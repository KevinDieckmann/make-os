'use client';

// ─── Inbox 2 — Beleg aus einer Mail ablegen (06.10.2026) ────────────────────────────────────────────────────────
// Kevin 06.10.: „alles ist Vorschlag + ein Klick, auch Beleg-Ablage.“ Zwei Klicks über die BESTEHENDEN Wege des Finanz-Moduls:
//   1. „Beleg lesen“: der Anhang kommt frisch aus dem Postfach (Download-Weg der Inbox) und geht an /api/beleg (liest nur, schreibt nichts)
//   2. „Als Buchung übernehmen“ bzw. „Als Rechnung übernehmen“: /api/beleg/uebernehmen — erst jetzt wird geschrieben,
//      in die Gesellschaft des Postfach-Bereichs (KD Ventures, MAKE …). Privat und Register-Gesellschaften ohne Finanzplan: Hinweis statt Weg.
// Nur mit Finanz-Zugang (sonst sagt die Route 403 und die Karte erklärt es).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { istGesellschaft } from '@/lib/einheiten';
import { Knopf, Hinweis } from '../ui';
import { anhangLink, senden } from './daten';

interface Gelesen { partner?: string; datum?: string; betragBrutto?: number; betragNetto?: number; ustSatz?: number; kategorie?: string; zweck?: string; faellig?: string; rechnungsnummer?: string; richtung?: string; waehrung?: string }

const neueId = () => `anf-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

export function BelegAusMail({ quelle, bereich, vorschlag, onZu, meldung }: {
  quelle: string; bereich: string | null; vorschlag?: { nachricht: string; teil: string; name: string; typ: string }; onZu: () => void; meldung: (t: string) => void;
}) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [beleg, setBeleg] = useState<Gelesen | null>(null);
  const [fehler, setFehler] = useState('');
  const [anfrageId] = useState(neueId);
  const firma = bereich && istGesellschaft(bereich) ? bereich : null;

  if (!vorschlag) return <Hinweis art="info" aktion={<Knopf leise onClick={onZu}>Schließen</Knopf>}>In diesem Gespräch gibt es keinen lesbaren Beleg (PDF oder Foto).</Hinweis>;
  if (!firma) return <Hinweis art="info" aktion={<Knopf leise onClick={onZu}>Schließen</Knopf>}>{bereich === 'privat' ? 'Private Belege bitte unter Finanzen › Privat erfassen — hier landen nur Belege einer Gesellschaft.' : 'Dieses Postfach gehört zu keiner Gesellschaft mit Finanzplan — den Beleg bitte direkt unter Zahlen erfassen.'}</Hinweis>;

  const lesen = async () => {
    setLaeuft('lesen'); setFehler('');
    try {
      const r = await fetch(anhangLink(quelle, vorschlag.nachricht, vorschlag.teil));
      if (!r.ok) throw new Error('Der Anhang ließ sich nicht holen.');
      const b = new Uint8Array(await r.arrayBuffer());
      let bin = '';
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
      const typ = /pdf/i.test(vorschlag.typ) || /\.pdf$/i.test(vorschlag.name) ? 'application/pdf' : vorschlag.typ;
      const x = await senden<{ beleg?: Gelesen; error?: string }>('/api/beleg', { datei: btoa(bin), medientyp: typ, name: vorschlag.name });
      if (x.d.ok && x.d.beleg) setBeleg(x.d.beleg); else setFehler(String(x.d.error ?? x.d.fehler ?? (x.status === 403 ? 'Für Belege fehlt der Finanz-Zugang.' : 'Der Beleg ließ sich nicht lesen.')));
    } catch (e) { setFehler(e instanceof Error ? e.message : 'Der Beleg ließ sich nicht lesen.'); }
    setLaeuft(null);
  };
  const uebernehmen = async (ziel: 'buchung' | 'rechnung') => {
    if (!beleg) return;
    setLaeuft('speichern');
    const r = await senden<{ angelegt?: string; wo?: string; error?: string }>('/api/beleg/uebernehmen', { ziel, firma, partner: beleg.partner, datum: beleg.datum, betragBrutto: beleg.betragBrutto, betragNetto: beleg.betragNetto, ustSatz: beleg.ustSatz, kategorie: beleg.kategorie, zweck: beleg.zweck, faellig: beleg.faellig, rechnungsnummer: beleg.rechnungsnummer, anfrageId });
    setLaeuft(null);
    if (r.d.ok) { meldung(`Übernommen: ${r.d.angelegt ?? 'Beleg'} → ${r.d.wo ?? 'Finanzen'}`); onZu(); } else setFehler(String(r.d.error ?? r.d.fehler ?? 'Nicht übernommen.'));
  };
  const zahl = (n?: number) => (n == null ? '—' : `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${beleg?.waehrung ?? 'EUR'}`);

  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 16, border: `1px solid ${C.linie}` }} data-inbox="beleg">
      <div style={{ fontWeight: 700, fontSize: TYP.body }}>Beleg ablegen · <span style={{ color: C.inkLeise, fontWeight: 500 }}>{vorschlag.name}</span></div>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {!beleg ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf onClick={lesen} aus={!!laeuft}>{laeuft === 'lesen' ? 'liest …' : 'Beleg lesen'}</Knopf>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Lesen schreibt nichts — erst „Übernehmen“ legt ab.</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: TYP.bedien }}>
            <span style={{ color: C.inkLeise }}>Partner</span><span>{beleg.partner || '—'}</span>
            <span style={{ color: C.inkLeise }}>Betrag</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{zahl(beleg.betragBrutto)}</span>
            <span style={{ color: C.inkLeise }}>Datum</span><span>{beleg.datum ?? '—'}</span>
            {beleg.rechnungsnummer && <><span style={{ color: C.inkLeise }}>Nummer</span><span>{beleg.rechnungsnummer}</span></>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf onClick={() => uebernehmen(beleg.richtung === 'ausgang' ? 'rechnung' : 'buchung')} aus={!!laeuft}>{beleg.richtung === 'ausgang' ? 'Als Rechnung übernehmen' : 'Als Buchung übernehmen'}</Knopf>
            <Knopf leise onClick={() => uebernehmen(beleg.richtung === 'ausgang' ? 'buchung' : 'rechnung')} aus={!!laeuft}>{beleg.richtung === 'ausgang' ? 'Doch als Buchung' : 'Doch als Rechnung'}</Knopf>
            <Knopf leise onClick={onZu}>Verwerfen</Knopf>
          </div>
        </>
      )}
    </div>
  );
}
