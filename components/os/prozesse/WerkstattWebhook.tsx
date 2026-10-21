'use client';

// ─── Prozesse · Werkstatt — der Webhook am Auslöser „Webhook von außen“ (22.10.; ANALYSE_100.md Punkt 32, Entscheidung 21.10.: „Ja, abgesichert“) ─────────────
// Die Oberfläche zum Bestand aus B1 (lib/prozesse/webhook.ts, webhook-server.ts): Adresse (kopierbar), Schlüssel erzeugen — GENAU EINMAL sichtbar (er steht nur in
// der Antwort dieses einen Aufrufs und nur im Zustand dieser Karte, nie im Speicher des Browsers; danach steht hier nur „gesetzt“) —, das Felder-Schema mit einem
// Beispiel-Aufruf, „nimmt an“ per Klick (Schalter mit Erklärung) und die letzten Eingänge NUR mit Zeit und Status (nie die Felder — fremder Text). Geschrieben über
// den EINEN Schreibweg der Werkstatt (`werkstattSenden`, Aktionen webhook-schluessel · webhook-scharf · webhook-entfernen); nur volle Mitglieder.

import { useState } from 'react';
import { Copy, KeyRound, Trash2, Webhook } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Knopf, Hinweis, Schalter, Zeile, Leer } from '../ui';
import type { WebhookFeld } from '@/lib/prozesse/definition';
import type { webhookKurz } from '@/lib/prozesse/webhook';
import { LAUF_STATUS_NAME, zeitText } from '@/lib/prozesse/laeufe-ansicht';
import type { LaufStatus } from '@/lib/prozesse/lauf-typen';
import { werkstattSenden } from './werkstatt-daten';

export type WebhookKurz = ReturnType<typeof webhookKurz>;
const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: TYP.bedien, color: C.ink, overflowWrap: 'anywhere' as const, margin: 0 };

/** Ein Beispiel-Körper aus dem Schema (rein, nur Platzhalter — nie echte Werte). */
export function beispielKoerper(felder: readonly WebhookFeld[]): string {
  const w = (f: WebhookFeld): string | number | boolean => (f.art === 'zahl' ? 1 : f.art === 'ja-nein' ? true : f.art === 'datum' ? '2026-10-22' : f.art === 'email' ? 'name@example.invalid' : f.art === 'auswahl' ? f.optionen?.[0] ?? '…' : '…');
  return JSON.stringify(Object.fromEntries(felder.map(f => [f.id, w(f)])), null, 2);
}

async function kopieren(t: string): Promise<boolean> { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }

