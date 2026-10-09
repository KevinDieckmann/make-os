'use client';

// ─── Heute: was ansteht (K6a, 29.09.) ───────────────────────────────────────
// Eine Karte für Heute mit allem, was außer Terminen und Aufgaben heute zählt — dieselbe Quelle wie die Glocke
// (GET /api/heute/anstehend, lib/heute/anstehend.ts): Termine nachbereiten, Fristen (Kündigungsfristen mit Vorlauf,
// Zahlungen, Steuer-Vorlage), fällige Follow-ups (auch die Wiedervorlage geparkter Deals), offene Buchungsanfragen,
// Kalender-Vorschläge von ZOE und Geburtstage (auf Heute NUR hier, F2 M2) mit dem Geschenk-Vorlauf:
//   Familie  der „Wichtige Tag“ ist die Quelle (Vorlauf, Aktion, erledigt je Jahr) — ohne ihn „Geschenk vormerken“, das
//            legt ihn in der Familie an (Verweis `menschId`, kein Datum kopiert).
//   CRM      „Geschenk-Aufgabe“ über den normalen Aufgaben-Schreibweg mit `bezug.kontaktId` + `anlass` (Kontakt + Jahr);
//            vorgemerkt/erledigt erkennt `geschenkStand` per Kennung, nie per Titel.
// Nur Verweise: jede Zeile führt in ihr Modul; erst ein Klick legt etwas an. Nichts da → keine Karte.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT } from '../ui';
import { useTasks } from '@/context/TasksContext';
import { aufgabeAnlegen } from '../aufgaben/hilfe';
import { BUSINESS_VORGABE_SPACE } from '@/lib/einheiten';
import { geschenkAufgabeTitel, geschenkStand, ANLASS_WORT, GEBURTSTAG_VORLAUF, type Anstehend as AnstehendDaten, type AGeburtstag } from '@/lib/heute/anstehend';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import { neueKennung } from '../aufgaben/hilfe';
import { tagKurz } from '@/lib/zeit/kalender-kern';

/** „5.9.“ — mit Jahreszahl nur außerhalb des laufenden Jahres (eine Regel mit Glocke/Agenda, lib/zeit/kalender-kern `tagKurz`). */
const kurz = (tag: string, heute: string) => tagKurz(tag, heute, { ohneNull: true });
const zeile: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.045)', textDecoration: 'none', color: C.ink, minWidth: 0, fontFamily: SCHRIFT.text };
const vorne = (farbe: string): React.CSSProperties => ({ fontSize: TYP.bedien, color: farbe, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 74 });
const text: React.CSSProperties = { fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 };
const kopf: React.CSSProperties = { fontSize: TYP.mikro, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 8 };

/** Ist irgendetwas da? (sonst zeigt Heute keine Karte) */
export const anstehendLeer = (d: Pick<AnstehendDaten, 'nachbereiten' | 'fristen' | 'followups' | 'buchungen' | 'vorschlaege' | 'geburtstage'> & { danke?: AnstehendDaten['danke'] }) =>
  !d.nachbereiten.length && !d.fristen.length && !d.followups.length && !d.buchungen.length && !d.vorschlaege.kalender && !d.geburtstage.length && !(d.danke ?? []).length;

/** Was beim Geburtstag rechts steht: Stand aus dem Wichtigen Tag (Familie) bzw. der verknüpften Aufgabe (CRM). */
function GeschenkRechts({ g, heute, stand, geschenk }: { g: AGeburtstag; heute: string; stand: 'offen' | 'erledigt' | null; geschenk?: (g: AGeburtstag) => void }) {
  const fertig: React.CSSProperties = { fontSize: TYP.bedien, color: LEUCHT.gut, whiteSpace: 'nowrap' };
  if (g.anlass) {
    const wort = ANLASS_WORT[g.anlass.aktion];
    return g.anlass.erledigt ? <span style={fertig}>✓ {wort} erledigt</span>
      : <Link href="/os/familie" style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }} title="In der Familie abhaken">{wort} ab {kurz(g.anlass.ab, heute)}</Link>;
  }
  if (stand === 'erledigt') return <span style={fertig}>✓ Geschenk erledigt</span>;
  if (stand === 'offen') return <span style={fertig}>✓ Geschenk vorgemerkt</span>;
  if (!geschenk || (g.herkunft === 'crm' ? !g.kontaktId : !g.menschId)) return null;
  return <Knopf leise onClick={() => geschenk(g)}>{g.herkunft === 'crm' ? 'Geschenk-Aufgabe' : 'Geschenk vormerken'} ({kurz(g.aufgabeTag, heute)})</Knopf>;
}

