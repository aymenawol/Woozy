import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  let parsedMessages: ChatMessage[] = [];
  let parsedCtx: Record<string, unknown> = {};
  let parsedFirstName = "friend";

  try {
    const body = await req.json();
    const {
      messages,
      sessionContext,
    }: {
      messages: ChatMessage[];
      sessionContext: {
        name: string;
        bac: number;
        drinkCount: number;
        drinks: { name: string; volume_ml: number; abv: number }[];
        hours: number;
        riskLevel: string;
        gender: string;
        weightLbs: number;
        hoursUntilSober: number;
        pacing: number;
      };
    } = body;

    const ctx = sessionContext;
    const firstName = ctx.name?.split(" ")[0] || "friend";

    // Save for catch-block fallback
    parsedMessages = messages;
    parsedCtx = ctx;
    parsedFirstName = firstName;

    const drinkSummary = ctx.drinks
      .map((d) => `${d.name} (${d.volume_ml}ml, ${d.abv}% ABV)`)
      .join(", ");

    const soberByEstimate = ctx.hoursUntilSober > 0
      ? `approximately ${ctx.hoursUntilSober} hours from now`
      : "already at or near 0";

    const systemPrompt = `You are Breathy, a witty and caring AI breathalyzer buddy built into the Woozy bar app. You're chatting with a customer at the end of their drinking session. This is a CONVERSATION — they can ask you questions and you respond naturally.

PERSONALITY:
- Warm but direct — concerned best friend who's also hilarious
- Casual language, light humor, occasional emoji
- NEVER encourage more drinking
- If they ask "can I drive?" and BAC ≥ 0.08 → be firm: absolutely not
- If they ask "can I drive?" and BAC 0.05-0.08 → strongly recommend waiting
- If BAC < 0.05 → they're probably fine but suggest water and a snack first

SESSION DATA (use these EXACT numbers, don't make up new ones):
- Customer: ${firstName} (${ctx.gender}, ${ctx.weightLbs} lbs)
- Drinks consumed: ${ctx.drinkCount} (${drinkSummary || "none"})
- Session duration: ${ctx.hours.toFixed(1)} hours
- Pacing: ${ctx.pacing.toFixed(1)} drinks/hr
- Estimated BAC: ${ctx.bac.toFixed(3)}%
- Risk level: ${ctx.riskLevel}
- Estimated sober by: ${soberByEstimate}
- BAC metabolism rate: ~0.015% per hour

RULES:
- Keep responses SHORT (2-4 sentences max per message)
- Address them by first name
- If they ask how long until sober, use the hoursUntilSober data
- If they ask about specific drinks, reference the actual drink list
- You know math — if they ask about BAC calculations, explain simply
- Always prioritize safety over humor when BAC is high
- On your FIRST message, give a quick overview of their session and how they're doing`;

    // If no OpenAI key, use the rule-based chat
    if (!process.env.OPENAI_API_KEY) {
      const reply = generateRuleBasedReply(messages, ctx, firstName);
      return NextResponse.json({ reply });
    }

    const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      max_tokens: 250,
      temperature: 0.8,
    });

    const reply = completion.choices[0]?.message?.content
      ?? generateRuleBasedReply(messages, ctx, firstName);

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Breathy API error:", error instanceof Error ? error.message : error);

    // Fall back to rule-based reply instead of generic error
    try {
      const fallback = generateRuleBasedReply(
        parsedMessages,
        parsedCtx as Parameters<typeof generateRuleBasedReply>[1],
        parsedFirstName
      );
      return NextResponse.json({ reply: fallback });
    } catch {
      return NextResponse.json({
        reply: "Oops, Breathy glitched for a sec 😅 But real talk — make sure you have a safe ride home tonight. What else can I help with?",
      });
    }
  }
}

