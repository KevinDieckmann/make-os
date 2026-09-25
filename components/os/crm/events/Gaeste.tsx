'use client';

// ─── Event · Gäste — Liste, Rolle, Einladungsweg, Vorschläge, Segment ───────
// Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG): per Mail oder
// LinkedIn nur mit Grundlage — die Ampel steht an jedem Gast und an jedem
// Vorschlag. Ohne Grundlage: persönlich einladen (Gespräch, Telefon mit
// Anlass). Teilnahme ist KEINE Einwilligung. Fotos nur mit Freigabe.
// Zu zweit: je Gast steht, wer einlädt und nachfasst (Standard: wer die
// Beziehung hält, ein Klick tauscht). Oben der Zähler „Kevin lädt 6 ein ·
// Malin 4“ mit dem, was noch aussteht; der Filter zeigt nur die eigenen.
// Jede Änderung am Gast geht als Teil-Änderung (nur dieses Feld).

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Punkt, Leer, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { kanalStatus, type KanalStatus } from '@/lib/crm/recht';
import { kontextAus, segmentAuswerten } from '@/lib/crm/segmente';
import { mix, mixGruppe, gaesteVorschlag, einladerMit, arbeitJePerson, type EinladerQuelle } from '@/lib/crm/eventplanung';
import { haeltBeziehung, anderer, nameVon } from '@/lib/crm/team';
import type { Teilnahme, TeilnahmeStatus } from '@/lib/crm/typen';
import { neueId, datum } from '../daten';
import { Pillen, Feld } from '../teile';
import { Person, WerFilter, useWerFilter, passtWer } from '../team';
import { GAST, ROLLEN, WEGE, MIX, AMPEL, MixAnzeige, KarteiSuche, Leise, WerTausch, JePerson, gastSetzen, eventSetzen, type ReiterProps, type Weg } from './gemeinsam';

const FOTO = [{ id: 'ja', label: 'Fotos ja' }, { id: 'nein', label: 'Fotos nein' }] as const;
const WEG_LABEL: Record<Weg, string> = { persoenlich: 'persönlich', telefon: 'Telefon', mail: 'Mail', linkedin: 'LinkedIn' };
const QUELLE: Record<EinladerQuelle, string | undefined> = { eingetragen: undefined, beziehung: 'hält die Beziehung', event: 'wie Event' };

