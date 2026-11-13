import type { OpinionFeedbackPayload, ErrorFeedbackPayload, OpinionFeedbackRow, ErrorFeedbackRow } from "../types/table/feedback";
import type { ErrorFeedbackAttachment, ErrorFeedbackStatus } from "../types/model/feedback";
import { t as tr } from "../i18n";
import supabase from "../database/connection";
import { createUuid } from "../utils/uuid";
import { COMPACT_PAGE_SIZE, listPage, pageRange } from './pagination';
import type { ListPage } from '../types/model/pagination';

class SupabaseFeedbackRepository {
  async fetchMyErrors(userId: string, page: number): Promise<ListPage<ErrorFeedbackRow>> {
    const { data, error, count } = await supabase.from("error_feedback").select("*", { count: 'exact' }).eq("user_id", userId)
      .order("created_at", { ascending: false }).order("id").range(...pageRange(page, COMPACT_PAGE_SIZE));
    if (error) throw new Error(error.message);
    return listPage((data ?? []) as ErrorFeedbackRow[], count);
  }
  async fetchOpinionFeedback(page = 1): Promise<ListPage<OpinionFeedbackRow>> {
    const { data, error, count } = await supabase.from("feedback").select("*", { count: 'exact' }).order("created_at", { ascending: false }).order('id').range(...pageRange(page, COMPACT_PAGE_SIZE));
    if (error) throw new Error(error.message);
    return listPage((data ?? []) as OpinionFeedbackRow[], count);
  }

  async fetchErrorFeedback(page = 1): Promise<ListPage<ErrorFeedbackRow>> {
    const { data, error, count } = await supabase.from("error_feedback").select("*", { count: 'exact' }).order("created_at", { ascending: false }).order('id').range(...pageRange(page, COMPACT_PAGE_SIZE));
    if (error) throw new Error(error.message);
    return listPage((data ?? []) as ErrorFeedbackRow[], count);
  }

  async updateErrorFeedbackStatus(id: string, status: ErrorFeedbackStatus): Promise<void> {
    const { data, error } = await supabase
      .from("error_feedback")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(tr('supabaseFeedbackRepository.khong_tim_thay_bao_loi_de_cap_nhat_hoac_ban_khong_co_quyen_cap_n'));
  }

  async createErrorFeedbackSignedUrls(paths: string[]): Promise<Record<string, string>> {
    const results = await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await supabase.storage.from("error-feedback").createSignedUrl(path, 60 * 60);
        if (error) throw new Error(error.message);
        return [path, data.signedUrl] as const;
      }),
    );
    return Object.fromEntries(results);
  }

  async createOpinionFeedback(payload: OpinionFeedbackPayload) {
    const { error } = await supabase.from("feedback").insert({
      user_id: payload.userId,
      like: payload.like,
      dislike: payload.dislike,
      contribute: payload.contribute,
    });
    if (error) throw new Error(error.message);
  }

  async createErrorFeedback(payload: ErrorFeedbackPayload) {
    const attachments: ErrorFeedbackAttachment[] = [];
    const uploadedPaths: string[] = [];

    try {
      for (const file of payload.files) {
        const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
        if (!type) throw new Error(tr('supabaseFeedbackRepository.chi_ho_tro_file_anh_hoac_video'));

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${payload.userId}/${createUuid()}-${safeName}`;
        const { error } = await supabase.storage.from("error-feedback").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw new Error(error.message);
        uploadedPaths.push(path);
        attachments.push({ type, path });
      }

      const { error } = await supabase.from("error_feedback").insert({
        user_id: payload.userId,
        title: payload.title,
        description: payload.description,
        attachments,
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from("error-feedback").remove(uploadedPaths);
      }
      throw error;
    }
  }
}

export const supabaseFeedbackRepository = new SupabaseFeedbackRepository();
