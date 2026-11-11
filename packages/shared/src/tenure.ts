/** "Member for 1 year 2 months" (B5). Dates are YYYY-MM-DD strings. */
export function tenureLabel(joiningDate: string, today: string = new Date().toISOString().slice(0, 10)): string {
  const [jy, jm, jd] = joiningDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let months = (ty - jy) * 12 + (tm - jm);
  if (td < jd) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(jy, jm - 1, jd)) / 86_400_000));
    return days <= 1 ? 'Joined recently' : `Member for ${days} days`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} year${y > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} month${m > 1 ? 's' : ''}`);
  return `Member for ${parts.join(' ')}`;
}

/** "Since Jan 2026". */
export function sinceLabel(joiningDate: string): string {
  const [y, m] = joiningDate.split('-').map(Number) as [number, number];
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `Since ${month} ${y}`;
}
