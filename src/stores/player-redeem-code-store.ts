import { defineStore } from "pinia";
import { supabaseRedeemCodeRepository } from "../data/supabaseRedeemCodeRepository";
import { useToast } from "../composables/useToast";
import { t as tr } from "../i18n";
import { useAuthStore } from "./auth";

export const useRedeemCodeStore = defineStore("redeemCode", {
  state: () => ({ isSubmitting: false }),
  actions: {
    async redeem(code: string): Promise<boolean> {
      const submittedCode = code.trim();
      const auth = useAuthStore();
      const userId = auth.user?.id;
      const generation = auth.sessionGeneration;
      if (!submittedCode || this.isSubmitting || !userId) return false;
      const current = () => auth.user?.id === userId && auth.sessionGeneration === generation;

      this.isSubmitting = true;
      try {
        await supabaseRedeemCodeRepository.redeem(submittedCode);
        if (!current()) return false;
        useToast().success(tr("RedeemCodeForm.doi_ma_thanh_cong"));
        return true;
      } catch (error) {
        if (current()) {
          useToast().error(error instanceof Error ? error.message : tr("RedeemCodeForm.khong_the_doi_ma_vui_long_thu_lai"));
        }
        return false;
      } finally {
        if (current()) this.isSubmitting = false;
      }
    },
  },
});
