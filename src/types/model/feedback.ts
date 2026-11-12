export interface ErrorFeedbackAttachment {
  type: "image" | "video";
  path: string;
}

export type ErrorFeedbackStatus = "pending" | "processing" | "resolved" | "closed";
