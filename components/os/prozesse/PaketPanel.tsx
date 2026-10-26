'use client';

// ─── Prozesse · Werkstatt — das Seitenfeld eines Fulfillment-Pakets (22.10., Fulfillment in die Werkstatt E2) ──────────────────────────────────────────────
// Nur, was der Fall-Ausführer kann (Fulfillment-Modus): die fünf Formen eines Schritts, Frist, Versuche, Zuständig (Team · Kunde · gemeinsam), „Kunde sieht es“,
// Bausteine der Bibliothek (mit der Kunden-Regel), Zweige der Entscheidung, Reihenfolge; an der Phase Titel, Sichtbarkeit, Bestätigung (an/aus, Titel, wer) und
// Reihenfolge. Jede Änderung ist eine Op des Fulfillment-Editors (`onOps`) — gerechnet wird in lib/prozesse/fulfillment-bearbeiten.ts, hier wird nur gewählt.
// Ohne Recht (bzw. am Handy) nur ansehen.

import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Chip, Knopf, Pillen, Schalter, auswahl as auswahlStil } from '../ui';
import { paketKnotenZeilen, werText, type BibliothekKurz, type PaketKnotenInfo } from '@/lib/prozesse/fulfillment-modus';
import { FORM_VORGABE, PALETTE_FORMEN, phaseVerschieben, schrittVerschieben, schritteDerPhase, type EditorOp } from '@/lib/prozesse/fulfillment-bearbeiten';
import type { ProzessVorlage, Zustaendig } from '@/lib/prozesse/definition';
import { FORM_TITEL } from '@/lib/fulfillment/prozesse/editor';
import { TextFeld, ZahlFeld } from './WerkstattMaske';

const ERKL_KUNDE_SIEHT = [{ kopf: 'Was es bedeutet', text: 'Der Schritt erscheint auf der Kunden-Seite und im Report — nur, wenn auch seine Bausteine für Kunden frei sind.' }, { kopf: 'Beispiel', text: '„Unterlagen schicken“ sieht der Kunde, „Angebot intern prüfen“ nicht.' }];
const ERKL_PHASE_SIEHT = [{ kopf: 'Was es bedeutet', text: 'Die Phase steht auf der Reise, die der Kunde sieht (Kunden-Seite, Report).' }, { kopf: 'Beispiel', text: 'Eine interne Vorbereitungsphase bleibt ausgeblendet.' }];
const ERKL_BESTAETIGUNG = [{ kopf: 'Was es bedeutet', text: 'Am Ende der Phase steht eine Bestätigung (Raute) — erst wenn sie gegeben ist, geht der Fall in die nächste Phase.' }, { kopf: 'Beispiel', text: '„Konzept abgenommen“: der Kunde bestätigt per Mail oder im Termin.' }];
const ERKL_ZUSATZ = [{ kopf: 'Was es bedeutet', text: 'Ein Zusatzmodul hängt sich an einen laufenden Fall an (eigener Abschnitt) statt einen neuen Fall zu starten.' }, { kopf: 'Beispiel', text: 'Ein gebuchtes Zusatzpaket läuft neben dem Hauptpaket her.' }];

const ZUSTAENDIG: { id: Zustaendig; label: string }[] = [{ id: 'intern', label: 'Team' }, { id: 'kunde', label: 'Kunde' }, { id: 'beide', label: 'gemeinsam' }];
const klein = { ...MIKRO, textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: TYP.bedien } as const;

export interface PanelAuswahl { art: 'schritt'; info: PaketKnotenInfo; phaseId: string }
export interface PanelPhase { art: 'phase'; id: string; titel: string; kundeSichtbar: boolean; schritte: number; abstimmung?: { titel: string; wer: Zustaendig; anzeige: string } }

