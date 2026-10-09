// ─── Inbox — Anhang (oder die Mail als Text) aus einem Gespräch in UNSERE Ablage legen (Server, 09.10.2026) ──────────────
// Kevin 09.10.: „Dokumente wegsortieren in unsere Ablage.“ Ein Klick der Person, nichts automatisch. Die Bytes holt der SERVER aus dem
// eigenen Spiegel (Gmail-API, IMAP über den Zugang des Postfachs bzw. des Team-Besitzers, WhatsApp-Medienablage) — der Browser schickt nur
// Kennungen, nie Inhalte. Geschrieben wird NUR über die vorhandenen Wege:
//   · CRM-Ablage (`crm-dateien--<haushalt>`, lib/dateien/ablage.ts `ablegen`): PDF/PNG/JPG/DOCX ≤ 15 MB, Typ am Inhalt (`typErkennen`),
//     Bezug Kontakt/Firma/Deal — nie ein Mandat (ein Mandats-Bezug macht den Eintrag zum Beleg, der nicht mehr gelöscht werden kann).
//   · Projekt-Dateien (`aufgaben-dateien--<haushalt>`, `aufgabenDateiAblegen`): ≤ 25 MB, Typ am Inhalt (`aufgabenTypErkennen`), Bezug
//     Projekt (+ Aufgabe), Bereich aus dem Space (Abweichung → 409), fremde „nur ich“-Aufgaben 404, Konto „nur Business“ nur Business.
// Regeln: das Gespräch muss der Person gehören (`gespraechLesen` = nur eigene Spiegel bzw. sichtbare Team-Postfächer); Art. 18
// (eingeschränkt) → nichts ablegen; Werbesperre → nicht an der Person; Privat ↔ Business nur mit `bereichWechsel: true` (bewusster Klick).
// Am Eintrag steht als Notiz nur die Herkunft mit Link zurück ins Gespräch — nie Mailtext.

import { gespraechLesen, type NachrichtAnsicht } from './gespraech-server';
import { ablageNotiz, bereichWechsel, crmAblageBezug, mailAlsText, raumVonPostfach, WECHSEL_TEXT, type Raum } from './flows';
import { AblageFehler, ablegen } from '@/lib/dateien/ablage';
import { aufgabenDateiAblegen, aufgabenDateienZugang, bezugAufloesen } from '@/lib/dateien/aufgaben-ablage';
import { DATEI_ARTEN, MAX_DATEI_BYTES, dateinameSaeubern, endung, typErkennen, type DateiArt } from '@/lib/dateien/regeln';
import { AUFGABEN_KENNUNG, MAX_AUFGABEN_DATEI_BYTES, aufgabenTypErkennen } from '@/lib/dateien/aufgaben-regeln';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { verborgeneAufgabenFuer } from '@/lib/aufgaben/sicht';

export type AblageZiel =
  | { art: 'crm'; kontaktId?: string; firmaId?: string; dealId?: string; dateiArt?: DateiArt; titel?: string }
  | { art: 'projekt'; projektId: string; aufgabeId?: string };

export interface AblageEingabe {
  gespraech: string;
  nachricht: string;
  /** Teil-Kennung des Anhangs — oder `mail` = die Nachricht selbst als Textdatei (nur Projekt-Ablage). */
  teil: string;
  ziel: AblageZiel;
  bereichWechsel?: boolean;
}

export interface AblageErgebnis { status: number; body: Record<string, unknown> }

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:~-]{0,79}$/;
const fehler = (status: number, text: string, extra: Record<string, unknown> = {}): AblageErgebnis => ({ status, body: { ok: false, fehler: text, ...extra } });

