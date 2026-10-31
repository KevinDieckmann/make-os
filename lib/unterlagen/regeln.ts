// ─── Unterlagen per E-Mail anfordern — die Regeln (31.10., rein, getestet) ───────────────────────────────────────────────────────────
// Kevin 31.10.: „bei den großen sachen müssen sie nachher ihre email abgeben wenn Sie das ganze bekommen möchten. Die kleinen Sachen sind Okay
// aber die größeren brauchen eine e-mail damit wir denen das ganze zuschicken können.“ Große Vorlagen der Website (ab ~7 Seiten) stehen dort nur als
// Vorschau; die Datei kommt per Mail: Formular auf der statischen Seite → POST /api/unterlage → Mail mit je Datei einem Download-Link (7 Tage) →
// GET /api/unterlage/laden?t=…&d=pdf|xlsx. Hier stehen nur die reinen Teile: Katalog (`unterlagen/katalog.json`) prüfen, Dateinamen, der
// Datenschutzhinweis, der Text der Mail und die Antwort an den Gast. Server: lib/unterlagen/server.ts. Keine Namen, keine Marke im Code.
// Hinweis, keine Rechtsberatung — Hinweis und Mail einmal anwaltlich gegenlesen.

/** Der Download-Link gilt so viele Tage (danach neu anfordern). */
export const LINK_TAGE = 7;
/** Kennung einer Unterlage (= Ordnername der Seite auf der Website). */
export const UNTERLAGE_ID_OK = /^[a-z0-9-]{1,60}$/;
/** Name der Datei im Ordner `unterlagen/` — nur ASCII, keine Pfadteile, Endung passt zur Art. */
export const DATEI_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;
export const ARTEN = ['pdf', 'xlsx'] as const;
export type UnterlageArt = typeof ARTEN[number];
export const ART_NAME: Readonly<Record<UnterlageArt, string>> = { pdf: 'PDF', xlsx: 'Excel' };
export const INHALTSTYP: Readonly<Record<UnterlageArt, string>> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
/** Höchstens so viele Dateien je Unterlage und so groß je Datei (darüber liefert der Server nichts aus — nie gekürzt). */
export const DATEIEN_MAX = 4;
export const DATEI_BYTES_MAX = 30 * 1024 * 1024;

export interface UnterlageDatei { art: UnterlageArt; datei: string; name: string }
export interface Unterlage { id: string; titel: string; seite: string; dateien: UnterlageDatei[] }

/** Ist ein Dateiname im Ordner sicher (keine Pfadteile, keine Punkte-Folge, Endung = Art)? Rein. */
export function dateiOk(datei: unknown, art: UnterlageArt): datei is string {
  return typeof datei === 'string' && DATEI_OK.test(datei) && !datei.includes('..') && datei.toLowerCase().endsWith(`.${art}`);
}

