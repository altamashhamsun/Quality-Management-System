"use client";

const palette: Record<string, string> = {
  "Action Taken": "border-amber-400/60 bg-amber-400/10 text-amber-300",
  "Action Not Taken Yet": "border-red-500/60 bg-red-500/10 text-red-400",
  Done: "border-emerald-400/60 bg-emerald-400/10 text-emerald-300",
};

export default function StatusBadge({ status }: { status: string | null }) {
  const base =
    "inline-block max-w-full rounded-md border px-1.5 py-0.5 text-[10px] font-medium break-words";
  const color = status && palette[status] ? palette[status] : "border-zinc-600 bg-zinc-500/10 text-zinc-400";

  return (
    <span className={`${base} ${color}`}>{status && status !== "" ? status : "\u2014"}</span>
  );
}
