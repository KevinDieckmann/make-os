// ─── Prozesse · Kundengewinnung — die 18 Vorlagen (22.10.; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md) ─────────────────────────────────────────────
// Jede Vorlage (und jeder ihrer Teilprozesse) ist eine gültige Definition: speicherbar UND veröffentlichbar mit einem Prüf-Kontext wie auf dem Server (Team,
// Konten, Auswahllisten, Vorschlags-Arten, Teilprozesse veröffentlicht), hat benannte Ausgänge (jede Raute einen Nein-Zweig, jeder Weg endet an einem Ende),
// ein Schloss hinter jeder Außenwirkung (Mail, WhatsApp, Einladung, Mandat, Research mit dem „tödlichen Dreieck“), keine Namen, keine Firmen, keine Beträge,
// nur Business — und die reinen Module sind client-sicher. Rein, ohne Datenordner.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { KUNDENGEWINNUNG_VORLAGEN, VORLAGEN_NACH_WELLE, vorlageKurz, vorlageVorschau, vorlageVon } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { istVorlageRef, vorlageAusRef, knotenKennung, type KgVorlage } from '@/lib/prozesse/kundengewinnung/bau';
import { definitionPruefen, laufFremd, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from '@/lib/prozesse/definition-pruefen';
import { kantenVon, alleSchritte, schloesser } from '@/lib/prozesse/fluss';
import { schlossGrund, schlossFehlt } from '@/lib/prozesse/schloss';
import { katalogEintrag, katalogSelbstpruefung, ROLLEN_WERTE, POSTFACH_WERTE, GESELLSCHAFT_DES_FALLS, type AuswahlQuelle } from '@/lib/prozesse/baustein-katalog';
import { VORSCHLAG_ARTEN } from '@/lib/zoe/crm-vorschlag';
import { STUFEN } from '@/lib/crm/pipeline';
import { BUSINESS_GESELLSCHAFTEN } from '@/lib/einheiten';
import { PROZESS_EREIGNISSE, DATUMS_FELDER } from '@/lib/prozesse/ausloeser';
import { personAusRolle } from '@/lib/prozesse/kundengewinnung/rollen';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

const alleDefinitionen = (v: KgVorlage) => [{ d: v.definition, offen: v.offen }, ...v.teile.map(t => ({ d: t.definition, offen: t.offen }))];
const TEILE = new Set(KUNDENGEWINNUNG_VORLAGEN.flatMap(v => v.teile.map(t => t.id)));
const VORLAGEN_IDS = new Set(KUNDENGEWINNUNG_VORLAGEN.map(v => v.id));

/** Ein Prüf-Kontext wie auf dem Server (lib/prozesse/werkstatt-server.ts `pruefKontextFuer`) — mit erfundenem Team, ohne Datenordner. */
const kontext = (): PruefKontext => {
  const listen: Partial<Record<AuswahlQuelle, string[]>> = {
    'team-person': ['t-probe-eins', 't-probe-zwei', ...ROLLEN_WERTE.map(r => r.id)], 'konto-person': ['probe-eins'],
    'pipeline-stufe': STUFEN.map(s => s.id), postfach: POSTFACH_WERTE.map(p => p.id), gesellschaft: [...BUSINESS_GESELLSCHAFTEN, GESELLSCHAFT_DES_FALLS],
    head: ['sales', 'marketing', 'event', 'kundenerfolg'], ereignis: [...PROZESS_EREIGNISSE], datumsfeld: DATUMS_FELDER.map(x => x.id),
  };
  return {
    team: [{ id: 't-probe-eins', aktiv: true, speicher: 'probe-eins' }], konten: ['probe-eins'],
    auswahl: q => listen[q] ?? null, vorschlagArten: VORSCHLAG_ARTEN,
    // Teilprozesse und Übergaben der Bibliothek gelten hier als veröffentlicht (beim Übernehmen werden die Teile zuerst veröffentlicht).
    prozess: id => (istVorlageRef(id) && (TEILE.has(vorlageAusRef(id)) || VORLAGEN_IDS.has(vorlageAusRef(id))) ? { titel: vorlageAusRef(id), veroeffentlicht: true } : null),
  };
};

describe('Die Bibliothek', () => {
  it('18 Vorlagen V01 … V18 mit eindeutigen Kennungen, in drei Wellen (6 · 6 · 6), Teilprozesse eindeutig', () => {
    expect(KUNDENGEWINNUNG_VORLAGEN.map(v => v.nr)).toEqual(Array.from({ length: 18 }, (_, i) => `V${String(i + 1).padStart(2, '0')}`));
    expect(new Set(KUNDENGEWINNUNG_VORLAGEN.map(v => v.id)).size).toBe(18);
    expect([1, 2, 3].map(w => VORLAGEN_NACH_WELLE.filter(v => v.welle === w).length)).toEqual([6, 6, 6]);
    expect(TEILE.size).toBe(KUNDENGEWINNUNG_VORLAGEN.reduce((n, v) => n + v.teile.length, 0));
    expect(Array.from(TEILE).sort()).toEqual(['kg-v01a', 'kg-v04a', 'kg-v05a', 'kg-v06a', 'kg-v09a', 'kg-v18a']);
  });
  it('Bau-Reihenfolge: Welle 1 = V09, V07, V13, V12, V08, V15 (Übergabe und Lecks zuerst)', () => {
    expect(VORLAGEN_NACH_WELLE.filter(v => v.welle === 1).map(v => v.nr)).toEqual(['V09', 'V07', 'V13', 'V12', 'V08', 'V15']);
  });
  it('der Katalog bleibt in sich stimmig (neue Bausteine N3–N10 eingeschlossen)', () => {
    expect(katalogSelbstpruefung()).toEqual([]);
    for (const id of ['crm.entwurf-text', 'crm.karte-ergaenzen', 'crm.lead-parken', 'crm.mandat-anlegen', 'fulfillment.fall-starten', 'event.gaeste', 'crm.kampagnen-ergebnis', 'crm.anfrage-anlegen', 'crm.deal-vorschlagen', 'crm.deal-schritt', 'ausloeser.loop']) {
      expect(katalogEintrag(id), id).not.toBeNull();
    }
    for (const e of ['crm.lead-parken', 'event.gaeste', 'crm.kampagnen-ergebnis', 'crm.anfrage-anlegen', 'crm.deal-vorschlagen']) expect(VORSCHLAG_ARTEN).toContain(katalogEintrag(e)!.fest!.art);
  });
});

describe.each(KUNDENGEWINNUNG_VORLAGEN.map(v => [v.nr, v] as const))('%s', (_nr, v) => {
  it('speicherbar und veröffentlichbar (keine Befunde „fehler“ oder „offen“) — Hauptprozess und Teilprozesse', () => {
    for (const { d } of alleDefinitionen(v)) {
      const b = definitionPruefen(d, kontext());
      expect(sperrtSpeichern(b), `${d.id}: ${b.filter(x => x.stufe === 'fehler').map(x => x.text).join(' | ')}`).toBe(false);
      expect(sperrtVeroeffentlichen(b), `${d.id}: ${b.filter(x => x.stufe !== 'hinweis').map(x => x.text).join(' | ')}`).toBe(false);
    }
  });
  it('Steckbrief: Bereich Business, Fall-Art, Eigner-Rolle, Start- und Endkriterium, Beschreibung — kein Eigner als Person', () => {
    for (const { d } of alleDefinitionen(v)) {
      expect(d.bereich).not.toBe('fulfillment');
      expect(['marketing', 'sales', 'uebergabe', 'ausbau']).toContain(d.bereich);
      expect(d.fallArt).toBeTruthy();
      expect(d.eigner).toBeUndefined();
      expect((d.startKriterium ?? '').length).toBeGreaterThan(10);
      expect((d.endKriterium ?? '').length).toBeGreaterThan(10);
      expect(d.herkunft?.quelleIds).toEqual([d.id]);
    }
    expect(['sales', 'marketing', 'event', 'kundenerfolg']).toContain(v.eignerRolle);
    expect(v.zweck.length).toBeGreaterThan(40);
    expect(v.recht.length).toBeGreaterThan(0);
    expect(v.kennzahlen.length).toBeGreaterThan(0);
  });
  it('benannte Ausgänge: jede Raute hat einen Nein-Zweig, jeder Weg endet an einem Ende (nie still im Leeren)', () => {
    for (const { d } of alleDefinitionen(v)) {
      const schritte = alleSchritte(d).map(x => x.schritt);
      for (const k of schritte.filter(x => x.form === 'entscheidung')) expect(k.zweige?.nein, `${k.id} ohne Nein-Zweig`).toBeTruthy();
      const nach = new Map(d.knoten.map(k => [k.id, k]));
      const tot = kantenVon(d).filter(x => x.nach === null && (x.ausgang === 'weiter' || x.ausgang === 'ja') && nach.get(x.von)?.form !== 'ende');
      expect(tot.map(x => x.von), `${d.id}: Wege ohne Ende`).toEqual([]);
      expect(schritte.some(k => k.form === 'ende')).toBe(true);
    }
  });
  it('Schloss hinter jeder Außenwirkung (Mail, WhatsApp, Einladung, Mandat, Dreieck) — nach der EINEN Regel, nichts fehlt', () => {
    for (const { d } of alleDefinitionen(v)) {
      expect(schlossFehlt(d, { laufFremd: laufFremd(d) })).toBe(false);
      const s = schloesser(d.knoten);
      for (const { schritt: k } of alleSchritte(d)) {
        if (k.form === 'freigabe') continue;
        const grund = schlossGrund(k, { laufFremd: laufFremd(d) });
        if (grund) expect(s.has(k.id), `${k.id} (${grund}) ohne Schloss`).toBe(true);
        if (['inbox.mail-entwurf', 'whatsapp.entwurf', 'kalender.einladung', 'crm.mandat-anlegen', 'angebot.stellen'].includes(k.katalog?.id ?? '')) expect(s.has(k.id), `${k.id}`).toBe(true);
      }
    }
  });
  it('Personen nur als Rolle, Postfach und Gesellschaft nur „des Falls“ bzw. „des Laufs“ — keine Namen, keine Adressen, keine Beträge, keine Firmen', () => {
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/@|https?:\/\//);
    expect(text).not.toMatch(/\d[\d.]*\s?(€|EUR\b|Euro\b)/);
    expect(text).not.toMatch(/\b(kevin|malin|lena|jonas|ben|mira)\b/i);
    expect(text).not.toMatch(/\b(GmbH|UG|AG|KG)\b/);
    for (const { d } of alleDefinitionen(v)) for (const k of d.knoten) {
      const w = k.katalog?.werte ?? {};
      if (typeof w.wer === 'string') expect(ROLLEN_WERTE.map(r => r.id)).toContain(w.wer);
      if (typeof w.postfach === 'string') expect(POSTFACH_WERTE.map(r => r.id)).toContain(w.postfach);
      if (typeof w.gesellschaft === 'string') expect(w.gesellschaft).toBe(GESELLSCHAFT_DES_FALLS);
    }
  });
  it('Agenten-Schritte: Budget je Schritt (≤ 500 Cent), Pflichtsatz, Vertrag nur Kennungen/Zahlen/Auswahl; Research immer als Vorschlag', () => {
    for (const { d } of alleDefinitionen(v)) for (const { schritt: k } of alleSchritte(d)) {
      if (k.form !== 'agent') continue;
      const a = k.agent!;
      expect(a.budgetCent).toBeGreaterThan(0);
      expect(a.budgetCent).toBeLessThanOrEqual(500);
      expect(a.warumKeineRegel.length).toBeGreaterThanOrEqual(20);
      for (const f of a.ausgabe) expect(['kennung', 'zahl', 'datum', 'ja-nein', 'auswahl']).toContain(f.art);
      if (a.wer.art === 'fach') expect(a.ergebnis).toBe('vorschlag');
    }
  });
  it('Einstellbares zeigt auf vorhandene Schritte; Übergaben und Teilprozesse zeigen auf Vorlagen der Bibliothek', () => {
    const lokal = new Set(alleDefinitionen(v).flatMap(({ d }) => d.knoten.map(k => k.id)));
    for (const e of v.einstellbar) if (e.knoten) expect(lokal.has(knotenKennung(v.id, e.knoten)) || v.teile.some(t => lokal.has(knotenKennung(t.id, e.knoten!))), `${v.id}: ${e.knoten}`).toBe(true);
    for (const { d } of alleDefinitionen(v)) for (const k of d.knoten) {
      const refs = [k.schleife?.prozessId, k.teilprozess?.prozessId, k.ende?.uebergabeAn].filter((x): x is string => !!x);
      for (const r of refs) { expect(istVorlageRef(r)).toBe(true); expect(VORLAGEN_IDS.has(vorlageAusRef(r)) || TEILE.has(vorlageAusRef(r))).toBe(true); }
    }
    for (const u of v.uebergabeAn) expect(vorlageVon(u)).not.toBeNull();
  });
  it('Galerie-Kurzform und Vorschau (Bild) ohne Freigabe-Knoten', () => {
    const k = vorlageKurz(v);
    expect(k.schritte).toBeGreaterThan(2);
    expect(k.ausloeser.length).toBeGreaterThan(0);
    const vs = vorlageVorschau(v.definition);
    expect(vs.length).toBeGreaterThan(0);
    expect(vs.flatMap(p => p.schritte).some(s => s.form === 'freigabe')).toBe(false);
  });
});

describe('Rollen statt Personen', () => {
  it('rolle:eigner → Eigner, rolle:zustaendig → Zuständige des Falls, sonst der Eigner; Team-Kennung bleibt; ohne Eigner null (nie Inhaber)', () => {
    expect(personAusRolle('rolle:eigner', { eigner: 't-a', zustaendig: 't-b' })).toBe('t-a');
    expect(personAusRolle('rolle:zustaendig', { eigner: 't-a', zustaendig: 't-b' })).toBe('t-b');
    expect(personAusRolle('rolle:zustaendig', { eigner: 't-a' })).toBe('t-a');
    expect(personAusRolle('t-c', { eigner: 't-a' })).toBe('t-c');
    expect(personAusRolle('rolle:eigner', {})).toBeNull();
  });
});

describe('Client-sicher', () => {
  const WURZEL = path.resolve(__dirname, '..');
  it('die reinen Module der Bibliothek laden keine Bestände, keine Node-Module, kein KI-Tor', () => {
    const ordner = path.join(WURZEL, 'lib/prozesse/kundengewinnung');
    const rein = fs.readdirSync(ordner).filter(f => f.endsWith('.ts') && !f.endsWith('-server.ts'));
    expect(rein.length).toBeGreaterThan(5);
    for (const f of rein) {
      const q = fs.readFileSync(path.join(ordner, f), 'utf8');
      expect(q, f).not.toMatch(/from\s+['"](node:|fs|path|crypto|next\/server)['"]|local-db|lib\/anthropic|-server['"]/);
    }
  });
});

// Kein Prozess der Bibliothek ist ein Fulfillment-Paket ohne Bereich (die Landkarte zeigt sie in ihrem Bereich der Fliege).
const _typ: ProzessDefinition | undefined = undefined; void _typ;