// ---- Rule-based fallback chat (no API key needed) ----
function generateRuleBasedReply(
  messages: ChatMessage[],
  ctx: { bac: number; drinkCount: number; hours: number; hoursUntilSober: number; riskLevel: string; pacing: number; drinks: { name: string }[] },
  firstName: string
): string {
  const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content?.toLowerCase() ?? "";
  const isFirstMessage = messages.length <= 1;

  // First message = session overview
  if (isFirstMessage) {
    if (ctx.drinkCount === 0) {
      return `Hey ${firstName}! 👋 Looks like you kept it clean tonight — zero drinks on the record. Designated driver vibes! You're good to go whenever you want.`;
    }
    if (ctx.bac < 0.05) {
      return `Hey ${firstName}! 😊 You had ${ctx.drinkCount} drink${ctx.drinkCount > 1 ? "s" : ""} over ${ctx.hours.toFixed(1)} hours — your BAC is at ${ctx.bac.toFixed(3)}%. You're looking pretty good! How are you feeling?`;
    }
    if (ctx.bac < 0.08) {
      return `Hey ${firstName}! 🫣 ${ctx.drinkCount} drinks in ${ctx.hours.toFixed(1)} hours puts your BAC at ${ctx.bac.toFixed(3)}%. That's in the caution zone. Do you have a ride home lined up?`;
    }
    return `${firstName}, real talk time. 🛑 Your BAC is ${ctx.bac.toFixed(3)}% after ${ctx.drinkCount} drinks — that's above the legal limit. Please do not drive. Do you have a safe ride home?`;
  }

  // Drive / driving questions
  if (lastUserMsg.match(/\b(drive|driving|car|behind the wheel)\b/)) {
    if (ctx.bac >= 0.08) {
      return `Absolutely not, ${firstName}. 🛑 Your BAC is ${ctx.bac.toFixed(3)}% — that's over the legal limit. Please call an Uber, Lyft, or a friend. No exceptions.`;
    }
    if (ctx.bac >= 0.05) {
      return `I'd really recommend waiting, ${firstName}. Your BAC is ${ctx.bac.toFixed(3)}% — you should be good in about ${ctx.hoursUntilSober} hours. Can you get a ride for now?`;
    }
    return `You're at ${ctx.bac.toFixed(3)}% which is under the limit. You're probably fine, but grab some water and a snack first. Trust your gut — if you feel off, get a ride. 🚗`;
  }

  // Sober / how long questions
  if (lastUserMsg.match(/\b(sober|how long|when can i|time|wait|hours)\b/)) {
    if (ctx.bac <= 0.01) {
      return `You're basically sober right now, ${firstName}! Your BAC is ${ctx.bac.toFixed(3)}%. You're good to go. 🌟`;
    }
    return `Your body burns off about 0.015% per hour. At ${ctx.bac.toFixed(3)}%, you should be back to zero in roughly ${ctx.hoursUntilSober} hours. Drink water and eat something — it won't speed things up, but you'll feel better! 💧`;
  }

  // Feeling / how am i questions
  if (lastUserMsg.match(/\b(feel|feeling|how am i|drunk|wasted|buzzed|tipsy)\b/)) {
    if (ctx.bac < 0.03) return `At ${ctx.bac.toFixed(3)}%, you're barely buzzed. You might feel completely normal! 😌`;
    if (ctx.bac < 0.06) return `At ${ctx.bac.toFixed(3)}%, you're probably feeling relaxed, maybe a bit chatty. Your judgment is slightly affected but you're in okay shape. 😊`;
    if (ctx.bac < 0.08) return `At ${ctx.bac.toFixed(3)}%, you're definitely feeling it — lowered inhibitions, slower reactions. Be careful out there, ${firstName}. 🫣`;
    return `At ${ctx.bac.toFixed(3)}%, ${firstName}, you're impaired. Coordination, judgment, reaction time — all taking a hit. Please get a safe ride. 🛑`;
  }

  // What did I drink
  if (lastUserMsg.match(/\b(what did i|my drinks|what i had|drink list)\b/)) {
    if (ctx.drinkCount === 0) return `You didn't have anything tonight! Squeaky clean. 🧊`;
    const drinkNames = ctx.drinks.map((d) => d.name).join(", ");
    return `Tonight you had: ${drinkNames}. That's ${ctx.drinkCount} drink${ctx.drinkCount > 1 ? "s" : ""} over ${ctx.hours.toFixed(1)} hours (${ctx.pacing.toFixed(1)}/hr). 🍹`;
  }

  // Yes / ride confirmation
  if (lastUserMsg.match(/\b(yes|yeah|yep|uber|lyft|ride|taxi|cab|friend|walking)\b/)) {
    if (ctx.bac >= 0.08) return `Good, I'm glad to hear that. 💛 Seriously, ${firstName} — tonight was fun but getting home safe is what matters. Drink some water and take it easy!`;
    return `Awesome! 💛 Glad you're being smart about it. Have a great rest of your night, ${firstName}!`;
  }

  // No / negative
  if (lastUserMsg.match(/^(no|nah|nope|not yet|i don't)\b/)) {
    if (ctx.bac >= 0.08) return `${firstName}, please figure out a ride before you leave. At ${ctx.bac.toFixed(3)}%, driving is not an option. Can you call someone or open the Uber app? 🚕`;
    if (ctx.bac >= 0.05) return `I'd strongly suggest getting a ride, ${firstName}. You're at ${ctx.bac.toFixed(3)}% — it's not worth the risk. 🚕`;
    return `No worries! Just making sure you're all set. Anything else you wanna know before you head out?`;
  }

  // Default / catch-all
  const tips = [
    `Anything else you wanna know? I can tell you when you'll be sober, how your pacing was, or just chat. 😊`,
    `I'm here if you have questions! Try asking me "can I drive?" or "how long until I'm sober?" 🧪`,
    `${firstName}, if you're ready to go, just hit the close button. Otherwise, ask me anything about your session!`,
  ];
  return tips[messages.length % tips.length];
}
