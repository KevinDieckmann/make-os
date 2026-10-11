'use client';

// ─── Unternehmen — Gesellschafts-Register und Schild (/os/unternehmen, 04.10. / 10.10.) ─────────────────────────────
// Kevin 04.10.: „Kriegen wir dort jetzt alles sauber geplant?“ — eigene Gesellschaften als offene Liste, Steckbrief, Cap-Table,
// Beteiligungen, Verträge mit Fristen, Unterlagen. Kevin 10.10.: „Welche Infos muss ich immer dokumentiert bei mir haben — rechtlich wie ein
// Schild aufstellen, das Risiko immer wieder mitbewerten.“ Die Seite ist in Reiter gegliedert (`?s=`, Wege über `WEG.schild`):
//   Überblick (Ampel je Gesellschaft und gesamt) · Gesellschaften (Liste · Archiv · Papierkorb, `?f=`) · Pflichten · Dokumente (mit Vorlagen) ·
//   Risiken · Struktur (Organigramm + Cap-Table) · Marken & Versicherungen · Verträge & Organe · Beschlüsse & Satzung (10.10.: Beschluss-Buch,
//   Gegenstand & Satzung mit Historie — `?s=beschluesse&w=<kennung>[&b=<beschluss>][&a=satzung]`, Beschluesse.tsx). Pflichten/Dokumente/Risiken/Schutz gelten je
//   BUSINESS-Gesellschaft (`?w=<kennung>`) — Daten im eigenen Business-Bestand (GET/PATCH /api/gesellschaften/schild); das Register selbst
//   bleibt unverändert (nur gelesen).
//   Alte Adressen: `?s=liste` → Gesellschaften, `?s=archiv|papierkorb` → Gesellschaften mit Filter.
//   Detail      ?g=<kennung>&r=<reiter> (Detail.tsx)
//   Ablage      ?ablage=<kennung>[&v=<vertrag>] (DSGVO-Nachtrag 04.10.): Unterlagen einer Gesellschaft bzw. eines Vertrags — auch
//               nach dem endgültigen Löschen (Aufbewahrung § 257 HGB); der Bezug steht dann als „„Name“ (gelöscht)“ da.
// Löschen/Archivieren über den gemeinsamen Baustein ZeileAktionen (Handy wischen, Rechner Knöpfe am Rand), Rückfrage statt
// window.confirm, „Rückgängig“ für 10 s. Daten: GET/POST/PATCH /api/gesellschaften (nur Haushalt des Inhabers).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, FileText, Trash2 } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Leerzustand, Leer, Reiter, Pillen, Feldzeile, eingabe, ZeileAktionen, useRueckgaengig, useRueckfrage } from '../ui';
import { zufallsUuid } from '@/lib/kennung';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { istGesellschaft, gehoertZuPrivat } from '@/lib/einheiten';
import { gesellschaftenGeaendert } from '@/lib/gesellschaften/client';
import {
  GES_STATUS, RECHTSFORMEN, istArchiviertStatus, statusLabel, rechtsformLabel, gesellschafterKurz, verweiseAnzahl, verweiseSatz,
  geloeschterBezug, geloeschtText,
  type GesStatus, type Rechtsform,
} from '@/lib/gesellschaften/modell';
import { lageAus, type SchildReiter, type Lage } from '@/lib/gesellschaften/schild/ampel';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { bezugName, klein, tagText, UnterlagenBleiben, type GAnzeige, type RegisterDaten } from './teile';
import { Detail } from './Detail';
import { useSchild, useSchildSchreiber, type SEintrag, type SchildDaten } from './schild/daten';
import { RechtBereich } from './schild/Recht';
import { Pflichten } from './schild/Pflichten';
import { Dokumente } from './schild/Dokumente';
import { Risiken } from './schild/Risiken';
import { Struktur } from './schild/Struktur';
import { Schutz } from './schild/Schutz';
import { VertraegeOrgane } from './schild/VertraegeOrgane';
import { BeschluesseBereich, type BuchAnsicht } from './Beschluesse';
import { BlickUeberblick } from './blick/Blick';
import { Assistent } from './blick/Assistent';
import { JahresstrahlKarte } from './blick/Jahresstrahl';
import { DokumenteAlle } from './blick/DokumenteRing';
import { RisikoMatrixKarte } from './blick/RisikoMatrix';
import { LebenslaufKarte } from './blick/Lebenslauf';
import { SchildZeichen, TonChip } from './blick/teile';
import { blickFuer, TON_SATZ } from '@/lib/gesellschaften/schild/blick';

