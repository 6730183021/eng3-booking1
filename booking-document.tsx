// =============================================================================
// แบบคำร้องขอใช้ห้อง — PDF template (@react-pdf/renderer)
// ⚠️ TEMPORARY LAYOUT. When the faculty's official form is available, replace
//    the JSX below — the data (`booking`) and the route stay the same.
// =============================================================================
import path from "node:path";
import type { ComponentProps, ReactNode } from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ACTIVITY_TYPES, EQUIPMENT, STATUS_META } from "../constants";
import { fmtDate, fmtDateTime, fmtTimeRange, fmtDuration } from "../time";
import type { BookingWithRoom } from "../types";

// ---------------------------------------------------------------- Thai font
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(FONT_DIR, "Sarabun-Regular.ttf") },
    { src: path.join(FONT_DIR, "Sarabun-Bold.ttf"), fontWeight: "bold" },
  ],
});

// Thai has no spaces between words → give the layout engine word boundaries
// (Intl.Segmenter uses ICU's Thai dictionary). The '' entries mark break
// opportunities without inserting a hyphen.
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
Font.registerHyphenationCallback((word) => {
  if (!/[฀-๿]/.test(word)) return [word];
  return Array.from(segmenter.segment(word)).flatMap((s) => [s.segment, ""]);
});

// fontkit decomposes SARA AM (ำ) into two glyphs, which shifts react-pdf's
// character↔glyph mapping and drops characters. Pre-decomposing fixes it and
// renders identically.
const thai = (v: unknown): string => String(v ?? "").replace(/\u0E33/g, "\u0E4D\u0E32");

/** <T> that is safe for Thai strings */
type PdfStyle = ComponentProps<typeof View>["style"];
function T({ children, ...props }: { children?: ReactNode; style?: PdfStyle }) {
  const fix = (c: ReactNode): ReactNode =>
    typeof c === "string" || typeof c === "number" ? thai(c) : Array.isArray(c) ? c.map(fix) : c;
  return <Text {...props}>{fix(children)}</Text>;
}

const MAROON = "#800000";
const s = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 10.5, paddingTop: 30, paddingBottom: 46, paddingHorizontal: 44, color: "#111827", lineHeight: 1.35 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  mark: { width: 42, height: 42, backgroundColor: MAROON, color: "#fff", fontWeight: "bold", fontSize: 16, textAlign: "center", paddingTop: 9, borderRadius: 4 },
  docMeta: { alignItems: "flex-end", fontSize: 10 },
  title: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginTop: 2, marginBottom: 6, lineHeight: 1.2 },
  subtitle: { fontSize: 12, textAlign: "center", color: "#374151" },
  rule: { borderBottomWidth: 1.5, borderBottomColor: MAROON, marginVertical: 8 },
  stamp: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, fontWeight: "bold", fontSize: 11, marginTop: 4 },
  para: { textIndent: 36, textAlign: "justify", marginBottom: 6 },
  section: { marginTop: 7 },
  sectionTitle: { fontWeight: "bold", color: MAROON, fontSize: 11.5, marginBottom: 3 },
  table: { borderWidth: 0.75, borderColor: "#9ca3af" },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: "#d1d5db" },
  trLast: { flexDirection: "row" },
  th: { width: "18%", backgroundColor: "#f3f4f6", paddingVertical: 3, paddingHorizontal: 5, fontWeight: "bold" },
  td: { width: "82%", paddingVertical: 3, paddingHorizontal: 5 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  signBox: { width: "46%", alignItems: "center" },
  signLine: { marginTop: 20, borderBottomWidth: 0.75, borderBottomColor: "#6b7280", width: "85%" },
  small: { fontSize: 8.5, color: "#6b7280", textAlign: "center" },
  officeBox: { marginTop: 12, borderWidth: 1, borderColor: MAROON, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 10 },
  checkRow: { flexDirection: "row", marginTop: 2 },
  check: { width: 10, height: 10, borderWidth: 0.9, borderColor: "#111827", marginRight: 5, marginTop: 3, textAlign: "center", fontSize: 8, lineHeight: 1 },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: "#6b7280", borderTopWidth: 0.5, borderTopColor: "#d1d5db", paddingTop: 4 },
});

