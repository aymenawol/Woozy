"use client";

import { useMemo } from "react";
import { ActiveSession } from "@/lib/types";
import { estimateBAC, bacRiskLevel, formatBAC } from "@/lib/bac";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddDrinkPanel } from "@/components/bartender/add-drink-panel";
import { cn } from "@/lib/utils";


interface SessionDetailProps {
  session: ActiveSession;
  onEndSession: (sessionId: string) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionDetail({ session, onEndSession }: SessionDetailProps) {
  const { customer, drinks } = session;
  const bac = estimateBAC(drinks, customer.weight_lbs, customer.gender);
  const risk = bacRiskLevel(bac);

  // Sort drinks newest first
  const sortedDrinks = [...drinks].sort(
    (a, b) =>
      new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()
  );

  // BAC as percentage of 0.15 for the progress bar (cap at 100)
  const bacPercent = Math.min((bac / 0.15) * 100, 100);

  // Session duration
  const durationStr = useMemo(() => {
    const mins = Math.floor(
      (Date.now() - new Date(session.started_at).getTime()) / 60000
    );
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [session.started_at]);

  return (
    <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight truncate sm:text-2xl">
            {customer.name}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Started {formatTime(session.started_at)} ·{" "}
            {customer.weight_lbs} lbs · {customer.gender}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onEndSession(session.id)}
          >
            End Session
          </Button>
        </div>
      </div>

      {/* BAC — primary stat */}
      <Card
        className={cn(
          risk === "danger" && "border-destructive",
          risk === "caution" && "border-yellow-500"
        )}
      >
        <CardContent className="py-4 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider sm:text-xs">
                Estimated BAC
              </p>
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums sm:text-4xl",
                  risk === "danger" && "text-destructive",
                  risk === "caution" && "text-yellow-600"
                )}
              >
                {formatBAC(bac)}
              </span>
            </div>
            {/* Secondary stats inline */}
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  Drinks
                </p>
                <span className="text-base font-semibold tabular-nums sm:text-lg">
                  {drinks.length}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  Duration
                </p>
                <span className="text-base font-semibold tabular-nums sm:text-lg">
                  {durationStr}
                </span>
              </div>
            </div>
          </div>
          <Progress
            value={bacPercent}
            className={cn(
              "mt-3 h-2",
              risk === "danger" && "[&>[data-slot=indicator]]:bg-destructive",
              risk === "caution" && "[&>[data-slot=indicator]]:bg-yellow-500"
            )}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            0.08% legal limit
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Add Drink */}
      <AddDrinkPanel sessionId={session.id} />

      <Separator />

      {/* Drink History */}
      <div className="flex flex-col gap-2 overflow-hidden min-h-0 flex-1">
        <h2 className="text-sm font-semibold tracking-tight">Drink History</h2>
        <ScrollArea className="flex-1">
          <div className="space-y-2 pb-4">
            {sortedDrinks.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No drinks ordered yet
              </p>
            )}
            {sortedDrinks.map((drink) => (
              <div
                key={drink.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{drink.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {drink.volume_ml}ml · {drink.abv}% ABV
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(drink.ordered_at)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