/** Rein darstellend (Render-Test): die Abschnitte. `geschenkStandVon` = Stand der Geschenk-Aufgabe eines CRM-Geburtstags. */
export function AnstehendListe({ d, geschenkStandVon, geschenk }: { d: AnstehendDaten; geschenkStandVon: (g: AGeburtstag) => 'offen' | 'erledigt' | null; geschenk?: (g: AGeburtstag) => void }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {d.nachbereiten.length > 0 && <div style={kopf}>Nachbereiten</div>}
      {d.nachbereiten.map(n => (
        <Link key={`n-${n.kontaktId}`} href={n.href} style={zeile} title="Kontakt öffnen — Ergebnis festhalten">
          <span style={vorne(LEUCHT.achtung)}>{kurz(n.tag, d.heute)}{n.zeit ? ` ${n.zeit}` : ''}</span><span style={text}>Wie lief „{n.titel}“ mit {n.name}?</span>
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
      {(d.danke ?? []).length > 0 && <div style={kopf}>Netzwerken</div>}
      {(d.danke ?? []).map(x => (
        <Link key={x.id} href={x.href} style={zeile} title="Danke-Mails ansehen — verschickt wird erst per Klick">
          <span style={vorne(LEUCHT.achtung)}>{x.n} Danke-Mail{x.n === 1 ? '' : 's'}</span><span style={text}>bereit — {x.eventTitel}</span>
        </Link>
      ))}
      {(d.buchungen.length > 0 || d.vorschlaege.kalender > 0) && <div style={kopf}>Wartet auf dich</div>}
      {d.buchungen.length > 0 && (
        <Link href={d.buchungen[0].href} style={zeile}>
          <span style={vorne(LEUCHT.business)}>{d.buchungen.length} Anfrage{d.buchungen.length === 1 ? '' : 'n'}</span>
          <span style={text}>Buchungsanfrage{d.buchungen.length === 1 ? '' : 'n'} freigeben oder ablehnen — {d.buchungen.map(b => `${b.titel} ${kurz(b.start.slice(0, 10), d.heute)}`).join(', ')}</span>
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
          <span style={vorne('#FF7EB6')}>{kurz(g.tag, d.heute)}</span>
          <Link href={g.href} style={{ ...text, color: C.ink, textDecoration: 'none' }}>🎂 {g.name}{g.alter !== undefined && g.alter > 0 ? ` (wird ${g.alter})` : ''}</Link>
          <GeschenkRechts g={g} heute={d.heute} stand={geschenkStandVon(g)} geschenk={geschenk} />
        </div>
      ))}
    </div>
  );
}

/** `space` (08.10., Woche 2 · 4.10): die Sicht der Fläche — der Server filtert (Privat ohne CRM-Follow-ups und Business-Fristen). */
export function Anstehend({ i = 0, space }: { i?: number; space?: 'privat' | 'business' | 'alle' }) {
  const [d, setD] = useState<AnstehendDaten | null>(null);
  const [runde, setRunde] = useState(0);
  const neuLaden = () => setRunde(r => r + 1);
  const { state, dispatch } = useTasks();
  useEffect(() => {
    let lebt = true;
    const laden = () => fetch(`/api/heute/anstehend${space === 'privat' || space === 'business' ? `?space=${space}` : ''}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => { if (lebt && x?.ok) setD(x as AnstehendDaten); }).catch(() => {});
    void laden();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, 5 * 60_000);
    return () => { lebt = false; clearInterval(t); };
  }, [runde, space]);
  if (!d || anstehendLeer(d)) return null;
  // CRM: verknüpft per Kennung (Kontakt + Jahr), nie per Titel — Papierkorb/Archiv/abgebrochen zählen nicht (`geschenkStand`).
  const geschenkStandVon = (g: AGeburtstag) => (g.herkunft === 'crm' ? geschenkStand(state.tasks, g) : null);
  const geschenk = (g: AGeburtstag) => {
    if (g.herkunft === 'crm') {
      if (!g.kontaktId || geschenkStandVon(g)) return;
      // Business mit Kontakt-Bezug; Titel nur „Geschenk für …“ (kein Datum), der Geburtstag bleibt am Kontakt.
      aufgabeAnlegen(dispatch, state, { spaceId: BUSINESS_VORGABE_SPACE }, {
        title: geschenkAufgabeTitel(g.name), dueDate: g.aufgabeTag, description: `Vorschlag aus Heute (Geburtstag, ${GEBURTSTAG_VORLAUF} Tage Vorlauf).`,
        bezug: { kontaktId: g.kontaktId }, anlass: { art: 'geschenk', jahr: Number(g.tag.slice(0, 4)) },
      });
      return;
    }
    // Familie: der Wichtige Tag wird die Quelle (Verweis auf den Menschen, ohne eigenes Datum) — dann laden wir neu.
    if (!g.menschId || g.anlass) return;
    const eintrag = { id: neueKennung('tag'), titel: `Geburtstag ${g.name}`, art: 'geburtstag', datum: '', menschId: g.menschId, vorlaufTage: GEBURTSTAG_VORLAUF, wer: personLesen() || '', aktion: 'geschenk', erledigt: [] };
    void fetch('/api/familie', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops: [{ liste: 'tage', op: 'upsert', eintrag }] }) })
      .then(r => (r.ok ? neuLaden() : undefined)).catch(() => {});
  };
  const zahl = d.nachbereiten.length + d.fristen.length + d.followups.length + d.buchungen.length + (d.vorschlaege.kalender ? 1 : 0) + d.geburtstage.length + (d.danke ?? []).length;
  return (
    <Karte i={i} akzent={d.fristen.some(f => f.kuendigung) || d.followups.some(f => f.tageUeber > 0) ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={LEUCHT.achtung} rechts={<span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{zahl}</span>}>Steht an</Ueberschrift>
      <AnstehendListe d={d} geschenkStandVon={geschenkStandVon} geschenk={geschenk} />
    </Karte>
  );
}
