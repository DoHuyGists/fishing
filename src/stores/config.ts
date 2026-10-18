import { defineStore } from "pinia";
import type { UserProfile } from "../data/supabaseUserProfileRepository";

const REQUIRE_LEVEL = {
    faction : 1,
    team: 1,
}

export const useConfigStore = defineStore("Config", {
    state: ()=> ({
        showFaction: false,
        showTeam: false,
    }),
    getters: {
        isShowFactionView: (state) => state.showFaction
    },
    actions: {
        loadConfig(userProfile: UserProfile){
            if(userProfile.level > REQUIRE_LEVEL.faction) {
                this.showFaction = true;
            }
            if(userProfile.level > REQUIRE_LEVEL.team) {
                this.showTeam = true;
            }
        }
    }
})