<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useModalStore } from "../../stores/modal.ts";
import { useCurrencyStore } from "../../stores/currency.ts";
import Cash from "../currency/Cash.vue";
import GuideTour from "./GuideTour.vue";
import UserTurn from "../stamina/UserTurn.vue";

const {
  title = "",
  subTitle = "",
  guidSteps = [],
  onRefresh = undefined,
} = defineProps<{
  title?: string;
  subTitle?: string;
  guidSteps?: any[];
  onRefresh?: () => void;
}>();
const hasRefreshListener = onRefresh != undefined;
const hasGuideSteps = guidSteps.length != 0;

const currencyStore = useCurrencyStore();
const modalStore = useModalStore();
const REFRESH_COOLDOWN = 5;
const isRefreshing = ref<boolean>(false);
const refreshCooldown = ref(0);
const showGuide = ref(false);

function handleRefresh() {
  onRefresh?.();
  isRefreshing.value = true;
  refreshCooldown.value = REFRESH_COOLDOWN;
}

function handleGuide() {
  showGuide.value = true;
}

let status: number | undefined = undefined;
let cooldown: number | undefined = undefined;
watch(isRefreshing, (refreshing) => {
  if (refreshing) {
    status = setTimeout(() => {
      isRefreshing.value = false;
    }, REFRESH_COOLDOWN * 1000);
    cooldown = setInterval(() => {
      refreshCooldown.value--;
    }, 1000);
  } else {
    if (status) clearTimeout(status);
    if (cooldown) clearInterval(cooldown);

    status = undefined;
    cooldown = undefined;
  }
});

onMounted(() => {
  window.document.body.style.overflowY = "hidden";
});

onUnmounted(() => {
  if (status) clearTimeout(status);
  if (cooldown) clearInterval(cooldown);
  window.document.body.style.overflowY = "auto";
});
</script>

<template>
  <div class="fixed inset-0 z-9999 flex h-[100vh] w-screen flex-col bg-white supports-[height:100dvh]:h-[100dvh]">
    <header class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-2 border-b border-emerald-950/10 bg-[#e7ecda] sm:flex-nowrap sm:gap-4">
      <div class="min-w-0 flex-1 sm:flex-none">
        <h2 class="m-0 mt-1 break-words text-lg font-bold sm:text-2xl">{{ title }}</h2>
        <p class="m-0 break-words text-[10px] font-extrabold tracking-[0.14em] uppercase text-emerald-800">{{ subTitle }}</p>
      </div>
      <div class="order-2 ml-auto shrink-0 sm:order-none sm:ml-0">
        <Cash :amount="currencyStore.formattedCash" />
        <UserTurn />
      </div>
      <div class="order-3 ml-auto flex max-w-full shrink-0 items-center gap-1 sm:order-none sm:ml-0 sm:gap-2">
        <button
          v-if="hasGuideSteps"
          type="button"
          class="px-2 py-2 rounded-md border border-emerald-900/15 bg-white/70 text-xs font-bold text-emerald-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
          :disabled="isRefreshing"
          @click="handleGuide"
        >
          <span aria-hidden="true" class="mr-1">Hướng dẫn</span>
        </button>
        <button
          v-if="hasRefreshListener"
          type="button"
          class="px-2 py-2 rounded-md border border-emerald-900/15 bg-white/70 text-xs font-bold text-emerald-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          <span aria-hidden="true" class="mr-1">↻</span>{{ isRefreshing ? `${refreshCooldown}s` : "Làm mới" }}
        </button>
        <button
          type="button"
          class="w-9 h-9 rounded-full border border-emerald-900/15 bg-white/70 text-emerald-950 hover:bg-white text-2xl leading-none cursor-pointer"
          aria-label="Đóng"
          @click="modalStore.close"
        >
          &times;
        </button>
      </div>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
      <slot></slot>
    </div>
  </div>
  <GuideTour v-if="showGuide && hasGuideSteps" :steps="guidSteps" @finish="showGuide = false" />
</template>
