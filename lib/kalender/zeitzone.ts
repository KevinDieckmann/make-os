// ─── Kalender — Zeitzonen (rein, getestet, 29.09., K1) ──────────────────────
// Kevin 29.09.: Zeitzone wie Google („GMT+02“ neben der Uhrzeit, andere Zone
// wählbar). Intern bleibt ALLES Berliner Wandzeit (lib/kalender/zeit.ts) — eine
// andere Zone betrifft nur das Anlegen (Eingabe in jener Zone, gespeichert mit
// TZID + VTIMEZONE) und die Anzeige („10:00 New York · GMT-04“).
// Die VTIMEZONE bauen wir aus den Zonendaten der Laufzeit (Intl): Übergänge eines
// Jahres suchen, als Jahresregel (n-ter/letzter Wochentag im Monat) schreiben —
// passt die Regel im Folgejahr nicht, feste Übergänge für zwölf Jahre.

export const STANDARD_ZONE = 'Europe/Berlin';

/** Die Auswahl im Dialog — jede andere gültige IANA-Zone nimmt die Route auch. */
export const ZONEN: readonly { id: string; label: string }[] = [
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Lisbon', label: 'Lissabon' },
  { id: 'Europe/Helsinki', label: 'Helsinki' },
  { id: 'Europe/Istanbul', label: 'Istanbul' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Kolkata', label: 'Indien' },
  { id: 'Asia/Singapore', label: 'Singapur' },
  { id: 'Asia/Tokyo', label: 'Tokio' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'America/Sao_Paulo', label: 'São Paulo' },
  { id: 'UTC', label: 'UTC' },
];

const formate = new Map<string, Intl.DateTimeFormat>();
function format(zone: string): Intl.DateTimeFormat {
  let f = formate.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    formate.set(zone, f);
  }
  return f;
}

