// ─── Postfächer — eine Rohnachricht (RFC 5322/MIME) lesen (rein, 06.10.2026) ──────────────────────────────────────
// IMAP liefert die Nachricht als Bytes. Statt einen zweiten MIME-Leser zu bauen, wird sie hier in DENSELBEN Nachrichtenbaum übersetzt,
// den Gmail liefert (`GPart`: Kopfzeilen + Körper als base64url, Transfer-Encoding schon aufgelöst) — danach liest `nachrichtAus`
// (lib/gmail/mime.ts) Kopf, Text und Anhänge genau wie bei Gmail: Zeichensätze (auch Windows-1252), RFC 2047, HTML nur als Text
// (lib/gmail/html.ts — Skripte/Bilder nie), Rundschreiben-Erkennung. EIN Leser, EINE Regel für alle Quellen.
// Teil-Kennungen folgen der IMAP-Zählung (`1`, `1.2` …) — damit holt der Anhang-Abruf genau diesen Teil (`BODY[1.2]`).
// Fremde Bytes sind Daten: nichts hier wirft bei kaputten Nachrichten (leere Teile statt Fehler), nichts lädt etwas nach.

import { createHash } from 'node:crypto';
import { bytesBase64url, quotedPrintableLesen, type GMessage, type GPart } from '@/lib/gmail/mime';
import type { Anhang } from '@/lib/gmail/typen';

const MAX_TIEFE = 8;
const MAX_TEILE = 200;

/** Bytes → Text: gültiges UTF-8 bleibt UTF-8, sonst Latin-1 (Kopfzeilen mit 8-Bit-Zeichen). */
function kopfText(b: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return b.toString('latin1'); }
}

/** Kopf und Körper an der ersten Leerzeile trennen (CRLF oder LF). */
function trennen(b: Buffer): { kopf: Buffer; koerper: Buffer } {
  const crlf = b.indexOf('\r\n\r\n');
  const lf = b.indexOf('\n\n');
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) return { kopf: b.subarray(0, crlf), koerper: b.subarray(crlf + 4) };
  if (lf >= 0) return { kopf: b.subarray(0, lf), koerper: b.subarray(lf + 2) };
  return { kopf: b, koerper: Buffer.alloc(0) };
}

/** Kopfzeilen entfalten → Liste in Originalreihenfolge. */
export function kopfzeilen(roh: Buffer): { name: string; value: string }[] {
  const text = kopfText(roh).replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ');
  const raus: { name: string; value: string }[] = [];
  for (const z of text.split('\n')) {
    const i = z.indexOf(':');
    if (i <= 0 || i > 76) continue;
    const name = z.slice(0, i).trim();
    if (!/^[\x21-\x39\x3b-\x7e]+$/.test(name)) continue;
    raus.push({ name, value: z.slice(i + 1).trim() });
    if (raus.length >= 400) break;
  }
  return raus;
}

const wert = (h: { name: string; value: string }[], n: string) => h.find(x => x.name.toLowerCase() === n)?.value;

