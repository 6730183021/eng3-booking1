"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const STUDENT_DOMAIN = "student.chula.ac.th";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [staffMode, setStaffMode] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(authErrorMessage(params.get("error")));

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback(),
        // Chula Google Workspace signs in through CUNET (Microsoft 365) SSO
        queryParams: staffMode ? { prompt: "select_account" } : { hd: STUDENT_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) {
      setError(authErrorMessage(error.message));
      setBusy(null);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!staffMode && !value.endsWith(`@${STUDENT_DOMAIN}`)) {
      return setError(`กรุณาใช้อีเมลนิสิต @${STUDENT_DOMAIN}`);
    }
    setBusy("email");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ email: value, options: { emailRedirectTo: callback() } });
    setBusy(null);
    if (error) return setError(authErrorMessage(error.message));
    setSent(true);
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-slate-900">{staffMode ? "เข้าสู่ระบบเจ้าหน้าที่" : "เข้าสู่ระบบนิสิต"}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {staffMode ? "ใช้บัญชีเจ้าหน้าที่ที่ได้รับสิทธิ์จากผู้ดูแลระบบ" : `ใช้อีเมลนิสิตจุฬาฯ (@${STUDENT_DOMAIN}) เท่านั้น`}
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

      {sent ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">ส่งลิงก์เข้าสู่ระบบไปที่ {email} แล้ว</p>
          <p className="mt-1">เปิดอีเมล (CU Outlook) แล้วคลิกลิงก์เพื่อเข้าสู่ระบบ ลิงก์มีอายุจำกัด</p>
          <button className="mt-3 text-emerald-900 underline" onClick={() => setSent(false)}>ใช้อีเมลอื่น</button>
        </div>
      ) : (
        <>
          <Button size="lg" variant="outline" className="mt-6 w-full" onClick={google} loading={busy === "google"}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
            </svg>
            เข้าสู่ระบบด้วยบัญชี Chula (Google)
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> หรือรับลิงก์ทางอีเมล <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={magicLink} className="space-y-3">
            <Field label="อีเมล" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={staffMode ? "name@chula.ac.th" : `6xxxxxxxxx@${STUDENT_DOMAIN}`} />
            </Field>
            <Button type="submit" className="w-full" loading={busy === "email"}>
              <Mail className="h-4 w-4" /> ส่งลิงก์เข้าสู่ระบบ
            </Button>
          </form>
        </>
      )}

      <button
        className="mt-8 flex items-center gap-1.5 text-sm text-slate-500 hover:text-maroon-700"
        onClick={() => { setStaffMode((s) => !s); setError(null); setSent(false); }}
      >
        <ShieldCheck className="h-4 w-4" />
        {staffMode ? "กลับไปหน้าเข้าสู่ระบบนิสิต" : "สำหรับเจ้าหน้าที่คณะ"}
      </button>
    </div>
  );
}
