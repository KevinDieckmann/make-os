'use client';

// ─── Rechnungen schreiben · Karte unter Finanzen › Business › Rechnungen & Zahlungen (08.10.) ───
// Oben in „Rechnungen & Zahlungen“ (kein eigener Reiter, keine dritte Ebene): Rechnung schreiben, offene Entwürfe, fällige
// Mahnstufen (nur Vorschlag — verschickt wird per Klick im Mail-Programm), zuletzt gestellte mit PDF. Der Editor öffnet als
// Fenster; `?re=<Rechnung>` (WEG.rechnungSchreiben) öffnet ihn direkt — so führen Kontakt › Umsatz, Mandatsakte und Angebot hierher.
// Die Liste kommt serverseitig nach Sicht gefiltert (Business-Konten: nur Business-Gesellschaften).

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { euroCent } from '@/lib/crm/angebote';
import { KEINE_STEUERBERATUNG, mahnTageSaeubern } from '@/lib/finanzen/rechnung/regeln';
import { Fenster } from '../Fenster';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Leer, feld } from '../ui';
import { entwurfAnlegen, pdfLaden, rechnungPost, useRechnungen, type RechnungMitFassung } from './daten';
import { RechnungEditor } from './Editor';

const datumDe = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');
const gesKurz = (g: string) => KERN_EINHEITEN.find(e => e.id === g)?.kurz ?? (g || 'ohne Gesellschaft');
const betrag = (r: RechnungMitFassung) => euroCent(Math.round(r.betrag * 100));

