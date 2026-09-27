// ─── Kalender: Schnelleingabe (rein, getestet, 27.09.) ───────────────────────
// Wie in Google Kalender: ein Satz statt fünf Felder. „Mo 10 Uhr Kaffee mit
// Frank 45min“, „morgen 14:30-16 Steuerberater“, „3.10. Geburtstag Oma ganztags“,
// „Fr 9 Uhr Power Hour jede Woche“. Was erkannt wird: Tag (heute/morgen/
// übermorgen, Wochentag, TT.MM.[JJJJ]), Uhrzeit (9, 9:30, 9.30 Uhr, 14-16),
// Dauer (30min, 1h, 1,5h), ganztags, Wiederholung (täglich, jede Woche,
// wöchentlich, monatlich, jährlich), Person (@kevin/@malin/@beide), Ort („in
// Berlin“ am Ende). Der Rest ist der Titel. Nichts wird geraten: fehlt die
// Uhrzeit, gilt die Vorgabe (9:00, Standarddauer).

export interface Schnell {
  titel: string;
  tag: string;            // YYYY-MM-DD
  von?: string;           // HH:mm — fehlt bei ganztags
  bis?: string;
  ganztags: boolean;
  dauerMin?: number;
  wer?: 'kevin' | 'malin' | 'beide';
  ort?: string;
  wiederholung?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  /** Was der Parser erkannt hat — für die Anzeige „verstanden als …“. */
  erkannt: string[];
}

