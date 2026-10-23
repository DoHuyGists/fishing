<script lang="ts" setup>
import { computed, ref } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useBadgesStore } from "../../stores/badges";

const authStore = useAuthStore();
const badgesStore = useBadgesStore();
const selectedBadgeId = ref<string | null>(null);

const earnedBadges = computed(() => badgesStore.badges.filter((badge) => badgesStore.ownedBadgeMap.has(badge.id)));
const selectedBadge = computed(() => badgesStore.badges.find((badge) => badge.id === selectedBadgeId.value));
const completion = computed(() => badgesStore.badges.length ? Math.round(earnedBadges.value.length / badgesStore.badges.length * 100) : 0);
</script>

<template>
  <section class="mt-5 md:mt-0 md:pl-5" aria-labelledby="badges-title">
    <div class="relative isolate overflow-hidden rounded-3xl border border-[#cbd9c6] bg-linear-to-br from-[#f5f9f0] via-white to-emerald-50 p-5 shadow-sm sm:p-6">
      <div aria-hidden="true" class="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-amber-200/30 blur-3xl"></div>
      <div class="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-800">Hành trình của bạn</p>
          <h3 id="badges-title" class="mb-1 mt-1 text-xl font-black tracking-tight text-[#24352a] sm:text-2xl">Bộ sưu tập huy hiệu</h3>
          <p class="m-0 max-w-md text-xs leading-relaxed text-[#617265]">Mỗi huy hiệu là một dấu ấn trên hành trình chinh phục những vùng nước mới.</p>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 px-4 py-2.5 shadow-sm backdrop-blur">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-xl" aria-hidden="true">🏆</span>
          <div>
            <p class="m-0 text-lg font-black leading-tight text-[#24352a]">{{ earnedBadges.length }}<span class="text-sm font-semibold text-gray-400"> / {{ badgesStore.badges.length }}</span></p>
            <p class="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">đã sưu tầm</p>
          </div>
        </div>
      </div>

      <div v-if="badgesStore.badges.length" class="relative mt-5 flex items-center gap-3">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-emerald-950/10">
          <div class="h-full rounded-full bg-linear-to-r from-emerald-600 to-teal-400 transition-[width] duration-700" :style="{ width: `${completion}%` }"></div>
        </div>
        <span class="text-xs font-black tabular-nums text-emerald-800">{{ completion }}%</span>
      </div>

      <div class="relative mt-5 flex items-center justify-between gap-3 border-t border-emerald-900/10 pt-4">
        <p class="m-0 text-xs font-bold text-[#405346]">Những chiếc cúp của cần thủ</p>
        <button v-if="badgesStore.error" type="button" class="cursor-pointer text-xs font-bold text-emerald-800 underline" @click="badgesStore.fetchForUser(authStore.user?.id || '', true)">Tải lại</button>
        <div v-else class="flex rounded-full border border-emerald-900/10 bg-white/80 p-0.5 text-[10px] font-bold">
          <span class="rounded-full bg-emerald-800 px-2.5 py-1 text-white">Tất cả</span>
          <span class="px-2.5 py-1 text-gray-500">Đã đạt {{ earnedBadges.length }}</span>
        </div>
      </div>
    </div>

    <div v-if="badgesStore.loading && badgesStore.badges.length === 0" class="py-12 text-center text-sm text-gray-500">Đang tải bộ sưu tập...</div>
    <div v-else-if="badgesStore.error && badgesStore.badges.length === 0" role="alert" class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      Không thể tải huy hiệu: {{ badgesStore.error }}
    </div>
    <div v-else-if="badgesStore.badges.length === 0" class="mt-4 rounded-2xl border border-dashed border-[#cbd9c6] bg-[#f5f9f0] p-8 text-center">
      <span class="text-4xl" aria-hidden="true">🎣</span>
      <p class="mb-1 mt-3 text-sm font-bold text-[#24352a]">Hồ sơ đang chờ dấu ấn đầu tiên</p>
      <p class="m-0 text-xs text-gray-500">Huy hiệu sẽ xuất hiện tại đây khi có sẵn trong trò chơi.</p>
    </div>
    <div v-else class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <button
        v-for="(badge, index) in badgesStore.badges"
        :key="badge.id"
        type="button"
        class="group relative flex min-h-48 cursor-pointer flex-col items-center overflow-hidden rounded-2xl border p-3 text-center transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        :class="badgesStore.ownedBadgeMap.has(badge.id) ? 'border-emerald-200 bg-white hover:border-emerald-400' : 'border-[#dce4d8] bg-[#f8faf6] hover:border-emerald-200'"
        :style="{ animationDelay: `${index * 45}ms` }"
        :aria-label="`${badge.name}${badgesStore.ownedBadgeMap.has(badge.id) ? ', đã đạt' : ', chưa đạt'}. Xem chi tiết`"
        @click="selectedBadgeId = badge.id"
      >
        <span aria-hidden="true" class="absolute -right-7 -top-8 h-20 w-20 rounded-full bg-amber-100/70 blur-xl transition group-hover:bg-amber-200/80"></span>
        <span class="relative grid h-24 w-full place-items-center">
          <span class="absolute h-20 w-20 rounded-full border border-amber-200/70 bg-linear-to-br from-amber-50 to-orange-100 shadow-inner transition duration-300 group-hover:scale-110 group-hover:rotate-6"></span>
          <img v-if="badge.icon_url" :src="badge.icon_url" :alt="badge.name" loading="lazy" class="relative z-10 h-20 w-20 object-contain drop-shadow-md transition duration-300 group-hover:scale-110" :class="!badgesStore.ownedBadgeMap.has(badge.id) && 'grayscale opacity-50'" />
          <span v-else class="relative z-10 text-4xl drop-shadow-sm" :class="!badgesStore.ownedBadgeMap.has(badge.id) && 'grayscale opacity-50'" aria-hidden="true">🏅</span>
          <span v-if="badgesStore.ownedBadgeMap.has(badge.id)" class="absolute bottom-0 right-[calc(50%-2.75rem)] z-20 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-emerald-600 text-xs font-black text-white shadow" aria-label="Đã đạt">✓</span>
          <span v-else class="absolute bottom-0 right-[calc(50%-2.75rem)] z-20 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-gray-300 text-[10px] text-white" aria-hidden="true">✦</span>
        </span>
        <h4 class="relative m-0 mt-2 line-clamp-1 w-full text-xs font-extrabold text-[#24352a]" :title="badge.name">{{ badge.name }}</h4>
        <span v-if="badgesStore.ownedBadgeMap.has(badge.id)" class="relative mt-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">Đã đạt · {{ badgesStore.ownedBadgeMap.get(badge.id)?.quantity ?? 0 }} lần</span>
        <span v-else class="relative mt-2 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500">Chưa mở khóa</span>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="selectedBadge" class="fixed inset-0 z-[10002] grid place-items-center bg-[#14221a]/65 p-4 backdrop-blur-sm" @click.self="selectedBadgeId = null" @keydown.esc="selectedBadgeId = null">
        <section role="dialog" aria-modal="true" aria-labelledby="badge-detail-title" class="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/70 bg-[#f5f9f0] p-6 text-center shadow-2xl">
          <div aria-hidden="true" class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-amber-100/80 to-transparent"></div>
          <button type="button" class="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-lg text-[#405346] hover:bg-white" aria-label="Đóng chi tiết" @click="selectedBadgeId = null">×</button>
          <div class="relative mx-auto grid h-32 w-32 place-items-center rounded-full border border-amber-200 bg-linear-to-br from-amber-50 to-orange-100 shadow-inner">
            <img v-if="selectedBadge.icon_url" :src="selectedBadge.icon_url" :alt="selectedBadge.name" class="h-28 w-28 object-contain drop-shadow-lg" />
            <span v-else class="text-6xl" aria-hidden="true">🏅</span>
          </div>
          <p class="mb-1 mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">{{ badgesStore.ownedBadgeMap.has(selectedBadge.id) ? 'Dấu ấn đã chinh phục' : 'Mục tiêu tiếp theo' }}</p>
          <h4 id="badge-detail-title" class="m-0 text-xl font-black text-[#24352a]">{{ selectedBadge.name }}</h4>
          <p class="mb-0 mt-2 text-sm leading-relaxed text-[#617265]">{{ selectedBadge.description || 'Một huy hiệu đặc biệt trong hành trình câu cá của bạn.' }}</p>
          <p v-if="badgesStore.ownedBadgeMap.has(selectedBadge.id)" class="mb-0 mt-4 inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900">Đạt {{ badgesStore.ownedBadgeMap.get(selectedBadge.id)?.quantity ?? 0 }} lần</p>
          <p v-else class="mb-0 mt-4 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-gray-500">Chưa mở khóa</p>
        </section>
      </div>
    </Teleport>
  </section>
</template>
