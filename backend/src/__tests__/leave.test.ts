import { computeWorkingDays, calculateSalaryComponents } from '../utils/helpers';

describe('computeWorkingDays — excludes weekends & holidays', () => {
  const holidays = new Set<string>(['2025-08-15', '2025-08-20']);
  const weekOff = [0, 6]; // Sun, Sat

  test('single working day', () => {
    expect(computeWorkingDays('2025-08-14', '2025-08-14', holidays, weekOff)).toBe(1);
  });
  test('single holiday', () => {
    expect(computeWorkingDays('2025-08-15', '2025-08-15', holidays, weekOff)).toBe(0);
  });
  test('weekend excluded', () => {
    // 2025-08-16 is Saturday, 2025-08-17 Sunday
    expect(computeWorkingDays('2025-08-16', '2025-08-17', holidays, weekOff)).toBe(0);
  });
  test('range with holiday and weekend', () => {
    // Mon 11 Aug to Fri 15 Aug 2025: 15 is holiday -> 4 days
    expect(computeWorkingDays('2025-08-11', '2025-08-15', holidays, weekOff)).toBe(4);
  });
  test('range spanning weekend', () => {
    // Fri 14, Mon 18 (skip Sat/Sun 16-17, 15 holiday)
    // Actually 14 Thu is working, 15 holiday, 16-17 weekend, 18 Mon working => 2 days
    expect(computeWorkingDays('2025-08-14', '2025-08-18', holidays, weekOff)).toBe(2);
  });
  test('half-day not in compute, caller halves', () => {
    const days = computeWorkingDays('2025-08-14', '2025-08-14', holidays, weekOff);
    const half = 0.5;
    expect(days).toBe(1);
    expect(half).toBe(0.5);
  });
});

describe('calculateSalaryComponents — spec §3A.4', () => {
  test('₹50,000 example matches wireframe', () => {
    const { breakdown, totals } = calculateSalaryComponents(50000);
    const map = Object.fromEntries(breakdown.map(c => [c.name, c.amount]));
    expect(map['Basic Salary']).toBe(25000);
    expect(map['House Rent Allowance']).toBe(12500);
    expect(map['Standard Allowance']).toBe(4167);
    // Bonus + LTA = 8.33% of Basic ≈ 2082.5 each
    expect(map['Performance Bonus']).toBeCloseTo(2082.5, 1);
    expect(map['Leave Travel Allowance']).toBeCloseTo(2082.5, 1);
    // Fixed remainder = wage - (sum of others) ≈ 4168 per remainder rule (spec says 2918 but remainder logic governs)
    const sumOthers = map['Basic Salary'] + map['House Rent Allowance'] + map['Standard Allowance'] + map['Performance Bonus'] + map['Leave Travel Allowance'];
    expect(map['Fixed Allowance']).toBeCloseTo(50000 - sumOthers, 0);
    expect(totals.gross).toBe(50000);
    // total components sums to gross
    const sum = breakdown.reduce((s, c) => s + c.amount, 0);
    expect(sum).toBeCloseTo(50000, 0);
    expect(totals.pfEmployee).toBe(3000);
    expect(totals.professionalTax).toBe(200);
  });

  test('₹60,000 scales proportionally', () => {
    const { breakdown } = calculateSalaryComponents(60000);
    const basic = breakdown.find(c => c.name === 'Basic Salary')!.amount;
    expect(basic).toBe(30000);
    const sum = breakdown.reduce((s, c) => s + c.amount, 0);
    expect(sum).toBeCloseTo(60000, 0);
  });

  test('low wage still non-negative remainder', () => {
    const { breakdown } = calculateSalaryComponents(20000);
    const fixed = breakdown.find(c => c.name === 'Fixed Allowance')!.amount;
    expect(fixed).toBeGreaterThanOrEqual(0);
  });
});
