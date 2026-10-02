'use client';

// ─── Finanzplanung jetzt — „Welche Steuern gelten?“ ──────────────────────────
// Kevin 02.10.: „Unten stehen so viele Steuern, die wir nicht brauchen.“ Je Gesellschaft nur die Steuerzeilen, die zur
// Rechtsform passen — jede mit Schalter und Satz. Die Karte ändert den Plan über dieselben Operationen wie alles andere
// (Stand/409, Protokoll, Rückgängig). Die Logik steht in lib/finanzen/steuern.ts; hier ist nur die Oberfläche.
// Steuern sind Näherungen — Hinweis, keine Steuerberatung.

import { useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift } from '../schlank';
import { finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import { prozent } from '@/lib/finanzen/plan/hilfen';
import { STEUER_HINWEIS, AUSSCHUETTUNG_STEUER_VORGABE } from '@/lib/finanzen/szenarien';
import { nettoTabellePlatzhalter } from '@/lib/finanzen/plan/operationen';
import {
  RECHTSFORM_LABEL, STEUER_STANDARD, gesamtsatzAus, profilVon, rechtsformVon, steuerOps, steuerZeilen, steuerArtenFuer,
  type Rechtsform, type SteuerAenderung, type SteuerArt,
} from '@/lib/finanzen/steuern';
import { usePlan } from './daten';
import { useArbeitsplan } from './arbeitsplan';
import { Tabelle, TH, THr, TD, TDr, ZahlFeld, Auswahl, Schalter, KnopfKlein, Hinweis, Etikett } from './teile';

/** Eine Steuerzeile: Schalter · Name · Satz, darunter ein Satz zur Wirkung. */
function ZeilenRahmen({ schalter, name, satz, hinweis, dim, fett }: { schalter?: ReactNode; name: string; satz: ReactNode; hinweis?: string; dim: boolean; fett?: boolean }) {
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.06)', opacity: dim ? 0.5 : 1 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center' }}>
        <span style={{ width: 44, flex: '0 0 auto' }}>{schalter}</span>
        <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: TYP.bedien, fontWeight: fett ? 700 : 500 }}>{name}</span>
        <span style={{ flex: '0 1 auto' }}>{satz}</span>
      </div>
      {hinweis && <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.45, margin: '3px 0 0 56px' }}>{hinweis}</div>}
    </div>
  );
}

/** Feld für einen Anteil: zeigt Prozent (15), speichert den Anteil (0,15). */
export function ProzentFeld({ wert, onFertig, breite = 84, titel, dezimal = 2, leer, platzhalter }: { wert: number | null | undefined; onFertig: (v: number | null) => void; breite?: number | string; titel: string; dezimal?: number; leer?: boolean; platzhalter?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <ZahlFeld wert={wert == null ? null : Math.round(wert * 10 ** (dezimal + 2)) / 10 ** dezimal} dezimal={dezimal} breite={breite} leer={leer} platzhalter={platzhalter} titel={titel} onFertig={v => onFertig(v == null ? null : v / 100)} />
      <span style={{ color: C.inkLeise, fontSize: 12.5 }}>%</span>
    </span>
  );
}

