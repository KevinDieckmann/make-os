// ─── WhatsApp — Senden per Einzelklick (Server, 07.10.2026) ────────────────────────────────────────────────────────────
// Kevin 06.10.: „ZOE macht alles nur als Vorschlag“ — gesendet wird nur, wenn eine Person in der Inbox klickt (Route mit Sitzung,
// Dienstweg 403), immer an EIN bestehendes Gespräch, nie an Listen, nie automatisch.
//   frei     nur bei offenem 24-h-Fenster (lib/whatsapp/typen.ts `fensterBerechnen`) — sonst 409 mit klarer Meldung
//   vorlage  jederzeit, aber nur eine bei Meta GENEHMIGTE Vorlage (Name + Sprache, Platzhalter vollständig)
// Meta: POST /<Version>/<PHONE_NUMBER_ID>/messages mit messaging_product, recipient_type, to, type (text|template), text.body bzw.
// template.name/language.code/components (https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages).
// Rechte der Gegenseite: eingeschränkte Person (Art. 18) → 409; Werbesperre → keine MARKETING-Vorlage (409). Doppelt senden
// verhindert die Anfrage-Kennung (`einmalig`), dazu eine kleine Bremse je Person.

import { einmalig } from '@/lib/store/anfragen';
import { gespraechTeile } from '@/lib/inbox/strom';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { kanalStatus } from '@/lib/crm/recht';
import { FENSTER_ZU } from './fehler';
import { graph, WhatsappFehler } from './graph';
import { whatsappFuer } from './server';
import { aendereWaSpiegel, ausgehendMerken, ladeWaSpiegel } from './spiegel';
import { fensterBerechnen, vorlageFuellen, WA_GRENZEN, WA_ID, type WaNachricht } from './typen';
import { sendbareVorlage, vorlagenLaden } from './vorlagen';
import { telefonIndex, waZuordnen } from './zuordnung';

export interface SendeEingabe {
  gespraech: string;
  art: 'frei' | 'vorlage';
  text?: string;
  vorlage?: { name: string; sprache: string; parameter?: string[] };
  anfrageId?: string;
}

export interface SendeErgebnis { ok: true; id: string; status: 'angenommen'; text: string }

/** Eingabe prüfen (rein). Wirft `WhatsappFehler` (400). */
export function eingabePruefen(b: Record<string, unknown>): SendeEingabe {
  const fehler = (t: string, s = 400) => new WhatsappFehler('parameter', t, s);
  if (typeof b.gespraech !== 'string' || !gespraechTeile(b.gespraech) || !b.gespraech.startsWith('wa~')) throw fehler('Gespräch fehlt.');
  if (b.art !== 'frei' && b.art !== 'vorlage') throw fehler('art: frei oder vorlage.');
  if (b.art === 'frei') {
    const text = typeof b.text === 'string' ? b.text.replace(/\r\n?/g, '\n').trim() : '';
    if (!text) throw fehler('Bitte einen Text eingeben.');
    if (text.length > WA_GRENZEN.text) throw fehler(`Der Text ist zu lang (höchstens ${WA_GRENZEN.text} Zeichen).`, 413);
    return { gespraech: b.gespraech, art: 'frei', text, ...(typeof b.anfrageId === 'string' ? { anfrageId: b.anfrageId } : {}) };
  }
  const v = (b.vorlage ?? {}) as Record<string, unknown>;
  const name = typeof v.name === 'string' ? v.name : '';
  const sprache = typeof v.sprache === 'string' ? v.sprache : '';
  if (!/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-z]{2,3}(_[A-Za-z]{2,4})?$/.test(sprache)) throw fehler('Bitte eine Vorlage wählen.');
  const roh = Array.isArray(v.parameter) ? v.parameter : [];
  if (roh.length > WA_GRENZEN.parameter) throw fehler(`Höchstens ${WA_GRENZEN.parameter} Platzhalter.`, 413);
  const parameter = roh.map(p => (typeof p === 'string' ? p.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim() : ''));
  if (parameter.some(p => !p)) throw fehler('Bitte jeden Platzhalter ausfüllen.');
  if (parameter.some(p => p.length > WA_GRENZEN.parameterLaenge)) throw fehler(`Ein Platzhalter ist zu lang (höchstens ${WA_GRENZEN.parameterLaenge} Zeichen).`, 413);
  return { gespraech: b.gespraech, art: 'vorlage', vorlage: { name, sprache, parameter }, ...(typeof b.anfrageId === 'string' ? { anfrageId: b.anfrageId } : {}) };
}

// Bremse je Person (Einzelklick): höchstens eine Sendung je 2 Sekunden.
const zuletzt = new Map<string, number>();
export const BREMSE_MS = 2_000;
/** Nur für Tests. */
export const _bremseZuruecksetzen = () => zuletzt.clear();

interface SendeAntwort { messages?: { id?: string }[] }

