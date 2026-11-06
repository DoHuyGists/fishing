import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useEquipmentStore } from "./equipment";
import { useUserInAreaStore } from "./userInArea";
import { useDayPhaseStore } from "./dayPhase";
import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import { supabaseFishRepository, type AreaSpeciesDiaryResponse, type FishDepthPreviewResponse } from "../data/supabaseFishRepository";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository";
import supabase from "../database/connection";
import { supabaseFishingAreaRepository } from "../data/supabaseFishingAreaRepository";
import { buildDepthConfig, DEPTH_STEP_METERS } from "../data/fishingDepth";
import { createTensionFight, isTensionChallenge, stepTensionFight, tensionMaxTicks,
  type TensionChallenge, type TensionFight, type TensionInput, type TensionSubmission } from "../data/tensionChallenge";
export type FishingTool = "rod" | "line" | "reel" | "hook" | "bait";
export type CastPhase = "idle" | "casting" | "waiting" | "bite" | "submitting" | "caught" | "lost";
export type CaughtFish = {
  id: string | number;
  name: string;
  weight: string;
  length?: string;
  image: string;
  createdAt?: string;
  isShiny?: boolean;
  variantType: "NORMAL" | "GOLDEN" | "MUTATED";
  starRating?: number;
};
export type FishingPlayer = {
  id: string | number;
  userId?: string;
  name: string;
  level: number;
  title: string;
  caughtCount: number;
  bestCatch: string;
  avatar: string;
  color: string;
  isCurrentUser?: boolean;
};

type CastRodResponse = {
  session_id: string;
  wait_time_ms: number;
  server_time_ms: number;
};

type SubmitChallengeResponse = {
  success: boolean;
  message?: string;
  caught?: {
    id: string;
    name: string;
    rarity: string;
    weight: number;
    image: string | null;
    model_3d: string | null;
    is_shiny: boolean;
    variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
    star_rating: number;
  };
};

const RPC_TIMEOUT_MS = 15_000;

