'use client';

// ─── Fulfillment · Prozesse — gemeinsame Teile der Oberfläche (Paket C1, 10.10.) ──────────────────────────────────────────────────────
// Kleine Bausteine, die mehrere Ansichten teilen: Textfeld mit Speichern beim Verlassen, Meldungs-Zeile, Knoten-Formular (Vorlagen-Editor),
// Marken eines Bausteins. Alles über components/os/ui (Design-Standard); keine eigenen Farben außer den Token.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, Feldzeile, Schalter, LEUCHT, feld as FELD_STIL } from '../../ui';
import { Lock, Scale, BookLock } from 'lucide-react';
import { Fenster } from '../../Fenster';
import { Wahl } from '../../crm/Wahl';
import { ORTE, type OrtId } from '@/lib/fulfillment/orte';
import { KREISLAUF_IDS } from '@/lib/fulfillment/lesen';
import { ebeneVon } from '@/lib/fulfillment/regeln';
import type { ProzessKnoten, ProzessVorlage, Zone } from '@/lib/fulfillment/typen';
import type { KreislaufId } from '@/lib/crm/planung';
import { vorlagenOps, fehlerText, type BausteinKurz, type MitStand } from './daten';

export const feld = { ...FELD_STIL, fontSize: 16 } as const;
export const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
export const beschriftung = { ...MIKRO } as const;

/** Ein Textfeld, das beim Verlassen speichert (Enter = fertig). Mehrzeilig mit `zeilen`. */
export function TextFeld({ wert, onFertig, platzhalter, zeilen, typ = 'text', aus, label }: { wert: string; onFertig: (t: string) => void; platzhalter?: string; zeilen?: number; typ?: string; aus?: boolean; label?: string }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  const fertig = () => { if (t !== wert) onFertig(t); };
  return zeilen
    ? <textarea value={t} rows={zeilen} disabled={aus} placeholder={platzhalter} aria-label={label ?? platzhalter} onChange={e => setT(e.target.value)} onBlur={fertig} style={{ ...feld, width: '100%', resize: 'vertical' }} />
    : <input type={typ} value={t} disabled={aus} placeholder={platzhalter} aria-label={label ?? platzhalter} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={{ ...feld, width: '100%' }} />;
}

/** Ergebnis-Zeile nach einer Aktion (gut oder Fehler) — bleibt stehen, bis die nächste Aktion kommt. */
export function Meldung({ text, art = 'gut' }: { text: string | null; art?: 'gut' | 'kritisch' | 'achtung' }) {
  return text ? <Hinweis art={art} rolle={art === 'kritisch' ? 'alert' : 'status'}>{text}</Hinweis> : null;
}

/** Texte der internen Marken (Tooltip und Vorleser) — EINE Stelle. */
export const MARKE_TEXT = {
  nurIntern: 'Nur intern — geht nie an Kunden (Kunden-Seite, Report, Wirkungsbericht, Export).',
  rechtOffen: 'Vor Einsatz rechtlich prüfen — bis zum Vermerk „geprüft“ nicht beim Kunden.',
  vorVerkaufOffen: 'Material Dritter — vor Verkauf prüfen; bis zum Vermerk nicht beim Kunden.',
} as const;

/**
 * Marken eines Bausteins (nur intern · rechtlich prüfen · vor Verkauf prüfen) — seit 12.10. ruhig: ein kleines Zeichen mit Tooltip statt eines
 * farbigen Chips (Rückmeldung: „interne Marken ruhig“). Erscheint nur in internen Ansichten; die Kunden-Sicht kennt die Marken gar nicht (Positivliste).
 */
export function BausteinMarken({ b }: { b: Pick<BausteinKurz, 'nurIntern' | 'rechtOffen' | 'vorVerkaufOffen'> & { rechtGeprueft?: unknown } }) {
  const z = (k: keyof typeof MARKE_TEXT, Zeichen: typeof Lock) => (
    <span key={k} role="img" aria-label={MARKE_TEXT[k]} title={MARKE_TEXT[k]} style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: 11, color: C.inkDim, border: `1px solid ${C.linie}` }}>
      <Zeichen size={13} aria-hidden />
    </span>
  );
  if (!b.nurIntern && !b.rechtOffen && !b.vorVerkaufOffen) return null;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {b.nurIntern && z('nurIntern', Lock)}
      {b.rechtOffen && z('rechtOffen', Scale)}
      {b.vorVerkaufOffen && z('vorVerkaufOffen', BookLock)}
    </span>
  );
}

