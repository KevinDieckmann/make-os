'use client';

// ─── Unternehmen › Organe & Beschlüsse (04.10. Nachtrag, Kevin: „Beschlüsse & Organe als eigene Liste je Gesellschaft“) ──
// Organe: Geschäftsführung, Prokura, Beirat … — Person im Haushalt oder Kontakt, seit/bis. Archiv = ausgeschieden („bis“ = heute).
// Beschlüsse: Datum, Art, Titel, Inhalt, Status, Unterlagen. Archiv = aufgehoben. Löschen = Papierkorb 30 Tage.
// Alles über ZeileAktionen, Rückfrage vor „endgültig“, Rückgängig 10 s; Rechte entscheidet der Server (/api/gesellschaften).

import { useState } from 'react';
import { Gavel, Users } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, Chip, ZeileAktionen, useRueckgaengig, useRueckfrage, feld } from '../ui';
import { localDay } from '@/lib/zeit';
import { BESCHLUSS_ARTEN, BESCHLUSS_STATUS, ORGAN_FUNKTIONEN, beschlussArtLabel, organLabel, eintragArchiviert, type Beschluss, type BeschlussArt, type BeschlussStatus, type Bezug, type Organ, type OrganFunktion } from '@/lib/gesellschaften/modell';
import { BezugWahl, Auswahl, Felder, Feldzeile, bezugName, klein, tagText, type GAnzeige, type RegisterDaten, type useSchreiber } from './teile';
import { Papierkorb } from './Gesellschafter';

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];
type Was = 'archivieren' | 'zurueckholen' | 'loeschen' | 'wiederherstellen' | 'endgueltig';
const B_FARBE: Record<BeschlussStatus, string> = { entwurf: C.inkDim, gefasst: LEUCHT.gut, eingetragen: LEUCHT.gut, aufgehoben: C.inkLeise };

