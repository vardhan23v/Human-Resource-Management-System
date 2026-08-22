import { pool } from './pool';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { buildLoginId, generatePassword } from '../utils/helpers';
import fs from 'fs';

export async function runSeed() {
  console.log('Seeding Dayflow demo data...');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // clean previous demo? Only if dayflow empty we seed. Check companies count
    const [cCount]: any = await conn.execute('SELECT COUNT(*) as c FROM companies');
    if (cCount[0].c > 0) {
      console.log('DB already has companies, skipping full seed — adding demo check?');
      // ensure we still create demo if needed
    }
    // Create company Odoo India example? Use generic Dayflow demo company
    const companyId = uuid();
    const companyName = 'Odoo India';
    const initials = 'OI';
    await conn.execute('INSERT INTO companies (id, name, initials) VALUES (?,?,?)', [companyId, companyName, initials]);

    // Departments
    const deptNames = ['Engineering','Human Resources','Sales','Marketing','Finance'];
    const deptIds: Record<string,string> = {};
    for (const n of deptNames) {
      const id = uuid();
      deptIds[n]=id;
      await conn.execute('INSERT INTO departments (id, company_id, name) VALUES (?,?,?)', [id, companyId, n]);
    }
    // Settings
    const settings: Record<string, any> = {
      timezone: 'Asia/Kolkata',
      weekOffDays: [0,6],
      workingHoursThreshold: 8,
      halfDayThresholdHours: 4,
      graceMinutes: 15,
      approvalFlow: 'SINGLE',
      pfPercent: 12,
      professionalTax: 200,
    };
    for (const [k,v] of Object.entries(settings)) await conn.execute('INSERT INTO org_settings (company_id, setting_key, setting_value) VALUES (?,?,?)', [companyId, k, JSON.stringify(v)]);
    // Leave types
    const leaveTypes = [
      { name:'Paid Time Off', code:'PAID', quota:18, cap:5, accrual:'YEARLY', paid:1 },
      { name:'Sick Time Off', code:'SICK', quota:7, cap:0, accrual:'YEARLY', paid:1 },
      { name:'Casual Leave', code:'CASUAL', quota:6, cap:2, accrual:'YEARLY', paid:1 },
      { name:'Unpaid Leave', code:'UNPAID', quota:0, cap:0, accrual:'YEARLY', paid:0 },
    ];
    const ltIds: Record<string,string> = {};
    for (const t of leaveTypes) {
      const id=uuid(); ltIds[t.code]=id;
      await conn.execute('INSERT INTO leave_types (id, company_id, name, code, annual_quota, carry_forward_cap, accrual_type, is_paid) VALUES (?,?,?,?,?,?,?,?)',[id, companyId, t.name, t.code, t.quota, t.cap, t.accrual, t.paid]);
    }
    // Holidays (Indian 2025-26 sample)
    const holidays = [
      { date:'2025-01-26', name:'Republic Day' },
      { date:'2025-08-15', name:'Independence Day' },
      { date:'2025-10-02', name:'Gandhi Jayanti' },
      { date:'2025-12-25', name:'Christmas' },
      { date:'2026-01-26', name:'Republic Day' },
      { date:'2026-08-15', name:'Independence Day' },
    ];
    for (const h of holidays) {
      await conn.execute('INSERT INTO holidays (id, company_id, date, name, year) VALUES (?,?,?,?,?)',[uuid(), companyId, h.date, h.name, new Date(h.date).getFullYear()]);
    }
    await conn.execute('INSERT INTO join_serials (company_id, year, last_serial) VALUES (?,?,?) ON DUPLICATE KEY UPDATE last_serial=VALUES(last_serial)',[companyId, 2022, 0]);

    // Helper to create user+employee
    async function createEmp(opts:any){
      const year = new Date(opts.dateOfJoining).getFullYear();
      // increment serial
      await conn.execute('INSERT INTO join_serials (company_id, year, last_serial) VALUES (?,?,1) ON DUPLICATE KEY UPDATE last_serial=last_serial+1',[companyId, year]);
      const [sRows]:any=await conn.execute('SELECT last_serial FROM join_serials WHERE company_id=? AND year=?',[companyId, year]);
      const serial=sRows[0].last_serial;
      const loginId=buildLoginId(initials, opts.firstName, opts.lastName, year, serial);
      const pwd=opts.password || 'Password123';
      const hash=await bcrypt.hash(pwd,10);
      const userId=uuid();
      const empId=uuid();
      await conn.execute('INSERT INTO users (id, company_id, login_id, email, password_hash, role, status, email_verified_at) VALUES (?,?,?,?,?,?,?,NOW())',[userId, companyId, loginId, opts.email.toLowerCase(), hash, opts.role||'EMPLOYEE', 'ACTIVE']);
      await conn.execute('INSERT INTO employees (id, user_id, company_id, name, first_name, last_name, department_id, designation, date_of_joining, manager_id, lifecycle_state, location, phone, about, photo_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [empId, userId, companyId, `${opts.firstName} ${opts.lastName}`, opts.firstName, opts.lastName, deptIds[opts.department]||null, opts.designation||null, opts.dateOfJoining, opts.managerId||null, 'ACTIVE', opts.location||'Bangalore', opts.phone||null, opts.about||null, opts.photo||null]);
      // leave balances for current year
      for(const code of Object.keys(ltIds)){
        const ltId=ltIds[code];
        const [tRows]:any=await conn.execute('SELECT annual_quota FROM leave_types WHERE id=?',[ltId]);
        const quota=tRows[0].annual_quota;
        await conn.execute('INSERT INTO leave_balances (id, employee_id, leave_type_id, year, allocated, used) VALUES (?,?,?,?,?,?)',[uuid(), empId, ltId, new Date().getFullYear(), quota, 0]);
      }
      // salary structure
      const monthly=opts.monthlyWage||50000;
      const comps=JSON.stringify([
        { name:'Basic Salary', amount: monthly*0.5, rule:'50% of wage', percent:50 },
        { name:'House Rent Allowance', amount: monthly*0.25, rule:'50% of Basic', percent:50 },
        { name:'Standard Allowance', amount:4167, rule:'Fixed', percent:8.33 },
        { name:'Performance Bonus', amount: Math.round(monthly*0.5*0.0833), rule:'8.33% Basic', percent:8.33 },
        { name:'Leave Travel Allowance', amount: Math.round(monthly*0.5*0.0833), rule:'8.33% Basic', percent:8.33 },
        { name:'Fixed Allowance', amount: Math.max(0, monthly - (monthly*0.5 + monthly*0.25 + 4167 + Math.round(monthly*0.5*0.0833)*2)), rule:'Remainder', percent:11.67 },
      ]);
      await conn.execute('INSERT INTO salary_structures (id, employee_id, company_id, effective_from, monthly_wage, yearly_wage, wage_type, working_days_per_week, break_hours, components, pf_percent, professional_tax) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [uuid(), empId, companyId, `${new Date().getFullYear()}-01-01`, monthly, monthly*12, 'FIXED',5,1, comps,12,200]);
      return { userId, empId, loginId, email: opts.email, pwd };
    }

    // Admin
    const admin = await createEmp({ firstName:'Arjun', lastName:'Mehta', photo:'https://randomuser.me/api/portraits/men/32.jpg', email:'admin@dayflow.local', role:'ADMIN', department:'Human Resources', designation:'HR Admin', dateOfJoining:'2022-01-10', monthlyWage:80000, phone:'9876543210', location:'Mumbai' });
    console.log('Admin:', admin);
    // HR
    const hr = await createEmp({ firstName:'Priya', lastName:'Sharma', photo:'https://randomuser.me/api/portraits/women/44.jpg', email:'hr@dayflow.local', role:'HR', department:'Human Resources', designation:'HR Executive', dateOfJoining:'2022-02-15', monthlyWage:65000 });
    console.log('HR:', hr);
    // Manager
    const mgr = await createEmp({ firstName:'Vikram', lastName:'Singh', photo:'https://randomuser.me/api/portraits/men/75.jpg', email:'vikram.singh@dayflow.local', role:'MANAGER', department:'Engineering', designation:'Engineering Manager', dateOfJoining:'2022-03-01', monthlyWage:90000 });
    console.log('Manager:', mgr);

    const employees = [];
    const empData = [
      { fn:'John', ln:'Doe', photo:'https://randomuser.me/api/portraits/men/11.jpg', dept:'Engineering', desg:'Senior Developer', doj:'2022-04-12', wage:70000 },
      { fn:'Aisha', ln:'Khan', photo:'https://randomuser.me/api/portraits/women/65.jpg', dept:'Engineering', desg:'Frontend Developer', doj:'2023-01-05', wage:60000 },
      { fn:'Rohan', ln:'Patel', photo:'https://randomuser.me/api/portraits/men/46.jpg', dept:'Sales', desg:'Sales Executive', doj:'2023-06-20', wage:45000 },
      { fn:'Neha', ln:'Gupta', photo:'https://randomuser.me/api/portraits/women/21.jpg', dept:'Marketing', desg:'Marketing Specialist', doj:'2023-08-11', wage:50000 },
      { fn:'Karan', ln:'Malhotra', photo:'https://randomuser.me/api/portraits/men/22.jpg', dept:'Finance', desg:'Finance Analyst', doj:'2022-11-03', wage:55000 },
      { fn:'Sneha', ln:'Reddy', photo:'https://randomuser.me/api/portraits/women/57.jpg', dept:'Engineering', desg:'QA Engineer', doj:'2024-02-14', wage:48000 },
      { fn:'Amit', ln:'Verma', photo:'https://randomuser.me/api/portraits/men/85.jpg', dept:'Sales', desg:'Account Manager', doj:'2024-05-09', wage:52000 },
      { fn:'Divya', ln:'Nair', photo:'https://randomuser.me/api/portraits/women/33.jpg', dept:'Marketing', desg:'Content Lead', doj:'2023-03-22', wage:47000 },
      { fn:'Siddharth', ln:'Joshi', photo:'https://randomuser.me/api/portraits/men/54.jpg', dept:'Finance', desg:'Accountant', doj:'2024-01-30', wage:40000 },
      { fn:'Pooja', ln:'Desai', photo:'https://randomuser.me/api/portraits/women/12.jpg', dept:'Engineering', desg:'DevOps Engineer', doj:'2023-09-18', wage:62000 },
    ];
    for(const e of empData){
      const emp=await createEmp({ firstName:e.fn, lastName:e.ln, email:`${e.fn.toLowerCase()}.${e.ln.toLowerCase()}@dayflow.local`, role:'EMPLOYEE', department:e.dept, designation:e.desg, dateOfJoining:e.doj, monthlyWage:e.wage, managerId: mgr.empId, photo:e.photo });
      employees.push(emp);
    }
    console.log('Employees created:', employees.length);

    // Attendance: create 2 months of data for all
    const allEmps=[admin,hr,mgr,...employees];
    const today=new Date();
    for(let d=60; d>=0; d--){
      const day=new Date(today); day.setDate(today.getDate()-d);
      const dow=day.getDay();
      if(dow===0||dow===6) continue; // weekend skip mostly
      const dateStr=day.toISOString().slice(0,10);
      // holidays skip
      const isHoliday=holidays.some(h=>h.date===dateStr);
      if(isHoliday) continue;
      for(const emp of allEmps){
        // random absent 5%
        if(Math.random()<0.05) continue;
        // leave 3%
        if(Math.random()<0.03){
          await conn.execute('INSERT INTO attendances (id, employee_id, company_id, date, status, source) VALUES (?,?,?,?,?,?)',[uuid(), emp.empId, companyId, dateStr, 'LEAVE','SYSTEM']);
          continue;
        }
        const checkIn=new Date(`${dateStr}T09:${String(5+Math.floor(Math.random()*20)).padStart(2,'0')}:00`);
        const checkOut=new Date(`${dateStr}T18:${String(10+Math.floor(Math.random()*40)).padStart(2,'0')}:00`);
        const diff=Math.round((checkOut.getTime()-checkIn.getTime())/60000);
        const status= diff < 240 ? 'HALF_DAY' : 'PRESENT';
        const extra=Math.max(0,diff-480);
        await conn.execute('INSERT INTO attendances (id, employee_id, company_id, date, check_in, check_out, worked_minutes, extra_minutes, status, late_flag, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [uuid(), emp.empId, companyId, dateStr, checkIn.toISOString().slice(0,19).replace('T',' '), checkOut.toISOString().slice(0,19).replace('T',' '), diff, extra, status, checkIn.getHours()>9|| (checkIn.getHours()==9 && checkIn.getMinutes()>15) ? 1:0, 'WEB']);
      }
    }
    // Add a pending leave request for demo
    const demoEmp=employees[0];
    const paidId=ltIds['PAID'];
    const nextWeek=new Date(); nextWeek.setDate(today.getDate()+3);
    const nextWeekEnd=new Date(nextWeek); nextWeekEnd.setDate(nextWeek.getDate()+1);
    await conn.execute('INSERT INTO leave_requests (id, employee_id, company_id, leave_type_id, start_date, end_date, days, remarks, status) VALUES (?,?,?,?,?,?,?,?,?)',
      [uuid(), demoEmp.empId, companyId, paidId, nextWeek.toISOString().slice(0,10), nextWeekEnd.toISOString().slice(0,10), 2, 'Family event', 'PENDING']);
    // Add notification
    await conn.execute('INSERT INTO notifications (id, user_id, company_id, type, title, payload) VALUES (?,?,?,?,?,?)',[uuid(), hr.userId, companyId, 'LEAVE_APPLIED', 'New leave request from John Doe', JSON.stringify({ employee: demoEmp.empId })]);

    await conn.commit();
    console.log('Seed completed successfully');
    console.log(`\nDemo credentials (password = Password123):`);
    console.log(`Admin: admin@dayflow.local / ${admin.loginId}`);
    console.log(`HR: hr@dayflow.local / ${hr.loginId}`);
    console.log(`Manager: vikram.singh@dayflow.local / ${mgr.loginId}`);
    console.log(`Employee: john.doe@dayflow.local / ${employees[0].loginId}`);
  } catch(e){
    await conn.rollback();
    console.error('Seed failed', e);
    throw e;
  } finally {
    conn.release();
  }
}
if (require.main === module) {
  runSeed().then(() => process.exit(0)).catch(() => process.exit(1));
}
