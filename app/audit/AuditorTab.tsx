"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { standardsForDepartment, standardLabel } from "@/lib/guidelines";
import { type NcrPdfData } from "@/lib/ncrPdf";

type Branch = { id: string; name: string };
type Department = { id: string; name: string; branch_id: string };
type AuditSession = {
  id: string;
  name: string;
  status: string;
  branch_id: string;
  department_id: string;
};
type AuditFinding = {
  id: string;
  raw: string | null;
  rephrased: string | null;
  clause_number: string | null;
  clause_name: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  root_cause: string | null;
  consequences: string | null;
  standard: string | null;
  pictures: string[] | null;
  drive_links: string[] | null;
};

type Photo = {
  file: File | null;
  url: string;
  storageUrl?: string;
  storagePath?: string;
  driveUrl?: string;
};

type AiAnalysis = {
  standard: string;
  rephrased: string;
  clauseNumber: string;
  clauseName: string;
  correctiveAction: string;
  preventiveAction: string;
  rootCause: string;
  consequences: string;
};

type Issue = {
  key: string;
  id: string | null;
  raw: string;
  rephrased: string;
  clauseNumber: string;
  clauseName: string;
  correctiveAction: string;
  preventiveAction: string;
  rootCause: string;
  consequences: string;
  standardText: string;
  analyses: AiAnalysis[];
  photos: Photo[];
  analyzing: boolean;
  saving: boolean;
  aiError: string | null;
};

type SavedNcr = NcrPdfData;

const EXCEL_EPOCH_OFFSET = 25569;

const STORAGE_BRANCH = "aiAuditBranchId";
const STORAGE_DEPT = "aiAuditDeptId";
const STORAGE_STANDARDS = "aiAuditStandards";

function readStored(key: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) ?? "";
}

function readStoredStandards(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_STANDARDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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
    id: null,
    raw: "",
    rephrased: "",
    clauseNumber: "",
    clauseName: "",
    correctiveAction: "",
    preventiveAction: "",
    rootCause: "",
    consequences: "",
    standardText: "",
    analyses: [],
    photos: [],
    analyzing: false,
    saving: false,
    aiError: null,
  };
}

function findingToIssue(f: AuditFinding): Issue {
  const driveLinks = f.drive_links ?? [];
  return {
    key: Math.random().toString(36).slice(2),
    id: f.id,
    raw: f.raw ?? "",
    rephrased: f.rephrased ?? "",
    clauseNumber: f.clause_number ?? "",
    clauseName: f.clause_name ?? "",
    correctiveAction: f.corrective_action ?? "",
    preventiveAction: f.preventive_action ?? "",
    rootCause: f.root_cause ?? "",
    consequences: f.consequences ?? "",
    standardText: f.standard ?? "",
    analyses: [],
    photos: (f.pictures ?? []).map((url, i) => {
      const storagePath = url.split("/ncr-images/")[1];
      return {
        file: null,
        url,
        storageUrl: url,
        storagePath: storagePath ? decodeURIComponent(storagePath) : undefined,
        driveUrl: driveLinks[i] ?? "",
      };
    }),
    analyzing: false,
    saving: false,
    aiError: null,
  };
}

