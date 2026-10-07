'use client';

// ─── Kalender-Einstellungen: iCloud verbinden — je Person (06.10.2026) ───────
// Kevin 06.10.: „Malins iCloud-Kalender soll in MAKE OS erscheinen.“ Jede Person hinterlegt hier SELBST ihre Apple-ID und
// ein app-spezifisches Passwort (nie das normale Apple-Passwort). Zwei Fälle, eine Karte:
//   · Haushalts-Kalender — die Verbindung der Haupt-Person speist den gemeinsamen Kalender (wie bisher; ohne Eintrag hier
//     gilt die Server-Einrichtung als ihre Verbindung, ein Eintrag hier ersetzt sie)
//   · eigene Kalender — jede andere Person: nur sie sieht die Termine, alle anderen nur „Belegt“; Kalender einzeln zeigen
// Fehlerfall „App-Passwort ungültig“ (Apple macht es beim Wechsel des Apple-Passworts ungültig): klare Meldung + „Verbindung
// erneuern“. „Trennen“ löscht Zugang und Spiegel (mit Rückfrage). Daten nur über /api/kalender/icloud — das Passwort geht
// einmal zum Server und kommt nie zurück (das Feld wird nach dem Senden geleert).
// Am Handy bedienbar: Tasten ≥ 44 px, Eingaben 16 px (Bausteine aus components/os/ui).

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, eingabe, Schalter, useRueckfrage } from '../ui';
import { AbgleichStand, type AbgleichInfo } from './AbgleichStand';

interface Stand {
  ok: boolean; haupt: boolean; quelle: 'oberflaeche' | 'umgebung' | 'getrennt' | 'keine'; verbunden: boolean;
  konto?: string; seit?: string; erneuert?: string; abgleich?: AbgleichInfo; anmeldung?: true;
  kalender?: { kennung: string; name: string; gezeigt: boolean; schreibbar: boolean; termine: number }[];
  fehler?: string; hinweis?: string;
}

