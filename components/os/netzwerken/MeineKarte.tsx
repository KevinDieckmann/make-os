'use client';
// ─── Netzwerken · Meine Visitenkarten (02.10., Paket B) ─────────────────────────
// Unterwegs die eigene Karte zeigen: oben „Unterwegs für: <Profil>“ (je Firma, für die man gerade unterwegs ist — gemerkt),
// darunter groß die Karte mit dem QR-Code (vCard 3.0, Kontakt speichern beim Scannen), „Vollbild“ und „vCard teilen“.
// Jedes Profil trägt sein eigenes Firmen-Design (Logo, Farben, Schrift) — die Karte und das Vollbild zeigen nur dieses Design,
// nie MAKE (QrKarte.tsx). Profile anlegen/bearbeiten/löschen/sortieren; „aus meinem Konto übernehmen“; die Inhaberin/der Inhaber
// kann Profile für andere Personen des Haushalts vorbereiten („für Malin anlegen“). Daten: karten-daten.ts → /api/netzwerken/karten.
// Am Handy (375 px): eine Spalte, alle Ziele ≥ 44 px, Eingaben 16 px (kein Zoom beim Antippen in Safari).

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Maximize2, Pencil, Share2, IdCard } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, TIEF } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Leer, Knopf, Chip, LEUCHT } from '../schlank';
import { neueKennung } from '@/lib/kennung';
import {
  FELD_LABEL, KARTEN_TEXTFELDER, MAX_KARTEN, SCHRIFTEN, SCHRIFT_LABEL, STANDARD_DESIGN, kartenName, kartenTitel, kontrastWarnungen, nameAusKonto, nachRang,
  vcard, vcardDateiname, hexNorm, LOGO_MAX, type KartenSchrift, type KartenTextfeld, type KarteMitStand, type Visitenkarte,
} from '@/lib/netzwerken/karte';
import { saeubereSvg } from '@/lib/netzwerken/svg';
import { KartenAnsicht, QrVollbild } from './QrKarte';
import { Leerzustand } from './bausteine';
import { aktivLesen, aktivMerken, useKarten, type Gesellschaftsvorschlag } from './karten-daten';

const MIN = 44; // kleinstes Ziel am Handy
const eingabe: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: MIN, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '10px 14px',
  color: C.ink, fontFamily: SCHRIFT.text, fontSize: 16, outline: 'none',
};
const knopfStil: CSSProperties = {
  minHeight: MIN, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: C.ink,
  fontFamily: SCHRIFT.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none',
};
const klein: CSSProperties = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 };

/** Ein Entwurf im Formular: alle Textfelder als Text, Design-Felder leer = Standard. */
type Entwurf = Record<KartenTextfeld, string> & { farbe: string; hintergrund: string; textfarbe: string; schrift: KartenSchrift | ''; logo: string };
const leererEntwurf = (): Entwurf => ({ ...(Object.fromEntries(KARTEN_TEXTFELDER.map(f => [f, ''])) as Record<KartenTextfeld, string>), farbe: '', hintergrund: '', textfarbe: '', schrift: '', logo: '' });
const entwurfAus = (k: Visitenkarte): Entwurf => ({ ...leererEntwurf(), ...(Object.fromEntries(KARTEN_TEXTFELDER.map(f => [f, k[f] ?? ''])) as Record<KartenTextfeld, string>), farbe: k.farbe ?? '', hintergrund: k.hintergrund ?? '', textfarbe: k.textfarbe ?? '', schrift: k.schrift ?? '', logo: k.logo ?? '' });
/** Der Entwurf als Profil (für Vorschau und Speichern) — leere Felder fallen weg. */
function karteAus(e: Entwurf, id: string, rang: number): Visitenkarte {
  const k: Visitenkarte = { id, rang };
  for (const f of KARTEN_TEXTFELDER) { const t = e[f].trim(); if (t) k[f] = t; }
  if (e.farbe) k.farbe = e.farbe;
  if (e.hintergrund) k.hintergrund = e.hintergrund;
  if (e.textfarbe) k.textfarbe = e.textfarbe;
  if (e.schrift && e.schrift !== 'system') k.schrift = e.schrift;
  if (e.logo) k.logo = e.logo;
  return k;
}

