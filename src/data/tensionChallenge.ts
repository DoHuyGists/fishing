// Protocol v1: fixed-point arithmetic and Park-Miller RNG must match
// replay_tension_challenge in submit_tension_challenge.sql exactly.
export const TENSION_SCALE = 10_000;
const RNG_MODULUS = 2_147_483_647;

export type TensionResult = "fighting" | "won" | "snapped" | "escaped" | "timeout";
export type TensionInput = { tick: number; reeling: boolean };
export type TensionSubmission = {
  sessionId: string;
  inputs: TensionInput[];
  totalTicks: number;
  claimedResult: Exclude<TensionResult, "fighting">;
};
export type TensionChallenge = {
  sessionId: string;
  type: "tension-challenge";
  version: 1;
  seed: number;
  startedAt: number;
  expiresAt: number;
  activatedAt?: number;
  config: {
    tickRate: number;
    safeMin: number;
    safeMax: number;
    maxTension: number;
    startTension: number;
    startDistance: number;
    reelRate: number;
    releaseRate: number;
    reelSpeed: number;
    slackEscapeSeconds: number;
    slackThresholdRatio: number;
    slackDistanceRate: number;
    fishPullMultiplier: number;
    minimumStrength: number;
  };
  fish: {
    id: string;
    baseStrength: number;
    burstChance: number;
    burstMin: number;
    burstMax: number;
    staminaDrain: number;
    basePull: number;
    pullAmplitude: number;
    pullPeriodTicks: number;
    burstMinTicks: number;
    burstMaxTicks: number;
  };
};

export function isTensionChallenge(value: unknown): value is TensionChallenge {
  if (!value || typeof value !== "object") return false;
  const c = value as TensionChallenge;
  if (c.type !== "tension-challenge" || c.version !== 1 || typeof c.sessionId !== "string" || !c.config || !c.fish) return false;
  const numbers = [c.seed, c.startedAt, c.expiresAt, ...Object.values(c.config),
    ...Object.entries(c.fish).filter(([key]) => key !== "id").map(([, v]) => v)];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  const cfg = c.config;
  const f = c.fish;
  return Number.isInteger(c.seed) && c.seed > 0 && c.seed < RNG_MODULUS &&
    Number.isSafeInteger(c.startedAt) && Number.isSafeInteger(c.expiresAt) &&
    (c.activatedAt === undefined || c.activatedAt === c.startedAt) &&
    c.expiresAt > c.startedAt && c.expiresAt - c.startedAt <= 180_000 &&
    Number.isInteger(cfg.tickRate) && cfg.tickRate >= 1 && cfg.tickRate <= 120 &&
    cfg.safeMin > 0 && cfg.safeMax > cfg.safeMin && cfg.maxTension > cfg.safeMax && cfg.maxTension <= 1000 &&
    cfg.startTension >= 0 && cfg.startTension < cfg.maxTension && cfg.startDistance > 0 && cfg.startDistance <= 1000 &&
    cfg.reelRate > 0 && cfg.reelRate <= 1000 && cfg.releaseRate < 0 && cfg.releaseRate >= -1000 &&
    cfg.reelSpeed > 0 && cfg.reelSpeed <= 1000 && cfg.slackEscapeSeconds > 0 && cfg.slackEscapeSeconds <= 180 &&
    cfg.slackThresholdRatio > 0 && cfg.slackThresholdRatio <= 1 && cfg.slackDistanceRate >= 0 && cfg.slackDistanceRate <= 1000 &&
    cfg.fishPullMultiplier >= 0 && cfg.fishPullMultiplier <= 10 && cfg.minimumStrength >= 0 && cfg.minimumStrength <= 1 &&
    typeof f.id === "string" && f.baseStrength > 0 && f.baseStrength <= 10 &&
    f.burstChance >= 0 && f.burstChance <= 1 && f.burstMin >= 0 && f.burstMax >= f.burstMin && f.burstMax <= 1000 &&
    f.staminaDrain >= 0 && f.staminaDrain <= 1 && f.basePull >= 0 && f.basePull <= 1000 &&
    f.pullAmplitude >= 0 && f.pullAmplitude <= f.basePull && Number.isInteger(f.pullPeriodTicks) && f.pullPeriodTicks >= 4 &&
    Number.isInteger(f.burstMinTicks) && Number.isInteger(f.burstMaxTicks) && f.burstMinTicks >= 1 && f.burstMaxTicks >= f.burstMinTicks;
}

