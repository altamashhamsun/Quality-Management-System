"use client";

import type { ReactNode } from "react";

export default function NeonTile({
  name,
  subtitle,
  onClick,
  actions,
}: {
  name: string;
  subtitle?: string;
  onClick?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-zinc-500"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-zinc-50">
            {name}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div
            className="flex shrink-0 items-center gap-2 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
