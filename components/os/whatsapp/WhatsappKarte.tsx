'use client';

// ─── WhatsApp Business — Verbinden-/Status-Karte (Verbindungen, 07.10.2026) ─────────────────────────────────────────────
// Drei ehrliche Zustände (wie die anderen Verbindungen):
//   nicht eingerichtet → Anleitung (Schritte bei Meta, Links nur auf offizielle Meta-Seiten) + welche Werte auf dem Server fehlen (nur
//                        die NAMEN) + die Webhook-Adresse; eingetragen wird auf dem Server mit deploy/whatsapp-verbinden.sh
//   eingerichtet       → Nummer, Anzeigename, Qualität, Durchsatz (von Meta, Cache 15 Min.), Webhook zuletzt empfangen, Gespräche;
//                        „Verbindung prüfen“; Inhaber: „Nummer registrieren“ (einmalig, Speicherort Deutschland — nur hier möglich)
//   Schlüssel abgelehnt → kritischer Hinweis „Verbindung erneuern“ (neuer System-User-Schlüssel über das Skript)
// Diese Seite sieht nie einen Schlüssel oder ein Geheimnis (GET /api/whatsapp/status liefert sie nicht).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, KUGEL } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Knopf, Hinweis, Feldzeile, Segmente, eingabe, LEUCHT, useRueckfrage } from '../ui';
import type { WhatsappStatus } from '@/lib/whatsapp/typen';

const META = {
  start: 'https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started',
  apps: 'https://developers.facebook.com/apps/',
  business: 'https://business.facebook.com/',
  token: 'https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens',
  webhook: 'https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint',
  registrieren: 'https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration',
} as const;

const QUALITAET: Record<string, { text: string; farbe: string }> = {
  GREEN: { text: 'Qualität hoch', farbe: KUGEL.smaragd }, YELLOW: { text: 'Qualität mittel', farbe: LEUCHT.achtung }, RED: { text: 'Qualität niedrig', farbe: KUGEL.granat },
};

