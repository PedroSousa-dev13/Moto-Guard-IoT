import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

vi.mock('../controllers/gpx.controller', () => ({
  importGpx: (req: any, res: any) => res.status(200).json({ success: true }),
  parseGpxFile: (req: any, res: any) => res.status(200).json({ success: true, waypoints: [] }),
  exportTripGpx: (req: any, res: any) => res.status(200).send('GPX DATA'),
  saveSimulatorGpxData: (req: any, res: any) => res.status(200).json({ success: true }),
}));

vi.mock('../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.userId = 'test-user-id';
    next();
  },
}));

vi.mock('../middleware/csrf.middleware', () => ({
  csrfMiddleware: (req: any, res: any, next: any) => {
    next();
  },
}));

describe('Gpx Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import GPX file', async () => {
    const response = await request(app)
      .post('/api/gpx/import')
      .attach('file', Buffer.from('<gpx></gpx>'), 'test.gpx');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should parse GPX file', async () => {
    const response = await request(app)
      .post('/api/gpx/parse')
      .attach('file', Buffer.from('<gpx></gpx>'), 'test.gpx');
    
    expect(response.status).toBe(200);
    expect(response.body.waypoints).toBeDefined();
  });

  it('should export GPX file', async () => {
    const response = await request(app).get('/api/gpx/export/t1');
    expect(response.status).toBe(200);
    expect(response.text).toBe('GPX DATA');
  });

  it('should save simulator GPX data', async () => {
    const response = await request(app)
      .post('/api/gpx/simulator')
      .send({ waypoints: [] });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
