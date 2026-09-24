'use client';

import { localDay } from '@/lib/zeit';

// ─── MAKE OS — Meeting-Agent ────────────────────────────────────────────────
// Mitschrift rein → Zusammenfassung, Entscheidungen, Action-Items. Jedes
// Action-Item wird auf Klick eine echte Aufgabe. Der Skriptverlauf bleibt
// liegen, mit Termin verknüpft.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile aus schlank).

import { useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, feld, prioFarbe, LEUCHT } from './schlank';

interface ActionItem { titel: string; owner: string; prio: string; projectId: string; due?: string; }
interface Protokoll { titel: string; zusammenfassung: string; entscheidungen: string[]; actionItems: ActionItem[]; }
interface Termin { id: string; title?: string; startDate?: string }
interface Meeting {
  id: string; datum: string; titel: string; terminTitel?: string;
  zusammenfassung?: string; entscheidungen?: string[];
  aufgaben?: { text: string; wer?: string; frist?: string }[];
  transcript?: string;
}

const PROJECTS: Record<string, string> = {
  'proj-ig': 'IG', 'proj-capos': 'CapOS', 'proj-kdm': 'Holding', 'proj-health': 'Gesundheit', 'proj-make': 'MAKE.One', 'proj-privat': 'Privat',
};
const ownerLabel = (o: string) => (o === 'both' ? 'Ma+Ke' : o === 'malin' ? 'Malin' : 'Kevin');
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
const auswahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', maxWidth: '100%' };

