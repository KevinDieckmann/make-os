// Wächter (16.10., zweite Abnahme — die restlichen Funde B11, C1, C4, C6, C7, C9, C10, C12, C17): je Regel EINE Stelle und ein Fall.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { anzahl, satz, wort } from '@/lib/text/zahlwort';
import { ehrgeizigeZiele, type ScoreZeile } from '@/lib/crm/scoreboard';
import { zuletztTag, type Kontakt } from '@/lib/make-one/crm';
import { verbindenAnzeige } from '@/lib/kalender/verbinden-anzeige';
import { passung } from '@/lib/fokus/steuerung';
import { kapazitaetUeberlastet } from '@/lib/kapazitaet/abweichung';
import { abweichungText } from '@/lib/lichtfaeden/abweichung';
import { GESAMT } from '@/lib/lichtfaeden/modell';
import { zielFortschrittAusTeilen, zieleDateiFortschritt } from '@/lib/planung/meilenstein-aufgaben';
import { zielIst } from '@/lib/planung/ziel-ist';
import { organigramm, orgLinie } from '@/lib/gesellschaften/schild/struktur';
import { gesundheitOhneEinwilligung } from '@/lib/gesundheit/speicher';
import { istKostenlos } from '@/lib/crm/produkte';
import { planungFehlt } from '@/lib/finanzen/produkte';
import { flussFamilie } from '@/lib/fluss/bereiche';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';
import type { KapaStand, PersonStand, WochePerson } from '@/lib/kapazitaet/typen';
import type { Leistung } from '@/lib/crm/typen';
import type { RegisterGesellschaft } from '@/lib/gesellschaften/modell';

const lies = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');

