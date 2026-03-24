import { NextRequest, NextResponse } from "next/server";

function getRuleBasedVerdict(avgTime: number, missRate: number, variance: number) {
  // Simple scoring
  let score = 0;
  if (avgTime <= 200) score = 0;
  else if (avgTime >= 1200) score = 100;
  else score = ((avgTime - 200) / 1000) * 100;

  score = score * 0.5 + Math.min(missRate / 0.5, 1) * 100 * 0.3 + (variance > 50 ? Math.min((variance - 50) / 250, 1) * 100 : 0) * 0.2;
  score = Math.round(score);

  const verdict = score >= 45 ? "impaired" : score >= 25 ? "slightly_impaired" : "sober";
  return {
    verdict,
    confidence: 0.6,
    explanation: score >= 45
      ? "Your reaction times are significantly slower than expected."
      : score >= 25
      ? "Your reactions show some slowing, but results aren't conclusive."
      : "Your reaction times look normal. No signs of impairment detected.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { avgReactionTime, missRate, variance, totalRounds, hits } = body as {
      avgReactionTime: number;
      missRate: number;
      variance: number;
      totalRounds: number;
      hits: number;
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(getRuleBasedVerdict(avgReactionTime, missRate, variance));
    }

    const systemPrompt = `You are an AI clinical analyst for the Woozy bar app. You receive reaction time test results and assess impairment level.

METRICS:
- Average reaction time: typical sober person on phone is 250-400ms. Above 600ms suggests impairment.
- Miss rate: percentage of targets missed. Below 10% is normal. Above 25% suggests impairment.
- Variance (std dev): consistency of reaction times. Below 80ms is normal. Above 200ms suggests impairment.

CONTEXT:
- This is a phone-based tap test, not a lab. Expect some noise.
- Be LENIENT. Only flag impairment if results are clearly abnormal.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "verdict": "sober" | "slightly_impaired" | "impaired",
  "confidence": 0.0-1.0,
  "explanation": "1-2 sentence explanation for the user"
}`;

    const userMessage = `Reaction test results:
- Average reaction time: ${avgReactionTime.toFixed(0)} ms
- Miss rate: ${(missRate * 100).toFixed(1)}% (${hits}/${totalRounds} hits)
- Reaction time std dev: ${variance.toFixed(0)} ms

Based on these results, what is your assessment?`;

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch (aiError) {
      console.error("OpenAI call failed for reaction analysis:", aiError);
      return NextResponse.json(getRuleBasedVerdict(avgReactionTime, missRate, variance));
    }
  } catch (error) {
    console.error("Reaction analysis API error:", error);
    return NextResponse.json(getRuleBasedVerdict(400, 0, 80));
  }
}