/** Eingabe aus dem Netz säubern (nur Kennungen; sonst null = 400). */
export function ablageEingabe(b: Record<string, unknown>): AblageEingabe | null {
  const s = (v: unknown, re = KENNUNG) => (typeof v === 'string' && re.test(v) ? v : undefined);
  const gespraech = typeof b.gespraech === 'string' && b.gespraech.length <= 200 ? b.gespraech : undefined;
  const nachricht = typeof b.nachricht === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:=~+/-]{0,199}$/.test(b.nachricht) ? b.nachricht : undefined;
  const teil = typeof b.teil === 'string' && (b.teil === 'mail' || b.teil === 'wa' || /^[0-9]{1,3}(\.[0-9]{1,3}){0,8}$/.test(b.teil)) ? b.teil : undefined;
  const z = (b.ziel && typeof b.ziel === 'object' ? b.ziel : {}) as Record<string, unknown>;
  if (!gespraech || !nachricht || !teil) return null;
  let ziel: AblageZiel;
  if (z.art === 'crm') {
    const dateiArt = DATEI_ARTEN.some(a => a.id === z.dateiArt) ? z.dateiArt as DateiArt : undefined;
    const titel = typeof z.titel === 'string' ? z.titel.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    ziel = { art: 'crm', ...(s(z.kontaktId) ? { kontaktId: s(z.kontaktId) } : {}), ...(s(z.firmaId) ? { firmaId: s(z.firmaId) } : {}), ...(s(z.dealId) ? { dealId: s(z.dealId) } : {}), ...(dateiArt ? { dateiArt } : {}), ...(titel ? { titel } : {}) };
  } else if (z.art === 'projekt') {
    const projektId = s(z.projektId, AUFGABEN_KENNUNG);
    if (!projektId) return null;
    ziel = { art: 'projekt', projektId, ...(s(z.aufgabeId, AUFGABEN_KENNUNG) ? { aufgabeId: s(z.aufgabeId, AUFGABEN_KENNUNG) } : {}) };
  } else return null;
  return { gespraech, nachricht, teil, ziel, ...(b.bereichWechsel === true ? { bereichWechsel: true } : {}) };
}

/** Bytes des Anhangs frisch aus dem eigenen Spiegel bzw. dem Postfach (nie aus dem Browser). */
async function anhangHolen(person: string, quelle: string, besitzer: string, nachricht: string, teil: string): Promise<{ name: string; bytes: Buffer }> {
  if (quelle === 'gmail') {
    const { gmailAnhang } = await import('@/lib/gmail/aktion');
    const a = await gmailAnhang(person, nachricht, teil);
    return { name: a.name, bytes: Buffer.from(a.bytes) };
  }
  if (quelle === 'imap') {
    const { imapAnhang } = await import('@/lib/postfach/aktion');
    return imapAnhang(besitzer, nachricht, teil);
  }
  if (quelle === 'whatsapp') {
    const [{ whatsappFuer }, { mediumOeffnen }] = await Promise.all([import('@/lib/whatsapp/server'), import('@/lib/whatsapp/medien')]);
    if (!(await whatsappFuer(person))) throw new AblageFehler('WhatsApp ist für dieses Konto nicht eingerichtet.', 404);
    const m = await mediumOeffnen(nachricht);
    if (!m) throw new AblageFehler('Diese Datei liegt (noch) nicht vor — sie wird gerade geladen, ist zu groß oder ihre Frist ist abgelaufen.', 404);
    return { name: m.name, bytes: m.bytes };
  }
  throw new AblageFehler('Diese Quelle kennt keine Anhänge.', 400);
}

/** Fehler der Postfach-Wege (Gmail, IMAP, Google) in eine Antwort übersetzen — nie Zugangsdaten im Text. */
function holFehler(e: unknown): AblageErgebnis {
  if (e instanceof AblageFehler) return fehler(e.status, e.message);
  const s = (e as { status?: unknown })?.status;
  const status = typeof s === 'number' && s >= 400 && s < 600 ? s : 502;
  return fehler(status, e instanceof Error && e.message ? e.message : 'Der Anhang ließ sich nicht holen.');
}

/**
 * Ablegen. `jetzt` nur für Tests. Rückgabe: Status + Körper (`{ ok, eintrag: { id, name }, ziel, text }`).
 * `betroffen`: wessen Postfach gelesen wurde (Team-Postfach einer anderen Person → Lese-Protokoll in der Route).
 */
