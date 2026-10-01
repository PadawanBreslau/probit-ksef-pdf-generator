import { Router } from 'express';

export interface HealthResponseBody {
  status: 'ok';
  uptime: number;
}

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res): void => {
    const body: HealthResponseBody = { status: 'ok', uptime: Math.round(process.uptime()) };

    res.json(body);
  });

  return router;
}