const STAMP_COLOR: Record<string, string> = {
  approved: "#047857", rejected: "#b91c1c", cancelled: "#6b7280", submitted: "#1d4ed8", in_review: "#6d28d9", holding: "#b45309",
};

function Row({ k, v, last }: { k: string; v?: string | number | null; last?: boolean }) {
  return (
    <View style={last ? s.trLast : s.tr} wrap={false}>
      <T style={s.th}>{k}</T>
      <T style={s.td}>{v === null || v === undefined || v === "" ? "-" : String(v)}</T>
    </View>
  );
}

function Row4({ k1, v1, k2, v2, last }: { k1: string; v1?: string | number | null; k2: string; v2?: string | number | null; last?: boolean }) {
  const val = (v?: string | number | null) => (v === null || v === undefined || v === "" ? "-" : String(v));
  return (
    <View style={last ? s.trLast : s.tr} wrap={false}>
      <T style={[s.th, { width: "18%" }]}>{k1}</T>
      <T style={[s.td, { width: "32%" }]}>{val(v1)}</T>
      <T style={[s.th, { width: "19%" }]}>{k2}</T>
      <T style={[s.td, { width: "31%" }]}>{val(v2)}</T>
    </View>
  );
}

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={s.checkRow}>
      <T style={s.check}>{on ? "X" : " "}</T>
      <T>{label}</T>
    </View>
  );
}

