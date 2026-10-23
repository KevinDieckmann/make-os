'use client';

// ─── Prozesse — das Feld neben dem Bild: Steckbrief, Phase, Schritt-Detail (Etappe A, 21.10.; ANALYSE_100.md Punkte 5, 7, 24, 27) ────────────────────
// Ebene 2 zeigt den Steckbrief (Auslöser, Eingang, Phasen, Ergebnis, Empfänger, Eigner — die Phasen nur als Zahl, das Bild daneben zeigt sie schon), Ebene 3
// die Phase mit ihren Schritten, Ebene 4 den Schritt (Form, was passiert, wer, wohin der Weg führt). Eine Information steht nur einmal je Ansicht (Punkt 24).
// „System“-Prozesse sind nur lesbar (E3) — das Feld sagt es und führt dorthin, wo der Prozess heute läuft; Vorlagen führen in den Editor bzw. ins Hochhaus.

import Link from 'next/link';
import { Cog, LayoutTemplate, SlidersHorizontal, Workflow } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Eigenschaft, Knopf, Chip, Hinweis } from '../ui';
import { FormZeichen } from '../ui/reise/ReiseBild';
import { FORM_NAME } from '@/lib/reise/bild';
import { ortVon, schrittSatz, steckbriefZeilen, zahlTexte, zahlSchluessel, systemMarke, ueberfuehrungMarke } from '@/lib/prozesse/modell';
import { einstellbar } from '@/lib/prozesse/stellschrauben';
import { tonVon } from '@/lib/prozesse/farben';
import type { ProzessDef, ProzessPhase, ProzessSchritt, Zahl } from '@/lib/prozesse/typen';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0 } as const;

/** Die Zahl mit dem Weg zu den Fällen (Punkt 27). */
function ZahlZeile({ z }: { z: Zahl | undefined }) {
  const t = zahlTexte(z);
  if (!t) return null;
  return (
    <Eigenschaft label="Fälle">
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {t.haupt && <span>{t.haupt}</span>}
        {t.zweite && <span style={{ color: t.zweite.rot ? C.kritisch : C.inkDim }}>{t.zweite.rot ? '⚠ ' : ''}{t.zweite.text}</span>}
        {z?.href && <Knopf leise href={z.href}>Fälle ansehen ›</Knopf>}
      </span>
    </Eigenschaft>
  );
}

function Marke({ p }: { p: ProzessDef }) {
  const Z = p.quelle === 'system' ? (einstellbar(p) ? SlidersHorizontal : Cog) : p.quelle === 'werkstatt' ? Workflow : LayoutTemplate;
  const w = p.werkstatt;
  const text = ueberfuehrungMarke(p) ?? (p.quelle === 'system' ? systemMarke(p) : w ? `Werkstatt · ${w.version ? `Version ${w.version}` : 'Entwurf'}` : 'Vorlage');
  return <Chip farbe={tonVon(p)}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Z size={13} aria-hidden />{text}</span></Chip>;
}

/** Ebene 2: der Steckbrief des Prozesses. */
export function SteckbriefKarte({ p, zahl }: { p: ProzessDef; zahl: Zahl | undefined }) {
  return (
    <Karte flach>
      <Ueberschrift rechts={<Marke p={p} />}>Steckbrief</Ueberschrift>
      <p style={klein}>{ortVon(p)}</p>
      {steckbriefZeilen(p, { phasenImBild: true }).map(z => <Eigenschaft key={z.id} label={z.titel}>{z.wert}</Eigenschaft>)}
      {/* Prozesse × Fulfillment (22.10.): an welchem Produkt der Prozess hängt — ein neues Mandat dieses Produkts startet ihn. */}
      {p.produkte?.length ? (
        <Eigenschaft label="Gehört zu Produkt">
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
            {p.produkte.map(x => <Link key={x.id} href={x.href} style={{ color: C.aktiv }}>{x.name} ›</Link>)}
          </span>
        </Eigenschaft>
      ) : null}
      <ZahlZeile z={zahl} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {p.link && <Knopf leise href={p.link.href}>{p.quelle === 'system' ? `Wo es läuft: ${p.link.text} ›` : `${p.link.text} ›`}</Knopf>}
      </div>
      {p.quelle === 'system' && <p style={klein}>{einstellbar(p)
        ? 'Dieser Ablauf ist im System gebaut — seine Stellschrauben stehen darunter; eigene Prozesse entstehen in der Werkstatt.'
        : 'Dieser Ablauf ist im System gebaut und hier nur zu sehen — eigene Prozesse entstehen in der Werkstatt.'}</p>}
    </Karte>
  );
}

/** Ebene 3: die Phase mit ihren Schritten (ein Tipp wählt den Schritt). */
export function PhaseKarte({ p, ph, zahlen, onSchritt }: { p: ProzessDef; ph: ProzessPhase; zahlen: Readonly<Record<string, Zahl>>; onSchritt: (id: string) => void }) {
  const nr = p.phasen.findIndex(x => x.id === ph.id) + 1;
  return (
    <Karte flach>
      <Ueberschrift rechts={<span style={klein}>{`Phase ${nr} von ${p.phasen.length}`}</span>}>{ph.titel}</Ueberschrift>
      <ZahlZeile z={zahlen[zahlSchluessel({ p: p.id, ph: ph.id })]} />
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }} aria-label={`Schritte der Phase ${ph.titel}`}>
        {ph.schritte.map(s => (
          <li key={s.id}>
            <button type="button" className="fassbar pz-feld-zeile" onClick={() => onSchritt(s.id)}>
              <FormZeichen form={s.form} />
              <span style={{ minWidth: 0, overflowWrap: 'break-word', hyphens: 'auto' }}>{s.titel}</span>
            </button>
          </li>
        ))}
      </ol>
      {ph.abstimmung && <p style={klein}>Am Ende: {ph.abstimmung}</p>}
    </Karte>
  );
}

/** Ebene 4: ein Schritt im Detail. */
export function SchrittKarte({ p, ph, s, zahl }: { p: ProzessDef; ph: ProzessPhase; s: ProzessSchritt; zahl: Zahl | undefined }) {
  const weg = schrittSatz(ph, s);
  return (
    <Karte flach>
      <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', ...klein }}><FormZeichen form={s.form} />{FORM_NAME[s.form]}</span>}>{s.titel}</Ueberschrift>
      {s.was && <Eigenschaft label="Was passiert">{s.was}</Eigenschaft>}
      {s.wer && <Eigenschaft label="Wer">{s.wer}</Eigenschaft>}
      {weg && <Eigenschaft label="Weg">{weg}</Eigenschaft>}
      <ZahlZeile z={zahl} />
      {p.editor && <Knopf leise href={p.editor}>{p.quelle === 'werkstatt' ? 'In der Werkstatt öffnen ›' : 'Im Editor öffnen ›'}</Knopf>}
      {!s.was && !s.wer && !weg && !zahl && <Hinweis art="info">Mehr steht zu diesem Schritt nicht — er gehört zur Phase „{ph.titel}“.</Hinweis>}
    </Karte>
  );
}
