'use client';

// ─── Markttraktion · Social › Kommentare & DMs (28.10.2026, Malin-Paket) ────────────────────────────────────────────────────────────────
// Instagram-Kommentare (je Beitrag) und Direktnachrichten (je Gegenüber) des Kanals: lesen, Entwurf von ZOE übernehmen oder selbst schreiben,
// per Klick antworten, erledigt markieren. Modus je Kanal (Einstellungskarte): Aus · Vorschlag · Auto — „Auto“ antwortet der Takt selbst, aber nur
// auf Fragen und freundliche Kommentare (lib/social/community-agent.ts). „Bei anderen kommentieren“: nur Entwurf + Link, gepostet wird von Hand.
// Not-Aus „Antworten anhalten“ und die Tageslimits des Kanals gelten (Server). Daten nur über `/api/social/community`.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Hinweis, Leerzustand, Feldzeile, feld, eingabe, Pillen, Segmente, Schalter } from '../../ui';
import type { FadenSicht, IgEntwurf, FremdKommentar } from '@/lib/social/community';
import { COMMUNITY_VORGABE, type CommunityEinstellung, type SocialKanal } from '@/lib/social/typen';
import type { MitStand, SocialApi } from './daten';

interface CommunityLage { faeden: FadenSicht[]; abgeholt: Record<string, string>; entwuerfe: Record<string, IgEntwurf>; fremd: FremdKommentar[] }

function useCommunity() {
  const [lage, setLage] = useState<CommunityLage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/social/community', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Nicht geladen.'); return; }
      setLage(j as CommunityLage);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const aktion = useCallback(async (body: Record<string, unknown>) => {
    try {
      const r = await fetch('/api/social/community', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.faeden) setLage(j as CommunityLage);
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Nicht gesendet.'); return null; }
      setFehler(null);
      return j as Record<string, unknown>;
    } catch { setFehler('Keine Verbindung — nichts gesendet.'); return null; }
  }, []);
  return { lage, fehler, setFehler, laden, aktion };
}

const zeit = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

