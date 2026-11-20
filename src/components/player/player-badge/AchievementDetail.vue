<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { UserBadgeStatus } from "../../../types/model/badge";
import Cash from "../player-currency/Cash.vue";

defineProps<{ badge: UserBadgeStatus; claimingId: string; claimError: string }>();
const emit = defineEmits<{ close: []; claim: [badgeId: string] }>();
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[10002] grid place-items-center bg-content/65 p-4 backdrop-blur-sm"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-detail-title"
        class="player-popup-in relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/70 bg-surface p-6 text-center shadow-2xl"
      >
        <div
          aria-hidden="true"
          class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-surface/80 to-transparent"
        ></div>
        <button
          type="button"
          class="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-lg text-content hover:bg-white"
          :aria-label="tr('Achievement.dong_chi_tiet')"
          @click="emit('close')"
        >
          ×
        </button>
        <div
          class="relative mx-auto grid h-32 w-32 place-items-center rounded-full border border-gold bg-linear-to-br from-surface to-surface inset-shadow-sm"
        >
          <img
            v-if="badge.icon_url"
            :src="badge.icon_url"
            :alt="badge.name"
            class="h-28 w-28 object-contain drop-shadow-lg"
          />
          <span v-else class="text-6xl" aria-hidden="true">🏅</span>
        </div>
        <div class="mb-1 mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-content">
          {{
            badge.is_earned ? tr("Achievement.dau_an_da_chinh_phuc") : tr("Achievement.muc_tieu_tiep_theo")
          }}
        </div>
        <div id="badge-detail-title" class="m-0 text-xl font-black text-content">{{ badge.name }}</div>
        <div class="mb-0 mt-2 text-sm leading-relaxed text-content">
          {{ badge.description || tr("Achievement.mot_huy_hieu_dac_biet_trong_hanh_trinh_cau_ca_cua_ban") }}
        </div>
        <div v-if="badge.reward !== null">
          <div class="mb-0 mt-3 text-xs font-bold text-gold">{{ tr("Achievement.phan_thuong") }}</div>
          <div class="flex justify-center">
            <Cash :amount="badge.reward.cash" />
          </div>
        </div>
        <div
          v-if="badge.is_earned"
          class="mb-0 mt-4 inline-flex rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-content"
        >
          {{ tr("Achievement.dat_2") }} {{ badge.quantity }} {{ tr("Achievement.lan") }}
        </div>
        <div v-else class="mb-0 mt-4 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-content">
          {{ tr("Achievement.chua_mo_khoa") }}
        </div>
        <div v-if="badge.can_claim" class="mt-4">
          <button
            type="button"
            class="cursor-pointer rounded-full border border-border-default bg-accent px-5 py-2 text-sm font-bold text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!!claimingId"
            @click="emit('claim', badge.badge_id)"
          >
            {{
              claimingId === badge.badge_id
                ? tr("FishingPassRewards.dang_nhan")
                : tr("DailyAttendance.nhan_thuong")
            }}
          </button>
        </div>
        <div v-else-if="badge.is_claim" class="mb-0 mt-3 text-xs font-semibold text-content">
          {{ tr("Achievement.da_nhan_thuong") }}
        </div>
        <div v-if="claimError" role="alert" class="mb-0 mt-3 text-xs text-danger">
          {{ claimError }}
        </div>
      </section>
    </div>
  </Teleport>
</template>
