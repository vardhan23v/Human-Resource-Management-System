import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const uuid = () => uuidv4();

export function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  // ensure policy
  if (!/[A-Z]/.test(s)) s = 'A' + s.slice(1);
  if (!/[a-z]/.test(s)) s = s.slice(0,1) + 'a' + s.slice(2);
  if (!/\d/.test(s)) s = s.slice(0,2) + '7' + s.slice(3);
  return s;
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// LoginId: [CC][FFLL][YYYY][NNNN]
export function buildLoginId(companyInitials: string, firstName: string, lastName: string, year: number, serial: number) {
  const cc = companyInitials.toUpperCase().slice(0, 3).padEnd(2, 'X');
  const ff = (firstName.slice(0,2) || 'XX').toUpperCase().padEnd(2,'X');
  const ll = (lastName.slice(0,2) || 'XX').toUpperCase().padEnd(2,'X');
  const nnnn = String(serial).padStart(4,'0');
  return `${cc}${ff}${ll}${year}${nnnn}`;
}

export function paginationParams(query: any) {
  const page = Math.max(1, parseInt(query.page || '1',10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20',10)));
  const offset = (page-1)*limit;
  return { page, limit, offset };
}

export function toUTCDateTimeString(d: Date) {
  return d.toISOString().slice(0,19).replace('T',' ');
}

// leave math helpers (pure, testable)
export function computeWorkingDays(start: string, end: string, holidaysSet: Set<string>, weekOffDays: number[] = [0,6]) {
  // holidaysSet contains YYYY-MM-DD
  // weekOffDays: 0 Sun ... 6 Sat
  let count = 0;
  let cur = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (cur <= endDate) {
    const iso = cur.toISOString().slice(0,10);
    const dow = cur.getUTCDay();
    if (!weekOffDays.includes(dow) && !holidaysSet.has(iso)) count += 1;
    cur.setUTCDate(cur.getUTCDate()+1);
  }
  return count;
}

export function calculateSalaryComponents(monthlyWage: number, overrides?: any) {
  // spec §3A.4 example on 50k: Basic 50% of wage, HRA 50% of Basic, Std 4167 fixed, Bonus 8.33% Basic, LTA 8.33% Basic, Fixed remainder
  const basic = monthlyWage * 0.5;
  const hra = basic * 0.5;
  const standardAllowance = 4167; // fixed amount (or could be param)
  const bonus = basic * 0.0833;
  const lta = basic * 0.0833;
  const fixed = Math.max(0, monthlyWage - (basic + hra + standardAllowance + bonus + lta));
  const pfEmp = basic * 0.12;
  const pfEmpr = basic * 0.12;
  const pt = 200;
  return {
    breakdown: [
      { name: 'Basic Salary', amount: round2(basic), rule: '50% of wage', percent: 50 },
      { name: 'House Rent Allowance', amount: round2(hra), rule: '50% of Basic', percent: 50 },
      { name: 'Standard Allowance', amount: round2(standardAllowance), rule: 'Fixed', percent: 8.33 },
      { name: 'Performance Bonus', amount: round2(bonus), rule: '8.33% of Basic', percent: 8.33 },
      { name: 'Leave Travel Allowance', amount: round2(lta), rule: '8.33% of Basic', percent: 8.33 },
      { name: 'Fixed Allowance', amount: round2(fixed), rule: 'Remainder', percent: round2((fixed/monthlyWage)*100) },
    ],
    totals: {
      gross: round2(monthlyWage),
      pfEmployee: round2(pfEmp),
      pfEmployer: round2(pfEmpr),
      professionalTax: pt,
      totalComponents: round2(basic+hra+standardAllowance+bonus+lta+fixed)
    }
  };
}
function round2(n:number){ return Math.round(n*100)/100; }

export function deriveAttendanceStatus(workedMinutes: number | null, isHoliday: boolean, isWeekOff: boolean, hasLeave: boolean) {
  if (isHoliday) return 'HOLIDAY';
  if (isWeekOff) return 'WEEK_OFF';
  if (hasLeave) return 'LEAVE';
  if (workedMinutes === null) return 'ABSENT';
  if (workedMinutes < 4*60) return 'ABSENT';
  if (workedMinutes < 8*60) return 'HALF_DAY';
  return 'PRESENT';
}
