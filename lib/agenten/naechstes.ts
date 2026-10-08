// ─── Agenten-Bereich: „Als Nächstes“ — nach Eisenhower (09.10., Paket 3; AGENTEN_KONZEPT.md C1/C2, Antwort 9) ─────────────────
// Entscheidung 08.10. (Antwort 9): „geplante Läufe mit Uhrzeit · offene Freigaben · nach Eisenhower sortiert“. Leitbild: kritische Einträge
// pulsieren in der Oberfläche (`kritisch`).
//
// KEINE zweite Planung: „wann läuft was“ kommt aus DENSELBEN Regeln wie der Takt —
//   • Skills und Hintergrundaufgaben: lib/agenten/zeitplan.ts (`naechsteSlots`/`wirksamAb`, auch der Riegel `schonGelaufen`);
//   • eingebaute Head-Läufe: die reine Funktion des Heads-Takts (lib/heads/takt.ts `faelligeModi`) bzw. des Finanzchefs
//     (lib/finanzen/chef/plan.ts `faelligerModus`), stündlich über die nächsten Tage durchgespielt — mit Business-frei des Haushalts
//     (wie `headsRahmen`) und dem Stand des Heads, der nach jedem simulierten Lauf fortgeschrieben wird.
// Dazu: Fristen nur über `fristenLesen` (dieselbe Stelle wie Kalender/Glocke) mit `fuerPersonFiltern`, offene Freigaben als EINE Zeile
// je Head (Zahl), Aufgaben, die bei ZOE liegen (nur die eigenen Aufträge).
// Trennung serverseitig: nur Heads, die die Person sieht; Power Hour und Aufgaben nur die eigenen; Privates der anderen nie.
//
// Eisenhower (q1 wichtig + dringend · q2 wichtig · q3 dringend · q4 weder noch):
//   Freigabe    wichtig + dringend (wartet auf dich) — kritisch, wenn die älteste länger als `FREIGABE_KRITISCH_STUNDEN` wartet
//   Frist       wichtig; dringend ab `FRIST_DRINGEND_TAGE` vorher; kritisch am Tag selbst bzw. bei einer Kündigungsfrist in ≤ 3 Tagen
//   ZOE-Aufgabe wichtig bei Priorität hoch/kritisch; dringend bei Deadline in ≤ `FRIST_DRINGEND_TAGE`; kritisch = Priorität kritisch + dringend
//   Lauf        (Zeitplan, Skill, Plan) dringend in den nächsten `DRINGEND_STUNDEN`; wichtig nur Reviews (Stufe „stark“) und Hintergrundaufgaben

import { EISENHOWER_REIHE, GRENZEN, type Eisenhower, type HeadDef, type Naechstes, type NaechstesArt } from './typen';
import { naechsteSlots, regelVon, schonGelaufen, wirksamAb, TAKT_BIS, TAKT_VON, type ZeitRegel, type ZeitplanLage } from './zeitplan';
import { ausWandzeit, tagPlus, tagVon, wandzeit, wandAus } from '@/lib/kalender/zeit';
import { istBusinessFrei, type Spanne } from '@/lib/arbeitsrahmen/regel';
import { WEG } from '@/lib/wege';

export const DRINGEND_STUNDEN = 24;
export const FREIGABE_KRITISCH_STUNDEN = 48;
export const FRIST_DRINGEND_TAGE = 2;

export const quadrantVon = (wichtig: boolean, dringend: boolean): Eisenhower => (wichtig ? (dringend ? 'q1' : 'q2') : dringend ? 'q3' : 'q4');

export function eintrag(x: Omit<Naechstes, 'quadrant'>): Naechstes {
  return { ...x, quadrant: quadrantVon(x.wichtig, x.dringend) };
}

