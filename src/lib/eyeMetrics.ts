// ============================================================
// Eye Metrics — clinically-motivated feature extraction
//
// Metrics based on smooth-pursuit eye-movement research:
//  1. Smooth Pursuit Gain — ratio of eye velocity to target
//     velocity. Sober ≈ 0.9–1.0, impaired ≈ 0.5–0.7.
//  2. Saccade Rate — catch-up saccades per second during
//     pursuit. Sober < 1/s, impaired > 3/s.
//  3. Position Error — RMS distance between gaze and target.
//  4. Gaze Stability (jitter) — variance of frame-to-frame
//     gaze velocity, measuring involuntary oscillations.
// ============================================================

export interface FocusFrame {
  timestamp: number;   // seconds since test start
  gazeX: number;       // normalised gaze (screen coords, 0–1)
  gazeY: number;
  dotX: number;        // target position (screen coords, 0–1)
  dotY: number;
  headYaw: number;
  headPitch: number;
  confidence: number;
}

export interface RawEyeMetrics {
  /** Eye velocity / target velocity (ideal ≈ 1.0). */
  pursuitGain: number;
  /** Catch-up saccades per second (lower is better). */
  saccadeRate: number;
  /** RMS tracking error between gaze and target. */
  positionError: number;
  /** Variance of gaze velocity — involuntary jitter. */
  gazeStability: number;
}

/** Minimum dt to avoid division by zero for velocity calcs. */
const MIN_DT = 0.005;
/** Velocity threshold that marks a saccade (normalised units/s). */
const SACCADE_THRESHOLD = 1.2;

/**
 * Smooth pursuit gain: median ratio of eye velocity magnitude
 * to target velocity magnitude, computed per frame pair.
 * Using median rejects saccade frames that would inflate the mean.
 */
function computePursuitGain(frames: FocusFrame[]): number {
  if (frames.length < 3) return 1;

  const ratios: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].timestamp - frames[i - 1].timestamp;
    if (dt < MIN_DT) continue;

    const eyeVx = (frames[i].gazeX - frames[i - 1].gazeX) / dt;
    const dotVx = (frames[i].dotX - frames[i - 1].dotX) / dt;
    const dotSpeed = Math.abs(dotVx);

    // Only measure gain when the target is actually moving
    if (dotSpeed < 0.05) continue;

    const eyeSpeed = Math.abs(eyeVx);

    // Only count frames where eye moves in the same direction as dot
    if (eyeVx * dotVx > 0) {
      ratios.push(eyeSpeed / dotSpeed);
    } else {
      // Eye moving opposite to dot — pursuit gain effectively 0
      ratios.push(0);
    }
  }

  if (ratios.length === 0) return 1;

  // Return median
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 !== 0
    ? ratios[mid]
    : (ratios[mid - 1] + ratios[mid]) / 2;
}

/**
 * Count catch-up saccades: sudden large velocity jumps during
 * pursuit that indicate the eye fell behind and "caught up".
 */
function computeSaccadeRate(frames: FocusFrame[]): number {
  if (frames.length < 3) return 0;

  let saccades = 0;
  let inSaccade = false;

  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].timestamp - frames[i - 1].timestamp;
    if (dt < MIN_DT) continue;

    const eyeSpeed = Math.abs((frames[i].gazeX - frames[i - 1].gazeX) / dt);

    if (eyeSpeed > SACCADE_THRESHOLD && !inSaccade) {
      saccades++;
      inSaccade = true;
    } else if (eyeSpeed <= SACCADE_THRESHOLD * 0.5) {
      inSaccade = false;
    }
  }

  const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
  return duration > 0 ? saccades / duration : 0;
}

/**
 * RMS position error between gaze and target (horizontal).
 */
function computePositionError(frames: FocusFrame[]): number {
  if (frames.length === 0) return 0;

  const sumSq = frames.reduce((sum, f) => {
    const err = f.gazeX - f.dotX;
    return sum + err * err;
  }, 0);

  return Math.sqrt(sumSq / frames.length);
}

/**
 * Gaze stability: variance of frame-to-frame gaze velocity.
 * Higher variance = more involuntary oscillation / nystagmus.
 */
function computeGazeStability(frames: FocusFrame[]): number {
  if (frames.length < 3) return 0;

  const velocities: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].timestamp - frames[i - 1].timestamp;
    if (dt < MIN_DT) continue;
    velocities.push((frames[i].gazeX - frames[i - 1].gazeX) / dt);
  }

  if (velocities.length === 0) return 0;

  const avg = velocities.reduce((s, v) => s + v, 0) / velocities.length;
  return velocities.reduce((s, v) => s + (v - avg) ** 2, 0) / velocities.length;
}

/**
 * Extract all clinical metrics from an array of focus frames.
 * Low-confidence frames (< 0.3) are filtered out first.
 */
export function extractEyeMetrics(frames: FocusFrame[]): RawEyeMetrics {
  const good = frames.filter((f) => f.confidence >= 0.3);

  return {
    pursuitGain: computePursuitGain(good),
    saccadeRate: computeSaccadeRate(good),
    positionError: computePositionError(good),
    gazeStability: computeGazeStability(good),
  };
}
