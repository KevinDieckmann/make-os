// ─── Fulfillment · Kunde — die Bilder der Kunden-Wege (12.10., Fulfillment extern, „ein Bild“) ──────────────────────────────────────────────────
// Phasen-Strahl („hier stehen wir“), Wert-Balken (vorher → jetzt → Ziel), Lage mit Ampel — für die Kunden-Seite und die Präsentation „Dem Kunden
// zeigen“. Sie zeichnen nur: die Modelle (`strahlModell`, `wertModell`) rechnet lib/fulfillment/kunde/bild.ts, dieselben zeichnen die PDFs
// (lib/fulfillment/kunde/pdf-bild.ts). Farben nur aus den Token (LEUCHT, FARBE, TIEF), Text ≥ 13 px (Beschriftungen in Großbuchstaben 11 px),
// keine Skripte von außen, kein Bild außer dem Logo als Bild-Daten. Der Strahl liegt am Handy als Liste unter dem Balken (globals.css `.kunde-strahl`).

import type { CSSProperties } from 'react';
import { FARBE as C, TYP, MIKRO, TIEF, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../../ui';
import { ohneUmbruch, strahlModell, wertModell, type KundenAmpel, type KundenLage, type KundenPhase, type KundenWert } from '@/lib/fulfillment/kunde/bild';

export const KUNDEN_AMPEL_FARBE: Record<KundenAmpel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch };
/** Die Farbe für „hier stehen wir“ und den erledigten Weg — der Akzent der Instanz (Petrol), ruhig. */
export const WEG_FARBE = C.aktiv;
const STAND_TEXT = { erledigt: 'erledigt', aktuell: 'hier stehen wir', kommt: 'kommt noch' } as const;

const klein: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 };

/** Die Lage: Ampel-Punkt, ein Titel, drei Sätze. */
export function LageBlock({ lage, gross }: { lage: KundenLage; gross?: boolean }) {
  const f = KUNDEN_AMPEL_FARBE[lage.ampel];
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, flex: '0 0 auto', background: f, boxShadow: TIEF.schein(f, 14) }} />
        <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: gross ? 28 : TYP.titel, fontWeight: 700, letterSpacing: '-.01em', color: C.ink, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{lage.titel}</h2>
      </div>
      <div style={{ display: 'grid', gap: 4, paddingLeft: 22 }}>
        {lage.saetze.map((s, i) => <p key={i} style={{ margin: 0, fontSize: gross ? 18 : TYP.body, color: i === 0 ? C.ink : C.inkDim, lineHeight: 1.5 }}>{ohneUmbruch(s)}</p>)}
      </div>
    </div>
  );
}

/**
 * Der Phasen-Strahl: ein Abschnitt je Phase (erledigt voll, laufend mit dem erledigten Anteil, kommend leer), Rauten an den Abstimmungspunkten, über dem
 * laufenden Abschnitt „hier stehen wir“. Darunter die Titel — am Rechner unter ihrem Abschnitt, am Handy als Liste.
 */
