'use client';

// ─── Gmail — eine Mail öffnen: Thread, Zuordnung, Antworten, Aufgabe/Follow-up/Termin/Kontakt (03.10.2026) ──
// Zeigt den Thread der Mail aus dem EIGENEN Spiegel (Text, nie HTML; Bilder nie geladen; Anhänge nur als Download auf Klick).
// „Gehört zu …“ verlinkt in die Kontaktakte. Mehr-Menü: Aufgabe · Follow-up · Termin (Business → Google Kalender der Person) ·
// Kontakt anlegen (Anfrage über Mail) · Gelesen/Ungelesen · Archivieren (Label INBOX weg, in Gmail). Alles läuft über die
// vorhandenen Schreibwege — nichts wird still angelegt, nichts gesendet. Am Handy bedienbar (Tasten ≥ 44 px).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import type { Owner } from '@/types/common';
import { Knopf, Chip, LEUCHT } from '../ui';
import { NeuerTermin } from '../kalender/NeuerTermin';
import { GmailText } from './GmailText';
import { GmailAntwort, type AntwortDaten } from './GmailAntwort';
import { aufgabeAusMail, followUpAusMail, terminVorgabe, kontaktAusMail } from '@/lib/gmail/aus-mail';
import { vorText } from '@/lib/gmail/liste';
import type { GmailKopf, Zuordnung, GmailAlias } from '@/lib/gmail/typen';

interface Nachricht { kopf: GmailKopf; text: string; zuordnung?: Zuordnung }
interface Antwort {
  ok: boolean; thread: Nachricht[]; antwortAuf: string; juengste?: string;
  empfaenger: AntwortDaten['empfaenger']; aliase: GmailAlias[]; eigene: string; fehler?: string;
}

const datum = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const groesse = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
const tagIn = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
const naechsterMontag = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return localDay(d); };
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, unknown> })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung.' } as Record<string, unknown> }));

