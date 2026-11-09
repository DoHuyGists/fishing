<script lang="ts" setup>
import { computed, defineAsyncComponent, ref } from "vue";
import { useAdminGuideStore } from "../stores/adminGuide";

const guideStore = useAdminGuideStore();
const AdminGuideModal = defineAsyncComponent(() => import("../components/admin/guide/AdminGuideModal.vue"));
const DashboarModal = defineAsyncComponent(() => import("../components/admin/monitor/DashboarModal.vue"));
const monitorOpen = ref(false);

type ModuleKey =
  | "blueprint"
  | "skill"
  | "zone"
  | "depthScope"
  | "weather"
  | "zoneWeather"
  | "weatherModifier"
  | "modifier"
  | "area"
  | "item"
  | "species"
  | "speciesInArea"
  | "aquacultureSpecies"
  | "aquacultureFood"
  | "event"
  | "schedule"
  | "redeemCode"
  | "hourMission"
  | "dailyMissionRewards"
  | "dailyMissionTemplates"
  | "notifications"
  | "guides"
  | "fishingPass"
  | "fishingPassRewards";

interface AdminModule {
  key: ModuleKey;
  icon: string;
  label: string;
  desc: string;
  component: ReturnType<typeof defineAsyncComponent>;
}

const moduleComponents = {
  guides: defineAsyncComponent(() => import("../components/admin/guides-management/GuidesManagementModal.vue")),
  blueprint: defineAsyncComponent(() => import("../components/admin/blueprint-management/BlueprintManagement.vue")),
  aquacultureSpecies: defineAsyncComponent(() => import("../components/admin/aquaculture-species-management/AquacultureSpeciesManagement.vue")),
  aquacultureFood: defineAsyncComponent(() => import("../components/admin/aquaculture-food-management/AquacultureFoodManagement.vue")),
  skill: defineAsyncComponent(() => import("../components/admin/skils-management/SkillManagementModal.vue")),
  dailyMissionRewards: defineAsyncComponent(
    () => import("../components/admin/daily-mission-rewards-management/DailyMissionRewardManagementModal.vue"),
  ),
  dailyMissionTemplates: defineAsyncComponent(
    () => import("../components/admin/daily-mission-templates-management/DailyMissionTemplateManagementModal.vue"),
  ),
  area: defineAsyncComponent(() => import("../components/admin/fishing-area-management/FishingAreaManagement.vue")),
  item: defineAsyncComponent(() => import("../components/admin/item-management/ItemsManagementModal.vue")),
  redeemCode: defineAsyncComponent(() => import("../components/admin/redeem-management/RedeemCodeManagement.vue")),
  hourMission: defineAsyncComponent(
    () => import("../components/admin/mission-management/HourMissionManagementModal.vue"),
  ),
  notifications: defineAsyncComponent(
    () => import("../components/admin/notification-management/NotificationManagement.vue"),
  ),
  fishingPass: defineAsyncComponent(
    () => import("../components/admin/fishing-pass-management/FishingPassModalManagement.vue"),
  ),
  fishingPassRewards: defineAsyncComponent(
    () => import("../components/admin/fishing-pass-rewards-management/FishingPassRewardsModaManagement.vue"),
  ),
  species: defineAsyncComponent(() => import("../components/admin/species-management/SpeciesManagementModal.vue")),
  speciesInArea: defineAsyncComponent(
    () => import("../components/admin/species-in-area-management/SpeciesInAreaManagement.vue"),
  ),
  zone: defineAsyncComponent(() => import("../components/admin/zone-management/ZoneManagement.vue")),
  weather: defineAsyncComponent(() => import("../components/admin/weather-management/WeatherManagement.vue")),
  zoneWeather: defineAsyncComponent(
    () => import("../components/admin/zone-weather-management/ZoneWeatherManagement.vue"),
  ),
  modifier: defineAsyncComponent(() => import("../components/admin/modifier-management/ModifierManagement.vue")),
  weatherModifier: defineAsyncComponent(
    () => import("../components/admin/weather-modifier-management/WeatherModifierManagement.vue"),
  ),
  event: defineAsyncComponent(() => import("../components/admin/event-management/EventManagement.vue")),
  schedule: defineAsyncComponent(
    () => import("../components/admin/event-schedule-management/EventScheduleManagement.vue"),
  ),
  depthScope: defineAsyncComponent(
    () => import("../components/admin/depth-scope-management/DepthScopeManagementModal.vue"),
  ),
};

const FeedbackListModal = defineAsyncComponent(
  () => import("../components/admin/feedback-management/FeedbackListModal.vue"),
);
const ErrorFeedbackManagementModal = defineAsyncComponent(
  () => import("../components/admin/feedback-management/ErrorFeedbackManagementModal.vue"),
);

