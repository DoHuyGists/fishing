<script setup lang="ts">
import { useLakeEditor } from '../../../composables/useLakeEditor';

const {
  MAX_ZONES, R_MIN, R_MAX, W_MIN, W_MAX, H_MIN, H_MAX,
  NODE_MIN, NODE_MAX, presets, shapeKey, size, locked, isNatural,
  naturalPts, selectedNode, canRemoveNode, removeBtnPos, lake, lakePoints, handleRight,
  handleBottom, zones, applyPreset, randomizeLake, resize, addNodeAuto, removeNode,
  onDblClick, cells, selectedId, selected, addZone, removeZone, svgRef,
  shapeMode, drag, startDrag, onMove, endDrag, radiusHandle, percentOf,
} = useLakeEditor();
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:flex-row">
    <!-- Bản đồ -->
    <div class="flex-1">
      <div class="overflow-hidden rounded-xl border border-content bg-surface shadow-sm">
        <svg
          ref="svgRef"
          viewBox="0 0 600 400"
          class="block h-auto w-full select-none"
          @pointermove="onMove"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @click="((selectedId = null), (selectedNode = null))"
          @dblclick="onDblClick"
        >
          <defs>
            <clipPath id="lake-clip-nodes">
              <polygon :points="lakePoints" />
            </clipPath>
          </defs>

          <polygon
            :points="lakePoints"
            fill="#1e5fbf"
            stroke="#f5f9f0"
            stroke-width="14"
            stroke-linejoin="round"
          />

          <g clip-path="url(#lake-clip-nodes)">
            <path
              v-for="c in cells"
              :key="c.zone.id"
              :d="c.d"
              fill-rule="evenodd"
              :fill="c.zone.color"
              :stroke="selectedId === c.zone.id ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'"
              :stroke-width="selectedId === c.zone.id ? 3.5 : 1.5"
              stroke-linejoin="round"
              class="cursor-pointer transition-opacity hover:opacity-90"
              :class="selectedId && selectedId !== c.zone.id ? 'opacity-60' : ''"
              @click.stop="selectedId = selectedId === c.zone.id ? null : c.zone.id"
            />
          </g>

          <!-- Nhãn vùng -->
          <g class="pointer-events-none" text-anchor="middle">
            <g v-for="c in cells" :key="'l-' + c.zone.id">
              <template v-if="c.hasArea">
                <text
                  :x="c.center.x"
                  :y="c.center.y"
                  font-size="12"
                  font-weight="700"
                  fill="#ffffff"
                  stroke="rgba(36, 53, 42, 0.45)"
                  stroke-width="3"
                  paint-order="stroke"
                >
                  {{ c.zone.name }}
                </text>
                <text
                  :x="c.center.x"
                  :y="c.center.y + 15"
                  font-size="11"
                  fill="#ffffff"
                  stroke="rgba(36, 53, 42, 0.45)"
                  stroke-width="3"
                  paint-order="stroke"
                >
                  {{ c.zone.note ? c.zone.note + ' · ' : '' }}{{ c.percent }}%
                </text>
              </template>
            </g>
          </g>

          <!-- Các node chỉnh sửa -->
          <g v-if="shapeMode">
            <!-- Vòng bán kính + node kéo giãn của vùng đang chọn -->
            <template v-if="selected">
              <circle
                :cx="selected.seed.x"
                :cy="selected.seed.y"
                :r="selected.r"
                fill="none"
                stroke="#ffffff"
                stroke-width="1.5"
                stroke-dasharray="5 4"
                class="pointer-events-none"
              />
              <line
                :x1="selected.seed.x"
                :y1="selected.seed.y"
                :x2="radiusHandle(selected).x"
                :y2="radiusHandle(selected).y"
                stroke="#ffffff"
                stroke-width="1.5"
                class="pointer-events-none"
              />
              <rect
                :x="radiusHandle(selected).x - 6"
                :y="radiusHandle(selected).y - 6"
                width="12"
                height="12"
                rx="2"
                fill="#ffffff"
                :stroke="selected.color"
                stroke-width="3"
                class="cursor-nwse-resize"
                style="touch-action: none"
                @click.stop
                @pointerdown.stop="startDrag(selected.id, 'radius', $event)"
              />
            </template>

            <!-- Node dời vùng -->
            <circle
              v-for="z in zones"
              :key="'h-' + z.id"
              :cx="z.seed.x"
              :cy="z.seed.y"
              r="8"
              fill="#ffffff"
              :stroke="z.color"
              stroke-width="4"
              class="cursor-grab"
              style="touch-action: none"
              @click.stop
              @pointerdown.stop="startDrag(z.id, 'seed', $event)"
            />

            <!-- Hồ tự nhiên: nhiều node trên đường bờ -->
            <template v-if="isNatural">
              <circle
                v-for="(n, i) in naturalPts"
                :key="'n-' + i"
                :cx="n.x"
                :cy="n.y"
                :r="selectedNode === i ? 8 : 6"
                :fill="selectedNode === i ? '#1e5fbf' : '#24352a'"
                stroke="#ffffff"
                stroke-width="2"
                class="cursor-move"
                style="touch-action: none"
                @click.stop
                @dblclick.stop="removeNode(i)"
                @pointerdown.stop="startDrag(String(i), 'lakeNode', $event)"
              />

              <!-- Nút "Xóa node" hiện cạnh node đang chọn -->
              <g
                v-if="removeBtnPos && selectedNode !== null && !drag"
                :transform="`translate(${removeBtnPos.x - 46}, ${removeBtnPos.y})`"
                role="button"
                tabindex="0"
                aria-label="Xóa node"
                :class="canRemoveNode ? 'cursor-pointer' : 'cursor-not-allowed'"
                @click.stop="selectedNode !== null && removeNode(selectedNode)"
                @keydown.enter.stop="selectedNode !== null && removeNode(selectedNode)"
              >
                <rect
                  width="92"
                  height="26"
                  rx="13"
                  :fill="canRemoveNode ? '#f75353' : '#24352a'"
                  stroke="#ffffff"
                  stroke-width="2"
                />
                <text
                  x="46"
                  y="17"
                  text-anchor="middle"
                  font-size="12"
                  font-weight="600"
                  fill="#ffffff"
                  class="pointer-events-none"
                >
                  {{ canRemoveNode ? 'Xóa node' : 'Tối thiểu ' + NODE_MIN }}
                </text>
              </g>
            </template>

            <!-- Các hình còn lại: 2 thanh kéo giãn biên -->
            <template v-else>
              <rect
                :x="handleRight.x - 5"
                :y="handleRight.y - 12"
                width="10"
                height="24"
                rx="4"
                fill="#24352a"
                stroke="#ffffff"
                stroke-width="2"
                class="cursor-ew-resize"
                style="touch-action: none"
                @click.stop
                @pointerdown.stop="startDrag('', 'lakeW', $event)"
              />
              <rect
                :x="handleBottom.x - 12"
                :y="handleBottom.y - 5"
                width="24"
                height="10"
                rx="4"
                fill="#24352a"
                stroke="#ffffff"
                stroke-width="2"
                class="cursor-ns-resize"
                style="touch-action: none"
                @click.stop
                @pointerdown.stop="startDrag('', 'lakeH', $event)"
              />
            </template>
          </g>
        </svg>
      </div>

      <div class="mt-2 text-xs text-content">
        Chấm tròn trắng: dời vùng. Ô vuông (khi chọn một vùng): kéo giãn diện tích. Chấm hoặc thanh đen trên bờ hồ: chỉnh hình dạng hồ.
      </div>
    </div>

    <!-- Bảng điều khiển -->
    <aside class="w-full space-y-4 lg:w-80">
      <!-- Hình dạng hồ -->
      <section class="rounded-xl border border-border bg-white p-3">
        <div class="mb-2 text-sm font-semibold text-content">Hình dạng hồ</div>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="p in presets"
            :key="p.key"
            class="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
            :class="
              shapeKey === p.key
                ? 'border-sky bg-surface text-primary'
                : 'border-border text-content hover:bg-white'
            "
            @click="applyPreset(p.key)"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <path :d="p.icon" />
            </svg>
            {{ p.label }}
          </button>

          <!-- Hình tự do không biết trước; sau đó vẫn chỉnh tiếp bằng node -->
          <button
            class="flex flex-col items-center gap-0.5 rounded-lg border border-dashed border-content px-1 py-1.5 text-[11px] text-content hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
            @click="randomizeLake"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
              <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
            Ngẫu nhiên
          </button>
        </div>

        <!-- Tự nhiên: chỉnh bằng node -->
        <div v-if="isNatural" class="mt-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-content">Số node: {{ naturalPts.length }}/{{ NODE_MAX }}</span>
            <button
              class="rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-content hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="naturalPts.length >= NODE_MAX"
              @click="addNodeAuto"
            >
              Thêm node
            </button>
          </div>
          <div class="text-xs text-content">
            Kéo chấm đen để uốn bờ hồ. Bấm vào một node để hiện nút "Xóa node" (tối thiểu {{ NODE_MIN }} node).
            Bấm đúp lên bờ để thêm node. Bấm lại "Tự nhiên" để đặt lại hình ban đầu.
          </div>
        </div>

        <!-- Các hình khác: chỉnh bằng thanh trượt -->
        <div v-else class="mt-3 space-y-2">
          <label class="block text-xs text-content">
            {{ locked ? 'Kích thước' : 'Chiều rộng' }}: {{ Math.round(size.w) }}
            <input
              type="range"
              :min="W_MIN"
              :max="locked ? H_MAX : W_MAX"
              :value="size.w"
              class="mt-1 w-full accent-primary"
              @input="resize({ w: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <label v-if="!locked" class="block text-xs text-content">
            Chiều cao: {{ Math.round(size.h) }}
            <input
              type="range"
              :min="H_MIN"
              :max="H_MAX"
              :value="size.h"
              class="mt-1 w-full accent-primary"
              @input="resize({ h: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
        </div>
      </section>

      <!-- Danh sách vùng -->
      <section class="rounded-xl border border-border bg-white p-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-sm font-semibold text-content">Các vùng ({{ zones.length }}/{{ MAX_ZONES }})</div>
          <div class="flex gap-1.5">
            <button
              class="rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
              :class="shapeMode ? 'bg-content text-white' : 'bg-surface text-content hover:bg-surface'"
              @click="shapeMode = !shapeMode"
            >
              Node
            </button>
            <button
              class="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="zones.length >= MAX_ZONES"
              @click="addZone"
            >
              Thêm vùng
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <div
            v-for="z in zones"
            :key="z.id"
            class="flex items-center gap-2 rounded-lg border px-2 py-1.5"
            :class="selectedId === z.id ? 'border-sky bg-surface' : 'border-border'"
            @click="selectedId = z.id"
          >
            <input
              v-model="z.color"
              type="color"
              class="h-6 w-6 shrink-0 cursor-pointer rounded border-0 p-0"
              aria-label="Màu vùng"
              @click.stop
            />
            <input
              v-model="z.name"
              class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-content hover:border-content focus:border-sky focus:bg-white focus:outline-none"
              aria-label="Tên vùng"
              @focus="selectedId = z.id"
              @click.stop
            />
            <span class="w-9 shrink-0 text-right text-xs tabular-nums text-content">
              {{ percentOf(z.id) }}%
            </span>
            <button
              class="shrink-0 rounded px-1.5 py-0.5 text-xs text-danger hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              aria-label="Xoá vùng"
              @click.stop="removeZone(z.id)"
            >
              Xoá
            </button>
          </div>
          <div v-if="!zones.length" class="text-sm text-content">Chưa có vùng nào. Bấm "Thêm vùng".</div>
        </div>
      </section>

      <section v-if="selected" class="space-y-3 rounded-xl border border-border bg-white p-3">
        <div class="text-sm font-semibold text-content">{{ selected.name || 'Vùng đang chọn' }}</div>
        <label class="block text-xs text-content">
          Ghi chú
          <input
            v-model="selected.note"
            class="mt-1 w-full rounded-md border border-content px-2 py-1 text-sm text-content"
          />
        </label>
        <label class="block text-xs text-content">
          Kích thước vùng
          <input
            v-model.number="selected.r"
            type="range"
            :min="R_MIN"
            :max="R_MAX"
            class="mt-1 w-full accent-primary"
          />
        </label>
        <div v-if="!percentOf(selected.id)" class="text-xs text-gold">
          Vùng này đang bị các vùng khác lấn hết. Hãy tăng kích thước hoặc dời node ra chỗ trống.
        </div>
      </section>
    </aside>
  </div>
</template>
