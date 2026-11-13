import type { MonitorAreaRow, MonitorCurrencyRow } from "../../../types/table/adminMonitor";
import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { startVisibleRefresh } from "../../../utils/visibleRefresh";
import { createKeyedRefreshTask } from "../../../utils/refreshTask";
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

  const activeReport = ref("areas");
  const currencies = ref<MonitorCurrencyRow[]>([]);
  const currencyLoading = ref(false);
  const currencyError = ref("");
  const currencyUpdatedAt = ref<string | null>(null);

  let stopRefresh: (() => void) | null = null;
  let monitoring = false;
  let version = 0;
  const readArea = createKeyedRefreshTask<void>();
  const readCurrency = createKeyedRefreshTask<void>();

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

  async function refreshAreaReport() {
    const generation = version;
    return readArea(String(generation), async () => {
      loading.value = true;
      error.value = '';
      try {
        const [nextAreas, players] = await Promise.all([
          supabaseAdminMonitorRepository.fetchAreas(), supabaseAdminMonitorRepository.fetchActivePlayers(),
        ]);
        if (generation !== version) return;
        areas.value = nextAreas;
        activePlayers.value = Object.fromEntries(players.map(player => [player.id, player.area_id]));
        lastUpdatedAt.value = new Date().toISOString();
      } catch (cause) {
        if (generation === version) error.value = cause instanceof Error ? cause.message : 'Không thể tải báo cáo người chơi.';
      } finally { if (generation === version) loading.value = false; }
    });
  }
  async function refreshCurrencyReport() {
    const generation = version;
    return readCurrency(String(generation), async () => {
      currencyLoading.value = true;
      currencyError.value = '';
      try {
        const wallets = await supabaseAdminMonitorRepository.fetchCurrencies();
        if (generation !== version) return;
        currencies.value = wallets;
        currencyUpdatedAt.value = new Date().toISOString();
      } catch (cause) {
        if (generation === version) currencyError.value = cause instanceof Error ? cause.message : 'Không thể tải báo cáo tiền tệ.';
      } finally { if (generation === version) currencyLoading.value = false; }
    });
  }
  async function refresh() {
    if (activeReport.value === 'currency') await refreshCurrencyReport();
    else await refreshAreaReport();
  }
  function start() {
    if (monitoring) return;
    monitoring = true;
    stopRefresh = startVisibleRefresh(async () => {
      await refresh();
      const failure = activeReport.value === 'currency' ? currencyError.value : error.value;
      if (failure) throw new Error(failure);
    }, 30_000);
  }
  function stop() {
    monitoring = false;
    version++;
    stopRefresh?.(); stopRefresh = null;
    loading.value = false;
    currencyLoading.value = false;
  }
  watch(activeReport, () => { if (monitoring) void refresh(); });

  return {
    areas, activePlayers, playerCounts, loading, error, lastUpdatedAt, lastUpdatedLabel, totalPlayers, areaReport,
    occupiedAreas, busiestCount, busiestAreas, chartData, chartHeight,
    activeReport, currencies, currencyLoading, currencyError, currencyUpdatedAt, currencyUpdatedLabel,
    reportLoading, emptyWalletCount, currencyReport,
    start, stop, refresh,
  };
});
