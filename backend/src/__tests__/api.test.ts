import request from 'supertest';
import app from '../app';
import { pool } from '../db/pool';

afterAll(async () => { await pool.end().catch(() => {}); });

// DB-free API contract tests: routing, validation, error envelope, headers.
describe('API surface', () => {
  it('GET / returns landing json', async () => {
    const r = await request(app).get('/');
    expect(r.status).toBe(200); expect(r.body.name).toMatch(/Dayflow/); expect(r.body.apiDocs).toBe('/api/docs');
  });
  it('GET /api/health reports drivers and db target without secrets', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200); expect(r.body.status).toBe('ok');
    expect(r.body.drivers).toEqual(expect.objectContaining({ storage: expect.any(String), mail: expect.any(String), rateLimit: expect.any(String) }));
    expect(JSON.stringify(r.body)).not.toMatch(/password|secret|token/i);
  });
  it('GET /api/openapi.json is a valid OpenAPI 3 document', async () => {
    const r = await request(app).get('/api/openapi.json');
    expect(r.body.openapi).toMatch(/^3\./); expect(Object.keys(r.body.paths).length).toBeGreaterThan(40);
  });
  it('sets X-Request-Id (honouring upstream)', async () => {
    const r = await request(app).get('/api/health').set('X-Request-Id', 'abc123');
    expect(r.headers['x-request-id']).toBe('abc123');
  });
  it('unknown /api route → 404 envelope', async () => {
    const r = await request(app).get('/api/nope');
    expect(r.status).toBe(404); expect(r.body.error.code).toBe('NOT_FOUND');
  });
  it('protected route without token → 401 envelope', async () => {
    const r = await request(app).get('/api/employees');
    expect(r.status).toBe(401); expect(r.body.error.code).toBe('UNAUTHORIZED');
  });
  it('POST /api/auth/login validates body before touching the DB', async () => {
    const r = await request(app).post('/api/auth/login').send({ identifier: '' });
    expect(r.status).toBe(400); expect(r.body.error.code).toBe('VALIDATION_ERROR'); expect(r.body.error.details[0].path).toBe('identifier');
  });
  it('POST /api/auth/signup enforces password policy', async () => {
    const r = await request(app).post('/api/auth/signup').send({ companyName: 'Acme', name: 'A B', email: 'a@b.co', password: 'weak' });
    expect(r.status).toBe(400); expect(r.body.error.message).toMatch(/8 characters/);
  });
  it('LinkedIn callback with bad state redirects to the frontend error page', async () => {
    const r = await request(app).get('/api/linkedin/callback?state=bogus&code=x');
    expect(r.status).toBe(302); expect(r.headers.location).toMatch(/\/linkedin\/return\?status=error&code=LINKEDIN_INVALID_STATE/);
  });
  it('rate limiter counts per key and blocks past max', async () => {
    const { rateLimit } = await import('../middleware/rateLimit');
    const mw = rateLimit({ windowMs: 60_000, max: 2, keyGenerator: () => 'test-key' });
    const run = () => new Promise<number>(resolve => {
      const res: any = { headers: {} as any, setHeader: (k: string, v: string) => { res.headers[k] = v; }, status: (c: number) => ({ json: () => resolve(c) }) };
      mw({ ip: '1.1.1.1' } as any, res, () => resolve(200));
    });
    expect(await run()).toBe(200); expect(await run()).toBe(200); expect(await run()).toBe(429);
  });
});
