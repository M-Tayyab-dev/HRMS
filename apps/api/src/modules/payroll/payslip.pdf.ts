import PDFDocument from 'pdfkit';
import type { PayslipLine } from '../../db/schema';

export interface PayslipPdfData {
  company: string;
  currency: string;
  period: string; // YYYY-MM
  status: string;
  employee: { fullName: string; employeeCode: string; designation: string; departmentName: string; level: string; joiningDate?: string };
  scheduledMinutes: number;
  payableMinutes: number;
  lines: PayslipLine[];
  gross: number;
  totalDeductions: number;
  net: number;
}

const fmt = (n: number, cur: string) => `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Renders the monthly salary slip (D1). Returns a Buffer. */
export function renderPayslipPdf(d: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Salary slip ${d.period} – ${d.employee.fullName}`, Author: d.company } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ink = '#0f172a';
    const muted = '#64748b';
    const brand = '#1e40af';
    const W = doc.page.width - 96;

    // Header band
    doc.rect(0, 0, doc.page.width, 92).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(d.company, 48, 30, { width: W });
    doc.font('Helvetica').fontSize(11).text(`Salary slip · ${monthName(d.period)}`, 48, 58);

    // Employee block
    let y = 116;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text(d.employee.fullName, 48, y);
    doc.font('Helvetica').fontSize(9).fillColor(muted);
    const info: [string, string][] = [
      ['Employee ID', d.employee.employeeCode],
      ['Designation', d.employee.designation],
      ['Department', d.employee.departmentName],
      ['Level', d.employee.level],
      ['Scheduled hours', `${(d.scheduledMinutes / 60).toFixed(1)} h`],
      ['Paid hours', `${(Math.min(d.payableMinutes, d.scheduledMinutes) / 60).toFixed(1)} h`],
    ];
    y += 20;
    info.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 48 + col * (W / 2);
      doc.fillColor(muted).text(k, x, y + row * 16, { width: 90 });
      doc.fillColor(ink).text(v, x + 95, y + row * 16, { width: W / 2 - 100 });
    });
    y += Math.ceil(info.length / 2) * 16 + 18;

    const table = (title: string, rows: PayslipLine[], total: number, x: number, width: number) => {
      let ty = y;
      doc.rect(x, ty, width, 22).fill('#eef2ff');
      doc.fillColor(brand).font('Helvetica-Bold').fontSize(10).text(title, x + 8, ty + 7);
      ty += 28;
      doc.font('Helvetica').fontSize(9.5).fillColor(ink);
      if (!rows.length) {
        doc.fillColor(muted).text('—', x + 8, ty);
        ty += 16;
      }
      for (const r of rows) {
        doc.fillColor(ink).text(r.label, x + 8, ty, { width: width - 110 });
        doc.text(fmt(r.amount, d.currency), x + width - 108, ty, { width: 100, align: 'right' });
        ty += 16;
      }
      doc.moveTo(x, ty + 2).lineTo(x + width, ty + 2).strokeColor('#cbd5e1').stroke();
      doc.font('Helvetica-Bold').fillColor(ink).text('Total', x + 8, ty + 8);
      doc.text(fmt(total, d.currency), x + width - 108, ty + 8, { width: 100, align: 'right' });
      return ty + 26;
    };

    const earnings = d.lines.filter((l) => l.kind !== 'DEDUCTION');
    const deductions = d.lines.filter((l) => l.kind === 'DEDUCTION');
    const half = (W - 16) / 2;
    const y1 = table('Earnings', earnings, d.gross, 48, half);
    const y2 = table('Deductions', deductions, d.totalDeductions, 48 + half + 16, half);
    y = Math.max(y1, y2) + 10;

    doc.rect(48, y, W, 44).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text('Net pay', 64, y + 15);
    doc.fontSize(14).text(fmt(d.net, d.currency), 48, y + 14, { width: W - 16, align: 'right' });
    y += 64;

    doc.font('Helvetica').fontSize(8).fillColor(muted);
    if (d.status !== 'APPROVED' && d.status !== 'PAID') doc.text(`DRAFT – status: ${d.status}. Not valid as a payment record.`, 48, y);
    doc.text('This is a computer-generated document and does not require a signature.', 48, doc.page.height - 70, { width: W, align: 'center' });
    doc.end();
  });
}
