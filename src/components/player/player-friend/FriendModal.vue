<script setup lang="ts">
import type { FriendTab as ActiveTab, FriendDeleteKind, FriendDeleteTarget, UserFriend } from "../../../types/model/friend";
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref, watch, onUnmounted } from "vue";
import Pagination from "../../shared/Pagination.vue";
import Modal from "../../shared/Modal.vue";
import { useCountryStore } from "../../../stores/player-country-store.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useFriendStore } from "../../../stores/player-friend-store.ts";
import { useToast } from "../../../composables/useToast.ts";

import FriendAcceptedList from './FriendAcceptedList.vue';
import FriendReceivedRequests from './FriendReceivedRequests.vue';
import FriendSentRequests from './FriendSentRequests.vue';
import FriendDiscovery from './FriendDiscovery.vue';

const authStore = useAuthStore();
const friendStore = useFriendStore();
const countryStore = useCountryStore();
const toast = useToast();

const activeTab = computed<ActiveTab>({
  get: () => friendStore.activeTab,
  set: (value) => {
    friendStore.activeTab = value;
  },
});
const searchQuery = computed({
  get: () => friendStore.search,
  set: (value) => {
    friendStore.search = value;
  },
});
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(activeTab, () => {
  clearTimeout(searchTimer);
  void friendStore.loadData(currentUserId.value, 1);
});
watch(searchQuery, () => {
  clearTimeout(searchTimer);
  ++friendStore.requestId;
  searchTimer = setTimeout(() => {
    void friendStore.loadData(currentUserId.value, 1);
  }, 300);
});
onUnmounted(() => {
  clearTimeout(searchTimer);
  ++friendStore.requestId;
});
const directFriendIdInput = ref("");
const copiedId = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(copyTimer));

// Xác nhận thao tác xóa bạn
const deleteConfirmTarget = ref<FriendDeleteTarget | null>(null);

const currentUserId = computed<string>(() => {
  try {
    return authStore.userId;
  } catch {
    return "";
  }
});

async function handleRefresh() {
  if (!currentUserId.value) return;
  await Promise.all([friendStore.loadData(currentUserId.value), countryStore.fetchCountries()]);
}

onMounted(() => {
  if (currentUserId.value) {
    void handleRefresh();
  }
});

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = text;
    toast.success(tr("FriendModal.da_sao_chep_ma_nguoi_choi_vao_clipboard"));
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      if (copiedId.value === text) {
        copiedId.value = null;
      }
    }, 2000);
  } catch {
    toast.error(tr("FriendModal.khong_the_sao_chep"));
  }
}

// Bảng màu avatar ngẫu hứng dựa trên chuỗi ID
async function handleSendRequest(targetUserId: string) {
  if (!targetUserId) return;
  if (targetUserId === currentUserId.value) {
    toast.warning(tr("FriendModal.khong_the_tu_ket_ban_voi_chinh_minh"));
    return;
  }

  try {
    await friendStore.sendFriendRequest(targetUserId, currentUserId.value);
    toast.success(tr("FriendModal.da_gui_loi_moi_ket_ban_thanh_cong"));
  } catch (err) {
    const message = err instanceof Error ? err.message : tr("FriendModal.gui_loi_moi_that_bai");
    toast.error(message);
  }
}

async function handleSendDirectId() {
  const targetId = directFriendIdInput.value.trim();
  if (!targetId) {
    toast.warning(tr("FriendModal.vui_long_nhap_ma_id_nguoi_choi"));
    return;
  }

  await handleSendRequest(targetId);
  directFriendIdInput.value = "";
}