type Sicht = SchildReiter;
// Reiter in zwei Gruppen (11.10., Kevin: „neun Reiter laufen über, keiner versteht, was zuerst zu tun ist“): „Lage“ (was ist zu tun) und „Akte“ (was
// gilt, wer hält wen). Kennungen und alte Adressen bleiben (`?s=`), nur die Beschriftung ist kürzer; am Handy wischt die Zeile.
const LAGE_REITER: { id: Sicht; label: string }[] = [
  { id: 'ueberblick', label: 'Überblick' }, { id: 'pflichten', label: 'Pflichten & Fristen' }, { id: 'dokumente', label: 'Dokumente' },
  { id: 'risiken', label: 'Risiken' }, { id: 'schutz', label: 'Schutz' },
];
const AKTE_REITER: { id: Sicht; label: string }[] = [
  { id: 'struktur', label: 'Struktur' }, { id: 'beschluesse', label: 'Beschlüsse & Satzung' }, { id: 'vertraege', label: 'Verträge & Organe' }, { id: 'gesellschaften', label: 'Gesellschaften' },
];
const SICHTEN: { id: Sicht; label: string }[] = [...LAGE_REITER, ...AKTE_REITER];
/** Reiter mit „Alle“ im Gesellschafts-Filter (dann das Bild über alle Gesellschaften). */
const MIT_ALLE: readonly Sicht[] = ['ueberblick', 'pflichten', 'dokumente', 'risiken'];
/** Kennung der Pille „Alle“ im Gesellschafts-Filter (keine Gesellschaft heißt so). */
const ALLE = '__alle';
type Filter = 'liste' | 'archiv' | 'papierkorb';
const FILTER: { id: Filter; label: string }[] = [{ id: 'liste', label: 'Aktiv' }, { id: 'archiv', label: 'Archiv' }, { id: 'papierkorb', label: 'Papierkorb' }];
/** Reiter + Filter aus der Adresse — alte Adressen (`s=liste|archiv|papierkorb`) bleiben gültig. */
export function sichtAus(s: string | null, f: string | null): { sicht: Sicht; filter: Filter } {
  if (s === 'liste' || s === 'archiv' || s === 'papierkorb') return { sicht: 'gesellschaften', filter: s };
  const sicht = SICHTEN.find(x => x.id === s)?.id ?? 'ueberblick';
  return { sicht, filter: FILTER.find(x => x.id === f)?.id ?? 'liste' };
}
/** Reiter, die je Business-Gesellschaft gelten (Gesellschaft-Wahl `w`) — ohne `w` zeigen die Reiter mit „Alle“ das Bild über alle. */
const JE_GESELLSCHAFT: readonly Sicht[] = ['schutz', 'beschluesse'];

/** Status → Farbe der Pille: Zustand, keine Deko. */
export const STATUS_FARBE: Record<GesStatus, string> = { geplant: C.inkDim, gruendung: LEUCHT.achtung, eingetragen: LEUCHT.gut, ruhend: C.inkLeise, aufgeloest: C.inkLeise };
export const StatusPille = ({ s }: { s?: GesStatus }) => <Chip farbe={s ? STATUS_FARBE[s] : C.inkLeise}>{statusLabel(s)}</Chip>;

