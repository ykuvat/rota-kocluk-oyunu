import { Application, Assets, Container, Texture, TextureStyle } from "pixi.js";
import { BALANCE } from "./content/balance";
import { homeStudio } from "./content/rooms/homeStudio";
import { officeCentral, officeDistrict } from "./content/rooms/offices";
import type { RoomDef, SpriteManifest } from "./content/types";
import { tileToScreen } from "./core/iso";
import { getLocale, setLocale, tf, tk } from "./platform/i18n";
import { Camera } from "./render/camera";
import { Floaters } from "./render/floaters";
import { RoomScene, spriteTop, type Actor } from "./render/RoomScene";
import { calendarAt } from "./sim/calendar";
import { createState, type GameState, type SimEvent } from "./sim/state";
import { ROLE_IDS, ROLE_SPRITE } from "./content/staff";
import { clearStorage, loadFromStorage, saveToStorage } from "./platform/save";
import { advance } from "./sim/step";
import { applyCommand, type Command } from "./sim/commands";
import { createHudElement, renderHud, type HudView } from "./ui/hud";
import { ProgramEditor } from "./ui/programEditor";
import { StudentPanel } from "./ui/studentPanel";
import { BusinessPanel } from "./ui/businessPanel";
import { InboxPanel } from "./ui/inboxPanel";
import { HistoryPanel } from "./ui/historyPanel";
import { SeasonReportView } from "./ui/seasonReport";
import { startCareer } from "./sim/funnel";
import { createRng } from "./core/rng";
import { injectPlayCss, isMobile, MOOD_ICON, moodOf, toast } from "./ui/play/common";
import { Autopilot } from "./ui/play/autopilot";
import { DecisionPanel } from "./ui/play/decisions";
import { StudentStrip } from "./ui/play/studentStrip";
import { PlayHud } from "./ui/play/playHud";
import { WeekSummary } from "./ui/play/weekSummary";
import { resetTutorial, Tutorial } from "./ui/play/tutorial";

// pixel art: bulanıklaştırmadan, en yakın komşu ölçekleme
TextureStyle.defaultOptions.scaleMode = "nearest";

/**
 * Tur tabanlı hafta: zaman oyuncu "Haftayı başlat" deyince akar. Bir hafta (168 oyun saati) ≈ 4 sn oynar;
 * bir olay çıkarsa durur, oyuncu cevaplayınca "Haftaya devam" der. Hafta bitince sonuç ekranı gelir.
 */
const MS_PER_GAME_HOUR_RUNNING = 24;

/** Odadaki personel yuvaları için sprite sırası: önce her rolden birer kişi (çeşitlilik), sonra kalanlar işe alınma sırasıyla. */
function staffSprites(state: GameState): string[] {
  const members = state.staff.members;
  const firsts = ROLE_IDS.map((r) => members.find((m) => m.role === r)).filter((m) => m !== undefined);
  const rest = members.filter((m) => !firsts.includes(m));
  return [...firsts, ...rest].map((m) => ROLE_SPRITE[m.role]);
}

