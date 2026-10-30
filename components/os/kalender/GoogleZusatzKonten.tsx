'use client';

// ─── Kalender-Einstellungen: weitere Google-Konten (nur lesen) (30.10.2026) ───
// Kevin 30.10.: ein zweites Konto in MAKE OS — für Kalender anderer Firmen, gegen Doppelbuchungen. Je Person bis zu fünf weitere
// Google-Konten; MAKE OS liest nur die gewählten Kalender, schreibt nie dorthin. Ihre Termine zählen als belegt, andere sehen nur
// „Belegt“. Nur die eigene Person verwaltet ihre Konten. Daten nur über /api/kalender/google/zusatz — nie Tokens, nie volle Adressen.
// Bausteine aus components/os/ui (Design-Standard), Tasten ≥ 44 px, Eingaben 16 px.

import { useCallback, useEffect, useState } from 'react';
import { Karte, Knopf, Hinweis, Zeile, Beschriftung, eingabe, useRueckfrage } from '../ui';
import { anzahl } from '@/lib/text/zahlwort';

interface KontoStand {
  id: string; konto: string; label: string; status: 'verbunden' | 'abgelaufen'; seit: string; abgelaufenAm?: string;
  spiegel: { kennung: string; name: string; termine: number; at?: string; fehler?: string }[];
}
interface Stand { ok: boolean; konfiguriert: boolean; max: number; konten: KontoStand[]; fehler?: string }
interface Wahl { id: string; name: string; primary: boolean; gewaehlt: boolean }

/** Rückkehr von Google (`?google-zusatz=…`) — eigene Texte, keine Adressen. */
const RUECKKEHR: Record<string, { text: string; art: 'gut' | 'achtung' }> = {
  verbunden: { text: 'Weiteres Kalender-Konto verbunden — die Termine werden jetzt gelesen.', art: 'gut' },
  abgebrochen: { text: 'Die Anmeldung bei Google wurde abgebrochen.', art: 'achtung' },
  domain: { text: 'Dieses Google-Konto gehört zu keiner Domain, die für weitere Kalender freigegeben ist.', art: 'achtung' },
  gleich: { text: 'Das ist dein Haupt-Konto bei Google — als weiteres Konto verbindest du ein anderes.', art: 'achtung' },
  doppelt: { text: 'Dieses Google-Konto ist schon verbunden.', art: 'achtung' },
  'anderes-konto': { text: 'Bei Google wurde ein anderes Konto gewählt — zum Neu-Verbinden bitte dasselbe Konto wählen.', art: 'achtung' },
  'scope-fehlt': { text: 'Google hat den Lesezugriff auf den Kalender nicht freigegeben — bitte neu verbinden und das Häkchen setzen.', art: 'achtung' },
  voll: { text: 'Mehr weitere Kalender-Konten gehen nicht.', art: 'achtung' },
  state: { text: 'Die Anmeldung ist abgelaufen — bitte noch einmal starten.', art: 'achtung' },
};

type Antwort = { ok?: boolean; fehler?: string; url?: string; widerrufen?: boolean };
const post = (body: unknown): Promise<{ status: number; d: Antwort }> => fetch('/api/kalender/google/zusatz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) as Antwort }))
  .catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung.' } }));

const seit = (iso?: string) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : '—');

