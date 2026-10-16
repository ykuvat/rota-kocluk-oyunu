// Mesleki gelişim ve kurumsallaşma (GDD A aşamaları, E8). Tutarlar ÖRNEKTİR.
// Aşama 1: evden serbest koç · Aşama 2: tanınan koç (ofis seçeneği açılır) · Aşama 3: ofisli küçük kurum.

export interface CertDef {
  id: string;
  cost: number;
  /** eğitim süresince haftalık koç saati */
  hoursPerWeek: number;
  weeks: number;
  /** kayıt olasılığına logit katkısı */
  conversion?: number;
  /** müdahale etkisi çarpanı */
  interventionFactor?: number;
  /** veli görüşmesinin memnuniyet etkisi çarpanı */
  parentMeetingFactor?: number;
  /** görüşmeyle tanıma kazancı çarpanı */
  insightFactor?: number;
  /** organik içerik takipçi kazancı çarpanı */
  organicFactor?: number;
  /** tamamlanınca bir kez kurum güveni */
  trustOnce?: number;
}

export const CERTS: CertDef[] = [
  { id: "coachingCert", cost: 12_000, hoursPerWeek: 4, weeks: 6, conversion: 0.35, trustOnce: 5 },
  { id: "learningPsych", cost: 7_000, hoursPerWeek: 3, weeks: 4, interventionFactor: 1.15 },
  { id: "parentComm", cost: 4_000, hoursPerWeek: 2, weeks: 3, parentMeetingFactor: 1.4 },
  { id: "interviewSkills", cost: 5_500, hoursPerWeek: 3, weeks: 3, insightFactor: 1.3 },
  { id: "contentCourse", cost: 3_500, hoursPerWeek: 2, weeks: 3, organicFactor: 1.4 },
];

export const CERT_BY_ID: Record<string, CertDef> = Object.fromEntries(CERTS.map((c) => [c.id, c]));

export interface OfficeDef {
  id: string;
  rent: number;
  utilities: number;
  /** kira cinsinden depozito */
  depositMonths: number;
  setup: number;
  capacity: number;
  conversion: number;
  trustOnce: number;
  /** haftalık bilinirlik (tabela, yoldan geçen veli) */
  awarenessWeekly: number;
}

export const OFFICES: OfficeDef[] = [
  { id: "district", rent: 10_000, utilities: 2_000, depositMonths: 2, setup: 15_000, capacity: 16, conversion: 0.2, trustOnce: 3, awarenessWeekly: 0.5 },
  { id: "central", rent: 18_000, utilities: 3_000, depositMonths: 2, setup: 25_000, capacity: 20, conversion: 0.45, trustOnce: 6, awarenessWeekly: 1.5 },
];

export const OFFICE_BY_ID: Record<string, OfficeDef> = Object.fromEntries(OFFICES.map((o) => [o.id, o]));

/** Şube (Aşama 4): ana ofise ek kapasite ve bilinirlik; ofisle aynı alanlar. Semtler kurgusal. */
export type BranchDef = OfficeDef;

export const BRANCHES: BranchDef[] = [
  { id: "harbor", rent: 11_000, utilities: 2_000, depositMonths: 2, setup: 25_000, capacity: 14, conversion: 0.1, trustOnce: 4, awarenessWeekly: 1 },
  { id: "campus", rent: 14_000, utilities: 2_500, depositMonths: 2, setup: 30_000, capacity: 16, conversion: 0.15, trustOnce: 4, awarenessWeekly: 1.2 },
  { id: "hills", rent: 9_000, utilities: 1_800, depositMonths: 2, setup: 22_000, capacity: 12, conversion: 0.08, trustOnce: 3, awarenessWeekly: 0.8 },
];

export const BRANCH_BY_ID: Record<string, BranchDef> = Object.fromEntries(BRANCHES.map((b) => [b.id, b]));

export const STAGES = {
  /** evde aynı anda bakılabilecek en fazla öğrenci (tek oda, tek koç) */
  homeCapacity: 10,
  /** Aşama 2 eşiği */
  stage2: { activeStudents: 4, trust: 50, tuitionTotal: 40_000 },
  /**
   * şube açma koşulu (her şube için; ilk şube Aşama 4'tür): kurum güveni (her açık şube eşiği yükseltir),
   * mevcut kapasitenin doluluğu, açıldıktan sonra her yer (ofis + şubeler) için koç (Buse dahil),
   * peşinatın üstünde yeni yerin birkaç aylık gideri (kira + `coachSkillRef` becerili bir koçun maaşı); ÜYS'den önceki haftalarda ve bir önceki şubeden minWeeksBetween hafta içinde açılmaz
   */
  branch: { trust: 60, trustPerBranch: 10, fillRatio: 0.75, coachesPerSite: 2, reserveMonths: 3, coachSkillRef: 60, examBlackoutWeeks: 10, minWeeksBetween: 26 },
} as const;
