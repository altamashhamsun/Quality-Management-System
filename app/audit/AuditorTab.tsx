"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GUIDELINES_BY_DEPARTMENT, type Guideline } from "@/lib/guidelines";
import { downloadNcrPdf, type NcrPdfData } from "@/lib/ncrPdf";

type Branch = { id: string; name: string };
type Department = { id: string; name: string; branch_id: string };

type Photo = { file: File; url: string };

type Issue = {
  key: string;
  raw: string;
  rephrased: string;
  clauseNumber: string;
  clauseName: string;
  correctiveAction: string;
  preventiveAction: string;
  rootCause: string;
  consequences: string;
  photos: Photo[];
  analyzing: boolean;
  aiError: string | null;
};

type SavedNcr = NcrPdfData;

const EXCEL_EPOCH_OFFSET = 25569;

const NCR_PREFIXES: Record<string, string> = {
  Compliance: "COMPCR",
  "Front Desk": "FCR",
  Housekeeping: "HCR",
  Kitchen: "KCR",
  Warehousing: "WCR",
};

function todayExcelSerial(): number {
  return Math.floor(Date.now() / 86400000) + EXCEL_EPOCH_OFFSET;
}

function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - EXCEL_EPOCH_OFFSET) * 86400000));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function newIssue(): Issue {
  return {
    key: Math.random().toString(36).slice(2),
    raw: "",
    rephrased: "",
    clauseNumber: "",
    clauseName: "",
    correctiveAction: "",
    preventiveAction: "",
    rootCause: "",
    consequences: "",
    photos: [],
    analyzing: false,
    aiError: null,
  };
}