describe('C6 · Einzahl/Mehrzahl und Satzende an EINER Stelle', () => {
  it('anzahl/wort/satz', () => {
    expect(anzahl(1, 'Mandat', 'Mandate')).toBe('1 Mandat');
    expect(anzahl(3, 'Konto', 'Konten')).toBe('3 Konten');
    expect(anzahl(0, 'offener Punkt', 'offene Punkte')).toBe('0 offene Punkte');
    expect(anzahl(1500, 'Rechnung', 'Rechnungen')).toBe('1.500 Rechnungen');
    expect(wort(1, 'Widerspruch', 'Widersprüche')).toBe('Widerspruch');
    expect(satz('überlastet ab 26.10.')).toBe('überlastet ab 26.10.');
    expect(satz('Alles im Plan')).toBe('Alles im Plan.');
  });
  it('die gefundenen Stellen nutzen den Helfer (keine „1 Mandate“, „Kontoen“, „1 offenen Rechnungen“ mehr)', () => {
    expect(lies('lib/crm/befunde.ts')).toContain("anzahl(widersprueche.length, 'Mandat', 'Mandate')");
    expect(lies('lib/finanzen/chef/ist-stand.ts')).not.toMatch(/Konto\$\{[^}]*'en'/);
    expect(lies('lib/business/messen.ts')).toContain("anzahl(offen.length, 'offenen Rechnung', 'offenen Rechnungen')");
    expect(lies('lib/crm/kunden.ts')).toContain("anzahl(m.offen.length, 'offener Punkt', 'offene Punkte')");
    expect(lies('lib/lichtfaeden/baum.ts')).toContain('satz(`Abweichungen vom Plan:');
  });
  it('sichtbare Texte der Mandate sagen „Gesundheit“ statt „Health“ (Kennungen bleiben)', () => {
    for (const d of ['components/os/crm/Kunden.tsx', 'components/os/mandate/ProdukteMandate.tsx', 'lib/crm/kunden.ts', 'lib/crm/heute.ts', 'lib/heads/grundlauf.ts']) {
      const sichtbar = lies(d).split('\n').filter(z => !/^\s*(\/\/|\*|\{\/\*)/.test(z)).join('\n');
      expect(sichtbar, d).not.toMatch(/[`'">]Health [{$a-z0-9]|Health bewerten|Health prüfen|Laufzeit, Health/);
    }
  });
  it('„Top 3 heute“ nur mit drei Einträgen — sonst „Wichtig heute“', () => {
    expect(lies('components/os/heute/Top3.tsx')).toContain("anzahlZeilen === 1 || anzahlZeilen === 2 ? 'Wichtig heute' : 'Top 3 heute'");
  });
});

describe('B11 · Markttraktion', () => {
  it('„Für dich“ öffnet die Leads-Liste auf „Meins“; die Pillen zählen in der gewählten Sicht; der Trichter auf „Alle“', () => {
    expect(lies('lib/crm/team.ts')).toContain("filter: 'qualifizierung', wer: 'ich'");
    expect(lies('lib/crm/team.ts')).toContain('von ${imTeam} im Team');
    const l = lies('components/os/crm/Leads.tsx');
    expect(l).toMatch(/const zahl = \(f: Filter\) => alleLeads\.filter\(z => passtWer\(wer,/);
    expect(l).toContain("leadsFilterSetzen(s.ziel.filter, 'alle')");
    expect(l).toContain('zahlen={werZahlen}');
  });
  it('Scoreboard: ein Soll aus der Planung weit über dem bisher Besten heißt „ehrgeizig“ (je Teamzeile)', () => {
    const z = (id: string, ziel: number | null, werte: (number | null)[], o: Partial<ScoreZeile> = {}): ScoreZeile => ({ id, welt: 'sales', label: id, ziel, zielText: `≥ ${ziel}`, werte, ampeln: [], quelle: '', plan: true, ...o });
    const e = ehrgeizigeZiele({ zeilen: [z('neue_leads', 116, [null, 8]), z('gespraeche', 2, [1, 2]), z('angebote', 4, [null, null]), z('x', 30, [12], { person: 'p' }), z('y', 30, [1], { plan: undefined })] });
    expect(e.map(x => x.id)).toEqual(['neue_leads', 'angebote']);
    expect(e[0]).toMatchObject({ ziel: 116, bisher: 8 });
  });
  it('die Demo setzt ein Umsatzziel über zwölf Monate (kein Fenster von 1–3 Wochen) und unterschiedlich weit qualifizierte Leads', () => {
    const s = lies('lib/demo/saat.ts');
    expect(s).toContain("bis: tagPlus(heute, 364), umsatz: 60_000");
    expect(s).toContain("aktion: 'setze', id, felder: { stufen }");
  });
  it('Kartei „Zuletzt“: jüngster Tag aus letztem Kontakt UND Aktivitäten (auch Notizen), nie System, nie Zukunft', () => {
    const k = (x: Partial<Kontakt>): Pick<Kontakt, 'letzterKontakt' | 'aktivitaeten'> => ({ aktivitaeten: [], ...x });
    expect(zuletztTag(k({}), '2026-10-16')).toBeUndefined();
    expect(zuletztTag(k({ aktivitaeten: [{ am: '2026-10-15T08:00:00.000Z', art: 'notiz', text: 'x', von: 'lena' }] }), '2026-10-16')).toBe('2026-10-15');
    expect(zuletztTag(k({ letzterKontakt: '2026-10-01', aktivitaeten: [{ am: '2026-10-15T08:00:00.000Z', art: 'system', text: 'x', von: 'system' }] }), '2026-10-16')).toBe('2026-10-01');
    expect(zuletztTag(k({ aktivitaeten: [{ am: '2026-10-15T08:00:00.000Z', art: 'termin', text: 'x', von: 'lena', wann: '2026-10-30T10:00' }] }), '2026-10-16')).toBeUndefined();
    expect(lies('components/os/crm/Kartei.tsx')).toContain('zuletztTag(k, heute)');
  });
  it('C21: Demo-Aktivitäten verteilt (früher am Tag, nie vor dem Anlagetag) und von der Person, die die Beziehung hält', () => {
    const s = lies('lib/demo/saat.ts');
    expect(s).toContain('frueher(40 + i * 23)');
    expect(s).toContain('von: besitzer');
  });
});

describe('C1 · Kalender', () => {
  it('„<Firma> verbinden · noch nicht eingerichtet“ nur, wo jemand etwas tun kann (Betreiber)', () => {
    expect(verbindenAnzeige('business', { konfiguriert: false, verbunden: false }, null).google).toBeNull();
    expect(verbindenAnzeige('business', { konfiguriert: false, verbunden: false }, null, { betreiber: true }).google).toBe('karte');
    expect(verbindenAnzeige('business', { konfiguriert: true, verbunden: false }, null).google).toBe('karte');
  });
  it('Raster: Schloss hinter der Zeit, Stunde weicht der Jetzt-Zeit, rollt in sich (Handy)', () => {
    const q = lies('components/os/kalender/Zeitraster.tsx');
    expect(q).toContain('{zeit}{schloss}');
    expect(q).toContain("Math.abs((h * 60 - jetztMin!) * px) < 16 ? 'hidden'");
    expect(q).toContain("maxHeight: 'max(420px, calc(100dvh - 150px - var(--os-ablage)))'"); // seit 18.10. minus die Ablage unten (ZOE-Kugel)
    expect(q).not.toMatch(/\{!ev\.bearbeitbar && !ev\.maskiert && <span aria-label="nur in Apple" style=\{\{ marginRight: 4 \}\}>🔒/);
  });
});

describe('C4 · Fokus', () => {
  const woche = (w: string, belastbar: number, bedarf: number): WochePerson => ({ woche: w, brutto: belastbar, abwesend: 0, termine: 0, termineAnzahl: 0, umschalten: 0, bloecke: 0, netto: belastbar, belastbar, gebunden: 0, bedarf });
  const person = (id: string, name: string, wochen: WochePerson[]): PersonStand => ({ id, name, quelle: 'konto', grundwert: 40, grundwertQuelle: 'einstellung', wochen, ausnahmen: [] });
  it('zusammenhängende Überlast-Wochen am selben Posten sind EINE Engstelle (vorher dreimal „Kapazität Mira … überlastet“)', () => {
    const stand: Pick<KapaStand, 'team' | 'personen' | 'posten'> = { team: { wochen: [], kopf: { faktor: 1, personen: 0, tage: 14 } }, posten: [],
      personen: [person('konto-mira', 'Mira', [woche('2026-10-12', 20, 40), woche('2026-10-19', 20, 30), woche('2026-10-26', 20, 50), woche('2026-11-02', 20, 10), woche('2026-11-09', 20, 30)])] };
    const aus = kapazitaetUeberlastet(stand, 'mira')({ heute: '2026-10-12', von: '2026-10-12', bis: '2026-11-15', straenge: [] });
    expect(aus).toHaveLength(2);
    expect(aus[0]).toMatchObject({ von: '2026-10-12', bis: '2026-11-01', staerke: 1, pfad: [GESAMT, 'space:business'] });
    expect(abweichungText(aus[0])).toBe('Kapazität Mira überlastet 12.10.–01.11.');
    expect(abweichungText(aus[1])).toBe('Kapazität Mira überlastet ab 09.11.');
  });
  it('gleiche Regler (Grundeinstellung) machen kein Thema „hoch“ — keine rote Warnung aus Vorgaben; ein echtes Gewicht schon', () => {
    const th = (g: number[]) => g.map((gewicht, i) => ({ id: `t${i}`, label: `T${i}`, gewicht, zeit: [`z${i}`] }));
    const ist = { t0: { sek: 0, bewusstSek: 0, eingeplantSek: 0 }, t1: { sek: 0, bewusstSek: 0, eingeplantSek: 0 }, t2: { sek: 9000, bewusstSek: 0, eingeplantSek: 0 } };
    expect(passung(th([50, 50, 50]), {}, ist, 9000).stufe).not.toBe('kritisch');
    expect(passung(th([70, 50, 50]), {}, ist, 9000).stufe).toBe('kritisch');
  });
});

describe('C17 · Ziel-Fortschritt: EINE Regel (Meilensteine + Unterziele), abgeleitete folgen, Ist daneben', () => {
  const ms = (id: string, zielId: string, fortschritt: number, erledigt = false) => ({ id, titel: id, zielId, fortschritt, erledigt }) as Meilenstein;
  const z = (id: string, x: Partial<Ziel> = {}): Ziel => ({ id, titel: id, fortschritt: 0, ...x });
  it('Unterziele zählen in den Fortschritt (auch aus einem anderen Horizont)', () => {
    const l = [ms('a', 'cockpit', 0), ms('b', 'cockpit', 0), ms('c', 'cockpit', 0)];
    expect(zielFortschrittAusTeilen('cockpit', [z('cockpit'), z('piloten', { oberzielId: 'cockpit', fortschritt: 50 })], l)).toBe(13);
    expect(zielFortschrittAusTeilen('cockpit', [z('cockpit')], l)).toBe(0);
    expect(zielFortschrittAusTeilen('leer', [z('leer')], [])).toBeNull();
    const d = zieleDateiFortschritt({ jahr: [z('cockpit')], quartal: [z('piloten', { oberzielId: 'cockpit', fortschritt: 50 }), z('cockpit~quartal', { abgeleitetVon: 'cockpit' })] }, l);
    expect(d.datei.jahr!.find(x => x.id === 'cockpit')!.fortschritt).toBe(13);
    // Abgeleitet ohne eigene Teile: der Fortschritt des Elternziels statt 0 %.
    expect(d.datei.quartal!.find(x => x.id === 'cockpit~quartal')!.fortschritt).toBe(13);
  });
  it('Ist eines Zahlenziels mit Messgröße steht daneben: „Ist 5.950 € = 24 %“', () => {
    expect(zielIst({ messgroesse: 'mrr', zielwert: 25000 }, { mrr: 5950 })?.text).toBe('Ist 5.950 € = 24 %');
    expect(zielIst({ zielwert: 25000 }, { mrr: 5950 })).toBeNull();
    expect(zielIst({ messgroesse: 'mrr' }, { mrr: 5950 })).toBeNull();
    expect(lies('components/os/seil/SeilBand.tsx')).toContain("{s.ist ? ` · ${s.ist}` : ''}");
  });
});

describe('C10 · Wer hält wen: keine Linie hinter einem Kasten, Anteil an seiner Linie, Inhaber-Linie', () => {
  const g = (id: string, x: Partial<RegisterGesellschaft>): RegisterGesellschaft => ({ id, name: id, ...x }) as RegisterGesellschaft;
  const alle = [
    g('kdc', { rechtsform: 'einzel', organe: [{ id: 'og-1', funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: 'lena' }, seit: '2019-03-01' }] }),
    g('kdv', { rechtsform: 'ug', gesellschafter: [{ id: 'gs-1', wer: { art: 'person', id: 'lena' }, nennbetragCent: 500_000, einlage: 'ja' }] }),
    g('ug', { rechtsform: 'gmbh', gesellschafter: [{ id: 'gs-2', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }] }),
    g('neu', { rechtsform: 'gmbh', gesellschafter: [{ id: 'gs-3', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 1_500_000, einlage: 'nein' }, { id: 'gs-4', wer: { art: 'person', id: 'jonas' }, nennbetragCent: 1_000_000, einlage: 'nein' }] }),
  ];
  const b = organigramm(alle, x => x.id);
  it('das Einzelunternehmen hängt mit einer Inhaber-Linie an der Person', () => {
    expect(b.kanten.find(k => k.zu === 'gesellschaft:kdc')).toMatchObject({ von: 'person:lena', inhaber: true });
  });
  it('die Linie über zwei Reihen läuft durch einen freien Platz — kein Kasten der Reihe dazwischen steht an ihrer Stelle', () => {
    const lang = b.kanten.find(k => k.von === 'person:jonas')!;
    expect(lang.punkte).toHaveLength(1);
    const p = lang.punkte![0];
    const reihe1 = b.knoten.filter(k => k.ebene === 1);
    for (const k of reihe1) expect(p.x < k.x || p.x > k.x + 196, k.id).toBe(true);
  });
  it('keine zwei Linien zwischen benachbarten Reihen kreuzen sich (Lage der Enden)', () => {
    const lage = (s: string) => b.knoten.find(k => k.schluessel === s)!;
    // Je Linie die Abschnitte zwischen benachbarten Reihen: [Reihe oben, x oben, x unten] (Zwischenpunkte = Mitte des freien Platzes → linke Kante).
    const paare: [number, number, number][] = [];
    for (const k of b.kanten) {
      const a = lage(k.von);
      const xs = [a.x, ...(k.punkte ?? []).map(p => p.x - 98), lage(k.zu).x];
      for (let i = 1; i < xs.length; i++) paare.push([a.ebene + i - 1, xs[i - 1], xs[i]]);
    }
    for (const a of paare) for (const c of paare) if (a !== c && a[0] === c[0] && a[1] !== c[1] && a[2] !== c[2]) expect((a[1] - c[1]) * (a[2] - c[2]) > 0, `${a} × ${c}`).toBe(true);
  });
  it('die Beschriftung sitzt nahe am Ziel auf der eigenen Linie', () => {
    const { marke } = orgLinie({ x: 0, y: 0 }, { x: 400, y: 300 });
    expect(marke.y).toBeGreaterThan(150);
    expect(marke.x).toBeGreaterThan(200);
  });
});

describe('C7 · Produkte: eine Zählung, kostenlos ist ein Preis', () => {
  it('kostenlos zählt nicht als „Preis offen“ und nicht als „für die Planung unvollständig“', () => {
    const l = { preis: { betrag: 0, einheit: 'kostenlos', basis: 'einmalig' }, gesellschaft: 'ug' } as Leistung;
    expect(istKostenlos(l)).toBe(true);
    expect(planungFehlt(l)).toEqual([]);
    expect(istKostenlos({ preis: { betrag: 0, einheit: 'Monat netto' } } as Leistung)).toBe(false);
  });
  it('Demo: der Kennzahlen-Check der Treppe steht als Produkt im Katalog; Einstieg < Kern < Premium', () => {
    const s = lies('lib/demo/saat.ts');
    expect(s).toContain("{ id: 'l-demo-check', name: 'Kennzahlen-Check'");
    expect(s).toContain("leistungIds: ['l-demo-check']");
    expect(s).toContain("name: 'Vertriebsaufbau', typ: 'retainer', stufe: 'premium'");
    expect(s).toContain("name: 'Cockpit-Lizenz', typ: 'software', stufe: 'kern'");
  });
});

describe('C9 · Familie: der feste Gesprächs-Termin ist Geplantes', () => {
  it('ein Rhythmus-Gespräch füllt die Prognose, als Zeile nur das nächste', () => {
    const r = flussFamilie({ heute: '2026-10-15', gewesen: [], geplant: [
      { id: 'gespraech-rhythmus:2026-10-18', titel: 'Paar-Gespräch', tag: '2026-10-18', art: 'gespraech' },
      { id: 'gespraech-rhythmus:2026-10-25', titel: 'Paar-Gespräch', tag: '2026-10-25', art: 'gespraech' },
    ] });
    expect(r.prognoseGrundlage).not.toBeNull();
    expect(r.zeilen.filter(x => x.titel === 'Paar-Gespräch')).toHaveLength(1);
    expect(lies('lib/fluss/server.ts')).toContain('...gespraechsRhythmus(f, heute, naechstesGespraech)');
  });
});

describe('C11/C12', () => {
  it('Handy: „Mit … sprechen“ zeigt eine Sprechblase statt eines leeren Kreises; Platz unten für die ZOE-Kugel', () => {
    expect(lies('components/os/crm/ZoeFragen.tsx')).toContain('zoe-fragen-symbol');
    const css = lies('app/globals.css');
    expect(css).toContain('.ui-kopf-aktion .zoe-fragen-symbol { display: block; }');
    // Seit 18.10. reserviert die Ablage unten den Platz (`<main>` endet über Leiste + Streifen der Kugel) — Wächter tests/nachpruefung-l1b.test.ts › N20.
    expect(css).toContain('height: calc(100dvh - var(--os-leiste-handy) - var(--os-ablage))');
  });
  it('Gesundheit ohne Einwilligung: keine Werte — Index und Säulen ohne Zahl, jede Kennzahl „ohne Einwilligung“', () => {
    const st = gesundheitOhneEinwilligung('jonas', '2026-10-16');
    expect(st.pi.index).toBeNull();
    for (const s of st.pi.saeulen) {
      expect(s.score, s.id).toBeNull();
      for (const k of s.kennzahlen) expect(k.gemessen || k.wert !== null, k.id).toBe(false);
    }
    expect(lies('app/api/gesundheit/index/route.ts')).toContain('gesundheitVerarbeitungErlaubt(person)');
  });
});
