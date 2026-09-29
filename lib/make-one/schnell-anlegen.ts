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
}

/** Eine Person mit Konto für „@Name“ — aus dem Team (`usePersonen`: Vorname, Kurzname, Speichername). */
export interface SchnellPerson { speicher: string; namen: readonly string[] }
/** Rückfall, solange das Team nicht geladen ist — dieselben Speichernamen wie `usePersonen` (Regel 11: keine Namen im Code). */
const STANDARD_PERSONEN: readonly SchnellPerson[] = [{ speicher: 'kevin', namen: ['kevin'] }, { speicher: 'malin', namen: ['malin'] }];
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

/** Schnell-Anlegen mit Kürzeln: !! kritisch · ! hoch · heute/morgen/übermorgen · [am|bis] mo–so · freitag · TT.MM.[JJJJ] · #projekt · @Name/@beide */
export function parseSchnell(rein: string, projekte: { id: string; title: string }[], heute: string = localDay(), personen: readonly SchnellPerson[] = STANDARD_PERSONEN): SchnellErgebnis {
  let s = ` ${rein.trim()} `;
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
  s = s.replace(/\s#(\S+)/, (_, w) => {
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
  return { title: s.replace(/\s+/g, ' ').trim(), priority, dueDate, projectId, ...(zustaendig ? { zustaendig } : {}), beteiligte, alleBeteiligt, zustaendigGetippt, ...(datumUngueltig ? { datumUngueltig } : {}) };
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
  return teile;
}
