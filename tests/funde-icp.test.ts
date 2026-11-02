// ─── Funde — Profil Start-ups (31.10.2026, lib/funde/icp.ts) — rein, erfundene Daten ─────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { icpMerkmaleAus, icpBewerten, prioritaetVon, vertriebsleitungAus, teamGroesse, stellenZahl, zielgruppeVon, konzernAus, ICP_RASTER, type IcpMerkmale } from '@/lib/funde/icp';
import { profilFuer, PROFIL_STARTUP, PROFIL_SCALEUP, PROFIL_UNTERNEHMER, PROFIL_HOMEPAGE, FUND_BRANCHEN, kampagneVon } from '@/lib/funde/typen';
import { osmBranche } from '@/lib/funde/osm';
import { entwurfBauen } from '@/lib/funde/entwurf';
import { icpNotiz } from '@/lib/funde/uebernehmen';
import { PLAYBOOKS } from '@/lib/crm/kampagnen';

const basis: IcpMerkmale = { deutschland: true, produktLive: true, b2b: true, vertriebGesucht: true, konzern: false, wettbewerb: false, mitarbeitende: null, stellen: 0, vertriebsleitung: 'unbekannt', linkedin: true, sichtbarkeitSchwach: false };
const AM = '2026-10-31T10:00:00.000Z';

