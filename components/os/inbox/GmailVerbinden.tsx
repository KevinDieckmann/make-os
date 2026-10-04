'use client';

// ─── Gmail verbinden und Stand (03.10.2026) ──────────────────────────────────
// Inkrementell: kein zweites Token — die Person ergänzt ihre Google-Verbindung um „Gmail“ (`/api/google/verbinden` mit der Funktion
// `gmail`, Google fragt nur die neue Freigabe `gmail.modify`). Nur die EIGENE Person verbindet, schaltet aus oder gleicht ab.
//   · nicht eingerichtet (kein GOOGLE_CLIENT_ID auf dem Server): ein Satz mit Verweis auf GOOGLE_GMAIL_EINRICHTEN.md
//   · nicht verbunden: Karte mit „Gmail verbinden“ (und was MAKE OS damit darf — und was nicht)
//   · verbunden: Statuszeile (maskierte Adresse, letzter Abgleich, Push), „Jetzt abgleichen“, „Gmail ausschalten“
// Nie Tokens im Browser. Am Handy bedienbar (Tasten ≥ 44 px).

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Knopf, LEUCHT, useRueckfrage } from '../ui';
import { vorText } from '@/lib/gmail/liste';

export interface GmailMeta {
  konfiguriert: boolean; verbunden: boolean; bereit: boolean; konto?: string; getrennt?: { grund: string };
  abgleich?: { vorMin: number | null; veraltet: boolean; fehler?: string; anmeldung?: boolean };
  push?: 'aktiv' | 'wartet' | 'aus'; einrichten?: boolean;
}

const HINWEISE: Record<string, { text: string; achtung?: boolean }> = {
  verbunden: { text: 'Gmail ist verbunden — die letzten 30 Tage werden gelesen.' },
  abgebrochen: { text: 'Die Anmeldung bei Google wurde abgebrochen.', achtung: true },
  domain: { text: 'Dieses Google-Konto gehört nicht zur erlaubten Domain — bitte mit dem Workspace-Konto anmelden.', achtung: true },
  'scope-fehlt': { text: 'Bei Google fehlt die Freigabe für Gmail — bitte noch einmal verbinden und das Häkchen setzen.', achtung: true },
  state: { text: 'Die Anmeldung war abgelaufen — bitte noch einmal starten.', achtung: true },
  person: { text: 'Diese Anmeldung gehörte einer anderen Person.', achtung: true },
  token: { text: 'Google hat die Anmeldung nicht angenommen — bitte noch einmal versuchen.', achtung: true },
  fehler: { text: 'Die Verbindung zu Google ließ sich nicht abschließen.', achtung: true },
};

const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  .then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, unknown> })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung.' } as Record<string, unknown> }));

