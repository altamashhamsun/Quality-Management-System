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

type ChartDatum = {
  round: number;
  resolved: number;
  unresolved: number;
  resolutionRate: number;
};

type Props = {
  data: ChartDatum[];
  improvement?: { fromRound: number; toRound: number; resolvedDelta: number; rateFrom: number; rateTo: number } | null;
};

export default function QCChart({ data, improvement }: Props) {
  const rateDelta = improvement ? improvement.rateTo - improvement.rateFrom : 0;
  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Quality Progress by Round
          </h3>
          <p className="text-xs text-zinc-500">
            Resolution rate % across inspection rounds
          </p>
        </div>
        {improvement && (
          <div className={`shrink-0 rounded-lg border px-4 py-2.5 text-center ${
            rateDelta > 0 ? "border-emerald-700 bg-emerald-950/60" : rateDelta < 0 ? "border-red-700 bg-red-950/60" : "border-zinc-700 bg-zinc-900/60"
          }`}>
            <div className={`text-2xl font-bold ${rateDelta > 0 ? "text-emerald-400" : rateDelta < 0 ? "text-red-400" : "text-zinc-400"}`}>
              {rateDelta > 0 ? "+" : ""}{rateDelta.toFixed(0)}%
            </div>
            <div className="text-[10px] text-zinc-500">
              R{improvement.fromRound} to R{improvement.toRound}
            </div>
          </div>
        )}
      </div>

      {improvement && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <span className="text-[10px] text-zinc-500 block">R{improvement.fromRound} Rate</span>
            <span className="text-sm font-bold text-zinc-200">{improvement.rateFrom.toFixed(0)}%</span>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <span className="text-[10px] text-zinc-500 block">R{improvement.toRound} Rate</span>
            <span className={`text-sm font-bold ${rateDelta > 0 ? "text-emerald-400" : rateDelta < 0 ? "text-red-400" : "text-zinc-200"}`}>
              {improvement.rateTo.toFixed(0)}%
            </span>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <span className="text-[10px] text-zinc-500 block">Trend</span>
            <span className={`text-sm font-bold ${rateDelta > 0 ? "text-emerald-400" : rateDelta < 0 ? "text-red-400" : "text-zinc-400"}`}>
              {rateDelta > 0 ? "Improved" : rateDelta < 0 ? "Declined" : "No change"}
            </span>
          </div>
          {data.map((d) => (
            <div key={d.round} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <span className="text-[10px] text-zinc-500 block">Round {d.round}</span>
              <span className="text-sm font-bold text-zinc-200">{d.resolved}/{d.resolved + d.unresolved}</span>
              <span className="text-[10px] text-zinc-500"> resolved</span>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="round"
            tick={{ fill: "#a1a1aa", fontSize: 13, fontWeight: 600 }}
            tickFormatter={(v) => `Round ${v}`}
            stroke="#3f3f46"
            axisLine={{ stroke: "#3f3f46" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            stroke="#3f3f46"
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fafafa", fontSize: 12 }}
            formatter={(value, name) => {
              if (name === "Resolution Rate") return [`${Number(value).toFixed(1)}%`, name];
              return [value, name];
            }}
            labelFormatter={(v) => `Round ${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <ReferenceLine y={50} stroke="#52525b" strokeDasharray="6 3" />
          <Line
            type="monotone"
            dataKey="resolutionRate"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "#050507" }}
            activeDot={{ r: 8 }}
            name="Resolution Rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
