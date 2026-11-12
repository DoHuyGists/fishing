<script setup lang="ts">
import type { NotificationKind } from "../../../types/model/notification";
import type { NotificationRow } from "../../../types/table/notification";
import { t as tr } from "../../../i18n";

import { computed, onMounted, onUnmounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useNotificationStore } from "../../../stores/notification.ts";

import Tab from "../../shared/Tab.vue";
import { formatDateTime } from "../../../utils/time.ts";
const currentTabActive = ref("personal");
const unreadPersonalNotifyCount = computed(() => notifications.personal.filter((x) => !x.is_read).length);
const unreadASystemNotifyCount = computed(() => notifications.system.filter((x) => !x.is_read).length);
const tabs = computed(() => [
  { key: "personal", get label() { return tr('NotificationModal.ca_nhan'); }, badge: unreadPersonalNotifyCount.value },
  { key: "system", get label() { return tr('NotificationModal.he_thong'); }, badge: unreadASystemNotifyCount.value },
]);

const auth = useAuthStore();
const notifications = useNotificationStore();
const activeTab = computed(() => currentTabActive.value as NotificationKind);
const selected = ref<NotificationRow | null>(null);
const expandedNotificationId = ref<string | null>(null);
const readError = ref("");

function loadNotifications() {
  const userId = auth.user?.id;
  if (userId) return notifications.loadNotifications(userId);
}

async function selectNotification(item: NotificationRow) {
  selected.value = item;
  expandedNotificationId.value = expandedNotificationId.value === item.id ? null : item.id;
  readError.value = "";
  const userId = auth.user?.id;
  if (userId && !item.is_read) {
    try {
      await notifications.markAsRead(activeTab.value, item, userId);
    } catch (error) {
      readError.value = error instanceof Error ? error.message : tr('NotificationModal.khong_the_cap_nhat_trang_thai_da_doc');
    }
  }
}

onMounted(() => {
  const userId = auth.user?.id;
  if (!userId) return;
  void notifications.loadNotifications(userId);
  notifications.subscribeToNotifications(userId);
});

onUnmounted(() => {
  void notifications.unsubscribeFromNotifications();
});
</script>

