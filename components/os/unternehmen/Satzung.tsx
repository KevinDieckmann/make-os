'use client';

// ─── Unternehmen › Beschlüsse & Satzung: Gegenstand & Satzung mit Historie (10.10.) ─────────────────────────────────────────────────────
// Gegenstand, Satzungsfassungen, Stammkapital, Sitz, Geschäftsführung, Firmierung — jede Änderung ist eine NEUE Fassung mit „gültig ab“ und Verweis
// auf den Beschluss (nie überschrieben; eine falsche geht in den Papierkorb). „Stand am Datum X“ zeigt, was an dem Tag galt. Weicht der Steckbrief
// von der gültigen Fassung ab, bietet die Karte „Steckbrief angleichen“ an (ein Klick, Steckbrief-Schreibweg) — nichts geschieht von selbst.
// Geschrieben wird NUR über das Register (PATCH /api/gesellschaften, Liste `fassungen`). Regeln rein in lib/gesellschaften/beschluesse.ts.

import Link from 'next/link';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, Chip, ZeileAktionen, useRueckgaengig, useRueckfrage, feld, LEUCHT } from '../ui';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { ANNEHMEN } from '@/lib/dateien/regeln';
import { SATZUNG_MERKMALE, aktiveEintraege, type Fassung, type SatzungMerkmal } from '@/lib/gesellschaften/modell';
import { beschlussNummern, fassungVerlauf, fassungWert, merkmalLabel, nummerText, standAm, steckbriefAbweichungen } from '@/lib/gesellschaften/beschluesse';
import { Auswahl, Felder, Feldzeile, centEingabe, klein, tagText, type GAnzeige, type useSchreiber } from './teile';
import { useUnterlagen } from './Vertraege';
import { Papierkorb } from './Gesellschafter';

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];
const kurz = (t: string, n = 240) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function SatzungAnsicht({ g, schreibe }: { g: GAnzeige; schreibe: Schreibe }) {
  const heute = localDay();
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [tag, setTag] = useState(heute);
  const [form, setForm] = useState<SatzungMerkmal | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const stand = standAm(g, tag || heute, heute);
  const abw = steckbriefAbweichungen(g, heute);
  const nr = beschlussNummern(g.beschluesse);
  const beschlussText = (id?: string) => {
    const b = id ? (g.beschluesse ?? []).find(x => x.id === id) : undefined;
    return b ? `Beschluss ${nummerText(nr.get(b.id))} „${b.titel}“` : undefined;
  };
  const handeln = async (id: string, was: 'loeschen' | 'wiederherstellen' | 'endgueltig') => (await schreibe({ liste: 'fassungen', eintragId: id, aktion: was })).ok;
  const angleichen = async () => {
    setFehler(null);
    const r = await schreibe({ felder: Object.fromEntries(abw.map(a => [a.feld, a.wert])) });
    if (!r.ok) setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  const korb = (g.fassungen ?? []).filter(f => f.geloeschtAm);
  const mitVerlauf = SATZUNG_MERKMALE.filter(m => fassungVerlauf(g, m.id).length);

  return (
    <>
      <Karte>
        <Ueberschrift erklaerung="unternehmen.standAm" rechts={<input type="date" value={tag} onChange={e => setTag(e.target.value)} aria-label="Stand am Datum" style={{ ...feld, width: 'auto' }} />}>
          {tag === heute ? 'Gültige Fassung heute' : `Stand am ${tagText(tag)}`}
        </Ueberschrift>
        <Liste>{stand.map(s => (
          <Zeile key={s.merkmal} umbrechen titel={merkmalLabel(s.merkmal)}
            unter={s.wert ? kurz(s.wert) : s.merkmal === 'gegenstand' || s.merkmal === 'satzung' ? 'Noch keine Fassung festgehalten.' : '—'}
            rechts={<span style={{ ...klein, textAlign: 'right' }}>{s.fassung ? `ab ${tagText(s.fassung.ab)}` : s.wert ? 'aus dem Steckbrief' : ''}{s.kommt ? ` · neu ab ${tagText(s.kommt.ab)}` : ''}</span>} />
        ))}</Liste>
        {tag !== heute && <div style={{ marginTop: 8 }}><Knopf leise onClick={() => setTag(heute)}>Zurück zu heute</Knopf></div>}
      </Karte>
      {abw.length > 0 && (
        <Hinweis art="info" titel="Steckbrief weicht von der gültigen Fassung ab" aktion={<Knopf leise onClick={angleichen}>Steckbrief angleichen</Knopf>}>
          {abw.map(a => `${merkmalLabel(a.merkmal)}: Steckbrief „${a.steckbrief ?? '—'}“, Fassung ab ${tagText(a.fassung.ab)} „${kurz(fassungWert(a.fassung), 80)}“`).join(' · ')}.
        </Hinweis>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <Karte>
        <Ueberschrift erklaerung="unternehmen.fassung" rechts={!form && <Knopf leise onClick={() => setForm('gegenstand')}>+ Neue Fassung</Knopf>}>Fassungen (Historie)</Ueberschrift>
        {!mitVerlauf.length ? <Leer symbol={<ScrollText size={16} />} aktion={!form ? <Knopf leise onClick={() => setForm('gegenstand')}>Gegenstand festhalten</Knopf> : undefined}>Noch keine Fassung — z. B. den Gegenstand laut Gründungssatzung mit „gültig ab“ Eintragung.</Leer> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {mitVerlauf.map(m => (
              <section key={m.id} aria-label={m.label} style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontSize: TYP.bedien }}>{m.label}</strong>
                <Liste>{fassungVerlauf(g, m.id).map((f, i) => (
                  <ZeileAktionen key={f.id} titel={`${m.label} ab ${tagText(f.ab)}`}
                    onLoeschen={async () => { if (await handeln(f.id, 'loeschen')) melden(`Fassung ab ${tagText(f.ab)} im Papierkorb`, () => void handeln(f.id, 'wiederherstellen')); }}>
                    <Zeile umbrechen titel={kurz(fassungWert(f) || 'Fassung', 400)}
                      unter={[`gültig ab ${tagText(f.ab)}`, beschlussText(f.beschlussId), f.dateiIds?.length ? `${f.dateiIds.length} Unterlage${f.dateiIds.length === 1 ? '' : 'n'}` : undefined, f.notiz].filter(Boolean).join(' · ')}
                      rechts={i === 0 && f.ab <= heute ? <Chip farbe={LEUCHT.gut}>gilt</Chip> : f.ab > heute ? <Chip farbe={LEUCHT.achtung}>kommt</Chip> : undefined} />
                  </ZeileAktionen>
                ))}</Liste>
              </section>
            ))}
          </div>
        )}
        <div style={{ ...klein, marginTop: 8 }}>Eine Fassung wird nie überschrieben — eine Änderung ist eine neue Fassung mit „gültig ab“. Am besten mit Verweis auf den Beschluss und dem Wortlaut mit Notarbescheinigung als Unterlage.</div>
      </Karte>
      {form && <FassungForm key={form} g={g} start={form} schreibe={schreibe} fertig={() => setForm(null)} />}
      {korb.length > 0 && <Papierkorb eintraege={korb.map(f => ({ id: f.id, titel: `${merkmalLabel(f.merkmal)} ab ${tagText(f.ab)}`, geloeschtAm: f.geloeschtAm! }))} wiederherstellen={id => void handeln(id, 'wiederherstellen')}
        endgueltig={id => { const f = korb.find(x => x.id === id)!; fragen({ titel: `Fassung „${merkmalLabel(f.merkmal)} ab ${tagText(f.ab)}“ endgültig löschen?`, text: 'Das lässt sich nicht rückgängig machen. Unterlagen in der Ablage bleiben.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => handeln(id, 'endgueltig') }] }); }} />}
      {dialog}
      {hinweis}
    </>
  );
}

function FassungForm({ g, start, schreibe, fertig }: { g: GAnzeige; start: SatzungMerkmal; schreibe: Schreibe; fertig: () => void }) {
  const [merkmal, setMerkmal] = useState<SatzungMerkmal>(start);
  const [ab, setAb] = useState(localDay());
  const [wert, setWert] = useState('');
  const [beschlussId, setBeschlussId] = useState('');
  const [dateiIds, setDateiIds] = useState<string[]>([]);
  const [notiz, setNotiz] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const u = useUnterlagen(g.id);
  const nr = beschlussNummern(g.beschluesse);
  const beschluesse = aktiveEintraege(g.beschluesse).filter(b => b.status !== 'entwurf').sort((a, b) => b.datum.localeCompare(a.datum));
  const speichern = async () => {
    setFehler(null);
    const eintrag: Record<string, unknown> = { merkmal, ab, ...(merkmal === 'stammkapital' ? { cent: wert } : { text: wert }), ...(beschlussId ? { beschlussId } : {}), ...(dateiIds.length ? { dateiIds } : {}), ...(notiz ? { notiz } : {}) };
    const r = await schreibe({ liste: 'fassungen', eintrag });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  const vorher = fassungVerlauf(g, merkmal)[0] as Fassung | undefined;
  return (
    <Karte>
      <Ueberschrift>Neue Fassung</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Was"><Pillen liste={SATZUNG_MERKMALE.map(m => ({ id: m.id, label: m.label }))} aktiv={merkmal} onWahl={m => { setMerkmal(m); setWert(''); }} /></Feldzeile>
        <Felder>
          <Feldzeile label="Gültig ab"><input type="date" value={ab} onChange={e => setAb(e.target.value)} aria-label="Gültig ab" style={feld} /></Feldzeile>
          <Feldzeile label="Aus Beschluss"><Auswahl label="Aus Beschluss" wert={beschlussId} leer="— ohne Beschluss —" liste={beschluesse.map(b => ({ id: b.id, label: `${nummerText(nr.get(b.id))} · ${tagText(b.datum)} · ${b.titel}` }))} onWahl={setBeschlussId} /></Feldzeile>
        </Felder>
        <Feldzeile label={merkmal === 'stammkapital' ? 'Stammkapital (€)' : merkmal === 'satzung' ? 'Bezeichnung der Fassung' : `${merkmalLabel(merkmal)} (Wortlaut)`}>
          {merkmal === 'gegenstand'
            ? <textarea value={wert} onChange={e => setWert(e.target.value)} aria-label="Gegenstand des Unternehmens" rows={4} placeholder="Gegenstand des Unternehmens ist …" style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
            : <input value={wert} onChange={e => setWert(e.target.value)} aria-label={merkmalLabel(merkmal)} inputMode={merkmal === 'stammkapital' ? 'decimal' : undefined} placeholder={merkmal === 'stammkapital' ? 'z. B. 25.000' : merkmal === 'satzung' ? 'z. B. Neufassung des Gesellschaftsvertrags' : ''} style={feld} />}
        </Feldzeile>
        {vorher && <div style={klein}>Bisher (ab {tagText(vorher.ab)}): {kurz(fassungWert(vorher), 160) || '—'}{merkmal === 'stammkapital' && vorher.cent !== undefined ? ` (${centEingabe(vorher.cent)} €)` : ''} — bleibt in der Historie.</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Unterlagen (Wortlaut mit Notarbescheinigung, Registerauszug)</span>
          {(u.liste ?? []).map(e => (
            <label key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: TYP.body, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={dateiIds.includes(e.id)} onChange={x => setDateiIds(l => (x.target.checked ? [...l, e.id] : l.filter(y => y !== e.id)))} style={{ width: 20, height: 20 }} />
              {e.titel || e.datei?.name || 'Unterlage'}
            </label>
          ))}
          <label style={{ fontSize: TYP.bedien, color: C.inkDim }}>
            Neue Datei: <input type="file" accept={ANNEHMEN} aria-label="Unterlage zur Fassung hochladen" onChange={async e => { const d = e.target.files?.[0]; e.target.value = ''; if (!d) return; const neu = await u.hochladen(d, 'sonstig', `${merkmalLabel(merkmal)} ab ${tagText(ab)}`); if (neu) setDateiIds(l => [...l, neu.id]); }} />
          </label>
        </div>
        <Feldzeile label="Notiz"><input value={notiz} onChange={e => setNotiz(e.target.value)} aria-label="Notiz" style={feld} /></Feldzeile>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf typ="submit" aus={!ab || (merkmal !== 'satzung' && !wert.trim())}>Festhalten</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
      </form>
    </Karte>
  );
}

/** Für den Steckbrief: die gültige Fassung von Gegenstand und Satzung (der Rest steht im Steckbrief selbst) und der Weg zur Historie. */
export function GueltigeFassungKarte({ g }: { g: GAnzeige }) {
  const heute = localDay();
  const stand = standAm(g, heute, heute);
  const gegenstand = stand.find(s => s.merkmal === 'gegenstand');
  const satzung = stand.find(s => s.merkmal === 'satzung');
  const neu = stand.filter(s => s.kommt);
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.fassungSteckbrief" rechts={<Knopf leise href={WEG.beschluss(g.id, undefined, 'satzung')}>Historie ›</Knopf>}>Gegenstand & Satzung</Ueberschrift>
      <div style={{ display: 'grid', gap: 10, fontSize: TYP.body, color: C.ink, lineHeight: 1.55 }}>
        <div><span style={klein}>Gegenstand{gegenstand?.fassung ? ` · gültig ab ${tagText(gegenstand.fassung.ab)}` : ''}</span><div>{gegenstand?.wert ?? <span style={{ color: C.inkDim }}>Noch nicht festgehalten.</span>}</div></div>
        <div><span style={klein}>Satzung</span><div>{satzung?.fassung ? `${satzung.wert || 'Fassung'} · gültig ab ${tagText(satzung.fassung.ab)}` : <span style={{ color: C.inkDim }}>Noch keine Fassung festgehalten.</span>}</div></div>
        {neu.map(s => <div key={s.merkmal} style={klein}>Beschlossen: {merkmalLabel(s.merkmal)} neu ab {tagText(s.kommt!.ab)}.</div>)}
        <div style={klein}><Link href={WEG.beschluss(g.id)} style={{ color: C.ink }}>Beschluss-Buch ›</Link></div>
      </div>
    </Karte>
  );
}
