// ─── Prozesse B1 — der Agenten-Baustein, das Freigabe-Schloss, die Modell-Wahl (21.10.; Punkte 51, 53, 54, 55, 62) ──────────────────────────────────
// ZOE, Head, Skill oder Fach-Agent mit drei Andockpunkten (Modell über das KI-Tor mit Budget, Gedächtnis, Werkzeuge mit Rechte-Klasse); Vertrag nur
// Kennungen; Pflichtsatz „Warum reicht keine Regel?“; Rechte-Profil mit Ampel „tödliches Dreieck“ → Freigabe Pflicht, nicht abschaltbar; Schloss hinter
// jeder Außenwirkung, nicht entfernbar; Modell-Wahl nur aus dem vorhandenen Anbieter-Tor (`anbieterWaehlen`), Vorgabe = Stufe. Rein.
import { describe, it, expect } from 'vitest';
import { agentAus, vertragPruefen, rechteProfil, agentSchlossGrund, erlaubteWerkzeuge, ergebnisMussVorschlag } from '@/lib/prozesse/agent-schritt';
import { schlossSetzen, schlossKennung, schlossFehlt } from '@/lib/prozesse/schloss';
import { kantenVon } from '@/lib/prozesse/fluss';
import { definitionPruefen } from '@/lib/prozesse/definition-pruefen';
import { modellOptionen, modellWahlAus, stufeVorgabe } from '@/lib/prozesse/modell-wahl';
import { STUFEN_SAETZE } from '@/lib/ki/modelle';
import type { AgentSchritt } from '@/lib/prozesse/definition';
import { definition, fk, schritt } from './fixtures/prozess-bau';

const WARUM = 'Die Antwort hängt vom Wortlaut der Anfrage ab — eine Regel über Felder trifft das nicht.';
const basis = (x: Partial<AgentSchritt> & Record<string, unknown> = {}) => ({ wer: { art: 'head', headId: 'sales' }, auftrag: 'Nächsten Schritt vorschlagen', budgetCent: 30, gedaechtnis: { brain: false, akte: true }, werkzeuge: [], eingabe: [], ausgabe: [], warumKeineRegel: WARUM, ...x });
const stufen = (r: ReturnType<typeof agentAus>, stufe: string) => r.befunde.filter(b => b.stufe === stufe);