/** Netto-Tabelle (Brutto → Netto je Monat, Näherung für Lohnsteuer und Sozialabgaben) — Paare bearbeiten, anhängen, entfernen. */
export function NettoTabelle() {
  const { d, aendere } = usePlan();
  const t = d.annahmen.nettoTabelle;
  const schreibe = (neu: [number, number][], feld: string) => aendere([{ pfad: '/annahmen/nettoTabelle', alt: t, neu }], feld);
  const setzePaar = (i: number, j: 0 | 1, v: number | null) => { const n = t.map(p => [...p] as [number, number]); n[i][j] = v ?? 0; void schreibe(n, `Netto-Tabelle Zeile ${i + 1}`); };
  const mehr = () => { const l = t[t.length - 1] ?? [0, 0]; void schreibe([...t, [Math.round(l[0] + 1000), Math.round(l[1] + 600)]], 'Netto-Tabelle Zeile angelegt'); };
  const weg = (i: number) => { if (t.length > 2) void schreibe(t.filter((_, j) => j !== i) as [number, number][], `Netto-Tabelle Zeile ${i + 1} entfernt`); };
  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 6 }}>Brutto → Netto je Monat (Lohnsteuer und Sozialabgaben, Näherung). Dazwischen rechnet der Plan linear.{nettoTabellePlatzhalter(d) && <span style={{ color: '#E0A64D' }}> Noch der Platzhalter: Netto = Brutto.</span>}</div>
      <Tabelle klein>
        <thead><tr><th style={THr}>Brutto €</th><th style={THr}>Netto €</th><th style={TH}></th></tr></thead>
        <tbody>
          {t.map((p, i) => (
            <tr key={i}>
              <td style={TDr}><ZahlFeld wert={p[0]} dezimal={0} breite={110} titel={`Brutto Zeile ${i + 1}`} onFertig={v => setzePaar(i, 0, v)} /></td>
              <td style={TDr}><ZahlFeld wert={p[1]} dezimal={0} breite={110} titel={`Netto Zeile ${i + 1}`} onFertig={v => setzePaar(i, 1, v)} /></td>
              <td style={TD}>{t.length > 2 && <KnopfKlein farbe={C.inkDim} onClick={() => weg(i)} titel="Zeile entfernen">−</KnopfKlein>}</td>
            </tr>
          ))}
        </tbody>
      </Tabelle>
      <div style={{ marginTop: 8 }}><KnopfKlein onClick={mehr}>+ Zeile</KnopfKlein></div>
    </div>
  );
}

/**
 * Die Karte für einen Ort. Eingeklappt zeigt sie nur die Überschrift mit Zusammenfassung („GmbH · 3 Steuerzeilen“);
 * `offen` öffnet sie von außen (Sprung aus „Noch offen“).
 */
