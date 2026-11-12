export interface EventRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  name: string;
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  is_disabled: boolean;
}

export type EventPayload = Omit<EventRow, "id" | "created_at" | "updated_at">;
