'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ImpairmentResult } from '@/lib/impairment-types';
import { Eye, Camera, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFaceMesh } from '@/hooks/useFaceMesh';
import { useFocusTest, getDotX, DOT_Y } from '@/hooks/useFocusTest';
import { DotTrackerCanvas } from './dot-tracker-canvas';

// ============================================================
// Eye Tracking Focus Check  (MediaPipe FaceMesh)
//
// Shows the camera feed so the user knows they're being scanned.
// Uses relative iris gaze for accurate tracking measurement.
// ============================================================

interface FocusCheckProps {
  onResult: (result: ImpairmentResult) => void;
  onCancel: () => void;
}

export function FocusCheck({ onResult, onCancel }: FocusCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    phase,
    progress,
    result,
    errorMsg,
    startCamera,
    startCalibration,
    recordFrame,
    cleanup,
    TEST_DURATION,
  } = useFocusTest();

  // Wire FaceMesh → recordFrame
  const { ready: meshReady, error: meshError, startProcessing, stopProcessing } = useFaceMesh({
    videoRef,
    onResults: recordFrame,
    enabled: phase === 'camera' || phase === 'calibrating' || phase === 'tracking',
  });

  // Once camera opens, kick off calibration once mesh is ready
  useEffect(() => {
    if (meshReady && (phase === 'camera')) {
      startCalibration();
    }
  }, [meshReady, phase, startCalibration]);

  // Start sending frames to FaceMesh while calibrating/tracking
  useEffect(() => {
    if (meshReady && (phase === 'calibrating' || phase === 'tracking')) {
      const stop = startProcessing();
      return () => { stop?.(); stopProcessing(); };
    }
  }, [meshReady, phase, startProcessing, stopProcessing]);

  // Clean up on unmount
  useEffect(() => () => { cleanup(); }, [cleanup]);

  // ---- Handlers ----
  const handleStart = useCallback(async () => {
    if (!videoRef.current) return;
    await startCamera(videoRef.current);
  }, [startCamera]);

  const handleCancel = useCallback(() => {
    cleanup();
    onCancel();
  }, [cleanup, onCancel]);

  function handleSubmit() {
    if (!result) return;
    cleanup();

    const impairmentResult: ImpairmentResult = {
      type: 'focus',
      rawMetrics: {
        pursuitGain: result.rawMetrics.pursuitGain,
        saccadeRate: result.rawMetrics.saccadeRate,
        positionError: result.rawMetrics.positionError,
        gazeStability: result.rawMetrics.gazeStability,
      },
      baselineDelta: result.score.focusDeltaPercent,
      impairmentContributionScore: result.score.focusDeltaPercent,
      completedAt: new Date().toISOString(),
    };
    onResult(impairmentResult);
  }

  // Current dot position for the canvas
  const elapsed = phase === 'tracking' ? (progress / 100) * TEST_DURATION : 0;
  const dotX = getDotX(elapsed);

  const combinedError = errorMsg || meshError;

  // Whether to show the camera preview (during active phases)
  const showCamera = phase === 'camera' || phase === 'calibrating' || phase === 'tracking';

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-background shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-primary/10">
              <Eye className="size-4 sm:size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base">Focus Check</h2>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Eye tracking analysis</p>
            </div>
          </div>
          <button onClick={handleCancel} className="p-1.5 rounded-full hover:bg-muted">
            <X className="size-4 sm:size-5 text-muted-foreground" />
          </button>
        </div>

        {/* Camera preview — shown during active phases */}
        <video
          ref={videoRef}
          className={showCamera
            ? "w-full h-40 sm:h-48 object-cover bg-black"
            : "hidden"
          }
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          muted
        />

        {/* --- Instructions Phase --- */}
        {phase === 'idle' && (
          <div className="px-4 py-6 sm:px-6 sm:py-8 space-y-5 sm:space-y-6 text-center overflow-y-auto">
            <div className="flex size-16 sm:size-20 mx-auto items-center justify-center rounded-full bg-primary/10">
              <Camera className="size-8 sm:size-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold">Follow the Moving Dot</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                A dot will move across the screen for {TEST_DURATION} seconds.
                Follow it with your eyes while keeping your head still.
                Hold your phone at arm&apos;s length.
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-[10px] sm:text-xs text-muted-foreground">
              <Eye className="size-3.5 shrink-0" />
              <span>Video is processed locally and never stored.</span>
            </div>

            {combinedError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{combinedError}</span>
              </div>
            )}

            <Button onClick={handleStart} className="w-full h-11 sm:h-12 rounded-xl" size="lg">
              <Camera className="mr-2 size-4 sm:size-5" />
              Start Focus Check
            </Button>
          </div>
        )}

        {/* --- Camera / Calibrating Phase --- */}
        {(phase === 'camera' || phase === 'calibrating') && (
          <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-3 text-center overflow-y-auto">
            <div className="mx-auto size-8 sm:size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-xs sm:text-sm font-medium animate-pulse">
              {phase === 'camera' ? 'Starting camera...' : 'Look straight ahead — calibrating...'}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Keep your face well-lit and centred in the preview.
            </p>
          </div>
        )}

        {/* --- Tracking Phase --- */}
        {phase === 'tracking' && (
          <div className="px-4 py-3 sm:px-6 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
            {/* Dot tracking area */}
            <div className="relative w-full h-24 sm:h-32 rounded-xl bg-muted/50 border overflow-hidden">
              <DotTrackerCanvas dotX={dotX} active />
              <p className="absolute bottom-1.5 sm:bottom-2 left-0 right-0 text-center text-[9px] sm:text-[10px] text-muted-foreground">
                Follow the dot with your eyes
              </p>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5 sm:h-2" />
            </div>
          </div>
        )}

        {/* --- Analyzing Phase --- */}
        {phase === 'analyzing' && (
          <div className="px-4 py-10 sm:px-6 sm:py-12 text-center space-y-4">
            <div className="mx-auto size-10 sm:size-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-xs sm:text-sm font-medium">Analysing eye tracking data...</p>
          </div>
        )}

        {/* --- Error Phase --- */}
        {phase === 'error' && (
          <div className="px-4 py-6 sm:px-6 sm:py-8 text-center space-y-4 overflow-y-auto">
            <AlertTriangle className="size-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{combinedError}</p>
            <Button variant="outline" onClick={handleCancel} className="w-full h-11 rounded-xl">
              Close
            </Button>
          </div>
        )}

        {/* --- Complete Phase --- */}
        {phase === 'complete' && result && (
          <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-3 sm:space-y-4 overflow-y-auto">
            <div className="flex items-center justify-center gap-2 text-emerald-500">
              <CheckCircle2 className="size-5 sm:size-6" />
              <span className="font-bold text-sm sm:text-base">Focus Check Complete</span>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <Card>
                <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">Pursuit Gain</span>
                  <span className="font-bold text-sm">{result.rawMetrics.pursuitGain.toFixed(2)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">Saccade Rate</span>
                  <span className="font-bold text-sm">{result.rawMetrics.saccadeRate.toFixed(1)}/s</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">Position Error</span>
                  <span className="font-bold text-sm">{result.rawMetrics.positionError.toFixed(3)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">Gaze Stability</span>
                  <span className="font-bold text-sm">{result.rawMetrics.gazeStability.toFixed(3)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">Impairment Score</span>
                  <span className="font-bold text-sm">{result.score.focusDeltaPercent}%</span>
                </CardContent>
              </Card>
              <Card className={result.score.focusDeltaPercent >= 40 ? 'border-rose-500/30' : result.score.focusDeltaPercent >= 25 ? 'border-amber-500/30' : 'border-emerald-500/30'}>
                <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium">Impairment Level</span>
                  <span className={`text-base sm:text-lg font-bold ${
                    result.score.focusDeltaPercent >= 40 ? 'text-rose-500' :
                    result.score.focusDeltaPercent >= 25 ? 'text-amber-500' :
                    result.score.focusDeltaPercent >= 10 ? 'text-yellow-500' : 'text-emerald-500'
                  }`}>
                    {result.score.focusDeltaPercent >= 40 ? 'Strong' :
                     result.score.focusDeltaPercent >= 25 ? 'Elevated' :
                     result.score.focusDeltaPercent >= 10 ? 'Mild' : 'Minimal'}
                  </span>
                </CardContent>
              </Card>
            </div>

            <Button onClick={handleSubmit} className="w-full h-11 sm:h-12 rounded-xl" size="lg">
              <CheckCircle2 className="mr-2 size-4 sm:size-5" />
              Submit Results
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
