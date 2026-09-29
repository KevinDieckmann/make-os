'use client';

// ─── Heute: was ansteht (K6a, 29.09.) ───────────────────────────────────────
// Eine Karte für Heute mit allem, was außer Terminen und Aufgaben heute zählt — dieselbe Quelle wie die Glocke
// (GET /api/heute/anstehend, lib/heute/anstehend.ts): Termine nachbereiten, Fristen (Kündigungsfristen mit Vorlauf,
// Zahlungen, Steuer-Vorlage), fällige Follow-ups (auch die Wiedervorlage geparkter Deals), offene Buchungsanfragen,
// Kalender-Vorschläge von ZOE und Geburtstage mit dem Vorschlag „Geschenk-Aufgabe 10 Tage vorher“.
// Nur Verweise: jede Zeile führt in ihr Modul; erst ein Klick legt etwas an (die Geschenk-Aufgabe über den normalen
// Aufgaben-Schreibweg). Nichts da → keine Karte.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import { aufgabeAnlegen } from '../aufgaben/hilfe';
import { geschenkAufgabeTitel, type Anstehend as AnstehendDaten, type AGeburtstag } from '@/lib/heute/anstehend';

const kurz = (tag: string) => `${Number(tag.slice(8, 10))}.${Number(tag.slice(5, 7))}.`;
const zeile: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.045)', textDecoration: 'none', color: C.ink, minWidth: 0, fontFamily: SCHRIFT.text };
const vorne = (farbe: string): React.CSSProperties => ({ fontSize: 12, color: farbe, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 74 });
const text: React.CSSProperties = { fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 };
const kopf: React.CSSProperties = { fontSize: 11.5, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 8 };

/** Ist irgendetwas da? (sonst zeigt Heute keine Karte) */
export const anstehendLeer = (d: Pick<AnstehendDaten, 'nachbereiten' | 'fristen' | 'followups' | 'buchungen' | 'vorschlaege' | 'geburtstage'>) =>
  !d.nachbereiten.length && !d.fristen.length && !d.followups.length && !d.buchungen.length && !d.vorschlaege.kalender && !d.geburtstage.length;

/** Rein darstellend (Render-Test): die Abschnitte. `vorgemerkt` = Geburtstage mit schon angelegter Geschenk-Aufgabe. */
export function AnstehendListe({ d, vorgemerkt, geschenk }: { d: AnstehendDaten; vorgemerkt: (g: AGeburtstag) => boolean; geschenk?: (g: AGeburtstag) => void }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {d.nachbereiten.length > 0 && <div style={kopf}>Nachbereiten</div>}
      {d.nachbereiten.map(n => (
        <Link key={`n-${n.kontaktId}`} href={n.href} style={zeile} title="Kontakt öffnen — Ergebnis festhalten">
          <span style={vorne(LEUCHT.achtung)}>{kurz(n.tag)}{n.zeit ? ` ${n.zeit}` : ''}</span><span style={text}>Wie lief „{n.titel}“ mit {n.name}?</span>
        </Link>
      ))}
      {d.fristen.length > 0 && <div style={kopf}>Fristen</div>}
      {d.fristen.map(f => (
        <Link key={`f-${f.id}`} href={f.href} style={zeile} title={f.unter}>
          <span style={vorne(f.kuendigung || f.inTagen <= 0 ? LEUCHT.kritisch : LEUCHT.achtung)}>{f.inTagen <= 0 ? 'heute' : f.inTagen === 1 ? 'morgen' : `in ${f.inTagen} T.`}</span>
          <span style={text}>{f.titel}{f.unter ? <span style={{ color: C.inkLeise }}> · {f.unter}</span> : null}</span>
        </Link>
      ))}
      {d.followups.length > 0 && <div style={kopf}>Follow-ups</div>}
      {d.followups.map(f => (
        <Link key={`fu-${f.id}`} href={f.href} style={zeile}>
          <span style={vorne(f.tageUeber > 0 ? LEUCHT.kritisch : LEUCHT.business)}>{f.tageUeber > 0 ? `seit ${f.tageUeber} T.` : f.uhrzeit ?? 'heute'}</span>
          <span style={text}>{f.text}{f.name && !f.text.includes(f.name) ? <span style={{ color: C.inkLeise }}> · {f.name}</span> : null}</span>
        </Link>
      ))}
      {(d.buchungen.length > 0 || d.vorschlaege.kalender > 0) && <div style={kopf}>Wartet auf dich</div>}
      {d.buchungen.length > 0 && (
        <Link href={d.buchungen[0].href} style={zeile}>
          <span style={vorne(LEUCHT.business)}>{d.buchungen.length} Anfrage{d.buchungen.length === 1 ? '' : 'n'}</span>
          <span style={text}>Buchungsanfrage{d.buchungen.length === 1 ? '' : 'n'} freigeben oder ablehnen — {d.buchungen.map(b => `${b.titel} ${kurz(b.start.slice(0, 10))}`).join(', ')}</span>
        </Link>
      )}
      {d.vorschlaege.kalender > 0 && (
        <Link href="/os/stapel" style={zeile}>
          <span style={vorne(LEUCHT.achtung)}>{d.vorschlaege.kalender} ZOE</span>
          <span style={text}>Kalender-Vorschl{d.vorschlaege.kalender === 1 ? 'ag wartet' : 'äge warten'} im Stapel auf Freigabe</span>
        </Link>
      )}
      {d.geburtstage.length > 0 && <div style={kopf}>Geburtstage</div>}
      {d.geburtstage.map(g => (
        <div key={`g-${g.id}`} style={{ ...zeile, alignItems: 'center' }}>
          <span style={vorne('#FF7EB6')}>{kurz(g.tag)}</span>
          <Link href={g.href} style={{ ...text, color: C.ink, textDecoration: 'none' }}>🎂 {g.name}{g.alter !== undefined && g.alter > 0 ? ` (wird ${g.alter})` : ''}</Link>
          {vorgemerkt(g) ? <span style={{ fontSize: 12, color: LEUCHT.gut, whiteSpace: 'nowrap' }}>✓ Geschenk vorgemerkt</span>
            : geschenk ? <Knopf leise onClick={() => geschenk(g)}>Geschenk-Aufgabe ({kurz(g.aufgabeTag)})</Knopf> : null}
        </div>
      ))}
    </div>
  );
}