/** Parameter einer Kopfzeile (`name="x"`, RFC 2231 `name*=UTF-8''%C3%A4`, Fortsetzungen `name*0=`). Rein. */
export function parameter(v: string | undefined, name: string): string | undefined {
  if (!v) return undefined;
  const teile = new Map<string, string>();
  const re = /;\s*([A-Za-z0-9_.*-]+)\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) teile.set(m[1].toLowerCase(), m[3] !== undefined ? m[3].replace(/\\(.)/g, '$1') : m[2].trim());
  const n = name.toLowerCase();
  if (teile.has(n)) return teile.get(n);
  const kodiert = (s: string) => {
    const x = /^([^']*)'[^']*'(.*)$/.exec(s);
    const satz = (x?.[1] || 'utf-8').toLowerCase();
    const roh = x ? x[2] : s;
    try {
      const bytes = Buffer.from(roh.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
      return satz === 'utf-8' || satz === 'utf8' ? bytes.toString('utf8') : bytes.toString('latin1');
    } catch { return roh; }
  };
  if (teile.has(`${n}*`)) return kodiert(teile.get(`${n}*`)!);
  // Fortsetzungen: name*0, name*1 … bzw. name*0*, name*1* (kodiert)
  const stuecke: string[] = [];
  let k = false;
  for (let i = 0; i < 50; i++) {
    if (teile.has(`${n}*${i}*`)) { stuecke.push(teile.get(`${n}*${i}*`)!); k = true; } else if (teile.has(`${n}*${i}`)) stuecke.push(teile.get(`${n}*${i}`)!); else break;
  }
  if (stuecke.length) return k ? kodiert(stuecke.join('')) : stuecke.join('');
  return undefined;
}

/** Körper eines Blatts vom Transfer-Encoding befreien. */
function entkodieren(b: Buffer, cte: string | undefined): Buffer {
  const c = (cte ?? '7bit').trim().toLowerCase();
  if (c === 'base64') return Buffer.from(b.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (c === 'quoted-printable') return quotedPrintableLesen(b.toString('latin1'));
  return b;
}

/** Multipart-Körper an der Grenze aufteilen (Präambel und Epilog fallen weg). */
function aufteilen(b: Buffer, grenze: string): Buffer[] {
  const marke = Buffer.from(`--${grenze}`, 'latin1');
  const teile: Buffer[] = [];
  let pos = b.indexOf(marke);
  while (pos >= 0 && teile.length < MAX_TEILE) {
    let start = pos + marke.length;
    if (b[start] === 0x2d && b[start + 1] === 0x2d) break; // --grenze-- = Ende
    while (b[start] === 0x20 || b[start] === 0x09) start++;
    if (b[start] === 0x0d) start++;
    if (b[start] === 0x0a) start++;
    const naechste = b.indexOf(marke, start);
    let ende = naechste >= 0 ? naechste : b.length;
    if (b[ende - 1] === 0x0a) ende--;
    if (b[ende - 1] === 0x0d) ende--;
    teile.push(b.subarray(start, Math.max(start, ende)));
    pos = naechste;
  }
  return teile;
}

function teilLesen(b: Buffer, partId: string, tiefe: number): GPart {
  const { kopf, koerper } = trennen(b);
  const headers = kopfzeilen(kopf);
  const ct = wert(headers, 'content-type') ?? 'text/plain; charset=us-ascii';
  const mimeType = (ct.split(';')[0] ?? '').trim().toLowerCase() || 'text/plain';
  const dispo = wert(headers, 'content-disposition');
  const filename = parameter(dispo, 'filename') ?? parameter(ct, 'name') ?? '';
  if (mimeType.startsWith('multipart/') && tiefe < MAX_TIEFE) {
    const grenze = parameter(ct, 'boundary');
    const kinder = grenze ? aufteilen(koerper, grenze) : [];
    // IMAP-Zählung: die Kinder eines Multipart an der Wurzel heißen 1, 2 …; tiefer `<eltern>.<n>`.
    return { partId, mimeType, filename: '', headers, body: { size: 0 }, parts: kinder.map((k, i) => teilLesen(k, partId ? `${partId}.${i + 1}` : String(i + 1), tiefe + 1)) };
  }
  const daten = entkodieren(koerper, wert(headers, 'content-transfer-encoding'));
  return { partId: partId || '1', mimeType, filename, headers, body: { size: daten.length, data: bytesBase64url(daten) } };
}

/**
 * Rohnachricht → Nachrichtenbaum im Gmail-Format (für `nachrichtAus`). `id`/`threadId` vergibt der Aufrufer (IMAP: Postfach + UID),
 * `internalDate` ist die Eingangszeit des Servers (ms), `labels` die abgeleiteten Zustände (INBOX/SENT/UNREAD …).
 */
export function rohZuNachricht(roh: Buffer, o: { id: string; threadId: string; internalDateMs?: number; labels: string[]; groesse?: number }): GMessage {
  const payload = teilLesen(roh, '', 0);
  // Ausschnitt wie bei Gmail: der Anfang des Texts, eine Zeile.
  return {
    id: o.id, threadId: o.threadId, labelIds: o.labels, payload,
    ...(o.internalDateMs ? { internalDate: String(o.internalDateMs) } : {}),
    ...(o.groesse ? { sizeEstimate: o.groesse } : {}),
  };
}

/** Den Ausschnitt aus dem gelesenen Text (Gmail liefert ihn fertig, IMAP nicht). Rein. */
export const ausschnittAus = (text: string, max = 300): string => text.replace(/^>.*$/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// ── Kopfzeilen, die Gmail nicht braucht, die Inbox aber schon ──────────────────

/** Automatische Nachricht (Abwesenheit, Zustellbericht): `Auto-Submitted` ≠ no, `X-Autoreply`, `X-Autorespond`. Rein. */
export function istAutomatisch(headers: readonly { name: string; value: string }[]): boolean {
  const a = wert(headers as { name: string; value: string }[], 'auto-submitted');
  if (a && !/^\s*no\b/i.test(a)) return true;
  return headers.some(h => /^x-auto(reply|respond|-response-suppress)?$/i.test(h.name) && !/^x-auto-response-suppress$/i.test(h.name));
}

// ── BODYSTRUCTURE → Anhänge (Größen stimmen auch, wenn die Quelle gekürzt geholt wurde) ─────────────────────────

/** Ein Knoten aus der BODYSTRUCTURE (Form von imapflow, nur was wir lesen). */
export interface StrukturKnoten {
  part?: string;
  type?: string;
  parameters?: Record<string, string>;
  disposition?: string;
  dispositionParameters?: Record<string, string>;
  size?: number;
  encoding?: string;
  id?: string;
  childNodes?: StrukturKnoten[];
}

/** Anhänge (nur Metadaten) aus der BODYSTRUCTURE. Rein. */
export function anhaengeAusStruktur(s: StrukturKnoten | undefined, max = 30): Anhang[] {
  const raus: Anhang[] = [];
  const lauf = (k: StrukturKnoten, tiefe: number) => {
    if (raus.length >= max || tiefe > MAX_TIEFE) return;
    const typ = (k.type ?? 'application/octet-stream').toLowerCase();
    if (typ.startsWith('multipart/')) { (k.childNodes ?? []).forEach(c => lauf(c, tiefe + 1)); return; }
    const name = (k.dispositionParameters?.filename ?? k.parameters?.name ?? '').replace(/[\u0000-\u001f\u007f/\\]+/g, ' ').trim().slice(0, 160);
    const anhang = (k.disposition ?? '').toLowerCase() === 'attachment' || !!name || (!/^text\/(plain|html)$/.test(typ) && typ !== 'message/delivery-status');
    if (!anhang || !k.part) return;
    const roh = Math.max(0, Math.floor(k.size ?? 0));
    const groesse = (k.encoding ?? '').toLowerCase() === 'base64' ? Math.floor(roh * 3 / 4) : roh;
    raus.push({ teil: k.part, name: name || (typ === 'text/calendar' ? 'Termineinladung.ics' : 'Anhang'), typ: typ.slice(0, 100), groesse, ...(k.id && (k.disposition ?? '').toLowerCase() !== 'attachment' ? { eingebettet: true } : {}) });
  };
  if (s) lauf(s, 0);
  return raus;
}

/** Kurzer, stabiler Fingerabdruck (Gesprächs-Schlüssel aus einer Message-ID) — 20 Zeichen, nur [a-z0-9]. Rein. */
export function kurzHash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 20);
}
