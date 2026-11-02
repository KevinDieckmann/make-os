'use client';

// ─── Werkzeuge der Buchhaltung (02.11.) ─────────────────────────────────────────────────────────────────────────────────────────
// Regel lernen (mit Vorschau „rückwirkend“, erst der Klick wendet an), Regeln je Gesellschaft, Vorschläge Entnahme/Einlage/Verrechnung für
// GESPEICHERTE Umbuchungen (per Klick), Zahlung ↔ Rechnung (Vorschlag, „bezahlt“ nur per Klick über /api/rechnung), Paket einlesen (Vorschau →
// Übernehmen), Export als CSV. Alles über die Schreibwege in ./daten.ts — nichts automatisch, nichts an ZOE.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Liste, Zeile, Leer, LEUCHT, feld, auswahl } from '../ui';
import { finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import { regelVorschlag, MUSTER_MIN, type BuchungsRegel, type RegelFeld } from '@/lib/finanzen/buchhaltung/regeln';
import { ZAHLUNG_ART_TEXT, type ZahlungVorschlag } from '@/lib/finanzen/buchhaltung/zahlung-rechnung';
import type { BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import type { TeilFelder } from '@/lib/finanzen/buchhaltung/teil';
import { aktion, bezahltVermerken, exportAdresse, type Bereich, type Lage } from './daten';

const tagText = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;
const geld = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;
const FELD_TEXT: Record<RegelFeld, string> = { wer: 'Gegenseite enthält', zweck: 'Zweck enthält', beide: 'Gegenseite oder Zweck enthält' };
const ortName = (o?: string) => (o ? finanzOrtName(o as FinanzOrt) : 'alle Gesellschaften');

type Wirkung = { id: string; datum: string; wer: string; betrag: number; vorher: string; nachher: string; regel: string; stand?: string };

// ── Rückwirkend: Vorschau → Anwenden ────────────────────────────────────────────────────────────────────────────────────────────
function Rueckwirkend({ bereich, wirkung, onFertig, onZu }: { bereich: Bereich; wirkung: Wirkung[]; onFertig: (zeilen: BhBuchung[], satz: string) => void; onZu: () => void }) {
  const [fehler, setFehler] = useState('');
  if (!wirkung.length) return <Hinweis art="info" aktion={<Knopf leise onClick={onZu}>Schließen</Knopf>}>Rückwirkend ändert sich nichts — von Hand gesetzte Kategorien bleiben.</Hinweis>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: TYP.bedien, color: C.ink }}>{`Rückwirkend würden ${wirkung.length} ${wirkung.length === 1 ? 'Buchung' : 'Buchungen'} umgestellt (von Hand gesetzte bleiben):`}</div>
      <Liste>
        {wirkung.slice(0, 50).map(w => (
          <Zeile key={w.id} links={<span style={{ ...geld, fontSize: 13, color: C.inkDim }}>{tagText(w.datum)}</span>} titel={w.wer} unter={`${w.vorher || '—'} → ${w.nachher}`}
            rechts={<span style={{ ...geld, color: w.betrag > 0 ? LEUCHT.gut : C.ink }}>{eur(w.betrag)}</span>} />
        ))}
      </Liste>
      {wirkung.length > 50 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`… und ${wirkung.length - 50} weitere (alle werden umgestellt).`}</div>}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={async () => {
          const r = await aktion<{ zeilen?: BhBuchung[]; geaendert?: number }>(bereich, { aktion: 'rueckwirkend-anwenden', ids: wirkung.map(w => ({ id: w.id, stand: w.stand })) });
          if (!r.ok) { setFehler(r.fehler); return; }
          onFertig(r.d.zeilen ?? [], `${r.d.geaendert ?? 0} Buchungen umgestellt.`);
        }}>{`Rückwirkend anwenden (${wirkung.length})`}</Knopf>
        <Knopf leise onClick={onZu}>Nicht anwenden</Knopf>
      </div>
    </div>
  );
}