async function boot() {
  const host = document.getElementById("game")!;
  const app = new Application();
  // yüksek yoğunluklu ekranda (telefon) cihaz pikseliyle çiz: oda küçük ekrana keskin sığar
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  await app.init({ resizeTo: host, background: "#2b2530", antialias: false, roundPixels: true, resolution: dpr, autoDensity: true });
  host.appendChild(app.canvas);

  const base = import.meta.env.BASE_URL;
  const manifest: SpriteManifest = await (await fetch(`${base}assets/sprites/manifest.json`)).json();
  availableSprites = new Set(Object.keys(manifest.sprites));

  const rooms = [homeStudio, officeDistrict, officeCentral];
  const needed = new Set(rooms.flatMap((r) => [...(r.background ? [r.background] : []), ...r.placements.map((p) => p.sprite)]));
  // öğrenci karakterleri ve bekleme kareleri (varsa)
  for (const name of Object.keys(manifest.sprites)) if (name.startsWith("char_student_")) needed.add(name);
  // personelin rol görünümleri (sprite'ı olmayan rol yuvanın varsayılan sprite'ıyla çizilir)
  for (const name of Object.values(ROLE_SPRITE)) if (manifest.sprites[name]) needed.add(name);
  const textures = new Map<string, Texture>();
  await Promise.all(
    [...needed].map(async (name) => {
      const info = manifest.sprites[name];
      if (!info) throw new Error(`manifest'te sprite yok: ${name}`);
      textures.set(name, await Assets.load<Texture>(`${base}${info.url}`));
    }),
  );

  const world = new Container();
  world.sortableChildren = true;
  app.stage.addChild(world);
  const camera = new Camera(world, app.canvas, dpr, host);

  // --- simülasyon: kayıt varsa devam et (N tuşu yeni oyun başlatır) ---
  const saved = loadFromStorage();
  const state = saved ?? newGame();

  // oda: ofis kiralanınca sahne değişir; ekip değişince de yeniden kurulur (yardımcı koçlar odada görünür)
  let room = roomFor(state);
  let staffShown = staffSprites(state);
  /** öğrencinin odadaki görünümü: arşetipe göre karakter, ruh hâli simgesi */
  const actorsFor = (r: RoomDef): Actor[] => {
    const spots = r.studentSpots ?? [];
    return state.students
      .filter((x) => !x.left)
      .slice(0, spots.length)
      .map((st, i) => {
        const sprite = studentSprite(st.archetype, st.id);
        const frames = Object.keys(manifest.sprites).filter((n) => n.startsWith(`${sprite}_idle_`)).sort();
        return { id: st.id, sprite, frames, ...spots[i], mood: MOOD_ICON[moodOf(st, state.hour)] };
      })
      .filter((a) => manifest.sprites[a.sprite]);
  };
  let actors = actorsFor(room);
  const actorKey = (a: Actor[]) => a.map((x) => `${x.id}${x.mood}`).join(",");
  const onActorTap = (id: string) => strip.select(id);
  let scene = new RoomScene(room, manifest, textures, staffShown, actors, onActorTap);
  world.addChild(scene);
  const floaters = new Floaters();
  world.addChild(floaters);
  const centerRoom = () => {
    // odanın arka plan sprite'ı sığacak en büyük yakınlık; duvar tepesinin biraz taşmasına izin ver
    const span = (room.tilesX + room.tilesY) * 64;
    const [w, h] = room.background ? manifest.sprites[room.background].size : [span + 40, span / 2 + 230];
    // görünür alan: masaüstünde sağ sütun ve alt şerit, telefonda üst çubuk ile alt sayfa + şerit hariç
    const play = document.body.classList.contains("play");
    const mobile = play && isMobile();
    const box = (id: string) => document.getElementById(id)?.getBoundingClientRect();
    camera.rightInset = play && !mobile ? 364 : 0;
    camera.topInset = mobile ? (box("phud")?.bottom ?? 0) : 0;
    // telefonda alt sınır: karar sayfası KAPALIYKEN kaplayacağı yer (başlık + ana düğme) + öğrenci şeridi; sayfa açılınca
    // odanın alt kısmını örter ama oda o yüzden küçülmez (dikey alan dar)
    const sheet = document.getElementById("decisions");
    const part = (sel: string) => (sheet?.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0);
    const sheetClosed = part(".head") + part(".main") + 30;
    const strip = box("strip");
    camera.bottomInset = !play ? 0 : mobile ? sheetClosed + (strip && strip.height > 0 ? strip.height + 6 : 0) + 8 : 110;
    camera.fit(w, h * 0.9);
    camera.centerOn(-room.floorOrigin[0] + w / 2, -room.floorOrigin[1] + h / 2 + 10);
  };
  const syncRoom = () => {
    const next = roomFor(state);
    const staff = staffSprites(state);
    const nextActors = actorsFor(next);
    if (next === room && staff.join() === staffShown.join() && actorKey(nextActors) === actorKey(actors)) return;
    const moved = next !== room;
    const gridOn = scene.grid.visible;
    world.removeChild(scene);
    scene.destroy({ children: true });
    room = next;
    staffShown = staff;
    actors = nextActors;
    scene = new RoomScene(room, manifest, textures, staff, actors, onActorTap);
    scene.grid.visible = gridOn;
    world.addChild(scene);
    if (moved) centerRoom();
  };

  // --- arayüz: varsayılan sade oyun modu; ⚙ ile eski ayrıntılı paneller (yalnız inceleme) ---
  injectPlayCss();
  document.body.classList.add("play");
  centerRoom();
  const isPlay = () => document.body.classList.contains("play");

  const view: HudView = { zoom: camera.zoom, speed: 1, paused: true };
  const oldHud = createHudElement();
  oldHud.id = "old-hud";
  const editor = new ProgramEditor(state, (message) => message && feedback(message));
  const panel = new StudentPanel(state, (id) => editor.open(id));
  const feedback = (text: string, bad = false) => (isPlay() ? toast(text, bad) : panel.showToast(text, bad));
  const business = new BusinessPanel(state, feedback);
  const inbox = new InboxPanel(state, feedback);
  const history = new HistoryPanel(state);
  const report = new SeasonReportView(state, () => panel.render(true));
  const autopilot = new Autopilot(state);
  const decisions = new DecisionPanel(state);
  const summary = new WeekSummary(state, () => undefined);
  const setDetails = (on: boolean) => {
    document.body.classList.toggle("play", !on);
    centerRoom();
  };
  const strip = new StudentStrip(state, (id) => {
    setDetails(true);
    panel.select(id);
  });
  const hud = new PlayHud(state, {
    // kurum menüsü (sertifika, ofis, ekip) erken oyunda gizli: oyuncuyu boğmasın
    showCompany: () => state.students.length >= 3 || state.stage >= 2 || calendarAt(state.hour).weekIndex >= 6,
    onCompany: () => document.getElementById("business-panel")?.classList.toggle("open"),
    onHistory: () => history.toggle(),
    onDetails: () => setDetails(true),
    onLayout: () => relayout(),
  });
  const back = document.createElement("button");
  back.id = "back-to-game";
  back.className = "pl primary";
  back.addEventListener("click", () => setDetails(false));
  document.body.appendChild(back);

  // --- tur tabanlı hafta ---
  let running = false;
  /** hafta başladı ama bitmedi (olay ya da rapor için durdu) */
  let inWeek = false;
  let weeksPlayed = 0;
  const startOrContinue = () => {
    if (running || summary.isOpen || report.isOpen || state.gameOver) return;
    if (state.events.pending.length) {
      toast(tk("turn.eventStop"), true);
      return;
    }
    if (!inWeek) summary.begin();
    inWeek = true;
    running = true;
    document.getElementById("business-panel")?.classList.remove("open");
  };
  decisions.onMain = startOrContinue;
  const endWeek = () => {
    running = false;
    inWeek = false;
    weeksPlayed++;
    saveToStorage(state); // haftalık otomatik kayıt
    decisions.running = false;
    decisions.render(true);
    summary.show([...decisions.weekDecisions], decisions.count);
    decisions.weekDecisions.length = 0;
  };
  const updateFooter = () => {
    const cal = calendarAt(state.hour);
    if (running) {
      const pct = Math.round(((cal.weekday * 24 + cal.hourOfDay) / 168) * 100);
      decisions.footer = `<button class="primary" disabled>${tk("turn.running")} ${tk(`day.${cal.weekday}`)}</button><div class="bar"><span style="width:${pct}%"></span></div>`;
    } else if (state.events.pending.length) {
      decisions.footer = `<div class="sub">⚡ ${tk("turn.eventStop")}</div>`;
    } else {
      const waiting = decisions.count;
      decisions.footer = `<button class="primary" data-main="1">${tk(inWeek ? "turn.continue" : "turn.start")}</button>
        <div class="sub">${waiting ? tf("turn.sub", { n: waiting }) : tk("turn.subReady")}</div>`;
    }
    decisions.running = running;
  };

  const tutorial = new Tutorial(
    {
      state,
      decisions: () => decisions.weekDecisions.length + (state.quests.includes("firstDecision") ? 1 : 0),
      summaryOpen: () => summary.isOpen,
      // kayıttan devam edilen oyunda geçmiş haftalar da sayılır
      weeksPlayed: () => Math.max(weeksPlayed, calendarAt(state.hour).weekIndex),
    },
    manifest.sprites.char_buse_idle_se ? `${base}${manifest.sprites.char_buse_idle_se.url}` : null,
    !saved,
  );

  // --- sahnede geri bildirim: günlükteki yeni kayıtlar ---
  let seenLog = state.log.length;
  let lastTuition = state.economy.totals.tuition ?? 0;
  const buseAt = () => spriteTop(scene, "buse") ?? tileToScreen(room.tilesX / 2, room.tilesY / 2);
  const floatFor = (e: SimEvent) => {
    const d = e.data as Record<string, unknown>;
    const at = buseAt();
    switch (e.type) {
      case "studentEnrolled":
        return floaters.spawn(at, `🎉 ${tk("float.enrolled")}`);
      case "intervention":
        return floaters.spawn(at, d.matched === false ? "💧" : "❤", d.matched === false ? 0x9fc6ff : 0xff8fb1);
      case "parentMeeting":
        return floaters.spawn(at, `☎ ${tk("float.call")}`, 0xbfe8ff);
      case "mockExam":
        if (d.prev === null) return;
        return floaters.spawn(at, `${Number(d.total) >= Number(d.prev) ? "↗" : "↘"} ${(Number(d.total) - Number(d.prev)).toFixed(1)} net`, Number(d.total) >= Number(d.prev) ? 0x8fe3a0 : 0xff9d9d);
      case "questDone":
        return floaters.spawn(at, `★ ${tk("float.quest")}`, 0xffd166);
      case "studentLeft":
        return floaters.spawn(at, `💔 ${String(d.name ?? "")}`, 0xff9d9d);
    }
  };
  const watchLog = () => {
    const log = state.log;
    if (seenLog > log.length) seenLog = log.length;
    // aynı karede çok sayıda kayıt gelirse yalnız son birkaçını uçur
    for (const e of log.slice(Math.max(seenLog, log.length - 4))) floatFor(e);
    seenLog = log.length;
    const tuition = state.economy.totals.tuition ?? 0;
    if (tuition > lastTuition) floaters.spawn(buseAt(), `+${Math.round(tuition - lastTuition).toLocaleString("tr-TR")} ₺`, 0xffe39a);
    lastTuition = tuition;
  };

  let lastPanel = 0;
  let lastLocale = getLocale();
  const refresh = () => {
    view.zoom = camera.zoom;
    view.paused = !running;
    syncRoom();
    autopilot.tick();
    // oyun modunda olanlar hafta sonu ekranında anlatılır; anlık bildirim yalnız ayrıntı modunda
    const fresh = inbox.drainNew();
    if (!isPlay() && fresh.notices.length) feedback(fresh.notices.join(" · "));
    report.render();
    watchLog();
    renderHud(oldHud, state, view);
    back.textContent = `◀ ${tk("play.backToGame")}`;
    const now = performance.now();
    if (now - lastPanel > 200 || getLocale() !== lastLocale) {
      lastLocale = getLocale();
      updateFooter();
      decisions.render();
      strip.render();
      hud.render();
      tutorial.render();
      if (!isPlay()) {
        panel.render();
        inbox.render();
      }
      business.render();
      history.render();
      lastPanel = now;
    }
  };

  let acc = 0;
  app.ticker.add((ticker) => {
    floaters.update(ticker.deltaMS / 1000);
    scene.update(ticker.deltaMS / 1000);
    if (running) {
      acc += ticker.deltaMS;
      while (acc >= MS_PER_GAME_HOUR_RUNNING && running) {
        acc -= MS_PER_GAME_HOUR_RUNNING;
        const weekBefore = calendarAt(state.hour).weekIndex;
        advance(state, 1);
        if (calendarAt(state.hour).weekIndex !== weekBefore) endWeek();
        // olay, sezon raporu ya da iflas: hafta durur, oyuncu cevaplar
        else if (state.events.pending.length || state.season.pendingReport || state.gameOver) {
          running = false;
          decisions.running = false;
        }
      }
      if (!running) {
        acc = 0;
        lastPanel = 0; // durunca paneller hemen güncellensin
      }
    }
    refresh();
  });

  window.addEventListener("keydown", (e) => {
    if (editor.isOpen) {
      if (e.key === "Escape") editor.close();
      return; // düzenleyicide yazarken kısayollar çalışmaz
    }
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "g" || e.key === "G") scene.grid.visible = !scene.grid.visible;
    if (e.key === "l" || e.key === "L") setLocale(getLocale() === "tr" ? "en" : "tr");
    if (e.key === "d" || e.key === "D") panel.debug = !panel.debug;
    if (e.key === "h" || e.key === "H") history.toggle();
    if (e.key === "s" || e.key === "S") {
      saveToStorage(state);
      feedback("💾");
    }
    if (e.key === "F2") setDetails(isPlay());
    if (e.key === "n" || e.key === "N") {
      if (window.confirm(tf("play.confirmNew", {}))) {
        clearStorage();
        resetTutorial();
        location.reload();
      }
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (summary.isOpen) summary.close();
      else startOrContinue();
    }
  });
  window.addEventListener("resize", centerRoom);
  // telefon: alt sayfanın yüksekliği şerit/eğitim konumunu belirler; sayfa ya da üst çubuk boyu değişince oda yeniden ortalanır
  let lastLayout = "";
  const relayout = () => {
    const sheet = document.getElementById("decisions");
    const h = sheet ? Math.round(sheet.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--sheet-h", `${h}px`);
    const key = `${h}|${document.getElementById("phud")?.offsetHeight}|${isMobile()}|${isPlay()}`;
    if (key === lastLayout) return;
    lastLayout = key;
    if (isMobile()) requestAnimationFrame(centerRoom);
  };
  const ro = new ResizeObserver(relayout);
  for (const id of ["decisions", "phud", "strip"]) {
    const el = document.getElementById(id);
    if (el) ro.observe(el);
  }
  decisions.onLayout = relayout;
  relayout();

  // hata ayıklama: konsoldan durumu incelemek için
  (window as unknown as { __rota: unknown }).__rota = {
    state,
    advance: (h: number) => advance(state, h),
    cmd: (c: Command) => applyCommand(state, c),
    startWeek: startOrContinue,
  };
}

