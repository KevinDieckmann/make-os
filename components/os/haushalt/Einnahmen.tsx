'use client';

// Einnahmen — Malins Frage: Worauf können wir uns verlassen? Gehalt kommt jeden
// Monat, ein Aktienverkauf nicht. Beides in einer Summe macht die Zahl
// unbrauchbar. Deshalb vier Töpfe; Kredite werden zur Schuld, ausgelegtes Geld
// ist kein Einkommen.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { Buchung, Kategorie } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import { artVon, KREDIT, type KatName, type Topf } from '@/lib/finanzen/haushalt/einordnung';
import { einnahmebild, letzterMonatMitDaten } from '@/lib/finanzen/haushalt/kennzahlen';
import { monatVon, monatName, datumDe } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from '../schlank';
import { Betrag, Dialog, Feld, Haken, Hinweis, Kachel, Kacheln, Leiste, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

const TOPF: Record<Topf, { name: string; farbe: string; etikett?: string }> = {
  planbar: { name: 'Planbar — darauf könnt ihr euch verlassen', farbe: LEUCHT.gut, etikett: 'planbar' },
  einmalig: { name: 'Einmalig — echtes Geld, aber nicht planbar', farbe: LEUCHT.puls },
  durchlauf: { name: 'Kein Einkommen — nur zurückgeflossen', farbe: C.inkLeise, etikett: 'kein Einkommen' },
  schuld: { name: 'Geliehen — wird zur Schuld', farbe: LEUCHT.kritisch, etikett: 'Schuld' },
  offen: { name: 'Noch ohne Art', farbe: LEUCHT.achtung, etikett: 'Art fehlt' },
};

interface Props {
  h: HaushaltDaten; katName: KatName;
  patch: (teil: string, ops: Op[]) => Promise<boolean>;
  aktion: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<(T & { ok: boolean; fehler?: string }) | null>;
  melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void;
  laden: () => Promise<void>;
}

function ArtOptionen({ kategorien }: { kategorien: Kategorie[] }) {
  const ein = kategorien.filter(k => k.typ === 'einnahme');
  return <>{(['offen', 'planbar', 'einmalig', 'durchlauf', 'schuld'] as Topf[]).map(t => {
    const drin = ein.filter(k => artVon(k.name) === t);
    return drin.length ? <optgroup key={t} label={TOPF[t].name}>{drin.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</optgroup> : null;
  })}</>;
}

export function Einnahmen({ h, katName, patch, aktion, melde, laden }: Props) {
  const monate = useMemo(() => Array.from(new Set(h.buchungen.filter(b => b.betrag > 0 && !b.ist_umbuchung).map(b => monatVon(b.datum)))).sort().reverse(), [h.buchungen]);
  const [f, setF] = useState({ monat: letzterMonatMitDaten(h.buchungen.filter(b => b.betrag > 0)), konto: '' });
  const [merken, setMerken] = useState<{ b: Buchung; katId: string } | null>(null);
  const [kredit, setKredit] = useState<Buchung | null>(null);
  const liste = useMemo(() => h.buchungen.filter(b => !b.ist_umbuchung && b.betrag > 0 && (!f.monat || monatVon(b.datum) === f.monat) && (!f.konto || b.konto_id === f.konto)).sort((a, b) => b.datum.localeCompare(a.datum)), [h.buchungen, f]);
  const e = useMemo(() => einnahmebild(liste, katName), [liste, katName]);
  const t = e.toepfe;
  const konto = (id: string) => h.stamm.konten.find(k => k.id === id)?.name.replace(/^Privatkonto /, '') ?? '–';

  async function artSetzen(b: Buchung, katId: string) {
    const ok = await patch('buchungen', [{ op: 'upsert', stand: b.stand, eintrag: { ...b, kategorie_id: katId || null } }]);
    if (!ok || !katId) return;
    if (katName(katId) === KREDIT) {
      if (h.schulden.some(s => s.aus_buchung_id === b.id)) { melde('info', 'Schon angelegt', 'Für diese Buchung gibt es bereits eine Schuld.'); return; }
      setKredit(b); return;
    }
    if (b.empfaenger) setMerken({ b, katId });
  }

  const max = e.arten[0]?.summe || 1;
  return (
    <>
      <Karte i={1} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={f.monat ? monatName(f.monat) : 'alle Monate'}>Einnahmen</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
          <select aria-label="Monat" value={f.monat} onChange={x => setF({ ...f, monat: x.target.value })} style={auswahl}><option value="">Alle Monate</option>{monate.map(m => <option key={m} value={m}>{monatName(m)}</option>)}</select>
          <select aria-label="Konto" value={f.konto} onChange={x => setF({ ...f, konto: x.target.value })} style={auswahl}><option value="">Alle Konten</option>{h.stamm.konten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
        </div>
        <Kacheln>
          <Kachel titel="Planbar" wert={eur(t.planbar)} farbe={LEUCHT.gut} zusatz="Gehalt, Entnahme, Miete" />
          <Kachel titel="Einmalig" wert={eur(t.einmalig)} farbe={LEUCHT.puls} zusatz="Aktien, Verkäufe, Geschenke" />
          {t.durchlauf > 0 && <Kachel titel="Durchlaufend" wert={eur(t.durchlauf)} farbe={C.inkDim} zusatz={<span style={{ color: LEUCHT.achtung }}>kein Einkommen</span>} />}
          {t.schuld > 0 && <Kachel titel="Geliehen" wert={eur(t.schuld)} farbe={LEUCHT.kritisch} zusatz={<span style={{ color: LEUCHT.achtung }}>steht unter Schulden</span>} />}
          {t.offen > 0 && <Kachel titel="Noch offen" wert={eur(t.offen)} farbe={LEUCHT.achtung} zusatz={`${t.offeneZeilen} Buchungen ohne Art`} />}
        </Kacheln>
        <div style={{ marginTop: 16, fontSize: TYP.body, lineHeight: 1.6 }}>
          Auf den Konten eingegangen sind <strong>{eur(e.gesamt)}</strong>. Davon sind <strong style={{ color: LEUCHT.gut }}>{eur(t.planbar + t.einmalig)}</strong> echtes Einkommen, und verlassen könnt ihr euch auf <strong style={{ color: LEUCHT.gut }}>{eur(t.planbar)}</strong>.
          {t.durchlauf > 0 && <> <strong style={{ color: LEUCHT.achtung }}>{eur(t.durchlauf)}</strong> sind durchlaufende Posten — ausgelegtes Geld, das zurückkam. Da hat niemand etwas verdient; mitgezählt sähen Einnahmen und Ausgaben beide zu hoch aus.</>}
          {t.schuld > 0 && <> <strong style={{ color: LEUCHT.achtung }}>{eur(t.schuld)}</strong> sind geliehen und stehen unter Schulden.</>}
        </div>
        {t.offen > 0 && <Hinweis>Solange etwas ohne Art ist, ist die Aufteilung nur eine Schätzung. Unten die Art wählen — das wird gemerkt und gilt auf Wunsch auch rückwirkend.</Hinweis>}
      </Karte>

      {e.arten.length > 0 && (
        <Karte i={2}>
          <Ueberschrift>Woher kommt das Geld?</Ueberschrift>
          <div style={{ display: 'grid', gap: 10 }}>
            {e.arten.map(a => (
              <div key={a.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto 56px', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: TYP.body }}>{a.name}</strong>{' '}{TOPF[a.topf].etikett && <Chip farbe={TOPF[a.topf].farbe}>{TOPF[a.topf].etikett}</Chip>} <span style={{ color: C.inkLeise, fontSize: 12 }}>({a.anzahl})</span>
                  <Leiste anteil={a.summe / max * 100} farbe={TOPF[a.topf].farbe} />
                </div>
                <Betrag cent={a.summe} farbe={C.ink} />
                <span style={{ fontSize: 12.5, color: C.inkDim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.anteil.toFixed(1).replace('.', ',')} %</span>
              </div>
            ))}
          </div>
        </Karte>
      )}

      <Karte i={3}>
        <Ueberschrift rechts={`${liste.length}`}>Einzelne Einnahmen</Ueberschrift>
        {!liste.length && <Leer>Keine Einnahmen in diesem Zeitraum.</Leer>}
        {liste.map(b => {
          const schuld = h.schulden.find(s => s.aus_buchung_id === b.id);
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '6px 14px', padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.empfaenger || '–'}</div>
                <div style={{ fontSize: 12, color: C.inkLeise }}>{datumDe(b.datum)} · {konto(b.konto_id)}</div>
              </div>
              <Betrag cent={b.betrag} vorzeichen />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select aria-label="Art" value={b.kategorie_id ?? ''} onChange={x => void artSetzen(b, x.target.value)} style={{ ...auswahl, padding: '5px 8px', fontSize: 12.5, maxWidth: 280, color: b.kategorie_id ? C.ink : LEUCHT.achtung }}>
                  <option value="">— offen —</option><ArtOptionen kategorien={h.stamm.kategorien} />
                </select>
                {schuld && <Chip farbe={LEUCHT.kritisch}>als Schuld angelegt</Chip>}
                {katName(b.kategorie_id) === KREDIT && !schuld && <button onClick={() => setKredit(b)} style={{ background: 'none', border: 'none', color: LEUCHT.achtung, cursor: 'pointer', fontSize: 12.5 }}>Schuld anlegen</button>}
              </div>
            </div>
          );
        })}
      </Karte>

      {merken && <EinfachMerken b={merken.b} katId={merken.katId} katName={katName} aktion={aktion} melde={melde} laden={laden} onZu={() => setMerken(null)} />}
      {kredit && <KreditDialog b={kredit} aktion={aktion} melde={melde} laden={laden} onZu={() => setKredit(null)} />}
    </>
  );
}

function EinfachMerken({ b, katId, katName, aktion, melde, laden, onZu }: { b: Buchung; katId: string; katName: KatName; aktion: Props['aktion']; melde: Props['melde']; laden: () => Promise<void>; onZu: () => void }) {
  const [alt, setAlt] = useState(true);
  return (
    <Dialog titel="Zuordnung merken?" onZu={onZu} aktionen={<Knopf farbe={LEUCHT.geld} onClick={async () => {
      const d = await aktion<{ geaendert: number }>({ aktion: 'regel', muster: b.empfaenger, kategorie_id: katId, rueckwirkend: alt, buchungId: b.id, ganzes_wort: true });
      if (d?.ok) { melde('ok', 'Gemerkt', d.geaendert > 1 ? `${d.geaendert - 1} weitere Buchung${d.geaendert === 2 ? '' : 'en'} gleich mit zugeordnet.` : 'Diese Zuordnung wird nicht mehr gefragt.'); await laden(); onZu(); }
    }}>Merken</Knopf>}>
      <div>Soll <strong>{b.empfaenger}</strong> künftig automatisch als <strong>{katName(katId)}</strong> laufen?</div>
      <Haken an={alt} onChange={setAlt}>Auch auf vorhandene Buchungen anwenden</Haken>
    </Dialog>
  );
}

function KreditDialog({ b, aktion, melde, laden, onZu }: { b: Buchung; aktion: Props['aktion']; melde: Props['melde']; laden: () => Promise<void>; onZu: () => void }) {
  const [e, setE] = useState({ bezeichnung: `Kredit ${b.empfaenger}`.trim(), glaeubiger: b.empfaenger, rate: '0', zins: '0' });
  return (
    <Dialog titel="Kredit als Schuld anlegen" onZu={onZu} aktionen={<Knopf farbe={LEUCHT.achtung} onClick={async () => {
      const d = await aktion<{ schonDa: boolean }>({ aktion: 'kredit', buchung_id: b.id, bezeichnung: e.bezeichnung, glaeubiger: e.glaeubiger, rate: zuCent(e.rate) ?? 0, zinssatz: Number(e.zins.replace(',', '.')) || 0 });
      if (d?.ok) { melde('ok', d.schonDa ? 'Schon angelegt' : 'Als Schuld angelegt', `${eur(b.betrag)} stehen unter Schulden und zählen nicht als Einkommen.`); await laden(); onZu(); }
    }}>Schuld anlegen</Knopf>}>
      <div><strong>{eur(b.betrag)}</strong> von <strong>{b.empfaenger || 'unbekannt'}</strong> am {datumDe(b.datum)}.</div>
      <div style={{ color: C.inkDim, fontSize: 13 }}>Das Geld liegt auf dem Konto, gehört aber jemand anderem. Als Schuld angelegt steht es unter „Schulden“ und fließt nicht ins Einkommen.</div>
      <Feld label="Bezeichnung"><input value={e.bezeichnung} onChange={x => setE({ ...e, bezeichnung: x.target.value })} style={feld} /></Feld>
      <Feld label="Gläubiger"><input value={e.glaeubiger} onChange={x => setE({ ...e, glaeubiger: x.target.value })} style={feld} /></Feld>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Feld label="Monatliche Rate (0 = keine)"><input inputMode="decimal" value={e.rate} onChange={x => setE({ ...e, rate: x.target.value })} style={feld} /></Feld>
        <Feld label="Zinssatz % p. a. (optional)"><input inputMode="decimal" value={e.zins} onChange={x => setE({ ...e, zins: x.target.value })} style={feld} /></Feld>
      </div>
    </Dialog>
  );
}
