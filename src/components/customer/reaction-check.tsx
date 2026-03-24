'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ImpairmentResult } from '@/lib/impairment-types';
import { Zap, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

// ============================================================
// Reaction Check — Tap the target as fast as you can
//
// A coloured circle appears at random positions on screen.
// User taps/clicks it. We measure reaction time, miss rate,
// and variance. Runs for ~20 seconds (or N rounds).
// ============================================================

const TOTAL_ROUNDS = 12;
const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 2500;
const TARGET_TIMEOUT_MS = 3000; // miss if not tapped within this
const TEST_DURATION_LABEL = '20 sec';

type Phase = 'idle' | 'countdown' | 'running' | 'complete';

interface ReactionCheckProps {
  onResult: (result: ImpairmentResult) => void;
  onCancel: () => void;
}

interface RoundResult {
  reactionTime: number | null; // null = miss
  appeared: number; // timestamp
}

interface AIVerdict {
  verdict: 'sober' | 'slightly_impaired' | 'impaired';
  confidence: number;
  explanation: string;
}

export function ReactionCheck({ onResult, onCancel }: ReactionCheckProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [round, setRound] = useState(0);
  const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null);
  const [targetColor, setTargetColor] = useState('#3b82f6');
  const [showTarget, setShowTarget] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [tooEarly, setTooEarly] = useState(false);
  const [aiVerdict, setAiVerdict] = useState<AIVerdict | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const targetAppearedRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const roundRef = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);

  const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

  // Clean up timers on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const showNextTarget = useCallback(() => {
    if (roundRef.current >= TOTAL_ROUNDS) {
      setShowTarget(false);
      setPhase('complete');
      return;
    }

    setShowTarget(false);
    setTooEarly(false);

    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    timeoutRef.current = setTimeout(() => {
      // Random position (keep target away from edges)
      const x = 15 + Math.random() * 70; // 15% to 85%
      const y = 15 + Math.random() * 70;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      setTargetPos({ x, y });
      setTargetColor(color);
      setShowTarget(true);
      targetAppearedRef.current = performance.now();

      // Auto-miss after timeout
      timeoutRef.current = setTimeout(() => {
        setResults((prev) => [...prev, { reactionTime: null, appeared: targetAppearedRef.current }]);
        roundRef.current++;
        setRound(roundRef.current);
        showNextTarget();
      }, TARGET_TIMEOUT_MS);
    }, delay);
  }, []);

  const handleStart = useCallback(() => {
    setPhase('countdown');
    setCountdown(3);
    setResults([]);
    roundRef.current = 0;
    setRound(0);

    let count = 3;
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setPhase('running');
        showNextTarget();
      }
    }, 1000);
  }, [showNextTarget]);

  const handleTapTarget = useCallback(() => {
    if (!showTarget) return;

    const rt = performance.now() - targetAppearedRef.current;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setResults((prev) => [...prev, { reactionTime: rt, appeared: targetAppearedRef.current }]);
    setShowTarget(false);
    roundRef.current++;
    setRound(roundRef.current);
    showNextTarget();
  }, [showTarget, showNextTarget]);

  const handleTapArea = useCallback(() => {
    // Tapped the area but not the target — show "too early" if target isn't showing
    if (phase === 'running' && !showTarget) {
      setTooEarly(true);
      setTimeout(() => setTooEarly(false), 600);
    }
  }, [phase, showTarget]);

  // ---- AI Verdict on complete ----
  useEffect(() => {
    if (phase !== 'complete' || results.length === 0 || aiVerdict || aiLoading) return;

    const hits = results.filter((r) => r.reactionTime !== null);
    const misses = results.filter((r) => r.reactionTime === null);
    const times = hits.map((r) => r.reactionTime!);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 3000;
    const missRate = misses.length / results.length;
    const variance = times.length > 1
      ? Math.sqrt(times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / (times.length - 1))
      : 0;

    setAiLoading(true);
    fetch('/api/reaction-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avgReactionTime: avgTime, missRate, variance, totalRounds: results.length, hits: hits.length }),
    })
      .then((r) => r.json())
      .then((data: AIVerdict) => setAiVerdict(data))
      .catch(() => {
        // Fallback rule-based
        const score = computeReactionScore(avgTime, missRate, variance);
        setAiVerdict({
          verdict: score >= 45 ? 'impaired' : score >= 25 ? 'slightly_impaired' : 'sober',
          confidence: 0.5,
          explanation: score >= 45
            ? 'Your reaction times suggest possible impairment.'
            : score >= 25
            ? 'Your reactions show some slowing but nothing conclusive.'
            : 'Your reaction times look normal.',
        });
      })
      .finally(() => setAiLoading(false));
  }, [phase, results, aiVerdict, aiLoading]);

  function handleSubmit() {
    const hits = results.filter((r) => r.reactionTime !== null);
    const misses = results.filter((r) => r.reactionTime === null);
    const times = hits.map((r) => r.reactionTime!);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 3000;
    const missRate = misses.length / results.length;
    const variance = times.length > 1
      ? Math.sqrt(times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / (times.length - 1))
      : 0;

    let score = computeReactionScore(avgTime, missRate, variance);

    // Adjust by AI verdict
    if (aiVerdict) {
      if (aiVerdict.verdict === 'sober') score = Math.min(score, 15);
      else if (aiVerdict.verdict === 'slightly_impaired') score = Math.max(20, Math.min(score, 45));
    }

    onResult({
      type: 'reaction',
      rawMetrics: {
        averageReactionTime: avgTime,
        missRate,
        reactionVariance: variance,
      },
      baselineDelta: score,
      impairmentContributionScore: score,
      completedAt: new Date().toISOString(),
    });
  }

  const progress = (round / TOTAL_ROUNDS) * 100;

  const verdictColor = aiVerdict?.verdict === 'sober' ? 'text-emerald-500' :
    aiVerdict?.verdict === 'slightly_impaired' ? 'text-amber-500' : 'text-destructive';
  const verdictLabel = aiVerdict?.verdict === 'sober' ? 'No Impairment Detected' :
    aiVerdict?.verdict === 'slightly_impaired' ? 'Mild Signs Detected' : 'Possible Impairment';

  // Compute display stats
  const hits = results.filter((r) => r.reactionTime !== null);
  const times = hits.map((r) => r.reactionTime!);
  const avgDisplay = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-background shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Zap className="size-4 sm:size-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base">Reaction Check</h2>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Tap the target as fast as you can</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-muted">
            <X className="size-4 sm:size-5 text-muted-foreground" />
          </button>
        </div>

        {/* --- Instructions Phase --- */}
        {phase === 'idle' && (
          <div className="px-4 py-6 sm:px-6 sm:py-8 space-y-5 sm:space-y-6 text-center overflow-y-auto">
            <div className="flex size-16 sm:size-20 mx-auto items-center justify-center rounded-full bg-amber-500/10">
              <Zap className="size-8 sm:size-10 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold">Tap the Circles</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Coloured circles will appear at random positions. Tap each one as quickly as you can.
                There are {TOTAL_ROUNDS} rounds — try not to miss any!
              </p>
            </div>

            <Button onClick={handleStart} className="w-full h-11 sm:h-12 rounded-xl" size="lg">
              <Zap className="mr-2 size-4 sm:size-5" />
              Start Reaction Check
            </Button>
          </div>
        )}

        {/* --- Countdown Phase --- */}
        {phase === 'countdown' && (
          <div className="px-4 py-12 sm:px-6 sm:py-16 text-center">
            <div className="text-6xl font-bold text-primary animate-pulse">{countdown}</div>
            <p className="text-sm text-muted-foreground mt-3">Get ready...</p>
          </div>
        )}

        {/* --- Running Phase --- */}
        {phase === 'running' && (
          <div className="flex flex-col overflow-hidden">
            {/* Tap area */}
            <div
              ref={areaRef}
              className="relative w-full h-72 sm:h-80 bg-muted/30 select-none touch-none"
              onClick={handleTapArea}
            >
              {showTarget && targetPos && (
                <button
                  className="absolute size-16 sm:size-20 rounded-full shadow-lg active:scale-90 transition-transform duration-75 animate-in fade-in zoom-in-50"
                  style={{
                    left: `${targetPos.x}%`,
                    top: `${targetPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: targetColor,
                  }}
                  onClick={(e) => { e.stopPropagation(); handleTapTarget(); }}
                />
              )}
              {!showTarget && !tooEarly && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground animate-pulse">Wait for the circle...</p>
                </div>
              )}
              {tooEarly && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-amber-500 font-medium">Too early! Wait for the circle.</p>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="px-4 py-3 sm:px-6 space-y-1 border-t">
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>Round {round}/{TOTAL_ROUNDS}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5 sm:h-2" />
            </div>
          </div>
        )}

        {/* --- Complete Phase --- */}
        {phase === 'complete' && (
          <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-3 sm:space-y-4 overflow-y-auto">
            {/* AI Verdict */}
            {aiLoading ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-sm font-medium">AI is analysing your results...</span>
              </div>
            ) : aiVerdict ? (
              <Card className={
                aiVerdict.verdict === 'sober' ? 'border-emerald-500/30 bg-emerald-500/5' :
                aiVerdict.verdict === 'slightly_impaired' ? 'border-amber-500/30 bg-amber-500/5' :
                'border-destructive/30 bg-destructive/5'
              }>
                <CardContent className="p-3 sm:p-4 text-center space-y-1">
                  <p className={`text-lg sm:text-xl font-bold ${verdictColor}`}>{verdictLabel}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{aiVerdict.explanation}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-500">
                <CheckCircle2 className="size-5 sm:size-6" />
                <span className="font-bold text-sm sm:text-base">Reaction Check Complete</span>
              </div>
            )}

            {/* Stats */}
            <details className="group" open>
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                View stats
              </summary>
              <div className="mt-2 space-y-1.5">
                <Card>
                  <CardContent className="p-2 sm:p-2.5 flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Avg Reaction Time</span>
                    <span className="font-bold text-xs sm:text-sm">{avgDisplay} ms</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-2.5 flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Hits / Misses</span>
                    <span className="font-bold text-xs sm:text-sm">{hits.length} / {results.length - hits.length}</span>
                  </CardContent>
                </Card>
              </div>
            </details>

            <Button
              onClick={handleSubmit}
              className="w-full h-11 sm:h-12 rounded-xl"
              size="lg"
              disabled={aiLoading}
            >
              <CheckCircle2 className="mr-2 size-4 sm:size-5" />
              Submit Results
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Score reaction metrics to a 0–100 impairment percentage. */
function computeReactionScore(avgTime: number, missRate: number, variance: number): number {
  // avgTime scoring: 200ms→0, 500ms→30, 800ms→60, 1200ms+→100
  let timeScore = 0;
  if (avgTime <= 200) timeScore = 0;
  else if (avgTime >= 1200) timeScore = 100;
  else timeScore = ((avgTime - 200) / 1000) * 100;

  // missRate scoring: 0→0, 0.25→40, 0.5+→100
  let missScore = Math.min(missRate / 0.5, 1) * 100;

  // variance scoring: <50ms→0, >300ms→100
  let varScore = 0;
  if (variance <= 50) varScore = 0;
  else if (variance >= 300) varScore = 100;
  else varScore = ((variance - 50) / 250) * 100;

  // Weighted combination
  return Math.round(timeScore * 0.50 + missScore * 0.30 + varScore * 0.20);
}
