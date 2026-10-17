'use client';

// ─── Fulfillment · Fall › Kunde (C2, 10.10.; 12.10. neu gezeichnet; seit 17.10. „eine Karte je Sache“ — FULFILLMENT_KONZEPT.md 5.2, 5.4, 5.5) ──────────────
// Die INTERNE Steuerung dessen, was beim Kunden ankommt und was zurückkommt. Rückmeldung 17.10.: „Es dupliziert sich — lieber wenig und klar.“ Seitdem ohne
// eigene Lage-Kacheln oben (die Ampel steht im Kopf des Falls, „Dem Kunden zeigen“ dort als EIN Knopf) — nur noch je Sache eine Karte:
//   1. Kunden-Link (Schalter der Instanz — nur Inhaber —, anlegen; verlängern/neu/widerrufen/Rechte hinter „⋯“).
//   2. Playbook & Formulare (gemeinsam ausfüllen, exportieren — das Playbook gehört dem Kunden).
//   3. Unterlagen (ungeprüft → freigegeben/gesperrt, Beleg, nur als Download).
//   4. Fortschritts-Report: die Zeitachse im Zwei-Wochen-Takt (erstellte Reports, Soll-Termine, nächster fälliger Tag) und der Report-Weg der
//      Leistungstreppe (`MandatFortschritt`: erstellen, Mail vorbereiten, Gesundheit).
//   5. Kunden-Puls als Verlauf neben der Gesundheit des Mandats („In die Gesundheit übernehmen“), unter der Schwelle der Weg zum Gespräch; Seltenes hinter „⋯“.
// Daten nur über /api/fulfillment/kunde{,/datei,/vorschau} und /api/fulfillment/fall (Reports, Follow-ups); der Server filtert (Business only). Das
// Token eines Links steht nur einmal hier — direkt nach „Link anlegen“ — und wird nirgends gespeichert.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Knopf, Hinweis, Ueberschrift, Chip, Leer, Schalter, Feldzeile, Erklaert, Zeile, ZeileAktionen, Liste, eingabe, feld, LEUCHT, useRueckfrage } from '../../ui';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { pulsStufe } from '@/lib/fulfillment/regeln';
import { pulsReihe, reportAchse, reportLage } from '@/lib/fulfillment/prozesse/ansichten';
import { fallStartTag } from '@/lib/fulfillment/prozesse/fall';
import type { KundeStand, InternFormular } from '@/lib/fulfillment/kunde/server';
import type { KundenFormular } from '@/lib/fulfillment/kunde/sicht';
import { KUNDE_ANNEHMEN, ZWECK_TEXT } from '@/lib/fulfillment/kunde/upload';
import { pulsMail } from '@/lib/fulfillment/kunde/puls';
import { FormularKarte, type SpeicherErgebnis } from './KundenAnsicht';
import { MandatFortschritt } from '../../mandate/treppe/Fortschritt';
import { TREPPE_EREIGNIS } from '../../mandate/treppe/daten';
import { useFall, geaendert, tagKurz } from '../prozesse/daten';
import { anzahl, satz as satzEnde } from '@/lib/text/zahlwort';
import { MehrKnopf, Zeitachse } from '../reise/teile';
import { JETZT, AMPEL_FARBE as AMPEL } from '../reise/bilder';
import { useStellenSprung } from '../reise/sprung';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const tag = (t?: string) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t ?? '');
const STATUS_FARBE = { aktiv: LEUCHT.gut, abgelaufen: LEUCHT.achtung, widerrufen: C.inkLeise } as const;
const UNTERLAGE_FARBE = { ungeprueft: LEUCHT.achtung, freigegeben: LEUCHT.gut, gesperrt: LEUCHT.kritisch } as const;
const UNTERLAGE_TEXT = { ungeprueft: 'ungeprüft', freigegeben: 'freigegeben', gesperrt: 'gesperrt' } as const;

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; j: Record<string, unknown> }> {
  const r = await fetch('/api/fulfillment/kunde', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) as Record<string, unknown> : { fehler: 'Keine Verbindung.' };
  return { ok: !!r?.ok && j.ok !== false, status: r?.status ?? 0, j };
}

/** Ein internes Formular in der Form der Kunden-Sicht (für `FormularKarte`). */
const alsKundenFormular = (f: InternFormular): KundenFormular => ({
  schluessel: f.schluessel, titel: f.titel, prozent: f.prozent, stand: f.stand, antworten: f.antworten,
  abschnitte: f.abschnitte.map(a => ({ schluessel: a.schluessel, titel: a.titel, fertig: a.fertig, fragen: a.fragen.map(q => ({ id: q.id, frage: q.frage, art: q.art as KundenFormular['abschnitte'][number]['fragen'][number]['art'], ...(q.optionen ? { optionen: q.optionen } : {}) })) })),
});

