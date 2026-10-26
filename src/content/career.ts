// KUVAT LABS — Rota
// Kariyer hedefi: eşikler ve kademeler (denge değil, hedef verisi). Mantık sim/career.ts'dedir.

export const CAREER = {
  /** final bu sezonun ÜYS'sinde (0 tabanlı: seasons - 1) sezon raporuna eklenir */
  seasons: 3,
  /** Başarı kartı: final sezonunda hedefini tutturan öğrenci oranı */
  successRate: 0.6,
  /** Güven kartı: final anında kurum güveni */
  trust: 85,
  /** Büyüme kartı: açılmış şube sayısı */
  branches: 1,
} as const;

export type CareerCardId = "success" | "trust" | "growth";
export type CareerTierId = "coach" | "bronze" | "silver" | "gold";

/** Tutturulan kart sayısı → kademe (dizin = kart sayısı). */
export const CAREER_TIERS: readonly CareerTierId[] = ["coach", "bronze", "silver", "gold"];
