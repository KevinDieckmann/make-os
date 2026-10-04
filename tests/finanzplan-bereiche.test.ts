// ─── Finanzplanung — Privat und Business separat einstellbar (04.10. spät) ──────────────────────────
// Kevin: „beide Planungen als Basis und separat einstellbar … im Business meine Planung haben.“ Jeder Bereich darf ein eigenes
// Planszenario rechnen (`FinanzDaten.bereiche`, optional — fehlt es, gilt der gemeinsame Arbeitsplan). Erfundene Zahlen.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit, arbeitsplanFuer, mitBereich, bereichEigen, arbeitsplanVon, auswertung } from '../lib/finanzen/szenarien';
import { wendeOperationenAn, pruefeDokument, lies, pfadTeile, OperationUngueltig, type Operation } from '../lib/finanzen/plan/operationen';
import { businessSicht, businessPfadErlaubt } from '../lib/finanzen/plan/sicht';
import { planFix, arbeitsplanFix, arbeitsplanSelbst } from './fixtures/finanz-plan';

const JETZT = '2026-10-04T22:00:00.000Z';
const an = (d: FinanzDaten, ops: Operation[]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;
const gegen = (d: FinanzDaten, op: Operation): Operation => { const alt = lies(d, pfadTeile(op.pfad)); return alt === undefined ? { pfad: op.pfad } : { pfad: op.pfad, neu: alt }; };
const basis = (): FinanzDaten => ({ ...planFix(14000), planszenarien: [arbeitsplanFix(), arbeitsplanSelbst()], arbeitsplan: 'ps1' });

describe('Ein Szenario je Bereich', () => {
  it('ohne Einstellung: beide Bereiche rechnen den gemeinsamen Arbeitsplan (dasselbe Dokument, wie bisher)', () => {
    const d = basis();
    expect(arbeitsplanFuer(d, 'privat')?.id).toBe('ps1'); expect(arbeitsplanFuer(d, 'business')?.id).toBe('ps1');
    expect(mitBereich(d, 'business')).toBe(d); expect(bereichEigen(d, 'business')).toBe(false);
  });
  it('Business rechnet „ps2“, Privat bleibt beim gemeinsamen — Kennzahlen je Bereich aus der einen Rechnung', () => {
    const d = an(basis(), [{ pfad: '/bereiche/business', neu: { arbeitsplan: 'ps2' } }]);
    expect(arbeitsplanFuer(d, 'business')?.id).toBe('ps2'); expect(arbeitsplanFuer(d, 'privat')?.id).toBe('ps1');
    const b = mitBereich(d, 'business'), p = mitBereich(d, 'privat');
    expect(arbeitsplanVon(b)?.id).toBe('ps2'); expect(p).toBe(d);
    const gb = rechneMit(b, arbeitsplanVon(b)), gp = rechneMit(p, arbeitsplanVon(p));
    expect(gb.kdc.some((k, i) => Math.abs(k.umsatz - gp.kdc[i].umsatz) > 1)).toBe(true);   // ps2 hat die starke Selbstständigkeit
    expect(gb.ug.map(u => u.frei)).toEqual(rechneMit(d, d.planszenarien![1]).ug.map(u => u.frei));
    const awB = auswertung(gb.d, gb.ug, gb.pr, gb.kdc), awP = auswertung(gp.d, gp.ug, gp.pr, gp.kdc);
    expect(awB.frei.kdc).not.toBe(awP.frei.kdc);
  });
  it('„eigenes: Basis“ = reiner Treiber (null) — nicht dasselbe wie gemeinsam', () => {
    const d = an(basis(), [{ pfad: '/bereiche/privat', neu: { arbeitsplan: null } }]);
    expect(arbeitsplanFuer(d, 'privat')).toBeNull(); expect(arbeitsplanFuer(d, 'business')?.id).toBe('ps1');
    expect(bereichEigen(d, 'privat')).toBe(true);
    expect(mitBereich(d, 'privat').arbeitsplan).toBeNull();
  });
});

describe('Operationen und Kompatibilität', () => {
  it('nur gültige Pfade und vorhandene Szenarien; gemeinsam = Bereich entfernen; Rückgängig räumt auf', () => {
    const d = basis();
    expect(() => an(d, [{ pfad: '/bereiche/business', neu: { arbeitsplan: 'gibtsnicht' } }])).toThrow(OperationUngueltig);
    expect(() => an(d, [{ pfad: '/bereiche/team', neu: { arbeitsplan: null } }])).toThrow(OperationUngueltig);
    expect(() => an(d, [{ pfad: '/bereiche/business', neu: { arbeitsplan: 'ps1', mehr: 1 } }])).toThrow(OperationUngueltig);
    expect(() => an(d, [{ pfad: '/bereiche', neu: {} }])).toThrow(OperationUngueltig);
    const op: Operation = { pfad: '/bereiche/business/arbeitsplan', neu: 'ps2' };
    const e = an(d, [op]);
    expect(e.bereiche).toEqual({ business: { arbeitsplan: 'ps2' } });
    expect(an(e, [gegen(d, op)]).bereiche).toBeUndefined();   // Rückgängig (Pfad entfernen) → wieder gemeinsam, kein leerer Rest
    expect(an(e, [{ pfad: '/bereiche/business' }]).bereiche).toBeUndefined();
  });
  it('ein gelöschtes Planszenario wird im Bereich zur Basis', () => {
    const e = an(an(basis(), [{ pfad: '/bereiche/business', neu: { arbeitsplan: 'ps2' } }]), [{ pfad: '/planszenarien/id=ps2' }]);
    expect(e.bereiche?.business).toEqual({ arbeitsplan: null });
  });
  it('alte Dokumente ohne Feld laufen unverändert; gespeicherte Einstellung bleibt; Unbekanntes wird Basis', () => {
    const alt = pruefeDokument(JSON.parse(JSON.stringify(basis())));
    expect(alt.ok && 'bereiche' in alt.dokument).toBe(false);
    const roh = { ...basis(), bereiche: { business: { arbeitsplan: 'ps2' }, privat: { arbeitsplan: 'weg' }, team: { arbeitsplan: 'ps1' } } };
    const p = pruefeDokument(JSON.parse(JSON.stringify(roh)));
    expect(p.ok && p.dokument.bereiche).toEqual({ business: { arbeitsplan: 'ps2' }, privat: { arbeitsplan: null } });
  });
  it('Konto ohne Privatzugang: sieht und ändert nur die Einstellung des Business-Bereichs', () => {
    const d = an(basis(), [{ pfad: '/bereiche/privat', neu: { arbeitsplan: null } }, { pfad: '/bereiche/business', neu: { arbeitsplan: 'ps2' } }]);
    expect(businessSicht(d).bereiche).toEqual({ business: { arbeitsplan: 'ps2' } });
    expect(businessPfadErlaubt('/bereiche/business', d, { arbeitsplan: 'ps1' })).toBeNull();
    expect(businessPfadErlaubt('/bereiche/privat', d, { arbeitsplan: 'ps1' })).not.toBeNull();
  });
});
