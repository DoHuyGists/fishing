<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useBadgesStore } from "../../stores/badges";
import Modal from "../shared/Modal.vue";
import Cash from "../currency/Cash.vue";

const badgesStore = useBadgesStore();
const selectedBadgeId = ref<string | null>(null);
const searchQuery = ref("");
const selectedType = ref("all");
const statusFilter = ref<"all" | "earned" | "unearned" | "claimable">("all");

function loadBadges() {
  badgesStore.fetchBadges();
}

onMounted(loadBadges);

const earnedBadges = computed(() => badgesStore.earnedBadges);
const selectedBadge = computed(() => badgesStore.badges.find((badge) => badge.badge_id === selectedBadgeId.value));
const completion = computed(() => badgesStore.badges.length ? Math.round(earnedBadges.value.length / badgesStore.badges.length * 100) : 0);
const badgeTypes = computed(() => [...new Set(
  badgesStore.badges
    .map((badge) => badge.type?.trim())
    .filter((type): type is string => Boolean(type)),
)].sort((a, b) => a.localeCompare(b)));
const filteredBadges = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase("vi");

  return badgesStore.badges.filter((badge) => {
    const matchesQuery = !query || [badge.name, badge.description, badge.type]
      .some((value) => value?.toLocaleLowerCase("vi").includes(query));
    const matchesType = selectedType.value === "all" || badge.type?.trim() === selectedType.value;
    const matchesStatus = statusFilter.value === "all"
      || (statusFilter.value === "earned" && badge.is_earned)
      || (statusFilter.value === "unearned" && !badge.is_earned)
      || (statusFilter.value === "claimable" && badge.can_claim);

    return matchesQuery && matchesType && matchesStatus;
  });
});

function closeDetail() {
  selectedBadgeId.value = null;
  badgesStore.claimError = "";
}

function clearFilters() {
  searchQuery.value = "";
  selectedType.value = "all";
  statusFilter.value = "all";
}
</script>

