"use client";

import type { ReactNode } from "react";

export type NeonColor = "cyan" | "pink" | "violet";

const styles: Record<
  NeonColor,
  { border: string; glow: string; text: string; shadow: string }
> = {
  cyan: {
    border: "border-cyan-400/60",
    glow: "hover:shadow-[0_0_35px_rgba(34,211,238,0.45)]",
    text: "neon-text-cyan",
    shadow: "shadow-[0_0_18px_rgba(34,211,238,0.15)]",
  },
  pink: {
    border: "border-pink-500/60",
    glow: "hover:shadow-[0_0_35px_rgba(244,114,182,0.45)]",
    text: "neon-text-pink",
    shadow: "shadow-[0_0_18px_rgba(244,114,182,0.15)]",
  },
  violet: {
    border: "border-violet-500/60",
    glow: "hover:shadow-[0_0_35px_rgba(167,139,250,0.45)]",
    text: "neon-text-violet",
    shadow: "shadow-[0_0_18px_rgba(167,139,250,0.15)]",
  },
};

export default function NeonTile({
  name,
  subtitle,
  color = "cyan",
  onClick,
  actions,
}: {
  name: string;
  subtitle?: string;
  color?: NeonColor;
  onClick?: () => void;
  actions?: ReactNode;
}) {
  const c = styles[color];

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border-2 ${c.border} ${c.shadow} bg-zinc-950/80 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 ${c.glow}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={`truncate text-lg font-semibold ${c.text}`}>{name}</h3>
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div
            className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
