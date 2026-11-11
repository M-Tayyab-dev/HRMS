// Full workflow test against a running local API. Usage: node scripts/e2e-flows.mjs
import { randomBytes } from 'node:crypto';
import { Client, expect, testPassword } from './smoke.mjs';

const TZ = 'Asia/Karachi';
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = ymd(new Date());
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const dow = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
const prevWeekday = (s, skip = 1) => {
  let d = s;
  let n = 0;
  while (n < skip) {
    d = addDays(d, -1);
    if (dow(d) >= 1 && dow(d) <= 5) n++;
  }
  return d;
};
const nextMonday = (() => {
  let d = addDays(today, 1);
  while (dow(d) !== 1) d = addDays(d, 1);
  return d;
})();
const pk = (date, hhmm) => `${date}T${hhmm}:00+05:00`;

async function login(workspace, email, password) {
  const c = new Client();
  await c.get('/auth/csrf');
  const r = await c.post('/auth/login', { workspace, email, password });
  expect(r.status === 200, `login ${email}`, r);
  return c;
}

async function main() {
  const ws = `e2e-${randomBytes(3).toString('hex')}`;
  const pw = testPassword();
  const admin = new Client();
  await admin.get('/auth/csrf');
  expect((await admin.post('/auth/signup', { companyName: 'E2E Ltd', workspace: ws, adminName: 'Sam Super', email: `sam@${ws}.test`, password: pw })).status === 201, 'tenant A signup');

  const depts = (await admin.get('/departments')).data;
  const sales = depts.find((d) => d.code === 'SALES');
  const hrDept = depts.find((d) => d.code === 'HR');
  const opsDept = depts.find((d) => d.code === 'OPS');
  const levels = (await admin.get(`/levels?departmentId=${sales.id}`)).data;
  const lvl = (code, list = levels) => list.find((l) => l.code === code);
  const hrLevels = (await admin.get(`/levels?departmentId=${hrDept.id}`)).data;
  const opsLevels = (await admin.get(`/levels?departmentId=${opsDept.id}`)).data;
  expect(levels.length === 7 && lvl('L2').title === 'Sales Executive', 'default B7 ladder provisioned');

  const joined = addDays(today, -60);
  const mk = async (name, email, deptId, levelId, roles, extra = {}) => {
    const r = await admin.post('/employees', { fullName: name, email, departmentId: deptId, levelId, designation: name.split(' ')[1] ?? 'Staff', joiningDate: joined, roles, sendInvite: false, ...extra });
    expect(r.status === 201, `create employee ${name}`, r);
    const p = await admin.post(`/access/users/${r.data.userId}/password`, { password: pw, mustChange: false });
    expect(p.status === 201, `set password ${name}`, p);
    return r.data;
  };
  const hr = await mk('Hina HR', `hina@${ws}.test`, hrDept.id, lvl('L3', hrLevels).id, ['HR']);
  const ops = await mk('Omar Ops', `omar@${ws}.test`, opsDept.id, lvl('L3', opsLevels).id, ['OPERATIONS']);
  const tl = await mk('Tariq Lead', `tariq@${ws}.test`, sales.id, lvl('L4').id, ['TEAM_LEAD']);
  const emp = await mk('Esha Exec', `esha@${ws}.test`, sales.id, lvl('L2').id, ['EMPLOYEE'], { dateOfBirth: `1995-${today.slice(5)}` });
  expect(emp.basicSalary === lvl('L2').defaultSalary, 'salary auto-filled from level (B7)');

  const team = await admin.post('/teams', { name: 'Sales Alpha', departmentId: sales.id, leadEmployeeId: tl.id });
  expect(team.status === 201, 'team created');
  expect((await admin.post(`/teams/${team.data.id}/members`, { employeeId: emp.id })).data.added === true, 'employee added to team');

  const HR = await login(ws, `hina@${ws}.test`, pw);
  const OPS = await login(ws, `omar@${ws}.test`, pw);
  const TL = await login(ws, `tariq@${ws}.test`, pw);
  const E = await login(ws, `esha@${ws}.test`, pw);

  // ---- Access control & data scope (F4)
  expect((await E.get('/employees')).status === 403, 'employee cannot list employees');
  expect((await E.get('/payroll/runs')).status === 403, 'employee cannot see payroll runs');
  expect((await E.get(`/employees/${tl.id}`)).status === 403, 'employee cannot open another profile');
  const tlView = await TL.get(`/employees/${emp.id}`);
  expect(tlView.status === 200 && tlView.data.basicSalary === null, 'team lead sees member profile with salary redacted');
  expect((await TL.get(`/employees/${hr.id}`)).status === 403, 'team lead cannot see non-members');
  const selfEdit = await E.req('PATCH', '/me/profile', { contactNo: '+92 300 1234567', bloodGroup: 'O+' });
  expect(selfEdit.status === 200, 'employee edits own allowed fields (B1)');

  // ---- Leave: Team Lead → HR (C3)
  const types = (await E.get('/leave/types')).data;
  const casual = types.find((t) => t.code === 'CASUAL');
  const lr = await E.post('/leave/requests', { leaveTypeId: casual.id, startDate: nextMonday, endDate: addDays(nextMonday, 1), reason: 'Family event' });
  expect(lr.status === 201 && lr.data.status === 'PENDING' && lr.data.currentStep === 'TEAM_LEAD', 'leave submitted to team lead', lr);
  expect((await HR.post(`/leave/requests/${lr.data.id}/decision`, { approve: true })).status === 403, 'HR cannot skip the team lead step');
  const inbox = (await TL.get('/approvals/inbox')).data;
  expect(inbox.some((i) => i.id === lr.data.id), 'leave appears in team lead inbox');
  expect((await TL.post(`/leave/requests/${lr.data.id}/decision`, { approve: true, comment: 'OK' })).data.currentStep === 'HR', 'team lead approval forwards to HR');
  expect((await HR.post(`/leave/requests/${lr.data.id}/decision`, { approve: true })).data.status === 'APPROVED', 'HR final approval');
  const bal = (await E.get('/leave/balances')).data.find((b) => b.code === 'CASUAL');
  expect(bal.used === 2 && bal.available === 12, 'leave balance updated (14 → 12)', bal);
  const cal = await E.get(`/calendar?month=${nextMonday.slice(0, 7)}`);
  expect(cal.data.leaves.some((l) => l.id === lr.data.id && l.status === 'APPROVED'), 'approved leave shows on calendar (C5)');
  const cancel = await E.post(`/leave/requests/${lr.data.id}/cancel`, { reason: 'Plans changed' });
  expect(cancel.data.cancellationStatus === 'REQUESTED', 'cancellation goes to HR', cancel);
  expect((await HR.post(`/leave/requests/${lr.data.id}/cancellation-decision`, { approve: true })).data.cancelled === true, 'HR cancels leave');
  const notif = (await E.get('/notifications/unread-count')).data;
  expect(notif.count >= 3, 'employee received notifications (G4)', notif);

  // ---- Biometric attendance & overtime (C1, C2)
  const dev = await admin.post('/attendance/devices', { name: 'Front door' });
  expect(dev.status === 201 && dev.data.apiKey, 'device registered');
  const d1 = prevWeekday(today, 1);
  const d2 = prevWeekday(today, 2);
  const devRes = await fetch('http://localhost:4000/api/v1/attendance/device/punches', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-key': dev.data.apiKey },
    body: JSON.stringify({ punches: [
      { employeeCode: emp.employeeCode, at: pk(d1, '09:00') }, { employeeCode: emp.employeeCode, at: pk(d1, '13:00') },
      { employeeCode: emp.employeeCode, at: pk(d1, '14:00') }, { employeeCode: emp.employeeCode, at: pk(d1, '20:00') },
      { employeeCode: emp.employeeCode, at: pk(d2, '09:40') }, { employeeCode: emp.employeeCode, at: pk(d2, '18:40') },
      { employeeCode: 'NOPE-1', at: pk(d2, '09:00') },
    ] }),
  });
  const devJson = await devRes.json();
  expect(devRes.status === 200 && devJson.inserted === 6 && devJson.unknownEmployeeCodes[0] === 'NOPE-1', 'device push accepted', devJson);
  const badDev = await fetch('http://localhost:4000/api/v1/attendance/device/punches', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-key': `${dev.data.apiKey.slice(0, 37)}wrong-secret-value-xx` }, body: JSON.stringify({ punches: [{ employeeCode: emp.employeeCode, at: pk(d1, '09:00') }] }) });
  expect(badDev.status === 401, 'invalid device key rejected');
  const days = (await E.get(`/attendance/days?from=${d2}&to=${d1}`)).data;
  const day1 = days.find((d) => d.date === d1);
  const day2 = days.find((d) => d.date === d2);
  expect(day1?.status === 'PRESENT' && day1.overtimeMinutes === 120, 'present day with 2h overtime', day1);
  expect(day2?.status === 'LATE' && day2.lateMinutes === 40, 'late arrival flagged', day2);
  const ot = (await TL.get('/attendance/overtime?status=PENDING')).data.find((o) => o.date === d1);
  expect(ot && ot.canDecide, 'overtime awaits team lead');
  expect((await TL.post(`/attendance/overtime/${ot.id}/decision`, { approve: true })).status === 400, 'overtime approval requires work description');
  expect((await TL.post(`/attendance/overtime/${ot.id}/decision`, { approve: true, workDescription: 'Client demo preparation' })).data.status === 'APPROVED', 'team lead approves overtime');
  const otBal = (await E.get('/attendance/compensation/balance')).data;
  expect(otBal.availableMinutes === 120, 'overtime balance available for compensation', otBal);
  const comp = await E.post('/attendance/compensation', { type: 'PAID', minutes: 120, reason: 'Paid compensation please' });
  expect(comp.status === 201, 'paid compensation requested (Sales has paid overtime)', comp);
  await TL.post(`/attendance/compensation/${comp.data.id}/decision`, { approve: true });
  expect((await HR.post(`/attendance/compensation/${comp.data.id}/decision`, { approve: true })).data.status === 'APPROVED', 'compensation approved TL → HR');

  // ---- KPI → incentive (E1, E2)
  const month = today.slice(0, 7);
  const target = await HR.post('/kpi/targets', { employeeId: emp.id, period: month, metric: 'Sales revenue', unit: 'PKR', targetValue: 1000000, incentiveType: 'PERCENT_OF_EXCESS', incentiveValue: 5 });
  expect(target.status === 201, 'HR sets KPI target');
  const sub = await E.post('/kpi/submissions', { targetId: target.data.id, period: month, metric: 'Sales revenue', achievedValue: 1200000 });
  await TL.post(`/kpi/submissions/${sub.data.id}/decision`, { approve: true, remarks: 'Great month' });
  expect((await HR.post(`/kpi/submissions/${sub.data.id}/decision`, { approve: true })).data.status === 'APPROVED', 'KPI approved TL → HR');
  const incs = (await E.get('/kpi/incentives?mine=true')).data;
  expect(incs.length === 1 && incs[0].amount === 10000, 'incentive = 5% of 200k excess', incs);

  // ---- Payroll: HR processes, HR + Operations approve (D1, H1)
  const run = await HR.post('/payroll/runs', { period: month });
  expect(run.status === 201 && run.data.employeeCount >= 5, 'payroll run calculated', run);
  expect((await HR.post(`/payroll/runs/${run.data.id}/submit`)).data.status === 'PENDING_APPROVAL', 'run submitted');
  expect((await HR.post(`/payroll/runs/${run.data.id}/decision`, { approve: true })).status === 403, 'maker cannot approve own payroll');
  expect((await OPS.post(`/payroll/runs/${run.data.id}/decision`, { approve: true })).status === 403, 'operations cannot approve before HR');
  expect((await admin.post(`/payroll/runs/${run.data.id}/decision`, { approve: true })).data.status === 'PENDING_APPROVAL', 'HR-stage approval by another approver');
  expect((await OPS.post(`/payroll/runs/${run.data.id}/decision`, { approve: true })).data.status === 'APPROVED', 'operations final approval');
  const slips = (await E.get('/payroll/me/payslips')).data;
  expect(slips.length === 1, 'employee sees their payslip');
  const slip = (await E.get(`/payroll/payslips/${slips[0].id}`)).data;
  const codes = slip.lines.map((l) => l.code);
  expect(codes.includes('INCENTIVE') && codes.includes('OVERTIME'), 'slip includes incentive and paid overtime', slip.lines);
  const pdf = await E.req('GET', `/payroll/payslips/${slips[0].id}/pdf`, undefined, { raw: true });
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  expect(pdf.headers.get('content-type') === 'application/pdf' && pdfBytes.subarray(0, 5).toString() === '%PDF-', 'salary slip PDF generated');
  const otherSlip = (await HR.get(`/payroll/runs/${run.data.id}`)).data.payslips.find((p) => p.employeeId !== emp.id);
  expect((await E.get(`/payroll/payslips/${otherSlip.id}`)).status === 403, 'employee cannot read another payslip');

  // ---- Anonymous complaint (F3)
  const fd = new FormData();
  fd.set('category', 'MISCONDUCT');
  fd.set('description', 'Something inappropriate happened in the meeting room on Monday.');
  const cRes = await fetch('http://localhost:4000/api/v1/complaints', {
    method: 'POST',
    headers: { cookie: [...E.jar].map(([k, v]) => `${k}=${v}`).join('; '), 'x-csrf-token': E.jar.get('hrms_csrf') },
    body: fd,
  });
  const cJson = await cRes.json();
  expect(cRes.status === 201 && cJson.trackingCode?.startsWith('CMP-'), 'complaint submitted with tracking code', cJson);
  const audit = (await admin.get('/access/audit?action=complaint.submitted')).data.items[0];
  expect(audit && audit.actorUserId === null && audit.ip === null && audit.metadata === null, 'complaint audit entry has no identity', audit);
  expect((await HR.get('/complaints')).data.length === 1, 'HR sees complaint');
  expect((await TL.get('/complaints')).status === 403, 'team lead cannot see complaints');
  expect((await E.post('/complaints/track', { trackingCode: cJson.trackingCode })).data.status === 'SUBMITTED', 'submitter can track status');

  // ---- Community (F2, G1)
  expect((await E.get('/community/feed')).status === 403, 'feed blocked until guidelines accepted');
  await E.post('/community/guidelines/accept');
  expect((await E.get('/community/feed')).status === 200, 'feed opens after acceptance');
  expect((await E.post('/community/posts', { body: 'Hello team!' })).status === 403, 'posting needs a grant');
  await HR.req('PUT', `/community/posting/${emp.userId}`, { canPost: true });
  const relog = await login(ws, `esha@${ws}.test`, pw);
  expect((await relog.post('/community/posts', { body: 'Hello team!' })).status === 201, 'granted employee can post');

  // ---- Survey (F7) & queries (F6)
  const sv = await HR.post('/surveys', { title: 'Pulse check', kind: 'GENERAL', audience: 'ALL', anonymous: true, questions: [{ id: 'q1', type: 'RATING', label: 'How happy are you?', required: true }] });
  await HR.post(`/surveys/${sv.data.id}/open`);
  expect((await E.post(`/surveys/${sv.data.id}/responses`, { answers: { q1: 4 } })).status === 201, 'survey answered');
  expect((await E.post(`/surveys/${sv.data.id}/responses`, { answers: { q1: 5 } })).status === 409, 'cannot answer twice');
  const res = (await HR.get(`/surveys/${sv.data.id}/results`)).data;
  expect(res.questions[0].average === 4, 'survey results aggregated');
  const q = await E.post('/queries', { subject: 'Payslip question', body: 'Why is my food allowance zero?' });
  expect(q.data.assignedToEmployeeId === tl.id, 'query auto-assigned to team lead');
  await TL.post(`/queries/${q.data.id}/messages`, { body: 'Checking with HR.' });
  expect((await E.get(`/queries/${q.data.id}`)).data.status === 'IN_PROGRESS', 'query moves to in progress on reply');

  // ---- Dashboards (A2)
  for (const [name, c] of [['employee', E], ['team lead', TL], ['HR', HR], ['operations', OPS], ['super admin', admin]]) {
    const d = await c.get('/dashboard');
    expect(d.status === 200, `${name} dashboard loads`, d);
  }

  // ---- Tenant isolation (RLS)
  const other = new Client();
  await other.get('/auth/csrf');
  await other.post('/auth/signup', { companyName: 'Other Co', workspace: `${ws}-b`, adminName: 'Bob', email: `bob@${ws}-b.test`, password: pw });
  expect((await other.get(`/employees/${emp.id}`)).status === 404, 'other tenant cannot read employee (RLS)');
  expect((await other.get(`/payroll/payslips/${slips[0].id}`)).status === 403, 'other tenant cannot read payslip');
  const otherList = (await other.get('/employees')).data;
  expect(otherList.total === 1, 'other tenant sees only its own employees');

  console.log(`\nAll flows passed for workspace "${ws}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
