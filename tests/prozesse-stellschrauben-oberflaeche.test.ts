// ─── Prozesse · Stellschrauben C (22.10.) — Oberfläche: Abschnitt im Steckbrief, Rechte, Zeichen „einstellbar“ an der Kachel ─────────────────────────────────────
// Gerendert ohne Browser (renderToStaticMarkup): wer darf, sieht Feld + „Speichern“ + „Vorgabe“; ohne Recht nur den Wert und den Satz, wer ändern darf; gesetzlich
// Festes als „fest (Gesetz)“; Ansichts-Zeilen mit Link in die Fachseite. Die Kachel trägt den Regler statt des Zahnrads und sagt „System, einstellbar“.
// Dazu die Wächter: die Komponente lädt keinen Server-Code, keine Farb-Literale, Formulare senden nur über onSubmit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { stellschraubenBauen, VORGABE_MAHNTAGE, VORGABE_FULFILLMENT } from '@/lib/prozesse/stellschrauben-bau';
import { kachelTexte, systemMarke } from '@/lib/prozesse/modell';
import { fliegeLage } from '@/lib/prozesse/landkarte';
import { StellschraubenKarte } from '@/components/os/prozesse/Stellschrauben';
import { SteckbriefKarte } from '@/components/os/prozesse/Feld';
import { LandkarteBild } from '@/components/os/prozesse/Bilder';
import type { ProzessDef } from '@/lib/prozesse/typen';

const je = stellschraubenBauen({
  wertelisten: { kadenzTage: { A: 45 } }, loeschfristen: {}, mahnTage: [...VORGABE_MAHNTAGE], fulfillment: { ...VORGABE_FULFILLMENT, nachsorgeTage: [...VORGABE_FULFILLMENT.nachsorgeTage] },
  heads: { sales: {}, marketing: {}, event: {}, finanzen: {} }, werte: { 'head.sales.wochenreview.stunde': 16 },
});
const mit = (id: string): ProzessDef => ({ ...SYSTEM_PROZESSE.find(p => p.id === id)!, stellschrauben: je[id] });
const karte = (p: ProzessDef, rechte: Record<string, boolean>, offen = true) => renderToStaticMarkup(h(StellschraubenKarte, { p, rechte, stand: 's', onGespeichert: () => {}, offen }));

describe('Abschnitt „Stellschrauben“', () => {
  it('wer darf: Feld, „Speichern“, „Vorgabe“ bei Abweichung, Vorgabe genannt, wo gespeichert; Gruppen aufklappbar (die erste offen)', () => {
    const html = karte(mit('sp-followup'), { wertelisten: true });
    for (const t of ['Stellschrauben', '4 einstellbar', 'Kadenz je Kreis', 'Kreis A (eng)', '45 Tage', 'Vorgabe: 30 Tage', 'Speichern', 'Vorgabe', 'Gespeichert in den Einstellungen der Markttraktion']) expect(html, t).toContain(t);
    expect(html).toContain('aria-label="Kreis A (eng)"');
    expect(html).toContain('aria-expanded="true"');
  });
  it('Feinschliff 1: standardmäßig zugeklappt — nur der Kopf mit „n einstellbar“ und der Zahl der Abweichungen; kein Ort als Technik (Datei, Bestand)', () => {
    const zu = karte(mit('sp-followup'), { wertelisten: true }, false);
    expect(zu).toContain('Stellschrauben');
    expect(zu).toContain('4 einstellbar');
    expect(zu).toContain('aria-expanded="false"');
    expect(zu).not.toContain('Speichern');
    expect(zu).not.toContain('Kreis A (eng)');
    for (const id of Object.keys(je)) {
      const html = karte(mit(id), { wertelisten: true, prozesse: true, loeschfrist: true, mahntage: true, fulfillment: true, 'puls-schwelle': true });
      expect(html, id).not.toMatch(/Gespeichert in:|lib\/|\.ts\b|\((crm|prozesse|agenten|markttraktion|rechnungswesen|buchung|fulfillment)[-.a-z]*\)/);
    }
    expect(karte(mit('sp-kampagnen'), {})).toContain('Fest im System');
  });
  it('ohne Recht: nur der Wert und der Satz, wer ändern darf — kein Feld, kein Speichern', () => {
    const html = karte(mit('sp-head-takt'), { wertelisten: true, prozesse: false });
    expect(html).not.toContain('Speichern');
    expect(html).toContain('Ändern dürfen volle Mitglieder des Haushalts.');
    expect(html).toContain('ab 16 Uhr');
    expect(html).toContain('ZOE › Agenten');
  });
  it('mit Recht: Uhrzeit und Wochentag als Auswahl, an/aus als Schalter mit Erklärung', () => {
    const html = karte(mit('sp-head-takt'), { prozesse: true });
    expect(html).toContain('<select');
    expect(html).toContain('role="switch"');
  });
  it('gesetzlich Festes steht als „fest (Gesetz)“ ohne Feld', () => {
    const html = karte(mit('sp-betroffenenrechte'), { loeschfrist: true });
    expect(html).toContain('fest (Gesetz) — Art. 12 Abs. 3 DSGVO');
    expect(html).toContain('1 Monat');
  });
  it('der Steckbrief sagt „System · einstellbar“ — ohne Stellschrauben bleibt es „System · nur lesbar“', () => {
    expect(renderToStaticMarkup(h(SteckbriefKarte, { p: mit('sp-followup'), zahl: undefined }))).toContain('System · einstellbar');
    expect(renderToStaticMarkup(h(SteckbriefKarte, { p: SYSTEM_PROZESSE.find(p => p.id === 'sp-followup')!, zahl: undefined }))).toContain('System · nur lesbar');
    expect(systemMarke({ stellschrauben: je['sp-kampagnen'] })).toBe('System · nur lesbar'); // nur Ansichts-Zeilen
    expect(kachelTexte(mit('sp-followup'), undefined, 'nah').marke).toBe('System · einstellbar');
  });
});

describe('Kachel auf der Landkarte: dezentes Zeichen „einstellbar“', () => {
  it('Regler statt Zahnrad, Aria „System, einstellbar“ — nur bei änderbaren Stellschrauben', () => {
    const L = SYSTEM_PROZESSE.map(p => (je[p.id] ? { ...p, stellschrauben: je[p.id] } : p));
    const html = renderToStaticMarkup(h('svg', null, h(LandkarteBild, { lage: fliegeLage(L), prozesse: new Map(L.map(p => [p.id, p])), zahlen: {}, stufe: 'mittel', spitze: 's', onKachel: () => {}, onZahl: () => {} })));
    expect(html).toContain('Follow-up &amp; Power Hour — System, einstellbar; öffnen');
    expect(html).toContain('Kampagnen (Playbooks) — System, nur lesbar; öffnen');
    expect(html).toContain('lucide-sliders-horizontal');
  });
});

describe('Wächter', () => {
  const quelle = readFileSync(path.join(process.cwd(), 'components/os/prozesse/Stellschrauben.tsx'), 'utf8');
  it('keine Server-Importe, keine Farb-Literale, Formular nur über onSubmit', () => {
    expect(quelle).not.toMatch(/from '@\/lib\/(store|zugang)|-server'/);
    expect(quelle).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(quelle).toContain('onSubmit');
    expect(quelle).not.toMatch(/typ="submit"[^>]*onClick/);
  });
});
