// ============================================================
// Focus Score — score raw clinical eye metrics and produce
// a 0–100 impairment percentage.
//
// Scoring is based on known clinical thresholds for smooth
// pursuit impairment rather than self-calibrated baselines,
// so it works on the very first use.
// ============================================================

import { RawEyeMetrics } from "./eyeMetrics";

export interface FocusBaseline {
  pursuitGainMean: number;
  pursuitGainStd: number;
  saccadeRateMean: number;
  saccadeRateStd: number;
  positionErrorMean: number;
  positionErrorStd: number;
  gazeStabilityMean: number;
  gazeStabilityStd: number;
}

/**
 * Population-derived defaults for a sober user.
 * Based on smooth pursuit research literature:
 *  - Pursuit gain ~0.90–0.95 (sober)
 *  - Saccade rate <1 per second
 *  - Position error ~0.03–0.06 (normalised)
 *  - Gaze velocity variance ~0.05–0.15
 */
export const DEFAULT_FOCUS_BASELINE: FocusBaseline = {
  pursuitGainMean: 0.92,
  pursuitGainStd: 0.06,
  saccadeRateMean: 0.8,
  saccadeRateStd: 0.4,
  positionErrorMean: 0.05,
  positionErrorStd: 0.02,
  gazeStabilityMean: 0.1,
  gazeStabilityStd: 0.05,
};

export interface FocusScoreResult {
  focusDeltaPercent: number;
  impairmentContributionScore: number;
  /** Individual metric scores (0–100, higher = worse). */
  pursuiGainScore: number;
  saccadeScore: number;
  positionErrorScore: number;
  stabilityScore: number;
}

/**
 * Score pursuit gain: map from 0–1 scale to 0–100 impairment.
 * Perfect gain (≥0.80) → 0;  severe impairment (≤0.20) → 100.
 * Lenient: phone-based tracking has much more noise than lab equipment.
 */
function scorePursuitGain(gain: number): number {
  const g = Math.max(0, Math.min(1.2, gain));
  if (g >= 0.80) return 0;
  if (g <= 0.20) return 100;
  return Math.round(((0.80 - g) / 0.60) * 100);
}

/**
 * Score saccade rate: ≤1/s → 0,  ≥12/s → 100.
 * Lenient: casual phone use produces many micro-saccades.
 */
function scoreSaccadeRate(rate: number): number {
  if (rate <= 1) return 0;
  if (rate >= 12) return 100;
  return Math.round(((rate - 1) / 11) * 100);
}

/**
 * Score position error: ≤0.05 → 0,  ≥0.40 → 100.
 * Lenient: webcam gaze has inherent position noise.
 */
function scorePositionError(err: number): number {
  if (err <= 0.05) return 0;
  if (err >= 0.40) return 100;
  return Math.round(((err - 0.05) / 0.35) * 100);
}

/**
 * Score gaze stability (velocity variance): ≤0.15 → 0,  ≥2.0 → 100.
 * Lenient: phone screen tracking has significant jitter.
 */
function scoreStability(variance: number): number {
  if (variance <= 0.15) return 0;
  if (variance >= 2.0) return 100;
  return Math.round(((variance - 0.15) / 1.85) * 100);
}

/**
 * Compute weighted impairment score from raw metrics.
 *
 * Weights (clinically motivated):
 *   pursuitGain     0.40  — the gold standard for impairment
 *   saccadeRate     0.25  — catch-up saccades indicate lag
 *   positionError   0.20  — overall accuracy
 *   gazeStability   0.15  — involuntary oscillation / nystagmus
 */
export function computeFocusScore(
  metrics: RawEyeMetrics,
  _baseline?: FocusBaseline,
): FocusScoreResult {
  const pg = scorePursuitGain(metrics.pursuitGain);
  const sr = scoreSaccadeRate(metrics.saccadeRate);
  const pe = scorePositionError(metrics.positionError);
  const gs = scoreStability(metrics.gazeStability);

  const focusDeltaPercent = Math.round(
    0.40 * pg + 0.25 * sr + 0.20 * pe + 0.15 * gs,
  );
  const clamped = Math.max(0, Math.min(100, focusDeltaPercent));

  return {
    focusDeltaPercent: clamped,
    impairmentContributionScore: clamped / 100,
    pursuiGainScore: pg,
    saccadeScore: sr,
    positionErrorScore: pe,
    stabilityScore: gs,
  };
}

/** EMA helper */
function ema(cur: number, obs: number, alpha: number): number {
  return alpha * obs + (1 - alpha) * cur;
}
function emaStd(curStd: number, curMean: number, obs: number, alpha: number): number {
  return Math.max(0.0001, ema(curStd, Math.abs(obs - curMean), alpha));
}

/**
 * Update baseline using an EMA from a sober calibration run.
 */
export function updateFocusBaseline(
  current: FocusBaseline,
  metrics: RawEyeMetrics,
  alpha: number = 0.2,
): FocusBaseline {
  return {
    pursuitGainMean: ema(current.pursuitGainMean, metrics.pursuitGain, alpha),
    pursuitGainStd: emaStd(current.pursuitGainStd, current.pursuitGainMean, metrics.pursuitGain, alpha),
    saccadeRateMean: ema(current.saccadeRateMean, metrics.saccadeRate, alpha),
    saccadeRateStd: emaStd(current.saccadeRateStd, current.saccadeRateMean, metrics.saccadeRate, alpha),
    positionErrorMean: ema(current.positionErrorMean, metrics.positionError, alpha),
    positionErrorStd: emaStd(current.positionErrorStd, current.positionErrorMean, metrics.positionError, alpha),
    gazeStabilityMean: ema(current.gazeStabilityMean, metrics.gazeStability, alpha),
    gazeStabilityStd: emaStd(current.gazeStabilityStd, current.gazeStabilityMean, metrics.gazeStability, alpha),
  };
}

export function loadFocusBaseline(): FocusBaseline {
  if (typeof window === "undefined") return DEFAULT_FOCUS_BASELINE;
  try {
    const raw = localStorage.getItem("woozy_focus_baseline");
    return raw ? JSON.parse(raw) : DEFAULT_FOCUS_BASELINE;
  } catch {
    return DEFAULT_FOCUS_BASELINE;
  }
}

export function saveFocusBaseline(baseline: FocusBaseline): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("woozy_focus_baseline", JSON.stringify(baseline));
  } catch {
    // silent
  }
}