export function RechnungenKarte() {
  const daten = useRechnungen();
  const router = useRouter();
  const pfad = usePathname();
  const q = useSearchParams();
  const offenId = q.get('re');
  const [meldung, setMeldung] = useState<string | null>(null);
  const [tageOffen, setTageOffen] = useState(false);
  const [tage, setTage] = useState('');
  const stand = daten.stand;

  /** Editor öffnen/schließen über die Adresse (Zurück schließt ihn). */
  const oeffnen = (id: string) => { const p = new URLSearchParams(q.toString()); p.set('re', id); router.push(`${pfad}?${p.toString()}`, { scroll: false }); };
  const schliessen = () => { const p = new URLSearchParams(q.toString()); p.delete('re'); router.replace(`${pfad}${p.toString() ? `?${p.toString()}` : ''}`, { scroll: false }); void daten.laden(); };
  // Ein Entwurf, der gerade erst (außerhalb) angelegt wurde, steht vielleicht noch nicht in der Liste — EINMAL je Kennung nachladen.
  const nachgeladen = useRef<string | null>(null);
  const { laden } = daten;
  useEffect(() => {
    if (!offenId || !stand || stand.rechnungen.some(r => r.id === offenId) || nachgeladen.current === offenId) return;
    nachgeladen.current = offenId;
    void laden();
  }, [offenId, stand, laden]);

  const rechnungen = useMemo(() => stand?.rechnungen ?? [], [stand]);
  // Entwürfe: mit Haushaltszugang nur die aus dem Editor (die übrigen stehen in der Liste darunter); Business-Konten sehen die Liste
  // darunter nicht — für sie stehen hier alle geplanten Rechnungen ihrer Gesellschaften.
  const entwuerfe = rechnungen.filter(r => r.status === 'geplant' && r.art !== 'storno' && (r.positionen || stand?.sicht === 'business')).reverse(); // jüngste zuerst (Reihenfolge im Bestand = Anlage)
  const gestellt = rechnungen.filter(r => r.pdfDateiId).sort((a, b) => (b.gestelltAm ?? '').localeCompare(a.gestelltAm ?? '')).slice(0, 12);
  const offen = offenId ? rechnungen.find(r => r.id === offenId) : undefined;

  if (daten.gesperrt) return null;

  async function neu() {
    const e = await entwurfAnlegen({ quelle: 'frei', ...(stand?.vorgabe ? { firmaId: stand.vorgabe } : {}) });
    if (!e.id) { setMeldung(e.fehler ?? 'Nicht angelegt.'); return; }
    await daten.laden();
    oeffnen(e.id);
  }
  async function tageSpeichern() {
    const t = mahnTageSaeubern(tage.split(/[^\d]+/).filter(Boolean).map(Number));
    if (!t) { setMeldung('Mahnstufen: drei steigende Tageszahlen, z. B. 7 · 14 · 21.'); return; }
    const r = await rechnungPost({ aktion: 'mahntage', tage: t });
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht gespeichert.'); return; }
    setTageOffen(false); void daten.laden();
  }

  return (
    <>
      <Karte i={0} ton={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={<Knopf onClick={neu}>+ Rechnung schreiben</Knopf>}>Rechnungen schreiben</Ueberschrift>
        {meldung && <div style={{ marginBottom: 10 }}><Hinweis art="achtung" rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung}</Hinweis></div>}
        {daten.fehler && <Hinweis art="kritisch" rolle="alert">{daten.fehler}</Hinweis>}
        {!stand ? <Leer>lade …</Leer> : <>
          {stand.mahnvorschlaege.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: LEUCHT.achtung, margin: '4px 0' }}>Mahnstufe dran · nur Vorschlag</div>
            <Liste>
              {stand.mahnvorschlaege.map(v => {
                const r = rechnungen.find(x => x.id === v.rechnungId);
                return <Zeile key={`${v.rechnungId}-${v.stufe}`} onClick={() => oeffnen(v.rechnungId)} titel={`${v.label} · Rechnung ${v.nummer ?? ''}`}
                  unter={`${r?.kunde ?? ''} · ${v.tageUeberfaellig} Tage überfällig${r ? ` · ${betrag(r)}` : ''}`} rechts={<Chip farbe={LEUCHT.achtung}>prüfen</Chip>} />;
              })}
            </Liste>
          </>}
          {entwuerfe.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim, margin: '10px 0 4px' }}>Entwürfe</div>
            <Liste>
              {entwuerfe.map(r => <Zeile key={r.id} onClick={() => oeffnen(r.id)} links={<FileText size={18} color={C.inkDim} />} titel={`${r.kunde} · ${r.titel}`}
                unter={`${gesKurz(r.firmaId)} · ${r.positionen?.length ?? 0} Position${r.positionen?.length === 1 ? '' : 'en'}${r.leistungVon ? ` · Leistung ab ${datumDe(r.leistungVon)}` : ''}`} rechts={<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{betrag(r)}</span>} />)}
            </Liste>
          </>}
          {gestellt.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim, margin: '10px 0 4px' }}>Zuletzt gestellt</div>
            <Liste>
              {gestellt.map(r => <Zeile key={r.id} onClick={() => oeffnen(r.id)} titel={`${r.nummer ?? ''} · ${r.kunde}`}
                unter={`${r.art === 'storno' ? 'Stornorechnung' : r.status}${r.datum ? ` · ${datumDe(r.datum)}` : ''}${r.faellig && r.status === 'gestellt' ? ` · fällig ${datumDe(r.faellig)}` : ''}`}
                rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{betrag(r)}</span>
                  <button onClick={e => { e.stopPropagation(); pdfLaden(r.id); }} aria-label={`PDF der Rechnung ${r.nummer ?? ''} herunterladen`} className="fassbar" style={{ minHeight: 40, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: C.ink, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer' }}>PDF ↓</button>
                </span>} />)}
            </Liste>
          </>}
          {!entwuerfe.length && !gestellt.length && !stand.mahnvorschlaege.length && <Leer>Noch keine Rechnung mit PDF — „+ Rechnung schreiben“, oder aus einem angenommenen Angebot bzw. einem Mandat.</Leer>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: TYP.bedien, color: C.inkLeise }}>
            {tageOffen
              ? <>
                <input value={tage} onChange={e => setTage(e.target.value)} placeholder="7 · 14 · 21" aria-label="Mahnstufen in Tagen nach Fälligkeit" style={{ ...feld, width: 160 }} />
                <Knopf onClick={tageSpeichern}>Speichern</Knopf><Knopf leise onClick={() => setTageOffen(false)}>Abbrechen</Knopf>
              </>
              : <>
                <span>Mahnstufen: Zahlungserinnerung {stand.mahnTage[0]} · 1. Mahnung {stand.mahnTage[1]} · 2. Mahnung {stand.mahnTage[2]} Tage nach Fälligkeit</span>
                {stand.sicht === 'privat' && <Knopf leise onClick={() => { setTage(stand.mahnTage.join(' · ')); setTageOffen(true); }}>ändern</Knopf>}
              </>}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{KEINE_STEUERBERATUNG}</div>
        </>}
      </Karte>
      {offenId && offen && (
        <Fenster titel={offen.status === 'geplant' ? 'Rechnung schreiben' : `${offen.art === 'storno' ? 'Stornorechnung' : 'Rechnung'} ${offen.nummer ?? ''}`} onZu={schliessen} breit={980}>
          <RechnungEditor key={offen.id} start={offen} daten={daten} onZu={schliessen} />
        </Fenster>
      )}
      {offenId && stand && !offen && (
        <Fenster titel="Rechnung" onZu={schliessen}>
          <Hinweis art="info">Diese Rechnung gibt es nicht (mehr) — oder sie gehört zu einer Gesellschaft, die dieses Konto nicht sieht.</Hinweis>
        </Fenster>
      )}
    </>
  );
}
