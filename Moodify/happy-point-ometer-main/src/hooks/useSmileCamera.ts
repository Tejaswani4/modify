import { useEffect, useRef, useState } from "react";
import { loadFaceModels, faceapi } from "@/lib/faceModels";

export type LiveExpression = {
  happy: number;
  sad: number;
  neutral: number;
  surprised: number;
  faceDetected: boolean;
};

export function useSmileCamera(enabled: boolean = true) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expr, setExpr] = useState<LiveExpression>({
    happy: 0,
    sad: 0,
    neutral: 1,
    surprised: 0,
    faceDetected: false,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      setExpr({ happy: 0, sad: 0, neutral: 1, surprised: 0, faceDetected: false });
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        await loadFaceModels();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        loop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera unavailable";
        setError(msg);
      }
    }

    async function loop() {
      const video = videoRef.current;
      if (!video || cancelled) return;
      if (video.readyState >= 2) {
        try {
          const result = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
            .withFaceExpressions();
          if (result?.expressions) {
            const e = result.expressions;
            setExpr({
              happy: e.happy,
              sad: e.sad,
              neutral: e.neutral,
              surprised: e.surprised,
              faceDetected: true,
            });
          } else {
            setExpr((p) => ({ ...p, faceDetected: false }));
          }
        } catch {
          /* ignore frame errors */
        }
      }
      rafRef.current = window.setTimeout(() => requestAnimationFrame(loop), 120) as unknown as number;
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) clearTimeout(rafRef.current);
      const v = videoRef.current;
      if (v) v.srcObject = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  function capture(): string | null {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    const w = 320;
    const h = (video.videoHeight / video.videoWidth) * w || 240;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.7);
  }

  return { videoRef, ready, error, expr, capture };
}
