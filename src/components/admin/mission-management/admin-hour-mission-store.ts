import { defineStore } from "pinia";
import {
  supabaseHourMissionRepository,
  type HourMissionPayload,
  type HourMissionRow,
} from "../../../data/supabaseHourMissionRepository";
import { supabaseSpeciesRepository, type SpeciesRow } from "../../../data/supabaseSpeciesRepository";
import type { MissionFish } from "../../../data/supabaseMissionRepository";

export type HourMissionStatusFilter = "ALL" | "ACTIVE" | "DISABLED";

export const RARITY_OPTIONS = ["THƯỜNG", "HIẾM", "SỬ THI", "HUYỀN THOẠI"];

export const speciesWeightText = (item: SpeciesRow) => {
  if (item.weight_min == null && item.weight_max == null) return "";
  if (item.weight_min != null && item.weight_max != null) return `${item.weight_min} - ${item.weight_max} kg`;
  return `${item.weight_min ?? item.weight_max} kg`;
};

const emptyForm = () => ({
  id: null as string | null,
  start: "",
  end: "",
  cash: "",
  isDisabled: false,
  content: [] as MissionFish[],
});

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

// "10:00:00+00" -> "10:00:00" (giá trị lưu theo UTC)
export const toTimeInput = (value: string | null) => (value ? value.split(/[+-]/)[0].slice(0, 8) : "");

const toTimeTz = (value: string) => {
  if (!value) return null;
  return `${value.length === 5 ? `${value}:00` : value}+00`;
};

export const useAdminHourMissionStore = defineStore("AdminHourMission", {
  state: () => ({
    missions: [] as HourMissionRow[],
    search: "",
    statusFilter: "ALL" as HourMissionStatusFilter,
    isLoading: false,
    loadError: "",

    species: [] as SpeciesRow[],
    isLoadingSpecies: false,
    speciesError: "",

    isFormOpen: false,
    isSaving: false,
    formError: "",
    form: emptyForm(),

    updatingId: null as string | null,
    deletingId: null as string | null,
    confirmDeleteId: null as string | null,
  }),
  getters: {
    filteredMissions(state): HourMissionRow[] {
      const keyword = state.search.trim().toLocaleLowerCase();
      return state.missions.filter((item) => {
        const matchesSearch =
          !keyword || item.content.some((fish) => fish.name.toLocaleLowerCase().includes(keyword));
        const matchesStatus =
          state.statusFilter === "ALL" ||
          (state.statusFilter === "ACTIVE" && !item.isDisabled) ||
          (state.statusFilter === "DISABLED" && item.isDisabled);
        return matchesSearch && matchesStatus;
      });
    },
  },
  actions: {
    async loadMissions() {
      this.isLoading = true;
      this.loadError = "";
      try {
        this.missions = await supabaseHourMissionRepository.fetchAll();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể tải danh sách nhiệm vụ giờ");
      } finally {
        this.isLoading = false;
      }
    },

    openCreateForm() {
      this.form = emptyForm();
      this.formError = "";
      this.isFormOpen = true;
    },

    openEditForm(item: HourMissionRow) {
      this.form = {
        id: item.id,
        start: toTimeInput(item.start),
        end: toTimeInput(item.end),
        cash: item.cash === null ? "" : String(item.cash),
        isDisabled: item.isDisabled,
        content: item.content.length ? item.content.map((fish) => ({ ...fish })) : [],
      };
      this.formError = "";
      this.isFormOpen = true;
    },

    closeForm() {
      this.isFormOpen = false;
      this.formError = "";
    },

    async loadSpecies() {
      if (this.species.length || this.isLoadingSpecies) return;
      this.isLoadingSpecies = true;
      this.speciesError = "";
      try {
        this.species = await supabaseSpeciesRepository.fetchAll();
      } catch (error) {
        this.speciesError = messageOf(error, "Không thể tải danh sách cá");
      } finally {
        this.isLoadingSpecies = false;
      }
    },

    setFishFromSpecies(selected: SpeciesRow[]) {
      const existing = new Map(this.form.content.map((fish) => [fish.id, fish]));
      this.form.content = selected.map(
        (item) =>
          existing.get(item.id) ?? {
            id: item.id,
            name: item.name,
            image: item.image ?? "",
            length: speciesWeightText(item),
            rarity: item.rarity ?? "THƯỜNG",
          },
      );
    },

    removeFish(index: number) {
      this.form.content.splice(index, 1);
    },

    buildPayload(): HourMissionPayload | null {
      const content = this.form.content.map((fish) => ({
        ...fish,
        name: fish.name.trim(),
        image: fish.image.trim(),
        length: fish.length.trim(),
      }));
      if (!content.length) {
        this.formError = "Cần ít nhất một loài cá trong nhiệm vụ";
        return null;
      }
      if (content.some((fish) => !fish.name)) {
        this.formError = "Tên cá là bắt buộc";
        return null;
      }

      let cash: number | null = null;
      // v-model trên input type="number" trả về number, không phải string
      const cashText = String(this.form.cash ?? "").trim();
      if (cashText !== "") {
        cash = Number(cashText);
        if (!Number.isSafeInteger(cash) || cash < 0) {
          this.formError = "Tiền thưởng phải là số nguyên không âm hợp lệ";
          return null;
        }
      }

      return {
        content,
        start: toTimeTz(this.form.start),
        end: toTimeTz(this.form.end),
        is_disabled: this.form.isDisabled,
        cash,
      };
    },

    async save() {
      this.formError = "";
      const payload = this.buildPayload();
      if (!payload) return;

      this.isSaving = true;
      try {
        if (this.form.id) await supabaseHourMissionRepository.update(this.form.id, payload);
        else await supabaseHourMissionRepository.create(payload);
        this.closeForm();
        await this.loadMissions();
      } catch (error) {
        this.formError = messageOf(error, "Không thể lưu nhiệm vụ giờ");
      } finally {
        this.isSaving = false;
      }
    },

    async toggleEnabled(item: HourMissionRow) {
      this.updatingId = item.id;
      this.loadError = "";
      try {
        await supabaseHourMissionRepository.update(item.id, {
          content: item.content,
          start: item.start,
          end: item.end,
          cash: item.cash,
          is_disabled: !item.isDisabled,
        });
        await this.loadMissions();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể cập nhật trạng thái nhiệm vụ");
      } finally {
        this.updatingId = null;
      }
    },

    async remove() {
      if (!this.confirmDeleteId) return;
      this.deletingId = this.confirmDeleteId;
      try {
        await supabaseHourMissionRepository.delete(this.confirmDeleteId);
        this.confirmDeleteId = null;
        await this.loadMissions();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể xoá nhiệm vụ giờ");
      } finally {
        this.deletingId = null;
      }
    },
  },
});