export function Anstehend({ i = 0 }: { i?: number }) {
  const [d, setD] = useState<AnstehendDaten | null>(null);
  const { state, dispatch } = useTasks();
  useEffect(() => {
    let lebt = true;
    const laden = () => fetch('/api/heute/anstehend', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => { if (lebt && x?.ok) setD(x as AnstehendDaten); }).catch(() => {});
    void laden();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, 5 * 60_000);
    return () => { lebt = false; clearInterval(t); };
  }, []);
  if (!d || anstehendLeer(d)) return null;
  // Eine Geschenk-Aufgabe gilt als vorgemerkt, solange eine offene Aufgabe mit genau diesem Titel existiert (keine Kopie).
  const vorgemerkt = (g: AGeburtstag) => state.tasks.some(t => t.title === geschenkAufgabeTitel(g.name, g.tag) && t.status !== 'done' && t.status !== 'cancelled');
  const geschenk = (g: AGeburtstag) => {
    if (vorgemerkt(g)) return;
    // Familie → Privat; CRM → Business mit Kontakt-Bezug (nur die Kennung, der Geburtstag bleibt am Kontakt).
    aufgabeAnlegen(dispatch, state, { spaceId: g.herkunft === 'crm' ? 'kdv' : 'privat' }, {
      title: geschenkAufgabeTitel(g.name, g.tag), dueDate: g.aufgabeTag, description: 'Vorschlag aus Heute (Geburtstag, 10 Tage Vorlauf).',
      ...(g.herkunft === 'crm' && g.kontaktId ? { bezug: { kontaktId: g.kontaktId } } : {}),
    });
  };
  const zahl = d.nachbereiten.length + d.fristen.length + d.followups.length + d.buchungen.length + (d.vorschlaege.kalender ? 1 : 0) + d.geburtstage.length;
  return (
    <Karte i={i} akzent={d.fristen.some(f => f.kuendigung) || d.followups.some(f => f.tageUeber > 0) ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={LEUCHT.achtung} rechts={<span style={{ fontSize: 12, color: C.inkLeise }}>{zahl}</span>}>Steht an</Ueberschrift>
      <AnstehendListe d={d} vorgemerkt={vorgemerkt} geschenk={geschenk} />
    </Karte>
  );
}
