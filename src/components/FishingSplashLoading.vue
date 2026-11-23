<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { t as tr } from "../i18n";

interface Props {
  /** Cá tự động quẫy theo chu kỳ ngẫu nhiên */
  autoplay?: boolean;
  /** Tần suất quẫy: 0.5 (thưa) – 2 (dồn dập) */
  intensity?: number;
  /** Vị trí lưỡi câu theo tỉ lệ chiều rộng / cao (0–1) */
  hookX?: number;
  hookY?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  intensity: 1,
  hookX: 0.46,
  hookY: 0.6,
});

interface Ripple {
  x: number;
  y: number;
  r: number;
  max: number;
  speed: number;
  width: number;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ground: number;
}
interface Foam {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
}
interface Delayed {
  at: number;
  fn: () => void;
}

const root = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const GRAVITY = 900;
const PERSPECTIVE = 0.32; // độ dẹt của sóng nước (nhìn xiên)

let ctx: CanvasRenderingContext2D | null = null;
let W = 0;
let H = 0;
let raf = 0;
let last = 0;
let time = 0;
let nextThrash = 0.9;
let nextWake = 0;
let tension = 0.3; // 0 = dây chùng, 1 = dây căng cứng
let reduced = false;
let ro: ResizeObserver | null = null;

const ripples: Ripple[] = [];
const drops: Drop[] = [];
const foams: Foam[] = [];
const delayed: Delayed[] = [];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const hook = () => ({ x: W * props.hookX, y: H * props.hookY });

/* ---------- Tạo hiệu ứng ---------- */

function addRipple(x: number, y: number, max: number, speed = 90, width = 1.8) {
  ripples.push({ x, y, r: 2, max, speed, width });
}

function addFoam(x: number, y: number, r: number) {
  foams.push({ x, y, r, age: 0, life: rand(0.35, 0.6) });
}

function addDrops(x: number, y: number, strength: number) {
  if (reduced) return;
  const n = Math.round(12 + 22 * strength);
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + rand(-0.95, 0.95);
    const speed = rand(140, 120 + 340 * strength);
    drops.push({
      x: x + rand(-8, 8),
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(0.9, 2.8),
      ground: y + rand(-4, 8),
    });
  }
}

function later(delay: number, fn: () => void) {
  delayed.push({ at: time + delay, fn });
}

/** Một cú quẫy: đuôi cá đập mặt nước, dây giật căng */
function thrash(strength = rand(0.55, 1)) {
  const h = hook();
  const x = h.x + rand(-34, 8);
  const y = h.y + rand(0, 10);

  addFoam(x, y, 22 + 26 * strength);
  addRipple(x, y, 50 + 90 * strength, 120, 2.4);
  addDrops(x, y, strength);

  later(0.12, () => addRipple(x, y, 35 + 60 * strength, 100, 1.6));
  later(0.26, () => addRipple(x, y, 25 + 40 * strength, 85, 1.2));
  // cú đập đuôi thứ hai, nhỏ hơn
  later(0.17, () => {
    const x2 = x + rand(-22, 22);
    addFoam(x2, y + 4, 14 + 12 * strength);
    addRipple(x2, y + 4, 30 + 40 * strength, 95, 1.5);
    addDrops(x2, y + 4, strength * 0.5);
  });

  tension = 1;
}

/* ---------- Cập nhật ---------- */

function update(dt: number) {
  time += dt;
  tension = Math.max(0.28, tension - dt * 0.85);

  if (props.autoplay && !reduced && time >= nextThrash) {
    thrash();
    // thỉnh thoảng quẫy dồn 2–3 nhịp liên tiếp
    if (Math.random() < 0.35) {
      later(0.28, () => thrash(rand(0.4, 0.8)));
      if (Math.random() < 0.5) later(0.55, () => thrash(rand(0.3, 0.7)));
    }
    nextThrash = time + rand(0.9, 2.4) / Math.max(0.3, props.intensity);
  }

  // sóng nhỏ liên tục tại điểm dây cắt mặt nước
  if (time >= nextWake) {
    const h = hook();
    addRipple(h.x + rand(-3, 3), h.y + rand(-1, 2), 14 + 22 * tension, 40 + 50 * tension, 1);
    nextWake = time + 0.5 - tension * 0.32;
  }

  for (let i = delayed.length - 1; i >= 0; i--) {
    if (time >= delayed[i].at) {
      delayed[i].fn();
      delayed.splice(i, 1);
    }
  }

  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i];
    rp.r += rp.speed * dt;
    if (rp.r >= rp.max) ripples.splice(i, 1);
  }

  for (let i = foams.length - 1; i >= 0; i--) {
    foams[i].age += dt;
    if (foams[i].age >= foams[i].life) foams.splice(i, 1);
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy += GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.vy > 0 && d.y >= d.ground) {
      if (d.r > 1.6 && Math.random() < 0.6) addRipple(d.x, d.ground, rand(10, 20), 45, 0.9);
      drops.splice(i, 1);
    }
  }
}

/* ---------- Vẽ ---------- */

