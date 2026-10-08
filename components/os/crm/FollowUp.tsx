'use client';

// ─── Markttraktion · Follow-up (27.09.) ─────────────────────────────────────
// Kevin: „Die ganze Follow-up-Ebene muss sauber eingepflegt werden.“ Eine Liste,
// in der nichts runterfällt: Zusagen (nächster Schritt), Wiedervorlagen, Deal-
// Schritte, Nachfassen nach Events, Reviews und die Kadenz je Kreis — überfällig,
// heute, diese Woche, später. Jede Zeile lässt sich mit einem Klick erledigen
// (Ergebnis + nächstes Follow-up), verschieben (1/3/7 Tage) oder absagen. Die
// Logik liegt in lib/crm/followup.ts, die Regeln in /api/crm/followup.
// 29.09. (#99, Follow-up = Aufgabe): offene Aufgaben mit CRM-Bezug und Deadline stehen mit in der Liste (Zeile „Aufgabe“,
// Haken erledigt sie, der Titel öffnet sie) — eine Wahrheit; Aufgaben, an denen schon ein Follow-up hängt, nicht doppelt.

import { localDay } from '@/lib/zeit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { anzeigename } from '@/lib/make-one/crm';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, LEUCHT, feld, Haken, useRueckfrage } from '../ui';
import { useAbgleich } from '@/hooks/useAbgleich';
import { type CrmApi, holeMitStand, datum, plusTage } from './daten';
import { Pillen, Feldzeile, ERGEBNIS_KNOEPFE } from './teile';
import { Wahl } from './Wahl';
import { wertelistenVollstaendig } from '@/lib/crm/wertelisten';
import { Person, ZustaendigWahl, WerFilter, useWerFilter, passtWer } from './team';
import { TEAM, BEIDE } from '@/lib/crm/team';
import { FOLLOWUP_ARTEN, VERSCHIEBEN_TAGE, type Faellig, type Gruppe } from '@/lib/crm/followup';
import type { FollowUpArt } from '@/lib/crm/typen';
import type { FollowupAnsicht } from '@/lib/crm/adresse';
import { KREIS_TAKT, type Kreis } from '@/lib/make-one/crm';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import Link from 'next/link';
import { useTasks } from '@/context/TasksContext';
import { aufgabenAlsFaellig, type AufgabeFaellig } from '@/lib/crm/followup-aufgabe';
import { WEG, eventLink } from '@/lib/wege';
import { useRouter } from 'next/navigation';

interface Antwort { ok: boolean; heute: string; liste: Faellig[]; zahlen: Record<Gruppe, number> & { gesamt: number }; puenktlich: { erledigt: number; puenktlich: number; verpasst: number; quote: number | null } }

const GRUPPEN: { id: Gruppe; label: string; farbe: string }[] = [
  { id: 'ueberfaellig', label: 'Überfällig', farbe: LEUCHT.kritisch }, { id: 'heute', label: 'Heute', farbe: LEUCHT.achtung },
  { id: 'woche', label: 'Diese Woche', farbe: LEUCHT.business }, { id: 'spaeter', label: 'Später', farbe: C.inkLeise },
];
const QUELLE_LABEL: Record<string, string> = {
  hand: 'von Hand', regel: 'Regel', kadenz: 'Kadenz', kampagne: 'Kampagne', event: 'Event', head: 'Head', zoe: 'ZOE', deal: 'Deal',
  schritt: 'Zusage', wiedervorlage: 'Wiedervorlage', dealschritt: 'Deal-Schritt', dealwiedervorlage: 'Deal-Wiedervorlage', nachfassen: 'Nachfassen', review: 'Review',
};
const ART_LABEL = Object.fromEntries(FOLLOWUP_ARTEN.map(a => [a.id, a.label])) as Record<FollowUpArt, string>;

/** Antwort einer Follow-up-Aktion — `ok: false` mit Text, wenn nichts gespeichert wurde. */
export type FollowupAntwort = { ok: boolean; fehler?: string; hinweis?: string; text?: string };

