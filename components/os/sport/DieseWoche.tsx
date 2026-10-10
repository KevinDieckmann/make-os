'use client';

// ─── Sport — Diese Woche: Plan ↔ Ist, Tagesform an der Einheit, abhaken, verschieben, in den Kalender (09.10.2026) ──────────
// Handy zuerst (am Handy wird im Gym geschaut): je Tag die geplanten Einheiten mit Status (erledigt · heute · offen · verpasst), an HEUTE
// der Hinweis aus der Tagesform (lib/sport/tagesform.ts). Ein Tipp „Erledigt“ legt eine Einheit von Hand an (ein späterer WHOOP-Import
// derselben Einheit zählt nicht doppelt — lib/sport/training.ts). Verschieben schreibt den Plan einzelner Tage (`plan-tage`); der Kalender-
// Block geht NUR über den vorhandenen Blöcke-Weg (POST /api/sport/kalender → blockAnlegen), nach Klick. Entlastung nach HRV-Trend als
// Vorschlag (lib/sport/entlastung.ts). Rechnen nur in lib/sport/*. Vorschläge, keine Trainingsberatung.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, Hinweis as UiHinweis, LEUCHT, auswahl } from '../ui';
import { Hinweis, datumKurz, de, KLASSE_FARBE, einheitText, quelleText } from './teile';
import { WOCHENTAGE, WOCHENTAG_LABEL, PHASE_LABEL, PLAN_LABEL, neueId, type Op, type SportStand, type PlanEinheit } from '@/lib/sport/modell';
import { wocheFuer, planGegenIst, planPruefen, tagAus, einheitenVon, type PlanZeile } from '@/lib/sport/plan-bau';
import { tagesformHinweis } from '@/lib/sport/tagesform';
import { entlastungPruefen } from '@/lib/sport/entlastung';
import { montagVon, tagPlus } from '@/lib/sport/pace';
import type { VitalTag } from '@/app/api/sport/route';

const STATUS: Record<PlanZeile['status'], { text: string; farbe: string }> = {
  erfuellt: { text: 'erledigt', farbe: LEUCHT.gut }, heute: { text: 'heute', farbe: C.aktiv }, offen: { text: 'geplant', farbe: C.inkDim }, verpasst: { text: 'ausgefallen', farbe: LEUCHT.achtung },
};

