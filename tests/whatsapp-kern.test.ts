// WhatsApp Business (07.10.) — die reinen Regeln: Signatur (HMAC über den ROHEN Körper), Verifizierung, 24-h-Fenster, Zustellstand
// nur vorwärts, Fehlercodes → deutsche Sätze, Webhook → Spiegel (idempotent, nur die eigene Nummer), Gespräche im Strom, Zuordnung über
// die Telefonnummer, Art. 17, Vorlagen, Eingaben, Prüfsumme, Medien-Hosts, Einrichtung aus der Umgebung. Kein Netz, keine Daten.
import { describe, it, expect } from 'vitest';
import { createHmac, createHash } from 'node:crypto';
import { signaturGueltig, verifizieren, gleichZeitkonstant } from '@/lib/whatsapp/signatur';
import { fensterBerechnen, fensterText, fensterKnapp, statusWeiter, platzhalter, vorlageFuellen, FENSTER_MS, type WaNachricht } from '@/lib/whatsapp/typen';
import { metaFehler, FENSTER_ZU } from '@/lib/whatsapp/fehler';
import { webhookAnwenden, leererSpiegel, ausgehendMerken, gelesenSetzen, waAufbewahren, nachrichtAus, type WebhookKoerper } from '@/lib/whatsapp/spiegel';
import { waGespraecheBauen, kopfAus, gespraechIdFuer, waPostfachZustand, betreffAus } from '@/lib/whatsapp/strom';
import { telefonIndex, waZuordnen, telefonSchluessel } from '@/lib/whatsapp/zuordnung';
import { waOhnePerson } from '@/lib/whatsapp/art17';
import { vorlageAus, sendbareVorlage } from '@/lib/whatsapp/vorlagen';
import { eingabePruefen } from '@/lib/whatsapp/senden';
import { pruefsummeOk, dateiFuer } from '@/lib/whatsapp/medien';
import { medienAdresseOk, GRAPH_VERSION, GRAPH_BASIS } from '@/lib/whatsapp/graph';
import { whatsappKonfig, whatsappFehlend, postfachIdFuer, bereichZulaessig, WA_ENV } from '@/lib/whatsapp/konfig';
import { GESPRAECH_ID, gespraechTeile } from '@/lib/inbox/strom';
import { merkmaleVon, nenntPerson } from '@/lib/crm/person-weitere';
import type { Kontakt } from '@/lib/make-one/crm';

const GEHEIM = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const sig = (roh: Buffer | string, g = GEHEIM) => `sha256=${createHmac('sha256', g).update(roh).digest('hex')}`;
const NR_ID = '100200300400500';
const KUNDE = '4915112345678';
const T0 = Date.parse('2026-10-07T09:00:00Z');
const ts = (ms: number) => String(Math.floor(ms / 1000));

function webhook(werte: Record<string, unknown>, nummerId = NR_ID): WebhookKoerper {
  return { object: 'whatsapp_business_account', entry: [{ id: '999', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '49 30 0000000', phone_number_id: nummerId }, ...werte } as never }] }] };
}
const text = (id: string, body: string, ms = T0, von = KUNDE) => ({ from: von, id, timestamp: ts(ms), type: 'text', text: { body } });

describe('Signatur X-Hub-Signature-256 (HMAC-SHA256 über den Rohkörper)', () => {
  const roh = Buffer.from(JSON.stringify(webhook({ messages: [text('wamid.AAA111', 'Hallo')] })));
  it('gültig → true', () => { expect(signaturGueltig(roh, sig(roh), GEHEIM)).toBe(true); });
  it('Großbuchstaben im Hex sind gleich gültig', () => { expect(signaturGueltig(roh, sig(roh).replace(/[a-f]/g, c => c.toUpperCase()).replace('SHA256', 'sha256'), GEHEIM)).toBe(true); });
  it('falsches Geheimnis, fehlender Kopf, kaputter Kopf → false', () => {
    expect(signaturGueltig(roh, sig(roh, 'anderes-geheimnis-1234567890'), GEHEIM)).toBe(false);
    expect(signaturGueltig(roh, null, GEHEIM)).toBe(false);
    expect(signaturGueltig(roh, '', GEHEIM)).toBe(false);
    expect(signaturGueltig(roh, 'sha1=abc', GEHEIM)).toBe(false);
    expect(signaturGueltig(roh, `sha256=${'0'.repeat(63)}`, GEHEIM)).toBe(false);
    expect(signaturGueltig(roh, sig(roh), '')).toBe(false);
  });
  it('manipulierter Körper (ein Byte, neu serialisiert mit Leerzeichen) → false', () => {
    const s = sig(roh);
    const anders = Buffer.from(roh.toString('utf8').replace('Hallo', 'Hallx'));
    expect(signaturGueltig(anders, s, GEHEIM)).toBe(false);
    const neuSerialisiert = Buffer.from(JSON.stringify(JSON.parse(roh.toString('utf8')), null, 1));
    expect(signaturGueltig(neuSerialisiert, s, GEHEIM)).toBe(false);
  });
});