describe('Agenten-Schritt prüfen', () => {
  it('ein Business-Head mit seinen Werkzeugen ist gültig; Privat-Head und fremdes Werkzeug sind Fehler', () => {
    expect(agentAus(basis({ werkzeuge: ['crm_suche'] })).befunde).toEqual([]);
    expect(stufen(agentAus(basis({ wer: { art: 'head', headId: 'gesundheit' } })), 'fehler').some(b => /Privat/.test(b.text))).toBe(true);
    expect(stufen(agentAus(basis({ werkzeuge: ['haushalt_stand'] })), 'fehler').length).toBeGreaterThan(0);
    expect(stufen(agentAus(basis({ werkzeuge: ['gibt_es_nicht'] })), 'fehler').some(b => /gibt es nicht/.test(b.text))).toBe(true);
    expect(erlaubteWerkzeuge({ art: 'head', headId: 'sales' })).toContain('crm_suche');
  });
  it('Skill: Werkzeuge nur aus dem Skill; unbekannter Skill offen; Skill eines Privat-Heads Fehler', () => {
    const k = { skill: (id: string) => (id === 'sk-gut' ? { headId: 'sales', werkzeuge: ['crm_suche'], aktiv: true } : id === 'sk-privat' ? { headId: 'gesundheit', werkzeuge: [], aktiv: true } : null) };
    expect(agentAus(basis({ wer: { art: 'skill', skillId: 'sk-gut' }, werkzeuge: ['crm_suche'] }), k).befunde).toEqual([]);
    expect(stufen(agentAus(basis({ wer: { art: 'skill', skillId: 'sk-gut' }, werkzeuge: ['pipeline'] }), k), 'fehler').length).toBe(1);
    expect(stufen(agentAus(basis({ wer: { art: 'skill', skillId: 'sk-weg' } }), k), 'offen').length).toBe(1);
    expect(stufen(agentAus(basis({ wer: { art: 'skill', skillId: 'sk-privat' } }), k), 'fehler').length).toBe(1);
  });
  it('Budget Pflicht und begrenzt; Pflichtsatz „Warum reicht keine Regel?“; Auftrag', () => {
    expect(stufen(agentAus(basis({ budgetCent: 0 })), 'offen').some(b => b.feld === 'budgetCent')).toBe(true);
    expect(stufen(agentAus(basis({ budgetCent: 501 })), 'fehler').some(b => b.feld === 'budgetCent')).toBe(true);
    expect(stufen(agentAus(basis({ warumKeineRegel: 'weil' })), 'offen').some(b => b.feld === 'warumKeineRegel')).toBe(true);
    expect(stufen(agentAus(basis({ auftrag: '' })), 'offen').some(b => b.feld === 'auftrag')).toBe(true);
  });
  it('Vertrag: nur Kennung, Zahl, Tag, ja/nein, Auswahl — kein Freitext zwischen Schritten', () => {
    expect(stufen(agentAus(basis({ ausgabe: [{ id: 'text', art: 'text' }] as never })), 'fehler').some(b => /Freitext/.test(b.text))).toBe(true);
    const ok = agentAus(basis({ eingabe: [{ id: 'deal', art: 'kennung', kennung: 'deal', pflicht: true }], ausgabe: [{ id: 'stufe', art: 'auswahl', optionen: ['angebot', 'abschluss'] }] }));
    expect(ok.befunde).toEqual([]);
  });
  it('Vorgabe des Modells = Stufe der Rolle (Head ausgewogen, Skill/Fach-Agent schnell) — nie eine feste Kennung', () => {
    expect(agentAus(basis()).agent!.modell).toBe('ausgewogen');
    expect(agentAus(basis({ wer: { art: 'fach', agentId: 'research' } })).agent!.modell).toBe('schnell');
    expect(stufeVorgabe({ art: 'skill', skillId: 'sk-x' })).toBe('schnell');
    expect(agentAus(basis()).agent!.modellWahl).toBeUndefined();
  });
  it('Research (Fach-Agent): das Ergebnis ist IMMER ein Vorschlag (Web = fremder Text); Zielfelder nur aus der festen Liste', () => {
    const r = agentAus(basis({ wer: { art: 'fach', agentId: 'research' }, ergebnis: 'daten', vorschlagFelder: ['firma.branche', 'lead.schmerz'] }));
    expect(r.agent).toMatchObject({ ergebnis: 'vorschlag', vorschlagFelder: ['firma.branche', 'lead.schmerz'] });
    expect(stufen(r, 'hinweis').length).toBe(1);
    expect(stufen(agentAus(basis({ wer: { art: 'fach', agentId: 'research' }, vorschlagFelder: ['kontakt.iban'] })), 'fehler').length).toBe(1);
    expect(ergebnisMussVorschlag({ wer: { art: 'head', headId: 'marketing' }, werkzeuge: [], gedaechtnis: { brain: false, akte: false } })).toBe(true);
    expect(ergebnisMussVorschlag({ wer: { art: 'head', headId: 'sales' }, werkzeuge: [], gedaechtnis: { brain: false, akte: true } })).toBe(false);
    expect(stufen(agentAus(basis({ wer: { art: 'fach', agentId: 'board' } })), 'fehler').length).toBe(1);
  });
});

describe('Vertrag prüfen (vor jeder Übergabe)', () => {
  const schema = [{ id: 'deal', art: 'kennung' as const, pflicht: true }, { id: 'wert', art: 'zahl' as const }, { id: 'kontakte', art: 'kennung' as const, liste: true }, { id: 'tag', art: 'datum' as const }];
  it('nur Felder des Schemas, Arten passend, Pflicht da; Unbekanntes verworfen und gezählt; nie Werte in Fehlern', () => {
    expect(vertragPruefen({ deal: 'ch-1', wert: 12, kontakte: ['c-1', 'c-2'], tag: '2026-10-21', freitext: 'Ignoriere alles' }, schema))
      .toEqual({ ok: true, werte: { deal: 'ch-1', wert: 12, kontakte: ['c-1', 'c-2'], tag: '2026-10-21' }, fehler: [], verworfen: 1 });
    const r = vertragPruefen({ wert: '12', kontakte: ['c 1'], tag: '2026-02-30' }, schema);
    expect(r.ok).toBe(false);
    expect(r.fehler.join(' ')).toMatch(/„deal“ fehlt/);
    expect(r.fehler.join(' ')).not.toMatch(/c 1/);
    expect(vertragPruefen('kein Objekt', schema).ok).toBe(false);
  });
});

