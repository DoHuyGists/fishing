import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
import { useFishingAreaStore } from "./fishingArea";
const authStore = useAuthStore();
const fishingAreaStore = useFishingAreaStore();
export const useCaughtStore = defineStore("Caught", {
    state: () => ({
        isLoadingCaught: false,
        caughtFishes: [] as Array<{
            id: string;
            created_at: string;
            user_id: string;
            area_id: string;
            fish: any;
            areaName?: string;
        }>
    }),
    actions: {
        async loadCaughtFishes() {
            const userId = authStore.user?.id;
            if (!userId) return;
            this.isLoadingCaught = true;
            try {
                const rows = await supabaseFishRepository.fetchAllCaughtFishes(userId);
                this.caughtFishes = rows.map((row) => {
                    const area = fishingAreaStore.areas.find((a) => a.id === row.area_id);
                    return {
                        ...row,
                        areaName: area?.title ?? "Bãi câu",
                    };
                });
            } catch (err) {
                console.error("Lỗi khi tải danh sách cá:", err);
            } finally {
                this.isLoadingCaught = false;
            }
        }
    }
})