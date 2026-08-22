import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Login ID or email is required').max(255),
  password: z.string().min(1, 'Password is required').max(200),
});
export const signupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200)
    .regex(/[A-Z]/, 'Needs an uppercase letter').regex(/[a-z]/, 'Needs a lowercase letter').regex(/\d/, 'Needs a digit'),
  logoUrl: z.string().max(2_000_000).optional().nullable(),
}).passthrough();
export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  halfDay: z.boolean().optional(),
  reason: z.string().max(1000).optional().nullable(),
}).passthrough().refine(v => v.endDate >= v.startDate, { message: 'endDate must be on or after startDate', path: ['endDate'] });
export const linkedinPostSchema = z.object({
  text: z.string().trim().min(1, 'Post text is required').max(3000),
  url: z.string().trim().url().max(2048).optional().or(z.literal('')),
  title: z.string().trim().max(200).optional(),
});
export const payrollRunSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM') });
