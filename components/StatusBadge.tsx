"use client";

const STATUS_OPTIONS = ["Done", "Action Taken", "Action Not Taken Yet"] as const;

function statusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s === "done") {
    return "border-green-500/70 bg-green-500/15 text-green-300";
  }
  if (s === "action taken") {
    return "border-yellow-500/70 bg-yellow-500/15 text-yellow-300";
  }
  if (s === "action not taken yet") {
    return "border-red-500/70 bg-red-500/15 text-red-300";
  }
  return "border-zinc-600 bg-zinc-500/10 text-zinc-300";
}

export default function StatusBadge({
  status,
  onChange,
}: {
  status: string | null;
  onChange?: (value: string) => void;
}) {
  const current = (status ?? "").trim();

  return (
    <select
      value={current}
      disabled={!onChange}
      onChange={(e) => onChange?.(e.target.value)}
      className={`max-w-full cursor-pointer rounded-md border px-1.5 py-0.5 text-[10px] font-medium outline-none transition-colors ${statusStyle(current)}`}
    >
      {!STATUS_OPTIONS.includes(current as (typeof STATUS_OPTIONS)[number]) && (
        <option value={current}>{current === "" ? "\u2014" : current}</option>
      )}
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