// ── Regel lernen (aus einer Buchung) ────────────────────────────────────────────────────────────────────────────────────────────
export function RegelLernen({ bereich, b, lage, orte, onLage, onZeilen, onZu }: {
  bereich: Bereich; b: BhBuchung; lage: Lage; orte: readonly string[];
  onLage: (l: Lage) => void; onZeilen: (zeilen: BhBuchung[], satz: string) => void; onZu: () => void;
}) {
  const v = regelVorschlag(b);
  const [feldArt, setFeldArt] = useState<RegelFeld>(v.feld);
  const [muster, setMuster] = useState(v.muster);
  const [kategorie, setKategorie] = useState(v.kategorie);
  const [ort, setOrt] = useState(v.ort ?? (bereich === 'business' ? orte[0] ?? '' : ''));
  const [fehler, setFehler] = useState('');
  const [wirkung, setWirkung] = useState<Wirkung[] | null>(null);
  const zuKurz = muster.trim().length < MUSTER_MIN;

  if (wirkung) return (
    <Karte i={0} ton={LEUCHT.puls}>
      <Ueberschrift farbe={LEUCHT.puls}>Regel gespeichert</Ueberschrift>
      <Rueckwirkend bereich={bereich} wirkung={wirkung} onFertig={(z, s) => { onZeilen(z, s); onZu(); }} onZu={onZu} />
    </Karte>
  );
  return (
    <Karte i={0} ton={LEUCHT.puls}>
      <Ueberschrift farbe={LEUCHT.puls}>Regel lernen</Ueberschrift>
      <form onSubmit={async e => {
        e.preventDefault();
        setFehler('');
        const vorher = new Set(lage.regeln.map(r => r.id));
        const r = await aktion<Lage>(bereich, { aktion: 'regel-lernen', stand: lage.stand, regel: { feld: feldArt, muster: muster.trim(), kategorie, ...(ort ? { ort } : {}) } });
        if (!r.ok) { setFehler(r.fehler); if (r.d && 'regeln' in (r.d as object)) onLage(r.d as Lage); return; }
        onLage(r.d);
        const neu = r.d.regeln.find(x => !vorher.has(x.id));
        const w = await aktion<{ wirkung?: Wirkung[] }>(bereich, { aktion: 'rueckwirkend-vorschau', ...(neu ? { regelId: neu.id } : {}) });
        setWirkung(w.ok ? w.d.wirkung ?? [] : []);
      }} style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 150px) 1fr', gap: '8px 12px', alignItems: 'center' }}>
          <label htmlFor="bh-rl-feld" style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wenn</label>
          <select id="bh-rl-feld" value={feldArt} onChange={e => setFeldArt(e.target.value as RegelFeld)} style={auswahl}>
            {(Object.keys(FELD_TEXT) as RegelFeld[]).map(f => <option key={f} value={f}>{FELD_TEXT[f]}</option>)}
          </select>
          <label htmlFor="bh-rl-muster" style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Text</label>
          <input id="bh-rl-muster" value={muster} onChange={e => setMuster(e.target.value)} style={{ ...feld, width: '100%' }} />
          <label htmlFor="bh-rl-kat" style={{ fontSize: TYP.bedien, color: C.inkLeise }}>dann Kategorie</label>
          <select id="bh-rl-kat" value={kategorie} onChange={e => setKategorie(e.target.value)} style={auswahl}>
            {(lage.kategorien.includes(kategorie) ? lage.kategorien : [kategorie, ...lage.kategorien]).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <label htmlFor="bh-rl-ort" style={{ fontSize: TYP.bedien, color: C.inkLeise }}>für</label>
          <select id="bh-rl-ort" value={ort} onChange={e => setOrt(e.target.value)} style={auswahl}>
            {bereich === 'privat' && <option value="">alle Gesellschaften</option>}
            {orte.map(o => <option key={o} value={o}>{ortName(o)}</option>)}
          </select>
        </div>
        {zuKurz && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{`Der Text braucht mindestens ${MUSTER_MIN} Zeichen.`}</div>}
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Die Regel gilt beim nächsten Import. Rückwirkend wirkt sie erst nach der Vorschau — von Hand gesetzte Kategorien bleiben immer.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf typ="submit" aus={zuKurz || !kategorie}>Regel speichern</Knopf>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        </div>
      </form>
    </Karte>
  );
}

