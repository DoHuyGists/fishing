import { defineStore } from "pinia";

// 4 giai đoạn trong ngày: rạng đông, ban ngày, hoàng hôn, ban đêm
const DAY_PHASES = [
  { key: "dawn", label: "Sáng", from: 3, to: 9, icon: "/time/sunrise.png" },
  { key: "day", label: "Trưa", from: 9, to: 17, icon: "/time/noon.png" },
  { key: "dusk", label: "Hoàng hôn", from: 17, to: 19, icon: "/time/dusk.png" },
  { key: "night", label: "Ban đêm", from: 19, to: 3, icon: "/time/night.png" },
] as const;


export const useDayPhaseStore = defineStore("DayPhase", {
    state: ()=> ({
        currentScenePhace: "",
    }),
    getters: {
        currentPhase : (_) => {
            const now = new Date();
            const hour = now.getHours();
            return (
                DAY_PHASES.find((phase) =>
                phase.from < phase.to ? hour >= phase.from && hour < phase.to : hour >= phase.from || hour < phase.to,
                ) ?? DAY_PHASES[3]
            )
        },
    },
    actions: {
        setCurrentScenePhase(fishingArea: any){
            switch (this.currentPhase.key) {
                case "dawn":
                    this.currentScenePhace = `${fishingArea.scenePath}/dawn.png`;
                    break;
                case "day":
                    this.currentScenePhace = `${fishingArea.scenePath}/day.png`;
                    break;
                case "dusk":
                    this.currentScenePhace = `${fishingArea.scenePath}/dusk.png`;
                    break;
                case "night":
                    this.currentScenePhace = `${fishingArea.scenePath}/night.png`;
                    break;
                default:
                    break;
                }
        }
    }
})