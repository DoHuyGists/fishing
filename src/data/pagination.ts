import type { ListPage, PageSize } from '../types/model/pagination';

export const LIST_PAGE_SIZE: PageSize = 10;
export const COMPACT_PAGE_SIZE: PageSize = 5;

export function pageRange(page: number, size: PageSize = LIST_PAGE_SIZE): [number, number] {
  const start = (Math.max(1, Math.trunc(page) || 1) - 1) * size;
  return [start, start + size - 1];
}

export function listPage<T>(items: T[] | null, total: number | null): ListPage<T> {
  return { items: items ?? [], total: total ?? 0 };
}

export function escapeLike(search: string): string {
  return search.trim().replace(/[\\%_]/g, '\\$&');
}
