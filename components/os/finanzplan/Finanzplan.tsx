'use client';

// ─── Finanzplanung jetzt — der Rahmen ────────────────────────────────────────
// Kopf: Stand, Arbeitsplan (Szenario-Baukasten) bzw. Treiber, wer plant (aus
// dem Konto — kein Umschalter), Verbergen, Rückgängig. Darunter die Blätter als
// EINE Pillenreihe und das Zahnrad (Treiber, Annahmen & Steuern); die Adresse
// trägt das Blatt (?u=…) und den Abschnitt (#…), alte Werte lösen weiter auf.
// Sprünge tragen Monat/Zeile (Buchungen) oder sz/feld (Planen).
// Cmd+Z macht die letzte Änderung rückgängig, solange kein Feld den Fokus hat.
//
// Seit 04.10. (Kevin: „Teile die Finanzplanung … bei Privat und bei Business“) ist das EINE Komponente mit `sicht`:
// eingehängt als Reiter „Planung“ (bis 08.10. „Finanzplanung“) unter Finanzen › Privat (alles, auch die Firmen) und Finanzen › Business (nur die
// Gesellschaften — das Dokument kommt schon gefiltert vom Server, lib/finanzen/plan/sicht.ts). Alte Links /os/finanzplan?… leiten
// in die Privat-Sicht weiter.
//
// 08.10. (Aufräumen Etappe 2, Kevin: „unaufgeräumt und überladen“): Finanzen hat höchstens zwei Ebenen — die Finanzplanung ist der
// Reiter „Planung“ (Ebene 1), ihre Blätter stehen in EINER Pillenreihe darunter (Ebene 2, `blaetterFuer`).
//
// 08.10. abends (Fragebogen Teil 3 Frage 10, Kevin: „Vorschlag so übernehmen“): Privat 9 Blätter, Business 6; was zusammengehört, steht als
// Abschnitt auf einer Seite (components/os/finanzplan/Blaetter.tsx); „Treiber, Annahmen & Steuern“ samt Protokoll hinter dem Zahnrad.
// Alte Adressen (?u=buchungen …) schreibt die Seite auf das neue Blatt + Abschnitt um (`blattAus`, router.replace) — Parameter bleiben.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Settings, Undo2 } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Knopf, Pillen, LEUCHT } from '../ui';
import { FRAGE, FRAGE_BUSINESS, ZAHNRAD, offeneBuchungen, faelligeZahl, datumLang, blaetterFuer, blattAus, istAbschnittId, finanzplanAdresse, type AbschnittId, type Sprung, type Unterseite } from '@/lib/finanzen/plan/hilfen';
import { mitBereich, bereichEigen, type Bereich } from '@/lib/finanzen/szenarien';
import { nettoTabellePlatzhalter } from '@/lib/finanzen/plan/operationen';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { FinanzplanKontext, useFinanzplanDaten, useGerechnet, type PlanKontext } from './daten';
import { Meldungen, PersonMarke, personName, Auswahl } from './teile';
import { Einrichtung } from './Einrichtung';
import { BlattSeite } from './Blaetter';

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
  const uRoh = params.get('u');
  const u: Unterseite = blattAus(uRoh, sicht).u;
  const blaetter = blaetterFuer(sicht);

  // Sprung zu einem Abschnitt (#buchungen): der Abschnitt klappt auf und kommt ins Bild (Blaetter.tsx). `n` zählt, damit derselbe Sprung erneut greift.
  const [anker, setAnker] = useState<{ id: AbschnittId; n: number } | null>(null);
  const springe = useCallback((id?: AbschnittId) => setAnker(a => (id ? { id, n: (a?.n ?? 0) + 1 } : null)), []);
  useEffect(() => {
    const lies = () => { const h = window.location.hash.slice(1); if (istAbschnittId(h)) springe(h); };
    window.addEventListener('hashchange', lies);
    return () => window.removeEventListener('hashchange', lies);
  }, [springe]);

  /** Adresse eines Blatts mit Parametern und Anker. Eingebettet: Reiter und Bereich der Finanzen-Seite bleiben in der Adresse (s=finanzplanung&space=…). */
  const adresse = useCallback((blatt: Unterseite, extra: URLSearchParams | Record<string, string | number | undefined>, abschnitt?: AbschnittId) => {
    const q = new URLSearchParams(extra instanceof URLSearchParams ? extra : undefined);
    if (!(extra instanceof URLSearchParams)) for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') q.set(k, String(v));
    q.set('u', blatt);
    if (eingebettet || pfad.startsWith('/os/finanzen')) return finanzplanAdresse(bereich, q, abschnitt);
    return `${pfad}?${q.toString()}${abschnitt ? `#${abschnitt}` : ''}`;
  }, [pfad, bereich, eingebettet]);

  // Blatt wechseln oder zu einem Abschnitt springen — auch mit alten Blatt-Kennungen ('buchungen' → Monat #buchungen).
  const geh = useCallback((ziel: Sprung, extra?: Record<string, string | number | undefined>) => {
    const z = blattAus(ziel, sicht);
    router.push(adresse(z.u, extra ?? {}, z.abschnitt), { scroll: false });
    springe(z.abschnitt);
  }, [router, sicht, adresse, springe]);

  // Alte Adresse (?u=<früheres Blatt>, Lesezeichen, Links von früher): auf das neue Blatt + Abschnitt umschreiben, alle Parameter bleiben.
  useEffect(() => {
    if (zustand !== 'da' || !istAbschnittId(uRoh)) return;
    const z = blattAus(uRoh, sicht);
    router.replace(adresse(z.u, new URLSearchParams(params.toString()), z.abschnitt), { scroll: false });
    springe(z.abschnitt);
  }, [zustand, uRoh, sicht, params, adresse, router, springe]);

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

  const kontext = useMemo<PlanKontext | null>(() => (d && g ? { d, ...g, sicht, bereich, person, verbergen, aendere, melde, geh, params, anker } : null), [d, g, sicht, bereich, person, verbergen, aendere, melde, geh, params, anker]);

  const titel = bereich === 'business' ? 'Finanzplanung Business' : 'Finanzplanung';
  if (zustand === 'laedt') { const l = <div style={{ color: C.inkDim, fontSize: TYP.bedien }} role="status">Lädt …</div>; return eingebettet ? l : <Seite titel={titel}>{l}</Seite>; }
  // Einrichten (Startbestand hochladen, ersetzen) nur in der Privat-Sicht — die Business-Sicht darf nie das ganze Dokument schreiben.
  if (sicht === 'business' && zustand === 'leer') return <div style={{ color: C.inkDim, fontSize: TYP.bedien }} role="status">Noch keine Finanzplanung — eingerichtet wird sie unter Finanzen › Privat › Planung.</div>;
  if (!d || !g || !kontext) return <Einrichtung zustand={zustand === 'kein' ? 'kein' : zustand === 'fehler' ? 'fehler' : 'leer'} onFertig={() => void laden()} />;

  const offen = offeneBuchungen(d), faellig = faelligeZahl(d);
  // Zähler stehen am Blatt, das sie auflöst: offene Ist-Buchungen (Monat) bzw. fällige Posten (Fällig & Schulden).
  const zaehler: Partial<Record<Unterseite, number>> = { monat: offen, faellig };
  const zahnradAn = u === ZAHNRAD.id;

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <nav aria-label="Blätter der Finanzplanung">
              <Pillen einzeilig liste={blaetter.map(b => ({ id: b.id, label: zaehler[b.id] ? `${b.label} · ${zaehler[b.id]}` : b.label }))} aktiv={zahnradAn ? null : u} onWahl={geh} />
            </nav>
          </div>
          {/* Zahnrad (Vorbild Markttraktion › Stammdaten): Treiber, Annahmen & Steuern samt Protokoll — selten gebraucht, deshalb keine eigene Pille. */}
          <Knopf leise onClick={() => geh(ZAHNRAD.id)} farbe={zahnradAn ? C.aktiv : undefined} ariaLabel={`${ZAHNRAD.label} · Protokoll`} titel={`${ZAHNRAD.label} · Protokoll`}>
            <Settings size={16} aria-hidden /><span className="ui-nur-breit">Annahmen &amp; Steuern</span>
          </Knopf>
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{zahnradAn && <b style={{ color: C.ink }}>{ZAHNRAD.label} · </b>}{(sicht === 'business' && FRAGE_BUSINESS[u]) || (bereich === 'business' && u === 'lage' && FRAGE_BUSINESS.lage) || FRAGE[u]}</div>
        <BlattSeite key={u} u={u} />
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
