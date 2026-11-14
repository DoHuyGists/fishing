import { defineStore } from "pinia";
import { useFeatureAvailabilityStore } from "./featureAvailability";
import { modalFeatures } from "../data/featureAvailability";

const STORAGE_KEY = "fishing.modalOpening";
const modalNames = [
    "account",
    "market",
    "diary",
    "gacha",
    "inventory",
    "body",
    "feedback",
    "mission",
    "event",
    "redeem",
    "notifications",
    "caught",
    "faction",
    "friend",
    "team",
    "post-production",
    "shop",
    "prepare",
    "badge",
    "work-bench",
    "leaderboard",
    "attendance",
    "donation",
    "skill",
    "aquaculture",
    "dispatch",
    "guide",
    "rule",
    "tutorial",
] as const;

type ModalName = typeof modalNames[number] | null;

function restoreModal(): ModalName {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return modalNames.find((name) => name === saved) ?? null;
    } catch {
        // Modal controls remain available when browser storage is disabled.
        return null;
    }
}

export const useModalStore = defineStore("Modal", {
    state: () => ({
        modalOpening: restoreModal(),
        pointerPosition: { x: 0, y: 0 },
        quickActions: { visible: false, x: 0, y: 0 },
    }),
    getters: {
       isModalOpening: (state) => state.modalOpening != null
    },
    actions: {
        trackPointer(x: number, y: number) {
            this.pointerPosition = { x, y };
        },
        showQuickActions() {
            if (!this.isModalOpening) return;
            this.quickActions = {
                visible: true,
                x: Math.max(0, Math.min(this.pointerPosition.x, window.innerWidth - 112)),
                y: Math.max(0, Math.min(this.pointerPosition.y, window.innerHeight - 48)),
            };
        },
        hideQuickActions() {
            this.quickActions.visible = false;
        },
        open(name: ModalName) {
            if (name) {
                const features = useFeatureAvailabilityStore();
                const blocked = modalFeatures(name).find(key => !features.isAvailable(key));
                if (blocked) { features.notify(blocked); return false; }
            }
            this.hideQuickActions();
            this.modalOpening = name;
            try {
                if (name === null) {
                    localStorage.removeItem(STORAGE_KEY);
                } else {
                    localStorage.setItem(STORAGE_KEY, name);
                }
            } catch {
                // Keep the in-memory state if browser storage is unavailable.
            }
        },
        close() {
            this.open(null);
        },
        isOpening(name: ModalName){
            return this.modalOpening == name && (!name || useFeatureAvailabilityStore().canOpen(name));
        }
    }
})
