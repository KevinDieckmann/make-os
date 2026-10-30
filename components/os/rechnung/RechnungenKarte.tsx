'use client';

// ─── Rechnungen · die EINE Übersicht (08.10., seit 27.10. mit allen Rechnungen) ───
// Business › Rechnungen & Zahlungen bzw. (27.10.) Privat › Konten & Buchungen › Selbstständigkeit — je Bereich nur seine Rechnungen (der Server
// filtert: `?bereich=`). Kevin 27.10.: „Den ganzen Rechnungsprozess sauber ziehen.“ Oben die Summen (offen, überfällig, bezahlt im Jahr, Entwürfe),
// darunter Filter, Suche und ALLE Rechnungen — vorher nur Entwürfe und die zwölf zuletzt gestellten, die volle Liste stand getrennt darunter (nur mit
// Haushaltszugang). Fällige Mahnstufen bleiben ein Vorschlag (verschickt wird per Klick). Der Editor öffnet als Fenster über `?re=<Rechnung>`
// (WEG.rechnungSchreiben; `?r=` aus den Kennzahl-Links öffnet ebenso); steht die Rechnung im anderen Bereich, leitet die Karte dorthin um.

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { euroCent } from '@/lib/crm/angebote';
import { KEINE_STEUERBERATUNG, mahnTageSaeubern, istZugeordnet, zuordnungText } from '@/lib/finanzen/rechnung/regeln';
import { RECHNUNGS_FILTER, ZUSTAND_NAME, rechnungenFiltern, rechnungsSummen, rechnungsZeile, rechnungsZustand, type RechnungsFilter, type RechnungsZustand } from '@/lib/finanzen/rechnung/uebersicht';
import { localDay } from '@/lib/zeit';
import { Fenster } from '../Fenster';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Leer, Pillen, Kennzahl, Raster, feld } from '../ui';
import { entwurfAnlegen, pdfLaden, rechnungPost, useRechnungen, type RechnungMitFassung } from './daten';
import { RechnungEditor } from './Editor';
import { anzahl } from '@/lib/text/zahlwort';
import { WEG, zurueckZiel } from '@/lib/wege';
import { useZurueck } from '../Verlauf';

const datumDe = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');
const gesKurz = (g: string) => KERN_EINHEITEN.find(e => e.id === g)?.kurz ?? (g || 'ohne Gesellschaft');
const betrag = (r: RechnungMitFassung) => euroCent(Math.round(r.betrag * 100) * (r.art === 'storno' ? -1 : 1));
const ZUSTAND_FARBE: Record<RechnungsZustand, string> = {
  entwurf: C.inkDim, geplant: C.inkLeise, offen: LEUCHT.achtung, ueberfaellig: LEUCHT.kritisch, bezahlt: LEUCHT.gut, storniert: C.inkLeise, storno: C.inkLeise,
};
/** So viele Zeilen zeigt die Liste zuerst — „weitere zeigen“ holt den Rest (nie still gekürzt). */
const ERST = 40;

