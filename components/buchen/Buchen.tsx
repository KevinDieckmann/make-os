'use client';

// ─── Öffentliche Buchungsseite — Formular (29.09., Paket K4) ─────────────────
// Freie Plätze (nur Zeiten), Tag → Uhrzeit → Angaben → Einwilligung (Wortlaut + Fassung stehen sichtbar da) → Buchen.
// Danach geht es auf die Status-Seite mit dem Token im Fragment (#…) — dort bestätigt der Gast die Anfrage.
// Spam-Schutz im Formular: ein unsichtbares Feld (Honigtopf) und der Formular-Stempel des Servers (Zeitprüfung).
// R-K2 (29.09.): Datenschutz-Hinweis ausgeklappt ÜBER dem Formular (#79) · „Gerade keine Termine buchbar“, wenn der
// Kalender nicht frisch ist (#73, `hinweis` vom Server) · zweite Uhrzeit in der Zone des Gasts (#74, nur im Browser).

import { useEffect, useMemo, useState } from 'react';
import { C, AKZENT, seite, rahmen, karte, titel, leise, klein, feld, label, knopf, chip, tagText, zeitText } from './stil';
import { gastZeitText, zweiteZone, zonenOrt } from '@/lib/kalender/gast-zeit';

interface Daten {
  ok: boolean; fehler?: string; stempel: string; hinweis?: string;
  seite: { titel: string; dauerMin: number; fragen: { firma: boolean; anliegen: boolean }; verantwortlich: string; hinweis: string[]; einwilligung: { wortlaut: string; version: string }; datenschutzLink?: string };
  plaetze: { start: string; ende: string }[];
}

/** Zone des Browsers (nur für die Anzeige) — null, wenn Berlin oder unbekannt. */
export function useGastZone(): string | null {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (zweiteZone(z)) setZone(z); } catch { /* bleibt Berlin */ } }, []);
  return zone;
}