<template>
  <Modal :title="tr('NotificationModal.thong_bao')" :sub-title="tr('NotificationModal.tin_nhan_danh_cho_ban_va_thong_bao_he_thong')" :on-refresh="loadNotifications">
    <div v-if="notifications.loadError || readError" role="alert" class="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{{ notifications.loadError || readError }}</div>
    <Tab v-model="currentTabActive" :tabs="tabs" lazy>
      <template #personal>
        <div class="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside class="w-full shrink-0 overflow-y-auto sm:w-80 sm:border-r sm:border-gray-200">
            <div v-if="notifications.loading" class="p-5 text-sm text-gray-500">{{ tr('NotificationModal.dang_tai_thong_bao') }}</div>
            <div v-else-if="!notifications.personal.length" class="p-5 text-sm text-gray-500">{{ tr('NotificationModal.chua_co_thong_bao_nao') }}</div>
            <button
              v-for="item in notifications.personal"
              :key="item.id"
              type="button"
              class="block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-emerald-50"
              :class="selected?.id === item.id ? 'bg-emerald-50' : ''"
              :aria-expanded="expandedNotificationId === item.id"
              @click="selectNotification(item)"
            >
              <span class="flex items-start gap-2"
                ><span
                  class="mt-1.5 size-2 shrink-0 rounded-full"
                  :class="item.is_read ? 'bg-gray-300' : 'bg-emerald-600'"
                  :aria-label="item.is_read ? tr('NotificationModal.da_doc') : tr('NotificationModal.chua_doc')"
                ></span
                ><span class="min-w-0"
                  ><span class="block truncate text-sm font-bold text-gray-800">{{ item.title }}</span
                  ><span class="mt-1 block text-xs text-gray-500">{{ formatDateTime(item.created_at) }}</span></span
                ></span
              >
              <span
                v-if="expandedNotificationId === item.id"
                class="mt-3 block border-t border-[#cbd9c6] pt-3 sm:hidden"
              >
                <span class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-[#f5f9f0] px-2.5 py-1 text-xs font-bold text-[#24352a]">{{
                    item.type || "general"
                  }}</span>
                  <span class="text-xs text-gray-500">{{ formatDateTime(item.created_at) }}</span>
                </span>
                <span class="block whitespace-pre-wrap text-sm leading-6 text-gray-700">{{ item.body }}</span>
                <span
                  v-if="selected?.id === item.id && readError"
                  role="alert"
                  class="mt-3 block rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  >{{ readError }}</span
                >
              </span>
            </button>
          </aside>
          <article class="hidden min-w-0 flex-1 overflow-y-auto p-5 sm:block sm:p-8">
            <div v-if="selected">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{{
                  selected.type || (activeTab === "personal" ? "general" : "system")
                }}</span
                ><span class="text-xs text-gray-500">{{ formatDateTime(selected.created_at) }}</span>
              </div>
              <div class="m-0 text-xl font-extrabold text-[#153221]">{{ selected.title }}</div>
              <div class="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">{{ selected.body }}</div>
              <div v-if="readError" role="alert" class="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {{ tr('NotificationModal.khong_the_cap_nhat_trang_thai_da_doc_2') }} {{ readError }}
              </div>
            </div>
            <div v-else class="grid h-full place-items-center text-center text-sm text-gray-400">
              {{ tr('NotificationModal.chon_mot_thong_bao_o_danh_sach_ben_trai_de_xem_noi_dung') }}
            </div>
          </article>
        </div>
      </template>

      <template #system>
        <div class="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside class="w-full shrink-0 overflow-y-auto sm:w-80 sm:border-r sm:border-gray-200">
            <div v-if="notifications.loading" class="p-5 text-sm text-gray-500">{{ tr('NotificationModal.dang_tai_thong_bao') }}</div>
            <div v-else-if="!notifications.system.length" class="p-5 text-sm text-gray-500">{{ tr('NotificationModal.chua_co_thong_bao_nao') }}</div>
            <button
              v-for="item in notifications.system"
              :key="item.id"
              type="button"
              class="block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-emerald-50"
              :class="selected?.id === item.id ? 'bg-emerald-50' : ''"
              :aria-expanded="expandedNotificationId === item.id"
              @click="selectNotification(item)"
            >
              <span class="flex items-start gap-2"
                ><span
                  class="mt-1.5 size-2 shrink-0 rounded-full"
                  :class="item.is_read ? 'bg-gray-300' : 'bg-emerald-600'"
                  :aria-label="item.is_read ? tr('NotificationModal.da_doc') : tr('NotificationModal.chua_doc')"
                ></span
                ><span class="min-w-0"
                  ><span class="block truncate text-sm font-bold text-gray-800">{{ item.title }}</span
                  ><span class="mt-1 block text-xs text-gray-500">{{ formatDateTime(item.created_at) }}</span></span
                ></span
              >
              <span
                v-if="expandedNotificationId === item.id"
                class="mt-3 block border-t border-[#cbd9c6] pt-3 sm:hidden"
              >
                <span class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-[#f5f9f0] px-2.5 py-1 text-xs font-bold text-[#24352a]">{{
                    item.type || "system"
                  }}</span>
                  <span class="text-xs text-gray-500">{{ formatDateTime(item.created_at) }}</span>
                </span>
                <span class="block whitespace-pre-wrap text-sm leading-6 text-gray-700">{{ item.body }}</span>
                <span
                  v-if="selected?.id === item.id && readError"
                  role="alert"
                  class="mt-3 block rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  >{{ readError }}</span
                >
              </span>
            </button>
          </aside>
          <article class="hidden min-w-0 flex-1 overflow-y-auto p-5 sm:block sm:p-8">
            <div v-if="selected">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{{
                  selected.type || (activeTab === "personal" ? "general" : "system")
                }}</span
                ><span class="text-xs text-gray-500">{{ formatDateTime(selected.created_at) }}</span>
              </div>
              <div class="m-0 text-xl font-extrabold text-[#153221]">{{ selected.title }}</div>
              <div class="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">{{ selected.body }}</div>
              <div v-if="readError" role="alert" class="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {{ tr('NotificationModal.khong_the_cap_nhat_trang_thai_da_doc_2') }} {{ readError }}
              </div>
            </div>
            <div v-else class="grid h-full place-items-center text-center text-sm text-gray-400">
              {{ tr('NotificationModal.chon_mot_thong_bao_o_danh_sach_ben_trai_de_xem_noi_dung') }}
            </div>
          </article>
        </div>
      </template>
    </Tab>
  </Modal>
</template>
