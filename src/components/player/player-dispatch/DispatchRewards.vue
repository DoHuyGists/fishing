<script setup lang="ts">
import { t as tr } from '../../../i18n';
import type { DispatchDeliveryItem, DispatchRewards } from '../../../types/table/dispatch';
import { useDispatchStore } from '../../../stores/player-dispatch-store';
import Cash from '../player-currency/Cash.vue';
import Shells from '../player-currency/Shells.vue';
import Tickets from '../player-currency/Tickets.vue';
defineProps<{ rewards: DispatchRewards; deliveryItems?: DispatchDeliveryItem[] }>();
const store = useDispatchStore();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs" :aria-label="tr('Dispatch.rewards')">
    <span>{{ tr('Dispatch.rewards') }}</span>
    <Cash v-if="rewards.cash" :amount="rewards.cash" :size="20" :interactive="false" />
    <Shells v-if="rewards.shells" :amount="rewards.shells" :size="20" :interactive="false" />
    <Tickets v-if="rewards.tickets" :amount="rewards.tickets" :size="20" :interactive="false" />
    <span v-for="(item, index) in deliveryItems" :key="`${item.item_id}-${index}`" class="inline-flex min-w-0 items-center gap-1 rounded border border-border-default bg-surface px-1.5 py-1">
      <img v-if="store.rewardItems[item.item_id]?.image" :src="store.rewardItems[item.item_id]!.image!" :alt="store.rewardItems[item.item_id]!.name" class="size-6 object-contain" loading="lazy" />
      <span v-else aria-hidden="true">{{ store.rewardItems[item.item_id]?.icon || '🎒' }}</span>
      <span class="break-all">{{ store.rewardItems[item.item_id]?.name || item.item_id }}</span>
      <span class="shrink-0 font-semibold">×{{ item.quantity }}</span>
    </span>
    <span v-if="!rewards.cash && !rewards.shells && !rewards.tickets && !deliveryItems?.length">—</span>
  </div>
</template>
