'use client';
// ─── MAKE OS — Aufgaben wie Monday/ClickUp (28.09. abends, Kevin + Malin; Vertiefung 28.09. spät) ───
// Navigation wie in der Markttraktion (Kevin ~22:30): Start ist der Überblick (Kacheln + Karten je Privat/Firma/
// Mandant), oben die Leiste Überblick · Privat · Firmen ▾ · Mandanten ▾ · Archiv, im Space die Brotkrumen
// Space ▾ › Projekt ▾ › Gruppe ▾ › Liste ▾. Ein Projekt öffnet seine Projektseite (Reiter Aufgaben · Notizen · Dateien ·
// Felder · Verlauf). Ebenen: Projekt → Gruppe → Liste → Aufgabe → Unteraufgabe; ohne Liste/Projekt „Sonstige“.
// Jeder Zustand steht in der Adresse (lib/aufgaben/adresse.ts, `WEG.aufgaben`) — alte Links (?offen=, ?r=, ?space=)
// gelten weiter. Regeln rein in lib/aufgaben/*; Schreiben über den Aufgaben-Kontext (Einzeländerungen mit Stand).
// Andere Pakete hängen sich mit wenigen Zeilen ein: Dateien (C2) über ProjektDateien, Wiederkehrend/Vorlagen (C3),
// ZOE-Stapel (C4, Kachel „Wartet auf Freigabe“), weitere Ansichten (C5, `ansicht=`).
// Paket T2 (29.09.): Filter „Alle · Meine · Beteiligt“, Suchfeld (Titel + Beschreibung, `suchPasst`, #58), Rückfragen und
// „Rückgängig“ über den HandlungProvider, Fokus zurück auf die Zeile nach dem Schließen (#89), Hinweis bei toten Links (#45).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Seite, Karte, Spalten, Spalte, Segmente, Leer, feld, useBreit } from '../ui';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { nachOben } from '../Verlauf';
import { useTasks } from '@/context/TasksContext';
import { useSpace } from '@/hooks/useSpace';
import { localDay } from '@/lib/zeit';
import { baum, passtFilter, statusListe, bereichVonSpace, FILTER_STANDARD, sonstigeProjektId, istSonstigeProjekt, type AufgabenFilter, type FaelligFilter } from '@/lib/aufgaben/struktur';
import { adresseLesen, aufgabenLink, type AufgabenAdresse } from '@/lib/aufgaben/adresse';
import type { Task } from '@/types/tasks';
import { SchnellAnlegen } from './SchnellAnlegen';
import { AufgabeDetail } from './AufgabeDetail';
import { StatusVerwalten } from './StatusVerwalten';
import { StatusBoard } from './StatusBoard';
import { AnsichtTabelle } from './AnsichtTabelle';
import { AnsichtKalender } from './AnsichtKalender';
import { BaumAnsicht, leiseKnopf } from './BaumAnsicht';
import { ProjektSeite } from './ProjektSeite';
import { AufgabenLeiste, Brotkrumen, MandantKopf } from './Navigation';
import { AufgabenUeberblick, AufgabenArchiv } from './Ueberblick';
import { VorlagenKnopf } from './VorlagenDialog';
import { ZoeAufgabenSicht } from './ZoeAufgabe';
import { NeuAnfangenKnopf } from './NeuAnfangen';
import { HandlungProvider } from './Handlung';
import { suchPasst } from '@/lib/text/such-norm';
import { kette, nachIdKarte } from '@/lib/aufgaben/ebenen';
import { imArchiv } from '@/lib/aufgaben/neustart';
import { projektAnlegen, spacesOderFest, usePersonen, useIch } from './hilfe';
import { KalenderAufgabenSchalter } from '../KalenderAufgabenSchalter';
import { kalenderLink } from '@/lib/kalender/modus';

const RAUM_MERKER = 'make-aufgaben-raum';
const FILTER_MERKER = 'make-aufgaben-filter';
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
const FAELLIG: { id: FaelligFilter; label: string }[] = [{ id: 'alle', label: 'Jederzeit' }, { id: 'ueberfaellig', label: 'Überfällig' }, { id: 'heute', label: 'Bis heute' }, { id: 'woche', label: '7 Tage' }, { id: 'ohne', label: 'Ohne Datum' }];


