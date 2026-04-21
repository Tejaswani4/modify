import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Mood } from "@/lib/scoring";

export type SmileRow = {
  id: string;
  user_id: string;
  points: number;
  happiness: number;
  sadness: number;
  anger: number;
  surprise: number;
  neutral: number;
  mood: string;
  confidence: number;
  image_url: string | null;
  image_hash: string | null;
  is_genuine: boolean;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  happiness_score: number;
  current_streak: number;
  best_streak: number;
  last_smile_at: string | null;
  badges: string[];
};

export function useSmileCloud() {
  const uploadSnapshot = useCallback(async (userId: string, dataUrl: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from("smiles").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("smiles").getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.error("upload smile snapshot failed", e);
      return null;
    }
  }, []);

  const insertSmile = useCallback(
    async (row: {
      user_id: string;
      points: number;
      happiness: number;
      sadness: number;
      anger: number;
      surprise: number;
      neutral: number;
      mood: Mood;
      confidence: number;
      image_url: string | null;
      image_hash: string | null;
      is_genuine: boolean;
    }) => {
      const { data, error } = await supabase.from("smiles").insert(row).select().single();
      if (error) throw error;
      return data as SmileRow;
    },
    []
  );

  const updateProfile = useCallback(async (userId: string, patch: Partial<ProfileRow>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) throw error;
  }, []);

  return { uploadSnapshot, insertSmile, updateProfile };
}