/** Sortierung: Quadrant (q1 … q4), darin Kritisches zuerst, dann nach Zeit. Rein. */
export function naechstesSortieren(liste: readonly Naechstes[]): Naechstes[] {
  return [...liste].sort((a, b) =>
    EISENHOWER_REIHE.indexOf(a.quadrant) - EISENHOWER_REIHE.indexOf(b.quadrant)
    || Number(!!b.kritisch) - Number(!!a.kritisch)
    || zeitWert(a.wann) - zeitWert(b.wann)
    || a.id.localeCompare(b.id));
}
/** ISO-Zeit oder Berliner Tag → Millisekunden (ein Tag zählt ab 00:00 Berlin). */
const zeitWert = (w: string): number => (/^\d{4}-\d{2}-\d{2}$/.test(w) ? ausWandzeit(`${w}T00:00:00`).getTime() : Date.parse(w));

// ── Läufe nach Zeitplan (Skills, Hintergrundaufgaben) ───────────────────────────────────────────────────────────────────

export interface ZeitplanPosten {
  art: 'skill' | 'plan';
  id: string;
  titel: string;
  headId: string | null;
  regel: ZeitRegel;
  /** Business-Head → ruht in Business-freien Zeiten der Person, für die er läuft. */
  business: boolean;
  /** Review (Stufe „stark“) bzw. Hintergrundaufgabe = wichtig. */
  wichtig: boolean;
}

/**
 * Die kommenden Läufe (rein) — über `naechsteSlots`, also genau dann, wann der Takt sie einreiht. Ein heutiger Slot, der schon lief
 * (`schonGelaufen`), fehlt. `frei(posten, tag)` = Business-freie Spannen an diesem Tag (nur für Business-Posten).
 */
export function zeitplanEintraege(posten: readonly ZeitplanPosten[], jetzt: Date, bis: Date, frei: (p: ZeitplanPosten, tag: string) => readonly Spanne[], riegel: Pick<ZeitplanLage, 'auftraege' | 'faeden'>): Naechstes[] {
  const von = wandzeit(jetzt), ende = wandzeit(bis);
  const raus: Naechstes[] = [];
  for (const p of posten) {
    const freiAm = (tag: string) => (p.business ? frei(p, tag) : []);
    for (const s of naechsteSlots(p.regel, `${tagVon(von)}T00:00:00`, ende, freiAm)) {
      if (schonGelaufen(p, s.slot, riegel)) continue;
      let w = s.wirksam;
      // Heute schon fällig, aber noch nicht eingereiht: der Takt reiht ihn beim nächsten offenen Moment ein — oder heute gar nicht mehr.
      if (w < von) { const ab = wirksamAb(von, freiAm(tagVon(von))); if (!ab || tagVon(ab) !== tagVon(s.slot)) continue; w = ab; }
      const wann = ausWandzeit(w);
      const dringend = wann.getTime() - jetzt.getTime() <= DRINGEND_STUNDEN * 3_600_000;
      raus.push(eintrag({
        id: `zp:${p.art}:${p.id}:${s.slot}`, art: p.art, titel: p.titel, wann: wann.toISOString(), ...(p.headId ? { headId: p.headId } : {}),
        link: WEG.agenten(p.headId ? { h: p.headId } : {}), wichtig: p.wichtig, dringend,
      }));
    }
  }
  return raus;
}

/** Ein Skill/Plan als Posten. */
export const postenVon = (p: Omit<ZeitplanPosten, 'regel'> & { regel: ZeitRegel | null }): ZeitplanPosten | null => (p.regel ? { ...p, regel: p.regel } : null);

// ── Eingebaute Head-Läufe: dieselbe reine Regel wie der Takt, durchgespielt ──────────────────────────────────────────────────

export interface ModusTreffer { modus: string; person?: string; wann: Date }

/**
 * Spielt eine Takt-Regel stündlich durch (rein): ab `von` (zuerst der Moment selbst — was gerade fällig ist, reiht der Takt in der
 * nächsten Minute ein), dann jede volle Stunde bis `bis`. Je Zeitpunkt so lange `modi(t)` fragen, bis nichts mehr fällig ist
 * (die Regel liefert höchstens einen je Aufruf); `gelaufen(m, t)` schreibt den simulierten Stand fort. `ruht(t)`: außerhalb des Takts.
 */
