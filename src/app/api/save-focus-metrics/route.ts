import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate expected shape — only accept derived metrics, never raw video
    const {
      sessionId,
      pursuitGain,
      saccadeRate,
      positionError,
      gazeStability,
      focusDeltaPercent,
      impairmentContributionScore,
    } = body;

    if (!sessionId || typeof focusDeltaPercent !== "number") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // For now, log to server console.
    // In production, persist to Supabase or another store.
    console.log("[save-focus-metrics]", {
      sessionId,
      pursuitGain,
      saccadeRate,
      positionError,
      gazeStability,
      focusDeltaPercent,
      impairmentContributionScore,
      savedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