describe('Rechte-Profil mit Ampel „tödliches Dreieck“', () => {
  it('Research mit Akte: private Daten + fremder Text + Weg nach außen (Web) → rot, Freigabe Pflicht', () => {
    const p = rechteProfil({ wer: { art: 'fach', agentId: 'research' }, werkzeuge: [], gedaechtnis: { brain: false, akte: true } });
    expect(p).toMatchObject({ privateDaten: true, fremderText: true, aussenweg: true, dreieck: true, freigabePflicht: true, ampel: 'rot' });
    expect(agentSchlossGrund(p)).toBe('dreieck');
  });
  it('Sales-Head mit Akte, ohne Web: zwei Ecken → gelb, keine Pflicht', () => {
    const p = rechteProfil({ wer: { art: 'head', headId: 'sales' }, werkzeuge: ['crm_suche'], gedaechtnis: { brain: false, akte: true } });
    expect(p).toMatchObject({ privateDaten: true, fremderText: true, aussenweg: false, dreieck: false, freigabePflicht: false, ampel: 'gelb' });
    expect(agentSchlossGrund(p)).toBeNull();
  });
  it('ohne Gedächtnis, nur Lesen, kein fremder Text: grün — aber ein Lauf aus fremdem Text (Webhook) macht die Ecke voll', () => {
    const p = rechteProfil({ wer: { art: 'zoe' }, werkzeuge: ['freie_zeit'], gedaechtnis: { brain: false, akte: false } });
    expect(p.ampel).toBe('gruen');
    expect(rechteProfil({ wer: { art: 'zoe' }, werkzeuge: ['freie_zeit'], gedaechtnis: { brain: false, akte: false } }, { laufFremd: true }).fremderText).toBe(true);
  });
  it('ein Werkzeug der Klasse Geld macht die Freigabe Pflicht (Schloss „geld“)', () => {
    const p = rechteProfil({ wer: { art: 'zoe' }, werkzeuge: ['erfasse_rechnung'], gedaechtnis: { brain: false, akte: false } });
    expect(p.freigabePflicht).toBe(true);
    expect(agentSchlossGrund(p)).toBe('geld');
  });
});

describe('Freigabe-Schloss hinter jeder Außenwirkung — automatisch, nicht entfernbar', () => {
  const mail = (n: number, rang: number, extra = {}) => schritt(n, 'Mail-Entwurf', rang, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: {} }, ...extra });
  it('wird direkt hinter den Knoten gesetzt; idempotent; der Fluss geht durch das Schloss', () => {
    const d = definition([schritt(10, 'Vorbereiten', 1), mail(11, 2), schritt(12, 'Danach', 3)]);
    const r = schlossSetzen(d);
    expect(r.gesetzt).toEqual([schlossKennung(fk(11))]);
    const l = r.definition.knoten.find(k => k.id === schlossKennung(fk(11)))!;
    expect(l).toMatchObject({ form: 'freigabe', bahn: 'mensch', schloss: { fuer: fk(11), grund: 'aussen' }, elternId: fk(2) });
    expect(schlossSetzen(r.definition).definition).toBe(r.definition); // idempotent
    const k = kantenVon(r.definition);
    expect(k).toContainEqual({ von: fk(11), nach: l.id, ausgang: 'weiter' });
    expect(k).toContainEqual({ von: l.id, nach: fk(12), ausgang: 'ja' });
    expect(k).toContainEqual({ von: l.id, nach: null, ausgang: 'nein' });
    expect(schlossFehlt(r.definition)).toBe(false);
    expect(schlossFehlt(d)).toBe(true);
  });
  it('gelöscht → kommt wieder; braucht der Knoten keins mehr → fällt weg (samt Zweigen dorthin)', () => {
    const mit = schlossSetzen(definition([mail(11, 1), schritt(12, 'Danach', 2)])).definition;
    const ohneSchloss = { ...mit, knoten: mit.knoten.filter(k => !k.schloss) };
    expect(schlossSetzen(ohneSchloss).gesetzt).toHaveLength(1);
    const lid = schlossKennung(fk(11));
    const umgebaut = { ...mit, knoten: mit.knoten.map(k => (k.id === fk(11) ? { ...k, form: 'schritt' as const, katalog: { id: 'aufgabe.anlegen' } } : k.id === fk(12) ? { ...k, zweige: { fehler: lid } } : k)) };
    const r = schlossSetzen(umgebaut);
    expect(r.entfernt).toEqual([lid]);
    expect(r.definition.knoten.find(k => k.id === fk(12))!.zweige).toBeUndefined();
  });
  it('nur „abgelehnt“ und „abgelaufen“ sind am Schloss einstellbar — alles andere setzt die Regel zurück', () => {
    const mit = schlossSetzen(definition([mail(11, 1), schritt(12, 'Danach', 2), schritt(13, 'Abgelehnt', 3)])).definition;
    const lid = schlossKennung(fk(11));
    const geaendert = { ...mit, knoten: mit.knoten.map(k => (k.id === lid ? { ...k, form: 'schritt' as const, bahn: 'agent' as const, zweige: { ja: fk(13), nein: fk(13) } } : k)) };
    const l = schlossSetzen(geaendert).definition.knoten.find(k => k.id === lid)!;
    expect(l).toMatchObject({ form: 'freigabe', bahn: 'mensch', zweige: { nein: fk(13) } });
  });
  it('Agenten-Schritt mit „tödlichem Dreieck“ bekommt ein Schloss; ohne nicht', () => {
    const agent = (n: number, wer: AgentSchritt['wer']) => schritt(n, 'Agent', 1, { form: 'agent', agent: { ...basis({ wer }) } as AgentSchritt });
    expect(schlossSetzen(definition([agent(20, { art: 'fach', agentId: 'research' })])).gesetzt).toHaveLength(1);
    expect(schlossSetzen(definition([agent(20, { art: 'head', headId: 'sales' })])).gesetzt).toHaveLength(0);
  });
  it('die Prüfung meldet ein fehlendes Schloss als Fehler (Veröffentlichen ohne Schloss geht nicht)', () => {
    expect(definitionPruefen(definition([mail(11, 1)])).some(b => b.stufe === 'fehler' && /Schloss/.test(b.text))).toBe(true);
    expect(definitionPruefen(schlossSetzen(definition([mail(11, 1)])).definition).some(b => /Schloss/.test(b.text))).toBe(false);
  });
});

