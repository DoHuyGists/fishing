<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useBadgesStore } from "../../../stores/player-badges-store";
import AchievementBadgeCard from "./AchievementBadgeCard.vue";

const badgesStore = useBadgesStore();
const emit = defineEmits<{ select: [badgeId: string]; "clear-filters": [] }>();
</script>

<template>
  <div
    v-if="badgesStore.loading"
    class="py-12 text-center text-sm text-content"
  >
    {{ tr("Achievement.dang_tai_bo_suu_tap") }}
  </div>
  <div
    v-else-if="badgesStore.error"
    role="alert"
    class="mt-4 rounded-2xl border border-danger bg-surface p-4 text-sm text-danger"
  >
    {{ tr("Achievement.khong_the_tai_huy_hieu") }} {{ badgesStore.error }}
  </div>
  <div
    v-else-if="badgesStore.collectionTotal === 0"
    class="mt-4 rounded-2xl border border-dashed border-border-default bg-surface p-8 text-center"
  >
    <span class="text-4xl" aria-hidden="true">🎣</span>
    <div class="mb-1 mt-3 text-sm font-bold text-content">
      {{ tr("Achievement.ho_so_dang_cho_dau_an_dau_tien") }}
    </div>
    <div class="m-0 text-xs text-content">
      {{ tr("Achievement.huy_hieu_se_xuat_hien_tai_day_khi_co_san_trong_tro_choi") }}
    </div>
  </div>
  <div
    v-else-if="badgesStore.badges.length === 0"
    class="mt-4 rounded-2xl border border-dashed border-border-default bg-surface p-8 text-center"
  >
    <div class="m-0 text-sm font-bold text-content">{{ tr("Achievement.khong_tim_thay_huy_hieu_phu_hop") }}</div>
    <div class="mb-3 mt-1 text-xs text-content">
      {{ tr("Achievement.thu_thay_doi_tu_khoa_hoac_bo_loc_cua_ban") }}
    </div>
    <button
      type="button"
      class="cursor-pointer rounded-full border border-border-default bg-white px-4 py-2 text-xs font-bold text-content hover:bg-surface"
      @click="emit('clear-filters')"
    >
      {{ tr("Achievement.xoa_bo_loc") }}
    </button>
  </div>
  <div v-else class="mt-3 sm:mt-4">
    <div class="mt-0 text-[10px] text-content sm:text-xs">
      {{ tr("Achievement.hien_thi") }} {{ badgesStore.badges.length }} / {{ badgesStore.collectionTotal }}
      {{ tr("Achievement.huy_hieu_2") }}
    </div>
    <div class="grid grid-cols-3 py-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      <AchievementBadgeCard
        v-for="(badge, index) in badgesStore.badges"
        :key="badge.badge_id"
        :badge="badge"
        :index="index"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