export function Community({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const c = useCommunity();
  const [offen, setOffen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'offen' | 'alle'>('offen');
  const verbunden = api.lage!.automatik.verbindungen.some(v => v.kanalId === kanal.id && v.plattform === 'instagram' && v.zustand === 'aktiv' && (v.anbieter === 'instagram' || v.anbieter === 'probe'));
  if (!kanal.plattformen.includes('instagram')) return <Karte><Leerzustand symbol="✉" titel="Dieser Kanal ist nicht auf Instagram">Kommentare und DMs holt MAKE OS heute von Instagram. Plattform am Kanal ergänzen, dann unter „Automatik“ verbinden.</Leerzustand></Karte>;
  if (!c.lage) return c.fehler ? <Hinweis art="kritisch">{c.fehler}</Hinweis> : <Karte><span style={{ color: C.inkLeise }}>Lädt …</span></Karte>;
  const faeden = c.lage.faeden.filter(f => f.kanalId === kanal.id && (filter === 'alle' || f.offen));
  const auf = offen ? c.lage.faeden.find(f => f.id === offen) : undefined;
  const abgeholt = c.lage.abgeholt[kanal.id];
  if (auf) return <FadenAnsicht c={c} kanal={kanal} f={auf} entwurf={c.lage.entwuerfe[auf.id]} onZu={() => setOffen(null)} />;
  return (
    <>
      <Einstellung api={api} kanal={kanal} />
      {c.fehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => c.setFehler(null)}>OK</Knopf>}>{c.fehler}</Hinweis>}
      {kanal.leitplanken.antwortenAus && <Hinweis art="kritisch" titel="Not-Aus: Antworten angehalten">Lesen geht weiter, gesendet wird nichts, bis jemand „Antworten fortsetzen“ drückt.</Hinweis>}
      <Karte>
        <Ueberschrift rechts={verbunden ? <Knopf onClick={() => c.aktion({ aktion: 'abholen', kanalId: kanal.id })}>Jetzt abholen</Knopf> : undefined}>Kommentare & DMs</Ueberschrift>
        {!verbunden
          ? <Leerzustand symbol="✉" titel="Instagram ist noch nicht verbunden">Unter „Automatik“ mit Instagram verbinden — dann holt MAKE OS alle 15 Minuten neue Kommentare und Nachrichten.</Leerzustand>
          : <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <Pillen liste={[{ id: 'offen', label: 'Offen' }, { id: 'alle', label: 'Alle' }]} aktiv={filter} onWahl={(x: 'offen' | 'alle') => setFilter(x)} />
              <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{abgeholt ? `zuletzt abgeholt ${zeit(abgeholt)}` : 'noch nicht abgeholt'}</span>
            </div>
            {faeden.length === 0
              ? <Leerzustand symbol="✓" titel={filter === 'offen' ? 'Nichts offen' : 'Noch nichts da'}>{filter === 'offen' ? 'Alle Kommentare und Nachrichten sind beantwortet oder erledigt.' : 'Sobald jemand kommentiert oder schreibt, steht es hier.'}</Leerzustand>
              : <Liste>{faeden.map(f => (
                <Zeile key={f.id} onClick={() => { setOffen(f.id); if (f.ungelesen) void c.aktion({ aktion: 'gelesen', kanalId: kanal.id, faden: f.id }); }} titel={f.titel}
                  unter={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Chip farbe={f.art === 'dm' ? C.aktiv : C.inkDim}>{f.art === 'dm' ? 'DM' : 'Kommentare'}</Chip>
                    {f.ungelesen > 0 && <Chip farbe={LEUCHT.achtung}>{f.ungelesen} neu</Chip>}
                    {f.offen && c.lage!.entwuerfe[f.id] && <Chip farbe={C.aktiv}>Entwurf bereit</Chip>}
                    {f.eintraege.some(e => e.durch === 'zoe') && <Chip farbe={C.inkDim}>ZOE hat geantwortet</Chip>}
                    {f.art === 'dm' && !f.fensterOffen && f.offen && <Chip farbe={LEUCHT.kritisch}>24 h vorbei</Chip>}
                    <span style={{ color: C.inkLeise, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{f.eintraege[f.eintraege.length - 1].text}</span>
                  </span>}
                  rechts={<span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{zeit(f.zuletzt)}</span>} />
              ))}</Liste>}
          </>}
      </Karte>
      <BeiAnderen c={c} kanal={kanal} />
    </>
  );
}

/** Modus, DMs, Offenlegung, Wunsch-Accounts — gespeichert am Kanal (Stand). Auto schaltet bei einer Personenmarke nur die Person selbst (Server 403). */
function Einstellung({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const c: CommunityEinstellung = kanal.community ?? COMMUNITY_VORGABE;
  const [hinweis, setHinweis] = useState(c.hinweisDm);
  const [zeichen, setZeichen] = useState(c.zeichen);
  const [wunsch, setWunsch] = useState(c.wunsch.join(', '));
  const [ziel, setZiel] = useState(String(c.fremdJeTag));
  const speichern = (teil: Partial<CommunityEinstellung>) => api.schreiben([{ op: 'kanal', eintrag: { id: kanal.id, community: { ...c, ...teil } }, stand: kanal.stand }]);
  const fremdeMarke = kanal.art === 'person' && kanal.person && kanal.person !== api.lage!.ich;
  return (
    <Karte>
      <Ueberschrift>Antworten durch ZOE</Ueberschrift>
      <div style={{ display: 'grid', gap: 12 }}>
        <Segmente liste={[{ id: 'aus' as const, label: 'Aus' }, { id: 'vorschlag' as const, label: 'Vorschlag (ihr sendet)' }, ...(fremdeMarke && c.modus !== 'auto' ? [] : [{ id: 'auto' as const, label: 'Auto mit Leitplanken' }])]} aktiv={c.modus} umbrechen
          onWahl={(m: CommunityEinstellung['modus']) => void speichern({ modus: m })} />
        <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{c.modus === 'auto'
          ? 'ZOE antwortet selbst auf Fragen und freundliche Kommentare unter euren Beiträgen — nie auf Kritik, Beschwerden, Gesundheits-, Geld- oder Preisthemen, nie auf Spam, nie zweimal fast gleich. Das bekommt ihr als Entwurf. Tageslimits und Not-Aus gelten.'
          : c.modus === 'vorschlag' ? 'ZOE legt zu jeder neuen Nachricht einen Entwurf bereit — ihr lest und sendet mit einem Tipp.' : 'Keine Entwürfe — ihr antwortet selbst.'}
          {fremdeMarke ? ' Automatisch antworten schaltet bei einer Personenmarke nur die Person selbst ein.' : ''}</span>
        {c.modus === 'auto' && <Schalter an={c.dmsAuto} onChange={v => void speichern({ dmsAuto: v })} erklaerungOhne="Nur innerhalb von 24 Stunden nach der Nachricht der Person; die erste automatische DM trägt den KI-Hinweis.">Auch DMs automatisch beantworten</Schalter>}
        <form onSubmit={e => { e.preventDefault(); void speichern({ hinweisDm: hinweis, zeichen, wunsch: wunsch.split(/[,\s]+/).filter(Boolean), fremdJeTag: Number(ziel) || 0 }); }} style={{ display: 'grid', gap: 12 }}>
          <Feldzeile label="KI-Hinweis in der ersten automatischen DM (Pflicht, KI-VO Art. 50)"><input style={eingabe} value={hinweis} maxLength={200} onChange={e => setHinweis(e.target.value)} /></Feldzeile>
          <Feldzeile label="Zeichen am Ende automatischer Kommentar-Antworten"><input style={eingabe} value={zeichen} maxLength={40} onChange={e => setZeichen(e.target.value)} /></Feldzeile>
          <Feldzeile label="Accounts, bei denen ihr regelmäßig mitredet (mit Komma)"><input style={eingabe} value={wunsch} onChange={e => setWunsch(e.target.value)} placeholder="z. B. lauftreff.beispiel, hyrox.community" /></Feldzeile>
          <Feldzeile label="Ziel: Kommentare bei anderen je Tag"><input style={eingabe} inputMode="numeric" value={ziel} onChange={e => setZiel(e.target.value.replace(/\D/g, ''))} /></Feldzeile>
          <div><Knopf typ="submit">Speichern</Knopf></div>
        </form>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Tipp: In die Bio gehört bei automatischen Antworten ein kurzer Satz wie „Antworten teils KI-unterstützt“.</span>
      </div>
    </Karte>
  );
}

/** Bei anderen kommentieren: Link + optional Beitragstext → Entwurf von ZOE → kopieren, Beitrag öffnen, selbst posten, abhaken. */
function BeiAnderen({ c, kanal }: { c: ReturnType<typeof useCommunity>; kanal: SocialKanal }) {
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [kopiert, setKopiert] = useState<string | null>(null);
  const e = kanal.community ?? COMMUNITY_VORGABE;
  const liste = c.lage!.fremd.filter(f => f.kanalId === kanal.id).sort((a, b) => b.am.localeCompare(a.am));
  const tag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const heuteErledigt = liste.filter(f => f.erledigtAm && tag(new Date(f.erledigtAm)) === tag(new Date())).length;
  return (
    <Karte>
      <Ueberschrift rechts={e.fremdJeTag ? <Chip farbe={heuteErledigt >= e.fremdJeTag ? LEUCHT.gut : C.inkDim}>{heuteErledigt}/{e.fremdJeTag} heute</Chip> : undefined}>Bei anderen kommentieren</Ueberschrift>
      <div style={{ display: 'grid', gap: 12 }}>
        <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>ZOE schreibt einen ehrlichen, persönlichen Kommentar-Entwurf — gepostet wird von euch in der App. So bleibt das Konto sicher (automatisches Kommentieren bei anderen erlauben die Plattformen nicht).</span>
        {e.wunsch.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{e.wunsch.map(h => <Knopf key={h} leise href={`https://www.instagram.com/${h}/`}>@{h}</Knopf>)}</div>}
        <form onSubmit={async x => { x.preventDefault(); if (await c.aktion({ aktion: 'fremd-entwurf', kanalId: kanal.id, link, text })) { setLink(''); setText(''); } }} style={{ display: 'grid', gap: 10 }}>
          <Feldzeile label="Link zum Beitrag"><input style={eingabe} inputMode="url" value={link} onChange={x => setLink(x.target.value)} placeholder="https://www.instagram.com/p/…" /></Feldzeile>
          <Feldzeile label="Worum geht es im Beitrag? (optional, Text hineinkopieren — wird nicht gespeichert)"><textarea style={{ ...feld, minHeight: 72, fontSize: 16 }} value={text} maxLength={4000} onChange={x => setText(x.target.value)} /></Feldzeile>
          <div><Knopf typ="submit" aus={!link.trim()}>Entwurf schreiben</Knopf></div>
        </form>
        {liste.length > 0 && <Liste>{liste.slice(0, 20).map(f => (
          <Zeile key={f.id} titel={f.entwurf} umbrechen
            unter={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {f.erledigtAm ? <Chip farbe={LEUCHT.gut}>gepostet</Chip> : <Chip farbe={C.aktiv}>Entwurf</Chip>}
              <Knopf leise onClick={async () => { await navigator.clipboard?.writeText(f.entwurf).catch(() => {}); setKopiert(f.id); }}>{kopiert === f.id ? 'kopiert ✓' : 'Kopieren'}</Knopf>
              <Knopf leise href={f.link}>Beitrag öffnen</Knopf>
              {!f.erledigtAm && <Knopf leise onClick={() => c.aktion({ aktion: 'fremd-erledigt', kanalId: kanal.id, id: f.id })}>Gepostet ✓</Knopf>}
              <Knopf leise onClick={() => c.aktion({ aktion: 'fremd-weg', kanalId: kanal.id, id: f.id })} ariaLabel="entfernen">✕</Knopf>
            </span>} />
        ))}</Liste>}
      </div>
    </Karte>
  );
}

function FadenAnsicht({ c, kanal, f, entwurf, onZu }: { c: ReturnType<typeof useCommunity>; kanal: SocialKanal; f: FadenSicht; entwurf?: IgEntwurf; onZu: () => void }) {
  const letzteEin = [...f.eintraege].reverse().find(e => e.richtung === 'ein');
  const passt = !!entwurf && entwurf.fuer === letzteEin?.id && !!entwurf.text;
  const [text, setText] = useState(passt ? entwurf!.text : '');
  const [antwortAuf, setAntwortAuf] = useState<string | undefined>(undefined);
  const [ki, setKi] = useState(passt);
  const zu = f.art === 'dm' && !f.fensterOffen;
  return (
    <>
      {c.fehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => c.setFehler(null)}>OK</Knopf>}>{c.fehler}</Hinweis>}
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={onZu}>← Übersicht</Knopf>}>{f.titel}</Ueberschrift>
        <div style={{ display: 'grid', gap: 10 }}>
          {f.eintraege.map(e => (
            <div key={e.id} style={{ justifySelf: e.richtung === 'aus' ? 'end' : 'start', maxWidth: '85%', background: e.richtung === 'aus' ? `${C.aktiv}22` : C.flaeche, borderRadius: 14, padding: '10px 12px' }}>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 4 }}>{e.richtung === 'ein' ? `@${e.gegen.name ?? 'jemand'}` : e.durch === 'zoe' ? 'ZOE (automatisch)' : 'Wir'} · {zeit(e.am)}{e.parentId && e.richtung === 'ein' ? ' · Antwort' : ''}</div>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text || <em style={{ color: C.inkLeise }}>(ohne Text)</em>}</div>
              {f.art === 'kommentar' && e.richtung === 'ein' && <Knopf leise onClick={() => setAntwortAuf(e.id)}>{antwortAuf === e.id ? 'antworte hierauf ✓' : 'hierauf antworten'}</Knopf>}
            </div>
          ))}
        </div>
      </Karte>
      <Karte>
        <form onSubmit={async e => { e.preventDefault(); if (await c.aktion({ aktion: 'antworten', kanalId: kanal.id, faden: f.id, text, antwortAuf })) { setText(''); setKi(false); } }} style={{ display: 'grid', gap: 10 }}>
          {entwurf && entwurf.fuer === letzteEin?.id && <Hinweis art="info" titel={entwurf.text ? 'ZOE hat einen Entwurf vorbereitet' : 'ZOE hat nicht geantwortet'}>Warum nicht automatisch: {entwurf.grund}.</Hinweis>}
          {zu && <Hinweis art="achtung">Die letzte Nachricht ist älter als 24 Stunden — Instagram erlaubt dann keine Antwort per Schnittstelle. In der Instagram-App antworten.</Hinweis>}
          <Feldzeile label={f.art === 'dm' ? 'Antwort (Direktnachricht)' : 'Antwort (öffentlich unter dem Beitrag)'}>
            <textarea style={{ ...feld, minHeight: 96, fontSize: 16 }} value={text} onChange={e => setText(e.target.value)} maxLength={f.art === 'dm' ? 1000 : 2200} disabled={zu} />
          </Feldzeile>
          {ki && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Vorschlag von ZOE (KI) — vor dem Senden lesen und anpassen.</span>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Knopf haupt typ="submit" aus={zu || !text.trim() || kanal.leitplanken.antwortenAus}>Senden</Knopf>
            <Knopf aus={zu} onClick={async () => { const j = await c.aktion({ aktion: 'vorschlag', kanalId: kanal.id, faden: f.id }); if (j && typeof j.text === 'string') { setText(j.text); setKi(true); } }}>ZOE-Vorschlag</Knopf>
            <Knopf leise onClick={async () => { if (await c.aktion({ aktion: 'erledigt', kanalId: kanal.id, faden: f.id })) onZu(); }}>Erledigt ohne Antwort</Knopf>
          </div>
        </form>
      </Karte>
    </>
  );
}
