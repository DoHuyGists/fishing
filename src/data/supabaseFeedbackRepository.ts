import supabase from "../database/connection";

export interface OpinionFeedbackPayload {
  userId: string;
  like: string;
  dislike: string;
  contribute: string | null;
}

export interface ErrorFeedbackAttachment {
  type: "image" | "video";
  path: string;
}

export interface ErrorFeedbackPayload {
  userId: string;
  title: string;
  description: string | null;
  files: File[];
}

export interface OpinionFeedbackRow {
  id: string;
  user_id: string | null;
  like: string;
  dislike: string;
  contribute: string | null;
  created_at: string;
}

export type ErrorFeedbackStatus = "pending" | "processing" | "resolved" | "closed";

export interface ErrorFeedbackRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  attachments: ErrorFeedbackAttachment[];
  status: ErrorFeedbackStatus;
  created_at: string;
  updated_at: string;
}

class SupabaseFeedbackRepository {
  async fetchOpinionFeedback(): Promise<OpinionFeedbackRow[]> {
    const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OpinionFeedbackRow[];
  }

  async fetchErrorFeedback(): Promise<ErrorFeedbackRow[]> {
    const { data, error } = await supabase.from("error_feedback").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ErrorFeedbackRow[];
  }

  async updateErrorFeedbackStatus(id: string, status: ErrorFeedbackStatus): Promise<void> {
    const { data, error } = await supabase
      .from("error_feedback")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Không tìm thấy báo lỗi để cập nhật hoặc bạn không có quyền cập nhật.");
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
        if (!type) throw new Error("Chỉ hỗ trợ file ảnh hoặc video.");

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${payload.userId}/${crypto.randomUUID()}-${safeName}`;
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
