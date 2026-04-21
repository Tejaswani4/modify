import type { LiveExpression } from "@/hooks/useSmileCamera";

export type Mood = "ecstatic" | "happy" | "neutral" | "sad" | "angry";

export function moodFor(e: { happy: number; sad: number; angry?: number }): Mood {
  if (e.happy >= 0.85) return "ecstatic";
  if (e.happy >= 0.5) return "happy";
  if ((e.angry ?? 0) >= 0.4) return "angry";
  if (e.sad >= 0.4) return "sad";
  return "neutral";
}

export function pointsFor(happiness: number, mood: Mood, streak: number, confidence: number): number {
  const base = Math.round(happiness * 100 * confidence);
  const moodBonus =
    mood === "ecstatic" ? 50 : mood === "happy" ? 20 : mood === "sad" ? -10 : mood === "angry" ? -15 : 0;
  const streakBonus = Math.min(streak * 5, 100);
  const jitter = Math.floor(Math.random() * 15);
  return Math.max(1, base + moodBonus + streakBonus + jitter);
}

// Happiness Score: weighted recent-bias 0..100
export function computeHappinessScore(recent: { happiness: number; createdAt: string | number }[]): number {
  if (recent.length === 0) return 0;
  const now = Date.now();
  let weightSum = 0;
  let valSum = 0;
  for (const r of recent) {
    const t = typeof r.createdAt === "string" ? new Date(r.createdAt).getTime() : r.createdAt;
    const ageDays = Math.max(0, (now - t) / 86_400_000);
    const w = Math.exp(-ageDays / 3); // half-life ~2 days
    weightSum += w;
    valSum += w * r.happiness;
  }
  return Math.round((valSum / weightSum) * 100);
}

export function describeExpression(e: LiveExpression) {
  return {
    happy: e.happy,
    sad: e.sad,
    neutral: e.neutral,
    surprised: e.surprised,
    angry: 0,
  };
}
