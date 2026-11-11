import { t as tr } from "../../i18n";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useTutorialSessionStore, type TutorialSessionConfig } from "../tutorialSession";

const lessonConfig: TutorialSessionConfig = {
  slug: "new-player-fishing",
  sceneImage: "/tutorial/new-player-fishing/scene/day.png",
  // Percent coordinates in the supplied scene: exclude sky, rocks and the shore.
  fishingBoundary: [{ x: 100, y: 100 },{ x: 0, y: 100 },{ x: 0, y: 30 },{ x: 100, y: 30 },{ x: 100, y: 100 }],
  equipment: [
    { id: "practice-rod", tool: "rod", get name() { return tr('newPlayerFishing.can_cau_tap_luyen'); }, image: "/items/rod/fishing-rob.png" },
    { id: "practice-line", tool: "line", get name() { return tr('newPlayerFishing.day_cau_tap_luyen'); }, image: "/items/line/Fishing Line.png" },
    { id: "practice-reel", tool: "reel", get name() { return tr('newPlayerFishing.may_cau_tap_luyen'); }, image: "/items/reel/Gold Spinning Reel.png" },
    { id: "practice-hook", tool: "hook", get name() { return tr('newPlayerFishing.luoi_cau_tap_luyen'); }, image: "/items/hook/Metallic Fishing Hook.png" },
    { id: "practice-bait", tool: "bait", get name() { return tr('newPlayerFishing.moi_giun_dat'); }, image: "/items/bait/Earthworm.png" },
  ],
  fish: { get name() { return tr('newPlayerFishing.ca_mu_tap_luyen'); }, image: "/fish/VN/Grouper.png", weight: 1.2 },
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
  const objectives = computed(() => [tr('EquipmentMenu.chon_trang_bi'), tr('NewPlayerFishing.quang_can'), tr('newPlayerFishing.keo_ca_len')]);
  const objectiveIndex = computed(() => objective.value === "equipment" ? 0 : objective.value === "cast" ? 1 : 2);
  const guideSteps = computed(() => {
    if (objective.value === "equipment") return [{ target: "#tutorial-equipment", get title() { return tr('newPlayerFishing.chuan_bi_bo_trang_bi'); },
      get description() { return tr('newPlayerFishing.chon_lan_luot_can_day_may_luoi_va_moi_sau_khi_chon_du_5_mon_nhan'); } }];
    if (objective.value === "fight") return [{ target: "#tutorial-tension", get title() { return tr('newPlayerFishing.giu_va_tha_de_keo_ca'); },
      get description() { return tr('newPlayerFishing.giu_nut_thu_day_hoac_phim_space_de_keo_ca_tha_khi_luc_cang_tang_'); } }];
    if (["casting", "waiting"].includes(session.castPhase)) return [{ target: "#tutorial-scene", get title() { return tr('newPlayerFishing.cho_ca_can_cau'); },
      get description() { return tr('newPlayerFishing.quan_sat_phao_tren_mat_nuoc_khi_ca_can_cau_phan_dieu_khien_giang'); } }];
    return [{ target: "#tutorial-water-target", get title() { return tr('newPlayerFishing.quang_can_xuong_mat_nuoc'); },
      get description() { return tr('newPlayerFishing.cham_vao_mat_nuoc_hoac_nhan_nut_quang_can_tranh_bau_troi_va_bo_d'); } }];
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