export function RechnungenKarte({ bereich = 'business' }: { bereich?: 'privat' | 'business' }) {
  const router = useRouter();
  const pfad = usePathname();
  const q = useSearchParams();
  const offenId = q.get('re') ?? q.get('r');
  const daten = useRechnungen({ bereich, re: offenId });
  const heute = localDay();
  const [meldung, setMeldung] = useState<string | null>(null);
  const [tageOffen, setTageOffen] = useState(false);
  const [tage, setTage] = useState('');
  const [filter, setFilter] = useState<RechnungsFilter>('alle');
  const [suche, setSuche] = useState('');
  const [ges, setGes] = useState<string | null>(null);
  const [alle, setAlle] = useState(false);
  const stand = daten.stand;

  /** Editor öffnen/schließen über die Adresse (Zurück schließt ihn). */
  const oeffnen = (id: string) => { const p = new URLSearchParams(q.toString()); p.set('re', id); p.delete('r'); p.delete('zurueck'); router.push(`${pfad}?${p.toString()}`, { scroll: false }); };
  // Aus dem Mandat (bzw. einer anderen Seite) geöffnet (21.10., Rundgang B8): „Schließen“ führt dorthin zurück — ein echter Schritt zurück, sonst die Seite
  // aus `zurueck` (nur eigene Pfade, `zurueckZiel`). Vorher landete man in Finanzen › Rechnungen.
  const zurueck = useZurueck();
  const zurueckNach = zurueckZiel(q.get('zurueck'));
  const schliessen = () => {
    if (zurueckNach) { zurueck(zurueckNach); return; }
    const p = new URLSearchParams(q.toString()); p.delete('re'); p.delete('r'); router.replace(`${pfad}${p.toString() ? `?${p.toString()}` : ''}`, { scroll: false }); void daten.laden();
  };
  // Die Rechnung steht im anderen Bereich (27.10.): z. B. eine Rechnung der Selbstständigkeit, geöffnet über einen Business-Link → dorthin, `zurueck` bleibt.
  useEffect(() => {
    if (!offenId || !stand?.ort || stand.ort === bereich) return;
    router.replace(WEG.rechnungSchreiben(offenId, q.get('zurueck') ?? undefined, stand.ort), { scroll: false });
  }, [offenId, stand?.ort, bereich, router, q]);
  // Ein Entwurf, der gerade erst (außerhalb) angelegt wurde, steht vielleicht noch nicht in der Liste — EINMAL je Kennung nachladen.
  const nachgeladen = useRef<string | null>(null);
  const { laden } = daten;
  useEffect(() => {
    if (!offenId || !stand || stand.rechnungen.some(r => r.id === offenId) || nachgeladen.current === offenId) return;
    nachgeladen.current = offenId;
    void laden();
  }, [offenId, stand, laden]);

  // Planposten (geplant, ohne Positionen) sind keine Rechnungen — sie stehen weiter darunter in „Planposten & ältere Rechnungen“ (Liquidität).
  const rechnungen = useMemo(() => (stand?.rechnungen ?? []).filter(r => rechnungsZustand(r, heute) !== 'geplant'), [stand, heute]);
  const summen = useMemo(() => rechnungsSummen(rechnungen, heute), [rechnungen, heute]);
  const namen = stand?.namen;
  const liste = useMemo(() => rechnungenFiltern(rechnungen, { filter, suche, gesellschaft: ges, ...(namen ? { namen } : {}) }, heute), [rechnungen, filter, suche, ges, heute, namen]);
  const gezeigt = alle ? liste : liste.slice(0, ERST);
  const offen = offenId ? stand?.rechnungen.find(r => r.id === offenId) : undefined;
  const gesellschaften = stand?.gesellschaften ?? [];
  const firmenInListe = [...new Set(rechnungen.map(r => r.firmaId))];

  if (daten.gesperrt) return null;

  async function neu() {
    const firmaId = stand?.vorgabe ?? gesellschaften[0]?.id;
    const e = await entwurfAnlegen({ quelle: 'frei', ...(firmaId ? { firmaId } : {}) });
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
  /** 29.10. (Kreislauf Geld): Stellschraube „Rechnungen vorbereiten“ — der Morgenlauf legt fällige Raten/Monatsrechnungen als Entwurf an (nie gestellt). */
  async function vorbereitenUmschalten(an: boolean) {
    const r = await rechnungPost({ aktion: 'vorbereiten', an });
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht gespeichert.'); return; }
    void daten.laden();
  }
  const filterAuf = (f: RechnungsFilter) => { setFilter(f); setAlle(false); };

  return (
    <>
      <Karte i={0} ton={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={<Knopf haupt onClick={neu}>+ Rechnung schreiben</Knopf>}>{bereich === 'privat' ? 'Rechnungen der Selbstständigkeit' : 'Rechnungen'}</Ueberschrift>
        {meldung && <div style={{ marginBottom: 10 }}><Hinweis art="achtung" rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung}</Hinweis></div>}
        {daten.fehler && <Hinweis art="kritisch" rolle="alert">{daten.fehler}</Hinweis>}
        {!stand ? <Leer>lade …</Leer> : <>
          <Raster min={150}>
            <Kennzahl klein label="Offen" wert={euroCent(summen.offenCent)} unter={anzahl(summen.offen, 'Rechnung', 'Rechnungen')} onClick={() => filterAuf('offen')} />
            <Kennzahl klein label="Überfällig" wert={euroCent(summen.ueberfaelligCent)} ton={summen.ueberfaellig ? LEUCHT.kritisch : undefined} unter={anzahl(summen.ueberfaellig, 'Rechnung', 'Rechnungen')} onClick={() => filterAuf('ueberfaellig')} />
            <Kennzahl klein label={`Bezahlt ${heute.slice(0, 4)}`} wert={euroCent(summen.bezahltJahrCent)} ton={summen.bezahltJahr ? LEUCHT.gut : undefined} unter={anzahl(summen.bezahltJahr, 'Rechnung', 'Rechnungen')} onClick={() => filterAuf('bezahlt')} />
            <Kennzahl klein label="Entwürfe" wert={String(summen.entwuerfe)} unter="noch nicht gestellt" onClick={() => filterAuf('entwuerfe')} />
          </Raster>

          {stand.mahnvorschlaege.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: LEUCHT.achtung, margin: '14px 0 4px' }}>Mahnstufe dran · nur Vorschlag</div>
            <Liste>
              {stand.mahnvorschlaege.map(v => {
                const r = rechnungen.find(x => x.id === v.rechnungId);
                return <Zeile key={`${v.rechnungId}-${v.stufe}`} onClick={() => oeffnen(v.rechnungId)} titel={`${v.label} · Rechnung ${v.nummer ?? ''}`}
                  unter={`${r?.kunde ?? ''} · ${anzahl(v.tageUeberfaellig, 'Tag', 'Tage')} überfällig${r ? ` · ${betrag(r)}` : ''}`} rechts={<Chip farbe={LEUCHT.achtung}>prüfen</Chip>} />;
              })}
            </Liste>
          </>}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 6px' }}>
            <Pillen<RechnungsFilter> liste={RECHNUNGS_FILTER} aktiv={filter} onWahl={filterAuf} />
            <input value={suche} onChange={e => { setSuche(e.target.value); setAlle(false); }} placeholder="Suchen: Kunde, Firma, Person, Nummer, Titel" aria-label="Rechnungen durchsuchen" type="search" style={{ ...feld, flex: '1 1 200px', maxWidth: 320 }} />
          </div>
          {firmenInListe.length > 1 && (
            <div style={{ marginBottom: 6 }}>
              <Pillen<string> liste={[{ id: '', label: 'Alle Gesellschaften' }, ...firmenInListe.map(id => ({ id, label: gesKurz(id) }))]} aktiv={ges ?? ''} onWahl={id => setGes(id || null)} />
            </div>
          )}

          {gezeigt.length > 0
            ? <Liste>
              {gezeigt.map(r => {
                const z = rechnungsZustand(r, heute);
                const zeile = rechnungsZeile(r);
                const wann = z === 'bezahlt' ? `bezahlt ${datumDe(r.bezahltAm)}` : z === 'offen' || z === 'ueberfaellig' ? `fällig ${datumDe(r.faellig)}` : r.datum ? datumDe(r.datum) : r.leistungVon ? `Leistung ab ${datumDe(r.leistungVon)}` : '';
                // 30.10.: der zugeordnete Kunde der Markttraktion je Zeile; ohne Zuordnung ein Kennzeichen (so geht sie nicht raus).
                const kunde = zuordnungText(r, namen);
                const ohne = r.art !== 'storno' && !istZugeordnet(r);
                return <Zeile key={r.id} onClick={() => oeffnen(r.id)} links={<FileText size={18} color={ZUSTAND_FARBE[z]} />} titel={zeile.titel}
                  unter={[kunde ? `Kunde: ${kunde}` : null, zeile.unter, gesKurz(r.firmaId), wann].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    {ohne && <Chip farbe={LEUCHT.achtung}>ohne Zuordnung</Chip>}
                    <Chip farbe={ZUSTAND_FARBE[z]}>{ZUSTAND_NAME[z]}</Chip>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, textDecoration: z === 'storniert' ? 'line-through' : 'none', minWidth: 92, textAlign: 'right' }}>{betrag(r)}</span>
                    {r.pdfDateiId && <button onClick={e => { e.stopPropagation(); pdfLaden(r.id); }} aria-label={`PDF der Rechnung ${r.nummer ?? ''} herunterladen`} className="fassbar" style={{ minHeight: 40, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: C.ink, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer' }}>PDF ↓</button>}
                  </span>} />;
              })}
            </Liste>
            : <Leer>{rechnungen.length ? 'Keine Rechnung passt zu Filter und Suche.' : 'Noch keine Rechnung — „+ Rechnung schreiben“, oder aus einem angenommenen Angebot bzw. einem Mandat.'}</Leer>}
          {liste.length > gezeigt.length && <div style={{ marginTop: 8 }}><Knopf leise onClick={() => setAlle(true)}>{`Weitere ${liste.length - gezeigt.length} zeigen`}</Knopf></div>}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14, fontSize: TYP.bedien, color: C.inkLeise }}>
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
          {typeof stand.vorbereiten === 'boolean' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>
              <span>Fällige Raten und Monatsrechnungen aus Mandaten: {stand.vorbereiten ? 'der Morgenlauf legt den Entwurf an (Stellen bleibt dein Klick)' : 'nur auf Klick in der Mandatsakte'}</span>
              {stand.sicht === 'privat' && <Knopf leise onClick={() => vorbereitenUmschalten(!stand.vorbereiten)}>{stand.vorbereiten ? 'ausschalten' : 'einschalten'}</Knopf>}
            </div>
          )}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{KEINE_STEUERBERATUNG}</div>
        </>}
      </Karte>
      {offenId && offen && (
        <Fenster titel={offen.status === 'geplant' ? 'Rechnung schreiben' : `${offen.art === 'storno' ? 'Stornorechnung' : 'Rechnung'} ${offen.nummer ?? ''}`} onZu={schliessen} breit={980}>
          <RechnungEditor key={offen.id} start={offen} daten={daten} onZu={schliessen} onOeffnen={oeffnen} />
        </Fenster>
      )}
      {offenId && stand && !offen && !stand.ort && (
        <Fenster titel="Rechnung" onZu={schliessen}>
          <Hinweis art="info">Diese Rechnung gibt es nicht (mehr) — oder sie gehört zu einer Gesellschaft, die dieses Konto nicht sieht.</Hinweis>
        </Fenster>
      )}
    </>
  );
}
