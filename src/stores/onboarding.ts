import { defineStore } from "pinia";
import { useUserProfileStore } from "./userProfile";
export const useOnboardingStore = defineStore("onboarding", {
  state: () => ({ visible: false, saving: false, error: "", shownFor: "" }),
  actions: {
    offer(userId: string) {
      if (this.shownFor === userId || useUserProfileStore().profile?.onboarding_completed !== false) return;
      this.shownFor = userId; this.visible = true;
    },
    async finish() {
      this.visible = false; this.error = ""; this.saving = true;
      try { await useUserProfileStore().completeOnboarding(); }
      catch (err) { this.error = err instanceof Error ? err.message : "Không thể lưu trạng thái hướng dẫn."; }
      finally { this.saving = false; }
    },
  },
});