// ── Logo vorbereiten (Browser) ───────────────────────────────────────────────

const alsDataUrl = (bytes: ArrayBuffer, typ: string): string => { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return `data:${typ};base64,${btoa(s)}`; };
const lesenText = (f: File): Promise<string> => new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => nein(new Error('lesen')); r.readAsText(f); });
const lesenBytes = (f: File): Promise<ArrayBuffer> => new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(r.result as ArrayBuffer); r.onerror = () => nein(new Error('lesen')); r.readAsArrayBuffer(f); });

/** Eine Logo-Datei als Data-URL für das Profil — SVG gesäubert, Raster bei Bedarf verkleinert. Der Server prüft alles noch einmal. */
async function logoVorbereiten(datei: File): Promise<{ ok: true; logo: string } | { ok: false; fehler: string }> {
  const typ = datei.type || (datei.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : '');
  try {
    if (typ === 'image/svg+xml') {
      const sauber = saeubereSvg(await lesenText(datei));
      if (!sauber) return { ok: false, fehler: 'Dieses SVG enthält nichts, was als Logo gezeigt werden kann (nur Formen und Text sind erlaubt).' };
      const logo = alsDataUrl(new TextEncoder().encode(sauber).buffer as ArrayBuffer, 'image/svg+xml');
      return logo.length > LOGO_MAX ? { ok: false, fehler: 'Das Logo ist zu groß (höchstens etwa 200 KB).' } : { ok: true, logo };
    }
    if (!/^image\/(png|jpeg|webp)$/.test(typ)) return { ok: false, fehler: 'Bitte ein SVG-, PNG-, JPG- oder WebP-Bild wählen.' };
    const roh = alsDataUrl(await lesenBytes(datei), typ);
    if (roh.length <= 150_000) return { ok: true, logo: roh };
    // Zu groß: auf höchstens 600 px Kantenlänge verkleinern (PNG behält Transparenz).
    const bild = await new Promise<HTMLImageElement>((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nein(new Error('bild')); i.src = roh; });
    const f = Math.min(1, 600 / Math.max(bild.naturalWidth, bild.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bild.naturalWidth * f)); c.height = Math.max(1, Math.round(bild.naturalHeight * f));
    c.getContext('2d')?.drawImage(bild, 0, 0, c.width, c.height);
    const klein = typ === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png');
    return klein.length <= LOGO_MAX ? { ok: true, logo: klein } : { ok: false, fehler: 'Das Bild ist auch verkleinert zu groß — bitte ein SVG oder ein einfacheres Bild wählen.' };
  } catch { return { ok: false, fehler: 'Die Datei konnte nicht gelesen werden.' }; }
}

// ── Kleine Bausteine ─────────────────────────────────────────────────────────

function FeldZeile({ label, children, hinweis }: { label: string; children: ReactNode; hinweis?: string }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, color: C.inkDim, fontWeight: 600 }}>{label}</span>
      {children}
      {hinweis && <span style={klein}>{hinweis}</span>}
    </label>
  );
}