/** Senden (Server). Wirft `WhatsappFehler` mit deutschem Satz. */
export async function whatsappSenden(person: string, e: SendeEingabe, jetzt = Date.now()): Promise<{ status: number; body: SendeErgebnis | { ok: false; error: string } }> {
  const k = await whatsappFuer(person);
  if (!k) throw new WhatsappFehler('unbekannt', 'WhatsApp ist für dieses Konto nicht freigeschaltet.', 403);
  const t = gespraechTeile(e.gespraech)!;
  if (t.quelle !== 'whatsapp' || t.postfach !== k.postfachId) throw new WhatsappFehler('unbekannt', 'Dieses Gespräch gibt es nicht.', 404);
  const nummer = t.schluessel;
  const s = await ladeWaSpiegel();
  const kontakt = s.kontakte[nummer];
  if (!kontakt || !Object.values(s.nachrichten).some(n => n.nummer === nummer)) throw new WhatsappFehler('unbekannt', 'Dieses Gespräch gibt es nicht.', 404);
  // Rechte der Gegenseite (Kartei): Art. 18 → nichts senden; Werbesperre → keine Werbe-Vorlage.
  const [kontakte, crm] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm()]);
  const z = waZuordnen(nummer, telefonIndex(kontakte), crm);
  if (z?.sperre === 'eingeschraenkt') throw new WhatsappFehler('unbekannt', 'Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO) — es wird nichts gesendet.', 409);

  let body: Record<string, unknown>;
  let text: string;
  if (e.art === 'frei') {
    if (!fensterBerechnen(kontakt.zuletztEingehend, jetzt).offen) throw new WhatsappFehler(FENSTER_ZU.art, FENSTER_ZU.text, FENSTER_ZU.status, 131047);
    text = e.text!;
    body = { messaging_product: 'whatsapp', recipient_type: 'individual', to: nummer, type: 'text', text: { preview_url: false, body: text } };
  } else {
    const w = e.vorlage!;
    let v = sendbareVorlage((await vorlagenLaden(k)).liste, w.name, w.sprache);
    if (!v) v = sendbareVorlage((await vorlagenLaden(k, { neu: true })).liste, w.name, w.sprache); // vielleicht gerade erst genehmigt
    if (!v) throw new WhatsappFehler('vorlage', 'Diese Vorlage ist (in dieser Sprache) nicht genehmigt — bitte im WhatsApp Manager bei Meta prüfen.', 409);
    const p = w.parameter ?? [];
    if (p.length !== v.parameter.length) throw new WhatsappFehler('parameter', `Die Vorlage braucht ${v.parameter.length} Platzhalter — ${p.length} ausgefüllt.`, 400);
    if (v.kategorie === 'MARKETING' && z?.sperre === 'werbesperre') throw new WhatsappFehler('unbekannt', 'Für diese Person gilt eine Werbesperre — keine Werbe-Vorlage (Kategorie MARKETING).', 409);
    // Kevin 07.10.: Werbe-Vorlagen nur mit nachgewiesener Einwilligung „WhatsApp“ (§ 7 UWG) — ohne zugeordnete Akte nie.
    if (v.kategorie === 'MARKETING') {
      const akte = z ? kontakte.find(c => c.id === z.kontaktId) : undefined;
      const st = akte ? kanalStatus(akte, 'whatsapp') : null;
      if (!st || st.farbe !== 'gruen') throw new WhatsappFehler('unbekannt', akte ? `Werbe-Vorlage nur mit Einwilligung „WhatsApp“ — ${st!.grund}.` : 'Werbe-Vorlage nur an eine zugeordnete Person mit Einwilligung „WhatsApp“ — erst zuordnen und die Einwilligung im Kontakt erfassen.', 409);
    }
    // Benannte Platzhalter ({{vorname}}): Meta erwartet dann `parameter_name` je Wert (Annahme — die Sende-Doku nennt nur `components`).
    const benannt = v.parameter.some(x => !/^\d+$/.test(x));
    text = vorlageFuellen(v.text, p) || `Vorlage „${v.name}“`;
    body = {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: nummer, type: 'template',
      template: { name: v.name, language: { code: v.sprache }, ...(p.length ? { components: [{ type: 'body', parameters: p.map((x, i) => ({ type: 'text', text: x, ...(benannt ? { parameter_name: v.parameter[i] } : {}) })) }] } : {}) },
    };
  }
  const alt = zuletzt.get(person) ?? 0;
  if (jetzt - alt < BREMSE_MS) throw new WhatsappFehler('limit', 'Einen Moment — höchstens eine Nachricht je zwei Sekunden.', 429);
  zuletzt.set(person, jetzt);

  return einmalig<SendeErgebnis>('whatsapp-senden', e.anfrageId, async () => {
    const r = await graph<SendeAntwort>(k, `/${k.telefonnummerId}/messages`, { method: 'POST', body });
    const id = r.messages?.[0]?.id;
    if (typeof id !== 'string' || !WA_ID.test(id)) throw new WhatsappFehler('unbekannt', 'Meta hat die Nachricht ohne Kennung angenommen — bitte im WhatsApp Manager nachsehen, bevor du erneut sendest.', 502);
    const m: WaNachricht = {
      id, nummer, richtung: 'aus', am: new Date(jetzt).toISOString(), art: e.art === 'frei' ? 'text' : 'vorlage', text: text.slice(0, WA_GRENZEN.text),
      status: 'angenommen', von: person, ...(e.art === 'vorlage' ? { vorlage: { name: e.vorlage!.name, sprache: e.vorlage!.sprache } } : {}),
    };
    await aendereWaSpiegel(cur => ausgehendMerken(cur, m));
    // Zugeordnetes Gespräch: die gesendete Nachricht steht sofort im Verlauf der Akte (wie bei Mail; nur nach „Zuordnen“).
    await import('@/lib/inbox/verlauf').then(v => v.verlaufNachziehen(person, e.gespraech)).catch(() => { /* Verlauf folgt beim nächsten Lauf */ });
    return { status: 200, body: { ok: true, id, status: 'angenommen', text: e.art === 'frei' ? 'Gesendet.' : 'Vorlage gesendet.' } };
  }, undefined, { wer: person }); // Nachschliff 09.10.: die gemerkte Antwort nur für die Person selbst (lib/store/anfragen.ts `wer`)
}