export function modusZeiten(von: Date, bis: Date, modi: (t: Date) => { modus: string; person?: string }[], gelaufen: (m: { modus: string; person?: string }, t: Date) => void, ruht: (t: Date) => boolean = () => false): ModusTreffer[] {
  const raus: ModusTreffer[] = [];
  const zeiten: Date[] = [von];
  const erste = new Date(von); erste.setMinutes(0, 0, 0); erste.setTime(erste.getTime() + 3_600_000);
  for (let t = erste.getTime(); t < bis.getTime(); t += 3_600_000) zeiten.push(new Date(t));
  for (const t of zeiten) {
    if (ruht(t)) continue;
    for (let i = 0; i < 8; i++) {
      const m = modi(t)[0];
      if (!m) break;
      raus.push({ ...m, wann: t });
      gelaufen(m, t);
    }
  }
  return raus;
}

/** Takt-Fenster der Agenten (Berliner Stunden) — dieselben Grenzen wie der Takt. */
export const ausserhalbTakt = (t: Date): boolean => { const h = Number(wandzeit(t).slice(11, 13)); return h < TAKT_VON || h >= TAKT_BIS; };

const MODUS_TITEL: Readonly<Record<string, string>> = {
  power_hour: 'Power Hour vorbereiten', lead_review: 'Leads qualifizieren', kundenreview: 'Kundenreview', wochenreview: 'Wochenreview',
  wochenplan: 'Wochenplan', netzwerk: 'Vernetzen-Runde', monatsreview: 'Monatsreview', planung: 'Event-Countdown', nachfassen: 'Nachfassen nach dem Event',
  tagescheck: 'Tagescheck', monatsabschluss: 'Monatsabschluss', steuercheck: 'Steuercheck',
};
const REVIEW = new Set(['wochenreview', 'kundenreview', 'monatsreview', 'monatsabschluss', 'steuercheck', 'lead_review']);

/** Treffer eines Heads → Einträge (rein); Power Hour einer anderen Person fällt weg. */
export function headEintraege(headId: string, treffer: readonly ModusTreffer[], person: string, jetzt: Date): Naechstes[] {
  return treffer.filter(t => !t.person || t.person === person).map(t => eintrag({
    id: `takt:${headId}:${t.modus}:${t.wann.toISOString()}`, art: 'zeitplan', titel: MODUS_TITEL[t.modus] ?? 'Lauf', wann: t.wann.toISOString(), headId,
    link: WEG.agenten({ h: headId }), wichtig: REVIEW.has(t.modus), dringend: t.wann.getTime() - jetzt.getTime() <= DRINGEND_STUNDEN * 3_600_000,
  }));
}

// ── Freigaben, Fristen, ZOE-Aufgaben ─────────────────────────────────────────────────────────────────────────────────────

/** Offene Freigaben als EINE Zeile je Head (C2). `aeltestes` = ISO-Zeit der ältesten offenen. Rein. */
export function freigabeEintraege(gruppen: readonly { headId?: string; anzahl: number; aeltestes: string }[], jetzt: Date): Naechstes[] {
  return gruppen.filter(g => g.anzahl > 0).map(g => eintrag({
    id: `freigabe:${g.headId ?? 'zoe'}`, art: 'freigabe', titel: g.anzahl === 1 ? '1 Freigabe offen' : `${g.anzahl} Freigaben offen`, wann: jetzt.toISOString(),
    ...(g.headId ? { headId: g.headId } : {}), link: WEG.freigaben(), wichtig: true, dringend: true, anzahl: g.anzahl,
    ...(jetzt.getTime() - Date.parse(g.aeltestes) > FREIGABE_KRITISCH_STUNDEN * 3_600_000 ? { kritisch: true } : {}),
  }));
}

/** Eine Frist (aus `fristenLesen`) dem passenden Head zuordnen — `null`, wenn keiner passt. */
export function headFuerFrist(f: { art: string; bereich: 'privat' | 'business' }): string | null {
  switch (f.art) {
    case 'zahlung': case 'eingang': case 'steuer': return f.bereich === 'privat' ? 'finanzen-privat' : 'finanzen';
    case 'mandat': return 'kundenerfolg';
    case 'angebot': case 'deal': return 'sales';
    case 'dsgvo': return 'recht';
    case 'vertrag': return 'strategie';
    case 'etappe': return 'produkt';
    case 'meilenstein': return f.bereich === 'privat' ? 'assistenz' : 'strategie';
    default: return null;
  }
}

