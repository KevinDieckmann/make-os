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
import { mitBereich, bereichEigen, type Bereich } from '@/lib/finanzen/szenarien';
import { nettoTabellePlatzhalter } from '@/lib/finanzen/plan/operationen';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { FinanzplanKontext, useFinanzplanDaten, useGerechnet, type PlanKontext } from './daten';
import { Meldungen, PersonMarke, personName, Auswahl } from './teile';
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

/**
 * `bereich`: Privat oder Business (aus der Adresse) — wählt NUR das eigene Szenario, die eigene Ansicht und die eigenen Kennzahlen.
 * Welche Daten kommen, entscheidet der Server aus dem Konto (`sicht`): der Haushalt des Inhabers sieht in beiden Bereichen alles
 * (Kevin 04.10. spät: „im Business meine Planung haben … immer sehen können — das ist der USP“). `eingebettet`: als Reiter in Finanzen.
 */
export function Finanzplan({ bereich = 'privat', eingebettet = false }: { bereich?: Bereich; eingebettet?: boolean }) {
  return <Suspense fallback={null}><FinanzplanInnen bereich={bereich} eingebettet={eingebettet} /></Suspense>;
}

function FinanzplanInnen({ bereich, eingebettet }: { bereich: Bereich; eingebettet: boolean }) {
  const router = useRouter(); const pfad = usePathname() ?? '/os/finanzen'; const params = useSearchParams();
  const { dokument: roh, zustand, person, sicht, laden, aendern, rueckgaengig, undoAnzahl, meldungen, melde, weg, gespeichert, verbergen, setVerbergen } = useFinanzplanDaten(bereich);
  // Das Dokument, wie dieser Bereich es sieht: sein eigenes Planszenario als Arbeitsplan (ohne eigene Wahl: der gemeinsame).
  const d = useMemo(() => (roh ? mitBereich(roh, bereich) : null), [roh, bereich]);
  const eigen = !!roh && bereichEigen(roh, bereich);
  const g = useGerechnet(d);
  const u: Unterseite = unterseiteFuer(params.get('u'), sicht);
  const reiter = bereichVon(u);
  const bereiche = bereicheFuer(sicht);

  const geh = useCallback((ziel: Unterseite, extra?: Record<string, string | number | undefined>) => {
    const z = unterseiteFuer(ziel, sicht);
    // Eingebettet: Reiter und Bereich der Finanzen-Seite bleiben in der Adresse (s=finanzplanung&space=…).
    if (eingebettet || pfad.startsWith('/os/finanzen')) { router.push(finanzplanAdresse(bereich, { u: z, ...(extra ?? {}) }), { scroll: false }); return; }
    const q = new URLSearchParams(); q.set('u', z);
    for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined && v !== '') q.set(k, String(v));
    router.push(`${pfad}?${q.toString()}`, { scroll: false });
  }, [router, pfad, sicht, bereich, eingebettet]);

  // Hat der Bereich ein eigenes Planszenario, gehört „Arbeitsplan setzen“ zu diesem Bereich (/bereiche/<b>/arbeitsplan), nicht zum gemeinsamen.
  // Business IMMER (05.10. spät): der gemeinsame Arbeitsplan gilt auch für Privat — der Server lehnt /arbeitsplan aus Business ab.
  const aendere = useCallback(async (ops: Operation[], feld: string) => {
    const umgelenkt = eigen || bereich === 'business' ? ops.map(o => (o.pfad === '/arbeitsplan' ? { ...o, pfad: `/bereiche/${bereich}/arbeitsplan`, ...(o.neu === undefined ? { neu: null } : {}) } : o)) : ops;
    const ok = await aendern(umgelenkt, feld); if (ok) gespeichert(feld); return ok;
  }, [aendern, gespeichert, eigen, bereich]);

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

  const kontext = useMemo<PlanKontext | null>(() => (d && g ? { d, ...g, sicht, bereich, person, verbergen, aendere, melde, geh, params } : null), [d, g, sicht, bereich, person, verbergen, aendere, melde, geh, params]);

  const titel = bereich === 'business' ? 'Finanzplanung Business' : 'Finanzplanung';
  if (zustand === 'laedt') { const l = <div style={{ color: C.inkDim, fontSize: TYP.bedien }} role="status">Lädt …</div>; return eingebettet ? l : <Seite titel={titel}>{l}</Seite>; }
  // Einrichten (Startbestand hochladen, ersetzen) nur in der Privat-Sicht — die Business-Sicht darf nie das ganze Dokument schreiben.
  if (sicht === 'business' && zustand === 'leer') return <div style={{ color: C.inkDim, fontSize: TYP.bedien }} role="status">Noch keine Finanzplanung — eingerichtet wird sie unter Finanzen › Privat › Finanzplanung.</div>;
  if (!d || !g || !kontext) return <Einrichtung zustand={zustand === 'kein' ? 'kein' : zustand === 'fehler' ? 'fehler' : 'leer'} onFertig={() => void laden()} />;

  // Lage je Bereich: Business mit den Business-Kennzahlen (MAKE frei, Runway, Tiefpunkt), Privat mit den privaten.
  const Ansicht = (bereich === 'business' || sicht === 'business') && u === 'lage' ? LageBusiness : ANSICHT[u];
  const offen = offeneBuchungen(d), faellig = faelligeZahl(d);
  const reiterInfo = bereiche.find(b => b.id === reiter) ?? bereiche[0];

  // Szenario dieses Bereichs: gemeinsam (wie der andere Bereich) oder ein eigenes (auch „Basis“ = reiner Treiber).
  const anderer = bereich === 'business' ? 'Privat' : 'Business';
  const gemeinsamName = roh?.arbeitsplan ? (roh.planszenarien ?? []).find(p => p.id === roh.arbeitsplan)?.name ?? 'Basis' : 'Basis';
  const wahlWert = !eigen ? '__gemeinsam' : roh?.bereiche?.[bereich]?.arbeitsplan ?? '__basis';
  const waehle = (v: string) => {
    if (!roh || v === wahlWert) return;
    if (v === '__gemeinsam') { void aendere([{ pfad: `/bereiche/${bereich}`, alt: roh.bereiche?.[bereich] }], `Bereich ${bereich === 'business' ? 'Business' : 'Privat'}: gemeinsames Szenario`); return; }
    const neu = v === '__basis' ? null : v;
    void aendere([{ pfad: `/bereiche/${bereich}`, alt: roh.bereiche?.[bereich], neu: { arbeitsplan: neu } }], `Bereich ${bereich === 'business' ? 'Business' : 'Privat'}: rechnet ${neu ? (roh.planszenarien ?? []).find(p => p.id === neu)?.name : 'Basis'}`);
  };
  const szenarioWahl = (
    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
      {bereich === 'business' ? 'Business rechnet' : 'Privat rechnet'}
      <Auswahl<string> wert={wahlWert} onWahl={waehle} titel={`Szenario des Bereichs ${bereich === 'business' ? 'Business' : 'Privat'}`}
        optionen={[{ id: '__gemeinsam', label: `gemeinsamer Arbeitsplan (${gemeinsamName})${sicht !== 'business' && roh && !bereichEigen(roh, bereich === 'business' ? 'privat' : 'business') ? ` — wie ${anderer}` : ''}` }, { id: '__basis', label: 'eigenes: Basis (nur Treiber)' }, ...(roh?.planszenarien ?? []).map(p => ({ id: p.id, label: `eigenes: ${p.name}` }))]} />
    </label>
  );

  const unter = <span>Stand {datumLang(d.stand.slice(0, 10))} · {g.ps ? <>Arbeitsplan <b style={{ color: C.ink }}>{g.ps.name}</b> auf Treiber <b style={{ color: C.ink }}>{g.sz.name}</b></> : <>Treiber <b style={{ color: C.ink }}>{g.sz.name}</b> · {eigen ? 'Basis' : 'noch kein Arbeitsplan'}</>}{eigen && <> · eigenes Szenario für {bereich === 'business' ? 'Business' : 'Privat'}</>}{sicht === 'privat' && nettoTabellePlatzhalter(d) && <span style={{ color: LEUCHT.achtung }}> · Netto-Tabelle fehlt (Netto = Brutto)</span>}{sicht === 'business' && <> · nur Business</>}</span>;
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{szenarioWahl}</div>
        <nav aria-label="Finanzplanung" className="ui-reiter-zeile">
          <Reiter ariaLabel="Bereiche der Finanzplanung" liste={bereiche.map(b => ({ id: b.id, label: b.id === 'buchungen' && offen + faellig > 0 ? <>{b.label}<span className="fp-zaehler" aria-label={`${offen + faellig} offen`}>{offen + faellig}</span></> : b.label }))} aktiv={reiter} onWahl={b => geh(bereiche.find(x => x.id === b)!.unter[0].id)} />
        </nav>
        {reiterInfo.unter.length > 1 && <Pillen einzeilig liste={reiterInfo.unter} aktiv={u} onWahl={geh} />}
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{(sicht === 'business' && FRAGE_BUSINESS[u]) || (bereich === 'business' && u === 'lage' && FRAGE_BUSINESS.lage) || FRAGE[u]}</div>
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
