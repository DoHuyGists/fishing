<script setup lang="ts">
import type { Faction, FactionEffect, CurrentFactionEffect } from "../../../types/model/faction";
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed, nextTick, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import FactionActivityRewards from "./FactionActivityRewards.vue";
import { useFactionStore } from "../../../stores/player-faction-store.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useToast } from "../../../composables/useToast.ts";


const factionStore = useFactionStore();
const authStore = useAuthStore();
const toast = useToast();

const topSectionRef = ref<HTMLElement | null>(null);

const confirmingAction = ref<{
  type: "join" | "change";
  faction: Faction;
} | null>(null);

const currentUserId = computed(() => {
  try {
    return authStore.userId;
  } catch {
    return "";
  }
});

const activeFaction = computed(() => factionStore.activeFaction);
const otherFactions = computed(() => factionStore.otherFactions);
const joinedFaction = computed(() => factionStore.joinedFaction);
const hasJoined = computed(() => factionStore.hasJoinedFaction);
const isActiveJoined = computed(() => factionStore.isActiveFactionJoined);
const dailyActivityPoints = computed(() => factionStore.dailyActivityPoints);

const getMemberCount = (factionId: string): number => factionStore.getMemberCount(factionId);

/**
 * Hiệu ứng của phe đang được chọn hiển thị ở Top Section.
 * Nếu là phe đã gia nhập thì lấy từ danh sách hiệu ứng kích hoạt (currentEffects);
 * Nếu là phe đang xem trước thì lấy từ quan hệ faction_effects của phe đó.
 */
const displayedEffects = computed<Array<FactionEffect | CurrentFactionEffect>>(() => {
  if (!activeFaction.value) return [];
  if (isActiveJoined.value && factionStore.currentEffects.length > 0) {
    return factionStore.currentEffects;
  }
  return activeFaction.value.faction_effects ?? [];
});

async function handleRefresh() {
  await factionStore.loadData(currentUserId.value);
}

function promptJoin(faction: Faction) {
  confirmingAction.value = { type: "join", faction };
}

function promptChange(faction: Faction) {
  confirmingAction.value = { type: "change", faction };
}

function cancelConfirm() {
  confirmingAction.value = null;
}

