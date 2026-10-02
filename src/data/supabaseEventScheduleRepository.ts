import supabase from "../database/connection";

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

const SELECT_QUERY = "*, event:event(id, name, thumbnail, image, description)";

function mapRow(row: any): EventScheduleRow {
  return {
    id: row.id,
    created_at: row.created_at,
    eventId: row.event_id,
    start: row.start,
    end: row.end,
    isDisabled: row.is_disabled,
    viewCount: row.view_count,
    eventName: row.event?.name ?? null,
    eventThumbnail: row.event?.thumbnail ?? null,
    eventImage: row.event?.image ?? null,
    eventDescription: row.event?.description ?? null,
  };
}

function toRecord(payload: EventSchedulePayload) {
  return {
    event_id: payload.eventId,
    start: payload.start,
    end: payload.end,
    is_disabled: payload.isDisabled,
    view_count: payload.viewCount,
  };
}

class SupabaseEventScheduleRepository {
  async fetchAll(): Promise<EventScheduleRow[]> {
    const { data, error } = await supabase
      .from("event_schedule")
      .select(SELECT_QUERY)
      .order("start", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  }

  async create(payload: EventSchedulePayload): Promise<EventScheduleRow> {
    const { data, error } = await supabase
      .from("event_schedule")
      .insert(toRecord(payload))
      .select(SELECT_QUERY)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async update(id: string, payload: EventSchedulePayload): Promise<EventScheduleRow> {
    const { data, error } = await supabase
      .from("event_schedule")
      .update(toRecord(payload))
      .eq("id", id)
      .select(SELECT_QUERY)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("event_schedule").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async incrementViewCount(id: string, currentCount: number): Promise<void> {
    const { error } = await supabase
      .from("event_schedule")
      .update({ view_count: currentCount + 1 })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export const supabaseEventScheduleRepository = new SupabaseEventScheduleRepository();
