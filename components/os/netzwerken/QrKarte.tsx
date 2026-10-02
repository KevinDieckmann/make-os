'use client';
// ─── Netzwerken · die Karte mit QR-Code (02.10., Paket B) ───────────────────────
// Zwei Ansichten desselben Profils — Karte (in der Seite) und Vollbild — und beide zeigen NUR das Design des Profils:
// Logo, Hintergrund-, Text- und Akzentfarbe, Schrift, Name, Rolle, Firma, QR. Kein MAKE-Logo, kein MAKE-Name, keine
// MAKE-Farben und keine App-Token (diese Datei importiert bewusst nichts aus lib/make-one/design.ts); wo ein Profil
// nichts wählt, gilt das neutrale Standard-Design (weiß/schwarz, Systemschrift). Die App-Leiste ist im Vollbild verdeckt.
//
// Der QR-Code steht IMMER dunkel auf weißem Feld mit ruhiger Zone (4 Module) und Rand — gleich, welche Hintergrundfarbe
// das Profil hat — und bleibt so bei voller Helligkeit und aus 50 cm scanbar. Er entsteht im Browser
// (lib/netzwerken/qr.ts), die vCard (lib/netzwerken/karte.ts) enthält nur die gesetzten Felder, nie das Design.
// Vollbild: Bildschirm bleibt wach (Wake Lock, wo der Browser es kann), Esc oder „Schließen“ beendet.
//
// Schliff 03.10.: ruhiger Verlauf in den Profilfarben (Hintergrund → oben etwas heller, unten etwas dunkler, Mischung per
// color-mix) und beim Öffnen EIN Lichtschimmer (≈ 1 s, CSS, bei „Bewegung reduzieren“ aus). Der Schimmer läuft hinter dem
// QR-Feld her: Logo und Name liegen darunter, das Feld darüber — der Code bleibt unberührt, dunkel auf weiß, scanbar.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { qrPfad } from '@/lib/netzwerken/qr';
import { vcard, kartenName, kartenDesign, leuchtdichte, type Visitenkarte } from '@/lib/netzwerken/karte';

/** Ruhiger Verlauf aus der Hintergrundfarbe des Profils: oben ein Hauch heller, unten ein Hauch dunkler — nie eine neue Farbe. */
function verlauf(hintergrund: string, stark: boolean): string {
  const hell = stark ? 14 : 8, dunkel = stark ? 16 : 8;
  return `radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, ${hintergrund} ${100 - hell - 4}%, #fff) 0%, transparent 62%), linear-gradient(165deg, color-mix(in srgb, ${hintergrund} ${100 - hell}%, #fff) 0%, ${hintergrund} 46%, color-mix(in srgb, ${hintergrund} ${100 - dunkel}%, #000) 100%)`;
}

/** Das SVG des Codes — skaliert auf die Breite des Elternelements. */
export function QrBild({ karte, stil }: { karte: Visitenkarte; stil?: CSSProperties }) {
  const text = useMemo(() => vcard(karte), [karte]);
  const q = useMemo(() => { try { return qrPfad(text); } catch { return null; } }, [text]);
  if (!q) return <div role="alert" style={{ padding: 16, color: '#b00020', fontSize: 13, background: '#fff' }}>Zu viele Angaben für einen QR-Code — bitte Anschrift oder Rolle kürzen.</div>;
  return (
    <svg role="img" aria-label={`QR-Code der Visitenkarte von ${kartenName(karte) || karte.firma || 'diesem Profil'}`} data-testid="qr" data-module={q.module} viewBox={`0 0 ${q.n} ${q.n}`} shapeRendering="crispEdges"
      style={{ display: 'block', width: '100%', height: 'auto', background: '#fff', ...stil }}>
      <rect width={q.n} height={q.n} fill="#ffffff" />
      <path d={q.pfad} fill="#000000" />
    </svg>
  );
}

/** Das weiße Feld um den Code, abgesetzt durch die Akzentfarbe des Profils. */
function QrFeld({ karte, breite }: { karte: Visitenkarte; breite: string }) {
  const d = kartenDesign(karte);
  return (
    <div style={{ width: breite, maxWidth: '100%', background: '#ffffff', borderRadius: 18, padding: 10, border: `3px solid ${d.akzent}`, boxShadow: '0 10px 30px -12px rgba(0,0,0,.45)', boxSizing: 'border-box' }}>
      <QrBild karte={karte} />
    </div>
  );
}

/** Das Logo des Profils (Bild, nie Text) — begrenzt in Höhe und Breite. */
function Logo({ karte, hoehe }: { karte: Visitenkarte; hoehe: number }) {
  if (!karte.logo) return null;
  // eslint-disable-next-line @next/next/no-img-element -- Data-URL des Profils, kein Netzwerkbild
  return <img src={karte.logo} alt={karte.firma ? `Logo ${karte.firma}` : 'Logo'} style={{ display: 'block', maxHeight: hoehe, maxWidth: '78%', width: 'auto', height: 'auto', objectFit: 'contain' }} />;
}

