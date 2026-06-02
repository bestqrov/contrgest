import rateLimit from 'express-rate-limit';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function rateLimiter(options: RateLimitOptions = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? parseInt(process.env.API_RATE_LIMIT_WINDOW_MS ?? '900000', 10),
    max: options.max ?? parseInt(process.env.API_RATE_LIMIT_MAX ?? '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: options.message ?? 'Too many requests, please try again later',
    },
  });
}
