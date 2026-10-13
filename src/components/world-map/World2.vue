<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import supabase from "../../database/connection";

interface CountryValueRow {
  country_id: number;
  color: string | null;
}

interface ViewTarget {
  lon?: number; // bỏ trống = giữ tâm hiện tại
  lat?: number;
  k?: number; // bỏ trống = giữ mức zoom hiện tại
  duration?: number; // ms, 0 = nhảy ngay, >0 = bay mượt
}

interface ZoomState {
  x: number; // dịch chuyển ngang (px)
  y: number; // dịch chuyển dọc (px)
  k: number; // mức zoom (1 = ban đầu)
  center: [number, number] | null; // [kinh độ, vĩ độ] tại tâm khung nhìn
  fromUser: boolean;
}

interface PickPoint {
  screen: { x: number; y: number }; // px trên canvas
  map: { x: number; y: number }; // toạ độ trong hệ chưa zoom
  lon: number | null;
  lat: number | null;
}

const emit = defineEmits<{
  zoom: [state: ZoomState];
  pick: [point: PickPoint];
}>();

const props = withDefaults(
  defineProps<{
    seaColor?: string;
    landColor?: string;
    borderColor?: string;
    anchor?: { lon: number; lat: number } | null; // điểm gắn tooltip
  }>(),
  {
    seaColor: "#cfe8f3",
    landColor: "#e8e4d8",
    borderColor: "#ffffff",
    anchor: null,
  },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);

function setView({ lon, lat, k, duration = 0 }: ViewTarget) {
  const canvas = canvasRef.value;
  if (!canvas || !projection) return;

  const nextK = Math.min(30, Math.max(1, k ?? transform.k));

  // Tâm đích trong hệ chưa zoom
  let target: [number, number] | null = null;
  if (lon != null && lat != null) {
    target = projection([lon, lat]);
  } else {
    target = transform.invert([width / 2, height / 2]);
  }
  if (!target) return; // toạ độ nằm ngoài phép chiếu

  // Muốn điểm target nằm giữa khung: screen = k * p + t  =>  t = center - k * p
  const raw = d3.zoomIdentity.translate(width / 2 - nextK * target[0], height / 2 - nextK * target[1]).scale(nextK);

  // Áp ràng buộc (scaleExtent, translateExtent) vì transform thủ công không tự áp
  const box: [[number, number], [number, number]] = [
    [0, 0],
    [width, height],
  ];
  const next = zoomBehavior.constrain()(raw, box, box);

  const sel = d3.select(canvas);
  if (duration > 0) {
    sel.transition().duration(duration).call(zoomBehavior.transform, next);
  } else {
    sel.call(zoomBehavior.transform, next);
  }
}

function resetView(duration = 400) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const sel = d3.select(canvas);
  if (duration > 0) {
    sel.transition().duration(duration).call(zoomBehavior.transform, d3.zoomIdentity);
  } else {
    sel.call(zoomBehavior.transform, d3.zoomIdentity);
  }
}

function onClick(event: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas || !projection) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // d3.pointer returns CSS pixels. Scale from the rendered rectangle so this
  // remains accurate when browser zoom creates fractional canvas dimensions.
  const sx = (event.clientX - rect.left) * (width / rect.width);
  const sy = (event.clientY - rect.top) * (height / rect.height);
  const [mx, my] = transform.invert([sx, sy]); // bỏ ảnh hưởng của zoom/kéo
  const lonLat = projection.invert?.([mx, my]); // ra kinh/vĩ độ

  // Click ngoài vùng bản đồ thì invert có thể ra giá trị ngoài ±180/±90
  const edgeTolerance = 1e-6;
  const valid =
    lonLat &&
    Math.abs(lonLat[0]) <= 180 + edgeTolerance &&
    Math.abs(lonLat[1]) <= 90 + edgeTolerance;
  const lon = valid ? Math.max(-180, Math.min(180, lonLat[0])) : null;
  const lat = valid ? Math.max(-90, Math.min(90, lonLat[1])) : null;

  emit("pick", {
    screen: { x: sx, y: sy },
    map: { x: mx, y: my },
    lon,
    lat,
  });
}

// Dữ liệu bản đồ (tải một lần)
const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const countries = topojson.feature(topo, topo.objects.countries).features;

// Trạng thái vẽ (không cần reactive, tránh Vue theo dõi dư thừa)
const colors = new Map<string, string>(); // id nước ("004", "704"...) -> màu
let ctx: CanvasRenderingContext2D | null = null;
let path: d3.GeoPath<any, d3.GeoPermissibleObjects> | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let transform: d3.ZoomTransform = d3.zoomIdentity;
let resizeObserver: ResizeObserver | null = null;
let viewport: VisualViewport | null = null;
const tip = ref({ x: 0, y: 0, visible: false });

const zoomBehavior = d3
  .zoom<HTMLCanvasElement, unknown>()
  .scaleExtent([1, 30])
  .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
    transform = event.transform;
    draw();
    emitZoom(Boolean(event.sourceEvent));
  });

let projection: d3.GeoProjection | null = null;
const relief = new Image();
relief.src = "/HYP_HR_SR_OB_DR.jpg"; // đặt ảnh trong thư mục public/
relief.onload = () => draw();

function setupCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  dpr = window.devicePixelRatio || 1;
  // d3.zoom works in CSS pixels, which are the integer client dimensions.
  // Keep its transform space aligned with the projection; click coordinates
  // are scaled from the rendered rectangle in onClick().
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  if (!width || !height) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  ctx = canvas.getContext("2d");
  if (!ctx) return;

  projection = d3
    // .geoNaturalEarth1()
    .geoEquirectangular()
    .fitSize([width, height], { type: "Sphere" });
  path = d3.geoPath(projection, ctx);

  // Không cho kéo bản đồ ra khỏi khung nhìn
  zoomBehavior.translateExtent([
    [0, 0],
    [width, height],
  ]);
}

function draw() {
  if (!ctx || !path) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // Biển
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = props.seaColor;
  ctx.fill();

  if (projection && relief.complete) {
    const [x0, y0] = projection([-180, 90])!;
    const [x1, y1] = projection([180, -90])!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(relief, x0, y0, x1 - x0, y1 - y0);
  }

  // Các quốc gia
  ctx.lineWidth = 0.5 / transform.k; // viền không dày lên khi zoom
  ctx.strokeStyle = props.borderColor;
  for (const feature of countries) {
    ctx.beginPath();
    path(feature);
    const custom = colors.get(String(feature.id));
    if (custom) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = custom;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.stroke();
  }

  ctx.restore();
  updateTip();
}

watch(() => props.anchor, updateTip, { deep: true });

async function loadColors() {
  const { data, error } = await supabase
    .from("country_values")
    .select("country_id, color")
    .returns<CountryValueRow[]>();

  if (error) {
    console.error("Không tải được country_values:", error.message);
    return;
  }

  colors.clear();
  for (const row of data ?? []) {
    if (row.color) colors.set(String(row.country_id).padStart(3, "0"), row.color);
  }
  draw();
}

function emitZoom(fromUser = false) {
  const [mx, my] = transform.invert([width / 2, height / 2]);
  const center = projection?.invert?.([mx, my]) ?? null;
  emit("zoom", { x: transform.x, y: transform.y, k: transform.k, center, fromUser });
}

function getCenterLonLat(): [number, number] | null {
  if (!projection) return null;
  const [mx, my] = transform.invert([width / 2, height / 2]);
  return projection.invert?.([mx, my]) ?? null;
}

function resizeMap() {
  // Browser zoom can change both the rendered rectangle and devicePixelRatio.
  // Preserve the geographic center while rebuilding the projection.
  const center = getCenterLonLat();
  const k = transform.k;

  setupCanvas();

  if (center) {
    setView({ lon: center[0], lat: center[1], k });
  } else {
    draw();
  }
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  setupCanvas();
  d3.select(canvas).call(zoomBehavior);
  draw();
  //   loadColors();

  // Vẽ lại khi đổi kích thước khung
  resizeObserver = new ResizeObserver(() => {
    // 1. Ghi nhớ vị trí theo toạ độ địa lý (dùng phép chiếu và kích thước cũ)
    const center = getCenterLonLat();
    const k = transform.k;

    // 2. Dựng lại theo kích thước mới
    setupCanvas();

    // 3. Đặt lại đúng tâm và mức zoom cũ
    if (center) {
      setView({ lon: center[0], lat: center[1], k });
    } else {
      draw();
    }
  });
  resizeObserver.observe(canvas);
  viewport = window.visualViewport;
  viewport?.addEventListener("resize", resizeMap);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  viewport?.removeEventListener("resize", resizeMap);
  if (canvasRef.value) d3.select(canvasRef.value).on(".zoom", null);
});

function updateTip() {
  const a = props.anchor;
  const p = a && projection ? projection([a.lon, a.lat]) : null;
  
  if (!p) {
    tip.value.visible = false;
    return;
  }
  const [x, y] = transform.apply(p); // lon/lat -> px, đã tính cả zoom và kéo
  const inside = x >= 0 && x <= width && y >= 0 && y <= height;
  tip.value = { x, y, visible: inside };
}

// Đổi màu qua props thì vẽ lại
watch(() => [props.seaColor, props.landColor, props.borderColor], draw);

defineExpose({ reload: loadColors, setView, resetView });
</script>

<template>
  <div class="world-map-wrap">
    <canvas ref="canvasRef" @click="onClick" class="world-map" />
    <div v-if="tip.visible" class="world-map-tip" :style="{ transform: `translate(${tip.x}px, ${tip.y}px)` }">
      <div class="world-map-tip__body">
        <slot name="tooltip" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-map-wrap {
  position: relative;
  overflow: hidden;
}
.world-map {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 1;
  cursor: grab;
}
.world-map:active {
  cursor: grabbing;
}
.world-map-tip {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none; /* không chặn kéo/click bản đồ bên dưới */
}
.world-map-tip__body {
  /* căn giữa ngang, nằm phía trên điểm 10px */
  transform: translate(-50%, calc(-100% - 10px));
  padding: 6px 10px;
  border-radius: 6px;
  background: #1f2937;
  color: #fff;
  font-size: 13px;
  white-space: nowrap;
}
</style>
