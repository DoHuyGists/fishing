import { defineStore } from "pinia";
import { biteProbability, catchProbability, lakeFish, type Equipment, type Fish } from "../data/fishingLogic";
import { equipmentVariants } from "../data/equipmentCatalog";
export type FishingTool = "rod" | "line" | "reel" | "hook" | "bait";
export type CastPhase = "idle" | "casting" | "waiting" | "bite" | "fighting" | "caught" | "lost";
export type CaughtFish = {
  id: number;
  name: string;
  weight: string;
  length: string;
  rarity: string;
  image: string;
  chance: number;
};
export type FishingPlayer = {
  id: number;
  name: string;
  level: number;
  title: string;
  caughtCount: number;
  bestCatch: string;
  avatar: string;
  color: string;
};
const MAX_TENSION = 82,
  SAFE_TENSION = 28;
export const useFishingStore = defineStore("fishing", {
  state: () => ({
    selectedTool: "rod" as FishingTool,
    castPhase: "idle" as CastPhase,
    baitPosition: { x: 56, y: 60 },
    castMessage: "Sẵn sàng thả câu",
    isCasting: false,
    isPulling: false,
    tension: 0,
    catchProgress: 0,
    fightElapsed: 0,
    catchDialogOpen: false,
    bagOpen: false,
    lakeGuideOpen: false,
    activeFish: null as Fish | null,
    equipment: { rodMaxWeight: 4.5, lineMaxWeight: 4, reelWearPercent: 8, reelDurability: 1, hookStrength: 1 } as Equipment,
    equipmentLoadout: {
      rod: "rod-bamboo",
      line: "line-nylon",
      reel: "reel-basic",
      hook: "hook-standard",
      bait: "bait-worm",
    } as Record<FishingTool, string>,
    playerSkillMultiplier: 1.1,
    playersOpen: false,
    selectedPlayer: null as FishingPlayer | null,
    nearbyPlayers: [
      {
        id: 1,
        name: "Minh An",
        level: 18,
        title: "Thợ câu hồ",
        caughtCount: 42,
        bestCatch: "Cá chép 6.2 kg",
        avatar: "MA",
        color: "#d99157",
      },
      {
        id: 2,
        name: "Bảo Ngọc",
        level: 27,
        title: "Người săn cá hiếm",
        caughtCount: 108,
        bestCatch: "Cá hồi vân 8.1 kg",
        avatar: "BN",
        color: "#a783cf",
      },
      {
        id: 3,
        name: "Hải Đăng",
        level: 11,
        title: "Tân thủ",
        caughtCount: 16,
        bestCatch: "Cá rô 1.4 kg",
        avatar: "HĐ",
        color: "#59a9a0",
      },
    ] as FishingPlayer[],
    inventory: [] as CaughtFish[],
    castAttempt: 0,
  }),
  getters: {
    canPull: (s) => s.castPhase === "bite" || s.castPhase === "fighting",
    currentBait: (s) => {
      const variant = equipmentVariants.bait.find((v) => v.id === s.equipmentLoadout.bait);
      return variant?.baitName ?? "Giun đất";
    },
    tensionState: (s) => (s.tension >= MAX_TENSION - 10 ? "danger" : s.tension >= SAFE_TENSION ? "safe" : "low"),
    fishCatchChances(state): { fish: Fish; bite: number; catch: number }[] {
      return lakeFish.map((fish) => ({
        fish,
        bite: Math.round(biteProbability(fish, this.currentBait) * 100),
        catch: Math.round(catchProbability(fish, state.equipment, state.playerSkillMultiplier) * 100),
      }));
    },
  },
  actions: {
    selectTool(tool: FishingTool) {
      this.selectedTool = tool;
    },
    selectVariant(category: FishingTool, variantId: string) {
      this.equipmentLoadout[category] = variantId;
      const variant = equipmentVariants[category].find((v) => v.id === variantId);
      if (!variant) return;
      if (variant.rodMaxWeight !== undefined) this.equipment.rodMaxWeight = variant.rodMaxWeight;
      if (variant.lineMaxWeight !== undefined) this.equipment.lineMaxWeight = variant.lineMaxWeight;
      if (variant.reelDurability !== undefined) this.equipment.reelDurability = variant.reelDurability;
      if (variant.hookStrength !== undefined) this.equipment.hookStrength = variant.hookStrength;
    },
    castTo(x: number, y: number) {
      if (!(["idle", "waiting", "lost"] as CastPhase[]).includes(this.castPhase)) return;
      const attempt = ++this.castAttempt;
      this.baitPosition = { x, y };
      this.isPulling = false;
      this.tension = 0;
      this.catchProgress = 0;
      this.fightElapsed = 0;
      this.activeFish = null;
      this.isCasting = true;
      this.castPhase = "casting";
      this.castMessage = "Đang vung cần đến điểm đã chọn...";
      const fish = lakeFish[Math.floor(Math.random() * lakeFish.length)];
      const [minBiteDelay, maxBiteDelay] = fish.biteDelayRange;
      const biteDelay = minBiteDelay + Math.random() * (maxBiteDelay - minBiteDelay);
      window.setTimeout(() => {
        if (attempt !== this.castAttempt) return;
        this.castPhase = "waiting";
        this.isCasting = false;
        this.castMessage = "Đang chờ cá cắn câu...";
      }, 900);
      window.setTimeout(() => {
        if (attempt !== this.castAttempt || this.castPhase !== "waiting") return;
        this.activeFish = fish;
        this.castPhase = "bite";
        this.castMessage = `${fish.name} đang cắn câu! Chuẩn bị kéo!`;
        window.setTimeout(() => {
          if (attempt === this.castAttempt && this.castPhase === "bite") this.loseFish("Cá đã nhả mồi — bạn phản ứng quá chậm!");
        }, 3000);
      }, biteDelay);
    },
    startPull() {
      if (this.castPhase === "bite") {
        this.castPhase = "fighting";
        this.castMessage = "Giữ và buông nút kéo để canh lực";
      }
      if (this.castPhase === "fighting") this.isPulling = true;
    },
    stopPull() {
      this.isPulling = false;
    },
    updateFight(deltaMs: number) {
      if (this.castPhase !== "fighting") return;
      this.fightElapsed += deltaMs;
      this.tension = Math.max(0, Math.min(100, this.tension + (this.isPulling ? 0.055 : -0.028) * deltaMs));
      if (this.tension > MAX_TENSION) return this.loseFish();
      if (this.isPulling && this.tension >= SAFE_TENSION) {
        const resistance = this.activeFish?.resistance ?? 0;
        const resistanceRate = this.activeFish?.resistanceRate ?? 0;
        const isFishResisting = Math.floor(this.fightElapsed / 450) % 2 === 1;
        const progressChange = isFishResisting ? -resistance * resistanceRate * deltaMs : deltaMs * 0.5; // < 0.5 make fishing progress harder
        this.catchProgress = Math.max(0, Math.min(100, this.catchProgress + progressChange));
        if (this.catchProgress >= 100) this.catchFish();
      }
    },
    loseFish(message = "Dây quá căng — cá đã thoát!") {
      this.isPulling = false;
      this.castPhase = "lost";
      this.castMessage = message;
      window.setTimeout(() => {
        if (this.castPhase === "lost") {
          this.castPhase = "idle";
          this.tension = 0;
          this.catchProgress = 0;
          this.fightElapsed = 0;
          this.activeFish = null;
          this.castMessage = "Chạm mặt hồ để câu lại";
        }
      }, 1500);
    },
    catchFish() {
      const fish = this.activeFish;
      this.isPulling = false;
      if (!fish) return this.loseFish("Cá đã thoát khỏi lưỡi câu!");
      const chance = catchProbability(fish, this.equipment, this.playerSkillMultiplier);
      this.equipment.reelWearPercent = Math.min(95, this.equipment.reelWearPercent + this.equipment.reelDurability);
      if (Math.random() >= chance) return this.loseFish("Cá quá nặng, đứt dây câu!");
      this.castPhase = "caught";
      this.castMessage = "Bạn đã câu được cá!";
      this.inventory.unshift({
        id: Date.now(),
        name: fish.name,
        weight: `${fish.weight} kg`,
        length: fish.length,
        rarity: fish.rarity,
        image: fish.image,
        chance: Math.round(chance * 100),
      });
      this.catchDialogOpen = true;
    },
    closeCatchDialog() {
      this.catchDialogOpen = false;
      this.castPhase = "idle";
      this.tension = 0;
      this.catchProgress = 0;
      this.fightElapsed = 0;
      this.activeFish = null;
      this.castMessage = "Chạm mặt hồ để câu tiếp";
    },
    openBag() {
      this.bagOpen = true;
    },
    closeBag() {
      this.bagOpen = false;
    },
    openLakeGuide() {
      this.lakeGuideOpen = true;
    },
    closeLakeGuide() {
      this.lakeGuideOpen = false;
    },
    openPlayers() {
      this.playersOpen = true;
      this.selectedPlayer = null;
    },
    closePlayers() {
      this.playersOpen = false;
      this.selectedPlayer = null;
    },
    selectPlayer(player: FishingPlayer) {
      this.selectedPlayer = player;
    },
    rejectCast() {
      this.castMessage = "Chỉ có thể quăng mồi xuống mặt nước";
    },
  },
});