export function useFollowups() {
  const [d, setD] = useState<Antwort | null>(null);
  // Zwei Fehler getrennt (08.10., Sofort-Paket 4.2): der Fehler einer AKTION bleibt stehen, bis die nächste Aktion gelingt — vorher
  // löschte das sofort folgende Neuladen (auch bei 304) ihn nach Sekundenbruchteilen. Der Ladefehler gilt nur bis zum nächsten Laden.
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);
  const staende = useRef(new Map<string, string>());
  const laden = useCallback(async () => {
    try { const r = await holeMitStand<Antwort>('/api/crm/followup', staende.current); if (r?.ok) setD(r); setLadeFehler(null); }
    catch { setLadeFehler('Follow-ups nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useAbgleich(laden, { alle: 20_000 });
  const aktion = useCallback(async (body: Record<string, unknown>): Promise<FollowupAntwort> => {
    const r = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' })) as FollowupAntwort;
    if (!r?.ok) { setAktionFehler(r?.fehler ?? 'Nicht gespeichert.'); return { ok: false, fehler: r?.fehler ?? 'Nicht gespeichert.' }; }
    setAktionFehler(null);
    staende.current.clear();
    void laden();
    return r;
  }, [laden]);
  return { d, fehler: aktionFehler ?? ladeFehler, laden, aktion, fehlerWeg: () => setAktionFehler(null) };
}

/** Fehler direkt am Formular — die Eingabe bleibt stehen (4.2). */
function FormFehler({ text }: { text: string | null }) {
  return text ? <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, lineHeight: 1.5 }}>{text} — die Eingabe bleibt stehen.</div> : null;
}

/** „Event öffnen“: ein besuchtes Event führt in die Event-Akte, ein Make.One-Abend in Make.One (M10). */
const eventHrefVon = (api: CrmApi) => (id: string) => eventLink(api.crm?.stand.events.find(e => e.id === id) ?? { id });

export function FollowUp({ api, ansicht, zuKontakt, zuDeal, zuAkte }: { api: CrmApi; ansicht: FollowupAnsicht; zuKontakt: (id: string) => void; zuDeal: (id: string) => void; zuAkte: (id: string) => void }) {
  const { d, fehler, laden, aktion, fehlerWeg } = useFollowups();
  const eventHref = useMemo(() => eventHrefVon(api), [api.crm]); // eslint-disable-line react-hooks/exhaustive-deps
  const [wahl, setWahl] = useWerFilter('followup');
  const [neu, setNeu] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const ich = api.ich;
  // Eigene Gesprächsergebnisse aus Stammdaten › Wertelisten (die festen lösen die Regeln aus, eigene sind Freitext).
  const eigene = useMemo(() => wertelistenVollstaendig(api.crm?.stand.wertelisten).ergebnisse.filter(e => !e.fest).map(e => ({ wert: e.wert, label: e.label })), [api.crm?.stand.wertelisten]);
  const liste = useMemo(() => (d?.liste ?? []).filter(f => passtWer(wahl, f.zustaendig, 'sales', ich)), [d, wahl, ich]);
  // Aufgaben mit CRM-Bezug (#99) — ohne die, an denen ein offenes Follow-up hängt (die stehen schon als Follow-up da).
  const { state: aufgabenStand, dispatch } = useTasks();
  const aufgaben = useMemo(() => {
    const verknuepft = new Set((api.crm?.stand.followups ?? []).filter(f => f.status === 'offen' && f.aufgabeId).map(f => f.aufgabeId!));
    return aufgabenAlsFaellig(aufgabenStand.tasks, d?.heute ?? localDay()).filter(a => !verknuepft.has(a.aufgabeId) && passtWer(wahl, a.zustaendig, 'sales', ich));
  }, [aufgabenStand.tasks, api.crm?.stand.followups, d?.heute, wahl, ich]);
  const aufgabeGruppe = (a: AufgabeFaellig, heute: string): Gruppe => (a.faellig < heute ? 'ueberfaellig' : a.faellig === heute ? 'heute' : a.faellig <= plusTage(heute, 7) ? 'woche' : 'spaeter');
  const zahlen = useMemo(() => {
    const alle = d?.liste ?? [];
    const z: Record<string, number> = { alle: alle.length };
    for (const p of TEAM.map(t => t.id)) z[p] = alle.filter(f => f.zustaendig === p || f.zustaendig === BEIDE).length;
    if (ich) z.ich = z[ich] ?? 0;
    return z;
  }, [d, ich]);
  /** Eine Aktion — die Antwort geht an den Aufrufer zurück: nur bei `ok` schließt ein Formular (4.2). */
  const nachAktion = async (body: Record<string, unknown>): Promise<FollowupAntwort> => {
    const r = await aktion(body);
    if (!r.ok) return r;
    if (r.hinweis) setHinweis(r.hinweis); else if (r.text) setHinweis(r.text);
    void api.laden();
    return r;
  };
  if (!d) return <Karte i={0}>{fehler ? <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler} <Knopf leise onClick={() => void laden()}>Noch einmal</Knopf></div> : <Leer>Lädt …</Leer>}</Karte>;

  return (
    <>
      <Karte i={0} ton={LEUCHT.business}>
        <Ueberschrift rechts={<Knopf haupt onClick={() => setNeu(!neu)}>{neu ? 'Schließen' : '+ Follow-up'}</Knopf>}>Was dran ist</Ueberschrift>
        <Raster min={130}>
          {GRUPPEN.map(g => { const n = liste.filter(f => f.gruppe === g.id).length + aufgaben.filter(a => aufgabeGruppe(a, d.heute) === g.id).length; return <Zahl key={g.id} wert={String(n)} label={g.label} farbe={n ? g.farbe : undefined} />; })}
          <Zahl wert={d.puenktlich.quote !== null ? `${d.puenktlich.quote} %` : `${d.puenktlich.puenktlich} · ${d.puenktlich.erledigt}`} label={d.puenktlich.quote !== null ? 'pünktlich · 30 Tage' : 'pünktlich · erledigt (Quote ab 5)'} farbe={d.puenktlich.quote !== null ? (d.puenktlich.quote >= 80 ? LEUCHT.gut : d.puenktlich.quote >= 60 ? LEUCHT.achtung : LEUCHT.kritisch) : undefined} />
        </Raster>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Zusagen, Wiedervorlagen, Deal-Schritte, Nachfassen, Reviews und Kadenz — an einer Stelle. Erledigt schreibt eine Aktivität an die Person.</span>
        </div>
        {hinweis && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkDim }}>{hinweis} <button onClick={() => setHinweis(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>}
        {fehler && <div role="alert" style={{ marginTop: 8, fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler} <button onClick={fehlerWeg} aria-label="Meldung schließen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>}
        {neu && <NeuesFollowUp api={api} onFertig={async body => { const r = await nachAktion({ aktion: 'anlegen', ...body }); if (r.ok) setNeu(false); return r; }} onAbbruch={() => setNeu(false)} />}
      </Karte>

      {ansicht === 'faellig' && GRUPPEN.map((g, i) => {
        const l = liste.filter(f => f.gruppe === g.id);
        const la = aufgaben.filter(a => aufgabeGruppe(a, d.heute) === g.id);
        if (!l.length && !la.length && g.id === 'spaeter') return null;
        return (
          <Karte key={g.id} i={i + 1} akzent={(l.length || la.length) && g.id !== 'spaeter' ? g.farbe : undefined}>
            <Ueberschrift farbe={g.farbe} rechts={`${l.length + la.length}`}>{g.label}</Ueberschrift>
            {l.length || la.length ? <Liste>
              {l.map(f => <FollowUpZeile key={f.id} f={f} heute={d.heute} zuKontakt={zuKontakt} zuDeal={zuDeal} zuAkte={zuAkte} aktion={nachAktion} eigene={eigene} eventHref={eventHref} />)}
              {la.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', minHeight: 44 }}>
                  <Haken an={false} label={a.titel} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: a.aufgabeId } })} />
                  <Chip farbe={LEUCHT.achtung}>Aufgabe</Chip>
                  <Link href={WEG.aufgabe(a.aufgabeId)} style={{ flex: 1, minWidth: 0, color: C.ink, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titel}</Link>
                  {a.kontaktId && <button onClick={() => zuKontakt(a.kontaktId!)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>Kontakt ›</button>}
                  <span style={{ fontSize: TYP.bedien, color: a.tageUeber ? LEUCHT.kritisch : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{a.tageUeber ? `! ${datum(a.faellig, d.heute)}` : datum(a.faellig, d.heute)}</span>
                </div>
              ))}
            </Liste>
              : <Leer>{g.id === 'ueberfaellig' ? 'Nichts überfällig — so soll es sein.' : g.id === 'heute' ? 'Heute nichts fällig.' : 'Diese Woche nichts weiter.'}</Leer>}
          </Karte>
        );
      })}

      {ansicht === 'woche' && <Wochenansicht liste={liste} heute={d.heute} zuKontakt={zuKontakt} zuDeal={zuDeal} zuAkte={zuAkte} aktion={nachAktion} eventHref={eventHref} />}
      {ansicht === 'kadenz' && <Kadenz api={api} liste={liste} heute={d.heute} zuKontakt={zuKontakt} aktion={nachAktion} />}
    </>
  );
}

