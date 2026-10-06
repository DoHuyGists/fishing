<script lang="ts" setup>
import { computed, ref } from "vue";
import FishingAreaManagement from "../components/admin/FishingAreaManagement.vue";
import ItemManagement from "../components/admin/ItemManagement.vue";
import SpeciesManagement from "../components/admin/SpeciesManagement.vue";
import SpeciesInAreaManagement from "../components/admin/SpeciesInAreaManagement.vue";
import EventManagement from "../components/admin/EventManagement.vue";
import EventScheduleManagement from "../components/admin/EventScheduleManagement.vue";
import RedeemCodeManagement from "../components/admin/RedeemCodeManagement.vue";
import NotificationManagement from "../components/admin/NotificationManagement.vue";

type ModuleKey = "area" | "item" | "species" | "speciesInArea" | "event" | "schedule" | "redeemCode" | "notifications";

interface AdminModule {
  key: ModuleKey;
  icon: string;
  label: string;
  desc: string;
  component: unknown;
}

interface ModuleGroup {
  title: string;
  modules: AdminModule[];
}

const groups: ModuleGroup[] = [
  {
    title: "Dữ liệu trò chơi",
    modules: [
      { key: "area", icon: "🗺️", label: "Bãi câu", desc: "Thêm, sửa và xoá các bãi câu trong game.", component: FishingAreaManagement },
      { key: "item", icon: "🎒", label: "Vật phẩm", desc: "Quản lý cần câu, mồi và các vật phẩm khác.", component: ItemManagement },
      { key: "redeemCode", icon: "🎟️", label: "Mã đổi thưởng", desc: "Tạo mã nhận xu, đặt hạn dùng và bật hoặc tắt mã.", component: RedeemCodeManagement },
      { key: "notifications", icon: "🔔", label: "Thông báo", desc: "Tạo và quản lý thông báo cá nhân, thông báo hệ thống.", component: NotificationManagement },
      { key: "species", icon: "🐟", label: "Loài cá", desc: "Chỉnh thông tin và thuộc tính của từng loài cá.", component: SpeciesManagement },
      { key: "speciesInArea", icon: "🎯", label: "Cá theo bãi câu", desc: "Chọn loài cá xuất hiện ở mỗi bãi câu.", component: SpeciesInAreaManagement },
    ],
  },
  {
    title: "Sự kiện",
    modules: [
      { key: "event", icon: "🎉", label: "Sự kiện", desc: "Tạo và cập nhật nội dung các sự kiện.", component: EventManagement },
      { key: "schedule", icon: "🗓️", label: "Lịch sự kiện", desc: "Đặt thời gian bắt đầu và kết thúc cho sự kiện.", component: EventScheduleManagement },
    ],
  },
];

const allModules = groups.flatMap((g) => g.modules);
const active = ref<ModuleKey | null>(null);
const keyword = ref("");

const activeComponent = computed(() => allModules.find((m) => m.key === active.value)?.component ?? null);

const filteredGroups = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      modules: g.modules.filter((m) => `${m.label} ${m.desc}`.toLowerCase().includes(q)),
    }))
    .filter((g) => g.modules.length > 0);
});

const open = (key: ModuleKey) => {
  active.value = key;
};
const close = () => {
  active.value = null;
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 lg:flex">
    <!-- Sidebar -->
    <aside class="hidden lg:flex lg:w-64 lg:shrink-0 flex-col bg-[#153221] text-emerald-50">
      <div class="px-6 py-5 border-b border-white/10">
        <p class="text-lg font-extrabold leading-tight">Quản trị</p>
        <p class="text-xs text-emerald-200/70 mt-0.5">Hệ thống câu cá</p>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Điều hướng quản trị">
        <section v-for="group in groups" :key="group.title">
          <h2 class="px-3 mb-1.5 text-xs font-semibold text-emerald-200/60">{{ group.title }}</h2>
          <ul class="space-y-0.5">
            <li v-for="m in group.modules" :key="m.key">
              <button
                type="button"
                class="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-300"
                :class="active === m.key ? 'bg-white/15 text-white' : 'text-emerald-50/80 hover:bg-white/10 hover:text-white'"
                :aria-current="active === m.key ? 'true' : undefined"
                @click="open(m.key)"
              >
                <span class="text-base" aria-hidden="true">{{ m.icon }}</span>
                {{ m.label }}
              </button>
            </li>
          </ul>
        </section>
      </nav>
    </aside>

    <!-- Main -->
    <main class="flex-1 min-w-0">
      <header class="bg-white border-b border-slate-200 px-5 py-4 sm:px-8 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 class="text-xl font-extrabold text-[#153221]">Bảng điều khiển</h1>
          <p class="text-sm text-slate-500">Chọn một mục để quản lý dữ liệu.</p>
        </div>

        <label class="relative w-full sm:w-72">
          <span class="sr-only">Tìm mục quản lý</span>
          <input
            v-model="keyword"
            type="search"
            placeholder="Tìm mục quản lý..."
            class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25"
          />
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">🔍</span>
        </label>
      </header>

      <div class="px-5 py-6 sm:px-8 space-y-8">
        <section v-for="group in filteredGroups" :key="group.title">
          <h2 class="mb-3 text-sm font-bold text-slate-600">{{ group.title }}</h2>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="m in group.modules"
              :key="m.key"
              type="button"
              class="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600"
              @click="open(m.key)"
            >
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-2xl group-hover:bg-emerald-100"
                aria-hidden="true"
              >
                {{ m.icon }}
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-bold text-[#153221]">Quản lý {{ m.label.toLowerCase() }}</span>
                <span class="mt-1 block text-sm text-slate-500">{{ m.desc }}</span>
              </span>
            </button>
          </div>
        </section>

        <p v-if="filteredGroups.length === 0" class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Không có mục nào khớp với "{{ keyword }}". Hãy thử từ khoá khác.
        </p>
      </div>
    </main>

    <!-- Module dialogs (giữ nguyên cơ chế @close của từng component) -->
    <component :is="activeComponent" v-if="activeComponent" @close="close" />
  </div>
</template>
