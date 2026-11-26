<script setup lang="ts">
import { computed } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { dispatchEligible, dispatchText } from "../../../data/dispatch.ts";
import type { DispatchNpc } from "../../../types/table/dispatch.ts";
import { useDispatchStore } from "../../../stores/player-dispatch-store.ts";
import Cash from "../player-currency/Cash.vue";
import Shells from "../player-currency/Shells.vue";
import DispatchPortrait from "./DispatchPortrait.vue";
import DispatchStats from "./DispatchStats.vue";

const props = defineProps<{ npc: DispatchNpc }>();
const store = useDispatchStore();
const owned = computed(() => store.owned.find((item) => item.npc_id === props.npc.id));
const busy = computed(() => store.runs.some((run) => run.owned_npc_id === owned.value?.id));
</script>

<template>
  <article class="dispatch-card" :class="{ 'ring-2 ring-accent': store.selectedNpcId === npc.id }">
    <div class="flex items-center gap-3">
      <DispatchPortrait :src="npc.image_path" fallback="🧑‍🌾" />
      <div class="min-w-0 space-y-1.5">
        <div class="font-bold">{{ dispatchText(npc.name) }}</div>
        <span
          class="inline-flex rounded-full border border-border-default px-2 py-0.5 text-xs"
          :class="busy ? 'bg-surface font-semibold' : ''"
        >
          {{ busy ? tr("Dispatch.working") : owned ? tr("Dispatch.owned") : tr("Dispatch.available") }}
        </span>
      </div>
    </div>
    <div v-if="dispatchText(npc.description)" class="text-xs leading-relaxed">{{ dispatchText(npc.description) }}</div>
    <DispatchStats :stats="npc.data.stats" />
    <div class="mt-auto space-y-3 border-t border-border-default pt-3">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{{ tr("Dispatch.operatingCost") }}</span>
        <Cash :amount="npc.operating_cash" :interactive="false" />
      </div>
      <div v-if="!owned" class="flex flex-wrap items-center justify-between gap-3">
        <Shells :amount="npc.purchase_shells" :interactive="false" />
        <button
          type="button"
          class="dispatch-button"
          :disabled="store.locked || !npc.enabled"
          @click="store.ask('buy', npc.id)"
        >
          {{ tr("Dispatch.buy") }}
        </button>
      </div>
      <template v-else>
        <div v-if="!npc.enabled" class="text-xs text-gold">{{ tr("Dispatch.errorNpc") }}</div>
        <div v-else-if="store.selectedJob && !dispatchEligible(npc, store.selectedJob)" class="text-xs text-gold">
          {{ tr("Dispatch.errorRequirements") }}
        </div>
        <button
          type="button"
          class="dispatch-button w-full"
          :disabled="store.locked || busy || !npc.enabled"
          @click="store.selectNpc(npc.id)"
        >
          {{ tr("Dispatch.chooseNpc") }}
        </button>
      </template>
    </div>
  </article>
</template>
