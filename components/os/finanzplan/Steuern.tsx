'use client';

// ─── Finanzplanung jetzt — „Welche Steuern gelten?“ ──────────────────────────
// Kevin 02.10.: „Unten stehen so viele Steuern, die wir nicht brauchen.“ Je Gesellschaft nur die Steuerzeilen, die zur
// Rechtsform passen — jede mit Schalter. Seit dem Kern-Umbau 02.10. rechnet der Plan die Ertragsteuern einzeln, und jeder Wert
// ist ein Feld mit Vorgabe (Kevin: „alles anpassen, damit ich selber spielen kann“): leer = Vorgabe (grauer Platzhalter),
// „zurücksetzen“ leert das Feld. Die Felder gelten für den ganzen Plan oder nur für ein Szenario (Überlagerung). Die Karte ändert
// den Plan über dieselben Operationen wie alles andere (Stand/409, Protokoll, Rückgängig) — die Blätter rechnen sofort neu.
// Die Logik steht in lib/finanzen/steuern.ts; hier ist nur die Oberfläche. Steuern sind Näherungen — Hinweis, keine Steuerberatung.

import { useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift } from '../ui';
import { finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import { prozent } from '@/lib/finanzen/plan/hilfen';
import { STEUER_HINWEIS, AUSSCHUETTUNG_STEUER_VORGABE, type Planszenario } from '@/lib/finanzen/szenarien';
import { nettoTabellePlatzhalter } from '@/lib/finanzen/plan/operationen';
import { gesamtquote } from '@/lib/finanzen/ertragsteuer';
import {
  RECHTSFORM_LABEL, rechtsformVon, steuerFelder, steuerOps, steuerParameter, steuerZeilen, steuernMit, steuerArtenFuer,
  type Rechtsform, type SteuerAenderung, type SteuerArt, type SteuerBereich, type SteuerFeld,
} from '@/lib/finanzen/steuern';
import { usePlan } from './daten';
import { useArbeitsplan } from './arbeitsplan';
import { FeldK } from './Annahmen';
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
      {hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45, margin: '3px 0 0 56px' }}>{hinweis}</div>}
    </div>
  );
}

/** Feld für einen Anteil: zeigt Prozent (15), speichert den Anteil (0,15). */
export function ProzentFeld({ wert, onFertig, breite = 84, titel, dezimal = 2, leer, platzhalter }: { wert: number | null | undefined; onFertig: (v: number | null) => void; breite?: number | string; titel: string; dezimal?: number; leer?: boolean; platzhalter?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <ZahlFeld wert={wert == null ? null : Math.round(wert * 10 ** (dezimal + 2)) / 10 ** dezimal} dezimal={dezimal} breite={breite} leer={leer} platzhalter={platzhalter} titel={titel} onFertig={v => onFertig(v == null ? null : v / 100)} />
      <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>%</span>
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
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Brutto → Netto je Monat (Lohnsteuer und Sozialabgaben, Näherung). Dazwischen rechnet der Plan linear.{nettoTabellePlatzhalter(d) && <span style={{ color: '#E0A64D' }}> Noch der Platzhalter: Netto = Brutto.</span>}</div>
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

const prozentText = (v: number, dezimal: number) => String(Math.round(v * 10 ** (dezimal + 2)) / 10 ** dezimal).replace('.', ',');

/** Ein Feld der Steuer-Karte: Wert oder grauer Platzhalter (= Vorgabe), „zurücksetzen“ leert es. */
function SteuerFeldEingabe({ f, setze }: { f: SteuerFeld; setze: (wert: number | boolean | string | null) => void }) {
  const mitReset = f.gesetzt ? <button type="button" onClick={() => setze(null)} title="Zurück auf die Vorgabe" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', font: 'inherit', fontSize: TYP.bedien, padding: 0, textAlign: 'left' }}>↺ zurücksetzen</button> : null;
  let eingabe: ReactNode;
  if (f.art === 'anteil') eingabe = <ProzentFeld wert={f.gesetzt ? (f.wert as number) : null} leer platzhalter={prozentText(f.vorgabe as number, f.dezimal)} dezimal={f.dezimal} breite="100%" titel={f.label} onFertig={v => setze(v == null ? null : Math.max(0, Math.min(1, v)))} />;
  else if (f.art === 'schalter') eingabe = <Schalter an={f.wert as boolean} onChange={v => setze(v)}>{f.wert ? 'ja' : 'nein'}{!f.gesetzt ? ' (Vorgabe)' : ''}</Schalter>;
  else if (f.art === 'wahl') eingabe = <Auswahl wert={String(f.wert)} onWahl={v => setze(v)} optionen={f.optionen ?? []} titel={f.label} />;
  else if (f.art === 'monat') eingabe = <ZahlFeld wert={f.gesetzt ? (f.wert as number) : null} leer platzhalter={String(f.vorgabe)} dezimal={0} breite="100%" titel={f.label} onFertig={v => setze(v == null ? null : Math.max(1, Math.min(12, Math.round(v))))} />;
  else eingabe = <ZahlFeld wert={f.gesetzt ? (f.wert as number) : null} leer platzhalter={String(f.vorgabe).replace('.', ',')} dezimal={f.dezimal} breite="100%" titel={f.label} onFertig={v => setze(v == null ? null : Math.max(0, v))} />;
  return <FeldK label={f.label} breit={190}>{eingabe}{mitReset}{f.hinweis && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.35 }}>{f.hinweis}</span>}</FeldK>;
}