interface ModuleGroup {
  title: string;
  modules: AdminModule[];
}

const groups: ModuleGroup[] = [
  {
    title: "Nuôi cá",
    modules: [
      { key: "aquacultureSpecies", icon: "🐟", label: "Cấu hình loài nuôi", desc: "Sức chứa, thời gian nuôi, giá giống, giá bán và tỷ lệ cá đặc biệt.", component: moduleComponents.aquacultureSpecies },
      { key: "aquacultureFood", icon: "🌾", label: "Thức ăn theo loài", desc: "Liên kết vật phẩm thức ăn và mức tăng chất lượng cho từng loài.", component: moduleComponents.aquacultureFood },
    ],
  },
  {
    title: "Dữ liệu trò chơi",
    modules: [
      { key: "blueprint", icon: "🛠️", label: "Công thức chế tạo", desc: "Quản lý bản vẽ, nguyên liệu, thành phẩm và phí chế tạo.", component: moduleComponents.blueprint },
      {
        key: "skill",
        icon: "✨",
        label: "Kỹ năng",
        desc: "Quản lý kỹ năng, cấp tối đa và hiệu ứng mỗi cấp.",
        component: moduleComponents.skill,
      },
      {
        key: "area",
        icon: "🗺️",
        label: "Bãi câu",
        desc: "Thêm, sửa và xoá các bãi câu trong game.",
        component: moduleComponents.area,
      },
      {
        key: "depthScope",
        icon: "🗺️",
        label: "Độ sâu",
        desc: "Thêm, sửa và xoá các độ sâu cá ở.",
        component: moduleComponents.depthScope,
      },
      {
        key: "item",
        icon: "🎒",
        label: "Vật phẩm",
        desc: "Quản lý cần câu, mồi và các vật phẩm khác.",
        component: moduleComponents.item,
      },
      {
        key: "redeemCode",
        icon: "🎟️",
        label: "Mã đổi thưởng",
        desc: "Tạo mã nhận xu, đặt hạn dùng và bật hoặc tắt mã.",
        component: moduleComponents.redeemCode,
      },
      {
        key: "hourMission",
        icon: "⏰",
        label: "Nhiệm vụ giờ",
        desc: "Quản lý nhiệm vụ câu cá theo khung giờ và phần thưởng.",
        component: moduleComponents.hourMission,
      },
      {
        key: "dailyMissionTemplates",
        icon: "📋",
        label: "Mẫu nhiệm vụ hằng ngày",
        desc: "Quản lý mục tiêu, điểm, độ khó và cấu hình nhiệm vụ hằng ngày.",
        component: moduleComponents.dailyMissionTemplates,
      },
      {
        key: "dailyMissionRewards",
        icon: "🎁",
        label: "Phần thưởng nhiệm vụ hằng ngày",
        desc: "Thiết lập mốc điểm và phần thưởng nhiệm vụ hằng ngày.",
        component: moduleComponents.dailyMissionRewards,
      },
      {
        key: "notifications",
        icon: "🔔",
        label: "Thông báo",
        desc: "Tạo và quản lý thông báo cá nhân, thông báo hệ thống.",
        component: moduleComponents.notifications,
      },
      {
        key: "guides",
        icon: "📖",
        label: "Hướng dẫn người chơi",
        desc: "Soạn nội dung, sắp xếp và quản lý trạng thái xuất bản hướng dẫn.",
        component: moduleComponents.guides,
      },
      {
        key: "fishingPass",
        icon: "🎫",
        label: "Vé câu",
        desc: "Quản lý giá, thời hạn và trạng thái vé câu.",
        component: moduleComponents.fishingPass,
      },
      {
        key: "fishingPassRewards",
        icon: "🎁",
        label: "Phần thưởng vé câu",
        desc: "Thiết lập vật phẩm FREE và PREMIUM theo từng ngày của vé.",
        component: moduleComponents.fishingPassRewards,
      },
      {
        key: "species",
        icon: "🐟",
        label: "Loài cá",
        desc: "Chỉnh thông tin và thuộc tính của từng loài cá.",
        component: moduleComponents.species,
      },
      {
        key: "speciesInArea",
        icon: "🎯",
        label: "Cá theo bãi câu",
        desc: "Chọn loài cá xuất hiện ở mỗi bãi câu.",
        component: moduleComponents.speciesInArea,
      },
    ],
  },
  {
    title: "Thời tiết",
    modules: [
      {
        key: "zone",
        icon: "🌊",
        label: "Vùng",
        desc: "Quản lý các vùng câu và thời tiết hiện tại.",
        component: moduleComponents.zone,
      },
      {
        key: "weather",
        icon: "⛅",
        label: "Thời tiết",
        desc: "Quản lý các loại thời tiết và thời lượng.",
        component: moduleComponents.weather,
      },
      {
        key: "zoneWeather",
        icon: "🌦️",
        label: "Thời tiết theo vùng",
        desc: "Chọn thời tiết được phép ở mỗi vùng.",
        component: moduleComponents.zoneWeather,
      },
      {
        key: "modifier",
        icon: "📊",
        label: "Chỉ số",
        desc: "Quản lý các chỉ số (modifiers).",
        component: moduleComponents.modifier,
      },
      {
        key: "weatherModifier",
        icon: "🎚️",
        label: "Chỉ số theo thời tiết",
        desc: "Cấu hình khoảng giá trị chỉ số của thời tiết.",
        component: moduleComponents.weatherModifier,
      },
    ],
  },
  {
    title: "Sự kiện",
    modules: [
      {
        key: "event",
        icon: "🎉",
        label: "Sự kiện",
        desc: "Tạo và cập nhật nội dung các sự kiện.",
        component: moduleComponents.event,
      },
      {
        key: "schedule",
        icon: "🗓️",
        label: "Lịch sự kiện",
        desc: "Đặt thời gian bắt đầu và kết thúc cho sự kiện.",
        component: moduleComponents.schedule,
      },
    ],
  },
];

