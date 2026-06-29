import jwt from 'jsonwebtoken';
import { prisma, EmployeeStatus } from '@field-ops/db';
import { AppError } from '../middleware/error.middleware';
import { ERROR_CODES } from '@field-ops/shared';
import type { AuthTokens } from '@field-ops/shared';

export async function loginWithPhone(
  phone: string,
  _password: string,
): Promise<AuthTokens & { employee: { id: string; role: string; firstName: string; lastName: string } }> {
  const employee = await prisma.employee.findUnique({
    where: { phone },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      // password hash would be stored in a separate auth table in prod
      // for now using a simple field approach — extend with proper auth table
    },
  });

  if (!employee) {
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
  }

  if (employee.status === EmployeeStatus.SUSPENDED || employee.status === EmployeeStatus.TERMINATED) {
    throw new AppError(403, ERROR_CODES.EMPLOYEE_SUSPENDED, 'Account is suspended or terminated');
  }

  // In production: compare against hashed password in auth table
  // Placeholder: require ADMIN role to use this endpoint or device token auth
  const tokens = issueTokens(employee.id, employee.employeeNumber, employee.role);

  return {
    ...tokens,
    employee: {
      id: employee.id,
      role: employee.role,
      firstName: employee.firstName,
      lastName: employee.lastName,
    },
  };
}

export function issueTokens(employeeId: string, employeeNumber: string, role: string): AuthTokens {
  const accessTokenOptions: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'],
  };
  const refreshTokenOptions: jwt.SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(
    { sub: employeeNumber, employeeId, role },
    process.env.JWT_SECRET!,
    accessTokenOptions,
  );

  const refreshToken = jwt.sign(
    { sub: employeeNumber, employeeId, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    refreshTokenOptions,
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // seconds
  };
}

export function refreshAccessToken(refreshToken: string): AuthTokens {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Refresh token invalid or expired');
  }

  if (payload['type'] !== 'refresh') {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Not a refresh token');
  }

  return issueTokens(payload['employeeId'], payload['sub']!, payload['role']);
}
