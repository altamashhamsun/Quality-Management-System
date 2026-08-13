"use client";

export default function StatsTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 backdrop-blur">
      <p className="text-2xl font-bold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
