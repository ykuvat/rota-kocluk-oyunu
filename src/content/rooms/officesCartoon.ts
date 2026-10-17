import type { RoomDef } from "../types";

// Çizgi film tarzı ofisler (sanat: art/configs/cizgi_semt.json). Ölçek ev odasıyla aynı (karakterler her odada
// aynı boyda) → semt ofisinin zemini oyunda 3 x 3 karo. Mobilya arka plana gömülü; seans masası ön ortada
// (≈ 1,6–2,7 karo), resepsiyon ve masalar arka duvarlarda. Personel yuvaları (minStaff) rolün çizgi film sprite'ıyla.
export const officeDistrictCartoon: RoomDef = {
  id: "office_district_cartoon",
  background: "room_office_district_cartoon",
  floorOrigin: [214.3, 176.9],
  tilesX: 3,
  tilesY: 3,
  placements: [
    { id: "buse", sprite: "char_buse_cartoon_se", x: 1.3, y: 1.35, fx: 0.4, fy: 0.4, walker: true },
    { id: "assistant1", sprite: "char_assistant_cartoon_se", x: 0.85, y: 2.55, fx: 0.4, fy: 0.4, minStaff: 1, flip: true, walker: true },
    { id: "assistant2", sprite: "char_assistant_cartoon_se", x: 2.3, y: 1.3, fx: 0.4, fy: 0.4, minStaff: 2, walker: true },
  ],
  studentSpots: [
    { x: 0.6, y: 2.85, flip: true },
    { x: 1.25, y: 2.85 },
    { x: 2.9, y: 2.05 },
  ],
  workSpots: [
    { x: 0.75, y: 1.5, icon: "💻", faceLeft: true },
    { x: 1.1, y: 0.95, icon: "💻", faceLeft: true },
    { x: 1.7, y: 1.05, icon: "☎️" },
    { x: 2.2, y: 0.8, icon: "✏️" },
    { x: 2.3, y: 1.3, icon: "☕" },
  ],
  hub: { x: 1.3, y: 1.4 },
  poses: {
    session: {
      anxious_perfectionist: "room_office_district_cartoon_s_anxious",
      talented_messy: "room_office_district_cartoon_s_messy",
      quiet_drifter: "room_office_district_cartoon_s_quiet",
    },
    desk: "room_office_district_cartoon_desk",
  },
};

/** Merkez ofis (sanat: art/configs/cizgi_merkez.json): eşyalar daha küçük çizildi, zemin daha geniş görünür. */
export const officeCentralCartoon: RoomDef = {
  id: "office_central_cartoon",
  background: "room_office_central_cartoon",
  floorOrigin: [214.3, 176.9],
  tilesX: 3,
  tilesY: 3,
  placements: [
    { id: "buse", sprite: "char_buse_cartoon_se", x: 1.5, y: 1.4, fx: 0.4, fy: 0.4, walker: true },
    { id: "assistant1", sprite: "char_assistant_cartoon_se", x: 1.1, y: 2.75, fx: 0.4, fy: 0.4, minStaff: 1, flip: true, walker: true },
    { id: "assistant2", sprite: "char_assistant_cartoon_se", x: 1.8, y: 1.05, fx: 0.4, fy: 0.4, minStaff: 2, walker: true },
    { id: "assistant3", sprite: "char_assistant_cartoon_se", x: 2.95, y: 2.05, fx: 0.4, fy: 0.4, minStaff: 3, flip: true, walker: true },
  ],
  studentSpots: [
    { x: 0.55, y: 2.85, flip: true },
    { x: 1.35, y: 2.9 },
    { x: 0.3, y: 2.3, flip: true },
  ],
  workSpots: [
    { x: 0.75, y: 1.6, icon: "💻", faceLeft: true },
    { x: 1.05, y: 1.15, icon: "💻", faceLeft: true },
    { x: 1.55, y: 1.1, icon: "☎️" },
    { x: 1.95, y: 0.75, icon: "✏️" },
    { x: 2.25, y: 1.0, icon: "☕" },
  ],
  hub: { x: 1.5, y: 1.45 },
  poses: {
    session: {
      anxious_perfectionist: "room_office_central_cartoon_s_anxious",
      talented_messy: "room_office_central_cartoon_s_messy",
    },
  },
};
