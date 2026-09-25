'use client';

// ─── MAKE OS — Der Freigabe-Stapel (voll) ───────────────────────────────────
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
//
// 24.09.: auf das lebendige Muster umgezogen — Karten mit Tiefe, leuchtende
// Zustandsfarben, große Zahl statt Held. Gleiche Funktion, gleiche Wege.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Zahl, Fortschritt, feld, LEUCHT } from './schlank';

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
  kunden: { href: '/os/markttraktion?s=sales&a=kunden', label: 'Markttraktion' },
  planer: { href: '/os/planung/woche', label: 'Wochenplaner' },
  inbox: { href: '/os/inbox', label: 'Postfach' },
  gesundheit: { href: '/os/gesundheit', label: 'Gesundheit' },
};

const GRUPPE_LABEL: Record<string, string> = {
  finanzen: 'Geld', meilensteine: 'Meilensteine', fokus: 'Fokus & Ziele',
  aufgaben: 'Aufgaben', kunden: 'Kunden', planer: 'Planung', inbox: 'Postfach', gesundheit: 'Gesundheit',
};

/** Eine Farbe je Gruppe — dieselben wie im schlanken Stapel. */
const GRUPPE_FARBE: Record<string, string> = {
  finanzen: LEUCHT.geld, meilensteine: LEUCHT.schlaf, fokus: LEUCHT.schlaf, aufgaben: LEUCHT.achtung,
  kunden: LEUCHT.business, planer: LEUCHT.puls, inbox: LEUCHT.puls, gesundheit: LEUCHT.gut,
};

const AUFTRAG_STATUS: Record<Auftrag['status'], { label: string; farbe: string }> = {
  offen: { label: 'wartet', farbe: C.inkLeise }, laeuft: { label: 'läuft …', farbe: LEUCHT.puls },
  fertig: { label: 'fertig', farbe: LEUCHT.gut }, fehler: { label: 'fehlgeschlagen', farbe: LEUCHT.kritisch },
};

