'use client';

// ─── MAKE OS — Der Freigabe-Stapel ──────────────────────────────────────────
// Baustein 2 (07.09.). Kevins Vorgabe vom 06.09.: gebündelt, morgens und
// abends — nicht als Unterbrechung. Deshalb sammelt Jarvis, und hier wird
// entschieden.
//
// Vier Antworten, nicht zwei: freigeben · ändern und freigeben · ablehnen mit
// Grund (Jarvis liest den Grund) · selbst machen. Dazu „Alles durcharbeiten"
// je Gruppe — Kevins eigener Wunsch: einmal freigeben, dann läuft es durch.
//
// Darunter das Protokoll: was Jarvis von allein getan hat, und der Knopf, um
// es zurückzunehmen.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS, MIKRO, ZIFFERN } from '@/lib/make-one/design';
import { Held } from './Held';

interface Vorschlag {
  id: string; zeit: string; werkzeug: string; gruppe: string;
  titel: string; vorher?: string; nachher: string;
  eingabe: Record<string, unknown>; anlass?: string;
  status: 'offen' | 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen';
  ergebnis?: string; grund?: string; quelle?: 'gespraech' | 'lauf';
}
interface Fakt {
  id: string; tag: string; art: string; thema: string; satz: string; woher?: string; bis?: string;
}
interface Auftrag {
  id: string; zeit: string; art: 'werkzeug' | 'agent'; name: string;
  auftrag?: string; status: 'offen' | 'laeuft' | 'fertig' | 'fehler';
  versuche: number; ergebnis?: string; fehler?: string; begonnen?: string;
}
interface Eintrag {
  id: string; zeit: string; werkzeug: string; gruppe: string; risiko: string;
  ergebnis: string; ok: boolean; quelle: 'jarvis' | 'stapel';
  ruecknahme?: { text: string } | null; zurueckgenommenAm?: string;
}

/** Wohin man geht, wenn man es lieber selbst macht. */
const SELBST: Record<string, { href: string; label: string }> = {
  finanzen: { href: '/os/finanzen', label: 'Finanzen' },
  meilensteine: { href: '/os/roadmap', label: 'Roadmap' },
  fokus: { href: '/os/fokus', label: 'Fokus' },
  aufgaben: { href: '/os/aufgaben', label: 'Aufgaben' },
  kunden: { href: '/os/crm', label: 'CRM' },
  planer: { href: '/os/planung/woche', label: 'Wochenplaner' },
  inbox: { href: '/os/inbox', label: 'Postfach' },
  gesundheit: { href: '/os/gesundheit', label: 'Gesundheit' },
};

const GRUPPE_LABEL: Record<string, string> = {
  finanzen: 'Geld', meilensteine: 'Meilensteine', fokus: 'Fokus & Ziele',
  aufgaben: 'Aufgaben', kunden: 'Kunden', planer: 'Planung', inbox: 'Postfach', gesundheit: 'Gesundheit',
};

