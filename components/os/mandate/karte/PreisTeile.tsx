'use client';

// ─── Produkt-Karte · Preis (P2, 19.10. — PRODUKTE_KONZEPT.md „Preis-Formen kombinierbar“) ───────────────────────────────────────────
// Die Preis-Teile einer Karte als Liste: je Teil die Form (Festpreis, monatlich, je Einheit …), „gilt immer“ oder „optional“, und NUR die
// Felder, die zu dieser Form gehören (lib/crm/produkt-katalog.ts `PREIS_TEIL_FELDER`). Die Reihenfolge ist sichtbar — der erste Teil, der
// immer gilt, ist der Hauptpreis (er steht im alten Preisfeld, in der Treppe und als erste Angebots-Position). Geschrieben wird die ganze Liste
// über den Bestand-Schreibweg; vorher prüft `preisePruefen` dieselben Regeln wie der Server.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, ECKE, FLAECHE_STIL, TIEF } from '@/lib/make-one/design';
import { Pillen, Chip, Hinweis, SymbolKnopf, LEUCHT } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { preisText, PRODUKT_GRENZEN, type PreisTeil, type PreisTeilArt } from '@/lib/crm/produkt-karte';
import {
  PREIS_TEIL_ARTEN, PREIS_TEIL_FELDER, PREIS_FELD_LABEL, preiseZumBearbeiten, preisePruefen, neuerPreisTeil, preiseVerschieben, hauptpreisId,
  teilFuerArt, teilFeldSetzen, teilFeldWert, type PreisTeilFeld,
} from '@/lib/crm/produkt-katalog';
import type { Leistung } from '@/lib/crm/typen';
import { TextFeld } from './felder';

const FELD_MAX: Record<PreisTeilFeld, number> = { betrag: 20, bis: 20, anzahlung: 3, deckel: 4, einheit: PRODUKT_GRENZEN.einheit, kontingent: PRODUKT_GRENZEN.kontingent, text: PRODUKT_GRENZEN.text };

export function PreisTeile({ l, speichern }: { l: Leistung; speichern: (felder: Record<string, unknown>) => Promise<boolean> }) {
  const preise = preiseZumBearbeiten(l);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Die ganze Liste schreiben — geprüft wie der Server; ein Fehler bleibt als Satz stehen (und kommt an das Feld zurück). */
  const schreibe = async (neu: PreisTeil[]): Promise<string | undefined> => {
    const f = preisePruefen(neu);
    if (f.length) { const t = f.map(x => x.text).join(' '); setFehler(t); return t; }
    setFehler(null);
    return (await speichern({ preise: neu })) ? undefined : 'Nicht gespeichert — der Grund steht unten.';
  };
  const haupt = hauptpreisId(preise);
  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
        Mehrere Teile lassen sich kombinieren (z. B. monatlich + Bonus, einmalig + je Event). Der erste Teil, der immer gilt, ist der Hauptpreis.
      </div>
      {preise.map((t, i) => (
        <TeilZeile key={t.id} t={t} nr={i + 1} haupt={t.id === haupt} anzahl={preise.length}
          onAendern={nt => schreibe(preise.map(x => (x.id === t.id ? nt : x)))}
          onSchieben={d => void schreibe(preiseVerschieben(preise, i, d))}
          onWeg={() => void schreibe(preise.filter(x => x.id !== t.id))} />
      ))}
      {preise.length < PRODUKT_GRENZEN.preise && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl<PreisTeilArt> label="Preis-Teil hinzufügen" liste={PREIS_TEIL_ARTEN.map(a => ({ id: a.id, label: a.label }))} wert={null} leer="+ Preis-Teil" onWahl={art => void schreibe([...preise, neuerPreisTeil(preise, art)])} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Form wählen — Betrag und Rest danach.</span>
        </div>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
    </div>
  );
}

function TeilZeile({ t, nr, haupt, anzahl, onAendern, onSchieben, onWeg }: {
  t: PreisTeil; nr: number; haupt: boolean; anzahl: number; onAendern: (t: PreisTeil) => Promise<string | undefined>; onSchieben: (d: -1 | 1) => void; onWeg: () => void;
}) {
  const f = haupt ? C.aktiv : t.rolle === 'option' ? LEUCHT.planung : C.inkDim;
  const feld = async (name: PreisTeilFeld, roh: string) => {
    const r = teilFeldSetzen(t, name, roh);
    return r.ok ? onAendern(r.teil) : r.fehler;
  };
  return (
    <div style={{ ...(haupt ? { background: TIEF.flaeche(C.aktiv), border: `1px solid ${TIEF.rand(C.aktiv)}` } : FLAECHE_STIL.flach), borderRadius: ECKE.flach, padding: 12, display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: 99, display: 'inline-grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, color: f, background: TIEF.flaeche(f), flex: '0 0 auto' }}>{nr}</span>
        <Wahl<PreisTeilArt> label={`Form von Preis-Teil ${nr}`} liste={PREIS_TEIL_ARTEN.map(a => ({ id: a.id, label: a.label }))} wert={t.art} onWahl={art => { if (art !== t.art) void onAendern(teilFuerArt(t, art)); }} />
        {haupt && <Chip farbe={C.aktiv}>Hauptpreis</Chip>}
        <span style={{ flex: 1 }} />
        <span className="ui-symbole" style={{ display: 'inline-flex', gap: 2 }}>
          <SymbolKnopf ariaLabel={`Preis-Teil ${nr} nach oben`} aus={nr === 1} onClick={() => onSchieben(-1)}>↑</SymbolKnopf>
          <SymbolKnopf ariaLabel={`Preis-Teil ${nr} nach unten`} aus={nr === anzahl} onClick={() => onSchieben(1)}>↓</SymbolKnopf>
          {anzahl > 1 && <SymbolKnopf ariaLabel={`Preis-Teil ${nr} entfernen`} gefahr onClick={onWeg}>×</SymbolKnopf>}
        </span>
      </div>
      <Pillen<'grund' | 'option'> liste={[{ id: 'grund', label: 'gilt immer' }, { id: 'option', label: 'optional (zum Anhaken im Angebot)' }]} aktiv={t.rolle} onWahl={r => { if (r !== t.rolle) void onAendern({ ...t, rolle: r }); }} />
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', minWidth: 0 }}>
        {PREIS_TEIL_FELDER[t.art].map(name => (
          <TextFeld key={`${t.id}-${t.art}-${name}`} label={PREIS_FELD_LABEL[name]} wert={teilFeldWert(t, name)} max={FELD_MAX[name]} modus={name === 'betrag' || name === 'bis' ? 'decimal' : name === 'anzahlung' || name === 'deckel' ? 'numeric' : undefined}
            platzhalter={name === 'betrag' ? 'z. B. 2.990' : name === 'anzahlung' ? '50 = 50/50' : name === 'text' ? (t.art === 'erfolg' ? 'z. B. Bonus bei erreichten Zielen' : 'optional') : undefined}
            onFertig={roh => feld(name, roh)} />
        ))}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{t.rolle === 'option' ? 'optional: ' : ''}{preisText(t)}</div>
    </div>
  );
}
