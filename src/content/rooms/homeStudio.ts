import type { RoomDef } from "../types";

// Aşama 1 başlangıç odası: kiralık stüdyo daire, 3 x 3 m.
// Mobilya sprite'ları "SE" çizildi: uzun kenarları ekranda sol-alttan sağ-üste uzanır, yani karo +y ekseni boyunca.
const DESK_TOP = 56; // masa yüzeyinin zeminden yüksekliği (px) ≈ 0,72 m

export const homeStudio: RoomDef = {
  id: "home_studio",
  background: "room_home_studio_empty",
  floorOrigin: [216, 188],
  tilesX: 3,
  tilesY: 3,
  placements: [
    { id: "desk", sprite: "furn_desk_eco_se", x: 0.05, y: 0.25, fx: 0.6, fy: 1.2 },
    { id: "laptop", sprite: "dev_laptop_old_se", x: 0.2, y: 0.55, fx: 0.3, fy: 0.35, lift: DESK_TOP, on: "desk" },
    { id: "lamp", sprite: "light_desk_lamp_se", x: 0.15, y: 1.15, fx: 0.15, fy: 0.15, lift: DESK_TOP, on: "desk" },
    { id: "chair", sprite: "furn_chair_eco_se", x: 0.75, y: 0.7, fx: 0.5, fy: 0.5 },
    { id: "printer", sprite: "dev_printer_inkjet_se", x: 1.35, y: 0.05, fx: 0.45, fy: 0.35 },
    { id: "plant", sprite: "deco_plant_pot_se", x: 2.45, y: 0.1, fx: 0.4, fy: 0.4 },
    { id: "basket", sprite: "furn_wastebasket_wicker_se", x: 0.1, y: 1.55, fx: 0.3, fy: 0.3 },
    { id: "shelf", sprite: "furn_bookshelf_eco_se_full", x: 0.05, y: 1.95, fx: 0.3, fy: 0.9 },
    { id: "whiteboard", sprite: "edu_whiteboard_stand_se", x: 2.2, y: 1.3, fx: 0.4, fy: 1.0 },
    { id: "kettle", sprite: "drink_kettle_tray_se", x: 2.45, y: 0.65, fx: 0.35, fy: 0.25 },
    { id: "buse", sprite: "char_buse_idle_se", x: 1.0, y: 2.2, fx: 0.4, fy: 0.4, walker: true },
  ],
  // küçük stüdyo: aynı anda en fazla 3 öğrenci görünür (diğerleri şeritte); Buse'nin iş noktalarıyla çakışmaz
  studentSpots: [
    { x: 1.65, y: 0.95, flip: true },
    { x: 1.8, y: 2.55 },
    { x: 2.55, y: 2.45, flip: true },
  ],
  workSpots: [
    { x: 0.7, y: 1.3, icon: "💻", faceLeft: true },
    { x: 1.75, y: 1.6, icon: "✏️" },
    { x: 2.2, y: 0.95, icon: "☕" },
    { x: 1.45, y: 0.5, icon: "🖨️", faceLeft: true },
    { x: 0.45, y: 2.2, icon: "📚", faceLeft: true },
    { x: 1.2, y: 2.2, icon: "📱" },
  ],
  hub: { x: 1.3, y: 1.9 },
};
