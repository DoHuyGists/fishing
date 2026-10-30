<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useFriendStore, type FriendshipRelation } from "../../../stores/friend.ts";
import { useToast } from "../../../composables/useToast.ts";
import type { FriendUserProfile, UserFriend } from "../../../data/supabaseFriendRepository.ts";

type ActiveTab = "friends" | "received" | "sent" | "discover";

const authStore = useAuthStore();
const friendStore = useFriendStore();
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

  return otherPlayers.value.filter((profile) => profile.id.toLowerCase().includes(query));
});

// Lọc bạn bè ở tab Bạn bè
const filteredFriends = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return acceptedFriends.value;

  return acceptedFriends.value.filter((record) => {
    const friendId = record.user_id === currentUserId.value ? record.friend_id : record.user_id;
    return friendId.toLowerCase().includes(query);
  });
});

async function handleRefresh() {
  if (!currentUserId.value) return;
  await friendStore.loadData(currentUserId.value);
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
    toast.success("Đã sao chép mã người chơi vào clipboard");
    setTimeout(() => {
      if (copiedId.value === text) {
        copiedId.value = null;
      }
    }, 2000);
  } catch {
    toast.error("Không thể sao chép");
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
    toast.warning("Không thể tự kết bạn với chính mình");
    return;
  }

  try {
    await friendStore.sendFriendRequest(targetUserId, currentUserId.value);
    toast.success("Đã gửi lời mời kết bạn thành công!");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gửi lời mời thất bại";
    toast.error(message);
  }
}

async function handleSendDirectId() {
  const targetId = directFriendIdInput.value.trim();
  if (!targetId) {
    toast.warning("Vui lòng nhập mã ID người chơi");
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
      toast.success("Đã đồng ý kết bạn!");
    } else {
      toast.info("Đã từ chối lời mời kết bạn");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Thao tác thất bại";
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
      toast.success("Đã xóa khỏi danh sách bạn bè");
    } else if (target.type === "sent_request") {
      await friendStore.cancelFriendRequest(target.id, currentUserId.value);
      toast.success("Đã hủy lời mời kết bạn");
    } else {
      await friendStore.respondFriendRequest(target.id, false, currentUserId.value);
      toast.success("Đã từ chối và xóa yêu cầu kết bạn");
    }
    deleteConfirmTarget.value = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Thao tác thất bại";
    toast.error(message);
  }
}
</script>

