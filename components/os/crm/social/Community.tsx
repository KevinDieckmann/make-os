'use client';

// ─── Markttraktion · Social › Kommentare & DMs (28.10.2026, Malin-Paket) ────────────────────────────────────────────────────────────────
// Instagram-Kommentare (je Beitrag) und Direktnachrichten (je Gegenüber) des Kanals: lesen, ZOE um einen Vorschlag bitten, per Klick
// antworten, erledigt markieren. Nichts geht automatisch raus. Not-Aus „Antworten anhalten“ und die Tageslimits des Kanals gelten (Server).
// Daten nur über `/api/social/community`.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Hinweis, Leerzustand, Feldzeile, feld, Pillen } from '../../ui';
import type { FadenSicht } from '@/lib/social/community';
import type { SocialKanal } from '@/lib/social/typen';
import type { MitStand, SocialApi } from './daten';

interface CommunityLage { faeden: FadenSicht[]; abgeholt: Record<string, string> }

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
  if (auf) return <FadenAnsicht c={c} kanal={kanal} f={auf} onZu={() => setOffen(null)} />;
  return (
    <>
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
                    {f.art === 'dm' && !f.fensterOffen && f.offen && <Chip farbe={LEUCHT.kritisch}>24 h vorbei</Chip>}
                    <span style={{ color: C.inkLeise, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{f.eintraege[f.eintraege.length - 1].text}</span>
                  </span>}
                  rechts={<span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{zeit(f.zuletzt)}</span>} />
              ))}</Liste>}
          </>}
      </Karte>
    </>
  );
}

function FadenAnsicht({ c, kanal, f, onZu }: { c: ReturnType<typeof useCommunity>; kanal: SocialKanal; f: FadenSicht; onZu: () => void }) {
  const [text, setText] = useState('');
  const [antwortAuf, setAntwortAuf] = useState<string | undefined>(undefined);
  const [ki, setKi] = useState(false);
  const zu = f.art === 'dm' && !f.fensterOffen;
  return (
    <>
      {c.fehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => c.setFehler(null)}>OK</Knopf>}>{c.fehler}</Hinweis>}
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={onZu}>← Übersicht</Knopf>}>{f.titel}</Ueberschrift>
        <div style={{ display: 'grid', gap: 10 }}>
          {f.eintraege.map(e => (
            <div key={e.id} style={{ justifySelf: e.richtung === 'aus' ? 'end' : 'start', maxWidth: '85%', background: e.richtung === 'aus' ? `${C.aktiv}22` : C.flaeche, borderRadius: 14, padding: '10px 12px' }}>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 4 }}>{e.richtung === 'ein' ? `@${e.gegen.name ?? 'jemand'}` : 'Wir'} · {zeit(e.am)}{e.parentId && e.richtung === 'ein' ? ' · Antwort' : ''}</div>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text || <em style={{ color: C.inkLeise }}>(ohne Text)</em>}</div>
              {f.art === 'kommentar' && e.richtung === 'ein' && <Knopf leise onClick={() => setAntwortAuf(e.id)}>{antwortAuf === e.id ? 'antworte hierauf ✓' : 'hierauf antworten'}</Knopf>}
            </div>
          ))}
        </div>
      </Karte>
      <Karte>
        <form onSubmit={async e => { e.preventDefault(); if (await c.aktion({ aktion: 'antworten', kanalId: kanal.id, faden: f.id, text, antwortAuf })) { setText(''); setKi(false); } }} style={{ display: 'grid', gap: 10 }}>
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
