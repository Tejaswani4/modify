import { BADGES, getBadgeDef } from "@/lib/badges";

export function BadgesDisplay({ earned }: { earned: string[] }) {
  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span>🎖️ Badges</span>
        <span className="text-xs text-foreground tabular-nums">{earned.length}/{BADGES.length}</span>
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {BADGES.map((b) => {
          const has = earned.includes(b.id);
          return (
            <div
              key={b.id}
              title={`${b.name} — ${b.description}`}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-2xl transition-all ${
                has
                  ? "glass-strong glow-happy scale-100"
                  : "bg-secondary/30 grayscale opacity-40 hover:opacity-60 scale-95"
              }`}
            >
              <div>{b.emoji}</div>
              <div className="text-[8px] mt-0.5 text-center px-1 leading-tight font-semibold">
                {has ? b.name : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NewBadgeToast({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-sm font-bold">🎖️ New badge{ids.length > 1 ? "s" : ""} unlocked!</div>
      {ids.map((id) => {
        const b = getBadgeDef(id);
        if (!b) return null;
        return (
          <div key={id} className="text-xs">
            {b.emoji} <strong>{b.name}</strong> — {b.description}
          </div>
        );
      })}
    </div>
  );
}
