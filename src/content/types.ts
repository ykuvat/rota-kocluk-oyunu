// İçerik (veri) tipleri. Denge ve yerleşim değerleri kodda değil, içerik dosyalarında durur.

export interface SpriteInfo {
  url: string;
  size: [number, number];
  /** Sprite içindeki alt-orta çapa (px). */
  anchor: [number, number];
  footprint: [number, number] | null;
}

export interface SpriteManifest {
  sprites: Record<string, SpriteInfo>;
}

/** Odaya yerleştirilmiş bir nesne ya da karakter. */
export interface Placement {
  id: string;
  sprite: string;
  /** Taban izinin arka (en üst) köşesinin karo koordinatı. */
  x: number;
  y: number;
  /** Taban izi: karo ekseni boyunca uzunluk (m). fx = +x (sağ-aşağı), fy = +y (sol-aşağı). */
  fx: number;
  fy: number;
  /** Başka bir yüzeyin üstündeyse zeminden yükseklik (px), ör. masa üstü. */
  lift?: number;
  /** Bu nesnenin üstünde durduğu nesne (çizim sırası için). */
  on?: string;
  /** Yalnız ekipte en az bu kadar yardımcı koç varken görünür. */
  minStaff?: number;
  /** Yatay aynala (SW yönü). */
  flip?: boolean;
  /** Karakter odada `workSpots` arasında dolaşır (Buse, yardımcı koçlar). */
  walker?: boolean;
}

/** Çizimi henüz üretilmemiş odalar için kodla çizilen duvar ve zemin (renkler 0xRRGGBB). */
export interface ProceduralRoom {
  floor: [number, number];
  floorLine: number;
  wallLeft: number;
  wallRight: number;
  trim: number;
  /** duvar yüksekliği (px) */
  wallHeight: number;
  /** sağ-arka duvar (x ekseni) ve sol-arka duvar (y ekseni) üstündeki pencereler: [başlangıç m, bitiş m] */
  windowsX: [number, number][];
  windowsY: [number, number][];
  /** sol-arka duvarda kapı [başlangıç m, bitiş m] */
  doorY?: [number, number];
}

export interface RoomDef {
  id: string;
  /** Arka plan sprite'ı (duvarlar + zemin); yoksa `procedural` çizilir. */
  background?: string;
  procedural?: ProceduralRoom;
  /** Arka plan sprite'ında (0,0) karosunun üst köşesinin piksel konumu. */
  floorOrigin: [number, number];
  tilesX: number;
  tilesY: number;
  placements: Placement[];
  /** Öğrencilerin odada durduğu yerler (karo koordinatı); sırayla doldurulur. */
  studentSpots?: { x: number; y: number; flip?: boolean }[];
  /** Buse ve ekibin iş yaptığı noktalar: oraya yürür, bir süre durur, başında simge belirir. */
  workSpots?: WorkSpot[];
  /** Mobilyaların arasından geçmemek için yürüyüşlerin uğradığı açık zemin noktası. */
  hub?: { x: number; y: number };
}

export interface WorkSpot {
  x: number;
  y: number;
  /** eylem simgesi (💻 ✏️ ☕ 📚 …) */
  icon: string;
  /** durunca sola dönük mü (SE sprite aynalanır) */
  faceLeft?: boolean;
}