export function Gaeste({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const nachId = useMemo(() => new Map(kontakte.map(k => [k.id, k])), [kontakte]);
  const firmen = useMemo(() => new Map(crm.stand.firmen.map(f => [f.id, f])), [crm.stand.firmen]);
  const ctx = useMemo(() => kontextAus(crm.stand, heute), [crm.stand, heute]);
  const segmente = crm.stand.segmente ?? [];
  const [filter, setFilter] = useState<'alle' | TeilnahmeStatus>('alle');
  const [segmentId, setSegmentId] = useState<string>(e.segmentId && segmente.some(s => s.id === e.segmentId) ? e.segmentId : 'kartei');
  const [mehr, setMehr] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [wahl, setWahl] = useWerFilter('event-gaeste');
  const ich = api.ich;
  const segment = segmente.find(s => s.id === segmentId);

  const gaeste = crm.stand.teilnahmen.filter(t => t.eventId === e.id);
  const m = mix(e, crm.stand.teilnahmen, kontakte, crm.stand.firmen);
  const vorschlaege = useMemo(() => gaesteVorschlag(kontakte, crm.stand, e, heute, segment?.kriterien, 24), [kontakte, crm.stand, e, heute, segment]);
  const ausSegment = useMemo(() => {
    if (!segment) return [];
    const schon = new Set(crm.stand.teilnahmen.filter(t => t.eventId === e.id).map(t => t.kontaktId));
    return segmentAuswerten(kontakte, segment.kriterien, ctx).mitglieder.filter(k => !schon.has(k.id));
  }, [segment, kontakte, ctx, crm.stand.teilnahmen, e.id]);

  const bez = (k: Kontakt) => ({ hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) });
  const wegFuer = (k: Kontakt): Weg => (kanalStatus(k, 'einladung', bez(k)).farbe === 'gruen' ? 'mail' : 'persoenlich');
  const vormerken = (k: Kontakt) => api.setze('teilnahmen', { id: neueId('t'), eventId: e.id, kontaktId: k.id, status: 'vorgemerkt', rolle: 'gast', einladungsweg: wegFuer(k) });
  const alleAusSegment = async () => {
    if (!segment || !ausSegment.length) return;
    const liste = ausSegment.slice(0, 60);
    if (!window.confirm(`${liste.length} Personen aus „${segment.name}“ vormerken?${ausSegment.length > 60 ? ` (die ersten 60 von ${ausSegment.length})` : ''}`)) return;
    setLaeuft(true);
    for (const k of liste) await vormerken(k);
    if (e.segmentId !== segment.id) await eventSetzen(api, e, { segmentId: segment.id });
    setLaeuft(false);
  };

  /** Ampel für den gewählten Weg — persönlich ist immer zulässig. */
  const wegStatus = (k: Kontakt, weg?: Weg): KanalStatus | null => {
    if (!weg || weg === 'persoenlich') return null;
    return kanalStatus(k, weg === 'mail' ? 'einladung' : weg, bez(k));
  };

  // Wer lädt ein (und fasst nach)? Eingetragen, sonst wer die Beziehung hält.
  const einladerVon = (t: Teilnahme) => einladerMit(t, nachId.get(t.kontaktId), e);
  const arbeit = arbeitJePerson(e, crm.stand.teilnahmen, nachId, heute);
  const passtPerson = (t: Teilnahme, w = wahl) => passtWer(w, einladerVon(t).person, 'event', ich);
  const andere = ich ? anderer(ich) : null;
  const werZahlen: Record<string, number> = { alle: gaeste.length };
  if (ich) werZahlen.ich = gaeste.filter(t => passtPerson(t, 'ich')).length;
  if (andere && andere !== ich) werZahlen[andere] = gaeste.filter(t => passtPerson(t, andere)).length;
  const einzuladen = Object.entries(arbeit).filter(([, a]) => a.einladen).map(([p, a]) => `${p === ich ? 'du' : nameVon(p)} ${a.einladen}`);
  const setzeEinlader = (t: Teilnahme, person: string) => {
    // Zurück auf den Standard (Beziehung) = Eintrag weg — dann folgt der Gast, wenn die Beziehung wechselt.
    const standard = einladerMit({}, nachId.get(t.kontaktId), e).person;
    void gastSetzen(api, t, { einladenDurch: person === standard ? undefined : person });
  };

  const zaehl = (s: TeilnahmeStatus) => gaeste.filter(t => t.status === s && passtPerson(t)).length;
  const imFilter = gaeste.filter(t => passtPerson(t)).length;
  const FILTER = [{ id: 'alle' as const, label: `Alle ${imFilter}` }, ...GAST.filter(g => zaehl(g.id)).map(g => ({ id: g.id, label: `${g.label} ${zaehl(g.id)}` }))];
  const sichtbar = gaeste.filter(t => (filter === 'alle' || t.status === filter) && passtPerson(t))
    .map(t => ({ t, k: nachId.get(t.kontaktId) }))
    .filter((x): x is { t: Teilnahme; k: Kontakt } => !!x.k)
    .sort((a, b) => GAST.findIndex(g => g.id === a.t.status) - GAST.findIndex(g => g.id === b.t.status) || anzeigename(a.k).localeCompare(anzeigename(b.k), 'de'));

  const gastZeile = ({ t, k }: { t: Teilnahme; k: Kontakt }) => {
    const f = k.firmaId ? firmen.get(k.firmaId) : undefined;
    const g = mixGruppe(k, f);
    const einl = kanalStatus(k, 'einladung', bez(k));
    const ws = wegStatus(k, t.einladungsweg);
    const laedt = einladerVon(t);
    return (
      <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'grid', gap: 7 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => zuKontakt(k.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.body, fontWeight: 500, padding: 0 }}>{anzeigename(k)}</button>
          <span style={{ fontSize: 12.5, color: C.inkLeise }}>{f?.name ?? k.firma}</span>
          <Chip farbe={MIX[g].farbe}>{MIX[g].label}</Chip>
          {k.kreis && <span style={{ fontSize: 12, color: C.inkLeise }}>Kreis {k.kreis}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {t.eingeladenAm && <span style={{ fontSize: 12, color: C.inkLeise }}>eingeladen {datum(t.eingeladenAm, heute)}</span>}
            {t.status === 'da' && !t.followUpAm && <Knopf leise onClick={() => { void gastSetzen(api, t, { followUpAm: heute }); void api.aktivitaet({ id: k.id, art: 'event', text: `Nachgefasst nach „${e.titel}“`, bezug: e.id }); }}>Nachgefasst</Knopf>}
            {t.followUpAm && <Chip farbe={LEUCHT.gut}>nachgefasst {datum(t.followUpAm)}</Chip>}
            <button onClick={() => { if (window.confirm(`${anzeigename(k)} von der Liste nehmen?`)) void api.weg('teilnahmen', t.id); }} aria-label="Gast entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.body }}>×</button>
          </span>
        </div>
        <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Pillen einzeilig liste={GAST} aktiv={t.status} farbe={LEUCHT.beziehung}
            onWahl={status => gastSetzen(api, t, { status, ...((status === 'eingeladen' || status === 'zugesagt') && !t.eingeladenAm ? { eingeladenAm: heute } : {}) })} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <WerTausch label="lädt ein" wert={laedt.person} ich={ich} standard={QUELLE[laedt.quelle]} onWahl={person => setzeEinlader(t, person)} />
          <Pillen liste={WEGE} aktiv={t.einladungsweg ?? null} onWahl={einladungsweg => gastSetzen(api, t, { einladungsweg })} />
          <Pillen liste={ROLLEN} aktiv={t.rolle ?? 'gast'} onWahl={rolle => gastSetzen(api, t, { rolle })} farbe={LEUCHT.agenten} />
          <Pillen liste={[...FOTO]} aktiv={t.fotofreigabe === true ? 'ja' : t.fotofreigabe === false ? 'nein' : null} onWahl={x => gastSetzen(api, t, { fotofreigabe: x === 'ja' })} farbe={LEUCHT.puls} />
        </div>
        {ws && ws.farbe !== 'gruen'
          ? <div style={{ fontSize: 12, color: AMPEL[ws.farbe] }}>● {WEG_LABEL[t.einladungsweg!]}: {ws.grund} — besser persönlich einladen.</div>
          : !t.einladungsweg && <div title={einl.grund} style={{ fontSize: 12, color: AMPEL[einl.farbe] }}>● Einladung per Mail: {einl.farbe === 'gruen' ? `zulässig (${einl.grund})` : 'nur persönlich'}</div>}
        <Feld wert={t.notiz} platzhalter="Notiz (für den Abend und das Nachfassen)" onFertig={notiz => gastSetzen(api, t, { notiz: notiz || undefined })} />
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <Ueberschrift rechts={`${gaeste.length}${e.kapazitaet ? ` / ${e.kapazitaet} Plätze` : ' Gäste'}`}>Gästeliste</Ueberschrift>
        <MixAnzeige m={m} />
      </div>

      {gaeste.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: C.inkLeise }}>Wer lädt ein</span>
            <JePerson zahlen={Object.fromEntries(Object.entries(arbeit).map(([p, a]) => [p, a.gaeste]))} />
          </div>
          <div style={{ fontSize: 12.5, color: einzuladen.length ? LEUCHT.achtung : C.inkLeise }}>
            {einzuladen.length ? `Noch einzuladen (vorgemerkt): ${einzuladen.join(' · ')} — persönlich, per Mail nur mit grüner Ampel.` : 'Niemand mehr nur vorgemerkt — Zusagen nachhalten, Nachrücker einladen.'}
          </div>
        </div>
      )}

      <div>
        {gaeste.length > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={werZahlen} />
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}><Pillen einzeilig liste={FILTER} aktiv={filter} onWahl={setFilter} /></div>
          </div>
        )}
        {sichtbar.map(gastZeile)}
        {!gaeste.length && <Leer>Noch niemand auf der Liste. Vorschläge unten oder direkt aus der Kartei hinzufügen.</Leer>}
        {gaeste.length > 0 && !sichtbar.length && <Leer>Keine Gäste in dieser Auswahl — „Alle“ zeigt die ganze Liste.</Leer>}
        <div style={{ marginTop: 10 }}><KarteiSuche api={api} e={e} platzhalter="Gast aus der Kartei hinzufügen …" onWahl={id => { const k = nachId.get(id); if (k) void vormerken(k); }} /></div>
      </div>

      <div>
        <Ueberschrift rechts={segment ? `${ausSegment.length} im Segment noch nicht auf der Liste` : undefined}>Vorschläge</Ueberschrift>
        {segmente.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
              <Pillen einzeilig liste={[{ id: 'kartei', label: 'Ganze Kartei' }, ...segmente.map(s => ({ id: s.id, label: s.name }))]} aktiv={segmentId} onWahl={setSegmentId} />
            </div>
            {segment && <div><Knopf leise aus={laeuft || !ausSegment.length} onClick={alleAusSegment}>{laeuft ? 'merkt vor …' : `Aus Segment übernehmen (${Math.min(60, ausSegment.length)})`}</Knopf></div>}
          </div>
        )}
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Kreis A/B, Kunden, Multiplikatoren und Prio A zuerst; wer in der Mischung fehlt, rückt vor. Gesperrte nie. Die Plakette zeigt, wer die Beziehung hält — sie/er lädt ein.</div>
        {vorschlaege.slice(0, mehr ? 24 : 8).map(v => (
          <div key={v.kontakt.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <Punkt farbe={MIX[v.gruppe].farbe} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: TYP.bedien, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <button onClick={() => zuKontakt(v.kontakt.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 600, padding: 0 }}>{anzeigename(v.kontakt)}</button>
                {v.kontakt.firma && <span style={{ color: C.inkLeise }}> · {v.kontakt.firma}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.gruende.join(' · ') || MIX[v.gruppe].label}</div>
            </div>
            <span title={`Hält die Beziehung: ${nameVon(haeltBeziehung(v.kontakt))} — lädt ein: ${nameVon(einladerMit({}, v.kontakt, e).person)}`} style={{ display: 'inline-flex' }}><Person id={haeltBeziehung(v.kontakt)} groesse={20} /></span>
            <span title={v.ampel.grund}><Chip farbe={v.weg === 'mail' ? LEUCHT.gut : C.inkDim}>{v.weg === 'mail' ? 'Mail ok' : 'persönlich'}</Chip></span>
            <Knopf leise onClick={() => vormerken(v.kontakt)}>+ vormerken</Knopf>
          </div>
        ))}
        {!vorschlaege.length && <Leer>{segment ? 'Alle aus diesem Segment stehen schon auf der Liste.' : 'Keine Vorschläge — Kreis, Lebensphase oder Prio in der Kartei pflegen, dann weiß die Liste, wen du meinst.'}</Leer>}
        {vorschlaege.length > 8 && <div style={{ marginTop: 8 }}><Leise onClick={() => setMehr(!mehr)}>{mehr ? 'weniger' : `alle ${vorschlaege.length} zeigen`}</Leise></div>}
      </div>
    </div>
  );
}
