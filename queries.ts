/** Shared PostgREST select strings */
export const BOOKING_WITH_ROOM = "*, room:rooms(id, code, name, floor, capacity)";
export const BOOKING_WITH_ROOM_AND_EVENTS =
  "*, room:rooms(id, code, name, floor, capacity), events:booking_events(id, action, from_status, to_status, note, created_at)";