async function handleViewDetail(factionId: string) {
  factionStore.selectFaction(factionId);
  await nextTick();
  topSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleResetToJoined() {
  factionStore.resetToJoinedFaction();
  await nextTick();
  topSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function executeConfirm() {
  if (!confirmingAction.value) return;

  const { type, faction } = confirmingAction.value;
  try {
    if (type === "join") {
      await factionStore.joinFaction(faction.id, currentUserId.value);
      toast.success(tr('FactionSelectModal.da_chinh_thuc_gia_nhap_phe_value0', { value0: faction.name }));
    } else {
      await factionStore.changeFaction(faction.id, currentUserId.value);
      toast.success(tr('FactionSelectModal.da_chuyen_sang_phe_value0', { value0: faction.name }));
    }
    confirmingAction.value = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : tr('FactionSelectModal.thao_tac_that_bai');
    toast.error(message);
  }
}

function getEffectTypeBadge(type: string) {
  switch (type) {
    case "BUFF":
      return {
        get label() { return tr('FactionSelectModal.hieu_qua_phe'); },
        class: "bg-surface-selected text-content-secondary border-border",
        icon: "✦",
      };
    case "DEBUFF":
      return {
        get label() { return tr('FactionSelectModal.hieu_qua_can_bang'); },
        class: "bg-surface text-danger border-danger",
        icon: "▲",
      };
    case "UNIQUE":
      return {
        get label() { return tr('FactionSelectModal.hieu_qua_doc_nhat'); },
        class: "bg-surface text-gold border-gold",
        icon: "★",
      };
    default:
      return {
        label: type,
        class: "bg-surface-hover text-content border-border-default",
        icon: "•",
      };
  }
}

function formatConfig(config: Record<string, unknown> | undefined): Array<{ key: string; value: string }> {
  if (!config) return [];
  const entries = Object.entries(config);
  if (entries.length === 0) return [];

  return entries.map(([key, val]) => ({
    key,
    value: typeof val === "object" ? JSON.stringify(val) : String(val),
  }));
}

onMounted(() => {
  void factionStore.loadData(currentUserId.value);
});
</script>

<template>
  <Modal :title="tr('FactionSelectModal.phe_phai')" :on-refresh="handleRefresh">
    <div class="faction-screen [font-family:inherit]! min-h-full p-5 sm:p-8 space-y-6 bg-surface text-content">
      <!-- Thanh trạng thái người chơi -->
      <section
        class="slide-fade-in from-top player-content-in flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border-default bg-surface text-content inset-shadow-sm"
      >
        <div class="flex items-center gap-2 text-xs sm:text-sm">
          <span class="text-content font-serif">❖</span>
          <span class="text-content-subtle uppercase tracking-wider text-[11px] font-bold">{{ tr('FactionSelectModal.phe_hien_tai') }}</span>
          <span v-if="joinedFaction" class="font-bold text-content-secondary font-serif text-sm sm:text-base">
            {{ joinedFaction.name }} ({{ joinedFaction.code }})
          </span>
          <span v-else class="text-content-subtle italic"> {{ tr('FactionSelectModal.chua_gia_nhap_phe_nao') }} </span>
        </div>

        <div v-if="joinedFaction && activeFaction && activeFaction.id !== joinedFaction.id">
          <button
            type="button"
            class="px-3 py-1 rounded border border-content-disabled bg-surface-selected hover:bg-border-default text-xs font-bold text-content-secondary transition-colors cursor-pointer"
            @click="handleResetToJoined"
          >
            {{ tr('FactionSelectModal.tro_ve_phe_cua_ban') }}
          </button>
        </div>
      </section>

      <!-- Loading State -->
      <div v-if="factionStore.loading" class="py-16 text-center text-content space-y-2">
        <div class="inline-block animate-spin text-2xl text-content">❖</div>
        <div class="text-xs uppercase tracking-widest font-bold">{{ tr('FactionSelectModal.dang_tai_thong_tin_phe_phai') }}</div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="factionStore.error && factionStore.factions.length === 0"
        class="p-4 rounded-lg border border-danger bg-surface text-danger text-center text-sm"
      >
        <div>{{ factionStore.error }}</div>
        <button
          type="button"
          class="mt-3 px-4 py-1.5 rounded border border-danger bg-surface hover:bg-danger text-xs font-bold transition-colors cursor-pointer"
          @click="handleRefresh"
        >
          {{ tr('Maintenance.thu_lai') }}
        </button>
      </div>

      <!-- Main Content -->
      <div v-else class="space-y-6">
        <!-- ================= SECTION PHẦN THƯỞNG NĂNG ĐỘNG HÀNG NGÀY ================= -->
        <FactionActivityRewards :current-points="dailyActivityPoints" />

        <!-- ================= TOP SECTION: PHE ĐÃ CHỌN / GIA NHẬP ================= -->
        <section
          v-if="activeFaction"
          ref="topSectionRef"
          class="slide-fade-in from-bottom player-content-in top-faction-card rounded-xl border border-border-default bg-surface text-content p-5 sm:p-7 shadow-xl relative overflow-hidden"
        >
          <!-- Nền hoa văn mờ trang nghiêm -->
          <!-- <div
            class="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none select-none font-serif text-[200px] leading-none text-content-secondary flex items-center justify-center"
            aria-hidden="true"
          >
            {{ activeFaction.symbol || "❖" }}
          </div> -->

          <!-- Nhãn đầu section -->
          <div class="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs uppercase tracking-widest font-extrabold text-content-secondary font-serif">
                {{
                  isActiveJoined
                    ? tr('FactionSelectModal.phe_hien_tai_2')
                    : hasJoined
                      ? tr('FactionSelectModal.chi_tiet_phe_dang_xem_xet')
                      : tr('FactionSelectModal.chi_tiet_phe_da_chon')
                }}
              </span>
              <span
                v-if="isActiveJoined"
                class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-surface-selected text-content-secondary border border-border"
              >
                {{ tr('FactionSelectModal.dang_kich_hoat') }}
              </span>
            </div>
            <div class="flex items-center gap-2.5 text-xs text-content font-serif">
              <span v-if="activeFaction.element">
                {{ tr('FactionSelectModal.menh') }} <span class="font-bold text-content">{{ activeFaction.element }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-hover border border-border-default text-content-secondary font-sans font-medium text-[11px]"
              >
                <span>👥</span>
                <span class="font-bold">{{ getMemberCount(activeFaction.id).toLocaleString(getFormattingLocale()) }}</span> {{ tr('FactionSelectModal.thanh_vien') }}
              </span>
            </div>
          </div>

          <!-- Bố cục 2 cột: Cột trái (Biểu tượng & Thông tin cốt lõi) | Cột phải (Thông tin chi tiết & Hiệu ứng) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Cột Trái (4 cols) -->
            <div
              class="lg:col-span-4 flex flex-col items-center text-center p-5 rounded-lg border border-border bg-surface-hover"
            >
              <!-- Huy hiệu / Symbol -->
              <div
                class="size-24 sm:size-28 rounded-full border-2 border-content-disabled bg-surface flex items-center justify-center text-4xl sm:text-5xl shadow-md text-content-secondary mb-4 select-none"
              >
                {{ activeFaction.symbol || "⚔️" }}
              </div>

              <!-- Tên Phe -->
              <div class="m-0 text-xl sm:text-2xl font-bold font-serif text-content tracking-wide">
                {{ activeFaction.name }}
              </div>

              <!-- Mã Phe & Thuộc tính & Số lượng thành viên -->
              <div class="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-content-subtle">
                <span class="px-2 py-0.5 rounded bg-surface border border-border-default font-mono">
                  {{ tr('FactionSelectModal.ma') }} {{ activeFaction.code }}
                </span>
                <span
                  v-if="activeFaction.is_neutral"
                  class="px-2 py-0.5 rounded bg-surface-hover text-content border border-border-default"
                >
                  {{ tr('FactionSelectModal.trung_lap') }}
                </span>
                <span
                  class="px-2 py-0.5 rounded bg-surface border border-border-default text-content-secondary flex items-center gap-1"
                >
                  <span>👥</span>
                  <span class="font-sans font-bold">{{
                    getMemberCount(activeFaction.id).toLocaleString(getFormattingLocale())
                  }}</span>
                  {{ tr('FactionSelectModal.thanh_vien') }}
                </span>
              </div>

              <!-- Trạng thái / Hành động -->
              <div class="mt-6 w-full pt-4 border-t border-border-default">
                <!-- Đang là phe đã gia nhập -->
                <div
                  v-if="isActiveJoined"
                  class="w-full py-2.5 px-3 rounded-lg bg-surface-selected border border-border text-content-secondary text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span>✓</span>
                  <span>{{ tr('FactionSelectModal.dang_thu_huong_toan_bo_hieu_ung') }}</span>
                </div>

                <!-- Chưa vào phe nào -> Nút Gia nhập -->
                <button
                  v-else-if="!hasJoined"
                  type="button"
                  class="w-full py-2.5 px-4 rounded-lg bg-content-secondary hover:bg-content border border-content text-surface font-serif font-bold text-sm tracking-wide shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  :disabled="factionStore.actionLoading"
                  @click="promptJoin(activeFaction)"
                >
                  {{ factionStore.actionLoading ? tr('DailyAttendance.dang_xu_ly') : tr('FactionSelectModal.gia_nhap_phe_nay') }}
                </button>

                <!-- Đã vào phe khác -> Nút Chuyển phe -->
                <button
                  v-else
                  type="button"
                  class="w-full py-2.5 px-4 rounded-lg bg-content-secondary hover:bg-content border border-content text-surface font-serif font-bold text-sm tracking-wide shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  :disabled="factionStore.actionLoading"
                  @click="promptChange(activeFaction)"
                >
                  {{ factionStore.actionLoading ? tr('DailyAttendance.dang_xu_ly') : tr('FactionSelectModal.chuyen_sang_phe_nay') }}
                </button>
              </div>
            </div>

            <!-- Cột Phải (8 cols): Thông tin chi tiết & Hiệu ứng -->
            <div class="lg:col-span-4 space-y-5">
              <!-- Giới thiệu / Tôn chỉ -->
              <div class="p-4 rounded-lg border border-border bg-surface-hover">
                <div
                  class="m-0 mb-2 text-xs uppercase tracking-widest font-extrabold text-content-secondary font-serif flex items-center gap-1.5"
                >
                  <span>📜</span>
                  <span>{{ tr('FactionSelectModal.ton_chi_gioi_thieu') }}</span>
                </div>
                <div class="m-0 text-sm leading-relaxed text-content whitespace-pre-line">
                  {{ activeFaction.description || tr('FactionSelectModal.chua_co_van_tu_mo_ta_cho_phe_nay') }}
                </div>
              </div>

              <!-- Danh sách Hiệu ứng Phe -->
              <div class="p-4 rounded-lg border border-border bg-surface-hover space-y-3">
                <div class="flex items-center justify-between border-b border-border-default pb-2">
                  <div
                    class="m-0 text-xs uppercase tracking-widest font-extrabold text-content-secondary font-serif flex items-center gap-1.5"
                  >
                    <span>⚡</span>
                    <span>{{ tr('FactionSelectModal.hieu_ung_ap_dung') }}{{ displayedEffects.length }})</span>
                  </div>
                  <span v-if="isActiveJoined" class="text-[11px] text-content font-medium">
                    {{ tr('FactionSelectModal.kich_hoat_theo_tai_khoan') }}
                  </span>
                </div>

                <div v-if="displayedEffects.length === 0" class="py-6 text-center text-xs text-content-subtle italic">
                  {{ tr('FactionSelectModal.phe_nay_hien_chua_co_hieu_ung_duoc_cong_bo') }}
                </div>

                <div v-else class="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  <article
                    v-for="effect in displayedEffects"
                    :key="effect.id ?? effect.code"
                    class="p-3 rounded-lg border border-border-default bg-surface hover:border-content-disabled transition-colors"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div class="flex items-center gap-2">
                        <span
                          class="px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider"
                          :class="getEffectTypeBadge(effect.effect_type).class"
                        >
                          {{ getEffectTypeBadge(effect.effect_type).icon }}
                          {{ getEffectTypeBadge(effect.effect_type).label }}
                        </span>
                        <div class="m-0 text-sm font-bold text-content font-serif">
                          {{ effect.name }}
                        </div>
                      </div>
                      <span class="text-[11px] font-mono text-content-subtle">
                        {{ tr('FactionSelectModal.chi_so') }} <strong class="text-content-secondary">{{ effect.target_stat }}</strong>
                      </span>
                    </div>

                    <div v-if="effect.description" class="m-0 text-xs text-content leading-relaxed">
                      {{ effect.description }}
                    </div>

                    <!-- Chi tiết config nếu có -->
                    <div
                      v-if="formatConfig(effect.config).length > 0"
                      class="mt-2 pt-1.5 border-t border-border flex flex-wrap gap-2 text-[10px]"
                    >
                      <span
                        v-for="cfg in formatConfig(effect.config)"
                        :key="cfg.key"
                        class="px-2 py-0.5 rounded bg-surface-hover border border-border-default text-content-secondary font-mono"
                      >
                        {{ cfg.key }}: {{ cfg.value }}
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            </div>

            <div class="col-span-4">
              <img :src="factionStore.activeFaction?.leader_1_image" alt="" draggable="false" />
            </div>
          </div>
        </section>

        <!-- ================= BOTTOM SECTION: CÁC PHE CÒN LẠI ================= -->
        <section class="space-y-4 pt-2">
          <div class="flex items-center justify-between border-b border-border-default pb-2">
            <div
              class="m-0 text-xs sm:text-sm uppercase tracking-widest font-extrabold text-content font-serif flex items-center gap-2"
            >
              <span>🏛️</span>
              <span>{{ tr('FactionSelectModal.cac_phe_khac') }}{{ otherFactions.length }})</span>
            </div>
            <span class="text-[11px] text-content-subtle"> {{ tr('FactionSelectModal.chon_phe_ben_duoi_de_xem_chi_tiet_ben_tren') }} </span>
          </div>

          <div v-if="otherFactions.length === 0" class="py-8 text-center text-xs text-content-subtle italic">
            {{ tr('FactionSelectModal.khong_con_phe_nao_khac') }}
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <article
              v-for="faction in otherFactions"
              :key="faction.id"
              class="slide-fade-in from-bottom player-content-in rounded-xl border border-border-default bg-surface hover:border-content-disabled p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div>
                <!-- Header card: Symbol, Name, Element -->
                <div class="flex items-start gap-3 mb-3">
                  <div
                    class="size-12 shrink-0 rounded-full border border-content-disabled bg-surface-hover flex items-center justify-center text-xl text-content-secondary select-none"
                  >
                    {{ faction.symbol || "⚔️" }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="m-0 text-base font-bold font-serif text-content truncate">
                      {{ faction.name }}
                    </div>
                    <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-content-subtle">
                      <span class="font-mono text-[10px]">{{ faction.code }}</span>
                      <span v-if="faction.element" class="text-content-secondary">{{ tr('FactionSelectModal.he') }} {{ faction.element }}</span>
                    </div>
                  </div>
                </div>

                <!-- Mô tả tóm tắt -->
                <div class="m-0 text-xs text-content line-clamp-2 leading-relaxed mb-3">
                  {{ faction.description || tr('FactionSelectModal.chua_co_mo_ta_chi_tiet') }}
                </div>

                <!-- Tóm tắt số thành viên & số hiệu ứng -->
                <div class="mb-4 flex flex-wrap gap-1.5 text-[10px]">
                  <span
                    class="px-1.5 py-0.5 rounded bg-surface-hover border border-border-default text-content-secondary flex items-center gap-1"
                  >
                    <span>👥</span>
                    <span class="font-sans font-bold">{{ getMemberCount(faction.id).toLocaleString(getFormattingLocale()) }}</span>
                    {{ tr('FactionSelectModal.thanh_vien') }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-surface-hover border border-border-default text-content">
                    {{ (faction.faction_effects ?? []).length }} {{ tr('FactionSelectModal.hieu_ung') }}
                  </span>
                  <span
                    v-if="faction.is_neutral"
                    class="px-1.5 py-0.5 rounded bg-surface-hover text-content border border-border-default"
                  >
                    {{ tr('FactionSelectModal.trung_lap_2') }}
                  </span>
                </div>
              </div>

              <!-- Nút hành động -->
              <div class="flex items-center gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  class="flex-1 py-1.5 px-2 rounded-lg border border-border bg-surface-hover hover:bg-surface-selected text-xs font-bold text-content-secondary transition-colors cursor-pointer"
                  @click="handleViewDetail(faction.id)"
                >
                  {{ tr('FactionSelectModal.xem_chi_tiet') }}
                </button>

                <!-- Nếu chưa có phe -> Nút gia nhập nhanh -->
                <button
                  v-if="!hasJoined"
                  type="button"
                  class="py-1.5 px-3 rounded-lg border border-content bg-content-secondary hover:bg-content text-xs font-bold text-surface transition-colors cursor-pointer"
                  @click="promptJoin(faction)"
                >
                  {{ tr('FactionSelectModal.gia_nhap') }}
                </button>

                <!-- Nếu đã có phe khác -> Nút chuyển phe nhanh -->
                <button
                  v-else
                  type="button"
                  class="py-1.5 px-3 rounded-lg border border-content-disabled bg-surface-selected hover:bg-border-default text-xs font-bold text-content-secondary transition-colors cursor-pointer"
                  @click="promptChange(faction)"
                >
                  {{ tr('FactionSelectModal.chuyen_phe') }}
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- ================= CONFIRMATION DIALOG ================= -->
      <Teleport to="body">
        <div v-if="confirmingAction" class="fixed inset-0 z-[10001] bg-content/75 flex items-center justify-center p-4">
          <div
            class="w-full max-w-md rounded-xl border border-border-default bg-surface text-content p-6 shadow-2xl space-y-4 player-popup-in"
          >
            <div class="text-center space-y-2">
              <div
                class="size-14 mx-auto rounded-full border-2 border-content-disabled bg-surface-hover flex items-center justify-center text-2xl text-content-secondary"
              >
                {{ confirmingAction.faction.symbol || "❖" }}
              </div>
              <div class="m-0 text-lg font-bold font-serif text-content">
                {{ confirmingAction.type === "join" ? tr('FactionSelectModal.xac_nhan_gia_nhap_phe') : tr('FactionSelectModal.xac_nhan_chuyen_doi_phe') }}
              </div>
              <div class="m-0 text-xs text-content leading-relaxed">
                <template v-if="confirmingAction.type === 'join'">
                  {{ tr('FactionSelectModal.ban_dang_chuan_bi_gia_nhap_phe') }}
                  <strong class="text-content-secondary font-serif text-sm">{{ confirmingAction.faction.name }}</strong
                  >{{ tr('FactionSelectModal.sau_khi_gia_nhap_cac_hieu_ung_chuc_phuc_va_rang_buoc_se_duoc_kic') }}
                </template>
                <template v-else>
                  {{ tr('FactionSelectModal.ban_dang_chon_chuyen_sang') }}
                  <strong class="text-content-secondary font-serif text-sm">{{ confirmingAction.faction.name }}</strong
                  >{{ tr('FactionSelectModal.moi_hieu_ung_cua_phe_hien_tai_se_duoc_thay_the_bang_hieu_ung_cua') }}
                </template>
              </div>
            </div>

            <div class="pt-2 flex items-center justify-end gap-3 border-t border-border-default">
              <button
                type="button"
                class="px-4 py-2 rounded-lg border border-border bg-surface-hover hover:bg-surface-selected text-xs font-bold text-content transition-colors cursor-pointer"
                :disabled="factionStore.actionLoading"
                @click="cancelConfirm"
              >
                {{ tr('FactionSelectModal.huy_bo') }}
              </button>
              <button
                type="button"
                class="px-5 py-2 rounded-lg border border-content bg-content-secondary hover:bg-content text-surface font-serif font-bold text-xs tracking-wide transition-colors cursor-pointer shadow-md disabled:opacity-50"
                :disabled="factionStore.actionLoading"
                @click="executeConfirm"
              >
                {{ factionStore.actionLoading ? tr('DailyAttendance.dang_xu_ly') : tr('FactionSelectModal.xac_nhan') }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </Modal>
</template>
