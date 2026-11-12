import { defineStore } from "pinia";
import { i18n, t as tr } from "../i18n";
import { FEATURE_CATALOG, modalFeatures } from "../data/featureAvailability";
import { supabaseFeatureFlagRepository as repository, type FeatureFlagRow } from "../data/supabaseFeatureFlagRepository";
import { useToast } from "../composables/useToast";
import { useInformationModalStore } from "./informationModal";
import type { RealtimeChannel } from "@supabase/supabase-js";

let channel: RealtimeChannel | null = null;
let pending: Promise<void> | null = null;
let refreshRequested = false;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let epoch = 0;
let lastNotice = "";
let lastNoticeAt = 0;

export const useFeatureAvailabilityStore = defineStore("FeatureAvailability", {
  state: () => ({
    flags: {} as Record<string, FeatureFlagRow>,
    ready: false,
    loading: false,
    error: "",
    lastFetchedAt: 0,
  }),
  getters: {
    isAvailable: state => (key: string): boolean =>
      state.ready && state.flags[key]?.enabled === true,
    canOpen(): (modal: string) => boolean {
      return modal => modalFeatures(modal).every(key => this.isAvailable(key));
    },
    reason(): (key: string) => string {
      return key => {
        if (!this.ready) return tr(this.error ? "FeatureAvailability.loadError" : "FeatureAvailability.loading");
        const flag = this.flags[key];
        const message = i18n.global.locale.value === "en" ? flag?.message_en : flag?.message_vi;
        return message?.trim() || tr("FeatureAvailability.maintenance");
      };
    },
  },
  actions: {
    showDetails(key: string) {
      const feature = FEATURE_CATALOG.find(feature => feature.key === key);
      useInformationModalStore().open({
        name: `${feature ? tr(feature.labelKey) : tr('FeatureAvailability.title')} · ${tr('FeatureAvailability.maintenanceBadge')}`,
        description: this.reason(key),
      });
    },
    async checkRequests(keys: string[]) {
      await this.load();
      const blocked = keys.find(key => !this.isAvailable(key));
      if (!blocked) return null;
      this.notify(blocked);
      return { message: this.reason(blocked), code: this.ready ? "FEATURE_DISABLED" : "FEATURE_FLAGS_UNAVAILABLE" };
    },
    handleServerDenial(key: string) {
      const flag = this.flags[key];
      if (flag) this.flags = { ...this.flags, [key]: { ...flag, enabled: false } };
      this.notify(key);
      void this.load(true);
    },
    async load(force = false) {
      if (pending) { if (force) refreshRequested = true; return pending; }
      if (!force && this.ready && Date.now() - this.lastFetchedAt < 30_000) return;
      const generation = epoch;
      this.loading = true;
      pending = (async () => {
        try {
          do {
            refreshRequested = false;
            const rows = await repository.fetchAll();
            if (generation !== epoch) return;
            if (!FEATURE_CATALOG.every(feature => rows.some(row => row.feature_key === feature.key))) {
              throw new Error("Incomplete feature flag configuration");
            }
            this.flags = Object.fromEntries(rows.map(row => [row.feature_key, row]));
            this.ready = true;
            this.error = "";
            this.lastFetchedAt = Date.now();
          } while (refreshRequested && generation === epoch);
        } catch (error) {
          if (generation === epoch) this.error = error instanceof Error ? error.message : String(error);
        } finally {
          if (generation === epoch) { this.loading = false; pending = null; }
        }
      })();
      return pending;
    },
    notify(key: string) {
      const message = this.reason(key);
      if (message === lastNotice && Date.now() - lastNoticeAt < 2500) return;
      lastNotice = message; lastNoticeAt = Date.now();
      useToast().warning(message, { title: tr("FeatureAvailability.title") });
    },
    async start() {
      if (!channel) channel = repository.subscribe(() => { void this.load(true); });
      if (!refreshTimer) refreshTimer = setInterval(() => { void this.load(true); }, 30_000);
      await this.load();
    },
    stop() {
      epoch++;
      if (channel) void repository.unsubscribe(channel);
      channel = null;
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
      pending = null;
      refreshRequested = false;
      lastNotice = "";
      this.$reset();
    },
  },
});