export function KundenStrahl({ phasen, gross }: { phasen: readonly KundenPhase[]; gross?: boolean }) {
  if (!phasen.length) return null;
  const m = strahlModell(phasen);
  const hoehe = gross ? 12 : 10;
  return (
    <div className={`kunde-strahl${gross ? ' kunde-strahl-gross' : ''}`} style={{ ['--n' as string]: String(phasen.length), display: 'grid', gap: 10, minWidth: 0 }}
      role="img" aria-label={`${m.text}. ${phasen.map((p, i) => `Phase ${i + 1}: ${p.titel} — ${STAND_TEXT[p.stand]}${p.abstimmung ? `, Abstimmung ${p.abstimmung.erledigt ? 'erledigt' : 'offen'}` : ''}`).join('. ')}`}>
      {/* Abnahme B18: die Spalte ist schmal (`minmax(0, 1fr)`) — sonst machte das unsichtbare „hier stehen wir“ jede Spalte breit, und der Strahl lief am Handy
          rechts aus der Karte. Die Marke steht am Handy nicht über dem Balken (die Liste darunter sagt „hier stehen wir“); hinten rechtsbündig. */}
      <div className="kunde-strahl-balken" aria-hidden>
        {m.segmente.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, minWidth: 0, alignContent: 'end' }}>
            <span className="kunde-strahl-marke" style={{ ...MIKRO, color: WEG_FARBE, whiteSpace: 'nowrap', visibility: i === m.jetzt ? 'visible' : 'hidden', fontWeight: 700, justifySelf: i > (phasen.length - 1) / 2 ? 'end' : 'start' }}>▾ hier stehen wir</span>
            <span style={{ position: 'relative', display: 'block', height: hoehe, borderRadius: hoehe / 2, background: 'rgba(255,255,255,.08)', boxShadow: i === m.jetzt ? TIEF.schein(WEG_FARBE, 16) : undefined }}>
              {s.fuellung > 0 && <span style={{ position: 'absolute', inset: 0, width: `${Math.round(s.fuellung * 100)}%`, borderRadius: hoehe / 2, background: TIEF.verlauf(s.stand === 'erledigt' ? LEUCHT.gut : WEG_FARBE) }} />}
              {s.abstimmung && <Raute erledigt={s.abstimmung.erledigt} groesse={hoehe + 4} />}
            </span>
          </div>
        ))}
      </div>
      <ol className="kunde-strahl-titel">
        {phasen.map((p, i) => (
          <li key={i} aria-current={p.stand === 'aktuell' ? 'step' : undefined} style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
            <span aria-hidden style={{ flex: '0 0 auto', width: 9, height: 9, borderRadius: 5, transform: 'translateY(1px)', background: p.stand === 'kommt' ? 'transparent' : p.stand === 'erledigt' ? LEUCHT.gut : WEG_FARBE, border: `2px solid ${p.stand === 'kommt' ? C.inkLeise : p.stand === 'erledigt' ? LEUCHT.gut : WEG_FARBE}` }} />
            <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: gross ? 17 : TYP.bedien, fontWeight: p.stand === 'aktuell' ? 700 : 600, color: p.stand === 'kommt' ? C.inkDim : C.ink, lineHeight: 1.3, overflowWrap: 'break-word', hyphens: 'auto' }}>{p.titel}</span>
              <span style={{ ...klein, fontSize: gross ? 14 : TYP.bedien, color: p.stand === 'aktuell' ? WEG_FARBE : C.inkLeise }}>
                {p.stand === 'aktuell' && p.anteil != null ? `hier stehen wir · ${Math.round(p.anteil * 100)}\u00A0%` : STAND_TEXT[p.stand]}
                {p.abstimmung ? ` · ◆ ${p.abstimmung.titel}${p.abstimmung.erledigt ? ' ✓' : ''}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {/* Abnahme B19: die Raute erklärt sich — ◆ ist ein Abstimmungspunkt mit dem Kunden. */}
      {phasen.some(p => p.abstimmung) && (
        <div className="kunde-strahl-legende" style={{ ...klein, display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: gross ? 14 : TYP.bedien }}>
          <span><span aria-hidden style={{ color: LEUCHT.gut }}>◆</span> abgestimmt</span>
          <span><span aria-hidden>◇</span> Abstimmungspunkt — hier stimmen wir gemeinsam ab, bevor es weitergeht</span>
        </div>
      )}
    </div>
  );
}

/** Die Raute eines Abstimmungspunkts am Ende eines Abschnitts: gefüllt = abgestimmt, Umriss = steht noch aus. */
function Raute({ erledigt, groesse }: { erledigt: boolean; groesse: number }) {
  const f = erledigt ? LEUCHT.gut : C.inkDim;
  return <span aria-hidden style={{ position: 'absolute', right: -groesse / 2 + 2, top: '50%', marginTop: -groesse / 2, width: groesse, height: groesse, transform: 'rotate(45deg)', borderRadius: 2, border: `2px solid ${f}`, background: erledigt ? f : C.grund }} />;
}

/** Ein Ziel als Balken: Name und Anteil, die Schiene von „vorher“ (links) bis „Ziel“ (rechts), gefüllt bis „jetzt“. Ohne Messung nur die Zeile. */
export function KundenWertBalken({ w, gross }: { w: KundenWert; gross?: boolean }) {
  const m = wertModell(w);
  const f = m.erreicht ? LEUCHT.gut : WEG_FARBE;
  const p = m.anteil != null ? Math.round(m.anteil * 100) : null;
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }} role="group" aria-label={`${w.name}: vorher ${w.vorher}, jetzt ${w.jetzt}, Ziel ${w.ziel}${p != null ? `, ${p} Prozent des Wegs` : ''}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between', minWidth: 0 }}>
        <span style={{ fontSize: gross ? 19 : TYP.body, fontWeight: 700, color: C.ink, lineHeight: 1.35, overflowWrap: 'anywhere', minWidth: 0 }}>{w.name}</span>
        {p != null && <span style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', fontSize: gross ? 26 : TYP.titel, fontWeight: 700, color: f, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{p}{'\u00A0'}%</span>}
      </div>
      {p != null ? (
        <>
          <span aria-hidden style={{ position: 'relative', display: 'block', height: gross ? 12 : 10, borderRadius: 6, background: 'rgba(255,255,255,.08)' }}>
            <span style={{ position: 'absolute', inset: 0, width: `${Math.max(p, 3)}%`, borderRadius: 6, background: TIEF.verlauf(f) }} />
            <span style={{ position: 'absolute', left: `calc(${Math.max(p, 3)}% - 8px)`, top: -3, width: 16, height: (gross ? 12 : 10) + 6, borderRadius: 8, background: f, boxShadow: TIEF.schein(f, 12) }} />
          </span>
          <div className="kunde-wert-achse" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', ...klein, fontSize: gross ? 15 : TYP.bedien }}>
            <span>vorher <b style={{ color: C.inkDim }}>{w.vorher}</b></span>
            <span style={{ color: C.ink }}>jetzt <b style={{ color: f }}>{w.jetzt}</b></span>
            <span>Ziel <b style={{ color: C.inkDim }}>{w.ziel}</b>{w.bis ? ` · bis ${w.bis}` : ''}</span>
          </div>
        </>
      ) : m.leer ? (
        // Abnahme A3: ein Ziel ohne Werte nicht als „vorher — → jetzt — → Ziel —“, sondern als ruhiger Satz.
        <div style={{ ...klein, fontSize: gross ? 15 : TYP.bedien }}>{m.zeile}</div>
      ) : (
        <div style={{ ...klein, fontSize: gross ? 15 : TYP.bedien }}>vorher <b style={{ color: C.inkDim }}>{w.vorher}</b> → jetzt <b style={{ color: C.ink }}>{w.jetzt}</b> → Ziel <b style={{ color: C.inkDim }}>{w.ziel}</b>{w.bis ? ` (bis ${w.bis})` : ''}</div>
      )}
    </div>
  );
}

/** Fortschritt als große Zahl mit einer Zeile darunter (Präsentation und Kopf der Lage). */
export function FortschrittZahl({ prozent, gross }: { prozent: number; gross?: boolean }) {
  return (
    <div role="img" style={{ display: 'grid', gap: 2, justifyItems: 'end', flex: '0 0 auto' }} aria-label={`${prozent} Prozent des Weges geschafft`}>
      <span style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', fontSize: gross ? 52 : 34, fontWeight: 700, color: C.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{prozent}<span style={{ fontSize: gross ? 24 : 18, color: C.inkDim }}>{'\u00A0'}%</span></span>
      <span style={{ ...MIKRO }}>des Weges geschafft</span>
    </div>
  );
}
