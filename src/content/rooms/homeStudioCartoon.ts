import type { RoomDef } from "../types";

// Çizgi film tarz denemesi (Game Dev Tycoon benzeri): ev stüdyosu, 3 x 3 m. Sanat: art/configs/cizgi_ev.json.
// Mobilya arka plana gömülü (deneme); karakterler yalnız boş zeminde ve mobilyanın önünde durur ki
// çizim sırası bozulmasın. Izgara tools/cartoon_cut.py çıktısındaki floorOrigin ile doğrulandı.
export const homeStudioCartoon: RoomDef = {
  id: "home_studio_cartoon",
  background: "room_home_cartoon",
  floorOrigin: [204.3, 168.1],
  tilesX: 3,
  tilesY: 3,
  placements: [{ id: "buse", sprite: "char_buse_cartoon_se", x: 1.6, y: 2.0, fx: 0.4, fy: 0.4, walker: true }],
  studentSpots: [
    { x: 1.0, y: 2.6, flip: true },
    { x: 2.3, y: 1.7 },
    { x: 2.55, y: 2.55, flip: true },
  ],
  workSpots: [
    { x: 1.0, y: 1.3, icon: "💻", faceLeft: true },
    { x: 0.85, y: 0.65, icon: "📚" },
    { x: 1.6, y: 0.65, icon: "✏️" },
    { x: 2.1, y: 1.1, icon: "☕" },
    { x: 1.75, y: 2.15, icon: "📱" },
  ],
  hub: { x: 1.5, y: 1.6 },
};
