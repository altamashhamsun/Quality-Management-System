"use client";

type Color = "cyan" | "pink" | "violet" | "amber" | "red" | "green";

const styles: Record<Color, { border: string; text: string; glow: string }> = {
  cyan: {
    border: "border-cyan-400/60",
    text: "neon-text-cyan",
    glow: "shadow-[0_0_18px_rgba(34,211,238,0.15)]",
  },
  pink: {
    border: "border-pink-500/60",
    text: "neon-text-pink",
    glow: "shadow-[0_0_18px_rgba(244,114,182,0.15)]",
  },
  violet: {
    border: "border-violet-500/60",
    text: "neon-text-violet",
    glow: "shadow-[0_0_18px_rgba(167,139,250,0.15)]",
  },
  amber: {
    border: "border-amber-400/60",
    text: "neon-text-amber",
    glow: "shadow-[0_0_18px_rgba(251,191,36,0.15)]",
  },
  red: {
    border: "border-red-500/60",
    text: "neon-text-red",
    glow: "shadow-[0_0_18px_rgba(248,113,113,0.15)]",
  },
  green: {
    border: "border-emerald-400/60",
    text: "neon-text-green",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.15)]",
  },
};

export default function StatsTile({
  label,
  value,
  color = "cyan",
}: {
  label: string;
  value: number;
  color?: Color;
}) {
  const c = styles[color];

  return (
    <div
      className={`rounded-xl border-2 ${c.border} ${c.glow} bg-zinc-950/80 p-4 backdrop-blur`}
    >
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
