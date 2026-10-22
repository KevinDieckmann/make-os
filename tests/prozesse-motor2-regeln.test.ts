// ─── Prozesse · Motor-Rest (22.10. spät) — die reinen Regeln: Schleife, CRM-Abfrage, Platzhalter, Agent mit Feldern, Frische, Drossel ───────────────────
// lib/prozesse/lauf-regeln.ts (Plan je Knoten, Ergebnis eintragen), lib/prozesse/kundengewinnung/abfrage.ts (Abfragen über die vorhandenen Leser),
// lib/prozesse/agent-felder.ts (Felder aus der Antwort des Modells), lib/zoe/crm-felder-wahl.ts (Häkchen je Feld). Nur erfundene Werte.
import { describe, it, expect } from 'vitest';
import {
  voran, nachAktion, starten, weckenZeit, startGesperrt, rechercheVorTagen, laufBefunde, probeZeilen, wirkungsKennung,
  type LaufUmfeld, type StartAnfrage, type AgentFreigabe,
} from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe, type LaeufeDatei, type ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import type { AgentSchritt, ProzessDefinition } from '@/lib/prozesse/definition';
import { abfrageFaelle, eventGaeste, fallFuerTeil, type AbfrageDaten } from '@/lib/prozesse/kundengewinnung/abfrage';
import { agentFelderAus, quellenAus, agentDaten } from '@/lib/prozesse/agent-felder';
import { felderZurWahl, nurGewaehlteFelder, crmSammelTauglich } from '@/lib/zoe/crm-felder-wahl';
import { laufLog } from '@/lib/prozesse/laeufe-ansicht';
import { leads } from '@/lib/crm/leads';
import { leererBestand } from '@/lib/crm/speicher';
import { definition, fk, schritt, PZ, PZ2, J } from './fixtures/prozess-bau';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const lid = (n: number) => `pl-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plus = (min: number, ab = J) => new Date(Date.parse(ab) + min * 60_000).toISOString();
const umfeld = (extra: Partial<LaufUmfeld> = {}, jetzt = J): LaufUmfeld => ({ jetzt, titel: 'Probe', daten: {}, teilprozess: () => ({ version: 1 }), ...extra });
function lauf(def: ProzessDefinition, o: Partial<StartAnfrage> = {}, datei: LaeufeDatei = leereLaeufe()): ProzessLauf {
  const r = starten(datei, { id: lid(1), prozessId: PZ, version: 1, def, fall: { art: 'keiner' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, periode: 'p1', jetzt: J, ...o });
  if (!r.ok) throw new Error(r.grund);
  return r.lauf;
}

/** Abfrage → „Hängt etwas?“ → Schleife (Teilprozess PZ2, höchstens 2) → Glocke an den Eigner → Ende. */
const SCHLEIFE: ProzessDefinition = definition([
  schritt(10, 'Deals finden', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'deals-ohne-schritt', hoechstens: 10 } }),
  schritt(11, 'Hängt etwas?', 2, { form: 'entscheidung', katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'abfrage.anzahl', op: 'groesser', wert: 0 }] }, zweige: { nein: fk(15) } }),
  schritt(12, 'Jeden Deal klären', 3, { form: 'schleife', katalog: { id: 'schleife.je-eintrag' }, schleife: { liste: `abfrage:${fk(10)}`, prozessId: PZ2, hoechstens: 2 } }),
  schritt(13, 'Lage melden', 4, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: 'rolle:eigner', text: 'Deals sind aufgegriffen.' } } }),
  schritt(14, 'Fertig', 5, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(15, 'Nichts', 6, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
], { fallArt: 'keiner', eigner: 'konto-pia' });

describe('CRM-Abfrage und Schleife im Lauf', () => {
  it('Abfrage ist eine Aktion (nur lesen); ihr Ergebnis steht als Liste im Lauf und als abfrage.anzahl für die Raute; die Schleife ist eine Aktion mit fester Kennung', () => {
    const l0 = lauf(SCHLEIFE);
    const u = umfeld({ rolle: w => (w === 'rolle:eigner' ? { speicher: 'pia', team: 'konto-pia' } : null) });
    const a = voran(l0, SCHLEIFE, u);
    expect(a.aktion).toMatchObject({ art: 'abfrage', knoten: fk(10), abfrage: { art: 'deals-ohne-schritt' } });
    // Kein Wirkungs-Eintrag am Schritt (Lesen erzeugt nichts).
    expect(a.lauf.schritte.at(-1)!.wirkung).toBeUndefined();
    const faelle = [{ art: 'deal' as const, id: 'ch-1' }, { art: 'deal' as const, id: 'ch-2' }, { art: 'deal' as const, id: 'ch-3' }];
    const l1 = nachAktion(a.lauf, SCHLEIFE, a.aktion!, { ok: true, liste: { faelle, gesamt: 3, am: J }, anzahl: 3, daten: { 'abfrage.anzahl': '3', 'abfrage.rest': '0', 'fremd.x': 'nein' } }, J);
    expect(l1.listen?.[fk(10)]?.faelle).toEqual(faelle);
    expect(l1.daten['abfrage.anzahl']).toBe('3');
    // Nur abfrage.*, schleife.*, agent.* kommen in die Daten.
    expect(l1.daten['fremd.x']).toBeUndefined();
    expect(l1.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'erledigt', anzahl: 3 });
    const b = voran(l1, SCHLEIFE, u);
    expect(b.aktion).toMatchObject({ art: 'schleife', knoten: fk(12), prozessId: PZ2, liste: `abfrage:${fk(10)}`, hoechstens: 2, kennung: wirkungsKennung(l0.id, fk(12), 0) });
    // Der Raute-Schritt ging über „ja“.
    expect(b.lauf.schritte.find(s => s.knoten === fk(11))).toMatchObject({ ausgang: 'ja' });
    // Ergebnis der Schleife: zwei Teil-Läufe, Rest 1 — sichtbar am Schritt, Lauf geht weiter (wartet nicht).
    const kinder = [{ art: 'lauf' as const, id: lid(51) }, { art: 'lauf' as const, id: lid(52) }];
    const l2 = nachAktion(b.lauf, SCHLEIFE, b.aktion!, { ok: true, wirkung: kinder, anzahl: 2, rest: 1, hinweis: 'schleife-rest', daten: { 'schleife.gestartet': '2', 'schleife.rest': '1' } }, J);
    expect(l2.schritte.find(s => s.knoten === fk(12))).toMatchObject({ status: 'erledigt', anzahl: 2, rest: 1, grund: 'schleife-rest', wirkung: kinder });
    expect(l2).toMatchObject({ status: 'laeuft', aktuell: fk(13) });
    const c = voran(l2, SCHLEIFE, u);
    expect(c.aktion).toMatchObject({ art: 'meldung', an: 'pia' });
    const l3 = voran(nachAktion(c.lauf, SCHLEIFE, c.aktion!, { ok: true }, J), SCHLEIFE, u).lauf;
    expect(l3).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    // Beim Ende fallen die Listen weg (nur Kennungen, nur solange der Lauf offen ist) — die Zahlen bleiben am Schritt.
    expect(l3.listen).toBeUndefined();
    expect(l3.schritte.find(s => s.knoten === fk(10))?.anzahl).toBe(3);
    // Die Läufe-Ansicht zeigt die Zahlen am Schritt (nur Zahlen).
    const zeilen = laufLog(l3.schritte, SCHLEIFE, J).flatMap(g => g.zeilen);
    expect(zeilen.find(z => z.knotenId === fk(10))?.zahlen).toBe('3 Treffer');
    expect(zeilen.find(z => z.knotenId === fk(12))?.zahlen).toBe('2 Teil-Läufe · 1 übrig für den nächsten Lauf');
  });
  it('nichts gefunden → Raute „nein“; Teilprozess nicht veröffentlicht → hält; Kette zu tief → hält; fehlende Abfrage → hält', () => {
    const l0 = lauf(SCHLEIFE);
    const u = umfeld({ rolle: () => ({ speicher: 'pia', team: 'konto-pia' }) });
    const a = voran(l0, SCHLEIFE, u);
    const leer = voran(nachAktion(a.lauf, SCHLEIFE, a.aktion!, { ok: true, liste: { faelle: [], gesamt: 0, am: J }, anzahl: 0, daten: { 'abfrage.anzahl': '0' } }, J), SCHLEIFE, u);
    expect(leer.lauf).toMatchObject({ status: 'fertig' });
    expect(leer.lauf.schritte.map(s => s.knoten)).toContain(fk(15));
    const voll = nachAktion(a.lauf, SCHLEIFE, a.aktion!, { ok: true, liste: { faelle: [{ art: 'deal', id: 'ch-1' }], gesamt: 1, am: J }, daten: { 'abfrage.anzahl': '1' } }, J);
    expect(voran(voll, SCHLEIFE, { ...u, teilprozess: () => null }).lauf).toMatchObject({ status: 'fehler', grund: 'teilprozess-fehlt' });
    expect(voran({ ...voll, tiefe: 3 }, SCHLEIFE, u).lauf).toMatchObject({ status: 'fehler', grund: 'kette' });
    const ohne = { ...SCHLEIFE, knoten: SCHLEIFE.knoten.map(k => (k.id === fk(12) ? { ...k, schleife: { ...k.schleife!, liste: 'abfrage:fk-weg' } } : k)) };
    expect(voran(voll, ohne, u).lauf).toMatchObject({ status: 'fehler', grund: 'liste-fehlt' });
    expect(laufBefunde(ohne).some(b => b.knotenId === fk(12))).toBe(false);
    expect(laufBefunde({ knoten: SCHLEIFE.knoten.map(k => (k.id === fk(12) ? { ...k, schleife: { ...k.schleife!, liste: 'unbekannt.liste' } } : k)) }).some(b => b.knotenId === fk(12))).toBe(true);
  });
  it('Probelauf (Schatten): Abfrage und Schleife „würden“ — der Weg geht ganz durch, nichts wird ausgeführt', () => {
    const r = voran(lauf(SCHLEIFE, { modus: 'schatten', person: null }), SCHLEIFE, umfeld({ rolle: () => ({ speicher: 'pia', team: 'konto-pia' }), daten: { 'abfrage.anzahl': 1 } }), 'schatten');
    expect(r.aktion).toBeNull();
    expect(r.lauf).toMatchObject({ status: 'fertig' });
    const z = probeZeilen(r.lauf, SCHLEIFE).schritte;
    expect(z.find(x => x.knotenId === fk(10))?.text).toMatch(/würde im CRM abfragen/);
    expect(z.find(x => x.knotenId === fk(12))?.text).toMatch(/würde je Fall einen Teil-Lauf starten/);
  });
  it('startGesperrt: offener bzw. beendeter Lauf ohne Wiedereintritt sperrt; nach erneutNachTagen ist der Fall wieder dran', () => {
    const def = definition([schritt(10, 'Klären', 1)]);
    const r = starten(leereLaeufe(), { id: lid(2), prozessId: PZ2, version: 1, def, fall: { art: 'deal', id: 'ch-1' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'teilprozess' }, automatisch: false, jetzt: J });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(startGesperrt(r.datei, PZ2, { art: 'deal', id: 'ch-1' }, J)).toBe('offen');
    expect(startGesperrt(r.datei, PZ2, { art: 'deal', id: 'ch-2' }, J)).toBeNull();
    const fertig: LaeufeDatei = { ...r.datei, laeufe: r.datei.laeufe.map(l => ({ ...l, status: 'fertig' as const, ende: J })) };
    expect(startGesperrt(fertig, PZ2, { art: 'deal', id: 'ch-1' }, plus(60 * 24 * 30))).toBe('schon');
    const mitErneut: LaeufeDatei = { ...fertig, prozesse: { [PZ2]: { einstellung: { erneutNachTagen: 10 }, verlauf: [] } } };
    expect(startGesperrt(mitErneut, PZ2, { art: 'deal', id: 'ch-1' }, plus(60 * 24 * 5))).toBe('schon');
    expect(startGesperrt(mitErneut, PZ2, { art: 'deal', id: 'ch-1' }, plus(60 * 24 * 11))).toBeNull();
  });
});

describe('Platzhalter der Vorlagen: Rollen, Postfach, Gesellschaft', () => {
  const ROLLEN = definition([
    schritt(10, 'Anrufen', 1, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Anrufen', wer: 'rolle:zustaendig' } } }),
    schritt(11, 'Melden', 2, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: 'rolle:eigner', text: 'x' } } }),
    schritt(12, 'Follow-up', 3, { katalog: { id: 'crm.followup', werte: { text: 'Nachfassen', inTagen: 2, wer: 'rolle:zustaendig' } } }),
    schritt(13, 'Ende', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ]);
  it('Rolle aufgelöst → Speichername (Aufgabe, Glocke) bzw. Team-Kennung (Follow-up)', () => {
    const u = umfeld({ rolle: w => (w === 'rolle:zustaendig' ? { speicher: 'olaf', team: 'konto-olaf' } : { speicher: 'pia', team: 'konto-pia' }) });
    const l = lauf(ROLLEN, { fall: { art: 'deal', id: 'ch-probe' } });
    const a = voran(l, ROLLEN, u);
    expect(a.aktion).toMatchObject({ art: 'aufgabe', an: 'olaf' });
    const b = voran(nachAktion(a.lauf, ROLLEN, a.aktion!, { ok: true }, J), ROLLEN, u);
    // Die Aufgabe wartet aufs Abhaken — dann weiter: Glocke an den Eigner, Follow-up mit der Team-Kennung.
    expect(b.lauf.status).toBe('wartet');
  });
  it('Rolle nicht auflösbar (kein Eigner mit Konto) → der Schritt hält mit Grund — nie Rückfall auf die Person des Laufs bzw. den Inhaber', () => {
    const l = lauf(ROLLEN, { fall: { art: 'deal', id: 'ch-probe' } });
    const r = voran(l, ROLLEN, umfeld({ rolle: () => null, person: () => 'inhaber' }));
    expect(r.aktion).toBeNull();
    expect(r.lauf).toMatchObject({ status: 'fehler', grund: 'rolle-fehlt' });
    // Ohne Rollen-Auflösung im Umfeld gilt eine Rolle ebenso als nicht auflösbar.
    expect(voran(l, ROLLEN, umfeld()).lauf).toMatchObject({ status: 'fehler', grund: 'rolle-fehlt' });
  });
  it('Follow-up mit Rolle: Team-Kennung im CRM-Vorschlag', () => {
    const d = definition([schritt(12, 'Follow-up', 1, { katalog: { id: 'crm.followup', werte: { text: 'Nachfassen', inTagen: 2, wer: 'rolle:zustaendig' } } })]);
    const r = voran(lauf(d, { fall: { art: 'deal', id: 'ch-probe' } }), d, umfeld({ rolle: () => ({ speicher: 'olaf', team: 'konto-olaf' }) }));
    expect(r.aktion).toMatchObject({ art: 'crm-vorschlag', eingabe: { art: 'followup', zustaendig: 'konto-olaf', deal: 'ch-probe' } });
  });
  const MAIL = schlossSetzen(definition([
    schritt(20, 'Danke-Mail', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'postfach.lauf', an: 'fall.kontakt', betreff: 'Danke', text: 'Danke.' } } }),
    schritt(21, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ])).definition;
  const an = () => ({ kontaktId: 'c-erika', name: 'Erika Beispiel', email: 'erika@example.invalid' });
  it('Postfach des Laufs → Kennung eines Business-Postfachs im Sende-Auftrag; ohne passendes Postfach hält der Schritt AN DER MAIL (kein-postfach)', () => {
    const l = lauf(MAIL, { fall: { art: 'deal', id: 'ch-probe' } });
    const mit = voran(l, MAIL, umfeld({ empfaenger: an, postfach: w => (w === 'postfach.lauf' ? 'pf-business' : null) }));
    expect(mit.aktion).toMatchObject({ art: 'vorschlag', sende: { kanal: 'mail', postfach: 'pf-business' } });
    const ohne = voran(l, MAIL, umfeld({ empfaenger: an, postfach: () => null }));
    expect(ohne.lauf).toMatchObject({ status: 'fehler', grund: 'kein-postfach', aktuell: fk(20) });
    // Ohne Auflösung im Umfeld bleibt der Wert (gesendet wird später über das Postfach der freigebenden Person) — wie bisher.
    expect(voran(l, MAIL, umfeld({ empfaenger: an })).aktion).toMatchObject({ sende: { postfach: 'postfach.lauf' } });
  });
  it('Gesellschaft des Falls → Angebots-Entwurf mit der Gesellschaft des Deals; ohne Business-Gesellschaft hält der Schritt', () => {
    const d = definition([schritt(30, 'Angebot entwerfen', 1, { katalog: { id: 'angebot.entwurf', werte: { gesellschaft: 'fall.gesellschaft' } } })]);
    const l = lauf(d, { fall: { art: 'deal', id: 'ch-probe' } });
    expect(voran(l, d, umfeld({ gesellschaft: () => 'ug', empfaenger: an })).aktion).toMatchObject({ art: 'crm-vorschlag', eingabe: { art: 'angebot_entwurf', gesellschaft: 'ug', deal: 'ch-probe' } });
    expect(voran(l, d, umfeld({ gesellschaft: () => null })).lauf).toMatchObject({ status: 'fehler', grund: 'gesellschaft-fehlt' });
  });
  it('weitere CRM-Bausteine als Vorschlag: Deal vorschlagen, nächster Schritt (Tage aus dem Agenten davor), Lead parken, Text-Entwurf (ohne Text: ein Mensch schreibt ihn)', () => {
    const d = definition([
      schritt(40, 'Deal vorschlagen', 1, { katalog: { id: 'crm.deal-vorschlagen', werte: { naechsterSchritt: 'Erstgespräch', inTagen: 3 } } }),
    ]);
    const l = lauf(d, { fall: { art: 'deal', id: 'ch-probe' } });
    const b = (k: string) => voran(l, d, umfeld({ empfaenger: an }));
    expect(b('').aktion).toMatchObject({ eingabe: { art: 'deal_anlegen', kontakt: 'c-erika', naechster_schritt: 'Erstgespräch', faellig: '2026-10-24' } });
    const s = definition([schritt(41, 'Nächster Schritt', 1, { katalog: { id: 'crm.deal-schritt', werte: { inTagen: 2 } } })]);
    const ls = { ...lauf(s, { fall: { art: 'deal', id: 'ch-probe' } }), daten: { 'agent.intagen': '5' } };
    expect(voran(ls, s, umfeld()).aktion).toMatchObject({ eingabe: { art: 'deal_aendern', deal: 'ch-probe', faellig: '2026-10-26' } });
    const p = definition([schritt(42, 'Parken', 1, { katalog: { id: 'crm.lead-parken', werte: { parkTage: 90, grundArt: 'spaeter' } } })], { fallArt: 'lead' });
    expect(voran(lauf(p, { fall: { art: 'lead', id: 'f-probe' } }), p, umfeld()).aktion).toMatchObject({ eingabe: { art: 'lead_parken', lead: 'f-probe', park_tage: 90, grund_art: 'spaeter' } });
    const t = definition([schritt(43, 'Leitfaden', 1, { katalog: { id: 'crm.entwurf-text', werte: { art: 'anruf_leitfaden', kanal: 'telefon', anlass: 'Aufhänger aus der Recherche' } } })]);
    const lt = lauf(t, { fall: { art: 'deal', id: 'ch-probe' } });
    expect(voran(lt, t, umfeld({ empfaenger: an })).aktion).toMatchObject({ art: 'aufgabe', titel: 'Leitfaden' });
    const tt = { ...t, knoten: t.knoten.map(k => (k.id === fk(43) ? { ...k, katalog: { id: 'crm.entwurf-text', werte: { art: 'nachricht_entwurf', kanal: 'mail', text: 'Guten Tag {{kontakt.nachname}}' } } } : k)) };
    expect(voran(lt, tt, umfeld({ empfaenger: an, platzhalter: { 'kontakt.nachname': 'Beispiel' } })).aktion).toMatchObject({ art: 'crm-vorschlag', eingabe: { art: 'nachricht_entwurf', kontakt: 'c-erika', text: 'Guten Tag Beispiel', kanal: 'mail' } });
    // Kanal rot → übersprungen (nichts angelegt).
    expect(voran(lt, tt, umfeld({ empfaenger: an, ansprache: () => ({ kanal: 'mail', farbe: 'rot', grund: 'x', erlaubt: false, anlassPflicht: false }) })).lauf.schritte.find(x => x.knoten === fk(43))).toMatchObject({ status: 'uebersprungen', grund: 'kanal-rot' });
  });
});

describe('Agenten-Schritt: Frische, Drossel, Nachtlauf, Felder', () => {
  const RES: AgentSchritt = {
    wer: { art: 'fach', agentId: 'research' }, auftrag: 'Öffentliche Angaben zur Firma', modell: 'schnell', budgetCent: 20, gedaechtnis: { brain: false, akte: true }, werkzeuge: [],
    eingabe: [], ausgabe: [{ id: 'fit', art: 'zahl' }], warumKeineRegel: 'Öffentliche Angaben stehen nicht im CRM — eine Regel kann sie nicht kennen.', ergebnis: 'vorschlag', vorschlagFelder: ['firma.branche', 'firma.website'],
  };
  const DEF = definition([
    schritt(10, 'Recherchieren', 1, { form: 'agent', katalog: { id: 'agent.research' }, agent: RES }),
    schritt(11, 'Fit stark?', 2, { form: 'entscheidung', raute: { art: 'regel', bedingungen: [{ feld: 'agent.fit', op: 'groesser', wert: 69 }] }, zweige: { nein: fk(13) } }),
    schritt(12, 'Outreach', 3, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Outreach' } } }),
    schritt(13, 'Pflege', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ], { fallArt: 'firma' });
  const f = (x: AgentFreigabe) => umfeld({ agent: () => x });
  it('Recherche-Frische: übersprungen ohne Modellaufruf, der Lauf geht weiter (Raute ohne Fit → „nein“)', () => {
    const r = voran(lauf(DEF, { fall: { art: 'firma', id: 'f-1' } }), DEF, f({ ok: false, grund: 'recherche-frisch', ueberspringen: true }));
    expect(r.aktion).toBeNull();
    expect(r.lauf.schritte.find(x => x.knoten === fk(10))).toMatchObject({ knoten: fk(10), status: 'uebersprungen', grund: 'recherche-frisch', ausgang: 'weiter' });
    expect(r.lauf).toMatchObject({ status: 'fertig' });
  });
  it('gedrosselt bzw. Nachtfenster: der Schritt wartet (Fenster) mit seinem Grund und kommt danach mit derselben Kennung wieder', () => {
    const l = lauf(DEF, { fall: { art: 'firma', id: 'f-1' } });
    const g = voran(l, DEF, f({ ok: false, grund: 'gedrosselt', bis: plus(2) }));
    expect(g.lauf).toMatchObject({ status: 'wartet', wartet: { art: 'fenster', bis: plus(2) } });
    expect(g.lauf.schritte.find(x => x.knoten === fk(10))).toMatchObject({ status: 'wartet', grund: 'gedrosselt' });
    const n = voran(l, DEF, f({ ok: false, grund: 'fenster', bis: plus(300) }));
    expect(n.lauf.schritte.find(x => x.knoten === fk(10))?.grund).toBe('fenster');
    const w = weckenZeit(g.lauf, DEF, plus(3));
    expect(w).toMatchObject({ status: 'laeuft', aktuell: fk(10) });
    const a = voran(w, DEF, f({ ok: true, kostenCent: 3 }));
    expect(a.aktion).toMatchObject({ art: 'agent', kennung: wirkungsKennung(l.id, fk(10), 0) });
  });
  it('Ergebnis: die Werte des Vertrags gehen an die Raute (agent.fit), der Lauf trägt „fremd“ und den Recherche-Stempel; Kosten am Schritt', () => {
    const l = lauf(DEF, { fall: { art: 'firma', id: 'f-1' } });
    const a = voran(l, DEF, f({ ok: true, kostenCent: 3 }));
    const n = nachAktion(a.lauf, DEF, a.aktion!, { ok: true, wirkung: [{ art: 'vorschlag', id: 'v-1' }], kostenCent: 7, recherche: true, fremd: true, daten: { 'agent.fit': '80', 'agent.felder': '2' } }, J);
    expect(n).toMatchObject({ fremd: true, kostenCent: 7, daten: { 'agent.fit': '80', 'agent.felder': '2' } });
    expect(n.schritte.find(x => x.knoten === fk(10))).toMatchObject({ status: 'erledigt', recherche: true, kostenCent: 7 });
    expect(voran(n, DEF, umfeld()).aktion).toMatchObject({ art: 'aufgabe', titel: 'Outreach' });
    // Bezahlt ist bezahlt: auch ein Vertrag, der nicht passte, bucht seine Kosten.
    const x = nachAktion(a.lauf, DEF, a.aktion!, { ok: false, art: 'dauerhaft', grund: 'vertrag', kostenCent: 4 }, J);
    expect(x).toMatchObject({ status: 'fehler', grund: 'vertrag', kostenCent: 4 });
  });
  it('rechercheVorTagen: über alle scharfen Läufe derselben Kennung; Schatten zählt nicht', () => {
    const l = lauf(DEF, { fall: { art: 'firma', id: 'f-1' } });
    const d: LaeufeDatei = { ...leereLaeufe(), laeufe: [{ ...l, schritte: [{ knoten: fk(10), status: 'erledigt', ab: J, bis: J, recherche: true }] }, { ...l, id: lid(9), modus: 'schatten', fall: { art: 'firma', id: 'f-2' }, schritte: [{ knoten: fk(10), status: 'wuerde', ab: J, bis: J, recherche: true }] }] };
    expect(rechercheVorTagen(d, 'f-1', plus(60 * 24 * 10))).toBeCloseTo(10, 5);
    expect(rechercheVorTagen(d, 'f-2', plus(60))).toBeNull();
    expect(rechercheVorTagen(d, 'f-3', plus(60))).toBeNull();
  });
  it('Felder aus der Antwort: nur die Zielfelder des Schritts, https für Webseite, zu lang verworfen (nie gekürzt); Quellen nur https; Vertrag als agent.*', () => {
    const r = agentFelderAus({ 'firma.branche': 'Maschinenbau', 'firma.website': 'http://beispiel.invalid', 'firma.sitz': 'Köln', 'lead.schmerz': 'x'.repeat(601), 'unbekannt': 'y' }, ['firma.branche', 'firma.website', 'lead.schmerz']);
    expect(r).toEqual({ firma: { branche: 'Maschinenbau' }, antworten: {}, verworfen: 4 });
    expect(agentFelderAus({ 'firma.website': 'https://beispiel.invalid', 'lead.schmerz': 'Zu viel Handarbeit <b>im</b> Vertrieb' }, ['firma.website', 'lead.schmerz'])).toEqual({ firma: { webseite: 'https://beispiel.invalid' }, antworten: { schmerz: 'Zu viel Handarbeit bim/b Vertrieb' }, verworfen: 0 });
    expect(quellenAus(['https://a.invalid/x', 'http://b.invalid', 'https://a.invalid/x', 5])).toEqual(['https://a.invalid/x']);
    expect(agentDaten({ fit: 80, kanal: 'telefon', ok: true, liste: ['a', 'b'] })).toEqual({ 'agent.fit': '80', 'agent.kanal': 'telefon', 'agent.ok': 'true', 'agent.liste': 'a,b' });
  });
});

describe('Häkchen je Feld und Sammelfreigabe (lib/zoe/crm-felder-wahl.ts)', () => {
  const v = { art: 'firma_felder', firmaId: 'f-1', felder: { branche: 'Maschinenbau', webseite: 'https://beispiel.invalid' }, _uebernahme: 'je-feld' };
  it('nur die gewählten der vorbereiteten Felder; unbekannt bzw. nichts gewählt → abgelehnt', () => {
    expect(felderZurWahl(v)?.map(f => f.id)).toEqual(['branche', 'webseite']);
    expect(felderZurWahl({ ...v, _uebernahme: undefined })).toBeNull();
    expect(nurGewaehlteFelder(v, ['webseite'])).toEqual({ ok: true, eingabe: { ...v, felder: { webseite: 'https://beispiel.invalid' } } });
    expect(nurGewaehlteFelder(v, [])).toMatchObject({ ok: false });
    expect(nurGewaehlteFelder(v, ['stadt'])).toMatchObject({ ok: false });
    const q = { art: 'qualifizierung', leadId: 'f-1', felder: { antworten: { schmerz: 'a', budget: 'b' } }, _uebernahme: 'je-feld' };
    expect(nurGewaehlteFelder(q, ['antworten.budget'])).toEqual({ ok: true, eingabe: { ...q, felder: { antworten: { budget: 'b' } } } });
  });
  it('Sammelfreigabe nur für „Firma ergänzen“ mit Übernahme „sammel“', () => {
    expect(crmSammelTauglich({ bezug: { art: 'crm' }, eingabe: { ...v, _uebernahme: 'sammel' } })).toBe(true);
    expect(crmSammelTauglich({ bezug: { art: 'crm' }, eingabe: v })).toBe(false);
    expect(crmSammelTauglich({ bezug: { art: 'crm' }, eingabe: { art: 'qualifizierung', _uebernahme: 'sammel' } })).toBe(false);
  });
});

describe('CRM-Abfragen über die vorhandenen Leser (lib/prozesse/kundengewinnung/abfrage.ts)', () => {
  const HEUTE = '2026-10-22';
  const k = (id: string, extra: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Probe', nachname: id, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-01', geaendertAm: '2026-01-01', ...extra } as Kontakt);
  const kontakte: Kontakt[] = [
    k('c-ruhig', { firmaId: 'f-ruhig', firma: 'Ruhig GmbH' }),
    k('c-kunde', { firmaId: 'f-kunde', firma: 'Kunde GmbH' }),
    k('c-neu', { importiertAm: '2026-10-20' }),
    k('c-sperre', { importiertAm: '2026-10-20', werbesperre: { seit: '2026-10-01', von: 'pia' } as never }),
  ];
  const deal = (id: string, extra: Record<string, unknown> = {}) => ({ id, titel: id, kontaktIds: ['c-ruhig'], stufe: 'qualifiziert', historie: [], wert: { betrag: 100, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-10-01', geaendert: '2026-10-01', ...extra });
  const crm = (): CrmBestand => ({
    ...leererBestand(),
    firmen: [{ id: 'f-ruhig', name: 'Ruhig GmbH', rolle: 'interessent' }, { id: 'f-kunde', name: 'Kunde GmbH', rolle: 'kunde', lead: { status: 'kunde' } }],
    chancen: [deal('ch-ohne'), deal('ch-schritt', { naechsterSchritt: { text: 'x', datum: '2026-11-01' } }), deal('ch-privat', { gesellschaft: 'kdc' }), deal('ch-gesperrt', { kontaktIds: ['c-art18'] })],
  } as unknown as CrmBestand);
  const daten = (extra: Partial<AbfrageDaten> = {}): AbfrageDaten => {
    const c = crm();
    return { crm: c, kontakte, leads: leads(kontakte, c, HEUTE), heute: HEUTE, person: 'pia', fall: { art: 'keiner' }, business: g => g !== 'kdc', ...extra };
  };
  it('Deals ohne nächsten Schritt: nur Business, ohne eingeschränkte Personen (fehlen in der Kartei)', () => {
    expect(abfrageFaelle({ art: 'deals-ohne-schritt', hoechstens: 10 }, daten())).toEqual([{ art: 'deal', id: 'ch-ohne' }]);
  });
  it('Hängende Deals: Ampel bzw. ohne nächsten Schritt', () => {
    expect(abfrageFaelle({ art: 'deals-haengen', hoechstens: 10 }, daten()).map(f => f.id)).toContain('ch-ohne');
  });
  it('Neue Leads seit n Tagen: Werbesperre fehlt', () => {
    const r = abfrageFaelle({ art: 'neue-leads', status: ['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung'], tage: 7, hoechstens: 10 }, daten());
    expect(r.map(f => f.id)).toContain('c-neu');
    expect(r.map(f => f.id)).not.toContain('c-sperre');
  });
  it('Ruhende Firmen: nie Kunde, nie mit offenem Deal', () => {
    const ohneDeal = daten({ crm: { ...crm(), chancen: [] } });
    const r = abfrageFaelle({ art: 'firmen-ruhend', tage: 90, hoechstens: 10 }, { ...ohneDeal, leads: leads(kontakte, ohneDeal.crm, HEUTE) });
    expect(r).toEqual([{ art: 'firma', id: 'f-ruhig' }]);
    expect(abfrageFaelle({ art: 'firmen-ruhend', tage: 90, hoechstens: 10 }, daten())).toEqual([]);
  });
  it('Erfassungen eines Events bzw. Gäste: nur mit Event-Fall, ohne Werbesperre', () => {
    const c = { ...crm(), teilnahmen: [
      { id: 't1', eventId: 'ev-1', kontaktId: 'c-ruhig', status: 'da', netzwerken: { schritt: 'qualifizieren' } },
      { id: 't2', eventId: 'ev-1', kontaktId: 'c-sperre', status: 'vorgemerkt', netzwerken: { schritt: 'qualifizieren' } },
      { id: 't3', eventId: 'ev-1', kontaktId: 'c-neu', status: 'vorgemerkt' },
      { id: 't4', eventId: 'ev-1', kontaktId: 'c-kunde', status: 'da', netzwerken: { schritt: 'qualifizieren' }, followUpAm: '2026-10-21' },
    ] } as unknown as CrmBestand;
    expect(abfrageFaelle({ art: 'netzwerken-offen', hoechstens: 10 }, daten({ crm: c, fall: { art: 'event', id: 'ev-1' } }))).toEqual([{ art: 'lead', id: 'c-ruhig' }]);
    expect(abfrageFaelle({ art: 'netzwerken-offen', hoechstens: 10 }, daten({ crm: c }))).toEqual([]);
    expect(eventGaeste({ crm: c, kontakte, fall: { art: 'event', id: 'ev-1' } })).toEqual([{ art: 'lead', id: 'c-neu' }]);
  });
  it('Fall des Teilprozesses: Firmen-Lead → Firma, Firma → Lead, sonst unverändert', () => {
    expect(fallFuerTeil({ art: 'lead', id: 'f-1' }, 'firma')).toEqual({ art: 'firma', id: 'f-1' });
    expect(fallFuerTeil({ art: 'lead', id: 'c-1' }, 'firma')).toEqual({ art: 'lead', id: 'c-1' });
    expect(fallFuerTeil({ art: 'firma', id: 'f-1' }, 'lead')).toEqual({ art: 'lead', id: 'f-1' });
    expect(fallFuerTeil({ art: 'deal', id: 'ch-1' }, 'deal')).toEqual({ art: 'deal', id: 'ch-1' });
  });
});
