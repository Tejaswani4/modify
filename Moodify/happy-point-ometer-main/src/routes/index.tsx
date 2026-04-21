import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useSmileCamera } from "@/hooks/useSmileCamera";
import { useSmileCloud, type SmileRow, type ProfileRow } from "@/hooks/useSmileCloud";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SmileMeter } from "@/components/SmileMeter";
import { GlobalLeaderboard } from "@/components/GlobalLeaderboard";
import { EmojiRain } from "@/components/EmojiRain";
import { BadgesDisplay, NewBadgeToast } from "@/components/BadgesDisplay";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { MoodCoach } from "@/components/MoodCoach";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { playCapture, playSad } from "@/lib/sound";
import { moodFor, pointsFor, computeHappinessScore, type Mood } from "@/lib/scoring";
import { ANTI_CHEAT, checkCooldown, perceptualHash, hammingDistance, computeConfidence } from "@/lib/antiCheat";
import { computeEarnedBadges, type BadgeStats } from "@/lib/badges";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [camOn, setCamOn] = useState(true);
  const { videoRef, ready, error, expr, capture } = useSmileCamera(camOn);
  const { uploadSnapshot, insertSmile, updateProfile } = useSmileCloud();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [smiles, setSmiles] = useState<SmileRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [flash, setFlash] = useState<{ pts: number; mood: Mood } | null>(null);
  const [shake, setShake] = useState(false);
  const [busyCapture, setBusyCapture] = useState(false);
  const recentHashes = useRef<{ hash: string; t: number }[]>([]);

  // Redirect to /auth if not signed in (after auth load resolves)
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  // Load profile + smiles
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const [{ data: prof }, { data: smileRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("smiles").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setProfile(prof as ProfileRow | null);
      setSmiles((smileRows as SmileRow[]) ?? []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  const intensity = useMemo(() => {
    const recent = smiles[0];
    const recentBoost = recent && Date.now() - new Date(recent.created_at).getTime() < 4000 ? 1 : 0;
    return Math.min(1, expr.happy * 0.9 + recentBoost * 0.5);
  }, [expr.happy, smiles]);

  const happinessScore = useMemo(() => computeHappinessScore(smiles.map((s) => ({ happiness: s.happiness, createdAt: s.created_at }))), [smiles]);

  const recentMoods = useMemo(() => smiles.slice(0, 5).map((s) => s.mood), [smiles]);
  const currentLiveMood: Mood = moodFor({ happy: expr.happy, sad: expr.sad });

  async function onCapture() {
    if (!user || !ready || busyCapture) return;

    // Cooldown
    const cd = checkCooldown(profile?.last_smile_at ? new Date(profile.last_smile_at).getTime() : null);
    if (!cd.ok) {
      toast.warning(`Slow down! ${(cd.remainingMs / 1000).toFixed(1)}s before next snap.`);
      return;
    }

    // Confidence check
    const confidence = computeConfidence(expr.happy, expr.sad, expr.neutral, expr.surprised);
    if (!expr.faceDetected || confidence < ANTI_CHEAT.MIN_CONFIDENCE) {
      toast.error("Can't read you clearly. Look at the camera and try again.");
      return;
    }

    setBusyCapture(true);
    try {
      // Perceptual hash dedupe
      const video = videoRef.current;
      const phash = video ? await perceptualHash(video) : null;
      if (phash) {
        const now = Date.now();
        recentHashes.current = recentHashes.current.filter((h) => now - h.t < ANTI_CHEAT.HASH_DUPE_WINDOW_MS);
        const dupe = recentHashes.current.find((h) => hammingDistance(h.hash, phash) <= 4);
        if (dupe) {
          toast.error("That looks identical to a recent snap. Change it up!");
          return;
        }
        recentHashes.current.push({ hash: phash, t: now });
      }

      const img = capture();
      if (!img) {
        toast.error("Capture failed");
        return;
      }

      const happiness = expr.happy;
      const sadness = expr.sad;
      const mood = moodFor({ happy: happiness, sad: sadness });
      const newStreak = mood === "happy" || mood === "ecstatic" ? (profile?.current_streak ?? 0) + 1 : 0;
      const points = happiness < ANTI_CHEAT.MIN_HAPPINESS_FOR_POINTS ? 1 : pointsFor(happiness, mood, newStreak, confidence);

      // Upload snapshot
      const url = await uploadSnapshot(user.id, img);

      // Insert smile
      const inserted = await insertSmile({
        user_id: user.id,
        points,
        happiness,
        sadness,
        anger: 0,
        surprise: expr.surprised,
        neutral: expr.neutral,
        mood,
        confidence,
        image_url: url,
        image_hash: phash,
        is_genuine: confidence >= ANTI_CHEAT.MIN_CONFIDENCE && happiness >= ANTI_CHEAT.MIN_HAPPINESS_FOR_POINTS,
      });

      // Update profile aggregates + badges
      const newSmiles = [inserted, ...smiles];
      const totalPoints = (profile?.total_points ?? 0) + points;
      const bestStreak = Math.max(profile?.best_streak ?? 0, newStreak);
      const newHappinessScore = computeHappinessScore(newSmiles.map((s) => ({ happiness: s.happiness, createdAt: s.created_at })));
      const ecstaticCount = newSmiles.filter((s) => s.mood === "ecstatic").length;
      const uniqueDays = new Set(newSmiles.map((s) => new Date(s.created_at).toDateString())).size;
      const stats: BadgeStats = {
        totalSmiles: newSmiles.length,
        ecstaticCount,
        currentStreak: newStreak,
        bestStreak,
        happinessScore: newHappinessScore,
        uniqueDays,
        totalPoints,
      };
      const earnedNow = computeEarnedBadges(stats);
      const previouslyEarned = new Set(profile?.badges ?? []);
      const newlyEarned = earnedNow.filter((id) => !previouslyEarned.has(id));

      await updateProfile(user.id, {
        total_points: totalPoints,
        current_streak: newStreak,
        best_streak: bestStreak,
        last_smile_at: inserted.created_at,
        happiness_score: newHappinessScore,
        badges: earnedNow,
      });

      setSmiles(newSmiles);
      setProfile((p) => (p ? { ...p, total_points: totalPoints, current_streak: newStreak, best_streak: bestStreak, last_smile_at: inserted.created_at, happiness_score: newHappinessScore, badges: earnedNow } : p));
      setRefreshKey((k) => k + 1);

      setFlash({ pts: points, mood });
      setTimeout(() => setFlash(null), 1800);

      if (newlyEarned.length > 0) {
        toast.success(<NewBadgeToast ids={newlyEarned} />, { duration: 6000 });
      }

      if (mood === "ecstatic") {
        playCapture(1);
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 }, scalar: 1.4 });
        setTimeout(() => confetti({ particleCount: 100, angle: 60, spread: 70, origin: { x: 0 } }), 200);
        setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1 } }), 400);
      } else if (mood === "happy") {
        playCapture(0.7);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      } else if (mood === "sad" || mood === "angry") {
        playSad();
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        playCapture(0.3);
      }
    } catch (e) {
      console.error("capture pipeline error", e);
      toast.error(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setBusyCapture(false);
    }
  }

  const ringHue = expr.happy > 0.5 ? "var(--happy)" : expr.sad > 0.4 ? "var(--sad)" : "var(--neon)";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading SmileOS…</div>
      </div>
    );
  }
  if (!user) return null; // navigating away

  return (
    <div className="relative min-h-screen w-full">
      <EmojiRain intensity={intensity} />

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              <span className="text-gradient-happy">Smile</span>
              <span className="text-gradient">OS</span>
              <span className="ml-2">😄</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hey <strong className="text-foreground">{profile?.display_name ?? "smiler"}</strong> — flash a grin to climb the global board.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <HappinessBadge score={happinessScore} />
            <StatChip label="Total" value={profile?.total_points ?? 0} accent />
            <StatChip label="Streak" value={profile?.current_streak ?? 0} suffix={(profile?.current_streak ?? 0) > 0 ? "🔥" : ""} />
            <StatChip label="Best" value={profile?.best_streak ?? 0} />
            <Button variant="ghost" size="sm" className="glass border border-border/50" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Camera card */}
          <section className={`glass-strong rounded-3xl p-4 md:p-6 space-y-4 ${shake ? "animate-shake" : ""}`}>
            <div
              className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-black/60 transition-shadow duration-300"
              style={{
                boxShadow: ready ? `0 0 60px 0 color-mix(in oklch, ${ringHue} 50%, transparent)` : undefined,
              }}
            >
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />

              {ready && expr.faceDetected && (
                <div
                  className="absolute inset-6 border-2 rounded-2xl pointer-events-none transition-colors"
                  style={{
                    borderColor: ringHue,
                    boxShadow: `inset 0 0 30px color-mix(in oklch, ${ringHue} 30%, transparent)`,
                  }}
                />
              )}

              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                  <div className="text-5xl">📷</div>
                  <p className="text-sm text-muted-foreground">Camera is off</p>
                </div>
              )}
              {camOn && !ready && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                  <div className="text-5xl animate-pulse">📸</div>
                  <p className="text-sm text-muted-foreground">Loading face AI & camera…</p>
                </div>
              )}
              {camOn && error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="text-5xl">🚫</div>
                  <p className="text-sm text-destructive font-semibold">Camera blocked</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              )}

              {flash && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="animate-pop-in glass-strong rounded-3xl px-8 py-6 text-center glow-neon">
                    <div className="text-6xl mb-1">
                      {flash.mood === "ecstatic" ? "🤩" : flash.mood === "happy" ? "😄" : flash.mood === "sad" ? "😢" : flash.mood === "angry" ? "😠" : "😐"}
                    </div>
                    <div className="text-4xl font-black text-gradient-happy">+{flash.pts}</div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">smile credits</div>
                  </div>
                </div>
              )}
            </div>

            <SmileMeter expr={expr} />

            <div className="flex gap-3">
              <Button
                onClick={() => setCamOn((v) => !v)}
                variant="ghost"
                className={`h-14 px-4 glass border border-border/50 ${camOn ? "text-happy" : "text-muted-foreground"}`}
              >
                {camOn ? "🟢 On" : "⚪ Off"}
              </Button>
              <Button
                onClick={onCapture}
                disabled={!ready || !camOn || busyCapture}
                className="flex-1 h-14 text-base font-bold bg-neon text-primary-foreground hover:opacity-90 glow-neon animate-pulse-glow border-0"
              >
                {busyCapture ? "Saving…" : !camOn ? "Camera Off" : ready ? "📸 Capture Smile" : "Loading…"}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              💡 Anti-cheat on: 5s cooldown · perceptual de-dupe · confidence ≥ {Math.round(ANTI_CHEAT.MIN_CONFIDENCE * 100)}%
            </p>
          </section>

          {/* Sidebar with tabs */}
          <aside>
            <Tabs defaultValue="board" className="space-y-3">
              <TabsList className="grid grid-cols-4 w-full bg-secondary/40">
                <TabsTrigger value="board">🏆</TabsTrigger>
                <TabsTrigger value="coach">🧠</TabsTrigger>
                <TabsTrigger value="badges">🎖️</TabsTrigger>
                <TabsTrigger value="stats">📊</TabsTrigger>
              </TabsList>

              <TabsContent value="board" className="space-y-3 mt-0">
                <GlobalLeaderboard refreshKey={refreshKey} />
                {smiles.length > 0 && (
                  <div className="glass rounded-2xl p-4">
                    <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Your Recent Smiles</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {smiles.slice(0, 8).map((e) => (
                        <div key={e.id} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-border group">
                          {e.image_url ? (
                            <img src={e.image_url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary/40 text-2xl">😶</div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5 text-[10px] font-bold text-center text-happy">
                            +{e.points}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="coach" className="mt-0">
                <MoodCoach
                  mood={currentLiveMood}
                  happinessScore={happinessScore}
                  recentMoods={recentMoods}
                  streak={profile?.current_streak ?? 0}
                />
              </TabsContent>

              <TabsContent value="badges" className="mt-0">
                <BadgesDisplay earned={profile?.badges ?? []} />
              </TabsContent>

              <TabsContent value="stats" className="mt-0">
                <AnalyticsDashboard smiles={smiles} />
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        <footer className="text-center text-xs text-muted-foreground pt-4 pb-8">
          SmileOS · on-device face AI · global leaderboard · AI Mood Coach 💖
        </footer>
      </main>
    </div>
  );
}

function HappinessBadge({ score }: { score: number }) {
  const tone =
    score >= 75 ? "text-happy" : score >= 50 ? "text-accent" : score >= 25 ? "text-muted-foreground" : "text-sad";
  return (
    <div className="glass rounded-2xl px-4 py-2 min-w-[110px] text-center glow-happy">
      <div className={`text-xl font-black tabular-nums ${tone}`}>{score}<span className="text-xs">/100</span></div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Happiness</div>
    </div>
  );
}

function StatChip({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className={`glass rounded-2xl px-4 py-2 min-w-[80px] text-center ${accent ? "glow-neon" : ""}`}>
      <div className={`text-xl font-black tabular-nums ${accent ? "text-gradient-happy" : ""}`}>
        {value}
        {suffix && <span className="ml-1">{suffix}</span>}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
