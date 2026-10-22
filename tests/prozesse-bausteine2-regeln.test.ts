// ─── Prozesse · Bausteine mit eigenem Weg (22.10. spät) — die reinen Regeln ─────────────────────────────────────────────────────────────────────────────
// lib/prozesse/lauf-regeln.ts (Plan je Knoten: Vorschlag mit Wirkung statt Aufgabe, Schloss mit Wirkung, „nichts zu tun“, Übernahme abgelehnt → weiter),
// lib/prozesse/kundengewinnung/text-geruest.ts (Gerüst eines Text-Entwurfs ohne Text), lib/prozesse/kundengewinnung/raute-felder.ts (welche Felder eine
// Definition liest). Nur erfundene Werte, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { voran, nachAktion, starten, freigabeEntschieden, probeZeilen, type LaufUmfeld, type StartAnfrage, type Empfaenger } from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe, type ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import type { MaskenWert, ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import { textGeruest, gruss } from '@/lib/prozesse/kundengewinnung/text-geruest';
import { gelesenFelder, istLaufFeld } from '@/lib/prozesse/kundengewinnung/raute-felder';
import { definition, fk, schritt, PZ, J } from './fixtures/prozess-bau';

const lid = (n: number) => `pl-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const an: Empfaenger = { kontaktId: 'c-erika', name: 'Erika Probe', email: 'erika@example.invalid', telefon: '+49 000 0000000' };
const umfeld = (extra: Partial<LaufUmfeld> = {}): LaufUmfeld => ({ jetzt: J, titel: 'Probe', daten: {}, teilprozess: () => ({ version: 1 }), empfaenger: () => an, ...extra });
function lauf(def: ProzessDefinition, o: Partial<StartAnfrage> = {}): ProzessLauf {
  const r = starten(leereLaeufe(), { id: lid(1), prozessId: PZ, version: 1, def, fall: { art: 'keiner' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, periode: 'p1', jetzt: J, ...o });
  if (!r.ok) throw new Error(r.grund);
  return r.lauf;
}
const ende = (n: number, rang: number) => schritt(n, 'Ende', rang, { form: 'ende', ende: { ergebnis: 'erfolg' } });
const ein = (id: string, werte: Record<string, MaskenWert> = {}): Partial<ProzessKnoten<ProzessForm>> => ({ katalog: { id, ...(Object.keys(werte).length ? { werte } : {}) } });

describe('Text-Gerüst (Text-Entwurf ohne Text)', () => {
  it('Anrede aus der Akte (Sie/Du), ohne Namen nie „undefined“', () => {
    expect(gruss({ 'kontakt.anrede': 'Sie', 'kontakt.vorname': 'Erika', 'kontakt.nachname': 'Probe' })).toBe('Guten Tag Erika Probe,');
    expect(gruss({ 'kontakt.anrede': 'Du', 'kontakt.vorname': 'Erika' })).toBe('Hallo Erika,');
    expect(gruss({})).toBe('Guten Tag,');
    for (const art of ['nachricht_entwurf', 'anruf_leitfaden', 'einladung_entwurf', 'danke_entwurf']) expect(textGeruest({ art, titel: 'x', p: {} })).not.toMatch(/undefined|null/);
  });
  it('Anruf-Leitfaden: Anlass, offene Kernfragen des Leads, nächster Schritt des Deals; Einladung nennt das Event; unbekannte Art → leer', () => {
    const t = textGeruest({ art: 'anruf_leitfaden', anlass: 'Gestelltes Angebot', titel: 'Nachfassen', p: { 'kontakt.anrede': 'Sie', 'kontakt.nachname': 'Probe', 'deal.titel': 'Beispiel-Deal', 'deal.naechster-schritt': 'Termin vereinbaren', 'lead.offene-fragen': 'Entscheider · Budget' } });
    expect(t).toContain('Anlass: Gestelltes Angebot');
    expect(t).toContain('· Entscheider');
    expect(t).toContain('· Budget');
    expect(t).toContain('Nächster Schritt: Termin vereinbaren');
    expect(t).toContain('„Beispiel-Deal“');
    expect(textGeruest({ art: 'einladung_entwurf', titel: 'x', p: { 'event.titel': 'Beispiel-Abend', 'event.datum': '2026-11-05', 'kontakt.anrede': 'Du', 'kontakt.vorname': 'Erika' } })).toMatch(/„Beispiel-Abend“ am 05\.11\.2026[\s\S]*dabei bist/);
    expect(textGeruest({ art: 'beitrag_entwurf', titel: 'x', p: {} })).toBe('');
  });
});

describe('Bausteine mit eigenem Weg: ein Vorschlag, der nach der Freigabe selbst wirkt', () => {
  it('Gäste vorschlagen (Fall Event): Vorschlag mit Wirkung „Gästeliste“ und der Mischung der Maske; ohne Event übersprungen', () => {
    const d = definition([schritt(10, 'Gäste vorschlagen', 1, ein('event.gaeste', { n: 8, mixZielkunden: 50, mixKunden: 25 })), ende(11, 2)], { fallArt: 'event' });
    const r = voran(lauf(d, { fall: { art: 'event', id: 'ev-1' } }), d, umfeld());
    expect(r.aktion).toMatchObject({ art: 'vorschlag', sorte: 'freigabe', wirkung: { art: 'crm', eingabe: { art: 'gaesteliste', event: 'ev-1' }, gaeste: { n: 8, zielkunden: 50, kunden: 25 } } });
    // Ersatz „von Hand“ ist vorbereitet (der Server entscheidet beim Vorlegen, welches gilt).
    expect(r.aktion).toMatchObject({ danach: { titel: 'Von Hand: Gäste vorschlagen' } });
    const o = voran(lauf(d), d, umfeld());
    expect(o.lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'daten-fehlen' });
  });
  it('Kampagnen-Ergebnis (Teil-Lauf einer Kampagne): Kampagne aus dem Bezug, Person aus dem Fall, Vorgabe der Maske; ohne Vorgabe leitet der Server ab', () => {
    const d = definition([schritt(10, 'Ergebnis setzen', 1, ein('crm.kampagnen-ergebnis', { ergebnis: 'reagiert' })), ende(11, 2)], { fallArt: 'lead' });
    const l = { ...lauf(d, { fall: { art: 'lead', id: 'c-erika' } }), daten: { 'bezug.kampagneid': 'kp-1' } };
    expect(voran(l, d, umfeld()).aktion).toMatchObject({ wirkung: { art: 'crm', eingabe: { art: 'kampagnen_ergebnis', kampagne: 'kp-1', kontakt: 'c-erika', ergebnis: 'reagiert' } } });
    const o = definition([schritt(10, 'Ergebnis setzen', 1, ein('crm.kampagnen-ergebnis')), ende(11, 2)], { fallArt: 'lead' });
    const w = voran({ ...l, schritte: [] }, o, umfeld()).aktion as { wirkung: { eingabe: Record<string, unknown> } };
    expect(w.wirkung.eingabe.ergebnis).toBeUndefined();
    expect(voran(lauf(o, { fall: { art: 'lead', id: 'c-erika' } }), o, umfeld()).lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'daten-fehlen' });
  });
  it('Anfrage übernehmen: nur mit einem Webhook-Eingang im Lauf (die Felder liest der Server); Fall starten: Deal bzw. Mandat des Falls', () => {
    const d = definition([schritt(10, 'Anfrage übernehmen', 1, ein('crm.anfrage-anlegen', { kanal: 'website' })), ende(11, 2)], { fallArt: 'lead' });
    const l = { ...lauf(d), daten: { 'bezug.eingangid': 'we-1' } };
    expect(voran(l, d, umfeld()).aktion).toMatchObject({ wirkung: { art: 'crm', eingabe: { art: 'anfrage_anlegen', kanal: 'website' }, webhook: true } });
    expect(voran(lauf(d), d, umfeld()).lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'daten-fehlen' });
    const f = definition([schritt(20, 'Fall starten', 1, ein('fulfillment.fall-starten')), ende(21, 2)]);
    expect(voran(lauf(f, { fall: { art: 'deal', id: 'ch-1' } }), f, umfeld()).aktion).toMatchObject({ art: 'vorschlag', wirkung: { art: 'fulfillment', dealId: 'ch-1' } });
  });
  it('Mandat anlegen (Klasse geld): der Schritt bereitet vor, das Schloss IST der Klick — mit Wirkung „Mandat aus dem Deal“; Termin mit Einladung: Gast aus dem Fall', () => {
    const d = schlossSetzen(definition([schritt(10, 'Mandat anlegen', 1, ein('crm.mandat-anlegen')), ende(11, 2)])).definition;
    const l = lauf(d, { fall: { art: 'deal', id: 'ch-1' } });
    const r = voran(l, d, umfeld());
    expect(r.lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'erledigt', grund: 'vorbereitet' });
    expect(r.aktion).toMatchObject({ art: 'vorschlag', wirkung: { art: 'crm', eingabe: { art: 'mandat_anlegen', deal: 'ch-1' } } });
    const t = schlossSetzen(definition([schritt(20, 'Kickoff', 1, { form: 'termin', ...ein('kalender.einladung', { titel: 'Auftakt', gaeste: 'fall.ansprechpartner', dauerMin: 60 }) }), ende(21, 2)])).definition;
    const lt = lauf(t, { fall: { art: 'deal', id: 'ch-1' } });
    expect(voran(lt, t, umfeld()).aktion).toMatchObject({ wirkung: { art: 'termin', titel: 'Auftakt', dauerMin: 60, an: { kontaktId: 'c-erika', email: 'erika@example.invalid' }, bezug: { dealId: 'ch-1' } } });
    // Ohne Adresse kein eigener Weg — dann bleibt es bei Freigabe + Aufgabe „von Hand“.
    const ohne = voran(lt, t, umfeld({ empfaenger: () => ({ kontaktId: 'c-erika', name: 'Erika Probe' }) })).aktion as { wirkung?: unknown; danach?: unknown };
    expect(ohne.wirkung).toBeUndefined();
    expect(ohne.danach).toBeTruthy();
  });
  it('im Probelauf (Schatten): „würde zur Freigabe vorlegen“ und weiter — nichts geschrieben, kein Halt', () => {
    const d = definition([schritt(10, 'Gäste vorschlagen', 1, ein('event.gaeste')), schritt(11, 'Fall starten', 2, ein('fulfillment.fall-starten')), ende(12, 3)], { fallArt: 'event' });
    const l = { ...lauf(d, { fall: { art: 'event', id: 'ev-1' }, modus: 'schatten' }), daten: { 'bezug.dealid': 'ch-1' } };
    const r = voran(l, d, umfeld(), 'schatten');
    expect(r.lauf.status).toBe('fertig');
    expect(probeZeilen(r.lauf, d).schritte.filter(z => z.status === 'freigabe').map(z => z.text)).toEqual(['würde zur Freigabe vorlegen: Gäste vorschlagen', 'würde zur Freigabe vorlegen: Fall starten']);
  });
});

describe('Ergebnis und Freigabe der Übernahme-Vorschläge', () => {
  const d = definition([schritt(10, 'Fall starten', 1, ein('fulfillment.fall-starten')), schritt(11, 'Danach', 2, ein('glocke.melden', { text: 'x' })), ende(12, 3)]);
  it('„nichts zu tun“ (schon erledigt): der Lauf wartet nicht — der Schritt ist übersprungen, es geht weiter', () => {
    const r = voran(lauf(d, { fall: { art: 'deal', id: 'ch-1' } }), d, umfeld());
    const n = nachAktion(r.lauf, d, r.aktion!, { ok: true, weiter: true, hinweis: 'schon-erledigt' }, J);
    expect(n.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'schon-erledigt', ausgang: 'weiter' });
    expect(n).toMatchObject({ status: 'laeuft', aktuell: fk(11) });
    expect(n.wartet).toBeUndefined();
  });
  it('am Schloss heißt „nichts zu tun“ ja (z. B. Mandat schon da): weiter auf dem Weg nach der Freigabe', () => {
    const s = schlossSetzen(definition([schritt(10, 'Mandat anlegen', 1, ein('crm.mandat-anlegen')), schritt(11, 'Weiter', 2, ein('glocke.melden', { text: 'x' })), ende(12, 3)])).definition;
    const r = voran(lauf(s, { fall: { art: 'deal', id: 'ch-1' } }), s, umfeld());
    const n = nachAktion(r.lauf, s, r.aktion!, { ok: true, weiter: true, hinweis: 'schon-erledigt' }, J);
    expect(n).toMatchObject({ status: 'laeuft', aktuell: fk(11) });
  });
  it('freigegeben → weiter; abgelehnt bzw. abgelaufen → ebenfalls weiter (übersprungen mit Grund) — die nächsten Rauten lesen den echten Stand', () => {
    const r = voran(lauf(d, { fall: { art: 'deal', id: 'ch-1' } }), d, umfeld());
    const w = nachAktion(r.lauf, d, r.aktion!, { ok: true, wirkung: [{ art: 'vorschlag', id: 'v-1' }] }, J);
    expect(w).toMatchObject({ status: 'wartet', wartet: { art: 'freigabe' } });
    const kennung = w.wartet!.wirkung!;
    expect(freigabeEntschieden(w, d, kennung, 'ja', J)).toMatchObject({ status: 'laeuft', aktuell: fk(11) });
    const nein = freigabeEntschieden(w, d, kennung, 'nein', J);
    expect(nein).toMatchObject({ status: 'laeuft', aktuell: fk(11) });
    expect(nein.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'abgelehnt' });
    expect(freigabeEntschieden(w, d, kennung, 'abgelaufen', J).schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'abgelaufen' });
  });
  it('eine Entscheidung (Mensch) bleibt, wie sie war: abgelehnt = nein', () => {
    const e = definition([
      schritt(10, 'Weiter?', 1, { form: 'entscheidung', ...ein('entscheidung.mensch', { frage: 'Weiter?', wer: 'pia' }), zweige: { nein: fk(12) } }),
      ende(11, 2), schritt(12, 'Nein', 3, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
    ]);
    const r = voran(lauf(e), e, umfeld({ person: () => 'pia' }));
    const w = nachAktion(r.lauf, e, r.aktion!, { ok: true, wirkung: [{ art: 'vorschlag', id: 'v-2' }] }, J);
    expect(freigabeEntschieden(w, e, w.wartet!.wirkung!, 'nein', J).schritte.at(-1)!.knoten).toBe(fk(12));
  });
});

describe('Karte ergänzen ohne Agent davor', () => {
  const d = definition([schritt(10, 'Karte', 1, ein('crm.karte-ergaenzen', { ziel: 'firma', felder: ['branche', 'webseite'] })), ende(11, 2)], { fallArt: 'firma' });
  it('Felder vom Agenten davor → erledigt; frische Recherche → übersprungen; alles schon in der Akte → nichts zu tun; sonst eine Aufgabe nur für die fehlenden Felder', () => {
    const l = lauf(d, { fall: { art: 'firma', id: 'f-1' } });
    expect(voran({ ...l, daten: { 'agent.felder': '2' } }, d, umfeld()).lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'erledigt', grund: 'vorbereitet' });
    const frisch = { ...l, aktuell: fk(10), schritte: [{ knoten: fk(9), status: 'uebersprungen' as const, ab: J, bis: J, grund: 'recherche-frisch' as const }] };
    expect(voran(frisch, d, umfeld()).lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'recherche-frisch' });
    expect(voran(l, d, umfeld({ karteLuecken: () => [] })).lauf.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'uebersprungen', grund: 'schon-erledigt' });
    const a = voran(l, d, umfeld({ karteLuecken: (_z, f) => f.filter(x => x === 'webseite') })).aktion;
    expect(a).toMatchObject({ art: 'aufgabe', titel: 'Karte ergänzen: Karte' });
    expect((a as { beschreibung: string }).beschreibung).toContain('Es fehlen: Webseite (Firma)');
    expect((a as { beschreibung: string }).beschreibung).not.toContain('Branche');
  });
});

describe('Welche Felder eine Definition liest', () => {
  it('Regel- und Score-Rauten, „nur wenn …“ an Auslöser und Warten; Lauf-Felder erkennbar', () => {
    const d = definition([
      schritt(10, 'Warm?', 1, { form: 'entscheidung', ...ein('entscheidung.score'), raute: { art: 'score', pruefung: 'temperatur', temperatur: ['warm'] }, zweige: { nein: fk(13) } }),
      schritt(11, 'Fach?', 2, { form: 'entscheidung', ...ein('entscheidung.regel'), raute: { art: 'regel', bedingungen: [{ feld: 'lead.mail-fach', op: 'einer-von', wert: ['antworten'] }, { feld: 'agent.fit', op: 'groesser', wert: 1 }] }, zweige: { nein: fk(13) } }),
      schritt(12, 'Warten', 3, { form: 'warten', ...ein('warten.ereignis'), warten: { art: 'ereignis', ereignis: 'neue-mail', hoechstensTage: 2, bedingungen: [{ feld: 'lead.status', op: 'gleich', wert: 'neu' }] } }),
      ende(13, 4),
    ], { fallArt: 'lead' });
    const f = gelesenFelder(d);
    expect(f.map(x => x.feld)).toEqual(['lead.temperatur', 'lead.mail-fach', 'agent.fit', 'lead.status']);
    expect(f.filter(x => !istLaufFeld(x.feld)).map(x => x.wo)).toEqual(['raute', 'raute', 'warten']);
  });
});
