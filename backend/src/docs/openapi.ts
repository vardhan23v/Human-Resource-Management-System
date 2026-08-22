import { env } from '../config/env';

const bearer = [{ bearerAuth: [] }];
const ok = (desc = 'OK') => ({ 200: { description: desc }, 400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } });
const op = (tag: string, summary: string, opts: any = {}) => ({ tags: [tag], summary, security: opts.public ? [] : bearer, ...(opts.body ? { requestBody: { required: true, content: { 'application/json': { schema: opts.body } } } } : {}), parameters: opts.params, responses: opts.responses || ok() });
const str = (d?: string) => ({ type: 'string', ...(d ? { description: d } : {}) });
const q = (name: string, d?: string) => ({ name, in: 'query', schema: str(d) });
const pth = (name: string) => ({ name, in: 'path', required: true, schema: { type: 'string' } });

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'Dayflow HRMS API', version: env.APP_VERSION, description: 'Employee directory, attendance, time off, payroll, notifications, audit and LinkedIn integration. Every response is `{ data }` or `{ error: { code, message, details? } }`.' },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: { Error: { type: 'object', properties: { error: { type: 'object', properties: { code: str(), message: str(), details: {} } } } } },
  },
  tags: ['System', 'Auth', 'Employees', 'Attendance', 'Leave', 'Payroll', 'Org', 'Reports', 'Notifications', 'Audit', 'LinkedIn'].map(name => ({ name })),
  paths: {
    '/health': { get: op('System', 'Liveness + driver/DB diagnostics (no secrets)', { public: true }) },
    '/auth/signup': { post: op('Auth', 'Create company + first Admin', { public: true, body: { type: 'object', required: ['companyName', 'name', 'email', 'password'], properties: { companyName: str(), name: str(), email: str(), password: str('>=8 chars, upper/lower/digit'), logoUrl: str('data URI, optional') } } }) },
    '/auth/login': { post: op('Auth', 'Login with Login ID or email', { public: true, body: { type: 'object', required: ['identifier', 'password'], properties: { identifier: str(), password: str() } } }) },
    '/auth/refresh': { post: op('Auth', 'Rotate refresh token', { public: true, body: { type: 'object', properties: { refreshToken: str() } } }) },
    '/auth/logout': { post: op('Auth', 'Revoke refresh token') },
    '/auth/me': { get: op('Auth', 'Current user + employee/company context') },
    '/auth/change-password': { post: op('Auth', 'Change password', { body: { type: 'object', properties: { currentPassword: str(), newPassword: str() } } }) },
    '/auth/forgot-password': { post: op('Auth', 'Request reset token', { public: true, body: { type: 'object', properties: { email: str() } } }) },
    '/auth/reset-password': { post: op('Auth', 'Reset with token', { public: true, body: { type: 'object', properties: { token: str(), newPassword: str() } } }) },
    '/auth/employees': { post: op('Auth', 'Create employee (ADMIN/HR): generates Login ID + temp password', { body: { type: 'object', properties: { firstName: str(), lastName: str(), email: str(), role: str('ADMIN|HR|MANAGER|EMPLOYEE'), department: str(), designation: str(), dateOfJoining: str('YYYY-MM-DD'), managerId: str() } } }) },
    '/employees': { get: op('Employees', 'List / search (role-scoped)', { params: [q('search'), q('department'), q('page'), q('limit')] }) },
    '/employees/{id}': { get: op('Employees', 'Profile', { params: [pth('id')] }), patch: op('Employees', 'Update (field-level permissions)', { params: [pth('id')] }) },
    '/employees/{id}/documents': { post: op('Employees', 'Upload document (multipart, 5 MB)', { params: [pth('id')] }) },
    '/employees/{id}/documents/{docId}/download': { get: op('Employees', 'Download document', { params: [pth('id'), pth('docId')] }) },
    '/employees/{id}/skills': { post: op('Employees', 'Add skill', { params: [pth('id')] }) },
    '/employees/{id}/certifications': { post: op('Employees', 'Add certification', { params: [pth('id')] }) },
    '/employees/departments/list': { get: op('Employees', 'Departments') },
    '/employees/departments': { post: op('Employees', 'Create department (ADMIN)') },
    '/attendance/check-in': { post: op('Attendance', 'Check in') },
    '/attendance/check-out': { post: op('Attendance', 'Check out') },
    '/attendance/today': { get: op('Attendance', 'Today state') },
    '/attendance': { get: op('Attendance', 'Records by day or month', { params: [q('date', 'YYYY-MM-DD'), q('month', 'YYYY-MM')] }) },
    '/attendance/calendar': { get: op('Attendance', 'Month grid / heat-map', { params: [q('month'), q('employeeId')] }) },
    '/attendance/regularizations': { post: op('Attendance', 'Request correction') },
    '/attendance/regularizations/list': { get: op('Attendance', 'List regularizations (scoped)') },
    '/attendance/regularizations/{id}/decide': { post: op('Attendance', 'Approve / reject (ADMIN/HR/MANAGER)', { params: [pth('id')], body: { type: 'object', properties: { action: str('APPROVED|REJECTED') } } }) },
    '/leave/types': { get: op('Leave', 'Leave types'), post: op('Leave', 'Create type (ADMIN)') },
    '/leave/types/{id}': { patch: op('Leave', 'Update type (ADMIN)', { params: [pth('id')] }) },
    '/leave/balances': { get: op('Leave', 'Live balances', { params: [q('year')] }) },
    '/leave/requests': { get: op('Leave', 'Requests (scoped)'), post: op('Leave', 'Apply', { body: { type: 'object', required: ['leaveTypeId', 'startDate', 'endDate'], properties: { leaveTypeId: str(), startDate: str(), endDate: str(), halfDay: { type: 'boolean' }, reason: str() } } }) },
    '/leave/requests/{id}/cancel': { post: op('Leave', 'Cancel / request cancellation', { params: [pth('id')] }) },
    '/leave/requests/{id}/decide': { post: op('Leave', 'Approve / reject (ADMIN/HR/MANAGER)', { params: [pth('id')] }) },
    '/leave/calendar': { get: op('Leave', 'Team leave calendar', { params: [q('month')] }) },
    '/payroll/salary': { post: op('Payroll', 'Upsert salary structure (ADMIN/HR)') },
    '/payroll/salary/{employeeId}': { get: op('Payroll', 'Salary structure', { params: [pth('employeeId')] }) },
    '/payroll/salary-structures/list': { get: op('Payroll', 'All structures (ADMIN/HR)') },
    '/payroll/run': { post: op('Payroll', 'Run month (idempotent)', { body: { type: 'object', required: ['month'], properties: { month: str('YYYY-MM') } } }) },
    '/payroll/finalize': { post: op('Payroll', 'Finalize month (ADMIN)') },
    '/payroll/payslips': { get: op('Payroll', 'Payslips (scoped)', { params: [q('month')] }) },
    '/payroll/payslips/{id}': { get: op('Payroll', 'Payslip', { params: [pth('id')] }) },
    '/payroll/payslips/{id}/pdf': { get: op('Payroll', 'Payslip PDF', { params: [pth('id')] }) },
    '/holidays': { get: op('Org', 'Holidays'), post: op('Org', 'Add holiday (ADMIN)') },
    '/holidays/{id}': { delete: op('Org', 'Delete holiday (ADMIN)', { params: [pth('id')] }) },
    '/org-settings': { get: op('Org', 'Settings (ADMIN)'), patch: op('Org', 'Update settings (ADMIN)') },
    '/reports/dashboard-stats': { get: op('Reports', 'Dashboard KPIs') },
    '/reports/attendance-summary': { get: op('Reports', 'Attendance summary', { params: [q('from'), q('to')] }) },
    '/reports/leave-utilization': { get: op('Reports', 'Leave utilisation', { params: [q('year')] }) },
    '/reports/headcount': { get: op('Reports', 'Headcount by department') },
    '/reports/late-arrivals': { get: op('Reports', 'Late arrivals', { params: [q('from'), q('to')] }) },
    '/reports/export/attendance': { get: op('Reports', 'CSV export', { params: [q('from'), q('to')] }) },
    '/notifications': { get: op('Notifications', 'List') },
    '/notifications/{id}/read': { post: op('Notifications', 'Mark read', { params: [pth('id')] }) },
    '/notifications/read-all': { post: op('Notifications', 'Mark all read') },
    '/audit-logs': { get: op('Audit', 'Audit trail (ADMIN; HR read)') },
    '/linkedin/status': { get: op('LinkedIn', 'Connection status (never includes tokens)') },
    '/linkedin/connect': { get: op('LinkedIn', 'Authorization URL') },
    '/linkedin/callback': { get: op('LinkedIn', 'OAuth callback (browser redirect target)', { public: true, params: [q('code'), q('state')] }) },
    '/linkedin/disconnect': { post: op('LinkedIn', 'Disconnect') },
    '/linkedin/posts': { post: op('LinkedIn', 'Publish a post', { body: { type: 'object', required: ['text'], properties: { text: str('<=3000 chars'), url: str(), title: str() } } }) },
    '/linkedin/diagnostics': { get: op('LinkedIn', 'Credential probe (ADMIN)') },
  },
};

export const docsHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Dayflow API docs</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0"><script id="api-reference" data-url="/api/openapi.json"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script></body></html>`;
