'use client';

// ─── Business-Index — Bausteine der Oberfläche ──────────────────────────────
// Kachel je Kennzahl (Wert, Ampel, woraus gerechnet — oder die Messlücke mit
// „so schließen“), darunter die 2–3 Punkte, aus denen sie besteht (jeder ein
// Link dorthin, wo man handelt), und das Fenster dahinter (Formel, Schwellen,
// Punkte, alle Einträge, Verlauf). Privat-Index und Business-Index teilen sie.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Balken, Knopf, feld, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import type { KennzahlStand, Ampel, Detail } from '@/lib/kennzahlen/kern';

export const AMPEL_FARBE: Record<Ampel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise };
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: 'gut', gelb: 'beobachten', rot: 'handeln', grau: 'fehlt' };
export const SAEULE_FARBE: Record<string, string> = { fh: LEUCHT.geld, ud: LEUCHT.schlaf, mt: LEUCHT.business };
export const scoreFarbe = (n: number | null) => (n == null ? C.inkLeise : n >= 80 ? LEUCHT.gut : n >= 60 ? LEUCHT.puls : n >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

export { schwelle, schwellenText } from '@/lib/business/text';
import { schwelle, schwellenText } from '@/lib/business/text';

/** Die Punkte hinter einer Kennzahl — jeder ein Link dorthin, wo man handelt. */
export function DetailListe({ details, dicht, onKlick }: { details: Detail[]; dicht?: boolean; onKlick?: () => void }) {
  if (!details.length) return null;
  return (
    <div style={{ display: 'grid', gap: dicht ? 2 : 4 }}>
      {details.map((d, i) => {
        const f = d.ampel ? AMPEL_FARBE[d.ampel] : 'rgba(255,255,255,.28)';
        const inhalt = (
          <>
            <span aria-hidden style={{ width: dicht ? 6 : 7, height: dicht ? 6 : 7, borderRadius: '50%', background: f, flex: '0 0 auto', marginTop: dicht ? 6 : 7 }} />
            <span style={{ minWidth: 0, flex: 1, display: 'grid' }}>
              <span style={{ fontSize: dicht ? 12 : TYP.bedien, fontWeight: 600, color: C.ink, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: dicht ? 2 : 3, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>{d.titel}</span>
              {d.unter && <span style={{ fontSize: dicht ? 11.5 : 12, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: dicht ? 'nowrap' : 'normal' }}>{d.unter}</span>}
            </span>
            {d.wert && <span style={{ fontSize: dicht ? 12 : TYP.bedien, fontWeight: 700, color: d.ampel && d.ampel !== 'gruen' ? f : C.inkDim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flex: '0 0 auto' }}>{d.wert}</span>}
            {d.href && <span aria-hidden style={{ color: C.inkLeise, fontSize: dicht ? 12 : 13, flex: '0 0 auto' }}>›</span>}
          </>
        );
        const stil = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: dicht ? '4px 6px' : '8px 10px', margin: dicht ? '0 -6px' : 0, borderRadius: 9, textDecoration: 'none', minWidth: 0, background: dicht ? 'transparent' : 'rgba(255,255,255,.025)' } as const;
        return d.href
          ? <Link key={i} href={d.href} onClick={onKlick} className="fassbar" style={stil}>{inhalt}</Link>
          : <div key={i} style={stil}>{inhalt}</div>;
      })}
    </div>
  );
}

export function KennzahlKachel({ k, onOeffnen }: { k: KennzahlStand; onOeffnen: () => void }) {
  const f = AMPEL_FARBE[k.ampel];
  const punkte = k.details.slice(0, 3);
  return (
    <div style={{ display: 'grid', gap: 8, alignContent: 'start', minWidth: 0, padding: '12px 14px', borderRadius: 14,
      background: k.gemessen ? `color-mix(in srgb, ${f} 7%, ${C.flaecheHoch})` : 'rgba(255,255,255,.025)', border: `1px solid ${k.gemessen ? `${f}33` : 'rgba(255,255,255,.07)'}`, color: C.ink }}>
      <button type="button" onClick={onOeffnen} className="fassbar" title="Formel, Schwellen, alle Punkte und Verlauf"
        style={{ display: 'grid', gap: 6, alignContent: 'start', textAlign: 'left', minWidth: 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.label}</span>
          <span title={AMPEL_TEXT[k.ampel]} style={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: f, boxShadow: k.gemessen ? `0 0 8px ${f}33` : undefined }} />
        </div>
        {k.gemessen ? (
          <>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(19px,2.2vw,22px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: k.ampel === 'gruen' ? C.ink : f }}>{k.anzeige}</div>
            <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{k.quelle}</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 18, fontWeight: 700, color: C.inkLeise }}>—</div>
            <div style={{ fontSize: 12, color: C.inkDim, lineHeight: 1.4 }}>{k.quelle}</div>
          </>
        )}
      </button>
      {punkte.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 6 }}>
          <DetailListe details={punkte} dicht />
          {k.details.length > 3 && <button type="button" onClick={onOeffnen} style={{ background: 'none', border: 'none', padding: '4px 0 0', color: C.inkLeise, cursor: 'pointer', fontSize: 11.5 }}>+ {k.details.length - 3} weitere</button>}
        </div>
      )}
      {!k.gemessen && k.pflegen && !punkte.some(d => d.href === k.pflegen!.href) && (
        <Link href={k.pflegen.href} style={{ fontSize: 12, color: LEUCHT.puls, fontWeight: 600, textDecoration: 'none' }}>{k.pflegen.text} ›</Link>
      )}
    </div>
  );
}