/** Fristen der nächsten Tage → Einträge (rein). Erledigtes und Mandats-Reviews (führt das Follow-up) fallen weg; fremde Zuständigkeit auch. */
export function fristEintraege(fristen: readonly { id: string; art: string; tag: string; titel: string; href: string; erledigt?: boolean; bereich: 'privat' | 'business'; fuer?: string; kuendigung?: true; review?: true }[], person: string, heute: string, sichtbar: ReadonlySet<string>): Naechstes[] {
  return fristen.filter(f => !f.erledigt && !f.review && (!f.fuer || f.fuer === person || f.fuer === 'beide') && f.tag >= heute && f.tag < tagPlus(heute, GRENZEN.naechsteTage + 1)).map(f => {
    const h = headFuerFrist(f);
    const dringend = f.tag <= tagPlus(heute, FRIST_DRINGEND_TAGE);
    const kritisch = f.tag === heute || (!!f.kuendigung && f.tag <= tagPlus(heute, 3));
    return eintrag({ id: `frist:${f.id}`, art: 'frist', titel: f.titel, wann: f.tag, ...(h && sichtbar.has(h) ? { headId: h } : {}), link: f.href, wichtig: true, dringend, ...(kritisch ? { kritisch: true } : {}) });
  });
}

/** Aufgaben, die bei ZOE liegen (nur die eigenen Aufträge, offen bzw. in Arbeit) → Einträge (rein). */
export function zoeAufgabeEintraege(tasks: readonly { id: string; title: string; priority?: string; dueDate?: string; zoe?: { status: string } }[], heute: string, jetzt: Date): Naechstes[] {
  return tasks.filter(t => t.zoe && (t.zoe.status === 'offen' || t.zoe.status === 'in_arbeit')).map(t => {
    const due = t.dueDate?.slice(0, 10);
    const dringend = !!due && due <= tagPlus(heute, FRIST_DRINGEND_TAGE);
    const wichtig = t.priority === 'high' || t.priority === 'critical';
    return eintrag({
      id: `zoe-aufgabe:${t.id}`, art: 'zoe-aufgabe', titel: t.title, wann: due && due >= heute ? due : jetzt.toISOString(), link: WEG.aufgabe(t.id),
      wichtig, dringend, ...(t.priority === 'critical' && dringend ? { kritisch: true } : {}),
    });
  });
}

// ── Server ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const sicher = async <T,>(p: Promise<T>, leer: T): Promise<T> => p.catch(e => { console.error('[agenten-naechstes] Quelle nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); return leer; });

