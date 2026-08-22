"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type Props = {
  data: { round: number; [branch: string]: number | string }[];
  improvement?: { fromRound: number; toRound: number; resolvedDelta: number; rateFrom: number; rateTo: number } | null;
};

const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export default function QCChart({ data, improvement }: Props) {
  const seriesNames = Object.keys(data[0]).filter((k) => k !== "round");
  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Issues Resolved per Round
          </h3>
          <p className="text-xs text-zinc-500">
            How many issues were resolved vs unresolved in each round
          </p>
        </div>
        {improvement && (
          <div className={`shrink-0 rounded-lg border px-3 py-2 text-center ${
            improvement.resolvedDelta > 0
              ? "border-emerald-800 bg-emerald-950/60"
              : improvement.resolvedDelta < 0
                ? "border-red-800 bg-red-950/60"
                : "border-zinc-700 bg-zinc-900/60"
          }`}>
            <div className={`text-lg font-bold ${
              improvement.resolvedDelta > 0 ? "text-emerald-400" : improvement.resolvedDelta < 0 ? "text-red-400" : "text-zinc-400"
            }`}>
              {improvement.resolvedDelta > 0 ? "+" : ""}{improvement.resolvedDelta}
            </div>
            <div className="text-[10px] text-zinc-500">
              R{improvement.fromRound}→R{improvement.toRound}
            </div>
          </div>
        )}
      </div>

      {improvement && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
            <span className="text-[10px] text-zinc-500">Resolution Rate R{improvement.fromRound}:</span>
            <span className="ml-1.5 text-xs font-semibold text-zinc-300">{improvement.rateFrom.toFixed(0)}%</span>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
            <span className="text-[10px] text-zinc-500">Resolution Rate R{improvement.toRound}:</span>
            <span className={`ml-1.5 text-xs font-semibold ${
              improvement.rateTo > improvement.rateFrom ? "text-emerald-400" : improvement.rateTo < improvement.rateFrom ? "text-red-400" : "text-zinc-300"
            }`}>{improvement.rateTo.toFixed(0)}%</span>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
            <span className="text-[10px] text-zinc-500">Trend:</span>
            <span className={`ml-1.5 text-xs font-semibold ${
              improvement.resolvedDelta > 0 ? "text-emerald-400" : improvement.resolvedDelta < 0 ? "text-red-400" : "text-zinc-400"
            }`}>
              {improvement.resolvedDelta > 0 ? "Improved" : improvement.resolvedDelta < 0 ? "Declined" : "No change"}
            </span>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="round" tick={{ fill: "#a1a1aa", fontSize: 12 }} tickFormatter={(v) => `R${v}`} stroke="#3f3f46" />
          <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} stroke="#3f3f46" allowDecimals={false} />
          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fafafa", fontSize: 12 }} labelFormatter={(v) => `Round ${v}`} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          {improvement && (
            <ReferenceLine
              y={data.length > 0 ? Math.round(
                data.reduce((sum, d) => {
                  const resolved = Number(d.Resolved ?? 0);
                  const unresolved = Number(d.Unresolved ?? 0);
                  return sum + (resolved + unresolved > 0 ? resolved / (resolved + unresolved) : 0);
                }, 0) / data.length * (data.length > 0 ? Math.max(...data.map((d) => Number(d.Resolved ?? 0) + Number(d.Unresolved ?? 0))) : 1)
              ) : 0}
              stroke="#52525b"
              strokeDasharray="6 3"
              label={{ value: "avg", fill: "#52525b", fontSize: 10 }}
            />
          )}
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
