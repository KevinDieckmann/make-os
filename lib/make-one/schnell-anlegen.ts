// ─── MAKE OS — Schnell-Anlegen-Kürzel ───────────────────────────────────────
// Reine Logik, aus der Aufgaben-Ansicht herausgelöst (Härtung 04.08.), damit
// sie testbar ist: „!! kritisch · @malin · morgen · 15.08. · #capos" wird zu
// einer fertigen Aufgabe. Ein Tippfehler hier landet direkt im Board — genau
// die Sorte Code, die Tests verdient.
// Seit 29.09. (#21): Wochentags-Kürzel (mo … so) nur als LETZTES Wort oder mit Präfix („am fr“, „bis mo“) — „so schnell
// wie möglich“ bekam vorher Sonntag als Frist. Ausgeschriebene Wochentage („freitag“) gelten überall. Datum „TT.MM.“ bzw.
// „TT.MM.JJJJ“ nur, wenn es den Kalendertag gibt („31.02.“ bleibt im Titel, mit Hinweis). `schnellVorschau` zeigt vor dem
// Speichern, was erkannt wurde („Fr 02.10.“).
// Seit 29.09. abends (Sichtprüfung F4): „@Name“ kommt aus dem Team (Konten des Haushalts, Vorname/Kurzname/Speichername,
// Umlaut-tolerant: @jürgen = @juergen = @jurgen) statt fest @kevin/@malin. Die erste erkannte Person ist verantwortlich,
// weitere sind beteiligt; „@beide“/„@alle“ = ich verantwortlich + alle anderen beteiligt (es gibt keine „beide“-Zuständigkeit
// mehr, lib/aufgaben/zustaendig.ts). Unbekannte @Wörter bleiben im Titel. Ohne @ = ich (`schnellZustaendigkeit`).
// Seit 06.10. (Malins Bauplan-Karte): die Schnelleingabe legt IMMER eine Aufgabe an. Ziel per `#Projekt/Liste` (Groß/Klein egal,
// Leerzeichen erlaubt bis zum Ende des Treffers — der längste passende Name gewinnt, bei Gleichstand der aktuelle Space). `#projekt`
// (ein Wort, Teil des Projektnamens) gilt weiter. Ein unbekanntes `#…/…` legt NICHT an: `zielUnbekannt` mit Vorschlag
// („Liste nicht gefunden — meintest du …?“).

import { localDay } from '@/lib/zeit';
import { istTag, kurzTag, tagPlus, wochentag } from '@/lib/aufgaben/wiederholung';
import type { Priority } from '@/types/common';

// ── Datums-Kurzhelfer fürs Schnellanlegen und die Zeilen-Aktionen ──
export const tagInT = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
export const naechsterWochentag = (idx: number) => { // 0=So … 6=Sa (JS getDay)
  const d = new Date();
  d.setDate(d.getDate() + (((idx - d.getDay()) % 7 + 7) % 7 || 7));
  return localDay(d);
};

const KURZ: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
const LANG: Record<string, number> = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };
/** Nächster Tag mit diesem Wochentag NACH `heute` (heute selbst zählt nicht — „fr“ am Freitag = nächste Woche). */
const naechsterAb = (heute: string, wt: number) => tagPlus(heute, ((wt - wochentag(heute)) % 7 + 7) % 7 || 7);

export interface SchnellErgebnis {
  title: string;
  priority: Priority;
  dueDate?: string;
  projectId?: string;
  /** Die erste getippte Person (@Name, Speichername) — sonst entscheidet `schnellZustaendigkeit` (= ich). */
  zustaendig?: string;
  /** Weitere getippte Personen (Speichernamen, ohne die Verantwortliche). */
  beteiligte: string[];
  /** „@beide“ / „@alle“: alle anderen Personen des Haushalts sind beteiligt. */
  alleBeteiligt: boolean;
  /** Wurde eine Zuständigkeit ausdrücklich getippt (@Person, @beide, @alle)? */
  zustaendigGetippt: boolean;
  /** Ein getipptes Datum, das es nicht gibt (z. B. „31.02.“) — bleibt im Titel. */
  datumUngueltig?: string;
  /** `#Projekt/Liste` erkannt (06.10.): dort entsteht die Aufgabe. */
  ziel?: SchnellZiel;
  /** `#…/…` ohne Treffer (06.10.): nicht anlegen — Hinweis „Liste nicht gefunden“ mit Vorschlag. */
  zielUnbekannt?: { text: string; vorschlag?: SchnellZiel };
}