const SICHT_LABEL: Record<string, string> = { gesamt: 'Gesamt', kdc: 'Consulting', kdv: 'KD Ventures' };
const zahlText = (n: number) => String(n).replace('.', ',');

/** Feinjustierung: eigene Schwellen für alle Sichten oder nur diese — mit Rückweg zum Standard. */
type SchwelleSenden = (schwelle: Record<string, unknown>) => Promise<{ ok: boolean; fehler?: string }>;
const businessSenden: SchwelleSenden = schwelle => fetch('/api/business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'einstellungen', schwelle }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));

function SchwellenAnpassen({ k, scope, onGespeichert, senden: sender = businessSenden }: { k: KennzahlStand; scope: string; onGespeichert: () => void; senden?: SchwelleSenden }) {
  const [offen, setOffen] = useState(false);
  const [gruen, setGruen] = useState(zahlText(k.gruen));
  const [rot, setRot] = useState(zahlText(k.rot));
  const [sicht, setSicht] = useState<'alle' | string>('alle');
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const senden = async (schwelle: Record<string, unknown>) => {
    const r = await sender(schwelle);
    setMeldung(r.ok ? { ok: true, text: 'Gespeichert — der Index rechnet neu.' } : { ok: false, text: r.fehler ?? 'Nicht gespeichert.' });
    if (r.ok) onGespeichert();
  };
  const zahl = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));
  if (!offen) return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <Knopf leise onClick={() => setOffen(true)}>Schwellen anpassen</Knopf>
      {k.angepasst && <span style={{ fontSize: 12.5, color: LEUCHT.achtung }}>eigene Schwellen · Standard: {schwellenText({ ...k, gruen: k.standard.gruen, rot: k.standard.rot })}</span>}
    </div>
  );
  const eingabe = { ...feld, width: 120, fontSize: TYP.bedien, padding: '8px 11px' };
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize: 12.5, color: C.inkDim }}>{k.richtung === 'hoch' ? 'Mehr ist besser: grün ab …, rot unter …' : 'Weniger ist besser: grün bis …, rot über …'} · Standard: {schwellenText({ ...k, gruen: k.standard.gruen, rot: k.standard.rot })}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: LEUCHT.gut, fontWeight: 600 }}>grün {k.richtung === 'hoch' ? 'ab' : 'bis'}</span><input inputMode="decimal" value={gruen} onChange={e => setGruen(e.target.value)} style={eingabe} /></label>
        <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: LEUCHT.kritisch, fontWeight: 600 }}>rot {k.richtung === 'hoch' ? 'unter' : 'über'}</span><input inputMode="decimal" value={rot} onChange={e => setRot(e.target.value)} style={eingabe} /></label>
        {scope !== 'privat' && <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: C.inkDim, fontWeight: 600 }}>gilt für</span>
          <select value={sicht} onChange={e => setSicht(e.target.value)} style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '8px 11px' }}>
            <option value="alle">alle Sichten</option>
            <option value={scope}>nur {SICHT_LABEL[scope] ?? scope}</option>
          </select>
        </label>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={() => void senden({ id: k.id, sicht, gruen: zahl(gruen), rot: zahl(rot) })}>Speichern</Knopf>
        {k.angepasst && <Knopf leise onClick={() => void senden({ id: k.id, sicht, zuruecksetzen: true })}>Standard wiederherstellen</Knopf>}
        <Knopf leise onClick={() => setOffen(false)}>Schließen</Knopf>
      </div>
      {meldung && <div style={{ fontSize: 12.5, color: meldung.ok ? LEUCHT.gut : LEUCHT.kritisch }}>{meldung.text}</div>}
    </div>
  );
}

