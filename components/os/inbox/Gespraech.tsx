'use client';

// ─── Inbox 2 — ein Gespräch: Nachrichten, „ZOE schlägt vor“, Kontext, Antworten (06.10.2026; vorher GmailDetail) ────────
// Front-Muster: das Gespräch und daneben (bzw. am Handy darunter, eingeklappt) der Kontext — Person/Firma mit Link in die Akte, offene
// Deals, offene Aufgaben zur Person (Aufgaben-Stand im Browser), letzter/nächster Termin (/api/kalender/bezug). Alle Vorschläge sind
// Knöpfe — nichts passiert ohne Klick, und jeder Klick nutzt den bestehenden Schreibweg des Moduls (Aufgaben, Kalender, CRM-Follow-up,
// Kontakt-Anfrage, Beleg lesen → übernehmen, Zuordnen). Text ist reiner Text (nie HTML), Bilder nie geladen, Anhänge nur als Download.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { gespraechPfad } from '@/lib/inbox/strom';
import { aufgabeAusGespraech, followUpAusGespraech, kontaktAusGespraech, spaceVon, terminVorgabe } from '@/lib/inbox/aus-gespraech';
import { FACH_LABEL } from '@/lib/inbox/faecher';
import type { Owner } from '@/types/common';
import { Knopf, Chip, Hinweis, Ueberschrift, Karte, Leer, LEUCHT, useBreit } from '../ui';
import { NeuerTermin } from '../kalender/NeuerTermin';
import { GmailText } from './GmailText';
import { Antwort } from './Antwort';
import { BelegAusMail } from './BelegAusMail';
import { aktion, anhangLink, datumLang, groesse, holen, naechsterMontag, senden, tagIn, type Ansicht } from './daten';

interface AkteTermin { titel: string; start: string; ganztags?: boolean; abgesagt?: boolean }