describe('Verifizierung (GET hub.*)', () => {
  const TOKEN = 'b'.repeat(48);
  const q = (o: Record<string, string>) => new URLSearchParams(o);
  it('richtiges Token → genau die Challenge', () => { expect(verifizieren(q({ 'hub.mode': 'subscribe', 'hub.verify_token': TOKEN, 'hub.challenge': '1158201444' }), TOKEN)).toBe('1158201444'); });
  it('falsches Token, falscher Modus, fremde Zeichen in der Challenge, leeres Token → null', () => {
    expect(verifizieren(q({ 'hub.mode': 'subscribe', 'hub.verify_token': 'falsch', 'hub.challenge': '1' }), TOKEN)).toBeNull();
    expect(verifizieren(q({ 'hub.mode': 'unsubscribe', 'hub.verify_token': TOKEN, 'hub.challenge': '1' }), TOKEN)).toBeNull();
    expect(verifizieren(q({ 'hub.mode': 'subscribe', 'hub.verify_token': TOKEN, 'hub.challenge': '<script>' }), TOKEN)).toBeNull();
    expect(verifizieren(q({ 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': '1' }), '')).toBeNull();
  });
  it('zeitkonstanter Vergleich', () => { expect(gleichZeitkonstant('abc', 'abc')).toBe(true); expect(gleichZeitkonstant('abc', 'abcd')).toBe(false); });
});

describe('24-h-Kundenservice-Fenster', () => {
  const ein = new Date(T0).toISOString();
  it('offen bis genau 24 h nach der letzten eingehenden Nachricht', () => {
    expect(fensterBerechnen(ein, T0 + 1000)).toMatchObject({ offen: true, bis: new Date(T0 + FENSTER_MS).toISOString() });
    expect(fensterBerechnen(ein, T0 + FENSTER_MS - 60_000).restMin).toBe(1);
    expect(fensterBerechnen(ein, T0 + FENSTER_MS).offen).toBe(false);
    expect(fensterBerechnen(ein, T0 + FENSTER_MS + 1).offen).toBe(false);
  });
  it('ohne eingehende Nachricht: zu, ohne Ende', () => { expect(fensterBerechnen(undefined, T0)).toEqual({ offen: false, bis: null, restMin: null }); });
  it('Texte und „knapp“', () => {
    expect(fensterText(fensterBerechnen(ein, T0 + 3600_000))).toMatch(/Fenster offen · noch 23 Std\./);
    expect(fensterText(fensterBerechnen(ein, T0 + FENSTER_MS + 1))).toMatch(/nur genehmigte Vorlagen/);
    expect(fensterText(fensterBerechnen(undefined))).toMatch(/Erstkontakt nur mit Vorlage/);
    expect(fensterKnapp(fensterBerechnen(ein, T0 + FENSTER_MS - 30 * 60_000))).toBe(true);
    expect(fensterKnapp(fensterBerechnen(ein, T0 + 60_000))).toBe(false);
  });
});

describe('Zustellstand nur vorwärts', () => {
  it('gesendet → zugestellt → gelesen; nie zurück; fehlgeschlagen nur vor der Zustellung', () => {
    expect(statusWeiter('angenommen', 'gesendet')).toBe(true);
    expect(statusWeiter('gelesen', 'zugestellt')).toBe(false);
    expect(statusWeiter('gesendet', 'fehlgeschlagen')).toBe(true);
    expect(statusWeiter('zugestellt', 'fehlgeschlagen')).toBe(false);
    expect(statusWeiter('fehlgeschlagen', 'gelesen')).toBe(false);
  });
});

describe('Fehlercodes von Meta → klare deutsche Sätze', () => {
  it.each([
    [131047, 'fenster', 409, /24-Stunden-Fenster ist zu/],
    [132001, 'vorlage', 409, /nicht genehmigt/],
    [132015, 'vorlage', 409, /pausiert/],
    [133010, 'nummer', 409, /nicht auf der WhatsApp Business Platform registriert/],
    [130429, 'limit', 429, /Limit erreicht/],
    [131056, 'limit', 429, /Limit erreicht/],
    [80007, 'limit', 429, /Limit erreicht/],
    [190, 'token', 502, /Verbindung erneuern/],
    [131026, 'empfaenger', 409, /nicht zustellen/],
    [132000, 'parameter', 400, /Platzhalter/],
    [368, 'gesperrt', 409, /eingeschränkt oder gesperrt/],
  ] as const)('%s → %s', (code, art, status, satz) => {
    const t = metaFehler(code);
    expect(t.art).toBe(art); expect(t.status).toBe(status); expect(t.text).toMatch(satz);
  });
  it('Schlüssel ungültig → erneuern; unbekannte Codes nennen den Code, nie Rohtext', () => {
    expect(metaFehler(190).erneuern).toBe(true);
    expect(metaFehler(250).erneuern).toBe(true);
    expect(metaFehler(131047).erneuern).toBe(false);
    expect(metaFehler(999999).text).toMatch(/Code 999999/);
    expect(metaFehler(undefined).art).toBe('unbekannt');
    expect(FENSTER_ZU.text).toMatch(/Vorlage/);
  });
});

describe('Webhook → Spiegel', () => {
  const J = '2026-10-07T09:05:00.000Z';
  it('Text, Bild (Medium offen), Dokument, Sprachnachricht, Ort, Kontakte — mit Profilname und „zuletzt eingehend“', () => {
    const r = webhookAnwenden(leererSpiegel(), webhook({
      contacts: [{ profile: { name: 'Erika Beispiel' }, wa_id: KUNDE }],
      messages: [
        text('wamid.T1aaaaaa', 'Guten Tag, bis Freitag bitte das Angebot', T0),
        { from: KUNDE, id: 'wamid.B1aaaaaa', timestamp: ts(T0 + 1000), type: 'image', image: { id: '1234567890', mime_type: 'image/jpeg', sha256: 'abcdefabcdefabcdefabcdef', caption: 'Foto' } },
        { from: KUNDE, id: 'wamid.D1aaaaaa', timestamp: ts(T0 + 2000), type: 'document', document: { id: '1234567891', mime_type: 'application/pdf', filename: 'Rechnung/../x.pdf' } },
        { from: KUNDE, id: 'wamid.A1aaaaaa', timestamp: ts(T0 + 3000), type: 'audio', audio: { id: '1234567892', mime_type: 'audio/ogg; codecs=opus', voice: true } },
        { from: KUNDE, id: 'wamid.L1aaaaaa', timestamp: ts(T0 + 4000), type: 'location', location: { latitude: 52.5, longitude: 13.4, name: 'Büro', address: 'Beispielweg 1' } },
        { from: KUNDE, id: 'wamid.K1aaaaaa', timestamp: ts(T0 + 5000), type: 'contacts', contacts: [{ name: { formatted_name: 'Max Muster' }, phones: [{ phone: '+49 30 1111' }] }] },
      ],
    }), NR_ID, J);
    expect(r.neu).toBe(6);
    expect(r.medien.sort()).toEqual(['wamid.A1aaaaaa', 'wamid.B1aaaaaa', 'wamid.D1aaaaaa']);
    const n = r.spiegel.nachrichten;
    expect(n['wamid.B1aaaaaa']).toMatchObject({ art: 'bild', text: 'Foto', medium: { mediaId: '1234567890', mime: 'image/jpeg', zustand: 'offen' } });
    expect(n['wamid.D1aaaaaa'].medium?.name).toBe('Rechnung_.._x.pdf');
    expect(n['wamid.A1aaaaaa'].art).toBe('sprachnachricht');
    expect(n['wamid.L1aaaaaa']).toMatchObject({ art: 'ort', ort: { lat: 52.5, lng: 13.4, name: 'Büro' } });
    expect(n['wamid.K1aaaaaa'].kontakte).toEqual([{ name: 'Max Muster', telefone: ['+49 30 1111'] }]);
    expect(r.spiegel.kontakte[KUNDE]).toMatchObject({ name: 'Erika Beispiel', zuletztEingehend: new Date(T0 + 5000).toISOString() });
  });
  it('idempotent: dieselbe WAMID zweimal (Meta wiederholt) → nichts Neues, derselbe Stand', () => {
    const k = webhook({ messages: [text('wamid.T1aaaaaa', 'Hallo')] });
    const a = webhookAnwenden(leererSpiegel(), k, NR_ID, J);
    const b = webhookAnwenden(a.spiegel, k, NR_ID, J);
    expect(a.neu).toBe(1); expect(b.neu).toBe(0); expect(b.spiegel).toBe(a.spiegel);
  });
  it('fremde Telefonnummer-ID, falsches object, fremde Felder, kaputte Nummern → übersprungen', () => {
    expect(webhookAnwenden(leererSpiegel(), webhook({ messages: [text('wamid.T1aaaaaa', 'x')] }, '555555555555'), NR_ID, J).neu).toBe(0);
    expect(webhookAnwenden(leererSpiegel(), { object: 'page', entry: [] }, NR_ID, J).uebersprungen).toBe(1);
    expect(webhookAnwenden(leererSpiegel(), webhook({ messages: [{ ...text('wamid.T1aaaaaa', 'x'), from: '+49 abc' }] }), NR_ID, J).neu).toBe(0);
  });
  it('Status: nur für eigene gesendete Nachrichten, nur vorwärts, „failed“ mit Satz', () => {
    const aus: WaNachricht = { id: 'wamid.OUT11111', nummer: KUNDE, richtung: 'aus', am: J, art: 'text', text: 'Hallo', status: 'angenommen', von: 'kevin' };
    let s = ausgehendMerken(leererSpiegel(), aus);
    s = webhookAnwenden(s, webhook({ statuses: [{ id: 'wamid.OUT11111', status: 'read', timestamp: ts(T0), recipient_id: KUNDE }] }), NR_ID, J).spiegel;
    expect(s.nachrichten['wamid.OUT11111'].status).toBe('gelesen');
    s = webhookAnwenden(s, webhook({ statuses: [{ id: 'wamid.OUT11111', status: 'delivered', timestamp: ts(T0) }] }), NR_ID, J).spiegel;
    expect(s.nachrichten['wamid.OUT11111'].status).toBe('gelesen');
    let f = ausgehendMerken(leererSpiegel(), { ...aus, id: 'wamid.OUT22222' });
    f = webhookAnwenden(f, webhook({ statuses: [{ id: 'wamid.OUT22222', status: 'failed', timestamp: ts(T0), errors: [{ code: 131047 }] }] }), NR_ID, J).spiegel;
    expect(f.nachrichten['wamid.OUT22222']).toMatchObject({ status: 'fehlgeschlagen', fehler: { code: 131047 } });
    expect(f.nachrichten['wamid.OUT22222'].fehler!.text).toMatch(/24-Stunden-Fenster/);
    expect(webhookAnwenden(leererSpiegel(), webhook({ statuses: [{ id: 'wamid.UNBEKANNT', status: 'read' }] }), NR_ID, J).status).toBe(0);
  });
  it('Nachricht ohne bekannte Form → „sonstiges“ mit Hinweis (nichts geht verloren)', () => {
    expect(nachrichtAus({ from: KUNDE, id: 'wamid.X1111111', type: 'poll' }, J)).toMatchObject({ art: 'sonstiges' });
  });
  it('gelesen setzen/zurücknehmen und Aufbewahren (Frist) samt Dateien', () => {
    let s = webhookAnwenden(leererSpiegel(), webhook({ messages: [text('wamid.ALT11111', 'alt', Date.parse('2026-01-01T10:00:00Z')), text('wamid.NEU11111', 'neu', T0, '4915199999999')] }), NR_ID, J).spiegel;
    s = { ...s, nachrichten: { ...s.nachrichten, 'wamid.ALT11111': { ...s.nachrichten['wamid.ALT11111'], medium: { mediaId: '1', mime: 'image/jpeg', zustand: 'abgelegt', datei: 'x'.repeat(40) + '.bin' } } } };
    expect(gelesenSetzen(s, KUNDE, true, J).kontakte[KUNDE].gelesenBis).toBe(J);
    expect(gelesenSetzen(gelesenSetzen(s, KUNDE, true, J), KUNDE, false, J).kontakte[KUNDE].gelesenBis).toBeUndefined();
    const r = waAufbewahren(s, '2026-04-10');
    expect(r.weg).toBe(1); expect(r.dateien).toEqual(['x'.repeat(40) + '.bin']);
    expect(Object.keys(r.spiegel.kontakte)).toEqual(['4915199999999']);
  });
});

describe('Gespräche im Strom der Inbox', () => {
  const PF = postfachIdFuer(NR_ID);
  const J = new Date(T0 + 3600_000).toISOString();
  const spiegel = () => {
    let s = webhookAnwenden(leererSpiegel(), webhook({ contacts: [{ profile: { name: 'Erika Beispiel' }, wa_id: KUNDE }], messages: [text('wamid.T1aaaaaa', 'Können wir bis Freitag sprechen?', T0)] }), NR_ID, J).spiegel;
    s = ausgehendMerken(s, { id: 'wamid.OUT11111', nummer: '4917700000000', richtung: 'aus', am: new Date(T0 - 5 * 86_400_000).toISOString(), art: 'vorlage', text: 'Hallo', status: 'zugestellt', von: 'kevin' });
    return s;
  };
  it('Postfach-Kennung passt zur Gesprächs-Kennung der Inbox (stabil, je Telefonnummer-ID)', () => {
    expect(PF).toMatch(/^pf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(postfachIdFuer(NR_ID)).toBe(PF);
    expect(postfachIdFuer('999')).not.toBe(PF);
    const id = gespraechIdFuer(PF, KUNDE);
    expect(GESPRAECH_ID.test(id)).toBe(true);
    expect(gespraechTeile(id)).toEqual({ quelle: 'whatsapp', postfach: PF, schluessel: KUNDE });
  });
  it('eingehend (zugelassen) → „Antworten“ mit Fenster offen, Frist erkannt; ausgehend ohne Antwort → „Warten auf“ + Nachfassen', () => {
    const g = waGespraecheBauen({ spiegel: spiegel(), postfachId: PF, bereich: 'ug', eigene: '4930000000', zuordnung: {}, zustand: {}, absender: { [`+${KUNDE}`]: { status: 'zugelassen' } }, heute: '2026-10-07', jetzt: T0 + 3600_000 });
    const a = g.find(x => x.whatsapp?.nummer === KUNDE)!;
    expect(a).toMatchObject({ quelle: 'whatsapp', bereich: 'ug', fach: 'antworten', ungelesen: true, inArbeit: true, gegenueber: { name: 'Erika Beispiel', email: `+${KUNDE}` } });
    expect(a.whatsapp!.fenster.offen).toBe(true);
    expect(a.betreff).toBe('Können wir bis Freitag sprechen?');
    expect(a.frist?.text).toMatch(/bis Freitag/);
    const w = g.find(x => x.whatsapp?.nummer === '4917700000000')!;
    expect(w).toMatchObject({ fach: 'warten', nachfassen: true });
    expect(w.whatsapp!.fenster.offen).toBe(false);
  });
  it('Screener (07.10. abends): unbekannte Nummer → „Neue Absender“; zugeordnet/zugelassen → Antworten; geblockt → aus der Arbeit; von uns angeschrieben nie neu', () => {
    const bau = (o: Partial<Parameters<typeof waGespraecheBauen>[0]> = {}) => waGespraecheBauen({ spiegel: spiegel(), postfachId: PF, bereich: 'ug', eigene: '', zuordnung: {}, zustand: {}, heute: '2026-10-07', jetzt: T0, ...o });
    const erika = (g: ReturnType<typeof bau>) => g.find(x => x.whatsapp?.nummer === KUNDE)!;
    expect(erika(bau())).toMatchObject({ fach: 'neu', absender: `+${KUNDE}`, inArbeit: true });
    expect(erika(bau({ zuordnung: { [KUNDE]: { kontaktId: 'c-erika', name: 'Erika Beispiel' } } })).fach).toBe('antworten');
    expect(erika(bau({ absender: { [`+${KUNDE}`]: { status: 'zugelassen' } } })).fach).toBe('antworten');
    expect(erika(bau({ absender: { [`+${KUNDE}`]: { status: 'geblockt' } } }))).toMatchObject({ fach: 'geblockt', inArbeit: false });
    // Gespräch, das wir mit einer Vorlage begonnen haben: nie „neu“ (Warten auf).
    expect(bau().find(x => x.whatsapp?.nummer === '4917700000000')!.fach).toBe('warten');
  });
  it('„erledigt bis jüngste“ nimmt es aus der Arbeit', () => {
    const g = waGespraecheBauen({ spiegel: spiegel(), postfachId: PF, bereich: 'ug', eigene: '', zuordnung: {}, zustand: { [gespraechIdFuer(PF, KUNDE)]: { erledigt: { bis: 'wamid.T1aaaaaa', am: J } } }, heute: '2026-10-07', jetzt: T0 });
    expect(g.find(x => x.whatsapp?.nummer === KUNDE)).toMatchObject({ inArbeit: false, offen: false });
  });
  it('Kopf: ganzer Text im Ausschnitt, gelesen bis → nicht mehr UNREAD, Medium als Anhang-Metadaten', () => {
    const n: WaNachricht = { id: 'wamid.B1aaaaaa', nummer: KUNDE, richtung: 'ein', am: J, art: 'bild', text: '', medium: { mediaId: '1', mime: 'image/jpeg', zustand: 'offen', groesse: 10 } };
    const k = kopfAus(n, { nummer: KUNDE, gelesenBis: J }, '', PF);
    expect(k.labels).toEqual(['INBOX']);
    expect(k.ausschnitt).toBe('[Bild]');
    expect(k.anhaenge).toEqual([{ teil: 'wa', name: 'Bild', typ: 'image/jpeg', groesse: 10 }]);
    expect(k.wa).toEqual({ art: 'bild', medium: 'offen' });
  });
  it('Betreff eines Chats: Anfang der jüngsten eingehenden Nachricht, gekürzt an einer Wortgrenze; ohne Text die Art', () => {
    const n = (id: string, text: string, richtung: 'ein' | 'aus' = 'ein', art: WaNachricht['art'] = 'text'): WaNachricht => ({ id, nummer: KUNDE, richtung, am: J, art, text });
    expect(betreffAus([n('a', 'Erste Frage'), n('b', 'Unsere Antwort', 'aus')])).toBe('Erste Frage');
    expect(betreffAus([n('a', 'Wort '.repeat(30))]).length).toBeLessThanOrEqual(60);
    expect(betreffAus([n('a', '', 'ein', 'bild')])).toBe('WhatsApp · Bild');
  });
  it('Zustand des Postfachs: Schlüssel abgelehnt → „anmeldung“, noch kein Webhook → „neu“', () => {
    expect(waPostfachZustand({ v: 1, token: { fehlerAt: J } }, 0).stufe).toBe('anmeldung');
    expect(waPostfachZustand({ v: 1 }, 0).stufe).toBe('neu');
    expect(waPostfachZustand({ v: 1, webhook: { zuletzt: J, anzahl: 1, abgelehnt: 0 } }, 3)).toMatchObject({ stufe: 'aktuell', at: J, nachrichten: 3 });
  });
});

describe('Zuordnung über die Telefonnummer (nur Vorschlag)', () => {
  const k = (id: string, telefon: string, extra: Partial<Kontakt> = {}) => ({ id, vorname: 'Erika', nachname: `Beispiel${id}`, telefon, ...extra }) as unknown as Kontakt;
  it('„0151 1234 5678“ in der Akte trifft wa_id 4915112345678; doppelte Nummer → keine Zuordnung', () => {
    expect(telefonSchluessel('0151 1234 5678')).toBe(KUNDE);
    const idx = telefonIndex([k('c-1', '0151 1234 5678'), k('c-2', '+49 30 111 222'), k('c-3', '030 111222')]);
    const z = waZuordnen(KUNDE, idx, { chancen: [], firmen: [] });
    expect(z).toMatchObject({ kontaktId: 'c-1' });
    expect(waZuordnen('4930111222', idx, { chancen: [], firmen: [] })).toBeNull();
  });
  it('eingeschränkt/Werbesperre stehen dabei (Anzeige ja, Verlauf/Senden nein)', () => {
    const idx = telefonIndex([k('c-1', '0151 1234 5678', { eingeschraenkt: { seit: '2026-10-01', grund: 'x' } as never })]);
    expect(waZuordnen(KUNDE, idx, { chancen: [], firmen: [] })?.sperre).toBe('eingeschraenkt');
  });
});

describe('Art. 17 über die Telefonnummer der Akte', () => {
  it('Nachrichten und Gesprächspartner der Person fallen weg, andere bleiben; Profilname zählt mit', () => {
    const s = webhookAnwenden(leererSpiegel(), webhook({ contacts: [{ profile: { name: 'Erika Beispiel' }, wa_id: '4917011111111' }], messages: [text('wamid.P1aaaaaa', 'Hallo', T0), text('wamid.P2aaaaaa', 'Hi', T0, '4917011111111'), text('wamid.Q1aaaaaa', 'Andere', T0, '4917099999999')] }), NR_ID, 'x').spiegel;
    const m = merkmaleVon('c-1', { vorname: 'Erika', nachname: 'Beispiel', telefon: '0151 1234 5678' });
    expect(m.telefone).toEqual([KUNDE]);
    const r = waOhnePerson(s as unknown as Record<string, unknown>, m, nenntPerson);
    const rest = r.neu as unknown as typeof s;
    expect(Object.keys(rest.nachrichten)).toEqual(['wamid.Q1aaaaaa']);
    expect(Object.keys(rest.kontakte)).toEqual(['4917099999999']);
    expect(r.n).toBe(4);
    expect(waOhnePerson(rest as unknown as Record<string, unknown>, m, nenntPerson).n).toBe(0);
  });
});

describe('Vorlagen und Eingaben', () => {
  it('Platzhalter und Vorschau', () => {
    expect(platzhalter('Hallo {{1}}, Termin am {{2}} — {{1}}')).toEqual(['1', '2']);
    expect(platzhalter('Hallo {{vorname}}')).toEqual(['vorname']);
    expect(vorlageFuellen('Hallo {{1}}, am {{2}}', ['Erika', 'Montag'])).toBe('Hallo Erika, am Montag');
  });
  it('Vorlage von Meta → unsere Form; nur APPROVED ist sendbar', () => {
    const v = vorlageAus({ name: 'termin_bestaetigung', language: 'de', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'HEADER', format: 'TEXT', text: 'Termin' }, { type: 'BODY', text: 'Hallo {{1}}, bis {{2}}.' }, { type: 'FOOTER', text: 'MAKE' }] })!;
    expect(v).toEqual({ name: 'termin_bestaetigung', sprache: 'de', status: 'APPROVED', kategorie: 'UTILITY', text: 'Hallo {{1}}, bis {{2}}.', parameter: ['1', '2'], kopf: 'Termin', fuss: 'MAKE' });
    expect(vorlageAus({ name: 'Böse Vorlage', language: 'de' })).toBeNull();
    expect(sendbareVorlage([v, { ...v, sprache: 'en_US', status: 'PENDING' }], 'termin_bestaetigung', 'en_US')).toBeNull();
    expect(sendbareVorlage([v], 'termin_bestaetigung', 'de')).toBe(v);
  });
  it('Eingabe frei/vorlage prüfen — leer, zu lang, ohne WhatsApp-Gespräch, fehlende Platzhalter', () => {
    const G = gespraechIdFuer(postfachIdFuer(NR_ID), KUNDE);
    expect(eingabePruefen({ gespraech: G, art: 'frei', text: '  Hallo  ' })).toMatchObject({ art: 'frei', text: 'Hallo' });
    expect(() => eingabePruefen({ gespraech: G, art: 'frei', text: '   ' })).toThrow(/Text/);
    expect(() => eingabePruefen({ gespraech: G, art: 'frei', text: 'x'.repeat(4097) })).toThrow(/zu lang/);
    expect(() => eingabePruefen({ gespraech: 'gm~abcdef1234', art: 'frei', text: 'x' })).toThrow(/Gespräch/);
    expect(eingabePruefen({ gespraech: G, art: 'vorlage', vorlage: { name: 'termin', sprache: 'de', parameter: ['a\nb'] } }).vorlage!.parameter).toEqual(['a b']);
    expect(() => eingabePruefen({ gespraech: G, art: 'vorlage', vorlage: { name: 'termin', sprache: 'de', parameter: [''] } })).toThrow(/Platzhalter/);
    expect(() => eingabePruefen({ gespraech: G, art: 'massen', text: 'x' })).toThrow();
  });
});

describe('Medien, Hosts, Version', () => {
  it('Prüfsumme hex oder base64; falsch → false', () => {
    const b = Buffer.from('datei');
    const d = createHash('sha256').update(b).digest();
    expect(pruefsummeOk(b, d.toString('hex'))).toBe(true);
    expect(pruefsummeOk(b, d.toString('base64'))).toBe(true);
    expect(pruefsummeOk(b, undefined)).toBe(true);
    expect(pruefsummeOk(b, 'a'.repeat(64))).toBe(false);
  });
  it('Dateiname ohne Nummer/Kennung, passt zur Ablage', () => { expect(dateiFuer('wamid.T1aaaaaa')).toMatch(/^[0-9a-f]{40}\.bin$/); });
  it('Schlüssel geht nur an Meta-Hosts über https', () => {
    expect(medienAdresseOk('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1')).toBe(true);
    expect(medienAdresseOk('http://lookaside.fbsbx.com/x')).toBe(false);
    expect(medienAdresseOk('https://fbsbx.com.boese.example/x')).toBe(false);
    expect(medienAdresseOk('https://user:pw@lookaside.fbsbx.com/x')).toBe(false);
  });
  it('Graph-Version an EINER Stelle', () => { expect(GRAPH_BASIS).toBe(`https://graph.facebook.com/${GRAPH_VERSION}`); expect(GRAPH_VERSION).toMatch(/^v\d+\.0$/); });
});

describe('Einrichtung aus der Umgebung', () => {
  const env = (o: Record<string, string> = {}) => ({ [WA_ENV.telefonnummerId]: NR_ID, [WA_ENV.wabaId]: '200300400500600', [WA_ENV.zugriff]: 'EAAG' + 'x'.repeat(120), [WA_ENV.appGeheimnis]: GEHEIM, [WA_ENV.verifyToken]: 'v'.repeat(48), ...o }) as unknown as NodeJS.ProcessEnv;
  it('vollständig → Konfig mit Vorgabe-Bereich ug, Postfach-Kennung', () => {
    const k = whatsappKonfig(env())!;
    expect(k).toMatchObject({ telefonnummerId: NR_ID, bereich: 'ug', personen: null, postfachId: postfachIdFuer(NR_ID) });
  });
  it('fehlende Werte → nur Namen; Privat ist nie ein zulässiger Bereich', () => {
    expect(whatsappFehlend({} as unknown as NodeJS.ProcessEnv)).toEqual(expect.arrayContaining([WA_ENV.telefonnummerId, WA_ENV.zugriff, WA_ENV.appGeheimnis, WA_ENV.verifyToken]));
    expect(whatsappKonfig(env({ [WA_ENV.bereich]: 'privat' }))).toBeNull();
    expect(whatsappFehlend(env({ [WA_ENV.bereich]: 'kdc' }))).toContain(WA_ENV.bereich);
    expect(bereichZulaessig('privat')).toBe(false);
    expect(bereichZulaessig('kdv')).toBe(true);
    expect(whatsappKonfig(env({ [WA_ENV.personen]: 'kevin, malin,BÖSE' }))!.personen).toEqual(['kevin', 'malin']);
  });
});