describe('ICP-Raster', () => {
  it('rechnet genau die Punkte des Rasters', () => {
    const r = icpBewerten(basis, { thema: 'KI-Software', signal: 'Portfolio eines Landesfonds', stadt: 'Berlin', geschaeftsfuehrung: true }, AM);
    expect(r.score).toBe(25 + 20 + 15 + 10 + 10 + 10 + 5);
    expect(r.stufe).toBe('A');
    expect(r.einstieg).toBe('vertrieb');
    expect(r.aufhaenger.length).toBeLessThanOrEqual(3);
    expect(ICP_RASTER.kann.reduce((n, k) => n + k.punkte, 0)).toBe(100);
  });
  it('ohne Produkt am Markt: Einstieg Sichtbarkeit, niedrige Stufe', () => {
    const r = icpBewerten({ ...basis, produktLive: false, vertriebGesucht: false, b2b: false }, { geschaeftsfuehrung: false }, AM);
    expect(r.einstieg).toBe('sichtbarkeit');
    expect(r.stufe).toBe('C');
  });
  it('Ausschlüsse: Konzern, Wettbewerb, Konzerngröße, nicht in Deutschland → 0 Punkte', () => {
    for (const m of [{ konzern: true }, { wettbewerb: true }, { mitarbeitende: 1500 }, { deutschland: false }]) {
      const r = icpBewerten({ ...basis, ...m }, { geschaeftsfuehrung: true }, AM);
      expect(r.score).toBe(0);
      expect(r.ausschluss).toBeTruthy();
    }
  });
  it('liest Merkmale aus Startseite, Impressum und Karriere', () => {
    const m = icpMerkmaleAus({
      start: '<title>Beispiel GmbH – Software</title><meta name="description" content="Planungssoftware für Unternehmen im Mittelstand, jetzt kostenlos testen."><p>Preise</p><a href="https://www.linkedin.com/company/beispiel">LinkedIn</a>' + ' Text'.repeat(300),
      impressum: '<p>Beispiel GmbH, Musterstraße 1, 10115 Berlin</p>',
      karriere: '<h2>Account Executive (m/w/d)</h2>',
    });
    expect(m).toMatchObject({ deutschland: true, produktLive: true, b2b: true, vertriebGesucht: true, linkedin: true, mitarbeitende: null, stellen: 1, wettbewerb: false, vertriebsleitung: 'unbekannt' });
  });
  it('Teamgröße nur aus Selbstangaben — nie Kundengrößen', () => {
    expect(teamGroesse('Wir sind 35 Mitarbeitende')).toBe(35);
    expect(teamGroesse('Wir sind über 120 Mitarbeiter')).toBe(120);
    expect(teamGroesse('Our team of 200+ people')).toBe(200);
    expect(teamGroesse('Ein Kunde löste mit uns 750 Mitarbeitende auf 350 Plätzen ab')).toBeNull();
    expect(teamGroesse('Bis zu 2000 Mitarbeitende')).toBeNull();
  });
  it('Scale-up: eigene Zielgruppe statt Ausschluss — ab 50 Mitarbeitenden, 8 Stellen oder Wachstumsrunde', () => {
    expect(zielgruppeVon({ mitarbeitende: 30, stellen: 2 })).toBe('startup');
    expect(zielgruppeVon({ mitarbeitende: 80, stellen: 0 })).toBe('scaleup');
    expect(zielgruppeVon({ mitarbeitende: null, stellen: 9 })).toBe('scaleup');
    expect(zielgruppeVon({ mitarbeitende: null, stellen: 0 }, 'Series B, 30 Mio. € (03/2026)')).toBe('scaleup');
    expect(stellenZahl('Account Executive (m/w/d) · Engineer (w/m/d) · Designer (all genders)')).toBe(3);
    const r = icpBewerten({ ...basis, mitarbeitende: 140 }, { geschaeftsfuehrung: true }, AM);
    expect(r).toMatchObject({ zielgruppe: 'scaleup', einstieg: 'struktur', mitarbeitende: 140 });
    expect(r.ausschluss).toBeUndefined();
    expect(r.aufhaenger.join(' ')).toMatch(/Struktur|Playbook/);
    expect(r.aufhaenger.join(' ')).not.toMatch(/63,5/);
  });
  it('Vertriebsleitung: besetzte Rolle ja, Stellenanzeige nicht, ohne Teamseite unbekannt', () => {
    expect(vertriebsleitungAus('Unser Team: Head of Sales, CTO, CEO', true)).toBe('ja');
    expect(vertriebsleitungAus('Wir suchen: Head of Sales (m/w/d)', true)).toBe('nein');
    expect(vertriebsleitungAus('Team: CEO, CTO, Product', true)).toBe('nein');
    expect(vertriebsleitungAus('Willkommen', false)).toBe('unbekannt');
  });
  it('Lead-Score: Passung + Handy vor Festnetz vor Mail + Geschäftsführung + fehlende Vertriebsleitung', () => {
    expect(prioritaetVon(80, { mobil: '+491701234567', geschaeftsfuehrung: true, vertriebsleitung: 'nein' })).toBe(88);
    expect(prioritaetVon(80, { telefon: '+49301234567', geschaeftsfuehrung: true })).toBe(70);
    expect(prioritaetVon(80, { email: 'info@example.invalid', geschaeftsfuehrung: false })).toBe(54);
    expect(prioritaetVon(0, { mobil: '+491701234567', geschaeftsfuehrung: true })).toBe(0);
  });
  it('Unternehmer laut Quelle bzw. nach acht Jahren — mit eigener Ansprache; Mittelstand ab 250 raus', () => {
    expect(zielgruppeVon({ mitarbeitende: 40, stellen: 0 }, 'Innovationspreis 2025', { art: 'unternehmer' })).toBe('unternehmer');
    expect(zielgruppeVon({ mitarbeitende: null, stellen: 0 }, undefined, { gruendungsjahr: 2012, jahrHeute: 2026 })).toBe('unternehmer');
    const r = icpBewerten(basis, { geschaeftsfuehrung: true, art: 'unternehmer', signal: 'Preisträger Innovationspreis 2025' }, AM);
    expect(r).toMatchObject({ zielgruppe: 'unternehmer', einstieg: 'vertrieb' });
    expect(r.aufhaenger.join(' ')).toMatch(/planbar/);
    expect(icpBewerten({ ...basis, mitarbeitende: 300 }, { geschaeftsfuehrung: true, art: 'unternehmer' }, AM).ausschluss).toMatch(/Mittelstand/);
    expect(profilFuer('unternehmer')).toBe(PROFIL_UNTERNEHMER);
  });
  it('Konzern nur als Aussage über die Firma selbst', () => {
    expect(konzernAus('Beispiel GmbH ist ein Unternehmen der Muster Gruppe')).toBe(true);
    expect(konzernAus('Die Amazon Web Services EMEA SARL ist eine Tochtergesellschaft der Amazon.com, Inc.')).toBe(false);
  });
});

