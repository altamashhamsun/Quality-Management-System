"use client";

import type { ReactNode } from "react";

export default function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-cyan-400/50 bg-zinc-950 p-6 shadow-[0_0_50px_rgba(34,211,238,0.25)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="neon-text-cyan text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-zinc-400 transition-colors hover:text-white"
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
