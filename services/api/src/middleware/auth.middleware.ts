import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@field-ops/db';
import { AppError } from './error.middleware';
import { ERROR_CODES } from '@field-ops/shared';
import type { JwtPayload } from '@field-ops/shared';

declare global {
  namespace Express {
    interface Request {
      employee?: {
        id: string;
        role: string;
        employeeNumber: string;
      };
      device?: {
        id: string;
        employeeId: string | null;
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Missing authorization header');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.employee = {
      id: payload.employeeId,
      role: payload.role,
      employeeNumber: payload.sub,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Token expired');
    }
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid token');
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.employee) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    }
    if (!roles.includes(req.employee.role)) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
    }
    next();
  };
}

export async function authenticateDevice(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.headers['x-device-token'] as string | undefined;
    if (!token) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Missing device token');
    }

    const device = await prisma.device.findFirst({
      where: { deviceTokenHash: token },
      select: { id: true, employeeId: true, status: true },
    });

    if (!device) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid device token');
    }

    if (device.status === 'DECOMMISSIONED' || device.status === 'STOLEN') {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Device is not authorized');
    }

    req.device = { id: device.id, employeeId: device.employeeId };
    next();
  } catch (err) {
    next(err);
  }
}

export function internalServiceAuth(req: Request, _res: Response, next: NextFunction): void {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SERVICE_SECRET) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid internal service secret');
  }
  next();
}