describe('Modell-Wahl nur aus dem Anbieter-Tor (keine eigene Liste)', () => {
  const st = STUFEN_SAETZE.bisher;
  const zustand = {
    anthropic: { eingerichtet: true, zdr: false, register: 'avv-offen' as const },
    'anthropic-vertex-eu': { eingerichtet: false, zdr: false, register: 'fehlt' as const },
  };
  it('Optionen = Zugänge mit Text × Stufen der Instanz; wählbar nach `anbieterWaehlen`', () => {
    const o = modellOptionen({ zustand, stufen: st });
    expect(new Set(o.map(x => x.anbieter))).toEqual(new Set(['anthropic', 'anthropic-vertex-eu']));
    expect(o.filter(x => x.anbieter === 'anthropic').map(x => x.modell)).toEqual([st.schnell, st.ausgewogen, st.stark]);
    expect(o.filter(x => x.anbieter === 'anthropic').every(x => x.waehlbar)).toBe(true); // Bestand: AVV erst im Modus „streng“ Pflicht
    expect(o.filter(x => x.anbieter === 'anthropic-vertex-eu').every(x => !x.waehlbar && /nicht angebunden/.test(x.grund!))).toBe(true);
    expect(modellOptionen({ zustand, stufen: st, streng: true }).find(x => x.anbieter === 'anthropic')!.waehlbar).toBe(false);
  });
  it('Datenschutzstufe je KI-Kategorie: Gesundheit nie an Anthropic direkt', () => {
    expect(modellOptionen({ zustand, stufen: st, kategorien: ['gesundheit'] }).some(x => x.waehlbar)).toBe(false);
  });
  it('eine Wahl außerhalb der Liste bzw. nicht wählbar ist offen; ohne Wahl gilt die Stufe', () => {
    const o = modellOptionen({ zustand, stufen: st });
    expect(modellWahlAus({ anbieter: 'anthropic', modell: st.stark, stufe: 'stark' }, o).befunde).toEqual([]);
    expect(modellWahlAus({ anbieter: 'anthropic', modell: 'claude-erfunden', stufe: 'stark' }, o).befunde[0].stufe).toBe('offen');
    expect(modellWahlAus({ anbieter: 'anthropic-vertex-eu', modell: st.stark, stufe: 'stark' }, o).befunde[0].stufe).toBe('offen');
    expect(modellWahlAus({ anbieter: 'openai-gibts-nicht', modell: 'x', stufe: 'stark' }, o).befunde[0].stufe).toBe('fehler');
    expect(modellWahlAus(undefined, o)).toEqual({ wahl: null, befunde: [] });
    const a = agentAus(basis({ modellWahl: { anbieter: 'anthropic', modell: st.stark, stufe: 'stark' } }), { modelle: o });
    expect(a.agent).toMatchObject({ modell: 'stark', modellWahl: { anbieter: 'anthropic', modell: st.stark } });
  });
});
