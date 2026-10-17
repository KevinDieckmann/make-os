'use client';

// ─── Fulfillment › Fall › Reise — die Ausführung am gewählten Knoten (17.10. abends) ───────────────────────────────────────────────────────
// Rückmeldung 17.10.: „Abläufe wirklich ausführen … Nachrichten als Entwurf auf Klick, Erinnerungen von selbst, Entscheidungen fragen nach.“ EINE Karte im Detail
// neben dem Fluss, je nach Form des Knotens:
//   · Entscheidung → die Frage mit „Ja“ / „Nein“ (ein Klick; Op `antwort`), was danach passiert, die Runde („Versuch 2 von 5“), „eskaliert“.
//   · Nachricht (bzw. Erinnerung mit Mail-Baustein) → „Entwurf öffnen“ (gefüllt aus dem Baustein, GET ?nachricht=) — gesendet wird nur dort per Klick
//     (MailSenden → /api/inbox/senden); danach gilt der Schritt als erledigt. Art. 18 bzw. Werbesperre: kein Entwurf, nur der Hinweis.
//   · Schritt/Termin/Erinnerung → ihre Aufgabe (Link, Stand) — erledigen dort rückt den Fall weiter, abhaken hier schließt sie.
// Rechnet nichts (Stand aus der Route: `daten.ablauf`, gerechnet in lib/fulfillment/prozesse/ausfuehrung.ts); schreibt nur über die Fall-Ops.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { neueMailVorbereiten } from '@/lib/inbox/neue-mail';
import { titelOhneZusatz } from '@/lib/fulfillment/prozesse/darstellung';
import { holeJson, tagKurz, type FallAntwort } from '../prozesse/daten';
import { MailSenden, type MailEntwurf } from '../prozesse/MailSenden';
import { klein } from '../prozesse/teile';
import type { Ops } from '../prozesse/FallAblauf';

const AUFGABE_STAND: Record<string, string> = { todo: 'offen', backlog: 'offen', in_progress: 'in Arbeit', blocked: 'wartet', done: 'erledigt', cancelled: 'abgebrochen' };

interface Grundlage { ok?: boolean; entwurf: MailEntwurf | null; gesperrt?: string; hinweis?: string; baustein?: { id: string; titel: string }; fehler?: string }

/** Hat der Knoten einen Mail-Baustein (eigener oder darunter)? Nur Anzeige — der Server entscheidet dasselbe (`mailBausteinVon`). */
function mitMail(daten: FallAntwort, id: string): boolean {
  const kn = daten.fall?.knoten ?? [];
  const k = kn.find(x => x.id === id);
  const ids = [k?.bausteinId, ...kn.filter(x => x.elternId === id).map(x => x.bausteinId)].filter((x): x is string => !!x);
  return ids.some(b => daten.bausteine?.find(x => x.id === b)?.art === 'mail');
}

