import { defineStore } from "pinia";
import type { UserProfile } from "../data/supabaseUserProfileRepository";

const REQUIRE_LEVEL = {
    faction : 1
}

export const useConfigStore = defineStore("Config", {
    state: ()=> ({
        showFaction: false,
    }),
    getters: {
        isShowFactionView: (state) => state.showFaction
    },
    actions: {
        loadConfig(userProfile: UserProfile){
            console.log(userProfile.level > REQUIRE_LEVEL.faction);
            
            if(userProfile.level > REQUIRE_LEVEL.faction) {
                this.showFaction = true;
            }
        }
    }
})