export function AufgabenRaum() {
  const { state, voll, dispatch, spaces: rohSpaces, ready } = useTasks();
  const [suche, setSuche] = useState('');
  const spaces = spacesOderFest(rohSpaces);
  const params = useSearchParams();
  const router = useRouter();
  const adresse = adresseLesen(params);
  const { space: bereichGemerkt, setzen: bereichSetzen } = useSpace();
  const breit = useBreit();
  const personen = usePersonen();
  const ich = useIch();
  const heute = localDay();

  const [filter, setFilterRoh] = useState<AufgabenFilter>(FILTER_STANDARD);
  const [raumGemerkt, setRaumGemerkt] = useState<string | null>(null);
  const [statusZeigen, setStatusZeigen] = useState(false);
  const [neuProjekt, setNeuProjekt] = useState<string | null>(null);

  useEffect(() => {
    try { const f = JSON.parse(lies(FILTER_MERKER) ?? 'null') as Partial<AufgabenFilter> | null; if (f) setFilterRoh({ ...FILTER_STANDARD, ...f }); } catch { /* egal */ }
    setRaumGemerkt(lies(RAUM_MERKER));
  }, []);
  // Konflikte, Ablehnungen und „wird erneut versucht“ zeigt seit 29.09. der globale Speicher-Hinweis (TasksProvider) —
  // überall gleich, mit „Deine Fassung“ (übernehmen/kopieren) statt eines Hinweises, der die eigene Eingabe verwirft.
  const setFilter = (f: Partial<AufgabenFilter>) => setFilterRoh(alt => { const n = { ...alt, ...f }; merke(FILTER_MERKER, JSON.stringify({ wer: n.wer, status: n.status, faellig: n.faellig })); return n; });

  // ── Wohin: ein neuer Ort = neuer Eintrag im Verlauf (Zurück führt zurück), Gleichrangiges tauscht nur ──
  const aktuell = aufgabenLink(adresse);
  const gehe = useCallback((z: Partial<AufgabenAdresse>, wie: 'push' | 'replace' = 'push') => {
    const ziel = aufgabenLink({ bereich: adresse.bereich, ...(z.ansicht === 'space' || (!z.ansicht && z.s) ? { darstellung: adresse.darstellung } : {}), ...z });
    if (ziel === aktuell) return;
    router[wie](ziel, { scroll: false });
    if (wie === 'push' && (z.ansicht !== adresse.ansicht || z.s !== adresse.s || z.p !== adresse.p)) nachOben();
  }, [router, aktuell, adresse.bereich, adresse.darstellung, adresse.ansicht, adresse.s, adresse.p]);

  const offenId = adresse.a ?? null;
  const offen = offenId ? state.tasks.find(t => t.id === offenId) : undefined;
  // Alter Link (?offen=<Aufgabe> ohne Space) → in den Space der Aufgabe (ersetzt den Eintrag).
  useEffect(() => {
    if (adresse.ansicht !== 'space' && offen?.spaceId) router.replace(aufgabenLink({ ansicht: 'space', s: offen.spaceId, a: offen.id, darstellung: adresse.darstellung }), { scroll: false });
  }, [adresse.ansicht, offen?.spaceId, offen?.id, adresse.darstellung, router]);
  const setOffen = (id: string | null) => gehe({ ...adresse, a: id ?? undefined }, offenId && id ? 'replace' : id ? 'push' : 'replace');
  // Schließen: Fokus zurück auf die Zeile, die das Detail geöffnet hat (#89).
  const schliessen = () => {
    const war = offenId;
    setOffen(null);
    if (war) setTimeout(() => document.getElementById(`oeffnen-${war}`)?.focus(), 80);
  };
  // Toter Link (#45): Aufgabe gelöscht, im Papierkorb oder archiviert → Hinweis statt stillem Überblick.
  const tot = ready && offenId && !offen ? (() => {
    const v = voll.tasks.find(t => t.id === offenId);
    if (!v) return 'weg' as const;
    if (v.geloeschtAm) return 'papierkorb' as const;
    if (imArchiv(v) || voll.projects.some(p => p.id === v.projectId && imArchiv(p))) return 'archiv' as const;
    return 'unsichtbar' as const;
  })() : null;
  // Am Handy steht das Detail über dem Baum — beim Öffnen dorthin springen.
  useEffect(() => {
    if (!offenId || breit) return;
    const t = setTimeout(() => document.getElementById(`aufgabe-${offenId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [offenId, breit]);

  // ── Space ──
  const raumId = adresse.ansicht === 'space' && adresse.s ? adresse.s : null;
  const raum = raumId ? spaces.find(s => s.id === raumId) ?? { id: raumId, label: 'Mandant', bereich: 'business' as const, art: 'mandant' as const, farbe: C.inkDim, archiv: true } : null;
  useEffect(() => {
    if (!raumId) return;
    const b = bereichVonSpace(raumId);
    if (b !== bereichGemerkt) bereichSetzen(b);
    merke(RAUM_MERKER, raumId); setRaumGemerkt(raumId);
  }, [raumId]); // eslint-disable-line react-hooks/exhaustive-deps
  const projektId = raumId && adresse.p && (state.projects.some(p => p.id === adresse.p) || adresse.p === sonstigeProjektId(raumId)) ? adresse.p : null;

  const offenJe = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of state.tasks) if (!t.parentId && t.status !== 'done' && t.spaceId) m.set(t.spaceId, (m.get(t.spaceId) ?? 0) + 1);
    return m;
  }, [state.tasks]);

  const zeigen = (t: Task) => passtFilter(t, { ...filter, ich }, heute) && (!suche.trim() || suchPasst([t.title, t.description], suche));
  const standard = filter.wer === 'alle' && filter.faellig === 'alle' && (filter.status === 'offen' || filter.status === 'alle') && !suche.trim();
  const projekteBaum = useMemo(() => (raumId ? baum(state, raumId, zeigen, standard) : []), [state, raumId, filter, ich, heute, suche]); // eslint-disable-line react-hooks/exhaustive-deps
  const baumProjekt = projektId ? projekteBaum.find(p => p.id === projektId) : undefined;
  const imRaum = raumId ? state.tasks.filter(t => t.spaceId === raumId && zeigen(t) && (!projektId || t.projectId === projektId || (istSonstigeProjekt(projektId) && !state.projects.some(p => p.id === t.projectId && p.spaceId === raumId)))) : [];
  const statusWahl: WahlEintrag<string>[] = [{ id: 'offen', label: 'Nicht erledigt' }, { id: 'alle', label: 'Alle' }, ...statusListe(raumId ?? undefined, state.statusEigen ?? []).map(s => ({ id: s.id, label: s.label, punkt: s.farbe }))];
  const darstellung = adresse.darstellung === 'board' || adresse.darstellung === 'tabelle' || adresse.darstellung === 'kalender' || adresse.darstellung === 'zoe' ? adresse.darstellung : 'liste';
  const zoeSicht = <ZoeAufgabenSicht state={state} personen={personen} ich={ich} offenId={offenId} onOeffnen={id => setOffen(offenId === id ? null : id)} />;
  const board = darstellung === 'board';
  // Tabelle/Kalender (C5): Kontext = Space bzw. Projekt, dazu Gruppe/Liste aus der Adresse.
  const imKontext = imRaum.filter(t => (!adresse.l || t.listeId === adresse.l) && (!adresse.g || (state.listen ?? []).some(l => l.id === t.listeId && l.gruppeId === adresse.g)));

  const detail = (t: Task) => (
    <AufgabeDetail task={t} state={state} dispatch={dispatch} spaces={spaces} personen={personen} ich={ich} onSchliessen={schliessen} onOeffnen={id => setOffen(id)} />
  );

  const vorbelegt = raumId
    ? { spaceId: raumId, ...(projektId ? { projectId: projektId } : {}), ...(adresse.g ? { gruppeId: adresse.g } : {}), ...(adresse.l ? { listeId: adresse.l } : {}) }
    : { spaceId: raumGemerkt && spaces.some(s => s.id === raumGemerkt && !s.archiv) && (adresse.bereich !== 'business' || raumGemerkt !== 'privat') ? raumGemerkt : adresse.bereich === 'business' ? 'kdc' : 'privat' };

  const filterZeile = raum && (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 12px' }}>
      <Segmente liste={[{ id: 'alle', label: 'Alle' }, { id: 'meine', label: 'Meine' }, { id: 'beteiligt', label: 'Beteiligt' }]} aktiv={filter.wer} onWahl={w => setFilter({ wer: w })} />
      <input type="search" value={suche} onChange={e => setSuche(e.target.value)} aria-label="Aufgaben durchsuchen" placeholder="Suchen …"
        style={{ ...feld, fontSize: TYP.bedien, padding: '7px 12px', width: 180, minHeight: 36 }} />
      <Wahl klein label="Status" liste={statusWahl} wert={filter.status} onWahl={s => setFilter({ status: s })} />
      <Wahl klein label="Fällig" liste={FAELLIG} wert={filter.faellig} onWahl={f => setFilter({ faellig: f })} />
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {projektId && <button onClick={() => gehe({ ansicht: 'space', s: raum.id })} style={leiseKnopf}>‹ alle Projekte</button>}
        {!raum.archiv && <button onClick={() => setNeuProjekt(n => (n === null ? '' : null))} style={{ ...leiseKnopf, color: C.aktiv }}>+ Projekt</button>}
        {!raum.archiv && <VorlagenKnopf spaceId={raum.id} projektId={projektId && !istSonstigeProjekt(projektId) ? projektId : undefined} />}
        <button onClick={() => setStatusZeigen(z => !z)} style={leiseKnopf}>{statusZeigen ? 'Status schließen' : 'Status verwalten'}</button>
      </span>
      {neuProjekt !== null && (
        <input autoFocus value={neuProjekt} onChange={e => setNeuProjekt(e.target.value)} aria-label="Neues Projekt"
          onKeyDown={e => { if (e.key === 'Escape') setNeuProjekt(null); if (e.key === 'Enter' && neuProjekt.trim()) { const id = projektAnlegen(dispatch, raum.id, neuProjekt.trim().slice(0, 120), raum.farbe); setNeuProjekt(null); gehe({ ansicht: 'space', s: raum.id, p: id }); } }}
          placeholder={`Neues Projekt in ${raum.label} (Enter)`} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px', flexBasis: '100%' }} />
      )}
    </div>
  );

  const inhalt = raum && (board
    ? <StatusBoard state={state} dispatch={dispatch} spaceId={raum.id} aufgaben={imRaum} personen={personen} heute={heute} offenId={offenId} onOeffnen={id => setOffen(offenId === id ? null : id)} />
    : darstellung === 'tabelle'
      ? <AnsichtTabelle state={state} dispatch={dispatch} spaceId={raum.id} aufgaben={imKontext} personen={personen} heute={heute} ich={ich} offenId={offenId} onOeffnen={id => setOffen(offenId === id ? null : id)} />
    : darstellung === 'zoe'
      ? zoeSicht
    : darstellung === 'kalender'
      ? <AnsichtKalender state={state} dispatch={dispatch} aufgaben={imKontext} offenId={offenId} onOeffnen={id => setOffen(offenId === id ? null : id)} />
    : projektId
      ? <ProjektSeite projektId={projektId} baumProjekt={baumProjekt} state={state} dispatch={dispatch} space={raum} adresse={adresse} gehe={gehe} breit={breit} personen={personen} heute={heute} offenId={offenId} onOeffnen={setOffen} />
      : <>
          <BaumAnsicht projekte={projekteBaum} state={state} dispatch={dispatch} raumId={raum.id} offenId={offenId} onOeffnen={setOffen} onProjekt={id => gehe({ ansicht: 'space', s: raum.id, p: id })} breit={breit} personen={personen} heute={heute} />
          {ready && (!projekteBaum.length || projekteBaum.every(p => p.virtuell && p.listen.every(l => !l.aufgaben.length))) && (
            <Karte i={2}><Leer>{!standard ? 'Nichts passt zum Filter.' : `Noch nichts in ${raum.label}. Oben eine Zeile tippen — oder „+ Projekt“ (z. B. Launch) mit Gruppen wie Marketing, Sales, Operations.`}</Leer></Karte>
          )}
        </>);

  // Darstellung (Liste · Board · Tabelle · Kalender · ZOE): am Rechner im Kopf, am Handy als eigene wischbare Zeile im Inhalt (Standard: breite Umschalter nicht im Kopf).
  const darstellungWahl = <Segmente liste={[{ id: 'liste', label: 'Liste' }, { id: 'board', label: 'Board' }, { id: 'tabelle', label: 'Tabelle' }, { id: 'kalender', label: 'Kalender' }, { id: 'zoe', label: 'ZOE' }]} aktiv={darstellung} onWahl={a => gehe({ ...adresse, darstellung: a === 'liste' ? undefined : a }, 'replace')} />;
  const titel = raum ? `Aufgaben · ${raum.label}` : adresse.ansicht === 'archiv' ? 'Aufgaben · Archiv' : 'Aufgaben';
  const treffer = adresse.ansicht === 'ueberblick' && suche.trim() ? state.tasks.filter(t => suchPasst([t.title, t.description], suche)).slice(0, 40) : [];
  return (
    <HandlungProvider>
    <Seite titel={titel} rechts={
      <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Umschalter Kalender | Aufgaben (29.09., K5): springt mit Space/Projekt/Filter in den Kalender. */}
        <KalenderAufgabenSchalter aktiv="aufgaben" aufgaben={{ href: aktuell }}
          kalender={{ href: kalenderLink({ ...(raumId ? { space: bereichVonSpace(raumId), as: raumId } : {}), ...(projektId ? { ap: projektId } : {}), ...(filter.wer !== 'alle' ? { wer: filter.wer } : {}) }) }} />
        {raum && <span className="ui-nur-breit">{darstellungWahl}</span>}
        <Link href={bereichGemerkt === 'privat' ? '/os/aufgaben/board?space=privat' : '/os/aufgaben/board?space=business'} style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Zeitstrahl ›</Link>
        {!raum && <NeuAnfangenKnopf klein />}
      </span>
    }>
      {raum && <div className="ui-nur-schmal">{darstellungWahl}</div>}
      <AufgabenLeiste adresse={adresse} spaces={spaces} offenJe={offenJe} gehe={gehe} />
      <SchnellAnlegen state={state} dispatch={dispatch} spaces={spaces} vorbelegt={vorbelegt} />

      {!ready && <Karte i={1}><Leer>lade …</Leer></Karte>}
      {tot && (
        <Karte i={1}>
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
            <span>{tot === 'papierkorb' ? 'Diese Aufgabe liegt im Papierkorb.' : tot === 'archiv' ? 'Diese Aufgabe ist archiviert („Neu anfangen“).' : tot === 'unsichtbar' ? 'Diese Aufgabe ist hier nicht sichtbar.' : 'Diese Aufgabe gibt es nicht mehr.'}</span>
            {(tot === 'papierkorb' || tot === 'archiv') && <button onClick={() => gehe({ ansicht: 'archiv' })} style={{ ...leiseKnopf, color: C.aktiv }}>Zum Archiv ›</button>}
            <button onClick={() => setOffen(null)} style={{ ...leiseKnopf, marginLeft: 'auto' }}>schließen</button>
          </div>
        </Karte>
      )}
      {ready && adresse.ansicht === 'ueberblick' && darstellung !== 'zoe' && (
        <div style={{ margin: '0 0 12px' }}>
          <input type="search" value={suche} onChange={e => setSuche(e.target.value)} aria-label="In allen Aufgaben suchen" placeholder="In allen Aufgaben suchen …"
            style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />
          {suche.trim() && (
            <Karte i={1} style={{ marginTop: 8 }}>
              {treffer.map(t => (
                <button key={t.id} id={`oeffnen-${t.id}`} onClick={() => gehe({ ansicht: 'space', s: t.spaceId, a: t.id })} className="fassbar"
                  style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'baseline', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '9px 2px', minHeight: 44, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: t.status === 'done' || t.status === 'cancelled' ? C.inkLeise : C.ink }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: t.status === 'done' || t.status === 'cancelled' ? 'line-through' : 'none' }}>{t.title}</span>
                  {t.parentId && <span title="Teil von" style={{ fontSize: TYP.bedien, color: C.inkLeise, minWidth: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>in {kette(t, nachIdKarte(state.tasks)).map(x => x.title).join(' › ')}</span>}
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}>{spaces.find(x => x.id === t.spaceId)?.label ?? ''}</span>
                </button>
              ))}
              {!treffer.length && <Leer>Nichts gefunden.</Leer>}
            </Karte>
          )}
        </div>
      )}

      {ready && adresse.ansicht === 'ueberblick' && (darstellung === 'zoe'
        ? <>{offen && <div style={{ marginBottom: 14 }}>{detail(offen)}</div>}{zoeSicht}</>
        : <AufgabenUeberblick state={state} dispatch={dispatch} spaces={spaces} ich={ich} heute={heute} gehe={gehe} nur={adresse.bereich === 'business' ? 'business' : undefined} />)}
      {ready && adresse.ansicht === 'archiv' && <AufgabenArchiv state={state} dispatch={dispatch} spaces={spaces} heute={heute} gehe={gehe} />}

      {ready && raum && <>
        <Brotkrumen adresse={adresse} state={state} spaces={spaces} gehe={gehe} />
        {raum.art === 'mandant' && <MandantKopf space={raum} personen={personen} />}
        {filterZeile}
        {breit ? (
          <Spalten verhaeltnis="3:2">
            <Spalte>{inhalt}</Spalte>
            <Spalte klebt>
              {offen ? detail(offen) : <Karte i={1}><Leer>Eine Aufgabe antippen — hier stehen Status, Deadline, Zuständig, Felder, „wartet auf“, Notiz, Unteraufgaben, Zeit, Dateien, Kommentare und Verlauf.</Leer></Karte>}
              {statusZeigen && <StatusVerwalten state={state} dispatch={dispatch} spaceId={raum.id} spaceLabel={raum.label} i={3} />}
            </Spalte>
          </Spalten>
        ) : (
          <>
            {offen && <div style={{ marginBottom: 12 }}>{detail(offen)}</div>}
            {statusZeigen && <StatusVerwalten state={state} dispatch={dispatch} spaceId={raum.id} spaceLabel={raum.label} />}
            {inhalt}
          </>
        )}
      </>}
    </Seite>
    </HandlungProvider>
  );
}