export function DieseWoche({ stand, heute, vitals, schicke }: { stand: SportStand; heute: string; vitals: Record<string, VitalTag>; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const montag = montagVon(heute);
  const pw = useMemo(() => wocheFuer(stand, montag), [stand, montag]);
  const pi = useMemo(() => planGegenIst(stand, montag, heute), [stand, montag, heute]);
  const hinweise = useMemo(() => planPruefen(pw.woche), [pw.woche]);
  const rec = vitals[heute]?.recovery;
  const entlastung = useMemo(() => entlastungPruefen(vitals, heute, stand.einstellungen?.entlastung), [vitals, heute, stand.einstellungen?.entlastung]);
  const [meldung, setMeldung] = useState<string | null>(null);
  const tage = WOCHENTAGE.map((t, i) => ({ t, datum: tagPlus(montag, i) }));

  /** Eine Einheit an einen anderen Tag dieser Woche (beide Tage als Einzeltage). */
  const verschieben = async (z: PlanZeile, nach: string) => {
    const vonTag = WOCHENTAGE[tage.findIndex(x => x.datum === z.plan.datum)];
    const nachTag = WOCHENTAGE[tage.findIndex(x => x.datum === nach)];
    const rest = einheitenVon(pw.woche[vonTag], vonTag).filter(e => e.id !== z.plan.einheit.id);
    const dort = einheitenVon(pw.woche[nachTag], nachTag);
    if (dort.length >= 4) { setMeldung('An diesem Tag stehen schon vier Einheiten.'); return; }
    const neu: PlanEinheit = { ...z.plan.einheit, id: `${nachTag}-v${dort.length + 1}-${z.plan.einheit.id}`.slice(0, 60) };
    await schicke([{ op: 'plan-tage', tage: { [z.plan.datum]: rest.length ? tagAus(rest) : { art: 'frei' }, [nach]: tagAus([...dort, neu]) } }], `Verschoben auf ${WOCHENTAG_LABEL[nachTag]}.`);
  };
  const erledigt = (z: PlanZeile) => schicke([{ op: 'training', eintrag: {
    id: neueId('tr'), datum: z.plan.datum <= heute ? z.plan.datum : heute, sport: einheitText({ ...z.plan.einheit, dauerMin: undefined }), art: z.plan.einheit.sparte,
    ...(z.plan.einheit.dauerMin ? { dauerMin: z.plan.einheit.dauerMin } : { dauerMin: 45 }),
  } }], 'Erledigt — gut gemacht.');
  const inKalender = async (z: PlanZeile, uhr: string) => {
    const [h, m] = uhr.split(':').map(Number);
    const r = await fetch('/api/sport/kalender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: z.plan.datum, einheitId: z.plan.einheit.id, startMin: h * 60 + m }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Nicht erreichbar.' }));
    setMeldung(r.ok ? `Im Kalender: ${WOCHENTAG_LABEL[z.plan.wochentag]} ${uhr}.` : (r.fehler ?? r.error ?? 'Nicht angelegt.'));
    return !!r.ok;
  };

  return (
    <Karte i={1}>
      <Ueberschrift rechts={pi.geplant ? `${pi.erfuellt} von ${pi.geplant} erledigt` : undefined}>Diese Woche</Ueberschrift>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip farbe={C.inkDim}>{pw.quelle === 'block' ? `Block · Woche ${pw.blockWoche} von ${pw.blockWochen}` : pw.vorlage.name}</Chip>
        {pw.phase !== 'aufbau' && <Chip farbe={pw.phase === 'deload' ? LEUCHT.schlaf : LEUCHT.business}>{PHASE_LABEL[pw.phase]}</Chip>}
        {pw.eigeneTage?.length ? <Chip farbe={C.inkDim}>{pw.eigeneTage.length} Tag{pw.eigeneTage.length === 1 ? '' : 'e'} angepasst</Chip> : null}
      </div>

      {entlastung?.vorschlag && pw.phase !== 'deload' && (
        <UiHinweis art="achtung" titel="Entlastung vorschlagen"
          aktion={<Knopf onClick={() => schicke([{ op: 'wochen-phase', montag, phase: 'deload' }], 'Diese Woche ist leichter.')}>Diese Woche leichter</Knopf>}>
          {entlastung.text} Umfang runter, harte Einheiten werden mittel — nur ein Vorschlag.
        </UiHinweis>
      )}
      {pw.eigenePhase && pw.phase === 'deload' && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '4px 0 10px' }}>Diese Woche leichter (von dir gesetzt). <button type="button" onClick={() => void schicke([{ op: 'wochen-phase', montag, phase: null }], 'Wieder normal.')} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 600, minHeight: 44 }}>Zurücknehmen</button></div>
      )}
      {meldung && <p role="status" style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '0 0 8px' }}>{meldung}</p>}

      {!pi.geplant && <Leer>Für diese Woche ist nichts geplant — unten im Baukasten eine Woche bauen oder eine Vorlage übernehmen.</Leer>}
      {tage.map(({ t, datum }) => {
        const zeilen = pi.zeilen.filter(z => z.plan.datum === datum);
        const tag = pw.woche[t];
        const istHeute = datum === heute;
        if (!zeilen.length && datum < heute) return null;
        return (
          <section key={t} aria-label={`${WOCHENTAG_LABEL[t]} ${datumKurz(datum)}`} style={{ padding: '10px 0', borderBottom: `1px solid ${RAND.flaeche}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: istHeute ? TYP.titel : TYP.body, color: istHeute ? C.ink : C.inkDim }}>{istHeute ? 'Heute' : WOCHENTAG_LABEL[t]} <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500 }}>{datumKurz(datum)}</span></span>
              {!zeilen.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{tag.art === 'ruhe' ? 'Ruhetag' : 'frei'}</span>}
            </div>
            {zeilen.map(z => <EinheitZeile key={z.plan.einheit.id} z={z} heute={heute} rec={istHeute ? rec : undefined} tage={tage.filter(x => x.datum >= heute && x.datum !== z.plan.datum)} onErledigt={() => erledigt(z)} onVerschieben={nach => verschieben(z, nach)} onKalender={uhr => inKalender(z, uhr)} />)}
          </section>
        );
      })}

      {pi.zusaetzlich.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Zusätzlich</div>
          {pi.zusaetzlich.map(e => <div key={e.id} style={{ fontSize: TYP.bedien, color: C.inkDim, padding: '4px 0' }}>{datumKurz(e.datum)} · {e.titel}{e.dauerMin ? ` · ${e.dauerMin} min` : ''} · <span style={{ color: C.inkLeise }}>{quelleText(e.quelle, e.auch)}</span></div>)}
        </div>
      )}
      {pi.geplant > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
          <span>Zeit {de(pi.minutenIst / 60)} von {de(pi.minutenPlan / 60)} h</span>
          {(pi.strainIst !== undefined || pi.strainPlan !== undefined) && <span>Strain {pi.strainIst !== undefined ? de(pi.strainIst) : '—'}{pi.strainPlan !== undefined ? ` von ${de(pi.strainPlan)} geplant` : ''}</span>}
          {pi.verpasst > 0 && <span>{pi.verpasst} ausgefallen</span>}
        </div>
      )}
      {hinweise.map(h => <Hinweis key={h.art + h.tage.join()}>{h.text}</Hinweis>)}
      <Hinweis>Struktur und Erfassung — keine Trainingsberatung. Bei Schmerzen oder Beschwerden führen Ärztin und Physio, nicht der Plan.</Hinweis>
    </Karte>
  );
}

function EinheitZeile({ z, heute, rec, tage, onErledigt, onVerschieben, onKalender }: {
  z: PlanZeile; heute: string; rec?: number; tage: { t: string; datum: string }[];
  onErledigt: () => Promise<boolean>; onVerschieben: (nach: string) => Promise<void>; onKalender: (uhr: string) => Promise<boolean>;
}) {
  const e = z.plan.einheit;
  const farbe = KLASSE_FARBE[e.sparte];
  const st = STATUS[z.status];
  const tf = z.status !== 'erfuellt' ? tagesformHinweis(e, rec) : null;
  const [mehr, setMehr] = useState(false);
  const [uhr, setUhr] = useState(e.uhrzeit ?? '07:00');
  const kannErledigen = z.status !== 'erfuellt' && z.plan.datum <= heute;
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 14, background: z.status === 'heute' ? 'rgba(255,255,255,.05)' : 'transparent', border: `1px solid ${z.status === 'heute' ? RAND.stark : RAND.flaeche}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: farbe, flex: '0 0 auto' }} />
        <span style={{ fontSize: TYP.body, fontWeight: 600, flex: '1 1 160px', minWidth: 0 }}>{einheitText(e)}</span>
        <Chip farbe={st.farbe}>{z.status === 'erfuellt' ? `✓ ${st.text}` : st.text}{z.versetzt ? ` · ${z.versetzt > 0 ? 'einen Tag später' : 'einen Tag früher'}` : ''}</Chip>
      </div>
      {(e.intensitaet || e.zone || e.strain !== undefined || e.notiz) && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>{[e.intensitaet ? `Intensität ${e.intensitaet}` : null, e.zone ? `Zone ${e.zone}` : null, e.strain !== undefined ? `Strain-Ziel ${de(e.strain)}` : null, e.notiz].filter(Boolean).join(' · ')}</div>}
      {z.ist && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>{z.ist.titel}{z.ist.dauerMin ? ` · ${z.ist.dauerMin} min` : ''}{z.ist.strain !== undefined ? ` · Strain ${de(z.ist.strain)}` : ''} · <span style={{ color: C.inkLeise }}>{quelleText(z.ist.quelle, z.ist.auch)}{z.ersatz ? ` · als ${PLAN_LABEL[z.ist.klasse as PlanEinheit['sparte']] ?? z.ist.klasse} erfasst` : ''}</span></div>}
      {tf && <div role="note" style={{ marginTop: 8, fontSize: TYP.bedien, lineHeight: 1.45, color: tf.stufe === 'rot' ? LEUCHT.kritisch : LEUCHT.achtung }}><b>{tf.kurz}:</b> <span style={{ color: C.inkDim }}>{tf.text}</span></div>}
      {z.status !== 'erfuellt' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {kannErledigen && <Knopf haupt={z.status === 'heute'} farbe={farbe} onClick={async () => { await onErledigt(); }}>Erledigt</Knopf>}
          <Knopf leise onClick={() => setMehr(m => !m)}>{mehr ? 'Weniger' : 'Verschieben · Kalender'}</Knopf>
        </div>
      )}
      {mehr && z.status !== 'erfuellt' && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {tage.length > 0 && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>Verschieben auf
              <select aria-label="Verschieben auf" defaultValue="" style={auswahl} onChange={ev => { if (ev.target.value) void onVerschieben(ev.target.value); }}>
                <option value="" disabled>Tag wählen</option>
                {tage.map(x => <option key={x.datum} value={x.datum}>{WOCHENTAG_LABEL[x.t as keyof typeof WOCHENTAG_LABEL]} {datumKurz(x.datum)}</option>)}
              </select>
            </label>
          )}
          {z.plan.datum >= heute && (
            <form onSubmit={ev => { ev.preventDefault(); void onKalender(uhr); }} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Im Kalender um <input type="time" value={uhr} step={900} onChange={ev => setUhr(ev.target.value)} style={{ ...auswahl, colorScheme: 'dark' }} /></label>
              <Knopf typ="submit" leise>Als Block eintragen</Knopf>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
