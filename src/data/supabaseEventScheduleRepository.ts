import type { EventScheduleRow, EventSchedulePayload } from "../types/table/eventSchedule";
import supabase from "../database/connection";
import { fetchAdminListPage } from './supabaseAdminListRepository';

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
  async fetchPage(page: number, search: string, event: string, status: string) {
    const result = await fetchAdminListPage<any>('event_schedule', page, search, {
      ...(event === 'ALL' ? {} : { event_id: event }), ...(status === 'ALL' ? {} : { is_disabled: status === 'DISABLED' }),
    });
    return { ...result, items: result.items.map(mapRow) };
  }
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