export function MeetingView() {
  const [transcript, setTranscript] = useState('');
  const [prot, setProt] = useState<Protokoll | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<Record<number, 'ok' | 'busy' | 'err'>>({});
  // Skriptverlauf: was schon protokolliert wurde, plus die Termine von heute,
  // damit ein Protokoll an den richtigen Termin gehängt wird.
  const [verlauf, setVerlauf] = useState<Meeting[]>([]);
  const [termine, setTermine] = useState<Termin[]>([]);
  const [gewaehlterTermin, setGewaehlterTermin] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [offenesProtokoll, setOffenesProtokoll] = useState<string | null>(null);

  const ladeVerlauf = () => {
    fetch('/api/state/meetings').then(r => r.json()).then(d => setVerlauf(d.meetings ?? [])).catch(() => {});
  };
  useEffect(() => {
    ladeVerlauf();
    // Die Termine kommen aus dem Apple-Kalender — dort wird gepflegt, hier
    // nur gelesen und verknüpft.
    fetch('/api/apple-calendar').then(r => r.json()).then((e: Termin[]) => {
      const heute = localDay();
      setTermine((Array.isArray(e) ? e : []).filter(t => (t.startDate ?? '').slice(0, 10) === heute));
    }).catch(() => {});
  }, []);

  async function evaluate() {
    if (transcript.trim().length < 20 || busy) return;
    setBusy(true); setErr(''); setProt(null); setCreated({});
    try {
      const r = await fetch('/api/meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, datum: localDay() }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else {
        const p = { titel: d.titel, zusammenfassung: d.zusammenfassung, entscheidungen: d.entscheidungen ?? [], actionItems: d.actionItems ?? [] };
        setProt(p);
        // Kevins Ansage: der Skriptverlauf soll bleiben. Also sofort ablegen —
        // samt Termin, wenn einer an diesem Tag dazu passt.
        const termin = termine.find(t => t.id === gewaehlterTermin);
        const id = `mt-${Date.now().toString(36)}`;
        setMeetingId(id);
        fetch('/api/state/meetings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id, datum: localDay(), titel: p.titel, transcript,
            zusammenfassung: p.zusammenfassung, entscheidungen: p.entscheidungen,
            aufgaben: p.actionItems.map((a: ActionItem) => ({ text: a.titel, wer: ownerLabel(a.owner), frist: a.due })),
            terminId: termin?.id, terminTitel: termin?.title,
          }), keepalive: true,
        }).then(() => ladeVerlauf()).catch(() => {});
      }
    } catch { setErr('Auswertung gerade nicht möglich.'); }
    setBusy(false);
  }

  async function toTask(it: ActionItem, i: number) {
    setCreated(c => ({ ...c, [i]: 'busy' }));
    try {
      const r = await fetch('/api/tasks/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: it.titel, description: `Aus Meeting „${prot?.titel ?? ''}" übernommen.`, projectId: it.projectId, owner: it.owner, priority: it.prio, dueDate: it.due }),
      });
      const d = await r.json();
      setCreated(c => ({ ...c, [i]: d.ok ? 'ok' : 'err' }));
    } catch { setCreated(c => ({ ...c, [i]: 'err' })); }
  }

  async function allToTasks() {
    if (!prot) return;
    for (let i = 0; i < prot.actionItems.length; i++) {
      if (created[i] !== 'ok') await toTask(prot.actionItems[i], i);
    }
  }

  const kannAuswerten = !busy && transcript.trim().length >= 20;

  return (
    <Seite
      titel="Vom Gespräch zu Aufgaben."
      unter={<>Transkript oder Notizen einfügen — der Agent macht Zusammenfassung, Entscheidungen und Action-Items daraus. Jedes Action-Item übernimmst du <b style={{ color: C.ink }}>auf Klick in deine echten Aufgaben</b>. <span style={{ color: C.inkLeise }}>(Auto-Mitschrift via Granola/Fireflies kommt als Zusatz.)</span></>}
      rechts={<Chip farbe={LEUCHT.agenten}>live · Entwurf</Chip>}
    >
      <Karte i={0} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten}>Mitschrift</Ueberschrift>
        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={7} placeholder="Meeting-Transkript oder Notizen hier einfügen …" style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
        {/* Zu welchem Termin gehört das? Der Kalender bleibt die Pflegebasis. */}
        {!!termine.length && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <span style={mikro}>Termin heute</span>
            <select value={gewaehlterTermin} onChange={e => setGewaehlterTermin(e.target.value)} aria-label="Termin zuordnen" style={auswahl}>
              <option value="">— ohne Termin</option>
              {termine.map(t => (
                <option key={t.id} value={t.id}>
                  {(t.startDate ?? '').slice(11, 16)} · {t.title ?? 'Termin'}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <Knopf onClick={evaluate} aus={!kannAuswerten} farbe={LEUCHT.agenten}>{busy ? 'werte aus …' : 'Meeting auswerten'}</Knopf>
          {err && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{err}</span>}
        </div>
      </Karte>

      {prot && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.agenten}>Protokoll</Ueberschrift>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink, marginBottom: 8, letterSpacing: '-.01em' }}>{prot.titel}</div>
          <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55 }}>{prot.zusammenfassung}</div>
        </Karte>
      )}

      {prot && !!prot.entscheidungen.length && (
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.gut}>Entscheidungen</Ueberschrift>
          {prot.entscheidungen.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, padding: '4px 0' }}>
              <span style={{ color: LEUCHT.gut, fontWeight: 700, flex: '0 0 auto' }}>✓</span><span>{e}</span>
            </div>
          ))}
        </Karte>
      )}

      {prot && !!prot.actionItems.length && (
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.planung} rechts={<Knopf leise onClick={allToTasks}>Alle übernehmen</Knopf>}>Action-Items ({prot.actionItems.length})</Ueberschrift>
          <Liste>
            {prot.actionItems.map((it, i) => (
              <Zeile key={i}
                links={<Chip farbe={prioFarbe(it.prio)}>{it.prio}</Chip>}
                titel={it.titel}
                unter={[ownerLabel(it.owner), PROJECTS[it.projectId] ?? it.projectId, it.due].filter(Boolean).join(' · ')}
                rechts={
                  <Knopf leise={created[i] !== 'err'} farbe={created[i] === 'err' ? LEUCHT.kritisch : undefined} onClick={() => toTask(it, i)} aus={created[i] === 'busy' || created[i] === 'ok'}>
                    {created[i] === 'ok' ? '✓ Aufgabe' : created[i] === 'busy' ? '…' : created[i] === 'err' ? 'Fehler' : '→ Aufgabe'}
                  </Knopf>
                }
              />
            ))}
          </Liste>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10 }}>Übernommene Aufgaben landen in deinen echten Aufgaben (/os/aufgaben).</div>
        </Karte>
      )}

      {/* ── SKRIPTVERLAUF ─────────────────────────────────────────────────
          Kevins Ansage: jedes Skript, in dem ihr wart, soll dahinterliegen.
          Vorher war jedes Protokoll nach der Sitzung weg. */}
      <Karte i={prot ? 4 : 1}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={verlauf.length ? `${verlauf.length} Protokoll${verlauf.length === 1 ? '' : 'e'}` : undefined}>Skriptverlauf</Ueberschrift>
        {!verlauf.length && <Leer>Noch nichts protokolliert. Ab jetzt bleibt jede Auswertung hier liegen.</Leer>}
        {!!verlauf.length && <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Bleiben liegen, mit Termin verknüpft.</div>}
        <Liste>
          {verlauf.map(m => {
            const auf = offenesProtokoll === m.id;
            return (
              <div key={m.id}>
                <Zeile onClick={() => setOffenesProtokoll(auf ? null : m.id)} aktiv={auf}
                  links={<span style={{ fontSize: 12, color: C.inkLeise, width: 46, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{m.datum.slice(8)}.{m.datum.slice(5, 7)}.</span>}
                  titel={m.titel}
                  unter={m.terminTitel ? `⌛ ${m.terminTitel}` : undefined}
                  rechts={<span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{(m.aufgaben ?? []).length} Aufgaben<span>{auf ? '▾' : '▸'}</span></span>}
                />
                {auf && (
                  <div style={{ padding: '10px 2px 16px 60px' }}>
                    {m.zusammenfassung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 8 }}>{m.zusammenfassung}</div>}
                    {!!m.entscheidungen?.length && (
                      <ul style={{ margin: '0 0 8px', paddingLeft: 17 }}>
                        {m.entscheidungen.map((e, i) => <li key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>{e}</li>)}
                      </ul>
                    )}
                    {(m.aufgaben ?? []).map((a, i) => (
                      <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, padding: '2px 0' }}>
                        ◇ {a.text}{a.wer ? <span style={{ color: C.inkLeise }}> · {a.wer}</span> : null}{a.frist ? <span style={{ color: C.inkLeise }}> · {a.frist}</span> : null}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {m.transcript && (
                        <details style={{ fontSize: 12, color: C.inkLeise, flex: 1, minWidth: 200 }}>
                          <summary style={{ cursor: 'pointer' }}>Skript nachlesen</summary>
                          <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, maxHeight: 260, overflowY: 'auto', fontSize: 12, color: C.inkDim, lineHeight: 1.5 }}>{m.transcript}</div>
                        </details>
                      )}
                      <span style={{ marginLeft: 'auto' }}>
                        <Knopf leise onClick={() => {
                          fetch(`/api/state/meetings?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' })
                            .then(() => setVerlauf(v => v.filter(x => x.id !== m.id))).catch(() => {});
                        }}>Protokoll löschen</Knopf>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Liste>
      </Karte>
    </Seite>
  );
}
