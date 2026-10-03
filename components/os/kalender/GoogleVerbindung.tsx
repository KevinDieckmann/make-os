'use client';

// ─── Kalender-Einstellungen: Google Kalender verbinden (03.10.2026) ──────────
// Kevin 03.10.: „Wir haben nur den Kalender bei Google für MAKE und alles andere läuft über MAKE OS.“ Je Person eine feste
// Verbindung zum Google-Workspace-Konto; der Kalender „MAKE <Vorname> (Google)“ gleicht in BEIDE Richtungen ab. Privat,
// Familie und Gemeinsam bleiben in MAKE OS + iCloud.
//   · nur die EIGENE Person verwaltet ihre Verbindung (Sitzung) — Status, Abgleich, Kalender wählen, Trennen, Umzug
//   · ohne GOOGLE_CLIENT_ID/SECRET auf dem Server steht hier „noch nicht eingerichtet“ (GOOGLE_KALENDER_EINRICHTEN.md)
//   · Umzug: Vorschau, dann ein ausdrücklicher Klick — vorher wird jeder Termin gesichert
// Am Handy bedienbar: Tasten ≥ 44 px, Eingaben 16 px.
// Daten nur über /api/google/* (allgemeine Verbindung) und /api/kalender/google* (Kalender) — nie Tokens im Browser.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import { AbgleichStand, type AbgleichInfo } from './AbgleichStand';

interface Stand {
  ok: boolean; konfiguriert: boolean; verbunden: boolean; konto?: string; seit?: string; erlaubteDomain?: boolean;
  getrennt?: { grund: string; seit?: string };
  bereit?: string[];
  kalender?: { name: string; schreibbar: boolean } | null;
  abgleich?: AbgleichInfo;
  push?: 'aktiv' | 'wartet' | 'aus';
  vonAussen?: { at: string; n: number };
  liste?: { id: string; name: string; primary: boolean; schreibbar: boolean; gewaehlt: boolean }[];
  listeFehler?: string;
  fehler?: string;
}
interface Vorschau {
  ok: boolean; ziel: string | null; hinweis?: string; uebrig: number;
  quellen: { name: string; business: boolean; umzieht: number; bleibt: number }[];
  umzieht: { schluessel: string; titel: string; start: string; ganztags: boolean; kalender: string }[];
  bleibt: { schluessel: string; titel: string; start: string; kalender: string; grund: string }[];
  fehler?: string;
}
interface Ergebnis { ok: boolean; umgezogen?: number; schonDa?: number; fehler?: { schluessel: string; grund: string }[] | string; uebrig?: number }

const HINWEISE: Record<string, { text: string; achtung?: boolean }> = {
  verbunden: { text: 'Google ist verbunden — der erste Abgleich läuft.' },
  abgebrochen: { text: 'Die Anmeldung bei Google wurde abgebrochen.', achtung: true },
  domain: { text: 'Dieses Google-Konto gehört nicht zur erlaubten Domain — bitte mit dem Workspace-Konto anmelden.', achtung: true },
  'scope-fehlt': { text: 'Bei Google fehlt eine Freigabe — bitte noch einmal verbinden und alle Häkchen lassen.', achtung: true },
  state: { text: 'Die Anmeldung war abgelaufen — bitte noch einmal starten.', achtung: true },
  person: { text: 'Diese Anmeldung gehörte einer anderen Person.', achtung: true },
  token: { text: 'Google hat die Anmeldung nicht angenommen — bitte noch einmal versuchen.', achtung: true },
  fehler: { text: 'Die Verbindung zu Google ließ sich nicht abschließen.', achtung: true },
};

const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung.' } }));

function Taste({ children, onClick, aus, leise, farbe }: { children: ReactNode; onClick: () => void; aus?: boolean; leise?: boolean; farbe?: string }) {
  const f = farbe ?? C.aktiv;
  const stil: CSSProperties = {
    minHeight: 44, padding: '10px 16px', borderRadius: 11, fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 700, cursor: aus ? 'default' : 'pointer',
    ...(aus ? { border: '1px solid transparent', background: 'rgba(255,255,255,.08)', color: C.inkLeise }
      : leise ? { border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink }
        : { border: `1px solid ${f}66`, background: `${f}22`, color: f }),
  };
  return <button type="button" disabled={aus} onClick={onClick} style={stil}>{children}</button>;
}

