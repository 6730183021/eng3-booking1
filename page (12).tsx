import { Suspense } from "react";
import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="relative flex flex-col justify-between overflow-hidden bg-maroon-700 px-8 py-10 text-white lg:w-[46%] lg:px-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full border-[48px] border-white/5" />
        <div aria-hidden className="pointer-events-none absolute top-10 -right-10 h-40 w-40 rounded-full border-[24px] border-white/5" />
        <Brand light href="/login" />
        <div className="my-10 max-w-md">
          <h1 className="text-3xl leading-tight font-bold lg:text-4xl">จองห้อง อาคาร 3<br />จบในไม่กี่นาที</h1>
          <p className="mt-4 text-maroon-100">
            เห็นห้องว่างทั้งอาคารบนแผนผังแบบเรียลไทม์ ส่งคำร้องออนไลน์ ระบบออกเอกสารให้อัตโนมัติ
            และติดตามสถานะได้ทันที — ไม่ต้องเดินเอกสารและรอ 5–7 วันอีกต่อไป
          </p>
          <ul className="mt-6 space-y-2 text-sm text-maroon-50">
            <li>● แผนผัง 2D ทุกชั้น พร้อมสถานะห้องสด</li>
            <li>● ล็อกคิวอัตโนมัติ ไม่มีจองชนกัน</li>
            <li>● สร้างเอกสาร PDF และแจ้งผลทางอีเมล</li>
          </ul>
        </div>
        <p className="text-xs text-maroon-200">คณะวิศวกรรมศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย</p>
      </section>
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