export function SteuerKarte({ ort, offen: offenStart = false, i = 0 }: { ort: FinanzOrt; offen?: boolean; i?: number }) {
  const { d, aendere } = usePlan();
  const { ps, schreibe } = useArbeitsplan();
  const [offen, setOffen] = useState(offenStart);
  const rf = rechtsformVon(d, ort), p = profilVon(d, ort);
  const ausSatz = ps?.annahmen.ausschuettungSteuer ?? AUSSCHUETTUNG_STEUER_VORGABE;
  const einzeln = !!p.einzeln && rf === 'kapital' && ort === 'ug';
  // Ohne Aufschlüsselung steht die Ertragsteuer als EINE Zeile da (KSt + Soli + Gewerbesteuer stecken im Gesamtsatz).
  const zeilen = steuerZeilen(d, ort, ausSatz).filter(z => einzeln || !(z.art === 'kst' || z.art === 'soli' || z.art === 'gewst'));
  const gesamtZeile = ort === 'ug' && !einzeln && rf === 'kapital';
  const gelten = zeilen.filter(z => z.an).length;
  const tu = (a: SteuerAenderung) => { const ops = steuerOps(d, ort, a); if (ops.length) void aendere(ops, ops[0].feld ?? 'Steuern'); };
  const annahme = (k: string, alt: number, neu: number, feld: string) => void aendere([{ pfad: `/annahmen/${k}`, alt, neu }], feld);
  const gesamt = gesamtsatzAus(p);

  /** Satz-Feld je Steuerart: ins Profil, in die Annahmen oder in den Arbeitsplan. */
  const satzFeld = (z: (typeof zeilen)[number]) => {
    const art = z.art;
    if (art === 'kst' || art === 'soli') return <ProzentFeld wert={z.satz} titel={`${z.info.label} Satz`} onFertig={v => v != null && tu({ art: 'satz', steuer: art, wert: v })} />;
    if (art === 'gewst') return (
      <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ color: C.inkLeise, fontSize: 12 }}>Messzahl</span><ProzentFeld wert={z.satz} titel="Gewerbesteuer Messzahl" breite={70} onFertig={v => v != null && tu({ art: 'satz', steuer: 'gewst', wert: v })} /></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ color: C.inkLeise, fontSize: 12 }}>Hebesatz</span><ZahlFeld wert={z.hebesatz ?? 0} dezimal={1} breite={78} titel="Gewerbesteuer Hebesatz in Prozent" onFertig={v => v != null && tu({ art: 'hebesatz', wert: Math.max(0, v) })} /><span style={{ color: C.inkLeise, fontSize: 12.5 }}>%</span></span>
      </span>
    );
    if (art === 'est' && ort === 'ug') return <ProzentFeld wert={d.annahmen.steuerUG} titel="Ertragsteuer pauschal" onFertig={v => v != null && annahme('steuerUG', d.annahmen.steuerUG, v, 'Ertragsteuer-Gesamtsatz')} />;
    if (art === 'ust') return <ProzentFeld wert={d.annahmen.ust} titel="Umsatzsteuer-Satz" onFertig={v => v != null && annahme('ust', d.annahmen.ust, v, 'Umsatzsteuer-Satz')} />;
    if (art === 'exit') return <ProzentFeld wert={d.annahmen.exitSteuer} titel="Steuer auf den Ausstieg" onFertig={v => v != null && annahme('exitSteuer', d.annahmen.exitSteuer, v, 'Steuer auf den Ausstieg')} />;
    if (art === 'ausschuettung') return <ProzentFeld wert={ausSatz} dezimal={3} titel="Steuer auf die Ausschüttung, pauschal" onFertig={v => v != null && void schreibe(id => [{ pfad: `/planszenarien/id=${id}/annahmen/ausschuettungSteuer`, alt: ps?.annahmen.ausschuettungSteuer, neu: Math.max(0, Math.min(1, v)) }], 'Steuer auf die Ausschüttung')} />;
    return <span style={{ color: C.inkLeise, fontSize: 12.5 }}>—</span>;
  };

  return (
    <Karte i={i} id={`steuern-${ort}`}>
      <Ueberschrift rechts={<KnopfKlein farbe={offen ? C.inkDim : undefined} onClick={() => setOffen(o => !o)}>{offen ? 'Zuklappen' : 'Anpassen'}</KnopfKlein>}>
        Welche Steuern gelten? — {finanzOrtName(ort)}
      </Ueberschrift>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
        {rf && <Etikett text={RECHTSFORM_LABEL[rf]} />}
        <span>{zeilen.length || gesamtZeile ? `${gelten + (gesamtZeile ? 1 : 0)} von ${zeilen.length + (gesamtZeile ? 1 : 0)} Steuerzeilen gelten` : 'keine Steuerzeilen'}{ort === 'ug' && !einzeln ? ` · Ertragsteuer insgesamt ${prozent(d.annahmen.steuerUG, 1)}` : ''}{einzeln ? ` · Ertragsteuer insgesamt ${prozent(gesamt, 1)}` : ''}</span>
      </div>
      {offen && (
        <div style={{ marginTop: 12 }}>
          {ort === 'ug' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: C.inkDim }}>Rechtsform</span>
              <Auswahl<Rechtsform> wert={rf ?? 'kapital'} onWahl={v => tu({ art: 'rechtsform', wert: v })} optionen={(Object.keys(RECHTSFORM_LABEL) as Rechtsform[]).map(id => ({ id, label: RECHTSFORM_LABEL[id] }))} titel="Rechtsform" />
            </div>
          )}
          {/* Zeilen statt Tabelle: auf dem Handy brechen sie um, nichts läuft nach rechts hinaus. */}
          <div>
            {gesamtZeile && (
              <ZeilenRahmen dim={false} name="Ertragsteuer insgesamt (Körperschaftsteuer, Soli, Gewerbesteuer)" hinweis="auf den Gewinn des Vorjahres; „Nach Steuerarten einstellen“ trennt die drei auf" satz={<ProzentFeld wert={d.annahmen.steuerUG} titel="Ertragsteuer insgesamt" onFertig={v => v != null && annahme('steuerUG', d.annahmen.steuerUG, v, 'Ertragsteuer-Gesamtsatz')} />} />
            )}
            {zeilen.map(z => (
              <ZeilenRahmen key={z.art} dim={!z.an} name={z.info.label} hinweis={z.hinweis ?? z.info.wirkung}
                schalter={z.schaltbar ? <Schalter an={z.an} onChange={v => tu({ art: 'an', steuer: z.art as SteuerArt, wert: v })} /> : <span style={{ color: C.inkLeise, fontSize: 12, width: 44, display: 'inline-block' }}>immer</span>}
                satz={z.quelle === 'annahmen' && !z.schaltbar ? null : satzFeld(z)} />
            ))}
            {einzeln && <ZeilenRahmen dim={false} fett name="Ertragsteuer insgesamt" hinweis="Summe der geltenden Zeilen — der Plan rechnet damit" satz={<span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{prozent(gesamt, 2)}</span>} />}
          </div>
          {ort === 'ug' && rf === 'kapital' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              {einzeln
                ? <KnopfKlein farbe={C.inkDim} onClick={() => tu({ art: 'einzeln', wert: false })} titel="Wieder ein einziger Gesamtsatz — der Satz bleibt, wie er ist">Zurück auf einen Gesamtsatz</KnopfKlein>
                : <KnopfKlein onClick={() => tu({ art: 'einzeln', wert: true })} titel="Verteilt den heutigen Gesamtsatz auf KSt, Soli und Gewerbesteuer — keine Zahl ändert sich">Nach Steuerarten einstellen</KnopfKlein>}
              <span style={{ fontSize: 12, color: C.inkLeise }}>{einzeln ? `Standard: KSt ${prozent(STEUER_STANDARD.kst, 1)}, Soli ${prozent(STEUER_STANDARD.soli, 1)} auf die KSt, Gewerbesteuer-Messzahl ${prozent(STEUER_STANDARD.messzahl, 1)} × Hebesatz Ihrer Gemeinde.` : 'Beim Aufschlüsseln bleibt der Gesamtsatz gleich; der Hebesatz ergibt sich als Rest.'}</span>
            </div>
          )}
          {ort === 'ug' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, color: C.inkDim }}>
              Ertragsteuer wird gezahlt im Monat
              <ZahlFeld wert={d.annahmen.steuerMonat} dezimal={0} breite={64} titel="Kalendermonat der Ertragsteuer-Zahlung (1–12)" onFertig={v => { if (v != null && v >= 1 && v <= 12) annahme('steuerMonat', d.annahmen.steuerMonat, Math.round(v), 'Steuer gezahlt im Kalendermonat'); }} />
              <span style={{ color: C.inkLeise }}>(1–12, auf den Gewinn des Vorjahres)</span>
            </div>
          )}
          {ort === 'privat' && <div style={{ marginTop: 14 }}><NettoTabelle /></div>}
          {steuerArtenFuer(ort, rf).length === 0 && <div style={{ color: C.inkLeise, fontSize: 12.5 }}>Hier rechnet der Plan keine Steuer.</div>}
          <Hinweis>{STEUER_HINWEIS} Nicht aufgeführt ist, was der Plan nicht rechnet (zum Beispiel Kirchensteuer). Eine abgeschaltete Zeile verschwindet aus den Blättern, ihr Satz bleibt gespeichert.</Hinweis>
        </div>
      )}
    </Karte>
  );
}
