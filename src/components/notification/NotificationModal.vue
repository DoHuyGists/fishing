<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Modal from "../Modal.vue";
import supabase from "../../database/connection";
import { useAuthStore } from "../../stores/auth";

type NotificationKind = "personal" | "system";
interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  expires_at?: string | null;
  is_read: boolean;
}

const auth = useAuthStore();
const activeTab = ref<NotificationKind>("personal");
const personal = ref<NotificationRow[]>([]);
const system = ref<NotificationRow[]>([]);
const selected = ref<NotificationRow | null>(null);
const loading = ref(false);
const loadError = ref("");
const readError = ref("");
const currentItems = computed(() => activeTab.value === "personal" ? personal.value : system.value);
const unreadCount = computed(() => currentItems.value.filter((item) => !item.is_read).length);

async function loadNotifications() {
  if (!auth.userId) return;
  loading.value = true;
  loadError.value = "";
  try {
    const now = new Date().toISOString();
    const [personalResult, systemResult, readsResult] = await Promise.all([
      supabase.from("personal_notifications").select("id,title,body,type,data,is_read,created_at").eq("user_id", auth.userId).order("created_at", { ascending: false }),
      supabase.from("system_notifications").select("id,title,body,type,data,created_at,expires_at").or(`expires_at.is.null,expires_at.gt.${now}`).order("created_at", { ascending: false }),
      supabase.from("system_notification_reads").select("notification_id").eq("user_id", auth.userId),
    ]);
    if (personalResult.error) throw personalResult.error;
    if (systemResult.error) throw systemResult.error;
    if (readsResult.error) throw readsResult.error;
    personal.value = (personalResult.data ?? []) as NotificationRow[];
    const readIds = new Set((readsResult.data ?? []).map((row) => row.notification_id as string));
    system.value = ((systemResult.data ?? []) as Omit<NotificationRow, "is_read">[]).map((row) => ({ ...row, is_read: readIds.has(row.id) }));
    if (selected.value) selected.value = currentItems.value.find((item) => item.id === selected.value?.id) ?? null;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể tải thông báo.";
  } finally {
    loading.value = false;
  }
}

async function selectNotification(item: NotificationRow) {
  selected.value = item;
  readError.value = "";
  if (activeTab.value === "personal" && !item.is_read) {
    const { error } = await supabase.from("personal_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", item.id).eq("user_id", auth.userId);
    if (error) { readError.value = error.message; return; }
    item.is_read = true;
  } else if (activeTab.value === "system" && !item.is_read) {
    const { error } = await supabase.rpc("mark_system_notification_read", { notif_id: item.id });
    if (error) { readError.value = error.message; return; }
    item.is_read = true;
  }
}

function changeTab(tab: NotificationKind) {
  activeTab.value = tab;
  selected.value = null;
  readError.value = "";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

onMounted(loadNotifications);
</script>

<template>
  <Modal title="Thông báo" sub-title="Tin nhắn dành cho bạn và thông báo hệ thống" :can-refresh="true" @refresh="loadNotifications">
    <section class="mx-auto flex h-[calc(100vh-100px)] max-w-6xl flex-col overflow-hidden rounded-xl border border-emerald-950/10 bg-white shadow-sm">
      <div class="flex shrink-0 gap-2 border-b border-gray-200 px-4 pt-3">
        <button v-for="tab in ([{ id: 'personal', label: 'Cá nhân' }, { id: 'system', label: 'Hệ thống' }] as const)" :key="tab.id" type="button" class="border-b-2 px-4 py-2 text-sm font-bold" :class="activeTab === tab.id ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-gray-500 hover:text-gray-800'" @click="changeTab(tab.id)">
          {{ tab.label }}<span v-if="activeTab === tab.id && unreadCount" class="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">{{ unreadCount }}</span>
        </button>
      </div>
      <p v-if="loadError" role="alert" class="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ loadError }}</p>
      <div class="flex min-h-0 flex-1">
        <aside class="w-[42%] shrink-0 overflow-y-auto border-r border-gray-200 sm:w-80">
          <p v-if="loading" class="p-5 text-sm text-gray-500">Đang tải thông báo...</p>
          <p v-else-if="!currentItems.length" class="p-5 text-sm text-gray-500">Chưa có thông báo nào.</p>
          <button v-for="item in currentItems" :key="item.id" type="button" class="block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-emerald-50" :class="selected?.id === item.id ? 'bg-emerald-50' : ''" @click="selectNotification(item)">
            <span class="flex items-start gap-2"><span class="mt-1.5 size-2 shrink-0 rounded-full" :class="item.is_read ? 'bg-gray-300' : 'bg-emerald-600'" :aria-label="item.is_read ? 'Đã đọc' : 'Chưa đọc'"></span><span class="min-w-0"><span class="block truncate text-sm font-bold text-gray-800">{{ item.title }}</span><span class="mt-1 block text-xs text-gray-500">{{ formatDate(item.created_at) }}</span></span></span>
          </button>
        </aside>
        <article class="min-w-0 flex-1 overflow-y-auto p-5 sm:p-8">
          <div v-if="selected"><div class="mb-4 flex flex-wrap items-center gap-2"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{{ selected.type || (activeTab === 'personal' ? 'general' : 'system') }}</span><span class="text-xs text-gray-500">{{ formatDate(selected.created_at) }}</span></div><h3 class="m-0 text-xl font-extrabold text-[#153221]">{{ selected.title }}</h3><p class="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">{{ selected.body }}</p><p v-if="readError" role="alert" class="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">Không thể cập nhật trạng thái đã đọc: {{ readError }}</p></div>
          <p v-else class="grid h-full place-items-center text-center text-sm text-gray-400">Chọn một thông báo ở danh sách bên trái để xem nội dung.</p>
        </article>
      </div>
    </section>
  </Modal>
</template>