/** „Als Nächstes“ für die Person (die nächsten `GRENZEN.naechsteTage` Tage), sortiert nach Eisenhower. */
export async function naechstesLesen(person: string, jetzt: Date = new Date()): Promise<Naechstes[]> {
  const { loadJson } = await import('@/lib/store/local-db');
  const { sichtbareHeads, sichtbareSkills, umfangFuer } = await import('./skills-server');
  const { einstellungFuer } = await import('./skills-lesen');
  const { laufPersonFuerSkill, agentHead } = await import('./zeitplan');
  const { planLesen } = await import('./plan-server');
  const { kiSchalterFuer } = await import('@/lib/datenschutz/ki-einstellungen');
  const { businessFreiFensterFuer, haushaltFensterFuer } = await import('@/lib/arbeitsrahmen/server');
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const { lies: auftraegeLesen } = await import('@/lib/zoe/auftraege');

  const heute = tagVon(wandzeit(jetzt));
  const bis = new Date(jetzt.getTime() + GRENZEN.naechsteTage * 864e5);
  const heads = await sichtbareHeads(person);
  const sicht = new Set(heads.map(h => h.id));
  const umfang = await umfangFuer(person);
  const [einst, ki, konten, auftraege] = await Promise.all([
    sicher(einstellungFuer(umfang.haushalt), { v: 1 as const, heads: {} }),
    sicher(kiSchalterFuer(null), { hintergrund: false } as { hintergrund: boolean }),
    sicher(ladeKonten(), { konten: [], einladungen: [] }),
    sicher(auftraegeLesen(), []),
  ]);
  const raus: Naechstes[] = [];
  const freiCache = new Map<string, Spanne[]>();
  const personFrei = async (p: string): Promise<Spanne[]> => {
    if (!freiCache.has(p)) freiCache.set(p, await sicher(businessFreiFensterFuer(p, tagPlus(heute, -1), tagPlus(heute, GRENZEN.naechsteTage + 2)), []));
    return freiCache.get(p)!;
  };
  const amTag = (spannen: readonly Spanne[], tag: string) => spannen.filter(s => s.start < `${tagPlus(tag, 1)}T00:00:00` && s.ende > `${tag}T00:00:00`);

  // 1) Skills und Hintergrundaufgaben nach Zeitplan — nur, wenn die Hintergrund-KI an ist und kein Not-Aus gilt (sonst laufen sie nicht).
  if (ki.hintergrund && !einst.notAus) {
    const personen = new Set(konten.konten.map(k => k.speicher));
    const posten: (ZeitplanPosten & { laufPerson: string })[] = [];
    for (const s of await sicher(sichtbareSkills(person, heads, umfang), [])) {
      if (!s.aktiv || s.ausloeser.art !== 'zeitplan' || einst.heads[s.headId]?.aktiv === false) continue;
      const h = heads.find(x => x.id === s.headId)!;
      const lp = h.ebene === 'person' ? person : laufPersonFuerSkill(s, personen);
      const p = lp ? postenVon({ art: 'skill', id: s.id, titel: s.name, headId: s.headId, regel: regelVon(s.ausloeser), business: h.bereich === 'business', wichtig: s.stufe === 'stark' }) : null;
      if (p) posten.push({ ...p, laufPerson: lp! });
    }
    for (const a of (await sicher(planLesen(person), { aufgaben: [], staende: {} })).aufgaben) {
      const ah = a.aktiv ? agentHead(a.agent) : null;
      if (!ah || (ah.headId !== 'zoe' && (!sicht.has(ah.headId) || einst.heads[ah.headId]?.aktiv === false))) continue;
      const p = postenVon({ art: 'plan', id: a.id, titel: a.titel, headId: ah.headId === 'zoe' ? null : ah.headId, regel: regelVon(a.zeitplan), business: ah.bereich === 'business', wichtig: true });
      if (p) posten.push({ ...p, laufPerson: person });
    }
    const spannen = new Map<string, Spanne[]>();
    for (const p of posten) if (p.business && !spannen.has(p.laufPerson)) spannen.set(p.laufPerson, await personFrei(p.laufPerson));
    const { fadenBestand } = await import('./typen');
    const faeden = ((await sicher(loadJson<{ faeden?: { skillId?: string; planId?: string; erstellt: string }[] }>(fadenBestand(person)), null))?.faeden ?? []);
    raus.push(...zeitplanEintraege(posten, jetzt, bis, (p, tag) => amTag(spannen.get((p as ZeitplanPosten & { laufPerson: string }).laufPerson) ?? [], tag), { auftraege, faeden }));
  }

  // 2) Eingebaute Head-Läufe (Heads-Takt; laufen auch ohne KI — dann als Regelwerk).
  const hhSpannen = await sicher(haushaltFensterFuer(tagPlus(heute, -7), tagPlus(heute, GRENZEN.naechsteTage + 2)), []);
  const hhFrei = (t: Date) => istBusinessFrei(hhSpannen, wandzeit(t));
  if (!einst.notAus) {
    const headsTakt = ['sales', 'marketing', 'event'].filter(h => sicht.has(h) && einst.heads[h]?.aktiv !== false);
    if (headsTakt.length) {
      const { faelligeModi } = await import('@/lib/heads/takt');
      const { AGENT_ID } = await import('@/lib/heads/prompt');
      const { leererStand, standName } = await import('@/lib/heads/stand');
      const { resolveAgent } = await import('@/lib/agent-config');
      const { ladeCrm } = await import('@/lib/crm/speicher');
      const { TEAM } = await import('@/lib/crm/team');
      const events = (await sicher(ladeCrm(), null))?.events ?? [];
      const mitKonto = new Set(konten.konten.map(k => k.speicher));
      const team = TEAM.map(t => t.id).filter(id => mitKonto.has(id));
      const teamFrei = new Map<string, Spanne[]>();
      for (const p of team) teamFrei.set(p, await personFrei(p));
      for (const h of headsTakt) {
        if (!(await sicher(resolveAgent(AGENT_ID[h as 'sales']), { enabled: false } as { enabled: boolean })).enabled) continue;
        const roh = await sicher(loadJson<Record<string, unknown>>(standName(h as 'sales')), null);
        const sim = { ...leererStand(), ...(roh ?? {}) } as ReturnType<typeof leererStand>;
        sim.letzte = { ...sim.letzte };
        const treffer = modusZeiten(jetzt, bis,
          t => faelligeModi(h as 'sales', t, sim, events, team, {
            haushaltFrei: hhFrei(t),
            personFrei: new Set(team.filter(p => istBusinessFrei(teamFrei.get(p) ?? [], wandzeit(t)))),
            warFrei: (tag, stunde) => istBusinessFrei(hhSpannen, wandAus(tag, stunde * 60)),
          }),
          (m, t) => { sim.letzte[m.person ? `${m.modus}:${m.person}` : m.modus] = t.toISOString(); },
          ausserhalbTakt);
        raus.push(...headEintraege(h, treffer, person, jetzt));
      }
    }
    // Finanzchef: nur mit Schlüssel, eingeschaltet und Hintergrund-KI (wie `finanzchefFaellig`).
    if (sicht.has('finanzen') && ki.hintergrund && einst.heads.finanzen?.aktiv !== false) {
      const { hasAnthropicKey } = await import('@/lib/anthropic');
      const { resolveAgent } = await import('@/lib/agent-config');
      if (hasAnthropicKey() && (await sicher(resolveAgent('finanzchef'), { enabled: false } as { enabled: boolean })).enabled) {
        const { faelligerModus } = await import('@/lib/finanzen/chef/plan');
        const { leererStand, standName } = await import('@/lib/finanzen/chef/stand');
        const { haushalteAus } = await import('@/lib/finanzen/chef/takt');
        const { steuertermine } = await import('@/lib/finanzen/chef/steuertermine');
        const { ladeEinstellung } = await import('@/lib/finanzen/chef/lauf');
        const { heuteBerlin } = await import('@/lib/finanzen/haushalt/monat');
        const hh = haushalteAus(konten.konten);
        const haushalt = umfang.haushalt && hh.has(umfang.haushalt) ? umfang.haushalt : null;
        const lauf = haushalt ? hh.get(haushalt)! : null;
        const sim = { ...leererStand(), ...((await sicher(loadJson<Record<string, unknown>>(standName(haushalt)), null)) ?? {}) } as ReturnType<typeof leererStand>;
        sim.letzte = { ...sim.letzte }; sim.versuche = { ...sim.versuche }; sim.berichte = [...sim.berichte];
        const e = await sicher(ladeEinstellung(), null);
        const termine = e ? steuertermine(heute, tagPlus(heute, 60), e.steuer) : [];
        const lpFrei = lauf ? await personFrei(lauf) : [];
        const treffer = modusZeiten(jetzt, bis,
          t => { if (hhFrei(t) || istBusinessFrei(lpFrei, wandzeit(t))) return []; const m = faelligerModus(sim, heuteBerlin(t), t.getDay(), t.getHours(), termine, t); return m ? [{ modus: m.modus }] : []; },
          (m, t) => {
            const iso = t.toISOString();
            sim.letzte = { ...sim.letzte, [m.modus]: iso }; sim.versuche = { ...sim.versuche, [m.modus]: iso };
            if (m.modus === 'monatsabschluss') { const vm = heuteBerlin(t).slice(0, 7); const [j, mo] = vm.split('-').map(Number); const vor = mo === 1 ? `${j - 1}-12` : `${j}-${String(mo - 1).padStart(2, '0')}`; sim.berichte.push({ modus: 'monatsabschluss', monat: vor } as (typeof sim.berichte)[number]); }
          },
          ausserhalbTakt);
        raus.push(...headEintraege('finanzen', treffer, person, jetzt));
      }
    }
  }

  // 3) Offene Freigaben — EINE Zeile je Head (ZOE-Stapel, Freigabe-Listen der Heads und des Finanzchefs).
  const { lies: stapelLesen, vorschlagSichtbar } = await import('@/lib/zoe/stapel');
  const { standName: chefStand } = await import('@/lib/finanzen/chef/stand');
  const gruppen = new Map<string, { anzahl: number; aeltestes: string }>();
  const zaehle = (k: string, zeit: string) => { const g = gruppen.get(k) ?? { anzahl: 0, aeltestes: zeit }; g.anzahl++; if (zeit < g.aeltestes) g.aeltestes = zeit; gruppen.set(k, g); };
  for (const v of await sicher(stapelLesen('offen'), [])) {
    if (!vorschlagSichtbar(v, person, true)) continue;
    const h = v.bezug && ['skill', 'mitarbeiter', 'merksatz'].includes(v.bezug.art) && sicht.has(v.bezug.id) ? v.bezug.id : '';
    zaehle(h, v.zeit);
  }
  for (const h of ['sales', 'marketing', 'event'].filter(x => sicht.has(x))) {
    const s = await sicher(loadJson<{ vorschlaege?: { status: string; erstellt: string; fuer?: string }[] }>(`head-${h}`), null);
    for (const v of s?.vorschlaege ?? []) if (v.status === 'offen' && (!v.fuer || v.fuer === person || v.fuer === 'beide')) zaehle(h, v.erstellt);
  }
  if (sicht.has('finanzen')) for (const v of (await sicher(loadJson<{ vorschlaege?: { status: string; erstellt: string }[] }>(chefStand(null)), null))?.vorschlaege ?? []) if (v.status === 'offen') zaehle('finanzen', v.erstellt);
  if (sicht.has('finanzen-privat') && umfang.haushalt) for (const v of (await sicher(loadJson<{ vorschlaege?: { status: string; erstellt: string }[] }>(chefStand(umfang.haushalt)), null))?.vorschlaege ?? []) if (v.status === 'offen') zaehle('finanzen-privat', v.erstellt);
  raus.push(...freigabeEintraege(Array.from(gruppen, ([k, g]) => ({ ...(k ? { headId: k } : {}), ...g })), jetzt));

  // 4) Fristen — dieselbe Stelle wie Kalender und Glocke; Privates nur für volle Mitglieder (`fuerPersonFiltern`).
  const { fristenLesen } = await import('@/lib/kalender/fristen-server');
  const { fuerPersonFiltern } = await import('@/lib/kalender/eintraege');
  const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  const { istInhaber } = await import('@/lib/zugang/haushalt-inhaber');
  const fristen = await sicher(fristenLesen(heute, tagPlus(heute, GRENZEN.naechsteTage + 1), heute, person), []);
  const gefiltert = fuerPersonFiltern({ fristen, erinnerungen: [] }, { inhaber: await sicher(istInhaber(person), false), privat: !!(await sicher(haushaltFuer(person), null)) }).fristen;
  raus.push(...fristEintraege(gefiltert, person, heute, sicht));

  // 5) Aufgaben, die bei ZOE liegen — nur die eigenen Aufträge (Sichtfilter der Person).
  const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
  const { zoeAufgaben } = await import('@/lib/aufgaben/zoe');
  const stand = await sicher(ladeAufgabenSicht(person), null);
  if (stand) raus.push(...zoeAufgabeEintraege(zoeAufgaben(stand, { auftraggeberin: person }).alle, heute, jetzt));

  return naechstesSortieren(raus.filter(x => zeitWert(x.wann) < bis.getTime()));
}

export type { NaechstesArt, HeadDef };