export default function AuditorTab({
  branchId,
  deptId,
}: {
  branchId?: string | null;
  deptId?: string | null;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(
    () => branchId || readStored(STORAGE_BRANCH),
  );
  const [selectedDeptId, setSelectedDeptId] = useState(
    () => deptId || readStored(STORAGE_DEPT),
  );
  const [standards, setStandards] = useState<string[]>(readStoredStandards);
  const [issues, setIssues] = useState<Issue[]>([newIssue()]);
  const [activeAudit, setActiveAudit] = useState<AuditSession | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

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

  // Branch/dept query params on a full page load are picked up by the
  // initializers above on mount.

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? null;
  const branchDepartments = departments.filter(
    (d) => d.branch_id === selectedBranchId,
  );
  const selectedDepartment =
    branchDepartments.find((d) => d.id === selectedDeptId) ?? null;

  const applicableStandards: string[] = selectedDepartment
    ? standardsForDepartment(selectedDepartment.name)
    : [];
  const selectedStandards = applicableStandards.filter((s) => standards.includes(s));

  const findingCount = issues.filter(
    (i) => i.raw.trim() !== "" || i.photos.length > 0,
  ).length;

  // Resume an active audit for the selected department.
  useEffect(() => {
    let cancelled = false;
    if (!selectedBranch || !selectedDepartment) return;
    supabase
      .from("audit_sessions")
      .select("*")
      .eq("department_id", selectedDepartment.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return;
        if (data) {
          setActiveAudit(data);
          const { data: findings, error } = await supabase
            .from("audit_findings")
            .select("*")
            .eq("session_id", data.id)
            .order("created_at", { ascending: true });
          if (error) {
            setError(error.message);
            return;
          }
          const list = (findings ?? []).map(findingToIssue);
          setIssues(list.length > 0 ? list : [newIssue()]);
        } else {
          setActiveAudit(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBranch, selectedDepartment]);

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
    if (!photo.file) return "";
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

  async function persistIssue(
    issue: Issue,
  ): Promise<{ id: string; photos: Photo[]; standardText: string } | null> {
    if (!activeAudit || !selectedBranch) return null;
    const hasContent = issue.raw.trim() !== "" || issue.photos.length > 0;
    if (!hasContent) return null;

    const issueStandard =
      issue.standardText || selectedStandards.join("; ") || "";

    try {
      let findingId = issue.id;
      if (!findingId) {
        const { data, error } = await supabase
          .from("audit_findings")
          .insert({
            session_id: activeAudit.id,
            raw: issue.raw.trim() === "" ? null : issue.raw.trim(),
            standard: issueStandard || null,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        findingId = data.id;
      }

      const basePath = `audit-${activeAudit.id}/${findingId}`;

      const photos: Photo[] = [];
      for (const p of issue.photos) {
        const ext =
          (p.file?.name.split(".").pop() ?? "").replace(/[^a-z0-9]/gi, "") || "jpg";
        const path = `${basePath}/${photos.length}.${ext}`;

        let storageUrl = p.storageUrl ?? "";
        let storagePath = p.storagePath;
        if (!storageUrl && p.file) {
          const { error } = await supabase.storage
            .from("ncr-images")
            .upload(path, p.file, { upsert: true });
          if (!error) {
            storageUrl = supabase.storage.from("ncr-images").getPublicUrl(path).data.publicUrl;
            storagePath = path;
          }
        }

        let driveUrl = p.driveUrl ?? "";
        if (!driveUrl && p.file) {
          driveUrl = await uploadToDrive(`${activeAudit.id}-${findingId}`, photos.length, p);
        }

        photos.push({ ...p, storageUrl, storagePath, driveUrl });
      }

      const { error } = await supabase
        .from("audit_findings")
        .update({
          raw: issue.raw.trim() === "" ? null : issue.raw.trim(),
          rephrased: issue.rephrased.trim() === "" ? null : issue.rephrased.trim(),
          clause_number:
            issue.clauseNumber.trim() === "" ? null : issue.clauseNumber.trim(),
          clause_name: issue.clauseName.trim() === "" ? null : issue.clauseName.trim(),
          corrective_action:
            issue.correctiveAction.trim() === "" ? null : issue.correctiveAction.trim(),
          preventive_action:
            issue.preventiveAction.trim() === "" ? null : issue.preventiveAction.trim(),
          root_cause: issue.rootCause.trim() === "" ? null : issue.rootCause.trim(),
          consequences:
            issue.consequences.trim() === "" ? null : issue.consequences.trim(),
          standard: issueStandard || null,
          pictures: photos.map((p) => p.storageUrl).filter(Boolean),
          drive_links: photos.map((p) => p.driveUrl).filter(Boolean),
          updated_at: new Date().toISOString(),
        })
        .eq("id", findingId);
      if (error) throw new Error(error.message);

      return {
        id: findingId as string,
        photos,
        standardText: issueStandard,
      };
    } catch (e) {
      console.error("Failed to save finding:", e);
      return null;
    }
  }

  // Debounced auto-save: findings (and photos) persist to Supabase + Drive
  // while the audit is active, so nothing is lost if the app closes.
  useEffect(() => {
    if (!activeAudit || issues.length === 0) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      issues.forEach((issue) => {
        void persistIssue(issue).then((result) => {
          if (!result) return;
          setIssues((prev) =>
            prev.map((i) => {
              if (i.key !== issue.key) return i;
              const changed =
                i.id !== result.id ||
                result.photos.some((p, idx) => p.storageUrl !== i.photos[idx]?.storageUrl);
              return changed
                ? {
                    ...i,
                    id: result.id,
                    photos: result.photos,
                    standardText: result.standardText,
                  }
                : i;
            }),
          );
        });
      });
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, activeAudit]);

  function handleBranchChange(id: string) {
    if (activeAudit) {
      setError("Stop the current audit first.");
      return;
    }
    setSelectedBranchId(id);
    setSelectedDeptId("");
    window.localStorage.setItem(STORAGE_BRANCH, id);
    window.localStorage.removeItem(STORAGE_DEPT);
    window.localStorage.removeItem(STORAGE_STANDARDS);
    setStandards([]);
  }

  function handleDeptChange(id: string) {
    if (activeAudit) {
      setError("Stop the current audit first.");
      return;
    }
    setSelectedDeptId(id);
    window.localStorage.setItem(STORAGE_DEPT, id);
    setStandards((prev) => {
      const applicable = standardsForDepartment(
        departments.find((d) => d.id === id)?.name ?? "",
      );
      const filtered = prev.filter((s) => applicable.includes(s));
      const next = filtered.length === 0 ? applicable : filtered;
      window.localStorage.setItem(STORAGE_STANDARDS, JSON.stringify(next));
      return next;
    });
  }

  function toggleStandard(s: string) {
    setStandards((prev) => {
      const next = prev.includes(s)
        ? prev.filter((x) => x !== s)
        : [...prev, s];
      window.localStorage.setItem(STORAGE_STANDARDS, JSON.stringify(next));
      return next;
    });
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
    if (!selectedDepartment) {
      setError("Select a branch and a department first.");
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
          standard: selectedStandards[0] ?? null,
          standards: selectedStandards,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateIssue(issue.key, { analyzing: false, aiError: data.error ?? "AI analysis failed." });
        return;
      }
      const analyses: AiAnalysis[] = (data.analyses ?? []).map(
        (a: Record<string, string>) => ({
          standard: a.standard ?? "",
          rephrased: a.rephrased ?? "",
          clauseNumber: a.clause_number ?? "",
          clauseName: a.clause_name ?? "",
          correctiveAction: a.corrective_action ?? "",
          preventiveAction: a.preventive_action ?? "",
          rootCause: a.root_cause ?? "",
          consequences: a.consequences ?? "",
        }),
      );
      updateIssue(issue.key, { analyzing: false, analyses });
    } catch (e) {
      updateIssue(issue.key, {
        analyzing: false,
        aiError: e instanceof Error ? e.message : "AI analysis failed.",
      });
    }
  }

  function applyAnalysis(key: string, a: AiAnalysis) {
    updateIssue(key, {
      standardText: a.standard,
      rephrased: a.rephrased,
      clauseNumber: a.clauseNumber,
      clauseName: a.clauseName,
      correctiveAction: a.correctiveAction,
      preventiveAction: a.preventiveAction,
      rootCause: a.rootCause,
      consequences: a.consequences,
    });
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
      const photo = photos[i];
      if (!photo.file) continue;
      const ext = photo.file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const path = `${branchName}/${ncrNumber}/${i}.${ext}`;
      const { error } = await supabase.storage
        .from("ncr-images")
        .upload(path, photo.file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("ncr-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  async function handleStartAudit() {
    setError(null);
    setSuccess(null);
    if (!selectedBranch || !selectedDepartment) {
      setError("Select a branch and a department first.");
      return;
    }
    const name = `Audit · ${selectedBranch.name} · ${selectedDepartment.name} · ${formatDate(new Date())}`;
    const { data, error } = await supabase
      .from("audit_sessions")
      .insert({
        branch_id: selectedBranch.id,
        department_id: selectedDepartment.id,
        branch_name: selectedBranch.name,
        department_name: selectedDepartment.name,
        name,
        status: "active",
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setActiveAudit(data);
    setIssues([newIssue()]);
  }

  async function handleDeleteIssue(issue: Issue) {
    if (activeAudit && issue.id) {
      if (!confirm("Delete this finding from the audit? This cannot be undone.")) return;
      const { error } = await supabase
        .from("audit_findings")
        .delete()
        .eq("id", issue.id);
      if (error) {
        setError(error.message);
        return;
      }
      const paths = issue.photos
        .map((p) => p.storagePath)
        .filter((x): x is string => !!x);
      if (paths.length > 0) {
        await supabase.storage.from("ncr-images").remove(paths);
      }
    }
    setIssues((prev) => {
      const next = prev.filter((i) => i.key !== issue.key);
      return next.length > 0 ? next : [newIssue()];
    });
  }

  async function handleStopAudit() {
    if (!activeAudit || !selectedBranch || !selectedDepartment) return;
    const validIssues = issues.filter(
      (i) => i.raw.trim() !== "" || i.photos.length > 0,
    );
    if (
      !confirm(
        `Add ${validIssues.length} finding${validIssues.length === 1 ? "" : "s"} to ${selectedDepartment.name} as NCRs and stop this audit?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    const saved: SavedNcr[] = [];
    try {
      for (const issue of validIssues) {
        const result = await persistIssue(issue);
        const photos = result?.photos ?? issue.photos;
        const standardText =
          result?.standardText ?? issue.standardText ?? selectedStandards.join("; ") ?? "";

        const ncrNumber = await nextNcrNumber(selectedBranch.name, selectedDepartment.name);
        const description = issue.rephrased.trim() || issue.raw.trim();
        const clauseParts = [issue.clauseNumber.trim(), issue.clauseName.trim()].filter(Boolean);
        const clause = clauseParts.join(" – ");
        const pictures = photos.map((p) => p.storageUrl).filter((x): x is string => !!x);
        const driveLinks = photos.map((p) => p.driveUrl).filter((x): x is string => !!x);

        const { error: insertError } = await supabase.from("ncr_records").insert({
          department_id: selectedDepartment.id,
          ncr_number: ncrNumber,
          branch: selectedBranch.name,
          description,
          clause,
          guideline: standardText,
          corrective_action: issue.correctiveAction.trim() === "" ? null : issue.correctiveAction.trim(),
          preventive_action: issue.preventiveAction.trim() === "" ? null : issue.preventiveAction.trim(),
          root_cause: issue.rootCause.trim() === "" ? null : issue.rootCause.trim(),
          consequences: issue.consequences.trim() === "" ? null : issue.consequences.trim(),
          opening_ncs: todayExcelSerial(),
          status: "Action Not Taken Yet",
          priority: "Medium",
          reported_to_ceo: false,
          pictures: pictures.length > 0 ? pictures : null,
          drive_links: driveLinks.length > 0 ? driveLinks : null,
        });
        if (insertError) throw new Error(insertError.message);

        saved.push({
          ncrNumber,
          branch: selectedBranch.name,
          department: selectedDepartment.name,
          guideline: standardText,
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
          photos: photos.map((p) => p.url),
        });
      }

      const { error: closeError } = await supabase
        .from("audit_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", activeAudit.id);
      if (closeError) throw new Error(closeError.message);

      setActiveAudit(null);
      setIssues([newIssue()]);
      setSuccess(
        `Audit stopped. ${saved.length} NCR${saved.length === 1 ? "" : "s"} added to ${selectedDepartment.name} (${saved.map((n) => n.ncrNumber).join(", ")}).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finalize audit.");
    } finally {
      setSaving(false);
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
        const guideline = issue.standardText || selectedStandards.join("; ");
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

      setIssues([newIssue()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save NCRs.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return <p className="text-sm text-zinc-500">Loading branches and departments...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          AI Auditor
        </h3>
        <p className="mb-4 mt-1 text-xs text-zinc-500">
          Select branch, department, and one or more standards to audit against. Click{" "}
          <span className="text-zinc-300">Start Audit</span> — everything you record (issues,
          photos, AI findings) is saved automatically to Supabase and Google Drive, so closing or
          refreshing the app never loses data. When done, click{" "}
          <span className="text-zinc-300">Stop Audit</span> to add all findings to the department
          as NCRs.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Branch
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={!!activeAudit}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300 disabled:opacity-50"
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
              disabled={!selectedBranchId || !!activeAudit}
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
            Standards (select one or more)
            {!selectedDepartment ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-600">
                Select a department first
              </div>
            ) : applicableStandards.length === 0 ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-600">
                No standards configured for this department
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {applicableStandards.map((s) => {
                  const active = selectedStandards.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStandard(s)}
                      disabled={!!activeAudit}
                      className={`rounded-full border px-3 py-1.5 text-left transition-colors disabled:opacity-50 ${
                        active
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold">{s}</span>
                      <span
                        className={`block text-[10px] ${
                          active ? "text-emerald-300/80" : "text-zinc-500"
                        }`}
                      >
                        {standardLabel(s)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </label>
        </div>

        {selectedBranch && selectedDepartment && !activeAudit && (
          <button
            onClick={handleStartAudit}
            className="mt-4 rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25"
          >
            Start Audit
          </button>
        )}
      </div>

      {activeAudit && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-200">
                Audit in progress · {findingCount} finding{findingCount === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-emerald-300/70">{activeAudit.name}</p>
              <p className="mt-0.5 text-xs text-emerald-300/70">
                Auto-saved. Photos go to Google Drive, findings to Supabase. Close the app anytime
                and come back.
              </p>
            </div>
            <button
              onClick={handleStopAudit}
              disabled={saving}
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {saving ? "Finalizing..." : "Stop Audit"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {issues.map((issue) => (
          <div
            key={issue.key}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-200">
                Issue
                {issue.saving && <span className="ml-2 text-xs font-normal text-zinc-500">Saving...</span>}
              </h4>
              <button
                onClick={() => handleDeleteIssue(issue)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                {activeAudit ? "Delete" : issues.length > 1 ? "Remove" : ""}
              </button>
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

            {issue.analyses.length > 0 && (
              <div className="mt-4 flex flex-col gap-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Clause violation per standard — pick the one to use
                </p>
                {issue.analyses.map((a) => {
                  const chosen =
                    issue.standardText === a.standard &&
                    (issue.clauseNumber === a.clauseNumber || issue.rephrased === a.rephrased);
                  return (
                    <div
                      key={a.standard}
                      className={`rounded-lg border p-3 ${
                        chosen
                          ? "border-emerald-500/60 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">
                            {standardLabel(a.standard)}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {a.clauseNumber}
                            {a.clauseName ? ` – ${a.clauseName}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {chosen && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              Chosen
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => applyAnalysis(issue.key, a)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              chosen
                                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
                                : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                            }`}
                          >
                            {chosen ? "Use this" : "Use this"}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-zinc-300">{a.rephrased}</p>
                      <div className="mt-2 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                        <div>
                          <span className="font-medium text-zinc-300">Corrective: </span>
                          {a.correctiveAction}
                        </div>
                        <div>
                          <span className="font-medium text-zinc-300">Preventive: </span>
                          {a.preventiveAction}
                        </div>
                        <div>
                          <span className="font-medium text-zinc-300">Root cause: </span>
                          {a.rootCause}
                        </div>
                        <div>
                          <span className="font-medium text-zinc-300">Consequences: </span>
                          {a.consequences}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-zinc-500">
                  Click <span className="text-zinc-300">Use this</span> to load the chosen
                  standard finding below, then edit before adding as an NCR.
                </p>
              </div>
            )}

            {issue.rephrased && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                {issue.standardText && (
                  <p className="text-xs font-medium text-emerald-300">
                    Standard: {standardLabel(issue.standardText)}
                  </p>
                )}
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
          {success}
        </p>
      )}

      <div className="sticky bottom-4 flex justify-end">
        {activeAudit ? (
          <button
            onClick={handleStopAudit}
            disabled={saving}
            className="rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-6 py-2.5 text-sm font-semibold text-emerald-100 transition-all duration-300 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {saving ? "Adding NCRs..." : "Stop Audit & Add NCRs"}
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-100 transition-all duration-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? "Saving NCRs..." : "Save to NCRs"}
          </button>
        )}
      </div>
    </div>
  );
}
