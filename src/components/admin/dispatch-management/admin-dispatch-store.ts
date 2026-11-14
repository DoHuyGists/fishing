import { defineStore } from 'pinia';
import { supabaseDispatchAdminRepository as repository } from '../../../data/supabaseDispatchAdminRepository';
import type { DispatchCatalogKind, DispatchJob, DispatchNpc } from '../../../types/table/dispatch';

function catalogStore(kind: DispatchCatalogKind) {
  return defineStore('AdminDispatch_' + kind, {
    state: () => ({ items: [] as (DispatchNpc | DispatchJob)[], page: 1, pageSize: 10, total: 0, search: '', loading: false, error: '', sequence: 0 }),
    actions: {
      async fetchAll(page?: number, search?: string) {
        page ??= this.page; search ??= this.search;
        const sequence = ++this.sequence;
        this.loading = true; this.error = ''; this.search = search;
        try {
          const result = await repository.fetchPage(kind, page, search);
          if (this.sequence !== sequence) return;
          this.items = result.items; this.page = page; this.total = result.total;
          if (!this.items.length && page > 1) await this.fetchAll(Math.max(1, Math.ceil(result.total / this.pageSize)));
        } catch (error) { if (this.sequence === sequence) this.error = error instanceof Error ? error.message : 'Không tải được cấu hình giao việc.'; }
        finally { if (this.sequence === sequence) this.loading = false; }
      },
      async save(input: Record<string, unknown>, id: string | null) {
        const payload: Record<string, unknown> = {};
        for (const key of ['code', 'name', 'description', 'image_path', 'data']) payload[key] = input[key];
        payload.enabled = input.enabled === true || input.enabled === 'true';
        const name = input.name as Record<string, unknown> | null;
        if (!name || !['vi', 'en'].every(locale => typeof name[locale] === 'string' && String(name[locale]).trim())) {
          throw new Error('Tên cần đủ hai ngôn ngữ, ví dụ {"vi":"Thủy thủ","en":"Sailor"}.');
        }
        if (!/^[a-z0-9_-]+$/.test(String(input.code ?? ''))) throw new Error('Mã chỉ gồm chữ thường, số, dấu gạch dưới hoặc gạch ngang.');
        for (const key of ['sort_order', ...(kind === 'npcs' ? ['purchase_shells', 'operating_cash'] : ['duration_seconds'])]) {
          const value = Number(input[key]);
          if (!Number.isSafeInteger(value)) throw new Error(key + ' phải là số nguyên.');
          payload[key] = value;
        }
        if (kind === 'jobs') payload.rewards = input.rewards;
        const result = await repository.save(kind, payload, id);
        await this.fetchAll();
        return result;
      },
      async remove(id: string) {
        try { await repository.remove(kind, id); }
        catch { throw new Error('Không thể xóa cấu hình đã có người sở hữu hoặc đã dùng. Hãy tắt cấu hình thay vì xóa.'); }
        await this.fetchAll();
      },
    },
  });
}
export const useAdminDispatchNpcStore = catalogStore('npcs');
export const useAdminDispatchJobStore = catalogStore('jobs');
