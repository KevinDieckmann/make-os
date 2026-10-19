'use client';

// ─── Produkte · geführtes Anlegen (P2, 19.10. — PRODUKTE_KONZEPT.md „Oberfläche“) ──────────────────────────────────────────────────
// „+ Produkt“ öffnet einen kleinen Dialog: Name · Art (einmalig · laufend monatlich · jährlich · kostenlos · nach Aufwand) · Preis ·
// Gesellschaft · Stufe · ein Satz Leistungstext. „Anlegen“ legt die Karte als Entwurf an (Bestand-Schreibweg, `api.setze`) und öffnet sie —
// kein Sofort-Entwurf mit erfundenen Vorgaben mehr. Regeln (Prüfen, Preis-Teil, Typ) rein in lib/crm/produkt-katalog.ts `neuesProdukt`.

import { useRef, useState, type FormEvent } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Pillen, Hinweis, Feldzeile, eingabe } from '../../ui';
import { Fenster } from '../../Fenster';
import { GesellschaftWahl } from '../../crm/GesellschaftWahl';
import { neuesProdukt, ANLEGEN_ARTEN, ebenenWahl, type AnlegenArt, type NeuesProduktEingabe } from '@/lib/crm/produkt-katalog';
import { neueId, type CrmApi } from '../../crm/daten';
import type { Gesellschaft } from '@/lib/crm/typen';

export function ProduktAnlegen({ api, ebene, vorhandeneEbenen, onZu, onFertig }: {
  api: CrmApi;
  /** Vorbelegte Stufe („+ Produkt auf Stufe n“) — null: ohne Stufe. */
  ebene: number | null;
  vorhandeneEbenen: readonly number[];
  onZu: () => void;
  onFertig: (id: string) => void;
}) {
  const [e, setE] = useState<NeuesProduktEingabe>({ name: '', art: 'monatlich', satz: 'stunde', preis: '', gesellschaft: 'offen' as Gesellschaft, ebene, leistungstext: '' });
  const [fehler, setFehler] = useState<Partial<Record<'name' | 'preis' | 'leistungstext', string>>>({});
  const [gescheitert, setGescheitert] = useState(false);
  const laeuft = useRef(false);
  const set = <K extends keyof NeuesProduktEingabe>(k: K, v: NeuesProduktEingabe[K]) => setE(x => ({ ...x, [k]: v }));
  const stufen = ebenenWahl(vorhandeneEbenen);
  const anlegen = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (laeuft.current) return;
    const id = neueId('l');
    const r = neuesProdukt(e, id);
    if (!r.ok) { setFehler(r.fehler); return; }
    setFehler({});
    laeuft.current = true;
    try {
      if (await api.setze('leistungen', r.eintrag as unknown as { id: string } & Record<string, unknown>)) onFertig(id);
      else setGescheitert(true);
    } finally { laeuft.current = false; }
  };
  return (
    <Fenster titel="Neues Produkt" onZu={onZu} breit={560}>
      <form onSubmit={anlegen} style={{ display: 'grid', gap: 14, minWidth: 0 }}>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Das Nötigste in einem Schritt — alles Weitere (Preis-Teile, Vertrag, Ablauf) steht danach in der Karte. Das Produkt startet als Entwurf.</div>
        {gescheitert && <Hinweis art="kritisch" rolle="alert">{api.fehler ?? 'Nicht angelegt.'} Die Eingaben bleiben hier stehen.</Hinweis>}
        <Feldzeile label="Name" fehler={fehler.name}>
          <input value={e.name} autoFocus onChange={x => set('name', x.target.value)} placeholder="z. B. Begleitung auf Zeit" style={eingabe} />
        </Feldzeile>
        <Feldzeile label="Wie wird bezahlt?">
          <Pillen<AnlegenArt> liste={ANLEGEN_ARTEN.map(a => ({ id: a.id, label: a.label }))} aktiv={e.art} onWahl={a => set('art', a)} />
        </Feldzeile>
        {e.art === 'aufwand' && (
          <Feldzeile label="Satz">
            <Pillen<'stunde' | 'tag'> liste={[{ id: 'stunde', label: 'je Stunde' }, { id: 'tag', label: 'je Tag' }]} aktiv={e.satz ?? 'stunde'} onWahl={s => set('satz', s)} />
          </Feldzeile>
        )}
        {e.art !== 'kostenlos' && (
          <Feldzeile label={`Preis netto (€${e.art === 'monatlich' ? ' je Monat' : e.art === 'jaehrlich' ? ' je Jahr' : e.art === 'aufwand' ? (e.satz === 'tag' ? ' je Tag' : ' je Stunde') : ''})`} fehler={fehler.preis}>
            <input value={e.preis} inputMode="decimal" onChange={x => set('preis', x.target.value)} placeholder="leer = Preis offen" style={eingabe} />
          </Feldzeile>
        )}
        <Feldzeile label="Gesellschaft"><div><GesellschaftWahl wert={e.gesellschaft} onWahl={g => set('gesellschaft', g)} /></div></Feldzeile>
        <Feldzeile label="Stufe der Treppe">
          <Pillen<string> liste={[...stufen.map(n => ({ id: String(n), label: `Stufe ${n}` })), { id: 'ohne', label: 'ohne Stufe' }]} aktiv={e.ebene ? String(e.ebene) : 'ohne'} onWahl={v => set('ebene', v === 'ohne' ? null : Number(v))} />
        </Feldzeile>
        <Feldzeile label="Leistungstext (ein Satz, optional)" fehler={fehler.leistungstext}>
          <textarea value={e.leistungstext} rows={2} onChange={x => set('leistungstext', x.target.value)} placeholder="Was genau geliefert wird — steht so im Angebot" style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
        </Feldzeile>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" aus={!e.name.trim()}>Anlegen</Knopf>
        </div>
      </form>
    </Fenster>
  );
}
