import { LiveExpression } from "@/hooks/useSmileCamera";

export function SmileMeter({ expr }: { expr: LiveExpression }) {
  const pct = Math.round(expr.happy * 100);
  const sadPct = Math.round(expr.sad * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-happy font-semibold">
          <span className="text-xl">😄</span> Happy
        </span>
        <span className="font-mono text-happy font-bold">{pct}%</span>
      </div>
      <div className="h-3 rounded-full bg-secondary/60 overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-200 relative overflow-hidden"
          style={{
            width: `${pct}%`,
            background: "var(--gradient-happy)",
            boxShadow: pct > 60 ? "0 0 20px var(--happy)" : undefined,
          }}
        >
          <div className="absolute inset-0 animate-shimmer" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>😢</span> Sad {sadPct}%
        </span>
        <span>
          {expr.faceDetected ? (
            <span className="text-accent">● Face detected</span>
          ) : (
            <span className="text-muted-foreground">○ Searching...</span>
          )}
        </span>
      </div>
    </div>
  );
}