const ZUSTAENDIG = [{ id: 'intern' as const, label: 'wir' }, { id: 'kunde' as const, label: 'Kunde' }, { id: 'beide' as const, label: 'beide' }];
const ZONEN = [{ id: 'dach' as Zone, label: 'Dach · Steuerung' }, { id: 'etage' as Zone, label: 'Etage · Kernprozess' }, { id: 'fundament' as Zone, label: 'Fundament · Unterstützung' }];
const KREISLAUF_TEXT: Record<KreislaufId, string> = { kanaele: 'Kanäle', leads: 'Leads', deals: 'Deals', followup: 'Follow-up', fulfillment: 'Fulfillment', nachher: 'Nach der Leistung', wiederkauf: 'Wiederkauf' };

/**
 * Knoten anlegen oder ändern (Vorlagen-Editor). Ebene 5 trägt nur einen Baustein (Wahl aus der Bibliothek); Landkarte (Ebene 2) zusätzlich
 * Zone und Kreislauf-Stufen; jeder Knoten optional einen Ort (Sprung in die Seite, in der der Prozess heute wohnt).
 */
export function KnotenFormular({ vorlage, knoten, elternId, bausteine, onZu }: { vorlage: Pick<ProzessVorlage, 'id' | 'art' | 'freigaben' | 'knoten'>; knoten?: MitStand<ProzessKnoten>; elternId?: string; bausteine: readonly BausteinKurz[]; onZu: () => void }) {
  const eltern = knoten?.elternId ?? elternId;
  const ebene = knoten ? ebeneVon(knoten, vorlage.knoten) : eltern ? ebeneVon({ id: '_neu', elternId: eltern }, [...vorlage.knoten, { id: '_neu', elternId: eltern }]) : 1;
  const [w, setW] = useState<Record<string, unknown>>(() => knoten ? { ...knoten } : {});
  const [fehler, setFehler] = useState<string | null>(null);
  const setze = (k: string, v: unknown) => setW(x => ({ ...x, [k]: v }));
  const text = (k: string) => (typeof w[k] === 'string' ? w[k] as string : '');
  const speichern = async () => {
    const felder = ebene === 5
      ? ['titel', 'bausteinId', 'kundeSichtbar']
      : ['titel', 'ziel', 'warum', 'eingang', 'ergebnis', 'kennzahl', 'zustaendig', 'rolle', 'dauerTage', 'aufwandStunden', 'freigabe', 'kundeSichtbar', 'phaseId', 'ort', ...(vorlage.art === 'landkarte' && ebene === 2 ? ['zone', 'kreislauf'] : [])];
    const eintrag: Record<string, unknown> = {};
    for (const f of felder) { const v = w[f]; if (v !== undefined && JSON.stringify(v) !== JSON.stringify((knoten as Record<string, unknown> | undefined)?.[f])) eintrag[f] = v === '' ? null : v; }
    if (ebene === 5 && !w.titel && typeof w.bausteinId === 'string') eintrag.titel = bausteine.find(b => b.id === w.bausteinId)?.titel;
    const op = knoten ? { op: 'knoten', vorlageId: vorlage.id, eintrag: { id: knoten.id, ...eintrag }, stand: knoten.stand } : { op: 'knoten', vorlageId: vorlage.id, eintrag: { elternId: eltern, ...eintrag } };
    const a = await vorlagenOps([op]);
    if (a.ok) onZu(); else setFehler(fehlerText(a));
  };
  const zahl = (k: string) => (typeof w[k] === 'number' ? String(w[k]) : '');
  return (
    <Fenster titel={knoten ? `Schritt bearbeiten (Ebene ${ebene})` : `Neuer Schritt (Ebene ${ebene})`} onZu={onZu} breit={640}>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 10 }}>
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        {ebene === 5 ? (
          <>
            <Feldzeile label="Baustein aus der Bibliothek">
              <Wahl label="Baustein" liste={bausteine.map(b => ({ id: b.id, label: b.titel, hinweis: b.art }))} wert={typeof w.bausteinId === 'string' ? w.bausteinId : null} onWahl={id => setze('bausteinId', id)} />
            </Feldzeile>
            <Feldzeile label="Titel (Anzeige)"><input value={text('titel')} onChange={e => setze('titel', e.target.value)} placeholder="Titel des Bausteins" style={feld} /></Feldzeile>
          </>
        ) : (
          <>
            <Feldzeile label="Titel"><input value={text('titel')} onChange={e => setze('titel', e.target.value)} style={feld} required /></Feldzeile>
            <Feldzeile label="Ziel"><textarea value={text('ziel')} rows={2} onChange={e => setze('ziel', e.target.value)} style={feld} /></Feldzeile>
            <Feldzeile label="Warum"><textarea value={text('warum')} rows={2} onChange={e => setze('warum', e.target.value)} style={feld} /></Feldzeile>
            <Feldzeile label="Eingang"><input value={text('eingang')} onChange={e => setze('eingang', e.target.value)} style={feld} /></Feldzeile>
            <Feldzeile label="Ergebnis"><input value={text('ergebnis')} onChange={e => setze('ergebnis', e.target.value)} style={feld} /></Feldzeile>
            <Feldzeile label="Kennzahl"><input value={text('kennzahl')} onChange={e => setze('kennzahl', e.target.value)} style={feld} /></Feldzeile>
            <Feldzeile label="Zuständig"><Wahl label="Zuständig" liste={ZUSTAENDIG} wert={(w.zustaendig as 'intern' | 'kunde' | 'beide' | undefined) ?? null} onWahl={x => setze('zustaendig', x)} onLeeren={() => setze('zustaendig', null)} /></Feldzeile>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <Feldzeile label="Dauer (Tage)"><input inputMode="numeric" value={zahl('dauerTage')} onChange={e => setze('dauerTage', e.target.value ? Number(e.target.value) : null)} style={feld} /></Feldzeile>
              <Feldzeile label="Aufwand (Stunden)"><input inputMode="decimal" value={zahl('aufwandStunden')} onChange={e => setze('aufwandStunden', e.target.value ? Number(e.target.value.replace(',', '.')) : null)} style={feld} /></Feldzeile>
            </div>
            {vorlage.freigaben.length > 0 && (
              <Feldzeile label="Freigabepunkt" erklaerung="fulfillment.freigabe">
                <Wahl label="Freigabe" liste={vorlage.freigaben.map(f => ({ id: f.id, label: `${f.id} · ${f.titel}` }))} wert={(w.freigabe as string | undefined) ?? null} onWahl={x => setze('freigabe', x)} onLeeren={() => setze('freigabe', null)} />
              </Feldzeile>
            )}
            <Feldzeile label="Wo wohnt der Prozess heute (Ort)">
              <Wahl<OrtId> label="Ort" liste={(Object.keys(ORTE) as OrtId[]).map(id => ({ id, label: ORTE[id].titel }))} wert={(w.ort as OrtId | undefined) ?? null} onWahl={x => setze('ort', x)} onLeeren={() => setze('ort', null)} />
            </Feldzeile>
            {vorlage.art === 'landkarte' && ebene === 2 && (
              <>
                <Feldzeile label="Zone"><Wahl<Zone> label="Zone" liste={ZONEN} wert={(w.zone as Zone | undefined) ?? null} onWahl={x => setze('zone', x)} /></Feldzeile>
                <Feldzeile label="Kreislauf-Stufen">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {KREISLAUF_IDS.map(id => {
                      const l = Array.isArray(w.kreislauf) ? w.kreislauf as string[] : [];
                      const an = l.includes(id);
                      return <Knopf key={id} leise={!an} onClick={() => setze('kreislauf', an ? l.filter(x => x !== id) : [...l, id])}>{KREISLAUF_TEXT[id]}</Knopf>;
                    })}
                  </div>
                </Feldzeile>
              </>
            )}
          </>
        )}
        <Schalter an={w.kundeSichtbar === true} onChange={v => setze('kundeSichtbar', v)} erklaerung="fulfillment.kundeSichtbar">Für Kunden sichtbar</Schalter>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit">Speichern</Knopf>
        </div>
      </form>
    </Fenster>
  );
}

export function Leiste({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}

/** Eine kurze Texteingabe als Fenster (statt `window.prompt`): `fragen(titel, vorgabe)` → Text oder null. */
export function useTextFrage(): { fragen: (titel: string, vorgabe?: string) => Promise<string | null>; dialog: ReactNode } {
  const [f, setF] = useState<{ titel: string; wert: string; fertig: (t: string | null) => void } | null>(null);
  const fragen = (titel: string, vorgabe = '') => new Promise<string | null>(fertig => setF({ titel, wert: vorgabe, fertig }));
  const zu = (t: string | null) => { f?.fertig(t); setF(null); };
  const dialog = f ? (
    <Fenster titel={f.titel} onZu={() => zu(null)} breit={480}>
      <form onSubmit={e => { e.preventDefault(); zu(f.wert.trim() || null); }} style={{ display: 'grid', gap: 10 }}>
        <input autoFocus value={f.wert} onChange={e => setF({ ...f, wert: e.target.value })} aria-label={f.titel} style={feld} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Knopf leise onClick={() => zu(null)}>Abbrechen</Knopf>
          <Knopf haupt typ="submit">Übernehmen</Knopf>
        </div>
      </form>
    </Fenster>
  ) : null;
  return { fragen, dialog };
}
