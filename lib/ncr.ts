export type NcrRecord = {
  id: string;
  department_id: string | null;
  ncr_number: string | null;
  description: string | null;
  branch: string | null;
  clause: string | null;
  guideline: string | null;
  opening_ncs: number | null;
  closing_ncs: number | null;
  corrective_action: string | null;
  preventive_action: string | null;
  root_cause: string | null;
  consequences: string | null;
  status: string | null;
  hod_name: string | null;
  hod_comments: string | null;
  branch_manager: string | null;
  branch_manager_comments: string | null;
  hr: string | null;
  hr_comments: string | null;
  ceo: string | null;
  ceo_comments: string | null;
  priority: string | null;
  reported_to_ceo: boolean | null;
  pictures: string[] | null;
  drive_links: string[] | null;
};

export type Field = {
  key: string;
  label: string;
  type?: "number" | "select";
  options?: string[];
};

export const FIELDS: Field[] = [
  { key: "ncr_number", label: "NCR #" },
  { key: "description", label: "Description" },
  { key: "branch", label: "Branch" },
  { key: "clause", label: "Clause" },
  { key: "opening_ncs", label: "Opening NCs", type: "number" },
  { key: "closing_ncs", label: "Closing NCs", type: "number" },
  { key: "corrective_action", label: "Corrective Action" },
  { key: "preventive_action", label: "Preventive Action" },
  { key: "root_cause", label: "Root Cause" },
  { key: "consequences", label: "Consequences" },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["Urgent", "High", "Medium", "Low"],
  },
  { key: "branch_manager_comments", label: "Comments from Branch Manager" },
  {
    key: "reported_to_ceo",
    label: "Reported to CEO",
    type: "select",
    options: ["Yes", "No"],
  },
  { key: "status", label: "Status" },
];

const HEADER_MAP: Record<string, string> = {
  "ncr #": "ncr_number",
  description: "description",
  branch: "branch",
  clause: "clause",
  "opening ncs": "opening_ncs",
  "closing ncs": "closing_ncs",
  "corrective action": "corrective_action",
  "preventive action": "preventive_action",
  "root cause": "root_cause",
  consequences: "consequences",
  status: "status",
  priority: "priority",
  "reported to ceo": "reported_to_ceo",
  "comments from branch manager": "branch_manager_comments",
};

const NUMBER_KEYS = new Set(["opening_ncs", "closing_ncs"]);

export function exportNcrToXlsx(records: NcrRecord[]) {
  return (async () => {
    const XLSX = await import("xlsx");
    const rows = records.map((record) => {
      const row: Record<string, unknown> = {};
      for (const field of FIELDS) {
        row[field.label] = record[field.key as keyof NcrRecord] ?? "";
      }
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NCRs");
    XLSX.writeFile(workbook, "ncrs.xlsx");
  })();
}

const DATE_KEYS = new Set(["opening_ncs", "closing_ncs"]);

export function formatExcelDate(value: unknown): string {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const date = new Date((num - 25569) * 86400000);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDisplayValue(key: string, value: unknown): string {
  if (value == null || value === "") return "";
  if (DATE_KEYS.has(key)) return formatExcelDate(value);
  return String(value);
}

export async function parseNcrFile(file: File): Promise<Partial<NcrRecord>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rawRows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(row)) {
      const key = HEADER_MAP[String(header).trim().toLowerCase()];
      if (!key) continue;
      if (NUMBER_KEYS.has(key)) {
        const num = Number(value);
        record[key] = value === "" || Number.isNaN(num) ? null : num;
      } else if (key === "reported_to_ceo") {
        const v = String(value).trim().toLowerCase();
        record[key] = ["yes", "true", "1", "y"].includes(v)
          ? true
          : ["no", "false", "0", "n"].includes(v)
            ? false
            : null;
      } else {
        record[key] = value === "" ? null : String(value);
      }
    }
    return record as Partial<NcrRecord>;
  });
}
