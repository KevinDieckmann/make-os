'use client';

// Ist gegen Soll — Planwerte je Monat gegen die tatsächlichen Zahlen.
// Überschreitungen sollen sichtbar sein, BEVOR der Monat um ist.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { POSTEN, type Posten } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import type { KatName } from '@/lib/finanzen/haushalt/einordnung';
import { istWert, sollWert } from '@/lib/finanzen/haushalt/kennzahlen';
import { monatVon, monatName, tageImMonat, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Knopf, feld, LEUCHT } from '../schlank';
import { Dialog, Feld, Haken, Hinweis, Leiste, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

const MEHR_IST_GUT: Record<Posten, boolean> = { Umsatz: true, Sparrate: true, Ausgaben: false, Tilgung: false };
const ERKLAERT: Record<Posten, string> = {
  Umsatz: 'echtes Einkommen — ohne Kredite, ohne zurückgeflossenes Geld',
  Ausgaben: 'alle echten Ausgaben außer Sparen und Tilgung',
  Sparrate: 'Kategorie „Sparen“',
  Tilgung: 'Kategorien „Tilgung“ und „Kredit & Raten“',
};

interface Props { h: HaushaltDaten; katName: KatName; patch: (teil: string, ops: Op[]) => Promise<boolean>; melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void }

export function IstSoll({ h, katName, patch, melde }: Props) {
  const heute = heuteBerlin();
  const privat = useMemo(() => h.buchungen.filter(b => b.einheit === 'privat'), [h.buchungen]);
  const monate = useMemo(() => {
    const m = new Set<string>(privat.map(b => monatVon(b.datum)));
    h.planwerte.forEach(p => m.add(`${p.jahr}-${String(p.monat).padStart(2, '0')}`));
    m.add(monatVon(heute));
    return Array.from(m).sort().reverse();
  }, [privat, h.planwerte, heute]);
  const [monat, setMonat] = useState(monatVon(heute));
  const [setzen, setSetzen] = useState<Posten | null>(null);

  const zeilen = POSTEN.map(p => {
    const soll = sollWert(p, h.planwerte, monat);
    const ist = istWert(p, privat, monat, katName);
    const abw = soll === null ? null : ist - soll;
    const gut = abw === null ? null : MEHR_IST_GUT[p] ? abw >= 0 : abw <= 0;
    return { p, soll, ist, abw, gut };
  });
  const warn: string[] = [];
  for (const z of zeilen) {
    if (!z.soll) continue;
    if (z.p === 'Ausgaben' && z.ist > z.soll) warn.push(`Die Ausgaben liegen mit ${eur(z.ist)} bereits ${eur(z.ist - z.soll)} über Plan.`);
    if (z.p === 'Umsatz' && monat === monatVon(heute)) {
      const tag = Number(heute.slice(8, 10)), tage = tageImMonat(monat);
      const erwartet = z.soll * tag / tage;
      if (z.ist < erwartet * 0.8) warn.push(`Das Einkommen hinkt hinterher: ${eur(z.ist)} nach ${tag} von ${tage} Tagen, erwartbar wären rund ${eur(erwartet)}.`);
    }
  }

  return (
    <Karte i={1} akzent={warn.length ? LEUCHT.achtung : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <Ueberschrift farbe={LEUCHT.planung}>Ist gegen Soll</Ueberschrift>
        <select aria-label="Monat" value={monat} onChange={e => setMonat(e.target.value)} style={{ ...auswahl, width: 'auto' }}>{monate.map(m => <option key={m} value={m}>{monatName(m)}</option>)}</select>
      </div>
      {warn.map(w => <div key={w} style={{ color: LEUCHT.achtung, fontSize: TYP.body, marginBottom: 6 }}>{w}</div>)}
      {zeilen.map(z => (
        <div key={z.p} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, padding: '12px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: TYP.body }}>{z.p}</strong> <span style={{ fontSize: 12, color: C.inkLeise }}>{ERKLAERT[z.p]}</span>
            {z.soll ? <Leiste anteil={Math.min(100, Math.abs(z.ist / z.soll) * 100)} farbe={z.gut ? LEUCHT.gut : LEUCHT.kritisch} /> : null}
            <div style={{ fontSize: 13, color: C.inkDim, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              Ist {eur(z.ist)} · Soll {z.soll === null ? <span style={{ color: C.inkLeise }}>nicht geplant</span> : eur(z.soll)}
              {z.abw !== null && <span style={{ color: z.gut ? LEUCHT.gut : LEUCHT.kritisch }}> · {z.abw > 0 ? '+' : ''}{eur(z.abw)}</span>}
            </div>
          </div>
          <button onClick={() => setSetzen(z.p)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, alignSelf: 'center' }}>Planwert setzen</button>
        </div>
      ))}
      <Hinweis>Umbuchungen zwischen euren Konten und auf Sparziele sind nicht enthalten.</Hinweis>
      {setzen && <PlanDialog posten={setzen} monat={monat} h={h} patch={patch} melde={melde} onZu={() => setSetzen(null)} />}
    </Karte>
  );
}

function PlanDialog({ posten, monat, h, patch, melde, onZu }: { posten: Posten; monat: string; h: HaushaltDaten; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const j = Number(monat.slice(0, 4)), m = Number(monat.slice(5, 7));
  const vorhanden = h.planwerte.find(p => p.einheit === 'privat' && p.jahr === j && p.monat === m && p.posten === posten);
  const [wert, setWert] = useState(vorhanden ? String(vorhanden.sollwert / 100) : '');
  const [alle, setAlle] = useState(false);
  return (
    <Dialog titel={`Planwert: ${posten} — ${monatName(monat)}`} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.planung} onClick={async () => {
      const cent = zuCent(wert);
      if (cent === null) { melde('fehler', 'Zahl fehlt'); return; }
      const ops: Op[] = [];
      for (let mm = m; mm <= (alle ? 12 : m); mm++) {
        const vh = h.planwerte.find(p => p.einheit === 'privat' && p.jahr === j && p.monat === mm && p.posten === posten);
        ops.push(vh ? { op: 'upsert', stand: vh.stand, eintrag: { ...vh, sollwert: cent } } : { op: 'upsert', eintrag: { einheit: 'privat', jahr: j, monat: mm, posten, sollwert: cent } });
      }
      if (await patch('plan', ops)) { melde('ok', 'Planwert gesetzt'); onZu(); }
    }}>Speichern</Knopf>}>
      <Feld label="Sollwert in Euro"><input inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} style={feld} /></Feld>
      <Haken an={alle} onChange={setAlle}>Für alle folgenden Monate dieses Jahres übernehmen</Haken>
    </Dialog>
  );
}