<template>
  <Modal title="Quản lý bạn bè" sub-title="Kết nối cộng đồng câu cá" :on-refresh="handleRefresh">
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
            <h3 class="m-0 text-base sm:text-lg font-bold text-white tracking-wide">Mã người chơi của bạn</h3>
            <p class="m-0 text-xs text-emerald-200/70 font-mono truncate" :title="currentUserId">
              {{ currentUserId || "Chưa đăng nhập" }}
            </p>
          </div>
        </div>

        <button
          v-if="currentUserId"
          type="button"
          class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-100 text-xs font-semibold transition cursor-pointer"
          @click="copyToClipboard(currentUserId)"
        >
          <span>{{ copiedId === currentUserId ? "✓ Đã chép" : "📋 Sao chép ID" }}</span>
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
          <span>👥 Bạn bè</span>
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
          <span>📩 Lời mời đã nhận</span>
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
          <span>📤 Lời mời đã gửi</span>
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
          <span>🔍 Thêm bạn bè</span>
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
            placeholder="Tìm theo mã người chơi (ID)..."
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
            placeholder="Nhập UUID để kết bạn ngay..."
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
            <span>+ Gửi lời mời</span>
          </button>
        </div>
      </div>

      <!-- Trạng thái Loading -->
      <div
        v-if="friendStore.loading && !friendStore.friends.length && !friendStore.profiles.length"
        class="py-16 flex flex-col items-center justify-center gap-3 text-emerald-800"
      >
        <div class="size-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold">Đang tải danh sách bạn bè...</span>
      </div>

      <!-- Trạng thái lỗi -->
      <div
        v-else-if="friendStore.error && !friendStore.friends.length"
        class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between"
      >
        <span>{{ friendStore.error }}</span>
        <button type="button" class="font-bold underline hover:no-underline cursor-pointer" @click="handleRefresh">
          Tải lại
        </button>
      </div>

      <!-- ================= TAB 1: BẠN BÈ ================= -->
      <div v-else-if="activeTab === 'friends'" class="space-y-3">
        <div
          v-if="filteredFriends.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">🤝</div>
          <h4 class="m-0 text-sm font-bold text-gray-800">Chưa có bạn bè nào</h4>
          <p class="m-0 text-xs text-gray-500 mt-1">
            {{
              searchQuery
                ? "Không tìm thấy bạn bè phù hợp với tìm kiếm."
                : "Hãy chuyển sang tab 'Thêm bạn bè' để kết bạn cùng những ngư thủ khác nhé!"
            }}
          </p>
          <button
            v-if="!searchQuery"
            type="button"
            class="mt-4 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            @click="activeTab = 'discover'"
          >
            Tìm bạn mới ngay
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
                  {{ (record.user_id === currentUserId ? record.friend_id : record.user_id).slice(0, 2).toUpperCase() }}
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-gray-900 font-mono">
                      {{ formatUuid(record.user_id === currentUserId ? record.friend_id : record.user_id) }}
                    </span>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                      title="Sao chép toàn bộ ID"
                      @click="copyToClipboard(record.user_id === currentUserId ? record.friend_id : record.user_id)"
                    >
                      📋
                    </button>
                  </div>

                  <!-- Thông số hồ sơ nếu có -->
                  <div v-if="getFriendProfile(record)" class="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span
                      class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200"
                    >
                      ⭐ Cấp {{ getFriendProfile(record)?.level }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      ✨ {{ Number(getFriendProfile(record)?.experience_point ?? 0).toLocaleString("vi-VN") }} EXP
                    </span>
                  </div>
                  <div v-else class="text-[10px] text-gray-400 mt-0.5">Chưa tải dữ liệu hồ sơ</div>
                </div>
              </div>

              <!-- Nút Xóa bạn -->
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="confirmDelete(record, 'friend')"
              >
                Xóa bạn
              </button>
            </div>

            <!-- Thời gian kết bạn -->
            <div
              class="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-400"
            >
              <span>Đã kết bạn từ: {{ new Date(record.created_at).toLocaleDateString("vi-VN") }}</span>
              <span class="text-emerald-700 font-semibold">● Bạn bè</span>
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
          <h4 class="m-0 text-sm font-bold text-gray-800">Không có lời mời nào</h4>
          <p class="m-0 text-xs text-gray-500 mt-1">
            Hiện tại bạn chưa nhận được yêu cầu kết bạn nào từ người chơi khác.
          </p>
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
                {{ record.user_id.slice(0, 2).toUpperCase() }}
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-gray-900 font-mono">
                    {{ formatUuid(record.user_id) }}
                  </span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                    title="Sao chép toàn bộ ID"
                    @click="copyToClipboard(record.user_id)"
                  >
                    📋
                  </button>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                    Muốn kết bạn
                  </span>
                </div>

                <div v-if="getSenderProfile(record)" class="flex items-center gap-2 mt-1 text-[11px]">
                  <span class="font-bold text-amber-800"> ⭐ Cấp {{ getSenderProfile(record)?.level }} </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-emerald-800 font-medium">
                    {{ Number(getSenderProfile(record)?.experience_point ?? 0).toLocaleString("vi-VN") }} EXP
                  </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-400 text-[10px]">
                    {{ new Date(record.created_at).toLocaleDateString("vi-VN") }}
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
                <span>✓ Đồng ý</span>
              </button>

              <button
                type="button"
                class="px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="handleRespondRequest(record.id, false)"
              >
                Từ chối
              </button>

              <button
                type="button"
                class="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                title="Xóa yêu cầu này"
                @click="confirmDelete(record, 'received_request')"
              >
                ✕ Xóa
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
          <h4 class="m-0 text-sm font-bold text-gray-800">Chưa gửi lời mời nào</h4>
          <p class="m-0 text-xs text-gray-500 mt-1">Bạn chưa gửi yêu cầu kết bạn nào đang ở trạng thái chờ.</p>
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
                {{ record.friend_id.slice(0, 2).toUpperCase() }}
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-gray-900 font-mono">
                    {{ formatUuid(record.friend_id) }}
                  </span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                    title="Sao chép toàn bộ ID"
                    @click="copyToClipboard(record.friend_id)"
                  >
                    📋
                  </button>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    ⏳ Đang chờ đồng ý
                  </span>
                </div>

                <div v-if="getRecipientProfile(record)" class="flex items-center gap-2 mt-1 text-[11px]">
                  <span class="font-bold text-amber-800"> ⭐ Cấp {{ getRecipientProfile(record)?.level }} </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-400 text-[10px]">
                    Gửi lúc: {{ new Date(record.created_at).toLocaleDateString("vi-VN") }}
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
              Hủy lời mời
            </button>
          </div>
        </div>
      </div>

      <!-- ================= TAB 4: KHÁM PHÁ & THÊM BẠN ================= -->
      <div v-else-if="activeTab === 'discover'" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-gray-600 px-1">
          <span>Danh sách người chơi từ hệ thống ({{ filteredPlayers.length }})</span>
          <span class="text-[11px] text-gray-400">Sắp xếp theo cấp độ cao xuống thấp</span>
        </div>

        <div
          v-if="filteredPlayers.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">🔍</div>
          <h4 class="m-0 text-sm font-bold text-gray-800">Không tìm thấy người chơi</h4>
          <p class="m-0 text-xs text-gray-500 mt-1">Không có người chơi nào khớp với từ khóa tìm kiếm.</p>
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
                  {{ player.id.slice(0, 2).toUpperCase() }}
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-gray-900 font-mono">
                      {{ formatUuid(player.id) }}
                    </span>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                      title="Sao chép toàn bộ ID"
                      @click="copyToClipboard(player.id)"
                    >
                      📋
                    </button>
                  </div>

                  <!-- Thông số: Cấp & EXP -->
                  <div class="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span
                      class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200"
                    >
                      ⭐ Cấp {{ player.level }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      ✨ {{ Number(player.experience_point).toLocaleString("vi-VN") }} EXP
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
                  ✓ Bạn bè
                </span>

                <!-- Đã gửi lời mời đang chờ -->
                <div v-else-if="getRelation(player.id).type === 'SENT_PENDING'" class="flex items-center gap-1.5">
                  <span
                    class="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold"
                  >
                    Đã gửi
                  </span>
                  <button
                    type="button"
                    class="px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold cursor-pointer"
                    title="Hủy lời mời"
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
                    Đồng ý
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
                    Từ chối
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
                  <span>+ Thêm bạn</span>
                </button>
              </div>
            </div>

            <!-- Dung lượng túi & Kho cá -->
            <div
              class="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-500"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>📦 Túi: {{ player.inventory_capacity }} ô</span>
                <span>🐟 Kho: {{ player.species_storage_capacity }} ô</span>
              </div>
              <span>Tham gia: {{ new Date(player.created_at).toLocaleDateString("vi-VN") }}</span>
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
          <h4 class="m-0 text-base font-bold text-gray-900">
            {{
              deleteConfirmTarget.type === "friend"
                ? "Xác nhận hủy kết bạn"
                : deleteConfirmTarget.type === "sent_request"
                  ? "Hủy lời mời kết bạn"
                  : "Xóa yêu cầu kết bạn"
            }}
          </h4>
        </div>

        <p class="m-0 text-xs text-gray-600 leading-relaxed">
          {{
            deleteConfirmTarget.type === "friend"
              ? "Bạn có chắc chắn muốn xóa người này khỏi danh sách bạn bè? Hai người sẽ không còn là bạn của nhau nữa."
              : deleteConfirmTarget.type === "sent_request"
                ? "Bạn có chắc chắn muốn hủy lời mời kết bạn đã gửi tới người chơi này?"
                : "Bạn có chắc chắn muốn xóa yêu cầu kết bạn này?"
          }}
        </p>

        <div class="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-700 truncate">
          Mã người chơi: {{ deleteConfirmTarget.targetUserId }}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer"
            @click="deleteConfirmTarget = null"
          >
            Hủy bỏ
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
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>
