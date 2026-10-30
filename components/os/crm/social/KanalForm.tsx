'use client';

// ─── Markttraktion · Social › Kanal anlegen/bearbeiten (26.10.2026) ──────────────────────────────────────────────────────────────────
// Name, Handle, Sprache, Plattformen, KI-Kanal + Persona, Markenprofil (Versprechen, Ton, Säulen, „sagen wir nie“, CTA, Bio) und die Zahlen der
// Leitplanken. Der Not-Aus und die Autonomie-Stufe stehen im Kopf des Kanals (eigene Schritte) — hier nur die Tageslimits.

import { useState } from 'react';
import { Karte, Ueberschrift, Knopf, Feldzeile, feld, eingabe, MehrfachPillen, Segmente } from '../../ui';
import { SOCIAL_PLATTFORMEN, PLATTFORM_NAME, LEITPLANKEN_VORGABE, KONTO_ARTEN, KONTO_ART_NAME, type SocialPlattform, type KontoArt } from '@/lib/social/typen';
import { PersonWahl, AbsenderWahl } from './KanalArt';
import { woerterAus, type MitStand, type SocialApi } from './daten';
import type { SocialKanal } from '@/lib/social/typen';

export function KanalForm({ api, kanal, onFertig }: { api: SocialApi; kanal?: MitStand<SocialKanal>; onFertig: (id?: string) => void }) {
  const ich = api.lage?.ich ?? '';
  const [art, setArt] = useState<KontoArt>(kanal?.art ?? 'faceless');
  const [person, setPerson] = useState(kanal?.person ?? '');
  const [gesellschaft, setGesellschaft] = useState(kanal?.gesellschaft ?? '');
  const [nurIch, setNurIch] = useState(kanal?.sichtbarkeit === 'person');
  const [name, setName] = useState(kanal?.name ?? '');
  const [handle, setHandle] = useState(kanal?.handle ?? '');
  const [sprache, setSprache] = useState<'de' | 'en'>(kanal?.sprache ?? 'de');
  const [plattformen, setPlattformen] = useState<SocialPlattform[]>(kanal?.plattformen ?? [...SOCIAL_PLATTFORMEN]);
  const [kiKanal, setKiKanal] = useState(kanal?.kiKanal ?? false);
  const [persona, setPersona] = useState(kanal?.persona?.name ?? '');
  const [look, setLook] = useState(kanal?.persona?.look ?? '');
  const [versprechen, setVersprechen] = useState(kanal?.marke.versprechen ?? '');
  const [zielgruppe, setZielgruppe] = useState(kanal?.marke.zielgruppe ?? '');
  const [ton, setTon] = useState(kanal?.marke.ton ?? '');
  const [saeulen, setSaeulen] = useState((kanal?.marke.saeulen ?? []).join(', '));
  const [nieSagen, setNieSagen] = useState((kanal?.marke.nieSagen ?? []).join(', '));
  const [cta, setCta] = useState(kanal?.marke.cta ?? '');
  const [bio, setBio] = useState(kanal?.marke.bio ?? '');
  const lp = kanal?.leitplanken ?? LEITPLANKEN_VORGABE;
  const [posts, setPosts] = useState(String(lp.postsProTag));
  const [antworten, setAntworten] = useState(String(lp.antwortenProTag));
  const [dms, setDms] = useState(String(lp.dmsProTag));
  const [negativ, setNegativ] = useState(String(lp.negativSchwelle));

  const speichern = async () => {
    const eintrag = {
      ...(kanal ? { id: kanal.id } : {}), name, handle, sprache, plattformen, kiKanal: art === 'faceless' && kiKanal,
      art, person: art === 'person' ? person || undefined : undefined, gesellschaft: gesellschaft || undefined,
      sichtbarkeit: art === 'person' && nurIch && person ? 'person' : 'haushalt',
      persona: persona.trim() ? { name: persona, look } : undefined,
      marke: { versprechen, zielgruppe, ton, saeulen: woerterAus(saeulen), nieSagen: woerterAus(nieSagen), cta, bio },
      leitplanken: { autonomie: lp.autonomie, postsProTag: Number(posts), antwortenProTag: Number(antworten), dmsProTag: Number(dms), negativSchwelle: Number(negativ) },
    };
    const l = await api.schreiben([{ op: 'kanal', eintrag, ...(kanal ? { stand: kanal.stand } : {}) }]);
    if (l) onFertig(kanal?.id ?? l.geaendert?.[0]);
  };

  return (
    <Karte>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift>{kanal ? `Kanal „${kanal.name}“ bearbeiten` : 'Neuer Kanal'}</Ueberschrift>
        <Feldzeile label="Art des Accounts" gruppe><Segmente liste={KONTO_ARTEN.map(a => ({ id: a, label: KONTO_ART_NAME[a] }))} aktiv={art} onWahl={setArt} umbrechen /></Feldzeile>
        <Feldzeile label="Name"><input style={eingabe} value={name} onChange={e => setName(e.target.value)} required maxLength={300} /></Feldzeile>
        {art === 'person' && <Feldzeile label="Wessen Marke"><PersonWahl wert={person} onWert={setPerson} /></Feldzeile>}
        <Feldzeile label={art === 'firma' ? 'Gesellschaft (Absender und Impressum)' : 'Absender fürs Impressum'}><AbsenderWahl wert={gesellschaft} onWert={setGesellschaft} /></Feldzeile>
        {art === 'person' && person && (person === ich || kanal?.sichtbarkeit === 'person') && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={nurIch} disabled={person !== ich} onChange={e => setNurIch(e.target.checked)} /> Nur die Person der Marke sieht diesen Kanal
          </label>
        )}
        <Feldzeile label="Handle (ohne @)"><input style={eingabe} value={handle} onChange={e => setHandle(e.target.value)} maxLength={60} /></Feldzeile>
        <Feldzeile label="Sprache">
          <select style={feld} value={sprache} onChange={e => setSprache(e.target.value === 'en' ? 'en' : 'de')}><option value="de">Deutsch</option><option value="en">Englisch</option></select>
        </Feldzeile>
        <Feldzeile label="Plattformen" gruppe>
          <MehrfachPillen liste={SOCIAL_PLATTFORMEN.map(p => ({ id: p, label: PLATTFORM_NAME[p] }))} aktiv={plattformen} onWahl={setPlattformen} />
        </Feldzeile>
        {art === 'faceless' && <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" checked={kiKanal} onChange={e => setKiKanal(e.target.checked)} /> Offen KI-geführter Kanal (Persona in Ich-Form)
        </label>}
        {art === 'faceless' && kiKanal && <>
          <Feldzeile label="Name der Persona"><input style={eingabe} value={persona} onChange={e => setPersona(e.target.value)} maxLength={60} /></Feldzeile>
          <Feldzeile label="Look der Persona"><textarea style={{ ...feld, minHeight: 72 }} value={look} onChange={e => setLook(e.target.value)} maxLength={2000} /></Feldzeile>
        </>}
        <Feldzeile label="Versprechen"><input style={eingabe} value={versprechen} onChange={e => setVersprechen(e.target.value)} maxLength={300} /></Feldzeile>
        <Feldzeile label="Für wen"><textarea style={{ ...feld, minHeight: 60 }} value={zielgruppe} onChange={e => setZielgruppe(e.target.value)} maxLength={2000} /></Feldzeile>
        <Feldzeile label="Ton"><textarea style={{ ...feld, minHeight: 60 }} value={ton} onChange={e => setTon(e.target.value)} maxLength={2000} /></Feldzeile>
        <Feldzeile label="Säulen (mit Komma getrennt)"><input style={eingabe} value={saeulen} onChange={e => setSaeulen(e.target.value)} /></Feldzeile>
        <Feldzeile label="Sagen wir nie (mit Komma getrennt — der Prüfer stoppt diese Wörter)"><input style={eingabe} value={nieSagen} onChange={e => setNieSagen(e.target.value)} /></Feldzeile>
        <Feldzeile label="Aufruf am Ende (CTA)"><input style={eingabe} value={cta} onChange={e => setCta(e.target.value)} maxLength={300} /></Feldzeile>
        <Feldzeile label="Bio"><input style={eingabe} value={bio} onChange={e => setBio(e.target.value)} maxLength={300} /></Feldzeile>
        <Ueberschrift>Leitplanken je Tag</Ueberschrift>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))' }}>
          <Feldzeile label="Posts"><input style={eingabe} inputMode="numeric" value={posts} onChange={e => setPosts(e.target.value)} /></Feldzeile>
          <Feldzeile label="Antworten"><input style={eingabe} inputMode="numeric" value={antworten} onChange={e => setAntworten(e.target.value)} /></Feldzeile>
          <Feldzeile label="DMs"><input style={eingabe} inputMode="numeric" value={dms} onChange={e => setDms(e.target.value)} /></Feldzeile>
          <Feldzeile label="Not-Aus ab % negativ"><input style={eingabe} inputMode="numeric" value={negativ} onChange={e => setNegativ(e.target.value)} /></Feldzeile>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf haupt typ="submit">Speichern</Knopf>
          <Knopf leise onClick={() => onFertig()}>Abbrechen</Knopf>
        </div>
      </form>
    </Karte>
  );
}
