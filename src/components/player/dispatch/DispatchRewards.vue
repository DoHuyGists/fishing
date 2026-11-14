<script setup lang="ts">
import { t as tr } from '../../../i18n';
import type { DispatchRewards } from '../../../types/table/dispatch';
import Cash from '../currency/Cash.vue';
import Shells from '../currency/Shells.vue';
import Tickets from '../currency/Tickets.vue';
defineProps<{ rewards: DispatchRewards }>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs" :aria-label="tr('Dispatch.rewards')">
    <span>{{ tr('Dispatch.rewards') }}</span>
    <Cash v-if="rewards.cash" :amount="rewards.cash" :size="20" :interactive="false" />
    <Shells v-if="rewards.shells" :amount="rewards.shells" :size="20" :interactive="false" />
    <Tickets v-if="rewards.tickets" :amount="rewards.tickets" :size="20" :interactive="false" />
    <span v-if="!rewards.cash && !rewards.shells && !rewards.tickets">—</span>
  </div>
</template>
