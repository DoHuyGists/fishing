export type PageSize = 5 | 10;

export interface ListPage<T> {
  items: T[];
  total: number;
}

export interface AdminListPage<T> extends ListPage<T> {
  facets: Record<string, string[]>;
}

export interface AdminListPage<T> extends ListPage<T> {
  facets: Record<string, string[]>;
}
