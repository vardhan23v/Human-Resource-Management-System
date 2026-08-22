// tiny in-house validator (no zod) — spec §6: minimal dependencies
export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
export function isStrongPassword(v: string) {
  return v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v);
}
export function requireString(v: any, field: string, min = 1, max = 1000) {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max) throw new Error(`${field} must be ${min}-${max} chars`);
  return v.trim();
}
export function requireEmail(v: any) {
  if (!isEmail(String(v))) throw new Error('Invalid email');
  return String(v).toLowerCase().trim();
}
export function validateSignupCompany(body: any) {
  const errors: string[] = [];
  try { requireString(body.companyName, 'companyName', 2, 255); } catch (e: any) { errors.push(e.message); }
  try { requireString(body.name, 'name', 2, 255); } catch (e: any) { errors.push(e.message); }
  try { requireEmail(body.email); } catch (e: any) { errors.push(e.message); }
  if (!isStrongPassword(body.password || '')) errors.push('Password must be 8+ chars with upper/lower/digit');
  if (body.password !== body.confirmPassword) errors.push('Passwords do not match');
  if (errors.length) throw new Error(errors.join('; '));
}
export function validateEmployeeCreate(body: any) {
  const errors: string[] = [];
  try { requireString(body.firstName, 'firstName', 1, 100); } catch (e:any){errors.push(e.message);}
  try { requireString(body.lastName, 'lastName', 1, 100); } catch (e:any){errors.push(e.message);}
  try { requireEmail(body.email); } catch(e:any){errors.push(e.message);}
  if (!body.dateOfJoining) errors.push('dateOfJoining required');
  if (!body.departmentId && !body.departmentName) errors.push('department required');
  if (errors.length) throw new Error(errors.join('; '));
}
