'use client';

// ─── Finanzplanung jetzt — der Rahmen ────────────────────────────────────────
// Kopf: Stand, Arbeitsplan (Szenario-Baukasten) bzw. Treiber, wer plant (aus
// dem Konto — kein Umschalter), Verbergen, Rückgängig. Darunter die acht
// Bereiche (Kevin 27.09.: Lage · Planen · Privat · Business · Gesamt ·
// Buchungen & Check · Ziele & Töpfe · Protokoll) als Leiste und die
// Unterseiten als Pillen; Adresse trägt die Unterseite (?u=…), alte Werte
// lösen weiter auf. Sprünge tragen Monat/Zeile (Buchungen) oder sz/feld (Planen).
// Cmd+Z macht die letzte Änderung rückgängig, solange kein Feld den Fokus hat.
//
// Seit 04.10. (Kevin: „Teile die Finanzplanung … bei Privat und bei Business“) ist das EINE Komponente mit `sicht`:
// eingehängt als Reiter „Finanzplanung“ unter Finanzen › Privat (alles, auch die Firmen) und Finanzen › Business (nur die
// Gesellschaften — das Dokument kommt schon gefiltert vom Server, lib/finanzen/plan/sicht.ts). Alte Links /os/finanzplan?… leiten
// in die Privat-Sicht weiter.

import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Undo2 } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Knopf, Reiter, Pillen, LEUCHT } from '../ui';
import { FRAGE, FRAGE_BUSINESS, bereichVon, offeneBuchungen, faelligeZahl, datumLang, bereicheFuer, unterseiteFuer, finanzplanAdresse, type Unterseite } from '@/lib/finanzen/plan/hilfen';
import type { PlanSicht } from '@/lib/finanzen/plan/sicht';
import { nettoTabellePlatzhalter } from '@/lib/finanzen/plan/operationen';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { FinanzplanKontext, useFinanzplanDaten, useGerechnet, type PlanKontext } from './daten';
import { Meldungen, PersonMarke, personName } from './teile';
import { Einrichtung } from './Einrichtung';
import { Lage, Check, LageBusiness } from './Ueberblick';
import { Privat, UG, Toepfe, KDV, Selbst, Szenarien, Ziele } from './Planen';
import { Budget, Buchungen } from './Monat';
import { Schulden, ZuErledigen, Kalender } from './Verpflichtungen';
import { Entwicklung, Geldfluss, Protokoll } from './Auswerten';
import { Baukasten } from './Baukasten';
import { Gesamt } from './Gesamt';

const ANSICHT: Record<Unterseite, () => JSX.Element> = {
  lage: Lage, check: Check, budget: Budget, buchungen: Buchungen,
  privat: Privat, ug: UG, toepfe: Toepfe, kdv: KDV, selbst: Selbst, szenarien: Szenarien, ziele: Ziele,
  schulden: Schulden, posten: ZuErledigen, kalender: Kalender,
  entwicklung: Entwicklung, geldfluss: Geldfluss, protokoll: Protokoll,
  planen: Baukasten, gesamt: Gesamt,
};

/** `sicht`: Privat (alles) oder Business (nur die Gesellschaften). `eingebettet`: als Reiter in Finanzen (ohne eigene Seite). */
export function Finanzplan({ sicht = 'privat', eingebettet = false }: { sicht?: PlanSicht; eingebettet?: boolean }) {
  return <Suspense fallback={null}><FinanzplanInnen sicht={sicht} eingebettet={eingebettet} /></Suspense>;
}