type Tun = (body: Record<string, unknown>, gut?: string) => Promise<Record<string, unknown> | null>;

export function FallKunde({ mandatId }: { mandatId: string }) {
  const [s, setS] = useState<KundeStand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung'; text: string } | null>(null);
  const [frisch, setFrisch] = useState<{ art: 'link' | 'puls'; url: string } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const fall = useFall(mandatId);
  useStellenSprung();
  const laden = useCallback(async () => {
    const r = await fetch(`/api/fulfillment/kunde?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok) { setFehler(String(j.fehler ?? 'Der Stand ließ sich nicht laden.')); return; }
    setFehler(null);
    setS(j as KundeStand);
  }, [mandatId]);
  useEffect(() => { void laden(); }, [laden]);
  // Ein Report entsteht im eingebetteten Report-Weg (Leistungstreppe) — danach den Fall (Report-Zeitachse) und den Puls neu laden.
  useEffect(() => {
    const neu = () => { geaendert(); void laden(); };
    window.addEventListener(TREPPE_EREIGNIS, neu);
    return () => window.removeEventListener(TREPPE_EREIGNIS, neu);
  }, [laden]);

  const tun: Tun = async (body, gut) => {
    const r = await post({ mandatId, ...body });
    if (!r.ok) { setMeldung({ art: 'kritisch', text: String(r.j.fehler ?? 'Nicht gespeichert.') }); return null; }
    if (gut) setMeldung({ art: 'gut', text: gut });
    await laden();
    if (body.aktion === 'puls-uebernehmen' || body.aktion === 'puls-hand') geaendert();
    return r.j;
  };
  const voll = (pfad: unknown, url: unknown) => (typeof url === 'string' ? url : `${window.location.origin}${String(pfad)}`);

  if (fehler) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  if (!s) return <Leer>Wird geladen …</Leer>;
  const heute = localDay();
  const fd = fall.daten;
  const start = fd?.fall ? fallStartTag(fd.fall) : (fd?.mandat.start ?? heute).slice(0, 10);
  const achse = reportAchse({ start, heute, reports: fd?.reports ?? [], gesendetAm: fd?.report?.gesendetAm ?? null });
  const rl = reportLage(achse, heute);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}
      <LinkKarte s={s} tun={tun} frisch={frisch} setFrisch={setFrisch} setMeldung={setMeldung} bestaetigen={bestaetigen} voll={voll} />

      <FormulareKarte s={s} mandatId={mandatId} laden={laden} />

      <Unterlagen mandatId={mandatId} s={s} laden={laden} setMeldung={setMeldung} bestaetigen={bestaetigen} />

      <Karte i={4} id="kunde-report">
        <Ueberschrift erklaerung="fulfillment.reportTakt" rechts={<Chip farbe={AMPEL[rl.ampel]}>{rl.antwort}</Chip>}>Fortschritts-Report</Ueberschrift>
        <Zeitachse heuteX={achse.heuteX} links={`Fallstart ${tagKurz(achse.von)}`} rechts={tagKurz(achse.bis)}
          beschreibung={`${satzEnde(`Reports seit ${tagKurz(achse.von)}: ${achse.reports.map(r => tagKurz(r.tag)).join(', ') || 'keiner'}`)} ${satzEnde(`Nächster fällig am ${tagKurz(achse.naechsterFaellig)}`)}`}
          punkte={[
            ...achse.takt.map(t => ({ x: t.x, farbe: t.erfuellt ? LEUCHT.gut : t.tag <= heute ? LEUCHT.kritisch : C.inkLeise, voll: false, raute: true, titel: `Soll ${tagKurz(t.tag)}${t.erfuellt ? ' · erfüllt' : t.tag <= heute ? ' · ohne Report' : ''}` })),
            ...achse.reports.map(r => ({ x: r.x, farbe: LEUCHT.gut, voll: true, gross: true, titel: `Report ${tagKurz(r.tag)}${r.gesendet ? ' · gesendet' : ''}` })),
            { x: Math.min(1, Math.max(0, achse.takt.find(t => t.tag === achse.naechsterFaellig)?.x ?? achse.heuteX)), farbe: achse.naechsterFaellig <= heute ? LEUCHT.achtung : JETZT, voll: false, gross: true, titel: `nächster fällig ${tagKurz(achse.naechsterFaellig)}` },
          ]} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: TYP.bedien, color: C.inkDim }}>
          <span><span aria-hidden style={{ color: LEUCHT.gut, marginRight: 6 }}>●</span>Report erstellt</span>
          <span><span aria-hidden style={{ color: C.inkLeise, marginRight: 6 }}>◇</span>Soll-Termin (alle 14 Tage)</span>
          <span><span aria-hidden style={{ color: JETZT, marginRight: 6 }}>|</span>heute</span>
        </div>
        <div style={klein}>{rl.unter} Im Report steht dasselbe Bild wie auf der Kunden-Seite (die Reise, Ziele, was wir brauchen); gesendet wird nur per Klick — mit der Puls-Frage, wenn der Kunden-Link aktiv ist.</div>
        <MandatFortschritt mandatId={mandatId} imFall />
      </Karte>

      <PulsKarte s={s} tun={tun} onLink={url => setFrisch({ art: 'puls', url })} voll={voll} followups={fd?.followups ?? []} />
      {dialog}
    </div>
  );
}

// ─── Kunden-Puls: Verlauf, Health, Gespräch ─────────────────────────────────────────────────────────────────────────────────────────
function PulsKarte({ s, tun, onLink, voll, followups }: { s: KundeStand; tun: Tun; onLink: (url: string) => void; voll: (p: unknown, u: unknown) => string; followups: { id: string; text: string; faellig: string; status: string }[] }) {
  const [wert, setWert] = useState('');
  const [satz, setSatz] = useState('');
  const [schwelle, setSchwelle] = useState(String(s.puls.schwelle));
  const [offen, setOffen] = useState<'hand' | 'schwelle' | null>(null);
  const [alle, setAlle] = useState(false);
  const reihe = pulsReihe(s.puls.liste, s.puls.health);
  const letzter = s.puls.liste[0];
  const kritisch = reihe.letzter ? pulsStufe(reihe.letzter.wert, s.puls.schwelle) === 'kritisch' : false;
  const gespraech = followups.filter(x => /Gespräch anbieten/.test(x.text));
  const B = 300, H = 90, y = (w: number) => 8 + (1 - w / 10) * (H - 16);
  const mehr = [
    { id: 'hand', label: 'Puls von Hand eintragen', hinweis: 'Aus dem Gespräch — 0 bis 10 und ein Satz.', tun: () => setOffen('hand') },
    { id: 'schwelle', label: `Schwelle ändern (heute ${s.puls.schwelle})`, hinweis: 'Bis zu diesem Wert gilt der Puls als „braucht Aufmerksamkeit“.', tun: () => setOffen('schwelle') },
    ...(s.link?.rechte.puls && s.schalter.an ? [{ id: 'link', label: 'Puls-Link anlegen', hinweis: 'Ein Link, der nur die Puls-Frage öffnet.', tun: async () => { const j = await tun({ aktion: 'puls-anfrage' }); if (j) onLink(voll(j.pfad, j.url)); } }] : []),
  ];
  return (
    <Karte i={2} id="kunde-puls">
      <Ueberschrift erklaerung="fulfillment.pulsSchwelle" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{reihe.letzter && <Chip farbe={kritisch ? LEUCHT.kritisch : reihe.letzter.wert >= 9 ? LEUCHT.gut : C.aktiv}>{reihe.letzter.wert} / 10</Chip>}<MehrKnopf titel="Kunden-Puls" mehr={mehr} /></span>}>Kunden-Puls</Ueberschrift>
      {!reihe.punkte.length ? <Leer>Noch kein Puls. Die Frage geht mit dem 2-Wochen-Report raus — oder über „⋯ › Puls von Hand eintragen“.</Leer> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, alignItems: 'center' }}>
          {/* 15.10. (Abnahme B7): der Verlauf führt weiter — ein Tipp zeigt alle Werte mit Datum, Satz und „in die Health übernehmen“. */}
          <button type="button" className="fassbar" onClick={() => setAlle(true)} aria-label={`Kunden-Puls: ${reihe.punkte.map(p => `${tagKurz(p.tag)} ${p.wert}`).join(', ')}; Schwelle ${s.puls.schwelle}. Alle Werte zeigen.`} title="Alle Werte zeigen"
            style={{ display: 'block', width: '100%', maxWidth: 420, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg viewBox={`0 0 ${B} ${H}`} width="100%" style={{ display: 'block' }} aria-hidden>
            <rect x={0} y={y(s.puls.schwelle)} width={B} height={H - 8 - y(s.puls.schwelle)} fill={`${LEUCHT.kritisch}12`} />
            <line x1={0} x2={B} y1={y(s.puls.schwelle)} y2={y(s.puls.schwelle)} stroke={LEUCHT.kritisch} strokeOpacity={0.6} strokeDasharray="4 4" />
            <text x={B - 4} y={Math.min(H - 2, y(s.puls.schwelle) + 13)} textAnchor="end" fontSize={11} fill={C.inkLeise}>Schwelle {s.puls.schwelle}</text>
            {reihe.punkte.length > 1 && <polyline fill="none" stroke={LEUCHT.puls} strokeWidth={2} points={reihe.punkte.map(p => `${10 + p.x * (B - 20)},${y(p.wert)}`).join(' ')} />}
            {reihe.punkte.map((p, i) => <circle key={i} cx={10 + p.x * (B - 20)} cy={y(p.wert)} r={4} fill={pulsStufe(p.wert, s.puls.schwelle) === 'kritisch' ? LEUCHT.kritisch : LEUCHT.puls} />)}
          </svg>
          </button>
          <div style={{ display: 'grid', gap: 6 }}>
            {reihe.letzter && <div style={{ fontSize: TYP.body, color: C.ink }}><b>{reihe.letzter.wert} / 10</b> am {tagKurz(reihe.letzter.tag)}{letzter?.satz ? <span style={klein}> — „{letzter.satz}“</span> : null}</div>}
            <div style={klein}>Gesundheit des Mandats (Zufriedenheit): <b style={{ color: C.ink }}>{reihe.health ?? 'noch nicht bewertet'}</b>{reihe.healthPasst ? ' — passt zum letzten Puls.' : ` — der letzte Puls entspricht ${reihe.vorschlagHealth}.`}</div>
            {!reihe.healthPasst && letzter && (
              <Erklaert erklaerung="fulfillment.pulsInHealth" name="In die Gesundheit des Mandats übernehmen">
                <Knopf onClick={() => tun({ aktion: 'puls-uebernehmen', pulsId: letzter.id }, `Übernommen: Zufriedenheit des Mandats = ${letzter.wert * 10}.`)}>In die Gesundheit des Mandats übernehmen ({reihe.vorschlagHealth})</Knopf>
              </Erklaert>
            )}
          </div>
        </div>
      )}
      {kritisch && (
        <Hinweis art="kritisch" titel="Puls unter der Schwelle — Gespräch anbieten" aktion={<Link href={WEG.freigaben(undefined, 'business')} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Freigabe-Stapel ›</Link>}>
          {gespraech.length ? satzEnde(`Follow-up „${gespraech[0].text}“ ${gespraech[0].status === 'offen' ? `fällig ${tagKurz(gespraech[0].faellig)}` : gespraech[0].status}`) : 'Der Vorschlag „Gespräch anbieten“ liegt im Freigabe-Stapel — die Freigabe legt ein Follow-up am Mandat an (in zwei Tagen fällig).'}
        </Hinweis>
      )}
      {s.puls.liste.length > 0 && <div><Knopf leise onClick={() => setAlle(!alle)}>{alle ? 'Werte ausblenden' : s.puls.liste.length === 1 ? '1 Wert zeigen' : `Alle ${anzahl(s.puls.liste.length, 'Wert', 'Werte')} zeigen`}</Knopf></div>}
      {alle && (
        <Liste>
          {s.puls.liste.map(p => (
            <ZeileAktionen key={p.id} titel={`Puls ${p.wert}`} mehr={[{ id: 'health', label: 'In die Gesundheit des Mandats übernehmen', hinweis: `Zufriedenheit = ${p.wert * 10}`, tun: () => tun({ aktion: 'puls-uebernehmen', pulsId: p.id }, `Übernommen: Zufriedenheit des Mandats = ${p.wert * 10}.`) }]}>
              <Zeile umbrechen titel={<span><b>{p.wert}</b> / 10 · {tag(p.am)}</span>} unter={`${p.quelle === 'link' ? 'über den Link' : 'von Hand'}${p.satz ? ` — „${p.satz}“` : ''}`} />
            </ZeileAktionen>
          ))}
        </Liste>
      )}
      {offen === 'hand' && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 120px) minmax(0, 1fr) auto', alignItems: 'end' }}>
          <Feldzeile label="Wert 0–10"><input value={wert} inputMode="numeric" onChange={e => setWert(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={eingabe} /></Feldzeile>
          <Feldzeile label="Ein Satz (freiwillig)"><input value={satz} maxLength={500} onChange={e => setSatz(e.target.value)} style={eingabe} /></Feldzeile>
          <Knopf aus={wert === '' || Number(wert) > 10} onClick={async () => { if (await tun({ aktion: 'puls-hand', wert: Number(wert), satz }, 'Puls eingetragen.')) { setWert(''); setSatz(''); setOffen(null); } }}>Eintragen</Knopf>
        </div>
      )}
      {offen === 'schwelle' && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 160px) auto', alignItems: 'end' }}>
          <Feldzeile label="Schwelle" erklaerung="fulfillment.pulsSchwelle"><input value={schwelle} inputMode="numeric" onChange={e => setSchwelle(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={eingabe} /></Feldzeile>
          <Knopf leise aus={schwelle === String(s.puls.schwelle) || schwelle === '' || Number(schwelle) > 10} onClick={async () => { if (await tun({ aktion: 'puls-schwelle', wert: Number(schwelle) }, 'Schwelle gespeichert.')) setOffen(null); }}>Speichern</Knopf>
        </div>
      )}
      {s.puls.offen && <div style={klein}>Eine Puls-Frage ist offen (bis {tag(s.puls.offen.offenBis)}).</div>}
    </Karte>
  );
}

// ─── Kunden-Link ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function LinkKarte({ s, tun, frisch, setFrisch, setMeldung, bestaetigen, voll }: {
  s: KundeStand; tun: Tun; frisch: { art: 'link' | 'puls'; url: string } | null; setFrisch: (f: { art: 'link' | 'puls'; url: string } | null) => void;
  setMeldung: (m: { art: 'gut' | 'kritisch'; text: string }) => void; bestaetigen: ReturnType<typeof useRueckfrage>['bestaetigen']; voll: (p: unknown, u: unknown) => string;
}) {
  const [rechte, setRechte] = useState(false);
  const l = s.link;
  const neu = async () => { const j = await tun({ aktion: 'link-anlegen' }); if (j) setFrisch({ art: 'link', url: voll(j.pfad, j.url) }); };
  const mehr = l ? [
    { id: 'rechte', label: rechte ? 'Rechte ausblenden' : 'Rechte des Links', hinweis: 'Formulare · Unterlagen · Puls', tun: () => setRechte(!rechte) },
    { id: 'verlaengern', label: 'Verlängern', hinweis: '90 Tage, höchstens bis 30 Tage nach Mandatsende.', tun: () => tun({ aktion: 'verlaengern', linkId: l.id }, 'Verlängert (90 Tage, höchstens bis 30 Tage nach Mandatsende).') },
    { id: 'neu', label: 'Neu erzeugen', hinweis: 'Der bisherige Link gilt dann nicht mehr.', tun: async () => { if (await bestaetigen({ titel: 'Neuen Link erzeugen?', text: 'Der bisherige Link gilt dann nicht mehr — auch wenn er schon verschickt ist.', ja: 'Neu erzeugen' })) await neu(); } },
    { id: 'widerrufen', label: 'Widerrufen', gefahr: true, tun: async () => { if (await bestaetigen({ titel: 'Link widerrufen?', text: 'Der Kunde sieht danach nur noch „nicht (mehr) gültig“. Antworten, Unterlagen und Puls bleiben hier.', ja: 'Widerrufen', gefahr: true })) await tun({ aktion: 'widerrufen', linkId: l.id }, 'Widerrufen.'); } },
  ] : [];
  return (
    <Karte i={3} id="kunde-link">
      <Ueberschrift erklaerung="fulfillment.kundenLink" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Chip farbe={l?.status === 'aktiv' ? STATUS_FARBE.aktiv : s.schalter.an ? C.inkDim : C.inkLeise}>{l ? l.status : s.schalter.an ? 'kein Link' : s.schalter.grund === 'betrieb' ? 'aus (Betrieb)' : 'aus'}</Chip><MehrKnopf titel="Kunden-Link" mehr={mehr} /></span>}>Kunden-Link</Ueberschrift>
      <Schalter an={s.schalter.instanz} onChange={an => void tun({ aktion: 'schalter', an }, an ? 'Kunden-Link für diese Instanz eingeschaltet.' : 'Kunden-Link ausgeschaltet — alle Links antworten „nicht gültig“.')} erklaerung="fulfillment.kundenLink">
        Kunden-Link der Instanz (nur Inhaber)
      </Schalter>
      {!s.schalter.umgebung && <Hinweis art="info">Auf dieser Instanz ist der Kunden-Link noch aus. Einschalten kann ihn der Betreiber eurer Instanz nach der Prüfung; bis dahin antwortet jeder Link „nicht gültig“. „Dem Kunden zeigen“ und die Vorschau funktionieren trotzdem.</Hinweis>}
      {!s.fall && <Hinweis art="achtung">Für dieses Mandat läuft noch kein Fall. Der Kunden-Link zeigt den Stand des Falls — erst das Kundenonboarding starten (<Link href={WEG.fulfillment('onboarding')} style={{ color: C.aktiv }}>Fulfillment › Onboarding</Link>).</Hinweis>}
      {l ? (
        <Zeile titel={`Link ${l.id.slice(0, 9)}…`} unter={`angelegt am ${tag(l.erstelltAm)} · gilt bis ${tag(l.ablaufAm)}${l.zuletztAm ? ` · zuletzt genutzt ${tag(l.zuletztAm)}` : ' · noch nicht geöffnet'} · ${[l.rechte.formular && 'Formulare', l.rechte.upload && 'Unterlagen', l.rechte.puls && 'Puls'].filter(Boolean).join(' · ') || 'nur Stand'}`} rechts={<Chip farbe={STATUS_FARBE[l.status]}>{l.status}</Chip>} />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={klein}>{s.verlauf.length ? `Kein aktiver Link (zuletzt: ${s.verlauf[0].status}).` : 'Noch kein Link für dieses Mandat.'} Ein neuer Link gilt 90 Tage; die Adresse seht ihr genau einmal.</div>
          {/* Abnahme C15: „Link anlegen“ war grau ohne Grund — jetzt steht dabei, was fehlt und wer es einschaltet. */}
          {s.fall && !s.schalter.instanz && s.schalter.umgebung && <Hinweis art="info" titel="Erst den Kunden-Link einschalten">Der Schalter „Kunden-Link der Instanz“ (oben) ist aus — einschalten kann ihn nur die Inhaberin bzw. der Inhaber. Danach legt ihr hier den Link an. Bis dahin zeigen „Vorschau hier“ und „Dem Kunden zeigen“ dieselbe Seite.</Hinweis>}
          <div><Knopf aus={!s.schalter.an || !s.fall} onClick={neu}>Link anlegen</Knopf></div>
        </div>
      )}
      {l && rechte && (
        <div style={{ display: 'grid', gap: 6 }}>
          <Schalter an={l.rechte.formular} onChange={v => void tun({ aktion: 'rechte', linkId: l.id, rechte: { formular: v } })} erklaerung="fulfillment.kundenLinkFormular">Formulare ausfüllen</Schalter>
          <Schalter an={l.rechte.upload} onChange={v => void tun({ aktion: 'rechte', linkId: l.id, rechte: { upload: v } })} erklaerung="fulfillment.kundenLinkUpload">Unterlagen hochladen</Schalter>
          <Schalter an={l.rechte.puls} onChange={v => void tun({ aktion: 'rechte', linkId: l.id, rechte: { puls: v } })} erklaerung="fulfillment.kundenLinkPuls">Kunden-Puls</Schalter>
        </div>
      )}
      {frisch && (
        <Hinweis art="gut" titel={frisch.art === 'link' ? 'Der Link — nur jetzt sichtbar' : 'Der Puls-Link — nur jetzt sichtbar'}
          aktion={<span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Knopf leise onClick={() => { void navigator.clipboard?.writeText(frisch.url); setMeldung({ art: 'gut', text: 'Kopiert. Verschickt wird er nur von euch — z. B. in der Willkommensmail.' }); }}>Kopieren</Knopf>
            {/* Puls-Mail (12.10., Paket Extern): kurzer Text mit Du/Sie aus der Akte — kopiert, gesendet wird nur von euch. */}
            {frisch.art === 'puls' && <Knopf leise onClick={() => { const m = pulsMail({ ...s.ansprache, link: frisch.url }); void navigator.clipboard?.writeText(`${m.betreff}\n\n${m.text}`); setMeldung({ art: 'gut', text: 'Mail-Text kopiert (Betreff in der ersten Zeile). Gesendet wird nur von euch.' }); }}>Mail-Text kopieren</Knopf>}
          </span>}>
          <code style={{ overflowWrap: 'anywhere', fontSize: TYP.bedien }}>{frisch.url}</code>
          <div style={klein}>Wir speichern nur einen Fingerabdruck. Verloren? Einfach neu erzeugen — der alte gilt dann nicht mehr.</div>
        </Hinweis>
      )}
    </Karte>
  );
}

// ─── Playbook & Formulare ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function FormulareKarte({ s, mandatId, laden }: { s: KundeStand; mandatId: string; laden: () => Promise<void> }) {
  const [bearbeiten, setBearbeiten] = useState<string | null>(null);
  return (
    <Karte i={4} id="kunde-formulare">
      <Ueberschrift erklaerung="fulfillment.kundeFuellt" rechts={s.formulare.length ? <span style={{ display: 'flex', gap: 10 }}><a href={`/api/fulfillment/kunde?m=${encodeURIComponent(mandatId)}&export=csv`} download style={{ color: C.aktiv, fontSize: TYP.bedien }}>CSV</a><a href={`/api/fulfillment/kunde?m=${encodeURIComponent(mandatId)}&export=pdf`} download style={{ color: C.aktiv, fontSize: TYP.bedien }}>PDF</a></span> : undefined}>Playbook & Formulare</Ueberschrift>
      {!s.formulare.length ? <Leer>Dieser Fall hat (noch) kein Formular — Playbook und Workbooks hängen als Baustein an einem Schritt des Falls.</Leer> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {s.formulare.map(f => (
            <div key={f.bausteinId} style={{ display: 'grid', gap: 6 }}>
              <Zeile titel={f.titel} umbrechen unter={<span style={{ display: 'grid', gap: 4 }}>
                <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)', maxWidth: 320 }}><span style={{ display: 'block', height: 6, borderRadius: 3, width: `${f.prozent}%`, background: f.prozent >= 100 ? LEUCHT.gut : LEUCHT.planung }} /></span>
                <span>{f.prozent} % beantwortet{f.geaendertAm ? ` · zuletzt ${tag(f.geaendertAm)} (${f.quelle === 'kunde' ? 'Kunde' : 'intern'})` : ''}{!f.kundeFuellt ? ' · nur intern' : !f.kundeTauglich ? ' · noch nicht für Kunden freigegeben' : ''}{f.fassung && f.fassung !== f.aktuelleFassung ? ` · beantwortet in Fassung ${f.fassung}` : ''}</span>
              </span>}
                rechts={<Knopf leise onClick={() => setBearbeiten(bearbeiten === f.bausteinId ? null : f.bausteinId)}>{bearbeiten === f.bausteinId ? 'Schließen' : 'Ansehen & ausfüllen'}</Knopf>} />
              {bearbeiten === f.bausteinId && (
                <FormularKarte f={alsKundenFormular(f)} aus={false} speichern={async (_k, antworten, abschnitt): Promise<SpeicherErgebnis> => {
                  const r = await post({ aktion: 'formular-intern', mandatId, bausteinId: f.bausteinId, antworten, stand: f.stand, ...(abschnitt ? { abschnitt: abschnitt.schluessel, fertig: abschnitt.fertig } : {}) });
                  if (r.ok) { await laden(); geaendert(); }
                  return r.ok ? { ok: true } : { ok: false, fehler: String(r.j.fehler ?? 'Nicht gespeichert.'), ...(r.status === 409 ? { neuLaden: true } : {}) };
                }} />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Das Playbook gehört dem Kunden — die Analyse wertet die Antworten aus, sobald sie freigegeben sind.</div>
    </Karte>
  );
}

// ─── Unterlagen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function Unterlagen({ mandatId, s, laden, setMeldung, bestaetigen }: { mandatId: string; s: KundeStand; laden: () => Promise<void>; setMeldung: (m: { art: 'gut' | 'kritisch'; text: string }) => void; bestaetigen: ReturnType<typeof useRueckfrage>['bestaetigen'] }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ablegen, setAblegen] = useState(false);
  const hoch = async () => {
    if (!datei) return;
    setLaeuft(true);
    const fd = new FormData();
    fd.append('datei', datei); fd.append('mandatId', mandatId); fd.append('zweck', 'sonstig');
    const r = await fetch('/api/fulfillment/kunde/datei', { method: 'POST', body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLaeuft(false);
    if (!r || !r.ok || !j.ok) { setMeldung({ art: 'kritisch', text: String(j.fehler ?? 'Nicht hochgeladen.') }); return; }
    setDatei(null); setAblegen(false);
    setMeldung({ art: 'gut', text: 'Abgelegt (verschlüsselt, ungeprüft).' });
    await laden();
  };
  const status = async (id: string, body: Record<string, unknown>) => {
    const r = await post({ aktion: 'unterlage-status', id, ...body });
    if (!r.ok) setMeldung({ art: 'kritisch', text: String(r.j.fehler ?? 'Nicht gespeichert.') });
    await laden();
  };
  const weg = async (id: string, name: string) => {
    if (!(await bestaetigen({ titel: 'Unterlage entfernen?', text: `„${name}“ wird gelöscht (Eintrag und Datei).`, ja: 'Entfernen', gefahr: true }))) return;
    const r = await fetch(`/api/fulfillment/kunde/datei?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok) setMeldung({ art: 'kritisch', text: String(j.fehler ?? 'Nicht entfernt.') });
    await laden();
  };
  return (
    <Karte i={5}>
      <Ueberschrift erklaerung="fulfillment.kundenLinkUpload" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{s.kurz.ungepruefteUnterlagen ? <Chip farbe={LEUCHT.achtung}>{s.kurz.ungepruefteUnterlagen} ungeprüft</Chip> : <span>{s.unterlagen.length}</span>}<MehrKnopf titel="Unterlagen" mehr={[{ id: 'ablegen', label: 'Interne Unterlage ablegen', hinweis: 'PDF, Bilder, Office ohne Makros — am Inhalt geprüft.', tun: () => setAblegen(true) }]} /></span>}>Unterlagen</Ueberschrift>
      {!s.unterlagen.length ? <Leer>Noch keine Unterlagen. Der Kunde lädt sie über seinen Link hoch; die Analyse liest erst „freigegebene“.</Leer> : (
        <Liste>
          {s.unterlagen.map(u => (
            <ZeileAktionen key={u.id} titel={u.name} mehr={[
              ...(u.status !== 'freigegeben' ? [{ id: 'frei', label: 'Freigeben', hinweis: 'Erst dann liest die Analyse sie.', tun: () => status(u.id, { status: 'freigegeben' }) }] : []),
              ...(u.status !== 'gesperrt' ? [{ id: 'sperren', label: 'Sperren', tun: () => status(u.id, { status: 'gesperrt' }) }] : []),
              { id: 'beleg', label: u.beleg ? 'Kein Beleg' : 'Als Beleg aufbewahren', tun: () => status(u.id, { beleg: !u.beleg }) },
              // Zusammengeführt 11.10.: A2 (Register & Finanzsignale) liest nur freigegebene Unterlagen mit Zweck „Registerauszug“ — hier intern setzen.
              { id: 'register', label: u.zweck === 'register' ? 'Kein Registerauszug' : 'Ist Registerauszug', tun: () => status(u.id, { zweck: u.zweck === 'register' ? 'sonstig' : 'register' }) },
              ...(!u.beleg ? [{ id: 'weg', label: 'Entfernen', gefahr: true, tun: () => weg(u.id, u.name) }] : []),
            ]}>
              <Zeile umbrechen titel={u.name} unter={`${tag(u.am)} · ${Math.max(1, Math.round(u.groesse / 1024))} KB · ${u.herkunft === 'kunde' ? 'vom Kunden' : 'intern'} · ${ZWECK_TEXT[u.zweck]}${u.beleg ? ' · Beleg' : ''}`}
                rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {u.status === 'ungeprueft' ? <Knopf leise onClick={() => status(u.id, { status: 'freigegeben' })}>Freigeben</Knopf> : <Chip farbe={UNTERLAGE_FARBE[u.status]}>{UNTERLAGE_TEXT[u.status]}</Chip>}
                  <a href={`/api/fulfillment/kunde/datei?id=${encodeURIComponent(u.id)}`} download aria-label={`${u.name} herunterladen`} style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>↓</a>
                </span>} />
            </ZeileAktionen>
          ))}
        </Liste>
      )}
      {ablegen && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}>
          <input type="file" accept={KUNDE_ANNEHMEN} onChange={e => setDatei(e.target.files?.[0] ?? null)} style={{ ...feld, padding: 8 }} aria-label="Interne Unterlage wählen" />
          <Knopf aus={!datei || laeuft} onClick={hoch}>{laeuft ? 'Lädt …' : 'Ablegen'}</Knopf>
        </div>
      )}
      <div style={{ ...MIKRO, textTransform: 'none', letterSpacing: 0, fontSize: TYP.bedien, color: C.inkLeise }}>Nur PDF, Bilder und Office ohne Makros, am Inhalt geprüft. Herunterladen geht nur als Datei — nie im Browser geöffnet.</div>
    </Karte>
  );
}