/** Farbfeld: Farbwähler + Hex-Text; leer = Standard (neutral). */
function FarbFeld({ label, wert, standard, onWahl }: { label: string; wert: string; standard: string; onWahl: (hex: string) => void }) {
  const [text, setText] = useState(wert);
  useEffect(() => setText(wert), [wert]);
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <span style={{ fontSize: 12.5, color: C.inkDim, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" aria-label={`${label} wählen`} value={hexNorm(wert) ?? standard} onChange={e => onWahl(e.target.value)}
          style={{ width: MIN, height: MIN, padding: 2, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', flex: '0 0 auto' }} />
        <input value={text} placeholder={`Standard ${standard}`} aria-label={`${label} als Hex-Wert`} autoCapitalize="off" autoCorrect="off" spellCheck={false}
          onChange={e => { setText(e.target.value); const h = hexNorm(e.target.value); if (h) onWahl(h); else if (!e.target.value.trim()) onWahl(''); }} style={{ ...eingabe, flex: 1, minWidth: 0 }} />
        {wert && <button type="button" onClick={() => onWahl('')} aria-label={`${label} zurücksetzen`} title="Standard" style={{ ...knopfStil, padding: 0, width: MIN, flex: '0 0 auto' }}>×</button>}
      </div>
    </div>
  );
}

// ── Formular ─────────────────────────────────────────────────────────────────

function Formular({ start, titel, konto, gesellschaften, onSpeichern, onAbbruch }: {
  start: Entwurf; titel: string; konto: { name: string; email: string } | null; gesellschaften: Gesellschaftsvorschlag[];
  onSpeichern: (e: Entwurf) => Promise<string | null>; onAbbruch: () => void;
}) {
  const [e, setE] = useState<Entwurf>(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const set = <K extends keyof Entwurf>(k: K, v: Entwurf[K]) => setE(x => ({ ...x, [k]: v }));
  const text = (f: KartenTextfeld, opt: { typ?: string; modus?: 'email' | 'tel' | 'url' | 'text'; auto?: string } = {}) => (
    <FeldZeile label={FELD_LABEL[f]} key={f}>
      <input value={e[f]} onChange={ev => set(f, ev.target.value)} type={opt.typ ?? 'text'} inputMode={opt.modus} autoComplete={opt.auto ?? 'off'}
        autoCapitalize={opt.modus && opt.modus !== 'text' ? 'off' : 'words'} autoCorrect="off" spellCheck={false} aria-label={FELD_LABEL[f]} style={eingabe} />
    </FeldZeile>
  );
  const warnungen = kontrastWarnungen({ hintergrund: e.hintergrund || undefined, textfarbe: e.textfarbe || undefined, farbe: e.farbe || undefined, schrift: undefined });
  const vorschau = karteAus(e, 'v-vorschau', 0);
  const ausKonto = () => { if (!konto) return; const n = nameAusKonto(konto.name); setE(x => ({ ...x, vorname: n.vorname, nachname: n.nachname, email: konto.email })); };
  const ausGesellschaft = (g: Gesellschaftsvorschlag) => setE(x => ({ ...x, firma: g.firma, strasse: g.strasse || x.strasse, plz: g.plz || x.plz, ort: g.ort || x.ort, land: g.land || x.land, web: x.web || g.web, telefon: x.telefon || g.telefon }));
  const logoWahl = async (datei: File | undefined) => {
    if (!datei) return;
    const r = await logoVorbereiten(datei);
    if (r.ok) { set('logo', r.logo); setFehler(null); } else setFehler(r.fehler);
  };
  const speichern = async () => {
    if (laeuft) return;
    setLaeuft(true); setFehler(null);
    const f = await onSpeichern(e);
    setLaeuft(false);
    if (f) setFehler(f);
  };

  return (
    <Karte i={2}>
      <Ueberschrift>{titel}</Ueberschrift>
      <div style={{ display: 'grid', gap: 14 }}>
        {konto && <button type="button" onClick={ausKonto} style={{ ...knopfStil, justifySelf: 'start' }}>Aus meinem Konto übernehmen</button>}
        <FeldZeile label={FELD_LABEL.bezeichnung} hinweis="So heißt das Profil im Umschalter „Unterwegs für“ — leer: die Firma.">
          <input value={e.bezeichnung} onChange={ev => set('bezeichnung', ev.target.value)} aria-label={FELD_LABEL.bezeichnung} style={eingabe} />
        </FeldZeile>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>{text('vorname', { auto: 'given-name' })}{text('nachname', { auto: 'family-name' })}</div>
        {text('rolle', { auto: 'organization-title' })}
        {text('firma', { auto: 'organization' })}
        {gesellschaften.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={klein}>Firma übernehmen:</span>
            {gesellschaften.map(g => <button key={g.id} type="button" onClick={() => ausGesellschaft(g)} style={{ ...knopfStil, minHeight: MIN, fontSize: 13.5 }}>{g.firma}</button>)}
          </div>
        )}
        {text('email', { typ: 'email', modus: 'email', auto: 'email' })}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>{text('handy', { typ: 'tel', modus: 'tel', auto: 'tel' })}{text('telefon', { typ: 'tel', modus: 'tel' })}</div>
        {text('web', { typ: 'url', modus: 'url', auto: 'url' })}
        {text('linkedin', { typ: 'url', modus: 'url' })}
        <div style={{ ...klein, marginTop: 2 }}>Anschrift (optional)</div>
        {text('strasse', { auto: 'street-address' })}
        <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 12 }}>{text('plz', { auto: 'postal-code', modus: 'text' })}{text('ort', { auto: 'address-level2' })}</div>
        {text('land', { auto: 'country-name' })}

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 14, display: 'grid', gap: 14 }}>
          <div style={{ fontSize: TYP.body, fontWeight: 700 }}>Design dieses Profils</div>
          <div style={klein}>Alles optional — ohne Auswahl bleibt die Karte neutral (weiß, schwarz, Systemschrift). Nur dieses Design erscheint auf der Karte und im Vollbild.</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: C.inkDim, fontWeight: 600 }}>Logo (SVG, PNG, JPG · bis etwa 200 KB)</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {e.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- Data-URL des Profils
                <img src={e.logo} alt="Gewähltes Logo" style={{ maxHeight: 44, maxWidth: 160, background: e.hintergrund || STANDARD_DESIGN.hintergrund, borderRadius: 8, padding: 6, objectFit: 'contain' }} />
              )}
              <label style={{ ...knopfStil, cursor: 'pointer' }}>
                {e.logo ? 'Logo ersetzen' : 'Logo wählen'}
                <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg" aria-label="Logo-Datei wählen" onChange={ev => { void logoWahl(ev.target.files?.[0]); ev.target.value = ''; }} style={{ display: 'none' }} />
              </label>
              {e.logo && <button type="button" onClick={() => set('logo', '')} style={knopfStil}>Logo entfernen</button>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <FarbFeld label="Hintergrundfarbe" wert={e.hintergrund} standard={STANDARD_DESIGN.hintergrund} onWahl={v => set('hintergrund', v)} />
            <FarbFeld label="Textfarbe" wert={e.textfarbe} standard={STANDARD_DESIGN.text} onWahl={v => set('textfarbe', v)} />
            <FarbFeld label="Akzentfarbe" wert={e.farbe} standard={STANDARD_DESIGN.akzent} onWahl={v => set('farbe', v)} />
          </div>
          <FeldZeile label="Schrift">
            <select value={e.schrift || 'system'} onChange={ev => set('schrift', ev.target.value === 'system' ? '' : (ev.target.value as KartenSchrift))} aria-label="Schrift" style={{ ...eingabe, appearance: 'auto' }}>
              {SCHRIFTEN.map(s => <option key={s} value={s}>{SCHRIFT_LABEL[s]}</option>)}
            </select>
          </FeldZeile>
          {warnungen.map(w => <div key={w} role="alert" style={{ fontSize: 13, color: LEUCHT.achtung, lineHeight: 1.45 }}>⚠ {w}</div>)}
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={klein}>So sieht die Karte aus:</span>
            <KartenAnsicht karte={vorschau} />
          </div>
        </div>

        {fehler && <div role="alert" style={{ fontSize: 13.5, color: LEUCHT.kritisch, lineHeight: 1.45 }}>{fehler}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void speichern()} disabled={laeuft} style={{ ...knopfStil, background: `${C.aktiv}22`, border: `1px solid ${C.aktiv}66`, color: C.aktiv, flex: '1 1 160px' }}>{laeuft ? 'Speichert …' : 'Speichern'}</button>
          <button type="button" onClick={onAbbruch} style={{ ...knopfStil, flex: '0 1 auto' }}>Abbrechen</button>
        </div>
      </div>
    </Karte>
  );
}

