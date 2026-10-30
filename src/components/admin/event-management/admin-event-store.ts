import { defineStore } from "pinia";
import { supabaseEventRepository, type EventPayload, type EventRow } from "../../../data/supabaseEventRepository";

const emptyForm = () => ({
  id: null as string | null,
  name: "",
  description: "",
  image: "",
  thumbnail: "",
  isDisabled: true,
});

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export const useAdminEventStore = defineStore("AdminEvent", {
  state: () => ({
    events: [] as EventRow[],
    search: "",
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
    filteredEvents(state): EventRow[] {
      const keyword = state.search.trim().toLocaleLowerCase();
      return state.events.filter((item) => {
        const matchesSearch =
          !keyword || [item.name, item.description].some((value) => value?.toLocaleLowerCase().includes(keyword));
        const matchesStatus =
          state.statusFilter === "ALL" ||
          (state.statusFilter === "ACTIVE" && !item.is_disabled) ||
          (state.statusFilter === "DISABLED" && item.is_disabled);
        return matchesSearch && matchesStatus;
      });
    },
  },
  actions: {
    async loadEvents() {
      this.isLoading = true;
      this.loadError = "";
      try {
        this.events = await supabaseEventRepository.fetchAll();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể tải danh sách sự kiện");
      } finally {
        this.isLoading = false;
      }
    },

    openCreateForm() {
      this.form = emptyForm();
      this.formError = "";
      this.isFormOpen = true;
    },

    openEditForm(item: EventRow) {
      this.form = {
        id: item.id,
        name: item.name,
        description: item.description ?? "",
        image: item.image ?? "",
        thumbnail: item.thumbnail ?? "",
        isDisabled: item.is_disabled,
      };
      this.formError = "";
      this.isFormOpen = true;
    },

    closeForm() {
      this.isFormOpen = false;
      this.formError = "";
    },

    buildPayload(): EventPayload | null {
      const name = this.form.name.trim();
      if (!name) {
        this.formError = "Tên sự kiện là bắt buộc";
        return null;
      }
      return {
        name,
        description: this.form.description.trim() || null,
        image: this.form.image.trim() || null,
        thumbnail: this.form.thumbnail.trim() || null,
        is_disabled: this.form.isDisabled,
      };
    },

    async save() {
      this.formError = "";
      const payload = this.buildPayload();
      if (!payload) return;

      this.isSaving = true;
      try {
        if (this.form.id) await supabaseEventRepository.update(this.form.id, payload);
        else await supabaseEventRepository.create(payload);
        this.closeForm();
        await this.loadEvents();
      } catch (error) {
        this.formError = messageOf(error, "Không thể lưu sự kiện");
      } finally {
        this.isSaving = false;
      }
    },

    async remove() {
      const id = this.confirmDeleteId;
      if (!id) return;
      this.deletingId = id;
      try {
        await supabaseEventRepository.delete(id);
        if (this.form.id === id) this.closeForm();
        this.confirmDeleteId = null;
        await this.loadEvents();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể xoá sự kiện");
      } finally {
        this.deletingId = null;
      }
    },
  },
});
