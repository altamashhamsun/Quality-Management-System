"use client";

import { useEffect } from "react";

export type LightboxItem = { src: string; driveLink?: string };

export default function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  useEffect(() => {
    if (index == null) return;
    const current = index;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        onNavigate(current - 1 < 0 ? items.length - 1 : current - 1);
      if (e.key === "ArrowRight") onNavigate((current + 1) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, items.length, onClose, onNavigate]);

  if (index == null || items.length === 0) return null;

  const item = items[index];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          {item.driveLink && (
            <a
              href={item.driveLink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
            >
              Open in Drive
            </a>
          )}
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-600 text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt={`Photo ${index + 1} of ${items.length}`}
          className="max-h-[78vh] max-w-full rounded-lg object-contain"
        />

        {items.length > 1 && (
          <>
            <button
              onClick={() => onNavigate(index - 1 < 0 ? items.length - 1 : index - 1)}
              className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-xl text-zinc-200 transition-colors hover:border-zinc-300 hover:text-white"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={() => onNavigate((index + 1) % items.length)}
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-xl text-zinc-200 transition-colors hover:border-zinc-300 hover:text-white"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}
