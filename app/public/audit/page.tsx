"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuditorTab from "@/app/audit/AuditorTab";
import AuditReportTab from "@/app/audit/AuditReportTab";
import BranchRankingTab from "@/app/audit/BranchRankingTab";

type AuditDocument = {
  id: string;
  category: "plan" | "report" | "capa";
  title: string;
  description: string | null;
  content: Record<string, string> | null;
  start_date: string | null;
  end_date: string | null;
  department_ids: string[];
  plan_id: string | null;
  created_at: string;
};

const TABS = [
  { key: "plan", label: "Audit Plans" },
  { key: "capa", label: "Corrective & Preventive Action" },
  { key: "auditor", label: "Auditor" },
  { key: "auditReport", label: "Audit Report" },
  { key: "branchMonth", label: "Branch of the Month" },
  { key: "branchYear", label: "Branch of the Year" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PLAN_SECTIONS: { key: string; label: string }[] = [
  { key: "objectives", label: "Objectives" },
  { key: "scope", label: "Scope" },
  { key: "criteria", label: "Criteria" },
  { key: "risk_assessment", label: "Risk Assessment" },
  { key: "procedures", label: "Procedures" },
  { key: "timeline", label: "Timeline" },
  { key: "team_resources", label: "Team & Resources" },
];

type PlanDepartment = {
  id: string;
  name: string;
  branches: { name: string } | { name: string }[] | null;
};

function PublicAuditContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("plan");
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [departments, setDepartments] = useState<PlanDepartment[]>([]);
  const [viewing, setViewing] = useState<AuditDocument | null>(null);

  useEffect(() => {
    (async () => {
      const [docsResult, deptsResult] = await Promise.all([
        supabase
          .from("audit_documents")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase.from("departments").select("id, name, branches(name)"),
      ]);
      if (!docsResult.error) setDocuments((docsResult.data ?? []) as AuditDocument[]);
      if (!deptsResult.error) setDepartments(deptsResult.data ?? []);
      setDataLoading(false);
    })();
  }, []);

  const activeDocuments = documents.filter((doc) => doc.category === activeTab);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [departments]);

  function formatDateRange(doc: AuditDocument): string {
    if (!doc.start_date || !doc.end_date) return "";
    const opts: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    return `${new Date(doc.start_date + "T00:00:00").toLocaleDateString(undefined, opts)} — ${new Date(doc.end_date + "T00:00:00").toLocaleDateString(undefined, opts)}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50">Audit</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Audit plans, corrective &amp; preventive actions, and reports — read only
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          const count = tab.key !== "auditor" && tab.key !== "auditReport" && tab.key !== "branchMonth" && tab.key !== "branchYear"
            ? documents.filter((doc) => doc.category === tab.key).length
            : null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                active
                  ? "border-zinc-300 bg-zinc-100 text-zinc-950"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {tab.label}
              {count !== null && (
                <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "auditor" ? (
        <AuditorTab />
      ) : activeTab === "auditReport" ? (
        <AuditReportTab readonly />
      ) : activeTab === "branchMonth" ? (
        <BranchRankingTab mode="month" />
      ) : activeTab === "branchYear" ? (
        <BranchRankingTab mode="year" />
      ) : dataLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : activeDocuments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
          No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} published yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeDocuments.map((doc) => (
            <div
              key={doc.id}
              className="group rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/40"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-50">
                  {doc.title}
                </h3>
                <span className="shrink-0 rounded bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  {doc.category === "plan" && doc.start_date
                    ? formatDateRange(doc)
                    : new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
              {doc.description && (
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {doc.description.length > 160
                    ? doc.description.slice(0, 160) + "..."
                    : doc.description}
                </p>
              )}
              {doc.category === "plan" && doc.department_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.department_ids.map((id) => (
                    <span
                      key={id}
                      className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400"
                    >
                      {deptName(id)}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setViewing(doc)}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-50">{viewing.title}</h3>
              <button
                onClick={() => setViewing(null)}
                className="shrink-0 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>
            {viewing.category === "plan" && viewing.content ? (
              <div className="flex flex-col gap-5">
                {PLAN_SECTIONS.map((section) => {
                  const html = viewing.content?.[section.key] ?? "";
                  return (
                    <div key={section.key}>
                      <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                        {section.label}
                      </h4>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                        {html ? (
                          <div
                            className="prose-xs rte-body text-sm text-zinc-200"
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        ) : (
                          <p className="text-sm text-zinc-600">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="whitespace-pre-line text-sm text-zinc-300">
                {viewing.description ?? "\u2014"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicAuditPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading...</p>}>
      <PublicAuditContent />
    </Suspense>
  );
}
