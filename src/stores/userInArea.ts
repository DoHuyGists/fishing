import { defineStore } from "pinia";
import { supabaseUserInAreaRepository, type UserInAreaRow } from "../data/supabaseUserInAreaRepository";

export const useUserInAreaStore = defineStore("UserInArea", {
    state: ()=> ({
        userInArea: null as null | UserInAreaRow,
        requestId: 0,
    }),
    getters: {
        canEnterFishingArea: (state) => state.userInArea?.status == null,
    },
    actions: {
        async setCurrentUserInArea(userId: string){
            const requestId = ++this.requestId;
            const area = await supabaseUserInAreaRepository.getCurrentUserArea(userId);
            if (requestId === this.requestId) this.userInArea = area;
            return area;
        }
    }
})
