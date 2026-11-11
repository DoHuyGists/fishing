import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useTutorialSessionStore, type TutorialSessionConfig } from "../tutorialSession";

const lessonConfig: TutorialSessionConfig = {
  slug: "new-player-fishing",
  sceneImage: "/tutorial/new-player-fishing/scene/day.png",
  // Percent coordinates in the supplied scene: exclude sky, rocks and the shore.
  fishingBoundary: [{ x: 36, y: 48 }, { x: 77, y: 48 }, { x: 83, y: 53 }, { x: 99, y: 50 },
    { x: 99, y: 95 }, { x: 66, y: 95 }, { x: 56, y: 78 }, { x: 32, y: 76 }, { x: 27, y: 57 }],
  equipment: [
    { id: "practice-rod", tool: "rod", name: "Cần câu tập luyện", image: "/items/rod/fishing-rob.png" },
    { id: "practice-line", tool: "line", name: "Dây câu tập luyện", image: "/items/line/Fishing Line.png" },
    { id: "practice-reel", tool: "reel", name: "Máy câu tập luyện", image: "/items/reel/Gold Spinning Reel.png" },
    { id: "practice-hook", tool: "hook", name: "Lưỡi câu tập luyện", image: "/items/hook/Metallic Fishing Hook.png" },
    { id: "practice-bait", tool: "bait", name: "Mồi giun đất", image: "/items/bait/Earthworm.png" },
  ],
  fish: { name: "Cá mú tập luyện", image: "/fish/VN/Grouper.png", weight: 1.2 },
  waitTimeMs: 2200,
  challenge: {
    seed: 20261111,
    config: { tickRate: 30, safeMin: 20, safeMax: 75, maxTension: 100, startTension: 42,
      startDistance: 12, reelRate: 15, releaseRate: -22, reelSpeed: 1.5, slackEscapeSeconds: 8,
      slackThresholdRatio: 0.5, slackDistanceRate: 0.5, fishPullMultiplier: 1, minimumStrength: 0.35 },
    fish: { id: "practice-grouper", baseStrength: 1, burstChance: 0.08, burstMin: 2, burstMax: 5,
      staminaDrain: 0.035, basePull: 5, pullAmplitude: 2, pullPeriodTicks: 120, burstMinTicks: 15, burstMaxTicks: 35 },
  },
};

// This store owns the lesson configuration, objectives and guide progression.
export const useNewPlayerFishingStore = defineStore("tutorial-new-player-fishing", () => {
  const session = useTutorialSessionStore();
  const active = ref(false);
  const guideVisible = ref(false);
  const attempt = ref(0);
  const objective = computed(() => session.castPhase === "caught" ? "complete"
    : !session.equipmentConfirmed ? "equipment" : session.castPhase === "bite" ? "fight" : "cast");
  const objectives = ["Chọn trang bị", "Quăng cần", "Kéo cá lên"];
  const objectiveIndex = computed(() => objective.value === "equipment" ? 0 : objective.value === "cast" ? 1 : 2);
  const guideSteps = computed(() => {
    if (objective.value === "equipment") return [{ target: "#tutorial-equipment", title: "Chuẩn bị bộ trang bị",
      description: "Chọn lần lượt cần, dây, máy, lưỡi và mồi. Sau khi chọn đủ 5 món, nhấn Sẵn sàng. Trang bị tập luyện đã được cấp sẵn." }];
    if (objective.value === "fight") return [{ target: "#tutorial-tension", title: "Giữ và thả để kéo cá",
      description: "Giữ nút thu dây hoặc phím Space để kéo cá. Thả khi lực căng tăng cao. Giữ lực căng trong vùng xanh và kéo khoảng cách về 0 m. Dây quá căng sẽ đứt, quá chùng thì cá thoát." }];
    if (["casting", "waiting"].includes(session.castPhase)) return [{ target: "#tutorial-scene", title: "Chờ cá cắn câu",
      description: "Quan sát phao trên mặt nước. Khi cá cắn câu, phần điều khiển giằng co sẽ xuất hiện. Bạn cũng có thể thu mồi để quăng lại." }];
    return [{ target: "#tutorial-water-target", title: "Quăng cần xuống mặt nước",
      description: "Chạm vào mặt nước hoặc nhấn nút Quăng cần. Tránh bầu trời và bờ đá. Chờ phao báo cá cắn câu; dùng Thu mồi nếu muốn chọn lại vị trí." }];
  });

  function showGuide() {
    if (!active.value || objective.value === "complete") return;
    guideVisible.value = true;
    session.setPaused(true);
  }
  function dismissGuide() {
    guideVisible.value = false;
    session.setPaused(false);
  }
  watch(objective, (next, previous) => {
    if (!active.value) return;
    if (next === "complete") dismissGuide();
    else if (next !== previous && ["equipment", "fight"].includes(next)) showGuide();
    else if (previous === "equipment" && next === "cast") showGuide();
  }, { flush: "sync" });

  function start() {
    active.value = false;
    session.start(lessonConfig);
    attempt.value++;
    active.value = true;
    showGuide();
  }
  function stop() {
    active.value = false;
    guideVisible.value = false;
    session.stop();
  }

  return { config: lessonConfig, active, guideVisible, attempt, objective, objectives, objectiveIndex, guideSteps,
    start, stop, showGuide, dismissGuide };
});
