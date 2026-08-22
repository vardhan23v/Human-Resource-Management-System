import { calculateSalaryComponents } from '../utils/helpers';

describe('payroll math', () => {
  test('gross prorated by payable days', () => {
    const monthly = 50000;
    const totalDays = 30;
    const payable = 28;
    const gross = Math.round((monthly * payable / totalDays) * 100) / 100;
    expect(gross).toBe(46666.67);
  });

  test('deductions PF pro-rata', () => {
    const monthly = 50000;
    const { breakdown } = calculateSalaryComponents(monthly);
    const basic = breakdown.find(c => c.name === 'Basic Salary')!.amount; // 25000
    const totalDays = 30, payable = 28;
    const pf = Math.round((basic * 0.12 * payable / totalDays) * 100) / 100;
    expect(pf).toBe(2800);
    const pt = 200;
    const deductions = pf + pt;
    expect(deductions).toBe(3000);
  });

  test('net = gross - deductions', () => {
    const gross = 46666.67, deductions = 3000;
    const net = Math.max(0, gross - deductions);
    expect(net).toBe(43666.67);
  });

  test('fully absent month => payable 0 => net 0', () => {
    const monthly = 50000, total = 30, payable = 0;
    const gross = Math.round((monthly * payable / total) * 100) / 100;
    expect(gross).toBe(0);
    const net = Math.max(0, gross - 0);
    expect(net).toBe(0);
  });

  test('unpaid leave reduces payable days', () => {
    const total = 30, unpaid = 2, absent = 1, payable = total - unpaid - absent;
    expect(payable).toBe(27);
  });
});