// ── Die Werkzeug-Karten ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function Werkzeuge({ bereich, lage, alle, zahlungen, rechnungTitel, filter, onLage, onZeilen, onTeil, onNeuLaden }: {
  bereich: Bereich; lage: Lage; alle: readonly BhBuchung[];
  zahlungen: readonly ZahlungVorschlag[];
  rechnungTitel: (id: string) => string;
  filter: { orte: readonly string[]; von?: string; bis?: string };
  onLage: (l: Lage) => void;
  onZeilen: (zeilen: BhBuchung[], satz: string) => void;
  onTeil: (ops: { b: BhBuchung; felder: TeilFelder }[]) => Promise<boolean>;
  onNeuLaden: (satz: string) => Promise<void>;
}) {
  const [fehler, setFehler] = useState('');
  const [wirkung, setWirkung] = useState<Wirkung[] | null>(null);
  const [paket, setPaket] = useState<{ roh: unknown; name: string; vorschau: PaketVorschau } | null>(null);
  const nachId = new Map(alle.map(b => [b.id, b]));
  const vorschlaege = lage.vorschlaege.filter(v => nachId.has(v.id));
  const zahl = zahlungen.filter(z => nachId.has(z.buchungId));

  return (
    <>
      {fehler && <Hinweis art="kritisch" aktion={<Knopf leise onClick={() => setFehler('')}>OK</Knopf>}>{fehler}</Hinweis>}

      {/* Umbuchungen, die keine sind */}
      {!!vorschlaege.length && (
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={`${vorschlaege.length}`}>Umbuchung prüfen</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8, lineHeight: 1.5 }}>Diese gespeicherten Umbuchungen sind vermutlich Entnahmen, Einlagen oder Verrechnungen. Ein Klick ordnet zu — nichts geschieht von selbst.</div>
          <Liste>
            {vorschlaege.slice(0, 30).map(v => (
              <Zeile key={v.id} umbrechen links={<span style={{ ...geld, fontSize: 13, color: C.inkDim }}>{tagText(v.datum)}</span>} titel={v.wer} unter={`${v.text} · ${v.grund}`}
                rechts={<>
                  <span style={{ ...geld, color: v.betrag > 0 ? LEUCHT.gut : C.ink }}>{eur(v.betrag)}</span>
                  <Knopf leise onClick={() => onTeil([{ b: nachId.get(v.id)!, felder: { kategorie: v.kategorie, ...(v.zuordnen ? { zuordnen: v.zuordnen } : {}) } }])}>Übernehmen</Knopf>
                </>} />
            ))}
          </Liste>
          {vorschlaege.length > 30 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{`… und ${vorschlaege.length - 30} weitere — nach dem Übernehmen rücken sie nach.`}</div>}
        </Karte>
      )}

      {/* Zahlung ↔ Rechnung */}
      {!!zahl.length && (
        <Karte i={4}>
          <Ueberschrift farbe={LEUCHT.gut} rechts={`${zahl.length}`}>Zahlung passt zu Rechnung</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8, lineHeight: 1.5 }}>Vorschläge — „Als bezahlt vermerken“ setzt die Rechnung auf bezahlt und verknüpft genau diese Buchung. Bei einem Teilbetrag lieber nur verknüpfen.</div>
          <Liste>
            {zahl.slice(0, 30).map(z => {
              const b = nachId.get(z.buchungId)!;
              return (
                <Zeile key={`${z.buchungId}-${z.rechnungId}`} umbrechen links={<span style={{ ...geld, fontSize: 13, color: C.inkDim }}>{tagText(b.datum)}</span>}
                  titel={`${b.wer} → ${rechnungTitel(z.rechnungId)}`} unter={`${ZAHLUNG_ART_TEXT[z.art]} · ${z.grund} · Rechnung ${eur(z.rechnungCent / 100)}`}
                  rechts={<>
                    <span style={{ ...geld, color: LEUCHT.gut }}>{eur(z.buchungCent / 100)}</span>
                    {z.art !== 'teil' && <Knopf leise onClick={async () => {
                      const r = await bezahltVermerken(z.rechnungId, b);
                      if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
                      await onNeuLaden('Rechnung als bezahlt vermerkt und mit der Buchung verknüpft.');
                    }}>Als bezahlt vermerken</Knopf>}
                    <Knopf leise onClick={() => onTeil([{ b, felder: { rechnungId: z.rechnungId } }])}>Nur verknüpfen</Knopf>
                  </>} />
              );
            })}
          </Liste>
        </Karte>
      )}

      {/* Regeln */}
      <Karte i={5}>
        <Ueberschrift rechts={lage.regeln.length ? <Knopf leise onClick={async () => {
          const w = await aktion<{ wirkung?: Wirkung[] }>(bereich, { aktion: 'rueckwirkend-vorschau' });
          if (!w.ok) { setFehler(w.fehler); return; }
          setWirkung(w.d.wirkung ?? []);
        }}>Rückwirkend prüfen</Knopf> : undefined}>{`Regeln (${lage.regeln.length})`}</Ueberschrift>
        {wirkung && <div style={{ marginBottom: 12 }}><Rueckwirkend bereich={bereich} wirkung={wirkung} onFertig={(z, s) => { setWirkung(null); onZeilen(z, s); }} onZu={() => setWirkung(null)} /></div>}
        {!lage.regeln.length
          ? <Leer symbol="⇄">Noch keine Regel. In einer Buchung „Regel lernen“ wählen — dann ordnet der nächste Import gleiche Buchungen selbst zu.</Leer>
          : <Liste>
            {lage.regeln.map((r: BuchungsRegel) => (
              <Zeile key={r.id} titel={`${FELD_TEXT[r.feld]} „${r.muster}“`} unter={ortName(r.ort)}
                rechts={<>
                  <Chip farbe={C.inkDim}>{r.kategorie}</Chip>
                  <Knopf leise ariaLabel={`Regel „${r.muster}“ löschen`} onClick={async () => {
                    const x = await aktion<Lage>(bereich, { aktion: 'regel-weg', id: r.id, stand: lage.stand });
                    if (!x.ok) { setFehler(x.fehler); if (x.d && 'regeln' in (x.d as object)) onLage(x.d as Lage); return; }
                    onLage(x.d);
                  }}>Löschen</Knopf>
                </>} />
            ))}
          </Liste>}
      </Karte>

      {/* Paket + Export */}
      <Karte i={6}>
        <Ueberschrift>Einlesen und Ausgeben</Ueberschrift>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            Buchhaltungs-Paket (JSON, Art „make-buchhaltung-paket“): erst die Vorschau, dann übernehmen. Von Hand Gesetztes bleibt, zweimal einlesen ändert nichts.
          </div>
          <label style={{ fontSize: TYP.bedien, color: C.ink }}>
            <span style={{ display: 'block', marginBottom: 6 }}>Paket wählen</span>
            <input type="file" accept="application/json,.json" aria-label="Buchhaltungs-Paket wählen" onChange={async e => {
              const datei = e.target.files?.[0];
              e.target.value = '';
              if (!datei) return;
              setFehler('');
              let roh: unknown;
              try { roh = JSON.parse(await datei.text()); } catch { setFehler('Die Datei ist kein gültiges JSON — nichts eingelesen.'); return; }
              const v = await aktion<PaketVorschau>(bereich, { aktion: 'paket-vorschau', paket: roh });
              if (!v.ok) { setFehler(v.fehler); return; }
              setPaket({ roh, name: datei.name, vorschau: v.d });
            }} style={{ fontSize: TYP.bedien }} />
          </label>
          {paket && <PaketKarte bereich={bereich} p={paket} onAbbruch={() => setPaket(null)} onNeu={v => setPaket({ ...paket, vorschau: v })}
            onFertig={async satz => { setPaket(null); await onNeuLaden(satz); }} onFehler={setFehler} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={exportAdresse(bereich, filter)} download className="ui-knopf fassbar" style={{ textDecoration: 'none', color: C.ink, border: `1px solid ${C.linie}` }}>
              Export als CSV
            </a>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`${filter.orte.length ? filter.orte.map(o => ortName(o)).join(', ') : 'alle Gesellschaften'}${filter.von || filter.bis ? ` · ${filter.von ?? '…'} bis ${filter.bis ?? '…'}` : ''} — IBAN gekürzt, für den Steuerberater.`}</span>
          </div>
        </div>
      </Karte>
    </>
  );
}

