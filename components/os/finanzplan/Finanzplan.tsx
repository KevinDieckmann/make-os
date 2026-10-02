'use client';

// ─── Finanzplanung jetzt — der Rahmen ────────────────────────────────────────
// Kopf: Stand, Arbeitsplan (Szenario-Baukasten) bzw. Treiber, wer plant (aus
// dem Konto — kein Umschalter), Verbergen, Rückgängig. Darunter die acht
// Bereiche (Kevin 27.09.: Lage · Planen · Privat · Business · Gesamt ·
// Buchungen & Check · Ziele & Töpfe · Protokoll) als Leiste und die
// Unterseiten als Pillen; Adresse trägt die Unterseite (?u=…), alte Werte
// lösen weiter auf. Sprünge tragen Monat/Zeile (Buchungen) oder sz/feld (Planen).
// Cmd+Z macht die letzte Änderung rückgängig, solange kein Feld den Fokus hat.

import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Undo2 } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, LEUCHT } from '../schlank';
import { BEREICHE, FRAGE, bereichVon, istUnterseite, offeneBuchungen, faelligeZahl, datumLang, type Unterseite } from '@/lib/finanzen/plan/hilfen';
import { nettoTabellePlatzhalter } from '@/lib/finanzen/plan/operationen';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { FinanzplanKontext, useFinanzplanDaten, useGerechnet, type PlanKontext } from './daten';
import { Meldungen, KnopfKlein, PersonMarke, personName, BereichLeiste, Pillen } from './teile';
import { Einrichtung } from './Einrichtung';
import { Lage, Check } from './Ueberblick';
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

export function Finanzplan() {
  return <Suspense fallback={null}><FinanzplanInnen /></Suspense>;
}

function FinanzplanInnen() {
  const router = useRouter(); const pfad = usePathname() ?? '/os/finanzplan'; const params = useSearchParams();
  const { dokument: d, zustand, person, laden, aendern, rueckgaengig, undoAnzahl, meldungen, melde, weg, gespeichert, verbergen, setVerbergen } = useFinanzplanDaten();
  const g = useGerechnet(d);
  const uRoh = params.get('u');
  const u: Unterseite = istUnterseite(uRoh) ? uRoh : 'lage';
  const bereich = bereichVon(u);

  const geh = useCallback((ziel: Unterseite, extra?: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams(); q.set('u', ziel);
    for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined && v !== '') q.set(k, String(v));
    router.push(`${pfad}?${q.toString()}`, { scroll: false });
  }, [router, pfad]);

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

  const kontext = useMemo<PlanKontext | null>(() => (d && g ? { d, ...g, person, verbergen, aendere, melde, geh, params } : null), [d, g, person, verbergen, aendere, melde, geh, params]);

  if (zustand === 'laedt') return <Seite titel="Finanzplanung jetzt"><div style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Lädt …</div></Seite>;
  if (!d || !g || !kontext) return <Einrichtung zustand={zustand === 'kein' ? 'kein' : zustand === 'fehler' ? 'fehler' : 'leer'} onFertig={() => void laden()} />;

  const Ansicht = ANSICHT[u];
  const offen = offeneBuchungen(d), faellig = faelligeZahl(d);
  const bereichInfo = BEREICHE.find(b => b.id === bereich)!;

  return (
    <FinanzplanKontext.Provider value={kontext}>
      <Seite titel="Finanzplanung jetzt"
        unter={<span>Stand {datumLang(d.stand.slice(0, 10))} · {g.ps ? <>Arbeitsplan <b style={{ color: C.ink }}>{g.ps.name}</b> auf Treiber <b style={{ color: C.ink }}>{g.sz.name}</b></> : <>Treiber <b style={{ color: C.ink }}>{g.sz.name}</b> · noch kein Arbeitsplan</>}{nettoTabellePlatzhalter(d) && <span style={{ color: LEUCHT.achtung }}> · Netto-Tabelle fehlt (Netto = Brutto)</span>}</span>}
        rechts={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span title={`Du planst als ${personName(person)}`}><PersonMarke wer={person} mitName /></span>
            <KnopfKlein onClick={() => setVerbergen(!verbergen)} farbe={verbergen ? LEUCHT.achtung : C.inkDim} titel="Alle Beträge verwischen — für Bildschirm teilen oder Café">{verbergen ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Eye size={14} /> Zeigen</span> : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><EyeOff size={14} /> Verbergen</span>}</KnopfKlein>
            <KnopfKlein onClick={() => void rueckgaengig()} aus={!undoAnzahl} titel="Letzte Änderung zurücknehmen (Cmd+Z)"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Undo2 size={14} /> Rückgängig{undoAnzahl ? ` (${undoAnzahl})` : ''}</span></KnopfKlein>
          </div>
        }>
        {/* minWidth 0: die Seite ist ein Raster mit einer Spalte — ohne das zieht die breite Reiterleiste die ganze Seite über das Handy hinaus */}
        <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <BereichLeiste liste={BEREICHE.map(b => ({ id: b.id, label: b.label, zahl: b.id === 'buchungen' ? offen + faellig : 0 }))} aktiv={bereich} onWahl={b => geh(BEREICHE.find(x => x.id === b)!.unter[0].id)} />
        </div>
        {bereichInfo.unter.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <Pillen liste={bereichInfo.unter} aktiv={u} onWahl={geh} />
          </div>
        )}
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '0 0 14px' }}>{FRAGE[u]}</div>
        <Ansicht />
        </div>
      </Seite>
      <Meldungen liste={meldungen} weg={weg} />
    </FinanzplanKontext.Provider>
  );
}
