'use client';

// ─── Markttraktion · Marketing › Anfragen — Bausteine bestellen (31.10.) ─────────────────────────────────────────────────────────────
// Bestellungen der Website (bezahlte Arbeitspakete auf Rechnung): offen mit „Freigeben und senden“ (Rückfrage mit der Empfänger-Adresse — erst dann werden
// Rechnung gestellt und Rechnung + Download-Links verschickt) und „Ablehnen“ (Entwurf weg; eine Absage nur, wenn gewählt), darunter die erledigten.
// Einstellungen (an/aus, Gesellschaft der Rechnung, Zahlungsziel, Bestellbedingungen) nur ein Inhaber; alle im Haushalt sehen und geben frei.
// Server: /api/bausteine/intern (lib/bausteine/server.ts).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Hinweis, Schalter, Knopf, Liste, Zeile, Leer, Chip, Klappbar, Feldzeile, eingabe, auswahl, useRueckfrage } from '../../ui';
import { WEG } from '@/lib/wege';
import { euro } from '@/lib/bausteine/regeln';

interface BestellZeile {
  id: string; am: string; titel: string; status: 'neu' | 'geliefert' | 'abgelehnt' | 'storniert';
  firma: string; name: string; email: string; ort: string; land: string; netto: number; brutto: number; ustSatz: number;
  rechnung?: { id: string; nummer?: string; status: string }; unbestaetigt?: true; ausland?: true; problem?: string;
  bestaetigung?: { ok: boolean; grund?: string }; geliefert?: { am: string; ueber: string }; abgelehnt?: { am: string; grund?: string; absage?: boolean }; kontaktId?: string;
}
interface Stand {
  einstellungen: { aktiv: boolean; gesellschaft: string; zahlungszielTage: number; bedingungenText: string; bedingungenVorgabe: string };
  bereit: boolean; gruende: string[]; bedingungen: { fassung: string; zeilen: string[] }; gesellschaften: { id: string; name: string }[];
  istInhaber: boolean; katalog: number; absender: string | null; offen: BestellZeile[]; erledigt: BestellZeile[];
}

const tag = (iso: string) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STATUS: Record<BestellZeile['status'], { text: string; farbe: string }> = {
  neu: { text: 'wartet', farbe: LEUCHT.achtung }, geliefert: { text: 'geliefert', farbe: LEUCHT.gut },
  abgelehnt: { text: 'abgelehnt', farbe: C.inkDim }, storniert: { text: 'Rechnung storniert', farbe: LEUCHT.kritisch },
};

