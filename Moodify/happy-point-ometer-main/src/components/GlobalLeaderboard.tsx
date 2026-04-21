import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Row = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  smile_count: number;
  best_smile: number;
};

const moodEmoji: Record<string, string> = {
  ecstatic: "🤩",
  happy: "😄",
  neutral: "😐",
  sad: "😢",
  angry: "😠",
};

export function GlobalLeaderboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tab, setTab] = useState<"daily" | "weekly" | "all">("daily");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const since =
          tab === "daily"
            ? new Date(Date.now() - 24 * 3600_000).toISOString()
            : tab === "weekly"
              ? new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
              : null;

        let smilesQuery = supabase.from("smiles").select("user_id, points").order("points", { ascending: false });
        if (since) smilesQuery = smilesQuery.gte("created_at", since);
        const { data: smileData, error: smileErr } = await smilesQuery.limit(2000);
        if (smileErr) throw smileErr;

        const userIds = Array.from(new Set((smileData ?? []).map((s) => s.user_id)));
        let profilesMap = new Map<string, { display_name: string; avatar_url: string | null }>();
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", userIds);
          for (const p of profs ?? []) {
            profilesMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url });
          }
        }

        const agg = new Map<string, Row>();
        for (const s of smileData ?? []) {
          const prof = profilesMap.get(s.user_id);
          const existing = agg.get(s.user_id);
          if (existing) {
            existing.total_points += s.points;
            existing.smile_count += 1;
            existing.best_smile = Math.max(existing.best_smile, s.points);
          } else {
            agg.set(s.user_id, {
              user_id: s.user_id,
              display_name: prof?.display_name || "Anon Smiler",
              avatar_url: prof?.avatar_url ?? null,
              total_points: s.points,
              smile_count: 1,
              best_smile: s.points,
            });
          }
        }

        const sorted = Array.from(agg.values())
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 25);
        if (!cancelled) setRows(sorted);
      } catch (e) {
        console.error("leaderboard load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tab, refreshKey]);

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <h3 className="text-lg font-bold text-gradient flex items-center gap-2 px-1">🏆 Global Leaderboard</h3>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "daily" | "weekly" | "all")}>
        <TabsList className="grid grid-cols-3 w-full bg-secondary/40">
          <TabsTrigger value="daily">Today</TabsTrigger>
          <TabsTrigger value="weekly">7 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No smiles yet — be first!</div>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {rows.map((r, i) => {
                const rankColors = ["text-yellow-300", "text-slate-300", "text-orange-400"];
                return (
                  <li key={r.user_id} className="flex items-center gap-3 p-2 rounded-xl glass">
                    <div className={`w-8 text-center font-bold text-lg ${rankColors[i] ?? "text-muted-foreground"}`}>
                      #{i + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary/60 flex items-center justify-center text-lg">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{moodEmoji.happy}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.display_name}</div>
                      <div className="text-xs text-muted-foreground">{r.smile_count} smiles · best {r.best_smile}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-gradient-happy tabular-nums">{r.total_points}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">pts</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
