import { z } from 'zod';

/**
 * Reusable pagination query schema + helper. Coerces `page`/`limit` from query
 * strings, clamps `limit` to a sane max, and computes `skip`.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  sort: z.string().optional(),
});

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

export function getPageParams(query: { page?: number; limit?: number }): PageParams {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
