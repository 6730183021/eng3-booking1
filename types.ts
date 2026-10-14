// Hand-written DB types for the MVP.
// Tip for the next team: replace with generated types →  npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type UserRole = "student" | "staff" | "approver" | "super_admin";
export type BookingStatus =
  | "holding"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "cancelled";
export type RoomStatus = "active" | "maintenance";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  year_of_study: number | null;
  phone: string | null;
  privacy_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FloorFeatureType = "corridor" | "stairs" | "lift" | "restroom" | "lobby" | "office";

export interface FloorFeature {
  type: FloorFeatureType;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface Floor {
  floor: number;
  label: string;
  features: FloorFeature[];
}

export interface Room {
  id: string;
  code: string;
  name: string;
  floor: number;
  capacity: number;
  facilities: string[];
  status: RoomStatus;
  status_note: string | null;
  map_x: number;
  map_y: number;
  map_w: number;
  map_h: number;
}

export interface RoomBlock {
  id: string;
  room_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string;
  created_at?: string;
}

/** Public, anonymous occupancy (mirror of live bookings) */
export interface RoomSlot {
  booking_id: string;
  room_id: string;
  starts_at: string;
  ends_at: string;
  state: "held" | "pending" | "approved";
  hold_expires_at: string | null;
}

export interface Requester {
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  year_of_study: number | null;
  phone: string | null;
  email: string;
}

export interface Booking {
  id: string;
  doc_no: string | null;
  room_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  hold_expires_at: string | null;
  activity_name: string | null;
  activity_type: string | null;
  purpose: string | null;
  attendees: number | null;
  organization: string | null;
  advisor_name: string | null;
  contact_phone: string | null;
  equipment: string[];
  extra_notes: string | null;
  requester: Requester | null;
  submitted_at: string | null;
  review_started_at: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  opened_at: string | null;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingEvent {
  id: number;
  booking_id: string;
  actor_id: string | null;
  action: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus | null;
  note: string | null;
  created_at: string;
}

export type RoomSummary = Pick<Room, "id" | "code" | "name" | "floor" | "capacity">;

export interface BookingWithRoom extends Booking {
  room: RoomSummary;
  events?: BookingEvent[];
}

export interface BookingSettings {
  min_lead_hours: number;
  max_duration_minutes: number;
  slot_minutes: number;
  open_time: string; // "08:00:00"
  close_time: string;
  open_days: number[]; // ISO 1=Mon … 7=Sun
  hold_minutes: number;
  cancel_before_hours: number;
  max_advance_days: number;
  max_active_bookings: number;
  allowed_email_domains: string[];
  timezone: string;
}

export interface StaffMember {
  email: string;
  role: Exclude<UserRole, "student">;
  created_at: string;
}

/** Result shape returned by every Server Action */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; detail?: string };
