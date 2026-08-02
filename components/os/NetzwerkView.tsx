'use client';

// ─── MAKE OS — Netzwerk & Pipeline ──────────────────────────────────────────
// Drei Sichten auf dasselbe: was liegen geblieben ist (der Geldhebel), die
// Pipeline nach Stufen, und die Kontakte selbst. Alles direkt bearbeitbar.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';
import { useSpeichern } from '@/hooks/useSpeichern';
import { eur } from '@/lib/make-one/finance-data';
import {
  NAEHE_META, STUFEN, STUFE, OFFENE_STUFEN, pipelineWert, liegenGeblieben,
  type Kontakt, type Chance, type Naehe, type Stufe,
} from '@/lib/make-one/netzwerk-data';
import { textLesen, zuKontakt, type Rohling } from '@/lib/make-one/netzwerk-import';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const feld = { background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '7px 10px', outline: 'none' };

type Sicht = 'liegt' | 'pipeline' | 'kontakte';

export function NetzwerkView() {
  const [kontakte, setKontakte] = useState<Kontakt[]>([]);
  const [chancen, setChancen] = useState<Chance[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [sicht, setSicht] = useState<Sicht>('liegt');
  const [offen, setOffen] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [wer, setWer] = useState<'alle' | 'kevin' | 'malin' | 'beide'>('alle');
  const heute = localDay();

  useEffect(() => {
    fetch('/api/state/netzwerk').then(r => r.json()).then(d => {
      setKontakte(Array.isArray(d.kontakte) ? d.kontakte : []);
      setChancen(Array.isArray(d.chancen) ? d.chancen : []);
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, []);

  // Speichert auch beim Seitenwechsel oder Tab-Schließen — was einmal
  // getippt wurde, ist beim nächsten Öffnen wieder da.
  const netzSpeichern = useSpeichern('/api/state/netzwerk', { verzoegerung: 400 });
  function speichern(k: Kontakt[], c: Chance[]) {
    setKontakte(k); setChancen(c);
    netzSpeichern.speichern({ kontakte: k, chancen: c });
  }
  const patchK = (id: string, p: Partial<Kontakt>) => speichern(kontakte.map(k => k.id === id ? { ...k, ...p } : k), chancen);
  const patchC = (id: string, p: Partial<Chance>) => speichern(kontakte, chancen.map(c => c.id === id ? { ...c, ...p } : c));

  // ── Neu anlegen ──
  const [neu, setNeu] = useState('');
  function kontaktAnlegen() {
    const roh = neu.trim();
    if (!roh) return;
    // „Name, Firma" oder „Name (Rolle)" wird direkt zerlegt — schneller erfasst.
    const m = roh.match(/^(.+?)\s*[,·]\s*(.+)$/) ?? roh.match(/^(.+?)\s*\((.+)\)$/);
    const k: Kontakt = {
      id: `k-${Date.now().toString(36)}`,
      name: (m?.[1] ?? roh).trim(),
      firma: m?.[2]?.trim(),
      naehe: 'kalt',
      besitzer: 'kevin',
    };
    speichern([...kontakte, k], chancen);
    setNeu('');
    setSicht('kontakte');
    setOffen(k.id);
  }
  function chanceAnlegen(kontaktId: string) {
    const c: Chance = { id: `c-${Date.now().toString(36)}`, kontaktId, titel: 'Neue Chance', stufe: 'kontakt' };
    speichern(kontakte, [...chancen, c]);
  }

  // ── Einfüllen: Liste einfügen oder aus dem Postfach übernehmen ──
  const [fuellAuf, setFuellAuf] = useState(false);
  const [rohtext, setRohtext] = useState('');
  const [importNaehe, setImportNaehe] = useState<Naehe>('kalt');
  const [importWer, setImportWer] = useState<Kontakt['besitzer']>('kevin');
  const [importQuelle, setImportQuelle] = useState('');
  const [vorschlaege, setVorschlaege] = useState<{ name: string; email: string; anzahl: number; betreff: string }[] | null>(null);
  const [vorschlagBusy, setVorschlagBusy] = useState(false);

  const gelesen = useMemo(() => (rohtext.trim() ? textLesen(rohtext, kontakte) : []), [rohtext, kontakte]);
  const neuDavon = gelesen.filter(r => !r.doppelt);

  function uebernehmen(liste: Rohling[]) {
    if (!liste.length) return;
    const neue = liste.map((r, i) => zuKontakt(r, importNaehe, importWer, importQuelle, i));
    speichern([...kontakte, ...neue], chancen);
    setRohtext('');
    setSicht('kontakte');
  }

  // ── Verlauf aus Postfach und Kalender ──
  const [verlauf, setVerlauf] = useState<{ name: string; datum: string; woher: string; beleg: string }[] | null>(null);
  const [verlaufInfo, setVerlaufInfo] = useState<{ geprueft: number; ohneDatum: number } | null>(null);
  const [verlaufBusy, setVerlaufBusy] = useState(false);

  async function verlaufPruefen() {
    setVerlaufBusy(true);
    try {
      const d = await (await fetch('/api/netzwerk/verlauf')).json();
      setVerlauf(Array.isArray(d.treffer) ? d.treffer : []);
      setVerlaufInfo({ geprueft: d.geprueft ?? 0, ohneDatum: d.ohneDatum ?? 0 });
    } catch { setVerlauf([]); }
    setVerlaufBusy(false);
  }

  async function verlaufSetzen() {
    setVerlaufBusy(true);
    try {
      await fetch('/api/netzwerk/verlauf', { method: 'POST' });
      const d = await (await fetch('/api/state/netzwerk')).json();
      setKontakte(Array.isArray(d.kontakte) ? d.kontakte : []);
      setVerlauf(null);
    } catch { /* still */ }
    setVerlaufBusy(false);
  }

  // ── Mac-Kontakte ──
  const [mac, setMac] = useState<{ name: string; firma?: string; rolle?: string; email?: string; telefon?: string; art: string }[] | null>(null);
  const [macBusy, setMacBusy] = useState(false);
  const [macFehler, setMacFehler] = useState('');
  const [macArt, setMacArt] = useState<'alle' | 'geschaeftlich' | 'privat' | 'unklar'>('geschaeftlich');

  async function macHolen() {
    setMacBusy(true); setMacFehler('');
    try {
      const d = await (await fetch('/api/apple-contacts')).json();
      if (d.error) { setMacFehler(d.error); setMac(null); }
      else setMac(Array.isArray(d.kontakte) ? d.kontakte : []);
    } catch { setMacFehler('Kontakte-App nicht erreichbar.'); }
    setMacBusy(false);
  }

  const macAuswahl = useMemo(() => {
    if (!mac) return [];
    const namen = new Set(kontakte.map(k => k.name.toLowerCase().trim()));
    const mails = new Set(kontakte.map(k => k.email?.toLowerCase().trim()).filter(Boolean));
    return mac
      .filter(m => macArt === 'alle' || m.art === macArt)
      .filter(m => !namen.has(m.name.toLowerCase().trim()) && !(m.email && mails.has(m.email.toLowerCase())));
  }, [mac, macArt, kontakte]);

  function macUebernehmen() {
    if (!macAuswahl.length) return;
    const neue: Kontakt[] = macAuswahl.map((m, i) => ({
      id: `k-mac-${Date.now().toString(36)}-${i}`,
      name: m.name, firma: m.firma, rolle: m.rolle, email: m.email, telefon: m.telefon,
      naehe: 'kalt', besitzer: importWer, quelle: 'Kontakte-App',
      stichworte: m.art === 'unklar' ? ['einsortieren'] : [m.art],
    }));
    speichern([...kontakte, ...neue], chancen);
    setMac(null);
    setSicht('kontakte');
  }

  async function postfachHolen() {
    setVorschlagBusy(true);
    try {
      const d = await (await fetch('/api/netzwerk/vorschlaege')).json();
      setVorschlaege(Array.isArray(d.vorschlaege) ? d.vorschlaege : []);
    } catch { setVorschlaege([]); }
    setVorschlagBusy(false);
  }

  function vorschlagUebernehmen(v: { name: string; email: string }) {
    const k: Kontakt = {
      id: `k-${Date.now().toString(36)}`,
      name: v.name, email: v.email,
      naehe: 'warm', besitzer: importWer, quelle: 'aus dem Postfach',
    };
    speichern([...kontakte, k], chancen);
    setVorschlaege(vs => (vs ?? []).filter(x => x.email !== v.email));
  }

  const wert = useMemo(() => pipelineWert(chancen), [chancen]);
  const liegt = useMemo(() => liegenGeblieben(kontakte, chancen, heute), [kontakte, chancen, heute]);
  const [gruppe, setGruppe] = useState<'alle' | 'geschaeftlich' | 'privat' | 'einsortieren' | 'ohne-datum'>('alle');
  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase();
    return kontakte.filter(k => {
      if (wer !== 'alle' && k.besitzer !== wer) return false;
      if (gruppe === 'ohne-datum' && k.letzterKontakt) return false;
      if (gruppe !== 'alle' && gruppe !== 'ohne-datum' && !(k.stichworte ?? []).includes(gruppe)) return false;
      if (!n) return true;
      return `${k.name} ${k.firma ?? ''} ${k.rolle ?? ''} ${k.notizen ?? ''}`.toLowerCase().includes(n);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [kontakte, suche, wer, gruppe]);
  const gruppenZahl = useMemo(() => ({
    alle: kontakte.length,
    geschaeftlich: kontakte.filter(k => (k.stichworte ?? []).includes('geschaeftlich')).length,
    privat: kontakte.filter(k => (k.stichworte ?? []).includes('privat')).length,
    einsortieren: kontakte.filter(k => (k.stichworte ?? []).includes('einsortieren')).length,
    'ohne-datum': kontakte.filter(k => !k.letzterKontakt).length,
  }), [kontakte]);

  /** Einsortieren: Stichwort ersetzen, damit die Gruppe sauber bleibt. */
  function einsortieren(k: Kontakt, ziel: 'geschaeftlich' | 'privat') {
    const rest = (k.stichworte ?? []).filter(s => !['geschaeftlich', 'privat', 'einsortieren'].includes(s));
    patchK(k.id, { stichworte: [ziel, ...rest] });
  }

  const chancenVon = (kid: string) => chancen.filter(c => c.kontaktId === kid);
  const nameVon = (kid: string) => kontakte.find(k => k.id === kid)?.name ?? '—';

  /** Kontaktkarte — überall dieselbe, aufklappbar zum Bearbeiten. */
  function karte(k: Kontakt, i: number) {
    const auf = offen === k.id;
    const meine = chancenVon(k.id);
    const offeneW = meine.filter(c => OFFENE_STUFEN.includes(c.stufe)).reduce((s, c) => s + (c.wert ?? 0), 0);
    const nm = NAEHE_META[k.naehe];
    return (
      <div key={k.id} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: auf ? T.panel2 : 'transparent' }}>
        <div onClick={() => setOffen(auf ? null : k.id)} style={{ display: 'flex', gap: 12, padding: '11px 16px', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ width: 4, height: 30, borderRadius: 2, background: nm.farbe, flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
              {k.name}
              {k.firma && <span style={{ color: T.muted, fontWeight: 400 }}> · {k.firma}</span>}
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 3 }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: nm.farbe, border: `1px solid ${nm.farbe}44`, borderRadius: 5, padding: '1px 6px' }}>{nm.label}</span>
              {k.rolle && <span style={{ fontSize: 11.5, color: T.muted }}>{k.rolle}</span>}
              {k.letzterKontakt && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>zuletzt {k.letzterKontakt.slice(8)}.{k.letzterKontakt.slice(5, 7)}.</span>}
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{k.besitzer === 'beide' ? 'Beide' : k.besitzer === 'malin' ? 'Malin' : 'Kevin'}</span>
              {!!meine.length && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.accent }}>{meine.length} Chance{meine.length === 1 ? '' : 'n'}{offeneW ? ` · ${eur(offeneW)}` : ''}</span>}
            </div>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{auf ? '▾' : '▸'}</span>
        </div>

        {auf && (
          <div style={{ padding: '0 16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <input value={k.firma ?? ''} onChange={e => patchK(k.id, { firma: e.target.value })} placeholder="Firma" aria-label="Firma" style={{ ...feld, width: 170 }} />
              <input value={k.rolle ?? ''} onChange={e => patchK(k.id, { rolle: e.target.value })} placeholder="Rolle" aria-label="Rolle" style={{ ...feld, width: 170 }} />
              <input value={k.email ?? ''} onChange={e => patchK(k.id, { email: e.target.value })} placeholder="E-Mail" aria-label="E-Mail" style={{ ...feld, width: 200 }} />
              <input value={k.quelle ?? ''} onChange={e => patchK(k.id, { quelle: e.target.value })} placeholder="Woher kennen wir uns?" aria-label="Quelle" style={{ ...feld, flex: 1, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...lbl, width: 62 }}>Nähe</span>
              {(Object.keys(NAEHE_META) as Naehe[]).map(n => (
                <button key={n} onClick={() => patchK(k.id, { naehe: n })} title={`Melden alle ${NAEHE_META[n].takt} Tage`}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${k.naehe === n ? NAEHE_META[n].farbe : T.line}`, background: k.naehe === n ? `${NAEHE_META[n].farbe}1c` : 'transparent', color: k.naehe === n ? NAEHE_META[n].farbe : T.inkDim }}>
                  {NAEHE_META[n].label}
                </button>
              ))}
              <span style={{ ...lbl, width: 62, marginLeft: 8 }}>Wer hält</span>
              {(['kevin', 'malin', 'beide'] as const).map(p => (
                <button key={p} onClick={() => patchK(k.id, { besitzer: p })}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${k.besitzer === p ? T.accent : T.line}`, background: k.besitzer === p ? `${T.accent}1c` : 'transparent', color: k.besitzer === p ? T.accentInk : T.inkDim }}>
                  {p === 'beide' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin'}
                </button>
              ))}
              {(k.stichworte ?? []).includes('einsortieren') && (
                <>
                  <span style={{ ...lbl, marginLeft: 8 }}>Ist das</span>
                  <button onClick={() => einsortieren(k, 'geschaeftlich')}
                    style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.amber}66`, background: `${T.amber}14`, color: T.amber }}>geschäftlich</button>
                  <button onClick={() => einsortieren(k, 'privat')}
                    style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim }}>privat</button>
                </>
              )}
              <button onClick={() => patchK(k.id, { letzterKontakt: heute })}
                style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk }}>
                ✓ heute gesprochen
              </button>
            </div>
            <textarea value={k.notizen ?? ''} onChange={e => patchK(k.id, { notizen: e.target.value })} rows={3}
              placeholder="Was wissen wir über ihn? Worüber haben wir gesprochen, was braucht er, wo können wir helfen?"
              aria-label="Notizen"
              style={{ ...feld, width: '100%', resize: 'vertical', lineHeight: 1.5 }} />

            {/* Chancen an diesem Kontakt */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={lbl}>Chancen</span>
              <button onClick={() => chanceAnlegen(k.id)} style={{ fontFamily: T.sans, fontSize: 11.5, padding: '3px 11px', borderRadius: 7, cursor: 'pointer', border: `1px dashed ${T.line}`, background: 'transparent', color: T.inkDim }}>+ Chance</button>
            </div>
            {meine.map(c => chanceZeile(c))}
            <button onClick={() => { if (confirm(`${k.name} wirklich löschen?`)) { speichern(kontakte.filter(x => x.id !== k.id), chancen.filter(c => c.kontaktId !== k.id)); setOffen(null); } }}
              style={{ alignSelf: 'flex-start', fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>Kontakt löschen</button>
          </div>
        )}
      </div>
    );
  };

  function chanceZeile(c: Chance) { return (
    <div key={c.id} style={{ background: T.void, border: `1px solid ${STUFE[c.stufe].farbe}33`, borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={c.titel} onChange={e => patchC(c.id, { titel: e.target.value })} aria-label="Titel der Chance"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 13, fontWeight: 600, flex: 1, minWidth: 130 }} />
        <input type="number" value={c.wert ?? ''} onChange={e => patchC(c.id, { wert: Number(e.target.value) || undefined })} placeholder="€" aria-label="Wert"
          style={{ ...feld, width: 96, fontFamily: T.mono, fontSize: 12 }} />
        <button onClick={() => { if (confirm('Chance löschen?')) speichern(kontakte, chancen.filter(x => x.id !== c.id)); }} aria-label="Chance löschen"
          style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {STUFEN.map(s => (
          <button key={s.id} onClick={() => patchC(c.id, { stufe: s.id })}
            style={{ fontFamily: T.sans, fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${c.stufe === s.id ? s.farbe : T.line}`, background: c.stufe === s.id ? `${s.farbe}1c` : 'transparent', color: c.stufe === s.id ? s.farbe : T.muted }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={c.naechsterSchritt ?? ''} onChange={e => patchC(c.id, { naechsterSchritt: e.target.value })}
          placeholder="Nächster Schritt — ohne den verläuft es sich" aria-label="Nächster Schritt"
          style={{ ...feld, flex: 1, minWidth: 180, fontSize: 12, borderColor: c.naechsterSchritt ? T.line : `${T.amber}66` }} />
        <input type="date" value={c.faellig ?? ''} onChange={e => patchC(c.id, { faellig: e.target.value || undefined })} aria-label="Fällig am"
          style={{ ...feld, fontFamily: T.mono, fontSize: 11.5, colorScheme: 'dark' }} />
      </div>
    </div>
  ); }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Netzwerk</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>
          {kontakte.length} {kontakte.length === 1 ? 'Kontakt' : 'Kontakte'}
          {wert.anzahl > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: T.accent, marginLeft: 12 }}>{eur(wert.gewichtet)} gewichtet</span>}
        </h1>
        <p style={{ fontSize: 13, color: T.inkDim, marginBottom: 16 }}>
          {wert.anzahl > 0
            ? <>{wert.anzahl} offene Chancen über {eur(wert.roh)} — nach Abschluss-Wahrscheinlichkeit der Stufen {eur(wert.gewichtet)}.</>
            : <>Noch keine Chancen erfasst. Das Geld liegt im Nachhalten, nicht im Sammeln.</>}
        </p>

        {/* Anlegen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') kontaktAnlegen(); }}
            placeholder="Name, Firma — Enter legt an" aria-label="Neuer Kontakt" style={{ ...feld, flex: 1, fontSize: 13.5, padding: '10px 13px' }} />
          <button onClick={kontaktAnlegen} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 17px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Kontakt</button>
          <button onClick={() => setFuellAuf(!fuellAuf)} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '9px 15px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${fuellAuf ? T.accent : T.line}`, background: fuellAuf ? `${T.accent}1c` : 'transparent', color: fuellAuf ? T.accentInk : T.inkDim }}>
            Viele auf einmal {fuellAuf ? '▾' : '▸'}
          </button>
        </div>

        {/* ── Einfüllen: Liste einfügen oder aus dem Postfach ── */}
        {fuellAuf && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ ...lbl, marginBottom: 4 }}>Liste einfügen</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 9, lineHeight: 1.5 }}>
              Aus Handy-Kontakten, LinkedIn-Export, einer Tabelle oder einfach getippt — eine Person je Zeile.
              Erkannt wird: <b style={{ color: T.inkDim }}>Name, Firma, Rolle</b> sowie E-Mail und Telefon, egal wo sie stehen.
            </div>
            <textarea value={rohtext} onChange={e => setRohtext(e.target.value)} rows={6}
              placeholder={'Frank Mathick, KEMARIS, Finanzen, frank@beispiel.de\nAnna Beispiel; Volksbank; Firmenkunden\nMoritz (Events) moritz@beispiel.de'}
              aria-label="Kontaktliste einfügen"
              style={{ ...feld, width: '100%', fontFamily: T.mono, fontSize: 12, lineHeight: 1.6, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
              <span style={{ ...lbl, width: 56 }}>Nähe</span>
              {(Object.keys(NAEHE_META) as Naehe[]).map(n => (
                <button key={n} onClick={() => setImportNaehe(n)}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${importNaehe === n ? NAEHE_META[n].farbe : T.line}`, background: importNaehe === n ? `${NAEHE_META[n].farbe}1c` : 'transparent', color: importNaehe === n ? NAEHE_META[n].farbe : T.inkDim }}>{NAEHE_META[n].label}</button>
              ))}
              <span style={{ ...lbl, width: 56, marginLeft: 6 }}>Wer hält</span>
              {(['kevin', 'malin', 'beide'] as const).map(p => (
                <button key={p} onClick={() => setImportWer(p)}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${importWer === p ? T.accent : T.line}`, background: importWer === p ? `${T.accent}1c` : 'transparent', color: importWer === p ? T.accentInk : T.inkDim }}>{p === 'beide' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin'}</button>
              ))}
              <input value={importQuelle} onChange={e => setImportQuelle(e.target.value)} placeholder="Woher? z. B. LinkedIn-Export"
                aria-label="Quelle" style={{ ...feld, flex: 1, minWidth: 150, fontSize: 12 }} />
            </div>

            {/* Vorschau — man sieht vorher, was ankommt */}
            {!!gelesen.length && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: T.inkDim }}>
                    <b style={{ color: T.accent }}>{neuDavon.length} neu</b>
                    {gelesen.length - neuDavon.length > 0 && <span style={{ color: T.muted }}> · {gelesen.length - neuDavon.length} kennen wir schon</span>}
                  </span>
                  <button onClick={() => uebernehmen(neuDavon)} disabled={!neuDavon.length}
                    style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '6px 15px', borderRadius: 8, cursor: neuDavon.length ? 'pointer' : 'default', border: 'none', background: neuDavon.length ? T.accent : T.line, color: neuDavon.length ? '#04110F' : T.muted }}>
                    ✓ {neuDavon.length} übernehmen
                  </button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${T.lineSoft}`, borderRadius: 9 }}>
                  {gelesen.slice(0, 60).map((r, i) => (
                    <div key={`${r.name}-${i}`} style={{ display: 'flex', gap: 9, padding: '6px 11px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, opacity: r.doppelt ? 0.45 : 1 }}>
                      <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 550, minWidth: 130 }}>{r.name}</span>
                      <span style={{ fontSize: 12, color: T.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[r.firma, r.rolle, r.email, r.telefon].filter(Boolean).join(' · ') || '—'}
                      </span>
                      {r.doppelt && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.amber }}>schon da</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Verlauf abgleichen */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={lbl}>Verlauf abgleichen</span>
                <span style={{ fontSize: 12.5, color: T.muted }}>Setzt „zuletzt gesprochen" aus Postfach und Kalender.</span>
                <button onClick={verlaufPruefen} disabled={verlaufBusy}
                  style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 8, cursor: verlaufBusy ? 'wait' : 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim }}>
                  {verlaufBusy ? 'prüft …' : 'Belege suchen'}
                </button>
              </div>
              {verlaufInfo && (
                <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
                  {verlaufInfo.geprueft} Kontakte geprüft · {verlaufInfo.ohneDatum} haben noch kein Datum.
                  {verlauf && !verlauf.length && ' Keine neuen Belege — Postfach und Kalender geben zu diesen Kontakten nichts her.'}
                </div>
              )}
              {!!verlauf?.length && (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 6px' }}>
                    <span style={{ fontSize: 12.5, color: T.inkDim }}><b style={{ color: T.accent }}>{verlauf.length} Belege</b> gefunden</span>
                    <button onClick={verlaufSetzen} disabled={verlaufBusy}
                      style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '6px 15px', borderRadius: 8, cursor: 'pointer', border: 'none', background: T.accent, color: '#04110F' }}>
                      ✓ Daten übernehmen
                    </button>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${T.lineSoft}`, borderRadius: 9 }}>
                    {verlauf.slice(0, 40).map((v, i) => (
                      <div key={`${v.name}-${i}`} style={{ display: 'flex', gap: 9, padding: '6px 11px', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accent, minWidth: 74 }}>{v.datum}</span>
                        <span style={{ fontSize: 12.5, color: T.ink, minWidth: 120 }}>{v.name}</span>
                        <span style={{ fontSize: 11.5, color: T.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.woher} · {v.beleg}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Vom Mac */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={lbl}>Kontakte-App</span>
                <span style={{ fontSize: 12.5, color: T.muted }}>Alles, was auf dem Mac und dem iPhone liegt.</span>
                <button onClick={macHolen} disabled={macBusy}
                  style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 8, cursor: macBusy ? 'wait' : 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim }}>
                  {macBusy ? 'liest …' : mac ? '↻ neu lesen' : 'Kontakte lesen'}
                </button>
              </div>

              {macFehler && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.amber, lineHeight: 1.5 }}>
                  {macFehler}<br />
                  <span style={{ color: T.muted }}>Freigabe: Systemeinstellungen → Datenschutz &amp; Sicherheit → Kontakte → den Terminal-Eintrag aktivieren, dann neu lesen.</span>
                </div>
              )}

              {mac && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 8px' }}>
                    {([['geschaeftlich', 'geschäftlich'], ['privat', 'privat'], ['unklar', 'nur Name & Nummer'], ['alle', 'alle']] as const).map(([k, label]) => {
                      const n = mac.filter(m => k === 'alle' || m.art === k).length;
                      return (
                        <button key={k} onClick={() => setMacArt(k)}
                          style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 11px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${macArt === k ? T.accent : T.line}`, background: macArt === k ? `${T.accent}1c` : 'transparent', color: macArt === k ? T.accentInk : T.inkDim }}>
                          {label} <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{n}</span>
                        </button>
                      );
                    })}
                    <button onClick={macUebernehmen} disabled={!macAuswahl.length}
                      style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '6px 15px', borderRadius: 8, cursor: macAuswahl.length ? 'pointer' : 'default', border: 'none', background: macAuswahl.length ? T.accent : T.line, color: macAuswahl.length ? '#04110F' : T.muted }}>
                      ✓ {macAuswahl.length} übernehmen
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
                    Einordnung nach vorhandenen Daten: Firma oder Geschäftsadresse → geschäftlich, Freemail → privat.
                    Wer nur mit Name und Nummer drinsteht, bekommt das Stichwort <b style={{ color: T.inkDim }}>einsortieren</b> — den Rest macht ihr beim Durchgehen.
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${T.lineSoft}`, borderRadius: 9 }}>
                    {macAuswahl.slice(0, 50).map((m, i) => (
                      <div key={`${m.name}-${i}`} style={{ display: 'flex', gap: 9, padding: '6px 11px', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                        <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 550, minWidth: 140 }}>{m.name}</span>
                        <span style={{ fontSize: 12, color: T.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[m.firma, m.rolle, m.email, m.telefon].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </div>
                    ))}
                    {macAuswahl.length > 50 && <div style={{ padding: '7px 11px', fontFamily: T.mono, fontSize: 10.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>+{macAuswahl.length - 50} weitere — alle werden übernommen</div>}
                    {!macAuswahl.length && <div style={{ padding: '12px', fontSize: 12.5, color: T.muted }}>In dieser Gruppe ist niemand Neues.</div>}
                  </div>
                </>
              )}
            </div>

            {/* Aus dem Postfach */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={lbl}>Aus dem Postfach</span>
                <span style={{ fontSize: 12.5, color: T.muted }}>Wer euch schreibt, ist schon ein Kontakt.</span>
                <button onClick={postfachHolen} disabled={vorschlagBusy}
                  style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 8, cursor: vorschlagBusy ? 'wait' : 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim }}>
                  {vorschlagBusy ? 'sucht …' : vorschlaege ? '↻ neu suchen' : 'Absender vorschlagen'}
                </button>
              </div>
              {vorschlaege && (
                vorschlaege.length ? (
                  <div style={{ marginTop: 9, maxHeight: 220, overflowY: 'auto' }}>
                    {vorschlaege.map((v, i) => (
                      <div key={v.email} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{v.name} <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{v.anzahl}×</span></div>
                          <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email} · {v.betreff}</div>
                        </div>
                        <button onClick={() => vorschlagUebernehmen(v)}
                          style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.accent}55`, background: `${T.accent}18`, color: T.accentInk }}>+ übernehmen</button>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ marginTop: 8, fontSize: 12.5, color: T.muted }}>Keine neuen Absender gefunden — entweder kennt ihr schon alle, oder der Postfach-Stand ist leer.</div>
              )}
            </div>
          </div>
        )}

        {/* Sichten */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {([['liegt', `Liegt liegen${liegt.length ? ` · ${liegt.length}` : ''}`], ['pipeline', 'Pipeline'], ['kontakte', 'Kontakte']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSicht(k)} style={{
              fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${sicht === k ? T.lineHot : T.line}`, background: sicht === k ? T.accentSoft : 'transparent',
              color: sicht === k ? T.accentInk : T.inkDim,
            }}>{label}</button>
          ))}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {(['alle', 'kevin', 'malin', 'beide'] as const).map(p => (
            <button key={p} onClick={() => setWer(p)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${wer === p ? T.lineHot : T.line}`, background: 'transparent', color: wer === p ? T.accentInk : T.muted,
            }}>{p === 'alle' ? 'Jeder' : p === 'beide' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin'}</button>
          ))}
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="suchen …" aria-label="Kontakte durchsuchen"
            style={{ ...feld, marginLeft: 'auto', width: 160, fontSize: 12 }} />
        </div>

        {/* Gruppen — bei hunderten Kontakten der eigentliche Einstieg */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {([['alle', 'Alle'], ['geschaeftlich', 'Geschäftlich'], ['privat', 'Privat'], ['einsortieren', 'Einsortieren'], ['ohne-datum', 'Nie gesprochen']] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setGruppe(k); setSicht('kontakte'); }} style={{
              fontFamily: T.sans, fontSize: 12, fontWeight: gruppe === k ? 700 : 500, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${gruppe === k ? (k === 'einsortieren' ? T.amber : T.accent) : T.line}`,
              background: gruppe === k ? `${k === 'einsortieren' ? T.amber : T.accent}1c` : 'transparent',
              color: gruppe === k ? (k === 'einsortieren' ? T.amber : T.accentInk) : T.inkDim,
            }}>{label} <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{gruppenZahl[k]}</span></button>
          ))}
        </div>

        {!geladen && <div style={{ ...panel, padding: '30px', textAlign: 'center', color: T.muted, fontSize: 13 }}>lädt …</div>}

        {geladen && !kontakte.length && (
          <div style={{ ...panel, padding: '30px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Noch niemand drin.</div>
            <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
              Fangt mit den zwanzig wichtigsten an — die, bei denen euch sofort etwas einfällt.
              Oben eintippen, Nähe setzen, kurz notieren was ihr wisst. Alles Weitere wächst daran.
            </div>
          </div>
        )}

        {/* ── LIEGT LIEGEN: der Geldhebel ── */}
        {geladen && !!kontakte.length && sicht === 'liegt' && (
          liegt.length ? (
            <div style={{ ...panel, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px' }}>
                <span style={lbl}>Was hinten runterfällt</span>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>Dringendstes zuerst. Jede Zeile ist Geld oder eine Beziehung, die gerade kalt wird.</div>
              </div>
              {liegt.slice(0, 40).map((l, i) => {
                const farbe = l.art === 'schritt-faellig' ? T.crit : l.art === 'ohne-schritt' ? T.amber : T.inkDim;
                return (
                  <div key={`${l.kontaktId}-${l.chanceId ?? l.art}-${i}`}
                    onClick={() => { setSicht('kontakte'); setOffen(l.kontaktId); }}
                    style={{ display: 'flex', gap: 11, padding: '10px 16px', alignItems: 'center', borderTop: `1px solid ${T.lineSoft}`, cursor: 'pointer' }}>
                    <span style={{ color: farbe, fontSize: 11, flex: '0 0 auto' }}>{l.art === 'stumm' ? '◷' : l.art === 'ohne-schritt' ? '◇' : '●'}</span>
                    <span style={{ fontSize: 13, color: T.inkDim, flex: 1, lineHeight: 1.4 }}>{l.text}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>öffnen ›</span>
                  </div>
                );
              })}
              {liegt.length > 40 && <div style={{ padding: '10px 16px', fontFamily: T.mono, fontSize: 10.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>+{liegt.length - 40} weitere</div>}
            </div>
          ) : (
            <div style={{ ...panel, padding: '28px', textAlign: 'center', color: T.inkDim, fontSize: 13.5 }}>
              Nichts liegen geblieben. Jede Chance hat einen nächsten Schritt, kein Kontakt ist zu lange still. 🎯
            </div>
          )
        )}

        {/* ── PIPELINE: nach Stufen ── */}
        {geladen && !!kontakte.length && sicht === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, alignItems: 'start' }}>
            {STUFEN.filter(s => s.id !== 'verloren').map(s => {
              const drin = chancen.filter(c => c.stufe === s.id);
              const summe = drin.reduce((sum, c) => sum + (c.wert ?? 0), 0);
              return (
                <div key={s.id} style={{ ...panel, borderTop: `3px solid ${s.farbe}`, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 14px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.farbe }}>{s.label}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{drin.length}</span>
                    </div>
                    {!!summe && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim, marginTop: 2 }}>{eur(summe)}</div>}
                  </div>
                  {drin.map(c => (
                    <div key={c.id} onClick={() => { setSicht('kontakte'); setOffen(c.kontaktId); }}
                      style={{ padding: '9px 14px', borderTop: `1px solid ${T.lineSoft}`, cursor: 'pointer' }}>
                      <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 550 }}>{c.titel}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        {nameVon(c.kontaktId)}{c.wert ? ` · ${eur(c.wert)}` : ''}
                      </div>
                      {c.naechsterSchritt
                        ? <div style={{ fontSize: 11, color: c.faellig && c.faellig < heute ? T.crit : T.inkDim, marginTop: 3 }}>→ {c.naechsterSchritt}{c.faellig ? ` (${c.faellig.slice(8)}.${c.faellig.slice(5, 7)}.)` : ''}</div>
                        : <div style={{ fontSize: 11, color: T.amber, marginTop: 3 }}>→ kein nächster Schritt</div>}
                    </div>
                  ))}
                  {!drin.length && <div style={{ padding: '12px 14px', fontSize: 12, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>leer</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── KONTAKTE ── */}
        {geladen && !!kontakte.length && sicht === 'kontakte' && (
          <div style={{ ...panel, overflow: 'hidden' }}>
            {sichtbar.map((k, i) => karte(k, i))}
            {!sichtbar.length && <div style={{ padding: '24px', textAlign: 'center', color: T.muted, fontSize: 13 }}>Kein Treffer.</div>}
          </div>
        )}

        <div style={{ marginTop: 18, fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>
          Euer Netzwerk — liegt lokal, gehört euch. Nähe bestimmt den Melde-Takt: eng 30 · warm 90 · lose 180 Tage.
        </div>
      </div>
    </div>
  );
}