describe('Profil Start-ups im Funde-Modul', () => {
  it('eigene Kampagne, eigenes Segment, eigenes Label — nie der Homepage-Funnel', () => {
    expect(profilFuer('startup')).toBe(PROFIL_STARTUP);
    expect(profilFuer('gastro')).toBe(PROFIL_HOMEPAGE);
    expect(PROFIL_STARTUP.label).not.toBe(PROFIL_HOMEPAGE.label);
    expect(PROFIL_STARTUP.segmentId).not.toBe(PROFIL_HOMEPAGE.segmentId);
    const pb = PLAYBOOKS.find(p => p.id === PROFIL_STARTUP.playbook);
    expect(pb?.zielgruppe.label).toEqual([PROFIL_STARTUP.label]);
    expect(FUND_BRANCHEN.some(b => b.id === 'startup')).toBe(true);
    expect(osmBranche('startup')).toBe(false);
    expect(osmBranche('scaleup')).toBe(false);
    expect(profilFuer('scaleup')).toBe(PROFIL_SCALEUP);
    expect(new Set([PROFIL_HOMEPAGE, PROFIL_STARTUP, PROFIL_UNTERNEHMER, PROFIL_SCALEUP].map(p => p.label)).size).toBe(4);
    expect(PLAYBOOKS.find(p => p.id === PROFIL_SCALEUP.playbook)?.zielgruppe.label).toEqual([PROFIL_SCALEUP.label]);
    expect(kampagneVon({ kampagneId: 'h', kampagneStartupId: 's', kampagneScaleupId: 'c' } as never, PROFIL_SCALEUP)).toBe('c');
  });
  it('Entwurf: Sie, Anlass mit Quelle, Datenschutz, nie Software- oder Partnernamen', () => {
    const icp = icpBewerten(basis, { geschaeftsfuehrung: true }, AM);
    const e = entwurfBauen({ name: 'Beispiel GmbH', quelle: 'hand', branche: 'startup', icp, inhaber: 'Erika Muster', inhaberArt: 'person', quellen: { inhaber: 'https://beispiel.example.invalid/impressum' } },
      { absender: 'Beispiel-Absender', datenschutz: { mail: 'datenschutz@example.invalid' } });
    expect(e.text).toContain('Guten Tag Erika Muster,');
    expect(e.text).toContain('Sie');
    expect(e.text).toContain('Datenschutz');
    expect(e.text).not.toMatch(/MAKE OS|Connect|Fokus Innovation/);
    expect(e.anruf).toContain('§ 7 UWG');
    expect(e.ki).toBe(false);
  });
  it('Scale-up-Entwurf spricht Struktur an, nicht „vom Produkt in den Markt“', () => {
    const icp = icpBewerten({ ...basis, mitarbeitende: 90 }, { geschaeftsfuehrung: false }, AM);
    const e = entwurfBauen({ name: 'Beispiel AG', quelle: 'hand', branche: 'scaleup', icp }, { absender: 'Beispiel-Absender', datenschutz: { mail: 'datenschutz@example.invalid' } });
    expect(e.betreff).toContain('Struktur');
    expect(e.text).toContain('wachsende Vertriebsteams');
    expect(e.text).toContain('Guten Tag,');
    expect(e.anruf).toContain('eingearbeitet');
  });
  it('Notiz an der Firma trägt Stufe, Punkte, Gründe', () => {
    const n = icpNotiz(icpBewerten(basis, { geschaeftsfuehrung: true }, AM));
    expect(n).toMatch(/^ICP Start-up [ABC] · \d+\/100/);
  });
});

describe('Steckbrief und ICP an der Firma (lib/crm/icp-firma.ts)', () => {
  it('säubert: nur Profil-Links der richtigen Dienste, höchstens 5 Beiträge, Partner ohne Doppelte, keine leeren Steckbriefe', async () => {
    const { steckbriefSaeubern, firmaIcpSaeubern } = await import('@/lib/crm/icp-firma');
    const s = steckbriefSaeubern({ vertriebsleitung: 'nein', stellen: 12, profile: { linkedin: 'https://www.linkedin.com/company/beispiel', instagram: 'https://evil.example.invalid/x' },
      beitraege: Array.from({ length: 8 }, (_, i) => ({ titel: `Beitrag ${i}`, url: `https://beispiel.example.invalid/blog/${i}`, datum: '2026-10-0' + (i % 9 + 1) })),
      partner: ['Partner A', 'Partner A', 'Partner B'], gemessenAm: AM });
    expect(s?.profile).toEqual({ linkedin: 'https://www.linkedin.com/company/beispiel' });
    expect(s?.beitraege).toHaveLength(5);
    expect(s?.partner).toEqual(['Partner A', 'Partner B']);
    expect(steckbriefSaeubern({ gemessenAm: AM })).toBeUndefined();
    expect(firmaIcpSaeubern({ score: 75, zielgruppe: 'scaleup', einstieg: 'struktur', prioritaet: 90, gruende: ['a'], aufhaenger: ['b'], gemessenAm: AM })).toMatchObject({ stufe: 'A', zielgruppe: 'scaleup', prioritaet: 90 });
  });
});

