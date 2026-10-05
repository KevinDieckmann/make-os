'use client';

// ─── Finanzplanung jetzt — Annahmen und Schwellen als Eingabefelder ──────────
// Jede Annahme des Rechenkerns, die man eintragen kann, ist hier (oder in „Welche Steuern gelten?“) ein Feld —
// gruppiert nach Gesellschaft, Enter speichert, jede Änderung geht über den Schreibweg (Stand/409, Protokoll, Rückgängig).
// Ampel-Schwellen (Runway, frei verfügbar, Luft …) stehen ebenfalls als Felder da; leer = die bisherige Vorgabe.

import type { ReactNode } from 'react';
import { FARBE as C, MIKRO, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift } from '../ui';
import { finanzOrtName, GESELLSCHAFTEN, type Gesellschaftskennung } from '@/lib/einheiten';
import { annahmeGruppen, type AnnahmeFeld } from '@/lib/finanzen/annahmen-felder';
import { SCHWELLEN_FELDER, SCHWELLEN_VORGABE, schwellenVon, type Schwellen } from '@/lib/finanzen/schwellen';
import { eur } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { ZahlFeld, MonatWahl, Hinweis, KnopfKlein, personName, eingabeStil } from './teile';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { datumLang } from '@/lib/finanzen/plan/hilfen';
import { ProzentFeld } from './Steuern';

export function FeldK({ label, children, breit }: { label: string; children: ReactNode; breit?: number }) {
  return <label style={{ display: 'grid', gap: 3, minWidth: 0, ...(breit ? { flex: `1 1 ${breit}px` } : {}) }}><span style={{ ...MIKRO, fontSize: 11 }}>{label}</span>{children}</label>;
}

/** Annahmen einer Gesellschaft — null, wenn sie keine hat. */
export function AnnahmenKarte({ ort, i = 5 }: { ort: Gesellschaftskennung; i?: number }) {
  const { d, aendere } = usePlan();
  const gruppen = annahmeGruppen(personName('kevin'), personName('malin')).filter(g => g.ort === ort);
  if (!gruppen.length) return null;
  const feld = (f: AnnahmeFeld) => {
    const v = (d.annahmen as unknown as Record<string, number | undefined>)[f.k] ?? 0;
    const speichere = (x: number | null) => void aendere([{ pfad: `/annahmen/${f.k}`, alt: v, neu: x ?? 0 }], `Annahme ${f.label}`);
    return (
      <FeldK key={f.k} label={f.label} breit={170}>
        {f.art === 'anteil' ? <ProzentFeld wert={v} titel={f.label} breite="100%" onFertig={x => speichere(x)} />
          : f.art === 'monat' ? <MonatWahl wert={v} aus onWahl={m => speichere(m)} monate={d.monate} breite={150} />
            : <ZahlFeld wert={v} dezimal={f.dezimal} breite="100%" titel={f.label} onFertig={speichere} />}
        {f.hinweis && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.4 }}>{f.hinweis}</span>}
      </FeldK>
    );
  };
  return (
    <Karte i={i}>
      <Ueberschrift>Annahmen — {finanzOrtName(ort)}</Ueberschrift>
      {gruppen.map(g => (
        <div key={g.id} style={{ marginBottom: 12 }}>
          <div style={{ ...MIKRO, marginBottom: 6 }}>{g.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{g.felder.map(feld)}</div>
        </div>
      ))}
      <Hinweis>Monate zählen ab dem ersten Planmonat = 1; „aus“ (0) heißt: nicht in Kraft. Gilt für alle Szenarien; ein Szenario kann Gehälter unter „Szenarien bauen“ überschreiben.</Hinweis>
    </Karte>
  );
}

/** Alle Annahmen aller Gesellschaften nacheinander. */
export function AnnahmenAlle({ i = 3 }: { i?: number }) {
  const { sicht } = usePlan();
  // Business-Sicht (05.10.): nur die Gesellschaften — die Selbstständigkeit gehört zu Privat.
  const orte = sicht === 'business' ? GESELLSCHAFTEN.filter(o => o !== 'kdc') : GESELLSCHAFTEN;
  return <>{orte.map((o, k) => <AnnahmenKarte key={o} ort={o} i={i + k} />)}</>;
}

