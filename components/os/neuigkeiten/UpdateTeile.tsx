'use client';

// ─── Was ist neu — ein Update als Liste (18.10.) ─────────────────────────────────────────────────────────────────────────────────────
// EIN Baustein für den Hinweis nach dem Update (UpdateHinweis) und die Seite Einstellungen › Was ist neu (NeuigkeitenView): Abschnitte
// „Neu · Besser geworden · Behoben“, je Punkt ein Satz und — wo es einen Ort gibt — „öffnen ›“. Die Daten kommen vom Server (/api/neuigkeiten),
// schon nach der Sicht des Kontos gefiltert; hier wird nichts gefiltert.

import Link from 'next/link';
import { FARBE as C, TYP, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { NEU_ART_NAME, type NeuArt, type Neuigkeit } from '@/lib/neuigkeiten/eintraege';

const ART_FARBE: Record<NeuArt, string> = { neu: BEDEUTUNG_FARBE.info, besser: BEDEUTUNG_FARBE.gut, behoben: BEDEUTUNG_FARBE.neutral };

/** „2026-10-18“ → „18.10.2026“. */
export const datumDe = (t: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);

/** Die Abschnitte eines Updates; `max` = höchstens so viele Punkte insgesamt (der Hinweis zeigt nur die ersten, die Seite alle). */
export function UpdateAbschnitte({ n, max, onWeg }: { n: Neuigkeit; max?: number; onWeg?: () => void }) {
  let rest = max ?? Infinity;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {n.abschnitte.map(a => {
        if (rest <= 0) return null;
        const punkte = a.punkte.slice(0, rest);
        rest -= punkte.length;
        return (
          <section key={a.art} aria-label={NEU_ART_NAME[a.art]}>
            <div style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: ART_FARBE[a.art], marginBottom: 6 }}>{NEU_ART_NAME[a.art]}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {punkte.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>
                  <span aria-hidden style={{ color: ART_FARBE[a.art], flex: '0 0 auto' }}>●</span>
                  <span style={{ minWidth: 0 }}>
                    {p.text}
                    {p.weg && <> <Link href={p.weg} onClick={onWeg} className="fassbar" style={{ color: C.aktiv, whiteSpace: 'nowrap', textDecoration: 'none' }}>öffnen ›</Link></>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Wie viele Punkte hat ein Update? */
export const punkteAnzahl = (n: Neuigkeit) => n.abschnitte.reduce((s, a) => s + a.punkte.length, 0);
