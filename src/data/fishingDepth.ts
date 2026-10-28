export const DEFAULT_MAX_DEPTH_METERS = 30;
export const DEPTH_STEP_METERS = 0.5;

const round1 = (value: number) => Math.round(value * 10) / 10;

export function resolveMaxDepth(value: unknown) {
  const max = Number(value);
  return Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX_DEPTH_METERS;
}

// Các tầng nước chia theo tỉ lệ so với độ sâu tối đa của khu vực.
export function buildDepthConfig(maxDepth: unknown) {
  const maxMeters = resolveMaxDepth(maxDepth);
  const at = (ratio: number) => round1(maxMeters * ratio);
  return {
    maxMeters,
    stepMeters: DEPTH_STEP_METERS,
    ticksMeters: [0, at(1 / 3), at(2 / 3), maxMeters],
    quickStopsMeters: [1, 2, 3, 4, 5, 6].map((i) => at(i / 6)),
    layers: [
      { id: "surface", label: "Tầng mặt", minMeters: 0, maxMeters: at(1 / 6), color: "#b6e5d5" },
      { id: "mid", label: "Tầng giữa", minMeters: at(1 / 6), maxMeters: at(1 / 2), color: "#64c7ac" },
      { id: "deep", label: "Tầng sâu", minMeters: at(1 / 2), maxMeters: at(5 / 6), color: "#368b79" },
      { id: "bottom", label: "Đáy hồ", minMeters: at(5 / 6), maxMeters, color: "#c5b878" },
    ],
  };
}

export type DepthConfig = ReturnType<typeof buildDepthConfig>;

export function getDepthLayer(depth: number, config: DepthConfig = buildDepthConfig(DEFAULT_MAX_DEPTH_METERS)) {
  const layers = config.layers;
  return layers.find((layer, index) => depth < layer.maxMeters || index === layers.length - 1) ?? layers[0];
}
