import { RepositoryError } from './repositoryError';

/** A complete catalog must never silently cache the Data API's first page. */
export async function readCatalogPages<T>(query: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null;
  status: number;
}>): Promise<T[]> {
  const rows: T[] = [], pageSize = 200;
  for (let offset = 0; offset <= 10_000;) {
    const { data, error, status } = await query(offset, offset + pageSize - 1);
    if (error) throw new RepositoryError({ ...error, status });
    rows.push(...data ?? []);
    if (rows.length > 10_000) throw new RepositoryError({ message: 'Catalog too large', code: 'CATALOG_SCHEMA_MISMATCH' });
    if (!data?.length) return rows;
    offset += data.length;
  }
  throw new RepositoryError({ message: 'Catalog too large', code: 'CATALOG_SCHEMA_MISMATCH' });
}
