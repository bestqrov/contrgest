import { Router, Request, Response } from 'express';
import { notifier } from '../services/notifier.service';
import { createLogger } from '@field-ops/shared';
import { prisma } from '@field-ops/db';

const logger = createLogger('alert-engine:internal');
export const internalRouter: Router = Router();

internalRouter.use((req: Request, res: Response, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

internalRouter.post('/notify', async (req: Request, res: Response) => {
  try {
    const { type, employeeId, ...meta } = req.body as {
      type: string;
      employeeId?: string;
      [key: string]: unknown;
    };

    let employeeName: string | undefined;
    if (employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });
      if (emp) employeeName = `${emp.firstName} ${emp.lastName}`;
    }

    await notifier.notifyOwner(
      type,
      `${type.replace(/_/g, ' ')} Alert`,
      JSON.stringify(meta),
      employeeName,
    );

    logger.info('Notification dispatched', { type, employeeId });
    res.json({ success: true });
  } catch (err) {
    logger.error('Notify failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Notification failed' });
  }
});
