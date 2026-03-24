import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawMetrics, score, bacEstimate } = body as {
      rawMetrics: {
        pursuitGain: number;
        saccadeRate: number;
        positionError: number;
        gazeStability: number;
      };
      score: number;
      bacEstimate: number;
    };

    const systemPrompt = `You are an AI clinical analyst for the Woozy bar app. You receive eye tracking metrics from a smooth-pursuit test and make a determination about the person's impairment level.

METRICS EXPLANATION:
- Pursuit Gain: ratio of eye velocity to target velocity. Sober people score 0.7-1.0 on phone cameras (lower than lab equipment). Below 0.4 suggests impairment.
- Saccade Rate: catch-up eye movements per second. Normal on phone: 0-3/s. Above 6/s suggests impairment.
- Position Error: RMS distance between gaze and target (0-1 scale). Normal on phone: 0.03-0.15. Above 0.25 suggests impairment.
- Gaze Stability: variance of gaze velocity. Normal on phone: 0.05-0.5. Above 1.0 suggests impairment.

IMPORTANT CONTEXT:
- These measurements come from a phone camera, NOT lab equipment. Phone-based tracking is inherently noisy.
- A sober person on a phone will NOT have perfect metrics. Expect pursuit gain of 0.5-0.9 for sober users.
- Be LENIENT. Only flag someone as impaired if the metrics are clearly abnormal, not just slightly off.
- The estimated BAC from drink tracking is provided for context but should NOT be the primary factor.

Respond with ONLY a JSON object (no markdown):
{
  "verdict": "sober" | "slightly_impaired" | "impaired",
  "confidence": 0.0-1.0,
  "explanation": "1-2 sentence explanation for the user"
}`;

    const userMessage = `Eye tracking results:
- Pursuit Gain: ${rawMetrics.pursuitGain.toFixed(3)}
- Saccade Rate: ${rawMetrics.saccadeRate.toFixed(2)}/s
- Position Error: ${rawMetrics.positionError.toFixed(4)}
- Gaze Stability (velocity variance): ${rawMetrics.gazeStability.toFixed(4)}
- Computed impairment score: ${score}%
- Estimated BAC from drinks: ${bacEstimate.toFixed(3)}%

Based on these phone-based eye tracking metrics, what is your assessment?`;

    if (!process.env.OPENAI_API_KEY) {
      // Fallback rule-based if no API key
      const verdict = score >= 45 ? "impaired" : score >= 25 ? "slightly_impaired" : "sober";
      return NextResponse.json({
        verdict,
        confidence: 0.6,
        explanation: score >= 45
          ? "Your eye tracking shows notable difficulty following the target smoothly."
          : score >= 25
          ? "Your eye tracking shows some minor irregularities, but nothing conclusive."
          : "Your eye tracking looks normal. No signs of impairment detected.",
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json(parsed);
    } catch {
      // If GPT didn't return valid JSON, fallback
      return NextResponse.json({
        verdict: score >= 45 ? "impaired" : score >= 25 ? "slightly_impaired" : "sober",
        confidence: 0.5,
        explanation: raw || "Analysis complete.",
      });
    }
  } catch (error) {
    console.error("Eye analysis API error:", error);
    return NextResponse.json(
      { verdict: "sober", confidence: 0.3, explanation: "Unable to complete AI analysis." },
      { status: 200 },
    );
  }
}
