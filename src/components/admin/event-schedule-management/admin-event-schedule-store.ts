import { defineStore } from "pinia";
import {
  supabaseEventScheduleRepository,
  type EventSchedulePayload,
  type EventScheduleRow,
} from "../../../data/supabaseEventScheduleRepository";
import { supabaseEventRepository, type EventRow } from "../../../data/supabaseEventRepository";

const emptyForm = () => ({
  id: null as string | null,
  eventId: "",
  start: "",
  end: "",
  isDisabled: true,
  viewCount: 0,
});

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

function toInputDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export const useAdminEventScheduleStore = defineStore("AdminEventSchedule", {
  state: () => ({
    schedules: [] as EventScheduleRow[],
    events: [] as EventRow[],
    search: "",
    eventFilter: "ALL",
    statusFilter: "ALL" as "ALL" | "ACTIVE" | "DISABLED",
    isLoading: false,
    loadError: "",

    isFormOpen: false,
    isSaving: false,
    formError: "",
    form: emptyForm(),

    deletingId: null as string | null,
    confirmDeleteId: null as string | null,
  }),
  getters: {
    eventOptions(state): EventRow[] {
      return [...state.events].sort((a, b) => a.name.localeCompare(b.name));
    },
    filteredSchedules(state): EventScheduleRow[] {
      const keyword = state.search.trim().toLocaleLowerCase();
      return state.schedules.filter((item) => {
        const matchesSearch = !keyword || [item.eventName].some((value) => value?.toLocaleLowerCase().includes(keyword));
        const matchesEvent = state.eventFilter === "ALL" || item.eventId === state.eventFilter;
        const matchesStatus =
          state.statusFilter === "ALL" ||
          (state.statusFilter === "ACTIVE" && !item.isDisabled) ||
          (state.statusFilter === "DISABLED" && item.isDisabled);
        return matchesSearch && matchesEvent && matchesStatus;
      });
    },
  },
  actions: {
    async loadAll() {
      this.isLoading = true;
      this.loadError = "";
      try {
        const [schedulesData, eventsData] = await Promise.all([
          supabaseEventScheduleRepository.fetchAll(),
          supabaseEventRepository.fetchAll(),
        ]);
        this.schedules = schedulesData;
        this.events = eventsData;
      } catch (error) {
        this.loadError = messageOf(error, "Không thể tải danh sách lịch sự kiện");
      } finally {
        this.isLoading = false;
      }
    },

    openCreateForm() {
      this.form = emptyForm();
      this.formError = "";
      this.isFormOpen = true;
    },

    openEditForm(item: EventScheduleRow) {
      this.form = {
        id: item.id,
        eventId: item.eventId,
        start: toInputDateTime(item.start),
        end: toInputDateTime(item.end),
        isDisabled: item.isDisabled,
        viewCount: item.viewCount,
      };
      this.formError = "";
      this.isFormOpen = true;
    },

    closeForm() {
      this.isFormOpen = false;
      this.formError = "";
    },

    buildPayload(): EventSchedulePayload | null {
      if (!this.form.eventId) {
        this.formError = "Vui lòng chọn sự kiện";
        return null;
      }
      if (!this.form.start || !this.form.end) {
        this.formError = "Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc";
        return null;
      }
      const start = fromInputDateTime(this.form.start);
      const end = fromInputDateTime(this.form.end);
      if (new Date(start) >= new Date(end)) {
        this.formError = "Thời gian kết thúc phải sau thời gian bắt đầu";
        return null;
      }
      const viewCount = Number(this.form.viewCount);
      if (!Number.isFinite(viewCount) || viewCount < 0) {
        this.formError = "Lượt xem phải là số không âm";
        return null;
      }

      return {
        eventId: this.form.eventId,
        start,
        end,
        isDisabled: this.form.isDisabled,
        viewCount,
      };
    },

    async save() {
      this.formError = "";
      const payload = this.buildPayload();
      if (!payload) return;

      this.isSaving = true;
      try {
        if (this.form.id) await supabaseEventScheduleRepository.update(this.form.id, payload);
        else await supabaseEventScheduleRepository.create(payload);
        this.closeForm();
        await this.loadAll();
      } catch (error) {
        this.formError = messageOf(error, "Không thể lưu lịch sự kiện");
      } finally {
        this.isSaving = false;
      }
    },

    async remove() {
      const id = this.confirmDeleteId;
      if (!id) return;
      this.deletingId = id;
      try {
        await supabaseEventScheduleRepository.delete(id);
        if (this.form.id === id) this.closeForm();
        this.confirmDeleteId = null;
        await this.loadAll();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể xoá lịch sự kiện");
      } finally {
        this.deletingId = null;
      }
    },
  },
});