/**
 * Die Karte für einen Ort. Eingeklappt zeigt sie nur die Überschrift mit Zusammenfassung („GmbH · 3 Steuerzeilen“);
 * `offen` öffnet sie von außen (Sprung aus „Noch offen“). `szenario` legt die Karte fest auf ein Szenario (Baukasten);
 * sonst wählt man oben „Ganzer Plan“ oder „nur Arbeitsplan“.
 */
export function SteuerKarte({ ort, offen: offenStart = false, i = 0, szenario }: { ort: FinanzOrt; offen?: boolean; i?: number; szenario?: Planszenario }) {
  const { d, aendere } = usePlan();
  const { ps: arbeitsplan, schreibe } = useArbeitsplan();
  const [offen, setOffen] = useState(offenStart);
  const [bereichWahl, setBereichWahl] = useState<'plan' | 'szenario'>('plan');
  const [tarifOffen, setTarifOffen] = useState(false);
  const ps = szenario ?? arbeitsplan;
  const imSzenario = !!szenario || bereichWahl === 'szenario';
  const schicht = imSzenario ? ps?.annahmen.steuern : d.steuern;
  const unter = imSzenario ? d.steuern : undefined;
  // Mit allen Überlagerungen gerechnet wird, was in der Schicht steht: Plan allein oder Plan + dieses Szenario.
  const dTop = imSzenario ? { ...d, steuern: steuernMit(d.steuern, ps?.annahmen.steuern) } : d;
  const rf = rechtsformVon(dTop, ort);
  const ausSatz = ps?.annahmen.ausschuettungSteuer ?? AUSSCHUETTUNG_STEUER_VORGABE;
  const zeilen = steuerZeilen(dTop, ort, ausSatz);
  const felder = steuerFelder(dTop, ort, schicht, unter);
  const sp = steuerParameter(dTop, ort);
  const gelten = zeilen.filter(z => z.an).length;
  const bereichFuer = (id: string): SteuerBereich => (imSzenario ? { art: 'szenario', id } : { art: 'plan' });
  /** Eine Änderung schreiben: in den Plan, in ein vorhandenes Szenario — oder, ohne Arbeitsplan, in einen neuen (derselbe Schritt, ein Rückgängig). */
  const tu = (a: SteuerAenderung) => {
    if (!imSzenario) { const ops = steuerOps(d, ort, a); if (ops.length) void aendere(ops, ops[0].feld ?? 'Steuern'); return; }
    if (ps) { const ops = steuerOps(d, ort, a, bereichFuer(ps.id), schicht); if (ops.length) void aendere(ops, ops[0].feld ?? 'Steuern (Szenario)'); return; }
    void schreibe(id => steuerOps(d, ort, a, bereichFuer(id), schicht), 'Steuern (Szenario)');
  };
  const annahme = (k: string, alt: number, neu: number, feld: string) => void aendere([{ pfad: `/annahmen/${k}`, alt, neu }], feld);
  const exitSatz = imSzenario ? ps?.annahmen.exitSteuer : undefined;

  const satzFeld = (z: (typeof zeilen)[number]) => {
    const art = z.art;
    if (art === 'kst' || art === 'soli' || art === 'gewst') return <span style={{ color: C.inkDim, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{art === 'gewst' ? `Messzahl ${prozent(z.satz ?? 0, 2)} × Hebesatz ${String(Math.round((z.hebesatz ?? 0) * 10) / 10).replace('.', ',')} %` : prozent(z.satz ?? 0, 2)}</span>;
    if (art === 'ust') return <ProzentFeld wert={d.annahmen.ust} titel="Umsatzsteuer-Satz" onFertig={v => v != null && annahme('ust', d.annahmen.ust, v, 'Umsatzsteuer-Satz')} />;
    if (art === 'exit') {
      if (imSzenario) return <ProzentFeld wert={exitSatz ?? null} leer platzhalter={prozentText(d.annahmen.exitSteuer, 2)} titel="Steuer auf den Ausstieg (Szenario)" onFertig={v => void schreibe(id => [{ pfad: `/planszenarien/id=${ps?.id ?? id}/annahmen/exitSteuer`, alt: exitSatz, ...(v == null ? {} : { neu: Math.max(0, Math.min(1, v)) }) }], 'Steuer auf den Ausstieg (Szenario)')} />;
      return <ProzentFeld wert={d.annahmen.exitSteuer} titel="Steuer auf den Ausstieg" onFertig={v => v != null && annahme('exitSteuer', d.annahmen.exitSteuer, v, 'Steuer auf den Ausstieg')} />;
    }
    if (art === 'ausschuettung') return <ProzentFeld wert={ausSatz} dezimal={3} titel="Steuer auf die Ausschüttung, pauschal" onFertig={v => v != null && void schreibe(id => [{ pfad: `/planszenarien/id=${id}/annahmen/ausschuettungSteuer`, alt: ps?.annahmen.ausschuettungSteuer, neu: Math.max(0, Math.min(1, v)) }], 'Steuer auf die Ausschüttung')} />;
    return <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>—</span>;
  };
  const gruppe = (g: SteuerFeld['gruppe']) => felder.filter(f => f.gruppe === g);
  const feldGrid = (liste: SteuerFeld[]) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{liste.map(f => <SteuerFeldEingabe key={f.id} f={f} setze={w => tu({ art: 'feld', id: f.id, wert: w })} />)}</div>;
  const tarifGesetzt = gruppe('tarif').filter(f => f.gesetzt);

  return (
    <Karte i={i} id={`steuern-${ort}`}>
      <Ueberschrift rechts={<KnopfKlein farbe={offen ? C.inkDim : undefined} onClick={() => setOffen(o => !o)}>{offen ? 'Zuklappen' : 'Anpassen'}</KnopfKlein>}>
        Welche Steuern gelten? — {finanzOrtName(ort)}{szenario ? ` · ${szenario.name}` : ''}
      </Ueberschrift>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
        {rf && <Etikett text={RECHTSFORM_LABEL[rf]} />}
        <span>{zeilen.length ? `${gelten} von ${zeilen.length} Steuerzeilen gelten` : 'keine Steuerzeilen'}{rf === 'kapital' && sp.kstAn ? ` · KSt, Soli und Gewerbesteuer zusammen ${prozent(gesamtquote(sp), 1)} vom Gewinn` : ''}</span>
      </div>
      {offen && (
        <div style={{ marginTop: 12 }}>
          {ort !== 'privat' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              {!szenario && (
                <>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Gilt für</span>
                  <Auswahl<'plan' | 'szenario'> wert={bereichWahl} onWahl={setBereichWahl} optionen={[{ id: 'plan', label: 'Ganzen Plan (alle Szenarien)' }, { id: 'szenario', label: arbeitsplan ? `Nur Arbeitsplan „${arbeitsplan.name}“` : 'Nur den Arbeitsplan (wird angelegt)' }]} titel="Gilt für" />
                </>
              )}
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Rechtsform</span>
              <Auswahl<Rechtsform> wert={rf ?? 'kapital'} onWahl={v => tu({ art: 'rechtsform', wert: v })} optionen={(Object.keys(RECHTSFORM_LABEL) as Rechtsform[]).map(id => ({ id, label: RECHTSFORM_LABEL[id] }))} titel="Rechtsform" />
            </div>
          )}
          {imSzenario && ort !== 'privat' && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>Felder, die hier leer bleiben, gelten wie im Plan (grauer Wert). Nur die eingetragenen überlagern den Plan für dieses Szenario.</div>}
          {/* Zeilen statt Tabelle: auf dem Handy brechen sie um, nichts läuft nach rechts hinaus. */}
          <div>
            {zeilen.map(z => (
              <ZeilenRahmen key={z.art} dim={!z.an} name={z.info.label} hinweis={z.hinweis ?? z.info.wirkung}
                schalter={z.schaltbar ? <Schalter an={z.an} onChange={v => tu({ art: 'an', steuer: z.art as SteuerArt, wert: v })} ariaLabel={`${z.info.label} berechnen`} /> : <span style={{ color: C.inkLeise, fontSize: TYP.bedien, width: 44, display: 'inline-block' }}>immer</span>}
                satz={satzFeld(z)} />
            ))}
          </div>
          {gruppe('saetze').length > 0 && <div style={{ marginTop: 12 }}><div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Sätze — leer heißt Vorgabe</div>{feldGrid(gruppe('saetze'))}</div>}
          {gruppe('regeln').length > 0 && <div style={{ marginTop: 12 }}><div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Regeln</div>{feldGrid(gruppe('regeln'))}</div>}
          {gruppe('tarif').length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <KnopfKlein farbe={C.inkDim} onClick={() => setTarifOffen(o => !o)}>{tarifOffen ? 'Einkommensteuer-Tarif zuklappen' : 'Einkommensteuer-Tarif (Eckwerte) anpassen'}</KnopfKlein>
                {tarifGesetzt.length > 0 && <KnopfKlein onClick={() => { const ops = tarifGesetzt.flatMap(f => steuerOps(d, ort, { art: 'feld', id: f.id, wert: null }, imSzenario && ps ? bereichFuer(ps.id) : { art: 'plan' }, schicht)); if (ops.length) void aendere(ops, 'Einkommensteuer-Tarif zurückgesetzt'); }}>↺ alle Eckwerte auf die Vorgabe 2026</KnopfKlein>}
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Grundtarif § 32a EStG, Vorgabe 2026 — die Eckwerte lassen sich einzeln ändern{tarifGesetzt.length ? ` (${tarifGesetzt.length} geändert)` : ''}.</span>
              </div>
              {tarifOffen && <div style={{ marginTop: 8 }}>{feldGrid(gruppe('tarif'))}</div>}
            </div>
          )}
          {ort === 'privat' && <div style={{ marginTop: 14 }}><NettoTabelle /></div>}
          {steuerArtenFuer(ort, rf).length === 0 && <div style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Hier rechnet der Plan keine Steuer.</div>}
          <Hinweis>{STEUER_HINWEIS} Nicht aufgeführt ist, was der Plan nicht rechnet (zum Beispiel Kirchensteuer). Eine abgeschaltete Zeile verschwindet aus den Blättern, ihr Satz bleibt gespeichert. Verlustvortrag, Hinzurechnungen und Anrechnung sind vereinfacht (siehe FINANZPLANUNG_JETZT.md).</Hinweis>
        </div>
      )}
    </Karte>
  );
}