async function handleRespondRequest(recordId: string, accept: boolean) {
  if (!recordId) return;

  try {
    await friendStore.respondFriendRequest(recordId, accept, currentUserId.value);
    if (accept) {
      toast.success(tr("FriendModal.da_dong_y_ket_ban"));
    } else {
      toast.info(tr("FriendModal.da_tu_choi_loi_moi_ket_ban"));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : tr("FactionSelectModal.thao_tac_that_bai");
    toast.error(message);
  }
}

function confirmDelete(record: UserFriend, type: FriendDeleteKind) {
  const targetUserId =
    type === "friend"
      ? record.user_id === currentUserId.value
        ? record.friend_id
        : record.user_id
      : type === "sent_request"
        ? record.friend_id
        : record.user_id;

  deleteConfirmTarget.value = {
    id: record.id,
    type,
    targetUserId,
  };
}

async function executeDelete() {
  if (!deleteConfirmTarget.value) return;

  const target = deleteConfirmTarget.value;
  try {
    if (target.type === "friend") {
      await friendStore.removeFriend(target.targetUserId, currentUserId.value);
      toast.success(tr("FriendModal.da_xoa_khoi_danh_sach_ban_be"));
    } else if (target.type === "sent_request") {
      await friendStore.cancelFriendRequest(target.id, currentUserId.value);
      toast.success(tr("FriendModal.da_huy_loi_moi_ket_ban"));
    } else {
      await friendStore.respondFriendRequest(target.id, false, currentUserId.value);
      toast.success(tr("FriendModal.da_tu_choi_va_xoa_yeu_cau_ket_ban"));
    }
    deleteConfirmTarget.value = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : tr("FactionSelectModal.thao_tac_that_bai");
    toast.error(message);
  }
}
</script>

<template>
  <Modal :title="tr('FriendModal.quan_ly_ban_be')" :on-refresh="handleRefresh">
    <div class="w-full min-w-0 space-y-3 pb-6 sm:space-y-4 sm:pb-10">
      <!-- ID Người chơi hiện tại & Banner -->
      <div
        class="slide-fade-in from-top player-content-in bg-linear-to-r from-palette-173223 via-palette-1c3f2d to-palette-122b1e rounded-2xl p-3 sm:p-5 border border-emerald-800/40 shadow-md text-emerald-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
      >
        <div class="flex items-center gap-3.5 min-w-0">
          <div
            class="size-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shrink-0"
          >
            🎣
          </div>
          <div class="min-w-0">
            <div class="m-0 text-base sm:text-lg font-bold text-white tracking-wide">
              {{ tr("FriendModal.ma_nguoi_choi_cua_ban") }}
            </div>
            <div class="m-0 text-xs text-emerald-200/70 font-mono truncate" :title="currentUserId">
              {{ currentUserId || tr("FriendModal.chua_dang_nhap") }}
            </div>
          </div>
        </div>

        <button
          v-if="currentUserId"
          type="button"
          class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-100 text-xs font-semibold transition cursor-pointer"
          @click="copyToClipboard(currentUserId)"
        >
          <span>{{ copiedId === currentUserId ? tr("UserProfile.da_chep") : tr("FriendModal.sao_chep_id") }}</span>
        </button>
      </div>

      <!-- Thanh điều hướng Tab -->
      <div
        class="flex items-center gap-2 border-b border-emerald-900/10 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-thin -mx-2 px-2 sm:mx-0 sm:px-0"
      >
        <button
          type="button"
          class="flex shrink-0 snap-start items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
          :class="
            activeTab === 'friends'
              ? 'bg-content-strong text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'friends'"
        >
          <span>{{ tr("FriendModal.ban_be") }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'friends' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            {{ friendStore.counts.friends }}
          </span>
        </button>

        <button
          type="button"
          class="flex shrink-0 snap-start items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border relative"
          :class="
            activeTab === 'received'
              ? 'bg-content-strong text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'received'"
        >
          <span>{{ tr("FriendModal.loi_moi_da_nhan") }}</span>
          <span
            v-if="friendStore.counts.received > 0"
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse"
          >
            {{ friendStore.counts.received }}
          </span>
          <span
            v-else
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'received' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            0
          </span>
        </button>

        <button
          type="button"
          class="flex shrink-0 snap-start items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
          :class="
            activeTab === 'sent'
              ? 'bg-content-strong text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'sent'"
        >
          <span>{{ tr("FriendModal.loi_moi_da_gui") }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'sent' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            {{ friendStore.counts.sent }}
          </span>
        </button>

        <button
          type="button"
          class="flex shrink-0 snap-start items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
          :class="
            activeTab === 'discover'
              ? 'bg-content-strong text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'discover'"
        >
          <span>{{ tr("FriendModal.them_ban_be") }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'discover' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            {{ friendStore.counts.discover }}
          </span>
        </button>
      </div>

      <!-- Ô tìm kiếm & Gửi kết bạn nhanh qua ID -->
      <div class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <!-- Tìm kiếm theo ID trong danh sách -->
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="tr('FriendModal.tim_theo_ten_hoac_ma_nguoi_choi_id')"
            class="w-full px-3.5 py-2 pl-9 rounded-xl border border-emerald-900/20 bg-white/90 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          <span class="absolute left-3 top-2.5 text-xs text-gray-400">🔍</span>
          <button
            v-if="searchQuery"
            type="button"
            class="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            @click="searchQuery = ''"
          >
            ✕
          </button>
        </div>

        <!-- Nhập ID và gửi lời mời trực tiếp -->
        <div class="flex min-w-0 items-center gap-2">
          <input
            v-model="directFriendIdInput"
            type="text"
            :placeholder="tr('FriendModal.nhap_uuid_de_ket_ban_ngay')"
            class="min-w-0 flex-1 px-3 py-2 sm:px-3.5 rounded-xl border border-emerald-900/20 bg-white/90 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
            @keydown.enter="handleSendDirectId"
          />
          <button
            type="button"
            class="shrink-0 px-2.5 sm:px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            :disabled="!directFriendIdInput.trim() || friendStore.actionLoadingId === directFriendIdInput.trim()"
            @click="handleSendDirectId"
          >
            <span
              v-if="friendStore.actionLoadingId === directFriendIdInput.trim()"
              class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></span>
            <span>{{ tr("FriendModal.gui_loi_moi") }}</span>
          </button>
        </div>
      </div>

      <!-- Trạng thái Loading -->
      <div
        v-if="friendStore.loading && !friendStore.friends.length && !friendStore.profiles.length"
        class="py-16 flex flex-col items-center justify-center gap-3 text-emerald-800"
      >
        <div class="size-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold">{{ tr("FriendModal.dang_tai_danh_sach_ban_be") }}</span>
      </div>

      <!-- Trạng thái lỗi -->
      <div
        v-else-if="friendStore.error && !friendStore.friends.length"
        class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between"
      >
        <span>{{ friendStore.error }}</span>
        <button type="button" class="font-bold underline hover:no-underline cursor-pointer" @click="handleRefresh">
          {{ tr("Fishfarm.tai_lai") }}
        </button>
      </div>

      <!-- ================= TAB 1: BẠN BÈ ================= -->
<FriendAcceptedList v-else-if="activeTab === 'friends'" @copy="copyToClipboard" @delete="confirmDelete" @respond="handleRespondRequest" @send="handleSendRequest" @discover="activeTab = 'discover'" />

      <!-- ================= TAB 2: LỜI MỜI ĐÃ NHẬN ================= -->
<FriendReceivedRequests v-else-if="activeTab === 'received'" @copy="copyToClipboard" @delete="confirmDelete" @respond="handleRespondRequest" @send="handleSendRequest" @discover="activeTab = 'discover'" />

      <!-- ================= TAB 3: LỜI MỜI ĐÃ GỬI ================= -->
<FriendSentRequests v-else-if="activeTab === 'sent'" @copy="copyToClipboard" @delete="confirmDelete" @respond="handleRespondRequest" @send="handleSendRequest" @discover="activeTab = 'discover'" />

      <!-- ================= TAB 4: KHÁM PHÁ & THÊM BẠN ================= -->
<FriendDiscovery v-else-if="activeTab === 'discover'" @copy="copyToClipboard" @delete="confirmDelete" @respond="handleRespondRequest" @send="handleSendRequest" @discover="activeTab = 'discover'" />
    </div>

    <!-- Hộp thoại xác nhận xóa (Modal xác nhận bên trong) -->
    <div v-if="deleteConfirmTarget" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4 player-popup-in">
        <div class="flex items-center gap-3 text-red-600">
          <div class="size-10 rounded-full bg-red-100 flex items-center justify-center text-lg shrink-0">⚠️</div>
          <div class="m-0 text-base font-bold text-gray-900">
            {{
              deleteConfirmTarget.type === "friend"
                ? tr("FriendModal.xac_nhan_huy_ket_ban")
                : deleteConfirmTarget.type === "sent_request"
                  ? tr("FriendModal.huy_loi_moi_ket_ban")
                  : tr("FriendModal.xoa_yeu_cau_ket_ban")
            }}
          </div>
        </div>

        <div class="m-0 text-xs text-gray-600 leading-relaxed">
          {{
            deleteConfirmTarget.type === "friend"
              ? tr("FriendModal.ban_co_chac_chan_muon_xoa_nguoi_nay_khoi_danh_sach_ban_be_hai_ng")
              : deleteConfirmTarget.type === "sent_request"
                ? tr("FriendModal.ban_co_chac_chan_muon_huy_loi_moi_ket_ban_da_gui_toi_nguoi_choi_")
                : tr("FriendModal.ban_co_chac_chan_muon_xoa_yeu_cau_ket_ban_nay")
          }}
        </div>

        <div class="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-700 truncate">
          {{ tr("FriendModal.ma_nguoi_choi") }} {{ deleteConfirmTarget.targetUserId }}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer"
            @click="deleteConfirmTarget = null"
          >
            {{ tr("FactionSelectModal.huy_bo") }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            :disabled="
              friendStore.actionLoadingId === deleteConfirmTarget.id ||
              friendStore.actionLoadingId === deleteConfirmTarget.targetUserId
            "
            @click="executeDelete"
          >
            <span
              v-if="
                friendStore.actionLoadingId === deleteConfirmTarget.id ||
                friendStore.actionLoadingId === deleteConfirmTarget.targetUserId
              "
              class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></span>
            <span>{{ tr("FriendModal.xac_nhan_xoa") }}</span>
          </button>
        </div>
      </div>
    </div>
    <Pagination
      :page="friendStore.page"
      :page-size="friendStore.pageSize"
      :total="friendStore.total"
      :loading="friendStore.loading"
      @change="friendStore.loadData(currentUserId, $event)"
    />
  </Modal>
</template>