/** Name · Rolle · Firma unter dem Code. */
function Namen({ karte, gross, kontakt }: { karte: Visitenkarte; gross?: boolean; kontakt?: boolean }) {
  const name = kartenName(karte);
  const zweite = [karte.rolle, karte.firma].filter(Boolean).join(' · ');
  const wege = kontakt ? [karte.handy, karte.email].filter(Boolean) : [];
  return (
    <div style={{ textAlign: 'center', maxWidth: '100%' }}>
      {name && <div style={{ fontSize: gross ? 'clamp(24px, 6.4vw, 32px)' : 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{name}</div>}
      {zweite && <div style={{ fontSize: gross ? 'clamp(15px, 4vw, 19px)' : 14.5, opacity: 0.78, marginTop: 4, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{zweite}</div>}
      {wege.length > 0 && <div style={{ fontSize: 13, opacity: 0.62, marginTop: 8, lineHeight: 1.5, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{wege.map(w => <div key={w}>{w}</div>)}</div>}
    </div>
  );
}

/** Die Karte in der Seite: Logo, Code, Name, Rolle, Firma (und die Wege) — im Design des Profils. */
export function KartenAnsicht({ karte }: { karte: Visitenkarte }) {
  const d = kartenDesign(karte);
  return (
    <div data-testid="karten-ansicht" style={{ background: d.hintergrund, backgroundImage: verlauf(d.hintergrund, false), color: d.text, fontFamily: d.schrift, borderRadius: 22, padding: '24px 16px 22px', display: 'grid', justifyItems: 'center', gap: 16, border: `1px solid ${d.akzent}55`, boxSizing: 'border-box', boxShadow: '0 22px 50px -26px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.1)' }}>
      <Logo karte={karte} hoehe={48} />
      <QrFeld karte={karte} breite="min(100%, 340px)" />
      <Namen karte={karte} kontakt />
    </div>
  );
}

/** Ganzer Bildschirm im Design des Profils: Logo, Code (auf hellem Feld), Name — sonst nichts. */
export function QrVollbild({ karte, onZu }: { karte: Visitenkarte; onZu: () => void }) {
  const d = kartenDesign(karte);
  const zu = useRef(onZu);
  zu.current = onZu;
  const [wach, setWach] = useState(false);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') zu.current(); };
    window.addEventListener('keydown', taste);
    // Bildschirm wach halten — wo es der Browser kann (iOS ab 16.4); sonst bleibt die Sperrzeit des Geräts.
    let sperre: { release: () => Promise<void>; addEventListener?: (t: 'release', f: () => void) => void } | null = null;
    let offen = true;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<NonNullable<typeof sperre>> } }).wakeLock;
    const holen = () => {
      if (!wl || sperre) return;
      void wl.request('screen').then(s => {
        if (!offen) { void s.release().catch(() => {}); return; }
        sperre = s; setWach(true);
        s.addEventListener?.('release', () => { if (sperre === s) { sperre = null; setWach(false); } });
      }).catch(() => { /* kein Wake Lock — egal */ });
    };
    holen();
    const sichtbar = () => { if (document.visibilityState === 'visible') { sperre = null; holen(); } };
    document.addEventListener('visibilitychange', sichtbar);
    return () => { offen = false; window.removeEventListener('keydown', taste); document.removeEventListener('visibilitychange', sichtbar); void sperre?.release().catch(() => {}); };
  }, []);
  // Schimmer: auf dunklem Grund ein helles Band, auf hellem Grund ein Hauch der Akzentfarbe (Weiß wäre dort unsichtbar).
  const dunkel = leuchtdichte(d.hintergrund) < 0.4;
  const band = dunkel ? 'rgba(255,255,255,.17)' : `color-mix(in srgb, ${d.akzent} 7%, transparent)`;
  const inhalt = (
    <div role="dialog" aria-modal="true" aria-label="Visitenkarte im Vollbild" data-testid="qr-vollbild"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: d.hintergrund, backgroundImage: verlauf(d.hintergrund, true), color: d.text, fontFamily: d.schrift, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, overflow: 'auto',
        padding: 'max(18px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))' }}>
      <button type="button" onClick={onZu} aria-label="Vollbild schließen"
        style={{ position: 'absolute', zIndex: 4, top: 'max(12px, env(safe-area-inset-top))', right: 'max(12px, env(safe-area-inset-right))', minHeight: 44, minWidth: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: d.text, color: d.hintergrund, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Schließen</button>
      {karte.logo && <div style={{ position: 'relative', zIndex: 1, display: 'grid', justifyItems: 'center', width: '100%' }}><Logo karte={karte} hoehe={56} /></div>}
      {/* Der Schimmer liegt zwischen Logo/Name (unten) und dem QR-Feld (oben) — er streift die Karte, nie den Code. */}
      <div className="kvl-schimmer-huelle" aria-hidden style={{ zIndex: 2 }}><div className="kvl-schimmer" style={{ background: `linear-gradient(100deg, transparent 0%, ${band} 50%, transparent 100%)` }} /></div>
      <div style={{ position: 'relative', zIndex: 3, display: 'grid', justifyItems: 'center', width: '100%' }}><QrFeld karte={karte} breite="min(90vw, 62vh, 560px)" /></div>
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}><Namen karte={karte} gross /></div>
      {wach && <div role="status" style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.6 }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />Bildschirm bleibt an</div>}
    </div>
  );
  // Direkt an <body> hängen: ein Elternelement mit Transform (Einblend-Animation der Seite) würde `position: fixed` sonst einfangen.
  return typeof document === 'undefined' ? inhalt : createPortal(inhalt, document.body);
}