export function BookingDocument({ booking: b, siteUrl, generatedAt }: { booking: BookingWithRoom; siteUrl: string; generatedAt: Date }) {
  const r = b.requester;
  const minutes = (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000;
  const meta = STATUS_META[b.status];
  const decided = b.status === "approved" || b.status === "rejected";

  return (
    <Document title={`คำร้องขอใช้ห้อง ${b.doc_no ?? ""}`} author="ระบบจองห้อง อาคาร 3" subject="แบบคำร้องขอใช้ห้อง" language="th">
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <T style={s.mark}>E3</T>
          <View style={s.docMeta}>
            <T>เลขที่คำร้อง <T style={{ fontWeight: "bold" }}>{b.doc_no ?? "-"}</T></T>
            <T>วันที่ยื่น {b.submitted_at ? fmtDateTime(b.submitted_at) : "-"}</T>
            <T style={[s.stamp, { color: STAMP_COLOR[b.status], borderColor: STAMP_COLOR[b.status] }]}>
              สถานะ: {meta.label}
            </T>
          </View>
        </View>

        <T style={s.title}>แบบคำร้องขอใช้ห้อง อาคาร 3</T>
        <T style={s.subtitle}>คณะวิศวกรรมศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย</T>
        <View style={s.rule} />

        <T style={{ marginBottom: 6 }}>เรียน  หัวหน้างานอาคารสถานที่ คณะวิศวกรรมศาสตร์</T>
        <T style={s.para}>
          ข้าพเจ้า {r?.full_name ?? "-"} รหัสนิสิต {r?.student_id ?? "-"} ภาควิชา{r?.department ?? "-"} ชั้นปีที่ {r?.year_of_study ?? "-"}
          {" "}มีความประสงค์ขอใช้ห้อง {b.room.code} ({b.room.name}) ชั้น {b.room.floor} ใน{fmtDate(b.starts_at)} เวลา {fmtTimeRange(b.starts_at, b.ends_at)}
          {" "}เพื่อจัดกิจกรรม “{b.activity_name ?? "-"}” โดยมีผู้เข้าร่วมประมาณ {b.attendees ?? "-"} คน รายละเอียดดังนี้
        </T>

        <View style={s.section}>
          <T style={s.sectionTitle}>1. ข้อมูลผู้ขอใช้ห้อง</T>
          <View style={s.table}>
            <Row4 k1="ชื่อ–นามสกุล" v1={r?.full_name} k2="รหัสนิสิต" v2={`${r?.student_id ?? "-"} (ชั้นปีที่ ${r?.year_of_study ?? "-"})`} />
            <Row4 k1="ภาควิชา" v1={r?.department} k2="หน่วยงาน/ชมรม" v2={b.organization} />
            <Row4 k1="อาจารย์ที่ปรึกษา" v1={b.advisor_name} k2="โทรศัพท์" v2={b.contact_phone} />
            <Row k="อีเมล" v={r?.email} last />
          </View>
        </View>

        <View style={s.section}>
          <T style={s.sectionTitle}>2. รายละเอียดการใช้ห้อง</T>
          <View style={s.table}>
            <Row k="ห้อง" v={`${b.room.code} ${b.room.name} (ชั้น ${b.room.floor}, ความจุ ${b.room.capacity} คน)`} />
            <Row k="วันและเวลา" v={`${fmtDate(b.starts_at)} เวลา ${fmtTimeRange(b.starts_at, b.ends_at)} (${fmtDuration(minutes)})`} />
            <Row k="ชื่อกิจกรรม" v={b.activity_name} />
            <Row4 k1="ประเภทกิจกรรม" v1={ACTIVITY_TYPES[b.activity_type ?? ""] ?? b.activity_type} k2="ผู้เข้าร่วม" v2={`${b.attendees ?? "-"} คน`} />
            <Row k="วัตถุประสงค์" v={b.purpose} />
            <Row k="อุปกรณ์ที่ต้องการ" v={b.equipment.length ? b.equipment.map((e) => EQUIPMENT[e] ?? e).join(", ") : "ไม่มี"} />
            <Row k="หมายเหตุ" v={b.extra_notes} last />
          </View>
        </View>

        <T style={[s.para, { marginTop: 10 }]}>
          ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นความจริง และจะดูแลความสะอาด ความเรียบร้อย ตลอดจนทรัพย์สินภายในห้อง
          หากเกิดความเสียหายข้าพเจ้ายินดีรับผิดชอบตามระเบียบของคณะ
        </T>

        <View style={s.signRow} wrap={false}>
          <View style={s.signBox}>
            <T>ผู้ยื่นคำร้อง</T>
            <T style={{ marginTop: 8, fontWeight: "bold" }}>( {r?.full_name ?? "-"} )</T>
            <T style={[s.small, { marginTop: 2 }]}>ยืนยันตัวตนทางอิเล็กทรอนิกส์ด้วยบัญชี</T>
            <T style={s.small}>{r?.email ?? "-"}</T>
            <T style={s.small}>เมื่อ {b.submitted_at ? fmtDateTime(b.submitted_at) : "-"}</T>
          </View>
          <View style={s.signBox}>
            <T>อาจารย์ที่ปรึกษาโครงการ (ถ้ามี)</T>
            <View style={s.signLine} />
            <T style={{ marginTop: 4 }}>( {b.advisor_name || "........................................"} )</T>
          </View>
        </View>

        <View style={s.officeBox} wrap={false}>
          <T style={{ fontWeight: "bold", color: MAROON }}>สำหรับเจ้าหน้าที่</T>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Check on={b.status === "approved"} label="อนุมัติ" />
              <Check on={b.status === "rejected"} label="ไม่อนุมัติ" />
              <Check on={b.status === "cancelled"} label="ยกเลิก / เพิกถอน" />
            </View>
            <View style={{ width: "55%" }}>
              <T>ผู้พิจารณา: {decided ? b.reviewer_name ?? "เจ้าหน้าที่" : "........................................"}</T>
              <T>วันที่พิจารณา: {b.reviewed_at ? fmtDateTime(b.reviewed_at) : "........................................"}</T>
              <T>หมายเหตุ: {b.review_note ?? b.cancel_reason ?? "-"}</T>
            </View>
          </View>
          {decided && <T style={[s.small, { marginTop: 6 }]}>บันทึกผลการพิจารณาผ่านระบบอิเล็กทรอนิกส์ ไม่ต้องลงนามบนกระดาษ</T>}
        </View>

        <View style={s.footer} fixed>
          <T>สร้างโดยระบบจองห้อง อาคาร 3 · {fmtDateTime(generatedAt)} · ตรวจสอบสถานะ: {siteUrl}/my-bookings</T>
          {/* note: a `render` (page-number) Text inside this fixed footer makes react-pdf drop the footer */}
          <T>{b.doc_no ?? ""}</T>
        </View>
      </Page>
    </Document>
  );
}