export function OrganeReiter({ g, daten, schreibe }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [organForm, setOrganForm] = useState<Organ | 'neu' | null>(null);
  const [beschlussForm, setBeschlussForm] = useState<Beschluss | 'neu' | null>(null);
  const heute = localDay();
  const name = (b: Bezug) => bezugName(b, daten.namen);
  const handeln = async (liste: 'organe' | 'beschluesse', id: string, was: Was) => (await schreibe({ liste, eintragId: id, aktion: was })).ok;
  const organe = (g.organe ?? []).filter(o => !o.geloeschtAm);
  const aktiveOrgane = organe.filter(o => !eintragArchiviert('organe', o, heute)).sort((a, b) => a.funktion.localeCompare(b.funktion));
  const frueher = organe.filter(o => eintragArchiviert('organe', o, heute));
  const beschluesse = (g.beschluesse ?? []).filter(b => !b.geloeschtAm).sort((a, b) => b.datum.localeCompare(a.datum));
  const korb = [...(g.organe ?? []).filter(o => o.geloeschtAm).map(o => ({ liste: 'organe' as const, id: o.id, titel: `${organLabel(o.funktion)}: ${name(o.wer)}`, geloeschtAm: o.geloeschtAm! })),
    ...(g.beschluesse ?? []).filter(b => b.geloeschtAm).map(b => ({ liste: 'beschluesse' as const, id: b.id, titel: b.titel, geloeschtAm: b.geloeschtAm! }))];
  const organZeile = (o: Organ, archiv: boolean) => {
    const t = `${organLabel(o.funktion)}: ${name(o.wer)}`;
    return (
      <ZeileAktionen key={o.id} titel={t} archiviert={archiv}
        onArchivieren={async () => { if (await handeln('organe', o.id, archiv ? 'zurueckholen' : 'archivieren')) melden(archiv ? `„${t}“ wieder aktiv` : `„${t}“ als ausgeschieden markiert`, archiv ? undefined : () => void handeln('organe', o.id, 'zurueckholen')); }}
        onLoeschen={async () => { if (await handeln('organe', o.id, 'loeschen')) melden(`„${t}“ im Papierkorb`, () => void handeln('organe', o.id, 'wiederherstellen')); }}>
        <Zeile titel={name(o.wer)} unter={[organLabel(o.funktion), o.seit ? `seit ${tagText(o.seit)}` : undefined, o.bis ? `bis ${tagText(o.bis)}` : undefined].filter(Boolean).join(' · ')} onClick={() => setOrganForm(o)} />
      </ZeileAktionen>
    );
  };
  return (
    <>
      <Karte>
        <Ueberschrift rechts={!organForm && <Knopf leise onClick={() => setOrganForm('neu')}>+ Organ</Knopf>}>Organe</Ueberschrift>
        {!aktiveOrgane.length ? <Leer symbol={<Users size={16} />} aktion={!organForm ? <Knopf leise onClick={() => setOrganForm('neu')}>Organ eintragen</Knopf> : undefined}>Noch keine Geschäftsführung, Prokura oder Beirat eingetragen.</Leer> : <Liste>{aktiveOrgane.map(o => organZeile(o, false))}</Liste>}
        {frueher.length > 0 && <><div style={{ ...klein, margin: '10px 0 4px' }}>Ausgeschieden</div><Liste>{frueher.map(o => organZeile(o, true))}</Liste></>}
      </Karte>
      {organForm && <OrganForm key={organForm === 'neu' ? 'neu' : organForm.id} daten={daten} alt={organForm === 'neu' ? undefined : organForm} schreibe={schreibe} fertig={() => setOrganForm(null)} />}
      <Karte>
        <Ueberschrift rechts={!beschlussForm && <Knopf leise onClick={() => setBeschlussForm('neu')}>+ Beschluss</Knopf>}>Beschlüsse</Ueberschrift>
        {!beschluesse.length ? <Leer symbol={<Gavel size={16} />} aktion={!beschlussForm ? <Knopf leise onClick={() => setBeschlussForm('neu')}>Beschluss eintragen</Knopf> : undefined}>Noch kein Beschluss — z. B. Gesellschafterbeschluss zur Umfirmierung oder Bestellung der Geschäftsführung.</Leer> : (
          <Liste>{beschluesse.map(b => {
            const archiv = b.status === 'aufgehoben';
            return (
              <ZeileAktionen key={b.id} titel={b.titel} archiviert={archiv}
                onArchivieren={async () => { if (await handeln('beschluesse', b.id, archiv ? 'zurueckholen' : 'archivieren')) melden(archiv ? `„${b.titel}“ wieder gültig` : `„${b.titel}“ als aufgehoben markiert`, archiv ? undefined : () => void handeln('beschluesse', b.id, 'zurueckholen')); }}
                onLoeschen={async () => { if (await handeln('beschluesse', b.id, 'loeschen')) melden(`„${b.titel}“ im Papierkorb`, () => void handeln('beschluesse', b.id, 'wiederherstellen')); }}>
                <Zeile titel={b.titel} unter={[tagText(b.datum), beschlussArtLabel(b.art), b.dateiIds?.length ? `${b.dateiIds.length} Unterlage${b.dateiIds.length === 1 ? '' : 'n'}` : undefined].filter(Boolean).join(' · ')} onClick={() => setBeschlussForm(b)}
                  rechts={<Chip farbe={B_FARBE[b.status]}>{BESCHLUSS_STATUS.find(s => s.id === b.status)?.label}</Chip>} />
              </ZeileAktionen>
            );
          })}</Liste>
        )}
      </Karte>
      {beschlussForm && <BeschlussForm key={beschlussForm === 'neu' ? 'neu' : beschlussForm.id} alt={beschlussForm === 'neu' ? undefined : beschlussForm} schreibe={schreibe} fertig={() => setBeschlussForm(null)} />}
      {korb.length > 0 && <Papierkorb eintraege={korb} wiederherstellen={id => { const e = korb.find(x => x.id === id)!; void handeln(e.liste, id, 'wiederherstellen'); }}
        endgueltig={id => { const e = korb.find(x => x.id === id)!; fragen({ titel: `„${e.titel}“ endgültig löschen?`, text: 'Das lässt sich nicht rückgängig machen. Unterlagen in der Ablage bleiben.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => handeln(e.liste, id, 'endgueltig') }] }); }} />}
      {dialog}
      {hinweis}
    </>
  );
}

function OrganForm({ daten, alt, schreibe, fertig }: { daten: RegisterDaten; alt?: Organ; schreibe: Schreibe; fertig: () => void }) {
  const [funktion, setFunktion] = useState<OrganFunktion>(alt?.funktion ?? 'geschaeftsfuehrung');
  const [wer, setWer] = useState<Bezug | null>(alt?.wer ?? null);
  const [seit, setSeit] = useState(alt?.seit ?? '');
  const [bis, setBis] = useState(alt?.bis ?? '');
  const [notiz, setNotiz] = useState(alt?.notiz ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = async () => {
    if (!wer) { setFehler('Bitte wählen, wer das Amt hat.'); return; }
    const r = await schreibe({ liste: 'organe', eintrag: { funktion, wer, seit: seit || null, bis: bis || null, notiz }, ...(alt ? { eintragId: alt.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <Karte>
      <Ueberschrift>{alt ? 'Organ ändern' : 'Organ eintragen'}</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Funktion"><Pillen liste={ORGAN_FUNKTIONEN.map(f => ({ id: f.id, label: f.label }))} aktiv={funktion} onWahl={setFunktion} /></Feldzeile>
        <Feldzeile label="Wer?"><BezugWahl daten={daten} wert={wer} arten={['person', 'kontakt']} onWahl={b => setWer(b)} /></Feldzeile>
        <Felder>
          <Feldzeile label="Seit"><input type="date" value={seit} onChange={e => setSeit(e.target.value)} aria-label="Seit" style={feld} /></Feldzeile>
          <Feldzeile label="Bis (leer = laufend)"><input type="date" value={bis} onChange={e => setBis(e.target.value)} aria-label="Bis" style={feld} /></Feldzeile>
        </Felder>
        <Feldzeile label="Notiz"><textarea value={notiz} onChange={e => setNotiz(e.target.value)} aria-label="Notiz" rows={2} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf typ="submit" aus={!wer}>{alt ? 'Speichern' : 'Eintragen'}</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
      </form>
    </Karte>
  );
}

function BeschlussForm({ alt, schreibe, fertig }: { alt?: Beschluss; schreibe: Schreibe; fertig: () => void }) {
  const [datum, setDatum] = useState(alt?.datum ?? localDay());
  const [art, setArt] = useState<BeschlussArt>(alt?.art ?? 'gesellschafterbeschluss');
  const [titel, setTitel] = useState(alt?.titel ?? '');
  const [inhalt, setInhalt] = useState(alt?.inhalt ?? '');
  const [status, setStatus] = useState<BeschlussStatus>(alt?.status ?? 'gefasst');
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = async () => {
    const r = await schreibe({ liste: 'beschluesse', eintrag: { datum, art, titel, inhalt, status }, ...(alt ? { eintragId: alt.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <Karte>
      <Ueberschrift>{alt ? 'Beschluss ändern' : 'Beschluss eintragen'}</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Felder>
          <Feldzeile label="Datum"><input type="date" value={datum} onChange={e => setDatum(e.target.value)} aria-label="Datum des Beschlusses" style={feld} /></Feldzeile>
          <Feldzeile label="Art"><Auswahl label="Art des Beschlusses" wert={art} liste={BESCHLUSS_ARTEN} onWahl={v => { if (v) setArt(v); }} /></Feldzeile>
        </Felder>
        <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} aria-label="Titel des Beschlusses" placeholder="z. B. Bestellung der Geschäftsführung" style={feld} /></Feldzeile>
        <Feldzeile label="Inhalt"><textarea value={inhalt} onChange={e => setInhalt(e.target.value)} aria-label="Inhalt" rows={3} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
        <Feldzeile label="Status"><Pillen liste={BESCHLUSS_STATUS.map(s => ({ id: s.id, label: s.label }))} aktiv={status} onWahl={setStatus} /></Feldzeile>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Die Niederschrift legst du unter „Unterlagen“ ab.</div>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf typ="submit" aus={titel.trim().length < 2}>{alt ? 'Speichern' : 'Eintragen'}</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
      </form>
    </Karte>
  );
}