/** Ein mögliches Ziel der Schnelleingabe: Liste in einem Projekt eines Space (Firma › Projekt › Liste). */
export interface SchnellZiel { spaceId: string; projektId: string; projektTitel: string; listeId: string; listeTitel: string }

const klein = (x: string) => x.toLocaleLowerCase('de-DE');
/** So schreibt man ein Ziel als Kürzel: `#Projekt/Liste`. */
export const zielKuerzel = (z: Pick<SchnellZiel, 'projektTitel' | 'listeTitel'>): string => `#${z.projektTitel}/${z.listeTitel}`;

/**
 * `#Projekt/Liste` am Anfang von `rest` (dem Text hinter „#“) — der längste passende Name, der an einer Wortgrenze endet; bei
 * Gleichstand das erste Ziel (die Aufrufer legen den aktuellen Space nach vorn). Liefert das Ziel und die Länge des Treffers.
 */
export function zielAmAnfang(rest: string, ziele: readonly SchnellZiel[]): { ziel: SchnellZiel; laenge: number } | null {
  const r = klein(rest);
  let best: { ziel: SchnellZiel; laenge: number } | null = null;
  for (const z of ziele) {
    const k = klein(`${z.projektTitel}/${z.listeTitel}`);
    if (!r.startsWith(k)) continue;
    const danach = rest.charAt(k.length);
    if (danach && !/\s/.test(danach)) continue;
    if (!best || k.length > best.laenge) best = { ziel: z, laenge: k.length };
  }
  return best;
}

/** Vorschlag zu einem unbekannten `#…/…`: das Ziel, dessen Projekt und Liste am besten zum Getippten passen (oder keins). */
export function zielVorschlag(rest: string, ziele: readonly SchnellZiel[]): SchnellZiel | undefined {
  const i = rest.indexOf('/');
  const p = klein(rest.slice(0, i < 0 ? undefined : i).trim());
  const l = klein(i < 0 ? '' : rest.slice(i + 1).trim());
  const lWort = l.split(/\s+/)[0] ?? '';
  let best: { z: SchnellZiel; punkte: number } | undefined;
  for (const z of ziele) {
    const zp = klein(z.projektTitel), zl = klein(z.listeTitel);
    let punkte = 0;
    if (p && (zp === p || zp.startsWith(p) || p.startsWith(zp))) punkte += 3; else if (p && zp.includes(p)) punkte += 2;
    if (l && l.startsWith(zl)) punkte += 4; else if (lWort && zl.startsWith(lWort)) punkte += 2; else if (lWort && zl.includes(lWort)) punkte += 1;
    if (punkte > 0 && (!best || punkte > best.punkte)) best = { z, punkte };
  }
  return best?.z;
}

/** Eine Person mit Konto für „@Name“ — aus dem Team (`usePersonen`: Vorname, Kurzname, Speichername). */
export interface SchnellPerson { speicher: string; namen: readonly string[] }
/** Solange das Team nicht geladen ist, erkennt „@Name“ niemanden (09.10.: kein Rückfall auf feste Namen — Regel 11). */
const STANDARD_PERSONEN: readonly SchnellPerson[] = [];
const ALLE_WOERTER = new Set(['beide', 'alle']);

/** Umlaut-tolerante Schlüssel eines Namens: „Jürgen“ → { juergen, jurgen }. */
function namensSchluessel(n: string): string[] {
  const k = n.trim().toLowerCase();
  if (!k) return [];
  const umschrieben = k.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const ohneZeichen = k.replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Array.from(new Set([k, umschrieben, ohneZeichen]));
}

