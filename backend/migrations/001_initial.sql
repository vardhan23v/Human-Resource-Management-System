-- Dayflow HRMS — Initial Schema (MySQL 8.x, InnoDB, utf8mb4)
-- Mirrors spec §5 data model + 3A + hardened production choices

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  initials VARCHAR(10) NOT NULL COMMENT '2-3 letter initials for loginId, e.g. OI',
  logo_url VARCHAR(1024) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companies_initials (initials)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_dept_company_name (company_id, name),
  INDEX idx_dept_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  login_id VARCHAR(32) NOT NULL COMMENT '[CC][FFLL][YYYY][NNNN] e.g. OIJODO20220001',
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','HR','MANAGER','EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  status ENUM('INVITED','ACTIVE','ON_NOTICE','EXITED') NOT NULL DEFAULT 'ACTIVE',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  email_verified_at DATETIME NULL,
  two_fa_secret VARCHAR(255) NULL,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_users_login_id (login_id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_company (company_id),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Join serial counter (atomic per company per year)
CREATE TABLE IF NOT EXISTS join_serials (
  company_id CHAR(36) NOT NULL,
  year INT NOT NULL,
  last_serial INT NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employees (profile)
CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  photo_url VARCHAR(1024) NULL,
  dob DATE NULL,
  phone VARCHAR(32) NULL,
  address TEXT NULL,
  emergency_contact VARCHAR(255) NULL,
  personal_email VARCHAR(255) NULL,
  nationality VARCHAR(100) NULL,
  gender ENUM('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY') NULL,
  marital_status ENUM('SINGLE','MARRIED','DIVORCED','WIDOWED') NULL,
  department_id CHAR(36) NULL,
  designation VARCHAR(255) NULL,
  employment_type ENUM('FULL_TIME','PART_TIME','CONTRACT','INTERN') NOT NULL DEFAULT 'FULL_TIME',
  date_of_joining DATE NOT NULL,
  manager_id CHAR(36) NULL COMMENT 'self-ref to employees.id',
  lifecycle_state ENUM('INVITED','ACTIVE','ON_NOTICE','EXITED') NOT NULL DEFAULT 'ACTIVE',
  about TEXT NULL,
  what_i_love TEXT NULL,
  interests TEXT NULL,
  location VARCHAR(255) NULL,
  -- encrypted bank details (app-layer encryption, stored as TEXT)
  bank_account_enc TEXT NULL,
  bank_name VARCHAR(255) NULL,
  ifsc_code VARCHAR(32) NULL,
  pan_no VARCHAR(32) NULL,
  uan_no VARCHAR(32) NULL,
  emp_code VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL,
  UNIQUE KEY uq_employees_user (user_id),
  INDEX idx_emp_company (company_id),
  INDEX idx_emp_manager (manager_id),
  INDEX idx_emp_dept (department_id),
  INDEX idx_emp_lifecycle (lifecycle_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee documents vault
CREATE TABLE IF NOT EXISTS employee_documents (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  storage_path VARCHAR(1024) NOT NULL,
  category VARCHAR(100) NULL COMMENT 'offer_letter, id_proof, certificate, etc',
  uploaded_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  INDEX idx_docs_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Skills & Certifications (per employee)
CREATE TABLE IF NOT EXISTS employee_skills (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_skills_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_certifications (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  issuer VARCHAR(255) NULL,
  issued_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_certs_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance
CREATE TABLE IF NOT EXISTS attendances (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  date DATE NOT NULL COMMENT 'stored as org-local date, timestamps UTC',
  check_in DATETIME NULL COMMENT 'UTC',
  check_out DATETIME NULL COMMENT 'UTC',
  worked_minutes INT NULL,
  extra_minutes INT NULL DEFAULT 0,
  status ENUM('PRESENT','ABSENT','HALF_DAY','LEAVE','HOLIDAY','WEEK_OFF','WFH') NOT NULL DEFAULT 'ABSENT',
  late_flag TINYINT(1) NOT NULL DEFAULT 0,
  source ENUM('WEB','REGULARIZED','AUTO_CLOSED','SYSTEM') NOT NULL DEFAULT 'WEB',
  ip_address VARCHAR(45) NULL,
  device_info VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_attendance_emp_date (employee_id, date),
  INDEX idx_att_company_date (company_id, date),
  INDEX idx_att_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  year INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_holiday_company_date (company_id, date),
  INDEX idx_holiday_company_year (company_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leave types
CREATE TABLE IF NOT EXISTS leave_types (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL COMMENT 'Paid, Sick, Casual, etc',
  code VARCHAR(20) NOT NULL,
  annual_quota DECIMAL(5,2) NOT NULL DEFAULT 0,
  carry_forward_cap DECIMAL(5,2) NOT NULL DEFAULT 0,
  accrual_type ENUM('MONTHLY','YEARLY') NOT NULL DEFAULT 'YEARLY',
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  requires_attachment TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_leave_type_company_code (company_id, code),
  INDEX idx_lt_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leave balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  leave_type_id CHAR(36) NOT NULL,
  year INT NOT NULL,
  allocated DECIMAL(5,2) NOT NULL DEFAULT 0,
  used DECIMAL(5,2) NOT NULL DEFAULT 0,
  carried_forward DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_balance_emp_type_year (employee_id, leave_type_id, year),
  INDEX idx_bal_emp_year (employee_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  leave_type_id CHAR(36) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(5,2) NOT NULL COMMENT 'computed excluding weekends/holidays',
  half_day TINYINT(1) NOT NULL DEFAULT 0,
  half_day_part ENUM('FIRST_HALF','SECOND_HALF') NULL,
  remarks TEXT NULL,
  attachment_url VARCHAR(1024) NULL,
  status ENUM('PENDING','APPROVED','REJECTED','CANCELLED','CANCELLATION_REQUESTED') NOT NULL DEFAULT 'PENDING',
  decided_by CHAR(36) NULL,
  decision_comment TEXT NULL,
  decided_at DATETIME NULL,
  cancellation_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_lr_employee (employee_id),
  INDEX idx_lr_company_status (company_id, status),
  INDEX idx_lr_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance regularization requests
CREATE TABLE IF NOT EXISTS regularizations (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  date DATE NOT NULL,
  requested_check_in DATETIME NULL,
  requested_check_out DATETIME NULL,
  reason TEXT NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  decided_by CHAR(36) NULL,
  decision_comment TEXT NULL,
  decided_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reg_emp_date (employee_id, date),
  INDEX idx_reg_company_status (company_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Salary structures (effective-dated, history preserved)
CREATE TABLE IF NOT EXISTS salary_structures (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  effective_from DATE NOT NULL COMMENT 'first day of month',
  monthly_wage DECIMAL(12,2) NOT NULL,
  yearly_wage DECIMAL(12,2) NOT NULL,
  wage_type ENUM('FIXED') NOT NULL DEFAULT 'FIXED',
  working_days_per_week INT NOT NULL DEFAULT 5,
  break_hours DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  -- components as JSON: [{name, percent, base: 'WAGE'|'BASIC', isFixed: bool, amount? }]
  components JSON NOT NULL,
  -- rates
  pf_percent DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  professional_tax DECIMAL(10,2) NOT NULL DEFAULT 200.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_salary_emp_effective (employee_id, effective_from),
  INDEX idx_sal_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  month DATE NOT NULL COMMENT 'first day of month, e.g. 2024-08-01',
  gross DECIMAL(12,2) NOT NULL,
  deductions DECIMAL(12,2) NOT NULL,
  unpaid_leave_days DECIMAL(5,2) NOT NULL DEFAULT 0,
  payable_days INT NOT NULL,
  total_working_days INT NOT NULL,
  net DECIMAL(12,2) NOT NULL,
  breakdown JSON NOT NULL COMMENT 'full component breakdown + pf etc',
  pdf_url VARCHAR(1024) NULL,
  finalized_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_payslip_emp_month (employee_id, month),
  INDEX idx_payslip_company_month (company_id, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  payload JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  INDEX idx_notif_user (user_id, is_read, created_at),
  INDEX idx_notif_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NULL,
  company_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(36) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_company (company_id, created_at),
  INDEX idx_audit_entity (entity, entity_id),
  INDEX idx_audit_actor (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Org settings (key-value per company)
CREATE TABLE IF NOT EXISTS org_settings (
  company_id CHAR(36) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, setting_key),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens / sessions
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL COMMENT 'hash of refresh token',
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id),
  INDEX idx_rt_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_prt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
