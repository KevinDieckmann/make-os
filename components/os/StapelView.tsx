'use client';

// ─── MAKE OS — Aufträge & Freigaben (der Stapel) ────────────────────────────
// Was Jarvis vorbereitet hat und auf dein Ja wartet. Seit 24.09. im
// lebendigen Muster: offene Vorschläge je Gruppe mit Freigeben/Ablehnen,
// zuletzt Entschiedenes, der Arbeiter mit seinen Aufträgen, Gedächtnis und
// Verbrauch. Protokoll, Rückgängig und Felder-Ändern: /os/stapel/voll.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Zahl, Fortschritt, feld, LEUCHT, Spalten, Spalte } from './schlank';

interface Vorschlag { id: string; zeit: string; werkzeug: string; gruppe: string; titel: string; vorher?: string; nachher: string; eingabe: Record<string, unknown>; anlass?: string; status: 'offen' | 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen'; ergebnis?: string; grund?: string }
interface Auftrag { id: string; zeit: string; art: string; name: string; auftrag?: string; status: 'offen' | 'laeuft' | 'fertig' | 'fehler'; ergebnis?: string; fehler?: string }
interface Fakt { id: string; tag: string; art: string; thema: string; satz: string }
interface Kosten { heuteCent: number; summeCent: number; jeZweck: { zweck: string; cent: number; anzahl: number }[] }

const GRUPPE: Record<string, { label: string; href: string; farbe: string }> = {
  finanzen: { label: 'Geld', href: '/os/finanzen', farbe: LEUCHT.geld }, meilensteine: { label: 'Meilensteine', href: '/os/roadmap', farbe: LEUCHT.schlaf },
  fokus: { label: 'Fokus & Ziele', href: '/os/wachstum', farbe: LEUCHT.schlaf }, aufgaben: { label: 'Aufgaben', href: '/os/aufgaben', farbe: LEUCHT.achtung },
  kunden: { label: 'Kunden', href: '/os/crm', farbe: LEUCHT.business }, planer: { label: 'Planung', href: '/os/planung/woche', farbe: LEUCHT.puls },
  inbox: { label: 'Postfach', href: '/os/inbox', farbe: LEUCHT.puls }, gesundheit: { label: 'Gesundheit', href: '/os/gesundheit', farbe: LEUCHT.gut },
};
const STATUS: Record<string, { label: string; farbe: string }> = {
  offen: { label: 'offen', farbe: LEUCHT.achtung }, laeuft: { label: 'läuft', farbe: LEUCHT.puls }, fertig: { label: 'fertig', farbe: LEUCHT.gut }, fehler: { label: 'Fehler', farbe: LEUCHT.kritisch },
  freigegeben: { label: 'freigegeben', farbe: LEUCHT.gut }, abgelehnt: { label: 'abgelehnt', farbe: C.inkLeise }, fehlgeschlagen: { label: 'fehlgeschlagen', farbe: LEUCHT.kritisch },
};
const her = (iso: string) => { const min = Math.floor((Date.now() - Date.parse(iso)) / 60000); return min < 1 ? 'gerade' : min < 60 ? `vor ${min} min` : min < 1440 ? `vor ${Math.floor(min / 60)} h` : `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`; };

export function StapelView() {
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [fakten, setFakten] = useState<Fakt[]>([]);
  const [kosten, setKosten] = useState<Kosten | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [grund, setGrund] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState('');
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    try {
      const [s, a, g] = await Promise.all([fetch('/api/jarvis/stapel?alle=1').then(r => r.json()), fetch('/api/jarvis/auftraege').then(r => r.json()), fetch('/api/jarvis/gedaechtnis').then(r => r.json())]);
      setVorschlaege(Array.isArray(s.vorschlaege) ? s.vorschlaege : []); setAuftraege(Array.isArray(a.auftraege) ? a.auftraege : []); setFakten(Array.isArray(g.fakten) ? g.fakten : []);
    } catch { /* offline — der alte Stand bleibt */ }
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); fetch('/api/jarvis/verbrauch').then(r => r.json()).then(d => { if (d.ok) setKosten(d); }).catch(() => {}); }, [laden]);
  const inArbeit = auftraege.filter(a => a.status === 'laeuft' || a.status === 'offen').length;
  useEffect(() => { if (!inArbeit) return; const iv = setInterval(() => { void laden(); }, 3000); return () => clearInterval(iv); }, [inArbeit, laden]);

  async function entscheide(v: Vorschlag, entscheidung: 'freigeben' | 'ablehnen') {
    setBusy(v.id);
    const d = await fetch('/api/jarvis/stapel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, entscheidung, ...(grund[v.id] ? { grund: grund[v.id] } : {}) }) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(d.ergebnis ?? (entscheidung === 'ablehnen' ? `Abgelehnt: ${v.titel}` : d.error ?? '')); setBusy(null); setOffenId(null); void laden();
  }
  async function alleFreigeben(gruppe?: string) {
    setBusy(gruppe ?? 'alle');
    const d = await fetch('/api/jarvis/stapel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alle: true, ...(gruppe ? { gruppe } : {}) }) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(d.error ?? `${d.erledigt ?? 0} freigegeben und ausgeführt.`); setBusy(null); void laden();
  }
  async function vergiss(id: string) {
    setBusy(id); await fetch(`/api/jarvis/gedaechtnis?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {}); setBusy(null); void laden();
  }

  const offen = vorschlaege.filter(v => v.status === 'offen');
  const entschieden = vorschlaege.filter(v => v.status !== 'offen').slice(0, 10);
  const gruppen = Array.from(new Set(offen.map(v => v.gruppe)));
  const g = (id: string) => GRUPPE[id] ?? { label: id, href: '/os', farbe: C.inkLeise };

  return (
    <Seite titel="Aufträge & Freigaben" unter="Was Jarvis vorbereitet hat und auf dein Ja wartet. Ohne dich passiert nichts." rechts={<Link href="/os/stapel/voll" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Protokoll & Rückgängig ›</Link>}>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}

      <Spalten verhaeltnis="2:1">
        <Spalte>
      <Karte i={0} akzent={offen.length ? LEUCHT.achtung : undefined}>
        <Ueberschrift farbe={offen.length ? LEUCHT.achtung : C.inkLeise} rechts={offen.length > 1 ? <Knopf onClick={() => alleFreigeben()} aus={busy === 'alle'}>Alle {offen.length} freigeben</Knopf> : `${offen.length} offen`}>Wartet auf dich</Ueberschrift>
        {!laedt && offen.length === 0 && <Leer>Nichts offen. Jarvis legt hier ab, was er vorbereitet hat — du entscheidest.</Leer>}
        {gruppen.map(gr => (
          <div key={gr} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px' }}>
              <Punkt farbe={g(gr).farbe} /><span style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.04em', textTransform: 'uppercase' }}>{g(gr).label}</span>
              <Link href={g(gr).href} style={{ fontSize: 12, color: C.inkLeise, textDecoration: 'none' }}>lieber selbst ›</Link>
              {offen.filter(v => v.gruppe === gr).length > 1 && <button onClick={() => alleFreigeben(gr)} disabled={busy === gr} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12 }}>alle in {g(gr).label} freigeben</button>}
            </div>
            <Liste>
              {offen.filter(v => v.gruppe === gr).map(v => (
                <div key={v.id}>
                  <Zeile onClick={() => setOffenId(o => (o === v.id ? null : v.id))} aktiv={offenId === v.id} titel={v.titel} unter={v.anlass ?? `${v.vorher ? `${v.vorher} → ` : ''}${v.nachher}`}
                    rechts={<span style={{ display: 'flex', gap: 6 }}><Knopf onClick={() => entscheide(v, 'freigeben')} aus={busy === v.id} farbe={LEUCHT.gut}>Freigeben</Knopf><Knopf leise onClick={() => entscheide(v, 'ablehnen')} aus={busy === v.id}>Ablehnen</Knopf></span>} />
                  {offenId === v.id && (
                    <div style={{ padding: '6px 2px 16px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: TYP.bedien, color: C.inkDim }}>
                        {v.vorher && <><span style={{ color: C.inkLeise }}>vorher</span><span>{v.vorher}</span></>}
                        <span style={{ color: C.inkLeise }}>nachher</span><span style={{ color: C.ink, fontWeight: 600 }}>{v.nachher}</span>
                        <span style={{ color: C.inkLeise }}>Werkzeug</span><span style={{ fontFamily: SCHRIFT.mono, fontSize: 12 }}>{v.werkzeug}</span>
                        <span style={{ color: C.inkLeise }}>seit</span><span>{her(v.zeit)}</span>
                      </div>
                      <input value={grund[v.id] ?? ''} onChange={e => setGrund(x => ({ ...x, [v.id]: e.target.value }))} placeholder="Grund fürs Ablehnen (optional) — Jarvis lernt daraus" style={{ ...feld, marginTop: 12 }} />
                    </div>
                  )}
                </div>
              ))}
            </Liste>
          </div>
        ))}
      </Karte>
        </Spalte>
        <Spalte>
        <Karte i={1}>
          <Ueberschrift farbe={inArbeit ? LEUCHT.puls : C.inkLeise} rechts={inArbeit ? `${inArbeit} in Arbeit` : undefined}>Der Arbeiter</Ueberschrift>
          <Liste>
            {auftraege.length === 0 && <Leer>Noch kein Auftrag.</Leer>}
            {auftraege.slice(0, 8).map(a => <Zeile key={a.id} links={<Punkt farbe={STATUS[a.status]?.farbe ?? C.inkLeise} />} titel={a.auftrag ?? a.name} unter={`${a.name} · ${her(a.zeit)}${a.fehler ? ` · ${a.fehler}` : a.ergebnis ? ` · ${a.ergebnis.slice(0, 80)}` : ''}`} rechts={<Chip farbe={STATUS[a.status]?.farbe ?? C.inkLeise}>{STATUS[a.status]?.label ?? a.status}</Chip>} />)}
          </Liste>
        </Karte>
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.schlaf}>Zuletzt entschieden</Ueberschrift>
          <Liste>
            {entschieden.length === 0 && <Leer>Noch nichts entschieden.</Leer>}
            {entschieden.map(v => <Zeile key={v.id} links={<Punkt farbe={STATUS[v.status]?.farbe ?? C.inkLeise} />} titel={v.titel} unter={`${g(v.gruppe).label} · ${her(v.zeit)}${v.grund ? ` · ${v.grund}` : v.ergebnis ? ` · ${v.ergebnis.slice(0, 80)}` : ''}`} rechts={<Chip farbe={STATUS[v.status]?.farbe ?? C.inkLeise}>{STATUS[v.status]?.label ?? v.status}</Chip>} />)}
          </Liste>
        </Karte>
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.agenten} rechts={`${fakten.length}`}>Gedächtnis</Ueberschrift>
          <Liste>
            {fakten.length === 0 && <Leer>Jarvis hat sich noch nichts gemerkt. Sag ihm „merk dir …“.</Leer>}
            {fakten.slice(0, 10).map(f => <Zeile key={f.id} titel={f.satz} unter={`${f.thema} · ${f.tag}`} rechts={<button onClick={() => vergiss(f.id)} disabled={busy === f.id} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12 }}>vergessen</button>} />)}
          </Liste>
        </Karte>
        <Karte i={4}>
          <Ueberschrift farbe={LEUCHT.geld}>Verbrauch der KI</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <Zahl wert={kosten ? eur(kosten.heuteCent / 100) : undefined} label="heute" farbe={LEUCHT.geld} />
            <Zahl wert={kosten ? eur(kosten.summeCent / 100) : undefined} label="insgesamt" />
          </div>
          {(kosten?.jeZweck ?? []).slice(0, 5).map(z => (
            <div key={z.zweck} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,130px) 1fr 64px', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span style={{ fontSize: 12.5, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.zweck}</span>
              <Fortschritt anteil={z.cent / Math.max(kosten!.jeZweck[0]?.cent ?? 1, 1)} farbe={LEUCHT.geld} />
              <span style={{ fontFamily: SCHRIFT.display, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: C.inkDim, textAlign: 'right' }}>{eur(z.cent / 100)}</span>
            </div>
          ))}
        </Karte>
        </Spalte>
      </Spalten>
    </Seite>
  );
}
