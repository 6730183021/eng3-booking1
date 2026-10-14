import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 " +
  "focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-200 disabled:bg-slate-50 disabled:text-slate-500 " +
  "aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-100";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(field, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(field, "min-h-24 py-2", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(field, "h-10 pr-8", className)} {...props} />;
  },
);

export function Label({ className, required, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("text-sm font-medium text-slate-700", className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-maroon-700">*</span>}
    </label>
  );
}

/** Label + control + hint/error, laid out consistently */
export function Field({
  label, htmlFor, required, hint, error, className, children,
}: {
  label: string; htmlFor?: string; required?: boolean; hint?: React.ReactNode; error?: string;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 text-sm text-slate-700", className)}>
      <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 accent-maroon-700" {...props} />
      <span>{label}</span>
    </label>
  );
}