const HAAR = 'rgba(255,255,255,.07)';
const uhr = (iso: string) => { try { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** Leiser Textknopf in einer Zeile — „vergessen", wie im schlanken Stapel. */
const textKnopf: React.CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 };
const zahlStil: React.CSSProperties = { fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', fontSize: TYP.body };

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

  const laufen = auftraege.filter(a => a.status === 'laeuft').length;
  const warten = auftraege.filter(a => a.status === 'offen').length;
  // Karten erscheinen gestaffelt — der Zähler vergibt die Reihenfolge.
  let n = 0;

  return (
    <Seite titel="Aufträge & Freigaben · voll" unter="Alles, was Jarvis vorbereitet hat — mit Protokoll, Rückgängig und Feldern zum Ändern."
      rechts={<Link href="/os/stapel" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Schlanker Stapel ›</Link>}>

      {/* ── Der Kopf: die eine Zahl, der Satz dazu, der große Knopf ── */}
      <Karte i={n++} akzent={laedt ? undefined : offen.length ? LEUCHT.achtung : LEUCHT.gut}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <Zahl gross wert={laedt || offen.length === 0 ? undefined : String(offen.length)}
            label={laedt ? 'lädt …' : offen.length === 0 ? 'nichts offen' : offen.length === 1 ? 'Vorschlag offen' : 'Vorschläge offen'}
            farbe={offen.length > 8 ? LEUCHT.achtung : C.ink} />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <p style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', color: C.ink, margin: 0, lineHeight: 1.35 }}>
              {laedt ? 'lädt …' : offen.length === 0
                ? <>Nichts wartet auf dich. Jarvis hat alles erledigt, was er allein darf.</>
                : <>Alles hier ist <b style={{ color: LEUCHT.achtung }}>vorbereitet, aber nicht ausgeführt</b> — Geld, Ziele und Kompass gehen nie ohne dich.</>}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
              <Chip farbe={gruppen.length ? LEUCHT.achtung : C.inkLeise}>{gruppen.length} {gruppen.length === 1 ? 'Gruppe' : 'Gruppen'}</Chip>
              <Chip farbe={C.inkDim}>{erledigt.length} zuletzt entschieden</Chip>
              {offen.length > 1 && (
                <Knopf onClick={() => durcharbeiten()} aus={busy !== null}>
                  {busy === 'alle' ? 'arbeitet durch …' : `Alle ${offen.length} durcharbeiten`}
                </Knopf>
              )}
            </div>
          </div>
        </div>
      </Karte>

      {meldung && <div style={{ fontSize: TYP.bedien, color: C.aktiv, padding: '0 2px' }}>{meldung}</div>}

      {/* ── Was gerade läuft ────────────────────────────────────────────
          Nur sichtbar, wenn wirklich etwas läuft oder gerade fertig wurde.
          Eine ruhige Seite, wenn nichts los ist. */}
      {(inArbeit.length > 0 || frischFertig.length > 0) && (
        <Karte i={n++} akzent={inArbeit.length ? LEUCHT.puls : undefined}>
          <Ueberschrift farbe={inArbeit.length ? LEUCHT.puls : C.inkLeise}
            rechts={inArbeit.length > 0 ? `${laufen} laufen gleichzeitig${warten > 0 ? `, ${warten} warten` : ''}` : undefined}>
            Im Hintergrund
          </Ueberschrift>
          <Liste>
            {[...inArbeit, ...frischFertig].slice(0, 24).map(a => {
              const s = AUFTRAG_STATUS[a.status];
              return (
                <div key={a.id} title={a.ergebnis ?? a.fehler ?? a.auftrag ?? ''}>
                  <Zeile links={<Punkt farbe={s.farbe} />} titel={a.name}
                    unter={a.status === 'fertig' && a.ergebnis ? a.ergebnis.slice(0, 110) : a.fehler ?? a.auftrag}
                    rechts={<Chip farbe={s.farbe}>{s.label}</Chip>} />
                </div>
              );
            })}
          </Liste>
        </Karte>
      )}

      {/* ── Offene Vorschläge, je Gruppe eine Karte ── */}
      {gruppen.map(g => {
        const drin = offen.filter(v => v.gruppe === g);
        const farbe = GRUPPE_FARBE[g] ?? C.inkLeise;
        return (
          <Karte key={g} i={n++} akzent={LEUCHT.achtung}>
            <Ueberschrift farbe={farbe} rechts={<>
              <span>{drin.length}</span>
              {drin.length > 1 && (
                <Knopf leise onClick={() => durcharbeiten(g)} aus={busy !== null}>
                  {busy === g ? 'läuft …' : 'Gruppe durcharbeiten'}
                </Knopf>
              )}
            </>}>
              {GRUPPE_LABEL[g] ?? g}
            </Ueberschrift>

            {drin.map((v, idx) => {
              const felder = aendern[v.id];
              return (
                <div key={v.id} style={{ padding: '12px 2px 16px', borderBottom: idx < drin.length - 1 ? `1px solid ${HAAR}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', color: C.ink }}>{v.titel}</span>
                    <span style={{ fontSize: 12, color: C.inkLeise }}>{uhr(v.zeit)}</span>
                  </div>

                  {/* Vorher → Nachher: aus demselben Lesevorgang wie die Ausführung */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
                    {v.vorher && <span style={{ ...zahlStil, color: C.inkLeise, textDecoration: 'line-through' }}>{v.vorher}</span>}
                    {v.vorher && <span style={{ color: C.inkLeise }}>→</span>}
                    <span style={{ ...zahlStil, fontWeight: 600, color: C.ink }}>{v.nachher}</span>
                  </div>

                  {v.anlass && (
                    <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 10, lineHeight: 1.5 }}>
                      {/* Kam der Vorschlag aus einem Lauf, ist der Anlass
                          Jarvis' Herleitung — nicht Kevins Satz. „Weil du
                          gesagt hast" wäre dann schlicht falsch. */}
                      {v.quelle === 'lauf' ? `Jarvis: ${v.anlass}` : `weil du gesagt hast: „${v.anlass}"`}
                    </div>
                  )}

                  {/* Ändern und freigeben — die Felder, die das Werkzeug bekommt */}
                  {felder && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 10 }}>
                      {Object.entries(felder).map(([k, wert]) => (
                        <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>{k}</span>
                          <input value={wert} onChange={e => setAendern(a => ({ ...a, [v.id]: { ...a[v.id], [k]: e.target.value } }))} style={feld} />
                        </label>
                      ))}
                    </div>
                  )}

                  {ablehnen[v.id] !== undefined && (
                    <input value={ablehnen[v.id]} autoFocus placeholder="Warum nicht? Jarvis liest das."
                      onChange={e => setAblehnen(a => ({ ...a, [v.id]: e.target.value }))}
                      style={{ ...feld, marginBottom: 10 }} />
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Knopf onClick={() => entscheide(v, 'freigeben')} aus={busy !== null} farbe={LEUCHT.gut}>
                      {busy === v.id ? '…' : felder ? '✓ Ändern und freigeben' : '✓ Freigeben'}
                    </Knopf>
                    {!felder && (
                      <Knopf leise onClick={() => setAendern(a => ({ ...a, [v.id]: Object.fromEntries(Object.entries(v.eingabe).map(([k, w]) => [k, String(w ?? '')])) }))}
                        aus={busy !== null}>Ändern</Knopf>
                    )}
                    <Knopf leise onClick={() => ablehnen[v.id] === undefined ? setAblehnen(a => ({ ...a, [v.id]: '' })) : entscheide(v, 'ablehnen')}
                      aus={busy !== null}>
                      {ablehnen[v.id] === undefined ? 'Ablehnen' : 'Ablehnung abschicken'}
                    </Knopf>
                    {SELBST[v.gruppe] && (
                      <Link href={SELBST[v.gruppe].href} style={{ marginLeft: 'auto', fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Selbst machen — {SELBST[v.gruppe].label} ›
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </Karte>
        );
      })}

      {/* ── Das Gehirn und was es kostet — nebeneinander, wo Platz ist ── */}
      {(gehirn || (kosten && kosten.summeCent > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {/* Das Gehirn: woraus er sein Wissen zieht */}
          {gehirn && (
            <Karte i={n++}>
              <Ueberschrift farbe={LEUCHT.agenten}>Sein Gehirn</Ueberschrift>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <Zahl wert={gehirn.notizen ? String(gehirn.notizen) : undefined} label="Notizen durchsuchbar" farbe={LEUCHT.agenten} />
                <Zahl wert={gehirn.dubletten ? String(gehirn.dubletten) : undefined} label="Kopien übersprungen" />
                <Zahl wert={gehirn.privatUebersprungen ? String(gehirn.privatUebersprungen) : undefined} label="private Pfade zu" />
              </div>
              <Leer>Aus deinem Obsidian-Brain (Nummer eins) und der MAKE-OS-Doku. Malins private Ordner werden gar nicht erst geöffnet.</Leer>
            </Karte>
          )}

          {/* Was das kostet — damit Kevin nach vier Wochen weiß, welcher Agent
              die Rechnung treibt, und nicht aus Unsicherheit alles abschaltet. */}
          {kosten && kosten.summeCent > 0 && (
            <Karte i={n++}>
              <Ueberschrift farbe={LEUCHT.geld}>Was die KI kostet</Ueberschrift>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <Zahl wert={kosten.heuteCent ? `${(kosten.heuteCent / 100).toFixed(2)} $` : undefined} label="heute" farbe={LEUCHT.geld} />
                <Zahl wert={`${(kosten.summeCent / 100).toFixed(2)} $`} label="in 30 Tagen" />
              </div>
              {kosten.jeZweck.slice(0, 3).map(z => (
                <div key={z.zweck} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,130px) 1fr auto', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <span style={{ fontSize: 12.5, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.zweck}</span>
                  <Fortschritt anteil={z.cent / Math.max(kosten.jeZweck[0]?.cent ?? 1, 1)} farbe={LEUCHT.geld} />
                  <span style={{ fontFamily: SCHRIFT.display, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: C.inkDim, textAlign: 'right', whiteSpace: 'nowrap' }}>{(z.cent / 100).toFixed(2)} $ · {z.anzahl}×</span>
                </div>
              ))}
            </Karte>
          )}
        </div>
      )}

      {/* ── Was Jarvis sich gemerkt hat ──────────────────────────────────
          Kevins Bedingung: sofort merken, dafür sichtbar und löschbar. */}
      {fakten.length > 0 && (
        <Karte i={n++}>
          <Ueberschrift farbe={LEUCHT.agenten} rechts={`${fakten.length}`}>Was Jarvis sich gemerkt hat</Ueberschrift>
          <Liste>
            {fakten.slice(0, 40).map(f => (
              <div key={f.id} title={f.satz}>
                <Zeile titel={f.satz} unter={`${f.art} · ${f.thema}`}
                  rechts={<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {f.bis && <Chip farbe={LEUCHT.achtung}>bis {f.bis}</Chip>}
                    <button onClick={() => vergiss(f.id)} disabled={busy !== null} title="Stimmt nicht — vergessen" style={textKnopf}>vergessen</button>
                  </span>} />
              </div>
            ))}
          </Liste>
        </Karte>
      )}

      {/* ── Was Jarvis von allein getan hat ── */}
      <Karte i={n++}>
        <Ueberschrift farbe={protokoll.length ? LEUCHT.schlaf : C.inkLeise} rechts={protokoll.length ? `${protokoll.length}` : undefined}>Was Jarvis getan hat</Ueberschrift>
        {!protokoll.length ? (
          <Leer>Noch nichts protokolliert.</Leer>
        ) : (
          <Liste>
            {protokoll.map(e => (
              // Nur die erste Zeile: eine gelesene Notiz bringt sonst
              // 600 Zeichen mit und das Protokoll wird unlesbar. Der Rest im Tooltip.
              <div key={e.id} title={e.ergebnis}>
                <Zeile links={<Punkt farbe={e.ok ? LEUCHT.gut : LEUCHT.kritisch} />}
                  titel={e.ergebnis.split('\n')[0].slice(0, 150)}
                  unter={`${uhr(e.zeit)} · ${e.quelle === 'stapel' ? 'nach Freigabe' : 'von allein'}`}
                  rechts={e.zurueckgenommenAm
                    ? <Chip farbe={C.inkLeise}>zurückgenommen</Chip>
                    : e.ruecknahme
                      ? <Knopf leise onClick={() => zurueck(e.id)} aus={busy !== null}>↺ {e.ruecknahme.text}</Knopf>
                      : null} />
              </div>
            ))}
          </Liste>
        )}
      </Karte>
    </Seite>
  );
}
