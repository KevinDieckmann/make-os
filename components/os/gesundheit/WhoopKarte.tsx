'use client';

// ─── Gesundheit: WHOOP verbinden — je Person (08.10.2026) ───────────────────────────────────────────────────────────────
// Kevin 08.10.: „Whoop-Schnittstelle, damit wir immer die aktuellen Daten haben.“ Jede Person verbindet IHR WHOOP-Konto selbst;
// die Karte zeigt nur die EIGENE Verbindung (die Route liefert nichts anderes — Trennung serverseitig): „WHOOP verbinden“ /
// „Verbunden als k***@…“, letzter Abgleich vor X, „Jetzt abgleichen“, „Trennen“ (mit Rückfrage). Daten nur über /api/whoop/* —
// nie ein Token im Browser. Ohne Einwilligung (a) in Gesundheitsdaten: Hinweis statt Knopf (die Einwilligung steht unter System ›
// Datenschutz). Eingebettet unter Gesundheit (Kachel „whoop“) und System › Verbindungen. Bausteine aus components/os/ui.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, LEUCHT, useRueckfrage } from '../ui';

interface Stand {
  ok: boolean; konfiguriert: boolean; fehlt: string[]; verbunden: boolean; konto?: string; seit?: string;
  getrennt?: { grund: string; seit?: string }; scopesFehlen: string[]; uebernommen?: boolean; einwilligung: boolean;
  abgleich: { vorMin: number | null; veraltet: boolean; webhook: boolean; fehler?: string; hinweis?: string };
  zuletzt?: { tag: string; rec?: number; sleep?: number; strain?: number };
}

const RUECKRUF_TEXT: Record<string, { text: string; art: 'gut' | 'achtung' | 'kritisch' }> = {
  verbunden: { text: 'WHOOP ist verbunden — die letzten 90 Tage kommen gleich herein.', art: 'gut' },
  'scope-fehlt': { text: 'Verbunden, aber WHOOP hat nicht alle Freigaben erteilt — bitte neu verbinden und alle Häkchen setzen.', art: 'achtung' },
  abgebrochen: { text: 'Die Anmeldung bei WHOOP wurde abgebrochen.', art: 'achtung' },
  state: { text: 'Die Anmeldung ist abgelaufen — bitte noch einmal „WHOOP verbinden“.', art: 'achtung' },
  belegt: { text: 'Dieses WHOOP-Konto ist schon mit einer anderen Person verbunden.', art: 'kritisch' },
  token: { text: 'WHOOP hat die Anmeldung nicht angenommen — bitte noch einmal versuchen.', art: 'kritisch' },
};

const tag = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const vor = (min: number | null) => (min === null ? 'noch nie' : min < 2 ? 'gerade eben' : min < 120 ? `vor ${min} min` : min < 48 * 60 ? `vor ${Math.round(min / 60)} h` : `vor ${Math.round(min / 1440)} Tagen`);