<template>
  <Modal title="Huy hiệu" :on-refresh="loadBadges">
    <section aria-labelledby="badges-title">
      <div class="relative isolate overflow-hidden rounded-2xl border border-[#cbd9c6] bg-linear-to-br from-[#f5f9f0] via-white to-emerald-50 p-3 shadow-sm sm:p-4">
        <div aria-hidden="true" class="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl"></div>
        <div class="relative flex items-center justify-between gap-2 sm:items-end sm:gap-4">
          <div>
            <p class="m-0 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800 sm:text-[10px] sm:tracking-[0.22em]">Hành trình của bạn</p>
            <h3 id="badges-title" class="mb-0 mt-0.5 text-base font-black tracking-tight text-[#24352a] sm:mt-1 sm:text-xl">Bộ sưu tập huy hiệu</h3>
            <p class="m-0 mt-0.5 hidden max-w-md text-xs leading-relaxed text-[#617265] sm:block">Mỗi huy hiệu là một dấu ấn trên hành trình chinh phục những vùng nước mới.</p>
          </div>
          <div class="flex shrink-0 items-center gap-2 rounded-xl border border-white/80 bg-white/75 px-2.5 py-1.5 shadow-sm backdrop-blur sm:gap-3 sm:px-3 sm:py-2">
            <span class="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-base sm:h-9 sm:w-9 sm:text-lg" aria-hidden="true">🏆</span>
            <div>
              <p class="m-0 text-sm font-black leading-tight text-[#24352a] sm:text-base">{{ earnedBadges.length }}<span class="text-xs font-semibold text-gray-400"> / {{ badgesStore.badges.length }}</span></p>
              <p class="m-0 text-[9px] font-bold uppercase tracking-wide text-gray-500 sm:text-[10px]">đã sưu tầm</p>
            </div>
          </div>
        </div>

        <div v-if="badgesStore.badges.length" class="relative mt-3 flex items-center gap-2 sm:mt-4 sm:gap-3">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-950/10">
            <div class="h-full rounded-full bg-linear-to-r from-emerald-600 to-teal-400 transition-[width] duration-700" :style="{ width: `${completion}%` }"></div>
          </div>
          <span class="text-[10px] font-black tabular-nums text-emerald-800 sm:text-xs">{{ completion }}%</span>
        </div>

        <div class="relative mt-3 flex flex-col gap-2 border-t border-emerald-900/10 pt-2.5 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-3">
          <p class="m-0 shrink-0 text-[10px] font-bold text-[#405346] sm:text-xs">Những chiếc cúp của cần thủ</p>
          <button v-if="badgesStore.error" type="button" class="cursor-pointer text-xs font-bold text-emerald-800 underline" @click="loadBadges">Tải lại</button>
          <div v-else class="-mx-1 flex min-w-0 gap-1 overflow-x-auto rounded-full border border-emerald-900/10 bg-white/80 p-0.5 text-[9px] font-bold sm:mx-0 sm:justify-end sm:overflow-visible sm:text-[10px]">
            <button type="button" class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5" :class="statusFilter === 'all' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'" :aria-pressed="statusFilter === 'all'" @click="statusFilter = 'all'">Tất cả</button>
            <button type="button" class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5" :class="statusFilter === 'earned' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'" :aria-pressed="statusFilter === 'earned'" @click="statusFilter = 'earned'">Đã đạt {{ earnedBadges.length }}</button>
            <button type="button" class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5" :class="statusFilter === 'unearned' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'" :aria-pressed="statusFilter === 'unearned'" @click="statusFilter = 'unearned'">Chưa đạt</button>
            <button type="button" class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5" :class="statusFilter === 'claimable' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'" :aria-pressed="statusFilter === 'claimable'" @click="statusFilter = 'claimable'">Có thưởng</button>
          </div>
        </div>
      </div>

      <div v-if="badgesStore.badges.length" class="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Tìm huy hiệu</span>
          <input v-model="searchQuery" type="search" placeholder="Tìm huy hiệu..." class="w-full rounded-lg border border-[#cbd9c6] bg-white px-2.5 py-2 text-xs text-[#24352a] outline-none placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm" />
        </label>
        <label class="w-[42%] sm:w-56">
          <span class="sr-only">Lọc theo loại huy hiệu</span>
          <select v-model="selectedType" class="w-full rounded-lg border border-[#cbd9c6] bg-white px-2 py-2 text-xs text-[#24352a] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
            <option value="all">Tất cả loại huy hiệu</option>
            <option v-for="type in badgeTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
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
      <div v-else-if="filteredBadges.length === 0" class="mt-4 rounded-2xl border border-dashed border-[#cbd9c6] bg-[#f5f9f0] p-8 text-center">
        <p class="m-0 text-sm font-bold text-[#24352a]">Không tìm thấy huy hiệu phù hợp</p>
        <p class="mb-3 mt-1 text-xs text-gray-500">Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
        <button type="button" class="cursor-pointer rounded-full border border-[#cbd9c6] bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50" @click="clearFilters">Xóa bộ lọc</button>
      </div>
      <div v-else class="mt-3 sm:mt-4">
        <p class="mb-2 mt-0 text-[10px] text-gray-500 sm:mb-3 sm:text-xs">Hiển thị {{ filteredBadges.length }} / {{ badgesStore.badges.length }} huy hiệu</p>
        <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        <button v-for="(badge, index) in filteredBadges" :key="badge.badge_id" type="button"
          class="group relative flex min-h-32 cursor-pointer flex-col items-center overflow-hidden rounded-xl border p-1.5 text-center transition duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:min-h-36 sm:rounded-2xl sm:p-2"
          :class="badge.is_earned ? 'border-emerald-200 bg-white hover:border-emerald-400' : 'border-[#dce4d8] bg-[#f8faf6] hover:border-emerald-200'" :style="{ animationDelay: `${index * 45}ms` }" :aria-label="`${badge.name}${badge.is_earned ? ', đã đạt' : ', chưa đạt'}. Xem chi tiết`"
          @click="selectedBadgeId = badge.badge_id">
          <span aria-hidden="true" class="absolute -right-7 -top-8 h-16 w-16 rounded-full bg-amber-100/70 blur-xl transition group-hover:bg-amber-200/80"></span>
          <span class="relative grid h-12 w-full place-items-center sm:h-14">
            <span class="absolute h-10 w-10 rounded-full border border-amber-200/70 bg-linear-to-br from-amber-50 to-orange-100 shadow-inner transition duration-300 group-hover:scale-110 group-hover:rotate-6 sm:h-12 sm:w-12"></span>
            <img v-if="badge.icon_url" :src="badge.icon_url" :alt="badge.name" loading="lazy" class="relative z-10 h-10 w-10 object-contain drop-shadow-md transition duration-300 group-hover:scale-110 sm:h-12 sm:w-12" :class="!badge.is_earned && 'grayscale opacity-50'" />
            <span v-else class="relative z-10 text-2xl drop-shadow-sm sm:text-3xl" :class="!badge.is_earned && 'grayscale opacity-50'" aria-hidden="true">🏅</span>
            <span v-if="badge.is_earned" class="absolute bottom-0 right-[calc(50%-1.5rem)] z-20 grid h-4 w-4 place-items-center rounded-full border border-white bg-emerald-600 text-[9px] font-black text-white shadow sm:right-[calc(50%-1.75rem)] sm:h-5 sm:w-5 sm:text-[10px]" aria-label="Đã đạt">✓</span>
            <span v-else class="absolute bottom-0 right-[calc(50%-1.5rem)] z-20 grid h-4 w-4 place-items-center rounded-full border border-white bg-gray-300 text-[8px] text-white sm:right-[calc(50%-1.75rem)] sm:h-5 sm:w-5 sm:text-[10px]" aria-hidden="true">✦</span>
          </span>
          <h4 class="relative m-0 mt-1 line-clamp-2 w-full text-[10px] font-extrabold leading-tight text-[#24352a] sm:mt-1.5 sm:text-xs" :title="badge.name">{{ badge.name }}</h4>
          <span v-if="badge.can_claim" class="relative mt-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-amber-800 sm:mt-1.5 sm:px-2 sm:text-[10px]">🎁 Nhận thưởng</span>
          <span v-else-if="badge.is_earned" class="relative mt-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-emerald-800 sm:mt-1.5 sm:px-2 sm:text-[10px]">Đạt · {{ badge.quantity }} lần</span>
          <span v-else class="relative mt-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-gray-500 sm:mt-1.5 sm:px-2 sm:text-[10px]">Chưa mở khóa</span>
        </button>
        </div>
      </div>

      <Teleport to="body">
        <div v-if="selectedBadge" class="fixed inset-0 z-[10002] grid place-items-center bg-[#14221a]/65 p-4 backdrop-blur-sm" @click.self="closeDetail" @keydown.esc="closeDetail">
          <section role="dialog" aria-modal="true" aria-labelledby="badge-detail-title" class="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/70 bg-[#f5f9f0] p-6 text-center shadow-2xl">
            <div aria-hidden="true" class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-amber-100/80 to-transparent"></div>
            <button type="button" class="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-lg text-[#405346] hover:bg-white" aria-label="Đóng chi tiết" @click="closeDetail">×</button>
            <div class="relative mx-auto grid h-32 w-32 place-items-center rounded-full border border-amber-200 bg-linear-to-br from-amber-50 to-orange-100 shadow-inner">
              <img v-if="selectedBadge.icon_url" :src="selectedBadge.icon_url" :alt="selectedBadge.name" class="h-28 w-28 object-contain drop-shadow-lg" />
              <span v-else class="text-6xl" aria-hidden="true">🏅</span>
            </div>
            <p class="mb-1 mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">{{ selectedBadge.is_earned ? 'Dấu ấn đã chinh phục' : 'Mục tiêu tiếp theo' }}</p>
            <h4 id="badge-detail-title" class="m-0 text-xl font-black text-[#24352a]">{{ selectedBadge.name }}</h4>
            <p class="mb-0 mt-2 text-sm leading-relaxed text-[#617265]">{{ selectedBadge.description || 'Một huy hiệu đặc biệt trong hành trình câu cá của bạn.' }}</p>
            <div v-if="selectedBadge.reward !== null">
              <p class="mb-0 mt-3 text-xs font-bold text-amber-800">Phần thưởng:</p>
              <div class="flex justify-center">
                <Cash :amount="selectedBadge.reward.cash" />
              </div>
            </div>
            <p v-if="selectedBadge.is_earned" class="mb-0 mt-4 inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900">Đạt {{ selectedBadge.quantity }} lần</p>
            <p v-else class="mb-0 mt-4 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-gray-500">Chưa mở khóa</p>
            <div v-if="selectedBadge.can_claim" class="mt-4">
              <button type="button" class="cursor-pointer rounded-full border border-[#cbd9c6] bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60" :disabled="!!badgesStore.claimingId"
                @click="badgesStore.claimReward(selectedBadge.badge_id)">
                {{ badgesStore.claimingId === selectedBadge.badge_id ? 'Đang nhận...' : 'Nhận thưởng' }}
              </button>
            </div>
            <p v-else-if="selectedBadge.is_claim" class="mb-0 mt-3 text-xs font-semibold text-[#617265]">Đã nhận thưởng</p>
            <p v-if="badgesStore.claimError" role="alert" class="mb-0 mt-3 text-xs text-red-700">{{ badgesStore.claimError }}</p>
          </section>
        </div>
      </Teleport>
    </section>
  </Modal>
</template>