export function PaketPanel(p: {
  fassung: ProzessVorlage; bibliothek: readonly BibliothekKurz[]; bearbeiten: boolean; neueId: () => string;
  auswahl: PanelAuswahl | PanelPhase | null; onOps: (ops: EditorOp[]) => void; uebersicht: { phasen: number; schritte: number; bestaetigungen: number };
}) {
  const a = p.auswahl, b = p.bearbeiten;
  if (!a) {
    return (
      <>
        <b style={{ fontSize: TYP.body, color: C.ink }}>{p.fassung.titel}</b>
        <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>{`${p.uebersicht.phasen} Phasen · ${p.uebersicht.schritte} Schritte · ${p.uebersicht.bestaetigungen} Bestätigungen`}</p>
        {b && <TextFeld label="Titel des Pakets" wert={p.fassung.titel} onWert={t => t.trim() && p.onOps([{ op: 'titel', titel: t.trim() }])} />}
        {b && <Schalter an={!!p.fassung.zusatz} onChange={an => p.onOps([{ op: 'zusatz', an }])} erklaerung={ERKL_ZUSATZ}>Zusatzmodul</Schalter>}
        <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>
          {b ? 'Ein Klick auf einen Schritt bzw. eine Phase zeigt ihre Felder. Gespeichert wird als Entwurf — laufende Kunden sehen erst nach „Veröffentlichen“ und „Übernehmen“ etwas.'
            : 'Ausgeführt wird im Fall des Kunden. Bahn „Kunde“: der Kunde ist dran · „Team“: die zuständige Person des Mandats.'}
        </p>
      </>
    );
  }
  if (a.art === 'phase') {
    const hoch = phaseVerschieben(p.fassung, a.id, 'hoch'), runter = phaseVerschieben(p.fassung, a.id, 'runter');
    return (
      <>
        <b style={{ fontSize: TYP.body, color: C.ink }}>{a.titel}</b>
        <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>{`${a.schritte} Schritte${a.abstimmung ? ` · ${a.abstimmung.anzeige} — ${werText(a.abstimmung.wer)}` : ''}`}</p>
        {b && (
          <>
            <TextFeld label="Titel der Phase" wert={a.titel} onWert={t => t.trim() && p.onOps([{ op: 'phase', id: a.id, titel: t.trim() }])} />
            <Schalter an={a.kundeSichtbar} onChange={an => p.onOps([{ op: 'phase', id: a.id, kundeSichtbar: an }])} erklaerung={ERKL_PHASE_SIEHT}>Kunde sieht die Phase</Schalter>
            <Schalter an={!!a.abstimmung} onChange={an => p.onOps([{ op: 'abstimmung', phaseId: a.id, an }])} erklaerung={ERKL_BESTAETIGUNG}>Bestätigung am Ende</Schalter>
            {a.abstimmung && (
              <>
                <TextFeld label="Titel der Bestätigung" wert={a.abstimmung.titel} onWert={t => t.trim() && p.onOps([{ op: 'abstimmung', phaseId: a.id, an: true, titel: t.trim() }])} />
                <span style={klein}>Wer bestätigt</span>
                <Pillen liste={ZUSTAENDIG.map(z => ({ id: z.id, label: z.id === 'intern' ? 'ihr intern' : z.id === 'kunde' ? 'der Kunde' : 'gemeinsam' }))} aktiv={a.abstimmung.wer} onWahl={w => p.onOps([{ op: 'abstimmung', phaseId: a.id, an: true, wer: w }])} />
              </>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Knopf leise onClick={() => p.onOps([{ op: 'schritt-neu', id: p.neueId(), ziel: { phaseId: a.id }, form: 'schritt', titel: FORM_VORGABE.schritt }])}>+ Schritt</Knopf>
              <Knopf leise onClick={() => p.onOps([{ op: 'phase-neu', id: p.neueId(), titel: 'Neue Phase', nach: a.id }])}>+ Phase danach</Knopf>
              {hoch && <Knopf leise onClick={() => p.onOps([hoch])}>Phase früher</Knopf>}
              {runter && <Knopf leise onClick={() => p.onOps([runter])}>Phase später</Knopf>}
              <Knopf leise onClick={() => p.onOps([{ op: 'weg', id: a.id }])} titel="In den Papierkorb des Pakets (30 Tage zurückholbar)">Phase löschen</Knopf>
            </div>
          </>
        )}
      </>
    );
  }
  const i = a.info, id = i.id;
  const hoch = schrittVerschieben(p.fassung, id, 'hoch'), runter = schrittVerschieben(p.fassung, id, 'runter');
  const ziele = schritteDerPhase(p.fassung, id);
  const knoten = p.fassung.knoten.find(k => k.id === id);
  const frei = p.bibliothek.filter(x => !i.bausteine.some(y => y.bausteinId === x.id));
  return (
    <>
      <b style={{ fontSize: TYP.body, color: C.ink }}>{i.titel}</b>
      {!b && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0, fontSize: TYP.bedien }}>
          {paketKnotenZeilen(i).map((z, n) => <span key={n} style={{ display: 'contents' }}><dt style={{ color: C.inkDim }}>{z.name}</dt><dd style={{ margin: 0, color: C.ink }}>{z.wert}</dd></span>)}
        </dl>
      )}
      {b && (
        <>
          <TextFeld label="Titel des Schritts" wert={i.titel} onWert={t => t.trim() && p.onOps([{ op: 'schritt', id, titel: t.trim() }])} />
          <span style={klein}>Form</span>
          <Pillen liste={PALETTE_FORMEN.map(f => ({ id: f, label: FORM_TITEL[f] }))} aktiv={knoten?.form && (PALETTE_FORMEN as readonly string[]).includes(knoten.form) ? knoten.form as (typeof PALETTE_FORMEN)[number] : null} onWahl={f => p.onOps([{ op: 'schritt', id, form: f }])} />
          {!i.formGesetzt && <span style={klein}>{`Jetzt abgeleitet: ${i.formTitel}`}</span>}
          <span style={klein}>Frist (Tage ab Ankunft)</span>
          <ZahlFeld label="Frist in Tagen" wert={i.frist ?? null} min={0} max={365} onWert={n => p.onOps([{ op: 'schritt', id, frist: n }])} />
          {knoten?.form === 'erinnerung' && (<><span style={klein}>Höchstens Runden</span><ZahlFeld label="Versuche" wert={i.versuche ?? null} min={1} max={20} onWert={n => p.onOps([{ op: 'schritt', id, versuche: n }])} /></>)}
          {/* 26.10.: „Lieferzeit startet hier“ — ab dem Tag, an dem dieser Schritt erledigt ist (Entscheidung: mit „ja“), so viele Werktage bis zur Lieferung. */}
          <span style={klein}>Lieferzeit startet hier (Werktage, leer = nein)</span>
          <ZahlFeld label="Lieferzeit in Werktagen" wert={i.lieferzeit ?? null} min={1} max={250} onWert={n => p.onOps([{ op: 'schritt', id, lieferzeit: n }])} />
          <span style={klein}>Zuständig</span>
          <Pillen liste={ZUSTAENDIG} aktiv={i.zustaendig ?? 'intern'} onWahl={z => p.onOps([{ op: 'schritt', id, zustaendig: z }])} />
          <Schalter an={!!i.kundeSichtbar} onChange={an => p.onOps([{ op: 'schritt', id, kundeSichtbar: an }])} erklaerung={ERKL_KUNDE_SIEHT}>Kunde sieht es</Schalter>
          {knoten?.form === 'entscheidung' && (
            <>
              <span style={klein}>Wenn ja, weiter bei</span>
              <select aria-label="Wenn ja, weiter bei" value={knoten.zweige?.ja ?? ''} onChange={e => p.onOps([{ op: 'zweig', id, ja: e.target.value || null }])} style={auswahlStil}>
                <option value="">dem nächsten Schritt</option>
                {ziele.map(z => <option key={z.id} value={z.id}>{z.titel}</option>)}
              </select>
              {!knoten.zweige?.nein && <Knopf leise onClick={() => p.onOps([{ op: 'nein-erinnerung', id: p.neueId(), entscheidungId: id }])}>+ Erinnerung, wenn nein</Knopf>}
            </>
          )}
        </>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={klein}>Bausteine</span>
        {i.bausteine.map(x => (
          <div key={x.knotenId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.ink }}>
            <span>{x.titel}</span>
            {x.kundeFrei === false && <span title={x.grund}><Chip farbe={C.inkDim}>nicht für Kunden</Chip></span>}
            {b && <Knopf leise onClick={() => p.onOps([{ op: 'weg', id: x.knotenId }])} titel="Baustein vom Schritt lösen (Papierkorb)">entfernen</Knopf>}
          </div>
        ))}
        {!i.bausteine.length && <span style={klein}>keine</span>}
        {b && frei.length > 0 && (
          <select aria-label="Baustein aus der Bibliothek hinzufügen" value="" onChange={e => e.target.value && p.onOps([{ op: 'baustein-dazu', id: p.neueId(), schrittId: id, bausteinId: e.target.value }])} style={auswahlStil}>
            <option value="">+ Baustein aus der Bibliothek …</option>
            {frei.map(x => <option key={x.id} value={x.id}>{`${x.titel}${x.kundeFrei ? '' : ' (nicht für Kunden)'}`}</option>)}
          </select>
        )}
      </div>
      {b && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Knopf leise onClick={() => p.onOps([{ op: 'schritt-neu', id: p.neueId(), ziel: { phaseId: a.phaseId, nach: id }, form: 'schritt', titel: FORM_VORGABE.schritt }])}>+ Schritt danach</Knopf>
          {hoch && <Knopf leise onClick={() => p.onOps([hoch])}>nach oben</Knopf>}
          {runter && <Knopf leise onClick={() => p.onOps([runter])}>nach unten</Knopf>}
          <Knopf leise onClick={() => p.onOps([{ op: 'weg', id }])} titel="In den Papierkorb des Pakets (30 Tage zurückholbar)">löschen</Knopf>
        </div>
      )}
    </>
  );
}
