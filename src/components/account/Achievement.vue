<script lang="ts" setup>
import { useAuthStore } from "../../stores/auth";
import { useBadgesStore } from "../../stores/badges";

const authStore = useAuthStore();
const badgesStore = useBadgesStore();
</script>

<template>
  <section class="mt-5 md:mt-0 md:pl-5" aria-labelledby="badges-title">
    <div class="flex items-center justify-between gap-2 mb-3">
      <h3 id="badges-title" class="m-0 text-sm font-bold text-[#263238]">Bộ sưu tập huy hiệu</h3>
      <button
        v-if="badgesStore.error"
        type="button"
        class="text-xs font-semibold text-emerald-700 underline cursor-pointer"
        @click="badgesStore.fetchForUser(authStore.user?.id || '', true)"
      >
        Tải lại
      </button>
    </div>

    <div v-if="badgesStore.loading && badgesStore.badges.length === 0" class="py-8 text-center text-sm text-gray-500">
      Đang tải huy hiệu...
    </div>
    <div
      v-else-if="badgesStore.error && badgesStore.badges.length === 0"
      role="alert"
      class="rounded-xl bg-red-50 p-3 text-sm text-red-700"
    >
      Không thể tải huy hiệu: {{ badgesStore.error }}
    </div>
    <div
      v-else-if="badgesStore.badges.length === 0"
      class="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500"
    >
      Chưa có huy hiệu nào.
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <article
        v-for="badge in badgesStore.badges"
        :key="badge.id"
        class="group relative z-0 min-w-0 rounded-2xl border bg-white p-3 text-center shadow-sm transition duration-200 hover:z-20 hover:-translate-y-0.5 hover:shadow-md"
        :class="
          badgesStore.ownedBadgeMap.has(badge.id)
            ? 'border-emerald-200 hover:border-emerald-300'
            : 'border-gray-200 border-dashed hover:border-gray-300'
        "
        :title="badge.description || badge.name"
      >
        <div class="relative z-0 flex h-24 items-center justify-center overflow-hidden px-2 pt-3 group-hover:overflow-visible">
          <img
            v-if="badge.icon_url"
            :src="badge.icon_url"
            :alt="badge.name"
            class="absolute left-1/2 top-0 z-10 h-32 max-w-full -translate-x-1/2 translate-y-[25%] object-contain transition-transform duration-300 ease-out group-hover:translate-y-[-25%] group-hover:scale-120"
            loading="lazy"
          />
          <span v-else aria-hidden="true" class="text-4xl">🏅</span>
        </div>
        <h4 class="m-0 mt-2 truncate text-xs font-bold text-[#263238]" :title="badge.name">{{ badge.name }}</h4>
        <p v-if="badge.description" class="m-0 mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-gray-500">
          {{ badge.description }}
        </p>
        <p v-else class="m-0 mt-1 min-h-8 text-[10px] leading-4 text-gray-400">Huy hiệu sưu tầm</p>
        <p
          v-if="badgesStore.ownedBadgeMap.has(badge.id)"
          class="m-0 mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800"
        >
          Số lần đạt: {{ badgesStore.ownedBadgeMap.get(badge.id)?.quantity ?? 0 }}
        </p>
        <p v-else class="m-0 mt-2 text-[10px] font-medium text-gray-400">Chưa sở hữu</p>
      </article>
    </div>
  </section>
</template>