export function UnternehmenView() {
  const router = useRouter();
  const params = useSearchParams();
  const offen = params.get('g');
  const { sicht, filter } = sichtAus(params.get('s'), params.get('f'));
  const [daten, setDaten] = useState<RegisterDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const schild = useSchild();

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/gesellschaften?papierkorb=1', { cache: 'no-store' });
      const d = await r.json().catch(() => null);
      if (d?.ok) { setDaten({ gesellschaften: d.gesellschaften, personen: d.personen, namen: d.namen, geloescht: d.geloescht ?? [] }); setFehler(null); }
      else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const geh = (q: { g?: string; s?: Sicht; r?: string; f?: Filter; w?: string; a?: string; e?: string }) => {
    const u = new URLSearchParams();
    if (q.g) u.set('g', q.g);
    if (q.r) u.set('r', q.r);
    if (q.s && q.s !== 'ueberblick') u.set('s', q.s);
    if (q.f && q.f !== 'liste') u.set('f', q.f);
    if (q.w) u.set('w', q.w);
    if (q.a) u.set('a', q.a);
    if (q.e) u.set('e', q.e);
    router.push(`/os/unternehmen${u.size ? `?${u}` : ''}`, { scroll: false });
  };
  const ersetzen = (g: GAnzeige) => setDaten(d => (d ? { ...d, gesellschaften: d.gesellschaften.map(x => (x.id === g.id ? g : x)) } : d));
  const heute = schild.daten?.heute ?? localDay();
  const lage = useMemo(() => (daten && schild.daten ? lageAus({ gesellschaften: daten.gesellschaften }, { gesellschaften: schild.daten.eintraege }, heute) : null), [daten, schild.daten, heute]);

  if (!daten) {
    return (
      <Seite titel="Unternehmen" unter="Eigene Gesellschaften, Pflichten, Risiken und Schutzrechte — eine Quelle.">
        {fehler ? <Hinweis art="kritisch" rolle="alert" titel="Register nicht geladen" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal versuchen</Knopf>}>{fehler}</Hinweis> : <Karte><Leer>lädt …</Leer></Karte>}
      </Seite>
    );
  }

  const ablage = params.get('ablage');
  if (ablage) return <AblageAnsicht key={`${ablage}:${params.get('v') ?? ''}`} gesellschaftId={ablage} vertragId={params.get('v') ?? undefined} zurueck={() => geh({ s: 'gesellschaften' })} />;

  const g = offen ? daten.gesellschaften.find(x => x.id === offen) : undefined;
  const weg = offen && !g ? geloeschterBezug(daten, 'gesellschaft', offen) : undefined;
  if (offen && g) return <Detail key={g.id} g={g} daten={daten} reiter={params.get('r') ?? 'steckbrief'} onReiter={r => geh({ g: g.id, r })} zurueck={() => geh({ s: 'gesellschaften' })} onNeu={ersetzen} neuLaden={laden} oeffne={id => geh({ g: id })} />;

  const business = lage?.gesellschaften ?? [];
  const w = business.find(x => x.id === params.get('w'))?.id;
  const gewaehlt = w ?? business.find(x => x.kontext.aktiv)?.id ?? business[0]?.id;
  /** Gewählte Gesellschaft — in den Reitern mit „Alle“ heißt ohne `w`: alle. */
  const filter1 = MIT_ALLE.includes(sicht) ? w : gewaehlt;
  const assistent = params.get('a') === 'ereignis';
  const mitFilter = business.length > 1 && (MIT_ALLE.includes(sicht) || sicht === 'schutz');
  const filterListe = [...(MIT_ALLE.includes(sicht) ? [{ id: ALLE, label: 'Alle' }] : []), ...business.map(x => ({ id: x.id as string, label: x.name }))];
  const wechsle = (s: Sicht) => {
    const ziel = MIT_ALLE.includes(s) ? w : JE_GESELLSCHAFT.includes(s) ? gewaehlt : undefined;
    geh({ s, ...(ziel ? { w: ziel } : {}) });
  };

  return (
    // Unternehmen (10.10.): eigener Punkt in der Leiste, getrennt von Produkte & Mandate. 11.10.: Antwort zuerst — der Überblick ist „in einem Blick“.
    <Seite titel="Unternehmen" unter="Eigene Gesellschaften, Pflichten, Risiken und Schutzrechte — eine Quelle."
      rechts={sicht === 'gesellschaften' ? (!neu && <Knopf haupt onClick={() => setNeu(true)}>+ Gesellschaft</Knopf>)
        : !assistent && business.length > 0 && <Knopf haupt href={WEG.ereignisAssistent(filter1)}>Was ist passiert?</Knopf>}>
      {offen && !g && (weg
        ? <Hinweis art="info" titel={geloeschtText(weg)}>Diese Gesellschaft wurde endgültig gelöscht. <UnterlagenBleiben href={WEG.unterlagen(weg.id)} /></Hinweis>
        : <Hinweis art="info" titel="Nicht gefunden">Diese Gesellschaft gibt es im Register nicht (mehr).</Hinweis>)}
      <div className="ui-reiter-zeile">
        <Reiter gruppe liste={LAGE_REITER} aktiv={LAGE_REITER.some(x => x.id === sicht) ? sicht : null} onWahl={wechsle} ariaLabel="Lage des Unternehmens" />
        <Reiter gruppe liste={AKTE_REITER} aktiv={AKTE_REITER.some(x => x.id === sicht) ? sicht : null} onWahl={wechsle} ariaLabel="Akte des Unternehmens" />
      </div>
      {mitFilter && !assistent && (
        <div role="group" aria-label="Gesellschaft wählen"><Pillen einzeilig liste={filterListe} aktiv={filter1 ?? (MIT_ALLE.includes(sicht) ? ALLE : gewaehlt ?? null)} onWahl={x => geh({ s: sicht, ...(x !== ALLE ? { w: x } : {}) })} /></div>
      )}
      {schild.fehler && sicht !== 'gesellschaften' && <Hinweis art="kritisch" rolle="alert" titel="Schild nicht geladen" aktion={<Knopf leise onClick={() => void schild.laden()}>Noch einmal versuchen</Knopf>}>{schild.fehler}</Hinweis>}
      {assistent && lage && schild.daten && (
        <Assistent lage={lage} daten={daten} schild={schild.daten} gewaehlt={w} situation={params.get('e') ?? undefined} heute={heute}
          waehle={q => geh({ s: sicht, a: 'ereignis', ...(q.w ? { w: q.w } : {}), ...(q.e ? { e: q.e } : {}) })}
          ersetzenRegister={ersetzen} ersetzenSchild={schild.ersetzen} schliessen={() => geh({ s: sicht, ...(w ? { w } : {}) })} />
      )}
      {sicht === 'gesellschaften' && (
        <>
          {neu && <Anlegen onFertig={async id => { setNeu(false); await laden(); await schild.laden(); if (id) geh({ g: id }); }} />}
          <div><Pillen liste={FILTER} aktiv={filter} onWahl={f => geh({ s: 'gesellschaften', f })} /></div>
          <Uebersicht daten={daten} sicht={filter} oeffne={id => geh({ g: id })} neuLaden={async () => { await laden(); await schild.laden(); }} />
        </>
      )}
      {sicht === 'struktur' && <Struktur daten={daten} schild={schild.daten?.eintraege ?? []} gewaehlt={params.get('w') ?? undefined} waehle={w => geh({ s: 'struktur', w })} oeffne={id => geh({ g: id })} />}
      {sicht === 'vertraege' && <VertraegeOrgane daten={daten} liste={daten.gesellschaften.filter(x => !x.geloeschtAm && business.some(b => b.id === x.id))} heute={heute} />}
      {sicht === 'beschluesse' && <Beschluesse daten={daten} wahl={params.get('w') ?? gewaehlt} offenId={params.get('b') ?? undefined} ansicht={params.get('a') === 'satzung' ? 'satzung' : 'buch'}
        risikenVon={id => (schild.daten?.eintraege.find(e => e.id === id)?.risiken ?? []).filter(r => !r.geloeschtAm).map(r => ({ id: r.id, titel: r.titel }))}
        geh={(w, a) => geh({ s: 'beschluesse', w, ...(a === 'satzung' ? { a } : {}) })} ersetzen={ersetzen}
        schildVon={id => schild.daten?.eintraege.find(e => e.id === id)} heute={heute} />}
      {sicht !== 'gesellschaften' && sicht !== 'struktur' && sicht !== 'vertraege' && sicht !== 'beschluesse' && (!lage || !schild.daten ? <Karte><Leer>lädt …</Leer></Karte>
        : sicht === 'ueberblick' ? <><BlickUeberblick lage={lage} schild={schild.daten} daten={daten} gewaehlt={w} heute={heute} />{!w && <RechtBereich lage={lage} gesellschaften={daten.gesellschaften} />}</>
          : !gewaehlt ? <Karte><Leerzustand symbol={<Building2 size={22} />} titel="Keine Business-Gesellschaft" aktion={<Knopf leise onClick={() => geh({ s: 'gesellschaften' })}>Zu den Gesellschaften</Knopf>}>Pflichten, Dokumente, Risiken und Schutzrechte gelten je Gesellschaft im Bereich Business.</Leerzustand></Karte>
            : MIT_ALLE.includes(sicht) && !w && business.length > 1 ? <AlleGesellschaften sicht={sicht} lage={lage} />
              : <JeGesellschaft key={filter1 ?? gewaehlt} sicht={sicht} lage={lage} id={filter1 ?? gewaehlt} schild={schild.daten} ersetzen={schild.ersetzen} personen={daten.personen} heute={heute} />)}
    </Seite>
  );
}

