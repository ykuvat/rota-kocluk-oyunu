import type { Placement, RoomDef } from "../types";

// Aşama 3 ofisleri. Arka planlar Gemini'de üretildi (art/configs/oda_ofis_*.json); zemin ızgarası
// tools/floor_corners.py ile ölçüldü. Masalar uzun kenarı +y boyunca, sol-arka duvara dayalı.
// Personel yuvaları (minStaff): ekipte o sırada kişi varken görünür, rolünün sprite'ıyla (content/staff.ts → ROLE_SPRITE).
const DESK_TOP = 56;

const workstation = (id: string, x: number, y: number, laptop = true): Placement[] => [
  { id, sprite: "furn_desk_eco_se", x, y, fx: 0.6, fy: 1.2 },
  ...(laptop ? [{ id: `${id}_laptop`, sprite: "dev_laptop_old_se", x: x + 0.15, y: y + 0.3, fx: 0.3, fy: 0.35, lift: DESK_TOP, on: id }] : []),
  { id: `${id}_chair`, sprite: "furn_chair_eco_se", x: x + 0.7, y: y + 0.45, fx: 0.5, fy: 0.5 },
];

/** Semt ofisi: 4 x 4 m. */
export const officeDistrict: RoomDef = {
  id: "office_district",
  background: "room_office_district_empty",
  floorOrigin: [274, 215],
  tilesX: 4,
  tilesY: 4,
  placements: [
    ...workstation("desk1", 0.05, 0.3),
    { id: "lamp", sprite: "light_desk_lamp_se", x: 0.15, y: 1.2, fx: 0.15, fy: 0.15, lift: DESK_TOP, on: "desk1" },
    ...workstation("desk2", 0.05, 1.8),
    ...workstation("desk3", 2.0, 1.5, false),
    { id: "shelf", sprite: "furn_bookshelf_eco_se_full", x: 0.05, y: 3.05, fx: 0.3, fy: 0.9 },
    { id: "printer", sprite: "dev_printer_inkjet_se", x: 1.6, y: 0.05, fx: 0.45, fy: 0.35 },
    { id: "kettle", sprite: "drink_kettle_tray_se", x: 2.3, y: 0.05, fx: 0.35, fy: 0.25 },
    { id: "plant1", sprite: "deco_plant_pot_se", x: 3.5, y: 0.1, fx: 0.4, fy: 0.4 },
    { id: "plant2", sprite: "deco_plant_pot_se", x: 0.75, y: 0.05, fx: 0.4, fy: 0.4 },
    { id: "whiteboard", sprite: "edu_whiteboard_stand_se", x: 3.5, y: 1.4, fx: 0.4, fy: 1.0 },
    { id: "basket", sprite: "furn_wastebasket_wicker_se", x: 1.2, y: 3.55, fx: 0.3, fy: 0.3 },
    { id: "buse", sprite: "char_buse_idle_se", x: 1.6, y: 2.8, fx: 0.4, fy: 0.4, walker: true },
    { id: "assistant1", sprite: "char_assistant_idle_se", x: 2.7, y: 3.1, fx: 0.4, fy: 0.4, minStaff: 1, flip: true, walker: true },
    { id: "assistant2", sprite: "char_assistant_idle_se", x: 3.5, y: 3.4, fx: 0.4, fy: 0.4, minStaff: 2, walker: true },
  ],
  // mobilya taban izleriyle ve iş noktalarıyla çakışmayan boş zemin
  studentSpots: [
    { x: 1.3, y: 1.05, flip: true },
    { x: 1.3, y: 2.55, flip: true },
    { x: 3.0, y: 0.85 },
    { x: 2.4, y: 3.3 },
    { x: 3.3, y: 2.75 },
  ],
  workSpots: [
    { x: 0.8, y: 1.3, icon: "💻", faceLeft: true },
    { x: 3.05, y: 1.45, icon: "✏️" },
    { x: 2.4, y: 0.45, icon: "☕" },
    { x: 1.7, y: 0.5, icon: "🖨️", faceLeft: true },
    { x: 0.45, y: 3.1, icon: "📚", faceLeft: true },
    { x: 0.8, y: 2.8, icon: "💻", faceLeft: true },
    { x: 2.0, y: 2.6, icon: "📱" },
  ],
  hub: { x: 1.9, y: 2.0 },
};

