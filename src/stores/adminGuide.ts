import { defineStore } from "pinia";
import { tensionGuideBaseline, tensionGuideEntries, tensionGuidePresets, type GuideSection } from "../data/tensionChallengeGuide";

const getPreset = (id: string) => tensionGuidePresets.find((preset) => preset.id === id) ?? tensionGuidePresets[0]!;

export const useAdminGuideStore = defineStore("adminGuide", {
  state: () => ({
    isOpen: false,
    topic: "tension",
    activeTab: "mechanics",
    keyword: "",
    section: "all" as "all" | GuideSection,
    selectedPresetId: "baseline",
    previewTension: 50,
    previewStamina: 100,
    previewBurst: false,
    previewReeling: true,
  }),
  getters: {
    selectedPreset: (s) => getPreset(s.selectedPresetId),
    filteredEntries: (s) => {
      const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
      const keyword = normalize(s.keyword.trim());
      return tensionGuideEntries.filter((entry) => (s.section === "all" || entry.section === s.section) &&
        (!keyword || normalize(`${entry.section} ${entry.key} ${entry.name} ${entry.meaning} ${entry.mechanism} ${entry.tuning} ${entry.example}`).includes(keyword)));
    },
    preview: (state) => {
      const { config, fish } = getPreset(state.selectedPresetId);
      const staminaFactor = config.minimumStrength + (1 - config.minimumStrength) * state.previewStamina / 100;
      // Explanatory estimate at the midpoint of the base wave, before tick rounding.
      const rawPull = fish.basePull + (state.previewBurst ? fish.burstMax : 0);
      const fishPull = rawPull * fish.baseStrength * staminaFactor * config.fishPullMultiplier;
      const playerPull = state.previewReeling ? config.reelRate : config.releaseRate;
      const delta = fishPull + playerPull;
      const slackThreshold = config.safeMin * config.slackThresholdRatio;
      const zone = state.previewTension >= config.maxTension ? "broken"
        : state.previewTension > config.safeMax ? "danger" : state.previewTension >= config.safeMin ? "safe" : "slack";
      return { staminaFactor, rawPull, fishPull, playerPull, delta, slackThreshold, zone: zone as "broken" | "danger" | "safe" | "slack",
        getsCloser: state.previewReeling && state.previewTension >= config.safeMin && zone !== "broken",
        losesStamina: zone === "safe" && state.previewStamina > 0,
        escapes: state.previewTension < slackThreshold,
        minimumReelSeconds: config.startDistance / config.reelSpeed,
      };
    },
    presetChanges: (state) => {
      const preset = getPreset(state.selectedPresetId);
      return (["config", "fish"] as const).flatMap((section) =>
        tensionGuideEntries.filter((entry) => entry.section === section).flatMap((entry) => {
          const baseline = tensionGuideBaseline[section] as Record<string, number | string>;
          const values = preset[section] as Record<string, number | string>;
          return values[entry.key] !== baseline[entry.key]
            ? [{ key: `${section}.${entry.key}`, name: entry.name, before: baseline[entry.key]!, after: values[entry.key]!, unit: entry.unit }] : [];
        }));
    },
  },
  actions: {
    open() { this.isOpen = true; },
    close() { this.isOpen = false; },
    selectPreset(id: string) {
      if (!tensionGuidePresets.some((preset) => preset.id === id)) return;
      this.selectedPresetId = id;
      this.previewTension = 50;
    },
    resetPreview() {
      this.previewTension = 50;
      this.previewStamina = 100;
      this.previewBurst = false;
      this.previewReeling = true;
    },
  },
});
