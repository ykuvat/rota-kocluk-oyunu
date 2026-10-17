import type { RoomDef } from "../types";

// Çizgi film tarzı ev stüdyosu (Game Dev Tycoon benzeri), 3 x 3 m. Sanat: art/configs/cizgi_ev.json.
// Mobilya arka plana gömülü; seans masası ön ortada (≈ 1,6–2,6 karo). Karakterler yalnız boş zeminde ve
// mobilyanın önünde durur ki çizim sırası bozulmasın. Izgara tools/cartoon_cut.py çıktısındaki floorOrigin ile doğrulandı.
export const homeStudioCartoon: RoomDef = {
  id: "home_studio_cartoon",
  background: "room_home_cartoon",
  floorOrigin: [204.3, 168.1],
  tilesX: 3,
  tilesY: 3,
  placements: [{ id: "buse", sprite: "char_buse_cartoon_se", x: 1.4, y: 1.5, fx: 0.4, fy: 0.4, walker: true }],
  // seans dışında bekleyen / aynı gün gelen diğer öğrenciler
  studentSpots: [
    { x: 1.1, y: 2.75, flip: true },
    { x: 2.8, y: 1.35 },
    { x: 2.85, y: 2.3 },
  ],
  workSpots: [
    { x: 1.0, y: 1.3, icon: "💻", faceLeft: true },
    { x: 1.15, y: 0.55, icon: "📚" },
    { x: 1.6, y: 0.65, icon: "✏️" },
    { x: 2.1, y: 1.1, icon: "☕" },
    { x: 0.95, y: 2.35, icon: "📱", faceLeft: true },
  ],
  hub: { x: 1.4, y: 1.5 },
  poses: {
    session: {
      anxious_perfectionist: "room_home_cartoon_s_anxious",
      talented_messy: "room_home_cartoon_s_messy",
      quiet_drifter: "room_home_cartoon_s_quiet",
    },
    desk: "room_home_cartoon_desk",
  },
};
