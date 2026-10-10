'use client';

// ─── Unternehmen › Überblick: Head of Recht — Recht-Check, Risikorunde, Anwalts-Mappe (10.10.) ─────────────────────────────────────────
// Kevin 10.10.: „Wöchentlicher Recht-Check (montags) … Quartals-Risikorunde vorbereiten … Anwalts-Mappe auf Knopfdruck (nichts geht raus ohne Klick).“
// Lesen: GET /api/gesellschaften/recht?space=business (letzter Check, vorbereitete Runden) bzw. `?jetzt=1` (der Check jetzt — nur lesen, keine
// Vorschläge). Die Mappe: POST /api/gesellschaften/recht { aktion: 'mappe' } → PDF in der verschlüsselten Ablage der Gesellschaft; herunterladen
// über die vorhandene Ablage. Vorschläge des Heads (Aufgaben, Risiken, Fristen, Checklisten) liegen im Freigabe-Stapel. Rechnen nur auf dem Server
// (lib/recht). Hinweis überall: keine Rechtsberatung.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Raster, Kennzahl, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, Klappbar, feld, auswahl } from '../../ui';
import { WEG } from '@/lib/wege';
import { aktiveEintraege, vertragArtLabel, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import type { Lage } from '@/lib/gesellschaften/schild/ampel';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { tagVon } from '@/lib/zeit';
import { MAPPE_HINWEIS, RECHT_BANNER, RECHT_HINWEIS, type RundeVorbereitung, type WochenCheck } from '@/lib/recht/typen';
import { AmpelChip, AMPEL_FARBE, PunktListe, klein } from './teile';
import { dateiLink } from './daten';

interface RechtAntwort { ok: boolean; hinweis?: string; check: WochenCheck | null; am: string | null; jetzt?: boolean; runden?: (RundeVorbereitung & { am: string })[]; fehler?: string }

/** Der Bereich des Head of Recht im Überblick — Recht-Check und Anwalts-Mappe. */
export function RechtBereich({ lage, gesellschaften }: { lage: Lage; gesellschaften: readonly RegisterGesellschaft[] }) {
  return (
    <>
      <RechtCheckKarte />
      {lage.gesellschaften.length > 0 && <AnwaltsMappeKarte lage={lage} gesellschaften={gesellschaften} />}
    </>
  );
}

function RechtCheckKarte() {
  const [d, setD] = useState<RechtAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const laden = useCallback(async (jetzt = false) => {
    try {
      const r = await fetch(`/api/gesellschaften/recht?space=business${jetzt ? '&jetzt=1' : ''}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null) as RechtAntwort | null;
      if (j?.ok) { setD(alt => (jetzt && alt ? { ...alt, check: j.check, am: null, jetzt: true } : j)); setFehler(null); } else setFehler(j?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const c = d?.check ?? null;
  return (
    <Karte>
      <Ueberschrift rechts={c ? <AmpelChip a={c.ampel} /> : undefined}>Head of Recht · Recht-Check</Ueberschrift>
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      {!d && !fehler && <Leer>lädt …</Leer>}
      {d && !c && <Leer symbol={<Scale size={16} />}>Der Recht-Check läuft montags im Morgenlauf — bis dahin „Jetzt prüfen“.</Leer>}
      {c && (
        <>
          <span style={klein}>{d?.jetzt ? 'Stand jetzt — nicht gespeichert, ohne Vorschläge.' : `${c.kw.replace('-W', ' · KW ')}${d?.am ? ` · erstellt ${tagText(tagVon(d.am))}` : ''}`}</span>
          <Raster min={140}>
            <Kennzahl wert={String(c.fristen.length)} label="Fristen in 4 Wochen" ton={c.fristen.some(f => f.inTagen < 0) ? AMPEL_FARBE.rot : undefined} />
            <Kennzahl wert={String(c.fehlt.length)} label="was fehlt" ton={c.fehlt.some(f => f.schwere === 'rot') ? AMPEL_FARBE.rot : c.fehlt.length ? AMPEL_FARBE.gelb : undefined} />
            <Kennzahl wert={String(c.eskalation.length)} label="anwaltlich klären" ton={c.eskalation.length ? AMPEL_FARBE.rot : undefined} />
          </Raster>
          {c.eskalation.map((e, i) => <Hinweis key={i} art="kritisch">{e}</Hinweis>)}
          <Klappbar id="recht-fristen" titel="Fristen der nächsten vier Wochen" zaehler={c.fristen.length} offen={offen.fristen ?? true} umschalten={() => setOffen(o => ({ ...o, fristen: !(o.fristen ?? true) }))}>
            {!c.fristen.length ? <span style={klein}>Keine Fristen in den nächsten vier Wochen.</span> : (
              <Liste>{c.fristen.slice(0, 12).map((f, i) => (
                <Link key={`${f.tag}-${i}`} href={f.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Zeile umbrechen titel={f.titel} unter={f.unter} rechts={<span style={{ fontSize: TYP.bedien, color: f.inTagen < 0 ? AMPEL_FARBE.rot : C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{f.inTagen < 0 ? 'seit ' : ''}{tagText(f.tag)}</span>} />
                </Link>
              ))}</Liste>
            )}
          </Klappbar>
          <Klappbar id="recht-fehlt" titel="Was fehlt" zaehler={c.fehlt.length} offen={offen.fehlt ?? false} umschalten={() => setOffen(o => ({ ...o, fehlt: !(o.fehlt ?? false) }))}>
            <PunktListe punkte={c.fehlt.map(f => ({ text: `${f.gesellschaft ? `${f.gesellschaft}: ` : ''}${f.text}`, weg: f.weg, schwere: f.schwere }))} max={12} />
          </Klappbar>
          {c.datenschutz && (
            <Link href={WEG.datenschutz('pruefung')} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile umbrechen titel="Datenschutz & Compliance" unter={`Selbstprüfung ${c.datenschutz.erfuellt} von ${c.datenschutz.gesamt} erfüllt · ${c.datenschutz.avvOffen} ohne bestätigten AVV · Verzeichnis ${c.datenschutz.verzeichnis} Verarbeitungen${c.datenschutz.pannen ? ` · Pannen offen ${c.datenschutz.pannen.offen}` : ''}`} rechts={<span style={klein}>›</span>} />
            </Link>
          )}
        </>
      )}
      {(d?.runden ?? []).map(r => (
        <Klappbar key={r.gesellschaftId} id={`recht-runde-${r.gesellschaftId}`} titel={`Risikorunde ${r.quartal.replace('-', ' ')} vorbereitet — ${r.name}`} zaehler={r.jeRisiko.length + r.neueRisiken.length} offen={offen[r.gesellschaftId] ?? false} umschalten={() => setOffen(o => ({ ...o, [r.gesellschaftId]: !(o[r.gesellschaftId] ?? false) }))}>
          <Liste>
            {r.jeRisiko.map(x => <Zeile key={x.risikoId} umbrechen titel={x.titel} unter={x.vorschlag} rechts={<AmpelChip a={x.ampel === 'offen' ? 'offen' : x.ampel} />} />)}
            {r.neueRisiken.map(x => <Zeile key={x.katalogId} umbrechen titel={`Neu prüfen: ${x.titel}`} unter={`${x.grund} — Vorschlag liegt im Stapel`} />)}
          </Liste>
          <div><Knopf leise href={WEG.schild('risiken', r.gesellschaftId)}>Im Schild bewerten</Knopf></div>
        </Klappbar>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf leise onClick={async () => { await laden(true); }}>Jetzt prüfen</Knopf>
        <Knopf leise href={WEG.freigaben(undefined, 'business')}>Vorschläge im Stapel</Knopf>
      </div>
      <div style={{ ...klein, marginTop: 8 }}>{d?.hinweis ?? RECHT_BANNER} {RECHT_HINWEIS}</div>
    </Karte>
  );
}

type ThemaArt = 'gesellschaft' | 'vertrag' | 'risiko';
const THEMEN: { id: ThemaArt; label: string }[] = [{ id: 'gesellschaft', label: 'Gesellschaft' }, { id: 'vertrag', label: 'Vertrag' }, { id: 'risiko', label: 'Risiko' }];

function AnwaltsMappeKarte({ lage, gesellschaften }: { lage: Lage; gesellschaften: readonly RegisterGesellschaft[] }) {
  const [gid, setGid] = useState(lage.gesellschaften[0]?.id ?? '');
  const [art, setArt] = useState<ThemaArt>('gesellschaft');
  const [eintrag, setEintrag] = useState('');
  const [fragen, setFragen] = useState('');
  const [ergebnis, setErgebnis] = useState<{ id: string; name: string; eingebunden: number; ausgelassen: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const g = lage.gesellschaften.find(x => x.id === gid) ?? lage.gesellschaften[0];
  const vertraege = aktiveEintraege(gesellschaften.find(x => x.id === g?.id)?.vertraege);
  const risiken = g?.risiken.map(z => z.r) ?? [];
  const wahl = art === 'vertrag' ? vertraege.map(v => ({ id: v.id, label: v.titel || vertragArtLabel(v.art) })) : art === 'risiko' ? risiken.map(r => ({ id: r.id, label: r.titel })) : [];
  const erstellen = async () => {
    setFehler(null); setErgebnis(null);
    if (!g) return;
    const id = art === 'gesellschaft' ? '' : eintrag || wahl[0]?.id || '';
    if (art !== 'gesellschaft' && !id) { setFehler(art === 'vertrag' ? 'Diese Gesellschaft hat noch keinen Vertrag im Register.' : 'Diese Gesellschaft hat noch kein Risiko im Register.'); return; }
    const thema = art === 'vertrag' ? { art, gesellschaftId: g.id, vertragId: id } : art === 'risiko' ? { art, gesellschaftId: g.id, risikoId: id } : { art, gesellschaftId: g.id };
    const r = await fetch('/api/gesellschaften/recht?space=business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'mappe', thema, fragen: fragen.split('\n').map(x => x.trim()).filter(Boolean) }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — keine Mappe erstellt.' }));
    if (r.ok) setErgebnis({ ...r.datei, eingebunden: r.eingebunden, ausgelassen: r.ausgelassen }); else setFehler(r.fehler ?? 'Keine Mappe erstellt.');
  };
  return (
    <Karte>
      <Ueberschrift>Anwalts-Mappe</Ueberschrift>
      <span style={klein}>Sachverhalt, Beteiligte, Dokumente, Fristen, bisherige Schritte und offene Fragen als ein PDF — die Unterlagen als Anlagen. Die Mappe liegt verschlüsselt in der Ablage der Gesellschaft; weitergegeben wird nur, was ihr herunterladet.</span>
      {lage.gesellschaften.length > 1 && <Pillen liste={lage.gesellschaften.map(x => ({ id: x.id, label: x.name }))} aktiv={g?.id ?? null} onWahl={x => { setGid(x); setEintrag(''); }} />}
      <Pillen liste={THEMEN} aktiv={art} onWahl={x => { setArt(x); setEintrag(''); }} />
      {art !== 'gesellschaft' && (wahl.length
        ? <select aria-label={art === 'vertrag' ? 'Vertrag' : 'Risiko'} value={eintrag || wahl[0].id} onChange={x => setEintrag(x.target.value)} style={auswahl}>{wahl.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
        : <span style={klein}>{art === 'vertrag' ? 'Noch kein Vertrag im Register dieser Gesellschaft.' : 'Noch kein Risiko im Register dieser Gesellschaft.'}</span>)}
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={klein}>Offene Fragen an die Kanzlei (eine je Zeile, optional)</span>
        <textarea value={fragen} onChange={x => setFragen(x.target.value)} rows={3} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
      </label>
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      {ergebnis && (
        <Hinweis art="gut" titel="Mappe erstellt">
          „{ergebnis.name}“ liegt in der Ablage der Gesellschaft{ergebnis.eingebunden ? ` · ${ergebnis.eingebunden} Anlage${ergebnis.eingebunden === 1 ? '' : 'n'} eingebunden` : ''}{ergebnis.ausgelassen ? ` · ${ergebnis.ausgelassen} nicht eingebunden (steht im Verzeichnis der Mappe)` : ''}. <a href={dateiLink(ergebnis.id)} style={{ color: 'inherit' }}>Herunterladen</a>
        </Hinweis>
      )}
      <div><Knopf haupt onClick={erstellen}>Anwalts-Mappe erstellen</Knopf></div>
      <div style={{ ...klein, marginTop: 8 }}>{MAPPE_HINWEIS} {RECHT_HINWEIS}</div>
    </Karte>
  );
}

/** Im Freigabe-Stapel: der Inhalt eines Vorschlags des Head of Recht (Checkliste, Aufgabentext, Fundstelle) — nur lesen. */
export function RechtStapelDetail({ v }: { v: { werkzeug: string; eingabe: Record<string, unknown> } }) {
  const text = typeof v.eingabe.text === 'string' ? v.eingabe.text : typeof v.eingabe.zitat === 'string' ? `Fundstelle im Vertrag: „${v.eingabe.zitat}“` : typeof v.eingabe.grund === 'string' ? `Anlass: ${v.eingabe.grund}` : '';
  if (!text) return null;
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: TYP.bedien, lineHeight: 1.5, color: C.ink, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 12px', maxHeight: 320, overflowY: 'auto' }}>{text}</div>
      <span style={klein}>{RECHT_HINWEIS}</span>
    </div>
  );
}
