import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

type Props = {
  mood: string;
  happinessScore: number;
  recentMoods: string[];
  streak: number;
};

export function MoodCoach({ mood, happinessScore, recentMoods, streak }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("mood-coach", {
        body: { mood, happinessScore, recentMoods, streak },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach is unavailable");
    } finally {
      setLoading(false);
    }
  }

  const needsLove = mood === "sad" || mood === "angry" || happinessScore < 40;

  return (
    <div className={`glass rounded-2xl p-4 space-y-3 ${needsLove ? "ring-1 ring-accent/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          🧠 AI Mood Coach
        </h3>
        {needsLove && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">RECOMMENDED</span>}
      </div>
      {!message && !error && (
        <p className="text-sm text-muted-foreground">
          {needsLove
            ? "Looks like a tough moment. Get a quick boost?"
            : "Get personalized suggestions based on your mood patterns."}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && (
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown>{message}</ReactMarkdown>
        </div>
      )}
      <Button onClick={ask} disabled={loading} className="w-full bg-accent text-accent-foreground hover:opacity-90 border-0">
        {loading ? "Thinking…" : message ? "🔄 Ask again" : "✨ Get suggestions"}
      </Button>
    </div>
  );
}
