import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { isPointInWater, type MapPoint } from "../data/fishingMap";
import type { FishingPhase, FishingSceneContext } from "../data/fishingGameplay";
import { createTensionFight, stepTensionFight, tensionMaxTicks, type TensionChallenge, type TensionFight } from "../data/tensionChallenge";

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
  const castMessage = ref("Chọn đủ trang bị để bắt đầu.");
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
    castMessage.value = "Chọn đủ trang bị để bắt đầu.";
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
    castMessage.value = "Chạm vào mặt nước để quăng cần.";
  }
  function rejectCast(message = "Chỉ có thể quăng mồi xuống mặt nước.") {
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
    castMessage.value = "Đang quăng cần...";
    castTimer = setTimeout(() => {
      if (attempt !== generation || !config.value) return;
      castPhase.value = "waiting";
      castMessage.value = "Chờ cá cắn câu. Bạn có thể thu mồi để chọn lại vị trí.";
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
        castMessage.value = "Cá cắn câu! Giữ để thu dây, thả để giảm lực căng.";
      }, config.value.waitTimeMs);
    }, 650);
  }
  function reelInBait() {
    if (!canReelIn.value) return;
    clearTimers();
    clearFight();
    castPhase.value = "idle";
    castMessage.value = "Đã thu mồi. Chạm mặt nước để quăng lại.";
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
      castMessage.value = "Bạn đã câu được con cá đầu tiên!";
    } else {
      castPhase.value = "lost";
      castMessage.value = fight.result === "snapped" ? "Dây bị đứt vì lực căng quá cao. Thả nút sớm hơn khi thử lại."
        : fight.result === "escaped" ? "Cá thoát vì dây quá chùng. Giữ nút để thu dây khi thử lại."
          : "Hết thời gian kéo cá. Hãy thử lại!";
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