const post = (body: unknown) => fetch('/api/kalender/icloud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) as Partial<Stand> & { fehler?: string; anmeldung?: true; war?: boolean } }))
  .catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung zum Server.' } as Partial<Stand> & { fehler?: string } }));

const tag = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export function IcloudVerbindung({ onGeaendert }: { onGeaendert?: () => void }) {
  const [s, setS] = useState<Stand | null>(null);
  const [formular, setFormular] = useState(false);
  const [appleId, setAppleId] = useState('');
  const [passwort, setPasswort] = useState('');
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' | 'kritisch' } | null>(null);
  const [arbeit, setArbeit] = useState<string | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const [ladeFehler, setLadeFehler] = useState(false);
  const laden = useCallback(async () => {
    const d: Stand | null = await fetch('/api/kalender/icloud', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setLadeFehler(!d);
    if (d) setS(d);
    return d;
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const verbinden = async (e?: FormEvent) => {
    e?.preventDefault();
    setArbeit('verbinden'); setMeldung(null);
    const r = await post({ aktion: 'verbinden', appleId, passwort });
    setPasswort(''); // nie länger als nötig im Browser
    setArbeit(null);
    if (r.d.ok) {
      setFormular(false);
      setMeldung({ text: r.d.hinweis ?? 'Verbunden — deine Termine erscheinen gleich im Kalender.', art: r.d.hinweis ? 'achtung' : 'gut' });
      setS(r.d as Stand); onGeaendert?.();
      return;
    }
    setMeldung({ text: r.d.fehler ?? 'Verbinden ging nicht.', art: r.d.anmeldung ? 'kritisch' : 'achtung' });
  };

  const trennen = async () => {
    if (!s) return;
    const text = s.haupt
      ? 'Das ist der Kalender des ganzen Haushalts: Seine Termine verschwinden aus MAKE OS (in iCloud bleiben sie). Neue Termine, Blöcke und Spiegel lassen sich erst nach erneutem Verbinden schreiben. Das App-Passwort bitte zusätzlich unter appleid.apple.com widerrufen.'
      : 'Deine iCloud-Termine verschwinden aus MAKE OS (in iCloud bleiben sie). Zugang und Spiegel werden gelöscht. Das App-Passwort bitte zusätzlich unter appleid.apple.com widerrufen.';
    if (!(await bestaetigen({ titel: s.haupt ? 'Haushalts-Kalender trennen?' : 'iCloud trennen?', text, ja: 'Trennen', gefahr: true }))) return;
    setArbeit('trennen');
    const r = await post({ aktion: 'trennen' });
    setArbeit(null);
    setMeldung(r.d.ok ? { text: 'Getrennt. Denk daran, das App-Passwort bei Apple zu widerrufen.', art: 'gut' } : { text: r.d.fehler ?? 'Trennen ging nicht.', art: 'achtung' });
    if (r.d.ok) { setS(r.d as Stand); onGeaendert?.(); }
  };

  const abgleichen = async () => {
    setArbeit('abgleich');
    const r = await post({ aktion: 'abgleichen' });
    setArbeit(null);
    setMeldung(r.d.ok ? { text: 'Abgeglichen.', art: 'gut' } : { text: r.d.fehler ?? 'Abgleich ging nicht.', art: 'achtung' });
    if (r.d.ok) { setS(r.d as Stand); onGeaendert?.(); } else void laden();
  };

  const zeigen = async (kennung: string, an: boolean) => {
    setArbeit(`kal:${kennung}`);
    const r = await post({ aktion: 'kalender', kennung, zeigen: an });
    setArbeit(null);
    if (r.d.ok) { setS(r.d as Stand); onGeaendert?.(); } else setMeldung({ text: r.d.fehler ?? 'Ging nicht.', art: 'achtung' });
  };

  const klein: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 };
  const box: CSSProperties = { display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' };
  const offen = formular || (s !== null && !s.verbunden);
  const erneuern = !!s?.verbunden;

  return (
    <div style={box} data-icloud="verbindung">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>iCloud Kalender</span>
        {s?.verbunden && !s.anmeldung && <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv, border: `1px solid ${C.aktiv}55`, borderRadius: 999, padding: '1px 8px' }}>verbunden</span>}
        {s?.anmeldung && <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.kritisch, border: `1px solid ${C.kritisch}55`, borderRadius: 999, padding: '1px 8px' }}>App-Passwort ungültig</span>}
      </div>
      <div style={klein}>
        {s?.haupt
          ? 'Dein iCloud-Konto ist der Kalender des Haushalts (Gemeinsam, Familie, Planen). Der Haushalt sieht ihn — private Termine der anderen Person nur als „Belegt“.'
          : 'Deine eigenen iCloud-Kalender in MAKE OS. Die Termine siehst nur du — alle anderen sehen nur „Belegt“ (Zeit ja, kein Titel, kein Ort).'}
      </div>

      {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}
      {!s && !ladeFehler && <div style={klein}>lädt …</div>}
      {!s && ladeFehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => laden()}>Noch einmal laden</Knopf>}>Der Stand der iCloud-Verbindung ließ sich gerade nicht laden.</Hinweis>}

      {s?.anmeldung && (
        <Hinweis art="kritisch" titel="Apple nimmt das App-Passwort nicht mehr an">
          Das passiert, wenn das Apple-Passwort geändert oder das App-Passwort widerrufen wurde. Lege unter appleid.apple.com ein neues App-Passwort an und erneuere die Verbindung.
        </Hinweis>
      )}

      {s?.verbunden && (
        <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          <span>Verbunden als <b>{s.konto}</b>{s.quelle === 'umgebung' ? ' · über die Server-Einrichtung' : s.seit ? ` · seit ${tag(s.seit)}` : ''}{s.erneuert ? ` · erneuert ${tag(s.erneuert)}` : ''}</span>
          <AbgleichStand a={s.abgleich} />
          {s.quelle === 'umgebung' && <span style={klein}>Die Server-Einrichtung gilt als deine Verbindung. Trägst du hier ein App-Passwort ein, ersetzt es die Server-Einrichtung.</span>}
        </div>
      )}

      {s?.verbunden && !offen && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise aus={!!arbeit} onClick={() => abgleichen()}>{arbeit === 'abgleich' ? 'gleicht ab …' : 'Jetzt abgleichen'}</Knopf>
          <Knopf leise={!s.anmeldung} aus={!!arbeit} onClick={() => { setFormular(true); setMeldung(null); }}>Verbindung erneuern</Knopf>
          <Knopf ton="warn" aus={!!arbeit} onClick={() => trennen()}>{arbeit === 'trennen' ? 'trennt …' : 'Trennen'}</Knopf>
        </div>
      )}

      {s?.verbunden && !s.haupt && !!s.kalender?.length && (
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ ...klein, fontWeight: 600 }}>Welche Kalender zeigen?</span>
          {s.kalender.map(k => (
            <div key={k.kennung} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}{k.schreibbar ? '' : ' · nur lesbar'}</span>
              <span style={klein}>{k.gezeigt ? `${k.termine} Termine` : 'aus'}</span>
              <Schalter an={k.gezeigt} aus={!!arbeit} onChange={an => void zeigen(k.kennung, an)} ariaLabel={`${k.name} zeigen`} />
            </div>
          ))}
          <span style={klein}>Kalender, die schon im Haushalts-Kalender stehen (geteilt), erscheinen nur einmal.</span>
        </div>
      )}

      {s && offen && (
        <form onSubmit={e => void verbinden(e)} style={{ display: 'grid', gap: 10 }}>
          <Feldzeile label="Apple-ID (E-Mail-Adresse)">
            <input type="email" inputMode="email" autoComplete="username" value={appleId} onChange={e => setAppleId(e.target.value)} placeholder="E-Mail-Adresse deiner Apple-ID" style={eingabe} required />
          </Feldzeile>
          <Feldzeile label="App-spezifisches Passwort">
            <input type="password" autoComplete="off" value={passwort} onChange={e => setPasswort(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" style={eingabe} required />
          </Feldzeile>
          <ol style={{ ...klein, margin: 0, paddingLeft: 18, display: 'grid', gap: 2 }}>
            <li>appleid.apple.com öffnen und anmelden.</li>
            <li>„Anmelden und Sicherheit“ › „App-spezifische Passwörter“ › neues Passwort, Name „MAKE OS“.</li>
            <li>Das Passwort hier einfügen (mit oder ohne Bindestriche). Nie das normale Apple-Passwort.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf haupt typ="submit" aus={!!arbeit || !appleId.trim() || !passwort.trim()}>{arbeit === 'verbinden' ? 'prüft bei Apple …' : erneuern ? 'Verbindung erneuern' : 'iCloud verbinden'}</Knopf>
            {erneuern && <Knopf leise aus={!!arbeit} onClick={() => { setFormular(false); setPasswort(''); }}>Abbrechen</Knopf>}
          </div>
          <span style={klein}>MAKE OS prüft die Anmeldung bei Apple, bevor etwas gespeichert wird. Das Passwort liegt nur verschlüsselt auf dem Server, geht nur an iCloud und erscheint nirgends mehr — auch nicht hier.</span>
        </form>
      )}
      {dialog}
    </div>
  );
}
