<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCountryStore } from "../../stores/country";

const props = defineProps<{
  userId: string;
  profile?: { display_name: string | null; avatar_url: string | null; country_id: string | null } | null;
}>();
const countryStore = useCountryStore();
const failedAvatar = ref(false);
const displayName = computed(() => props.profile?.display_name?.trim() || `${props.userId.slice(0, 8)}…`);
watch(() => props.profile?.avatar_url, () => { failedAvatar.value = false; });
</script>

<template>
  <div class="flex min-w-0 items-center gap-3 text-[#24352a]">
    <div class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3b7a57] text-sm font-bold text-white">
      <img v-if="profile?.avatar_url && !failedAvatar" :src="profile.avatar_url" :alt="`Ảnh đại diện của ${displayName}`" class="size-full object-cover" referrerpolicy="no-referrer" @error="failedAvatar = true" />
      <span v-else>{{ (profile?.display_name?.trim() || userId).slice(0, 2).toUpperCase() }}</span>
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs font-bold" :title="`${displayName} (${userId})`">{{ displayName }}</div>
      <div class="mt-0.5 truncate text-[11px] text-[#556655]" :title="countryStore.getCountryName(profile?.country_id)">{{ countryStore.getCountryName(profile?.country_id) }}</div>
      <slot />
    </div>
  </div>
</template>