/**
 * Beschlüsse & Satzung (10.10.): alle Gesellschaften des Registers außer der Privat-Einheit (Gesellschafterbeschlüsse gibt es auch vor der Eintragung).
 * Ein Schreiber je Gesellschaft (`useSchreiber` im Bereich) — derselbe Weg wie im Steckbrief.
 */
function Beschluesse({ daten, wahl, offenId, ansicht, risikenVon, geh, ersetzen, schildVon, heute }: {
  daten: RegisterDaten; wahl?: string; offenId?: string; ansicht: BuchAnsicht; risikenVon: (id: string) => { id: string; titel: string }[];
  geh: (w: string, a?: BuchAnsicht) => void; ersetzen: (g: GAnzeige) => void; schildVon: (id: string) => SEintrag | undefined; heute: string;
}) {
  const liste = daten.gesellschaften.filter(x => !x.geloeschtAm && !gehoertZuPrivat(x.id));
  const g = liste.find(x => x.id === wahl) ?? liste[0];
  if (!g) return <Karte><Leerzustand symbol={<Building2 size={22} />} titel="Keine Gesellschaft" aktion={<Knopf leise href={WEG.schild('gesellschaften')}>Zu den Gesellschaften</Knopf>}>Das Beschluss-Buch führt Beschlüsse je Gesellschaft — lege zuerst eine Gesellschaft an.</Leerzustand></Karte>;
  return (
    <>
      <BeschluesseBereich key={g.id} g={g} daten={daten} liste={liste.map(x => ({ id: x.id, name: x.name }))} waehle={id => geh(id, ansicht)} onNeu={ersetzen}
        risiken={risikenVon(g.id)} offenId={offenId} ansicht={ansicht} setAnsicht={a => geh(g.id, a)} />
      {/* 11.10.: der Lebenslauf der Gesellschaft — Gründung, Beschlüsse, Fassungen, Kapital, Wechsel — als Bild unter dem Buch. */}
      {!offenId && <LebenslaufKarte key={`ll-${g.id}`} g={g} schild={schildVon(g.id)} namen={daten.namen} heute={heute} />}
    </>
  );
}

