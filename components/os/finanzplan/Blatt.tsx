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
//
// Handwerte (04.10., Kevin: „Jede Zahl bearbeitbar, nur die Formeln bleiben fest“): Jede Zeile mit `edit` ist bearbeitbar —
// Planzeilen wie bisher, gerechnete Zeilen (Summen, Steuern, Konto …) über ihre Kennung aus lib/finanzen/handwerte.ts. Eine
// überschriebene Zelle trägt den Strich der Person und das Kennzeichen „von Hand“ (✎); der Tooltip nennt den Formelwert und die
// Abweichung. Summen von Hand stehen zusätzlich als ruhiger Hinweis unter dem Blatt (Abweichung zur Summe der Einzelzeilen).
// Zurücksetzen auf die Formel: je Zelle (Entf, Menü), je Zeile (Menü) oder alle Handwerte des Blatts (Knopf über dem Blatt).
// Handwerte je Szenario (04.10. Nachtrag): Standard „gilt für alle Szenarien“ (`<kennung>:<monat>`); im Menü „Nur in „<Arbeitsplan>““
// (`<kennung>@<szenario>:<monat>`). Vorrang Szenario › alle › Formel; eine Zelle mit Szenario-Handwert schreibt beim Tippen dorthin.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, MIKRO, TYP, ECKE } from '@/lib/make-one/design';
import { LEUCHT, Knopf, feld } from '../ui';
import type { Zeile } from '@/lib/finanzen/rechenkern';
import { key, jahrVon, wert, sollBudget } from '@/lib/finanzen/rechenkern';
import { MAX_OPS, type Operation } from '@/lib/finanzen/plan/operationen';
import { eur, parseBetrag, zeileName, monatLabel, datumLang, alleZeilen } from '@/lib/finanzen/plan/hilfen';
import { HAND_FELDER, szenarioSchluessel } from '@/lib/finanzen/handwerte';
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
  /** Die Zeile zeigt den gespeicherten Wert mit umgekehrtem Vorzeichen (Kosten, Auszahlungen, Steuern als Minus) — Eingaben werden zurückgedreht. */
  minus?: boolean;
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

