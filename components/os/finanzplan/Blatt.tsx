'use client';

// ─── Finanzplanung jetzt — das Blatt (Excel-Gefühl) ──────────────────────────
// Ein Raster für Privat, MAKE (Kennung ug), KD Ventures und Gruppe: Zeilen mit Gruppen,
// Monate als Spalten (davor auf Wunsch die IST-Historie in Lila), rechts die
// Summe. Zelle anklicken oder Ziffer tippen → bearbeiten; Enter übernimmt,
// Tab übernimmt und geht nach rechts, Pfeile bewegen die Auswahl, Entf setzt
// zurück, Escape bricht ab. Rechtsklick oder langer Druck: Wert fortschreiben
// (ab hier · 12 Monate), zurücksetzen, Notiz. Überschriebene Zellen tragen
// links den Strich der Person, die sie geändert hat (Tooltip mit Datum).
// Modus Plan · IST · Abweichung, Jahr-Filter. Gerechnet wird im Rechenkern —
// das Blatt zeigt nur, was `get(m)` liefert.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, MIKRO } from '@/lib/make-one/design';
import { LEUCHT, Knopf, feld } from '../schlank';
import type { Zeile } from '@/lib/finanzen/rechenkern';
import { key, jahrVon } from '@/lib/finanzen/rechenkern';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { eur, parseBetrag, zeileName, monatLabel, datumLang } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { Kontextmenue, Dialog, KnopfKlein, Schalter, personFarbe, personName, LILA, HAAR, vorzeichenFarbe, Legende, Pillen } from './teile';

export type ZeilenListe = 'sachkosten' | 'privatBudget' | 'privatEinnahmen' | 'privatSchulden';
export interface GruppenZeile {
  grp: string; add?: ZeilenListe; addG?: string; /** Einheit der neuen Zeile (Sachkosten der Selbstständigkeit). */ addE?: Zeile['einheit'];
  /** Beim Öffnen eingeklappt (nur die Summenzeilen bleiben sichtbar). */
  zu?: boolean;
  /** Name für verborgene Nullzeilen: [Einzahl, Mehrzahl], z. B. ['weitere Steuerzeile', 'weitere Steuerzeilen']. */
  leerName?: [string, string];
}
export interface DatenZeile {
  name: string;
  /** Planwert im Monat m (1 = Okt 26) — kommt aus dem Rechenkern, enthält Überschreibungen. */
  get: (m: number) => number;
  /** IST im Historienmonat i (0 = Jan 26). */
  hist?: (i: number) => number | null;
  /** Kennung der Zelle für Überschreibungen (plan/ist) — ohne edit ist die Zeile nur Anzeige. */
  edit?: string;
  /** Kennung der Planzeile — Klick auf den Namen öffnet den Zeilen-Dialog. */
  zeile?: string;
  sum?: boolean; key?: boolean; stock?: boolean; ind?: boolean; aus?: boolean;
  istGet?: (m: number) => number | null;
  /** Klick auf eine IST-Zelle springt in die Buchungen dieser Zeile. */
  drill?: string;
  z?: Zeile;
  /**
   * Eigene Zelle statt Planzelle (02.10.): Klick → bearbeiten, Enter speichert — aber über `setze` (z. B. ein Monat eines
   * Produkts im Szenario) und nicht als Überschreibung im Plan. `id` muss im Blatt eindeutig sein; nur im Modus „Plan“.
   */
  zelle?: { id: string; setze: (m: number, wert: number | null) => void; ueber: (m: number) => boolean };
  /** Nullzeile: bleibt verborgen („n weitere …“ der Gruppe), solange sie in allen Monaten 0 ist. */
  optional?: boolean;
}
export type BlattZeile = GruppenZeile | DatenZeile;
export interface ExtraSpalte { h: string; t?: string; get: (r: DatenZeile) => ReactNode }
type Modus = 'plan' | 'ist' | 'delta';
type Jahr = 'alle' | '2026' | '2027' | '2028';
type Spalte = { h: true; i: number; label: string } | { h?: false; m: number; label: string };