/** Name der Datei beim Herunterladen: eine Zeile, ohne Steuerzeichen, Anführungszeichen und Schrägstriche; Endung = Art. Rein. */
export function downloadName(name: unknown, art: UnterlageArt, ersatz: string): string {
  const roh = typeof name === 'string' ? name.normalize('NFC').replace(/[\u0000-\u001f\u007f"\\/<>:*?|]/g, '').replace(/\s+/g, ' ').trim() : '';
  const n = roh && roh.length <= 150 ? roh : ersatz;
  return n.toLowerCase().endsWith(`.${art}`) ? n : `${n}.${art}`;
}

/** `Content-Disposition` für einen Download mit Umlauten (RFC 6266/5987): ASCII-Ersatz plus `filename*`. Rein. */
export function anhangKopf(name: string): string {
  const ascii = name.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** Ein Pfad der Website (`/…`, kein `//`, keine Leerzeichen/Anführungszeichen). Rein. */
const seiteOk = (x: unknown): x is string => typeof x === 'string' && x.length <= 200 && x.startsWith('/') && !x.startsWith('//') && !/[\s<>"'\\]/.test(x);

/**
 * Den Katalog prüfen (rein): nur gültige Einträge kommen durch, für jeden verworfenen ein Satz in `fehler` (fürs Log — der Generator der Website
 * schreibt die Datei, ein Fehler dort soll auffallen, nicht still verschwinden). Doppelte Kennungen: der erste Eintrag gilt.
 */
export function katalogPruefen(roh: unknown): { unterlagen: Unterlage[]; fehler: string[] } {
  const fehler: string[] = [];
  const liste = roh && typeof roh === 'object' && Array.isArray((roh as { unterlagen?: unknown }).unterlagen) ? (roh as { unterlagen: unknown[] }).unterlagen : null;
  if (!liste) return { unterlagen: [], fehler: roh === null || roh === undefined ? [] : ['katalog.json: „unterlagen“ ist keine Liste.'] };
  const aus: Unterlage[] = [];
  liste.forEach((x, i) => {
    const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const wo = `Eintrag ${i + 1}${typeof e.id === 'string' ? ` (${e.id.slice(0, 60)})` : ''}`;
    if (typeof e.id !== 'string' || !UNTERLAGE_ID_OK.test(e.id)) { fehler.push(`${wo}: Kennung fehlt oder ist ungültig ([a-z0-9-]{1,60}).`); return; }
    if (aus.some(u => u.id === e.id)) { fehler.push(`${wo}: Kennung doppelt — der erste Eintrag gilt.`); return; }
    const titel = typeof e.titel === 'string' ? e.titel.replace(/\s+/g, ' ').trim() : '';
    if (!titel || titel.length > 200 || /[<>{}]/.test(titel)) { fehler.push(`${wo}: Titel fehlt oder ist ungültig.`); return; }
    if (!seiteOk(e.seite)) { fehler.push(`${wo}: Seite muss ein Pfad der Website sein (/…).`); return; }
    const dateien = Array.isArray(e.dateien) ? e.dateien : [];
    if (!dateien.length || dateien.length > DATEIEN_MAX) { fehler.push(`${wo}: 1 bis ${DATEIEN_MAX} Dateien.`); return; }
    const ds: UnterlageDatei[] = [];
    for (const d0 of dateien) {
      const d = (d0 && typeof d0 === 'object' ? d0 : {}) as Record<string, unknown>;
      const art = ARTEN.find(a => a === d.art);
      if (!art) { fehler.push(`${wo}: Art einer Datei muss pdf oder xlsx sein.`); return; }
      if (ds.some(y => y.art === art)) { fehler.push(`${wo}: je Art höchstens eine Datei.`); return; }
      if (!dateiOk(d.datei, art)) { fehler.push(`${wo}: Dateiname ungültig (nur A–Z, 0–9, . _ -, keine Pfade, Endung .${art}).`); return; }
      ds.push({ art, datei: d.datei, name: downloadName(d.name, art, d.datei) });
    }
    aus.push({ id: e.id, titel, seite: e.seite, dateien: ds });
  });
  return { unterlagen: aus, fehler };
}

// ── Texte an den Gast (immer dieselben, egal was im Hintergrund geschieht) ──────────────────────────────────────────────────────

/** Die eine Antwort auf jede angenommene Anforderung — bekannt, unbekannt, gesperrt oder über der Grenze sind nicht zu unterscheiden. */
export const ANFORDERUNG_TEXT = `Danke! Wir schicken Ihnen die Unterlage gerade per E-Mail. Die Links darin gelten ${LINK_TAGE} Tage. Kommt nichts an, schauen Sie bitte auch im Spam-Ordner nach.`;
export const NICHT_DA_TEXT = 'Diese Unterlage gibt es hier gerade nicht per E-Mail.';

/** Der Datenschutzhinweis unter dem Formular (Art. 13). Verantwortlicher NIE fest im Code — aus den Einstellungen bzw. der Einrichtung. */
export function unterlageHinweis(verantwortlich: string, link: string | null): string[] {
  return [
    `Verantwortlich: ${verantwortlich}.`,
    `Wofür: Wir schicken Ihnen die angeforderte Unterlage an Ihre E-Mail-Adresse (die Links gelten ${LINK_TAGE} Tage) und legen Ihre Anfrage in unserem Kundensystem an, damit wir Ihnen bei Fragen weiterhelfen können (Art. 6 Abs. 1 lit. b DSGVO).`,
    'Was wir speichern: Ihren Vornamen, Ihre E-Mail-Adresse, Ihre Firma (falls angegeben), welche Unterlage Sie angefordert haben und wann.',
    'Speicherdauer: Ihre Anfrage bleibt in unserem Kundensystem, solange wir in Kontakt sind; ohne weiteren Kontakt prüfen wir sie spätestens nach 24 Monaten. Den Newsletter bekommen Sie nur, wenn Sie ihn ankreuzen und die Anmeldung bestätigen.',
    `Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch${link ? ` — mehr in der Datenschutzerklärung (${link})` : ''}.`,
  ];
}

export interface UnterlageMailWerte {
  marke: string;
  vorname?: string;
  titel: string;
  /** Je Datei der Name und der Download-Link. */
  links: { name: string; art: UnterlageArt; link: string }[];
  /** Seite der Unterlage auf der Website (zum neu Anfordern). */
  seite: string;
  verantwortlich: string;
  datenschutzLink: string | null;
}

/**
 * Die Mail mit den Download-Links — fester Text, keine Werbung (Anrede, Titel, Links, Gültigkeit, „wenn Sie das nicht waren“, Absender, Datenschutz).
 * Der Text kommt nur von hier; der Aufrufer setzt nur die Werte der Instanz, den geprüften Vornamen und die Links.
 */
export function unterlageMail(w: UnterlageMailWerte): { betreff: string; text: string } {
  return {
    betreff: `Ihre Unterlage: ${w.titel} — ${w.marke}`,
    text: [
      w.vorname ? `Guten Tag ${w.vorname},` : 'Guten Tag,',
      '',
      `hier ist die Unterlage, die Sie auf unserer Website angefordert haben: ${w.titel}.`,
      '',
      ...w.links.flatMap(l => [`${l.name} (${ART_NAME[l.art]}):`, l.link, '']),
      `Die Links gelten ${LINK_TAGE} Tage. Danach fordern Sie die Unterlage einfach neu an: ${w.seite}`,
      '',
      'Viele Grüße',
      w.marke,
      '',
      '—',
      `Absender: ${w.marke} · Verantwortlich: ${w.verantwortlich}`,
      `Datenschutz: Wir nutzen Ihre Angaben, um Ihnen die Unterlage zu schicken, und haben Ihre Anfrage in unserem Kundensystem angelegt (Art. 6 Abs. 1 lit. b DSGVO). `
        + `Den Newsletter bekommen Sie nur, wenn Sie ihn angekreuzt und bestätigt haben.${w.datenschutzLink ? ` Mehr: ${w.datenschutzLink}` : ''}`,
      'Sie haben die Unterlage nicht angefordert? Dann ignorieren Sie diese Mail und schreiben Sie uns kurz — wir löschen Ihre Angaben.',
    ].join('\n'),
  };
}

/** Kleine Seite, wenn ein Link nicht (mehr) gilt — ohne Skript, ohne fremde Quellen, Texte maskiert. Rein. */
export function linkSeite(o: { abgelaufen: boolean; seite: string | null }): string {
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const satz = o.abgelaufen ? 'Der Link ist abgelaufen' : 'Dieser Link ist nicht gültig';
  const weiter = o.seite ? `Fordern Sie die Vorlage einfach neu an: <a href="${esc(o.seite)}">${esc(o.seite)}</a>` : 'Fordern Sie die Vorlage einfach auf der Website neu an.';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(satz)}</title>`
    + '<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:48px 16px}main{max-width:560px;margin:0 auto}h1{font-size:20px}</style>'
    + `</head><body><main><h1>${esc(satz)}</h1><p>${weiter}</p></main></body></html>`;
}
