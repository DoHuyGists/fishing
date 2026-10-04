import { defineStore } from "pinia";

type ModalName =
    null |
    "account" |
    "market" |
    "diary" |
    "gacha" |
    "inventory" |
    "feedback" |
    "mission" |
    "event"

export const useModalStore = defineStore("Modal", {
    state: () => ({
        modalOpening: null as ModalName
    }),
    getters: {
       isModalOpening: (state) => state.modalOpening != null
    },
    actions: {
        open(name: ModalName) {
            this.modalOpening = name;
        },
        close() {
            this.modalOpening = null;
        },
        isOpening(name: ModalName){
            return this.modalOpening == name;
        }
    }
})