<script setup lang="ts">
import type { FriendTab as ActiveTab, FriendUserProfile, UserFriend } from "../../../types/model/friend";
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { useCountryStore } from "../../../stores/country.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useFriendStore, type FriendshipRelation } from "../../../stores/friend.ts";
import { useToast } from "../../../composables/useToast.ts";


const authStore = useAuthStore();
const friendStore = useFriendStore();
const countryStore = useCountryStore();
const toast = useToast();

const activeTab = ref<ActiveTab>("friends");
const searchQuery = ref("");
const directFriendIdInput = ref("");
const copiedId = ref<string | null>(null);

// Xác nhận thao tác xóa bạn
const deleteConfirmTarget = ref<{
  id: string;
  type: "friend" | "sent_request" | "received_request";
  targetUserId: string;
} | null>(null);

const currentUserId = computed<string>(() => {
  try {
    return authStore.userId;
  } catch {
    return "";
  }
});

const profilesMap = computed(() => friendStore.profilesMap);

const acceptedFriends = computed(() => friendStore.acceptedFriends);

const receivedRequests = computed(() => friendStore.getReceivedRequests(currentUserId.value));

const sentRequests = computed(() => friendStore.getSentRequests(currentUserId.value));

// Danh sách tất cả người chơi khác từ user_profile
const otherPlayers = computed(() => {
  return friendStore.profiles.filter((profile) => profile.id !== currentUserId.value);
});

// Lọc người chơi ở tab Khám phá
const filteredPlayers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return otherPlayers.value;

  return otherPlayers.value.filter((profile) => profile.id.toLowerCase().includes(query) || profile.display_name?.toLocaleLowerCase().includes(query));
});

// Lọc bạn bè ở tab Bạn bè
const filteredFriends = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return acceptedFriends.value;

  return acceptedFriends.value.filter((record) => {
    const friendId = record.user_id === currentUserId.value ? record.friend_id : record.user_id;
    return friendId.toLowerCase().includes(query) || profilesMap.value.get(friendId)?.display_name?.toLocaleLowerCase().includes(query);
  });
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

function formatUuid(uuid: string): string {
  if (!uuid || uuid.length < 12) return uuid;
  return `${uuid.slice(0, 8)}...${uuid.slice(-4)}`;
}

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = text;
    toast.success(tr('FriendModal.da_sao_chep_ma_nguoi_choi_vao_clipboard'));
    setTimeout(() => {
      if (copiedId.value === text) {
        copiedId.value = null;
      }
    }, 2000);
  } catch {
    toast.error(tr('FriendModal.khong_the_sao_chep'));
  }
}

// Bảng màu avatar ngẫu hứng dựa trên chuỗi ID
const avatarGradients = [
  "from-emerald-600 to-teal-700",
  "from-blue-600 to-cyan-700",
  "from-amber-600 to-orange-700",
  "from-violet-600 to-purple-700",
  "from-rose-600 to-pink-700",
  "from-teal-600 to-emerald-800",
];

function getAvatarGradient(id: string): string {
  if (!id) return avatarGradients[0];
  const charCode = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return avatarGradients[charCode % avatarGradients.length];
}

function getFriendProfile(record: UserFriend): FriendUserProfile | undefined {
  const friendId = record.user_id === currentUserId.value ? record.friend_id : record.user_id;
  return profilesMap.value.get(friendId);
}

function getSenderProfile(record: UserFriend): FriendUserProfile | undefined {
  return profilesMap.value.get(record.user_id);
}

function getRecipientProfile(record: UserFriend): FriendUserProfile | undefined {
  return profilesMap.value.get(record.friend_id);
}

function getRelation(targetUserId: string): FriendshipRelation {
  return friendStore.getFriendshipWithUser(targetUserId, currentUserId.value);
}

async function handleSendRequest(targetUserId: string) {
  if (!targetUserId) return;
  if (targetUserId === currentUserId.value) {
    toast.warning(tr('FriendModal.khong_the_tu_ket_ban_voi_chinh_minh'));
    return;
  }

  try {
    await friendStore.sendFriendRequest(targetUserId, currentUserId.value);
    toast.success(tr('FriendModal.da_gui_loi_moi_ket_ban_thanh_cong'));
  } catch (err) {
    const message = err instanceof Error ? err.message : tr('FriendModal.gui_loi_moi_that_bai');
    toast.error(message);
  }
}

