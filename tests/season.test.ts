import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { EVENTS } from "../src/content/events";
import { balancedProgram } from "../src/content/programs";
import { UYS } from "../src/content/season";
import { daysUntil, HOURS_PER_DAY, HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { examIso, rankFor } from "../src/sim/season";
import { createState, LOG_LIMIT, STATE_VERSION, type GameState } from "../src/sim/state";
import { advance, stateHash } from "../src/sim/step";
import { migrate, serialize } from "../src/platform/save";
import { EXTRA_EN, EXTRA_TR } from "../src/platform/i18n.extra";

const examHour = (season: number) => daysUntil(0, examIso(season)) * HOURS_PER_DAY + UYS.hour;

function seasonState(seed: number, n = 3): GameState {
  const s = createState(seed, BALANCE.coach.weeklyHours);
  for (const e of EVENTS) s.events.lastFired[e.id] = s.hour + 1_000_000;
  applyCommand(s, { type: "setMarketing", networkActive: false, organicHours: 0, paidBudget: 0 });
  // bu testler sınav ve sezonla ilgili; ekonomi iflasa sürüklemesin
  s.economy.personal = 1_000_000;
  for (let i = 0; i < n; i++) applyCommand(s, { type: "addStudent", archetype: ["anxious_perfectionist", "talented_messy", "quiet_drifter"][i % 3] });
  for (const st of s.students) {
    st.program = balancedProgram(st);
    st.parent.style = "calm";
  }
  return s;
}

/** Sınava kadar oyna; veliyle ayda bir görüş (öğrenciler sezonu bitirsin). */
function playToExam(s: GameState) {
  while (s.hour < examHour(0) + 1) {
    if (s.gameOver) throw new Error("test oyunu iflas etti");
    for (const st of s.students.filter((x) => !x.left)) {
      if (Math.floor(s.hour / HOURS_PER_WEEK) % 4 === 0) applyCommand(s, { type: "parentMeeting", studentId: st.id });
      if (Math.floor(s.hour / HOURS_PER_WEEK) % 3 === 0) st.program = balancedProgram(st);
    }
    advance(s, Math.min(HOURS_PER_WEEK, examHour(0) + 1 - s.hour));
  }
}

describe("ÜYS ve sezon", () => {
  it("sıralama nete göre azalır; orta net ≈ adayların yarısı", () => {
    expect(rankFor(60)).toBeLessThan(rankFor(40));
    expect(rankFor(UYS.rankMidNet)).toBeCloseTo(UYS.candidates / 2, -3);
    expect(rankFor(200)).toBe(1);
  });

  it("ÜYS günü sonuç, mezuniyet, rapor ve yeni sezon", () => {
    const s = seasonState(11);
    playToExam(s);
    const r = s.season.pendingReport!;
    expect(r).not.toBeNull();
    const finishers = s.students.filter((x) => x.graduated);
    expect(r.results.length).toBe(finishers.length);
    expect(finishers.length).toBeGreaterThan(0);
    expect(s.students.filter((x) => !x.left).length).toBe(0);
    expect(s.season.index).toBe(1);
    expect(examIso(s.season.index)).toBe("2028-06-19");
    expect(r.income).toBe((s.economy.totals.tuition ?? 0) + (s.economy.totals.questReward ?? 0));
    // mezuniyet "yarıda bırakma" sayılmaz
    expect(r.leftEarly).toBe(s.students.filter((x) => x.left && !x.graduated).length);
    for (const x of r.results) expect(x.goalMet).toBe(x.net >= x.targetNet);
    expect(applyCommand(s, { type: "closeReport" })).toEqual({ ok: true });
    expect(s.season.pendingReport).toBeNull();
    // sezon sonrası: mezunlar ücret ödemez
    const tuition = s.economy.totals.tuition;
    advance(s, 30 * HOURS_PER_DAY);
    expect(s.economy.totals.tuition).toBe(tuition);
  });

  it("çalışan öğrenci ilk denemeye göre net kazanır (12 öğrenci ortalaması)", () => {
    const s = seasonState(12, 12);
    playToExam(s);
    const res = s.season.reports[0].results.filter((x) => x.firstNet !== null);
    const gain = res.reduce((a, x) => a + x.net - x.firstNet!, 0) / res.length;
    const hit = res.filter((x) => x.goalMet).length / res.length;
    console.log(`ÜYS: ${res.length} öğrenci, ort. net artışı ${gain.toFixed(1)}, hedef tutturma %${Math.round(hit * 100)}, ort. net ${(res.reduce((a, x) => a + x.net, 0) / res.length).toFixed(1)}`);
    expect(gain).toBeGreaterThan(5);
  });

  it("bildirim geçmişi günlük kırpılsa da korunur ve deterministik", () => {
    const s = seasonState(13, 6);
    playToExam(s);
    expect(s.log.length).toBeLessThanOrEqual(LOG_LIMIT);
    expect(s.history.some((e) => e.type === "examResult")).toBe(true);
    expect(s.history.some((e) => e.type === "seasonEnded")).toBe(true);
    const a = seasonState(14);
    const b = seasonState(14);
    advance(a, HOURS_PER_WEEK * 10);
    advance(b, HOURS_PER_WEEK * 10);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it("raporda geçen tüm kategori ve bildirim metinleri iki dilde var", () => {
    const s = seasonState(15);
    applyCommand(s, { type: "startCert", certId: "parentComm" });
    playToExam(s);
    const keys = Object.keys(s.season.reports[0].byCategory).map((k) => `cat.${k}`);
    keys.push("notice.examMet", "notice.examMissed", "notice.seasonEnded", "report.title", "report.close", "history.title");
    for (const k of keys) {
      expect(EXTRA_TR[k], k).toBeTruthy();
      expect(EXTRA_EN[k], k).toBeTruthy();
    }
  });

  it("sürüm 6 kaydı güncel sürüme göç eder", () => {
    const s = seasonState(16);
    const raw = JSON.parse(serialize(s));
    raw.version = 6;
    delete raw.history;
    delete raw.season;
    const m = migrate(raw);
    expect(m.version).toBe(STATE_VERSION);
    expect(m.season.index).toBe(0);
    advance(m, HOURS_PER_WEEK);
  });
});