export function GmailDetail({ nachrichtId, person, meldung, onGeaendert, imFenster }: {
  nachrichtId: string; person: string; meldung: (t: string) => void; onGeaendert: () => void; imFenster?: boolean;
}) {
  const { state, dispatch } = useTasks();
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [antwort, setAntwort] = useState<null | { allen: boolean }>(null);
  const [menue, setMenue] = useState(false);
  const [termin, setTermin] = useState(false);
  const [wann, setWann] = useState<null | 'followup'>(null);
  const [eigenesDatum, setEigenesDatum] = useState('');
  const heute = localDay();

  const laden = useCallback(async () => {
    const r = await fetch(`/api/gmail/nachricht?id=${encodeURIComponent(nachrichtId)}`, { cache: 'no-store' }).then(async x => ({ status: x.status, d: await x.json().catch(() => ({})) as Antwort })).catch(() => null);
    if (!r || !r.d.ok) { setFehler(r?.d.fehler ?? 'Die Mail ließ sich nicht laden.'); setD(null); return null; }
    setFehler(''); setD(r.d); return r.d;
  }, [nachrichtId]);

  useEffect(() => {
    setD(null); setOffen(null); setAntwort(null); setMenue(false); setTermin(false); setWann(null);
    void laden().then(x => {
      // Wie in Gmail: wer die Mail öffnet, hat sie gelesen.
      const j = x?.thread.at(-1);
      if (x && j?.kopf.labels.includes('UNREAD')) void post('/api/gmail', { aktion: 'markieren', id: j.kopf.id, was: 'gelesen' }).then(() => onGeaendert());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nachrichtId]);

  if (fehler) return <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{fehler}</div>;
  if (!d) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lädt …</div>;

  const ziel = d.thread.find(n => n.kopf.id === d.antwortAuf) ?? d.thread[d.thread.length - 1];
  const k = ziel.kopf;
  const z = ziel.zuordnung ?? d.thread.find(n => n.zuordnung)?.zuordnung ?? null;
  const imPosteingang = d.thread.some(n => n.kopf.labels.includes('INBOX'));
  const ungelesen = k.labels.includes('UNREAD');
  const markieren = async (was: 'gelesen' | 'ungelesen' | 'archivieren' | 'posteingang', text: string) => {
    const r = await post('/api/gmail', { aktion: 'markieren', id: k.id, was });
    meldung(r.d.ok ? text : String(r.d.fehler ?? 'Gmail hat die Änderung nicht angenommen.'));
    setMenue(false); await laden(); onGeaendert();
  };
  const aufgabe = () => {
    const a = aufgabeAusMail(k, z);
    const schonDa = state.tasks.find(t => t.status !== 'done' && t.title.trim().toLowerCase() === a.title.trim().toLowerCase() && (t.description ?? '').includes(`gmail-${k.id}`));
    if (!schonDa) dispatch({ type: 'ADD_TASK', payload: { projectId: state.projects[0]?.id ?? '', title: a.title, description: a.description, status: 'todo', priority: a.priority, assignee: person as Owner, tags: [], subTasks: [], dependencies: [], sortOrder: 0, space: a.space, ...(a.bezug ? { bezug: a.bezug } : {}) } });
    meldung(schonDa ? `Aufgabe gab es schon: ${a.title}` : `Aufgabe angelegt: ${a.title}`); setMenue(false);
  };
  const followUp = async (faellig: string) => {
    const f = followUpAusMail(k, z, faellig);
    if (!f) return;
    const r = await post('/api/crm/followup', f);
    meldung(r.d.ok ? `Follow-up für ${faellig.slice(8, 10)}.${faellig.slice(5, 7)}. angelegt: ${f.text}` : String(r.d.fehler ?? 'Follow-up nicht angelegt.'));
    setWann(null); setMenue(false);
  };
  const kontaktAnlegen = async () => {
    const r = await post('/api/crm/anfrage', { aktion: 'anlegen', ...kontaktAusMail(k, heute) });
    meldung(r.d.ok ? String(r.d.text ?? 'Kontakt angelegt.') : String(r.d.fehler ?? 'Kontakt nicht angelegt.'));
    setMenue(false); await post('/api/gmail', { aktion: 'abgleichen' }); await laden(); onGeaendert();
  };

  const kopfZeile = (n: Nachricht) => (
    <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>
      <b style={{ color: C.inkDim }}>{n.kopf.von.name ?? n.kopf.von.email}</b>{n.kopf.von.name ? ` <${n.kopf.von.email}>` : ''} · {datum(n.kopf.am)}
      {n.kopf.an.length > 0 && <> · an {n.kopf.an.slice(0, 3).map(a => a.name ?? a.email).join(', ')}{n.kopf.an.length > 3 ? ` +${n.kopf.an.length - 3}` : ''}{n.kopf.cc.length ? ` (Cc ${n.kopf.cc.length})` : ''}</>}
    </div>
  );
  const taste = (children: React.ReactNode, onClick: () => unknown, leise = true) => <Knopf leise={leise} onClick={onClick}>{children}</Knopf>;

  return (
    <div style={imFenster ? undefined : { padding: '6px 2px 18px 22px', borderBottom: `1px solid ${C.linie}` }} data-gmail="detail">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {z ? (
          <Chip farbe={z.sperre ? LEUCHT.achtung : LEUCHT.gut}>
            <Link href={WEG.akte(z.kontaktId)} style={{ color: 'inherit', textDecoration: 'none' }}>gehört zu {z.name}{z.firma ? ` · ${z.firma}` : ''}{z.dealTitel ? ` · Deal „${z.dealTitel}“` : ''} ›</Link>
          </Chip>
        ) : <Chip farbe={C.inkLeise}>noch keine Person in der Kartei</Chip>}
        {z?.sperre && <Chip farbe={LEUCHT.achtung}>{z.sperre === 'eingeschraenkt' ? 'Verarbeitung eingeschränkt (Art. 18)' : 'Werbesperre'}</Chip>}
        {ungelesen && <Chip farbe={LEUCHT.puls}>ungelesen</Chip>}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {d.thread.map((n, i) => {
          const letzte = i === d.thread.length - 1;
          const auf = letzte || offen === n.kopf.id;
          return (
            <div key={n.kopf.id} style={{ borderTop: i ? `1px solid ${C.linie}` : undefined, paddingTop: i ? 10 : 0 }}>
              <div onClick={() => !letzte && setOffen(auf ? null : n.kopf.id)} style={{ cursor: letzte ? 'default' : 'pointer' }}>
                {kopfZeile(n)}
                {!auf && <div style={{ fontSize: 13, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.kopf.ausschnitt}</div>}
              </div>
              {auf && <div style={{ maxHeight: letzte ? 420 : 280, overflow: 'auto' }}><GmailText text={n.text} bilder={n.kopf.bilder} gekuerzt={n.kopf.gekuerzt} /></div>}
              {auf && n.kopf.anhaenge.filter(a => !a.eingebettet).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {n.kopf.anhaenge.filter(a => !a.eingebettet).map(a => (
                    <a key={a.teil} href={`/api/gmail/anhang?id=${encodeURIComponent(n.kopf.id)}&teil=${encodeURIComponent(a.teil)}`} download rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.05)', color: C.ink, fontSize: 13, textDecoration: 'none', fontFamily: SCHRIFT.text }}>
                      {a.name} <span style={{ color: C.inkLeise, marginLeft: 6 }}>{groesse(a.groesse)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {!antwort && taste('Antworten', () => setAntwort({ allen: false }), false)}
        {!antwort && (k.an.length + k.cc.length > 1) && taste('Allen antworten', () => setAntwort({ allen: true }))}
        {taste('Aufgabe', aufgabe)}
        {taste('Follow-up', () => { if (z) setWann(wann ? null : 'followup'); else meldung('Ein Follow-up hängt an einer Person — erst „Kontakt anlegen“.'); })}
        {taste('Termin', () => setTermin(t => !t))}
        {!z && taste('Kontakt anlegen', kontaktAnlegen)}
        {imPosteingang ? taste('Erledigt (archivieren)', () => markieren('archivieren', 'Archiviert — in Gmail liegt sie unter „Alle Nachrichten“.')) : taste('Zurück in den Posteingang', () => markieren('posteingang', 'Zurück im Posteingang.'))}
        {taste('Mehr ▾', () => setMenue(m => !m))}
      </div>
      {menue && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {ungelesen ? taste('Als gelesen markieren', () => markieren('gelesen', 'Als gelesen markiert.')) : taste('Als ungelesen markieren', () => markieren('ungelesen', 'Als ungelesen markiert.'))}
          <a href={`https://mail.google.com/mail/u/${encodeURIComponent(d.eigene)}/#all/${encodeURIComponent(k.threadId)}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 12px', color: C.inkLeise, fontSize: 13, textDecoration: 'none' }}>In Gmail öffnen ›</a>
        </div>
      )}

      {wann === 'followup' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 13, color: C.inkLeise }}>Wann nachfassen?</span>
          {taste('Morgen', () => followUp(tagIn(1)))}
          {taste('Montag', () => followUp(naechsterMontag()))}
          {taste('In einer Woche', () => followUp(tagIn(7)))}
          <input type="date" value={eigenesDatum} min={heute} onChange={e => setEigenesDatum(e.target.value)} aria-label="Eigenes Datum" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 10px', color: C.ink, fontSize: 16, minHeight: 44 }} />
          {eigenesDatum >= heute && /^\d{4}-\d{2}-\d{2}$/.test(eigenesDatum) && taste('Anlegen', () => followUp(eigenesDatum), false)}
        </div>
      )}

      {termin && (
        <div style={{ marginTop: 10 }}>
          <NeuerTermin vorgabe={terminVorgabe(k, z, heute, person, typeof window === 'undefined' ? '' : window.location.origin)} heute={heute} standardDauer={60} kalender={[]} bereich="business" onZu={() => setTermin(false)}
            onAngelegt={x => { if (x.uid) meldung(x.gaeste ? `Termin angelegt — Einladung an ${x.gaeste} ${x.gaeste === 1 ? 'Person' : 'Personen'} verschickt.` : 'Termin angelegt (Business: im Google Kalender).'); else if (x.aufgabeId) meldung('Aufgabe angelegt.'); }} />
        </div>
      )}

      {antwort && (
        <GmailAntwort key={`${k.id}-${antwort.allen}`} allen={antwort.allen} onZu={() => setAntwort(null)} meldung={meldung}
          onGesendet={() => { setAntwort(null); void laden(); void post('/api/gmail', { aktion: 'abgleichen' }).then(() => onGeaendert()); }}
          d={{ antwortAuf: d.antwortAuf, betreff: k.betreff, empfaenger: d.empfaenger, aliase: d.aliase, eigene: d.eigene }} />
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>{vorText(Math.max(0, Math.floor((Date.now() - Date.parse(k.am)) / 60_000)))} · Gmail bleibt das Original — hier liegt nur eine Kopie zum Lesen, Zuordnen und Antworten.</div>
    </div>
  );
}
