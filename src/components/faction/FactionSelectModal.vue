<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import Modal from "../Modal.vue";
import FactionActivityRewards from "./FactionActivityRewards.vue";
import { useFactionStore } from "../../stores/faction";
import { useAuthStore } from "../../stores/auth";
import { useToast } from "../../composables/useToast";
import type { Faction, FactionEffect, CurrentFactionEffect } from "../../data/supabaseFactionRepository";

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
      toast.success(`Đã chính thức gia nhập phe: ${faction.name}`);
    } else {
      await factionStore.changeFaction(faction.id, currentUserId.value);
      toast.success(`Đã chuyển sang phe: ${faction.name}`);
    }
    confirmingAction.value = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Thao tác thất bại";
    toast.error(message);
  }
}

function getEffectTypeBadge(type: string) {
  switch (type) {
    case "BUFF":
      return {
        label: "Hiệu quả phe",
        class: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: "✦",
      };
    case "DEBUFF":
      return {
        label: "Hiệu quả cân bằng",
        class: "bg-rose-100 text-rose-800 border-rose-300",
        icon: "▲",
      };
    case "UNIQUE":
      return {
        label: "Hiệu quả độc nhất",
        class: "bg-amber-100 text-amber-800 border-amber-300",
        icon: "★",
      };
    default:
      return {
        label: type,
        class: "bg-slate-100 text-slate-700 border-slate-300",
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
  <Modal
    title="Phe phái"
    sub-title="Gia nhập phe phái để nhận các lợi ích tập thể"
    :on-refresh="handleRefresh"
  >
    <div class="faction-screen -m-2 w-full min-h-full p-5 sm:p-8 space-y-6 bg-[#f5f9f0] text-[#24352a]">
      <!-- Thanh trạng thái người chơi -->
      <section
        class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-inner"
      >
        <div class="flex items-center gap-2 text-xs sm:text-sm">
          <span class="text-emerald-400 font-serif">❖</span>
          <span class="text-[#617565] uppercase tracking-wider text-[11px] font-bold">phe hiện tại:</span>
          <span v-if="joinedFaction" class="font-bold text-emerald-800 font-serif text-sm sm:text-base">
            {{ joinedFaction.name }} ({{ joinedFaction.code }})
          </span>
          <span v-else class="text-stone-500 italic">
            Chưa gia nhập phe nào
          </span>
        </div>

        <div v-if="joinedFaction && activeFaction && activeFaction.id !== joinedFaction.id">
          <button
            type="button"
            class="px-3 py-1 rounded border border-emerald-700/50 bg-emerald-100 hover:bg-emerald-200 text-xs font-bold text-emerald-800 transition-colors cursor-pointer"
            @click="handleResetToJoined"
          >
            ← Trở về phe của bạn
          </button>
        </div>
      </section>

      <!-- Loading State -->
      <div v-if="factionStore.loading" class="py-16 text-center text-[#526a5e] space-y-2">
        <div class="inline-block animate-spin text-2xl text-emerald-700">❖</div>
        <p class="text-xs uppercase tracking-widest font-bold">Đang tải thông tin phe phái...</p>
      </div>

      <!-- Error State -->
      <div
        v-else-if="factionStore.error && factionStore.factions.length === 0"
        class="p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 text-center text-sm"
      >
        <p>{{ factionStore.error }}</p>
        <button
          type="button"
          class="mt-3 px-4 py-1.5 rounded border border-red-700 bg-red-100 hover:bg-red-200 text-xs font-bold transition-colors cursor-pointer"
          @click="handleRefresh"
        >
          Thử lại
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
          class="top-faction-card rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] p-5 sm:p-7 shadow-xl relative overflow-hidden"
        >
          <!-- Nền hoa văn mờ trang nghiêm -->
          <!-- <div
            class="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none select-none font-serif text-[200px] leading-none text-emerald-800 flex items-center justify-center"
            aria-hidden="true"
          >
            {{ activeFaction.symbol || "❖" }}
          </div> -->

          <!-- Nhãn đầu section -->
          <div class="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs uppercase tracking-widest font-extrabold text-emerald-800 font-serif">
                {{ isActiveJoined ? "👑 Phe Hiện Tại" : (hasJoined ? "👁️ Chi Tiết Phe Đang Xem Xét" : "⚔️ Chi Tiết Phe Đã Chọn") }}
              </span>
              <span
                v-if="isActiveJoined"
                class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300"
              >
                Đang Kích Hoạt
              </span>
            </div>
            <div class="flex items-center gap-2.5 text-xs text-emerald-800 font-serif">
              <span v-if="activeFaction.element">
                Mệnh: <span class="font-bold text-emerald-700">{{ activeFaction.element }}</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-800 font-sans font-medium text-[11px]">
                <span>👥</span>
                <span class="font-bold">{{ getMemberCount(activeFaction.id).toLocaleString("vi-VN") }}</span> thành viên
              </span>
            </div>
          </div>

          <!-- Bố cục 2 cột: Cột trái (Biểu tượng & Thông tin cốt lõi) | Cột phải (Thông tin chi tiết & Hiệu ứng) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Cột Trái (4 cols) -->
            <div class="lg:col-span-4 flex flex-col items-center text-center p-5 rounded-lg border border-[#d5e1d0] bg-[#eaf2e5]">
              <!-- Huy hiệu / Symbol -->
              <div
                class="size-24 sm:size-28 rounded-full border-2 border-emerald-600/60 bg-[#f5f9f0] flex items-center justify-center text-4xl sm:text-5xl shadow-md text-emerald-800 mb-4 select-none"
              >
                {{ activeFaction.symbol || "⚔️" }}
              </div>

              <!-- Tên Phe -->
              <h3 class="m-0 text-xl sm:text-2xl font-bold font-serif text-emerald-950 tracking-wide">
                {{ activeFaction.name }}
              </h3>

              <!-- Mã Phe & Thuộc tính & Số lượng thành viên -->
              <div class="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-[#617565]">
                <span class="px-2 py-0.5 rounded bg-[#f5f9f0] border border-[#cbd9c6] font-mono">
                  MÃ: {{ activeFaction.code }}
                </span>
                <span
                  v-if="activeFaction.is_neutral"
                  class="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300"
                >
                  Trung Lập
                </span>
                <span class="px-2 py-0.5 rounded bg-[#f5f9f0] border border-[#cbd9c6] text-emerald-800 flex items-center gap-1">
                  <span>👥</span>
                  <span class="font-sans font-bold">{{ getMemberCount(activeFaction.id).toLocaleString("vi-VN") }}</span> thành viên
                </span>
              </div>

              <!-- Trạng thái / Hành động -->
              <div class="mt-6 w-full pt-4 border-t border-[#cbd9c6]">
                <!-- Đang là phe đã gia nhập -->
                <div
                  v-if="isActiveJoined"
                  class="w-full py-2.5 px-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span>✓</span>
                  <span>Đang thụ hưởng toàn bộ hiệu ứng</span>
                </div>

                <!-- Chưa vào phe nào -> Nút Gia nhập -->
                <button
                  v-else-if="!hasJoined"
                  type="button"
                  class="w-full py-2.5 px-4 rounded-lg bg-emerald-800 hover:bg-emerald-700 border border-emerald-600 text-white font-serif font-bold text-sm tracking-wide shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  :disabled="factionStore.actionLoading"
                  @click="promptJoin(activeFaction)"
                >
                  {{ factionStore.actionLoading ? "Đang xử lý..." : "Gia Nhập Phe Này" }}
                </button>

                <!-- Đã vào phe khác -> Nút Chuyển phe -->
                <button
                  v-else
                  type="button"
                  class="w-full py-2.5 px-4 rounded-lg bg-emerald-800 hover:bg-emerald-700 border border-emerald-600/80 text-emerald-100 font-serif font-bold text-sm tracking-wide shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  :disabled="factionStore.actionLoading"
                  @click="promptChange(activeFaction)"
                >
                  {{ factionStore.actionLoading ? "Đang xử lý..." : "Chuyển Sang Phe Này" }}
                </button>
              </div>
            </div>

            <!-- Cột Phải (8 cols): Thông tin chi tiết & Hiệu ứng -->
            <div class="lg:col-span-8 space-y-5">
              <!-- Giới thiệu / Tôn chỉ -->
              <div class="p-4 rounded-lg border border-[#d5e1d0] bg-[#eaf2e5]">
                <h4 class="m-0 mb-2 text-xs uppercase tracking-widest font-extrabold text-emerald-800 font-serif flex items-center gap-1.5">
                  <span>📜</span>
                  <span>Tôn Chỉ & Giới Thiệu</span>
                </h4>
                <p class="m-0 text-sm leading-relaxed text-[#405446] whitespace-pre-line">
                  {{ activeFaction.description || "Chưa có văn tự mô tả cho phe này." }}
                </p>
              </div>

              <!-- Danh sách Hiệu ứng Phe -->
              <div class="p-4 rounded-lg border border-[#d5e1d0] bg-[#eaf2e5] space-y-3">
                <div class="flex items-center justify-between border-b border-[#cbd9c6] pb-2">
                  <h4 class="m-0 text-xs uppercase tracking-widest font-extrabold text-emerald-800 font-serif flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Hiệu Ứng Áp Dụng ({{ displayedEffects.length }})</span>
                  </h4>
                  <span v-if="isActiveJoined" class="text-[11px] text-emerald-700 font-medium">
                    ● Kích hoạt theo tài khoản
                  </span>
                </div>

                <div v-if="displayedEffects.length === 0" class="py-6 text-center text-xs text-[#617565] italic">
                  phe này hiện chưa có hiệu ứng được công bố.
                </div>

                <div v-else class="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  <article
                    v-for="effect in displayedEffects"
                    :key="effect.id ?? effect.code"
                    class="p-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] hover:border-[#8eaa91] transition-colors"
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
                        <h5 class="m-0 text-sm font-bold text-emerald-950 font-serif">
                          {{ effect.name }}
                        </h5>
                      </div>
                      <span class="text-[11px] font-mono text-[#617565]">
                        Chỉ số: <strong class="text-emerald-800">{{ effect.target_stat }}</strong>
                      </span>
                    </div>

                    <p v-if="effect.description" class="m-0 text-xs text-[#405446] leading-relaxed">
                      {{ effect.description }}
                    </p>

                    <!-- Chi tiết config nếu có -->
                    <div
                      v-if="formatConfig(effect.config).length > 0"
                      class="mt-2 pt-1.5 border-t border-[#d5e1d0] flex flex-wrap gap-2 text-[10px]"
                    >
                      <span
                        v-for="cfg in formatConfig(effect.config)"
                        :key="cfg.key"
                        class="px-2 py-0.5 rounded bg-[#eaf2e5] border border-[#cbd9c6] text-emerald-900 font-mono"
                      >
                        {{ cfg.key }}: {{ cfg.value }}
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ================= BOTTOM SECTION: CÁC PHE CÒN LẠI ================= -->
        <section class="space-y-4 pt-2">
          <div class="flex items-center justify-between border-b border-[#cbd9c6] pb-2">
            <h3 class="m-0 text-xs sm:text-sm uppercase tracking-widest font-extrabold text-[#526a58] font-serif flex items-center gap-2">
              <span>🏛️</span>
              <span>Các phe Khác ({{ otherFactions.length }})</span>
            </h3>
            <span class="text-[11px] text-[#617565]">
              Chọn phe bên dưới để xem chi tiết bên trên
            </span>
          </div>

          <div v-if="otherFactions.length === 0" class="py-8 text-center text-xs text-gray-500 italic">
            Không còn phe nào khác.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <article
              v-for="faction in otherFactions"
              :key="faction.id"
              class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] hover:border-emerald-500/70 p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div>
                <!-- Header card: Symbol, Name, Element -->
                <div class="flex items-start gap-3 mb-3">
                  <div
                    class="size-12 shrink-0 rounded-full border border-emerald-600/40 bg-[#eaf2e5] flex items-center justify-center text-xl text-emerald-800 select-none"
                  >
                    {{ faction.symbol || "⚔️" }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class="m-0 text-base font-bold font-serif text-emerald-950 truncate">
                      {{ faction.name }}
                    </h4>
                    <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#617565]">
                      <span class="font-mono text-[10px]">{{ faction.code }}</span>
                      <span v-if="faction.element" class="text-emerald-800">· Hệ {{ faction.element }}</span>
                    </div>
                  </div>
                </div>

                <!-- Mô tả tóm tắt -->
                <p class="m-0 text-xs text-[#405446] line-clamp-2 leading-relaxed mb-3">
                  {{ faction.description || "Chưa có mô tả chi tiết." }}
                </p>

                <!-- Tóm tắt số thành viên & số hiệu ứng -->
                <div class="mb-4 flex flex-wrap gap-1.5 text-[10px]">
                  <span class="px-1.5 py-0.5 rounded bg-[#eaf2e5] border border-[#cbd9c6] text-emerald-800 flex items-center gap-1">
                    <span>👥</span>
                    <span class="font-sans font-bold">{{ getMemberCount(faction.id).toLocaleString("vi-VN") }}</span> thành viên
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-[#eaf2e5] border border-[#cbd9c6] text-[#405446]">
                    {{ (faction.faction_effects ?? []).length }} Hiệu ứng
                  </span>
                  <span
                    v-if="faction.is_neutral"
                    class="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300"
                  >
                    Trung lập
                  </span>
                </div>
              </div>

              <!-- Nút hành động -->
              <div class="flex items-center gap-2 pt-3 border-t border-[#d5e1d0]">
                <button
                  type="button"
                  class="flex-1 py-1.5 px-2 rounded-lg border border-[#b7cbb4] bg-[#eaf2e5] hover:bg-[#dce9d7] text-xs font-bold text-emerald-900 transition-colors cursor-pointer"
                  @click="handleViewDetail(faction.id)"
                >
                  Xem chi tiết
                </button>

                <!-- Nếu chưa có phe -> Nút gia nhập nhanh -->
                <button
                  v-if="!hasJoined"
                  type="button"
                  class="py-1.5 px-3 rounded-lg border border-emerald-600 bg-emerald-800 hover:bg-emerald-700 text-xs font-bold text-white transition-colors cursor-pointer"
                  @click="promptJoin(faction)"
                >
                  Gia nhập
                </button>

                <!-- Nếu đã có phe khác -> Nút chuyển phe nhanh -->
                <button
                  v-else
                  type="button"
                  class="py-1.5 px-3 rounded-lg border border-emerald-700 bg-emerald-100 hover:bg-emerald-200 text-xs font-bold text-emerald-900 transition-colors cursor-pointer"
                  @click="promptChange(faction)"
                >
                  Chuyển phe
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- ================= CONFIRMATION DIALOG ================= -->
      <Teleport to="body">
        <div
          v-if="confirmingAction"
          class="fixed inset-0 z-[10001] bg-black/75 flex items-center justify-center p-4"
        >
          <div
            class="w-full max-w-md rounded-xl border border-emerald-300 bg-[#f5f9f0] text-[#24352a] p-6 shadow-2xl space-y-4 animate-scale-in"
          >
            <div class="text-center space-y-2">
              <div class="size-14 mx-auto rounded-full border-2 border-emerald-500/60 bg-[#eaf2e5] flex items-center justify-center text-2xl text-emerald-800">
                {{ confirmingAction.faction.symbol || "❖" }}
              </div>
              <h3 class="m-0 text-lg font-bold font-serif text-emerald-950">
                {{ confirmingAction.type === "join" ? "Xác nhận gia nhập phe" : "Xác nhận chuyển đổi phe" }}
              </h3>
              <p class="m-0 text-xs text-[#405446] leading-relaxed">
                <template v-if="confirmingAction.type === 'join'">
                  Bạn đang chuẩn bị gia nhập phe
                  <strong class="text-emerald-800 font-serif text-sm">{{ confirmingAction.faction.name }}</strong>.
                  Sau khi gia nhập, các hiệu ứng chúc phúc và ràng buộc sẽ được kích hoạt lên nhân vật.
                </template>
                <template v-else>
                  Bạn đang chọn chuyển sang
                  <strong class="text-emerald-800 font-serif text-sm">{{ confirmingAction.faction.name }}</strong>.
                  Mọi hiệu ứng của phe hiện tại sẽ được thay thế bằng hiệu ứng của phe mới.
                </template>
              </p>
            </div>

            <div class="pt-2 flex items-center justify-end gap-3 border-t border-[#cbd9c6]">
              <button
                type="button"
                class="px-4 py-2 rounded-lg border border-[#b7cbb4] bg-[#eaf2e5] hover:bg-[#dce9d7] text-xs font-bold text-[#405446] transition-colors cursor-pointer"
                :disabled="factionStore.actionLoading"
                @click="cancelConfirm"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                class="px-5 py-2 rounded-lg font-serif font-bold text-xs tracking-wide transition-colors cursor-pointer shadow-md disabled:opacity-50"
                :class="confirmingAction.type === 'join' ? 'bg-emerald-800 hover:bg-emerald-700 border border-emerald-600 text-white' : 'bg-emerald-800 hover:bg-emerald-700 border border-emerald-600 text-emerald-100'"
                :disabled="factionStore.actionLoading"
                @click="executeConfirm"
              >
                {{ factionStore.actionLoading ? "Đang xử lý..." : "Xác Nhận" }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </Modal>
</template>

<style scoped>
.faction-screen {
  font-family: inherit;
}
</style>
