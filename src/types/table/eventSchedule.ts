export interface EventScheduleRow {
  id: string;
  created_at: string;
  eventId: string;
  start: string;
  end: string;
  isDisabled: boolean;
  viewCount: number;
  eventName: string | null;
  eventThumbnail: string | null;
  eventImage: string | null;
  eventDescription: string | null;
}

export interface EventSchedulePayload {
  eventId: string;
  start: string;
  end: string;
  isDisabled: boolean;
  viewCount: number;
}
