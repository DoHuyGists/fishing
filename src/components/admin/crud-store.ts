import type { CrudRepository } from "../../types/model/weather";
import { defineStore } from "pinia";


// Builds a Pinia store exposing CRUD actions over a repository.
export function defineCrudStore<Row extends { id: string }, Payload>(
  storeId: string,
  repository: CrudRepository<Row, Payload>,
  errorLabel: string,
) {
  return defineStore(storeId, {
    state: () => ({
      items: [] as Row[],
      loading: false,
      error: "",
      page: 1,
      pageSize: 10,
      total: 0,
      search: '',
      requestId: 0,
      options: [] as Row[],
    }),
    actions: {
      async fetchAll(page?: number, search?: string) {
        page ??= this.page;
        this.search = search ?? this.search;
        const request = ++this.requestId;
        this.loading = true;
        this.error = "";
        try {
          const result = await repository.fetchPage(page, this.search);
          if (request !== this.requestId) return;
          this.items = result.items as any; this.total = result.total; this.page = page;
          if (!result.items.length && page > 1) await this.fetchAll(Math.max(1, Math.ceil(result.total / this.pageSize)));
        } catch (err) {
          if (request === this.requestId) this.error = err instanceof Error ? err.message : `Không thể tải ${errorLabel}`;
        } finally {
          if (request === this.requestId) this.loading = false;
        }
      },
      async fetchOptions() {
        // Relation selectors need the complete catalog, separate from the page.
        this.options = (await repository.fetchAll()) as any;
      },
      async create(payload: Payload) {
        const created = await repository.create(payload);
        await this.fetchAll(1);
        return created;
      },
      async update(id: string, payload: Payload) {
        const updated = await repository.update(id, payload);
        await this.fetchAll();
        return updated;
      },
      async remove(id: string) {
        await repository.remove(id);
        await this.fetchAll();
      },
    },
  });
}