const WOCHENTAGE: Record<string, number> = { so: 0, sonntag: 0, mo: 1, montag: 1, di: 2, dienstag: 2, mi: 3, mittwoch: 3, do: 4, donnerstag: 4, fr: 5, freitag: 5, sa: 6, samstag: 6 };
const zwei = (n: number) => String(n).padStart(2, '0');
const tagText = (d: Date) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const plusTage = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00`); d.setDate(d.getDate() + n); return tagText(d); };
const zeitText = (h: number, m: number) => `${zwei(h)}:${zwei(m)}`;
const plusMin = (hhmm: string, min: number) => { const [h, m] = hhmm.split(':').map(Number); const g = Math.min(24 * 60, h * 60 + m + min); return zeitText(Math.floor(g / 60) % 24 || (g === 1440 ? 24 : 0), g % 60); };

/** Einen Satz zerlegen. `heute` als YYYY-MM-DD (Berliner Tag), `standardDauer` in Minuten. */
export function schnellLesen(eingabe: string, heute: string, standardDauer = 60): Schnell {
  let rest = ` ${eingabe.trim().replace(/\s+/g, ' ')} `;
  const erkannt: string[] = [];
  const nimm = (re: RegExp, was: (m: RegExpMatchArray) => void) => { const m = rest.match(re); if (m) { was(m); rest = rest.replace(m[0], ' '); } };
  const out: Schnell = { titel: '', tag: heute, ganztags: false, erkannt };

  // Person
  nimm(/\s@(kevin|malin|beide|gemeinsam)\b/i, m => { out.wer = m[1].toLowerCase() === 'gemeinsam' ? 'beide' : (m[1].toLowerCase() as Schnell['wer']); erkannt.push(`für ${out.wer}`); });
  // Wiederholung
  nimm(/\s(täglich|jeden tag|jede woche|wöchentlich|jeden monat|monatlich|jedes jahr|jährlich)\b/i, m => {
    const w = m[1].toLowerCase();
    out.wiederholung = /täglich|jeden tag/.test(w) ? 'DAILY' : /woche|wöchentlich/.test(w) ? 'WEEKLY' : /monat/.test(w) ? 'MONTHLY' : 'YEARLY';
    erkannt.push({ DAILY: 'täglich', WEEKLY: 'jede Woche', MONTHLY: 'monatlich', YEARLY: 'jährlich' }[out.wiederholung]);
  });
  // ganztags
  nimm(/\s(ganztags|ganztägig|den ganzen tag)\b/i, () => { out.ganztags = true; erkannt.push('ganztägig'); });
  // Datum TT.MM.[JJJJ]
  nimm(/\s(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?=\s)/, m => {
    const j = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(heute.slice(0, 4));
    let tag = `${j}-${zwei(Number(m[2]))}-${zwei(Number(m[1]))}`;
    if (!m[3] && tag < heute) tag = `${j + 1}-${zwei(Number(m[2]))}-${zwei(Number(m[1]))}`; // ohne Jahr: nächstes Vorkommen
    out.tag = tag; erkannt.push(`am ${Number(m[1])}.${Number(m[2])}.${j}`);
  });
  // heute / morgen / übermorgen / Wochentag (nächster)
  nimm(/\s(heute|morgen|übermorgen)\b/i, m => { const w = m[1].toLowerCase(); out.tag = plusTage(heute, w === 'heute' ? 0 : w === 'morgen' ? 1 : 2); erkannt.push(w); });
  nimm(/\s(?:am\s|nächsten\s|nächste\s)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so)\b(?!\.)/i, m => {
    const ziel = WOCHENTAGE[m[1].toLowerCase()]; const d = new Date(`${heute}T12:00:00`);
    let diff = (ziel - d.getDay() + 7) % 7; if (diff === 0 && /nächst/i.test(m[0])) diff = 7;
    out.tag = plusTage(heute, diff); erkannt.push(['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][ziel]);
  });
  // Zeitspanne 14-16, 14:30-16:00, 9 bis 10 Uhr
  nimm(/\s(?:um\s|ab\s|von\s)?(\d{1,2})(?:[:.](\d{2}))?\s?(?:-|–|bis)\s?(\d{1,2})(?:[:.](\d{2}))?\s?(?:uhr)?(?=\s)/i, m => {
    out.von = zeitText(Number(m[1]), Number(m[2] ?? 0)); out.bis = zeitText(Number(m[3]), Number(m[4] ?? 0)); erkannt.push(`${out.von}–${out.bis}`);
  });
  // Einzelzeit 9 Uhr, 9:30, 14.30 Uhr, um 9
  if (!out.von) nimm(/\s(?:um\s|ab\s)?(\d{1,2})(?:[:.](\d{2}))?\s?uhr(?=\s)|\s(?:um\s|ab\s)(\d{1,2})(?:[:.](\d{2}))?(?=\s)|\s(\d{1,2}):(\d{2})(?=\s)/i, m => {
    const h = Number(m[1] ?? m[3] ?? m[5]); const mi = Number(m[2] ?? m[4] ?? m[6] ?? 0);
    if (h <= 24 && mi < 60) { out.von = zeitText(h, mi); erkannt.push(`${out.von} Uhr`); }
  });
  // Dauer
  nimm(/\s(\d+(?:[,.]\d+)?)\s?(min|minuten|h|std|stunden)\b/i, m => {
    const z = Number(m[1].replace(',', '.')); const min = /^(min|minuten)$/i.test(m[2]) ? z : z * 60;
    out.dauerMin = Math.max(5, Math.min(24 * 60, Math.round(min / 5) * 5)); erkannt.push(`${out.dauerMin} Minuten`);
  });
  // Ort: „… in Berlin“ / „… bei Frank“ am Ende (nur, wenn danach nichts mehr kommt)
  nimm(/\s(?:in|bei)\s([A-ZÄÖÜ][^\s]*(?:\s[A-ZÄÖÜ0-9][^\s]*){0,3})\s*$/, m => { out.ort = m[1].trim(); erkannt.push(`in ${out.ort}`); });

  out.titel = rest.replace(/\s+/g, ' ').replace(/^[\s,:\-–]+|[\s,:\-–]+$/g, '').trim();
  if (!out.ganztags) {
    if (!out.von) out.von = '09:00';
    if (!out.bis) out.bis = plusMin(out.von, out.dauerMin ?? standardDauer);
    if (out.bis <= out.von) out.bis = plusMin(out.von, standardDauer);
  } else { delete out.von; delete out.bis; }
  return out;
}
