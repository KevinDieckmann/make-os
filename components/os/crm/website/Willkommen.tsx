'use client';

// ─── Markttraktion › Website › Formulare & Termine › Willkommens-Mails (M1, 01.11.) ──────────────────────────────────────────────────────
// Bis 01.11. versteckt im Kampagnen-Detail (Versand-Einstellungen). Hier: der Schalter (nur Inhaber), die festen Texte je Stufe (Tag, Betreff, Text —
// bearbeitbar, nur Inhaber), und die Übersicht „wer bekam welche Stufe“ (nur Name und Stufen, nie Adressen). Lesen und Schreiben über
// /api/crm/kampagnen/motor (GET ?teil=willkommen, POST aktion „einstellungen“) — Prüfen tut der Server (Platzhalter 400, Grenzen 413).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leer, Schalter, feld } from '../../ui';
import type { WillkommenStufe } from '@/lib/crm/kampagnen-post';

interface Lage {
  istInhaber: boolean; willkommen: { seit: string; von: string } | null; stufen: WillkommenStufe[]; vorgabe: WillkommenStufe[];
  empfaenger: { id: string; name: string; start: string; gesendet: number[]; gescheitert?: { stufe: number; am: string; grund: string }[]; geantwortet?: boolean }[];
  /** Stand des letzten Laufs (B-Prüfung, 02.11.): warum die Strecke nichts tut bzw. wie viele Versuche scheiterten. */
  lauf: { am: string; grund?: string; gesendet: number; gescheitert: number } | null;
}
const tag = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const MAX_STUFEN = 6;

