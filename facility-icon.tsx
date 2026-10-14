import {
  AirVent, Mic, Monitor, MonitorSmartphone, PenLine, Plug, Presentation, Projector, Tv, Video,
  type LucideIcon,
} from "lucide-react";
import { FACILITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  projector: Projector,
  smart_board: MonitorSmartphone,
  whiteboard: PenLine,
  tv: Tv,
  mic: Mic,
  computers: Monitor,
  video_conf: Video,
  power_outlets: Plug,
  aircon: AirVent,
};

export function FacilityChips({ facilities, className }: { facilities: string[]; className?: string }) {
  if (!facilities.length) return <span className="text-xs text-slate-400">ไม่มีข้อมูลอุปกรณ์</span>;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {facilities.map((f) => {
        const Icon = ICONS[f] ?? Presentation;
        return (
          <li key={f} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            {FACILITIES[f] ?? f}
          </li>
        );
      })}
    </ul>
  );
}
