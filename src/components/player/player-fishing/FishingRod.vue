<script setup lang="ts">
import type { MapPoint } from "../../../types/model/fishingMap";
import { onMounted, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  src?: string;
  maxBend?: number;
  bendDirection?: -1 | 1;
  showLine?: boolean;
}>(), { src: "/items/rod/fishing-rob.png", maxBend: 75, bendDirection: -1, showLine: true });

const emit = defineEmits<{ "tip-change": [position: MapPoint] }>();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const tipAnchor = ref<HTMLElement | null>(null);

const BEND_START = 0.62;
const PIVOT_X = 0.49;
const TIP_Y = 0.028;
const STEP = 2;
let img: HTMLImageElement | null = null;
let pendingImage: HTMLImageElement | null = null;
let raf = 0;
let current = 0;
let lastFrame = 0;
let extraLeft = 0;
let reduceMotion = false;

function getTipPosition(): MapPoint | undefined {
  if (!img || !tipAnchor.value) return;
  const bounds = tipAnchor.value.getBoundingClientRect();
  return { x: bounds.left, y: bounds.top };
}

defineExpose({ getTipPosition });

function draw(bendDeg: number, t: number) {
  const canvas = canvasRef.value;
  const anchor = tipAnchor.value;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx || !img || !anchor) return;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const y0 = Math.round(H * BEND_START);
  const cx = W * PIVOT_X;
  ctx.drawImage(img, 0, y0, W, H - y0, extraLeft, y0, W, H - y0);

  const total = (bendDeg * Math.PI) / 180;
  let px = extraLeft + cx;
  let py = y0;
  let theta = 0;
  let srcBottom = y0;
  let tip = { x: px, y: H * TIP_Y };

  while (srcBottom > 0) {
    const s = Math.min(STEP, srcBottom);
    const sy = srcBottom - s;
    const dist = (y0 - srcBottom) / y0;
    theta += total * 2 * dist * (s / y0);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(theta);
    ctx.drawImage(img, 0, sy, W, s + 1, -cx, -s, W, s + 1);
    ctx.restore();

    // Use the same slice transform as the visible tip, including its image inset.
    const tipY = H * TIP_Y;
    if (sy <= tipY && srcBottom > tipY) {
      tip = { x: px - (tipY - srcBottom) * Math.sin(theta), y: py + (tipY - srcBottom) * Math.cos(theta) };
    }
    px += Math.sin(theta) * s;
    py -= Math.cos(theta) * s;
    srcBottom = sy;
  }

  if (props.showLine) {
    const sway = reduceMotion ? 0 : Math.sin(t * 0.004) * 6;
    const endY = H * 0.88;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo(tip.x - 4 + sway, (tip.y + endY) / 2, tip.x + sway, endY);
    ctx.strokeStyle = "rgba(36, 53, 42, 0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Update synchronously before measuring so the line and canvas share this frame.
  anchor.style.left = `${((tip.x - extraLeft) / W) * 100}%`;
  anchor.style.top = `${(tip.y / H) * 100}%`;
  const position = getTipPosition();
  if (position) emit("tip-change", position);
}

function loop(t: number) {
  const elapsed = lastFrame ? Math.min(64, t - lastFrame) : 16.67;
  lastFrame = t;
  const target = Math.max(0, props.maxBend) * props.bendDirection;
  // Time-based easing keeps flex and recovery consistent across display refresh rates.
  current += (target - current) * (1 - Math.exp(-elapsed / 110));
  if (Math.abs(current - target) < 0.01) current = target;
  draw(current, t);
  raf = requestAnimationFrame(loop);
}

function loadImage(src: string) {
  if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
  const nextImage = new Image();
  pendingImage = nextImage;
  nextImage.onload = () => {
    const canvas = canvasRef.value;
    if (!canvas || pendingImage !== nextImage) return;
    img = nextImage;
    extraLeft = Math.ceil(img.naturalHeight * BEND_START);
    // Reserve equal room on both sides so either bend direction stays visible.
    canvas.width = img.naturalWidth + extraLeft * 2;
    canvas.height = img.naturalHeight;
    // Padding must not shrink or move the original rod inside its holder.
    canvas.style.width = `${(canvas.width / img.naturalWidth) * 100}%`;
    canvas.style.left = `${(-extraLeft / img.naturalWidth) * 100}%`;
    draw(current, performance.now());
  };
  nextImage.onerror = () => {
    if (src !== "/items/rod/fishing-rob.png") loadImage("/items/rod/fishing-rob.png");
  };
  nextImage.src = src;
}

onMounted(() => {
  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  loadImage(props.src);
  raf = requestAnimationFrame(loop);
});
watch(() => props.src, loadImage);
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
  img = null;
});
</script>

<template>
  <div class="fishing-rod" aria-hidden="true">
    <canvas ref="canvasRef" class="rod-canvas" />
    <span ref="tipAnchor" class="rod-tip-anchor"></span>
  </div>
</template>

<style scoped>
.fishing-rod {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  mix-blend-mode: multiply;
  filter: drop-shadow(-5px 7px 5px color-mix(in srgb, var(--color-content) 25%, transparent));
}

.rod-canvas {
  position: absolute;
  top: 0;
  height: 100%;
  max-width: none;
}

.rod-tip-anchor {
  position: absolute;
  width: 0;
  height: 0;
}
</style>
