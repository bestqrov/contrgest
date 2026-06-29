import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string | undefined {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;

  if (dbHost && dbName && dbUser && dbPassword) {
    const port = dbPort ?? '5432';
    return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${port}/${dbName}`;
  }

  return process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: resolveDatabaseUrl() ? { db: { url: resolveDatabaseUrl()! } } : undefined,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export default prisma;
