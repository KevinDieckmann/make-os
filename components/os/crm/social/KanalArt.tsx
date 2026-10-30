'use client';

// ─── Markttraktion · Social › Kontotyp: Person und Absender wählen, neuer Kanal aus einer Vorlage (27.10.2026) ──────────────────────────
// Kevin 27.10.: „Einmal Faceless und einmal wirklich unsere Personenmarken oder auch die Firmenaccounts.“ Personen kommen aus dem Team des
// Haushalts (nur Konten — eine Personenmarke gehört einer angemeldeten Person), Gesellschaften aus der offenen Liste (GesellschaftWahl).
// Der neue Kanal entsteht in EINEM Schritt (`op: 'vorlage'`) mit Formaten und Ziel-Vorschlägen; Formate sind nie freigegeben.

import { useState } from 'react';
import { FARBE as C, TYP, ECKE, FLAECHE_STIL } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Feldzeile, feld, eingabe, Segmente, Hinweis } from '../../ui';
import { useTeam } from '@/hooks/useTeam';
import { GesellschaftWahl } from '../GesellschaftWahl';
import { KONTO_ARTEN, KONTO_ART_NAME, INHALT_ART_NAME, PLATTFORM_NAME, type KontoArt } from '@/lib/social/typen';
import { SOCIAL_VORLAGEN, type SocialVorlage } from '@/lib/social/vorlagen';
import type { Gesellschaft } from '@/lib/crm/typen';
import type { SocialApi } from './daten';

/** Konten des Haushalts (Speichername → Name) — nur sie können eine Personenmarke haben. */
export function usePersonen(): { speicher: string; name: string }[] {
  const { team } = useTeam();
  return team.filter(t => t.quelle === 'konto' && t.speicher).map(t => ({ speicher: t.speicher!, name: t.name }));
}

export function PersonWahl({ wert, onWert }: { wert: string; onWert: (s: string) => void }) {
  const personen = usePersonen();
  return (
    <select style={feld} value={wert} onChange={e => onWert(e.target.value)}>
      <option value="">— wessen Marke? —</option>
      {personen.map(p => <option key={p.speicher} value={p.speicher}>{p.name}</option>)}
      {wert && !personen.some(p => p.speicher === wert) && <option value={wert}>Person (nicht mehr im Haushalt)</option>}
    </select>
  );
}

export function AbsenderWahl({ wert, onWert }: { wert: string; onWert: (g: string) => void }) {
  return <GesellschaftWahl wert={(wert || 'offen') as Gesellschaft} onWahl={g => onWert(g === 'offen' ? '' : g)} />;
}

const ART_SATZ: Record<KontoArt, string> = {
  faceless: 'Kein Gesicht — das Thema ist die Marke. Auch offen KI-geführt möglich.',
  person: 'Die Marke einer Person des Haushalts. Nur sie gibt Formate frei, schaltet Stufe 2 ein und bestätigt eigene Erlebnisse.',
  firma: 'Der Account einer Gesellschaft — Absender und Impressum. Personen im Bild nur mit Einwilligung.',
};