/** Merkez ofis: 5 x 5 m. */
export const officeCentral: RoomDef = {
  id: "office_central",
  background: "room_office_central_empty",
  floorOrigin: [339, 274],
  tilesX: 5,
  tilesY: 5,
  placements: [
    ...workstation("desk1", 0.05, 0.3),
    { id: "lamp", sprite: "light_desk_lamp_se", x: 0.15, y: 1.2, fx: 0.15, fy: 0.15, lift: DESK_TOP, on: "desk1" },
    ...workstation("desk2", 0.05, 1.8),
    ...workstation("desk3", 2.6, 0.6),
    ...workstation("desk4", 2.6, 2.1),
    { id: "shelf1", sprite: "furn_bookshelf_eco_se_half", x: 0.05, y: 3.2, fx: 0.3, fy: 0.9 },
    { id: "shelf2", sprite: "furn_bookshelf_eco_se_full", x: 0.05, y: 4.05, fx: 0.3, fy: 0.9 },
    { id: "printer", sprite: "dev_printer_inkjet_se", x: 1.6, y: 0.05, fx: 0.45, fy: 0.35 },
    { id: "kettle", sprite: "drink_kettle_tray_se", x: 3.7, y: 0.05, fx: 0.35, fy: 0.25 },
    { id: "plant1", sprite: "deco_plant_pot_se", x: 4.5, y: 0.1, fx: 0.4, fy: 0.4 },
    { id: "plant2", sprite: "deco_plant_pot_se", x: 0.75, y: 0.05, fx: 0.4, fy: 0.4 },
    { id: "plant3", sprite: "deco_plant_pot_se", x: 4.5, y: 4.45, fx: 0.4, fy: 0.4 },
    { id: "whiteboard", sprite: "edu_whiteboard_stand_se", x: 4.5, y: 1.8, fx: 0.4, fy: 1.0 },
    { id: "basket", sprite: "furn_wastebasket_wicker_se", x: 1.3, y: 4.45, fx: 0.3, fy: 0.3 },
    { id: "buse", sprite: "char_buse_idle_se", x: 1.8, y: 3.4, fx: 0.4, fy: 0.4, walker: true },
    { id: "assistant1", sprite: "char_assistant_idle_se", x: 3.1, y: 3.8, fx: 0.4, fy: 0.4, minStaff: 1, flip: true, walker: true },
    { id: "assistant2", sprite: "char_assistant_idle_se", x: 3.9, y: 3.2, fx: 0.4, fy: 0.4, minStaff: 2, walker: true },
    { id: "assistant3", sprite: "char_assistant_idle_se", x: 4.5, y: 3.0, fx: 0.4, fy: 0.4, minStaff: 3, flip: true, walker: true },
  ],
  studentSpots: [
    { x: 1.3, y: 1.05, flip: true },
    { x: 1.3, y: 2.55, flip: true },
    { x: 4.0, y: 0.75 },
    { x: 2.2, y: 4.3 },
    { x: 4.2, y: 3.6 },
    { x: 2.15, y: 1.6 },
  ],
  workSpots: [
    { x: 0.8, y: 1.35, icon: "💻", faceLeft: true },
    { x: 0.8, y: 2.85, icon: "💻", faceLeft: true },
    { x: 4.05, y: 2.0, icon: "✏️" },
    { x: 3.8, y: 0.45, icon: "☕" },
    { x: 1.7, y: 0.5, icon: "🖨️", faceLeft: true },
    { x: 0.45, y: 3.5, icon: "📚", faceLeft: true },
    { x: 2.2, y: 3.2, icon: "📱" },
    { x: 3.4, y: 3.6, icon: "💬" },
  ],
  hub: { x: 2.25, y: 3.0 },
};
