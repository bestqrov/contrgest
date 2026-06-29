import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { loginWithPhone, refreshAccessToken } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';

export const authRouter: Router = Router();

const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await loginWithPhone(body.phone, body.password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = refreshSchema.parse(req.body);
    const tokens = refreshAccessToken(body.refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: req.employee });
});