export function NeuerKanal({ api, onFertig, ohneVorlage }: { api: SocialApi; onFertig: (neueId?: string) => void; ohneVorlage: () => void }) {
  const [art, setArt] = useState<KontoArt>('faceless');
  const [vorlage, setVorlage] = useState<SocialVorlage | null>(null);
  if (vorlage) return <AusVorlage api={api} vorlage={vorlage} onZurueck={() => setVorlage(null)} onFertig={onFertig} />;
  return (
    <Karte>
      <Ueberschrift rechts={<Knopf leise onClick={() => onFertig()}>Abbrechen</Knopf>}>Neuer Kanal</Ueberschrift>
      <Segmente liste={KONTO_ARTEN.map(a => ({ id: a, label: KONTO_ART_NAME[a] }))} aktiv={art} onWahl={setArt} umbrechen />
      <p style={{ color: C.inkDim, margin: '12px 0' }}>{ART_SATZ[art]}</p>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
        {SOCIAL_VORLAGEN.filter(v => v.art === art).map(v => (
          <button key={v.id} type="button" onClick={() => setVorlage(v)} className="ui-wahl"
            style={{ ...FLAECHE_STIL.flach, textAlign: 'left', display: 'grid', gap: 6, padding: 14, borderRadius: ECKE.flach, color: C.ink, cursor: 'pointer', minHeight: 44 }}>
            <strong>{v.name}</strong>
            <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{v.fuer}</span>
            <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{v.plattformen.map(p => PLATTFORM_NAME[p]).join(' · ')} — {v.formate.length} Formate: {v.formate.slice(0, 3).map(f => f.name).join(', ')} …</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><Knopf leise onClick={ohneVorlage}>Ohne Vorlage anlegen</Knopf></div>
    </Karte>
  );
}

function AusVorlage({ api, vorlage, onZurueck, onFertig }: { api: SocialApi; vorlage: SocialVorlage; onZurueck: () => void; onFertig: (neueId?: string) => void }) {
  const ich = api.lage?.ich ?? '';
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [sprache, setSprache] = useState<'de' | 'en'>(vorlage.kiKanal ? 'en' : 'de');
  const [person, setPerson] = useState(vorlage.art === 'person' ? ich : '');
  const [gesellschaft, setGesellschaft] = useState('');
  const [nurIch, setNurIch] = useState(false);
  const [persona, setPersona] = useState('');
  const [versprechen, setVersprechen] = useState('');
  const speichern = async () => {
    const eintrag = {
      name, handle, sprache, person: vorlage.art === 'person' ? person || undefined : undefined, gesellschaft: gesellschaft || undefined,
      sichtbarkeit: vorlage.art === 'person' && nurIch && person === ich ? 'person' : undefined,
      persona: vorlage.kiKanal && persona.trim() ? { name: persona } : undefined, versprechen,
    };
    const l = await api.schreiben([{ op: 'vorlage', vorlageId: vorlage.id, eintrag }]);
    if (l) onFertig(l.geaendert?.[0]);
  };
  return (
    <Karte>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift rechts={<Knopf leise onClick={onZurueck}>← Vorlagen</Knopf>}>{vorlage.name}</Ueberschrift>
        <span style={{ color: C.inkDim }}>{vorlage.fuer}</span>
        <Feldzeile label="Name des Kanals"><input style={eingabe} value={name} onChange={e => setName(e.target.value)} required maxLength={300} /></Feldzeile>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
          <Feldzeile label="Handle (ohne @)"><input style={eingabe} value={handle} onChange={e => setHandle(e.target.value)} maxLength={60} /></Feldzeile>
          <Feldzeile label="Sprache">
            <select style={feld} value={sprache} onChange={e => setSprache(e.target.value === 'en' ? 'en' : 'de')}><option value="de">Deutsch</option><option value="en">Englisch</option></select>
          </Feldzeile>
          {vorlage.art === 'person' && <Feldzeile label="Wessen Marke"><PersonWahl wert={person} onWert={setPerson} /></Feldzeile>}
          {vorlage.kiKanal && <Feldzeile label="Name der Persona"><input style={eingabe} value={persona} onChange={e => setPersona(e.target.value)} maxLength={60} /></Feldzeile>}
        </div>
        <Feldzeile label={vorlage.art === 'firma' ? 'Gesellschaft (Absender und Impressum)' : 'Absender fürs Impressum'}><AbsenderWahl wert={gesellschaft} onWert={setGesellschaft} /></Feldzeile>
        {vorlage.art === 'person' && person === ich && ich && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={nurIch} onChange={e => setNurIch(e.target.checked)} /> Nur ich sehe diesen Kanal (die anderen im Haushalt sehen ihn gar nicht)
          </label>
        )}
        <Feldzeile label="Versprechen (ein Satz: was bekommt, wer folgt?)"><input style={eingabe} value={versprechen} onChange={e => setVersprechen(e.target.value)} maxLength={300} /></Feldzeile>
        <div style={{ display: 'grid', gap: 6, color: C.inkDim, fontSize: TYP.bedien }}>
          <strong style={{ color: C.ink }}>Kommt mit</strong>
          <span>Plattformen: {vorlage.plattformen.map(p => PLATTFORM_NAME[p]).join(', ')} · Säulen: {vorlage.saeulen.join(', ')}</span>
          <span>Formate (nicht freigegeben): {vorlage.formate.map(f => `${f.name} (${INHALT_ART_NAME[f.art]})`).join(' · ')}</span>
          <span>Stufe {vorlage.leitplanken.autonomie ?? 1} · höchstens {vorlage.leitplanken.postsProTag ?? 3} Posts am Tag</span>
        </div>
        {vorlage.regeln.map((r, i) => <Hinweis key={i} art="info">{r}</Hinweis>)}
        <div><Knopf haupt typ="submit">Kanal anlegen</Knopf></div>
      </form>
    </Karte>
  );
}
