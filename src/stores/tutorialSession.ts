import type { MapPoint } from "../types/model/fishingMap";
import type { FishingPhase, FishingSceneContext } from "../types/model/fishingGameplay";
import type { TensionChallenge, TensionFight } from "../types/model/tensionChallenge";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { isPointInWater } from "../data/fishingMap";

import { createTensionFight, stepTensionFight, tensionMaxTicks } from "../data/tensionChallenge";

export type TutorialTool = "rod" | "line" | "reel" | "hook" | "bait";
export interface TutorialEquipment {
  id: string;
  tool: TutorialTool;
  name: string;
  image: string;
}
export interface TutorialFish {
  name: string;
  image: string;
  weight: number;
}
export interface TutorialSessionConfig {
  slug: string;
  sceneImage: string;
  fishingBoundary: MapPoint[];
  equipment: TutorialEquipment[];
  fish: TutorialFish;
  waitTimeMs: number;
  challenge: Pick<TensionChallenge, "seed" | "config" | "fish">;
}

// Deliberately has no repository, authentication, player-store or persistence imports.
export const useTutorialSessionStore = defineStore("tutorial-session", () => {
  const config = ref<TutorialSessionConfig | null>(null);
  const castPhase = ref<FishingPhase>("idle");
  const castMessage = ref(tr('tutorialSession.chon_du_trang_bi_de_bat_dau'));
  const baitPosition = ref<MapPoint>({ x: 56, y: 60 });
  const loadout = ref<Partial<Record<TutorialTool, string>>>({});
  const equipmentConfirmed = ref(false);
  const inventory = ref<TutorialFish[]>([]);
  const tensionChallenge = ref<TensionChallenge | null>(null);
  const tensionFight = ref<TensionFight | null>(null);
  const tensionStartedAt = ref<number | null>(null);
  const tensionReeling = ref(false);
  const paused = ref(false);
  const serverClockOffset = 0;
  const isStartingTensionChallenge = false;
  let castTimer: ReturnType<typeof setTimeout> | undefined;
  let biteTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const currentArea = computed(() => ({ fishingBoundary: config.value?.fishingBoundary ?? [] }));
  const equipmentReady = computed(() => (["rod", "line", "reel", "hook", "bait"] as const)
    .every(tool => config.value?.equipment.some(item => item.tool === tool && item.id === loadout.value[tool])));
  const canCast = computed(() => !!config.value && equipmentConfirmed.value && !paused.value && ["idle", "lost"].includes(castPhase.value));
  const canReelIn = computed(() => !paused.value && ["casting", "waiting", "bite"].includes(castPhase.value) && tensionStartedAt.value === null);
  const canChangeEquipment = computed(() => !!config.value && ["idle", "lost"].includes(castPhase.value));
  const selectedRod = computed(() => config.value?.equipment.find(item => item.id === loadout.value.rod));
  const sceneContext = computed<FishingSceneContext>(() => ({
    state: { get canCast() { return canCast.value; }, get castPhase() { return castPhase.value; },
      get baitPosition() { return baitPosition.value; }, get castMessage() { return castMessage.value; },
      get currentArea() { return currentArea.value; }, castTo, rejectCast },
    sceneImage: config.value?.sceneImage ?? "",
    rodImage: selectedRod.value?.image ?? "/items/rod/fishing-rob.png",
  }));

  function clearTimers() {
    clearTimeout(castTimer);
    clearTimeout(biteTimer);
    castTimer = undefined;
    biteTimer = undefined;
    generation++;
  }
  function clearFight() {
    tensionChallenge.value = null;
    tensionFight.value = null;
    tensionStartedAt.value = null;
    tensionReeling.value = false;
  }
  function stop() {
    clearTimers();
    clearFight();
    config.value = null;
    castPhase.value = "idle";
    castMessage.value = tr('tutorialSession.chon_du_trang_bi_de_bat_dau');
    baitPosition.value = { x: 56, y: 60 };
    loadout.value = {};
    equipmentConfirmed.value = false;
    inventory.value = [];
    paused.value = false;
  }
  function start(nextConfig: TutorialSessionConfig) {
    stop();
    // Each attempt owns a copy, including equipment and challenge configuration.
    config.value = JSON.parse(JSON.stringify(nextConfig)) as TutorialSessionConfig;
  }
  function selectEquipment(id: string) {
    if (!canChangeEquipment.value) return;
    const item = config.value?.equipment.find(item => item.id === id);
    if (!item) return;
    loadout.value[item.tool] = item.id;
    equipmentConfirmed.value = false;
  }
  function confirmEquipment() {
    if (!canChangeEquipment.value || !equipmentReady.value) return;
    equipmentConfirmed.value = true;
    castMessage.value = tr('tutorialSession.cham_vao_mat_nuoc_de_quang_can');
  }
  function rejectCast(message = tr('tutorialSession.chi_co_the_quang_moi_xuong_mat_nuoc')) {
    castMessage.value = message;
  }
  function castTo(x: number, y: number) {
    if (!canCast.value || !config.value) return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !isPointInWater({ x, y }, config.value.fishingBoundary)) {
      rejectCast();
      return;
    }
    clearTimers();
    clearFight();
    const attempt = generation;
    baitPosition.value = { x, y };
    castPhase.value = "casting";
    castMessage.value = tr('tutorialSession.dang_quang_can');
    castTimer = setTimeout(() => {
      if (attempt !== generation || !config.value) return;
      castPhase.value = "waiting";
      castMessage.value = tr('tutorialSession.cho_ca_can_cau_ban_co_the_thu_moi_de_chon_lai_vi_tri');
      biteTimer = setTimeout(() => {
        if (attempt !== generation || !config.value) return;
        const now = Math.floor(performance.now());
        tensionChallenge.value = {
          ...config.value.challenge,
          sessionId: `tutorial-${attempt}`,
          type: "tension-challenge", version: 1, startedAt: now, expiresAt: now + 90_000,
        };
        tensionFight.value = createTensionFight(tensionChallenge.value);
        castPhase.value = "bite";
        castMessage.value = tr('tutorialSession.ca_can_cau_giu_de_thu_day_tha_de_giam_luc_cang');
      }, config.value.waitTimeMs);
    }, 650);
  }
  function reelInBait() {
    if (!canReelIn.value) return;
    clearTimers();
    clearFight();
    castPhase.value = "idle";
    castMessage.value = tr('tutorialSession.da_thu_moi_cham_mat_nuoc_de_quang_lai');
  }
  function advanceTensionFight(now = performance.now()) {
    const challenge = tensionChallenge.value;
    const fight = tensionFight.value;
    if (paused.value || !challenge || !fight || castPhase.value !== "bite" || tensionStartedAt.value === null) return;
    const target = Math.min(tensionMaxTicks(challenge), Math.floor((now - tensionStartedAt.value) * challenge.config.tickRate / 1000));
    while (fight.tick < target && fight.result === "fighting") stepTensionFight(challenge, fight, tensionReeling.value);
    if (fight.result === "fighting") return;
    if (fight.result === "won" && config.value) {
      inventory.value.push({ ...config.value.fish });
      castPhase.value = "caught";
      castMessage.value = tr('tutorialSession.ban_da_cau_duoc_con_ca_dau_tien');
    } else {
      castPhase.value = "lost";
      castMessage.value = fight.result === "snapped" ? tr('tutorialSession.day_bi_dut_vi_luc_cang_qua_cao_tha_nut_som_hon_khi_thu_lai')
        : fight.result === "escaped" ? tr('tutorialSession.ca_thoat_vi_day_qua_chung_giu_nut_de_thu_day_khi_thu_lai')
          : tr('tutorialSession.het_thoi_gian_keo_ca_hay_thu_lai');
    }
    clearFight();
  }
  function setTensionReeling(reeling: boolean) {
    advanceTensionFight();
    if (paused.value || castPhase.value !== "bite" || !tensionChallenge.value) return;
    if (reeling && tensionStartedAt.value === null) {
      const now = performance.now();
      tensionStartedAt.value = now;
      tensionChallenge.value.startedAt = Math.floor(now);
      tensionChallenge.value.expiresAt = Math.floor(now) + 90_000;
    }
    tensionReeling.value = reeling;
  }
  function setPaused(value: boolean) {
    if (value === paused.value) return;
    if (value) advanceTensionFight();
    paused.value = value;
    tensionReeling.value = false;
    // Keep already simulated ticks when resuming a guide during a fight.
    if (!value && tensionStartedAt.value !== null && tensionFight.value && tensionChallenge.value) {
      tensionStartedAt.value = performance.now() - tensionFight.value.tick * 1000 / tensionChallenge.value.config.tickRate;
    }
  }

  return { config, castPhase, castMessage, baitPosition, loadout, equipmentConfirmed, inventory,
    tensionChallenge, tensionFight, tensionStartedAt, tensionReeling, serverClockOffset, isStartingTensionChallenge,
    paused, currentArea, equipmentReady, canCast, canReelIn, canChangeEquipment, selectedRod, sceneContext,
    start, stop, selectEquipment, confirmEquipment, castTo, rejectCast, reelInBait, advanceTensionFight, setTensionReeling, setPaused };
});
