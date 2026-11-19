<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useSpeciesInAreaStore } from "./admin-species-in-area-store.ts";
import SpeciesDistributionLake from "./SpeciesDistributionLake.vue";

const props = defineProps<{ areaId: string }>();
const store = useSpeciesInAreaStore();
const state = computed(() => store.distributions[props.areaId]);
const rows = computed(() => state.value?.rows ?? []);
const weights = computed(() => state.value?.weights ?? {});
const total = computed(() => rows.value.reduce((sum, row) => sum + (weights.value[row.speciesId] ?? 0), 0));
const valid = computed(
  () =>
    Number.isFinite(total.value) &&
    rows.value.every((row) => {
      const weight = weights.value[row.speciesId];
      return weight !== null && Number.isFinite(weight) && weight! >= 0;
    }),
);
const dirty = computed(
  () =>
    rows.value.some((row) => weights.value[row.speciesId] !== row.weightRate) ||
    JSON.stringify(state.value?.boundary) !== JSON.stringify(state.value?.originalBoundary),
);
const format = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 6 });
const percent = (id: string) =>
  valid.value && total.value > 0 ? format(((weights.value[id] ?? 0) / total.value) * 100) : "0";

function setWeight(id: string, event: Event) {
  const input = event.target as HTMLInputElement;
  store.setDistributionWeights(props.areaId, { [id]: input.value === "" ? null : input.valueAsNumber });
}
function setWeights(next: Record<string, number>) {
  store.setDistributionWeights(props.areaId, next);
}
onMounted(() => {
  void store.loadDistribution(props.areaId);
});
</script>

<template>
  <section
    class="player-popup-in w-full rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a] sm:p-4"
    :aria-busy="state?.loading || state?.saving"
  >
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="text-sm font-bold">Phân bổ loài</div>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="state?.loaded" class="text-xs"
          >{{ rows.length }} loài · Tổng tỉ trọng: {{ valid ? format(total) : "—" }}</span
        >
        <button
          type="button"
          class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          :disabled="state?.loading || state?.saving"
          @click="store.loadDistribution(areaId, true)"
        >
          Tải lại phân bổ
        </button>
      </div>
    </div>
    <div
      v-if="state?.error"
      role="alert"
      class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {{ state.error }}
    </div>
    <div v-if="!state || state.loading" class="py-8 text-center text-sm">Đang tải đầy đủ loài của bãi câu...</div>
    <div v-else-if="state.loaded && !rows.length" class="py-6 text-center text-sm">Bãi câu chưa có cấu hình loài.</div>
    <template v-else-if="state.loaded">
      <div class="flex flex-col gap-4 xl:flex-row">
        <SpeciesDistributionLake
          :rows="rows"
          :weights="weights"
          :boundary="state.boundary"
          :disabled="state.saving || !valid"
          @change="setWeights"
          @boundary-change="store.setDistributionBoundary(areaId, $event)"
        />
        <div class="min-w-0 xl:w-88 xl:shrink-0">
          <div class="max-h-96 space-y-2 overflow-auto pr-1">
            <label
              v-for="row in rows"
              :key="row.speciesId"
              class="flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-white px-2.5 py-2"
            >
              <img
                v-if="row.speciesImage"
                :src="row.speciesImage"
                alt=""
                loading="lazy"
                class="size-9 shrink-0 object-contain"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-semibold" :title="row.speciesName || ''">{{
                  row.speciesName || "Chưa đặt tên"
                }}</span>
                <span class="block text-[11px] text-[#24352a]/70">{{ percent(row.speciesId) }}%</span>
              </span>
              <input
                type="number"
                min="0"
                step="any"
                :value="weights[row.speciesId]"
                :aria-label="`Tỉ trọng ${row.speciesName || row.speciesId}`"
                :disabled="state.saving"
                class="w-28 rounded-md border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1.5 text-right text-xs focus:outline-emerald-600 disabled:opacity-50"
                @input="setWeight(row.speciesId, $event)"
              />
            </label>
          </div>
          <div class="mt-3 text-xs leading-relaxed text-[#24352a]/70">
            Tỉ trọng là giá trị tương đối, không bắt buộc tổng bằng 100. Biểu đồ luôn bao gồm mọi loài của bãi câu, kể
            cả khi danh sách đang lọc hoặc phân trang.
          </div>
          <div v-if="!valid" role="alert" class="mt-2 text-xs text-red-700">
            Tỉ trọng phải là số hữu hạn không âm và tổng phải hữu hạn.
          </div>
          <div v-else-if="total === 0" class="mt-2 text-xs text-amber-800">
            Tất cả tỉ trọng bằng 0: không có loài nào xuất hiện. Nhập tỉ trọng lớn hơn 0 để tạo vùng.
          </div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#cbd9c6] pt-3">
        <span v-if="state.saved" role="status" class="mr-auto text-xs font-semibold text-emerald-800"
          >Đã lưu phân bổ.</span
        >
        <span v-else-if="dirty" class="mr-auto text-xs text-amber-800">Có thay đổi chưa lưu</span>
        <button
          type="button"
          :disabled="!dirty || state.saving"
          class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-xs font-bold disabled:opacity-40"
          @click="store.resetDistribution(areaId)"
        >
          Hoàn tác
        </button>
        <button
          type="button"
          :disabled="!dirty || !valid || state.saving"
          class="rounded-lg bg-[#153221] px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
          @click="store.saveDistribution(areaId)"
        >
          {{ state.saving ? "Đang lưu..." : "Lưu phân bổ" }}
        </button>
      </div>
    </template>
  </section>
</template>
