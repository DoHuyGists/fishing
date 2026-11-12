export interface GuideRow {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

export interface AdminGuideRow extends GuideRow {
  is_published: boolean;
  created_at: string;
}

export type GuidePayload = Pick<AdminGuideRow, "title" | "content" | "sort_order" | "is_published">;
