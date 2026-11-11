<script lang="ts" setup>
import { t as tr } from "../i18n";

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
  | "assets"
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
  assets: defineAsyncComponent(() => import("../components/admin/assets/AssetsManagementModal.vue")),
  guides: defineAsyncComponent(() => import("../components/admin/guides-management/GuidesManagementModal.vue")),
  blueprint: defineAsyncComponent(() => import("../components/admin/blueprint-management/BlueprintManagement.vue")),
  aquacultureSpecies: defineAsyncComponent(
    () => import("../components/admin/aquaculture-species-management/AquacultureSpeciesManagement.vue"),
  ),
  aquacultureFood: defineAsyncComponent(
    () => import("../components/admin/aquaculture-food-management/AquacultureFoodManagement.vue"),
  ),
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
  event: defineAsyncComponent(() => import("../components/admin/event-management/EventManagementModal.vue")),
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
    get title() { return tr('AdminView.nuoi_ca'); },
    modules: [
      {
        key: "aquacultureSpecies",
        icon: "🐟",
        get label() { return tr('AdminView.cau_hinh_loai_nuoi'); },
        get desc() { return tr('AdminView.suc_chua_thoi_gian_nuoi_gia_giong_gia_ban_va_ty_le_ca_dac_biet'); },
        component: moduleComponents.aquacultureSpecies,
      },
      {
        key: "aquacultureFood",
        icon: "🌾",
        get label() { return tr('AdminView.thuc_an_theo_loai'); },
        get desc() { return tr('AdminView.lien_ket_vat_pham_thuc_an_va_muc_tang_chat_luong_cho_tung_loai'); },
        component: moduleComponents.aquacultureFood,
      },
    ],
  },
  {
    get title() { return tr('AdminView.du_lieu_tro_choi'); },
    modules: [
      {
        key: "assets",
        icon: "🖼️",
        get label() { return tr('AdminView.anh_video'); },
        get desc() { return tr('AdminView.tai_len_xem_truoc_va_sao_chep_link_anh_video_tu_storage'); },
        component: moduleComponents.assets,
      },
      {
        key: "blueprint",
        icon: "🛠️",
        get label() { return tr('AdminView.cong_thuc_che_tao'); },
        get desc() { return tr('AdminView.quan_ly_ban_ve_nguyen_lieu_thanh_pham_va_phi_che_tao'); },
        component: moduleComponents.blueprint,
      },
      {
        key: "skill",
        icon: "✨",
        get label() { return tr('SkillModal.ky_nang'); },
        get desc() { return tr('AdminView.quan_ly_ky_nang_cap_toi_da_va_hieu_ung_moi_cap'); },
        component: moduleComponents.skill,
      },
      {
        key: "area",
        icon: "🗺️",
        get label() { return tr('AdminView.bai_cau'); },
        get desc() { return tr('AdminView.them_sua_va_xoa_cac_bai_cau_trong_game'); },
        component: moduleComponents.area,
      },
      {
        key: "depthScope",
        icon: "🗺️",
        get label() { return tr('AdminView.do_sau'); },
        get desc() { return tr('AdminView.them_sua_va_xoa_cac_do_sau_ca_o'); },
        component: moduleComponents.depthScope,
      },
      {
        key: "item",
        icon: "🎒",
        get label() { return tr('ShopModal.vat_pham'); },
        get desc() { return tr('AdminView.quan_ly_can_cau_moi_va_cac_vat_pham_khac'); },
        component: moduleComponents.item,
      },
      {
        key: "redeemCode",
        icon: "🎟️",
        get label() { return tr('RedeemCodeForm.ma_doi_thuong'); },
        get desc() { return tr('AdminView.tao_ma_nhan_xu_dat_han_dung_va_bat_hoac_tat_ma'); },
        component: moduleComponents.redeemCode,
      },
      {
        key: "hourMission",
        icon: "⏰",
        get label() { return tr('AdminView.nhiem_vu_gio'); },
        get desc() { return tr('AdminView.quan_ly_nhiem_vu_cau_ca_theo_khung_gio_va_phan_thuong'); },
        component: moduleComponents.hourMission,
      },
      {
        key: "dailyMissionTemplates",
        icon: "📋",
        get label() { return tr('AdminView.mau_nhiem_vu_hang_ngay'); },
        get desc() { return tr('AdminView.quan_ly_muc_tieu_diem_do_kho_va_cau_hinh_nhiem_vu_hang_ngay'); },
        component: moduleComponents.dailyMissionTemplates,
      },
      {
        key: "dailyMissionRewards",
        icon: "🎁",
        get label() { return tr('AdminView.phan_thuong_nhiem_vu_hang_ngay'); },
        get desc() { return tr('AdminView.thiet_lap_moc_diem_va_phan_thuong_nhiem_vu_hang_ngay'); },
        component: moduleComponents.dailyMissionRewards,
      },
      {
        key: "notifications",
        icon: "🔔",
        get label() { return tr('NotificationModal.thong_bao'); },
        get desc() { return tr('AdminView.tao_va_quan_ly_thong_bao_ca_nhan_thong_bao_he_thong'); },
        component: moduleComponents.notifications,
      },
      {
        key: "guides",
        icon: "📖",
        get label() { return tr('AdminView.huong_dan_nguoi_choi'); },
        get desc() { return tr('AdminView.soan_noi_dung_sap_xep_va_quan_ly_trang_thai_xuat_ban_huong_dan'); },
        component: moduleComponents.guides,
      },
      {
        key: "fishingPass",
        icon: "🎫",
        get label() { return tr('AdminView.ve_cau'); },
        get desc() { return tr('AdminView.quan_ly_gia_thoi_han_va_trang_thai_ve_cau'); },
        component: moduleComponents.fishingPass,
      },
      {
        key: "fishingPassRewards",
        icon: "🎁",
        get label() { return tr('AdminView.phan_thuong_ve_cau'); },
        get desc() { return tr('AdminView.thiet_lap_vat_pham_free_va_premium_theo_tung_ngay_cua_ve'); },
        component: moduleComponents.fishingPassRewards,
      },
      {
        key: "species",
        icon: "🐟",
        get label() { return tr('AquacultureStockForm.loai_ca'); },
        get desc() { return tr('AdminView.chinh_thong_tin_va_thuoc_tinh_cua_tung_loai_ca'); },
        component: moduleComponents.species,
      },
      {
        key: "speciesInArea",
        icon: "🎯",
        get label() { return tr('AdminView.ca_theo_bai_cau'); },
        get desc() { return tr('AdminView.chon_loai_ca_xuat_hien_o_moi_bai_cau'); },
        component: moduleComponents.speciesInArea,
      },
    ],
  },
  {
    get title() { return tr('WeatherSection.thoi_tiet'); },
    modules: [
      {
        key: "zone",
        icon: "🌊",
        get label() { return tr('AdminView.vung'); },
        get desc() { return tr('AdminView.quan_ly_cac_vung_cau_va_thoi_tiet_hien_tai'); },
        component: moduleComponents.zone,
      },
      {
        key: "weather",
        icon: "⛅",
        get label() { return tr('WeatherSection.thoi_tiet'); },
        get desc() { return tr('AdminView.quan_ly_cac_loai_thoi_tiet_va_thoi_luong'); },
        component: moduleComponents.weather,
      },
      {
        key: "zoneWeather",
        icon: "🌦️",
        get label() { return tr('AdminView.thoi_tiet_theo_vung'); },
        get desc() { return tr('AdminView.chon_thoi_tiet_duoc_phep_o_moi_vung'); },
        component: moduleComponents.zoneWeather,
      },
      {
        key: "modifier",
        icon: "📊",
        get label() { return tr('AdminView.chi_so'); },
        get desc() { return tr('AdminView.quan_ly_cac_chi_so_modifiers'); },
        component: moduleComponents.modifier,
      },
      {
        key: "weatherModifier",
        icon: "🎚️",
        get label() { return tr('AdminView.chi_so_theo_thoi_tiet'); },
        get desc() { return tr('AdminView.cau_hinh_khoang_gia_tri_chi_so_cua_thoi_tiet'); },
        component: moduleComponents.weatherModifier,
      },
    ],
  },
  {
    get title() { return tr('EventModal.su_kien_2'); },
    modules: [
      {
        key: "event",
        icon: "🎉",
        get label() { return tr('EventModal.su_kien_2'); },
        get desc() { return tr('AdminView.tao_va_cap_nhat_noi_dung_cac_su_kien'); },
        component: moduleComponents.event,
      },
      {
        key: "schedule",
        icon: "🗓️",
        get label() { return tr('AdminView.lich_su_kien'); },
        get desc() { return tr('AdminView.dat_thoi_gian_bat_dau_va_ket_thuc_cho_su_kien'); },
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
        <div class="text-lg font-extrabold leading-tight">{{ tr('AdminView.quan_tri') }}</div>
        <div class="text-xs text-emerald-200/70 mt-0.5">{{ tr('AdminView.he_thong_cau_ca') }}</div>
      </div>

      <nav
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-5"
        :aria-label="tr('AdminView.dieu_huong_quan_tri')"
      >
        <section v-for="group in groups" :key="group.title">
          <div class="px-3 mb-1.5 text-xs font-semibold text-emerald-200/60">{{ group.title }}</div>
          <div class="space-y-0.5">
            <div v-for="m in group.modules" :key="m.key">
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
            </div>
          </div>
        </section>
      </nav>
    </aside>

    <!-- Main -->
    <main class="flex-1 min-w-0">
      <header
        class="bg-white border-b border-slate-200 px-5 py-4 sm:px-8 flex flex-wrap items-center gap-4 justify-between"
      >
        <div>
          <div class="text-xl font-extrabold text-[#153221]">{{ tr('AdminView.bang_dieu_khien') }}</div>
          <div class="text-sm text-slate-500">{{ tr('AdminView.chon_mot_muc_de_quan_ly_du_lieu') }}</div>
        </div>

        <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-haspopup="dialog"
            :aria-expanded="monitorOpen"
            @click="monitorOpen = true"
          >
            {{ tr('AdminView.giam_sat_bai_cau') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-haspopup="dialog"
            :aria-expanded="guideStore.isOpen"
            @click="guideStore.open"
          >
            {{ tr('AdminView.huong_dan_quan_tri') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
            @click="feedbackModal = 'opinion'"
          >
            {{ tr('AdminView.xem_gop_y') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600"
            @click="feedbackModal = 'errors'"
          >
            {{ tr('AdminView.xu_ly_bao_loi') }}
          </button>
          <label class="relative w-full sm:w-72">
            <span class="sr-only">{{ tr('AdminView.tim_muc_quan_ly') }}</span>
            <input
              v-model="keyword"
              type="search"
              :placeholder="tr('AdminView.tim_muc_quan_ly_2')"
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
          <div class="mb-3 text-sm font-bold text-slate-600">{{ group.title }}</div>

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
                <span class="block text-sm font-bold text-[#153221]">{{ tr('AdminView.quan_ly') }} {{ m.label.toLowerCase() }}</span>
                <span class="mt-1 block text-sm text-slate-500">{{ m.desc }}</span>
              </span>
            </button>
          </div>
        </section>

        <div
          v-if="filteredGroups.length === 0"
          class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500"
        >
          {{ tr('AdminView.khong_co_muc_nao_khop_voi') }}{{ keyword }}{{ tr('AdminView.hay_thu_tu_khoa_khac') }}
        </div>
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
