import type { FeatureFlagRow } from "../../../types/table/featureFlag";
import { defineStore } from "pinia";
import { FEATURE_CATALOG } from "../../../data/featureAvailability";
import { supabaseFeatureFlagRepository as repository } from "../../../data/supabaseFeatureFlagRepository";
import { useFeatureAvailabilityStore } from "../../../stores/featureAvailability";
import { t as tr } from "../../../i18n";

export const useAdminFeatureStore = defineStore("AdminFeatureAvailability", {
  state: () => ({ flags: [] as FeatureFlagRow[], loading: false, error: "", saving: false }),
  getters: {
    items: state => FEATURE_CATALOG.map(feature => {
      const flag = state.flags.find(row => row.feature_key === feature.key);
      return { ...flag, id: feature.key, feature_key: feature.key, name: tr(feature.labelKey) };
    }),
  },
  actions: {
    async fetchAll() {
      if (this.loading || this.saving) return;
      this.loading = true; this.error = "";
      try {
        this.flags = await repository.fetchAll();
        if (FEATURE_CATALOG.some(feature => !this.flags.some(row => row.feature_key === feature.key))) {
          this.error = "Thiếu cấu hình tính năng trên DB. Hãy chạy đầy đủ migration feature_flags trước khi quản trị.";
        }
      } catch (error) { this.error = error instanceof Error ? error.message : "Không thể tải cấu hình tính năng"; }
      finally { this.loading = false; }
    },
    async save(payload: Record<string, unknown>, key: string | null) {
      if (this.saving) throw new Error("Đang lưu cấu hình tính năng");
      const current = this.flags.find(row => row.feature_key === key);
      if (!current) throw new Error("Không tìm thấy cấu hình tính năng. Hãy chạy migration và tải lại danh sách.");
      if (![true, false, "true", "false"].includes(payload.enabled as boolean | string)) throw new Error("Hãy chọn trạng thái tính năng");
      this.saving = true;
      try {
        const updated = await repository.update(current.feature_key, {
          enabled: payload.enabled === true || payload.enabled === "true",
          message_vi: String(payload.message_vi ?? ""), message_en: String(payload.message_en ?? ""),
        }, current.updated_at);
        if (!updated) throw new Error("Cấu hình đã được thay đổi ở phiên khác. Hãy đóng biểu mẫu và làm mới danh sách trước khi lưu lại.");
        this.flags = this.flags.map(row => row.feature_key === key ? updated : row);
        await useFeatureAvailabilityStore().load(true);
      } finally { this.saving = false; }
    },
    async remove() { throw new Error("Không thể xóa cấu hình tính năng"); },
  },
});
