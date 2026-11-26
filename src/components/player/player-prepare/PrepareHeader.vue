<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useCurrencyStore } from "../../../stores/player-currency-store";
import { useUserProfileStore } from "../../../stores/player-user-profile-store";
import Cash from "../player-currency/Cash.vue";
import Shells from "../player-currency/Shells.vue";
import Tickets from "../player-currency/Tickets.vue";
import SkillPoints from "../player-currency/SkillPoints.vue";
import UserTurn from "../player-stamina/UserTurn.vue";

defineProps<{ title: string; busy: boolean; refreshDisabled: boolean; refreshing: boolean; cooldown: number }>();
defineEmits<{ refresh: [] }>();
const currency = useCurrencyStore();
const profile = useUserProfileStore();
</script>

<template>
  <header class="slide-fade-in from-top flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-default bg-primary p-3 text-content">
    <div class="min-w-0 break-words text-lg font-bold text-accent sm:text-xl">{{ title }}</div>
    <div class="flex flex-wrap items-center gap-1 text-xs sm:text-sm">
      <Cash :amount="currency.formattedCash" />
      <Shells :amount="currency.formattedShells" />
      <Tickets :amount="currency.formattedTickets" />
      <SkillPoints :amount="profile.skillPoints" />
      <UserTurn />
    </div>
    <div class="flex items-center gap-2">
      <button type="button" class="rounded-lg border border-border-default bg-surface px-3 py-2 text-sm font-bold disabled:opacity-50" :disabled="busy || refreshDisabled" :aria-busy="refreshing" @click="$emit('refresh')">
        {{ refreshing ? tr('Modal.refreshing') : cooldown > 0 ? `${cooldown}s` : tr('Modal.lam_moi') }}
      </button>
      <RouterLink v-if="!busy" :to="{ name: 'lobby' }" class="rounded-lg border border-border-default bg-surface px-3 py-2 text-sm font-bold">
        {{ tr('Story.backHome') }}
      </RouterLink>
    </div>
  </header>
</template>