const istGruppe = (r: BlattZeile): r is GruppenZeile => 'grp' in r;
const ZELLE_MIN = 74;
/** Kennung der bearbeitbaren Zelle einer Zeile: Planzelle (`edit`) oder eigene Zelle (`zelle.id`). */
const eid = (r: DatenZeile): string | undefined => r.edit ?? r.zelle?.id;

export function Blatt({ zeilen, titel, hist, extra, onZeile, onNeueZeile, onDrill, werkzeuge }: {
  zeilen: BlattZeile[]; titel: string; hist?: boolean; extra?: ExtraSpalte[];
  onZeile?: (id: string) => void; onNeueZeile?: (liste: ZeilenListe, gruppe?: string, einheit?: Zeile['einheit']) => void; onDrill?: (histIdx: number, zeile: string) => void; werkzeuge?: ReactNode;
}) {
  const { d, aendere, verbergen, person } = usePlan();
  const [modus, setModus] = useState<Modus>('plan');
  const [jahr, setJahr] = useState<Jahr>('alle');
  const [verlauf, setVerlauf] = useState(true);
  const [zu, setZu] = useState<Record<string, boolean>>(() => Object.fromEntries(zeilen.filter((r): r is GruppenZeile => istGruppe(r) && !!r.zu).map(r => [r.grp, true])));
  const [leerZeigen, setLeerZeigen] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<{ e: string; m: number } | null>(null);
  const [bearbeitet, setBearbeitet] = useState<{ e: string; m: number; text: string } | null>(null);
  const [menue, setMenue] = useState<{ x: number; y: number; e: string; m: number } | null>(null);
  const [notiz, setNotiz] = useState<{ e: string; m: number; text: string } | null>(null);
  const wurzel = useRef<HTMLDivElement>(null);
  const druck = useRef<number | null>(null);
  const fertigRef = useRef(false);

  const spalten = useMemo<Spalte[]>(() => {
    const c: Spalte[] = [];
    if (hist && verlauf && (jahr === 'alle' || jahr === '2026')) d.historie.forEach((l, i) => c.push({ h: true, i, label: l }));
    d.monate.forEach((l, i) => { const m = i + 1; if (jahr === 'alle' || String(jahrVon(m)) === jahr) c.push({ m, label: l }); });
    return c;
  }, [d.historie, d.monate, hist, verlauf, jahr]);
  const planMonate = useMemo(() => spalten.filter((s): s is { m: number; label: string } => !s.h).map(s => s.m), [spalten]);
  const erstPlan = spalten.findIndex(s => !s.h);

  /** Sichtbare, bearbeitbare Zeilen in Reihenfolge — für Pfeil hoch/runter. */
  const editZeilen = useMemo(() => {
    const out: string[] = []; let zuG = false;
    for (const r of zeilen) { if (istGruppe(r)) { zuG = !!zu[r.grp]; continue; } if (zuG && !r.sum) continue; if (eid(r)) out.push(eid(r)!); }
    return out;
  }, [zeilen, zu]);
  const zeileVon = useCallback((e: string) => zeilen.find((r): r is DatenZeile => !istGruppe(r) && eid(r) === e), [zeilen]);

  const label = (e: string, m: number) => `${modus === 'ist' ? 'IST ' : ''}${zeileVon(e)?.zelle ? zeileVon(e)!.name : zeileName(d, e)} · ${monatLabel(d, m)}`;
  const ebene = modus === 'ist' ? 'ist' : 'plan';
  const speicher = ebene === 'ist' ? d.ist : d.plan;

  /** Zelle setzen/zurücksetzen. */
  const setzeZelle = useCallback((e: string, m: number, wert: number | null) => {
    const eigene = zeileVon(e)?.zelle;
    if (eigene) { eigene.setze(m, wert); return; }
    const k = key(e, m);
    const op: Operation = wert === null ? { pfad: `/${ebene}/${k}` } : { pfad: `/${ebene}/${k}`, neu: wert };
    if (wert === null && !(k in speicher)) return;
    void aendere([{ ...op, alt: speicher[k] }], label(e, m));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aendere, ebene, speicher, d, zeileVon]);

  const anzeigeWert = useCallback((r: DatenZeile, m: number): number | null => {
    const k = r.edit ? key(r.edit, m) : null;
    if (modus === 'plan') return r.get(m);
    if (modus === 'ist') { if (k && k in d.ist) return d.ist[k]; return r.istGet ? r.istGet(m) : null; }
    if (k && k in d.ist) return d.ist[k] - r.get(m);
    return null;
  }, [modus, d.ist]);

  const beginne = useCallback((e: string, m: number, start?: string) => {
    const r = zeileVon(e); if (!r) return;
    if (r.zelle && modus !== 'plan') return;
    const v = anzeigeWert(r, m);
    fertigRef.current = false;
    setSel({ e, m });
    setBearbeitet({ e, m, text: start ?? (v == null ? '' : eur(v, Number.isInteger(v) ? 0 : 2)) });
  }, [zeileVon, anzeigeWert, modus]);

  const uebernehme = useCallback((weiter: boolean) => {
    const b = bearbeitet; if (!b || fertigRef.current) return;
    fertigRef.current = true;
    const r = zeileVon(b.e);
    const v = parseBetrag(b.text);
    setBearbeitet(null);
    if (r) {
      const alt = anzeigeWert(r, b.m);
      if (v === null) setzeZelle(b.e, b.m, null);
      else if (!Number.isNaN(v) && (alt == null || Math.abs(v - alt) > 1e-9)) setzeZelle(b.e, b.m, v);
    }
    if (weiter) {
      const i = planMonate.indexOf(b.m);
      if (i >= 0 && i + 1 < planMonate.length) setTimeout(() => beginne(b.e, planMonate[i + 1]), 0);
    }
  }, [bearbeitet, zeileVon, anzeigeWert, setzeZelle, planMonate, beginne]);

  // Tastatur auf dem Blatt: nur, wenn eine Zelle gewählt ist und kein Feld den Fokus hat.
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (!sel || bearbeitet || menue || notiz) return;
      const t = ev.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const mi = planMonate.indexOf(sel.m), zi = editZeilen.indexOf(sel.e);
      let ziel: { e: string; m: number } | null = null;
      if (ev.key === 'ArrowRight' && mi + 1 < planMonate.length) ziel = { e: sel.e, m: planMonate[mi + 1] };
      else if (ev.key === 'ArrowLeft' && mi > 0) ziel = { e: sel.e, m: planMonate[mi - 1] };
      else if (ev.key === 'ArrowDown' && zi + 1 < editZeilen.length) ziel = { e: editZeilen[zi + 1], m: sel.m };
      else if (ev.key === 'ArrowUp' && zi > 0) ziel = { e: editZeilen[zi - 1], m: sel.m };
      else if (ev.key === 'Enter') { ev.preventDefault(); beginne(sel.e, sel.m); return; }
      else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); setzeZelle(sel.e, sel.m, null); return; }
      else if (ev.key === 'Escape') { setSel(null); return; }
      else if (/^[0-9,.\-]$/.test(ev.key)) { ev.preventDefault(); beginne(sel.e, sel.m, ev.key); return; }
      if (ziel) {
        ev.preventDefault(); setSel(ziel);
        wurzel.current?.querySelector<HTMLElement>(`td[data-e="${CSS.escape(ziel.e)}"][data-m="${ziel.m}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [sel, bearbeitet, menue, notiz, planMonate, editZeilen, beginne, setzeZelle]);

  // Kontextmenü: fortschreiben, zurücksetzen, Notiz.
  const menueEintraege = () => {
    if (!menue) return [];
    const { e, m } = menue; const r = zeileVon(e); const k = key(e, m);
    const wert = k in speicher ? speicher[k] : r ? anzeigeWert(r, m) ?? 0 : 0;
    const fort = (bis: number) => {
      const ops: Operation[] = []; for (let i = m; i <= bis; i++) ops.push({ pfad: `/${ebene}/${key(e, i)}`, alt: speicher[key(e, i)], neu: wert });
      void aendere(ops, `${zeileName(d, e)} ab ${monatLabel(d, m)} bis ${monatLabel(d, bis)}`);
    };
    const zurueck = (bis: number) => {
      const ops: Operation[] = []; for (let i = m; i <= bis; i++) if (key(e, i) in speicher) ops.push({ pfad: `/${ebene}/${key(e, i)}`, alt: speicher[key(e, i)] });
      if (ops.length) void aendere(ops, `${zeileName(d, e)} ab ${monatLabel(d, m)} zurückgesetzt`);
    };
    return [
      { label: 'Wert ab hier für alle Folgemonate', tun: () => fort(d.monate.length) },
      { label: 'Wert für die nächsten 12 Monate', tun: () => fort(Math.min(d.monate.length, m + 11)) },
      { label: 'Zurücksetzen', tun: () => setzeZelle(e, m, null), aus: !(k in speicher) },
      { label: 'Ab hier alle zurücksetzen', tun: () => zurueck(d.monate.length) },
      { label: d.notizen[k] ? 'Notiz bearbeiten' : 'Notiz hinzufügen', tun: () => setNotiz({ e, m, text: d.notizen[k] ?? '' }) },
    ];
  };
  const notizSpeichern = () => {
    if (!notiz) return; const k = key(notiz.e, notiz.m); const t = notiz.text.trim();
    setNotiz(null);
    if (t === (d.notizen[k] ?? '')) return;
    void aendere([t ? { pfad: `/notizen/${k}`, alt: d.notizen[k], neu: t } : { pfad: `/notizen/${k}`, alt: d.notizen[k] }], `Notiz ${zeileName(d, notiz.e)} · ${monatLabel(d, notiz.m)}`);
  };

  const geldStil: CSSProperties = verbergen ? { filter: 'blur(6px)', userSelect: 'none' } : {};
  const zellStil = (extraStil?: CSSProperties): CSSProperties => ({ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: SCHRIFT.display, fontSize: 12.5, minWidth: ZELLE_MIN, whiteSpace: 'nowrap', borderBottom: `1px solid ${HAAR}`, position: 'relative', ...extraStil });
  const kopfStil: CSSProperties = { ...MIKRO, fontSize: 11, padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: C.flaeche, zIndex: 2, borderBottom: `1px solid ${HAAR}` };
  const nameStil: CSSProperties = { position: 'sticky', left: 0, background: C.flaeche, zIndex: 1, padding: '5px 10px 5px 4px', fontSize: 12.5, whiteSpace: 'nowrap', textAlign: 'left', borderBottom: `1px solid ${HAAR}`, minWidth: 150, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' };

  let zuG = false;
  const koerper: ReactNode[] = [];
  /** Nullzeilen („optional“), die in allen Planmonaten 0 sind — verborgen, bis man „n weitere …“ anklickt. */
  const leer = new Set<DatenZeile>();
  for (const r of zeilen) if (!istGruppe(r) && r.optional && d.monate.every((_, i) => Math.abs(r.get(i + 1) ?? 0) < 0.5)) leer.add(r);
  let aktuelleGruppe = '', verborgen = 0, nullzeilen = 0, leerName: [string, string] = ['weitere Zeile', 'weitere Zeilen'];
  const leerZeile = () => {
    if (!nullzeilen) return;
    const g = aktuelleGruppe, n = nullzeilen, v = verborgen; verborgen = 0; nullzeilen = 0;
    koerper.push(
      <tr key={`leer-${g}`}>
        <td style={{ ...nameStil, paddingLeft: 16, color: C.inkLeise, cursor: 'pointer' }} onClick={() => setLeerZeigen(z => ({ ...z, [g]: !z[g] }))} title={v ? 'Alle Werte sind 0 — anklicken zeigt sie' : 'Nullzeilen wieder verbergen'}>
          {v ? `▸ ${n} ${n === 1 ? leerName[0] : leerName[1]}` : `▾ ${n === 1 ? 'Nullzeile' : 'Nullzeilen'} verbergen`}
        </td>
        <td colSpan={spalten.length + 1 + (extra?.length ?? 0)} style={{ borderBottom: `1px solid ${HAAR}` }} />
      </tr>,
    );
  };
  for (const r of zeilen) {
    if (istGruppe(r)) {
      leerZeile();
      aktuelleGruppe = r.grp; if (r.leerName) leerName = r.leerName;
      zuG = !!zu[r.grp];
      koerper.push(
        <tr key={`g-${r.grp}`}>
          <td style={{ ...nameStil, ...MIKRO, paddingTop: 12, cursor: 'pointer' }} onClick={() => setZu(z => ({ ...z, [r.grp]: !z[r.grp] }))}>
            <span style={{ marginRight: 6 }}>{zuG ? '▸' : '▾'}</span>{r.grp}
            {r.add && onNeueZeile && <button type="button" onClick={e => { e.stopPropagation(); onNeueZeile(r.add!, r.addG, r.addE); }} style={{ marginLeft: 10, background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 11.5, fontWeight: 600, textTransform: 'none', letterSpacing: 0, padding: 0 }}>+ Zeile</button>}
          </td>
          <td colSpan={spalten.length + 1 + (extra?.length ?? 0)} style={{ borderBottom: `1px solid ${HAAR}` }} />
        </tr>,
      );
      continue;
    }
    if (zuG && !r.sum) continue;
    if (r.optional && leer.has(r)) { nullzeilen++; if (!leerZeigen[aktuelleGruppe]) { verborgen++; continue; } }
    let summe = 0, letzter = 0, n = 0;
    const zellen = spalten.map((c, j) => {
      const heuteRand = j === erstPlan && erstPlan > 0 ? { boxShadow: `inset 2px 0 0 ${C.aktiv}55` } : undefined;
      if (c.h) {
        const v = r.hist ? r.hist(c.i) : null;
        const klick = r.drill && onDrill && v != null ? () => onDrill(c.i, r.drill!) : undefined;
        return <td key={`h${c.i}`} onClick={klick} title={klick ? 'Buchungen dahinter öffnen' : undefined} style={zellStil({ background: `${LILA}10`, color: v == null ? C.inkLeise : C.ink, cursor: klick ? 'pointer' : 'default', ...heuteRand })}><span style={geldStil}>{v == null ? '' : eur(v)}</span></td>;
      }
      const m = c.m; const k = r.edit ? key(r.edit, m) : null;
      const v = anzeigeWert(r, m);
      const ueberschrieben = r.zelle ? modus === 'plan' && r.zelle.ueber(m) : !!k && modus !== 'delta' && k in speicher;
      const meta = k && modus === 'plan' && k in d.plan ? d.meta[k] : undefined;
      const gewaehlt = !!eid(r) && !!sel && sel.e === eid(r) && sel.m === m;
      const bearb = !!eid(r) && !!bearbeitet && bearbeitet.e === eid(r) && bearbeitet.m === m;
      const hatNotiz = !!k && !!d.notizen[k];
      if (modus === 'plan' && v != null && !Number.isNaN(v)) { summe += v; letzter = v; n++; }
      let farbe: string | undefined = v == null ? C.inkLeise : vorzeichenFarbe(v);
      if (modus === 'delta' && v != null) farbe = v > 0.5 ? (r.aus ? LEUCHT.kritisch : LEUCHT.gut) : v < -0.5 ? (r.aus ? LEUCHT.gut : LEUCHT.kritisch) : C.inkDim;
      const titel = [hatNotiz ? d.notizen[k!] : null, meta ? `${personName(meta.wer)} · ${datumLang(meta.wann.slice(0, 10))}` : ueberschrieben ? 'überschrieben' : null].filter(Boolean).join(' — ') || undefined;
      const stil = zellStil({
        cursor: eid(r) ? 'cell' : 'default',
        color: farbe,
        background: bearb ? 'rgba(255,255,255,.08)' : gewaehlt ? `${C.aktiv}22` : modus === 'ist' && r.edit ? `${LILA}0E` : ueberschrieben && modus === 'plan' ? `${LEUCHT.achtung}12` : undefined,
        outline: gewaehlt ? `1px solid ${C.aktiv}` : undefined, outlineOffset: -1,
        boxShadow: meta ? `inset 3px 0 0 ${personFarbe(meta.wer)}` : heuteRand?.boxShadow,
        fontWeight: r.sum || r.key ? 700 : 500,
      });
      return (
        <td key={m} data-e={eid(r) ?? undefined} data-m={eid(r) ? m : undefined} title={titel} style={stil}
          onClick={eid(r) ? () => beginne(eid(r)!, m) : undefined}
          onContextMenu={r.edit ? ev => { ev.preventDefault(); setMenue({ x: ev.clientX, y: ev.clientY, e: r.edit!, m }); } : undefined}
          onTouchStart={r.edit ? ev => { const t = ev.touches[0]; druck.current = window.setTimeout(() => setMenue({ x: t.clientX, y: t.clientY, e: r.edit!, m }), 550); } : undefined}
          onTouchEnd={() => { if (druck.current) { clearTimeout(druck.current); druck.current = null; } }}
          onTouchMove={() => { if (druck.current) { clearTimeout(druck.current); druck.current = null; } }}>
          {bearb ? (
            <input autoFocus value={bearbeitet!.text} inputMode="decimal" aria-label={label(eid(r)!, m)} onChange={ev => setBearbeitet(b => (b ? { ...b, text: ev.target.value } : b))}
              onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); uebernehme(false); } else if (ev.key === 'Tab') { ev.preventDefault(); uebernehme(true); } else if (ev.key === 'Escape') { fertigRef.current = true; setBearbeitet(null); } }}
              onBlur={() => uebernehme(false)} onFocus={ev => ev.target.select()}
              style={{ ...feld, width: Math.max(ZELLE_MIN - 4, 8 * bearbeitet!.text.length + 20), padding: '2px 6px', borderRadius: 6, fontSize: 12.5, textAlign: 'right', fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', border: `1px solid ${C.aktiv}` }} />
          ) : <span style={geldStil}>{v == null ? (modus === 'plan' ? '' : '·') : eur(v)}</span>}
          {hatNotiz && !bearb && <span aria-hidden style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: LEUCHT.business }} />}
        </td>
      );
    });
    const summeWert = n ? (r.stock ? letzter : summe) : null;
    koerper.push(
      <tr key={eid(r) ?? r.name} style={{ background: r.sum ? 'rgba(255,255,255,.025)' : undefined }}>
        <td style={{ ...nameStil, paddingLeft: r.ind ? 16 : 4, fontWeight: r.sum || r.key ? 700 : 500, color: r.key ? C.aktiv : C.ink }}>
          {r.zeile && onZeile ? <button type="button" onClick={() => onZeile(r.zeile!)} title="Zeile bearbeiten" style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', borderBottom: `1px dotted ${C.inkLeise}` }}>{r.name}</button> : r.name}
        </td>
        {extra?.map((x, i) => <td key={`x${i}`} style={zellStil({ color: C.inkDim, background: 'rgba(255,255,255,.02)' })}><span style={geldStil}>{x.get(r)}</span></td>)}
        {zellen}
        <td style={zellStil({ fontWeight: 700, background: 'rgba(255,255,255,.02)', color: summeWert == null ? C.inkLeise : vorzeichenFarbe(summeWert) })}><span style={geldStil}>{modus === 'plan' ? eur(summeWert) : ''}</span></td>
      </tr>,
    );
  }

  leerZeile();
  return (
    <div ref={wurzel}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {werkzeuge}
        <Pillen liste={[{ id: 'plan' as Modus, label: 'Plan' }, { id: 'ist' as Modus, label: 'IST' }, { id: 'delta' as Modus, label: 'Abweichung' }]} aktiv={modus} onWahl={m => { setModus(m); setSel(null); }} einzeilig />
        <Pillen liste={[{ id: 'alle' as Jahr, label: 'Alle' }, { id: '2026' as Jahr, label: '2026' }, { id: '2027' as Jahr, label: '2027' }, { id: '2028' as Jahr, label: '2028' }]} aktiv={jahr} onWahl={setJahr} einzeilig />
        {hist && <Schalter an={verlauf} onChange={setVerlauf}>IST Jan–Sep</Schalter>}
        <span style={{ flex: 1 }} />
        <Legende eintraege={[{ farbe: LILA, text: 'IST' }, { farbe: LEUCHT.achtung, text: 'überschrieben' }, { farbe: LEUCHT.business, text: 'Notiz' }, { farbe: personFarbe('kevin'), text: 'Kevin' }, { farbe: personFarbe('malin'), text: 'Malin' }]} />
      </div>
      <div style={{ overflow: 'auto', maxHeight: '72vh', borderRadius: 12, background: C.flaeche, WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', color: C.ink, fontFamily: SCHRIFT.text }}>
          <thead>
            <tr>
              <th style={{ ...kopfStil, textAlign: 'left', left: 0, zIndex: 3, paddingLeft: 4 }}>{titel}</th>
              {extra?.map((x, i) => <th key={`x${i}`} title={x.t} style={kopfStil}>{x.h}</th>)}
              {spalten.map((c, j) => <th key={c.h ? `h${c.i}` : `m${c.m}`} style={{ ...kopfStil, color: c.h ? LILA : j === erstPlan && erstPlan > 0 ? C.aktiv : C.inkLeise }}>{c.label}</th>)}
              <th style={kopfStil}>{jahr === 'alle' ? 'Plan gesamt' : `Plan ${jahr}`}</th>
            </tr>
          </thead>
          <tbody>{koerper}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>
        Zelle anklicken oder Ziffer tippen · Enter übernimmt · Tab weiter · Pfeile bewegen · Entf setzt zurück · Rechtsklick oder langer Druck: fortschreiben, Notiz.
        {person && <> Änderungen laufen unter <b style={{ color: personFarbe(person) }}>{personName(person)}</b>.</>}
      </div>
      {menue && <Kontextmenue x={menue.x} y={menue.y} titel={`${zeileName(d, menue.e)} · ${monatLabel(d, menue.m)}`} eintraege={menueEintraege()} onZu={() => setMenue(null)} />}
      {notiz && (
        <Dialog titel={`Notiz · ${zeileName(d, notiz.e)} · ${monatLabel(d, notiz.m)}`} onZu={() => setNotiz(null)} aktionen={<><KnopfKlein onClick={() => setNotiz(null)} farbe={C.inkDim}>Abbrechen</KnopfKlein><Knopf onClick={notizSpeichern}>Speichern</Knopf></>}>
          <textarea autoFocus rows={4} value={notiz.text} onChange={e => setNotiz(n => (n ? { ...n, text: e.target.value } : n))} aria-label="Notiz" style={{ ...feld, resize: 'vertical' }} />
        </Dialog>
      )}
    </div>
  );
}
