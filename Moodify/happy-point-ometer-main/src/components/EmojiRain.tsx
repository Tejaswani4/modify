import { useEffect, useRef } from "react";

const EMOJIS = ["😄", "😁", "🤩", "😍", "🥰", "😆", "🥳", "✨", "💖", "⭐", "🌟", "💫"];

export function EmojiRain({ intensity }: { intensity: number }) {
  // intensity 0..1
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const count = Math.max(1, Math.round(intensity * 4));
    let active = true;

    function spawn() {
      if (!active || !el) return;
      for (let i = 0; i < count; i++) {
        const span = document.createElement("span");
        span.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        const size = 18 + Math.random() * 28 + intensity * 20;
        span.style.cssText = `
          position:absolute;
          left:${Math.random() * 100}%;
          bottom:-40px;
          font-size:${size}px;
          pointer-events:none;
          animation: float-up ${4 + Math.random() * 4}s linear forwards;
          filter: drop-shadow(0 0 8px oklch(0.78 0.22 320 / 0.6));
        `;
        el.appendChild(span);
        setTimeout(() => span.remove(), 9000);
      }
    }

    const interval = setInterval(spawn, Math.max(250, 1200 - intensity * 1000));
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [intensity]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
    />
  );
}