const KONTEXT_TERMIN = (iso: string, ganztags?: boolean) => new Date(iso.length === 19 ? `${iso}` : iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', ...(ganztags ? {} : { hour: '2-digit', minute: '2-digit' }) });

export function GespraechAnsicht({ id, person, meldung, onGeaendert, onZurueck, startAntwort }: {
  id: string; person: string; meldung: (t: string, rueck?: () => void) => void; onGeaendert: () => void; onZurueck?: () => void; startAntwort?: boolean;
}) {
  const { state, dispatch } = useTasks();
  const breit = useBreit();
  const [a, setA] = useState<Ansicht | null>(null);
  const [fehler, setFehler] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [antwort, setAntwort] = useState<null | { allen: boolean; zoe?: string }>(null);
  const [termin, setTermin] = useState(false);
  const [beleg, setBeleg] = useState(false);
  const [spaeterAuf, setSpaeterAuf] = useState(false);
  const [kontextAuf, setKontextAuf] = useState(false);
  const [termine, setTermine] = useState<{ kommend?: AkteTermin; vergangen?: AkteTermin } | null>(null);
  const heute = localDay();

  const laden = useCallback(async () => {
    const r = await holen<Ansicht>(`/api/inbox/gespraech?id=${encodeURIComponent(id)}`);
    if (!r.d.ok) { setFehler(r.d.fehler ?? 'Das Gespräch ließ sich nicht laden.'); setA(null); return null; }
    setFehler(''); setA(r.d as Ansicht); return r.d as Ansicht;
  }, [id]);

  useEffect(() => {
    setA(null); setOffen(null); setAntwort(startAntwort ? { allen: false } : null); setTermin(false); setBeleg(false); setSpaeterAuf(false); setTermine(null);
    void laden().then(x => {
      // Öffnen = gelesen (zurückgeschrieben an Gmail bzw. IMAP \Seen).
      if (x?.gespraech.ungelesen) void aktion(id, 'gelesen').then(() => onGeaendert());
      const k = x?.kontext.kontakt?.id;
      if (k) void holen<{ kommend?: AkteTermin[]; vergangen?: AkteTermin[] }>(`/api/kalender/bezug?kontakte=${encodeURIComponent(k)}`).then(t => {
        if (t.d.ok) setTermine({ kommend: t.d.kommend?.find(z => !z.abgesagt), vergangen: t.d.vergangen?.find(z => !z.abgesagt) });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (fehler) return <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal laden</Knopf>}>{fehler}</Hinweis>;
  if (!a) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: 8 }}>lädt …</div>;

  const g = a.gespraech;
  const z = g.zuordnung;
  const space = spaceVon(g);
  const tu = async (was: string, extra: Record<string, unknown> = {}, rueck?: string) => {
    const r = await aktion(id, was, extra);
    meldung(r.d.ok ? String(r.d.text ?? 'Erledigt.') : String(r.d.fehler ?? 'Das ging nicht.'), r.d.ok && rueck ? () => { void aktion(id, rueck).then(() => onGeaendert()); } : undefined);
    if (r.d.ok) onGeaendert();
    return r.d.ok;
  };
  const aufgabe = (faellig?: string, titel?: string) => {
    const v = aufgabeAusGespraech(g, faellig);
    const t = (titel ?? v.title).slice(0, 300);
    const link = gespraechPfad(id);
    const schonDa = state.tasks.find(x => x.status !== 'done' && (x.description ?? '').includes(link));
    if (!schonDa) dispatch({ type: 'ADD_TASK', payload: {
      projectId: state.projects[0]?.id ?? '', ...v, title: t, status: 'todo', assignee: person as Owner, tags: [], subTasks: [], dependencies: [], sortOrder: 0,
    } });
    meldung(schonDa ? `Aufgabe gab es schon: ${schonDa.title}` : `Aufgabe angelegt${v.dueDate ? ` bis ${v.dueDate.slice(8, 10)}.${v.dueDate.slice(5, 7)}.` : ''}: ${t}`);
  };
  const followUp = async (faellig: string, text: string) => {
    const f = followUpAusGespraech(g, faellig, text);
    if (!f) { meldung('Ein Follow-up hängt an einer Person — erst „Kontakt anlegen“.'); return; }
    const r = await senden('/api/crm/followup', f);
    meldung(r.d.ok ? `Follow-up am ${faellig.slice(8, 10)}.${faellig.slice(5, 7)}. angelegt.` : String(r.d.fehler ?? 'Follow-up nicht angelegt.'));
  };
  const kontaktAnlegen = async () => {
    const n = [...a.nachrichten].reverse().find(x => !x.vonUns);
    const r = await senden('/api/crm/anfrage', { aktion: 'anlegen', ...kontaktAusGespraech({ ...g, gegenueber: { ...g.gegenueber, name: n?.von.name ?? g.gegenueber.name } }, (n?.text ?? '').slice(0, 300), heute) });
    meldung(r.d.ok ? String(r.d.text ?? 'Kontakt angelegt.') : String(r.d.fehler ?? 'Kontakt nicht angelegt.'));
    if (r.d.ok) { await laden(); onGeaendert(); }
  };
  const vorschlag = (v: Ansicht['vorschlaege'][number]) => {
    if (v.art === 'aufgabe') return aufgabe(v.datum);
    if (v.art === 'termin') return setTermin(true);
    if (v.art === 'beleg') return setBeleg(true);
    if (v.art === 'zuordnen') return void tu('zuordnen', {}, 'loesen').then(() => laden());
    if (v.art === 'deal') return void followUp(tagIn(7), `Deal „${z?.dealTitel ?? ''}“: nachfassen`);
    if (v.art === 'kontakt') return void kontaktAnlegen();
    if (v.art === 'nachfassen') return setAntwort({ allen: false, zoe: 'Freundlich nachfassen, kurz.' });
  };

  const aufgabenZurPerson = z ? state.tasks.filter(t => t.status !== 'done' && t.bezug?.kontaktId === z.kontaktId).slice(0, 4) : [];
  const anhaenge = (n: Ansicht['nachrichten'][number]) => n.anhaenge.filter(x => !x.eingebettet);
  const kopf = (n: Ansicht['nachrichten'][number]) => (
    <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6, overflowWrap: 'anywhere' }}>
      <b style={{ color: n.vonUns ? C.inkDim : C.ink }}>{n.vonUns ? 'Du' : n.von.name ?? n.von.email}</b>{!n.vonUns && n.von.name ? ` <${n.von.email}>` : ''} · {datumLang(n.am)}
      {n.automatisch && <> · <span style={{ color: LEUCHT.achtung }}>automatische Antwort</span></>}
      {n.an.length > 0 && <> · an {n.an.slice(0, 3).map(x => x.name ?? x.email).join(', ')}{n.an.length > 3 ? ` +${n.an.length - 3}` : ''}{n.cc.length ? ` (Cc ${n.cc.length})` : ''}</>}
    </div>
  );

  const kontext: ReactNode = (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift>Kontext</Ueberschrift>
      {a.kontext.kontakt ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <Link href={WEG.akte(a.kontext.kontakt.id)} style={{ color: C.ink, fontWeight: 700, fontSize: TYP.body, textDecoration: 'none', minHeight: 32 }}>{a.kontext.kontakt.name} ›</Link>
          {a.kontext.kontakt.firma && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{a.kontext.kontakt.firma}</div>}
          {a.kontext.kontakt.sperre && <Chip farbe={LEUCHT.achtung}>{a.kontext.kontakt.sperre === 'eingeschraenkt' ? 'Verarbeitung eingeschränkt (Art. 18)' : 'Werbesperre'}</Chip>}
          {g.zugeordnet ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Steht im Verlauf der Akte · <button type="button" onClick={() => void tu('loesen').then(() => laden())} style={{ background: 'none', border: 'none', color: C.inkLeise, textDecoration: 'underline', cursor: 'pointer', fontSize: TYP.bedien, padding: 0, minHeight: 32 }}>lösen</button></span> : null}
        </div>
      ) : <Leer>Noch keine Person in der Kartei.</Leer>}
      {a.kontext.deals.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Offene Deals</div>
          {a.kontext.deals.map(d => <div key={d.id} style={{ fontSize: TYP.bedien, color: C.inkDim }}>{d.titel} · {d.stufe}</div>)}
        </div>
      )}
      {aufgabenZurPerson.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Offene Aufgaben</div>
          {aufgabenZurPerson.map(t => <div key={t.id} style={{ fontSize: TYP.bedien, color: C.inkDim }}>{t.title}{t.dueDate ? ` · bis ${t.dueDate.slice(8, 10)}.${t.dueDate.slice(5, 7)}.` : ''}</div>)}
        </div>
      )}
      {termine && (termine.kommend || termine.vergangen) && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Termine</div>
          {termine.kommend && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Nächster: {termine.kommend.titel} · {KONTEXT_TERMIN(termine.kommend.start, termine.kommend.ganztags)}</div>}
          {termine.vergangen && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Letzter: {termine.vergangen.titel} · {KONTEXT_TERMIN(termine.vergangen.start, termine.vergangen.ganztags)}</div>}
        </div>
      )}
    </div>
  );

  const inhalt = (
    <div data-inbox="gespraech" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, minWidth: 0 }}>
      {onZurueck && !breit && <div><Knopf leise onClick={onZurueck}>‹ Zurück zur Liste</Knopf></div>}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 20, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{g.betreff}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip umbrechen farbe={C.inkDim}>{a.antwort.postfach}{a.antwort.bereichName && !a.antwort.postfach.includes(a.antwort.bereichName) ? ` · ${a.antwort.bereichName}` : ''}</Chip>
          {g.fach !== 'geblockt' && <Chip farbe={g.fach === 'warten' && g.nachfassen ? LEUCHT.achtung : C.inkLeise}>{FACH_LABEL[g.fach]}{g.fach === 'warten' && g.wartetTage !== undefined ? ` · ${g.wartetTage} T.` : ''}</Chip>}
          {z && <Chip umbrechen farbe={z.sperre ? LEUCHT.achtung : LEUCHT.gut}>gehört zu {z.name}{z.firma ? ` · ${z.firma}` : ''}</Chip>}
        </div>
      </div>

      {a.vorschlaege.length > 0 && (
        <div role="group" aria-label="ZOE schlägt vor" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.linie}` }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>ZOE schlägt vor · nur auf Klick</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{a.vorschlaege.map(v => <Knopf key={v.art + v.text} leise onClick={() => vorschlag(v)}>{v.text}</Knopf>)}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        {a.nachrichten.map((n, i) => {
          const letzte = i === a.nachrichten.length - 1;
          const auf = letzte || offen === n.id;
          return (
            <div key={n.id} style={{ borderTop: i ? `1px solid ${C.linie}` : undefined, paddingTop: i ? 10 : 0 }}>
              <div onClick={() => !letzte && setOffen(auf ? null : n.id)} style={{ cursor: letzte ? 'default' : 'pointer' }}>
                {kopf(n)}
                {!auf && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.text.replace(/\s+/g, ' ').slice(0, 200)}</div>}
              </div>
              {auf && <div style={{ maxHeight: letzte ? 480 : 300, overflow: 'auto' }}><GmailText text={n.text} bilder={n.bilder} gekuerzt={n.gekuerzt} /></div>}
              {auf && anhaenge(n).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {anhaenge(n).map(x => (
                    <a key={x.teil} href={anhangLink(g.quelle, n.id, x.teil)} download rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.05)', color: C.ink, fontSize: TYP.bedien, textDecoration: 'none', fontFamily: SCHRIFT.text, overflowWrap: 'anywhere' }}>
                      {x.name} <span style={{ color: C.inkLeise, marginLeft: 6 }}>{groesse(x.groesse)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!antwort && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf onClick={() => setAntwort({ allen: false })}>Antworten</Knopf>
          {(a.antwort.empfaenger.allen.an.length + a.antwort.empfaenger.allen.cc.length > 1) && <Knopf leise onClick={() => setAntwort({ allen: true })}>Allen antworten</Knopf>}
          <Knopf leise onClick={() => void tu('erledigt', {}, 'zurueck').then(ok => { if (ok && onZurueck) onZurueck(); })}>Erledigt</Knopf>
          <Knopf leise onClick={() => setSpaeterAuf(x => !x)}>Später ▾</Knopf>
          <Knopf leise onClick={() => void tu(g.ungelesen ? 'gelesen' : 'ungelesen')}>{g.ungelesen ? 'Gelesen' : 'Ungelesen'}</Knopf>
          {!z && g.fach !== 'info' && <Knopf leise onClick={() => void kontaktAnlegen()}>Kontakt anlegen</Knopf>}
          {!(a.vorschlaege.some(v => v.art === 'aufgabe')) && <Knopf leise onClick={() => aufgabe()}>Aufgabe</Knopf>}
          {!(a.vorschlaege.some(v => v.art === 'termin')) && <Knopf leise onClick={() => setTermin(t => !t)}>Termin</Knopf>}
        </div>
      )}
      {spaeterAuf && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wieder vorlegen:</span>
          {([['Morgen', tagIn(1)], ['Montag', naechsterMontag()], ['In einer Woche', tagIn(7)]] as const).map(([l, d]) => <Knopf key={l} leise onClick={() => { setSpaeterAuf(false); void tu('spaeter', { bis: d }, 'zurueck').then(ok => { if (ok && onZurueck) onZurueck(); }); }}>{l}</Knopf>)}
        </div>
      )}
      {termin && (
        <NeuerTermin vorgabe={terminVorgabe(g, heute, person, typeof window === 'undefined' ? '' : window.location.origin)}
          heute={heute} standardDauer={60} kalender={[]} bereich={space} onZu={() => setTermin(false)}
          onAngelegt={x => { setTermin(false); meldung(x.uid ? (x.gaeste ? `Termin angelegt — Einladung an ${x.gaeste} ${x.gaeste === 1 ? 'Person' : 'Personen'} verschickt.` : 'Termin angelegt.') : 'Angelegt.'); }} />
      )}
      {beleg && <BelegAusMail quelle={g.quelle} bereich={g.bereich} vorschlag={a.vorschlaege.find(v => v.art === 'beleg')?.anhang} onZu={() => setBeleg(false)} meldung={meldung} />}
      {antwort && (
        <Antwort key={`${id}-${antwort.allen}`} allen={antwort.allen} onZu={() => setAntwort(null)} meldung={t => meldung(t)}
          onGesendet={() => { setAntwort(null); void laden(); onGeaendert(); }}
          v={{ gespraech: id, betreff: g.betreff, empfaenger: a.antwort.empfaenger, von: a.antwort.von, signatur: a.antwort.signatur, hinweis: a.antwort.hinweis, postfach: a.antwort.postfach, bereichName: a.antwort.bereichName, ...(antwort.zoe ? { start: { zoeHinweis: antwort.zoe } } : {}) }} />
      )}
    </div>
  );

  // Eigenes Raster mit minmax(0, …): lange Zeilen (Adressen, Ausschnitte) dürfen die Kontext-Spalte nie überlappen.
  if (breit) return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 16, alignItems: 'start' }}>{inhalt}<Karte flach i={0}>{kontext}</Karte></div>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {inhalt}
      <Karte flach i={0}>
        <button type="button" onClick={() => setKontextAuf(x => !x)} aria-expanded={kontextAuf} style={{ background: 'none', border: 'none', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, cursor: 'pointer', minHeight: 44, padding: 0, width: '100%', textAlign: 'left' }}>
          {kontextAuf ? 'Kontext ausblenden' : `Kontext${z ? ` · ${z.name}` : ''} ›`}
        </button>
        {kontextAuf && kontext}
      </Karte>
    </div>
  );
}
