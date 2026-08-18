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
} from "recharts";

type Props = {
  data: { round: number; [branch: string]: number | string }[];
};

const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export default function QCChart({ data }: Props) {
  const branchNames = Object.keys(data[0]).filter((k) => k !== "round");
  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Issues Resolved per Round
      </h3>
      <p className="mb-4 text-xs text-zinc-500">
        How many issues each branch resolved in each round
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="round" tick={{ fill: "#a1a1aa", fontSize: 12 }} tickFormatter={(v) => `R${v}`} stroke="#3f3f46" />
          <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} stroke="#3f3f46" allowDecimals={false} />
          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fafafa", fontSize: 12 }} labelFormatter={(v) => `Round ${v}`} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          {branchNames.map((name, i) => (
            <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
