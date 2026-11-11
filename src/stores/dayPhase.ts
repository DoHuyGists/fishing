import { t as tr } from "../i18n";
import { defineStore } from "pinia";

// 4 giai đoạn trong ngày: rạng đông, ban ngày, hoàng hôn, ban đêm
const DAY_PHASES = [
  { key: "dawn", get label() { return tr('dayPhase.sang'); }, from: 3, to: 9, icon: "/time/sunrise.png" },
  { key: "day", get label() { return tr('dayPhase.trua'); }, from: 9, to: 17, icon: "/time/noon.png" },
  { key: "dusk", get label() { return tr('dayPhase.hoang_hon'); }, from: 17, to: 19, icon: "/time/dusk.png" },
  { key: "night", get label() { return tr('dayPhase.ban_dem'); }, from: 19, to: 3, icon: "/time/night.png" },
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
            if (!fishingArea?.scenePath) {
                this.currentScenePhace = "";
                return;
            }
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
