'use client';

// ─── Inbox — Flows aus einem Gespräch: Aufgabe mit Zuordnung · Ablegen (09.10.2026) ─────────────────────────────────────
// Kevin 09.10.: „Entweder antworten, Dokumente wegsortieren in unsere Ablage oder Aufgabe erstellen — da müssen saubere Flows rein.“
// Antworten bleibt der vorhandene Editor (Antwort.tsx, ZOE-Entwurf nur als Vorschlag). Hier die zwei anderen Wege — beide nur auf Klick,
// beide mit vorgeschlagenem Ziel (lib/inbox/flows.ts: Kontakt → Firma → aktives Mandat → Mandanten-Space/Kundenprojekt), alles änderbar:
//   · FlowAufgabe: Titel, Wohin (Bereich › Projekt › Liste), Fällig (Frist aus der Mail), Zuständig, Bezug — angelegt über `aufgabeAnlegen`.
//   · FlowAblegen: Anhänge (oder die Mail als Text) → Firma/Kontakt (CRM-Ablage) · Projekt/Aufgabe (Projekt-Dateien) · Beleg (vorhandener Weg).
// Bereiche bleiben getrennt: gezeigt werden Ziele im Bereich des Postfachs; der andere Bereich nur nach „Anderer Bereich …“ mit Hinweis.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { WEG } from '@/lib/wege';
import { aufgabeAusGespraech } from '@/lib/inbox/aus-gespraech';
import {
  ablageLink, ablageVorschlag, aufgabenAusGespraech, aufgabenZiel, belegTypPasst, crmAblageBezug, crmTypPasst, dateiArtAusName,
  DANACH_ERLEDIGEN, raumVonPostfach, WECHSEL_TEXT, type AblageArt, type Raum,
} from '@/lib/inbox/flows';
import { bereichVonSpace, sonstigeProjektId, istSonstigeProjekt, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import { DATEI_ARTEN, type DateiArt } from '@/lib/dateien/regeln';
import type { AufgabeBezug, TasksState } from '@/types/tasks';
import type { Owner } from '@/types/common';
import { Knopf, Hinweis, Segmente, Wahl as Umschalter, eingabe } from '../ui';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { aufgabeAnlegen, projekteImSpace, spacesOderFest, useCrmVerweise, usePersonen } from '../aufgaben/hilfe';
import { groesse, senden, type Ansicht, type GespraechZeile } from './daten';

const neueId = () => `abl-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
const ortSchluessel = (spaceId: string, projektId: string, listeId?: string) => `${spaceId}|${projektId}|${listeId ?? ''}`;
const ortAus = (k: string) => { const [spaceId, projektId, listeId] = k.split('|'); return { spaceId, projektId, listeId: listeId || undefined }; };

/** „Danach erledigen“ — je Browser gemerkt (Vorgabe aus). */
export function useDanachErledigen(): [boolean, (v: boolean) => void] {
  const [an, setAn] = useState(false);
  useEffect(() => { try { setAn(window.localStorage.getItem(DANACH_ERLEDIGEN) === '1'); } catch { /* privat/blockiert — bleibt aus */ } }, []);
  return [an, (v: boolean) => { setAn(v); try { window.localStorage.setItem(DANACH_ERLEDIGEN, v ? '1' : '0'); } catch { /* nur Bequemlichkeit */ } }];
}

/** Orte „Bereich › Projekt › Liste“ (wie die Schnelleingabe der Aufgaben) — nur Spaces des gewählten Raums (bzw. beider, wenn bewusst). */
function orteListe(state: TasksState, spaces: readonly AufgabenSpace[], raeume: readonly Raum[], mitListen: boolean): WahlEintrag<string>[] {
  return spacesOderFest(spaces).filter(s => !s.archiv && raeume.includes(bereichVonSpace(s.id))).flatMap(s => [
    ...projekteImSpace(state, s.id).filter(p => p.status !== 'abgeschlossen').flatMap(p => [
      ...(mitListen ? (state.listen ?? []).filter(l => l.projektId === p.id && !l.archiviert && !l.archiviertAm).sort((a, b) => a.sortOrder - b.sortOrder)
        .map(l => ({ id: ortSchluessel(s.id, p.id, l.id), label: `${p.title} › ${l.titel}`, hinweis: s.label, punkt: l.farbe ?? p.color })) : []),
      { id: ortSchluessel(s.id, p.id), label: mitListen ? `${p.title} › Sonstige` : p.title, hinweis: s.label, punkt: p.color },
    ]),
    { id: ortSchluessel(s.id, sonstigeProjektId(s.id)), label: 'Sonstige (ohne Projekt)', hinweis: s.label, punkt: s.farbe },
  ]);
}

const kasten = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, padding: 12, borderRadius: 16, border: `1px solid ${C.linie}` } as const;
const titelZeile = (t: string, unter?: string) => (
  <div style={{ fontWeight: 700, fontSize: TYP.body }}>{t}{unter ? <span style={{ color: C.inkLeise, fontWeight: 500 }}> · {unter}</span> : null}</div>
);
const beschriftung = (t: string) => <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>{t}</div>;

/** Bereich bewusst wechseln: Knopf „Anderer Bereich …“ und — wenn gewählt — der Hinweis. */
function BereichWechsel({ von, an, onAn, aktiv }: { von: Raum; an: boolean; onAn: (v: boolean) => void; aktiv: Raum | null }) {
  const nach: Raum = von === 'privat' ? 'business' : 'privat';
  return (
    <>
      {!an && aktiv === von && <button type="button" onClick={() => onAn(true)} style={{ background: 'none', border: 'none', color: C.inkLeise, textDecoration: 'underline', cursor: 'pointer', fontSize: TYP.bedien, padding: 0, minHeight: 44, justifySelf: 'start', fontFamily: SCHRIFT.text }}>Anderer Bereich ({nach === 'privat' ? 'Privat' : 'Business'}) …</button>}
      {aktiv && aktiv !== von && <Hinweis art="achtung" titel="Bereich wechselt">{WECHSEL_TEXT(von, aktiv)}</Hinweis>}
    </>
  );
}

// ── Aufgabe mit Zuordnung ─────────────────────────────────────────────────────

export function FlowAufgabe({ g, person, datum, onAngelegt, onZu }: {
  g: GespraechZeile; person: string; datum?: string; onAngelegt: (id: string, titel: string) => void; onZu: () => void;
}) {
  const { state, dispatch, spaces } = useTasks();
  const crm = useCrmVerweise();
  const personen = usePersonen();
  const raum = raumVonPostfach(g.bereich);
  const vorlage = aufgabeAusGespraech(g);
  const vorschlag = useMemo(() => aufgabenZiel({
    gespraechId: g.id, bereich: g.bereich, zuordnung: g.zuordnung, mandate: crm?.mandate ?? [], spaces, tasks: state.tasks, projects: state.projects, listen: state.listen,
  }), [g.id, g.bereich, g.zuordnung, crm, spaces, state.tasks, state.projects, state.listen]);
  const [titel, setTitel] = useState(vorlage.title);
  const [faellig, setFaellig] = useState(datum ?? g.frist?.datum ?? '');
  const [wer, setWer] = useState<string>(person);
  const [ort, setOrt] = useState<string | null>(null);
  const [anders, setAnders] = useState(false);
  const [ohne, setOhne] = useState<Set<keyof AufgabeBezug>>(new Set());
  const o = ortAus(ort ?? ortSchluessel(vorschlag.spaceId, vorschlag.projectId, vorschlag.listeId));
  const zielRaum = bereichVonSpace(o.spaceId);
  const orte = useMemo(() => orteListe(state, spaces, anders ? ['privat', 'business'] : [raum], true), [state, spaces, anders, raum]);
  const bezug: AufgabeBezug = Object.fromEntries(Object.entries(vorschlag.bezug ?? {}).filter(([k]) => !ohne.has(k as keyof AufgabeBezug)));
  const name: Record<keyof AufgabeBezug, string | undefined> = {
    kontaktId: g.zuordnung?.name, firmaId: g.zuordnung?.firma ?? crm?.firmen.find(f => f.id === bezug.firmaId)?.name,
    mandatId: crm?.mandate.find(m => m.id === vorschlag.bezug?.mandatId)?.titel, dealId: g.zuordnung?.dealTitel,
  };
  const BEZUG_TEXT: Record<keyof AufgabeBezug, string> = { kontaktId: 'Kontakt', firmaId: 'Firma', mandatId: 'Mandat', dealId: 'Deal' };
  const anlegen = () => {
    const t = titel.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!t) return;
    const id = aufgabeAnlegen(dispatch, state, { spaceId: o.spaceId, projectId: o.projektId, ...(o.listeId ? { listeId: o.listeId } : {}) }, {
      title: t, description: vorlage.description, assignee: wer as Owner, ...(/^\d{4}-\d{2}-\d{2}$/.test(faellig) ? { dueDate: faellig } : {}),
      // Alles abgewählt → ohne Bezug (im Mandanten-Space belegt `aufgabeAnlegen` dann die Firma des Space vor).
      ...(Object.keys(bezug).length ? { bezug } : {}),
    });
    onAngelegt(id, t);
  };
  const ortName = orte.find(x => x.id === ortSchluessel(o.spaceId, o.projektId, o.listeId));
  return (
    <div style={kasten} data-inbox="flow-aufgabe">
      {titelZeile('Aufgabe erstellen', ort ? undefined : `Vorschlag: ${vorschlag.grund}`)}
      <input value={titel} onChange={e => setTitel(e.target.value)} aria-label="Titel der Aufgabe" maxLength={300} style={eingabe} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        <Wahl label="Wohin? (Bereich › Projekt › Liste)" liste={orte} wert={ortName ? ortName.id : null} leer={ortName ? undefined : `${istSonstigeProjekt(o.projektId) ? 'Sonstige' : state.projects.find(p => p.id === o.projektId)?.title ?? 'Sonstige'}`} onWahl={setOrt} />
        <input type="date" value={faellig} onChange={e => setFaellig(e.target.value)} aria-label="Fällig am" style={{ ...eingabe, width: 170 }} />
        {personen.length > 1 && <Wahl label="Zuständig" liste={personen.map(p => ({ id: p.speicher, label: p.name }))} wert={wer} onWahl={setWer} />}
      </div>
      {(Object.keys(vorschlag.bezug ?? {}) as (keyof AufgabeBezug)[]).length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {beschriftung('Bezug')}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(vorschlag.bezug ?? {}) as (keyof AufgabeBezug)[]).map(k => (
              <Umschalter key={k} klein an={!ohne.has(k)} onClick={() => setOhne(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>{BEZUG_TEXT[k]}{name[k] ? `: ${name[k]}` : ''}</Umschalter>
            ))}
          </div>
        </div>
      )}
      {g.zuordnung?.sperre === 'eingeschraenkt' && <Hinweis art="info">Die Verarbeitung der Person ist eingeschränkt (Art. 18) — die Aufgabe hängt nur an Firma bzw. Deal, nicht an ihr.</Hinweis>}
      <BereichWechsel von={raum} an={anders} onAn={setAnders} aktiv={zielRaum} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf onClick={anlegen} aus={!titel.trim()}>Aufgabe anlegen</Knopf>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Mit Link zurück zu diesem Gespräch — der Mailtext bleibt in der Inbox.</span>
      </div>
    </div>
  );
}

// ── Ablegen ───────────────────────────────────────────────────────────────────

interface AnhangWahl { schluessel: string; nachricht: string; teil: string; name: string; typ: string; groesse: number; mail?: boolean }

export function FlowAblegen({ g, a, start, onAbgelegt, onBeleg, onZu }: {
  g: GespraechZeile; a: Ansicht; start?: AblageArt;
  onAbgelegt: (text: string, href: string) => void; onBeleg: (anhang: { nachricht: string; teil: string; name: string; typ: string }) => void; onZu: () => void;
}) {
  const { state, spaces } = useTasks();
  const crm = useCrmVerweise();
  const raum = raumVonPostfach(g.bereich);
  const anhaenge: AnhangWahl[] = useMemo(() => a.nachrichten.flatMap(n => n.anhaenge.filter(x => !x.eingebettet).map(x => ({ schluessel: `${n.id}|${x.teil}`, nachricht: n.id, teil: x.teil, name: x.name, typ: x.typ, groesse: x.groesse }))), [a.nachrichten]);
  // Die Mail selbst als Text (nur Projekt-Ablage): die jüngste Nachricht der Gegenseite, sonst die jüngste. WhatsApp: nicht (kurze Nachrichten).
  const mailQuelle = g.quelle === 'whatsapp' ? undefined : [...a.nachrichten].reverse().find(n => !n.vonUns) ?? a.nachrichten[a.nachrichten.length - 1];
  const mail: AnhangWahl | null = mailQuelle ? { schluessel: `${mailQuelle.id}|mail`, nachricht: mailQuelle.id, teil: 'mail', name: 'Die Mail als Textdatei', typ: 'text/plain', groesse: mailQuelle.text.length, mail: true } : null;
  const ausGespraech = aufgabenAusGespraech(state.tasks, g.id);
  const [art, setArt] = useState<AblageArt>(() => start ?? ablageVorschlag({ fach: g.fach, bereich: g.bereich, zuordnung: g.zuordnung, anhang: anhaenge[anhaenge.length - 1], ausGespraech: ausGespraech.length }));
  // Vorauswahl: die Anhänge der jüngsten Nachricht mit Anhängen.
  const [wahl, setWahl] = useState<Set<string>>(() => { const letzte = anhaenge[anhaenge.length - 1]?.nachricht; return new Set(anhaenge.filter(x => x.nachricht === letzte).map(x => x.schluessel)); });
  const [anders, setAnders] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  // CRM: Bezüge der Zuordnung (Werbesperre → ohne Person), einzeln abwählbar; Art aus dem Dateinamen.
  const crmErlaubt = crmAblageBezug(g.zuordnung);
  const [crmOhne, setCrmOhne] = useState<Set<string>>(new Set());
  const ersteWahl = anhaenge.find(x => wahl.has(x.schluessel));
  const [dateiArt, setDateiArt] = useState<DateiArt | null>(null);
  // Projekt: vorgeschlagen = Aufgabe aus diesem Gespräch, sonst der Ort wie bei „Aufgabe erstellen“.
  const ziel = useMemo(() => aufgabenZiel({ gespraechId: g.id, bereich: g.bereich, zuordnung: g.zuordnung, mandate: crm?.mandate ?? [], spaces, tasks: state.tasks, projects: state.projects, listen: state.listen }), [g.id, g.bereich, g.zuordnung, crm, spaces, state.tasks, state.projects, state.listen]);
  const [ort, setOrt] = useState<string | null>(null);
  const [aufgabe, setAufgabe] = useState<string | null | undefined>(undefined);
  const o = ortAus(ort ?? ortSchluessel(ausGespraech[0]?.spaceId ?? ziel.spaceId, ausGespraech[0]?.projectId ?? ziel.projectId));
  const aufgabeWirksam = aufgabe === undefined ? (ausGespraech[0] && ausGespraech[0].projectId === o.projektId ? ausGespraech[0].id : null) : aufgabe;
  const orte = useMemo(() => orteListe(state, spaces, anders ? ['privat', 'business'] : [raum], false), [state, spaces, anders, raum]);
  const aufgabenListe: WahlEintrag<string>[] = useMemo(() => {
    const imProjekt = state.tasks.filter(t => t.projectId === o.projektId && t.spaceId === o.spaceId && t.status !== 'done' && t.status !== 'cancelled');
    const vorn = new Set(ausGespraech.map(t => t.id));
    return [...imProjekt.filter(t => vorn.has(t.id)), ...imProjekt.filter(t => !vorn.has(t.id))].slice(0, 200).map(t => ({ id: t.id, label: t.title, ...(vorn.has(t.id) ? { hinweis: 'aus diesem Gespräch' } : {}) }));
  }, [state.tasks, o.projektId, o.spaceId, ausGespraech]);
  const zielRaum: Raum = art === 'crm' ? 'business' : bereichVonSpace(o.spaceId);
  const wechsel = art !== 'beleg' && zielRaum !== raum;
  const liste = art === 'projekt' && mail ? [...anhaenge, mail] : anhaenge;
  const gewaehlt = liste.filter(x => wahl.has(x.schluessel));
  const unpassend = art === 'crm' ? gewaehlt.filter(x => !crmTypPasst(x.name)) : [];

  const ablegen = async () => {
    if (!gewaehlt.length) return;
    setLaeuft(true); setFehler('');
    const zielDaten = art === 'crm'
      ? { art: 'crm' as const, ...Object.fromEntries(Object.entries(crmErlaubt.ok ? crmErlaubt.bezug : {}).filter(([k]) => !crmOhne.has(k))), dateiArt: dateiArt ?? dateiArtAusName(ersteWahl?.name ?? '') }
      : { art: 'projekt' as const, projektId: o.projektId, ...(aufgabeWirksam ? { aufgabeId: aufgabeWirksam } : {}) };
    const fertig: string[] = [];
    for (const x of gewaehlt.filter(y => !unpassend.includes(y))) {
      const r = await senden<{ text?: string }>('/api/inbox/ablegen', { gespraech: g.id, nachricht: x.nachricht, teil: x.teil, ziel: zielDaten, ...(wechsel ? { bereichWechsel: true } : {}), anfrageId: neueId() });
      if (!r.d.ok) { setFehler(`${x.mail ? 'Die Mail' : x.name}: ${String(r.d.fehler ?? 'Nicht abgelegt.')}`); break; }
      fertig.push(x.mail ? 'Mail als Text' : x.name);
    }
    setLaeuft(false);
    if (fertig.length) {
      const href = art === 'crm' ? ablageLink(zielDaten as Parameters<typeof ablageLink>[0]) : ablageLink({ art: 'projekt', spaceId: o.spaceId, projektId: o.projektId, ...(aufgabeWirksam ? { aufgabeId: aufgabeWirksam } : {}) });
      const wohin = art === 'crm' ? (g.zuordnung?.firma && !crmOhne.has('firmaId') ? g.zuordnung.firma : g.zuordnung?.name ?? 'Kartei') : aufgabeWirksam ? state.tasks.find(t => t.id === aufgabeWirksam)?.title ?? 'Aufgabe' : orte.find(x => x.id === ortSchluessel(o.spaceId, o.projektId))?.label ?? 'Projekt';
      onAbgelegt(`Abgelegt (${fertig.length}) → ${wohin}`, href);
    }
  };

  const beleg = anhaenge.filter(belegTypPasst);
  return (
    <div style={kasten} data-inbox="flow-ablegen">
      {titelZeile('Ablegen', 'in unsere Ablage')}
      <Segmente umbrechen liste={[{ id: 'crm' as const, label: 'Firma / Kontakt' }, { id: 'projekt' as const, label: 'Projekt / Aufgabe' }, { id: 'beleg' as const, label: 'Beleg' }]} aktiv={art} onWahl={x => { setArt(x); setFehler(''); }} />

      {art === 'beleg' ? (
        beleg.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Welcher Anhang ist der Beleg? Lesen schreibt nichts — erst „Übernehmen“ legt in die Finanzen.</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{beleg.map(x => <Knopf key={x.schluessel} leise onClick={() => onBeleg({ nachricht: x.nachricht, teil: x.teil, name: x.name, typ: x.typ })}>{x.name}</Knopf>)}</div>
          </div>
        ) : <Hinweis art="info">In diesem Gespräch gibt es keinen lesbaren Beleg (PDF oder Foto).</Hinweis>
      ) : (
        <>
          {liste.length === 0 ? <Hinweis art="info">Dieses Gespräch hat keine Anhänge{art === 'crm' ? ' — die Mail selbst geht als Text nur in die Projekt-Ablage.' : '.'}</Hinweis> : (
            <div style={{ display: 'grid', gap: 6 }}>
              {beschriftung('Was')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {liste.map(x => (
                  <Umschalter key={x.schluessel} klein an={wahl.has(x.schluessel)} onClick={() => setWahl(s => { const n = new Set(s); if (n.has(x.schluessel)) n.delete(x.schluessel); else n.add(x.schluessel); return n; })}>
                    {x.name}{x.mail ? '' : ` · ${groesse(x.groesse)}`}
                  </Umschalter>
                ))}
              </div>
              {unpassend.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{unpassend.map(x => x.name).join(', ')}: die CRM-Ablage nimmt nur PDF, PNG, JPG, DOCX — {unpassend.length === 1 ? 'diese Datei bleibt' : 'diese Dateien bleiben'} hier liegen (Projekt-Ablage nimmt mehr).</span>}
            </div>
          )}

          {art === 'crm' && (crmErlaubt.ok ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {beschriftung('Woran')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {crmErlaubt.bezug.kontaktId && <Umschalter klein an={!crmOhne.has('kontaktId')} onClick={() => setCrmOhne(s => schalte(s, 'kontaktId'))}>Kontakt: {g.zuordnung?.name}</Umschalter>}
                {crmErlaubt.bezug.firmaId && <Umschalter klein an={!crmOhne.has('firmaId')} onClick={() => setCrmOhne(s => schalte(s, 'firmaId'))}>Firma: {g.zuordnung?.firma ?? crm?.firmen.find(f => f.id === crmErlaubt.bezug.firmaId)?.name ?? '—'}</Umschalter>}
                {crmErlaubt.bezug.dealId && <Umschalter klein an={!crmOhne.has('dealId')} onClick={() => setCrmOhne(s => schalte(s, 'dealId'))}>Deal: {g.zuordnung?.dealTitel ?? '—'}</Umschalter>}
                <Wahl klein label="Art" liste={DATEI_ARTEN} wert={dateiArt ?? dateiArtAusName(ersteWahl?.name ?? '')} onWahl={setDateiArt} />
              </div>
              {g.zuordnung?.sperre === 'werbesperre' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Werbesperre — an der Person selbst wird nichts abgelegt.</span>}
            </div>
          ) : <Hinweis art="info">{crmErlaubt.grund}</Hinweis>)}

          {art === 'projekt' && (
            <div style={{ display: 'grid', gap: 6 }}>
              {beschriftung('Wohin')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
                <Wahl label="Projekt" liste={orte} wert={orte.some(x => x.id === ortSchluessel(o.spaceId, o.projektId)) ? ortSchluessel(o.spaceId, o.projektId) : null} onWahl={k => { setOrt(k); setAufgabe(null); }} />
                <Wahl label="Aufgabe" leer="+ an eine Aufgabe" liste={aufgabenListe} wert={aufgabeWirksam} onWahl={setAufgabe} onLeeren={() => setAufgabe(null)} leerenLabel="nur am Projekt" />
              </div>
            </div>
          )}
          {art !== 'crm' || crmErlaubt.ok ? <BereichWechsel von={raum} an={anders || (art === 'crm' && raum === 'privat')} onAn={setAnders} aktiv={zielRaum} /> : null}
          {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf onClick={ablegen} aus={laeuft || !gewaehlt.length || gewaehlt.length === unpassend.length || (art === 'crm' && !crmErlaubt.ok)}>{laeuft ? 'legt ab …' : wechsel ? 'Bewusst ablegen' : 'Ablegen'}</Knopf>
            <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          </div>
        </>
      )}
      {art === 'beleg' && <div><Knopf leise onClick={onZu}>Abbrechen</Knopf></div>}
    </div>
  );
}

const schalte = (s: Set<string>, k: string) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; };

/** Was aus diesem Gespräch schon entstanden ist: Aufgaben (aus dem Aufgaben-Stand, bleibt) und Ablagen dieser Sitzung. */
export function FlowErgebnisse({ gespraechId, ergebnisse }: { gespraechId: string; ergebnisse: { text: string; href: string }[] }) {
  const { state } = useTasks();
  const aufgaben = aufgabenAusGespraech(state.tasks, gespraechId).slice(0, 4);
  const zeilen = [
    ...ergebnisse.filter(e => !aufgaben.some(t => e.href === WEG.aufgabe(t.id))),
    ...aufgaben.map(t => ({ text: `Aufgabe${t.status === 'done' ? ' (erledigt)' : ''}: ${t.title}`, href: WEG.aufgabe(t.id) })),
  ];
  if (!zeilen.length) return null;
  return (
    <div role="status" style={{ display: 'grid', gap: 4 }}>
      {beschriftung('Aus diesem Gespräch')}
      {zeilen.map((z, i) => (
        <Link key={`${z.href}-${i}`} href={z.href} style={{ color: C.inkDim, fontSize: TYP.bedien, textDecoration: 'none', minHeight: 32, display: 'inline-flex', alignItems: 'center', overflowWrap: 'anywhere' }}>{z.text} ›</Link>
      ))}
    </div>
  );
}

