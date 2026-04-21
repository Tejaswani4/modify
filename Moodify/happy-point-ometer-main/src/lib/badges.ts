export type BadgeDef = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  check: (stats: BadgeStats) => boolean;
};

export type BadgeStats = {
  totalSmiles: number;
  ecstaticCount: number;
  currentStreak: number;
  bestStreak: number;
  happinessScore: number;
  uniqueDays: number;
  totalPoints: number;
};

export const BADGES: BadgeDef[] = [
  { id: "first_smile", name: "First Smile", emoji: "🌱", description: "Capture your first smile", check: (s) => s.totalSmiles >= 1 },
  { id: "smile_10", name: "Getting Warm", emoji: "🔥", description: "Capture 10 smiles", check: (s) => s.totalSmiles >= 10 },
  { id: "smile_50", name: "Smile Veteran", emoji: "🏅", description: "Capture 50 smiles", check: (s) => s.totalSmiles >= 50 },
  { id: "smile_100", name: "Century Smiler", emoji: "💯", description: "100 smiles captured", check: (s) => s.totalSmiles >= 100 },
  { id: "ecstatic_5", name: "Pure Joy", emoji: "🤩", description: "5 ecstatic smiles", check: (s) => s.ecstaticCount >= 5 },
  { id: "ecstatic_25", name: "Joy Machine", emoji: "✨", description: "25 ecstatic smiles", check: (s) => s.ecstaticCount >= 25 },
  { id: "streak_3", name: "On a Roll", emoji: "🎯", description: "3-smile streak", check: (s) => s.bestStreak >= 3 },
  { id: "streak_7", name: "Week of Joy", emoji: "🌟", description: "7-smile streak", check: (s) => s.bestStreak >= 7 },
  { id: "streak_15", name: "Unstoppable", emoji: "⚡", description: "15-smile streak", check: (s) => s.bestStreak >= 15 },
  { id: "happiness_75", name: "Sunny Soul", emoji: "☀️", description: "Happiness Score above 75", check: (s) => s.happinessScore >= 75 },
  { id: "happiness_90", name: "Radiant", emoji: "🌞", description: "Happiness Score above 90", check: (s) => s.happinessScore >= 90 },
  { id: "loyal_3d", name: "Loyal Smiler", emoji: "💖", description: "Smiled on 3 different days", check: (s) => s.uniqueDays >= 3 },
  { id: "loyal_7d", name: "Daily Joy", emoji: "🗓️", description: "Smiled on 7 different days", check: (s) => s.uniqueDays >= 7 },
  { id: "rich_1k", name: "1K Club", emoji: "💎", description: "Earn 1,000 total points", check: (s) => s.totalPoints >= 1000 },
  { id: "rich_5k", name: "Smile Tycoon", emoji: "👑", description: "Earn 5,000 total points", check: (s) => s.totalPoints >= 5000 },
];

export function computeEarnedBadges(stats: BadgeStats): string[] {
  return BADGES.filter((b) => b.check(stats)).map((b) => b.id);
}

export function getBadgeDef(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}