export function WhoopKarte({ i = 0, eingebettet = false }: { i?: number; eingebettet?: boolean }) {
  const [s, setS] = useState<Stand | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' | 'kritisch' } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const rueckruf = useSearchParams().get('whoop');

  const laden = useCallback(async () => {
    const d: Stand | null = await fetch('/api/whoop/status', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setLadeFehler(!d);
    if (d) setS(d);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { if (rueckruf) setMeldung(RUECKRUF_TEXT[rueckruf] ?? { text: 'Die Verbindung kam nicht zustande — bitte noch einmal versuchen.', art: 'achtung' }); }, [rueckruf]);

  type Antwort = { ok?: boolean; url?: string; fehler?: string; error?: string; tage?: number; trainings?: number; widerrufen?: boolean };
  const post = (pfad: string): Promise<{ status: number; d: Antwort }> => fetch(pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) as Antwort }))
    .catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung zum Server.' } }));

  const verbinden = async () => {
    setMeldung(null);
    const r = await post('/api/whoop/verbinden');
    if (r.d.ok && r.d.url) { window.location.assign(r.d.url); return; }
    setMeldung({ text: r.d.fehler ?? r.d.error ?? 'Verbinden ging nicht.', art: 'achtung' });
  };
  const abgleichen = async () => {
    const r = await post('/api/whoop/abgleich');
    setMeldung(r.d.ok ? { text: `Abgeglichen${r.d.tage ? ` — ${r.d.tage} Tag${r.d.tage === 1 ? '' : 'e'} aktualisiert` : ''}${r.d.trainings ? `, ${r.d.trainings} Training${r.d.trainings === 1 ? '' : 's'}` : ''}.`, art: 'gut' } : { text: r.d.fehler ?? r.d.error ?? 'Abgleich ging nicht.', art: 'achtung' });
    await laden();
  };
  const trennen = async () => {
    if (!(await bestaetigen({ titel: 'WHOOP trennen?', text: 'MAKE OS widerruft den Zugang bei WHOOP und löscht Verbindung und Spiegel. Deine schon übernommenen Werte (Morgen-Check, Trainings) bleiben — löschen kannst du sie dort.', ja: 'Trennen', gefahr: true }))) return;
    const r = await post('/api/whoop/trennen');
    setMeldung(r.d.ok ? { text: r.d.widerrufen ? 'Getrennt — der Zugang ist bei WHOOP widerrufen.' : 'Getrennt. WHOOP hat den Widerruf nicht bestätigt — in der WHOOP-App unter „Connected Apps“ prüfen.', art: r.d.widerrufen ? 'gut' : 'achtung' } : { text: r.d.fehler ?? 'Trennen ging nicht.', art: 'achtung' });
    await laden();
  };

  const klein = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 } as const;
  const zustand = !s ? null : s.verbunden ? { label: 'verbunden', farbe: LEUCHT.gut } : s.getrennt ? { label: 'getrennt', farbe: LEUCHT.kritisch } : s.konfiguriert ? { label: 'bereit', farbe: LEUCHT.achtung } : { label: 'nicht eingerichtet', farbe: C.inkLeise };

  return (
    <Karte i={i} id="whoop" akzent={s?.verbunden ? LEUCHT.gut : undefined} flach={eingebettet}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={zustand ? <Chip farbe={zustand.farbe}>{zustand.label}</Chip> : undefined}>WHOOP</Ueberschrift>
      <div style={{ display: 'grid', gap: 10 }}>
        {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}
        {!s && !ladeFehler && <div style={klein}>lädt …</div>}
        {!s && ladeFehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => laden()}>Noch einmal laden</Knopf>}>Der Stand der WHOOP-Verbindung ließ sich gerade nicht laden.</Hinweis>}

        {s && !s.konfiguriert && (
          <div style={klein}>WHOOP ist auf diesem Server noch nicht eingerichtet. Es fehlt: {s.fehlt.join(' · ')} (einmalig über das Einrichtungs-Skript).</div>
        )}

        {s?.konfiguriert && !s.einwilligung && (
          <Hinweis art="info" aktion={<Link href="/os/datenschutz#gesundheit" style={{ color: C.ink }}>Zur Einwilligung</Link>}>
            WHOOP-Werte sind Gesundheitsdaten — sie werden erst nach deiner Einwilligung abgeholt.
          </Hinweis>
        )}

        {s?.getrennt && (
          <Hinweis art="kritisch" titel="WHOOP nimmt die Verbindung nicht mehr an">
            Der Zugang wurde bei WHOOP widerrufen oder ist abgelaufen{s.getrennt.seit ? ` (seit ${tag(s.getrennt.seit)})` : ''}. Bitte neu verbinden.
          </Hinweis>
        )}

        {s?.verbunden && (
          <div style={{ display: 'grid', gap: 4, fontSize: TYP.body }}>
            <span>Verbunden{s.konto ? <> als <b>{s.konto}</b></> : ''}{s.seit ? ` · seit ${tag(s.seit)}` : ''}</span>
            <span style={klein}>Letzter Abgleich {vor(s.abgleich.vorMin)}{s.abgleich.webhook ? ' · WHOOP meldet Neues sofort' : ' · stündlich'}</span>
            {s.zuletzt && <span style={klein}>Zuletzt ({tag(`${s.zuletzt.tag}T12:00:00`)}): {[s.zuletzt.rec !== undefined ? `Recovery ${s.zuletzt.rec} %` : '', s.zuletzt.sleep !== undefined ? `Schlaf ${String(s.zuletzt.sleep).replace('.', ',')} h` : '', s.zuletzt.strain !== undefined ? `Strain ${String(s.zuletzt.strain).replace('.', ',')}` : ''].filter(Boolean).join(' · ') || '—'}</span>}
            {s.abgleich.fehler && <span style={klein}>Zuletzt nicht erreichbar — der nächste Abgleich versucht es wieder.</span>}
          </div>
        )}
        {s?.verbunden && (s.scopesFehlen.length > 0 || s.abgleich.hinweis) && (
          <Hinweis art="achtung">{s.uebernommen ? 'Diese Verbindung stammt aus der alten Einrichtung und darf nicht alles lesen (z. B. Workouts).' : 'WHOOP hat nicht alle Freigaben erteilt.'} Bitte neu verbinden und alle Häkchen setzen.</Hinweis>
        )}

        {s?.konfiguriert && s.einwilligung && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!s.verbunden && <Knopf haupt onClick={() => verbinden()}>{s.getrennt ? 'Neu verbinden' : 'WHOOP verbinden'}</Knopf>}
            {s.verbunden && <Knopf onClick={() => abgleichen()}>Jetzt abgleichen</Knopf>}
            {s.verbunden && (s.scopesFehlen.length > 0 || s.uebernommen) && <Knopf leise onClick={() => verbinden()}>Neu verbinden</Knopf>}
            {(s.verbunden || s.getrennt) && <Knopf leise onClick={() => trennen()}>Trennen</Knopf>}
          </div>
        )}
        <div style={klein}>
          Verbunden heißt: Recovery, Schlaf, HRV und Ruhepuls kommen von selbst in deinen Morgen-Check, Workouts in Sport. Was du von Hand einträgst, überschreibt WHOOP nie. Nur du siehst diese Karte — andere Konten sehen deine Werte nur, wenn du sie teilst.
        </div>
      </div>
      {dialog}
    </Karte>
  );
}