function vor(iso?: string): string {
  if (!iso) return 'noch nie';
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  if (min < 48 * 60) return `vor ${Math.round(min / 60)} Std.`;
  return `am ${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.aktiv }}>{children} ↗</a>;

function Anleitung({ s }: { s: WhatsappStatus }) {
  const schritte: React.ReactNode[] = [
    <>Im <A href={META.business}>Meta Business Manager</A> das Business-Portfolio der Gesellschaft öffnen (bzw. anlegen).</>,
    <>Im <A href={META.apps}>App-Dashboard</A> eine App vom Typ „Business“ anlegen und das Produkt „WhatsApp“ hinzufügen (<A href={META.start}>Anleitung von Meta</A>).</>,
    <>Die neue Business-Nummer hinzufügen — sie darf nicht in der WhatsApp-App aktiv sein. Registriert wird später hier in MAKE OS (mit Speicherort Deutschland).</>,
    <>In den Unternehmenseinstellungen einen System-User anlegen und einen dauerhaften Zugriffsschlüssel erzeugen (<A href={META.token}>Anleitung</A>).</>,
    <>Auf dem Server <code style={{ fontFamily: SCHRIFT.mono }}>deploy/whatsapp-verbinden.sh</code> ausführen — es fragt die Werte verdeckt ab und zeigt den Verify-Token.</>,
    <>Bei Meta den Webhook eintragen (<A href={META.webhook}>Anleitung</A>): Rückruf-URL {s.webhookAdresse ? <code style={{ fontFamily: SCHRIFT.mono, wordBreak: 'break-all' }}>{s.webhookAdresse}</code> : 'https://<eure Adresse>/api/whatsapp/webhook'} + Verify-Token, dann das Feld „messages“ abonnieren.</>,
  ];
  return (
    <div style={{ display: 'grid', gap: 10, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{schritte.map((x, i) => <li key={i}>{x}</li>)}</ol>
      {s.fehlend.length > 0 && <div style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.bedien, color: C.inkLeise, wordBreak: 'break-word' }}>Auf dem Server fehlt noch: {s.fehlend.join(' · ')}</div>}
      <div style={{ color: C.inkLeise }}>Ausführlich: UPDATES.md › 07.10. „WhatsApp Business“. Werte nie in den Chat.</div>
    </div>
  );
}

function Registrieren({ onFertig }: { onFertig: (s: WhatsappStatus, text: string) => void }) {
  const [auf, setAuf] = useState(false);
  const [pin, setPin] = useState('');
  const [ort, setOrt] = useState<'DE' | 'ohne'>('DE');
  const [fehler, setFehler] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();
  if (!auf) return <Knopf leise onClick={() => setAuf(true)}>Nummer registrieren …</Knopf>;
  const los = async () => {
    setFehler('');
    const ok = await bestaetigen({ titel: 'Nummer jetzt bei Meta registrieren?', text: ort === 'DE' ? 'Einmaliger Schritt. Gespeicherte Daten bleiben bei Meta in Deutschland (Local Storage „DE“) — das lässt sich nur jetzt festlegen. Meta erlaubt höchstens 10 Versuche in 72 Stunden.' : 'Einmaliger Schritt OHNE Local Storage — Meta speichert dann in seinen Rechenzentren. Das lässt sich später nicht mehr umstellen.', ja: 'Jetzt registrieren' });
    if (!ok) return;
    const r = await fetch('/api/whatsapp/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'registrieren', pin, speicherort: ort }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) as WhatsappStatus & { fehler?: string; text?: string } : null;
    setPin('');
    if (r?.ok && d?.ok) { setAuf(false); onFertig(d, d.text ?? 'Nummer registriert.'); return; }
    setFehler(d?.fehler ?? 'Die Registrierung ging nicht durch.');
  };
  return (
    <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, border: `1px solid ${C.linie}` }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
        Meta registriert eine Nummer nur über die Schnittstelle (<A href={META.registrieren}>Beleg</A>). Die 6-stellige PIN ist die Zwei-Schritt-PIN der Nummer
        (neu, wenn noch keine gesetzt ist) — MAKE OS speichert sie nicht. Vorher bitte bei Meta prüfen, ob „No Storage“ gewünscht ist.
      </div>
      <Segmente liste={[{ id: 'DE', label: 'Speicherort Deutschland (empfohlen)' }, { id: 'ohne', label: 'ohne Local Storage' }]} aktiv={ort} onWahl={setOrt} umbrechen />
      <Feldzeile label="PIN (6 Ziffern)">
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" type="password" style={{ ...eingabe, maxWidth: 220 }} aria-label="PIN" />
      </Feldzeile>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={los} aus={pin.length !== 6} ton="gut">Registrieren</Knopf>
        <Knopf leise onClick={() => { setAuf(false); setPin(''); }}>Abbrechen</Knopf>
      </div>
      {dialog}
    </div>
  );
}

export function WhatsappKarte({ i = 0 }: { i?: number }) {
  const [s, setS] = useState<WhatsappStatus | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const laden = async (pruefen = false) => {
    const r = await fetch('/api/whatsapp/status', pruefen ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'pruefen' }) } : { cache: 'no-store' }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) as WhatsappStatus | null : null;
    if (d) setS(d);
  };
  useEffect(() => { void laden(); }, []);
  const pruefen = async () => { setLaeuft(true); setMeldung(''); await laden(true); setLaeuft(false); setMeldung('Geprüft.'); };

  const zustand = !s ? { text: 'lädt …', farbe: C.inkLeise } : !s.eingerichtet ? { text: 'nicht eingerichtet', farbe: C.inkLeise } : !s.zugang ? { text: 'kein Zugang', farbe: C.inkLeise }
    : s.verbindung === 'token' ? { text: 'Verbindung erneuern', farbe: KUGEL.granat } : s.verbindung === 'fehler' ? { text: 'Meta nicht erreichbar', farbe: LEUCHT.achtung }
    : !s.webhook?.zuletzt ? { text: 'wartet auf Webhook', farbe: LEUCHT.achtung } : { text: 'verbunden', farbe: KUGEL.smaragd };
  const q = s?.qualitaet ? QUALITAET[s.qualitaet] : undefined;

  return (
    <Karte i={i} akzent={s?.eingerichtet && s.zugang && s.verbindung === 'ok' ? KUGEL.smaragd : undefined} id="whatsapp">
      <Ueberschrift farbe={KUGEL.smaragd} rechts={<Chip farbe={zustand.farbe}>{zustand.text}</Chip>}>WhatsApp Business</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, marginBottom: 12 }}>
        Eigene Business-Nummer über die Cloud API von Meta — Gespräche landen in der Inbox{s?.bereichName ? ` (Bereich ${s.bereichName})` : ''}, Antworten nur per Klick.
        Frei schreiben geht 24 Stunden nach der letzten Nachricht der Person, danach nur mit genehmigter Vorlage.
      </div>
      {s && !s.eingerichtet && <Anleitung s={s} />}
      {s && s.eingerichtet && !s.zugang && <Hinweis art="info">Die Business-Nummer ist eingerichtet, aber für dieses Konto nicht freigegeben (WHATSAPP_PERSONEN auf dem Server).</Hinweis>}
      {s && s.eingerichtet && s.zugang && (
        <div style={{ display: 'grid', gap: 12 }}>
          {s.verbindung === 'token' && (
            <Hinweis art="kritisch" titel="Verbindung erneuern">
              Meta hat den Zugriffsschlüssel abgelehnt (abgelaufen, widerrufen oder ohne Rechte). Neuen dauerhaften Schlüssel des System-Users erzeugen und auf dem
              Server <code style={{ fontFamily: SCHRIFT.mono }}>deploy/whatsapp-verbinden.sh</code> erneut ausführen (Verify-Token behalten).
            </Hinweis>
          )}
          {s.verbindung === 'fehler' && s.fehler && <Hinweis art="achtung">{s.fehler}</Hinweis>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: TYP.bedien }}>
            <Angabe label="Nummer" wert={s.nummer ?? '—'} mono />
            <Angabe label="Anzeigename" wert={s.anzeigename ?? '—'} />
            <Angabe label="Qualität" wert={q ? q.text : s.qualitaet ? s.qualitaet : 'noch nicht bewertet'} farbe={q?.farbe} />
            <Angabe label="Durchsatz" wert={s.durchsatz ?? '—'} />
            <Angabe label="Webhook zuletzt" wert={vor(s.webhook?.zuletzt)} />
            <Angabe label="Gespräche" wert={String(s.gespraeche ?? 0)} />
          </div>
          {!s.webhook?.zuletzt && <Hinweis art="info">Noch keine Meldung von Meta angekommen. Ist der Webhook bei Meta gespeichert und das Feld „messages“ abonniert? Eine Test-Nachricht an die Nummer zeigt es.</Hinweis>}
          {(s.webhook?.abgelehnt ?? 0) > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Abgelehnte Aufrufe ohne gültige Signatur: {s.webhook!.abgelehnt} (zuletzt {vor(s.webhook!.zuletztAbgelehnt)}).</div>}
          {s.registriert && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Aus MAKE OS registriert {vor(s.registriert.am)} · Speicherort {s.registriert.speicherort === 'DE' ? 'Deutschland' : 'ohne Local Storage'}.</div>}
          {s.inhaber && !s.registriert && <Registrieren onFertig={(n, t) => { setS(n); setMeldung(t); }} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf onClick={pruefen} aus={laeuft}>{laeuft ? 'Prüft …' : 'Verbindung prüfen'}</Knopf>
            <Link href={`/os/inbox${s.bereich ? `?bereich=${s.bereich}` : ''}`} style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>Zur Inbox ›</Link>
            {meldung && <span role="status" style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</span>}
          </div>
        </div>
      )}
    </Karte>
  );
}

function Angabe({ label, wert, mono, farbe }: { label: string; wert: string; mono?: boolean; farbe?: string }) {
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>{label}</span>
      <span style={{ color: farbe ?? C.ink, fontFamily: mono ? SCHRIFT.mono : undefined, overflowWrap: 'anywhere' }}>{wert}</span>
    </div>
  );
}