const kurzTag = (t: string, ganztags: boolean) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${ganztags ? '' : ` ${t.slice(11, 16)}`}`;

export function GoogleVerbindung({ onGeaendert }: { onGeaendert?: () => void }) {
  const [s, setS] = useState<Stand | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; achtung?: boolean } | null>(null);
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [waehlen, setWaehlen] = useState(false);
  const [umzug, setUmzug] = useState(false);
  const [quellen, setQuellen] = useState<string[]>([]);
  const [vergangen, setVergangen] = useState(false);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [bestaetigt, setBestaetigt] = useState(false);

  const laden = useCallback(async (liste = false) => {
    const d: Stand | null = await fetch(`/api/kalender/google${liste ? '?liste=1' : ''}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setS(d);
    return d;
  }, []);

  // Rückkehr von Google: ?google=verbunden|… → Hinweis zeigen, Adresse säubern.
  useEffect(() => {
    void laden();
    try {
      const u = new URL(window.location.href);
      const g = u.searchParams.get('google');
      if (g) { setHinweis(HINWEISE[g] ?? { text: 'Google: Anmeldung beendet.' }); u.searchParams.delete('google'); window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
    } catch { /* ohne Adresse */ }
  }, [laden]);

  const verbinden = async () => {
    setArbeit('verbinden'); setHinweis(null);
    const r = await post('/api/google/verbinden', { funktionen: ['kalender'] });
    setArbeit(null);
    if (r.d.ok && typeof r.d.url === 'string') { window.location.href = r.d.url; return; }
    setHinweis({ text: r.d.fehler ?? 'Google ließ sich nicht starten.', achtung: true });
  };
  const trennen = async () => {
    if (!window.confirm('Google trennen? Der Zugriff wird bei Google widerrufen, die Google-Termine verschwinden aus MAKE OS (sie bleiben in Google). Neue Business-Termine landen wieder in iCloud.')) return;
    setArbeit('trennen');
    const r = await post('/api/google/trennen');
    setArbeit(null);
    setHinweis(r.d.ok ? { text: r.d.widerrufen ? 'Getrennt — der Zugriff ist bei Google widerrufen.' : 'Getrennt. Bei Google ließ sich der Zugriff gerade nicht widerrufen — bitte unter myaccount.google.com › Sicherheit entfernen.', achtung: !r.d.widerrufen } : { text: r.d.fehler ?? 'Trennen ging nicht.', achtung: true });
    await laden(); onGeaendert?.();
  };
  const abgleichen = async (voll = false) => {
    setArbeit('abgleich');
    const r = await post('/api/kalender/google', { aktion: voll ? 'voll' : 'abgleichen' });
    setArbeit(null);
    setHinweis(r.d.ok ? { text: `Abgeglichen — ${r.d.ereignisse ?? 0} Termine${r.d.vonAussen ? `, ${r.d.vonAussen} von Google geändert` : ''}.` } : { text: r.d.fehler ?? 'Abgleich ging nicht.', achtung: true });
    await laden(); onGeaendert?.();
  };
  const kalenderWaehlen = async (id: string) => {
    setArbeit('kalender');
    const r = await post('/api/kalender/google', { aktion: 'kalender', kalenderId: id });
    setArbeit(null); setWaehlen(false);
    setHinweis(r.d.ok ? { text: 'Kalender gewählt — wird neu gelesen.' } : { text: r.d.fehler ?? 'Kalender ließ sich nicht wählen.', achtung: true });
    await laden(); onGeaendert?.();
  };

  const umzugOeffnen = async () => {
    setUmzug(true); setErgebnis(null); setBestaetigt(false);
    const v: Vorschau | null = await fetch('/api/kalender/google/umzug', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setVorschau(v);
    setQuellen((v?.quellen ?? []).filter(q => q.business).map(q => q.name));
  };
  const vorschauHolen = async (q = quellen, v = vergangen) => {
    const p = new URLSearchParams(); q.forEach(n => p.append('kalender', n)); if (v) p.set('vergangen', '1');
    const x: Vorschau | null = await fetch(`/api/kalender/google/umzug?${p.toString()}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setVorschau(x); setBestaetigt(false); setErgebnis(null);
  };
  const umziehen = async () => {
    setArbeit('umzug');
    const r = await post('/api/kalender/google/umzug', { kalender: quellen, mitVergangenen: vergangen, bestaetigt: true });
    setArbeit(null);
    setErgebnis(r.d as Ergebnis);
    await vorschauHolen(); onGeaendert?.();
  };

  const klein: CSSProperties = { fontSize: 12.5, color: C.inkLeise };
  const box: CSSProperties = { display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' };
  const gebe = (k: string) => arbeit === k;

  return (
    <div style={box} data-google="verbindung">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Google Kalender (MAKE)</span>
        {s?.verbunden && <span style={{ fontSize: 11, fontWeight: 700, color: LEUCHT.schlaf, border: `1px solid ${LEUCHT.schlaf}55`, borderRadius: 999, padding: '1px 8px' }}>verbunden</span>}
        {s?.getrennt && <span style={{ fontSize: 11, fontWeight: 700, color: LEUCHT.kritisch, border: `1px solid ${LEUCHT.kritisch}55`, borderRadius: 999, padding: '1px 8px' }}>getrennt</span>}
      </div>
      <div style={klein}>Deine MAKE-Termine liegen bei Google (Workspace) und gleichen in beide Richtungen ab. Privat, Familie und Gemeinsam bleiben in MAKE OS und iCloud.</div>
      {hinweis && <div role="status" style={{ fontSize: 13, color: hinweis.achtung ? LEUCHT.achtung : C.ink, background: hinweis.achtung ? `${LEUCHT.achtung}14` : 'rgba(255,255,255,.04)', borderRadius: 9, padding: '8px 10px' }}>{hinweis.text}</div>}

      {!s && <div style={klein}>lädt …</div>}
      {s && !s.konfiguriert && (
        <div style={{ ...klein, color: LEUCHT.achtung }}>Noch nicht eingerichtet: Auf dem Server fehlen die Zugangsdaten der Google-Anwendung (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET). Schritt für Schritt: GOOGLE_KALENDER_EINRICHTEN.md.</div>
      )}
      {s?.konfiguriert && !s.verbunden && (
        <>
          {s.getrennt && <div style={{ fontSize: 13, color: LEUCHT.kritisch }}>Die Verbindung ist nicht mehr gültig ({s.getrennt.grund}). Bitte neu verbinden.</div>}
          <div><Taste onClick={() => void verbinden()} aus={gebe('verbinden')}>{gebe('verbinden') ? 'öffnet Google …' : s.getrennt ? 'Neu verbinden' : 'Google Kalender verbinden'}</Taste></div>
          <div style={klein}>Du meldest dich bei Google mit deinem Workspace-Konto an{s.erlaubteDomain ? ' (nur die eingestellte Domain wird angenommen)' : ''}. MAKE OS bekommt Zugriff auf Termine — keine Mails und keine Dateien; Gmail verbindest du getrennt in der Inbox (nur wenn du willst).</div>
        </>
      )}
      {s?.verbunden && (
        <>
          <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>Verbunden als <b>{s.konto}</b>{s.kalender ? <> · Kalender „{s.kalender.name}“{s.kalender.schreibbar ? '' : ' (nur lesbar)'}</> : ' · wird eingerichtet …'}</span>
            <AbgleichStand a={s.abgleich} quelle="Google" />
            <span style={klein}>Gmail (Inbox): {s.bereit?.includes('gmail') ? 'verbunden' : 'nicht verbunden'} — <Link href="/os/inbox" style={{ color: C.aktiv, textDecoration: 'none' }}>in der Inbox {s.bereit?.includes('gmail') ? 'öffnen' : 'verbinden'} ›</Link></span>
            <span style={klein}>{s.push === 'aktiv' ? 'Änderungen kommen sofort per Push von Google.' : s.push === 'wartet' ? 'Push wird eingerichtet — bis dahin Abgleich alle 5 Minuten.' : 'Kein Push (keine öffentliche HTTPS-Adresse) — Abgleich alle 5 Minuten.'}{s.vonAussen ? ` Zuletzt in Google geändert: ${s.vonAussen.n} Termin${s.vonAussen.n === 1 ? '' : 'e'}.` : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Taste leise aus={!!arbeit} onClick={() => void abgleichen()}>{gebe('abgleich') ? 'gleicht ab …' : 'Jetzt abgleichen'}</Taste>
            <Taste leise aus={!!arbeit} onClick={() => { setWaehlen(v => !v); if (!waehlen) void laden(true); }}>Kalender wählen</Taste>
            <Taste leise aus={!!arbeit} onClick={() => (umzug ? setUmzug(false) : void umzugOeffnen())}>Business-Termine aus iCloud umziehen</Taste>
            <Taste farbe={LEUCHT.kritisch} aus={!!arbeit} onClick={() => void trennen()}>{gebe('trennen') ? 'trennt …' : 'Trennen'}</Taste>
          </div>

          {waehlen && (
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={klein}>Welcher Google-Kalender ist dein MAKE-Kalender? (Ein MAKE-OS-Kalender hat genau ein Google-Zuhause.)</span>
              {!s.liste && !s.listeFehler && <span style={klein}>lädt …</span>}
              {s.listeFehler && <span style={{ ...klein, color: LEUCHT.achtung }}>{s.listeFehler}</span>}
              <div style={{ display: 'grid', gap: 6 }}>
                {(s.liste ?? []).map(k => (
                  <label key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14, cursor: arbeit ? 'default' : 'pointer' }}>
                    <input type="radio" name="google-kalender" checked={k.gewaehlt} disabled={!!arbeit || !k.schreibbar} onChange={() => void kalenderWaehlen(k.id)} style={{ width: 20, height: 20 }} />
                    <span style={{ flex: 1 }}>{k.name}{k.primary ? ' · Hauptkalender' : ''}{k.schreibbar ? '' : ' · nur lesbar'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {umzug && (
            <div style={{ display: 'grid', gap: 8, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>Business-Termine aus iCloud umziehen</span>
              <span style={klein}>Zieht Termine ab heute aus den gewählten iCloud-Kalendern in deinen Google-Kalender. Vorher wird jeder Termin gesichert (verschlüsselt, 30 Tage). Serien, Termine mit Gästen und Blöcke aus dem Planen bleiben in iCloud.</span>
              {vorschau?.hinweis && <span style={{ ...klein, color: LEUCHT.achtung }}>{vorschau.hinweis}</span>}
              {(vorschau?.quellen ?? []).length === 0 && vorschau && <span style={klein}>Keine iCloud-Kalender gefunden, die dir gehören.</span>}
              {(vorschau?.quellen ?? []).map(q => (
                <label key={q.name} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14 }}>
                  <input type="checkbox" checked={quellen.includes(q.name)} style={{ width: 20, height: 20 }}
                    onChange={() => { const n = quellen.includes(q.name) ? quellen.filter(x => x !== q.name) : [...quellen, q.name]; setQuellen(n); void vorschauHolen(n, vergangen); }} />
                  <span style={{ flex: 1 }}>{q.name}{q.business ? ' · Business' : ''}</span>
                  {quellen.includes(q.name) && <span style={klein}>{q.umzieht} ziehen um · {q.bleibt} bleiben</span>}
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14 }}>
                <input type="checkbox" checked={vergangen} style={{ width: 20, height: 20 }} onChange={() => { setVergangen(!vergangen); void vorschauHolen(quellen, !vergangen); }} />
                <span>auch die letzten 90 Tage mitnehmen</span>
              </label>
              {!!vorschau?.umzieht.length && (
                <div style={{ display: 'grid', gap: 2, fontSize: 13 }}>
                  <b>{vorschau.umzieht.length} {vorschau.umzieht.length === 1 ? 'Termin zieht' : 'Termine ziehen'} nach „{vorschau.ziel}“ um{vorschau.uebrig ? ` (weitere ${vorschau.uebrig} im nächsten Klick)` : ''}:</b>
                  {vorschau.umzieht.slice(0, 40).map(t => <span key={t.schluessel} style={{ color: C.inkDim }}>{kurzTag(t.start, t.ganztags)} · {t.titel}</span>)}
                  {vorschau.umzieht.length > 40 && <span style={klein}>… und {vorschau.umzieht.length - 40} weitere</span>}
                </div>
              )}
              {!!vorschau?.bleibt.length && (
                <div style={{ display: 'grid', gap: 2, fontSize: 13 }}>
                  <b>{vorschau.bleibt.length} bleiben in iCloud:</b>
                  {vorschau.bleibt.slice(0, 20).map(t => <span key={t.schluessel} style={{ color: C.inkDim }}>{kurzTag(t.start, false)} · {t.titel} — {t.grund}</span>)}
                  {vorschau.bleibt.length > 20 && <span style={klein}>… und {vorschau.bleibt.length - 20} weitere</span>}
                </div>
              )}
              {!!vorschau?.umzieht.length && (
                <>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, fontSize: 14 }}>
                    <input type="checkbox" checked={bestaetigt} onChange={() => setBestaetigt(!bestaetigt)} style={{ width: 20, height: 20, marginTop: 2 }} />
                    <span>Ja, diese {vorschau.umzieht.length} Termine jetzt umziehen (in iCloud werden sie danach gelöscht).</span>
                  </label>
                  <div><Taste aus={!bestaetigt || !!arbeit} onClick={() => void umziehen()}>{gebe('umzug') ? 'zieht um …' : 'Jetzt umziehen'}</Taste></div>
                </>
              )}
              {ergebnis && (
                <div role="status" style={{ fontSize: 13, color: Array.isArray(ergebnis.fehler) && ergebnis.fehler.length ? LEUCHT.achtung : C.ink }}>
                  {ergebnis.ok
                    ? `${ergebnis.umgezogen ?? 0} umgezogen${ergebnis.schonDa ? ` (${ergebnis.schonDa} waren schon in Google)` : ''}${Array.isArray(ergebnis.fehler) && ergebnis.fehler.length ? ` · ${ergebnis.fehler.length} nicht — bitte noch einmal` : ''}${ergebnis.uebrig ? ` · ${ergebnis.uebrig} weitere folgen im nächsten Klick` : ''}.`
                    : typeof ergebnis.fehler === 'string' ? ergebnis.fehler : 'Umzug nicht möglich.'}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