/** Ohne gewählte Gesellschaft (11.10.): das Bild über alle — Jahresplan, Firmen-Akten, Risiko-Matrix. */
function AlleGesellschaften({ sicht, lage }: { sicht: Sicht; lage: Lage }) {
  if (sicht === 'pflichten') return <><JahresstrahlKarte lage={lage} /><div style={klein}>Wähle oben eine Gesellschaft, um Pflichten zu vermerken, Ereignisse zu erfassen und das Profil zu pflegen.</div></>;
  if (sicht === 'dokumente') return <DokumenteAlle gesellschaften={lage.gesellschaften} />;
  return (
    <>
      <RisikoMatrixKarte alle je={lage.gesellschaften.map(x => ({ gesellschaftId: x.id, gesellschaft: x.name, risiken: x.risiken }))} />
      <div style={klein}>Wähle oben eine Gesellschaft, um Risiken zu erfassen, zu bewerten und Maßnahmen festzulegen.</div>
    </>
  );
}

/** Ein Reiter je Gesellschaft (Pflichten · Dokumente · Risiken · Marken & Versicherungen) mit EINEM Schreiber (Kette mit Stand). */
function JeGesellschaft({ sicht, lage, id, schild, ersetzen, personen, heute }: {
  sicht: Sicht; lage: Lage; id: string; schild: SchildDaten; ersetzen: (e: SEintrag) => void; personen: { id: string; name: string }[]; heute: string;
}) {
  const gl = lage.gesellschaften.find(x => x.id === id)!;
  const e = schild.eintraege.find(x => x.id === id) ?? ({ id: gl.id, stand: '' } as SEintrag);
  const sw = useSchildSchreiber(e, ersetzen);
  const b = blickFuer(gl, e, heute);
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SchildZeichen ton={b.ton} groesse={32} titel={`${gl.name}: ${TON_SATZ[b.ton]}`} />
        <strong style={{ fontSize: TYP.body }}>{gl.name}</strong><TonChip ton={b.ton} />
        <Link href={WEG.unternehmen(id)} style={{ ...klein, color: C.ink, marginLeft: 'auto' }}>Steckbrief ›</Link>
      </div>
      {sw.meldung && <Hinweis art="achtung" rolle="alert">{sw.meldung}</Hinweis>}
      {sw.unterwegs > 0 && <div role="status" style={klein}>speichert …</div>}
      {sicht === 'pflichten' && <Pflichten lage={gl} e={e} sw={sw} heute={heute} />}
      {sicht === 'dokumente' && <Dokumente lage={gl} e={e} sw={sw} />}
      {sicht === 'risiken' && <Risiken lage={gl} e={e} sw={sw} personen={personen} />}
      {sicht === 'schutz' && <Schutz e={e} sw={sw} heute={heute} />}
    </>
  );
}