const uhr = (iso: string) => { try { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

const knopf = (art: 'stark' | 'ruhig' | 'weg'): React.CSSProperties => ({
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600,
  minHeight: 34, padding: `0 ${A.l}px`, borderRadius: RADIUS.bauteil, cursor: 'pointer',
  border: `1px solid ${art === 'stark' ? C.gut : art === 'weg' ? C.linie : C.linie}`,
  background: art === 'stark' ? C.gut : 'transparent',
  color: art === 'stark' ? C.grund : art === 'weg' ? C.inkLeise : C.inkDim,
});

export function StapelView() {
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [protokoll, setProtokoll] = useState<Eintrag[]>([]);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [fakten, setFakten] = useState<Fakt[]>([]);
  const [gehirn, setGehirn] = useState<{ notizen: number; dubletten: number; privatUebersprungen: number } | null>(null);
  const [kosten, setKosten] = useState<{ heuteCent: number; summeCent: number; jeZweck: { zweck: string; cent: number; anzahl: number }[] } | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [aendern, setAendern] = useState<Record<string, Record<string, string>>>({});
  const [ablehnen, setAblehnen] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState('');

  const laden = useCallback(async () => {
    try {
      const [s, p, a, g] = await Promise.all([
        fetch('/api/jarvis/stapel?alle=1').then(r => r.json()),
        fetch('/api/jarvis/protokoll?anzahl=40').then(r => r.json()),
        fetch('/api/jarvis/auftraege').then(r => r.json()),
        fetch('/api/jarvis/gedaechtnis').then(r => r.json()),
      ]) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
      setVorschlaege(Array.isArray(s.vorschlaege) ? (s.vorschlaege as Vorschlag[]) : []);
      setProtokoll(Array.isArray(p.eintraege) ? (p.eintraege as Eintrag[]) : []);
      setAuftraege(Array.isArray(a.auftraege) ? (a.auftraege as Auftrag[]) : []);
      setFakten(Array.isArray(g.fakten) ? (g.fakten as Fakt[]) : []);
    } catch { /* offline — der alte Stand bleibt stehen */ }
    setLaedt(false);
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  // Der Stand des Gehirns — einmal beim Öffnen, er ändert sich selten.
  useEffect(() => {
    fetch('/api/jarvis/wissen').then(r => r.json()).then(d => { if (d.ok) setGehirn(d); }).catch(() => {});
    fetch('/api/jarvis/verbrauch').then(r => r.json()).then(d => { if (d.ok) setKosten(d); }).catch(() => {});
  }, []);

  // Solange Aufträge laufen, kurz getaktet nachsehen — das ist der Moment,
  // den Kevin sehen wollte. Danach hört das Nachfragen von selbst auf.
  const inArbeit = auftraege.filter(a => a.status === 'laeuft' || a.status === 'offen');
  useEffect(() => {
    if (!inArbeit.length) return;
    const iv = setInterval(() => { void laden(); }, 3000);
    return () => clearInterval(iv);
  }, [inArbeit.length, laden]);

  // „Frisch fertig" heißt: in den letzten zehn Minuten beendet. Ältere Läufe
  // stehen im Protokoll, nicht hier.
  const frischFertig = auftraege.filter(a => (a.status === 'fertig' || a.status === 'fehler')
    && Date.now() - Date.parse(a.zeit) < 10 * 60_000);
  const offen = vorschlaege.filter(v => v.status === 'offen');
  const erledigt = vorschlaege.filter(v => v.status !== 'offen').slice(0, 12);
  const gruppen = Array.from(new Set(offen.map(v => v.gruppe)));

  async function entscheide(v: Vorschlag, entscheidung: 'freigeben' | 'ablehnen') {
    setBusy(v.id);
    // Geänderte Felder zurück in die Form bringen, die das Werkzeug erwartet:
    // was vorher eine Zahl war, bleibt eine Zahl.
    const roh = aendern[v.id];
    const eingabe = roh
      ? Object.fromEntries(Object.entries(roh).map(([k, wert]) => {
          const alt = v.eingabe[k];
          return [k, typeof alt === 'number' && wert.trim() !== '' && isFinite(Number(wert)) ? Number(wert) : wert];
        }))
      : undefined;
    try {
      const r = await fetch('/api/jarvis/stapel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id, entscheidung, ...(eingabe ? { eingabe } : {}), ...(ablehnen[v.id] ? { grund: ablehnen[v.id] } : {}) }),
      });
      const d = await r.json();
      setMeldung(d.ergebnis ?? (entscheidung === 'ablehnen' ? 'Abgelehnt.' : d.error ?? ''));
    } catch { setMeldung('Nicht erreichbar.'); }
    setBusy(null);
    void laden();
  }

  async function durcharbeiten(gruppe?: string) {
    setBusy(gruppe ?? 'alle');
    try {
      const r = await fetch('/api/jarvis/stapel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alle: true, ...(gruppe ? { gruppe } : {}) }),
      });
      const d = await r.json();
      setMeldung(`${d.erledigt ?? 0} erledigt.`);
    } catch { setMeldung('Nicht erreichbar.'); }
    setBusy(null);
    void laden();
  }

  async function vergiss(id: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/jarvis/gedaechtnis?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const d = await r.json();
      setMeldung(d.ok ? 'Vergessen.' : d.error ?? 'Ging nicht.');
    } catch { setMeldung('Nicht erreichbar.'); }
    setBusy(null);
    void laden();
  }

  async function zurueck(id: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/jarvis/protokoll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const d = await r.json();
      setMeldung(d.ok ? 'Zurückgenommen.' : d.error ?? 'Ging nicht.');
    } catch { setMeldung('Nicht erreichbar.'); }
    setBusy(null);
    void laden();
  }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>

        <Held
          wert={String(offen.length)}
          label={offen.length === 1 ? 'Vorschlag offen' : 'Vorschläge offen'}
          farbe={offen.length === 0 ? C.gut : offen.length > 8 ? C.achtung : C.ink}
          satz={laedt ? 'lädt …' : offen.length === 0
            ? <>Nichts wartet auf dich. Jarvis hat alles erledigt, was er allein darf.</>
            : <>Alles hier ist <b style={{ color: C.achtung }}>vorbereitet, aber nicht ausgeführt</b> — Geld, Ziele und Kompass gehen nie ohne dich.</>}
          neben={[
            { label: 'Gruppen', wert: String(gruppen.length) },
            { label: 'zuletzt entschieden', wert: String(erledigt.length) },
          ]}
          kinder={offen.length > 1 ? (
            <button onClick={() => durcharbeiten()} disabled={busy !== null} style={{ ...knopf('stark'), minHeight: 36 }}>
              {busy === 'alle' ? 'arbeitet durch …' : `Alle ${offen.length} durcharbeiten`}
            </button>
          ) : undefined}
        />

        {meldung && (
          <div style={{ background: C.aktivSanft, border: `1px solid ${C.aktiv}44`, borderRadius: RADIUS.bauteil, padding: `${A.m}px ${A.l}px`, fontSize: TYP.bedien, color: C.aktiv, marginBottom: A.l }}>
            {meldung}
          </div>
        )}

        {/* ── Was gerade läuft ────────────────────────────────────────────
            Nur sichtbar, wenn wirklich etwas läuft oder gerade fertig wurde.
            Eine ruhige Seite, wenn nichts los ist. */}
        {(inArbeit.length > 0 || frischFertig.length > 0) && (
          <section style={{ marginBottom: A.xl }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, marginBottom: A.m, flexWrap: 'wrap' }}>
              <span style={MIKRO}>Im Hintergrund</span>
              {inArbeit.length > 0 && (
                <span style={{ fontSize: TYP.bedien, color: C.aktiv }}>
                  {auftraege.filter(a => a.status === 'laeuft').length} laufen gleichzeitig
                  {auftraege.filter(a => a.status === 'offen').length > 0 && `, ${auftraege.filter(a => a.status === 'offen').length} warten` }
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: A.s }}>
              {[...inArbeit, ...frischFertig].slice(0, 24).map(a => {
                const farbe = a.status === 'laeuft' ? C.aktiv : a.status === 'fehler' ? C.kritisch : a.status === 'fertig' ? C.gut : C.inkLeise;
                return (
                  <div key={a.id} title={a.ergebnis ?? a.fehler ?? a.auftrag ?? ''}
                    style={{ background: T.panel, border: `1px solid ${a.status === 'laeuft' ? C.aktiv : C.linie}`, borderRadius: RADIUS.bauteil, padding: `${A.m}px ${A.l}px`, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: A.s }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: farbe, flex: '0 0 auto' }} />
                      <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: farbe, marginTop: 3 }}>
                      {a.status === 'laeuft' ? 'läuft …' : a.status === 'offen' ? 'wartet' : a.status === 'fehler' ? 'fehlgeschlagen' : 'fertig'}
                    </div>
                    {a.status === 'fertig' && a.ergebnis && (
                      <div style={{ fontSize: TYP.mikro, color: C.inkLeise, marginTop: 4, lineHeight: 1.4, maxHeight: 46, overflow: 'hidden' }}>
                        {a.ergebnis.slice(0, 110)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {gruppen.map(g => {
          const drin = offen.filter(v => v.gruppe === g);
          return (
            <section key={g} style={{ marginBottom: A.xl }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, marginBottom: A.m, flexWrap: 'wrap' }}>
                <span style={MIKRO}>{GRUPPE_LABEL[g] ?? g}</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{drin.length}</span>
                {drin.length > 1 && (
                  <button onClick={() => durcharbeiten(g)} disabled={busy !== null}
                    style={{ ...knopf('ruhig'), marginLeft: 'auto', minHeight: 30, fontSize: TYP.mikro }}>
                    {busy === g ? 'läuft …' : 'Gruppe durcharbeiten'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: A.m }}>
                {drin.map(v => {
                  const felder = aendern[v.id];
                  return (
                    <div key={v.id} style={{ background: T.panel, border: `1px solid ${C.linie}`, borderLeft: `3px solid ${C.achtung}`, borderRadius: RADIUS.behaelter, padding: `${A.l}px ${A.xl}px` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, color: C.ink }}>{v.titel}</span>
                        <span style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: C.inkLeise }}>{uhr(v.zeit)}</span>
                      </div>

                      {/* Vorher → Nachher: aus demselben Lesevorgang wie die Ausführung */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: A.m, flexWrap: 'wrap', margin: `${A.m}px 0` }}>
                        {v.vorher && <span style={{ ...ZIFFERN, fontSize: TYP.body, color: C.inkLeise, textDecoration: 'line-through' }}>{v.vorher}</span>}
                        {v.vorher && <span style={{ color: C.inkLeise }}>→</span>}
                        <span style={{ ...ZIFFERN, fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{v.nachher}</span>
                      </div>

                      {v.anlass && (
                        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: A.m }}>
                          {/* Kam der Vorschlag aus einem Lauf, ist der Anlass
                              Jarvis' Herleitung — nicht Kevins Satz. „Weil du
                              gesagt hast" wäre dann schlicht falsch. */}
                          {v.quelle === 'lauf' ? `Jarvis: ${v.anlass}` : `weil du gesagt hast: „${v.anlass}"`}
                        </div>
                      )}

                      {/* Ändern und freigeben — die Felder, die das Werkzeug bekommt */}
                      {felder && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: A.s, marginBottom: A.m }}>
                          {Object.entries(felder).map(([k, wert]) => (
                            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={MIKRO}>{k}</span>
                              <input value={wert} onChange={e => setAendern(a => ({ ...a, [v.id]: { ...a[v.id], [k]: e.target.value } }))}
                                style={{ background: C.grund, border: `1px solid ${C.linie}`, borderRadius: RADIUS.bauteil, padding: '7px 10px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, outline: 'none' }} />
                            </label>
                          ))}
                        </div>
                      )}

                      {ablehnen[v.id] !== undefined && (
                        <input value={ablehnen[v.id]} autoFocus placeholder="Warum nicht? Jarvis liest das."
                          onChange={e => setAblehnen(a => ({ ...a, [v.id]: e.target.value }))}
                          style={{ width: '100%', background: C.grund, border: `1px solid ${C.linie}`, borderRadius: RADIUS.bauteil, padding: '8px 11px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, outline: 'none', marginBottom: A.m }} />
                      )}

                      <div style={{ display: 'flex', gap: A.s, flexWrap: 'wrap' }}>
                        <button onClick={() => entscheide(v, 'freigeben')} disabled={busy !== null} style={knopf('stark')}>
                          {busy === v.id ? '…' : felder ? '✓ Ändern und freigeben' : '✓ Freigeben'}
                        </button>
                        {!felder && (
                          <button onClick={() => setAendern(a => ({ ...a, [v.id]: Object.fromEntries(Object.entries(v.eingabe).map(([k, w]) => [k, String(w ?? '')])) }))}
                            disabled={busy !== null} style={knopf('ruhig')}>Ändern</button>
                        )}
                        <button onClick={() => ablehnen[v.id] === undefined ? setAblehnen(a => ({ ...a, [v.id]: '' })) : entscheide(v, 'ablehnen')}
                          disabled={busy !== null} style={knopf('weg')}>
                          {ablehnen[v.id] === undefined ? 'Ablehnen' : 'Ablehnung abschicken'}
                        </button>
                        {SELBST[v.gruppe] && (
                          <Link href={SELBST[v.gruppe].href} style={{ ...knopf('weg'), display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginLeft: 'auto' }}>
                            Selbst machen — {SELBST[v.gruppe].label} ›
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* ── Das Gehirn: woraus er sein Wissen zieht ── */}
        {gehirn && (
          <section style={{ marginTop: A.xxl }}>
            <div style={{ ...MIKRO, marginBottom: A.s }}>Sein Gehirn</div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
              <b style={{ color: C.ink }}>{gehirn.notizen} Notizen</b> aus deinen drei Vaults durchsuchbar.
              {' '}{gehirn.dubletten} Kopien übersprungen, {gehirn.privatUebersprungen} private Pfade gar nicht erst geöffnet.
            </div>
          </section>
        )}

        {/* ── Was das kostet ────────────────────────────────────────────────
            Damit Kevin nach vier Wochen weiß, welcher Agent die Rechnung
            treibt — und nicht aus Unsicherheit alles abschaltet. */}
        {kosten && kosten.summeCent > 0 && (
          <section style={{ marginTop: A.xl }}>
            <div style={{ ...MIKRO, marginBottom: A.s }}>Was die KI kostet</div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
              Heute <b style={{ ...ZIFFERN, color: C.ink }}>{(kosten.heuteCent / 100).toFixed(2)} $</b>,
              in 30 Tagen <b style={{ ...ZIFFERN, color: C.ink }}>{(kosten.summeCent / 100).toFixed(2)} $</b>.
              {kosten.jeZweck.length > 0 && (
                <> Am meisten: {kosten.jeZweck.slice(0, 3).map(z => `${z.zweck} (${(z.cent / 100).toFixed(2)} $, ${z.anzahl}×)`).join(' · ')}.</>
              )}
            </div>
          </section>
        )}

        {/* ── Was Jarvis sich gemerkt hat ──────────────────────────────────
            Kevins Bedingung: sofort merken, dafür sichtbar und löschbar. */}
        {fakten.length > 0 && (
          <section style={{ marginTop: A.xxl }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, marginBottom: A.m }}>
              <span style={MIKRO}>Was Jarvis sich gemerkt hat</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{fakten.length}</span>
            </div>
            <div style={{ background: T.panel, border: `1px solid ${C.linie}`, borderRadius: RADIUS.behaelter, overflow: 'hidden' }}>
              {fakten.slice(0, 40).map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: A.m, padding: `${A.m}px ${A.l}px`, borderTop: i ? `1px solid ${C.linieWeich}` : 'none', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: C.inkLeise, width: 78, flex: '0 0 auto' }}>{f.art}</span>
                  <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink, flex: '0 0 auto' }}>{f.thema}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim, flex: 1, minWidth: 160 }}>{f.satz}</span>
                  {f.bis && <span style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: C.achtung }}>bis {f.bis}</span>}
                  <button onClick={() => vergiss(f.id)} disabled={busy !== null} title="Stimmt nicht — vergessen"
                    style={{ ...knopf('weg'), minHeight: 28, fontSize: TYP.mikro }}>vergessen</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Was Jarvis von allein getan hat ── */}
        <section style={{ marginTop: A.xxl }}>
          <div style={{ ...MIKRO, marginBottom: A.m }}>Was Jarvis getan hat</div>
          {!protokoll.length ? (
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch nichts protokolliert.</div>
          ) : (
            <div style={{ background: T.panel, border: `1px solid ${C.linie}`, borderRadius: RADIUS.behaelter, overflow: 'hidden' }}>
              {protokoll.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: A.m, padding: `${A.m}px ${A.l}px`, borderTop: i ? `1px solid ${C.linieWeich}` : 'none', flexWrap: 'wrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: e.ok ? C.gut : C.kritisch, flex: '0 0 auto' }} />
                  <span style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: C.inkLeise, width: 44, flex: '0 0 auto' }}>{uhr(e.zeit)}</span>
                  {/* Nur die erste Zeile: eine gelesene Notiz bringt sonst
                      600 Zeichen mit und das Protokoll wird unlesbar. */}
                  <span title={e.ergebnis} style={{ fontSize: TYP.bedien, color: C.inkDim, flex: 1, minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.ergebnis.split('\n')[0].slice(0, 150)}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: C.inkLeise, flex: '0 0 auto' }}>
                    {e.quelle === 'stapel' ? 'nach Freigabe' : 'von allein'}
                  </span>
                  {e.zurueckgenommenAm
                    ? <span style={{ fontFamily: T.mono, fontSize: TYP.mikro, color: C.inkLeise }}>zurückgenommen</span>
                    : e.ruecknahme
                      ? <button onClick={() => zurueck(e.id)} disabled={busy !== null} style={{ ...knopf('weg'), minHeight: 28, fontSize: TYP.mikro }}>↺ {e.ruecknahme.text}</button>
                      : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
