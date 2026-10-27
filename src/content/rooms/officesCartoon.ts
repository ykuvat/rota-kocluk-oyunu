import type { RoomDef } from "../types";

// Çizgi film tarzı ofisler (sanat: art/configs/cizgi_ofis2.json, 2026-10-27). Ev görünümünden çıkıldı: her mekân
// gerçek bir iş yeri ve birbirinden farklı. Ölçek karakterlerle aynı (mobilya istemde gerçek boyutla çizildi):
// semt ofisi 4×4, merkez ofis 5×5 karo — ofise taşınınca alan gerçekten büyür. Mobilya arka plana gömülü.
// Personel yuvaları (minStaff) rolün çizgi film sprite'ıyla; makineler alış sırasıyla machineSpots'a (bkz. types.ts).

/** Semt ofisi: resepsiyon, bekleme sırası, iki iş istasyonu, fotokopi, su sebili, toplantı masası. */
export const officeDistrictCartoon: RoomDef = {
  id: "office_district_cartoon",
  background: "room_office_semt_cartoon",
  floorOrigin: [267.6, 188.4],
  tilesX: 4,
  tilesY: 4,
  charScale: 0.72,
  machineScale: 0.72,
  placements: [
    { id: "buse", sprite: "char_buse_cartoon_se", x: 1.7, y: 1.4, fx: 0.4, fy: 0.4, walker: true },
    { id: "assistant1", sprite: "char_assistant_cartoon_se", x: 2.7, y: 1.3, fx: 0.4, fy: 0.4, minStaff: 1, walker: true },
    { id: "assistant2", sprite: "char_assistant_cartoon_se", x: 1.3, y: 3.1, fx: 0.4, fy: 0.4, minStaff: 2, flip: true, walker: true },
  ],
  studentSpots: [
    { x: 0.7, y: 1.6, flip: true },
    { x: 2.2, y: 2.3 },
    { x: 3.4, y: 2.1 },
  ],
  workSpots: [
    { x: 1.5, y: 0.9, icon: "💻" },
    { x: 2.6, y: 0.9, icon: "💻" },
    { x: 3.4, y: 1.0, icon: "🖨️" },
    { x: 0.6, y: 0.6, icon: "☕", faceLeft: true },
    { x: 1.5, y: 2.8, icon: "☎️", faceLeft: true },
  ],
  hub: { x: 2.0, y: 2.0 },
  // semt ofisinde boş duvar yok: makineler sağ önde, fotokopinin önünde yan yana bir sıra
  machineSpots: [
    { x: 3.75, y: 1.1 },
    { x: 3.75, y: 2.15 },
  ],
};

/** Merkez ofis: tuğla duvar ve fabrika pencereleri, cam sınıf, dinlenme köşesi, mutfak, uzun çalışma masası. */
export const officeCentralCartoon: RoomDef = {
  id: "office_central_cartoon",
  background: "room_office_merkez_cartoon",
  floorOrigin: [334.5, 235.5],
  tilesX: 5,
  tilesY: 5,
  charScale: 0.66,
  machineScale: 0.66,
  placements: [
    { id: "buse", sprite: "char_buse_cartoon_se", x: 2.3, y: 2.6, fx: 0.4, fy: 0.4, walker: true },
    { id: "assistant1", sprite: "char_assistant_cartoon_se", x: 0.8, y: 3.0, fx: 0.4, fy: 0.4, minStaff: 1, flip: true, walker: true },
    { id: "assistant2", sprite: "char_assistant_cartoon_se", x: 3.3, y: 3.3, fx: 0.4, fy: 0.4, minStaff: 2, walker: true },
    { id: "assistant3", sprite: "char_assistant_cartoon_se", x: 1.9, y: 1.4, fx: 0.4, fy: 0.4, minStaff: 3, flip: true, walker: true },
  ],
  studentSpots: [
    { x: 3.6, y: 4.0 },
    { x: 2.0, y: 4.3, flip: true },
    { x: 1.4, y: 2.4, flip: true },
  ],
  workSpots: [
    { x: 1.1, y: 0.7, icon: "☕" },
    { x: 0.9, y: 3.3, icon: "☎️", faceLeft: true },
    { x: 2.7, y: 3.7, icon: "💻" },
    { x: 3.0, y: 2.6, icon: "✏️" },
    { x: 1.4, y: 1.7, icon: "📚", faceLeft: true },
  ],
  hub: { x: 2.3, y: 2.6 },
  // tuğla duvar boyunca resepsiyonun yanı, çalışma masasının başı ve sağ öndeki boş alan
  machineSpots: [
    { x: 0.1, y: 2.3 },
    { x: 0.1, y: 2.95 },
    { x: 2.35, y: 1.75 },
    { x: 4.4, y: 2.75 },
  ],
};
