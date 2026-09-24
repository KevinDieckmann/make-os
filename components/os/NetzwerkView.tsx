'use client';

// ─── MAKE OS — Netzwerk & Pipeline ──────────────────────────────────────────
// Drei Sichten auf dasselbe: was liegen geblieben ist (der Geldhebel), die
// Pipeline nach Stufen, und die Kontakte selbst. Alles direkt bearbeitbar.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Zahl/Segmente
// aus schlank) — der Held ist jetzt die erste Karte, die Sichten sind Segmente.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { useSpeichern } from '@/hooks/useSpeichern';
import { eur } from '@/lib/make-one/finance-data';
import {
  NAEHE_META, STUFEN, STUFE, OFFENE_STUFEN, pipelineWert, liegenGeblieben,
  type Kontakt, type Chance, type Naehe,
} from '@/lib/make-one/netzwerk-data';
import { textLesen, zuKontakt, type Rohling } from '@/lib/make-one/netzwerk-import';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Segmente, feld, LEUCHT } from './schlank';

type Sicht = 'liegt' | 'pipeline' | 'kontakte';

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
/** Eingabe in einer Zeile neben anderen — das Feld ohne feste Breite. */
const inline: CSSProperties = { ...feld, width: 'auto', padding: '8px 12px', fontSize: TYP.bedien };
/** Nie eine Null als große Zahl — dann lieber der Strich. */
const z = (n: number) => (n ? String(n) : undefined);
const besitzerLabel = (p: Kontakt['besitzer']) => (p === 'beide' ? 'Beide' : p === 'malin' ? 'Malin' : 'Kevin');
const tag = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;

/** Pillen-Schalter — eine Wahl aus mehreren, ohne Rahmen. */
function Wahl({ an, farbe, onClick, children, title }: { an: boolean; farbe?: string; onClick: () => void; children: ReactNode; title?: string }) {
  const f = farbe ?? C.aktiv;
  return (
    <button onClick={onClick} title={title} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: an ? `${f}22` : 'rgba(255,255,255,.05)', color: an ? f : C.inkDim, whiteSpace: 'nowrap', transition: 'background .2s ease, color .2s ease' }}>{children}</button>
  );
}