// ── Seite ────────────────────────────────────────────────────────────────────

/** Teilen: Web Share API mit .vcf-Datei, sonst Download. Muss direkt aus dem Klick heraus laufen (Safari). */
async function teilen(k: Visitenkarte, melde: (t: string) => void): Promise<void> {
  const datei = new File([vcard(k, { falten: true, mitLogo: true })], vcardDateiname(k), { type: 'text/vcard' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.share && nav.canShare?.({ files: [datei] })) { await nav.share({ files: [datei], title: kartenName(k) || k.firma || 'Visitenkarte' }); return; }
  } catch (e) { if ((e as Error)?.name === 'AbortError') return; /* sonst: Download */ }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url; a.download = datei.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  melde('Die vCard-Datei wurde heruntergeladen.');
}

export function MeineKarte() {
  const [fuer, setFuer] = useState<string | null>(null);
  const d = useKarten(fuer);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState<{ id: string | null; start: Entwurf } | null>(null);
  const [vollbild, setVollbild] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);
  useEffect(() => { if (!fuer) setAktivId(aktivLesen()); }, [fuer]);
  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 5000); return () => clearTimeout(t); }, [meldung]);

  const karten = d.karten;
  const aktiv: KarteMitStand | undefined = karten.find(k => k.id === aktivId) ?? karten[0];
  const waehlen = (id: string) => { setAktivId(id); if (!fuer) aktivMerken(id); setLoeschen(null); };
  const andere = d.fuerAndere ? d.personen.find(p => p.person === d.person)?.name.split(' ')[0] : undefined;
  const warnungen = useMemo(() => (aktiv ? kontrastWarnungen(aktiv) : []), [aktiv]);

  const speichern = async (e: Entwurf): Promise<string | null> => {
    const alt = bearbeiten?.id ? karten.find(k => k.id === bearbeiten.id) : undefined;
    const id = alt?.id ?? neueKennung('v');
    const rang = alt?.rang ?? (karten.length ? Math.max(...karten.map(k => k.rang)) + 1 : 0);
    const r = await d.schreiben([{ op: 'upsert', eintrag: karteAus(e, id, rang), ...(alt ? { stand: alt.stand } : {}) }]);
    if (!r.ok) return r.fehler ?? 'Nicht gespeichert.';
    waehlen(id); setBearbeiten(null); setMeldung('Gespeichert.');
    return null;
  };
  const neu = (vorbelegt: boolean) => {
    const e = leererEntwurf();
    if (vorbelegt && d.konto) { const n = nameAusKonto(d.konto.name); e.vorname = n.vorname; e.nachname = n.nachname; e.email = d.konto.email; }
    setBearbeiten({ id: null, start: e });
  };
  const verschieben = async (id: string, richtung: -1 | 1) => {
    const liste = nachRang(karten);
    const i = liste.findIndex(k => k.id === id), j = i + richtung;
    if (i < 0 || j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
    const ops = liste.flatMap((k, n) => (k.rang !== n ? [{ op: 'teil' as const, id: k.id, felder: { rang: n }, stand: k.stand }] : []));
    const r = await d.schreiben(ops);
    if (!r.ok) setMeldung(r.fehler ?? 'Nicht gespeichert.');
  };
  const entfernen = async (k: KarteMitStand) => {
    const r = await d.schreiben([{ op: 'delete', id: k.id, stand: k.stand }]);
    setLoeschen(null);
    setMeldung(r.ok ? 'Profil gelöscht.' : r.fehler ?? 'Nicht gelöscht.');
  };

  const personenWahl = d.personen.length > 1 && (
    <div role="group" aria-label="Profile von" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={klein}>Profile von:</span>
      {d.personen.map(p => {
        const an = (p.ich && !fuer) || p.person === fuer;
        return <button key={p.person} type="button" aria-pressed={an} onClick={() => { setFuer(p.ich ? null : p.person); setBearbeiten(null); setAktivId(null); }}
          style={{ ...knopfStil, ...(an ? { background: `${C.aktiv}22`, border: `1px solid ${C.aktiv}66`, color: C.aktiv } : {}) }}>{p.ich ? 'Ich' : p.name.split(' ')[0]}</button>;
      })}
    </div>
  );

  // Beim Wechsel der Person bleibt die Auswahl stehen — nur der Inhalt darunter lädt neu.
  // Ladezustand mit festem Platz: ein grauer Kartenumriss in der Größe der echten Karte — nichts springt, wenn sie da ist.
  if (!d.geladen) return (
    <Seite titel="Meine Visitenkarten">
      <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto', width: '100%' }}>
        {personenWahl}
        <div role="status" aria-label="Lädt" style={{ display: 'grid', gap: 12 }}>
          <div aria-hidden style={{ height: 40, width: '62%', borderRadius: 12, background: 'rgba(255,255,255,.04)' }} />
          <div aria-hidden style={{ height: 470, borderRadius: 22, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.05)' }} />
          <div aria-hidden style={{ height: 56, borderRadius: 16, background: 'rgba(255,255,255,.04)' }} />
        </div>
      </div>
    </Seite>
  );
  if (d.fehler && !karten.length) return <Seite titel="Meine Visitenkarten"><Karte i={0}><Leer>{d.fehler}</Leer></Karte></Seite>;

  return (
    <Seite titel="Meine Visitenkarten" unter="Der QR-Code für unterwegs — wer ihn scannt, hat dich als Kontakt.">
      <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto', width: '100%' }}>
        {personenWahl}
        {d.fuerAndere && <div style={{ ...klein, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>Du bearbeitest die Profile von {andere ?? 'einer anderen Person'} — sie erscheinen dort unter „Meine Visitenkarte“.</div>}
        {d.offline && <div role="status" style={{ ...klein, color: LEUCHT.achtung }}>Offline-Stand auf diesem Gerät — der Code funktioniert, Bearbeiten ist erst mit Verbindung möglich.</div>}
        {meldung && <div role="status" style={{ fontSize: 13.5, color: LEUCHT.gut }}>{meldung}</div>}

        {karten.length > 0 && aktiv && (
          <>
            {/* Umschalter „Unterwegs für“ */}
            <div>
              <div style={{ ...klein, marginBottom: 6, fontWeight: 600 }}>Unterwegs für:</div>
              <div role="tablist" aria-label="Unterwegs für" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
                {nachRang(karten).map(k => {
                  const an = k.id === aktiv.id;
                  return <button key={k.id} role="tab" aria-selected={an} type="button" onClick={() => waehlen(k.id)}
                    style={{ ...knopfStil, flex: '0 0 auto', whiteSpace: 'nowrap', ...(an ? { background: `${C.aktiv}22`, border: `1px solid ${C.aktiv}66`, color: C.aktiv } : {}) }}>
                    <span aria-hidden style={{ width: 12, height: 12, borderRadius: 4, flex: '0 0 auto', background: k.hintergrund ?? STANDARD_DESIGN.hintergrund, border: `3px solid ${k.farbe ?? STANDARD_DESIGN.akzent}`, boxSizing: 'border-box', outline: '1px solid rgba(255,255,255,.2)' }} />{kartenTitel(k)}</button>;
                })}
              </div>
            </div>

            <KartenAnsicht karte={aktiv} />
            {warnungen.length > 0 && <div role="alert" style={{ fontSize: 13, color: LEUCHT.achtung, lineHeight: 1.45 }}>⚠ {warnungen[0]} Unter „Bearbeiten“ anpassen.</div>}

            {/* Eine Hauptaktion: der Code groß auf den Bildschirm. Teilen und Bearbeiten sind leiser. */}
            <button type="button" onClick={() => setVollbild(true)} className="fassbar" style={{ ...knopfStil, minHeight: 56, fontSize: 17, fontWeight: 700, borderRadius: 16, ...TIEF.knopf(C.aktiv) }}><Maximize2 size={20} aria-hidden />Vollbild zeigen</button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <button type="button" onClick={() => void teilen(aktiv, setMeldung)} style={knopfStil}><Share2 size={16} aria-hidden />vCard teilen</button>
              <button type="button" onClick={() => setBearbeiten({ id: aktiv.id, start: entwurfAus(aktiv) })} disabled={d.offline} style={{ ...knopfStil, ...(d.offline ? { opacity: 0.5 } : {}) }}><Pencil size={16} aria-hidden />Bearbeiten</button>
            </div>
            <div style={klein}>Der QR-Code enthält nur die Angaben dieses Profils — Kontaktprogramm des Handys öffnet „Kontakt speichern“.</div>
          </>
        )}

        {karten.length === 0 && !bearbeiten && (
          <Leerzustand symbol={<IdCard size={26} />} titel={d.fuerAndere ? `Noch keine Karte für ${andere ?? 'diese Person'}` : 'Noch keine Visitenkarte'}
            aktion={<button type="button" onClick={() => neu(true)} className="fassbar" style={{ ...knopfStil, width: '100%', minHeight: 52, fontSize: 16, fontWeight: 700, borderRadius: 14, ...TIEF.knopf(C.aktiv) }}>Erstes Profil anlegen</button>}>
            Lege ein Profil an — z. B. eins je Firma, für die du unterwegs bist. Name, Rolle und Erreichbarkeit trägst du selbst ein; sie liegen nur in deinem Konto. Danach zeigst du den QR-Code mit einem Tipp im Vollbild.
          </Leerzustand>
        )}

        {bearbeiten && (
          <Formular key={bearbeiten.id ?? 'neu'} start={bearbeiten.start} titel={bearbeiten.id ? 'Profil bearbeiten' : d.fuerAndere ? `Neues Profil für ${andere ?? 'die Person'}` : 'Neues Profil'}
            konto={d.konto} gesellschaften={d.gesellschaften} onSpeichern={speichern} onAbbruch={() => setBearbeiten(null)} />
        )}

        {karten.length > 0 && (
          <Karte i={3}>
            <Ueberschrift rechts={<span style={{ fontSize: 12.5, color: C.inkLeise }}>{karten.length} von {MAX_KARTEN}</span>}>Meine Profile</Ueberschrift>
            <div style={{ display: 'grid', gap: 2 }}>
              {nachRang(karten).map((k, i, alle) => (
                <div key={k.id} style={{ display: 'grid', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, flex: '0 0 auto', background: k.hintergrund ?? STANDARD_DESIGN.hintergrund, border: `3px solid ${k.farbe ?? STANDARD_DESIGN.akzent}` }} />
                    <button type="button" onClick={() => waehlen(k.id)} style={{ flex: 1, minWidth: 0, minHeight: MIN, background: 'none', border: 'none', color: C.ink, textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kartenTitel(k)}{aktiv && k.id === aktiv.id && <span style={{ marginLeft: 8 }}><Chip farbe={C.aktiv}>gezeigt</Chip></span>}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setBearbeiten({ id: k.id, start: entwurfAus(k) })} disabled={d.offline} style={knopfStil}>Bearbeiten</button>
                    <button type="button" aria-label={`${kartenTitel(k)} nach oben`} disabled={i === 0 || d.offline} onClick={() => void verschieben(k.id, -1)} style={{ ...knopfStil, width: MIN, padding: 0, ...(i === 0 ? { opacity: 0.4 } : {}) }}>↑</button>
                    <button type="button" aria-label={`${kartenTitel(k)} nach unten`} disabled={i === alle.length - 1 || d.offline} onClick={() => void verschieben(k.id, 1)} style={{ ...knopfStil, width: MIN, padding: 0, ...(i === alle.length - 1 ? { opacity: 0.4 } : {}) }}>↓</button>
                    {loeschen === k.id
                      ? <><Knopf farbe={LEUCHT.kritisch} onClick={() => entfernen(k)}>Wirklich löschen</Knopf><button type="button" onClick={() => setLoeschen(null)} style={knopfStil}>Behalten</button></>
                      : <button type="button" onClick={() => setLoeschen(k.id)} disabled={d.offline} style={{ ...knopfStil, color: LEUCHT.kritisch }}>Löschen</button>}
                  </div>
                </div>
              ))}
            </div>
            {karten.length < MAX_KARTEN && !bearbeiten && !d.offline && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <button type="button" onClick={() => neu(false)} style={knopfStil}>+ Neues Profil</button>
                <button type="button" onClick={() => neu(true)} style={knopfStil}>Aus meinem Konto übernehmen</button>
              </div>
            )}
          </Karte>
        )}
      </div>
      {vollbild && aktiv && <QrVollbild karte={aktiv} onZu={() => setVollbild(false)} />}
    </Seite>
  );
}
