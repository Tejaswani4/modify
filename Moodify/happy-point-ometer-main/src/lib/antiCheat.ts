// Anti-cheat: cooldowns + perceptual hashing of snapshots
const COOLDOWN_MS = 5_000;

export const ANTI_CHEAT = {
  COOLDOWN_MS,
  MIN_CONFIDENCE: 0.55,
  MIN_HAPPINESS_FOR_POINTS: 0.15,
  HASH_DUPE_WINDOW_MS: 60_000,
};

export function checkCooldown(lastAt: number | null): { ok: boolean; remainingMs: number } {
  if (!lastAt) return { ok: true, remainingMs: 0 };
  const elapsed = Date.now() - lastAt;
  if (elapsed >= COOLDOWN_MS) return { ok: true, remainingMs: 0 };
  return { ok: false, remainingMs: COOLDOWN_MS - elapsed };
}

// Average-hash style perceptual hash from a video element. 8x8 grayscale -> 64-bit string.
export async function perceptualHash(video: HTMLVideoElement): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const grays: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const avg = grays.reduce((a, b) => a + b, 0) / grays.length;
  return grays.map((g) => (g > avg ? "1" : "0")).join("");
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// Confidence from raw expression vector — penalize when no dominant emotion is present.
export function computeConfidence(happy: number, sad: number, neutral: number, surprised: number): number {
  const max = Math.max(happy, sad, neutral, surprised);
  const sum = happy + sad + neutral + surprised || 1;
  // Concentration = how peaked the distribution is. Range ~0.25 (uniform) to 1 (one-hot).
  return Math.min(1, (max / sum) * 1.1);
}
