import { RepositoryError } from './repositoryError';

/** Complete reads must never silently stop at the Data API's first page.
 * Catalogs retain their size budget; personal snapshots can opt out with Infinity.
 */
export async function readCatalogPages<T>(query: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null;
  status: number;
}>, maxRows = 10_000): Promise<T[]> {
  const rows: T[] = [], pageSize = 200;
  for (let offset = 0; offset <= maxRows;) {
    const { data, error, status } = await query(offset, offset + pageSize - 1);
    if (error) throw new RepositoryError({ ...error, status });
    rows.push(...data ?? []);
    if (rows.length > maxRows) throw new RepositoryError({ message: 'Catalog too large', code: 'CATALOG_SCHEMA_MISMATCH' });
    if (!data?.length) return rows;
    offset += data.length;
  }
  throw new RepositoryError({ message: 'Catalog too large', code: 'CATALOG_SCHEMA_MISMATCH' });
}
