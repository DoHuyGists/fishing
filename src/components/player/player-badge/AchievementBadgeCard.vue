<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { UserBadgeStatus } from "../../../types/model/badge";

defineProps<{ badge: UserBadgeStatus; index: number }>();
const emit = defineEmits<{ select: [badgeId: string] }>();
</script>

<template>
  <button
    type="button"
    class="slide-fade-in from-bottom player-content-in group relative flex min-h-32 cursor-pointer flex-col items-center overflow-hidden rounded-xl border p-1.5 text-center transition duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:min-h-36 sm:rounded-2xl sm:p-2"
    :class="
      badge.is_earned
        ? 'border-emerald-200 bg-white hover:border-emerald-400'
        : 'border-palette-dce4d8 bg-palette-f8faf6 hover:border-emerald-200'
    "
    :style="{ '--delay': `${index * 45}ms` }"
    :aria-label="
      tr('Achievement.value0_value1_xem_chi_tiet', {
        value0: badge.name,
        value1: badge.is_earned ? tr('Achievement.earnedSuffix') : tr('Achievement.unearnedSuffix'),
      })
    "
    @click="emit('select', badge.badge_id)"
  >
    <span
      aria-hidden="true"
      class="absolute -right-7 -top-8 h-16 w-16 rounded-full bg-amber-100/70 blur-xl transition group-hover:bg-amber-200/80"
    ></span>
    <span class="relative grid h-12 w-full place-items-center sm:h-14">
      <span
        class="absolute h-10 w-10 rounded-full border border-amber-200/70 bg-linear-to-br from-amber-50 to-orange-100 shadow-inner transition duration-300 group-hover:scale-110 group-hover:rotate-6 sm:h-12 sm:w-12"
      ></span>
      <img
        v-if="badge.icon_url"
        :src="badge.icon_url"
        :alt="badge.name"
        loading="lazy"
        class="relative z-10 h-10 w-10 object-contain drop-shadow-md transition duration-300 group-hover:scale-110 sm:h-12 sm:w-12"
        :class="!badge.is_earned && 'grayscale opacity-50'"
      />
      <span
        v-else
        class="relative z-10 text-2xl drop-shadow-sm sm:text-3xl"
        :class="!badge.is_earned && 'grayscale opacity-50'"
        aria-hidden="true"
        >🏅</span
      >
      <span
        v-if="badge.is_earned"
        class="absolute bottom-0 right-[calc(50%-1.5rem)] z-20 grid h-4 w-4 place-items-center rounded-full border border-white bg-emerald-600 text-[9px] font-black text-white shadow sm:right-[calc(50%-1.75rem)] sm:h-5 sm:w-5 sm:text-[10px]"
        :aria-label="tr('Achievement.da_dat')"
        >✓</span
      >
      <span
        v-else
        class="absolute bottom-0 right-[calc(50%-1.5rem)] z-20 grid h-4 w-4 place-items-center rounded-full border border-white bg-gray-300 text-[8px] text-white sm:right-[calc(50%-1.75rem)] sm:h-5 sm:w-5 sm:text-[10px]"
        aria-hidden="true"
        >✦</span
      >
    </span>
    <div
      class="relative m-0 mt-1 line-clamp-2 w-full text-[10px] font-extrabold leading-tight text-content sm:mt-1.5 sm:text-xs"
      :title="badge.name"
    >
      {{ badge.name }}
    </div>
    <span
      v-if="badge.can_claim"
      class="relative mt-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-amber-800 sm:mt-1.5 sm:px-2 sm:text-[10px]"
      >{{ tr("Achievement.nhan_thuong") }}</span
    >
    <span
      v-else-if="badge.is_earned"
      class="relative mt-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-emerald-800 sm:mt-1.5 sm:px-2 sm:text-[10px]"
      >{{ tr("Achievement.dat") }} {{ badge.quantity }} {{ tr("Achievement.lan") }}</span
    >
    <span
      v-else
      class="relative mt-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-gray-500 sm:mt-1.5 sm:px-2 sm:text-[10px]"
      >{{ tr("Achievement.chua_mo_khoa") }}</span
    >
  </button>
</template>