export function BausteineKarte() {
  const [d, setD] = useState<Stand | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null);
  const [erledigtOffen, setErledigtOffen] = useState(false);
  const [einstOffen, setEinstOffen] = useState(false);
  const [ziel, setZiel] = useState('');
  const [text, setText] = useState('');
  const { fragen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const r = await fetch('/api/bausteine/intern', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) { const s = await r.json() as Stand; setD(s); setZiel(String(s.einstellungen.zahlungszielTage)); setText(s.einstellungen.bedingungenText); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  if (!d) return null;

  const senden = async (body: Record<string, unknown>, erfolg?: (j: Record<string, unknown>) => string) => {
    setMeldung(null);
    const r = await fetch('/api/bausteine/intern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) as Record<string, unknown> : {};
    if (!r?.ok) setMeldung({ text: String(j.fehler ?? 'Das ging gerade nicht.'), fehler: true });
    else if (erfolg) setMeldung({ text: erfolg(j) });
    if (r?.ok && Array.isArray(j.offen)) setD(j as unknown as Stand); else await laden();
  };
  const einstellen = (teil: Record<string, unknown>) => senden({ aktion: 'einstellungen', ...teil });

  const freigeben = (z: BestellZeile) => fragen({
    titel: 'Freigeben und senden?',
    text: <>Die Rechnung wird jetzt gestellt (feste Nummer, nicht mehr änderbar) und mit den Download-Links an <b>{z.email}</b> geschickt{d.absender ? ` (über ${d.absender})` : ''}.
      {z.unbestaetigt ? ' Achtung: Die Adresse gehört zu einer Person, die schon in der Kartei steht — bitte prüfen, ob die Bestellung wirklich von ihr kommt.' : ''}
      {z.ausland ? ' Achtung: Lieferung ins Ausland — vorher die Umsatzsteuer im Rechnungsentwurf prüfen.' : ''}</>,
    wahl: [{ label: 'Freigeben und senden', tun: () => senden({ aktion: 'freigeben', id: z.id }, j => (j.schon ? 'War schon geliefert — nichts doppelt gesendet.' : `Rechnung ${String(j.nummer ?? '')} gestellt, Mail an ${z.email} ist raus.`)) }],
  });
  const ablehnen = (z: BestellZeile) => fragen({
    titel: 'Bestellung ablehnen?',
    text: 'Der Rechnungsentwurf wird gelöscht, es entsteht kein Vertrag. Ohne Absage erfährt die Person nichts — mit Absage bekommt sie eine kurze, neutrale Mail.',
    wahl: [
      { label: 'Ablehnen, ohne Mail', ton: 'gefahr', tun: () => senden({ aktion: 'ablehnen', id: z.id }, () => 'Abgelehnt — nichts verschickt.') },
      { label: 'Ablehnen und Absage senden', ton: 'leise', tun: () => senden({ aktion: 'ablehnen', id: z.id, absage: true }, () => 'Abgelehnt — die Absage ist raus.') },
    ],
  });
  const linksNeu = (z: BestellZeile) => fragen({
    titel: 'Neue Download-Links senden?',
    text: <>Neue Links (30 Tage gültig) gehen an <b>{z.email}</b> — ohne Rechnung im Anhang.</>,
    wahl: [{ label: 'Neue Links senden', tun: () => senden({ aktion: 'links-neu', id: z.id }, () => `Neue Links an ${z.email} sind raus.`) }],
  });

  const zeileUnter = (z: BestellZeile) => (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span>{z.name} · {euro(z.brutto)} brutto · {tag(z.am)}</span>
      {z.rechnung?.nummer && <Link href={WEG.rechnung(z.rechnung.id)} style={{ color: C.aktiv }}>{z.rechnung.nummer}</Link>}
      {z.status === 'neu' && z.rechnung && !z.rechnung.nummer && <Link href={WEG.rechnung(z.rechnung.id)} style={{ color: C.aktiv }}>Entwurf</Link>}
      {z.unbestaetigt && <Chip farbe={LEUCHT.achtung}>Adresse unbestätigt</Chip>}
      {z.ausland && <Chip farbe={LEUCHT.achtung}>Ausland — Steuer prüfen</Chip>}
      {z.problem && <Chip farbe={LEUCHT.kritisch} umbrechen>{z.problem}</Chip>}
      {z.status === 'neu' && z.bestaetigung && !z.bestaetigung.ok && <Chip farbe={C.inkDim}>keine Eingangsbestätigung</Chip>}
      {z.kontaktId && <Link href={WEG.akte(z.kontaktId)} style={{ color: C.aktiv }}>Kontakt</Link>}
    </span>
  );

  return (
    <Karte i={0} akzent={d.offen.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift rechts={<span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{d.einstellungen.aktiv ? (d.bereit ? 'bestellbar' : 'eingeschaltet, aber unvollständig') : 'aus'}</span>}>Bausteine</Ueberschrift>
      <div style={{ display: 'grid', gap: 10 }}>
        <Schalter an={d.einstellungen.aktiv} aus={!d.istInhaber} onChange={an => void einstellen({ aktiv: an })} erklaerung="bausteine.bestellen">Bestellen über die Website</Schalter>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Bestellungen kommen hier an, mit Anfrage in der Kartei und vorbereiteter Rechnung. Rechnung und Dateien gehen erst raus, wenn ihr „Freigeben und senden“ klickt. {d.katalog ? `${d.katalog} Bausteine im Katalog.` : 'Noch kein Katalog der Website.'}</span>
        {!d.istInhaber && <Hinweis art="info">Einstellungen ändern kann nur ein Inhaber — freigeben und ablehnen kannst du.</Hinweis>}
        {d.gruende.length > 0 && <Hinweis art="achtung" titel="Noch nicht bestellbar">{d.gruende.join(' ')}</Hinweis>}
        {meldung && <Hinweis art={meldung.fehler ? 'kritisch' : 'gut'} rolle={meldung.fehler ? 'alert' : 'status'}>{meldung.text}</Hinweis>}

        {d.offen.length ? (
          <Liste>
            {d.offen.map(z => (
              <Zeile key={z.id} umbrechen titel={`${z.firma} · ${z.titel}`} unter={zeileUnter(z)} rechts={
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Knopf onClick={async () => { freigeben(z); }}>Freigeben und senden</Knopf>
                  <Knopf leise onClick={async () => { ablehnen(z); }}>Ablehnen</Knopf>
                </span>
              } />
            ))}
          </Liste>
        ) : <Leer>Keine offenen Bestellungen.</Leer>}

        {d.erledigt.length > 0 && (
          <Klappbar id="bausteine-erledigt" titel="Erledigt" zaehler={d.erledigt.length} offen={erledigtOffen} umschalten={() => setErledigtOffen(x => !x)}>
            <Liste>
              {d.erledigt.map(z => (
                <Zeile key={z.id} umbrechen titel={`${z.firma} · ${z.titel}`} unter={zeileUnter(z)} rechts={
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip farbe={STATUS[z.status].farbe}>{STATUS[z.status].text}</Chip>
                    {z.status === 'geliefert' && <Knopf leise onClick={async () => { linksNeu(z); }}>Neue Links</Knopf>}
                  </span>
                } />
              ))}
            </Liste>
          </Klappbar>
        )}

        {d.istInhaber && (
          <Klappbar id="bausteine-einstellungen" titel="Einstellungen" offen={einstOffen} umschalten={() => setEinstOffen(x => !x)}>
            <div style={{ display: 'grid', gap: 10 }}>
              <Feldzeile label="Rechnung stellt">
                <select value={d.einstellungen.gesellschaft} onChange={e => void einstellen({ gesellschaft: e.target.value })} style={auswahl}>
                  <option value="">— wählen —</option>
                  {d.gesellschaften.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Feldzeile>
              <form onSubmit={e => { e.preventDefault(); void einstellen({ zahlungszielTage: Number(ziel), bedingungenText: text }); }} style={{ display: 'grid', gap: 8 }}>
                <Feldzeile label="Zahlungsziel (Tage)">
                  <input type="number" min={0} max={90} value={ziel} onChange={e => setZiel(e.target.value)} style={{ ...eingabe, maxWidth: 140 }} />
                </Feldzeile>
                <Feldzeile label="Bestellbedingungen (ein Punkt je Zeile, {zahlungsziel} wird ersetzt — leer = Vorgabe)">
                  <textarea value={text} onChange={e => setText(e.target.value)} placeholder={d.einstellungen.bedingungenVorgabe} rows={6} style={{ ...eingabe, minHeight: 120, resize: 'vertical' }} />
                </Feldzeile>
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Fassung {d.bedingungen.fassung} — ändert sich mit jedem Wort; wer die Seite vorher geladen hat, muss neu laden. Hinweis, keine Rechtsberatung: einmal anwaltlich gegenlesen.</span>
                <div><Knopf typ="submit">Speichern</Knopf></div>
              </form>
            </div>
          </Klappbar>
        )}
      </div>
      {dialog}
    </Karte>
  );
}