/** Gültige IANA-Zone (die die Laufzeit kennt)? */
export function zoneGueltig(v: unknown): v is string {
  if (typeof v !== 'string' || !/^(UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/.test(v) || v.length > 40) return false;
  try { format(v); return true; } catch { return false; }
}

function teile(d: Date, zone: string): Record<string, number> {
  const t: Record<string, number> = {};
  for (const p of format(zone).formatToParts(d)) if (p.type !== 'literal') t[p.type] = Number(p.value);
  return t;
}
const zwei = (n: number) => String(Math.abs(n)).padStart(2, '0');

/** Abstand Zone − UTC in Minuten zu einem Zeitpunkt. */
export function versatzMin(zone: string, d: Date): number {
  const t = teile(d, zone);
  return Math.round((Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
}

/** „GMT+02“, „GMT-04“, „GMT+05:30“, „GMT+00“ — wie Google neben der Uhrzeit. */
export function gmtText(zone: string, d: Date): string {
  const v = versatzMin(zone, d);
  const h = Math.floor(Math.abs(v) / 60), m = Math.abs(v) % 60;
  return `GMT${v < 0 ? '-' : '+'}${zwei(h)}${m ? `:${zwei(m)}` : ''}`;
}

/** Ein Zeitpunkt als Wandzeit „YYYY-MM-DDTHH:mm:ss“ in einer Zone. */
export function wandzeitIn(d: Date, zone: string): string {
  const t = teile(d, zone);
  return `${t.year}-${zwei(t.month)}-${zwei(t.day)}T${zwei(t.hour)}:${zwei(t.minute)}:${zwei(t.second)}`;
}

/** Wandzeit in einer Zone → Zeitpunkt (zweimal ansetzen wegen der Umstellung; eine fehlende Stunde landet später). */
export function ausWandzeitIn(wand: string, zone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(wand);
  if (!m) throw new Error(`Keine Wandzeit: ${wand}`);
  const alsUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  let t = alsUtc - versatzMin(zone, new Date(alsUtc)) * 60_000;
  t = alsUtc - versatzMin(zone, new Date(t)) * 60_000;
  return new Date(t);
}

// ── VTIMEZONE ───────────────────────────────────────────────────────────────

interface Uebergang { zeit: number; von: number; nach: number }

/** Alle Versatz-Wechsel eines Jahres (UTC-Zeitpunkte, minutengenau). */
function uebergaenge(zone: string, jahr: number): Uebergang[] {
  const raus: Uebergang[] = [];
  let t = Date.UTC(jahr, 0, 1);
  const ende = Date.UTC(jahr + 1, 0, 1);
  let v = versatzMin(zone, new Date(t));
  const schritt = 6 * 3600_000;
  while (t < ende) {
    const n = Math.min(ende, t + schritt);
    const vn = versatzMin(zone, new Date(n));
    if (vn !== v) {
      let lo = t, hi = n;
      while (hi - lo > 60_000) { const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000; if (versatzMin(zone, new Date(mid)) === v) lo = mid; else hi = mid; }
      raus.push({ zeit: hi, von: v, nach: vn });
      v = vn;
    }
    t = n;
  }
  return raus;
}

const offsetText = (min: number) => `${min < 0 ? '-' : '+'}${zwei(Math.floor(Math.abs(min) / 60))}${zwei(Math.abs(min) % 60)}`;
/** Lokale Wandzeit (im alten Versatz) als iCalendar-Datum-Zeit ohne Zone. */
const lokal = (u: Uebergang) => { const d = new Date(u.zeit + u.von * 60_000); return `${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}T${zwei(d.getUTCHours())}${zwei(d.getUTCMinutes())}00`; };
const TAGE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Regel „n-ter/letzter Wochentag im Monat“ eines Übergangs. */
function regel(u: Uebergang): { monat: number; byday: string; stunde: string } {
  const d = new Date(u.zeit + u.von * 60_000);
  const tag = d.getUTCDate(), monat = d.getUTCMonth() + 1;
  const imMonat = new Date(Date.UTC(d.getUTCFullYear(), monat, 0)).getUTCDate();
  const nr = tag + 7 > imMonat ? -1 : Math.ceil(tag / 7);
  return { monat, byday: `${nr}${TAGE[d.getUTCDay()]}`, stunde: lokal(u).slice(9) };
}
/** Der Tag im Jahr, den eine Regel trifft (für den Gegencheck und DTSTART 1970). */
function regelTag(jahr: number, monat: number, byday: string): number {
  const nr = Number(byday.slice(0, -2)), wt = TAGE.indexOf(byday.slice(-2));
  if (nr === -1) { const letzter = new Date(Date.UTC(jahr, monat, 0)); return letzter.getUTCDate() - ((letzter.getUTCDay() - wt + 7) % 7); }
  const erster = new Date(Date.UTC(jahr, monat - 1, 1)).getUTCDay();
  return 1 + ((wt - erster + 7) % 7) + (nr - 1) * 7;
}

function beobachtung(art: 'STANDARD' | 'DAYLIGHT', von: number, nach: number, dtstart: string, rrule?: string): string {
  return [`BEGIN:${art}`, `TZOFFSETFROM:${offsetText(von)}`, `TZOFFSETTO:${offsetText(nach)}`, `DTSTART:${dtstart}`, ...(rrule ? [`RRULE:${rrule}`] : []), `END:${art}`].join('\r\n');
}

/**
 * VTIMEZONE-Text einer Zone, gültig um `jahr` herum. Ohne Umstellung: eine STANDARD-Beobachtung.
 * Sonst die Jahresregeln — oder, wenn die Regel im Folgejahr nicht stimmt, feste Übergänge jahr-1 … jahr+10.
 */
export function vtimezoneText(zone: string, jahr: number): string {
  const ue = uebergaenge(zone, jahr);
  const kopf = ['BEGIN:VTIMEZONE', `TZID:${zone}`];
  if (!ue.length) {
    const v = versatzMin(zone, new Date(Date.UTC(jahr, 0, 1)));
    return [...kopf, beobachtung('STANDARD', v, v, '19700101T000000'), 'END:VTIMEZONE'].join('\r\n');
  }
  const art = (u: Uebergang): 'STANDARD' | 'DAYLIGHT' => (u.nach > u.von ? 'DAYLIGHT' : 'STANDARD');
  const regeln = ue.map(u => ({ u, r: regel(u) }));
  const folge = uebergaenge(zone, jahr + 1);
  const passt = folge.length === ue.length && regeln.every(({ r }, i) => {
    const d = new Date(folge[i].zeit + folge[i].von * 60_000);
    return d.getUTCMonth() + 1 === r.monat && d.getUTCDate() === regelTag(jahr + 1, r.monat, r.byday);
  });
  if (passt) {
    const teile = regeln.map(({ u, r }) => beobachtung(art(u), u.von, u.nach, `1970${zwei(r.monat)}${zwei(regelTag(1970, r.monat, r.byday))}T${r.stunde}`, `FREQ=YEARLY;BYMONTH=${r.monat};BYDAY=${r.byday}`));
    return [...kopf, ...teile, 'END:VTIMEZONE'].join('\r\n');
  }
  const alle: Uebergang[] = [];
  for (let j = jahr - 1; j <= jahr + 10; j++) alle.push(...uebergaenge(zone, j));
  return [...kopf, ...alle.map(u => beobachtung(art(u), u.von, u.nach, lokal(u))), 'END:VTIMEZONE'].join('\r\n');
}
