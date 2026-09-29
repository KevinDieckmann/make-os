'use client';

// ─── Termine in den CRM-Akten (30.09., Paket K3) ────────────────────────────
// Kontaktakte, Firmenakte, Deal-Akte und Mandat zeigen kommende und vergangene Termine — gelesen NUR über den Bezug
// (`kalender-bezug`, GET /api/kalender/bezug), nie über den Namen im Titel. Klick öffnet den Termin im Kalender
// (`WEG.termin`). Ein vergangener Termin der letzten 14 Tage bietet „Nachbereiten“ an — ein VORSCHLAG: erst der Klick
// legt das Follow-up an (POST /api/crm/followup), nichts geschieht automatisch. Es hängt am Termin (`terminUid`, F2 M4):
// der Titel wird nicht kopiert (die Anzeige leitet ihn ab), und „Wie lief's?“ fragt dazu nicht noch einmal.
// `useTerminZeiten` liefert dieselben Zeiten je Termin-Schlüssel für die Meeting-Aktivitäten (`terminUid` → Zeit).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import { WEG } from '@/lib/wege';
import { tagPlus } from '@/lib/kalender/zeit';
import { antwortenZaehlen } from '@/lib/kalender/gaeste';
import type { AkteTermin, TermineZuFrage } from '@/lib/kalender/termine-zu';
import type { TerminZeiten } from '@/lib/crm/aktivitaeten';

interface Antwort { kommend: AkteTermin[]; vergangen: AkteTermin[]; zeiten: TerminZeiten }
const LEER: Antwort = { kommend: [], vergangen: [], zeiten: {} };

const adresse = (f: TermineZuFrage) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v?.length) q.set(k, v.join(','));
  return q.toString();
};

/** Termine zu Kontakten/Firmen/Deals/Mandaten laden (null = noch nicht geladen oder kein Kalender-Zugang). */
export function useTermineZu(f: TermineZuFrage): { daten: Antwort | null; laden: () => void } {
  const q = adresse(f);
  const [daten, setDaten] = useState<Antwort | null>(null);
  const laden = useCallback(() => {
    if (!q) { setDaten(LEER); return; }
    fetch(`/api/kalender/bezug?${q}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setDaten(d?.ok ? { kommend: d.kommend ?? [], vergangen: d.vergangen ?? [], zeiten: d.zeiten ?? {} } : LEER)).catch(() => setDaten(LEER));
  }, [q]);
  useEffect(() => { laden(); }, [laden]);
  return { daten, laden };
}

/** Zeiten der verknüpften Termine eines Kontakts (für Meetings mit `terminUid`). */
export function useTerminZeiten(kontaktId: string): TerminZeiten | undefined {
  const frage = useMemo(() => ({ kontakte: [kontaktId] }), [kontaktId]);
  return useTermineZu(frage).daten?.zeiten;
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const wann = (t: AkteTermin) => {
  const d = new Date(`${t.start.slice(0, 10)}T12:00:00`);
  return `${WD[d.getDay()]} ${t.start.slice(8, 10)}.${t.start.slice(5, 7)}.${t.ganztags ? '' : ` ${t.start.slice(11, 16)}`}`;
};

/** Die Termine einer Akte. `kontaktId` = wen „Nachbereiten“ betrifft (sonst der Kontakt am Termin). */
export function TermineAkte({ frage, kontaktId, heute }: { frage: TermineZuFrage; kontaktId?: string; heute: string }) {
  const stabil = useMemo(() => frage, [JSON.stringify(frage)]); // eslint-disable-line react-hooks/exhaustive-deps
  const { daten } = useTermineZu(stabil);
  const [vorgemerkt, setVorgemerkt] = useState<Record<string, 'ok' | 'laeuft' | string>>({});
  if (!daten) return <div style={{ fontSize: 12.5, color: C.inkLeise }}>Termine werden geladen …</div>;
  const { kommend, vergangen } = daten;
  if (!kommend.length && !vergangen.length) return <div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine verknüpften Termine. Im Kalender am Termin „verknüpfen“ — oder hier „+ Meeting“.</div>;
  const nachbereiten = async (t: AkteTermin) => {
    const wer = kontaktId ?? t.bezug.kontaktId;
    if (!wer) return;
    setVorgemerkt(v => ({ ...v, [t.id]: 'laeuft' }));
    const r = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      aktion: 'anlegen', kontaktId: wer, ...(t.bezug.dealId ? { bezug: { art: 'chance', id: t.bezug.dealId } } : {}), art: 'sonstig',
      text: 'Termin nachbereiten', terminUid: t.id, faellig: heute,
    }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setVorgemerkt(v => ({ ...v, [t.id]: r.ok ? 'ok' : (r.fehler ?? 'Nicht angelegt.') }));
  };
  const zeile = (t: AkteTermin) => {
    const kannNach = t.vergangen && t.start.slice(0, 10) >= tagPlus(heute, -14) && !!(kontaktId ?? t.bezug.kontaktId);
    const v = vorgemerkt[t.id];
    return (
      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.045)', minWidth: 0, fontFamily: SCHRIFT.text }}>
        <Link href={WEG.termin(t.id, t.start.slice(0, 10))} title="Im Kalender öffnen" style={{ display: 'grid', gap: 1, flex: 1, minWidth: 0, color: C.ink, textDecoration: 'none' }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
          <span style={{ fontSize: 12, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wann(t)}{t.ort ? ` · ${t.ort}` : ''}{t.serie ? ' · Serie' : ''}{t.antworten?.length ? ` · ${antwortenZaehlen(t.antworten)}` : ''}</span>
        </Link>
        {kannNach && (v === 'ok'
          ? <span style={{ fontSize: 12, color: LEUCHT.gut, whiteSpace: 'nowrap' }}>✓ vorgemerkt</span>
          : <button type="button" disabled={v === 'laeuft'} onClick={() => void nachbereiten(t)} title={typeof v === 'string' && v !== 'laeuft' ? v : 'Vorschlag: Follow-up „Nachbereiten“ für heute anlegen'} className="fassbar"
            style={{ border: `1px solid ${LEUCHT.business}66`, background: 'transparent', color: LEUCHT.business, borderRadius: 999, padding: '3px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: SCHRIFT.text }}>Nachbereiten</button>)}
      </div>
    );
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {kommend.length > 0 && <div><div style={{ fontSize: 11.5, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kommend</div>{kommend.slice(0, 5).map(zeile)}</div>}
      {vergangen.length > 0 && <div><div style={{ fontSize: 11.5, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em' }}>Vergangen</div>{vergangen.slice(0, 5).map(zeile)}</div>}
    </div>
  );
}
