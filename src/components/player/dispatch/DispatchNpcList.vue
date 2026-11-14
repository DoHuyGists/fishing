<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { dispatchEligible, dispatchText } from '../../../data/dispatch';
import { useDispatchStore } from '../../../stores/dispatch';
import Cash from '../currency/Cash.vue';
import Shells from '../currency/Shells.vue';
const store = useDispatchStore();
const owned = (id: string) => store.owned.find(o => o.npc_id === id);
const busy = (id: string) => store.runs.some(r => r.owned_npc_id === owned(id)?.id);
</script>

<template>
  <div v-if="!store.npcs.length" class="py-8 text-center text-sm">{{ tr('Dispatch.emptyNpcs') }}</div>
  <div class="dispatch-grid">
    <article v-for="npc in store.npcs" :key="npc.id" class="dispatch-card slide-fade-in player-content-in" :class="{ 'ring-2 ring-[#527547]': store.selectedNpcId === npc.id }">
      <div class="flex items-center gap-2">
        <img v-if="npc.image_path" :src="npc.image_path" :alt="dispatchText(npc.name)" class="size-10 shrink-0 rounded-md object-contain" loading="lazy">
        <span v-else aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#f5f9f0] text-2xl">🧑‍🌾</span>
        <div class="min-w-0">
          <div class="font-bold">{{ dispatchText(npc.name) }}</div>
          <div class="text-xs text-[#61745d]">{{ busy(npc.id) ? tr('Dispatch.working') : owned(npc.id) ? tr('Dispatch.owned') : tr('Dispatch.available') }}</div>
        </div>
      </div>
      <div>{{ dispatchText(npc.description) }}</div>
      <div class="flex flex-wrap gap-1 text-[11px]">
        <span v-for="(value, key) in npc.data.stats" :key="key" class="rounded bg-[#f5f9f0] px-1.5 py-0.5">{{ key }}: {{ value }}</span>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{{ tr('Dispatch.operatingCost') }}</span><Cash :amount="npc.operating_cash" :size="20" :interactive="false" />
      </div>
      <div v-if="!owned(npc.id)" class="flex flex-wrap items-center justify-between gap-2">
        <Shells :amount="npc.purchase_shells" :size="18" :interactive="false" />
        <button type="button" class="dispatch-button" :disabled="store.locked || !npc.enabled" @click="store.ask('buy', npc.id)">{{ tr('Dispatch.buy') }}</button>
      </div>
      <div v-else class="space-y-2">
        <div v-if="!npc.enabled" class="text-xs text-amber-800">{{ tr('Dispatch.errorNpc') }}</div>
        <div v-else-if="store.selectedJob && !dispatchEligible(npc, store.selectedJob)" class="text-xs text-amber-800">{{ tr('Dispatch.errorRequirements') }}</div>
        <button type="button" class="dispatch-button w-full" :disabled="store.locked || busy(npc.id) || !npc.enabled" @click="store.selectNpc(npc.id)">{{ tr('Dispatch.chooseNpc') }}</button>
      </div>
    </article>
  </div>
</template>
