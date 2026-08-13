"use client";

export default function StatusBadge({ status }: { status: string | null }) {
  const base =
    "inline-block max-w-full rounded-md border border-zinc-600 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium break-words text-zinc-300";

  return (
    <span className={base}>
      {status && status !== "" ? status : "\u2014"}
    </span>
  );
}
