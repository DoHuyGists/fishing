import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useFishingAreaStore } from "./fishingArea";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository";
import supabase from "../database/connection";
export type FishingTool = "rod" | "line" | "reel" | "hook" | "bait";
export type CastPhase = "idle" | "casting" | "waiting" | "bite" | "submitting" | "caught" | "lost";
export type FishingChallenge = {
  target_zone_start: number;
  target_zone_width: number;
  bar_speed: number;
  max_duration_ms: number;
};
export type CaughtFish = {
  id: string | number;
  name: string;
  weight: string;
  length?: string;
  rarity: string;
  image: string;
  model3d?: string;
  createdAt?: string;
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
  challenge: FishingChallenge;
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

function isFishingChallenge(value: unknown): value is FishingChallenge {
  if (!value || typeof value !== "object") return false;
  const challenge = value as FishingChallenge;
  return (
    Number.isFinite(challenge.target_zone_start) &&
    Number.isFinite(challenge.target_zone_width) &&
    Number.isFinite(challenge.bar_speed) &&
    Number.isFinite(challenge.max_duration_ms) &&
    challenge.target_zone_start >= 0 &&
    challenge.target_zone_width > 0 &&
    challenge.target_zone_start + challenge.target_zone_width <= 1 &&
    challenge.bar_speed > 0 &&
    challenge.max_duration_ms > 0
  );
}

export const useFishingStore = defineStore("fishing", {
  state: () => ({
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
    challenge: null as FishingChallenge | null,
    castRequestId: 0,
    playersOpen: false,
    selectedPlayer: null as FishingPlayer | null,
    nearbyPlayers: [] as FishingPlayer[],
    isLoadingPlayers: false,
    inventory: [] as CaughtFish[],
    currentAreaId: null as string | null,
  }),
  getters: {
    canPull: (s) => s.castPhase === "bite",
    canCast: (s) => s.castPhase === "idle" || s.castPhase === "lost",
    canReelIn: (s) => ["casting", "waiting", "bite"].includes(s.castPhase),
  },
  actions: {
    async updateCurrentAreaId(userId: string) {
      this.currentAreaId = await supabaseUserInAreaRepository.getCurrentUserArea(userId);
    },
    async initializeFishingArea(areaId: string) {
      if (!areaId) return;
      this.currentAreaId = areaId;
      await Promise.all([this.fetchCaughtFishes(), this.fetchPlayersInArea(areaId)]);
    },
    async fetchPlayersInArea(areaId?: string) {
      const targetAreaId = areaId || this.currentAreaId || useFishingAreaStore().currentArea?.id;
      if (!targetAreaId) return;

      this.isLoadingPlayers = true;
      try {
        const rows = await supabaseUserInAreaRepository.fetchUsersInArea(targetAreaId);
        if (!rows.length) {
          this.nearbyPlayers = [];
          return;
        }

        const authStore = useAuthStore();
        const currentUserId = authStore.userId;
        const userIds = rows.map((r) => r.user_id);

        const { data: catches, error: catchesError } = await supabase.from("caught").select("user_id, weight, species(name)").in("user_id", userIds);
        if (catchesError) throw catchesError;

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
        this.isLoadingPlayers = false;
      }
    },
    async fetchCaughtFishes(userId?: string) {
      const authStore = useAuthStore();
      const targetUserId = userId || authStore.userId;
      if (!targetUserId) return;

      try {
        const rows = await supabaseFishRepository.fetchFishingInventory(targetUserId);
        this.inventory = rows.map((row) => {
          const species = Array.isArray(row.species) ? row.species[0] : row.species;
          return {
            id: row.id,
            name: species?.name ?? "Cá",
            weight: `${row.weight} kg`,
            rarity: species?.rarity ?? "Chưa rõ",
            image: species?.image ?? "/fish/VN/fish.jpg",
            model3d: species?.["3d"] ?? undefined,
            createdAt: row.created_at ?? undefined,
          };
        });
      } catch (err) {
        console.error("Lỗi khi tải danh sách cá trong túi:", err);
      }
    },
    async releaseFish(caughtId: string | number) {
      try {
        await supabaseFishRepository.deleteCaughtFish(String(caughtId));
        this.inventory = this.inventory.filter((item) => item.id !== caughtId);
      } catch (err) {
        console.error("Lỗi khi thả cá khỏi túi:", err);
        throw err;
      }
    },
    selectTool(tool: FishingTool) {
      this.selectedTool = tool;
    },
    selectVariant(category: FishingTool, variantId: string) {
      this.equipmentLoadout[category] = variantId;
    },
    async castTo(x: number, y: number) {
      if (!this.canCast) {
        this.rejectCast("Hãy thu mồi trước khi quăng mồi lại");
        return;
      }
      const areaId = this.currentAreaId || useFishingAreaStore().currentArea?.id;
      if (!areaId) {
        this.rejectCast("Không tìm thấy bãi câu. Hãy thử vào lại khu vực.");
        return;
      }

      const requestId = ++this.castRequestId;
      this.baitPosition = { x, y };
      this.catchDialogOpen = false;
      this.challenge = null;
      this.sessionId = null;
      this.isCasting = true;
      this.castPhase = "casting";
      this.castMessage = "Đang kết nối với bãi câu...";

      try {
        const { data, error } = await withTimeout(supabase.rpc("cast_rod", { p_area_id: areaId }), RPC_TIMEOUT_MS);
        if (requestId !== this.castRequestId) return;
        if (error) throw error;

        const response = data as unknown as CastRodResponse;
        if (!response || typeof response.session_id !== "string" || !Number.isFinite(response.wait_time_ms) || response.wait_time_ms < 0 || !isFishingChallenge(response.challenge)) {
          throw new Error("Invalid cast response");
        }

        this.sessionId = response.session_id;
        this.challenge = response.challenge;
        this.isCasting = false;
        this.castPhase = "waiting";
        this.castMessage = "Mồi đã chạm nước. Đang chờ tín hiệu...";
        window.setTimeout(() => {
          if (requestId !== this.castRequestId || !this.sessionId) return;
          this.castPhase = "bite";
          this.castMessage = "Tín hiệu! Bấm đúng lúc để móc cá.";
        }, response.wait_time_ms);
      } catch {
        if (requestId !== this.castRequestId) return;
        this.sessionId = null;
        this.challenge = null;
        this.isCasting = false;
        this.castPhase = "lost";
        this.castMessage = "Không thể kết nối. Hãy thử thả cần lại.";
      }
    },
    reelInBait() {
      if (!this.canReelIn) return;
      this.castRequestId += 1;
      this.sessionId = null;
      this.challenge = null;
      this.isCasting = false;
      this.castPhase = "idle";
      this.castMessage = "Sẵn sàng thả câu";
    },
    async submitChallenge(isSuccess: boolean, timeSpentMs: number) {
      if (!this.sessionId || !this.challenge || this.castPhase !== "bite") return;

      const sessionId = this.sessionId;
      const requestId = this.castRequestId;
      this.castPhase = "submitting";
      this.castMessage = "Đang xác nhận kết quả...";

      try {
        const { data, error } = await withTimeout(
          supabase.rpc("submit_challenge", {
            p_session_id: sessionId,
            p_success: isSuccess,
            p_time_spent_ms: Math.max(0, Math.round(timeSpentMs)),
          }),
          RPC_TIMEOUT_MS,
        );
        if (requestId !== this.castRequestId) return;
        if (error) throw error;

        const response = data as unknown as SubmitChallengeResponse;
        if (response?.success && response.caught) {
          const caught: CaughtFish = {
            id: response.caught.id,
            name: response.caught.name,
            rarity: response.caught.rarity,
            weight: `${response.caught.weight} kg`,
            image: response.caught.image ?? "/fish/VN/fish.jpg",
            model3d: response.caught.model_3d ?? undefined,
          };
          this.inventory.unshift(caught);
          this.catchDialogOpen = true;
          this.castPhase = "caught";
          this.castMessage = "Bạn đã câu được cá!";
        } else {
          this.castPhase = "lost";
          this.castMessage = response?.message || "Cá đã thoát. Hãy thử lại!";
        }
        this.sessionId = null;
        this.challenge = null;
      } catch {
        if (requestId !== this.castRequestId) return;
        this.sessionId = null;
        this.challenge = null;
        this.castPhase = "lost";
        this.castMessage = "Không thể xác nhận kết quả. Hãy thử lại.";
      }
    },
    closeCatchDialog() {
      this.catchDialogOpen = false;
      this.castRequestId += 1;
      this.sessionId = null;
      this.challenge = null;
      this.castPhase = "idle";
      this.castMessage = "Chạm mặt hồ để câu tiếp";
    },
    async openBag() {
      this.bagOpen = true;
      await this.fetchCaughtFishes();
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
