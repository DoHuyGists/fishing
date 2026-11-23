<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import { useFishingStore } from "../../../stores/player-fishing-store";
const store = useFishingStore();
const discoveredFishes = computed(() => store.areaSpeciesDiary?.fishes.filter((fish) => fish.is_discovered) ?? []);
const undiscoveredFishes = computed(() => store.areaSpeciesDiary?.fishes.filter((fish) => !fish.is_discovered) ?? []);
</script>
<template>
  <Teleport to="body">
    <Transition name="player-popup" :duration="{ enter: 220, leave: 150 }">
      <div
        v-if="store.lakeGuideOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-ocean-deep/75 backdrop-blur-[7px]"
        @click.self="store.closeLakeGuide"
      >
        <section
          class="player-popup-panel w-[min(500px,100%)] overflow-hidden border border-ocean-gold/70 rounded-[20px] bg-primary shadow-[0_24px_70px_color-mix(in_srgb,_var(--color-content)_48%,_transparent)] text-ocean-pearl"
          role="dialog"
          aria-modal="true"
        >
          <header class="flex justify-between px-5 pt-[19px] pb-3 border-b border-ocean-gold/20 text-ocean-gold">
            <div>
              <div class="m-0 text-xl">{{ tr("EquipmentMenu.ca_trong_ho") }}</div>
            </div>
            <button
              type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-ocean-cyan/15 text-white cursor-pointer text-[22px] leading-none"
              @click="store.closeLakeGuide"
            >
              ×
            </button>
          </header>
          <div class="px-5 py-4">
            <div v-if="store.isLoadingAreaSpeciesDiary" class="py-8 text-center text-sm text-border-strong" role="status">
              {{ tr("CaughtModal.dang_tai_danh_sach_ca") }}
            </div>
            <div v-else-if="store.areaSpeciesDiaryError" class="py-6 text-center text-sm text-danger" role="alert">
              <div class="mb-3">{{ tr("LakeFishGuide.khong_the_tai_so_tay_ca_trong_ho") }}</div>
              <button
                type="button"
                class="rounded-lg border border-white/20 px-3 py-2 text-xs text-white"
                @click="store.fetchAreaSpeciesDiary"
              >
                {{ tr("Maintenance.thu_lai") }}
              </button>
            </div>
            <template v-else-if="store.areaSpeciesDiary">
              <div class="mb-4 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-white/[0.07] p-2">
                  <strong class="block text-lg">{{ store.areaSpeciesDiary.total_species }}</strong>
                  <span class="text-[10px] text-border-strong">{{ tr("LakeFishGuide.tong_loai") }}</span>
                </div>
                <div class="rounded-xl bg-white/[0.07] p-2">
                  <strong class="block text-lg text-ocean-cyan">{{ store.areaSpeciesDiary.discovered_species }}</strong>
                  <span class="text-[10px] text-border-strong">{{ tr("LakeFishGuide.da_kham_pha") }}</span>
                </div>
                <div class="rounded-xl bg-white/[0.07] p-2">
                  <strong class="block text-lg text-ocean-gold">{{
                    store.areaSpeciesDiary.undiscovered_species
                  }}</strong>
                  <span class="text-[10px] text-border-strong">{{ tr("LakeFishGuide.chua_kham_pha") }}</span>
                </div>
              </div>

              <div class="max-h-[min(55vh,420px)] space-y-4 overflow-y-auto pr-1">
                <section v-if="discoveredFishes.length">
                  <div class="mb-2 text-xs font-bold uppercase tracking-wide text-ocean-cyan">
                    {{ tr("LakeFishGuide.da_kham_pha") }}
                  </div>
                  <div class="m-0 space-y-2 p-0">
                    <div
                      v-for="fish in discoveredFishes"
                      :key="fish.species_id"
                      class="flex gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2.5"
                    >
                      <img
                        :src="fish.image || '/fish/VN/fish.jpg'"
                        :alt="fish.display_name"
                        class="h-14 shrink-0 rounded-lg bg-content/20 object-cover"
                        draggable="false"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="m-0 font-semibold">{{ fish.display_name || fish.name }}</div>
                        <div class="m-0 text-[10px] text-ocean-gold">
                          {{ fish.rarity || tr("LakeFishGuide.chua_ro_do_hiem") }}
                        </div>
                        <div v-if="fish.information" class="mb-0 mt-1 text-xs leading-relaxed text-border-strong">
                          {{ fish.information }}
                        </div>
                        <div
                          v-if="fish.weight_min != null || fish.weight_max != null"
                          class="mb-0 mt-1 text-[10px] text-border-strong"
                        >
                          {{ tr("LakeFishGuide.can_nang") }} {{ fish.weight_min ?? "?" }}–{{
                            fish.weight_max ?? "?"
                          }}
                          kg
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section v-if="undiscoveredFishes.length">
                  <div class="mb-2 text-xs font-bold uppercase tracking-wide text-ocean-gold">
                    {{ tr("LakeFishGuide.chua_kham_pha") }}
                  </div>
                  <div class="m-0 grid grid-cols-2 gap-2 p-0">
                    <div
                      v-for="fish in undiscoveredFishes"
                      :key="fish.species_id"
                      class="flex min-h-16 items-center gap-2 rounded-xl border border-dashed border-white/15 bg-content/10 p-2.5"
                    >
                      <span
                        class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-lg text-border-strong"
                        aria-hidden="true"
                        >?</span
                      >
                      <span class="text-xs font-semibold text-ocean-pearl/80">{{
                        fish.display_name || tr("LakeFishGuide.chua_kham_pha")
                      }}</span>
                    </div>
                  </div>
                </section>
                <div v-if="!store.areaSpeciesDiary.fishes.length" class="m-0 py-6 text-center text-sm text-border-strong">
                  {{ tr("LakeFishGuide.chua_co_du_lieu_loai_ca_o_khu_vuc_nay") }}
                </div>
              </div>
            </template>
            <div v-else class="m-0 py-8 text-center text-sm text-border-strong">
              {{ tr("LakeFishGuide.chua_co_khu_vuc_cau_ca_duoc_chon") }}
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
