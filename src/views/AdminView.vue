<script lang="ts" setup>
import { computed, defineAsyncComponent, ref } from "vue";

type ModuleKey =
  | "zone"
  | "weather"
  | "zoneWeather"
  | "weatherModifier"
  | "modifier"
  | "area"
  | "item"
  | "species"
  | "speciesInArea"
  | "event"
  | "schedule"
  | "redeemCode"
  | "notifications";

interface AdminModule {
  key: ModuleKey;
  icon: string;
  label: string;
  desc: string;
  component: ReturnType<typeof defineAsyncComponent>;
}

const moduleComponents = {
  area: defineAsyncComponent(() => import("../components/admin/fishing-area-management/FishingAreaManagement.vue")),
  item: defineAsyncComponent(() => import("../components/admin/item-management/ItemManagement.vue")),
  redeemCode: defineAsyncComponent(() => import("../components/admin/redeem-management/RedeemCodeManagement.vue")),
  notifications: defineAsyncComponent(() => import("../components/admin/notification-management/NotificationManagement.vue")),
  species: defineAsyncComponent(
    () => import("../components/admin/species-management/SpeciesManagementModal.vue"),
  ),
  speciesInArea: defineAsyncComponent(() => import("../components/admin/species-in-area-management/SpeciesInAreaManagement.vue")),
  zone: defineAsyncComponent(() => import("../components/admin/zone-management/ZoneManagement.vue")),
  weather: defineAsyncComponent(() => import("../components/admin/weather-management/WeatherManagement.vue")),
  zoneWeather: defineAsyncComponent(() => import("../components/admin/zone-weather-management/ZoneWeatherManagement.vue")),
  modifier: defineAsyncComponent(() => import("../components/admin/modifier-management/ModifierManagement.vue")),
  weatherModifier: defineAsyncComponent(() => import("../components/admin/weather-modifier-management/WeatherModifierManagement.vue")),
  event: defineAsyncComponent(() => import("../components/admin/event-management/EventManagement.vue")),
  schedule: defineAsyncComponent(() => import("../components/admin/event-schedule-management/EventScheduleManagement.vue")),
};

const FeedbackListModal = defineAsyncComponent(() => import("../components/admin/feedback-management/FeedbackListModal.vue"));
const ErrorFeedbackManagementModal = defineAsyncComponent(
  () => import("../components/admin/feedback-management/ErrorFeedbackManagementModal.vue"),
);

interface ModuleGroup {
  title: string;
  modules: AdminModule[];
}

