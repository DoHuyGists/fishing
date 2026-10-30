import { defineStore } from "pinia";
import supabase from "../database/connection";
import { supabaseFeedbackRepository } from "../data/supabaseFeedbackRepository";

export const useFeedbackStore = defineStore("feedback", {
  state: () => ({
    submitting: false,
    error: "",
  }),
  actions: {
    async submitOpinion(payload: { like: string; dislike: string; contribute: string }) {
      return this.submit(async (userId) => supabaseFeedbackRepository.createOpinionFeedback({
        userId,
        like: payload.like.trim(),
        dislike: payload.dislike.trim(),
        contribute: payload.contribute.trim() || null,
      }));
    },
    async submitError(payload: { title: string; description: string; files: File[] }) {
      return this.submit(async (userId) => supabaseFeedbackRepository.createErrorFeedback({
        userId,
        title: payload.title.trim(),
        description: payload.description.trim() || null,
        files: payload.files,
      }));
    },
    async submit(action: (userId: string) => Promise<void>) {
      this.submitting = true;
      this.error = "";
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw new Error("Bạn cần đăng nhập để gửi phản hồi.");
        await action(user.id);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể gửi phản hồi lúc này. Vui lòng thử lại.";
        throw error;
      } finally {
        this.submitting = false;
      }
    },
  },
});