function drawFishShadow(h: { x: number; y: number }) {
  if (!ctx) return;
  const fx = h.x - 34 + Math.sin(time * 9) * tension * 10;
  const fy = h.y + 30;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(Math.sin(time * 11) * 0.25 * tension);
  ctx.fillStyle = `rgba(36, 53, 42, ${0.16 + tension * 0.14})`;
  ctx.filter = "blur(5px)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // đuôi
  ctx.moveTo(26, 0);
  ctx.lineTo(44, -9 * (1 + tension));
  ctx.lineTo(44, 9 * (1 + tension));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.filter = "none";
}

function drawRipples() {
  if (!ctx) return;
  for (const rp of ripples) {
    const life = 1 - rp.r / rp.max;
    ctx.lineWidth = rp.width;
    ctx.strokeStyle = `rgba(245, 249, 240, ${life * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, rp.r, rp.r * PERSPECTIVE, 0, 0, Math.PI * 2);
    ctx.stroke();
    // vòng trong mờ hơn tạo cảm giác gợn
    ctx.lineWidth = rp.width * 0.6;
    ctx.strokeStyle = `rgba(79, 195, 255, ${life * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, rp.r * 0.82, rp.r * 0.82 * PERSPECTIVE, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFoam() {
  if (!ctx) return;
  for (const f of foams) {
    const k = f.age / f.life;
    const r = f.r * (0.6 + k * 0.9);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, PERSPECTIVE + 0.1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.75 * (1 - k)})`);
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawLine(h: { x: number; y: number }) {
  if (!ctx) return;
  const tipX = W * 0.9;
  const tipY = -8;

  // điểm điều khiển: dây chùng khi tension thấp, rung khi tension cao
  const midX = (tipX + h.x) / 2;
  const midY = (tipY + h.y) / 2;
  const sag = (1 - tension) * H * 0.09;
  const shake = Math.sin(time * 42) * tension * tension * 5;
  const cx = midX + shake;
  const cy = midY + sag;

  // phần dây dưới nước (mờ, lệch nhẹ do khúc xạ)
  const fx = h.x - 34 + Math.sin(time * 9) * tension * 10;
  const fy = h.y + 30;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(h.x, h.y);
  ctx.quadraticCurveTo(h.x - 8 + shake, h.y + 16, fx, fy);
  ctx.stroke();

  // phần dây trên không
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo(cx, cy, h.x, h.y);
  ctx.stroke();

  // vệt nước kéo theo dây tại điểm chạm
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + tension * 0.4})`;
  ctx.lineWidth = 1;
  const w = 10 + tension * 18;
  ctx.beginPath();
  ctx.moveTo(h.x, h.y);
  ctx.lineTo(h.x + w, h.y + w * PERSPECTIVE * 0.9);
  ctx.moveTo(h.x, h.y);
  ctx.lineTo(h.x - w * 0.5, h.y + w * PERSPECTIVE * 1.4);
  ctx.stroke();
}

function drawDrops() {
  if (!ctx) return;
  ctx.lineCap = "round";
  for (const d of drops) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
    ctx.lineWidth = d.r;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.vx * 0.018, d.y - d.vy * 0.018);
    ctx.stroke();
  }
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const h = hook();
  drawFishShadow(h);
  drawRipples();
  drawFoam();
  drawLine(h);
  drawDrops();
}

/* ---------- Vòng đời ---------- */

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  raf = requestAnimationFrame(frame);
}

function resize() {
  const el = canvas.value;
  const box = root.value;
  if (!el || !box) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = box.clientWidth;
  H = box.clientHeight;
  el.width = Math.round(W * dpr);
  el.height = Math.round(H * dpr);
  ctx = el.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function onPointerDown() {
  thrash(rand(0.8, 1));
}

onMounted(() => {
  reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  resize();
  ro = new ResizeObserver(resize);
  if (root.value) ro.observe(root.value);
  last = performance.now();
  raf = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
});

defineExpose({ thrash });
</script>

<template>
  <div
    ref="root"
    class="fixed inset-0 z-[10000] isolate h-dvh w-screen select-none overflow-hidden bg-primary"
    role="status"
    aria-live="polite"
    aria-busy="true"
    :aria-label="tr('FishingView.dang_chuan_bi_du_lieu_cau_ca')"
  >
    <!-- ánh sáng phản chiếu trên mặt hồ -->
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,color-mix(in_srgb,_var(--color-sky)_30%,_transparent),transparent_60%)]"
    />
    <div
      class="pointer-events-none absolute inset-0 opacity-30 mix-blend-soft-light bg-[repeating-linear-gradient(180deg,transparent_0_9px,color-mix(in_srgb,_var(--color-white)_18%,_transparent)_9px_10px)]"
    />

    <canvas
      ref="canvas"
      class="absolute inset-0 h-full w-full cursor-pointer touch-manipulation"
      :aria-label="tr('FishingSplashLoading.lake')"
      @pointerdown="onPointerDown"
    />

    <div class="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-1.5 text-center">
      <div class="rounded-full border border-[var(--color-ocean-gold)]/40 bg-[var(--color-ocean-deep)]/70 px-5 py-2 text-sm font-medium tracking-wide text-[var(--color-ocean-pearl)] animate-pulse">
        {{ tr("FishingView.dang_chuan_bi_du_lieu_cau_ca") }}
      </div>
    </div>
  </div>
</template>
