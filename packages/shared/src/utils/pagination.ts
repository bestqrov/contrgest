import type { PaginationMeta, PaginatedQuery } from '../types/api.types';

export function parsePagination(query: PaginatedQuery): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