export function WebhookKarte({ prozessId, webhook, eingaenge, felder, darf, versionHatWebhook, onWebhook, geheimVorgabe }: {
  prozessId: string; webhook: WebhookKurz | null; eingaenge: readonly { am: string; lauf?: { id: string; status: LaufStatus } }[]; felder: readonly WebhookFeld[];
  /** Volle Mitglieder (Schlüssel, scharf, entfernen). */ darf: boolean;
  /** Die jüngste veröffentlichte Version hat einen Webhook-Auslöser (sonst kann die Adresse nicht scharf werden). */ versionHatWebhook: boolean;
  onWebhook: (w: WebhookKurz | null) => void;
  /** Nur für Tests: ein Schlüssel, als käme er gerade aus der Antwort. */ geheimVorgabe?: { adresse: string; schluessel: string };
}) {
  const [geheim, setGeheim] = useState<{ adresse: string; schluessel: string } | null>(geheimVorgabe ?? null);
  const [frage, setFrage] = useState<'erneuern' | 'entfernen' | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'info' } | null>(null);
  const ursprung = typeof window !== 'undefined' ? window.location.origin : '';
  const senden = async (k: Record<string, unknown>) => {
    setMeldung(null);
    const r = await werkstattSenden(() => ({ id: prozessId, ...k }));
    if (r.status !== 200 || !r.j?.ok) { setMeldung({ text: String(r.j?.fehler ?? 'Das ging nicht.'), art: 'kritisch' }); return null; }
    onWebhook((r.j.webhook as WebhookKurz | null) ?? null);
    return r.j;
  };
  const schluessel = async () => {
    const j = await senden({ aktion: 'webhook-schluessel' });
    const g = j?.geheim as { adresse: string; schluessel: string } | undefined;
    if (g) setGeheim(g);
    setFrage(null);
  };
  const adresse = webhook ? `${ursprung}${webhook.adresse}` : '';
  return (
    <section aria-label="Webhook von außen" style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${C.linie}` }}>
      <div style={{ ...MIKRO, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Webhook size={13} aria-hidden />Webhook von außen</div>
      {!webhook && <Leer>Noch keine Adresse — erst anlegen, dann das Schema ausfüllen und scharf schalten.</Leer>}
      {!webhook && darf && <div><Knopf onClick={schluessel}><span className="pz-knopf-inhalt"><KeyRound size={14} aria-hidden />Adresse und Schlüssel anlegen</span></Knopf></div>}
      {geheim && (
        <Hinweis art="achtung" titel="Schlüssel — wird nur jetzt gezeigt" aktion={<Knopf leise onClick={() => setGeheim(null)}>Gemerkt</Knopf>}>
          <span style={{ display: 'grid', gap: 6 }}>
            <span>Kopiere ihn jetzt in das System, das die Adresse aufruft. Gespeichert ist nur sein Fingerabdruck — danach steht hier nur „gesetzt“.</span>
            <code data-webhook-geheim="" style={mono}>{geheim.schluessel}</code>
            <span><Knopf leise onClick={async () => setMeldung((await kopieren(geheim.schluessel)) ? { text: 'Schlüssel kopiert.', art: 'gut' } : { text: 'Kopieren ging nicht — bitte markieren.', art: 'info' })}><span className="pz-knopf-inhalt"><Copy size={14} aria-hidden />Schlüssel kopieren</span></Knopf></span>
          </span>
        </Hinweis>
      )}
      {webhook && (
        <>
          <Zeile umbrechen titel="Adresse" unter={<span style={mono}>{adresse}</span>}
            rechts={<Knopf leise onClick={async () => setMeldung((await kopieren(adresse)) ? { text: 'Adresse kopiert.', art: 'gut' } : { text: 'Kopieren ging nicht — bitte markieren.', art: 'info' })} titel="Adresse kopieren"><span className="pz-knopf-inhalt"><Copy size={14} aria-hidden />Kopieren</span></Knopf>} />
          <Zeile umbrechen titel="Schlüssel" unter={`gesetzt seit ${zeitText(webhook.erneuertAm ?? webhook.angelegtAm)} — nur als Fingerabdruck gespeichert`}
            rechts={darf ? <Knopf leise onClick={() => setFrage('erneuern')}><span className="pz-knopf-inhalt"><KeyRound size={14} aria-hidden />Neuer Schlüssel</span></Knopf> : undefined} />
          {frage === 'erneuern' && (
            <Hinweis art="achtung" titel="Neuen Schlüssel erzeugen?" aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={schluessel}>Erzeugen</Knopf><Knopf leise onClick={() => setFrage(null)}>Abbrechen</Knopf></span>}>
              Der alte Schlüssel gilt sofort nicht mehr — alle, die die Adresse aufrufen, brauchen den neuen.
            </Hinweis>
          )}
          <Schalter an={webhook.scharf} aus={!darf || (!webhook.scharf && !versionHatWebhook)} onChange={an => void senden({ aktion: 'webhook-scharf', an })} erklaerung="prozesse.webhook-scharf">
            {webhook.scharf ? 'Nimmt an (scharf)' : 'Nimmt nichts an'}
          </Schalter>
          {!webhook.scharf && !versionHatWebhook && <p style={klein}>Scharf erst mit einer veröffentlichten Version, die diesen Auslöser hat.</p>}
        </>
      )}
      <div style={{ ...MIKRO }}>So ruft ihr sie auf</div>
      {felder.length ? (
        <>
          <p style={klein}>{`POST mit „Authorization: Bearer <Schlüssel>“ und einem JSON-Körper mit diesen Feldern (andere werden verworfen): ${felder.map(f => `${f.id} (${f.art}${f.pflicht ? ', Pflicht' : ''})`).join(' · ')}.`}</p>
          <pre style={{ ...mono, whiteSpace: 'pre-wrap', padding: 10, borderRadius: 10, border: `1px solid ${C.linie}` }}>{beispielKoerper(felder)}</pre>
        </>
      ) : <p style={klein}>Erst oben die Felder des Schemas anlegen — angenommen wird nur, was dort steht.</p>}
      {webhook && (
        <>
          <div style={{ ...MIKRO }}>{`Letzte Eingänge · ${webhook.anzahl}`}</div>
          {!eingaenge.length && <Leer>Noch nichts angekommen.</Leer>}
          {eingaenge.map((e, i) => <Zeile key={i} titel={zeitText(e.am)} unter={e.lauf ? `Lauf gestartet · ${LAUF_STATUS_NAME[e.lauf.status]}` : 'angenommen · kein Lauf (Prozess lief nicht oder „nur wenn …“ passte nicht)'} />)}
          {darf && (frage === 'entfernen'
            ? <Hinweis art="achtung" titel="Webhook entfernen?" aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={async () => { await senden({ aktion: 'webhook-entfernen' }); setFrage(null); setGeheim(null); }}>Entfernen</Knopf><Knopf leise onClick={() => setFrage(null)}>Abbrechen</Knopf></span>}>Adresse, Schlüssel und Eingänge dieses Prozesses fallen weg.</Hinweis>
            : <div><Knopf leise onClick={() => setFrage('entfernen')}><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Webhook entfernen</span></Knopf></div>)}
        </>
      )}
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
    </section>
  );
}
