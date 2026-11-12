import type { MonitorAreaRow, MonitorCurrencyRow } from "../../../types/table/adminMonitor";
import type { MonitorPlayerChange, MonitorRealtimeStatus } from "../../../types/model/adminMonitor";
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChartData } from "chart.js";
import { supabaseAdminMonitorRepository } from "../../../data/supabaseAdminMonitorRepository";

export interface AreaAttendance {
  id: string;
  title: string;
  countryId: string;
  isAvailable: boolean;
  playerCount: number;
  share: number;
}

export const useAdminMonitorStore = defineStore("admin-monitor", () => {
  const areas = ref<MonitorAreaRow[]>([]);
  const activePlayers = ref<Record<string, string>>({});
  const loading = ref(false);
  const error = ref("");
  const lastUpdatedAt = ref<string | null>(null);
  const realtimeStatus = ref<MonitorRealtimeStatus>("disconnected");
  const activeReport = ref("areas");
  const currencies = ref<MonitorCurrencyRow[]>([]);
  const currencyLoading = ref(false);
  const currencyError = ref("");
  const currencyUpdatedAt = ref<string | null>(null);

  let channel: RealtimeChannel | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let currencyRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let currencyRefreshQueued = false;
  let currencyRequestVersion = 0;
  let monitoring = false;
  let refreshQueued = false;
  let requestVersion = 0;
  let monitoringVersion = 0;
  let pendingPlayerChanges: MonitorPlayerChange[] = [];

  const playerCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const areaId of Object.values(activePlayers.value)) counts[areaId] = (counts[areaId] ?? 0) + 1;
    return counts;
  });
  const totalPlayers = computed(() => Object.values(playerCounts.value).reduce((sum, count) => sum + count, 0));
  const areaReport = computed<AreaAttendance[]>(() => {
    const knownAreas = new Map(areas.value.map((area) => [area.id, area]));
    // Preserve counts even if an area was removed or is not visible in the area query.
    const areaIds = new Set([...knownAreas.keys(), ...Object.keys(playerCounts.value)]);
    return Array.from(areaIds, (id) => {
      const area = knownAreas.get(id);
      const playerCount = playerCounts.value[id] ?? 0;
      return {
        id,
        title: area?.title?.trim() || `Bãi câu ${id.slice(0, 8)}`,
        countryId: area?.country_id ?? "—",
        isAvailable: area?.is_available ?? false,
        playerCount,
        share: totalPlayers.value ? (playerCount / totalPlayers.value) * 100 : 0,
      };
    }).sort((a, b) => b.playerCount - a.playerCount || a.title.localeCompare(b.title, "vi") || a.id.localeCompare(b.id));
  });
  const occupiedAreas = computed(() => areaReport.value.filter((area) => area.playerCount > 0));
  const busiestCount = computed(() => occupiedAreas.value[0]?.playerCount ?? 0);
  const busiestAreas = computed(() => occupiedAreas.value.filter((area) => area.playerCount === busiestCount.value));
  const chartAreas = computed(() => occupiedAreas.value.slice(0, 10));
  const chartData = computed<ChartData<"bar">>(() => ({
    labels: chartAreas.value.map((area) => area.title),
    datasets: [{
      label: "Người đang trong bãi",
      data: chartAreas.value.map((area) => area.playerCount),
      backgroundColor: chartAreas.value.map((area) => area.playerCount === busiestCount.value ? "#b45309" : "#15803d"),
      borderRadius: 6,
      maxBarThickness: 32,
    }],
  }));
  const chartHeight = computed(() => Math.max(240, chartAreas.value.length * 44 + 60));
  const lastUpdatedLabel = computed(() => lastUpdatedAt.value
    ? new Date(lastUpdatedAt.value).toLocaleTimeString("vi-VN")
    : "Chưa có dữ liệu");
  const realtimeLabel = computed(() => ({
    connecting: "Đang kết nối Realtime…",
    connected: "Realtime đã kết nối",
    disconnected: "Realtime đã ngắt · tải lại mỗi 30 giây",
    error: "Realtime gián đoạn · tải lại mỗi 30 giây",
  })[realtimeStatus.value]);
  const currencyUpdatedLabel = computed(() => currencyUpdatedAt.value
    ? new Date(currencyUpdatedAt.value).toLocaleTimeString("vi-VN")
    : "Chưa có dữ liệu");
  const reportLoading = computed(() => loading.value || currencyLoading.value);
  const currencyWallets = computed(() => currencies.value.map((wallet) => ({
    id: wallet.id,
    userId: wallet.user_id,
    cash: BigInt(wallet.cash),
    shells: BigInt(wallet.shells),
  })));
  const emptyWalletCount = computed(() => currencyWallets.value.filter((wallet) => wallet.cash === 0n && wallet.shells === 0n).length);
  const currencyReport = computed(() => ([
    { key: "cash", label: "Tiền", unit: "xu", icon: "/currency/cash.svg" },
    { key: "shells", label: "Vỏ sò", unit: "vỏ sò", icon: "/currency/shells.svg" },
  ] as const).map((currency) => {
    const holders = currencyWallets.value.filter((wallet) => wallet[currency.key] > 0n);
    return {
      ...currency,
      total: currencyWallets.value.reduce((sum, wallet) => sum + wallet[currency.key], 0n),
      holderCount: holders.length,
      topHolders: holders.sort((a, b) => {
        const difference = b[currency.key] - a[currency.key];
        return difference > 0n ? 1 : difference < 0n ? -1 : a.userId.localeCompare(b.userId);
      }).slice(0, 10).map((wallet) => ({
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet[currency.key],
      })),
    };
  }));

  function applyPlayerChange(change: MonitorPlayerChange) {
    if (change.areaId === null) delete activePlayers.value[change.id];
    else activePlayers.value[change.id] = change.areaId;
  }

  function handlePlayerChange(change: MonitorPlayerChange) {
    // Replay changes after a pending snapshot so HTTP responses cannot undo live updates.
    if (loading.value) pendingPlayerChanges.push(change);
    applyPlayerChange(change);
    if (lastUpdatedAt.value) lastUpdatedAt.value = new Date().toISOString();
  }

  function scheduleRefresh() {
    if (!monitoring || refreshTimer !== null) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refreshAreaReport();
    }, 500);
  }

  async function refreshAreaReport() {
    if (loading.value) {
      refreshQueued = true;
      return;
    }
    const version = ++requestVersion;
    pendingPlayerChanges = [];
    loading.value = true;
    error.value = "";
    try {
      const [nextAreas, players] = await Promise.all([
        supabaseAdminMonitorRepository.fetchAreas(),
        supabaseAdminMonitorRepository.fetchActivePlayers(),
      ]);
      if (version !== requestVersion) return;
      areas.value = nextAreas;
      activePlayers.value = Object.fromEntries(players.map((player) => [player.id, player.area_id]));
      for (const change of pendingPlayerChanges) applyPlayerChange(change);
      lastUpdatedAt.value = new Date().toISOString();
    } catch (cause) {
      if (version === requestVersion) {
        error.value = cause instanceof Error ? cause.message : "Không thể tải báo cáo người chơi trong bãi câu.";
      }
    } finally {
      if (version === requestVersion) {
        pendingPlayerChanges = [];
        loading.value = false;
        if (refreshQueued) {
          refreshQueued = false;
          scheduleRefresh();
        }
      }
    }
  }

  function scheduleCurrencyRefresh() {
    if (!monitoring || currencyRefreshTimer !== null) return;
    currencyRefreshTimer = setTimeout(() => {
      currencyRefreshTimer = null;
      void refreshCurrencyReport();
    }, 500);
  }

  async function refreshCurrencyReport() {
    if (currencyLoading.value) {
      currencyRefreshQueued = true;
      return;
    }
    const version = ++currencyRequestVersion;
    currencyLoading.value = true;
    currencyError.value = "";
    try {
      const wallets = await supabaseAdminMonitorRepository.fetchCurrencies();
      if (version !== currencyRequestVersion) return;
      currencies.value = wallets;
      currencyUpdatedAt.value = new Date().toISOString();
    } catch (cause) {
      if (version === currencyRequestVersion) {
        currencyError.value = cause instanceof Error ? cause.message : "Không thể tải báo cáo tiền tệ thế giới.";
      }
    } finally {
      if (version === currencyRequestVersion) {
        currencyLoading.value = false;
        if (currencyRefreshQueued) {
          currencyRefreshQueued = false;
          scheduleCurrencyRefresh();
        }
      }
    }
  }

  function handleCurrencyRefresh() {
    // A change during a paginated snapshot requires another complete snapshot.
    if (currencyLoading.value) currencyRefreshQueued = true;
    else scheduleCurrencyRefresh();
  }

  async function refresh() {
    await Promise.all([refreshAreaReport(), refreshCurrencyReport()]);
  }

  function start() {
    if (monitoring) return;
    monitoring = true;
    const version = ++monitoringVersion;
    const isCurrentSubscription = () => monitoring && version === monitoringVersion;
    realtimeStatus.value = "connecting";
    channel = supabaseAdminMonitorRepository.subscribe({
      onPlayerChange: (change) => {
        if (isCurrentSubscription()) handlePlayerChange(change);
      },
      onCurrencyRefresh: () => {
        if (isCurrentSubscription()) handleCurrencyRefresh();
      },
      onRefresh: () => {
        if (isCurrentSubscription()) scheduleRefresh();
      },
      onStatus: (status) => {
        if (isCurrentSubscription()) realtimeStatus.value = status;
      },
    });
    // Also refresh when Realtime is unavailable or a change was missed.
    pollTimer = setInterval(() => void refresh(), 30_000);
    void refresh();
  }

  function stop() {
    monitoring = false;
    monitoringVersion++;
    requestVersion++;
    currencyRequestVersion++;
    realtimeStatus.value = "disconnected";
    pendingPlayerChanges = [];
    loading.value = false;
    refreshQueued = false;
    currencyLoading.value = false;
    currencyRefreshQueued = false;
    if (pollTimer !== null) clearInterval(pollTimer);
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    if (currencyRefreshTimer !== null) clearTimeout(currencyRefreshTimer);
    pollTimer = null;
    refreshTimer = null;
    currencyRefreshTimer = null;
    if (channel) {
      void supabaseAdminMonitorRepository.unsubscribe(channel).catch((cause) => {
        console.error("Không thể ngắt cập nhật báo cáo giám sát:", cause);
      });
      channel = null;
    }
  }

  return {
    areas, activePlayers, playerCounts, loading, error, lastUpdatedAt, lastUpdatedLabel, totalPlayers, areaReport,
    realtimeStatus, realtimeLabel,
    occupiedAreas, busiestCount, busiestAreas, chartData, chartHeight,
    activeReport, currencies, currencyLoading, currencyError, currencyUpdatedAt, currencyUpdatedLabel,
    reportLoading, emptyWalletCount, currencyReport,
    start, stop, refresh,
  };
});