export async function ausGespraechAblegen(person: string, e: AblageEingabe): Promise<AblageErgebnis & { betroffen?: string }> {
  const a = await gespraechLesen(person, e.gespraech);
  if (!a) return fehler(404, 'Dieses Gespräch gibt es nicht (mehr).');
  const g = a.gespraech;
  const n: NachrichtAnsicht | undefined = a.nachrichten.find(x => x.id === e.nachricht);
  if (!n) return fehler(404, 'Diese Nachricht gibt es in dem Gespräch nicht.');
  // Art. 18: die Verarbeitung der Person ist eingeschränkt — weder an der Person noch an Firma oder Projekt ablegen.
  if (g.zuordnung?.sperre === 'eingeschraenkt') return fehler(409, 'Die Verarbeitung dieser Person ist eingeschränkt (Art. 18) — es wird nichts abgelegt.', { code: 'eingeschraenkt' });
  const besitzer = g.team?.postfach?.besitzer ?? person;
  const betroffen = besitzer !== person ? besitzer : undefined;
  const von: Raum = raumVonPostfach(g.bereich);

  // ── Ziel prüfen (vor dem Holen der Bytes — ein abgelehntes Ziel kostet keinen Abruf beim Anbieter) ──
  let zielRaum: Raum;
  let crm: { haushalt: string; bezug: { kontaktId?: string; firmaId?: string; dealId?: string } } | null = null;
  let projekt: { haushalt: string; projektId: string; aufgabeId?: string } | null = null;
  if (e.ziel.art === 'crm') {
    if (e.teil === 'mail') return fehler(415, 'Die CRM-Ablage nimmt nur PDF, PNG, JPG oder DOCX — die Mail als Text geht in die Projekt-Ablage.');
    const h = await haushaltFuer(person);
    if (!h) return fehler(403, 'Kein Zugang zur Dateiablage — sie gehört zum Haushalt des Inhabers.');
    const erlaubt = crmAblageBezug(g.zuordnung);
    // Bezüge: nur, was die Zuordnung des Gesprächs hergibt (Werbesperre → nie an der Person) — die Person darf weglassen, nicht hinzufügen.
    const bezug = { ...(e.ziel.kontaktId ? { kontaktId: e.ziel.kontaktId } : {}), ...(e.ziel.firmaId ? { firmaId: e.ziel.firmaId } : {}), ...(e.ziel.dealId ? { dealId: e.ziel.dealId } : {}) };
    if (!erlaubt.ok) return fehler(409, erlaubt.grund, { code: 'bezug' });
    const fremd = (Object.entries(bezug) as [keyof typeof bezug, string][]).find(([k, v]) => erlaubt.bezug[k] !== v);
    if (fremd) return fehler(fremd[0] === 'kontaktId' && g.zuordnung?.sperre === 'werbesperre' ? 409 : 400, fremd[0] === 'kontaktId' && g.zuordnung?.sperre === 'werbesperre' ? 'Werbesperre — an der Person wird nichts abgelegt (nur an der Firma).' : 'Abgelegt wird nur an Person, Firma oder Deal dieses Gesprächs.', { code: 'bezug' });
    if (!Object.keys(bezug).length) return fehler(400, 'Bitte wählen, woran abgelegt wird (Kontakt, Firma oder Deal).');
    // Gibt es die Bezüge (noch)? Kartei nur über die verarbeitbare Sicht (Art. 18 fehlt dort ohnehin).
    const [{ kontakteFuerVerarbeitung }, { ladeCrm }] = await Promise.all([import('@/lib/crm/verarbeitung'), import('@/lib/crm/speicher')]);
    if (bezug.kontaktId) {
      const k = (await kontakteFuerVerarbeitung()).find(x => x.id === bezug.kontaktId);
      if (!k) return fehler(404, 'Diese Person gibt es in der Kartei nicht (mehr).');
      if (k.werbesperre) return fehler(409, 'Werbesperre — an der Person wird nichts abgelegt (nur an der Firma).', { code: 'bezug' });
    }
    if (bezug.firmaId || bezug.dealId) {
      const c = await ladeCrm();
      if (bezug.firmaId && !c.firmen.some(f => f.id === bezug.firmaId)) return fehler(404, 'Diese Firma gibt es nicht (mehr).');
      if (bezug.dealId && !c.chancen.some(d => d.id === bezug.dealId)) return fehler(404, 'Diesen Deal gibt es nicht (mehr).');
    }
    zielRaum = 'business';
    crm = { haushalt: h.haushalt, bezug };
  } else {
    const z = await aufgabenDateienZugang(person);
    if (!z) return fehler(403, 'Kein Zugang zu den Projekt-Dateien — sie gehören zum Haushalt des Inhabers.');
    if (e.ziel.aufgabeId && (await verborgeneAufgabenFuer(person)).has(e.ziel.aufgabeId)) return fehler(404, 'Diese Aufgabe gibt es nicht (mehr).');
    let b;
    try { b = await bezugAufloesen(e.ziel.projektId, e.ziel.aufgabeId, person); } catch (x) { return holFehler(x); }
    if (z.nurBusiness && b.bereich !== 'business') return fehler(404, 'Dieses Projekt gibt es nicht (mehr).');
    zielRaum = b.bereich;
    projekt = { haushalt: z.haushalt, projektId: b.projektId, ...(b.aufgabeId ? { aufgabeId: b.aufgabeId } : {}) };
  }
  if (bereichWechsel(g.bereich, zielRaum) && !e.bereichWechsel) return fehler(409, WECHSEL_TEXT(von, zielRaum), { code: 'bereich', von, nach: zielRaum });

  // ── Inhalt holen ──
  let name: string, bytes: Buffer;
  if (e.teil === 'mail') {
    const t = mailAlsText(n);
    name = t.name; bytes = Buffer.from(t.text, 'utf8');
  } else {
    const anhang = n.anhaenge.find(x => x.teil === e.teil);
    if (!anhang) return fehler(404, 'Diesen Anhang gibt es nicht.');
    const grenze = crm ? MAX_DATEI_BYTES : MAX_AUFGABEN_DATEI_BYTES;
    if (anhang.groesse > grenze) return fehler(413, `Der Anhang ist größer als ${grenze / 1048576} MB — ${crm ? 'die CRM-Ablage nimmt höchstens 15 MB (die Projekt-Ablage 25 MB).' : 'bitte herunterladen und anders ablegen.'}`);
    try { ({ name, bytes } = await anhangHolen(person, g.quelle, besitzer, n.id, e.teil)); } catch (x) { return { ...holFehler(x), ...(betroffen ? { betroffen } : {}) }; }
    if (!bytes.length) return fehler(400, 'Der Anhang ist leer.');
    if (bytes.length > grenze) return fehler(413, `Der Anhang ist größer als ${grenze / 1048576} MB.`);
  }

  // ── Ablegen über den vorhandenen Weg ──
  const notiz = ablageNotiz(g.id, g.quelle);
  try {
    if (crm) {
      const datei = dateinameSaeubern(name, endung(name) || 'pdf');
      const typ = typErkennen(datei, bytes.subarray(0, 16));
      if (!typ) return fehler(415, 'Die CRM-Ablage nimmt nur PDF, PNG, JPG oder DOCX (am Inhalt geprüft) — andere Dateien gehen in die Projekt-Ablage.', { code: 'typ' });
      const ziel = e.ziel as Extract<AblageZiel, { art: 'crm' }>;
      const eintrag = await ablegen(crm.haushalt, person, { art: ziel.dateiArt ?? 'sonstig', ...(ziel.titel ? { titel: ziel.titel } : {}), ...crm.bezug, notiz }, { bytes, name: datei, typ });
      return { status: 200, body: { ok: true, eintrag: { id: eintrag.id, name: datei }, ziel: { art: 'crm', ...crm.bezug }, text: `Abgelegt: ${datei}` }, ...(betroffen ? { betroffen } : {}) };
    }
    const p = projekt!;
    const datei = dateinameSaeubern(name, endung(name) || 'txt');
    const typ = aufgabenTypErkennen(datei, bytes);
    if (!typ) return fehler(415, 'Diesen Dateityp nimmt die Projekt-Ablage nicht (PDF, Bilder, Word, Excel, PowerPoint, CSV, TXT, Markdown — am Inhalt geprüft).', { code: 'typ' });
    const eintrag = await aufgabenDateiAblegen(p.haushalt, person, { projektId: p.projektId, ...(p.aufgabeId ? { aufgabeId: p.aufgabeId } : {}), bereich: zielRaum, notiz }, { bytes, name: datei, typ });
    return { status: 200, body: { ok: true, eintrag: { id: eintrag.id, name: datei }, ziel: { art: 'projekt', projektId: p.projektId, ...(p.aufgabeId ? { aufgabeId: p.aufgabeId } : {}) }, text: `Abgelegt: ${datei}` }, ...(betroffen ? { betroffen } : {}) };
  } catch (x) {
    if (x instanceof AblageFehler) return fehler(x.status, x.message);
    throw x;
  }
}
