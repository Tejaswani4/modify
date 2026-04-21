import { useMemo } from "react";
import type { SmileRow } from "@/hooks/useSmileCloud";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const MOOD_COLORS: Record<string, string> = {
  ecstatic: "oklch(0.85 0.2 95)",
  happy: "oklch(0.78 0.22 50)",
  neutral: "oklch(0.72 0.04 280)",
  sad: "oklch(0.65 0.18 250)",
  angry: "oklch(0.65 0.25 25)",
};

export function AnalyticsDashboard({ smiles }: { smiles: SmileRow[] }) {
  const trend = useMemo(() => {
    // Bucket by day, last 14 days
    const days = 14;
    const now = new Date();
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      d.setHours(0, 0, 0, 0);
      return { day: d.getTime(), label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), happiness: 0, count: 0 };
    });
    for (const s of smiles) {
      const t = new Date(s.created_at);
      t.setHours(0, 0, 0, 0);
      const idx = buckets.findIndex((b) => b.day === t.getTime());
      if (idx >= 0) {
        buckets[idx].happiness += s.happiness;
        buckets[idx].count += 1;
      }
    }
    return buckets.map((b) => ({
      label: b.label,
      score: b.count > 0 ? Math.round((b.happiness / b.count) * 100) : 0,
      smiles: b.count,
    }));
  }, [smiles]);

  const moodSplit = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of smiles) counts[s.mood] = (counts[s.mood] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [smiles]);

  if (smiles.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-5xl mb-2">📊</div>
        <p className="text-sm text-muted-foreground">Capture some smiles to see your trends.</p>
      </div>
    );
  }

  const totalSmiles = smiles.length;
  const avgHappiness = Math.round((smiles.reduce((a, s) => a + s.happiness, 0) / totalSmiles) * 100);
  const totalPoints = smiles.reduce((a, s) => a + s.points, 0);
  const bestSmile = Math.max(...smiles.map((s) => s.points));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Smiles" value={totalSmiles} />
        <Stat label="Avg Happy" value={`${avgHappiness}%`} />
        <Stat label="Total Pts" value={totalPoints} />
        <Stat label="Best Pop" value={bestSmile} accent />
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Happiness Trend (14d)</h3>
        <div className="h-48">
          <ResponsiveContainer>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.85 0.2 95)" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="oklch(0.75 0.25 340)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.72 0.04 280)" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "oklch(0.72 0.04 280)" }} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.05 285)",
                  border: "1px solid oklch(0.98 0.01 280 / 0.2)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="score" stroke="oklch(0.85 0.2 95)" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Mood Mix</h3>
        <div className="h-48">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={moodSplit} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                {moodSplit.map((m) => (
                  <Cell key={m.name} fill={MOOD_COLORS[m.name] || "oklch(0.5 0.05 280)"} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.05 285)",
                  border: "1px solid oklch(0.98 0.01 280 / 0.2)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`glass rounded-2xl px-3 py-2 text-center ${accent ? "glow-neon" : ""}`}>
      <div className={`text-xl font-black tabular-nums ${accent ? "text-gradient-happy" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