export function NetzwerkView() {
  const [kontakte, setKontakte] = useState<Kontakt[]>([]);
  const [chancen, setChancen] = useState<Chance[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [sicht, setSicht] = useState<Sicht>('liegt');
  const [offen, setOffen] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [wer, setWer] = useState<'alle' | string | 'beide'>('alle');
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

  /** Kontaktzeile — überall dieselbe, aufklappbar zum Bearbeiten. */
  function karte(k: Kontakt) {
    const auf = offen === k.id;
    const meine = chancenVon(k.id);
    const offeneW = meine.filter(c => OFFENE_STUFEN.includes(c.stufe)).reduce((s, c) => s + (c.wert ?? 0), 0);
    const nm = NAEHE_META[k.naehe];
    return (
      <div key={k.id}>
        <Zeile onClick={() => setOffen(auf ? null : k.id)} aktiv={auf}
          links={<Punkt farbe={nm.farbe} />}
          titel={<>{k.name}{k.firma && <span style={{ color: C.inkLeise, fontWeight: 400 }}> · {k.firma}</span>}</>}
          unter={[k.rolle, k.letzterKontakt ? `zuletzt ${tag(k.letzterKontakt)}` : '', besitzerLabel(k.besitzer)].filter(Boolean).join(' · ')}
          rechts={
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!!meine.length && <Chip farbe={LEUCHT.geld}>{meine.length} Chance{meine.length === 1 ? '' : 'n'}{offeneW ? ` · ${eur(offeneW)}` : ''}</Chip>}
              <Chip farbe={nm.farbe}>{nm.label}</Chip>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{auf ? '▾' : '▸'}</span>
            </span>
          }
        />

        {auf && (
          <div style={{ padding: '8px 2px 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={k.firma ?? ''} onChange={e => patchK(k.id, { firma: e.target.value })} placeholder="Firma" aria-label="Firma" style={{ ...inline, flex: 1, minWidth: 140 }} />
              <input value={k.rolle ?? ''} onChange={e => patchK(k.id, { rolle: e.target.value })} placeholder="Rolle" aria-label="Rolle" style={{ ...inline, flex: 1, minWidth: 140 }} />
              <input value={k.email ?? ''} onChange={e => patchK(k.id, { email: e.target.value })} placeholder="E-Mail" aria-label="E-Mail" style={{ ...inline, flex: 1, minWidth: 180 }} />
              <input value={k.quelle ?? ''} onChange={e => patchK(k.id, { quelle: e.target.value })} placeholder="Woher kennen wir uns?" aria-label="Quelle" style={{ ...inline, flex: 1, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...mikro, width: 62 }}>Nähe</span>
              {(Object.keys(NAEHE_META) as Naehe[]).map(n => (
                <Wahl key={n} an={k.naehe === n} farbe={NAEHE_META[n].farbe} onClick={() => patchK(k.id, { naehe: n })} title={`Melden alle ${NAEHE_META[n].takt} Tage`}>{NAEHE_META[n].label}</Wahl>
              ))}
              <span style={{ ...mikro, width: 62, marginLeft: 8 }}>Wer hält</span>
              {(['kevin', 'malin', 'beide'] as const).map(p => (
                <Wahl key={p} an={k.besitzer === p} farbe={LEUCHT.beziehung} onClick={() => patchK(k.id, { besitzer: p })}>{besitzerLabel(p)}</Wahl>
              ))}
              {(k.stichworte ?? []).includes('einsortieren') && (
                <>
                  <span style={{ ...mikro, marginLeft: 8 }}>Ist das</span>
                  <Wahl an farbe={LEUCHT.achtung} onClick={() => einsortieren(k, 'geschaeftlich')}>geschäftlich</Wahl>
                  <Wahl an={false} onClick={() => einsortieren(k, 'privat')}>privat</Wahl>
                </>
              )}
              <span style={{ marginLeft: 'auto' }}><Knopf leise onClick={() => patchK(k.id, { letzterKontakt: heute })}>✓ heute gesprochen</Knopf></span>
            </div>
            <textarea value={k.notizen ?? ''} onChange={e => patchK(k.id, { notizen: e.target.value })} rows={3}
              placeholder="Was wissen wir über ihn? Worüber haben wir gesprochen, was braucht er, wo können wir helfen?"
              aria-label="Notizen"
              style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />

            {/* Chancen an diesem Kontakt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={mikro}>Chancen</span>
              <Knopf leise onClick={() => chanceAnlegen(k.id)}>+ Chance</Knopf>
            </div>
            {meine.map(c => chanceZeile(c))}
            <span style={{ alignSelf: 'flex-start' }}>
              <Knopf leise onClick={() => { if (confirm(`${k.name} wirklich löschen?`)) { speichern(kontakte.filter(x => x.id !== k.id), chancen.filter(c => c.kontaktId !== k.id)); setOffen(null); } }}>Kontakt löschen</Knopf>
            </span>
          </div>
        )}
      </div>
    );
  }

  function chanceZeile(c: Chance) { return (
    <div key={c.id} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Punkt farbe={STUFE[c.stufe].farbe} />
        <input value={c.titel} onChange={e => patchC(c.id, { titel: e.target.value })} aria-label="Titel der Chance"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 600, flex: 1, minWidth: 130 }} />
        <input type="number" value={c.wert ?? ''} onChange={e => patchC(c.id, { wert: Number(e.target.value) || undefined })} placeholder="€" aria-label="Wert"
          style={{ ...inline, width: 110, fontVariantNumeric: 'tabular-nums' }} />
        <button onClick={() => { if (confirm('Chance löschen?')) speichern(kontakte, chancen.filter(x => x.id !== c.id)); }} aria-label="Chance löschen"
          style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {STUFEN.map(s => (
          <Wahl key={s.id} an={c.stufe === s.id} farbe={s.farbe} onClick={() => patchC(c.id, { stufe: s.id })}>{s.label}</Wahl>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={c.naechsterSchritt ?? ''} onChange={e => patchC(c.id, { naechsterSchritt: e.target.value })}
          placeholder="Nächster Schritt — ohne den verläuft es sich" aria-label="Nächster Schritt"
          style={{ ...inline, flex: 1, minWidth: 180, boxShadow: c.naechsterSchritt ? undefined : `0 0 0 1px ${LEUCHT.achtung}66` }} />
        <input type="date" value={c.faellig ?? ''} onChange={e => patchC(c.id, { faellig: e.target.value || undefined })} aria-label="Fällig am"
          style={{ ...inline, colorScheme: 'dark' }} />
      </div>
    </div>
  ); }

  const satz = wert.anzahl === 0
    ? <>Noch keine Chancen erfasst. Das Geld liegt im Nachhalten, nicht im Sammeln.</>
    : liegt.length
      ? <><b style={{ color: LEUCHT.achtung }}>{liegt.length}</b> {liegt.length === 1 ? 'Faden' : 'Fäden'} {liegt.length === 1 ? 'wird' : 'werden'} gerade kalt — das ist der teuerste Posten auf dieser Seite.</>
      : <>Nichts liegt liegen. {wert.anzahl} offene {wert.anzahl === 1 ? 'Chance' : 'Chancen'} laufen nach.</>;

  const SICHTEN: { id: Sicht; label: string }[] = [
    { id: 'liegt', label: `Liegt liegen${liegt.length ? ` · ${liegt.length}` : ''}` },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'kontakte', label: 'Kontakte' },
  ];
  /** Index der Karten nach dem Einfüll-Block — der klappt vier Karten auf. */
  const nI = fuellAuf ? 6 : 2;

  return (
    <Seite titel="Netzwerk & Pipeline." unter={satz} rechts={<Segmente liste={SICHTEN} aktiv={sicht} onWahl={setSicht} />}>
      {/* ── Der Held (UX 5, 06.09.) ───────────────────────────────────────
          Nicht die Zahl der Kontakte ist die Frage, sondern was davon Geld
          werden kann — und was gerade kalt wird. Kontaktzahl und Rohwert
          stehen daneben, nicht darüber. */}
      <Karte i={0} akzent={LEUCHT.beziehung}>
        <Ueberschrift farbe={LEUCHT.beziehung}>{wert.anzahl > 0 ? 'Pipeline gewichtet' : 'Netzwerk'}</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 18, alignItems: 'end' }}>
          <Zahl gross
            wert={wert.anzahl > 0 ? eur(wert.gewichtet) : z(kontakte.length)}
            label={wert.anzahl > 0 ? 'Pipeline gewichtet' : kontakte.length === 1 ? 'Kontakt' : 'Kontakte'}
            farbe={wert.anzahl > 0 ? LEUCHT.geld : LEUCHT.beziehung} />
          <Zahl wert={z(wert.anzahl)} label="offene Chancen" />
          <Zahl wert={wert.roh ? eur(wert.roh) : undefined} label="Rohwert" farbe={LEUCHT.geld} />
          <Zahl wert={z(kontakte.length)} label="Kontakte" farbe={LEUCHT.beziehung} />
        </div>
      </Karte>

      {/* Anlegen */}
      <Karte i={1}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') kontaktAnlegen(); }}
            placeholder="Name, Firma — Enter legt an" aria-label="Neuer Kontakt" style={{ ...feld, flex: 1, minWidth: 180, width: 'auto' }} />
          <Knopf onClick={kontaktAnlegen} farbe={LEUCHT.beziehung}>+ Kontakt</Knopf>
          <Knopf leise onClick={() => setFuellAuf(!fuellAuf)}>Viele auf einmal {fuellAuf ? '▾' : '▸'}</Knopf>
        </div>
      </Karte>

      {/* ── Einfüllen: Liste einfügen oder aus dem Postfach ── */}
      {fuellAuf && (
        <>
          <Karte i={2}>
            <Ueberschrift farbe={LEUCHT.beziehung}>Liste einfügen</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 10, lineHeight: 1.5 }}>
              Aus Handy-Kontakten, LinkedIn-Export, einer Tabelle oder einfach getippt — eine Person je Zeile.
              Erkannt wird: <b style={{ color: C.inkDim }}>Name, Firma, Rolle</b> sowie E-Mail und Telefon, egal wo sie stehen.
            </div>
            <textarea value={rohtext} onChange={e => setRohtext(e.target.value)} rows={6}
              placeholder={'Frank Mathick, KEMARIS, Finanzen, frank@beispiel.de\nAnna Beispiel; Volksbank; Firmenkunden\nMoritz (Events) moritz@beispiel.de'}
              aria-label="Kontaktliste einfügen"
              style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.6, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
              <span style={{ ...mikro, width: 56 }}>Nähe</span>
              {(Object.keys(NAEHE_META) as Naehe[]).map(n => (
                <Wahl key={n} an={importNaehe === n} farbe={NAEHE_META[n].farbe} onClick={() => setImportNaehe(n)}>{NAEHE_META[n].label}</Wahl>
              ))}
              <span style={{ ...mikro, width: 56, marginLeft: 6 }}>Wer hält</span>
              {(['kevin', 'malin', 'beide'] as const).map(p => (
                <Wahl key={p} an={importWer === p} farbe={LEUCHT.beziehung} onClick={() => setImportWer(p)}>{besitzerLabel(p)}</Wahl>
              ))}
              <input value={importQuelle} onChange={e => setImportQuelle(e.target.value)} placeholder="Woher? z. B. LinkedIn-Export"
                aria-label="Quelle" style={{ ...inline, flex: 1, minWidth: 150 }} />
            </div>

            {/* Vorschau — man sieht vorher, was ankommt */}
            {!!gelesen.length && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>
                    <b style={{ color: LEUCHT.gut }}>{neuDavon.length} neu</b>
                    {gelesen.length - neuDavon.length > 0 && <span style={{ color: C.inkLeise }}> · {gelesen.length - neuDavon.length} kennen wir schon</span>}
                  </span>
                  <span style={{ marginLeft: 'auto' }}><Knopf onClick={() => uebernehmen(neuDavon)} aus={!neuDavon.length} farbe={LEUCHT.beziehung}>✓ {neuDavon.length} übernehmen</Knopf></span>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <Liste>
                    {gelesen.slice(0, 60).map((r, i) => (
                      <div key={`${r.name}-${i}`} style={{ opacity: r.doppelt ? 0.45 : 1 }}>
                        <Zeile titel={r.name} unter={[r.firma, r.rolle, r.email, r.telefon].filter(Boolean).join(' · ') || '—'}
                          rechts={r.doppelt ? <Chip farbe={LEUCHT.achtung}>schon da</Chip> : undefined} />
                      </div>
                    ))}
                  </Liste>
                </div>
              </>
            )}
          </Karte>

          {/* Verlauf abgleichen */}
          <Karte i={3}>
            <Ueberschrift farbe={LEUCHT.puls} rechts={<Knopf leise onClick={verlaufPruefen} aus={verlaufBusy}>{verlaufBusy ? 'prüft …' : 'Belege suchen'}</Knopf>}>Verlauf abgleichen</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Setzt „zuletzt gesprochen" aus Postfach und Kalender.</div>
            {verlaufInfo && (
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>
                {verlaufInfo.geprueft} Kontakte geprüft · {verlaufInfo.ohneDatum} haben noch kein Datum.
                {verlauf && !verlauf.length && ' Keine neuen Belege — Postfach und Kalender geben zu diesen Kontakten nichts her.'}
              </div>
            )}
            {!!verlauf?.length && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}><b style={{ color: LEUCHT.gut }}>{verlauf.length} Belege</b> gefunden</span>
                  <span style={{ marginLeft: 'auto' }}><Knopf onClick={verlaufSetzen} aus={verlaufBusy} farbe={LEUCHT.puls}>✓ Daten übernehmen</Knopf></span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <Liste>
                    {verlauf.slice(0, 40).map((v, i) => (
                      <Zeile key={`${v.name}-${i}`}
                        links={<span style={{ fontSize: 12, color: LEUCHT.puls, minWidth: 74, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{v.datum}</span>}
                        titel={v.name} unter={`${v.woher} · ${v.beleg}`} />
                    ))}
                  </Liste>
                </div>
              </>
            )}
          </Karte>

          {/* Vom Mac */}
          <Karte i={4}>
            <Ueberschrift farbe={LEUCHT.beziehung} rechts={<Knopf leise onClick={macHolen} aus={macBusy}>{macBusy ? 'liest …' : mac ? '↻ neu lesen' : 'Kontakte lesen'}</Knopf>}>Kontakte-App</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Alles, was auf dem Mac und dem iPhone liegt.</div>

            {macFehler && (
              <div style={{ marginTop: 10, fontSize: TYP.bedien, color: LEUCHT.achtung, lineHeight: 1.5 }}>
                {macFehler}<br />
                <span style={{ color: C.inkLeise }}>Freigabe: Systemeinstellungen → Datenschutz &amp; Sicherheit → Kontakte → den Terminal-Eintrag aktivieren, dann neu lesen.</span>
              </div>
            )}

            {mac && (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0 8px' }}>
                  {([['geschaeftlich', 'geschäftlich'], ['privat', 'privat'], ['unklar', 'nur Name & Nummer'], ['alle', 'alle']] as const).map(([k, label]) => {
                    const n = mac.filter(m => k === 'alle' || m.art === k).length;
                    return (
                      <Wahl key={k} an={macArt === k} farbe={LEUCHT.beziehung} onClick={() => setMacArt(k)}>{label} <span style={{ color: C.inkLeise, fontWeight: 500 }}>{n}</span></Wahl>
                    );
                  })}
                  <span style={{ marginLeft: 'auto' }}><Knopf onClick={macUebernehmen} aus={!macAuswahl.length} farbe={LEUCHT.beziehung}>✓ {macAuswahl.length} übernehmen</Knopf></span>
                </div>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6, lineHeight: 1.5 }}>
                  Einordnung nach vorhandenen Daten: Firma oder Geschäftsadresse → geschäftlich, Freemail → privat.
                  Wer nur mit Name und Nummer drinsteht, bekommt das Stichwort <b style={{ color: C.inkDim }}>einsortieren</b> — den Rest macht ihr beim Durchgehen.
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <Liste>
                    {macAuswahl.slice(0, 50).map((m, i) => (
                      <Zeile key={`${m.name}-${i}`} titel={m.name} unter={[m.firma, m.rolle, m.email, m.telefon].filter(Boolean).join(' · ') || '—'} />
                    ))}
                  </Liste>
                  {macAuswahl.length > 50 && <div style={{ padding: '8px 2px', fontSize: 12, color: C.inkLeise }}>+{macAuswahl.length - 50} weitere — alle werden übernommen</div>}
                  {!macAuswahl.length && <Leer>In dieser Gruppe ist niemand Neues.</Leer>}
                </div>
              </>
            )}
          </Karte>

          {/* Aus dem Postfach */}
          <Karte i={5}>
            <Ueberschrift farbe={LEUCHT.beziehung} rechts={<Knopf leise onClick={postfachHolen} aus={vorschlagBusy}>{vorschlagBusy ? 'sucht …' : vorschlaege ? '↻ neu suchen' : 'Absender vorschlagen'}</Knopf>}>Aus dem Postfach</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wer euch schreibt, ist schon ein Kontakt.</div>
            {vorschlaege && (
              vorschlaege.length ? (
                <div style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
                  <Liste>
                    {vorschlaege.map(v => (
                      <Zeile key={v.email}
                        titel={<>{v.name} <span style={{ fontSize: 12, color: C.inkLeise, fontWeight: 400 }}>{v.anzahl}×</span></>}
                        unter={`${v.email} · ${v.betreff}`}
                        rechts={<Knopf leise onClick={() => vorschlagUebernehmen(v)}>+ übernehmen</Knopf>} />
                    ))}
                  </Liste>
                </div>
              ) : <Leer>Keine neuen Absender gefunden — entweder kennt ihr schon alle, oder der Postfach-Stand ist leer.</Leer>
            )}
          </Karte>
        </>
      )}

      {/* Filter: wer hält, suchen, Gruppen — bei hunderten Kontakten der eigentliche Einstieg */}
      <Karte i={nI}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['alle', 'kevin', 'malin', 'beide'] as const).map(p => (
            <Wahl key={p} an={wer === p} farbe={LEUCHT.beziehung} onClick={() => setWer(p)}>{p === 'alle' ? 'Jeder' : besitzerLabel(p)}</Wahl>
          ))}
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="suchen …" aria-label="Kontakte durchsuchen"
            style={{ ...inline, marginLeft: 'auto', flex: 1, minWidth: 140, maxWidth: 260 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          {([['alle', 'Alle'], ['geschaeftlich', 'Geschäftlich'], ['privat', 'Privat'], ['einsortieren', 'Einsortieren'], ['ohne-datum', 'Nie gesprochen']] as const).map(([k, label]) => (
            <Wahl key={k} an={gruppe === k} farbe={k === 'einsortieren' ? LEUCHT.achtung : LEUCHT.beziehung} onClick={() => { setGruppe(k); setSicht('kontakte'); }}>
              {label} <span style={{ color: C.inkLeise, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{gruppenZahl[k]}</span>
            </Wahl>
          ))}
        </div>
      </Karte>

      {!geladen && <Karte i={nI + 1}><Leer>lädt …</Leer></Karte>}

      {geladen && !kontakte.length && (
        <Karte i={nI + 1}>
          <div style={{ fontSize: TYP.body, fontWeight: 600, marginBottom: 6 }}>Noch niemand drin.</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, maxWidth: 480 }}>
            Fangt mit den zwanzig wichtigsten an — die, bei denen euch sofort etwas einfällt.
            Oben eintippen, Nähe setzen, kurz notieren was ihr wisst. Alles Weitere wächst daran.
          </div>
        </Karte>
      )}

      {/* ── LIEGT LIEGEN: der Geldhebel ── */}
      {geladen && !!kontakte.length && sicht === 'liegt' && (
        <Karte i={nI + 1}>
          <Ueberschrift farbe={liegt.length ? LEUCHT.achtung : LEUCHT.gut} rechts={liegt.length ? `${liegt.length} offen` : undefined}>Was hinten runterfällt</Ueberschrift>
          {liegt.length ? (
            <>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 4 }}>Dringendstes zuerst. Jede Zeile ist Geld oder eine Beziehung, die gerade kalt wird.</div>
              <Liste>
                {liegt.slice(0, 40).map((l, i) => {
                  const farbe = l.art === 'schritt-faellig' ? LEUCHT.kritisch : l.art === 'ohne-schritt' ? LEUCHT.achtung : C.inkLeise;
                  return (
                    <Zeile key={`${l.kontaktId}-${l.chanceId ?? l.art}-${i}`}
                      onClick={() => { setSicht('kontakte'); setOffen(l.kontaktId); }}
                      links={<Punkt farbe={farbe} />}
                      titel={<span style={{ whiteSpace: 'normal', fontWeight: 500, color: C.inkDim, lineHeight: 1.4 }}>{l.text}</span>}
                      rechts={<span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>öffnen ›</span>} />
                  );
                })}
              </Liste>
              {liegt.length > 40 && <div style={{ padding: '10px 2px 0', fontSize: 12, color: C.inkLeise }}>+{liegt.length - 40} weitere</div>}
            </>
          ) : (
            <Leer>Nichts liegen geblieben. Jede Chance hat einen nächsten Schritt, kein Kontakt ist zu lange still. 🎯</Leer>
          )}
        </Karte>
      )}

      {/* ── PIPELINE: nach Stufen ── */}
      {geladen && !!kontakte.length && sicht === 'pipeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'start' }}>
          {STUFEN.filter(s => s.id !== 'verloren').map((s, si) => {
            const drin = chancen.filter(c => c.stufe === s.id);
            const summe = drin.reduce((sum, c) => sum + (c.wert ?? 0), 0);
            return (
              <Karte key={s.id} i={nI + 1 + si}>
                <Ueberschrift farbe={s.farbe} rechts={drin.length ? String(drin.length) : undefined}>{s.label}</Ueberschrift>
                {!!summe && <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>{eur(summe)}</div>}
                <Liste>
                  {drin.map(c => (
                    <Zeile key={c.id} onClick={() => { setSicht('kontakte'); setOffen(c.kontaktId); }}
                      titel={c.titel}
                      unter={<>
                        {nameVon(c.kontaktId)}{c.wert ? ` · ${eur(c.wert)}` : ''}
                        {c.naechsterSchritt
                          ? <span style={{ color: c.faellig && c.faellig < heute ? LEUCHT.kritisch : C.inkDim }}> · → {c.naechsterSchritt}{c.faellig ? ` (${tag(c.faellig)})` : ''}</span>
                          : <span style={{ color: LEUCHT.achtung }}> · → kein nächster Schritt</span>}
                      </>} />
                  ))}
                </Liste>
                {!drin.length && <Leer>leer</Leer>}
              </Karte>
            );
          })}
        </div>
      )}

      {/* ── KONTAKTE ── */}
      {geladen && !!kontakte.length && sicht === 'kontakte' && (
        <Karte i={nI + 1}>
          <Ueberschrift farbe={LEUCHT.beziehung} rechts={`${sichtbar.length} von ${kontakte.length}`}>Kontakte</Ueberschrift>
          <Liste>
            {sichtbar.map(k => karte(k))}
            {!sichtbar.length && <Leer>Kein Treffer.</Leer>}
          </Liste>
        </Karte>
      )}

      <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>
        Euer Netzwerk — liegt lokal, gehört euch. Nähe bestimmt den Melde-Takt: eng 30 · warm 90 · lose 180 Tage.
      </div>
    </Seite>
  );
}
