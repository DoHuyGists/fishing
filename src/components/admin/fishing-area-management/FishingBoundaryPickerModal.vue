<script setup lang="ts">
import { ref } from "vue";

type BoundaryPoint = { x: number; y: number };

const props = defineProps<{
  sceneImageUrl: string;
  initialBoundary: BoundaryPoint[];
}>();

const emit = defineEmits<{
  close: [];
  complete: [boundary: BoundaryPoint[]];
}>();

const boundaryDraft = ref(props.initialBoundary.map(({ x, y }) => ({ x, y })));
const sceneImageError = ref(false);

function clearBoundaryPoints() {
  if (boundaryDraft.value.length <= 2) return;

  const first = boundaryDraft.value[0];
  const last = boundaryDraft.value[boundaryDraft.value.length - 1];
  boundaryDraft.value = [{ ...first }, { ...last }];
}

function clearAllBoundaryPoints() {
  boundaryDraft.value = [];
}

function addBoundaryPoint(event: MouseEvent) {
  const image = event.currentTarget as HTMLImageElement;
  const bounds = image.getBoundingClientRect();
  const point = {
    x: ((event.clientX - bounds.left) / bounds.width) * 100,
    y: ((event.clientY - bounds.top) / bounds.height) * 100,
  };
  const insertIndex = boundaryDraft.value.length - 1;
  boundaryDraft.value.splice(insertIndex, 0, point);
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fishing-boundary-picker-title"
        class="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-2xl"
      >
        <header class="flex items-center justify-between gap-3 border-b border-[#cbd9c6] px-4 py-3 sm:px-5">
          <div>
            <h2 id="fishing-boundary-picker-title" class="m-0 text-sm font-extrabold">Thiết lập vùng câu</h2>
            <p class="m-0 mt-1 text-xs text-gray-600">Nhấn vào ảnh để thêm các điểm giới hạn vùng câu.</p>
          </div>
          <button
            type="button"
            @click="emit('close')"
            aria-label="Đóng"
            class="text-xl leading-none text-gray-500 hover:text-gray-800"
          >
            &times;
          </button>
        </header>

        <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-5">
          <p v-if="sceneImageError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Không thể tải ảnh cảnh: {{ sceneImageUrl }}
          </p>
          <div v-else class="relative inline-block max-h-full max-w-full">
            <img
              :src="sceneImageUrl"
              :alt="`Cảnh câu ${sceneImageUrl}`"
              draggable="false"
              @click="addBoundaryPoint"
              @error="sceneImageError = true"
              class="block max-h-[70vh] max-w-full cursor-crosshair select-none"
            />
            <svg
              class="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon
                :points="boundaryDraft.map(({ x, y }) => `${x},${y}`).join(' ')"
                fill="rgba(34, 197, 94, 0.18)"
                stroke="rgb(252, 143, 1)"
                stroke-width="0.6"
                stroke-dasharray="2 1"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        <footer class="flex items-center justify-between gap-3 border-t border-[#cbd9c6] px-4 py-3 sm:px-5">
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-600">{{ boundaryDraft.length }} điểm</span>
            <button
              type="button"
              @click="clearBoundaryPoints"
              :disabled="boundaryDraft.length <= 2"
              class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xóa điểm giữa
            </button>
            <button
              type="button"
              @click="clearAllBoundaryPoints"
              :disabled="boundaryDraft.length === 0"
              class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xóa toàn bộ
            </button>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              @click="emit('close')"
              class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              @click="emit('complete', boundaryDraft.map(({ x, y }) => ({ x, y })))"
              :disabled="sceneImageError"
              class="rounded-lg bg-[#153221] px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hoàn tất
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
