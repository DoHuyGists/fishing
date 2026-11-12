import type { ErrorFeedbackAttachment, ErrorFeedbackStatus } from "../model/feedback";

export interface OpinionFeedbackPayload {
  userId: string;
  like: string;
  dislike: string;
  contribute: string | null;
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