function withTimeout<T>(request: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
  });

  return Promise.race([Promise.resolve(request), timeout]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

export const useFishingStore = defineStore("fishing", {
  state: () => ({
    sessionReady: false,
    sessionError: "",
    sessionRequestId: 0,
    isLeavingArea: false,
    hasLeftArea: false,
    leaveAreaError: "",
    isReleasingFish: false,
    inventoryRequestId: 0,
    playersRequestId: 0,
    inventoryError: "",
    selectedTool: "rod" as FishingTool,
    castPhase: "idle" as CastPhase,
    baitPosition: { x: 56, y: 60 },
    castMessage: "Sẵn sàng thả câu",
    isCasting: false,
    catchDialogOpen: false,
    bagOpen: false,
    lakeGuideOpen: false,
    equipmentLoadout: {
      rod: "rod-bamboo",
      line: "line-nylon",
      reel: "reel-basic",
      hook: "hook-standard",
      bait: "bait-worm",
    } as Record<FishingTool, string>,
    sessionId: null as string | null,
    tensionChallenge: null as TensionChallenge | null,
    tensionFight: null as TensionFight | null,
    tensionInputs: [] as TensionInput[],
    tensionReeling: false,
    tensionStartedAt: null as number | null,
    isStartingTensionChallenge: false,
    serverClockOffset: 0,
    isLoadingChallenge: false,
    castRequestId: 0,
    playersOpen: false,
    selectedPlayer: null as FishingPlayer | null,
    nearbyPlayers: [] as FishingPlayer[],
    isLoadingPlayers: false,
    inventory: [] as CaughtFish[],
    currentArea: {} as any,
    currentAreaId: null as string | null,
    isLoadingCurrentArea: false,
    currentAreaLoadError: "",
    currentAreaRequestId: 0,
    appliedDepthMeters: 0,
    depthAdjusterOpen: false,
    depthPreview: null as FishDepthPreviewResponse | null,
    isLoadingDepthPreview: false,
    depthPreviewError: "",
    depthPreviewRequestId: 0,
    areaSpeciesDiary: null as AreaSpeciesDiaryResponse | null,
    isLoadingAreaSpeciesDiary: false,
    areaSpeciesDiaryError: "",
    areaSpeciesDiaryRequestId: 0,
  }),
  getters: {
    canCast: (s) => s.sessionReady && !s.isLeavingArea && !s.hasLeftArea && (s.castPhase === "idle" || s.castPhase === "lost"),
    canReelIn: (s) => !s.isLeavingArea && !s.hasLeftArea && ["casting", "waiting", "bite"].includes(s.castPhase) && (!s.tensionChallenge || s.tensionStartedAt === null),
    canAdjustDepth: (s) => s.sessionReady && !s.isLeavingArea && !s.hasLeftArea && (s.castPhase === "idle" || s.castPhase === "lost"),
    canAdjustLakeDepth: (s) =>
      s.sessionReady && !s.isLeavingArea && !s.hasLeftArea &&
      (s.castPhase === "idle" || s.castPhase === "lost") &&
      !s.isLoadingCurrentArea &&
      Boolean(s.currentAreaId) && s.currentArea?.id === s.currentAreaId,
    depthConfig: (s) => buildDepthConfig(s.currentArea?.maxDepth),
  },
  actions: {
    resetSession() {
      // Keep generations increasing so late responses cannot match a later visit.
      const generations = {
        sessionRequestId: this.sessionRequestId + 1,
        castRequestId: this.castRequestId + 1,
        currentAreaRequestId: this.currentAreaRequestId + 1,
        depthPreviewRequestId: this.depthPreviewRequestId + 1,
        areaSpeciesDiaryRequestId: this.areaSpeciesDiaryRequestId + 1,
        inventoryRequestId: this.inventoryRequestId + 1,
        playersRequestId: this.playersRequestId + 1,
      };
      this.$reset();
      Object.assign(this, generations);
      useDayPhaseStore().$reset();
    },
    async initializeSession(userId: string) {
      this.resetSession();
      const requestId = this.sessionRequestId;
      try {
        const [area] = await Promise.all([
          useUserInAreaStore().setCurrentUserInArea(userId),
          useEquipmentStore().fetchEquipment(userId, true),
        ]);
        if (requestId !== this.sessionRequestId) return;
        if (useEquipmentStore().error) throw new Error(useEquipmentStore().error);
        if (area?.status !== "enter" || !area.area_id) throw new Error("Bạn chưa ở trong bãi câu.");
        await this.initializeFishingArea(area.area_id);
        if (requestId !== this.sessionRequestId) return;
        if (this.currentAreaLoadError) throw new Error(this.currentAreaLoadError);
        if (this.inventoryError) throw new Error(this.inventoryError);
        useDayPhaseStore().setCurrentScenePhase(this.currentArea);
        this.sessionReady = true;
      } catch (err) {
        if (requestId !== this.sessionRequestId) return;
        this.sessionError = err instanceof Error ? err.message : "Không thể chuẩn bị phiên câu.";
      }
    },
    async leaveFishingArea(): Promise<boolean> {
      if (this.hasLeftArea) return true;
      if (this.isLeavingArea) return false;
      this.leaveAreaError = "";
      if (this.isCasting || this.castPhase === "submitting" || this.isStartingTensionChallenge || this.isReleasingFish) {
        this.leaveAreaError = "Đang xử lý lượt câu hoặc thả cá. Vui lòng thử lại sau giây lát.";
        return false;
      }
      this.isLeavingArea = true;
      const requestId = this.sessionRequestId;
      try {
        // Read the actual bag, including fish restored after a reload or released.
        const area = await useUserInAreaStore().setCurrentUserInArea(useAuthStore().userId);
        if (requestId !== this.sessionRequestId) return false;
        if (area?.status === "enter") {
          if (!area.area_id) throw new Error("Không tìm thấy bãi câu hiện tại.");
          const fishes = await supabaseFishRepository.fetchFishingInventory(area.area_id);
          if (requestId !== this.sessionRequestId) return false;
          if (fishes.length > 0) await supabaseUserInAreaRepository.setUserLeaveArea();
          else await supabaseFishRepository.completeFishing();
        }
        if (requestId !== this.sessionRequestId) return false;
        this.hasLeftArea = true;
        this.resetCast();
        // Refresh membership explicitly; navigation must not depend on Realtime.
        await useUserInAreaStore().setCurrentUserInArea(useAuthStore().userId);
        return requestId === this.sessionRequestId;
      } catch (err) {
        if (requestId !== this.sessionRequestId) return false;
        this.leaveAreaError = err instanceof Error ? err.message : "Không thể kết thúc chuyến câu. Vui lòng thử lại.";
        return false;
      } finally {
        if (requestId === this.sessionRequestId) this.isLeavingArea = false;
      }
    },
    async initializeFishingArea(areaId: string) {
      if (!areaId) return;
      if (areaId === this.currentAreaId && this.currentArea?.id === areaId && !this.currentAreaLoadError) return;
      this.currentAreaId = areaId;
      this.currentArea = {};
      this.isLoadingCurrentArea = true;
      this.currentAreaLoadError = "";
      this.depthAdjusterOpen = false;
      const requestId = ++this.currentAreaRequestId;
      await Promise.all([
        this.fetchCurrentArea(areaId, requestId),
        this.fetchCaughtFishes(areaId),
        this.fetchPlayersInArea(areaId),
      ]);
    },
    async fetchCurrentArea(areaId: string, requestId?: number) {
      const activeRequestId = requestId ?? ++this.currentAreaRequestId;
      this.isLoadingCurrentArea = true;
      this.currentAreaLoadError = "";
      try {
        const area = await supabaseFishingAreaRepository.fetchOneAreas(areaId);
        if (activeRequestId !== this.currentAreaRequestId || areaId !== this.currentAreaId) return;
        this.currentArea = area ?? {};
        if (!area) this.currentAreaLoadError = "Không tìm thấy thông tin hồ câu.";
        this.appliedDepthMeters = Math.min(this.appliedDepthMeters, this.depthConfig.maxMeters);
      } catch (err) {
        if (activeRequestId !== this.currentAreaRequestId) return;
        this.currentAreaLoadError = err instanceof Error ? err.message : "Không thể tải thông tin hồ.";
        console.error("Lỗi khi tải thông tin hồ câu:", err);
      } finally {
        if (activeRequestId === this.currentAreaRequestId) this.isLoadingCurrentArea = false;
      }
    },
    async fetchDepthPreview(castDepth: number) {
      const requestId = ++this.depthPreviewRequestId;
      this.isLoadingDepthPreview = true;
      this.depthPreviewError = "";
      try {
        const preview = await supabaseFishRepository.previewFishByDepth(castDepth);
        if (requestId !== this.depthPreviewRequestId) return;
        this.depthPreview = preview;
      } catch (err) {
        if (requestId !== this.depthPreviewRequestId) return;
        this.depthPreview = null;
        this.depthPreviewError = err instanceof Error ? err.message : "Không thể tải dự đoán cá ở độ sâu này.";
      } finally {
        if (requestId === this.depthPreviewRequestId) this.isLoadingDepthPreview = false;
      }
    },
    async fetchAreaSpeciesDiary() {
      const requestId = ++this.areaSpeciesDiaryRequestId;
      this.isLoadingAreaSpeciesDiary = true;
      this.areaSpeciesDiaryError = "";
      try {
        const diary = await supabaseFishRepository.fetchAreaSpeciesDiary();
        if (requestId !== this.areaSpeciesDiaryRequestId) return;
        this.areaSpeciesDiary = diary;
      } catch (err) {
        if (requestId !== this.areaSpeciesDiaryRequestId) return;
        this.areaSpeciesDiary = null;
        this.areaSpeciesDiaryError = err instanceof Error ? err.message : "Không thể tải sổ tay cá trong hồ.";
      } finally {
        if (requestId === this.areaSpeciesDiaryRequestId) this.isLoadingAreaSpeciesDiary = false;
      }
    },
    async fetchPlayersInArea(areaId?: string) {
      const targetAreaId = areaId || this.currentAreaId;
      if (!targetAreaId) return;

      const requestId = ++this.playersRequestId;
      this.isLoadingPlayers = true;
      try {
        const rows = await supabaseUserInAreaRepository.fetchUsersInArea(targetAreaId);
        if (requestId !== this.playersRequestId || targetAreaId !== this.currentAreaId) return;
        if (!rows.length) {
          this.nearbyPlayers = [];
          return;
        }

        const authStore = useAuthStore();
        const currentUserId = authStore.userId;
        const userIds = rows.map((r) => r.user_id);

        const { data: catches, error: catchesError } = await supabase.from("caught").select("user_id, weight, species(name)").in("user_id", userIds);
        if (catchesError) throw catchesError;
        if (requestId !== this.playersRequestId || targetAreaId !== this.currentAreaId) return;

        const playerStats = new Map<string, { count: number; bestWeight: number; bestFishName: string }>();
        userIds.forEach((uid) => {
          playerStats.set(uid, { count: 0, bestWeight: 0, bestFishName: "" });
        });

        if (catches) {
          catches.forEach((c: any) => {
            const stat = playerStats.get(c.user_id);
            if (!stat) return;
            stat.count++;
            const weightVal = typeof c.weight === "number" ? c.weight : parseFloat(c.weight || "0");
            if (weightVal > stat.bestWeight) {
              stat.bestWeight = weightVal;
              const species = Array.isArray(c.species) ? c.species[0] : c.species;
              stat.bestFishName = species?.name || "";
            }
          });
        }

        const colors = ["#d99157", "#a783cf", "#59a9a0", "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"];

        this.nearbyPlayers = rows.map((row) => {
          const isCurrent = row.user_id === currentUserId;
          const stat = playerStats.get(row.user_id) || { count: 0, bestWeight: 0, bestFishName: "" };
          const level = Math.max(1, Math.floor(stat.count / 3) + 1);

          let title = "Tân thủ";
          if (level >= 30) title = "Huyền thoại mặt nước";
          else if (level >= 20) title = "Người săn cá hiếm";
          else if (level >= 10) title = "Thợ câu lão luyện";
          else if (level >= 5) title = "Thợ câu hồ";

          let name = "";
          let avatar = "";

          if (isCurrent) {
            const rawName = authStore.user?.user_metadata?.full_name || authStore.user?.email?.split("@")[0] || "Tôi";
            name = `${rawName} (Bạn)`;
            avatar = rawName.slice(0, 2).toUpperCase();
          } else {
            const shortId = row.user_id.slice(0, 5);
            name = `Cần thủ #${shortId}`;
            avatar = shortId.slice(0, 2).toUpperCase();
          }

          const charCodeSum = row.user_id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
          const color = colors[charCodeSum % colors.length];

          const bestCatch = stat.bestWeight > 0 ? `${stat.bestFishName} ${stat.bestWeight} kg` : "Chưa có";

          return {
            id: row.id,
            userId: row.user_id,
            name,
            level,
            title,
            caughtCount: stat.count,
            bestCatch,
            avatar,
            color,
            isCurrentUser: isCurrent,
          };
        });
      } catch (err) {
        console.error("Lỗi khi tải danh sách người chơi trong khu vực:", err);
      } finally {
        if (requestId === this.playersRequestId) this.isLoadingPlayers = false;
      }
    },
    async fetchCaughtFishes(areaId: string) {
      const requestId = ++this.inventoryRequestId;
      this.inventoryError = "";
      try {
        const rows = await supabaseFishRepository.fetchFishingInventory(areaId);
        if (requestId !== this.inventoryRequestId || areaId !== this.currentAreaId) return;
        this.inventory = rows.map((row) => {
          const species = Array.isArray(row.species) ? row.species[0] : row.species;
          return {
            id: row.id,
            name: species?.name ?? "Cá",
            weight: `${row.weight} kg`,
            variantType: row.variant_type,
            image: species?.image ?? "/fish/VN/fish.jpg",
            createdAt: row.created_at ?? undefined,
            isShiny: row.is_shiny
          };
        });
      } catch (err) {
        if (requestId !== this.inventoryRequestId) return;
        this.inventoryError = err instanceof Error ? err.message : "Không thể tải giỏ cá.";
        console.error("Lỗi khi tải danh sách cá trong túi:", err);
      }
    },
    async releaseFish(caughtId: string | number) {
      if (this.isLeavingArea || this.hasLeftArea || this.isReleasingFish) return;
      const requestId = this.sessionRequestId;
      this.isReleasingFish = true;
      this.inventoryRequestId++;
      try {
        await supabaseFishRepository.deleteCaughtFish(String(caughtId));
        if (requestId !== this.sessionRequestId) return;
        this.inventoryRequestId++;
        this.inventory = this.inventory.filter((item) => item.id !== caughtId);
      } catch (err) {
        console.error("Lỗi khi thả cá khỏi túi:", err);
        throw err;
      } finally {
        if (requestId === this.sessionRequestId) this.isReleasingFish = false;
      }
    },
    selectTool(tool: FishingTool) {
      this.selectedTool = tool;
    },
    applyDepth(depth: number) {
      if (!this.canAdjustDepth) return false;
      const step = DEPTH_STEP_METERS;
      this.appliedDepthMeters = Math.max(0, Math.min(this.depthConfig.maxMeters, Math.round(depth / step) * step));
      return true;
    },
    openDepthAdjuster() {
      if (!this.canAdjustDepth || !this.canAdjustLakeDepth) return;
      this.depthAdjusterOpen = true;
    },
    async selectVariant(category: FishingTool, variantId: string): Promise<boolean> {
      if (!this.canAdjustDepth) return false;
      const requestId = this.sessionRequestId;
      const previous = this.equipmentLoadout[category];
      this.equipmentLoadout[category] = variantId;
      try {
        await supabaseEquipmentRepository.selectItem(variantId);
        return requestId === this.sessionRequestId;
      } catch (err) {
        if (requestId !== this.sessionRequestId) return false;
        this.equipmentLoadout[category] = previous;
        console.error("Lỗi khi chọn trang bị:", err);
        return false;
      }
    },
    async castTo(x: number, y: number) {
      if (!this.canCast) {
        this.rejectCast("Hãy thu mồi trước khi quăng mồi lại");
        return;
      }
      const areaId = this.currentAreaId;
      if (!areaId) {
        this.rejectCast("Không tìm thấy bãi câu. Hãy thử vào lại khu vực.");
        return;
      }

      const bait = useEquipmentStore().variants.bait?.find((variant) => variant.id === this.equipmentLoadout.bait);
      if (!bait || (bait.quantity ?? 0) < 1) {
        this.rejectCast("Bạn đã hết mồi. Hãy chọn hoặc mua thêm mồi để quăng.");
        return;
      }

      const requestId = ++this.castRequestId;
      this.baitPosition = { x, y };
      this.catchDialogOpen = false;
      this.resetTensionChallenge();
      this.sessionId = null;
      this.isCasting = true;
      this.castPhase = "casting";
      this.castMessage = "Đang kết nối với bãi câu...";

      try {
        const data = await withTimeout(supabaseFishingAreaRepository.castRod(areaId, this.appliedDepthMeters), RPC_TIMEOUT_MS);
        if (requestId !== this.castRequestId) return;

        const response = data as unknown as CastRodResponse;
        if (!response || typeof response.session_id !== "string") {
          throw new Error("Invalid cast response");
        }

        this.sessionId = response.session_id;
        this.serverClockOffset = Number.isSafeInteger(response.server_time_ms)
          ? response.server_time_ms - performance.now() : Date.now() - performance.now();
        this.isCasting = false;
        this.castPhase = "waiting";
        this.castMessage = "Mồi đã chạm nước. Đang chờ tín hiệu...";
      } catch {
        if (requestId !== this.castRequestId) return;
        this.sessionId = null;
        this.isCasting = false;
        this.castPhase = "lost";
        this.castMessage = "Không thể kết nối. Hãy thử thả cần lại.";
      }
    },
    async startChallengeForSession(sessionId: string) {
      if (this.isLeavingArea || this.hasLeftArea) return;
      if (this.sessionId !== sessionId || this.castPhase !== "waiting" || this.isLoadingChallenge) return;
      const requestId = this.castRequestId;
      this.isLoadingChallenge = true;
      this.castMessage = "Cá cắn câu! Đang tải thử thách...";
      try {
        const session = await withTimeout(supabaseFishingAreaRepository.fetchSessionChallenge(sessionId), RPC_TIMEOUT_MS);
        if (requestId !== this.castRequestId || this.sessionId !== sessionId) return;
        if (session.status !== "BITE") throw new Error("Session is not ready");
        const challenge = session.challenge_data;
        if (!isTensionChallenge(challenge) || challenge.sessionId !== sessionId) {
          throw new Error("Invalid tension challenge data");
        }
        this.tensionChallenge = challenge;
        this.tensionFight = createTensionFight(challenge);
        this.tensionInputs = [];
        this.tensionReeling = false;
        // The scheduled bite time is not the beginning of the playable fight.
        this.tensionStartedAt = null;
        this.castMessage = "Có tín hiệu! Giữ nút hoặc Space khi sẵn sàng để thu dây.";
        this.castPhase = "bite";
      } catch {
        if (requestId !== this.castRequestId) return;
        this.sessionId = null;
        this.resetTensionChallenge();
        this.castPhase = "lost";
        this.castMessage = "Không thể tải thử thách. Hãy thả cần lại.";
      } finally {
        if (requestId === this.castRequestId) this.isLoadingChallenge = false;
      }
    },
    resetTensionChallenge() {
      this.tensionChallenge = null;
      this.tensionFight = null;
      this.tensionInputs = [];
      this.tensionReeling = false;
      this.tensionStartedAt = null;
      this.isStartingTensionChallenge = false;
      this.isLoadingChallenge = false;
    },
    async beginTensionChallenge() {
      if (this.isLeavingArea || this.hasLeftArea) return;
      this.advanceTensionFight();
      const sessionId = this.sessionId;
      if (!sessionId || !this.tensionChallenge || this.castPhase !== "bite" ||
        this.tensionStartedAt !== null || this.isStartingTensionChallenge) return;
      const requestId = this.castRequestId;
      this.isStartingTensionChallenge = true;
      this.castMessage = "Đang bắt đầu đấu sức với cá...";
      try {
        const response = await withTimeout(supabaseFishingAreaRepository.startTensionChallenge(sessionId), RPC_TIMEOUT_MS);
        if (requestId !== this.castRequestId || this.sessionId !== sessionId) return;
        if (response.resolution) {
          await this.finishChallenge(async () => response.resolution);
          return;
        }
        const challenge = response.challenge_data;
        if (!isTensionChallenge(challenge) || challenge.sessionId !== sessionId ||
          challenge.activatedAt !== challenge.startedAt || !Number.isSafeInteger(response.server_time_ms)) {
          throw new Error("Invalid activated challenge");
        }
        this.tensionChallenge = challenge;
        this.tensionFight = createTensionFight(challenge);
        this.tensionInputs = this.tensionReeling ? [{ tick: 0, reeling: true }] : [];
        // Refresh the clock at activation, not at cast. Time spent waiting for BITE
        // and loading the challenge must never be replayed as released inputs.
        this.serverClockOffset = response.server_time_ms - performance.now();
        this.tensionStartedAt = challenge.startedAt - this.serverClockOffset;
        this.castMessage = "Giữ và thả để điều chỉnh lực căng.";
      } catch (err) {
        if (requestId !== this.castRequestId || this.sessionId !== sessionId) return;
        console.error("Không thể bắt đầu thử thách lực căng:", err);
        this.sessionId = null;
        this.resetTensionChallenge();
        this.castPhase = "lost";
        this.castMessage = "Không thể bắt đầu thử thách hoặc phiên đã hết hạn. Hãy thả cần lại.";
      } finally {
        if (requestId === this.castRequestId) this.isStartingTensionChallenge = false;
      }
    },
    advanceTensionFight(now = performance.now()) {
      const challenge = this.tensionChallenge;
      const fight = this.tensionFight;
      if (!challenge || !fight || this.castPhase !== "bite") return;
      if (this.tensionStartedAt === null) {
        // The server also limits how long the player can wait before activation.
        if (now + this.serverClockOffset >= challenge.expiresAt) {
          // Invalidate any activation request still in flight as well.
          this.resetCast();
          this.castPhase = "lost";
          this.castMessage = "Đã hết thời gian bắt đầu thử thách. Cá đã thoát!";
        }
        return;
      }
      const targetTick = Math.min(tensionMaxTicks(challenge), Math.floor(((now - this.tensionStartedAt) * challenge.config.tickRate) / 1000));
      while (fight.tick < targetTick && fight.result === "fighting") {
        stepTensionFight(challenge, fight, this.tensionReeling);
      }
      if (fight.result !== "fighting") {
        void this.submitTensionChallenge({ sessionId: challenge.sessionId, inputs: this.tensionInputs.map((input) => ({ ...input })),
          totalTicks: fight.tick, claimedResult: fight.result });
      }
    },
    setTensionReeling(reeling: boolean) {
      this.advanceTensionFight();
      if (this.tensionChallenge && this.castPhase === "bite" && this.tensionStartedAt === null) {
        this.tensionReeling = reeling;
        if (reeling) void this.beginTensionChallenge();
        return;
      }
      const fight = this.tensionFight;
      if (this.castPhase !== "bite" || !fight || fight.result !== "fighting" || this.tensionReeling === reeling) return;
      this.tensionReeling = reeling;
      if (this.tensionInputs.at(-1)?.tick === fight.tick) this.tensionInputs.pop();
      if ((this.tensionInputs.at(-1)?.reeling ?? false) !== reeling) this.tensionInputs.push({ tick: fight.tick, reeling });
    },
    reelInBait() {
      if (!this.canReelIn) return;
      this.resetCast();
    },
    resetCast() {
      this.castRequestId += 1;
      this.sessionId = null;
      this.resetTensionChallenge();
      this.isCasting = false;
      this.castPhase = "idle";
      this.castMessage = "Sẵn sàng thả câu";
    },
    async submitTensionChallenge(payload: TensionSubmission) {
      if (!this.tensionChallenge || this.tensionStartedAt === null || payload.sessionId !== this.sessionId || this.castPhase !== "bite") return;
      await this.finishChallenge(() => supabaseFishingAreaRepository.submitTensionChallenge(payload));
    },
    async finishChallenge(submit: () => Promise<unknown>) {
      if (this.isLeavingArea || this.hasLeftArea) return;
      const requestId = this.castRequestId;
      this.castPhase = "submitting";
      this.castMessage = "Đang xác nhận kết quả...";

      try {
        const data = await withTimeout(submit(), RPC_TIMEOUT_MS);
        if (requestId !== this.castRequestId) return;

        const response = data as unknown as SubmitChallengeResponse;
        if (response?.success && response.caught) {
          const caught: CaughtFish = {
            id: response.caught.id,
            name: response.caught.name,
            weight: `${response.caught.weight} kg`,
            image: response.caught.image ?? "/fish/VN/fish.jpg",
            isShiny: response.caught.is_shiny,
            variantType: response.caught.variant_type,
            starRating: response.caught.star_rating,
          };
          this.inventory.unshift(caught);
          this.inventoryRequestId++;
          this.catchDialogOpen = true;
          this.castPhase = "caught";
          this.castMessage = "Bạn đã câu được cá!";
        } else {
          this.castPhase = "lost";
          this.castMessage = response?.message || "Cá đã thoát. Hãy thử lại!";
        }
        this.sessionId = null;
        this.resetTensionChallenge();
      } catch {
        if (requestId !== this.castRequestId) return;
        this.sessionId = null;
        this.resetTensionChallenge();
        this.castPhase = "lost";
        this.castMessage = "Không thể xác nhận kết quả. Hãy thử lại.";
      }
    },
    closeCatchDialog() {
      this.catchDialogOpen = false;
      this.castRequestId += 1;
      this.sessionId = null;
      this.resetTensionChallenge();
      this.castPhase = "idle";
      this.castMessage = "Chạm mặt hồ để câu tiếp";
    },
    async openBag() {
      this.bagOpen = true;
      if (this.currentAreaId) await this.fetchCaughtFishes(this.currentAreaId);
    },
    closeBag() {
      this.bagOpen = false;
    },
    openLakeGuide() {
      this.lakeGuideOpen = true;
      void this.fetchAreaSpeciesDiary();
    },
    closeLakeGuide() {
      this.lakeGuideOpen = false;
    },
    async openPlayers() {
      this.playersOpen = true;
      this.selectedPlayer = null;
      if (this.currentAreaId) {
        await this.fetchPlayersInArea(this.currentAreaId);
      }
    },
    closePlayers() {
      this.playersOpen = false;
      this.selectedPlayer = null;
    },
    selectPlayer(player: FishingPlayer) {
      this.selectedPlayer = player;
    },
    rejectCast(message = "Chỉ có thể quăng mồi xuống mặt nước") {
      this.castMessage = message;
    },
  },
});