/** Neue Gesellschaft: Name, Rechtsform, Status — der Rest im Steckbrief. */
function Anlegen({ onFertig }: { onFertig: (id?: string) => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [rechtsform, setRechtsform] = useState<Rechtsform>('gmbh');
  const [status, setStatus] = useState<GesStatus>('gruendung');
  const [fehler, setFehler] = useState<string | null>(null);
  const [anfrageId] = useState(() => `ges-${zufallsUuid()}`);
  const speichern = async () => {
    setFehler(null);
    const r = await fetch('/api/gesellschaften', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anfrageId, felder: { name, rechtsform, status } }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' }));
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    gesellschaftenGeaendert();
    await onFertig(r.gesellschaft?.id);
  };
  return (
    <Karte>
      <Ueberschrift>Neue Gesellschaft</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Name"><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Musterfirma GmbH" style={eingabe} /></Feldzeile>
        <Feldzeile label="Rechtsform"><Pillen liste={RECHTSFORMEN.map(x => ({ id: x.id, label: x.label }))} aktiv={rechtsform} onWahl={setRechtsform} /></Feldzeile>
        <Feldzeile label="Status"><Pillen liste={GES_STATUS.filter(s => !istArchiviertStatus(s.id)).map(s => ({ id: s.id, label: s.label }))} aktiv={status} onWahl={setStatus} /></Feldzeile>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf typ="submit" aus={name.trim().length < 2}>Anlegen</Knopf>
          <Knopf leise onClick={() => onFertig()}>Abbrechen</Knopf>
        </div>
      </form>
    </Karte>
  );
}

/** Gesellschaften · Archiv · Papierkorb — Zeilen mit ZeileAktionen. */
function Uebersicht({ daten, sicht, oeffne, neuLaden }: { daten: RegisterDaten; sicht: Filter; oeffne: (id: string) => void; neuLaden: () => Promise<void> }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [fehler, setFehler] = useState<string | null>(null);
  const alle = daten.gesellschaften;
  const liste = alle.filter(g => (sicht === 'papierkorb' ? !!g.geloeschtAm : !g.geloeschtAm && (sicht === 'archiv' ? istArchiviertStatus(g.status) : !istArchiviertStatus(g.status))));
  const name = (b: Parameters<typeof bezugName>[0]) => bezugName(b, daten.namen);

  const handeln = async (g: GAnzeige, aktion: string, extra: Record<string, unknown> = {}) => {
    setFehler(null);
    const r = await fetch('/api/gesellschaften', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, stand: g.stand, aktion, ...extra }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts geändert.' }));
    await neuLaden(); gesellschaftenGeaendert();
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht geändert.'); return false; }
    return true;
  };
  // Nach dem Neuladen gilt der neue Stand — „Rückgängig“ holt ihn frisch.
  const frisch = async (id: string) => { const d = await fetch('/api/gesellschaften?papierkorb=1', { cache: 'no-store' }).then(r => r.json()).catch(() => null); return (d?.gesellschaften as GAnzeige[] | undefined)?.find(x => x.id === id); };
  const archivieren = (g: GAnzeige) => fragen({
    titel: `„${g.name}“ archivieren?`, text: 'Archiviert heißt: ruhend oder aufgelöst. Sie bleibt mit allen Angaben erhalten und lässt sich jederzeit zurückholen.',
    wahl: [
      { label: 'Ruhend stellen', tun: async () => { if (await handeln(g, 'archivieren', { ziel: 'ruhend' })) melden(`„${g.name}“ ruht jetzt`, async () => { const f = await frisch(g.id); if (f) await handeln(f, 'zurueckholen'); }); } },
      { label: 'Als aufgelöst markieren', ton: 'leise', tun: async () => { if (await handeln(g, 'archivieren', { ziel: 'aufgeloest' })) melden(`„${g.name}“ als aufgelöst markiert`, async () => { const f = await frisch(g.id); if (f) await handeln(f, 'zurueckholen'); }); } },
    ],
  });
  const zurueckholen = async (g: GAnzeige) => { if (await handeln(g, 'zurueckholen')) melden(`„${g.name}“ ist zurück`); };
  const loeschen = (g: GAnzeige) => {
    const weg = async () => { if (await handeln(g, 'loeschen')) melden(`„${g.name}“ im Papierkorb`, async () => { const f = await frisch(g.id); if (f) await handeln(f, 'wiederherstellen'); }); };
    const n = verweiseAnzahl(g.verweise);
    if (!n) return void weg();
    fragen({
      titel: `„${g.name}“ löschen?`, text: `${verweiseSatz(g.verweise)} Im Papierkorb bleibt sie 30 Tage wiederherstellbar; endgültig gelöscht wird sie erst, wenn nichts mehr an ihr hängt. Archivieren ist meist der bessere Weg.`,
      wahl: [{ label: 'Stattdessen archivieren', tun: () => archivieren(g) }, { label: 'In den Papierkorb', ton: 'gefahr', tun: weg }],
    });
  };
  const endgueltig = (g: GAnzeige) => fragen({
    titel: `„${g.name}“ endgültig löschen?`, text: <>Das lässt sich nicht rückgängig machen. <UnterlagenBleiben href={WEG.unterlagen(g.id)} /></>,
    wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: async () => { if (await handeln(g, 'endgueltig')) melden(`„${g.name}“ endgültig gelöscht`); } }],
  });

  const leer = sicht === 'liste'
    ? <Leerzustand symbol={<Building2 size={22} />} titel="Noch keine Gesellschaft">Lege die erste Gesellschaft mit „+ Gesellschaft“ an.</Leerzustand>
    : <Leer symbol={sicht === 'papierkorb' ? <Trash2 size={16} /> : undefined}>{sicht === 'archiv' ? 'Keine ruhende oder aufgelöste Gesellschaft.' : 'Der Papierkorb ist leer. Gelöschtes bleibt hier 30 Tage.'}</Leer>;

  return (
    <>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <Karte>
        {!liste.length ? leer : (
          <Liste>
            {liste.map(g => {
              // 05.10.: eine Privat-Einheit (Selbstständigkeit) steht im Register (Struktur), gehört aber zum Privat-Bereich — sagen.
              const unter = [rechtsformLabel(g.rechtsform), g.sitz || g.ort, gesellschafterKurz(g, name), gehoertZuPrivat(g.id) ? 'gehört zu Privat' : null].filter(Boolean).join(' · ') || 'Steckbrief noch leer';
              const fest = istGesellschaft(g.id);
              const zeile = <Zeile titel={g.name} unter={unter} onClick={() => oeffne(g.id)} rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{!!g.luecken.length && sicht === 'liste' && <span style={klein} title={`Fehlt: ${g.luecken.join(', ')}`}>{g.luecken.length} offen</span>}<StatusPille s={g.status} /><span aria-hidden style={{ color: C.inkLeise }}>›</span></span>} />;
              if (sicht === 'papierkorb') {
                return <Zeile key={g.id} titel={g.name} unter={`gelöscht am ${g.geloeschtAm?.slice(8, 10)}.${g.geloeschtAm?.slice(5, 7)}. · ${verweiseAnzahl(g.verweise) ? verweiseSatz(g.verweise) : 'nichts hängt daran'}`}
                  rechts={<span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><Knopf leise onClick={() => handeln(g, 'wiederherstellen').then(x => { if (x) melden(`„${g.name}“ wiederhergestellt`); })}>Wiederherstellen</Knopf>{!verweiseAnzahl(g.verweise) && <Knopf leise onClick={() => endgueltig(g)}>Endgültig löschen</Knopf>}</span>} />;
              }
              return (
                <ZeileAktionen key={g.id} titel={g.name} archiviert={sicht === 'archiv'} onArchivieren={() => (sicht === 'archiv' ? zurueckholen(g) : archivieren(g))} onLoeschen={fest ? undefined : () => loeschen(g)}>
                  {zeile}
                </ZeileAktionen>
              );
            })}
          </Liste>
        )}
      </Karte>
      {sicht === 'liste' && <div style={klein}>Die drei festen Gesellschaften kommen aus den Einstellungen und lassen sich nur archivieren. Weitere legst du mit „+ Gesellschaft“ an — z. B. eine Gesellschaft in Gründung oder eine, aus der eine andere hervorgeht.</div>}
      {dialog}
      {hinweis}
    </>
  );
}