export function WillkommenKarte({ i = 3 }: { i?: number }) {
  const [d, setD] = useState<Lage | null>(null);
  const [stufen, setStufen] = useState<WillkommenStufe[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'achtung'; text: string } | null>(null);
  const [alle, setAlle] = useState(false);
  const laden = useCallback(async () => {
    const r = await fetch('/api/crm/kampagnen/motor?teil=willkommen', { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (r?.ok) setD(r);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const senden = async (body: Record<string, unknown>, gut: string) => {
    const r = await fetch('/api/crm/kampagnen/motor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'einstellungen', ...body }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setMeldung(r.ok ? { art: 'gut', text: gut } : { art: 'achtung', text: r.fehler ?? 'Nicht gespeichert.' });
    await laden();
    return !!r.ok;
  };
  if (!d) return <Karte i={i}><Ueberschrift>Willkommens-Mails</Ueberschrift><Leer>lädt …</Leer></Karte>;
  const bearbeitet = stufen ?? d.stufen;
  const setze = (j: number, teil: Partial<WillkommenStufe>) => setStufen(bearbeitet.map((s, k) => (k === j ? { ...s, ...teil } : s)));

  return (
    <Karte i={i}>
      <Ueberschrift>Willkommens-Mails</Ueberschrift>
      <div style={{ display: 'grid', gap: 10 }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nach einer Einwilligung über die Website (Check, Unterlage, Newsletter) laufen feste Willkommens-Mails — nur mit vollem Nachweis der Einwilligung, nur werktags 8–18 Uhr, mit Abmeldelink. Keine KI. Wer vor dem Einschalten eingewilligt hat, bekommt nichts nachträglich.</span>
        {meldung && <Hinweis art={meldung.art} rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung.text}</Hinweis>}
        <Schalter an={!!d.willkommen} aus={!d.istInhaber} onChange={an => void senden({ willkommen: an }, an ? 'Willkommens-Mails an — für Einwilligungen ab heute.' : 'Willkommens-Mails aus.')} erklaerung="kampagnen.willkommen">
          Willkommens-Mails nach Einwilligung{d.willkommen ? ` (an seit ${tag(d.willkommen.seit)}, ${d.willkommen.von})` : ''}
        </Schalter>
        {!d.istInhaber && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Einschalten und Texte ändern dürfen Inhaber und volle Mitglieder des Haushalts.</span>}
        {d.willkommen && d.lauf?.grund && <Hinweis art="achtung">{d.lauf.grund} (Stand {tag(d.lauf.am)})</Hinweis>}

        <b style={{ fontSize: TYP.bedien, color: C.ink }}>Texte</b>
        {bearbeitet.map((s, j) => (
          <div key={j} style={{ display: 'grid', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
              <b style={{ color: C.ink }}>Mail {j + 1}</b>
              {stufen ? (
                <>
                  <span>Tage nach der Einwilligung</span>
                  <input aria-label={`Tag der Mail ${j + 1}`} type="number" min={0} max={90} value={s.tag} onChange={e => setze(j, { tag: Math.max(0, Math.min(90, Math.round(Number(e.target.value) || 0))) })} style={{ ...feld, width: 90 }} />
                  <Knopf leise onClick={() => setStufen(bearbeitet.filter((_, k) => k !== j))}>Entfernen</Knopf>
                </>
              ) : <span>Tag {s.tag} · „{s.betreff}“</span>}
            </div>
            {stufen && (
              <>
                <input aria-label={`Betreff der Mail ${j + 1}`} value={s.betreff} onChange={e => setze(j, { betreff: e.target.value })} style={feld} />
                <textarea aria-label={`Text der Mail ${j + 1}`} rows={6} value={s.text} onChange={e => setze(j, { text: e.target.value })} style={feld} />
              </>
            )}
          </div>
        ))}
        {d.istInhaber && (stufen ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf leise aus={bearbeitet.length >= MAX_STUFEN} onClick={() => setStufen([...bearbeitet, { tag: (bearbeitet[bearbeitet.length - 1]?.tag ?? 0) + 7, betreff: '', text: '{{anrede}},\n\n\n\nViele Grüße\n{{absender}}' }])}>+ Mail</Knopf>
            <Knopf leise onClick={() => setStufen(d.vorgabe)}>Vorgabe einsetzen</Knopf>
            <Knopf leise onClick={() => setStufen(null)}>Verwerfen</Knopf>
            <Knopf haupt aus={!bearbeitet.length} onClick={async () => { if (await senden({ willkommenStufen: bearbeitet }, 'Texte gespeichert.')) setStufen(null); }}>Texte speichern</Knopf>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Platzhalter: {'{{anrede}} {{vorname}} {{nachname}} {{absender}} {{heute}}'} · Abmeldelink und Absender stehen automatisch unter jeder Mail.</span>
          </div>
        ) : <span><Knopf leise onClick={() => setStufen(d.stufen)}>Texte bearbeiten</Knopf></span>)}

        <b style={{ fontSize: TYP.bedien, color: C.ink }}>Wer bekam welche Mail</b>
        {!d.empfaenger.length ? <Leer>Noch niemand.</Leer> : (
          <div>
            {d.empfaenger.slice(0, alle ? d.empfaenger.length : 12).map(x => (
              <div key={x.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span style={{ color: C.ink }}>{x.name}</span>
                <span>seit {tag(x.start)}</span>
                <span>{x.gesendet.length ? `bekam Mail ${x.gesendet.map(n => n + 1).join(', ')} von ${d.stufen.length}` : 'noch keine'}</span>
                {x.geantwortet && <span style={{ color: C.ink }}>hat geantwortet</span>}
                {(x.gescheitert ?? []).map(g => <span key={g.stufe} style={{ color: C.inkLeise }}>Mail {g.stufe + 1} gescheitert am {tag(g.am)}: {g.grund}</span>)}
              </div>
            ))}
            {d.empfaenger.length > 12 && <button onClick={() => setAlle(!alle)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, minHeight: 44 }}>{alle ? 'weniger' : `alle ${d.empfaenger.length}`}</button>}
          </div>
        )}
      </div>
    </Karte>
  );
}
