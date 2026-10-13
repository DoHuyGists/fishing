<script lang="ts" setup>
import { ref } from "vue";
import World2 from "./World2.vue";

const zoomInfo = ref({ lon: 0, lat: 0, k: 1 });
const picked = ref<string>("");
const mapRef = ref<InstanceType<typeof World2> | null>(null);

interface PickPoint {
  screen: { x: number; y: number };
  map: { x: number; y: number };
  lon: number | null;
  lat: number | null;
}

function onZoom(s: { center: [number, number] | null; k: number }) {
  zoomInfo.value = {
    lon: s.center?.[0] ?? 0,
    lat: s.center?.[1] ?? 0,
    k: s.k,
  };
}

function onPick(p: PickPoint) {
  picked.value =
    p.lon != null && p.lat != null
      ? `Screen: ${p.screen.x.toFixed(0)}, ${p.screen.y.toFixed(0)} | Map: ${p.map.x.toFixed(1)}, ${p.map.y.toFixed(1)} | Lon/lat: ${p.lon.toFixed(5)}, ${p.lat.toFixed(5)}`
      : `Screen: ${p.screen.x.toFixed(0)}, ${p.screen.y.toFixed(0)} | Point is outside the map`;

  // Click đâu bay tới đó
  if (p.lon != null && p.lat != null) {
    mapRef.value?.setView({ lon: p.lon, lat: p.lat, k: 15, duration: 600 });
  }
  anchor.value = p.lon != null && p.lat != null ? { lon: p.lon, lat: p.lat } : null;
}

function goHanoi() {
  mapRef.value?.setView({ lon: 105.85, lat: 21.03, k: 30, duration: 800 });
}

function zoomTo(k: number) {
  mapRef.value?.setView({ k, duration: 300 }); // giữ nguyên tâm, chỉ đổi zoom
}

const anchor = ref<{ lon: number; lat: number } | null>(null);
</script>

<template>
  <div class="flex flex-col">
    <div class="flex">
      <button @click="goHanoi">Hà Nội</button>
      <button @click="zoomTo(3)">Zoom 3x</button>
      <button @click="mapRef?.resetView()">Về toàn cảnh</button>
    </div>
    <div class="w-[50dvw] overflow-hidden">
      <World2 ref="mapRef" @pick="onPick" @zoom="onZoom" :anchor="anchor">
        <template #tooltip>
          <template v-if="anchor"> {{ anchor.lat.toFixed(3) }}, {{ anchor.lon.toFixed(3) }} </template>
        </template>
      </World2>
    </div>
  </div>
  <!-- <p>Zoom: {{ zoomInfo.k.toFixed(2) }}x | Dịch: {{ zoomInfo.x.toFixed(0) }}, {{ zoomInfo.y.toFixed(0) }}</p> -->
  <!-- <p>{{ picked }}</p> -->
</template>