/**
 * Unterlagen einer Gesellschaft bzw. eines Vertrags aus der Ablage (DSGVO-Nachtrag 04.10.) — auch nach dem endgültigen Löschen:
 * die Unterlagen bleiben (Aufbewahrungspflicht), der Bezug steht lesbar als „„Name“ (gelöscht)“ statt eines toten Links.
 */
function AblageAnsicht({ gesellschaftId, vertragId, zurueck }: { gesellschaftId: string; vertragId?: string; zurueck: () => void }) {
  type Bezug = { gesellschaft: { name: string; geloescht: boolean } | null; vertrag?: { titel: string; geloescht: boolean } };
  const [stand, setStand] = useState<{ eintraege: DateiEintrag[]; bezug: Bezug } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    const u = new URLSearchParams({ id: gesellschaftId, ...(vertragId ? { vertrag: vertragId } : {}) });
    void fetch(`/api/gesellschaften/unterlagen?${u}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      .then(d => { if (d?.ok) { setStand({ eintraege: d.eintraege, bezug: d.bezug }); setFehler(null); } else setFehler(d?.fehler ?? 'Ablage nicht erreichbar.'); });
  }, [gesellschaftId, vertragId]);
  const b = stand?.bezug;
  const gText = !b?.gesellschaft ? 'Gesellschaft (gelöscht)' : b.gesellschaft.geloescht ? geloeschtText({ titel: b.gesellschaft.name }) : b.gesellschaft.name;
  return (
    <Seite titel="Unterlagen" unter="Aus der Dateiablage des Haushalts — verschlüsselt, nur der Haushalt des Inhabers."
      rechts={<Knopf leise onClick={zurueck}>Zum Register</Knopf>}>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <Karte>
        <Ueberschrift>Bezug</Ueberschrift>
        <div style={{ display: 'grid', gap: 6, fontSize: TYP.body, color: C.ink }}>
          <span>Gesellschaft: {b?.gesellschaft && !b.gesellschaft.geloescht
            ? <Link href={WEG.unternehmen(gesellschaftId, 'unterlagen')} style={{ color: 'inherit' }}>{gText} ›</Link>
            : <span style={{ color: C.inkDim }}>{stand ? gText : '…'}</span>}</span>
          {vertragId && <span>Vertrag: {b?.vertrag && !b.vertrag.geloescht && b.gesellschaft && !b.gesellschaft.geloescht
            ? <Link href={WEG.unternehmen(gesellschaftId, 'vertraege')} style={{ color: 'inherit' }}>„{b.vertrag.titel}“ ›</Link>
            : <span style={{ color: C.inkDim }}>{b?.vertrag ? (b.vertrag.geloescht ? geloeschtText(b.vertrag) : `„${b.vertrag.titel}“`) : '…'}</span>}</span>}
        </div>
      </Karte>
      <Karte>
        <Ueberschrift>Unterlagen</Ueberschrift>
        {!stand ? <Leer>{fehler ? 'nicht geladen' : 'lädt …'}</Leer> : !stand.eintraege.length ? <Leer symbol={<FileText size={16} />}>Keine Unterlagen in der Ablage.</Leer> : (
          <Liste>{stand.eintraege.map(e => (
            <a key={e.id} href={`/api/crm/dateien?id=${encodeURIComponent(e.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile titel={e.titel || e.datei?.name || 'Unterlage'} unter={[e.art === 'vertrag' ? 'Vertrag' : 'Unterlage', tagText(e.hochgeladenAm.slice(0, 10)), e.datei?.name].filter(Boolean).join(' · ')} rechts={<span style={klein}>herunterladen ›</span>} />
            </a>
          ))}</Liste>
        )}
        <div style={{ ...klein, marginTop: 8 }}>Aufbewahrungspflicht: Unterlagen bleiben auch nach dem endgültigen Löschen einer Gesellschaft oder eines Vertrags in der Ablage (§ 257 HGB, § 147 AO — 6 bzw. 10 Jahre).</div>
      </Karte>
    </Seite>
  );
}
