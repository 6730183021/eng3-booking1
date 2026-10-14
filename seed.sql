-- =============================================================================
-- ENG3 Room Booking — Seed data
-- ⚠️ Floor plans & rooms below are SAMPLE data for the MVP. Replace them with the
--    real layout of อาคาร 3 (or edit in the admin screen: /admin/rooms).
--    Coordinates use the SVG viewBox 1000 × 560 (x → right, y → down).
-- =============================================================================

-- Shared core (corridor / stairs / lift / restrooms) for every floor
with core as (
  select '[
    {"type":"corridor","x":20,"y":255,"w":960,"h":50,"label":"ทางเดิน"},
    {"type":"stairs","x":20,"y":30,"w":90,"h":110,"label":"บันได"},
    {"type":"restroom","x":20,"y":140,"w":90,"h":115,"label":"ห้องน้ำ"},
    {"type":"lift","x":450,"y":175,"w":100,"h":80,"label":"ลิฟต์"},
    {"type":"restroom","x":890,"y":305,"w":90,"h":115,"label":"ห้องน้ำ"},
    {"type":"stairs","x":890,"y":420,"w":90,"h":110,"label":"บันไดหนีไฟ"}
  ]'::jsonb as f
)
insert into public.floors (floor, label, features)
select 1, 'ชั้น 1', f || '[
    {"type":"lobby","x":20,"y":305,"w":280,"h":225,"label":"โถงทางเข้า"},
    {"type":"office","x":300,"y":305,"w":150,"h":225,"label":"สำนักงานอาคาร"}
  ]'::jsonb from core
union all select 2, 'ชั้น 2', f from core
union all select 3, 'ชั้น 3', f from core
union all select 4, 'ชั้น 4', f from core;

insert into public.rooms (code, name, floor, capacity, facilities, map_x, map_y, map_w, map_h, status, status_note) values
-- ชั้น 1
('3-101', 'ห้องบรรยายรวม 101',      1, 150, '{projector,mic,aircon,whiteboard,video_conf}', 110,  30, 340, 225, 'active', null),
('3-106', 'ห้องประชุมเล็ก 106',      1,  10, '{tv,aircon,whiteboard}',                       450,  30, 100, 145, 'active', null),
('3-102', 'ห้องเรียน 102',           1,  60, '{projector,aircon,whiteboard}',                 550,  30, 215, 225, 'active', null),
('3-103', 'ห้องเรียน 103',           1,  60, '{projector,aircon,whiteboard}',                 765,  30, 215, 225, 'active', null),
('3-104', 'ห้องเรียน 104',           1,  40, '{projector,aircon,whiteboard}',                 450, 305, 220, 225, 'active', null),
('3-105', 'ห้องเรียน 105',           1,  40, '{smart_board,aircon,power_outlets}',            670, 305, 220, 225, 'active', null),
-- ชั้น 2
('3-201', 'ห้องเรียน 201',           2,  50, '{projector,aircon,whiteboard}',                 110,  30, 170, 225, 'active', null),
('3-202', 'ห้องเรียน 202',           2,  50, '{projector,aircon,whiteboard}',                 280,  30, 170, 225, 'active', null),
('3-206', 'ห้องประชุมเล็ก 206',      2,   8, '{tv,aircon}',                                   450,  30, 100, 145, 'active', null),
('3-203', 'ห้องเรียน 203',           2,  60, '{smart_board,aircon,mic}',                      550,  30, 215, 225, 'active', null),
('3-204', 'ห้องเรียน 204',           2,  60, '{projector,aircon,whiteboard}',                 765,  30, 215, 225, 'active', null),
('3-205', 'ห้องเรียน 205',           2,  45, '{projector,aircon,whiteboard}',                  20, 305, 220, 225, 'active', null),
('3-207', 'ห้องเรียน 207',           2,  45, '{projector,aircon,whiteboard}',                 240, 305, 220, 225, 'active', null),
('3-208', 'ห้องติวกลุ่ม 208',        2,  20, '{tv,whiteboard,power_outlets,aircon}',          460, 305, 220, 225, 'active', null),
('3-209', 'ห้องติวกลุ่ม 209',        2,  20, '{tv,whiteboard,power_outlets,aircon}',          680, 305, 210, 225, 'active', null),
-- ชั้น 3
('3-301', 'ห้องปฏิบัติการคอมพิวเตอร์ 301', 3, 60, '{computers,projector,aircon}',           110,  30, 340, 225, 'active', null),
('3-306', 'ห้องประชุมเล็ก 306',      3,  10, '{tv,aircon,video_conf}',                        450,  30, 100, 145, 'active', null),
('3-302', 'ห้องเรียน 302',           3,  50, '{projector,aircon,whiteboard}',                 550,  30, 215, 225, 'active', null),
('3-303', 'ห้องเรียน 303',           3,  50, '{smart_board,aircon}',                          765,  30, 215, 225, 'active', null),
('3-304', 'ห้องทำโปรเจกต์ 304',      3,  30, '{power_outlets,whiteboard,aircon,tv}',           20, 305, 280, 225, 'active', null),
('3-305', 'ห้องเรียน 305',           3,  45, '{projector,aircon,whiteboard}',                 300, 305, 300, 225, 'active', null),
('3-307', 'ห้องเรียน 307',           3,  45, '{projector,aircon,whiteboard}',                 600, 305, 290, 225, 'active', null),
-- ชั้น 4
('3-401', 'ห้องสัมมนา 401',          4, 100, '{projector,mic,aircon,video_conf}',             110,  30, 340, 225, 'active', null),
('3-406', 'ห้องประชุมเล็ก 406',      4,  12, '{tv,aircon,video_conf}',                        450,  30, 100, 145, 'active', null),
('3-402', 'Co-working Space 402',    4,  50, '{power_outlets,whiteboard,aircon,tv}',          550,  30, 430, 225, 'active', null),
('3-403', 'ห้องเรียน 403',           4,  45, '{projector,aircon,whiteboard}',                  20, 305, 300, 225, 'active', null),
('3-404', 'ห้องเรียน 404',           4,  45, '{projector,aircon,whiteboard}',                 320, 305, 290, 225, 'maintenance', 'ปรับปรุงระบบปรับอากาศ'),
('3-405', 'ห้องเรียน 405',           4,  45, '{smart_board,aircon,whiteboard}',               610, 305, 280, 225, 'active', null);

-- Example closure: room 3-101 reserved for an exam 3 days from now, 08:00–12:00 (Bangkok time)
insert into public.room_blocks (room_id, starts_at, ends_at, reason)
select id,
       ((now() at time zone 'Asia/Bangkok')::date + 3 + time '08:00') at time zone 'Asia/Bangkok',
       ((now() at time zone 'Asia/Bangkok')::date + 3 + time '12:00') at time zone 'Asia/Bangkok',
       'สอบกลางภาค'
from public.rooms where code = '3-101';

-- -----------------------------------------------------------------------------
-- Staff accounts: add the real e-mails of faculty staff here (or in /admin/settings).
-- Roles are applied automatically the first time that e-mail signs in.
-- -----------------------------------------------------------------------------
-- insert into public.staff_members (email, role) values
--   ('somchai.k@chula.ac.th', 'staff'),        -- เปิด–ปิดห้อง
--   ('suda.p@chula.ac.th',    'approver'),     -- ผู้อนุมัติเอกสาร
--   ('admin.eng3@chula.ac.th','super_admin');  -- ผู้ดูแลระบบ
