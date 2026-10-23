export const FISHING_DEPTH_CONFIG = {
  maxMeters: 30,
  stepMeters: 0.5,
  ticksMeters: [0, 10, 20, 30],
  quickStopsMeters: [5, 10, 15, 20, 25, 30],
  layers: [
    { id: "surface", label: "Tầng mặt", minMeters: 0, maxMeters: 5, color: "#b6e5d5" },
    { id: "mid", label: "Tầng giữa", minMeters: 5, maxMeters: 15, color: "#64c7ac" },
    { id: "deep", label: "Tầng sâu", minMeters: 15, maxMeters: 25, color: "#368b79" },
    { id: "bottom", label: "Đáy hồ", minMeters: 25, maxMeters: 30, color: "#c5b878" },
  ],
} as const;

export function getDepthLayer(depth: number) {
  const layers = FISHING_DEPTH_CONFIG.layers;
  return layers.find((layer, index) => depth < layer.maxMeters || index === layers.length - 1) ?? layers[0];
}