const groups: ModuleGroup[] = [
  {
    title: "Dá»¯ liá»‡u trÃ² chÆ¡i",
    modules: [
      {
        key: "area",
        icon: "ðŸ—ºï¸",
        label: "BÃ£i cÃ¢u",
        desc: "ThÃªm, sá»­a vÃ  xoÃ¡ cÃ¡c bÃ£i cÃ¢u trong game.",
        component: moduleComponents.area,
      },
      {
        key: "item",
        icon: "ðŸŽ’",
        label: "Váº­t pháº©m",
        desc: "Quáº£n lÃ½ cáº§n cÃ¢u, má»“i vÃ  cÃ¡c váº­t pháº©m khÃ¡c.",
        component: moduleComponents.item,
      },
      {
        key: "redeemCode",
        icon: "ðŸŽŸï¸",
        label: "MÃ£ Ä‘á»•i thÆ°á»Ÿng",
        desc: "Táº¡o mÃ£ nháº­n xu, Ä‘áº·t háº¡n dÃ¹ng vÃ  báº­t hoáº·c táº¯t mÃ£.",
        component: moduleComponents.redeemCode,
      },
      {
        key: "notifications",
        icon: "ðŸ””",
        label: "ThÃ´ng bÃ¡o",
        desc: "Táº¡o vÃ  quáº£n lÃ½ thÃ´ng bÃ¡o cÃ¡ nhÃ¢n, thÃ´ng bÃ¡o há»‡ thá»‘ng.",
        component: moduleComponents.notifications,
      },
      {
        key: "species",
        icon: "ðŸŸ",
        label: "LoÃ i cÃ¡",
        desc: "Chá»‰nh thÃ´ng tin vÃ  thuá»™c tÃ­nh cá»§a tá»«ng loÃ i cÃ¡.",
        component: moduleComponents.species,
      },
      {
        key: "speciesInArea",
        icon: "ðŸŽ¯",
        label: "CÃ¡ theo bÃ£i cÃ¢u",
        desc: "Chá»n loÃ i cÃ¡ xuáº¥t hiá»‡n á»Ÿ má»—i bÃ£i cÃ¢u.",
        component: moduleComponents.speciesInArea,
      },
    ],
  },
  {
    title: "Thá»i tiáº¿t",
    modules: [
      {
        key: "zone",
        icon: "ðŸŒŠ",
        label: "VÃ¹ng",
        desc: "Quáº£n lÃ½ cÃ¡c vÃ¹ng cÃ¢u vÃ  thá»i tiáº¿t hiá»‡n táº¡i.",
        component: moduleComponents.zone,
      },
      {
        key: "weather",
        icon: "â›…",
        label: "Thá»i tiáº¿t",
        desc: "Quáº£n lÃ½ cÃ¡c loáº¡i thá»i tiáº¿t vÃ  thá»i lÆ°á»£ng.",
        component: moduleComponents.weather,
      },
      {
        key: "zoneWeather",
        icon: "ðŸŒ¦ï¸",
        label: "Thá»i tiáº¿t theo vÃ¹ng",
        desc: "Chá»n thá»i tiáº¿t Ä‘Æ°á»£c phÃ©p á»Ÿ má»—i vÃ¹ng.",
        component: moduleComponents.zoneWeather,
      },
      {
        key: "modifier",
        icon: "ðŸ“Š",
        label: "Chá»‰ sá»‘",
        desc: "Quáº£n lÃ½ cÃ¡c chá»‰ sá»‘ (modifiers).",
        component: moduleComponents.modifier,
      },
      {
        key: "weatherModifier",
        icon: "ðŸŽšï¸",
        label: "Chá»‰ sá»‘ theo thá»i tiáº¿t",
        desc: "Cáº¥u hÃ¬nh khoáº£ng giÃ¡ trá»‹ chá»‰ sá»‘ cá»§a thá»i tiáº¿t.",
        component: moduleComponents.weatherModifier,
      },
    ],
  },
  {
    title: "Sá»± kiá»‡n",
    modules: [
      {
        key: "event",
        icon: "ðŸŽ‰",
        label: "Sá»± kiá»‡n",
        desc: "Táº¡o vÃ  cáº­p nháº­t ná»™i dung cÃ¡c sá»± kiá»‡n.",
        component: moduleComponents.event,
      },
      {
        key: "schedule",
        icon: "ðŸ—“ï¸",
        label: "Lá»‹ch sá»± kiá»‡n",
        desc: "Äáº·t thá»i gian báº¯t Ä‘áº§u vÃ  káº¿t thÃºc cho sá»± kiá»‡n.",
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
    <aside class="hidden lg:flex lg:w-64 lg:shrink-0 flex-col bg-[#153221] text-emerald-50">
      <div class="px-6 py-5 border-b border-white/10">
        <p class="text-lg font-extrabold leading-tight">Quáº£n trá»‹</p>
        <p class="text-xs text-emerald-200/70 mt-0.5">Há»‡ thá»‘ng cÃ¢u cÃ¡</p>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Äiá»u hÆ°á»›ng quáº£n trá»‹">
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
          <h1 class="text-xl font-extrabold text-[#153221]">Báº£ng Ä‘iá»u khiá»ƒn</h1>
          <p class="text-sm text-slate-500">Chá»n má»™t má»¥c Ä‘á»ƒ quáº£n lÃ½ dá»¯ liá»‡u.</p>
        </div>

        <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
            @click="feedbackModal = 'opinion'"
          >
            Xem gÃ³p Ã½
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600"
            @click="feedbackModal = 'errors'"
          >
            Xá»­ lÃ½ bÃ¡o lá»—i
          </button>
          <label class="relative w-full sm:w-72">
            <span class="sr-only">TÃ¬m má»¥c quáº£n lÃ½</span>
            <input
              v-model="keyword"
              type="search"
              placeholder="TÃ¬m má»¥c quáº£n lÃ½..."
              class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25"
            />
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"
              >ðŸ”</span
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
                <span class="block text-sm font-bold text-[#153221]">Quáº£n lÃ½ {{ m.label.toLowerCase() }}</span>
                <span class="mt-1 block text-sm text-slate-500">{{ m.desc }}</span>
              </span>
            </button>
          </div>
        </section>

        <p
          v-if="filteredGroups.length === 0"
          class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500"
        >
          KhÃ´ng cÃ³ má»¥c nÃ o khá»›p vá»›i "{{ keyword }}". HÃ£y thá»­ tá»« khoÃ¡ khÃ¡c.
        </p>
      </div>
    </main>

    <!-- Module dialogs (giá»¯ nguyÃªn cÆ¡ cháº¿ @close cá»§a tá»«ng component) -->
    <component :is="activeComponent" v-if="activeComponent" @close="close" />
    <FeedbackListModal v-if="feedbackModal === 'opinion'" @close="feedbackModal = null" />
    <ErrorFeedbackManagementModal v-if="feedbackModal === 'errors'" @close="feedbackModal = null" />
  </div>
</template>
