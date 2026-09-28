'use client';

// ─── Stammdaten › Datenqualität · Einwilligung ohne vollständigen Nachweis (28.09., U2-Nachtrag) ─
// Kevin 28.09.: Altbestand bleibt gültig, aber gelb — diese Liste hilft, die Nachweise nach und nach
// zu ergänzen. Anzahl je Kanal, je Person was fehlt; ein Tipp öffnet „Kontakt öffnen“ › Stammdaten
// (dort Datenschutz). Nichts wird automatisch geändert. Hinweis, keine Rechtsberatung.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, LEUCHT } from '../../schlank';
import { kontaktAkte } from '@/lib/crm/adresse';
import type { StammdatenDaten } from './typen';

const KANAL: Record<string, string> = { mail: 'Mail', telefon: 'Telefon', social: 'LinkedIn/Social', newsletter: 'Newsletter', einladung: 'Einladungen' };

export function NachweisOffenKarte({ d }: { d: StammdatenDaten }) {
  const n = d.qualitaet.nachweisOffen;
  const kanaele = Object.entries(n.jeKanal).filter(([, x]) => x > 0);
  return (
    <Karte i={1} akzent={n.liste.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift rechts={`${n.liste.length} offen`}>Einwilligung ohne vollständigen Nachweis</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: n.liste.length ? LEUCHT.achtung : C.inkLeise, lineHeight: 1.55 }}>
        {n.liste.length
          ? 'Gültig, aber ohne Zeitpunkt, wer, Wortlaut oder Beleg — Mail und Newsletter bleiben dafür gelb. Nachweise in der Kontaktseite unter Stammdaten › Datenschutz ergänzen; hier wird nichts automatisch geändert.'
          : 'Alle gültigen Einwilligungen haben einen vollständigen Nachweis.'}
      </div>
      {kanaele.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{kanaele.map(([k, x]) => <Chip key={k} farbe={LEUCHT.achtung}>{KANAL[k] ?? k} · {x}</Chip>)}</div>}
      {n.liste.length > 0 && (
        <div style={{ display: 'grid', gap: 2, marginTop: 8 }}>
          {n.liste.map(x => (
            <Link key={x.id} href={kontaktAkte(x.id, 'daten')} style={{ display: 'block', color: C.inkDim, fontSize: 12.5, padding: '2px 0', textDecoration: 'none' }}>
              {x.name} <span style={{ color: C.inkLeise }}>· {x.id} · {x.kanaele.map(k => KANAL[k] ?? k).join(', ')} · fehlt: {x.fehlt.join(', ')}</span> ›
            </Link>
          ))}
        </div>
      )}
    </Karte>
  );
}