export function GoogleZusatzKonten({ onGeaendert }: { onGeaendert?: () => void }) {
  const [s, setS] = useState<Stand | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; art: 'gut' | 'achtung' } | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [wahl, setWahl] = useState<Wahl[] | null>(null);
  const [label, setLabel] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const d = await fetch('/api/kalender/google/zusatz', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null) as Stand | null;
    setS(d?.ok ? d : null);
  }, []);
  useEffect(() => {
    void laden();
    try {
      const u = new URL(window.location.href);
      const g = u.searchParams.get('google-zusatz');
      if (g) { setHinweis(RUECKKEHR[g] ?? { text: 'Google: Anmeldung beendet.', art: 'achtung' }); u.searchParams.delete('google-zusatz'); window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
    } catch { /* ohne Adresse */ }
  }, [laden]);

  if (!s) return null;

  const verbinden = async (konto?: string) => {
    setHinweis(null);
    const r = await post({ aktion: 'verbinden', ...(konto ? { konto } : {}) });
    if (r.d.ok && typeof r.d.url === 'string') { window.location.href = r.d.url; return; }
    setHinweis({ text: r.d.fehler ?? 'Die Anmeldung ließ sich nicht starten.', art: 'achtung' });
  };
  const oeffnen = async (k: KontoStand) => {
    if (offen === k.id) { setOffen(null); return; }
    setOffen(k.id); setLabel(k.label); setWahl(null);
    if (k.status !== 'verbunden') return;
    const d = await fetch(`/api/kalender/google/zusatz?liste=${encodeURIComponent(k.id)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null) as { ok?: boolean; liste?: Wahl[]; fehler?: string } | null;
    if (d?.ok && d.liste) setWahl(d.liste); else setHinweis({ text: d?.fehler ?? 'Die Kalender dieses Kontos ließen sich nicht lesen.', art: 'achtung' });
  };
  const speichern = async (k: KontoStand) => {
    if (label.trim() && label.trim() !== k.label) {
      const r = await post({ aktion: 'label', konto: k.id, label });
      if (!r.d.ok) { setHinweis({ text: r.d.fehler ?? 'Bezeichnung nicht gespeichert.', art: 'achtung' }); return; }
    }
    if (wahl) {
      const ids = wahl.filter(w => w.gewaehlt).map(w => w.id);
      const r = await post({ aktion: 'kalender', konto: k.id, kalender: ids });
      if (!r.d.ok) { setHinweis({ text: r.d.fehler ?? 'Kalender nicht gespeichert.', art: 'achtung' }); return; }
    }
    setHinweis({ text: 'Gespeichert — die Kalender werden neu gelesen.', art: 'gut' });
    setOffen(null); await laden(); onGeaendert?.();
  };
  const abgleichen = async (k: KontoStand) => {
    const r = await post({ aktion: 'abgleichen', konto: k.id });
    setHinweis(r.d.ok ? { text: 'Abgeglichen.', art: 'gut' } : { text: r.d.fehler ?? 'Abgleich ging nicht.', art: 'achtung' });
    await laden(); onGeaendert?.();
  };
  const trennen = async (k: KontoStand) => {
    if (!(await bestaetigen({ titel: 'Kalender-Konto trennen?', text: `„${k.label}“ (${k.konto}): der Zugriff wird bei Google widerrufen, die Termine verschwinden aus MAKE OS (sie bleiben bei Google) und zählen nicht mehr als belegt.`, ja: 'Trennen', gefahr: true }))) return;
    const r = await post({ aktion: 'trennen', konto: k.id });
    setHinweis(r.d.ok ? { text: r.d.widerrufen ? 'Getrennt — der Zugriff ist bei Google widerrufen.' : 'Getrennt. Bei Google ließ sich der Zugriff gerade nicht widerrufen — bitte im Google-Konto unter Sicherheit entfernen.', art: r.d.widerrufen ? 'gut' : 'achtung' } : { text: r.d.fehler ?? 'Trennen ging nicht.', art: 'achtung' });
    setOffen(null); await laden(); onGeaendert?.();
  };

  return (
    <Karte flach>
      <div style={{ display: 'grid', gap: 10 }}>
        <Beschriftung>Weitere Kalender</Beschriftung>
        <span style={{ fontSize: 14, lineHeight: 1.45 }}>Arbeitskalender bei anderen Firmen (Google): MAKE OS liest nur mit, damit dort belegte Zeiten hier als belegt zählen. Andere sehen davon nur „Belegt“.</span>
        {hinweis && <Hinweis art={hinweis.art === 'gut' ? 'gut' : 'achtung'}>{hinweis.text}</Hinweis>}
        {!s.konfiguriert && <Hinweis art="info">Weitere Kalender-Konten sind auf dieser Instanz noch nicht eingerichtet — das richtet die Inhaberin bzw. der Betreiber eurer Instanz ein.</Hinweis>}
        {s.konten.map(k => (
          <div key={k.id} style={{ display: 'grid', gap: 8 }}>
            <Zeile
              titel={k.label} umbrechen
              unter={`${k.konto} · ${k.status === 'verbunden' ? `${anzahl(k.spiegel.reduce((n, x) => n + x.termine, 0), 'Termin', 'Termine')}, zuletzt ${seit(k.spiegel.map(x => x.at).filter(Boolean).sort().pop())}` : 'Anmeldung abgelaufen'}`}
              rechts={k.status === 'abgelaufen'
                ? <Knopf onClick={() => verbinden(k.id)}>Neu verbinden</Knopf>
                : <Knopf leise onClick={() => oeffnen(k)}>{offen === k.id ? 'Schließen' : 'Einstellen'}</Knopf>}
            />
            {k.status === 'verbunden' && k.spiegel.some(x => x.fehler) && <Hinweis art="achtung">{k.spiegel.find(x => x.fehler)?.fehler}</Hinweis>}
            {offen === k.id && (
              <div style={{ display: 'grid', gap: 8, paddingLeft: 4 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                  Bezeichnung (steht hinter dem Kalendernamen)
                  <input value={label} maxLength={40} onChange={e => setLabel(e.target.value)} style={{ ...eingabe, fontSize: 16 }} />
                </label>
                {wahl && (
                  <div style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 13 }}>Welche Kalender zählen als belegt?</span>
                    {wahl.map(w => (
                      <label key={w.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: 14, cursor: 'pointer' }}>
                        <input type="checkbox" checked={w.gewaehlt} onChange={e => setWahl(wahl.map(x => (x.id === w.id ? { ...x, gewaehlt: e.target.checked } : x)))} style={{ width: 20, height: 20 }} />
                        {w.name}{w.primary ? ' (Hauptkalender)' : ''}
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Knopf onClick={() => speichern(k)} aus={!!wahl && !wahl.some(w => w.gewaehlt)}>Speichern</Knopf>
                  <Knopf leise onClick={() => abgleichen(k)}>Jetzt abgleichen</Knopf>
                  <Knopf leise ton="warn" onClick={() => trennen(k)}>Trennen</Knopf>
                </div>
              </div>
            )}
            {k.status === 'abgelaufen' && <div><Knopf leise ton="warn" onClick={() => trennen(k)}>Trennen</Knopf></div>}
          </div>
        ))}
        {s.konfiguriert && s.konten.length < s.max && (
          <div><Knopf onClick={() => verbinden()}>{s.konten.length ? 'Noch ein Google-Konto verbinden' : 'Weiteres Google-Konto verbinden'}</Knopf></div>
        )}
      </div>
      {dialog}
    </Karte>
  );
}
