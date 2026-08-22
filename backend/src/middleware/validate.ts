import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/errors';

/** Validates req[source] against a Zod schema; replaces it with the parsed (typed, stripped) value. */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse((req as any)[source]);
    if (!r.success) {
      const details = r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
      return next(new AppError(400, 'VALIDATION_ERROR', details[0] ? `${details[0].path || 'input'}: ${details[0].message}` : 'Invalid input', details));
    }
    (req as any)[source] = r.data;
    next();
  };
}