export function Blatt({ zeilen, titel, hist, extra, onZeile, onNeueZeile, onDrill, werkzeuge, abMonat }: {
  zeilen: BlattZeile[]; titel: string; hist?: boolean; extra?: ExtraSpalte[];
  onZeile?: (id: string) => void; onNeueZeile?: (liste: ZeilenListe, gruppe?: string, einheit?: Zeile['einheit']) => void; onDrill?: (histIdx: number, zeile: string) => void; werkzeuge?: ReactNode;
  /** 0-Punkt (05.10.): Plan-Monat der Eröffnung dieser Gesellschaft — Monate davor heißen „vor Eröffnung“ (gedämpft) und zählen nicht in „Plan gesamt“. */
  abMonat?: number;
}) {
  const vorEroeffnung = (m: number) => !!abMonat && m < abMonat;
  const { d, aendere, verbergen, person, formel, melde, ps, bereich = 'privat' } = usePlan();
  const [modus, setModus] = useState<Modus>('plan');
  const [jahr, setJahr] = useState<Jahr>('alle');
  const [verlauf, setVerlauf] = useState(true);
  const [zu, setZu] = useState<Record<string, boolean>>(() => Object.fromEntries(zeilen.filter((r): r is GruppenZeile => istGruppe(r) && !!r.zu).map(r => [r.grp, true])));
  const [leerZeigen, setLeerZeigen] = useState<Record<string, boolean>>({});
  // Ansicht je Bereich merken (04.10. spät, Kevin: „separat einstellbar“): Jahr, Plan/IST/Abweichung, eingeklappte Gruppen, IST-Schalter —
  // je Bereich (Privat/Business) und Blatt im Browser (nur Bequemlichkeit; ohne Speicher gilt die Vorgabe).
  const merkKey = `make-fp-ansicht:${bereich}:${titel}`;
  const geladen = useRef(false);
  useEffect(() => {
    geladen.current = false;
    try {
      const m = JSON.parse(localStorage.getItem(merkKey) ?? 'null') as { modus?: Modus; jahr?: Jahr; verlauf?: boolean; zu?: Record<string, boolean> } | null;
      if (m) {
        if (m.modus === 'plan' || m.modus === 'ist' || m.modus === 'delta') setModus(m.modus);
        if (m.jahr === 'alle' || m.jahr === '2026' || m.jahr === '2027' || m.jahr === '2028') setJahr(m.jahr);
        if (typeof m.verlauf === 'boolean') setVerlauf(m.verlauf);
        if (m.zu && typeof m.zu === 'object') setZu(m.zu);
      }
    } catch { /* ohne Speicher: Vorgabe */ }
    geladen.current = true;
  }, [merkKey]);
  useEffect(() => {
    if (!geladen.current) return;
    try { localStorage.setItem(merkKey, JSON.stringify({ modus, jahr, verlauf, zu })); } catch { /* egal */ }
  }, [merkKey, modus, jahr, verlauf, zu]);
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

  /** Name einer Zeile: gerechnete Zeilen tragen den Namen aus dem Blatt (mit den Personennamen), Planzeilen ihren eigenen. */
  const zeilenName = (e: string) => { const r = zeileVon(e); return r && (r.zelle || HAND_FELDER[e]) ? r.name : zeileName(d, e); };
  const label = (e: string, m: number) => `${modus === 'ist' ? 'IST ' : ''}${zeilenName(e)} · ${monatLabel(d, m)}`;
  const ebene = modus === 'ist' ? 'ist' : 'plan';
  const speicher = ebene === 'ist' ? d.ist : d.plan;
  /** Vorzeichen der Anzeige: gespeichert × vz = gezeigt. */
  const vz = (e: string) => (zeileVon(e)?.minus ? -1 : 1);

  /** Schlüssel des Handwerts „nur in diesem Szenario“ (nur Plan-Ebene, nur mit Arbeitsplan). */
  const szKey = (e: string, m: number): string | null => (ebene === 'plan' && ps ? szenarioSchluessel(e, ps.id, m) : null);
  /** Der Schlüssel, der in dieser Zelle gilt bzw. beschrieben wird: der Szenario-Handwert, wenn es ihn gibt, sonst der allgemeine. */
  const zielKey = (e: string, m: number): string => { const sk = szKey(e, m); return sk && sk in speicher ? sk : key(e, m); };

  /** Zelle setzen/zurücksetzen — `wert` ist der gezeigte Wert (bei Minus-Zeilen wird er zurückgedreht). */
  const setzeZelle = useCallback((e: string, m: number, wert: number | null) => {
    const eigene = zeileVon(e)?.zelle;
    if (eigene) { eigene.setze(m, wert); return; }
    const k = zielKey(e, m);
    const op: Operation = wert === null ? { pfad: `/${ebene}/${k}` } : { pfad: `/${ebene}/${k}`, neu: wert * vz(e) + 0 };
    if (wert === null && !(k in speicher)) return;
    void aendere([{ ...op, alt: speicher[k] }], label(e, m));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aendere, ebene, speicher, d, zeileVon, ps]);

  const anzeigeWert = useCallback((r: DatenZeile, m: number): number | null => {
    const k = r.edit ? key(r.edit, m) : null;
    const v = r.minus ? -1 : 1;
    if (modus === 'plan') return r.get(m);
    if (modus === 'ist') { if (k && k in d.ist) return d.ist[k] * v; return r.istGet ? r.istGet(m) : null; }
    if (k && k in d.ist) return d.ist[k] * v - r.get(m);
    return null;
  }, [modus, d.ist]);

  /**
   * Formelwert (gezeigtes Vorzeichen) einer von Hand überschriebenen Planzelle — null, wenn sie nicht überschrieben ist.
   * Gerechnete Zeilen: aus dem Kern (`formel`); Planzeilen: Sollwert der Zeile ohne Überschreibung.
   */
  const formelWert = useCallback((r: DatenZeile, m: number): number | null => {
    if (!r.edit) return null;
    const k = key(r.edit, m);
    if (!(k in d.plan) && !(ps && szenarioSchluessel(r.edit, ps.id, m) in d.plan)) return null;
    const v = r.minus ? -1 : 1;
    if (k in formel) return formel[k] * v;
    const z = alleZeilen(d).find(x => x.id === r.edit);
    if (!z) return null;
    return (d.privatBudget.includes(z) ? sollBudget(z, m, {}) : wert(z, m, {})) * v;
  }, [d, formel, ps]);

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
  /** Alle Zellen einer Ebene zurücksetzen (eine Änderung, ein Rückgängig) — über MAX_OPS hinaus lieber zeilenweise. */
  const zuruecksetzen = (keys: string[], feld: string) => {
    const ops: Operation[] = keys.filter(k => k in speicher).map(k => ({ pfad: `/${ebene}/${k}`, alt: speicher[k] }));
    if (!ops.length) return;
    if (ops.length > MAX_OPS) { melde('fehler', 'Zu viele auf einmal', `${ops.length} Zellen — höchstens ${MAX_OPS} je Schritt. Bitte zeilenweise zurücksetzen.`); return; }
    void aendere(ops, feld);
  };
  const menueEintraege = () => {
    if (!menue) return [];
    const { e, m } = menue; const r = zeileVon(e); const k = key(e, m), zk = zielKey(e, m), sk = szKey(e, m);
    const imSzenario = !!sk && zk === sk;
    const wert = zk in speicher ? speicher[zk] : r ? (anzeigeWert(r, m) ?? 0) * vz(e) : 0;
    // Fortschreiben im selben Geltungsbereich wie die Zelle (Szenario oder alle).
    const fort = (bis: number) => {
      const ops: Operation[] = []; for (let i = m; i <= bis; i++) { const t = imSzenario && ps ? szenarioSchluessel(e, ps.id, i) : key(e, i); ops.push({ pfad: `/${ebene}/${t}`, alt: speicher[t], neu: wert }); }
      void aendere(ops, `${zeilenName(e)} ab ${monatLabel(d, m)} bis ${monatLabel(d, bis)}${imSzenario && ps ? ` (nur ${ps.name})` : ''}`);
    };
    // Zurücksetzen nimmt beide Geltungsbereiche dieser Zeile (allgemein und dieses Szenario).
    const zeileKeys = (von: number) => d.monate.map((_, i) => i + 1).filter(i => i >= von).flatMap(i => [key(e, i), ...(ps && ebene === 'plan' ? [szenarioSchluessel(e, ps.id, i)] : [])]);
    const fw = r ? formelWert(r, m) : null;
    const szenarioEintraege = ebene === 'plan' && ps && !r?.zelle ? (imSzenario
      ? [{ label: `Für alle Szenarien statt nur in „${ps.name}“`, tun: () => void aendere([{ pfad: `/plan/${k}`, alt: speicher[k], neu: speicher[sk!] }, { pfad: `/plan/${sk}`, alt: speicher[sk!] }], `${label(e, m)} gilt für alle Szenarien`) },
        { label: `Handwert nur in „${ps.name}“ entfernen${k in speicher ? ' (dann gilt der für alle)' : ''}`, tun: () => void aendere([{ pfad: `/plan/${sk}`, alt: speicher[sk!] }], `${label(e, m)} · Szenario-Handwert entfernt`) }]
      : [{ label: `Diesen Wert nur in „${ps.name}“`, tun: () => void aendere([{ pfad: `/plan/${sk}`, alt: speicher[sk!], neu: wert }], `${label(e, m)} (nur ${ps.name})`) }])
      : [];
    return [
      { label: 'Wert ab hier für alle Folgemonate', tun: () => fort(d.monate.length) },
      { label: 'Wert für die nächsten 12 Monate', tun: () => fort(Math.min(d.monate.length, m + 11)) },
      ...szenarioEintraege,
      { label: fw != null ? `Auf Formel zurücksetzen (${eur(fw)} €)` : 'Auf Formel zurücksetzen', tun: () => zuruecksetzen([k, ...(sk ? [sk] : [])], `${label(e, m)} auf Formel zurückgesetzt`), aus: !(k in speicher) && !imSzenario },
      { label: 'Ab hier alle auf Formel zurücksetzen', tun: () => zuruecksetzen(zeileKeys(m), `${zeilenName(e)} ab ${monatLabel(d, m)} auf Formel zurückgesetzt`), aus: !zeileKeys(m).some(x => x in speicher) },
      { label: 'Ganze Zeile auf Formel zurücksetzen', tun: () => zuruecksetzen(zeileKeys(1), `${zeilenName(e)} auf Formel zurückgesetzt`), aus: !zeileKeys(1).some(x => x in speicher) },
      { label: d.notizen[k] ? 'Notiz bearbeiten' : 'Notiz hinzufügen', tun: () => setNotiz({ e, m, text: d.notizen[k] ?? '' }) },
    ];
  };
  const notizSpeichern = () => {
    if (!notiz) return; const k = key(notiz.e, notiz.m); const t = notiz.text.trim();
    setNotiz(null);
    if (t === (d.notizen[k] ?? '')) return;
    void aendere([t ? { pfad: `/notizen/${k}`, alt: d.notizen[k], neu: t } : { pfad: `/notizen/${k}`, alt: d.notizen[k] }], `Notiz ${zeilenName(notiz.e)} · ${monatLabel(d, notiz.m)}`);
  };

  const geldStil: CSSProperties = verbergen ? { filter: 'blur(6px)', userSelect: 'none' } : {};
  const zellStil = (extraStil?: CSSProperties): CSSProperties => ({ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: SCHRIFT.display, fontSize: TYP.bedien, minWidth: ZELLE_MIN, whiteSpace: 'nowrap', borderBottom: `1px solid ${HAAR}`, position: 'relative', ...extraStil });
  const kopfStil: CSSProperties = { ...MIKRO, fontSize: 11, padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: C.flaeche, zIndex: 2, borderBottom: `1px solid ${HAAR}` };
  const nameStil: CSSProperties = { position: 'sticky', left: 0, background: C.flaeche, zIndex: 1, padding: '5px 10px 5px 4px', fontSize: TYP.bedien, whiteSpace: 'nowrap', textAlign: 'left', borderBottom: `1px solid ${HAAR}`, minWidth: 'min(150px, 36vw)' };
  // Breite der Namensspalte begrenzen (04.10.): `max-width` greift an Tabellenzellen nicht — ohne Innen-Span wurde die Spalte am Handy
  // so breit wie der längste Name (oder der Titel) und deckte die Zahlen zu. Der volle Name steht im Tooltip.
  const nameText: CSSProperties = { display: 'block', maxWidth: 'min(240px, 40vw)', overflow: 'hidden', textOverflow: 'ellipsis' };

  // Handwerte dieses Blatts (Plan-Ebene): alle überschriebenen Zellen der Zeilen mit `edit`, und die Summen mit Abweichung.
  const blattKeys: string[] = [];
  const summenHinweise: { name: string; m: number; hand: number; formel: number }[] = [];
  for (const r of zeilen) {
    if (istGruppe(r) || !r.edit) continue;
    for (let m = 1; m <= d.monate.length; m++) {
      const k = key(r.edit, m), sk = ps ? szenarioSchluessel(r.edit, ps.id, m) : null;
      if (sk && sk in d.plan) blattKeys.push(sk);
      if (!(k in d.plan) && !(sk && sk in d.plan)) continue;
      if (k in d.plan) blattKeys.push(k);
      const fw = formelWert(r, m);
      if (r.sum && fw != null && Math.abs(r.get(m) - fw) > 0.005 && planMonate.includes(m)) summenHinweise.push({ name: r.name, m, hand: r.get(m), formel: fw });
    }
  }
  const handZahl = blattKeys.length;

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
        <td style={{ ...nameStil, whiteSpace: 'normal', paddingLeft: 16, color: C.inkLeise, cursor: 'pointer' }} onClick={() => setLeerZeigen(z => ({ ...z, [g]: !z[g] }))} title={v ? 'Alle Werte sind 0 — anklicken zeigt sie' : 'Nullzeilen wieder verbergen'}>
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
          <td style={{ ...nameStil, ...MIKRO, whiteSpace: 'normal', paddingTop: 12, cursor: 'pointer' }} onClick={() => setZu(z => ({ ...z, [r.grp]: !z[r.grp] }))}>
            <span style={{ marginRight: 6 }}>{zuG ? '▸' : '▾'}</span>{r.grp}
            {r.add && onNeueZeile && <button type="button" onClick={e => { e.stopPropagation(); onNeueZeile(r.add!, r.addG, r.addE); }} style={{ marginLeft: 10, background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, textTransform: 'none', letterSpacing: 0, padding: 0 }}>+ Zeile</button>}
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
      const skZ = r.edit && modus === 'plan' && ps ? szenarioSchluessel(r.edit, ps.id, m) : null;
      const szHand = !!skZ && skZ in d.plan;
      const ueberschrieben = r.zelle ? modus === 'plan' && r.zelle.ueber(m) : (!!k && modus !== 'delta' && k in speicher) || szHand;
      const meta = szHand ? d.meta[skZ!] : k && modus === 'plan' && k in d.plan ? d.meta[k] : undefined;
      const gewaehlt = !!eid(r) && !!sel && sel.e === eid(r) && sel.m === m;
      const bearb = !!eid(r) && !!bearbeitet && bearbeitet.e === eid(r) && bearbeitet.m === m;
      const hatNotiz = !!k && !!d.notizen[k];
      if (modus === 'plan' && v != null && !Number.isNaN(v) && !vorEroeffnung(m)) { summe += v; letzter = v; n++; }
      let farbe: string | undefined = v == null ? C.inkLeise : vorzeichenFarbe(v);
      if (modus === 'delta' && v != null) farbe = v > 0.5 ? (r.aus ? LEUCHT.kritisch : LEUCHT.gut) : v < -0.5 ? (r.aus ? LEUCHT.gut : LEUCHT.kritisch) : C.inkDim;
      const fw = modus === 'plan' && ueberschrieben ? formelWert(r, m) : null;
      const vonHand = modus === 'plan' && ueberschrieben && !r.zelle;
      const formelText = fw != null && v != null ? `Formel ${eur(fw, Number.isInteger(fw) ? 0 : 2)} € · Abweichung ${v - fw >= 0 ? '+' : '−'}${eur(Math.abs(v - fw), Number.isInteger(v - fw) ? 0 : 2)} €` : null;
      const wirkt = vonHand && r.edit && HAND_FELDER[r.edit] ? `wirkt auf: ${HAND_FELDER[r.edit].wirkt}` : null;
      const gilt = vonHand ? (szHand ? `nur in „${ps!.name}“${k! in d.plan ? ` (für alle: ${eur(d.plan[k!] * (r.minus ? -1 : 1))} €)` : ''}` : 'für alle Szenarien') : '';
      const titel = [hatNotiz ? d.notizen[k!] : null, vonHand ? `von Hand · ${gilt}${meta ? ` · ${personName(meta.wer)} · ${datumLang(meta.wann.slice(0, 10))}` : ''}` : meta ? `${personName(meta.wer)} · ${datumLang(meta.wann.slice(0, 10))}` : ueberschrieben ? 'überschrieben' : null, formelText, wirkt].filter(Boolean).join(' — ') || undefined;
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
          aria-label={vonHand ? `${r.name} · ${monatLabel(d, m)}: von Hand${formelText ? ` (${formelText})` : ''}` : undefined}
          onContextMenu={r.edit ? ev => { ev.preventDefault(); setMenue({ x: ev.clientX, y: ev.clientY, e: r.edit!, m }); } : undefined}
          onTouchStart={r.edit ? ev => { const t = ev.touches[0]; druck.current = window.setTimeout(() => setMenue({ x: t.clientX, y: t.clientY, e: r.edit!, m }), 550); } : undefined}
          onTouchEnd={() => { if (druck.current) { clearTimeout(druck.current); druck.current = null; } }}
          onTouchMove={() => { if (druck.current) { clearTimeout(druck.current); druck.current = null; } }}>
          {bearb ? (
            <input autoFocus value={bearbeitet!.text} inputMode="decimal" aria-label={label(eid(r)!, m)} onChange={ev => setBearbeitet(b => (b ? { ...b, text: ev.target.value } : b))}
              onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); uebernehme(false); } else if (ev.key === 'Tab') { ev.preventDefault(); uebernehme(true); } else if (ev.key === 'Escape') { fertigRef.current = true; setBearbeitet(null); } }}
              onBlur={() => uebernehme(false)} onFocus={ev => ev.target.select()}
              style={{ ...feld, minHeight: 32, width: Math.max(ZELLE_MIN - 4, 8 * bearbeitet!.text.length + 20), padding: '2px 6px', borderRadius: 6, fontSize: TYP.bedien, textAlign: 'right', fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', border: `1px solid ${C.aktiv}` }} />
          ) : <span style={geldStil}>{v == null ? (modus === 'plan' ? '' : '·') : eur(v)}</span>}
          {hatNotiz && !bearb && <span aria-hidden style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: LEUCHT.business }} />}
          {vonHand && !bearb && <span aria-hidden title={szHand ? 'von Hand, nur in diesem Szenario' : 'von Hand'} style={{ position: 'absolute', top: 0, left: 3, fontSize: TYP.bedien, lineHeight: 1, color: szHand ? C.aktiv : LEUCHT.achtung, fontFamily: SCHRIFT.text }}>✎</span>}
        </td>
      );
    });
    const summeWert = n ? (r.stock ? letzter : summe) : null;
    koerper.push(
      <tr key={eid(r) ?? r.name} style={{ background: r.sum ? 'rgba(255,255,255,.025)' : undefined }}>
        <td style={{ ...nameStil, paddingLeft: r.ind ? 16 : 4, fontWeight: r.sum || r.key ? 700 : 500, color: r.key ? C.aktiv : C.ink }}>
          <span style={nameText} title={r.name}>{r.zeile && onZeile ? <button type="button" onClick={() => onZeile(r.zeile!)} title="Zeile bearbeiten" style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', borderBottom: `1px dotted ${C.inkLeise}`, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</button> : r.name}</span>
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
        {modus === 'plan' && handZahl > 0 && (
          <button type="button" onClick={() => zuruecksetzen(blattKeys, `${titel}: alle Handwerte auf Formel zurückgesetzt`)} title="Alle von Hand überschriebenen Zahlen dieses Blatts auf die Formel zurücksetzen (Rückgängig mit Cmd+Z)"
            style={{ background: 'none', border: `1px solid ${LEUCHT.achtung}55`, borderRadius: 999, color: LEUCHT.achtung, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '4px 10px' }}>
            ✎ {handZahl} von Hand · alle auf Formel
          </button>
        )}
        <span style={{ flex: 1 }} />
        <Legende eintraege={[{ farbe: LILA, text: 'IST' }, { farbe: LEUCHT.achtung, text: '✎ von Hand' }, ...(ps ? [{ farbe: C.aktiv, text: '✎ nur dieses Szenario' }] : []), { farbe: LEUCHT.business, text: 'Notiz' }, { farbe: personFarbe('kevin'), text: personName('kevin') }, { farbe: personFarbe('malin'), text: personName('malin') }]} />
      </div>
      <div className="ui-tabelle" tabIndex={0} role="region" aria-label={`${titel}, Monate als Spalten — seitwärts wischbar`} style={{ overflow: 'auto', maxHeight: '72vh', borderRadius: ECKE.eingabe, background: C.flaeche }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', color: C.ink, fontFamily: SCHRIFT.text }}>
          <thead>
            <tr>
              <th style={{ ...kopfStil, textAlign: 'left', left: 0, zIndex: 3, paddingLeft: 4 }}><span style={nameText} title={titel}>{titel}</span></th>
              {extra?.map((x, i) => <th key={`x${i}`} title={x.t} style={kopfStil}>{x.h}</th>)}
              {spalten.map((c, j) => <th key={c.h ? `h${c.i}` : `m${c.m}`} title={!c.h && vorEroeffnung(c.m) ? 'vor Eröffnung — zählt nicht in „Plan gesamt“ (0-Punkt unter Zahlen › Business)' : undefined} style={{ ...kopfStil, color: c.h ? LILA : j === erstPlan && erstPlan > 0 ? C.aktiv : C.inkLeise, ...(!c.h && vorEroeffnung(c.m) ? { opacity: 0.55 } : {}) }}>{c.label}{!c.h && vorEroeffnung(c.m) ? <span style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>vor Eröffnung</span> : null}{!c.h && abMonat === c.m ? <span style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: LEUCHT.business }}>0-Punkt</span> : null}</th>)}
              <th style={kopfStil}>{jahr === 'alle' ? 'Plan gesamt' : `Plan ${jahr}`}</th>
            </tr>
          </thead>
          <tbody>{koerper}</tbody>
        </table>
      </div>
      {modus === 'plan' && summenHinweise.length > 0 && (
        <div role="note" style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8, lineHeight: 1.5, padding: '8px 10px', borderRadius: 10, background: `${LEUCHT.achtung}0D`, boxShadow: `inset 3px 0 0 ${LEUCHT.achtung}66` }}>
          <b style={{ color: LEUCHT.achtung, fontWeight: 600 }}>Summe von Hand</b> — gilt so; die Einzelzeilen ergeben etwas anderes:
          {summenHinweise.slice(0, 6).map(x => (
            <div key={`${x.name}-${x.m}`} style={geldStil}>{x.name} · {monatLabel(d, x.m)}: {eur(x.hand)} € statt {eur(x.formel)} € ({x.hand - x.formel >= 0 ? '+' : '−'}{eur(Math.abs(x.hand - x.formel))} €)</div>
          ))}
          {summenHinweise.length > 6 && <div>und {summenHinweise.length - 6} weitere (Tooltip der Zelle)</div>}
        </div>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>
        Jede Zahl ist bearbeitbar: Zelle anklicken oder Ziffer tippen · Enter übernimmt · Tab weiter · Pfeile bewegen · Entf setzt auf die Formel zurück · Rechtsklick oder langer Druck: fortschreiben, zurücksetzen (Zelle, Zeile), Notiz. ✎ = von Hand, die Formel bleibt im Hintergrund.
        {person && <> Änderungen laufen unter <b style={{ color: personFarbe(person) }}>{personName(person)}</b>.</>}
      </div>
      {menue && <Kontextmenue x={menue.x} y={menue.y} titel={`${zeilenName(menue.e)} · ${monatLabel(d, menue.m)}`} eintraege={menueEintraege()} onZu={() => setMenue(null)} />}
      {notiz && (
        <Dialog titel={`Notiz · ${zeilenName(notiz.e)} · ${monatLabel(d, notiz.m)}`} onZu={() => setNotiz(null)} aktionen={<><KnopfKlein onClick={() => setNotiz(null)} farbe={C.inkDim}>Abbrechen</KnopfKlein><Knopf onClick={notizSpeichern}>Speichern</Knopf></>}>
          <textarea autoFocus rows={4} value={notiz.text} onChange={e => setNotiz(n => (n ? { ...n, text: e.target.value } : n))} aria-label="Notiz" style={{ ...feld, resize: 'vertical' }} />
        </Dialog>
      )}
    </div>
  );
}