describe('Branche, Technik, neue Steckbrief-Felder', () => {
  it('Branchen-Schlagwort aus Thema, sonst Text; Technik aus Skript-Spuren', async () => {
    const { branchenTag, technikAus } = await import('@/lib/funde/icp');
    expect(branchenTag('KI-Software für Pathologie')).toBe('HealthTech & Medizintechnik');
    expect(branchenTag('Software für Handwerksbetriebe')).toBe('PropTech & Bau');
    expect(branchenTag(undefined, 'Wir bauen eine Plattform für Rechnungen')).toBe('FinTech & InsurTech');
    expect(branchenTag('xyz')).toBe('Sonstiges');
    expect(technikAus('<script src="//js.hs-scripts.com/1.js"></script><a href="https://calendly.com/x">')).toEqual(['HubSpot', 'Calendly']);
  });
  it('Steckbrief: Technik nur aus der Liste, Ansprechpartner nur mit Rolle und Quelle, Presse höchstens 5', async () => {
    const { steckbriefSaeubern } = await import('@/lib/crm/icp-firma');
    const s = steckbriefSaeubern({ technik: ['HubSpot', 'Erfunden'], ansprechpartner: [{ name: 'Erika Muster', rolle: 'CEO', quelle: 'https://beispiel.example.invalid/team' }, { name: 'Ohne Quelle', rolle: 'CEO' }],
      presse: Array.from({ length: 7 }, (_, i) => ({ titel: `Meldung ${i}`, url: `https://news.example.invalid/${i}` })), branche: 'KI & Daten', mailZustellbar: true, stellenTitel: ['Account Executive (m/w/d)'], gemessenAm: AM });
    expect(s).toMatchObject({ technik: ['HubSpot'], branche: 'KI & Daten', mailZustellbar: true, stellenTitel: ['Account Executive (m/w/d)'] });
    expect(s?.ansprechpartner).toHaveLength(1);
    expect(s?.presse).toHaveLength(5);
  });
});

describe('Steckbrief: EU-Projekte, Vertriebsweg, Zertifikate, Region', () => {
  it('nimmt nur bekannte Werte, begrenzt Listen, prüft den Wikidata-Link', async () => {
    const { steckbriefSaeubern } = await import('@/lib/crm/icp-firma');
    const s = steckbriefSaeubern({
      euProjekte: { anzahl: 3, foerderung: 1234567.8, laufend: 9, koordinator: 1, titel: ['A', 'B', 'C', 'D'] },
      vertriebsweg: ['Demo/Termin', 'Erfunden'], zertifikate: ['ISO 27001', 'ISO 99999'], messen: Array.from({ length: 12 }, (_, i) => `Messe ${i}`),
      sprachen: ['de', 'en', 'deutsch'], bundesland: 'Berlin', belege: true, international: false,
      mutter: 'Beispiel Holding', wikidata: 'https://www.wikidata.org/wiki/Q42', gemessenAm: AM });
    expect(s?.euProjekte).toEqual({ anzahl: 3, foerderung: 1234568, laufend: 3, koordinator: 1, titel: ['A', 'B', 'C'] });
    expect(s).toMatchObject({ vertriebsweg: ['Demo/Termin'], zertifikate: ['ISO 27001'], sprachen: ['de', 'en'], bundesland: 'Berlin', belege: true, international: false, mutter: 'Beispiel Holding' });
    expect(s?.messen).toHaveLength(10);
    expect(steckbriefSaeubern({ bundesland: 'Atlantis', wikidata: 'https://evil.example.invalid/Q1', euProjekte: { anzahl: 0 }, gemessenAm: AM })).toBeUndefined();
  });
});
