<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import FishingScene from "../fishing/FishingScene.vue";
import TensionChallenge from "../fishing-challenge/TensionChallenge.vue";
import GuideTour from "../../shared/GuideTour.vue";
import { useNewPlayerFishingStore } from "../../../stores/tutorials/newPlayerFishing";
import { useTutorialSessionStore } from "../../../stores/tutorialSession";
import { useModalStore } from "../../../stores/modal";

const router = useRouter();
const lesson = useNewPlayerFishingStore();
const session = useTutorialSessionStore();
const modalStore = useModalStore();

async function exit() {
  const failure = await router.push({ name: "home" });
  if (!failure && router.currentRoute.value.name === "home") modalStore.open("tutorial");
}
onMounted(() => lesson.start());
onBeforeUnmount(() => lesson.stop());
</script>

<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-[#193224] text-[#24352a]">
    <header class="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 sm:px-5">
      <div>
        <div class="text-sm font-bold sm:text-base">{{ tr('NewPlayerFishing.buoi_cau_dau_tien') }}</div>
        <div class="text-[11px] text-[#61745d]">{{ tr('NewPlayerFishing.man_tap_luyen_trang_bi_va_ket_qua_chi_dung_trong_luot_nay') }}</div>
      </div>
      <div class="flex gap-2 text-xs font-bold">
        <button v-if="lesson.objective !== 'complete'" type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 hover:bg-[#e2ecdc]" @click="lesson.showGuide">{{ tr('NewPlayerFishing.chi_dan') }}</button>
        <button type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 hover:bg-[#e2ecdc]" @click="lesson.start">{{ tr('NewPlayerFishing.choi_lai') }}</button>
        <button type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 hover:bg-[#e2ecdc]" @click="exit">{{ tr('NewPlayerFishing.thoat') }}</button>
      </div>
    </header>
    <div class="flex shrink-0 gap-2 overflow-x-auto bg-[#e7ecda] px-3 py-2 text-xs sm:justify-center" :aria-label="tr('NewPlayerFishing.tien_trinh_bai_hoc')">
      <div v-for="(label, index) in lesson.objectives" :key="label" :aria-current="lesson.objectiveIndex === index && lesson.objective !== 'complete' ? 'step' : undefined"
        class="flex shrink-0 items-center gap-2 rounded-full px-3 py-1" :class="index <= lesson.objectiveIndex ? 'bg-white font-bold' : 'opacity-60'">
        <span aria-hidden="true">{{ lesson.objective === 'complete' || index < lesson.objectiveIndex ? '✓' : index + 1 }}</span>{{ label }}
      </div>
    </div>
    <div id="tutorial-scene" class="relative min-h-0 flex-1">
      <FishingScene v-if="session.config" :key="lesson.attempt" :context="session.sceneContext" class="h-full" />
      <div id="tutorial-water-target" class="pointer-events-none absolute left-[42%] top-[51%] grid h-12 w-[24%] place-items-center rounded-full border border-dashed border-white/70 bg-black/20 text-center text-xs font-bold text-white"
        :class="session.castPhase === 'idle' || session.castPhase === 'lost' ? '' : 'invisible'">{{ tr('AdjusDepth.mat_nuoc') }}</div>
    </div>
    <section class="z-10 max-h-[48dvh] shrink-0 space-y-2 overflow-y-auto border-t border-[#cbd9c6] bg-[#f5f9f0] p-3 sm:px-5">
      <div v-if="lesson.objective === 'complete'" class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#cbd9c6] bg-white p-4" role="status">
        <div class="flex items-center gap-4">
          <img :src="session.inventory[0]?.image" :alt="tr('NewPlayerFishing.ca_vua_cau_duoc')" class="size-16 object-contain">
          <div>
            <div class="text-lg font-bold">{{ tr('NewPlayerFishing.hoan_thanh_buoi_cau_dau_tien') }}</div>
            <div class="mt-1 text-sm">{{ session.inventory[0]?.name }} · {{ session.inventory[0]?.weight }} kg</div>
            <div class="mt-1 text-xs text-[#61745d]">{{ tr('NewPlayerFishing.ban_da_biet_chon_trang_bi_quang_can_va_giu_luc_cang_day') }}</div>
          </div>
        </div>
        <button type="button" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white" @click="exit">{{ tr('NewPlayerFishing.ve_danh_sach_man_choi') }}</button>
      </div>
      <template v-else>
        <div v-if="lesson.objective === 'equipment'" id="tutorial-equipment" class="space-y-2">
          <div class="text-sm font-bold">{{ tr('NewPlayerFishing.chon_du_5_mon_trang_bi') }}</div>
          <div class="grid grid-cols-5 gap-1.5 sm:gap-3">
            <button v-for="item in lesson.config.equipment" :key="item.id" type="button" :aria-pressed="session.loadout[item.tool] === item.id"
              class="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-[#cbd9c6] p-2 text-center text-[10px] font-semibold hover:bg-[#e2ecdc] sm:text-xs"
              :class="session.loadout[item.tool] === item.id ? 'bg-[#dcebd3] ring-2 ring-emerald-700' : 'bg-white'" @click="session.selectEquipment(item.id)">
              <img :src="item.image" alt="" class="size-8 object-contain sm:size-10">
              <span>{{ item.name }}</span>
              <span>{{ session.loadout[item.tool] === item.id ? tr('NewPlayerFishing.da_chon') : tr('NewPlayerFishing.chon') }}</span>
            </button>
          </div>
          <button type="button" class="w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-40" :disabled="!session.equipmentReady" @click="session.confirmEquipment">{{ tr('TensionChallenge.san_sang') }}</button>
        </div>
        <div v-else-if="session.tensionChallenge" id="tutorial-tension" :key="`fight-${lesson.attempt}`">
          <TensionChallenge :controller="session" untimed-start />
          <div class="mt-2 text-center text-xs">{{ tr('NewPlayerFishing.giu_nut_hoac_space_de_thu_day_tha_de_giam_luc_cang_keo_ve_0_m') }}</div>
        </div>
        <div v-else class="flex flex-wrap items-center justify-between gap-3">
          <div role="status" class="text-sm">{{ session.castMessage }}</div>
          <div class="flex gap-2">
            <button v-if="session.canCast" type="button" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white" @click="session.castTo(56, 60)">{{ tr('NewPlayerFishing.quang_can') }}</button>
            <button type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" :disabled="!session.canReelIn" @click="session.reelInBait">{{ tr('NewPlayerFishing.thu_moi') }}</button>
          </div>
        </div>
      </template>
    </section>
    <GuideTour v-if="lesson.guideVisible" :key="`${lesson.attempt}-${lesson.objective}`" :steps="lesson.guideSteps" :finish-label="tr('NewPlayerFishing.thuc_hanh')" @finish="lesson.dismissGuide" />
  </main>
</template>
