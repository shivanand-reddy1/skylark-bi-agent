import { Router, Request, Response } from 'express';
import { mondayClient } from '../monday/client';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const status = await mondayClient.ping();
    res.json({
      status: 'ok',
      monday: status ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.json({
      status: 'degraded',
      monday: 'unreachable',
      timestamp: new Date().toISOString(),
    });
  }
});