export function KennzahlFenster({ k, saeule, verlauf, scope, onZu, onGespeichert, schwelleSenden }: { k: KennzahlStand; saeule: string; verlauf: { tag: string; wert: number | null }[]; scope: string; onZu: () => void; onGespeichert: () => void; schwelleSenden?: SchwelleSenden }) {
  const f = AMPEL_FARBE[k.ampel];
  const mitWert = verlauf.filter(v => v.wert != null);
  const max = Math.max(...mitWert.map(v => Math.abs(v.wert as number)), k.gruen, k.rot, 1);
  const zeile = (t: string, inhalt: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 130px) 1fr', gap: 12, fontSize: TYP.bedien, lineHeight: 1.5 }}>
      <span style={{ color: C.inkLeise }}>{t}</span><span style={{ color: C.ink, minWidth: 0, overflowWrap: 'anywhere' }}>{inhalt}</span>
    </div>
  );
  return (
    <Fenster breit={600} onZu={onZu} titel={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: f }} />{k.label}</span>}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 34, fontWeight: 700, letterSpacing: '-.03em', color: k.gemessen ? C.ink : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{k.anzeige ?? '—'}</span>
        <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: f }}>{AMPEL_TEXT[k.ampel]}</span>
        {k.punkte != null && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{k.punkte} von 100 Punkten</span>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {zeile('Säule', `${saeule} · ${k.gruppe}`)}
        {zeile('Formel', k.formel)}
        {zeile(k.gemessen ? 'Gerechnet' : 'Es fehlt', k.quelle)}
        {zeile('Schwellen', <>{schwellenText(k)}{k.angepasst && <span style={{ color: LEUCHT.achtung }}> (eigene)</span>}</>)}
        {zeile('Punkte', k.einheit === 'punkte' ? 'Der Wert ist schon ein Score (0–100).' : 'An der roten Schwelle 20, an der grünen 100, dazwischen linear.')}
      </div>
      {k.details.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase' }}>Dahinter · {k.details.length}</span>
          <DetailListe details={k.details} />
        </div>
      )}
      {mitWert.length > 1 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase' }}>Verlauf · {mitWert.length} Tage</span>
          <Balken werte={verlauf.slice(-30).map(v => (v.wert == null ? null : Math.abs(v.wert)))} max={max} farbe={f} hoehe={48} titel={verlauf.slice(-30).map(v => `${v.tag}: ${v.wert == null ? '—' : schwelle(v.wert, k.einheit)}`)} />
        </div>
      )}
      <SchwellenAnpassen key={`${k.id}-${k.gruen}-${k.rot}`} k={k} scope={scope} onGespeichert={onGespeichert} senden={schwelleSenden} />
      {k.pflegen && (
        <div><Link href={k.pflegen.href} onClick={onZu} className="fassbar" style={{ display: 'inline-flex', textDecoration: 'none', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink }}>{k.pflegen.text} ›</Link></div>
      )}
    </Fenster>
  );
}