/** Die Person zu einem getippten Namen — nur bei genau einem Treffer. */
export function personZuName(name: string, personen: readonly SchnellPerson[]): string | undefined {
  const s = new Set(namensSchluessel(name));
  if (!s.size) return undefined;
  const treffer = personen.filter(p => [p.speicher, ...p.namen].some(n => namensSchluessel(n).some(k => s.has(k))));
  return treffer.length === 1 ? treffer[0].speicher : undefined;
}

/** Schnell-Anlegen mit Kürzeln: !! kritisch · ! hoch · heute/morgen/übermorgen · [am|bis] mo–so · freitag · TT.MM.[JJJJ] · #Projekt/Liste · #projekt · @Name/@beide */
export function parseSchnell(rein: string, projekte: { id: string; title: string }[], heute: string = localDay(), personen: readonly SchnellPerson[] = STANDARD_PERSONEN, ziele: readonly SchnellZiel[] = []): SchnellErgebnis {
  let s = ` ${rein.trim()} `;
  // `#Projekt/Liste` (06.10.) zuerst — Namen dürfen Leerzeichen, „!“ und Ziffern enthalten, die sonst als Kürzel gälten.
  let ziel: SchnellZiel | undefined;
  let zielUnbekannt: SchnellErgebnis['zielUnbekannt'];
  const raute = s.search(/\s#[^\s#]/);
  if (raute >= 0 && s.slice(raute + 2).includes('/')) {
    const rest = s.slice(raute + 2);
    const t = zielAmAnfang(rest, ziele);
    if (t) { ziel = t.ziel; s = `${s.slice(0, raute + 1)}${rest.slice(t.laenge)}`; }
    else {
      const text = rest.trim().slice(0, 120);
      const vorschlag = zielVorschlag(rest, ziele);
      zielUnbekannt = { text: `#${text}`, ...(vorschlag ? { vorschlag } : {}) };
    }
  }
  let priority: Priority = 'medium';
  if (s.includes('!!')) { priority = 'critical'; s = s.replace('!!', ' '); }
  else if (s.includes('!')) { priority = 'high'; s = s.replace('!', ' '); }
  const getippt: string[] = [];
  let alleBeteiligt = false;
  s = s.replace(/(\s)@([\p{L}\p{N}][\p{L}\p{N}._-]*)/gu, (ganz, vor: string, wort: string) => {
    const name = wort.replace(/[._-]+$/, '');
    const rest = wort.slice(name.length);
    if (ALLE_WOERTER.has(name.toLowerCase())) { alleBeteiligt = true; return `${vor}${rest}`; }
    const p = personZuName(name, personen);
    if (!p) return ganz;
    if (!getippt.includes(p)) getippt.push(p);
    return `${vor}${rest}`;
  });
  const zustaendig = getippt[0];
  const beteiligte = getippt.slice(1);
  const zustaendigGetippt = !!zustaendig || alleBeteiligt;
  let projectId: string | undefined;
  if (!ziel && !zielUnbekannt) s = s.replace(/\s#(\S+)/, (_, w) => {
    const p = projekte.find(x => x.title.toLowerCase().includes(String(w).toLowerCase()));
    if (p) { projectId = p.id; return ' '; }
    return ` #${w}`;
  });
  let dueDate: string | undefined;
  let datumUngueltig: string | undefined;
  s = s.replace(/\s(heute|morgen|übermorgen)(?=\s)/i, (_, w) => { const x = w.toLowerCase(); dueDate = tagPlus(heute, x === 'heute' ? 0 : x === 'morgen' ? 1 : 2); return ' '; });
  // Wochentag: mit Präfix irgendwo, ausgeschrieben irgendwo, Kürzel nur als letztes Wort.
  if (!dueDate) s = s.replace(/\s(?:am|bis|ab|nächsten|naechsten|kommenden)\s(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\.?(?=\s)/i, (_, w) => { const k = w.toLowerCase(); dueDate = naechsterAb(heute, KURZ[k] ?? LANG[k]); return ' '; });
  if (!dueDate) s = s.replace(/\s(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?=\s)/i, (_, w) => { dueDate = naechsterAb(heute, LANG[w.toLowerCase()]); return ' '; });
  if (!dueDate) s = s.replace(/\s(mo|di|mi|do|fr|sa|so)\.?\s*$/i, (_, w) => { dueDate = naechsterAb(heute, KURZ[w.toLowerCase()]); return ' '; });
  if (!dueDate) s = s.replace(/\s(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?=\s)/, (ganz, tt, mm, jj) => {
    const zwei = (x: string) => String(x).padStart(2, '0');
    const j = Number(heute.slice(0, 4));
    if (jj) {
      const jahr = jj.length === 2 ? 2000 + Number(jj) : Number(jj);
      const kand = `${jahr}-${zwei(mm)}-${zwei(tt)}`;
      if (!istTag(kand)) { datumUngueltig = ganz.trim(); return ganz; }
      dueDate = kand; return ' ';
    }
    // Vergangen → nächstes Jahr; den Tag muss es im gewählten Jahr geben (29.02. → das nächste Schaltjahr).
    let wahl: string | null = null;
    for (let k = 0; k <= 4 && !wahl; k++) { const kand = `${j + k}-${zwei(mm)}-${zwei(tt)}`; if (istTag(kand) && kand >= heute) wahl = kand; }
    if (!wahl) { datumUngueltig = ganz.trim(); return ganz; }
    dueDate = wahl; return ' ';
  });
  return {
    title: s.replace(/\s+/g, ' ').trim(), priority, dueDate, projectId, ...(zustaendig ? { zustaendig } : {}), beteiligte, alleBeteiligt, zustaendigGetippt,
    ...(datumUngueltig ? { datumUngueltig } : {}), ...(ziel ? { ziel } : {}), ...(zielUnbekannt ? { zielUnbekannt } : {}),
  };
}

/**
 * Wer ist verantwortlich, wer beteiligt? Eine Verantwortliche (29.09.): die erste getippte Person, sonst ich.
 * „@beide“/„@alle“ → alle anderen `personen` beteiligt. `nurIch` → nur ich, keine Beteiligten (Server-Regel T1).
 */
export function schnellZustaendigkeit(p: Pick<SchnellErgebnis, 'zustaendig' | 'beteiligte' | 'alleBeteiligt'>, ich: string, personen: readonly string[], nurIch = false): { assignee: string; beteiligte?: string[] } {
  if (nurIch) return { assignee: ich };
  const assignee = p.zustaendig ?? ich;
  const beteiligte = Array.from(new Set((p.alleBeteiligt ? personen : p.beteiligte).filter(x => x && x !== assignee)));
  return beteiligte.length ? { assignee, beteiligte } : { assignee };
}

const PRIO_TEXT: Record<Priority, string> = { critical: 'kritisch', high: 'hoch', medium: '', low: 'niedrig' };

/** Was vor dem Speichern angezeigt wird: „Fr 02.10. · kritisch · @malin · #Projekt“ (leer, wenn nichts erkannt). */
export function schnellVorschau(p: SchnellErgebnis, projekte: { id: string; title: string }[], namen: Record<string, string> = {}): string[] {
  const teile: string[] = [];
  if (p.dueDate) teile.push(kurzTag(p.dueDate));
  if (PRIO_TEXT[p.priority]) teile.push(PRIO_TEXT[p.priority]);
  if (p.zustaendig) teile.push(`@${namen[p.zustaendig] ?? p.zustaendig}`);
  for (const b of p.beteiligte) teile.push(`+${namen[b] ?? b}`);
  if (p.alleBeteiligt) teile.push('+ alle beteiligt');
  if (p.projectId) teile.push(`#${projekte.find(x => x.id === p.projectId)?.title ?? p.projectId}`);
  if (p.ziel) teile.push(`in ${p.ziel.projektTitel} › ${p.ziel.listeTitel}`);
  return teile;
}