export default function AuditorTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [guidelineId, setGuidelineId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([newIssue()]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: d }] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase.from("departments").select("id, name, branch_id").order("name"),
      ]);
      setBranches(b ?? []);
      setDepartments(d ?? []);
      setLoadingData(false);
    })();
  }, []);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? null;
  const branchDepartments = useMemo(
    () => departments.filter((d) => d.branch_id === selectedBranchId),
    [departments, selectedBranchId],
  );
  const selectedDepartment =
    branchDepartments.find((d) => d.id === selectedDeptId) ?? null;

  const guidelines: Guideline[] = selectedDepartment
    ? (GUIDELINES_BY_DEPARTMENT[selectedDepartment.name] ?? [])
    : [];
  const selectedGuideline = guidelines.find((g) => g.id === guidelineId) ?? guidelines[0] ?? null;

  function handleBranchChange(id: string) {
    setSelectedBranchId(id);
    setSelectedDeptId("");
    setGuidelineId("");
  }

  function handleDeptChange(id: string) {
    setSelectedDeptId(id);
    setGuidelineId("");
  }

  function updateIssue(key: string, patch: Partial<Issue>) {
    setIssues((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function addPhotos(key: string, files: FileList | null) {
    if (!files) return;
    const photos: Photo[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = await readAsDataURL(file);
      photos.push({ file, url });
    }
    if (photos.length === 0) return;
    setIssues((prev) =>
      prev.map((i) => (i.key === key ? { ...i, photos: [...i.photos, ...photos] } : i)),
    );
  }

  function removePhoto(key: string, index: number) {
    const issue = issues.find((i) => i.key === key);
    if (!issue) return;
    updateIssue(key, { photos: issue.photos.filter((_, i) => i !== index) });
  }

  async function analyzeWithAi(issue: Issue) {
    if (!issue.raw.trim()) return;
    if (!selectedDepartment || !selectedGuideline) {
      setError("Select a department and a standard/guideline first.");
      return;
    }
    updateIssue(issue.key, { analyzing: true, aiError: null });
    try {
      const res = await fetch("/api/ai/ncr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: issue.raw,
          department: selectedDepartment.name,
          standard: selectedGuideline.name,
          clause: selectedGuideline.clause,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateIssue(issue.key, { analyzing: false, aiError: data.error ?? "AI analysis failed." });
        return;
      }
      updateIssue(issue.key, {
        analyzing: false,
        rephrased: data.rephrased ?? "",
        clauseNumber: data.clause_number ?? "",
        clauseName: data.clause_name ?? "",
        correctiveAction: data.corrective_action ?? "",
        preventiveAction: data.preventive_action ?? "",
        rootCause: data.root_cause ?? "",
        consequences: data.consequences ?? "",
      });
    } catch (e) {
      updateIssue(issue.key, {
        analyzing: false,
        aiError: e instanceof Error ? e.message : "AI analysis failed.",
      });
    }
  }

  async function nextNcrNumber(branchName: string, deptName: string): Promise<string> {
    const prefix = NCR_PREFIXES[deptName] ?? "NCR";
    const { data } = await supabase
      .from("ncr_records")
      .select("ncr_number")
      .eq("branch", branchName)
      .ilike("ncr_number", `${prefix}-%`);
    let max = 0;
    for (const row of data ?? []) {
      const m = /-(\d+)$/.exec(row.ncr_number ?? "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${prefix}-${String(max + 1).padStart(4, "0")}`;
  }

  async function uploadPhotos(
    branchName: string,
    ncrNumber: string,
    photos: Photo[],
  ): Promise<string[]> {
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const ext = photos[i].file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const path = `${branchName}/${ncrNumber}/${i}.${ext}`;
      const { error } = await supabase.storage
        .from("ncr-images")
        .upload(path, photos[i].file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("ncr-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function uploadToDrive(
    ncrNumber: string,
    index: number,
    photo: Photo,
  ): Promise<string> {
    try {
      const ext =
        photo.file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `${ncrNumber}-${index + 1}.${ext}`,
          base64: await fileToBase64(photo.file),
          mime: photo.file.type || "image/jpeg",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drive upload failed");
      return data.publicLink ?? data.webViewLink ?? "";
    } catch (err) {
      console.error("Drive upload error:", err);
      return "";
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (!selectedBranch || !selectedDepartment) {
      setError("Select a branch and a department first.");
      return;
    }
    const validIssues = issues.filter((i) => i.raw.trim() !== "");
    if (validIssues.length === 0) {
      setError("Write at least one issue before saving.");
      return;
    }

    setSaving(true);
    const saved: SavedNcr[] = [];
    try {
      for (const issue of validIssues) {
        const ncrNumber = await nextNcrNumber(selectedBranch.name, selectedDepartment.name);
        const description = issue.rephrased.trim() || issue.raw.trim();
        const clauseParts = [issue.clauseNumber.trim(), issue.clauseName.trim()].filter(Boolean);
        const clause = clauseParts.join(" – ");
        const guideline = [selectedGuideline?.standard ?? "", selectedGuideline?.name ?? ""]
          .filter(Boolean)
          .join(" – ");
        const pictures = await uploadPhotos(selectedBranch.name, ncrNumber, issue.photos);

        const driveLinks: string[] = [];
        for (let i = 0; i < issue.photos.length; i++) {
          const link = await uploadToDrive(ncrNumber, i, issue.photos[i]);
          if (link) driveLinks.push(link);
        }

        const { error: insertError } = await supabase.from("ncr_records").insert({
          department_id: selectedDepartment.id,
          ncr_number: ncrNumber,
          branch: selectedBranch.name,
          description,
          clause,
          guideline,
          corrective_action: issue.correctiveAction.trim() === "" ? null : issue.correctiveAction.trim(),
          preventive_action: issue.preventiveAction.trim() === "" ? null : issue.preventiveAction.trim(),
          root_cause: issue.rootCause.trim() === "" ? null : issue.rootCause.trim(),
          consequences: issue.consequences.trim() === "" ? null : issue.consequences.trim(),
          opening_ncs: todayExcelSerial(),
          status: "Action Not Taken Yet",
          priority: "Medium",
          reported_to_ceo: false,
          pictures,
          drive_links: driveLinks.length ? driveLinks : null,
        });
        if (insertError) throw new Error(insertError.message);

        saved.push({
          ncrNumber,
          branch: selectedBranch.name,
          department: selectedDepartment.name,
          guideline,
          clause,
          description,
          rootCause: issue.rootCause.trim() === "" ? "—" : issue.rootCause.trim(),
          correctiveAction: issue.correctiveAction.trim() === "" ? "—" : issue.correctiveAction.trim(),
          preventiveAction: issue.preventiveAction.trim() === "" ? "—" : issue.preventiveAction.trim(),
          consequences: issue.consequences.trim() === "" ? "—" : issue.consequences.trim(),
          openingDate: formatDate(excelSerialToDate(todayExcelSerial())),
          dueDate: "",
          priority: "Medium",
          status: "Action Not Taken Yet",
          photos: issue.photos.map((p) => p.url),
        });
      }

      setSuccess(
        `Saved ${saved.length} NCR${saved.length === 1 ? "" : "s"} (${saved.map((n) => n.ncrNumber).join(", ")}).`,
      );

      for (const ncr of saved) {
        await downloadNcrPdf(ncr);
      }

      setIssues([newIssue()]);
      setSelectedGuidelineReset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save NCRs.");
    } finally {
      setSaving(false);
    }
  }

  function setSelectedGuidelineReset() {
    setGuidelineId("");
  }

  if (loadingData) {
    return <p className="text-sm text-zinc-500">Loading branches and departments...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Record NCRs with AI
        </h3>
        <p className="mb-4 mt-1 text-xs text-zinc-500">
          Select branch, department, and a standard/guideline. Write issues, add photos, let AI
          rephrase and flag the violated clause, then save to NCRs. Photos are backed up to Google
          Drive when connected.
        </p>
        <div className="mb-4">
          <a
            href="/api/drive/auth"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 4 15h5l3 5 3-5h5L12 2Z" />
            </svg>
            Connect Google Drive
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Branch
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Department
            <select
              value={selectedDeptId}
              onChange={(e) => handleDeptChange(e.target.value)}
              disabled={!selectedBranchId}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300 disabled:opacity-50"
            >
              <option value="">Select department</option>
              {branchDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Standard / Guideline
            <select
              value={guidelineId || selectedGuideline?.id || ""}
              onChange={(e) => setGuidelineId(e.target.value)}
              disabled={!selectedDepartment}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300 disabled:opacity-50"
            >
              {!selectedDepartment && <option value="">Select a department first</option>}
              {guidelines.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.standard} – {g.name} ({g.clause})
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedDepartment && guidelines.length === 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            No suggested guidelines for {selectedDepartment.name} yet. Add them in
            lib/guidelines.ts.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {issues.map((issue) => (
          <div
            key={issue.key}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-200">Issue</h4>
              {issues.length > 1 && (
                <button
                  onClick={() => setIssues((prev) => prev.filter((i) => i.key !== issue.key))}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Remove
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              What did you observe?
              <textarea
                value={issue.raw}
                onChange={(e) => updateIssue(issue.key, { raw: e.target.value })}
                rows={2}
                placeholder="e.g. Kitchen floor had food scraps left behind after the lunch shift"
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-300"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-300">
                + Add Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => addPhotos(issue.key, e.target.files)}
                />
              </label>
              <button
                onClick={() => analyzeWithAi(issue)}
                disabled={issue.analyzing || !issue.raw.trim()}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {issue.analyzing ? "Analyzing..." : "Analyze with AI"}
              </button>
            </div>

            {issue.photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {issue.photos.map((photo, index) => (
                  <div key={index} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Photo ${index + 1}`}
                      className="h-20 w-20 rounded-lg border border-zinc-700 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(issue.key, index)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950 text-[10px] text-zinc-300 hover:text-white"
                      title="Remove photo"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {issue.aiError && (
              <p className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                {issue.aiError}
              </p>
            )}

            {issue.rephrased && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                  Rephrased Issue (simple language)
                  <textarea
                    value={issue.rephrased}
                    onChange={(e) => updateIssue(issue.key, { rephrased: e.target.value })}
                    rows={2}
                    className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Clause Number
                    <input
                      type="text"
                      value={issue.clauseNumber}
                      onChange={(e) => updateIssue(issue.key, { clauseNumber: e.target.value })}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Clause Name
                    <input
                      type="text"
                      value={issue.clauseName}
                      onChange={(e) => updateIssue(issue.key, { clauseName: e.target.value })}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Root Cause
                    <textarea
                      value={issue.rootCause}
                      onChange={(e) => updateIssue(issue.key, { rootCause: e.target.value })}
                      rows={2}
                      className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Corrective Action
                    <textarea
                      value={issue.correctiveAction}
                      onChange={(e) => updateIssue(issue.key, { correctiveAction: e.target.value })}
                      rows={2}
                      className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Preventive Action
                    <textarea
                      value={issue.preventiveAction}
                      onChange={(e) => updateIssue(issue.key, { preventiveAction: e.target.value })}
                      rows={2}
                      className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Consequences
                    <textarea
                      value={issue.consequences}
                      onChange={(e) => updateIssue(issue.key, { consequences: e.target.value })}
                      rows={2}
                      className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={() => setIssues((prev) => [...prev, newIssue()])}
          className="self-start rounded-lg border border-dashed border-zinc-600 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-200"
        >
          + Add Another Issue
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          {success} PDFs downloaded.
        </p>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-100 transition-all duration-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "Saving NCRs..." : "Save to NCRs"}
        </button>
      </div>
    </div>
  );
}
