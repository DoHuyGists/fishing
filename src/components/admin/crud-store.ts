import { defineStore } from "pinia";
import type { CrudRepository } from "../../data/supabaseWeatherRepository";

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
    }),
    actions: {
      async fetchAll() {
        this.loading = true;
        this.error = "";
        try {
          this.items = (await repository.fetchAll()) as any;
        } catch (err) {
          this.error = err instanceof Error ? err.message : `Không thể tải ${errorLabel}`;
        } finally {
          this.loading = false;
        }
      },
      async create(payload: Payload) {
        const created = await repository.create(payload);
        this.items.push(created as any);
        return created;
      },
      async update(id: string, payload: Payload) {
        const updated = await repository.update(id, payload);
        const index = this.items.findIndex((item) => item.id === id);
        if (index !== -1) this.items[index] = updated as any;
        return updated;
      },
      async remove(id: string) {
        await repository.remove(id);
        this.items = this.items.filter((item) => item.id !== id) as any;
      },
    },
  });
}
