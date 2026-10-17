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
