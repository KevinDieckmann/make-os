'use client';

// ─── Markttraktion · Social › Kanal anlegen/bearbeiten (26.10.2026) ──────────────────────────────────────────────────────────────────
// Name, Handle, Sprache, Plattformen, KI-Kanal + Persona, Markenprofil (Versprechen, Ton, Säulen, „sagen wir nie“, CTA, Bio) und die Zahlen der
// Leitplanken. Der Not-Aus und die Autonomie-Stufe stehen im Kopf des Kanals (eigene Schritte) — hier nur die Tageslimits.

import { useState } from 'react';
import { Karte, Ueberschrift, Knopf, Feldzeile, feld, eingabe, MehrfachPillen } from '../../ui';
import { SOCIAL_PLATTFORMEN, PLATTFORM_NAME, LEITPLANKEN_VORGABE, type SocialPlattform } from '@/lib/social/typen';
import { woerterAus, type MitStand, type SocialApi } from './daten';
import type { SocialKanal } from '@/lib/social/typen';

export function KanalForm({ api, kanal, onFertig }: { api: SocialApi; kanal?: MitStand<SocialKanal>; onFertig: (id?: string) => void }) {
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
      ...(kanal ? { id: kanal.id } : {}), name, handle, sprache, plattformen, kiKanal,
      persona: persona.trim() ? { name: persona, look } : undefined,
      marke: { versprechen, zielgruppe, ton, saeulen: woerterAus(saeulen), nieSagen: woerterAus(nieSagen), cta, bio },
      leitplanken: { autonomie: lp.autonomie, postsProTag: Number(posts), antwortenProTag: Number(antworten), dmsProTag: Number(dms), negativSchwelle: Number(negativ) },
    };
    if (await api.schreiben([{ op: 'kanal', eintrag, ...(kanal ? { stand: kanal.stand } : {}) }])) onFertig(kanal?.id ?? undefined);
  };

  return (
    <Karte>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift>{kanal ? `Kanal „${kanal.name}“ bearbeiten` : 'Neuer Kanal'}</Ueberschrift>
        <Feldzeile label="Name"><input style={eingabe} value={name} onChange={e => setName(e.target.value)} required maxLength={300} /></Feldzeile>
        <Feldzeile label="Handle (ohne @)"><input style={eingabe} value={handle} onChange={e => setHandle(e.target.value)} maxLength={60} /></Feldzeile>
        <Feldzeile label="Sprache">
          <select style={feld} value={sprache} onChange={e => setSprache(e.target.value === 'en' ? 'en' : 'de')}><option value="de">Deutsch</option><option value="en">Englisch</option></select>
        </Feldzeile>
        <Feldzeile label="Plattformen" gruppe>
          <MehrfachPillen liste={SOCIAL_PLATTFORMEN.map(p => ({ id: p, label: PLATTFORM_NAME[p] }))} aktiv={plattformen} onWahl={setPlattformen} />
        </Feldzeile>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" checked={kiKanal} onChange={e => setKiKanal(e.target.checked)} /> Offen KI-geführter Kanal (Persona in Ich-Form)
        </label>
        {kiKanal && <>
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