function FinanzplanInnen({ sicht, eingebettet }: { sicht: PlanSicht; eingebettet: boolean }) {
  const router = useRouter(); const pfad = usePathname() ?? '/os/finanzen'; const params = useSearchParams();
  const { dokument: d, zustand, person, laden, aendern, rueckgaengig, undoAnzahl, meldungen, melde, weg, gespeichert, verbergen, setVerbergen } = useFinanzplanDaten(sicht);
  const g = useGerechnet(d);
  const u: Unterseite = unterseiteFuer(params.get('u'), sicht);
  const bereich = bereichVon(u);
  const bereiche = bereicheFuer(sicht);

  const geh = useCallback((ziel: Unterseite, extra?: Record<string, string | number | undefined>) => {
    const z = unterseiteFuer(ziel, sicht);
    // Eingebettet: Reiter und Sicht der Finanzen-Seite bleiben in der Adresse (s=finanzplanung&space=…).
    if (eingebettet || pfad.startsWith('/os/finanzen')) { router.push(finanzplanAdresse(sicht, { u: z, ...(extra ?? {}) }), { scroll: false }); return; }
    const q = new URLSearchParams(); q.set('u', z);
    for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined && v !== '') q.set(k, String(v));
    router.push(`${pfad}?${q.toString()}`, { scroll: false });
  }, [router, pfad, sicht, eingebettet]);

  const aendere = useCallback(async (ops: Operation[], feld: string) => { const ok = await aendern(ops, feld); if (ok) gespeichert(feld); return ok; }, [aendern, gespeichert]);

  // Cmd+Z / Strg+Z — nur außerhalb von Feldern (dort macht der Browser sein eigenes Rückgängig).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable)) return;
      e.preventDefault(); void rueckgaengig();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [rueckgaengig]);

  const kontext = useMemo<PlanKontext | null>(() => (d && g ? { d, ...g, sicht, person, verbergen, aendere, melde, geh, params } : null), [d, g, sicht, person, verbergen, aendere, melde, geh, params]);

  const titel = sicht === 'business' ? 'Finanzplanung Business' : 'Finanzplanung';
  if (zustand === 'laedt') { const l = <div style={{ color: C.inkDim, fontSize: TYP.bedien }} role="status">Lädt …</div>; return eingebettet ? l : <Seite titel={titel}>{l}</Seite>; }
  // Einrichten (Startbestand hochladen, ersetzen) nur in der Privat-Sicht — die Business-Sicht darf nie das ganze Dokument schreiben.
  if (sicht === 'business' && zustand === 'leer') return <div style={{ color: C.inkDim, fontSize: TYP.bedien }} role="status">Noch keine Finanzplanung — eingerichtet wird sie unter Finanzen › Privat › Finanzplanung.</div>;
  if (!d || !g || !kontext) return <Einrichtung zustand={zustand === 'kein' ? 'kein' : zustand === 'fehler' ? 'fehler' : 'leer'} onFertig={() => void laden()} />;

  const Ansicht = sicht === 'business' && u === 'lage' ? LageBusiness : ANSICHT[u];
  const offen = offeneBuchungen(d), faellig = faelligeZahl(d);
  const bereichInfo = bereiche.find(b => b.id === bereich) ?? bereiche[0];

  const unter = <span>Stand {datumLang(d.stand.slice(0, 10))} · {g.ps ? <>Arbeitsplan <b style={{ color: C.ink }}>{g.ps.name}</b> auf Treiber <b style={{ color: C.ink }}>{g.sz.name}</b></> : <>Treiber <b style={{ color: C.ink }}>{g.sz.name}</b> · noch kein Arbeitsplan</>}{sicht === 'privat' && nettoTabellePlatzhalter(d) && <span style={{ color: LEUCHT.achtung }}> · Netto-Tabelle fehlt (Netto = Brutto)</span>}{sicht === 'business' && <> · nur Business</>}</span>;
  const knoepfe = <>
    <span className="ui-nur-breit" title={`Du planst als ${personName(person)}`}><PersonMarke wer={person} mitName /></span>
    <Knopf leise onClick={() => setVerbergen(!verbergen)} ariaLabel={verbergen ? 'Beträge zeigen' : 'Beträge verbergen'} farbe={verbergen ? LEUCHT.achtung : undefined} titel="Alle Beträge verwischen — für Bildschirm teilen oder Café">{verbergen ? <><Eye size={16} /><span className="ui-nur-breit">Zeigen</span></> : <><EyeOff size={16} /><span className="ui-nur-breit">Verbergen</span></>}</Knopf>
    <Knopf leise onClick={() => void rueckgaengig()} aus={!undoAnzahl} ariaLabel="Letzte Änderung rückgängig" titel="Letzte Änderung zurücknehmen (Cmd+Z)"><Undo2 size={16} /><span className="ui-nur-breit">Rückgängig{undoAnzahl ? ` (${undoAnzahl})` : ''}</span></Knopf>
  </>;
  const inhalt = (
    // minWidth 0: die Seite ist ein Raster mit einer Spalte — ohne das zieht die breite Reiterleiste die ganze Seite über das Handy hinaus
    <div style={{ minWidth: 0 }}>
      <div className="ui-karten">
        {eingebettet && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}><div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{unter}</div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{knoepfe}</div></div>}
        <nav aria-label="Finanzplanung" className="ui-reiter-zeile">
          <Reiter ariaLabel="Bereiche der Finanzplanung" liste={bereiche.map(b => ({ id: b.id, label: b.id === 'buchungen' && offen + faellig > 0 ? <>{b.label}<span className="fp-zaehler" aria-label={`${offen + faellig} offen`}>{offen + faellig}</span></> : b.label }))} aktiv={bereich} onWahl={b => geh(bereiche.find(x => x.id === b)!.unter[0].id)} />
        </nav>
        {bereichInfo.unter.length > 1 && <Pillen einzeilig liste={bereichInfo.unter} aktiv={u} onWahl={geh} />}
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{(sicht === 'business' && FRAGE_BUSINESS[u]) || FRAGE[u]}</div>
        <Ansicht />
      </div>
    </div>
  );

  return (
    <FinanzplanKontext.Provider value={kontext}>
      {eingebettet ? inhalt : <Seite titel={titel} unter={unter} rechts={knoepfe}>{inhalt}</Seite>}
      <Meldungen liste={meldungen} weg={weg} />
    </FinanzplanKontext.Provider>
  );
}