/** Eigene Ampel-Schwellen — leer = Vorgabe. */
export function SchwellenKarte({ i = 8 }: { i?: number }) {
  const { d, aendere } = usePlan();
  const sw = schwellenVon(d);
  const eigene = Object.keys(d.schwellen ?? {}).length > 0;
  const speichere = (k: keyof Schwellen, v: number | null, label: string) => {
    const alt = d.schwellen?.[k];
    if (v == null) { if (alt !== undefined) void aendere([{ pfad: `/schwellen/${k}`, alt }], `Schwelle ${label} zurückgesetzt`); return; }
    void aendere([{ pfad: `/schwellen/${k}`, alt, neu: v }], `Schwelle ${label}`);
  };
  return (
    <Karte i={i}>
      <Ueberschrift rechts={eigene ? <KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: '/schwellen', alt: d.schwellen }], 'Schwellen auf die Vorgabe zurückgesetzt')}>Alle auf Vorgabe</KnopfKlein> : undefined}>Ampeln und Schwellen</Ueberschrift>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {SCHWELLEN_FELDER.map(f => {
          const eigen = d.schwellen?.[f.id] !== undefined;
          const prozent = f.einheit === '%';
          const vorgabe = SCHWELLEN_VORGABE[f.id];
          return (
            <FeldK key={f.id} label={`${f.label}${f.einheit === '€' ? ' (€)' : f.einheit === 'Monate' ? ' (Monate)' : ''}`} breit={190}>
              {prozent
                ? <ProzentFeld wert={eigen ? sw[f.id] : null} leer platzhalter={String(Number((vorgabe * 100).toFixed(4))).replace('.', ',')} dezimal={0} titel={f.label} breite="100%" onFertig={v => speichere(f.id, v, f.label)} />
                : <ZahlFeld wert={eigen ? sw[f.id] : null} leer platzhalter={eur(vorgabe)} dezimal={0} titel={f.label} breite="100%" onFertig={v => speichere(f.id, v, f.label)} />}
            </FeldK>
          );
        })}
      </div>
      <Hinweis>Leer heißt: die bisherige Vorgabe (grau im Feld). Die Schwellen färben Kacheln und Hinweise gelb oder rot — gerechnet wird davon nichts.</Hinweis>
    </Karte>
  );
}

/** Stichtag und Reserve — die zwei Einstellungen des Plans, die bisher nur an versteckten Stellen standen. */
export function EinstellungenKarte({ i = 4 }: { i?: number }) {
  const { d, aendere } = usePlan();
  const e = d.einstellungen;
  return (
    <Karte i={i}>
      <Ueberschrift>Einstellungen des Plans</Ueberschrift>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <FeldK label="Stichtag der Rechnung („jetzt“)" breit={190}>
          <input type="date" value={e.heute} aria-label="Stichtag der Rechnung" onChange={ev => { if (/^\d{4}-\d{2}-\d{2}$/.test(ev.target.value) && ev.target.value !== e.heute) void aendere([{ pfad: '/einstellungen/heute', alt: e.heute, neu: ev.target.value }], 'Stichtag der Rechnung'); }} style={{ ...eingabeStil, width: '100%' }} />
        </FeldK>
        {e.heute !== heuteBerlin() && <KnopfKlein onClick={() => void aendere([{ pfad: '/einstellungen/heute', alt: e.heute, neu: heuteBerlin() }], 'Stichtag auf heute gesetzt')}>auf heute setzen ({datumLang(heuteBerlin())})</KnopfKlein>}
        <FeldK label="Reserve der Firma (Monatskosten)" breit={190}>
          <ZahlFeld wert={e.reserveMonate} dezimal={0} breite="100%" titel="Reserve in Monatskosten" onFertig={v => { if (v != null && v >= 0 && v <= 24) void aendere([{ pfad: '/einstellungen/reserveMonate', alt: e.reserveMonate, neu: Math.round(v) }], 'Reserve in Monatskosten'); }} />
        </FeldK>
      </div>
      <Hinweis>Der Stichtag bestimmt, wo „jetzt“ liegt (Runway, frei verfügbar, laufender Monat). Die Reserve steht in den Töpfen als Ziel.</Hinweis>
    </Karte>
  );
}
