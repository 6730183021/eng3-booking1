// All wall-clock times in this app are Bangkok time (UTC+7, no daylight saving).
export const TZ = "Asia/Bangkok";
const OFFSET = "+07:00";

const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});
const timeKeyFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** "2026-10-15" + "13:30" (Bangkok) → Date */
export function toInstant(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time.slice(0, 5)}:00${OFFSET}`);
}

/** Date → "YYYY-MM-DD" in Bangkok */
export function dateKey(d: Date | string): string {
  return dateKeyFmt.format(new Date(d));
}

/** Date → "HH:mm" in Bangkok */
export function timeKey(d: Date | string): string {
  return timeKeyFmt.format(new Date(d));
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO day of week: 1 = Monday … 7 = Sunday */
export function isoDow(key: string): number {
  const d = new Date(`${key}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function dayBounds(key: string) {
  return { start: toInstant(key, "00:00"), end: toInstant(addDays(key, 1), "00:00") };
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** ["08:00", "08:30", …, "20:00"] */
export function timeSlots(open: string, close: string, step: number): string[] {
  const out: string[] = [];
  for (let m = minutesOf(open); m <= minutesOf(close); m += step) out.push(hhmm(m));
  return out;
}

export function overlaps(aStart: Date | string, aEnd: Date | string, bStart: Date | string, bEnd: Date | string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

// ---------------------------------------------------------------- formatting (Thai)
export function fmtDate(d: Date | string, style: "long" | "medium" | "short" = "long"): string {
  const opts: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "medium"
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { day: "numeric", month: "short", year: "2-digit" };
  return new Intl.DateTimeFormat("th-TH", { timeZone: TZ, ...opts }).format(new Date(d));
}

export function fmtTimeRange(start: Date | string, end: Date | string): string {
  return `${timeKey(start)}–${timeKey(end)} น.`;
}

export function fmtDateTime(d: Date | string): string {
  return `${fmtDate(d, "short")} ${timeKey(d)} น.`;
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} ชม.` : "", m ? `${m} นาที` : ""].filter(Boolean).join(" ") || "0 นาที";
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
export function fmtRelative(d: Date | string, now: Date = new Date()): string {
  const diffMin = Math.round((new Date(d).getTime() - now.getTime()) / 60000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 48) return rtf.format(diffH, "hour");
  return rtf.format(Math.round(diffH / 24), "day");
}
