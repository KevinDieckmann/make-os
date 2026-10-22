// ─── Prozesse · Werkstatt bau-fertig — Testdaten, „Weg annehmen“, Ausgabe, Ausschalten (22.10.; research/prozesse/WERKSTATT_BAUFERTIG.md Punkte 6–11, 14) ──────
// Rein: Testdaten nur erfunden (Prüfung + Säuberer, ohne Feld bit-gleich), Schreibweg `testdaten`, Testwerte und Webhook-Beispiel aus dem Schema, „Weg annehmen“ im
// Schatten (scharf nie), Ausgabe eines Schritts (würde senden … an …, JSON nur Kennungen), Vorschau im großen Fenster, ausgeschaltete Schritte im Motor und im Säuberer.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eintragAus, knotenAus, werkstattAnwenden, neuerProzess, prozesseAus } from '@/lib/prozesse/bestand';
import { fulfillmentModusBefunde } from '@/lib/prozesse/fulfillment-modus';
import {
  testdatenPruefen, testdatenAus, testWerte, webhookBeispiel, annahmeOptionen, annahmenAusLauf, nichtErfunden, BEISPIEL_PLATZHALTER, BEISPIEL_EMPFAENGER_WERTE,
} from '@/lib/prozesse/testdaten';
import { voran, probeAusgabe, probeZeilen, type LaufUmfeld, type ProbeBeobachtung } from '@/lib/prozesse/lauf-regeln';
import { ausgabeVorschau } from '@/lib/prozesse/werkstatt-ausgabe';
import { hinweiseVon } from '@/lib/prozesse/werkstatt-hinweise';
import { schlossSetzen, schlossKennung } from '@/lib/prozesse/schloss';
import type { ProzessEintrag, ProzessDefinition } from '@/lib/prozesse/definition';
import type { ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, schritt, fk, PZ, J } from './fixtures/prozess-bau';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const rechte = { entwurf: true, veroeffentlichen: true, status: true, webhook: true } as never;
const kx = { person: 'pia', jetzt: J, rechte, standVon: (e: ProzessEintrag) => String(JSON.stringify(e).length), neueKennung: (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-8000-00000000ff01` };

describe('Testdaten — nur erfundene Werte', () => {
  it('nimmt erfundene Werte an (Platzhalter, Felder, Empfänger unter .invalid, Platzhalter-Telefon, Wege als Kennungen); leer → null', () => {
    const r = testdatenPruefen({ platzhalter: { 'kontakt.vorname': 'Tina', 'firma.name': 'Probe AG' }, felder: { 'lead.score': 72, 'deal.stufe': 'angebot', 'fall.termin': '2026-11-05' },
      empfaenger: { name: 'Tina Probe', email: 'tina@probe.invalid', telefon: '+49 000 0000000' }, annahmen: { [fk(12)]: 'nein' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.testdaten).toMatchObject({ empfaenger: { email: 'tina@probe.invalid' }, annahmen: { [fk(12)]: 'nein' } });
    expect(testdatenPruefen({ platzhalter: { 'kontakt.vorname': '' }, felder: {} })).toEqual({ ok: true, testdaten: null });
  });
  it('lehnt echte Daten ab — Adresse außerhalb von .invalid, echte Telefonnummer, IBAN, Webhook-Felder (fremder Text), unbekannte Platzhalter', () => {
    for (const roh of [
      { empfaenger: { email: 'person@firma.de' } },
      { platzhalter: { 'kontakt.vorname': 'schreib an person@firma.de' } },
      { empfaenger: { telefon: '0151 1234567' } },
      { felder: { 'lead.status': 'Tel. +49 151 1234567' } },
      { felder: { 'lead.status': 'DE89 3704 0044 0532 0130 00' } },
      { platzhalter: { 'webhook.firma': 'Probe' } },
      { platzhalter: { 'gibt.es.nicht': 'x' } },
      { annahmen: { [fk(12)]: 'vielleicht' } },
    ]) expect(testdatenPruefen(roh).ok, JSON.stringify(roh)).toBe(false);
    expect(nichtErfunden('2026-11-05')).toBeNull();
    expect(nichtErfunden('+49 000 0000000')).toBeNull();
    expect(testdatenPruefen({ felder: Object.fromEntries(Array.from({ length: 121 }, (_, i) => [`lead.f${i}`, 'x'])) })).toMatchObject({ ok: false, status: 413 });
  });
  it('Säuberer: ohne Feld bit-gleich, gültige Testdaten bleiben, ungültige fallen ganz weg (nie ein Absturz)', () => {
    const e = neuerProzess({ id: PZ, titel: 'Probe', bereich: 'sales', fallArt: 'deal', von: 'pia', jetzt: J, kennung: (() => { let n = 100; return () => fk(++n); })() });
    const roh = JSON.parse(JSON.stringify(e)) as Record<string, unknown>;
    const gelesen = eintragAus(roh)!;
    expect('testdaten' in gelesen).toBe(false);
    expect(JSON.stringify(eintragAus(JSON.parse(JSON.stringify(gelesen))))).toBe(JSON.stringify(gelesen));
    expect(eintragAus({ ...roh, testdaten: { platzhalter: { 'kontakt.vorname': 'Tina' } } })?.testdaten).toEqual({ platzhalter: { 'kontakt.vorname': 'Tina' } });
    expect(eintragAus({ ...roh, testdaten: { empfaenger: { email: 'person@firma.de' } } })?.testdaten).toBeUndefined();
    expect(testdatenAus('kaputt')).toBeUndefined();
    expect(prozesseAus({ v: 1, prozesse: [roh] }).prozesse[0]).toEqual(gelesen);
  });
  it('Schreibweg `testdaten`: gespeichert mit wann/wer, nicht erfunden → 400, nichts gespeichert; null leert; archiviert → 409', () => {
    const e = neuerProzess({ id: PZ, titel: 'Probe', bereich: 'sales', fallArt: 'deal', von: 'pia', jetzt: J, kennung: (() => { let n = 200; return () => fk(++n); })() });
    const datei = { v: 1 as const, prozesse: [e] };
    const st = kx.standVon(e);
    const ok = werkstattAnwenden(datei, { aktion: 'testdaten', id: PZ, stand: st, testdaten: { platzhalter: { 'kontakt.vorname': 'Tina' } } }, kx);
    expect(ok.ok && ok.eintrag.testdaten).toMatchObject({ platzhalter: { 'kontakt.vorname': 'Tina' }, am: J, von: 'pia' });
    const nein = werkstattAnwenden(datei, { aktion: 'testdaten', id: PZ, stand: st, testdaten: { empfaenger: { email: 'person@firma.de' } } }, kx);
    expect(nein).toMatchObject({ ok: false, status: 400 });
    if (!ok.ok) return;
    const leer = werkstattAnwenden(ok.datei, { aktion: 'testdaten', id: PZ, stand: kx.standVon(ok.eintrag), testdaten: null }, kx);
    expect(leer.ok && leer.eintrag.testdaten).toBeUndefined();
    const arch = { v: 1 as const, prozesse: [{ ...e, status: 'archiviert' as const }] };
    expect(werkstattAnwenden(arch, { aktion: 'testdaten', id: PZ, stand: kx.standVon(arch.prozesse[0]), testdaten: null }, kx)).toMatchObject({ ok: false, status: 409 });
  });
  it('Testwerte: Beispiel ∪ eigene Testdaten; ein Webhook bekommt sein Beispiel aus dem Felder-Schema (nie ein echter Eingang)', () => {
    const tw = testWerte({ testdaten: { platzhalter: { 'kontakt.vorname': 'Tina' }, empfaenger: { email: 'tina@probe.invalid' } }, titel: 'Probe', heute: '2026-10-22' });
    expect(tw.platzhalter['kontakt.vorname']).toBe('Tina');
    expect(tw.platzhalter['kontakt.nachname']).toBe(BEISPIEL_PLATZHALTER['kontakt.nachname']);
    expect(tw.platzhalter['prozess.titel']).toBe('Probe');
    expect(tw.empfaenger).toMatchObject({ name: BEISPIEL_EMPFAENGER_WERTE.name, email: 'tina@probe.invalid' });
    const wh = webhookBeispiel([{ id: 'firma', art: 'text' }, { id: 'mail', art: 'email' }, { id: 'n', art: 'zahl' }, { id: 'ok', art: 'ja-nein' }, { id: 'wahl', art: 'auswahl', optionen: ['a', 'b'] }]);
    expect(wh).toEqual({ 'webhook.firma': 'Beispiel firma', 'webhook.mail': 'beispiel@example.invalid', 'webhook.n': 1, 'webhook.ok': true, 'webhook.wahl': 'a' });
  });
});

/** Ein Schatten-Lauf ohne Server: dieselben Regeln wie der Probelauf. */
function schatten(def: ProzessDefinition, u: Partial<LaufUmfeld> = {}, modus: 'schatten' | 'scharf' = 'schatten') {
  const lauf: ProzessLauf = { id: 'pl-00000000-0000-4000-8000-000000000000', prozessId: PZ, version: 1, fall: { art: 'deal', id: 'ch-1' }, bereich: 'sales', schluessel: 'x', durchgang: 1, modus,
    status: 'laeuft', person: 'pia', ausloeser: { art: 'hand' }, tiefe: 0, daten: {}, start: J, geaendert: J, aktuell: null, schritte: [], kostenCent: 0 };
  return voran(lauf, def, { jetzt: J, titel: 'Probe', daten: {}, ...u }, modus);
}
const WEG = definition([
  schritt(10, 'Anrufen', 1),
  schritt(12, 'Passt es?', 2, { form: 'entscheidung', zweige: { nein: fk(20) } }),
  schritt(13, 'Fertig', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(20, 'Abgesagt', 4, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
]);

describe('„Weg annehmen“ (Punkt 9) — nur im Schatten', () => {
  it('ohne Annahme der Hauptweg; mit „nein“ der andere Weg; scharf liest die Annahme nie', () => {
    const haupt = schatten(WEG).lauf.schritte.map(s => s.knoten);
    expect(haupt).toContain(fk(13));
    const nein = schatten(WEG, { annahme: id => (id === fk(12) ? 'nein' : undefined) }).lauf.schritte.map(s => s.knoten);
    expect(nein).toContain(fk(20));
    expect(nein).not.toContain(fk(13));
    // Scharf: der Lauf hält an der ersten Wirkung (Aufgabe) — die Annahme ändert nichts.
    const scharf = schatten(WEG, { annahme: () => 'nein' }, 'scharf');
    expect(scharf.aktion?.art).toBe('aufgabe');
  });
  it('Raute nach Regel: die Annahme schlägt die Daten; Warten: abgelaufen statt eingetreten; unpassende Annahmen wirken nicht', () => {
    const REGEL = definition([
      schritt(12, 'Score hoch?', 1, { form: 'entscheidung', raute: { art: 'regel', bedingungen: [{ feld: 'deal.wert', op: 'groesser', wert: '500' }] }, zweige: { nein: fk(20) } }),
      schritt(13, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
      schritt(20, 'Klein', 3, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
    ]);
    expect(schatten(REGEL, { daten: { 'deal.wert': 1000 } }).lauf.schritte.map(s => s.knoten)).toContain(fk(13));
    expect(schatten(REGEL, { daten: { 'deal.wert': 1000 }, annahme: id => (id === fk(12) ? 'nein' : undefined) }).lauf.schritte.map(s => s.knoten)).toContain(fk(20));
    expect(schatten(REGEL, { daten: { 'deal.wert': 1000 }, annahme: () => 'abgelaufen' }).lauf.schritte.map(s => s.knoten)).toContain(fk(13));
    const WARTEN = definition([
      schritt(30, 'Auf Antwort warten', 1, { form: 'warten', warten: { art: 'ereignis', ereignis: 'deal-stufe', hoechstensTage: 3 }, zweige: { abgelaufen: fk(32) } }),
      schritt(31, 'Weiter', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
      schritt(32, 'Nachfassen', 3, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
    ]);
    expect(schatten(WARTEN).lauf.schritte.map(s => s.knoten)).toContain(fk(31));
    expect(schatten(WARTEN, { annahme: () => 'abgelaufen' }).lauf.schritte.map(s => s.knoten)).toContain(fk(32));
  });
  it('Optionen je Form, und der Weg eines Laufs wird zu Annahmen (nur Kennungen, nur Rauten/Freigaben/Warten)', () => {
    expect(annahmeOptionen({ form: 'entscheidung' }).map(o => o.ausgang)).toEqual(['ja', 'nein']);
    expect(annahmeOptionen({ form: 'freigabe' }).map(o => o.ausgang)).toEqual(['ja', 'nein', 'abgelaufen']);
    expect(annahmeOptionen({ form: 'warten', warten: { art: 'dauer', tage: 2 } })).toEqual([]);
    expect(annahmeOptionen({ form: 'schritt' })).toEqual([]);
    const a = annahmenAusLauf([{ knoten: fk(10), ausgang: 'weiter' }, { knoten: fk(12), ausgang: 'nein' }, { knoten: fk(99), ausgang: 'ja' }], WEG.knoten);
    expect(a).toEqual({ [fk(12)]: 'nein' });
  });
});

describe('Ausgabe eines Schritts (Punkt 10) — würde senden … an …, JSON nur Kennungen', () => {
  const MAIL = schlossSetzen(definition([
    schritt(30, 'Danke-Mail', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'gmail', an: 'fall.kontakt', betreff: 'Danke, {{kontakt.vorname}}', text: 'Schön, {{firma.name}}.' } } }),
    schritt(31, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ])).definition;
  it('die Mail hinter dem Schloss: „würde senden … erst nach der Freigabe“, Empfänger und gefüllter Text in der Tabelle — im JSON keine Namen, keine Adressen', () => {
    const beob = new Map<string, ProbeBeobachtung>();
    const r = schatten(MAIL, {
      platzhalter: { 'kontakt.vorname': 'Tina', 'firma.name': 'Probe AG' }, empfaenger: () => ({ kontaktId: 'c-beispiel', name: 'Tina Probe', email: 'tina@probe.invalid' }),
      beobachte: b => { beob.set(b.knoten, b); },
    });
    const sl = schlossKennung(fk(30));
    const z = probeZeilen(r.lauf, MAIL).schritte.map(x => x.knotenId);
    expect(z).toEqual(expect.arrayContaining([fk(30), sl]));
    const a = probeAusgabe(beob.get(sl)!, MAIL);
    const tabelle = a.zeilen.map(x => `${x.feld}: ${x.wert}`).join('\n');
    expect(tabelle).toMatch(/würde senden \(Mail\) — erst nach der Freigabe/);
    expect(tabelle).toContain('Tina Probe <tina@probe.invalid>');
    expect(tabelle).toContain('Betreff: Danke, Tina');
    const json = JSON.stringify(a.json);
    expect(json).toContain('"kanal":"mail"');
    expect(json).toContain('"an":"c-beispiel"');
    for (const x of ['Tina', '@', 'Probe AG']) expect(json).not.toContain(x);
    expect(a.json.schloss).toBe(true);
  });
  it('Vorschau im großen Fenster: rein aus den Testwerten; Raute nach Regel zeigt jede Bedingung; ausgeschaltet sagt es', () => {
    const tw = testWerte({ testdaten: { platzhalter: { 'kontakt.vorname': 'Tina' } } });
    const m = MAIL.knoten.find(k => k.id === fk(30))!;
    const v = ausgabeVorschau(m, MAIL, tw);
    expect(v.satz).toMatch(/würde senden \(Mail\)/);
    expect(v.schloss).toBe(true);
    expect(v.zeilen.find(x => x.feld === 'Betreff')?.wert).toBe('Danke, Tina');
    const r = { id: fk(50), titel: 'Wert hoch?', rang: 1, form: 'entscheidung' as const, raute: { art: 'regel' as const, bedingungen: [{ feld: 'deal.wert', op: 'groesser' as const, wert: '500' }] } };
    const rv = ausgabeVorschau(r, MAIL, tw);
    expect(rv.satz).toMatch(/→ ja/);
    expect(rv.zeilen[0].wert).toBe('erfüllt');
    expect(ausgabeVorschau({ ...m, deaktiviert: true }, MAIL, tw).satz).toMatch(/ausgeschaltet/);
  });
});

describe('Ausschalten (Punkt 14) — Motor, Säuberer, Rückweg', () => {
  it('ein ausgeschalteter Schritt wird übersprungen (Grund „deaktiviert“); sein Schloss mit — und der Lauf geht über den Hauptweg weiter', () => {
    const MAIL = schlossSetzen(definition([
      schritt(30, 'Danke-Mail', 1, { form: 'nachricht', deaktiviert: true, katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'gmail', an: 'fall.kontakt', betreff: 'Danke', text: 'Danke.' } } }),
      schritt(31, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
    ])).definition;
    const sl = schlossKennung(fk(30));
    expect(MAIL.knoten.some(k => k.id === sl)).toBe(true); // das Schloss fällt nie still weg
    const r = schatten(MAIL, { empfaenger: () => ({ kontaktId: 'c-1', name: 'X', email: 'x@probe.invalid' }) });
    const st = new Map(r.lauf.schritte.map(s => [s.knoten, s]));
    expect(st.get(fk(30))).toMatchObject({ status: 'uebersprungen', grund: 'deaktiviert' });
    expect(st.get(sl)).toMatchObject({ status: 'uebersprungen', ausgang: 'ja' });
    expect(st.has(fk(31))).toBe(true);
    // Scharf: keine Wirkung, kein Vorschlag — der Lauf endet erfolgreich.
    const s = schatten(MAIL, { empfaenger: () => ({ kontaktId: 'c-1', name: 'X', email: 'x@probe.invalid' }) }, 'scharf');
    expect(s.aktion).toBeNull();
    expect(s.lauf).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    // Eine Entscheidung ausgeschaltet → „ja“.
    const w = schatten({ ...WEG, knoten: WEG.knoten.map(k => (k.id === fk(12) ? { ...k, deaktiviert: true } : k)) }, {}, 'schatten').lauf.schritte.map(x => x.knoten);
    expect(w).toContain(fk(13));
  });
  it('Säuberer: nur `true` zählt; ohne Feld bit-gleich; Fulfillment-Pakete kennen es nicht; die Werkstatt sagt es an', () => {
    const k = { id: fk(30), elternId: fk(2), titel: 'Mail', rang: 1, form: 'schritt' };
    expect(knotenAus({ ...k, deaktiviert: true })?.deaktiviert).toBe(true);
    expect(knotenAus({ ...k, deaktiviert: 'ja' })).toEqual(knotenAus(k));
    expect('deaktiviert' in (knotenAus(k) ?? {})).toBe(false);
    expect(fulfillmentModusBefunde({ knoten: [{ ...k, form: 'schritt', deaktiviert: true } as never] }).some(b => b.feld === 'deaktiviert')).toBe(true);
    expect(hinweiseVon({ knoten: WEG.knoten.map(x => (x.id === fk(10) ? { ...x, deaktiviert: true } : x)) }).some(r => /ausgeschaltet/.test(r.text))).toBe(true);
  });
});

describe('Oberfläche Punkte 6–11, 14 (Quelltext-Wächter)', () => {
  const w = lies('components/os/prozesse/Werkstatt.tsx');
  const fl = lies('components/os/prozesse/WerkstattFlaeche.tsx');
  const kn = lies('components/os/prozesse/WerkstattKnoten.tsx');
  const gr = lies('components/os/prozesse/WerkstattGross.tsx');
  const ma = lies('components/os/prozesse/WerkstattMaske.tsx');
  it('Punkt 6: Befund-Marke mit Satz beim Überfahren, Klick springt ins Feld (data-ws-feld)', () => {
    expect(kn).toContain('data-ws-befund={k.id}');
    expect(fl).toContain('className="pw-befund-tipp"');
    expect(ma).toContain('data-ws-feld={f.id}');
    expect(w).toContain('setFeldFokus(');
  });
  it('Punkt 7/8: großes Fenster mit Eingabe · Maske · Ausgabe; Platzhalter an den Cursor, Vorschau und Prüfung beim Tippen', () => {
    for (const x of ['aria-label="Eingabe"', 'aria-label="Maske"', 'aria-label="Ausgabe"', 'Nur diesen Schritt testen', 'Bis hier testen', 'Beispiel bearbeiten']) expect(gr).toContain(x);
    expect(ma).toContain('textvorlagePruefen(t, platzhalter)');
    expect(ma).toContain('textvorlageFuellen(t, u.werte)');
    expect(ma).toContain("e.dataTransfer.setData('text/plain', text)");
    expect(w).toContain("case 'oeffnen': if (eine) { setGross(eine.id); return true; }");
  });
  it('Punkt 9–11: Testdaten über EINEN Weg, „Weg annehmen“, Schritt testen mit Ausgabe, Lauf → Testdaten in Bauen', () => {
    expect(w).toContain("aktion: 'testdaten', id: prozessId, stand: stand.current");
    expect(w).toContain('ausgabe: true');
    expect(lies('components/os/prozesse/WerkstattLaeufe.tsx')).toContain('Als Testdaten in Bauen');
    expect(lies('components/os/prozesse/WerkstattPanel.tsx')).toContain('Im Probelauf annehmen');
  });
  it('Punkt 14: ausgeschaltete Knoten blass mit Marke; das Panel schaltet aus statt zu löschen', () => {
    expect(kn).toContain('data-ws-aus');
    expect(lies('components/os/prozesse/WerkstattPanel.tsx')).toContain('Ausgeschaltet');
  });
});