export function Buchen({ slug }: { slug: string }) {
  const [d, setD] = useState<Daten | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');
  const [tag, setTag] = useState('');
  const [platz, setPlatz] = useState<{ start: string; ende: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firma, setFirma] = useState('');
  const [anliegen, setAnliegen] = useState('');
  const [ja, setJa] = useState(false);
  const [falle, setFalle] = useState('');
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState('');
  const zone = useGastZone();

  const laden = async () => {
    setLadeFehler('');
    try {
      const r = await fetch(`/api/buchung/${slug}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) { setLadeFehler(j.fehler ?? 'Die Seite konnte nicht geladen werden.'); return; }
      setD(j);
    } catch { setLadeFehler('Keine Verbindung — bitte später noch einmal.'); }
  };
  useEffect(() => { void laden(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const jeTag = useMemo(() => {
    const m = new Map<string, { start: string; ende: string }[]>();
    for (const p of d?.plaetze ?? []) { const t = p.start.slice(0, 10); m.set(t, [...(m.get(t) ?? []), p]); }
    return m;
  }, [d]);
  const tage = useMemo(() => Array.from(jeTag.keys()), [jeTag]);
  useEffect(() => { if (!tag && tage.length) setTag(tage[0]); }, [tage, tag]);

  const bereit = !!platz && name.trim().length > 0 && /.+@.+\..+/.test(email.trim()) && ja && !sendet;
  /** Zweite Uhrzeit beim Gast (#74) — nur, wenn sie abweicht. */
  const bei = (wand: string) => (zone ? gastZeitText(wand, zone) : null);

  const buchen = async () => {
    if (!d || !platz || !bereit) return;
    setSendet(true); setFehler('');
    try {
      const r = await fetch(`/api/buchung/${slug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: platz.start, name: name.trim(), email: email.trim(), ...(d.seite.fragen.firma ? { firma: firma.trim() } : {}), ...(d.seite.fragen.anliegen ? { anliegen: anliegen.trim() } : {}), einwilligung: ja, stempel: d.stempel, webseite: falle }),
      });
      const j = await r.json().catch(() => ({ ok: false }));
      if (r.ok && j.ok && j.token) { window.location.assign(`${j.statusPfad}#${j.token}`); return; }
      setFehler(j.fehler ?? 'Die Buchung hat nicht geklappt.');
      if (r.status === 409 || r.status === 503) { setPlatz(null); void laden(); }
    } catch { setFehler('Keine Verbindung — bitte noch einmal.'); }
    setSendet(false);
  };

  if (ladeFehler) return <main style={seite}><div style={rahmen}><div style={karte}><h1 style={titel}>Termin buchen</h1><p style={leise}>{ladeFehler}</p><button style={knopf(true, true)} onClick={() => void laden()}>Noch einmal laden</button></div></div></main>;
  if (!d) return <main style={seite}><div style={rahmen}><div style={karte}><p style={leise}>Freie Zeiten werden geladen …</p></div></div></main>;

  const s = d.seite;
  const platzBei = platz ? bei(platz.start) : null;
  return (
    <main style={seite}>
      <div style={rahmen}>
        <header style={{ display: 'grid', gap: 6 }}>
          <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.12em', color: AKZENT, fontWeight: 700 }}>Termin buchen</span>
          <h1 style={titel}>{s.titel}</h1>
          <span style={leise}>{s.dauerMin} Minuten · Zeiten in deutscher Zeit (Berlin){zone ? ` · darunter Ihre Zeit (${zonenOrt(zone)}), wo sie abweicht` : ''}</span>
        </header>

        {/* Datenschutz-Hinweis ausgeklappt ÜBER dem Formular (Art. 13 DSGVO, R-K2 #79). */}
        <section aria-label="Hinweise zum Datenschutz" style={{ ...karte, padding: '14px 16px', background: C.grund, border: `1px solid ${C.linie}`, boxShadow: 'none' }}>
          <h2 style={{ fontSize: 14, margin: '0 0 8px', color: C.ink }}>Datenschutz in Kürze</h2>
          <ul style={{ ...klein, margin: 0, paddingLeft: 18, display: 'grid', gap: 5, color: C.inkDim }}>{s.hinweis.map((h, i) => <li key={i}>{h}</li>)}</ul>
          <p style={{ ...klein, margin: '8px 0 0', color: C.inkDim }}>Verantwortlich: {s.verantwortlich}</p>
          {/* Datenschutzhinweis der Instanz (05.10., aus System › Datenschutz) — vollständig, mit allen Rechten. */}
          {s.datenschutzLink && <p style={{ ...klein, margin: '6px 0 0' }}><a href={s.datenschutzLink} target="_blank" rel="noopener noreferrer" style={{ color: AKZENT }}>Vollständiger Datenschutzhinweis</a></p>}
        </section>

        <div className="buchen-raster" style={{ display: 'grid', gap: 18 }}>
          <section style={karte} aria-label="Zeit wählen">
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>1 · Tag und Uhrzeit</h2>
            {!tage.length && <p style={leise}>{d.hinweis ?? 'Gerade sind keine Zeiten frei. Bitte später noch einmal vorbeischauen.'}</p>}
            {!!tage.length && (
              <>
                <div role="listbox" aria-label="Tag" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
                  {tage.map(t => <button key={t} role="option" aria-selected={t === tag} onClick={() => { setTag(t); setPlatz(null); }} style={chip(t === tag)}>{tagText(t)}</button>)}
                </div>
                <div role="listbox" aria-label="Uhrzeit" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8, marginTop: 12 }}>
                  {(jeTag.get(tag) ?? []).map(p => { const b = bei(p.start); return (
                    <button key={p.start} role="option" aria-selected={platz?.start === p.start} aria-label={`${p.start.slice(11, 16)} Uhr Berlin${b ? `, ${b} bei Ihnen` : ''}`} onClick={() => setPlatz(p)} style={{ ...chip(platz?.start === p.start), display: 'grid', gap: 2, justifyItems: 'center' }}>
                      <span>{p.start.slice(11, 16)}</span>
                      {b && <span style={{ fontSize: 11, fontWeight: 500, color: C.inkLeise }}>{b} bei Ihnen</span>}
                    </button>
                  ); })}
                </div>
              </>
            )}
          </section>

          <section style={karte} aria-label="Ihre Angaben">
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>2 · Ihre Angaben</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {platz ? <div style={{ ...leise, color: C.ink, fontWeight: 600 }}>{zeitText(platz.start, platz.ende)}{platzBei && zone ? <span style={{ ...klein, display: 'block', fontWeight: 500 }}>bei Ihnen ({zonenOrt(zone)}): {platzBei}–{bei(platz.ende) ?? platz.ende.slice(11, 16)}</span> : null}</div> : <div style={klein}>Bitte zuerst eine Uhrzeit wählen.</div>}
              <label style={label}>Name *<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" required style={feld} /></label>
              <label style={label}>E-Mail *<input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={160} autoComplete="email" required style={feld} /></label>
              {s.fragen.firma && <label style={label}>Firma<input value={firma} onChange={e => setFirma(e.target.value)} maxLength={160} autoComplete="organization" style={feld} /></label>}
              {s.fragen.anliegen && <label style={label}>Worum geht es?<textarea value={anliegen} onChange={e => setAnliegen(e.target.value)} maxLength={1000} rows={3} style={{ ...feld, resize: 'vertical' }} /></label>}
              {/* Honigtopf: für Menschen unsichtbar, nicht per Tab erreichbar. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
                <label>Webseite<input tabIndex={-1} autoComplete="off" value={falle} onChange={e => setFalle(e.target.value)} name="webseite" /></label>
              </div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: C.ink, lineHeight: 1.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={ja} onChange={e => setJa(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, flex: '0 0 auto', accentColor: AKZENT }} />
                <span>{s.einwilligung.wortlaut} <span style={klein}>(Pflicht · Fassung {s.einwilligung.version} · Hinweise oben)</span></span>
              </label>
              {fehler && <div role="alert" style={{ color: C.achtung, fontSize: 14 }}>{fehler}</div>}
              {/* Hinweis direkt vor dem Absenden (05.10., Art. 13): was mit den Angaben geschieht, und wo es vollständig steht. */}
              <p style={{ ...klein, margin: 0 }}>Mit „Termin anfragen“ übermitteln Sie Name, E-Mail{s.fragen.firma ? ', Firma' : ''}{s.fragen.anliegen ? ' und Ihr Anliegen' : ''} an {s.verantwortlich ? s.verantwortlich.split(',')[0] : 'uns'} — nur zur Bearbeitung Ihrer Terminanfrage.{s.datenschutzLink ? <> Mehr im <a href={s.datenschutzLink} target="_blank" rel="noopener noreferrer" style={{ color: AKZENT }}>Datenschutzhinweis</a>.</> : ' Mehr in den Hinweisen oben.'}</p>
              <button onClick={() => void buchen()} disabled={!bereit} aria-busy={sendet} style={knopf(bereit)}>{sendet ? 'Wird reserviert …' : 'Termin anfragen'}</button>
              <p style={{ ...klein, margin: 0 }}>Der Platz wird 30 Minuten für Sie reserviert. Auf der nächsten Seite bestätigen Sie die Anfrage; danach bestätigen wir den Termin persönlich.</p>
            </div>
          </section>
        </div>
      </div>
      <style>{'@media (min-width: 760px) { .buchen-raster { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }'}</style>
    </main>
  );
}
