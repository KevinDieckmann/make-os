'use client';

// ─── Standard · Erklärung: antippen → „Was es bedeutet“ mit Fallbeispiel (10.10.) ───────────────────────────────────────────
// Kevin 10.10.: „Wenn man auf die einzelnen Sachen klickt, möchte ich, dass die Erklärung dahinter ist und was es bedeutet — mit
// Fallbeispiel. Das will ich überall.“ EIN Baustein für alle Einstellungen, Kennzahlen, Heads und Onboarding-Schritte:
//   · `ErklaerKnopf` — das kleine „i“ (Tippfläche 44 × 44, aria-expanded/-controls), steht neben dem Schalter bzw. an der Überschrift.
//   · `ErklaerPanel` — die aufgeklappte Erklärung: Abschnitte „Beschriftung · Text“ (Was es bedeutet · Beispiel · Wenn an · Wenn aus …).
//   · `Erklaert`     — Hülle um irgendein Bedienelement: Element + „i“, das Panel klappt darunter auf (über die ganze Breite).
//   · `useErklaerung` — Zustand für Baustein-Autoren (Zeile, Überschrift, Kennzahl … bauen darauf).
// Die TEXTE kommen nicht von hier, sondern aus lib/erklaerungen (Daten, ein Schlüssel je Ding). `Schalter` verlangt seit 10.10. eine
// Erklärung (Typ) — oder `erklaerungOhne` mit Grund (Wächter tests/erklaerungen.test.ts zählt sie). In einer `Zeile` meldet der Schalter
// seine Erklärung an die Zeile (`ZeileErklaerung`), dann klappt der Titel der Zeile sie auf — „die Zeile antippen, nicht den Schalter“.

import { createContext, useContext, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, FLAECHE_STIL, ECKE } from '@/lib/make-one/design';
import { abschnitteVon, type ErklaerungsQuelle } from '@/lib/erklaerungen';
import type { ErklaerAbschnitt } from '@/lib/erklaerungen/typen';

export type { ErklaerungsQuelle, ErklaerAbschnitt };

/** Auf-/Zu-Zustand einer Erklärung samt der Kennung für aria-controls. */
export function useErklaerung() {
  const [offen, setOffen] = useState(false);
  const roh = useId();
  return { offen, umschalten: () => setOffen(o => !o), schliessen: () => setOffen(false), id: `erkl-${roh.replace(/:/g, '')}` };
}

/**
 * Das kleine „i“: 44 × 44 Tippfläche, sichtbar ein ruhiges Symbol; offen in der Akzentfarbe. In Überschriften und Beschriftungen
 * schiebt globals.css (`.ui-erkl-knopf`) die Fläche mit negativem Rand zurück, damit die Zeile nicht höher wird.
 */
export function ErklaerKnopf({ offen, onClick, id, name }: { offen: boolean; onClick: () => void; id: string; /** Wozu die Erklärung gehört (für Vorleser). */ name?: string }) {
  return (
    <button type="button" className="ui-erkl-knopf fassbar" aria-expanded={offen} aria-controls={id} data-erklaerung="knopf"
      aria-label={`Erklärung${name ? ` zu ${name}` : ''} ${offen ? 'ausblenden' : 'anzeigen'}`} title="Was bedeutet das?"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ width: 44, height: 44, minHeight: 44, color: offen ? C.aktiv : C.inkLeise }}>
      <Info size={17} aria-hidden />
    </button>
  );
}

/** Die aufgeklappte Erklärung: kleine Beschriftung, darunter der Text; das Beispiel mit leiser Kante. */
export function ErklaerPanel({ id, abschnitte, style }: { id: string; abschnitte: readonly ErklaerAbschnitt[]; style?: CSSProperties }) {
  if (!abschnitte.length) return null;
  return (
    <div id={id} role="region" aria-label="Erklärung" className="ui-erkl-panel" data-erklaerung="panel"
      style={{ ...FLAECHE_STIL.leise, borderRadius: ECKE.eingabe, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0, textAlign: 'left', ...style }}>
      {abschnitte.map(a => (
        <div key={a.kopf} style={{ display: 'grid', gap: 3, minWidth: 0, ...(a.kopf === 'Beispiel' || a.kopf === 'Beispiel-Vorschlag' ? { borderLeft: `2px solid ${C.aktiv}55`, paddingLeft: 10 } : {}) }}>
          <span style={{ ...MIKRO }}>{a.kopf}</span>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{a.text}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Hülle um ein beliebiges Bedienelement: das Element, daneben das „i“, die Erklärung klappt darunter auf (volle Breite).
 * `breit`: die Hülle füllt die Zeile (Kartenschalter, Felder); sonst so breit wie das Element.
 */
export function Erklaert({ erklaerung, name, breit, children }: { erklaerung: ErklaerungsQuelle; name?: string; breit?: boolean; children: ReactNode }) {
  const e = useErklaerung();
  const abschnitte = abschnitteVon(erklaerung);
  if (!abschnitte.length) return <>{children}</>;
  return (
    <div className="ui-erkl" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, minWidth: 0, maxWidth: '100%', ...(breit || e.offen ? { width: '100%' } : null) }}>
      <div style={{ flex: breit ? '1 1 0%' : '0 1 auto', minWidth: 0 }}>{children}</div>
      <ErklaerKnopf offen={e.offen} onClick={e.umschalten} id={e.id} name={name} />
      {e.offen && <ErklaerPanel id={e.id} abschnitte={abschnitte} style={{ flex: '1 0 100%', marginTop: 2 }} />}
    </div>
  );
}

// ── Schalter in einer Zeile: die Zeile trägt die Erklärung ───────────────────────────────────────────────────────────────

/**
 * Die Zeile (ui/flaechen.tsx › Zeile) stellt diese Meldefunktion bereit; ein `Schalter` darin meldet seine Erklärung an sie, statt ein
 * eigenes „i“ zu zeigen — dann klappt der Titel der Zeile die Erklärung auf (die Zeile antippen, nicht den Schalter). Ohne Zeile (oder in
 * einer Zeile, die selbst ein Tippziel ist) zeigt der Schalter sein eigenes „i“.
 */
export const ZeileErklaerung = createContext<((q: ErklaerungsQuelle | null) => void) | null>(null);

/** Für Schalter & Co.: gibt `true`, wenn die umgebende Zeile die Erklärung übernommen hat (kein eigenes „i“ zeigen). */
export function useAnZeileMelden(q: ErklaerungsQuelle | undefined): boolean {
  const melden = useContext(ZeileErklaerung);
  const schluessel = q === undefined ? null : typeof q === 'string' ? q : JSON.stringify(q);
  useEffect(() => {
    if (!melden || schluessel === null) return;
    melden(q ?? null);
    return () => melden(null);
    // `q` ist durch `schluessel` vertreten (Abschnitte werden bei jedem Aufbau neu gebaut).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [melden, schluessel]);
  return !!melden && schluessel !== null;
}

/** Das „i“-Zeichen im Titel einer Zeile, deren Titel die Erklärung aufklappt (nur Anzeige — der Titel ist der Knopf). */
export function ErklaerZeichen({ offen }: { offen: boolean }) {
  return <Info size={15} aria-hidden className="ui-erkl-zeichen" style={{ color: offen ? C.aktiv : C.inkLeise, flex: '0 0 auto', marginLeft: 6, verticalAlign: '-2px' }} />;
}