export function GmailVerbinden({ meta, onGeaendert, meldung }: { meta: GmailMeta | null; onGeaendert: () => void; meldung: (t: string) => void }) {
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; achtung?: boolean } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  // Rückkehr von Google: ?google=verbunden|… → Hinweis zeigen, Adresse säubern.
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const g = u.searchParams.get('google');
      if (g) { setHinweis(HINWEISE[g] ?? { text: 'Google: Anmeldung beendet.' }); u.searchParams.delete('google'); window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
    } catch { /* ohne Adresse */ }
  }, []);

  const verbinden = async () => {
    setArbeit('verbinden'); setHinweis(null);
    const r = await post('/api/google/verbinden', { funktionen: ['gmail'] });
    setArbeit(null);
    if (r.d.ok && typeof r.d.url === 'string') { window.location.href = r.d.url; return; }
    setHinweis({ text: String(r.d.fehler ?? 'Google ließ sich nicht starten.'), achtung: true });
  };
  const abgleichen = async (voll = false) => {
    setArbeit('abgleich');
    const r = await post('/api/gmail', { aktion: voll ? 'voll' : 'abgleichen' });
    setArbeit(null);
    meldung(r.d.ok ? `Gmail abgeglichen — ${r.d.neu ?? 0} neue Nachrichten.` : String(r.d.fehler ?? 'Abgleich ging nicht.'));
    onGeaendert();
  };
  const ausschalten = async () => {
    if (!(await bestaetigen({ titel: 'Gmail in MAKE OS ausschalten?', text: 'Der Spiegel (Kopie der Mails) wird gelöscht und der Zugriff nicht mehr genutzt. In Gmail bleibt alles, wie es ist. Der Kalender bleibt verbunden.', ja: 'Ausschalten', gefahr: true }))) return;
    setArbeit('aus');
    const r = await post('/api/gmail', { aktion: 'ausschalten' });
    setArbeit(null);
    meldung(r.d.ok ? 'Gmail ist ausgeschaltet — der Spiegel ist gelöscht.' : String(r.d.fehler ?? 'Ausschalten ging nicht.'));
    onGeaendert();
  };

  const klein = { fontSize: TYP.bedien, color: C.inkLeise } as const;
  const kasten = hinweis && <div role="status" style={{ fontSize: 13, color: hinweis.achtung ? LEUCHT.achtung : C.ink, background: hinweis.achtung ? `${LEUCHT.achtung}14` : 'rgba(255,255,255,.04)', borderRadius: 9, padding: '8px 10px', marginBottom: 10 }}>{hinweis.text}</div>;
  if (!meta) return kasten || null;

  if (!meta.konfiguriert) {
    return <div style={{ ...klein, marginTop: 14 }}>{kasten}Gmail ist noch nicht eingerichtet (auf dem Server fehlt die Google-Anwendung) — Schritt für Schritt: GOOGLE_GMAIL_EINRICHTEN.md.</div>;
  }
  if (!meta.bereit) {
    return (
      <Karte i={0} akzent={LEUCHT.puls}>
        {kasten}
        <div style={{ fontWeight: 700, fontSize: TYP.body, marginBottom: 6 }}>Gmail verbinden</div>
        {meta.getrennt && <div style={{ fontSize: 13, color: LEUCHT.kritisch, marginBottom: 6 }}>Die Verbindung ist nicht mehr gültig ({meta.getrennt.grund}). Bitte neu verbinden.</div>}
        <div style={{ ...klein, marginBottom: 10, lineHeight: 1.55 }}>
          Die Post deiner Workspace-Adresse erscheint hier in der Inbox: lesen, den Kontakten zuordnen, antworten, Aufgaben daraus machen. Gesendet wird nur, wenn du auf „Senden“ klickst.
          MAKE OS bekommt dafür die Freigabe „Gmail lesen, markieren und senden“ — nicht das endgültige Löschen, keine Gmail-Einstellungen. Du meldest dich bei Google mit deinem Konto an; es ist dieselbe Verbindung wie beim Kalender.
        </div>
        <Knopf onClick={verbinden} aus={arbeit === 'verbinden'}>{arbeit === 'verbinden' ? 'öffnet Google …' : meta.getrennt ? 'Neu verbinden' : 'Gmail verbinden'}</Knopf>
      </Karte>
    );
  }
  const a = meta.abgleich;
  return (
    <div style={{ marginTop: 14 }}>
      {kasten}
      <div style={{ ...klein, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>Gmail · {meta.konto} · letzter Abgleich {vorText(a?.vorMin)}{a?.veraltet ? ' (veraltet)' : ''}{meta.push === 'aktiv' ? ' · Push aktiv' : ' · alle 2 Minuten'}{a?.fehler ? ` · ${a.fehler}` : ''}</span>
        <Knopf leise onClick={() => abgleichen(false)} aus={!!arbeit}>{arbeit === 'abgleich' ? 'gleicht ab …' : 'Jetzt abgleichen'}</Knopf>
        <Knopf leise onClick={ausschalten} aus={!!arbeit}>Gmail ausschalten</Knopf>
      </div>
      {dialog}
    </div>
  );
}
