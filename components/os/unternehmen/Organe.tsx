'use client';

// ─── Unternehmen › Organe & Beschlüsse (04.10. Nachtrag, Kevin: „Beschlüsse & Organe als eigene Liste je Gesellschaft“) ──
// Organe: Geschäftsführung, Prokura, Beirat … — Person im Haushalt oder Kontakt, seit/bis. Archiv = ausgeschieden („bis“ = heute).
// Beschlüsse: seit 10.10. im Beschluss-Buch (Unternehmen › Beschlüsse & Satzung, components/os/unternehmen/Beschluesse.tsx) — hier nur die letzten
// mit dem Weg dorthin (eine Stelle zum Pflegen). Organe über ZeileAktionen, Rückfrage vor „endgültig“, Rückgängig 10 s; Rechte entscheidet der Server.

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, ZeileAktionen, useRueckgaengig, useRueckfrage, feld } from '../ui';
import { localDay } from '@/lib/zeit';
import { ORGAN_FUNKTIONEN, organLabel, eintragArchiviert, type Bezug, type Organ, type OrganFunktion } from '@/lib/gesellschaften/modell';
import { BezugWahl, Felder, Feldzeile, bezugName, klein, tagText, type GAnzeige, type RegisterDaten, type useSchreiber } from './teile';
import { Papierkorb } from './Gesellschafter';
import { BeschluesseKurz } from './Beschluesse';

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];
type Was = 'archivieren' | 'zurueckholen' | 'loeschen' | 'wiederherstellen' | 'endgueltig';

export function OrganeReiter({ g, daten, schreibe }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [organForm, setOrganForm] = useState<Organ | 'neu' | null>(null);
  const heute = localDay();
  const name = (b: Bezug) => bezugName(b, daten.namen);
  const handeln = async (liste: 'organe', id: string, was: Was) => (await schreibe({ liste, eintragId: id, aktion: was })).ok;
  const organe = (g.organe ?? []).filter(o => !o.geloeschtAm);
  const aktiveOrgane = organe.filter(o => !eintragArchiviert('organe', o, heute)).sort((a, b) => a.funktion.localeCompare(b.funktion));
  const frueher = organe.filter(o => eintragArchiviert('organe', o, heute));
  const korb = (g.organe ?? []).filter(o => o.geloeschtAm).map(o => ({ liste: 'organe' as const, id: o.id, titel: `${organLabel(o.funktion)}: ${name(o.wer)}`, geloeschtAm: o.geloeschtAm! }));
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
      <BeschluesseKurz g={g} />
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
