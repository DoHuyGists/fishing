import { defineStore } from "pinia";
import { supabaseUserInAreaRepository, type UserInAreaRow } from "../data/supabaseUserInAreaRepository";

export const useUserInAreaStore = defineStore("UserInArea", {
    state: ()=> ({
        userInArea: null as null | UserInAreaRow
    }),
    getters: {
        canEnterFishingArea: (state) => state.userInArea?.status == null,
    },
    actions: {
        async setCurrentUserInArea(userId: string){
            this.userInArea = await supabaseUserInAreaRepository.getCurrentUserArea(userId);
        }
    }
})