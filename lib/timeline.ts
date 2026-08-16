export const PRIORITY_DAYS: Record<string, number> = {
  Urgent: 2,
  High: 3,
  Medium: 7,
  Low: 10,
};

export const EXCEL_EPOCH_OFFSET = 25569;

export function excelSerialToDate(serial: number): Date {
  return new Date((serial - EXCEL_EPOCH_OFFSET) * 86400000);
}

export function todayExcelSerial(): number {
  return Math.floor(Date.now() / 86400000) + EXCEL_EPOCH_OFFSET;
}

export function isDone(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "done";
}

export function isResolved(
  status: string | null | undefined,
  closingNcs: number | null | undefined,
): boolean {
  return isDone(status) || (closingNcs != null && closingNcs > 0);
}

export function dueSerial(
  openingNcs: number | null | undefined,
  priority: string | null | undefined,
): number | null {
  if (openingNcs == null) return null;
  const days = priority ? PRIORITY_DAYS[priority] : undefined;
  if (!days) return null;
  return openingNcs + days;
}

export function daysOverdue(
  openingNcs: number | null | undefined,
  priority: string | null | undefined,
): number {
  const due = dueSerial(openingNcs, priority);
  if (due == null) return 0;
  const dueDate = excelSerialToDate(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
}
