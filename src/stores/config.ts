import { defineStore } from "pinia";
import type { UserProfile } from "../data/supabaseUserProfileRepository";

export const REQUIRE_LEVEL = {
    market: 1,
    leaderboard: 2,
    gacha: 1,
    event: 1,
    team: 2,
    "work-bench": 1,
    faction: 2,
    donation: 1,
} as const;

export const useConfigStore = defineStore("Config", {
    state: () => ({ level: 0 }),
    getters: {
        requiredLevel: () => (feature: string) =>
            REQUIRE_LEVEL[feature as keyof typeof REQUIRE_LEVEL] ?? 1,
        isUnlocked(): (feature: string) => boolean {
            return (feature) => this.level >= this.requiredLevel(feature);
        },
        showFaction(): boolean { return this.isUnlocked("faction"); },
        showTeam(): boolean { return this.isUnlocked("team"); },
        showDonation(): boolean { return this.isUnlocked("donation"); },
        isShowFactionView(): boolean { return this.showFaction; },
    },
    actions: {
        loadConfig(userProfile: Pick<UserProfile, "level"> | null) {
            this.level = userProfile?.level ?? 0;
        }
    }
})
