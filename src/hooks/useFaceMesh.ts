// ============================================================
// useFaceMesh — initialise MediaPipe FaceMesh and stream
// face-landmark results via a callback.
//
// Extracts RELATIVE iris position within eye socket bounds,
// giving gaze direction independent of head position.
// ============================================================

import { useEffect, useRef, useCallback, useState } from "react";

/** Gaze + head pose data extracted per frame. */
export interface FaceLandmarkData {
  /** Horizontal gaze: 0 = screen-left, 1 = screen-right (0.5 ≈ center). */
  gazeX: number;
  /** Vertical gaze: 0 = top, 1 = bottom (0.5 ≈ center). */
  gazeY: number;
  /** Inter-outer-corner distance; changes with head yaw. */
  headYaw: number;
  /** Nose-tip to mid-eye vertical offset; changes with head pitch. */
  headPitch: number;
  /** Detection confidence proxy (0–1). */
  confidence: number;
}

// Iris landmark indices (refineLandmarks: true)
const LEFT_IRIS = [468, 469, 470, 471];
const RIGHT_IRIS = [473, 474, 475, 476];

// Horizontal eye corner landmarks
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;

// Vertical eye boundary landmarks
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

// Head pose reference
const NOSE_TIP = 1;

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractData(results: any): FaceLandmarkData | null {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    return null;
  }
  const lm = results.multiFaceLandmarks[0];
  if (!lm || lm.length < 475) return null;

  // ── Iris centres ──────────────────────────
  const leftIrisX = mean(LEFT_IRIS.map((i) => lm[i].x));
  const leftIrisY = mean(LEFT_IRIS.map((i) => lm[i].y));
  const rightIrisX = mean(RIGHT_IRIS.map((i) => lm[i].x));
  const rightIrisY = mean(RIGHT_IRIS.map((i) => lm[i].y));

  // ── Horizontal gaze (relative to eye socket) ──
  // leftW/rightW are signed; both formulas produce 0→1
  // consistently: 0 = looking person-right, 1 = looking person-left.
  const leftW = lm[LEFT_EYE_OUTER].x - lm[LEFT_EYE_INNER].x;
  const rightW = lm[RIGHT_EYE_INNER].x - lm[RIGHT_EYE_OUTER].x;

  let leftGazeRaw = 0.5;
  let rightGazeRaw = 0.5;
  if (Math.abs(leftW) > 0.001) {
    leftGazeRaw = clamp01((leftIrisX - lm[LEFT_EYE_INNER].x) / leftW);
  }
  if (Math.abs(rightW) > 0.001) {
    rightGazeRaw = clamp01((rightIrisX - lm[RIGHT_EYE_OUTER].x) / rightW);
  }

  // Raw average (0 = person-right, 1 = person-left).
  // Flip to screen coords: 0 = screen-left, 1 = screen-right.
  const gazeX = 1 - (leftGazeRaw + rightGazeRaw) / 2;

  // ── Vertical gaze ────────────────────────
  const leftH = lm[LEFT_EYE_BOTTOM].y - lm[LEFT_EYE_TOP].y;
  const rightH = lm[RIGHT_EYE_BOTTOM].y - lm[RIGHT_EYE_TOP].y;

  let leftGazeY = 0.5;
  let rightGazeY = 0.5;
  if (Math.abs(leftH) > 0.005) {
    leftGazeY = clamp01((leftIrisY - lm[LEFT_EYE_TOP].y) / leftH);
  }
  if (Math.abs(rightH) > 0.005) {
    rightGazeY = clamp01((rightIrisY - lm[RIGHT_EYE_TOP].y) / rightH);
  }
  const gazeY = (leftGazeY + rightGazeY) / 2;

  // ── Head pose approximation ──────────────
  const nose = lm[NOSE_TIP];
  const leftOuter = lm[LEFT_EYE_OUTER];
  const rightOuter = lm[RIGHT_EYE_OUTER];

  const headYaw = rightOuter.x - leftOuter.x;
  const midEyeY = (leftOuter.y + rightOuter.y) / 2;
  const headPitch = nose.y - midEyeY;

  // ── Confidence: z-depth spread as proxy ──
  const zSpread = Math.abs(lm[LEFT_IRIS[0]].z - lm[RIGHT_IRIS[0]].z);
  const confidence = Math.min(1, zSpread * 20 + 0.5);

  return { gazeX, gazeY, headYaw, headPitch, confidence };
}

interface UseFaceMeshOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onResults: (data: FaceLandmarkData) => void;
  enabled: boolean;
}

/**
 * Hook that sets up MediaPipe FaceMesh and runs it against a
 * <video> element at ~30fps via requestAnimationFrame.
 *
 * Returns `{ ready, error }`.
 */
export function useFaceMesh({ videoRef, onResults, enabled }: UseFaceMeshOptions) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceMeshRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  // Initialise FaceMesh once (dynamic import to avoid SSR / module issues)
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      try {
        // Dynamic import — @mediapipe/face_mesh is a UMD module
        const faceMeshModule = await import("@mediapipe/face_mesh");
        if (cancelled) return;

        const FaceMeshClass = faceMeshModule.FaceMesh ?? (faceMeshModule as any).default?.FaceMesh ?? (faceMeshModule as any).default;
        if (!FaceMeshClass) {
          throw new Error("Could not find FaceMesh constructor");
        }

        const fm = new FaceMeshClass({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        fm.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fm.onResults((results: any) => {
          const data = extractData(results);
          if (data) {
            onResultsRef.current(data);
          }
        });

        await fm.initialize();
        if (cancelled) { fm.close(); return; }

        faceMeshRef.current = fm;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error("FaceMesh init failed:", err);
        setError("Failed to initialise face tracking. Please reload and try again.");
      }
    })();

    return () => {
      cancelled = true;
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Processing loop — send video frames to FaceMesh
  const startProcessing = useCallback(() => {
    const video = videoRef.current;
    const fm = faceMeshRef.current;
    if (!video || !fm) return;

    let running = true;

    async function loop() {
      if (!running) return;
      const v = videoRef.current;
      const mesh = faceMeshRef.current;
      if (v && mesh && v.readyState >= 2) {
        try {
          await mesh.send({ image: v });
        } catch {
          // frame skipped
        }
      }
      if (running) {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  const stopProcessing = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  return { ready, error, startProcessing, stopProcessing };
}