async function handleSendDirectId() {
  const targetId = directFriendIdInput.value.trim();
  if (!targetId) {
    toast.warning(tr('FriendModal.vui_long_nhap_ma_id_nguoi_choi'));
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
      toast.success(tr('FriendModal.da_dong_y_ket_ban'));
    } else {
      toast.info(tr('FriendModal.da_tu_choi_loi_moi_ket_ban'));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : tr('FactionSelectModal.thao_tac_that_bai');
    toast.error(message);
  }
}

function confirmDelete(record: UserFriend, type: "friend" | "sent_request" | "received_request") {
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
      toast.success(tr('FriendModal.da_xoa_khoi_danh_sach_ban_be'));
    } else if (target.type === "sent_request") {
      await friendStore.cancelFriendRequest(target.id, currentUserId.value);
      toast.success(tr('FriendModal.da_huy_loi_moi_ket_ban'));
    } else {
      await friendStore.respondFriendRequest(target.id, false, currentUserId.value);
      toast.success(tr('FriendModal.da_tu_choi_va_xoa_yeu_cau_ket_ban'));
    }
    deleteConfirmTarget.value = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : tr('FactionSelectModal.thao_tac_that_bai');
    toast.error(message);
  }
}
</script>

<template>
  <Modal :title="tr('FriendModal.quan_ly_ban_be')" :sub-title="tr('FriendModal.ket_noi_cong_dong_cau_ca')" :on-refresh="handleRefresh">
    <div class="w-full min-w-0 space-y-3 pb-6 sm:space-y-4 sm:pb-10">
      <!-- ID Người chơi hiện tại & Banner -->
      <div
        class="bg-linear-to-r from-[#173223] via-[#1c3f2d] to-[#122b1e] rounded-2xl p-3 sm:p-5 border border-emerald-800/40 shadow-md text-emerald-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
      >
        <div class="flex items-center gap-3.5 min-w-0">
          <div
            class="size-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shrink-0"
          >
            🎣
          </div>
          <div class="min-w-0">
            <div class="m-0 text-base sm:text-lg font-bold text-white tracking-wide">{{ tr('FriendModal.ma_nguoi_choi_cua_ban') }}</div>
            <div class="m-0 text-xs text-emerald-200/70 font-mono truncate" :title="currentUserId">
              {{ currentUserId || tr('FriendModal.chua_dang_nhap') }}
            </div>
          </div>
        </div>

        <button
          v-if="currentUserId"
          type="button"
          class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-100 text-xs font-semibold transition cursor-pointer"
          @click="copyToClipboard(currentUserId)"
        >
          <span>{{ copiedId === currentUserId ? tr('UserProfile.da_chep') : tr('FriendModal.sao_chep_id') }}</span>
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
              ? 'bg-[#153221] text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'friends'"
        >
          <span>{{ tr('FriendModal.ban_be') }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'friends' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            {{ acceptedFriends.length }}
          </span>
        </button>

        <button
          type="button"
          class="flex shrink-0 snap-start items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border relative"
          :class="
            activeTab === 'received'
              ? 'bg-[#153221] text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'received'"
        >
          <span>{{ tr('FriendModal.loi_moi_da_nhan') }}</span>
          <span
            v-if="receivedRequests.length > 0"
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse"
          >
            {{ receivedRequests.length }}
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
              ? 'bg-[#153221] text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'sent'"
        >
          <span>{{ tr('FriendModal.loi_moi_da_gui') }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'sent' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            {{ sentRequests.length }}
          </span>
        </button>

        <button
          type="button"
          class="flex shrink-0 snap-start items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
          :class="
            activeTab === 'discover'
              ? 'bg-[#153221] text-white border-emerald-800 shadow-sm'
              : 'bg-white/80 text-emerald-950/80 border-emerald-900/10 hover:bg-emerald-50'
          "
          @click="activeTab = 'discover'"
        >
          <span>{{ tr('FriendModal.them_ban_be') }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            :class="activeTab === 'discover' ? 'bg-emerald-800 text-emerald-200' : 'bg-gray-200 text-gray-700'"
          >
            {{ otherPlayers.length }}
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
            <span>{{ tr('FriendModal.gui_loi_moi') }}</span>
          </button>
        </div>
      </div>

      <!-- Trạng thái Loading -->
      <div
        v-if="friendStore.loading && !friendStore.friends.length && !friendStore.profiles.length"
        class="py-16 flex flex-col items-center justify-center gap-3 text-emerald-800"
      >
        <div class="size-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold">{{ tr('FriendModal.dang_tai_danh_sach_ban_be') }}</span>
      </div>

      <!-- Trạng thái lỗi -->
      <div
        v-else-if="friendStore.error && !friendStore.friends.length"
        class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between"
      >
        <span>{{ friendStore.error }}</span>
        <button type="button" class="font-bold underline hover:no-underline cursor-pointer" @click="handleRefresh">
          {{ tr('Fishfarm.tai_lai') }}
        </button>
      </div>

      <!-- ================= TAB 1: BẠN BÈ ================= -->
      <div v-else-if="activeTab === 'friends'" class="space-y-3">
        <div
          v-if="filteredFriends.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">🤝</div>
          <div class="m-0 text-sm font-bold text-gray-800">{{ tr('FriendModal.chua_co_ban_be_nao') }}</div>
          <div class="m-0 text-xs text-gray-500 mt-1">
            {{
              searchQuery
                ? tr('FriendModal.khong_tim_thay_ban_be_phu_hop_voi_tim_kiem')
                : tr('FriendModal.hay_chuyen_sang_tab_them_ban_be_de_ket_ban_cung_nhung_ngu_thu_kh')
            }}
          </div>
          <button
            v-if="!searchQuery"
            type="button"
            class="mt-4 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            @click="activeTab = 'discover'"
          >
            {{ tr('FriendModal.tim_ban_moi_ngay') }}
          </button>
        </div>

        <div v-else class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="record in filteredFriends"
            :key="record.id"
            class="p-4 rounded-2xl border border-emerald-900/10 bg-white/95 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <!-- Avatar -->
                <div
                  class="size-11 rounded-xl bg-linear-to-br flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                  :class="getAvatarGradient(record.user_id === currentUserId ? record.friend_id : record.user_id)"
                >
                  <img v-if="getFriendProfile(record)?.avatar_url" :src="getFriendProfile(record)?.avatar_url ?? ''" :alt="tr('UpdateIdentityModal.anh_dai_dien')" class="h-full w-full rounded-xl object-cover" referrerpolicy="no-referrer" />
                  <span v-else>{{ (getFriendProfile(record)?.display_name || (record.user_id === currentUserId ? record.friend_id : record.user_id)).slice(0, 2).toUpperCase() }}</span>
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-gray-900 font-mono">
                      {{ getFriendProfile(record)?.display_name || formatUuid(record.user_id === currentUserId ? record.friend_id : record.user_id) }}
                    </span>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                      :title="tr('FriendModal.sao_chep_toan_bo_id')"
                      @click="copyToClipboard(record.user_id === currentUserId ? record.friend_id : record.user_id)"
                    >
                      📋
                    </button>
                  </div>

                  <div class="mt-1 text-[11px] text-[#556655]">{{ countryStore.getCountryName(getFriendProfile(record)?.country_id) }}</div>
                  <!-- Thông số hồ sơ nếu có -->
                  <div v-if="getFriendProfile(record)" class="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span
                      class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200"
                    >
                      {{ tr('UserProfile.cap') }} {{ getFriendProfile(record)?.level }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      ✨ {{ Number(getFriendProfile(record)?.experience_point ?? 0).toLocaleString(getFormattingLocale()) }} EXP
                    </span>
                  </div>
                  <div v-else class="text-[10px] text-gray-400 mt-0.5">{{ tr('FriendModal.chua_tai_du_lieu_ho_so') }}</div>
                </div>
              </div>

              <!-- Nút Xóa bạn -->
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="confirmDelete(record, 'friend')"
              >
                {{ tr('FriendModal.xoa_ban') }}
              </button>
            </div>

            <!-- Thời gian kết bạn -->
            <div
              class="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-400"
            >
              <span>{{ tr('FriendModal.da_ket_ban_tu') }} {{ new Date(record.created_at).toLocaleDateString(getFormattingLocale()) }}</span>
              <span class="text-emerald-700 font-semibold">{{ tr('FriendModal.ban_be_2') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 2: LỜI MỜI ĐÃ NHẬN ================= -->
      <div v-else-if="activeTab === 'received'" class="space-y-3">
        <div
          v-if="receivedRequests.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">📬</div>
          <div class="m-0 text-sm font-bold text-gray-800">{{ tr('FriendModal.khong_co_loi_moi_nao') }}</div>
          <div class="m-0 text-xs text-gray-500 mt-1">
            {{ tr('FriendModal.hien_tai_ban_chua_nhan_duoc_yeu_cau_ket_ban_nao_tu_nguoi_choi_kh') }}
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="record in receivedRequests"
            :key="record.id"
            class="p-4 rounded-2xl border border-amber-200/60 bg-amber-50/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="size-11 rounded-xl bg-linear-to-br flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                :class="getAvatarGradient(record.user_id)"
              >
                <img v-if="getSenderProfile(record)?.avatar_url" :src="getSenderProfile(record)?.avatar_url ?? ''" :alt="tr('UpdateIdentityModal.anh_dai_dien')" class="h-full w-full rounded-xl object-cover" referrerpolicy="no-referrer" />
                <span v-else>{{ (getSenderProfile(record)?.display_name || record.user_id).slice(0, 2).toUpperCase() }}</span>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-gray-900 font-mono">
                    {{ getSenderProfile(record)?.display_name || formatUuid(record.user_id) }}
                  </span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                    :title="tr('FriendModal.sao_chep_toan_bo_id')"
                    @click="copyToClipboard(record.user_id)"
                  >
                    📋
                  </button>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                    {{ tr('FriendModal.muon_ket_ban') }}
                  </span>
                </div>

                <div class="mt-1 text-[11px] text-[#556655]">{{ countryStore.getCountryName(getSenderProfile(record)?.country_id) }}</div>
                <div v-if="getSenderProfile(record)" class="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span class="font-bold text-amber-800"> {{ tr('UserProfile.cap') }} {{ getSenderProfile(record)?.level }} </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-emerald-800 font-medium">
                    {{ Number(getSenderProfile(record)?.experience_point ?? 0).toLocaleString(getFormattingLocale()) }} EXP
                  </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-400 text-[10px]">
                    {{ new Date(record.created_at).toLocaleDateString(getFormattingLocale()) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Hành động phản hồi: Đồng ý, Từ chối, Xóa -->
            <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
              <button
                type="button"
                class="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="handleRespondRequest(record.id, true)"
              >
                <span
                  v-if="friendStore.actionLoadingId === record.id"
                  class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                ></span>
                <span>{{ tr('FriendModal.dong_y') }}</span>
              </button>

              <button
                type="button"
                class="px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="handleRespondRequest(record.id, false)"
              >
                {{ tr('FriendModal.tu_choi') }}
              </button>

              <button
                type="button"
                class="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                :title="tr('FriendModal.xoa_yeu_cau_nay')"
                @click="confirmDelete(record, 'received_request')"
              >
                {{ tr('FriendModal.xoa') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 3: LỜI MỜI ĐÃ GỬI ================= -->
      <div v-else-if="activeTab === 'sent'" class="space-y-3">
        <div
          v-if="sentRequests.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">📤</div>
          <div class="m-0 text-sm font-bold text-gray-800">{{ tr('FriendModal.chua_gui_loi_moi_nao') }}</div>
          <div class="m-0 text-xs text-gray-500 mt-1">{{ tr('FriendModal.ban_chua_gui_yeu_cau_ket_ban_nao_dang_o_trang_thai_cho') }}</div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="record in sentRequests"
            :key="record.id"
            class="p-4 rounded-2xl border border-emerald-900/10 bg-white/95 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="size-11 rounded-xl bg-linear-to-br flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                :class="getAvatarGradient(record.friend_id)"
              >
                <img v-if="getRecipientProfile(record)?.avatar_url" :src="getRecipientProfile(record)?.avatar_url ?? ''" :alt="tr('UpdateIdentityModal.anh_dai_dien')" class="h-full w-full rounded-xl object-cover" referrerpolicy="no-referrer" />
                <span v-else>{{ (getRecipientProfile(record)?.display_name || record.friend_id).slice(0, 2).toUpperCase() }}</span>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-gray-900 font-mono">
                    {{ getRecipientProfile(record)?.display_name || formatUuid(record.friend_id) }}
                  </span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                    :title="tr('FriendModal.sao_chep_toan_bo_id')"
                    @click="copyToClipboard(record.friend_id)"
                  >
                    📋
                  </button>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {{ tr('FriendModal.dang_cho_dong_y') }}
                  </span>
                </div>

                <div class="mt-1 text-[11px] text-[#556655]">{{ countryStore.getCountryName(getRecipientProfile(record)?.country_id) }}</div>
                <div v-if="getRecipientProfile(record)" class="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span class="font-bold text-amber-800"> {{ tr('UserProfile.cap') }} {{ getRecipientProfile(record)?.level }} </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-400 text-[10px]">
                    {{ tr('FriendModal.gui_luc') }} {{ new Date(record.created_at).toLocaleDateString(getFormattingLocale()) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Nút Hủy / Xóa lời mời -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
              :disabled="friendStore.actionLoadingId === record.id"
              @click="confirmDelete(record, 'sent_request')"
            >
              {{ tr('FriendModal.huy_loi_moi') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ================= TAB 4: KHÁM PHÁ & THÊM BẠN ================= -->
      <div v-else-if="activeTab === 'discover'" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-gray-600 px-1">
          <span>{{ tr('FriendModal.danh_sach_nguoi_choi_tu_he_thong') }}{{ filteredPlayers.length }})</span>
          <span class="text-[11px] text-gray-400">{{ tr('FriendModal.sap_xep_theo_cap_do_cao_xuong_thap') }}</span>
        </div>

        <div
          v-if="filteredPlayers.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">🔍</div>
          <div class="m-0 text-sm font-bold text-gray-800">{{ tr('FriendModal.khong_tim_thay_nguoi_choi') }}</div>
          <div class="m-0 text-xs text-gray-500 mt-1">{{ tr('FriendModal.khong_co_nguoi_choi_nao_khop_voi_tu_khoa_tim_kiem') }}</div>
        </div>

        <div v-else class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="player in filteredPlayers"
            :key="player.id"
            class="p-4 rounded-2xl border border-emerald-900/10 bg-white/95 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <!-- Avatar -->
                <div
                  class="size-11 rounded-xl bg-linear-to-br flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                  :class="getAvatarGradient(player.id)"
                >
                  <img v-if="player.avatar_url" :src="player.avatar_url" :alt="tr('UpdateIdentityModal.anh_dai_dien')" class="h-full w-full rounded-xl object-cover" referrerpolicy="no-referrer" />
                  <span v-else>{{ (player.display_name || player.id).slice(0, 2).toUpperCase() }}</span>
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-gray-900 font-mono">
                      {{ player.display_name || formatUuid(player.id) }}
                    </span>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                      :title="tr('FriendModal.sao_chep_toan_bo_id')"
                      @click="copyToClipboard(player.id)"
                    >
                      📋
                    </button>
                  </div>

                  <div class="mt-1 text-[11px] text-[#556655]">{{ countryStore.getCountryName(player.country_id) }}</div>
                  <!-- Thông số: Cấp & EXP -->
                  <div class="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span
                      class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200"
                    >
                      {{ tr('UserProfile.cap') }} {{ player.level }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      ✨ {{ Number(player.experience_point).toLocaleString(getFormattingLocale()) }} EXP
                    </span>
                  </div>
                </div>
              </div>

              <!-- Trạng thái hoặc Nút kết bạn -->
              <div class="flex shrink-0 items-center gap-2">
                <!-- Đã là bạn bè -->
                <span
                  v-if="getRelation(player.id).type === 'ACCEPTED'"
                  class="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold"
                >
                  {{ tr('FriendModal.ban_be_3') }}
                </span>

                <!-- Đã gửi lời mời đang chờ -->
                <div v-else-if="getRelation(player.id).type === 'SENT_PENDING'" class="flex items-center gap-1.5">
                  <span
                    class="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold"
                  >
                    {{ tr('FriendModal.da_gui') }}
                  </span>
                  <button
                    type="button"
                    class="px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold cursor-pointer"
                    :title="tr('FriendModal.huy_loi_moi')"
                    @click="
                      confirmDelete(
                        (getRelation(player.id) as { type: 'SENT_PENDING'; record: UserFriend }).record,
                        'sent_request',
                      )
                    "
                  >
                    ✕
                  </button>
                </div>

                <!-- Người này đã gửi lời mời cho mình -->
                <div v-else-if="getRelation(player.id).type === 'RECEIVED_PENDING'" class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                    @click="
                      handleRespondRequest(
                        (getRelation(player.id) as { type: 'RECEIVED_PENDING'; record: UserFriend }).record.id,
                        true,
                      )
                    "
                  >
                    {{ tr('PostProduction.dong_y') }}
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold cursor-pointer"
                    @click="
                      handleRespondRequest(
                        (getRelation(player.id) as { type: 'RECEIVED_PENDING'; record: UserFriend }).record.id,
                        false,
                      )
                    "
                  >
                    {{ tr('FriendModal.tu_choi') }}
                  </button>
                </div>

                <!-- Chưa có quan hệ: Nút Thêm bạn -->
                <button
                  v-else
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-[#153221] hover:bg-[#1c432d] text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  :disabled="friendStore.actionLoadingId === player.id"
                  @click="handleSendRequest(player.id)"
                >
                  <span
                    v-if="friendStore.actionLoadingId === player.id"
                    class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></span>
                  <span>{{ tr('FriendModal.them_ban') }}</span>
                </button>
              </div>
            </div>

            <!-- Dung lượng túi & Kho cá -->
            <div
              class="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-500"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{{ tr('FriendModal.tui') }} {{ player.inventory_capacity }} {{ tr('UserProfile.o') }}</span>
                <span>{{ tr('FriendModal.kho') }} {{ player.species_storage_capacity }} {{ tr('UserProfile.o') }}</span>
              </div>
              <span>{{ tr('FriendModal.tham_gia') }} {{ new Date(player.created_at).toLocaleDateString(getFormattingLocale()) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hộp thoại xác nhận xóa (Modal xác nhận bên trong) -->
    <div v-if="deleteConfirmTarget" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-4 animate-in fade-in zoom-in duration-150"
      >
        <div class="flex items-center gap-3 text-red-600">
          <div class="size-10 rounded-full bg-red-100 flex items-center justify-center text-lg shrink-0">⚠️</div>
          <div class="m-0 text-base font-bold text-gray-900">
            {{
              deleteConfirmTarget.type === "friend"
                ? tr('FriendModal.xac_nhan_huy_ket_ban')
                : deleteConfirmTarget.type === "sent_request"
                  ? tr('FriendModal.huy_loi_moi_ket_ban')
                  : tr('FriendModal.xoa_yeu_cau_ket_ban')
            }}
          </div>
        </div>

        <div class="m-0 text-xs text-gray-600 leading-relaxed">
          {{
            deleteConfirmTarget.type === "friend"
              ? tr('FriendModal.ban_co_chac_chan_muon_xoa_nguoi_nay_khoi_danh_sach_ban_be_hai_ng')
              : deleteConfirmTarget.type === "sent_request"
                ? tr('FriendModal.ban_co_chac_chan_muon_huy_loi_moi_ket_ban_da_gui_toi_nguoi_choi_')
                : tr('FriendModal.ban_co_chac_chan_muon_xoa_yeu_cau_ket_ban_nay')
          }}
        </div>

        <div class="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-700 truncate">
          {{ tr('FriendModal.ma_nguoi_choi') }} {{ deleteConfirmTarget.targetUserId }}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer"
            @click="deleteConfirmTarget = null"
          >
            {{ tr('FactionSelectModal.huy_bo') }}
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
            <span>{{ tr('FriendModal.xac_nhan_xoa') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>