export interface PaketVorschau {
  satz: string; basis: string; zugeordnet: number; mitAenderung: number; unveraendert: number; handBehalten: number;
  ohneBuchung: { nr: number; datum: string; betragCent: number; gegenseite: string; grund: string }[];
  regelnNeu: number; regelnGeaendert: number; regelnGleich: number;
}

function PaketKarte({ bereich, p, onAbbruch, onNeu, onFertig, onFehler }: {
  bereich: Bereich; p: { roh: unknown; name: string; vorschau: PaketVorschau };
  onAbbruch: () => void; onNeu: (v: PaketVorschau) => void; onFertig: (satz: string) => Promise<void>; onFehler: (f: string) => void;
}) {
  const v = p.vorschau;
  const nichts = !v.mitAenderung && !v.regelnNeu && !v.regelnGeaendert;
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, border: `1px solid ${C.linie}` }}>
      <div style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 700 }}>{p.name}</div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{v.satz}</div>
      <div className="ui-pillen">
        <Chip farbe={LEUCHT.gut}>{`${v.zugeordnet} zugeordnet`}</Chip>
        <Chip farbe={LEUCHT.puls}>{`${v.mitAenderung} mit Änderung`}</Chip>
        <Chip farbe={C.inkDim}>{`${v.unveraendert} unverändert`}</Chip>
        {!!v.handBehalten && <Chip farbe={C.inkDim}>{`${v.handBehalten} von Hand — bleibt`}</Chip>}
        {!!(v.regelnNeu + v.regelnGeaendert) && <Chip farbe={LEUCHT.puls}>{`${v.regelnNeu} Regeln neu · ${v.regelnGeaendert} geändert`}</Chip>}
        {!!v.ohneBuchung.length && <Chip farbe={LEUCHT.achtung}>{`${v.ohneBuchung.length} ohne Buchung`}</Chip>}
      </div>
      {!!v.ohneBuchung.length && (
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>
          {v.ohneBuchung.slice(0, 8).map(o => <div key={o.nr}>{`Nr. ${o.nr} · ${tagText(o.datum)} · ${eur(o.betragCent / 100)} · ${o.gegenseite} — ${o.grund}`}</div>)}
          {v.ohneBuchung.length > 8 && <div>{`… und ${v.ohneBuchung.length - 8} weitere. Erst den Kontoauszug einlesen, dann das Paket noch einmal.`}</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf aus={nichts} onClick={async () => {
          const r = await aktion<{ satz?: string; geaendert?: number; vorschau?: PaketVorschau }>(bereich, { aktion: 'paket-uebernehmen', paket: p.roh, basis: v.basis });
          if (!r.ok) {
            if (r.status === 409 && r.d?.vorschau) onNeu(r.d.vorschau);
            onFehler(r.fehler);
            return;
          }
          await onFertig(`Paket übernommen: ${r.d.geaendert ?? 0} Buchungen geändert.`);
        }}>{nichts ? 'Nichts zu übernehmen' : 'Übernehmen'}</Knopf>
        <Knopf leise onClick={onAbbruch}>Verwerfen</Knopf>
      </div>
    </div>
  );
}