export function tensionMaxTicks(c: TensionChallenge) {
  return Math.floor(((c.expiresAt - c.startedAt) * c.config.tickRate) / 1000);
}

export function createTensionFight(c: TensionChallenge) {
  return {
    tick: 0, tension: Math.round(c.config.startTension * TENSION_SCALE),
    distance: Math.round(c.config.startDistance * TENSION_SCALE), stamina: TENSION_SCALE,
    rng: c.seed, burst: 0, burstLeft: 0, slackTicks: 0,
    result: "fighting" as TensionResult,
  };
}
export type TensionFight = ReturnType<typeof createTensionFight>;

export function stepTensionFight(c: TensionChallenge, s: TensionFight, reeling: boolean) {
  if (s.result !== "fighting") return;
  const scale = TENSION_SCALE;
  // PostgreSQL ROUND rounds negative halves away from zero as well.
  const fixed = (n: number) => Math.sign(n) * Math.round(Math.abs(n) * scale);
  const multiply = (a: number, b: number) => Math.trunc((a * b) / scale);
  const random = () => (s.rng = (s.rng * 48_271) % RNG_MODULUS);
  const cfg = c.config;
  const fish = c.fish;
  if (s.burstLeft <= 0) {
    const chance = random();
    const magnitude = random();
    const duration = random();
    s.burst = chance / RNG_MODULUS < fish.burstChance
      ? fixed(fish.burstMin) + Math.floor(((fixed(fish.burstMax) - fixed(fish.burstMin)) * magnitude) / RNG_MODULUS)
      : 0;
    s.burstLeft = fish.burstMinTicks + Math.floor(((fish.burstMaxTicks - fish.burstMinTicks + 1) * duration) / RNG_MODULUS);
  }
  s.burstLeft--;
  // Integer triangle wave avoids platform-dependent trigonometry.
  const phase = s.tick % fish.pullPeriodTicks;
  const wave = Math.trunc((4 * scale * Math.min(phase, fish.pullPeriodTicks - phase)) / fish.pullPeriodTicks) - scale;
  const strength = fixed(cfg.minimumStrength) + multiply(scale - fixed(cfg.minimumStrength), s.stamina);
  let pull = fixed(fish.basePull) + multiply(fixed(fish.pullAmplitude), wave) + s.burst;
  pull = multiply(multiply(multiply(pull, fixed(fish.baseStrength)), strength), fixed(cfg.fishPullMultiplier));
  s.tension = Math.max(0, s.tension + Math.trunc((pull + fixed(reeling ? cfg.reelRate : cfg.releaseRate)) / cfg.tickRate));
  const safeMin = fixed(cfg.safeMin);
  if (s.tension >= safeMin && s.tension <= fixed(cfg.safeMax)) {
    s.stamina = Math.max(0, s.stamina - Math.trunc(fixed(fish.staminaDrain) / cfg.tickRate));
  }
  if (reeling && s.tension >= safeMin) s.distance -= Math.trunc(fixed(cfg.reelSpeed) / cfg.tickRate);
  if (s.tension < safeMin) s.distance = Math.min(fixed(cfg.startDistance), s.distance + Math.trunc(fixed(cfg.slackDistanceRate) / cfg.tickRate));
  s.slackTicks = s.tension < multiply(safeMin, fixed(cfg.slackThresholdRatio)) ? s.slackTicks + 1 : 0;
  s.tick++;
  if (s.tension >= fixed(cfg.maxTension)) s.result = "snapped";
  else if (s.slackTicks > cfg.slackEscapeSeconds * cfg.tickRate) s.result = "escaped";
  else if (s.distance <= 0) s.result = "won";
  else if (s.tick >= tensionMaxTicks(c)) s.result = "timeout";
}