/**
 * Arşetipe göre öğrenci karakteri. Aynı arşetipten birden çok öğrenci varsa kimliğe göre
 * varyantlar arasında dağıtılır (char_student_<tür>_se, _b_se ...).
 */
const STUDENT_LOOKS: Record<string, string[]> = {
  anxious_perfectionist: ["char_student_anxious_se", "char_student_anxious_b_se"],
  talented_messy: ["char_student_messy_se", "char_student_messy_b_se"],
  quiet_drifter: ["char_student_quiet_se", "char_student_quiet_b_se"],
};
let availableSprites = new Set<string>();
function studentSprite(archetype: string, id: string): string {
  const looks = (STUDENT_LOOKS[archetype] ?? []).filter((n) => availableSprites.has(n));
  if (!looks.length) return STUDENT_LOOKS[archetype]?.[0] ?? "";
  const n = Number(id.replace(/\D/g, "")) || 0;
  return looks[n % looks.length];
}

function roomFor(state: GameState): RoomDef {
  if (state.office === "central") return officeCentral;
  if (state.office === "district") return officeDistrict;
  return homeStudio;
}

/** Yeni oyun (Aşama 1): öğrenci yok, kişisel çevreden iki aday. İlk öğrenciyi bulmak oyuncuya kalmış. */
function newGame(): GameState {
  const state = createState(20260907, BALANCE.coach.weeklyHours);
  const rng = createRng(state.rng);
  startCareer(state, rng);
  state.rng = rng.state();
  return state;
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:#ff8a8a;padding:16px">${String(err)}</pre>`);
});