function FollowUpZeile({ f, heute, zuKontakt, zuDeal, zuAkte, aktion, eigene = [], eventHref }: { f: Faellig; heute: string; zuKontakt: (id: string) => void; zuDeal: (id: string) => void; zuAkte: (id: string) => void; aktion: (b: Record<string, unknown>) => Promise<FollowupAntwort>; eigene?: { wert: string; label: string }[]; /** Wohin „Event öffnen“ führt (besuchtes Event → Event-Akte, Make.One → Make.One) — der Aufrufer kennt die Events. */ eventHref?: (id: string) => string }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [erledigen, setErledigen] = useState(false);
  const { bestaetigen, dialog } = useRueckfrage();
  const farbe = GRUPPEN.find(g => g.id === f.gruppe)!.farbe;
  const ziel = () => (f.bezug.art === 'chance' ? zuDeal(f.bezug.id) : f.kontaktId ? zuAkte(f.kontaktId) : undefined);
  return (
    <div>
      <Zeile onClick={() => setOffen(!offen)} aktiv={offen} links={<Punkt farbe={farbe} />}
        titel={<><span>{f.name}</span>{f.firma && f.firma !== f.name && <span style={{ color: C.inkLeise }}> · {f.firma}</span>}</>}
        unter={<>{ART_LABEL[f.art]} · {f.text}{f.bezug.titel && f.bezug.art !== 'kontakt' ? <span style={{ color: C.inkLeise }}> · {f.bezug.titel}</span> : null}</>}
        rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip farbe={f.virtuell ? C.inkLeise : LEUCHT.business}>{QUELLE_LABEL[f.quelle] ?? f.quelle}</Chip>
          <span style={{ fontSize: TYP.bedien, color: f.gruppe === 'ueberfaellig' ? LEUCHT.kritisch : C.inkDim, whiteSpace: 'nowrap' }}>{datum(f.faellig, heute)}{f.uhrzeit ? ` ${f.uhrzeit}` : ''}{f.tageUeber > 0 ? ` · ${f.tageUeber} T` : ''}</span>
          <Person id={f.zustaendig} groesse={18} />
        </span>} />
      {offen && (
        <div style={{ padding: '8px 2px 14px', display: 'grid', gap: 10, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf farbe={LEUCHT.gut} onClick={() => setErledigen(!erledigen)}>✓ Erledigt</Knopf>
            {VERSCHIEBEN_TAGE.map(t => <Knopf key={t} leise onClick={() => void aktion({ aktion: 'verschieben', id: f.id, tage: t })}>+{t} {t === 1 ? 'Tag' : 'Tage'}</Knopf>)}
            {f.quelle !== 'dealschritt' && f.quelle !== 'dealwiedervorlage' && <Knopf leise onClick={async () => { if (await bestaetigen(f.quelle === 'nachfassen' ? { titel: 'Nachfassen bewusst auslassen?', text: 'Der Gast verschwindet aus der Liste, zählt aber nicht als nachgefasst.', ja: 'Auslassen' } : { titel: 'Follow-up absagen?', text: 'Die Person bleibt, nur diese Zusage fällt weg.', ja: 'Absagen', gefahr: true })) void aktion({ aktion: 'absagen', id: f.id }); }}>{f.quelle === 'nachfassen' ? 'Auslassen' : 'Absagen'}</Knopf>}
            <span style={{ flex: 1 }} />
            {f.kontaktId && <Knopf leise onClick={() => zuKontakt(f.kontaktId!)}>Person</Knopf>}
            {f.bezug.art === 'event' && <Knopf leise onClick={() => router.push(eventHref ? eventHref(f.bezug.id) : eventLink({ id: f.bezug.id }))}>Event öffnen</Knopf>}
            {(f.bezug.art === 'chance' || f.kontaktId) && <Knopf leise onClick={ziel}>{f.bezug.art === 'chance' ? 'Deal öffnen' : 'Kontakt öffnen'}</Knopf>}
          </div>
          {f.verschoben ? <div style={{ fontSize: TYP.bedien, color: f.verschoben >= 3 ? LEUCHT.kritisch : C.inkLeise }}>{f.verschoben}× verschoben{f.verschoben >= 3 ? ' — ehrlicherweise keine Zusage mehr.' : ''}</div> : null}
          {erledigen && <Erledigen f={f} heute={heute} eigene={eigene} onFertig={async b => { const r = await aktion({ aktion: 'erledigen', id: f.id, ...b }); if (r.ok) { setErledigen(false); setOffen(false); } return r; }} onAbbruch={() => setErledigen(false)} />}
        </div>
      )}
      {dialog}
    </div>
  );
}

/**
 * Erledigen: Ergebnis (setzt Stufe/Wiedervorlage per Regel), kurze Notiz, und — Pflichtfrage — was als Nächstes passiert.
 * Exportiert (08.10., Woche 1 · 4.5): Kontakt › Aktivitäten nimmt DASSELBE Formular — vorher endete „✓ Erledigt“ dort bei einem
 * Deal-Schritt immer mit 400 (ohne „Als Nächstes“) und ohne Notiz.
 */
export function Erledigen({ f, heute, onFertig, onAbbruch, eigene = [] }: { f: Faellig; heute: string; onFertig: (b: Record<string, unknown>) => Promise<FollowupAntwort>; onAbbruch: () => void; /** Eigene Gesprächsergebnisse aus den Stammdaten (Wertelisten). */ eigene?: { wert: string; label: string }[] }) {
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [notiz, setNotiz] = useState('');
  // Vorgabe wie in der Pipeline: Deals in drei Tagen weiter, alles andere in einer Woche.
  const [naechster, setNaechster] = useState<{ text: string; faellig: string; art: FollowUpArt }>({ text: '', faellig: plusTage(heute, f.bezug.art === 'chance' ? 3 : 7), art: f.art });
  const [kein, setKein] = useState(false);
  const bereit = kein || (naechster.text.trim() && naechster.faellig);
  // 4.9 (08.10.): „Sperre“ fragt nach — wie in der Power Hour (die Person taucht danach nirgends mehr auf).
  const { bestaetigen, dialog } = useRueckfrage();
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      {f.kontaktId && (
        <Feldzeile label="Ergebnis">
          <Pillen liste={[...ERGEBNIS_KNOEPFE.map(e => ({ id: e.id as string, label: e.label })), ...eigene.map(e => ({ id: e.wert, label: e.label }))]} aktiv={ergebnis} onWahl={setErgebnis} farbe={LEUCHT.gut} />
        </Feldzeile>
      )}
      <Feldzeile label="Notiz"><input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Ein Satz, was besprochen wurde" style={{ ...feld }} /></Feldzeile>
      <Feldzeile label="Als Nächstes">
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={naechster.text} onChange={e => setNaechster({ ...naechster, text: e.target.value })} placeholder="Was passiert als Nächstes?" disabled={kein} style={{ ...feld, flex: 1, minWidth: 200 }} />
            <input type="date" value={naechster.faellig} onChange={e => setNaechster({ ...naechster, faellig: e.target.value })} disabled={kein} style={{ ...feld, width: 150 }} aria-label="Datum" />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Wahl label="Art" liste={FOLLOWUP_ARTEN} wert={naechster.art} onWahl={art => setNaechster({ ...naechster, art })} aus={kein} />
            {f.quelle === 'dealwiedervorlage' ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Das Datum wird die nächste Wiedervorlage am geparkten Deal; der Text steht danach in der Notiz dieses Follow-ups.</span>
              : f.bezug.art !== 'chance' ? <label style={{ fontSize: TYP.bedien, color: C.inkLeise, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={kein} onChange={e => setKein(e.target.checked)} /> kein nächster Schritt (bewusst)</label> : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Beim Deal ist der nächste Schritt Pflicht (Deal-Regel).</span>}
          </div>
        </div>
      </Feldzeile>
      <FormFehler text={fehler} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf farbe={LEUCHT.gut} aus={!bereit} onClick={async () => { if (!bereit) return; if (ergebnis === 'sperre' && !(await bestaetigen({ titel: `${f.name} widerspricht Werbung?`, text: 'Die Person wird gesperrt und taucht nirgends mehr auf.', ja: 'Sperren', gefahr: true }))) return; const r = await onFertig({ ...(ergebnis ? { ergebnis } : {}), ...(notiz.trim() ? { notiz: notiz.trim() } : {}), ...(kein ? {} : { naechster }) }); setFehler(r.ok ? null : r.fehler ?? 'Nicht gespeichert.'); }}>Erledigt</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
      {dialog}
    </div>
  );
}

function NeuesFollowUp({ api, onFertig, onAbbruch }: { api: CrmApi; onFertig: (b: Record<string, unknown>) => Promise<FollowupAntwort>; onAbbruch: () => void }) {
  const heute = api.crm?.heute ?? localDay();
  const [fehler, setFehler] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [kontaktId, setKontaktId] = useState<string | null>(null);
  const [art, setArt] = useState<FollowUpArt>('anruf');
  const [text, setText] = useState('');
  const [faellig, setFaellig] = useState(plusTage(heute, 1));
  const [uhrzeit, setUhrzeit] = useState('');
  const [zustaendig, setZustaendig] = useState<string | undefined>(undefined);
  const treffer = suche.trim().length >= 2 && !kontaktId ? (api.kontakte ?? []).filter(k => `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];
  const k = kontaktId ? (api.kontakte ?? []).find(x => x.id === kontaktId) : undefined;
  const bereit = !!kontaktId && text.trim() && faellig;
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <Feldzeile label="Person">
        {k ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>{anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null}</span><button onClick={() => { setKontaktId(null); setSuche(''); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>
          : <div style={{ display: 'grid', gap: 4 }}>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name oder Firma …" style={{ ...feld }} autoFocus />
            {treffer.map(t => <button key={t.id} onClick={() => setKontaktId(t.id)} style={{ textAlign: 'left', background: 'rgba(255,255,255,.04)', border: 'none', borderRadius: 8, padding: '6px 10px', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>{anzeigename(t)}{t.firma ? <span style={{ color: C.inkLeise }}> · {t.firma}</span> : null}</button>)}
          </div>}
      </Feldzeile>
      <Feldzeile label="Art"><Wahl label="Art" liste={FOLLOWUP_ARTEN} wert={art} onWahl={setArt} /></Feldzeile>
      <Feldzeile label="Was"><input value={text} onChange={e => setText(e.target.value)} placeholder="z. B. Angebot nachfassen" style={{ ...feld }} /></Feldzeile>
      <Feldzeile label="Wann">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={faellig} onChange={e => setFaellig(e.target.value)} style={{ ...feld, width: 150 }} aria-label="Datum" />
          <input type="time" value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} style={{ ...feld, width: 110 }} aria-label="Uhrzeit" />
          {[1, 3, 7, 14].map(t => <Knopf key={t} leise onClick={() => setFaellig(plusTage(heute, t))}>+{t}</Knopf>)}
        </div>
      </Feldzeile>
      <Feldzeile label="Zuständig"><ZustaendigWahl wert={zustaendig} welt="sales" onWahl={setZustaendig} /></Feldzeile>
      <FormFehler text={fehler} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf aus={!bereit} onClick={async () => { if (!bereit) return; const r = await onFertig({ kontaktId, bezug: { art: 'kontakt', id: kontaktId }, art, text: text.trim(), faellig, ...(uhrzeit ? { uhrzeit } : {}), ...(zustaendig ? { zustaendig } : {}) }); setFehler(r.ok ? null : r.fehler ?? 'Nicht gespeichert.'); }}>Anlegen</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
    </div>
  );
}

const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
function Wochenansicht({ liste, heute, zuKontakt, zuDeal, zuAkte, aktion, eventHref }: { liste: Faellig[]; heute: string; zuKontakt: (id: string) => void; zuDeal: (id: string) => void; zuAkte: (id: string) => void; aktion: (b: Record<string, unknown>) => Promise<FollowupAntwort>; eventHref: (id: string) => string }) {
  // Montag der Woche von heute
  const d = new Date(`${heute}T12:00:00Z`);
  const mo = plusTage(heute, -((d.getUTCDay() + 6) % 7));
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(mo, i));
  const ueber = liste.filter(f => f.faellig < mo);
  const danach = liste.filter(f => f.faellig > tage[6]);
  return (
    <>
      {ueber.length > 0 && <Karte i={1} akzent={LEUCHT.kritisch}><Ueberschrift farbe={LEUCHT.kritisch} rechts={`${ueber.length}`}>Aus den Vorwochen</Ueberschrift><Liste>{ueber.map(f => <FollowUpZeile key={f.id} f={f} heute={heute} zuKontakt={zuKontakt} zuDeal={zuDeal} zuAkte={zuAkte} aktion={aktion} eventHref={eventHref} />)}</Liste></Karte>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tage.map((t, i) => {
          // (Einträge nach dem Sonntag stehen darunter unter „Nächste Woche“)
          const l = liste.filter(f => f.faellig === t);
          const istHeute = t === heute;
          return (
            <div key={t} style={{ background: 'rgba(255,255,255,.025)', borderRadius: 14, padding: 10, border: istHeute ? `1px solid ${LEUCHT.achtung}66` : '1px solid transparent' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: istHeute ? LEUCHT.achtung : C.inkDim, letterSpacing: '.05em', textTransform: 'uppercase' }}>{WT[i]} {t.slice(8, 10)}.{t.slice(5, 7)}.</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {l.map(f => (
                  <button key={f.id} onClick={() => (f.bezug.art === 'chance' ? zuDeal(f.bezug.id) : f.kontaktId ? zuAkte(f.kontaktId) : undefined)} className="fassbar" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '7px 9px', color: C.ink, display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: TYP.bedien, fontWeight: 600, lineHeight: 1.3, color: f.gruppe === 'ueberfaellig' ? LEUCHT.kritisch : C.ink }}>{f.name}</span>
                    <span style={{ fontSize: 12, color: C.inkLeise }}>{f.uhrzeit ? `${f.uhrzeit} · ` : ''}{ART_LABEL[f.art]} · {f.text}</span>
                  </button>
                ))}
                {!l.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
      {danach.length > 0 && <Karte i={2}><Ueberschrift rechts={`${danach.length}`}>Nächste Woche</Ueberschrift><Liste>{danach.map(f => <FollowUpZeile key={f.id} f={f} heute={heute} zuKontakt={zuKontakt} zuDeal={zuDeal} zuAkte={zuAkte} aktion={aktion} eventHref={eventHref} />)}</Liste></Karte>}
    </>
  );
}

function Kadenz({ api, liste, heute, zuKontakt, aktion }: { api: CrmApi; liste: Faellig[]; heute: string; zuKontakt: (id: string) => void; aktion: (b: Record<string, unknown>) => Promise<FollowupAntwort> }) {
  const kontakte = api.kontakte ?? [];
  const takte = api.crm?.stand.wertelisten?.kadenzTage ?? {};
  const kreise = (['A', 'B', 'C', 'D'] as Kreis[]).map(k => ({ k, takt: takte[k] ?? KREIS_TAKT[k], n: kontakte.filter(x => x.kreis === k && !ausgenommen(x)).length, faellig: liste.filter(f => f.quelle === 'kadenz' && kontakte.find(x => x.id === f.kontaktId)?.kreis === k).length }));
  const ohne = kontakte.filter(x => !x.kreis && !ausgenommen(x) && x.stufe !== 'ruht' && x.stufe !== 'verloren').length;
  const kadenz = liste.filter(f => f.quelle === 'kadenz');
  return (
    <>
      <Karte i={1}>
        <Ueberschrift rechts={<span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Takt änderbar unter Stammdaten › Wertelisten</span>}>Kadenz je Kreis</Ueberschrift>
        <Raster min={150}>
          {kreise.map(x => <Zahl key={x.k} wert={String(x.faellig)} label={`Kreis ${x.k} · ${x.n} Personen · alle ${x.takt} Tage`} farbe={x.faellig ? LEUCHT.achtung : undefined} />)}
        </Raster>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>{ohne} Personen haben noch keinen Kreis — sie haben keine Kadenz. Kreis setzen: „Kontakt öffnen“ › links unter Wichtigste Infos.</div>
      </Karte>
      <Karte i={2}>
        <Ueberschrift rechts={`${kadenz.length}`}>Zu lange nichts gehört</Ueberschrift>
        {kadenz.length ? <Liste>{kadenz.map(f => <FollowUpZeile key={f.id} f={f} heute={heute} zuKontakt={zuKontakt} zuDeal={() => {}} zuAkte={zuKontakt} aktion={aktion} />)}</Liste> : <Leer>Alle Kreise im Takt.</Leer>}
      </Karte>
    </>
  );
}