const allModules = groups.flatMap((g) => g.modules);
const active = ref<ModuleKey | null>(null);
const keyword = ref("");
const feedbackModal = ref<"opinion" | "errors" | null>(null);

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
    <aside
      class="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:self-start flex-col overflow-hidden bg-[#153221] text-emerald-50"
    >
      <div class="shrink-0 px-6 py-5 border-b border-white/10">
        <p class="text-lg font-extrabold leading-tight">Quản trị</p>
        <p class="text-xs text-emerald-200/70 mt-0.5">Hệ thống câu cá</p>
      </div>

      <nav class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-5" aria-label="Điều hướng quản trị">
        <section v-for="group in groups" :key="group.title">
          <h2 class="px-3 mb-1.5 text-xs font-semibold text-emerald-200/60">{{ group.title }}</h2>
          <ul class="space-y-0.5">
            <li v-for="m in group.modules" :key="m.key">
              <button
                type="button"
                class="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-300"
                :class="
                  active === m.key ? 'bg-white/15 text-white' : 'text-emerald-50/80 hover:bg-white/10 hover:text-white'
                "
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
      <header
        class="bg-white border-b border-slate-200 px-5 py-4 sm:px-8 flex flex-wrap items-center gap-4 justify-between"
      >
        <div>
          <h1 class="text-xl font-extrabold text-[#153221]">Bảng điều khiển</h1>
          <p class="text-sm text-slate-500">Chọn một mục để quản lý dữ liệu.</p>
        </div>

        <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-haspopup="dialog"
            :aria-expanded="monitorOpen"
            @click="monitorOpen = true"
          >
            📊 Giám sát bãi câu
          </button>
          <button
            type="button"
            class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-haspopup="dialog"
            :aria-expanded="guideStore.isOpen"
            @click="guideStore.open"
          >
            📘 Hướng dẫn quản trị
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
            @click="feedbackModal = 'opinion'"
          >
            Xem góp ý
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600"
            @click="feedbackModal = 'errors'"
          >
            Xử lý báo lỗi
          </button>
          <label class="relative w-full sm:w-72">
            <span class="sr-only">Tìm mục quản lý</span>
            <input
              v-model="keyword"
              type="search"
              placeholder="Tìm mục quản lý..."
              class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25"
            />
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"
              >🔍</span
            >
          </label>
        </div>
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

        <p
          v-if="filteredGroups.length === 0"
          class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500"
        >
          Không có mục nào khớp với "{{ keyword }}". Hãy thử từ khoá khác.
        </p>
      </div>
    </main>

    <!-- Module dialogs (giữ nguyên cơ chế @close của từng component) -->
    <DashboarModal v-if="monitorOpen" @close="monitorOpen = false" />
    <AdminGuideModal v-if="guideStore.isOpen" @close="guideStore.close" />
    <component :is="activeComponent" v-if="activeComponent" @close="close" />
    <FeedbackListModal v-if="feedbackModal === 'opinion'" @close="feedbackModal = null" />
    <ErrorFeedbackManagementModal v-if="feedbackModal === 'errors'" @close="feedbackModal = null" />
  </div>
</template>