export function AblaufKarte({ daten, knotenId, ops }: { daten: FallAntwort; knotenId: string; ops: Ops }) {
  const router = useRouter();
  const [entwurf, setEntwurf] = useState<MailEntwurf | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; art: 'kritisch' | 'achtung' | 'info' } | null>(null);
  const st = daten.ablauf?.aktiv ? daten.ablauf.knoten[knotenId] : undefined;
  const f = daten.fall;
  if (!st || !f) return null;
  const kn = f.knoten.find(x => x.id === knotenId);
  if (!kn) return null;
  const titel = (id?: string) => titelOhneZusatz(f.knoten.find(x => x.id === id)?.titel ?? '');
  const fertig = kn.status === 'erledigt' || kn.status === 'entfaellt';
  const m = daten.mandat.id;
  const stand = (id: string) => f.knoten.find(x => x.id === id)?.stand;
  const erledigen = async () => { const s = stand(knotenId); await ops([{ op: 'knoten-status', id: knotenId, status: 'erledigt', ...(s ? { stand: s } : {}) }]); };
  const frist = st.faellig ? `${st.ueberfaellig ? 'überfällig seit' : 'bis'} ${tagKurz(st.faellig)}` : null;

  const entwurfHolen = async () => {
    setHinweis(null);
    const a = await holeJson<Grundlage>(`/api/fulfillment/fall?m=${encodeURIComponent(m)}&nachricht=${encodeURIComponent(knotenId)}`);
    if (!a.ok) { setHinweis({ text: String(a.j.fehler ?? 'Der Entwurf ließ sich nicht laden.'), art: 'kritisch' }); return null; }
    if (a.j.gesperrt) { setHinweis({ text: a.j.gesperrt, art: 'achtung' }); return null; }
    if (a.j.hinweis) setHinweis({ text: a.j.hinweis, art: 'info' });
    return a.j.entwurf;
  };
  const nachricht = st.art === 'nachricht' || (st.art === 'erinnerung' && mitMail(daten, knotenId));
  const aufgabe = st.aufgabe ? (
    <span style={{ ...klein }}>
      Aufgabe: <Link href={WEG.aufgabe(st.aufgabe)} style={{ color: C.aktiv }}>{AUFGABE_STAND[st.aufgabeStatus ?? ''] ?? 'öffnen'} ›</Link>
    </span>
  ) : null;

  if (st.art === 'entscheidung') {
    const versuch = st.runde > 0 && st.versuche ? `Versuch ${Math.min(st.runde, st.versuche)} von ${st.versuche}` : null;
    const nein = st.nein ? titel(st.nein) : null;
    const ja = kn.zweige?.ja ? titel(kn.zweige.ja) : null;
    return (
      <Karte i={1} id="ff-ablauf-frage" akzent={st.eskaliert && !fertig ? LEUCHT.kritisch : LEUCHT.achtung}>
        <Ueberschrift rechts={versuch ? <span>{versuch}</span> : undefined}>Entscheidung</Ueberschrift>
        <b style={{ fontSize: TYP.body, color: C.ink, overflowWrap: 'break-word' }}>{titelOhneZusatz(kn.titel)}</b>
        {fertig ? <div style={klein}>{kn.status === 'entfaellt' ? 'Entfällt.' : `Entschieden: ${kn.antwort === 'nein' ? 'nein' : 'ja'}${kn.antwortAm ? ` (${tagKurz(kn.antwortAm)})` : ''}.`}</div> : (
          <>
            {st.eskaliert && <Hinweis art="kritisch">Eskaliert — alle Versuche ohne Antwort. Bitte entscheiden: „Ja“, oder den Schritt mit Grund entfallen lassen.</Hinweis>}
            {st.neinLaeuft
              ? <div style={klein}>„Nein“ am {tagKurz(kn.antwortAm)} — die Erinnerung „{nein}“ läuft. Kommt die Antwort doch, einfach „Ja“.</div>
              : <div style={klein}>{frist ? `Antwort ${frist}. ` : ''}Ja → {ja ? `weiter zu „${ja}“` : 'weiter'}{nein ? ` · Nein → „${nein}“, danach fragt der Fall wieder` : ' · Nein → in ein paar Tagen noch einmal fragen'}.</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Knopf haupt onClick={async () => { const s = stand(knotenId); await ops([{ op: 'antwort', id: knotenId, antwort: 'ja', ...(s ? { stand: s } : {}) }]); }}>Ja</Knopf>
              <Knopf leise onClick={async () => { const s = stand(knotenId); await ops([{ op: 'antwort', id: knotenId, antwort: 'nein', ...(s ? { stand: s } : {}) }]); }}>Nein</Knopf>
            </div>
          </>
        )}
      </Karte>
    );
  }

  return (
    <Karte i={1} id="ff-ablauf-ausfuehrung">
      <Ueberschrift rechts={frist && st.aktiv && !fertig ? <span style={{ color: st.ueberfaellig ? LEUCHT.achtung : undefined }}>{frist}</span> : undefined}>
        {st.art === 'nachricht' ? 'Nachricht' : st.art === 'erinnerung' ? `Erinnerung${st.runde > 0 && st.versuche ? ` · Runde ${Math.min(st.runde, st.versuche)} von ${st.versuche}` : ''}` : kn.form === 'termin' ? 'Termin' : 'Aufgabe'}
      </Ueberschrift>
      {hinweis && <Hinweis art={hinweis.art}>{hinweis.text}</Hinweis>}
      {st.art === 'erinnerung' && st.entscheidung && <div style={klein}>Erledigt ihr die Erinnerung, fragt der Fall wieder: „{titel(st.entscheidung)}“.</div>}
      {st.art === 'aufgabe' && <div style={klein}>Erledigt ihr die Aufgabe, rückt der Fall weiter — hakt ihr den Schritt hier ab, schließt sich die Aufgabe.</div>}
      {st.art === 'erinnerung' && st.aktiv && !st.aufgabe && st.faellig && !st.ueberfaellig && st.faellig > localDay() && <div style={klein}>Die Aufgabe entsteht am {tagKurz(st.faellig)} von selbst.</div>}
      {aufgabe}
      {nachricht && !fertig && (
        <>
          <div style={klein}>Der Entwurf kommt aus dem Mail-Baustein am Schritt — gesendet wird nur per Klick, danach gilt der Schritt als erledigt.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Knopf haupt={st.aktiv} onClick={async () => { const e = await entwurfHolen(); if (e) setEntwurf(e); }}>Entwurf öffnen</Knopf>
            <Knopf leise onClick={async () => {
              const e = await entwurfHolen();
              if (e) router.push(neueMailVorbereiten({ ...(e.an ? { an: e.an.email, ...(e.an.name ? { name: e.an.name } : {}) } : {}), betreff: e.betreff, text: e.text }));
            }}>In der Inbox öffnen</Knopf>
            <Knopf leise onClick={erledigen}>Gesendet vermerken</Knopf>
          </div>
        </>
      )}
      {entwurf && <MailSenden titel={`${st.art === 'erinnerung' ? 'Erinnerung' : 'Nachricht'} senden`} entwurf={entwurf} onZu={() => setEntwurf(null)} onGesendet={async () => { await erledigen(); }} />}
    </Karte>
  );
}
