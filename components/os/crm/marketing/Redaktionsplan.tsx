'use client';

// ─── Markttraktion · Marketing › Redaktionsplan — Themen aus Kundengesprächen ────────
// Beiträge wandern Idee → Entwurf → Geplant → Veröffentlicht. Themen kommen
// aus der „Stimme der Kunden“ (Bedarf/Schmerz aus den Gesprächsnotizen) —
// ein Klick macht daraus eine Idee, die Person bleibt als Quelle verknüpft,
// ihr Name steht nie im Text. Wirkung wird je Person erfasst: Reaktion,
// Gespräch, Anfrage. Gespräch und Anfrage landen zusätzlich im Verlauf der
// Person (Bezug = Beitrag) — so steht die Zuordnung auch in der Kartei.
//
// Zu zweit (25.09.): Jeder Beitrag hat einen Autor (wer schreibt, ohne
// Eintrag Malin als Verantwortliche) und eine Stimme (in wessen Namen er
// erscheint: Kevin, Malin oder die Marke). Schreibt jemand für die andere
// Person, braucht der Beitrag vor „Geplant“ deren Freigabe — die Regel steht
// in lib/crm/marketing.ts (planSperre, beitragStatusWechsel), die Oberfläche
// hält sich daran. Filter „Alle · Meins · …“, „Für dich“ und „Diese Woche:
// wer schreibt was“ zeigen, was bei wem liegt. Jede Änderung ist eine
// Einzeländerung (api.teil) — Kevin und Malin überschreiben sich nie.
// MAKE OS veröffentlicht nichts: Text kopieren, selbst posten, hier eintragen.
// Kosten (27.09.): je Beitrag pflegbar (Anzeigen, Produktion) — der Marketing-
// Trichter rechnet daraus Kosten je Anfrage und je SQL.
// 04.10. (Kevin: „alles anpassbar“): jede Beitragszeile am Baustein `ZeileAktionen` — Archivieren (`archiviertAm`, Reiter
// Archiv, zurückholbar) und Löschen (Papierkorb 30 Tage, Rückgängig; steckt er in einer Ausgabe → Rückfrage).

import { localDay } from '@/lib/zeit';
import { anfrageKanalAusBeitrag } from '@/lib/crm/anfragen';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Raster, feld, LEUCHT, ZeileAktionen } from '../../ui';
import { useCrmAblage, useAblageSicht, AblageReiter, PapierkorbKarte, ArchivLeer, type CrmAblage } from '../ablage';
import { anzeigename } from '@/lib/make-one/crm';
import type { Beitrag, MarketingEinstellung } from '@/lib/crm/typen';
import { BEIDE, anderer, nameVon, verantwortlich } from '@/lib/crm/team';
import {
  BEITRAG_STATUS, BEITRAG_KANAELE, WIRKUNG_ARTEN, STIMMEN_WAHL, MARKE, planFenster, imFenster, nachStatus, wirkungZahlen, stimmenAus, ideeAusStimme, schonUebernommen, einstellungAus,
  autorVon, stimmPerson, stimmeText, freigabeStand, planSperre, beitragStatusWechsel, beitragNachTextAenderung, rollenWechsel, freigabeAnfrage, freigabeOk, aenderungsWunsch,
  naechsterSchritt, redaktionFuerMich, wocheWerSchreibt, type PlanSicht, type Teil, type FreigabeStand,
} from '@/lib/crm/marketing';
import { type CrmApi, neueId, datum } from '../daten';
import { Pillen, Feld, Feldzeile } from '../teile';
import { Wahl } from '../Wahl';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer, type WerWahl } from '../team';
import { PersonWahl, Textfeld, kopieren, AutorStimme, StimmePlakette, FreigabeChip, FreigabeBlock, AlsNaechstes, STAND_FARBE } from './gemeinsam';

const STATUS_FARBE: Record<Beitrag['status'], string> = { idee: C.inkDim, entwurf: LEUCHT.puls, geplant: LEUCHT.achtung, veroeffentlicht: LEUCHT.gut };
const SICHTEN: { id: PlanSicht; label: string }[] = [{ id: 'woche', label: 'Woche' }, { id: 'monat', label: 'Monat' }, { id: 'alle', label: 'Alle' }];
const kanalLabel = (k: string) => BEITRAG_KANAELE.find(x => x.id === k)?.label ?? k;
const statusLabel = (s: Beitrag['status']) => BEITRAG_STATUS.find(x => x.id === s)?.label ?? s;
const alsEintrag = (b: Beitrag) => b as unknown as { id: string } & Record<string, unknown>;
const OFFEN_ID = 'redaktion-beitrag-offen';

/** Filter „Alle · Meins · …“: nach Autor — und was in deinem Namen auf dein Okay wartet, gehört auch zu dir. */
function passtBeitrag(b: Beitrag, wahl: WerWahl, ich: string | null): boolean {
  if (passtWer(wahl, b.zustaendig, 'marketing', ich)) return true;
  const wer = wahl === 'ich' ? ich : wahl;
  return wahl !== 'alle' && freigabeStand(b) === 'offen' && stimmPerson(b) === wer;
}
/** Kurzer Freigabe-Text für die Unterzeile — leer, wenn keine nötig oder schon erteilt. */
function freigabeKurz(stand: FreigabeStand, an: string | null): string {
  return stand === 'offen' ? `Freigabe bei ${nameVon(an)}` : stand === 'aenderung' ? 'Änderung gewünscht' : stand === 'fehlt' ? 'Freigabe fehlt' : '';
}

export function Redaktionsplan({ api, zuKontakt, fokus }: { api: CrmApi; zuKontakt: (id: string) => void; fokus?: string }) {
  const [sicht, setSicht] = useState<PlanSicht>('monat');
  const [versatz, setVersatz] = useState(0);
  const [offen, setOffen] = useState<string | null>(fokus ?? null);
  const [titel, setTitel] = useState('');
  const [meldung, setMeldung] = useState('');
  const [alleStimmen, setAlleStimmen] = useState(false);
  const [wer, setWer] = useWerFilter('marketing-redaktion');
  useEffect(() => { if (fokus) setOffen(fokus); }, [fokus]);
  // Aufgeklappter Beitrag steht oben — wer weiter unten klickt, wird hingeführt.
  useEffect(() => {
    if (!offen) return;
    const el = document.getElementById(OFFEN_ID);
    if (el && (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().top > window.innerHeight * 0.6)) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [offen]);
  const crm = api.crm;
  const ich = api.ich;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const heute = crm?.heute ?? localDay();
  const ablage = useCrmAblage(api, 'beitraege');
  const [ablageSicht, setAblageSicht] = useAblageSicht(() => setOffen(null));
  const alleBeitraege = crm?.stand.beitraege;
  // Archivierte Beiträge zählen in Plan, Woche und „für dich“ nicht mit — sie stehen nur im Reiter Archiv.
  const beitraege = useMemo(() => (alleBeitraege ?? []).filter(b => !b.archiviertAm), [alleBeitraege]);
  const archiviert = useMemo(() => (alleBeitraege ?? []).filter(b => b.archiviertAm), [alleBeitraege]);
  const einstellung = useMemo(() => einstellungAus(crm?.stand ?? {}), [crm]);
  const fenster = useMemo(() => planFenster(heute, sicht, versatz), [heute, sicht, versatz]);
  const imPlan = useMemo(() => beitraege.filter(b => imFenster(b, fenster)), [beitraege, fenster]);
  const gruppen = useMemo(() => nachStatus(imPlan.filter(b => passtBeitrag(b, wer, ich))), [imPlan, wer, ich]);
  const zahlen = useMemo(() => {
    const z: Record<string, number> = { alle: imPlan.length };
    if (ich) { z.ich = imPlan.filter(b => passtBeitrag(b, 'ich', ich)).length; z[anderer(ich)] = imPlan.filter(b => passtBeitrag(b, anderer(ich), ich)).length; }
    return z;
  }, [imPlan, ich]);
  const fuerMich = useMemo(() => redaktionFuerMich(beitraege, ich, heute), [beitraege, ich, heute]);
  const woche = useMemo(() => wocheWerSchreibt(beitraege, heute), [beitraege, heute]);
  const stimmen = useMemo(() => stimmenAus(kontakte, 30), [kontakte]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const anlegen = async () => {
    const t = titel.trim();
    if (!t) return;
    // Ohne Autor-Eintrag schreibt die/der Verantwortliche für Marketing.
    const b: Beitrag = { id: neueId('bt'), titel: t.slice(0, 200), kanal: 'linkedin', status: 'idee', wirkung: [], quellen: [], geaendert: new Date().toISOString() };
    // Nur öffnen, was der Server angenommen hat (08.10., Sofort-Paket 5.11) — sonst bleibt der Titel stehen, der Grund steht oben.
    if (!(await api.setze('beitraege', alsEintrag(b)))) { setMeldung(`„${t.slice(0, 60)}“ ist NICHT angelegt — der Grund steht oben, der Titel bleibt stehen.`); return; }
    setTitel(''); setOffen(b.id);
  };
  const aktuell = offen ? (alleBeitraege ?? []).find(b => b.id === offen) ?? null : null;
  /** Eine Beitragszeile mit Archivieren/Löschen (Wischen bzw. Knöpfe am Rand). */
  const mitAktionen = (b: Beitrag, zeile: ReactNode) => (
    <ZeileAktionen key={b.id} titel={b.titel} archiviert={!!b.archiviertAm} onArchivieren={() => { if (offen === b.id) setOffen(null); if (b.archiviertAm) ablage.zurueckholen(b.id, b.titel); else ablage.archivieren(b.id, b.titel); }} onLoeschen={() => { if (offen === b.id) setOffen(null); beitragLoeschen(ablage, b, crm.stand.newsletter.filter(n => n.beitragIds.includes(b.id)).length); }}>
      {zeile}
    </ZeileAktionen>
  );
  const siebenTage = beitraege.filter(b => b.status === 'veroeffentlicht' && b.datum && b.datum <= heute && b.datum >= new Date(Date.parse(`${heute}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10)).length;
  const oeffne = (id: string) => setOffen(offen === id ? null : id);
  const verantwortung = verantwortlich('marketing');

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<span style={{ color: siebenTage >= 2 ? LEUCHT.gut : siebenTage === 1 ? LEUCHT.achtung : C.inkLeise }}>{siebenTage} veröffentlicht in 7 Tagen · Ziel ≥ 2</span>}>Redaktionsplan</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={titel} maxLength={200} onChange={e => setTitel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} placeholder="Neue Idee: Titel eingeben, Enter" aria-label="Titel des Beitrags" style={{ ...feld, flex: 1, minWidth: 220, fontSize: TYP.bedien, padding: '9px 13px' }} />
          <Knopf aus={!titel.trim()} onClick={() => void anlegen()}>+ Beitrag</Knopf>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <Pillen liste={SICHTEN} aktiv={sicht} onWahl={s => { setSicht(s); setVersatz(0); }} />
          {fenster && (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Knopf leise onClick={() => setVersatz(versatz - 1)}>‹</Knopf>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, minWidth: 150, textAlign: 'center' }}>{fenster.label}</span>
              <Knopf leise onClick={() => setVersatz(versatz + 1)}>›</Knopf>
              {versatz !== 0 && <button onClick={() => setVersatz(0)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>heute</button>}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <WerFilter wahl={wer} onWahl={setWer} ich={ich} zahlen={zahlen} />
        </div>
        {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>
          Neue Beiträge schreibt {nameVon(verantwortung)} (Verantwortung Marketing), bis jemand anderes eingetragen ist. Erscheint ein Beitrag im Namen einer Person, die ihn nicht selbst schreibt, gibt sie ihn vor dem Planen frei.
          Beiträge ohne Datum stehen in jeder Ansicht. MAKE OS veröffentlicht nichts — Text kopieren, selbst posten, Status und Wirkung hier eintragen.
        </div>
      </Karte>

      <AblageReiter sicht={ablageSicht} onSicht={setAblageSicht} name="Plan" liste={beitraege.length} archiv={archiviert.length} korb={ablage.korb.length} />

      {aktuell && <div id={OFFEN_ID} style={{ scrollMarginTop: 80 }}><BeitragKarte key={aktuell.id} b={aktuell} api={api} ablage={ablage} einstellung={einstellung} heute={heute} zuKontakt={zuKontakt} schliessen={() => setOffen(null)} melde={setMeldung} /></div>}

      {ablageSicht === 'papierkorb' && <PapierkorbKarte ablage={ablage} liste="beitraege" />}
      {ablageSicht === 'archiv' && (archiviert.length ? (
        <Karte i={1}>
          <Ueberschrift rechts={String(archiviert.length)}>Archiv · Beiträge</Ueberschrift>
          <Liste>{archiviert.map(b => mitAktionen(b, <Zeile onClick={() => oeffne(b.id)} aktiv={offen === b.id} titel={b.titel} links={<AutorStimme autor={autorVon(b)} stimme={b.stimme} groesse={18} />} unter={[statusLabel(b.status), kanalLabel(b.kanal), b.datum ? datum(b.datum, heute) : ''].filter(Boolean).join(' · ')} />))}</Liste>
        </Karte>
      ) : <ArchivLeer liste="beitraege" />)}

      {ablageSicht === 'liste' && <>
      <Raster min={360}>
        <Karte i={1}>
          <Ueberschrift rechts={ich ? <Person id={ich} name /> : undefined}>Als Nächstes für dich</Ueberschrift>
          {fuerMich.length ? (
            <Liste>
              {fuerMich.map(x => {
                const b = beitraege.find(y => y.id === x.id)!;
                return mitAktionen(b, <Zeile onClick={() => oeffne(x.id)} aktiv={offen === x.id} links={<AutorStimme autor={autorVon(b)} stimme={b.stimme} />} titel={b.titel} unter={x.was}
                  rechts={x.art === 'freigabe' || x.art === 'aenderung' ? <Punkt farbe={x.art === 'freigabe' ? LEUCHT.achtung : LEUCHT.kritisch} /> : undefined} />);
              })}
            </Liste>
          ) : <Leer>{ich ? 'Nichts wartet auf dich. Nächster Schritt: eine Idee aus der Stimme der Kunden (unten) zum Entwurf machen.' : 'Anmelden, dann steht hier, was bei dir liegt.'}</Leer>}
        </Karte>

        <Karte i={2}>
          <Ueberschrift rechts={woche.label}>Diese Woche: wer schreibt was</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14 }}>
            {woche.je.map(g => (
              <div key={g.person} style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Person id={g.person} name />
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{g.beitraege.length || ''}</span>
                </div>
                {g.beitraege.length ? (
                  <Liste>
                    {g.beitraege.map(b => {
                      const ueber = b.datum! < heute && b.status !== 'veroeffentlicht';
                      const f = freigabeKurz(freigabeStand(b), stimmPerson(b));
                      return mitAktionen(b, <Zeile onClick={() => oeffne(b.id)} aktiv={offen === b.id} links={<StimmePlakette stimme={b.stimme} groesse={18} />} titel={b.titel}
                        unter={<><span style={{ color: ueber ? LEUCHT.kritisch : undefined }}>{ueber ? 'überfällig · ' : ''}{datum(b.datum, heute)}</span> · {statusLabel(b.status)} · als {stimmeText(b.stimme)}{f ? ` · ${f}` : ''}</>}
                        rechts={<Punkt farbe={STATUS_FARBE[b.status]} groesse={7} />} />);
                    })}
                  </Liste>
                ) : <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '8px 0' }}>Nichts mit Datum in dieser Woche.</div>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Nach Autor · die Plakette zeigt, in wessen Namen es erscheint. Liegengebliebenes aus früheren Wochen steht mit dabei.</div>
        </Karte>
      </Raster>

      <Raster min={220}>
        {BEITRAG_STATUS.map((s, i) => (
          <Karte key={s.id} i={i + 3}>
            <Ueberschrift farbe={STATUS_FARBE[s.id]} rechts={String(gruppen[s.id].length)}>{s.label}</Ueberschrift>
            <Liste>
              {gruppen[s.id].map(b => {
                const w = wirkungZahlen(b);
                const saeule = einstellung.saeulen.find(x => x.id === b.saeule)?.name ?? b.saeule;
                const stand = freigabeStand(b);
                const f = freigabeKurz(stand, stimmPerson(b));
                return mitAktionen(b,
                  <Zeile onClick={() => oeffne(b.id)} aktiv={offen === b.id} titel={b.titel} links={<AutorStimme autor={autorVon(b)} stimme={b.stimme} groesse={18} />}
                    rechts={f ? <Punkt farbe={STAND_FARBE[stand]} groesse={8} /> : undefined}
                    unter={[f, kanalLabel(b.kanal), b.datum ? datum(b.datum, heute) : '', saeule, w.reaktionen ? `${w.reaktionen} Reakt.` : '', w.gespraeche + w.anfragen ? `${w.gespraeche + w.anfragen} Gespr./Anfr.` : ''].filter(Boolean).join(' · ')} />);
              })}
            </Liste>
            {!gruppen[s.id].length && <Leer>{s.id === 'idee' ? 'Ideen kommen aus der Stimme der Kunden (unten).' : wer !== 'alle' ? 'Nichts für diese Auswahl in diesem Zeitraum.' : 'Nichts in diesem Zeitraum.'}</Leer>}
          </Karte>
        ))}
      </Raster>

      <Karte i={7}>
        <Ueberschrift rechts={stimmen.length ? `${stimmen.length} Notizen` : undefined}>Themen aus der Stimme der Kunden</Ueberschrift>
        {stimmen.length ? (
          <Liste>
            {(alleStimmen ? stimmen : stimmen.slice(0, 8)).map((s, i) => {
              const drin = schonUebernommen(s, beitraege);
              return (
                <div key={`${s.kontaktId}-${s.am}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>„{s.bedarf}“</div>
                    <button onClick={() => zuKontakt(s.kontaktId)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{s.name} · {datum(s.am, heute)}</button>
                  </div>
                  {drin ? <Chip farbe={LEUCHT.gut}>übernommen</Chip>
                    : <Knopf leise onClick={async () => { const b = ideeAusStimme(s, neueId('bt'), new Date().toISOString()); const ok = await api.setze('beitraege', alsEintrag(b)); setMeldung(ok ? `Idee „${b.titel}“ angelegt.` : `Idee „${b.titel}“ NICHT angelegt — der Grund steht oben.`); }}>Als Idee übernehmen</Knopf>}
                </div>
              );
            })}
          </Liste>
        ) : <Leer>Sobald Gesprächsnotizen das Feld „Bedarf / Schmerz“ haben, stehen hier die Themen — echte Probleme, mit eigener Einsicht beantwortet.</Leer>}
        {stimmen.length > 8 && <button onClick={() => setAlleStimmen(!alleStimmen)} style={{ marginTop: 8, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{alleStimmen ? 'weniger' : `alle ${stimmen.length} zeigen`}</button>}
      </Karte>
      </>}
      {ablage.dialog}
      {ablage.hinweis}
    </>
  );
}

/** Löschen = Papierkorb; steckt der Beitrag in einer Newsletter-Ausgabe, erst eine Rückfrage (Archiv als ruhigerer Weg). */
function beitragLoeschen(ablage: CrmAblage, b: Beitrag, inAusgaben: number) {
  ablage.loeschen(b.id, b.titel, inAusgaben ? { archivAnbieten: true, text: `Der Beitrag steckt in ${inAusgaben} Newsletter-Ausgabe${inAusgaben === 1 ? '' : 'n'}. Im Papierkorb ist er dort ausgeblendet; endgültig geht er erst, wenn ihn keine Ausgabe mehr nennt.` } : undefined);
}

function BeitragKarte({ b, api, ablage, einstellung, heute, zuKontakt, schliessen, melde }: {
  b: Beitrag; api: CrmApi; ablage: CrmAblage; einstellung: MarketingEinstellung; heute: string; zuKontakt: (id: string) => void; schliessen: () => void; melde: (t: string) => void;
}) {
  const [art, setArt] = useState<Beitrag['wirkung'][number]['art']>('reaktion');
  const [notiz, setNotiz] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [statusHinweis, setStatusHinweis] = useState('');
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const nachId = useMemo(() => new Map(kontakte.map(k => [k.id, k])), [kontakte]);
  const ich = api.ich;
  const jetzt = () => new Date().toISOString();
  /** Nur diese Felder — der Server vereint mit dem Stand, den die/der andere gerade hat. */
  const teil = (x: Teil<Beitrag>) => api.teil('beitraege', b.id, x);
  /** Titel und Text: Ein Okay gilt dem freigegebenen Text — ändert jemand anderes, liegt es wieder bei der Stimme. */
  const textAendern = (x: Teil<Beitrag>) => { const f = beitragNachTextAenderung(b, ich, jetzt()); if (f) melde(`Geändert — die Freigabe liegt wieder bei ${nameVon(f.an)}.`); return teil(f ? { ...x, freigabe: f } : x); };
  const w = wirkungZahlen(b);
  const name = (id: string) => { const k = nachId.get(id); return k ? anzeigename(k) : 'nicht mehr in der Kartei'; };
  const SAEULEN = [{ id: '', label: 'keine' }, ...einstellung.saeulen.map(s => ({ id: s.id, label: s.name }))];
  const autor = autorVon(b);
  const stimme = stimmPerson(b);
  const stand = freigabeStand(b);
  const sperre = planSperre(b, ich);

  const statusWahl = (neu: Beitrag['status']) => {
    const x = beitragStatusWechsel(b, neu, ich, heute, jetzt());
    if (!x.ok) { setStatusHinweis(x.grund); return; }
    setStatusHinweis('');
    void teil(x.felder);
  };
  const eintragen = async (kontaktId: string) => {
    if (b.wirkung.some(x => x.kontaktId === kontaktId && x.art === art)) { setHinweis('Schon eingetragen.'); return; }
    // 5.10 (08.10.): „Anfrage“ läuft über DEN Anfrage-Weg (/api/crm/anfrage) — Verlauf, Follow-up „beantworten“, Lead, Einwilligung
    // „Antwort auf Anfrage“ und die Wirkung am Beitrag in einem. Vorher entstand nur die Wirkung, zählte aber im Trichter.
    if (art === 'anfrage') {
      const r = await fetch('/api/crm/anfrage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'anlegen', kontaktId, kanal: anfrageKanalAusBeitrag(b.kanal), bezug: { art: 'beitrag', id: b.id }, text: notiz.trim() || `Anfrage auf den Beitrag „${b.titel}“` }) })
        .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts eingetragen.' })) as { ok?: boolean; fehler?: string; text?: string; hinweis?: string };
      setHinweis(r.ok ? [r.text ?? `Anfrage von ${name(kontaktId)} eingetragen.`, r.hinweis].filter(Boolean).join(' ') : r.fehler ?? 'Nicht eingetragen.');
      if (r.ok) { setNotiz(''); void api.laden(true); }
      return;
    }
    const neu = { kontaktId, art, am: heute, ...(notiz.trim() ? { notiz: notiz.trim().slice(0, 300) } : {}) };
    await teil({ wirkung: [...b.wirkung, neu] });
    // Gespräch und Anfrage gehören in den Verlauf der Person — mit Bezug auf den Beitrag.
    if (art !== 'reaktion') {
      const r = await api.aktivitaet({ id: kontaktId, art: 'gespraech', text: `Aus Beitrag „${b.titel}“${notiz.trim() ? ` — ${notiz.trim()}` : ''}`.slice(0, 3000), bezug: b.id }).catch(() => null);
      setHinweis(r?.ok ? `${WIRKUNG_ARTEN.find(x => x.id === art)?.label} bei ${name(kontaktId)} eingetragen — steht auch im Verlauf.` : 'Wirkung eingetragen, der Verlauf der Person war nicht erreichbar.');
    } else setHinweis(`Reaktion von ${name(kontaktId)} eingetragen.`);
    setNotiz('');
  };
  const ohne = !b.stimme ? 'Erst festlegen, in wessen Namen er erscheint.'
    : b.stimme === MARKE ? 'Erscheint als Marke — keine Freigabe nötig.'
    : autor === BEIDE ? 'Ihr schreibt gemeinsam — keine Freigabe nötig.'
    : `${nameVon(autor)} schreibt in eigenem Namen — keine Freigabe nötig.`;

  return (
    <Karte i={0} akzent={STATUS_FARBE[b.status]}>
      <Ueberschrift farbe={STATUS_FARBE[b.status]} rechts={<><FreigabeChip stand={stand} an={stimme} /><Knopf leise onClick={schliessen}>Schließen</Knopf></>}>Beitrag</Ueberschrift>
      <AlsNaechstes>{naechsterSchritt(b, ich, heute)}</AlsNaechstes>
      <div style={{ marginTop: 6 }} />
      <Feldzeile label="Titel"><Feld wert={b.titel} platzhalter="Titel" onFertig={t => { if (t.trim()) void textAendern({ titel: t.trim() }); }} /></Feldzeile>
      <Feldzeile label="Schreibt">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={b.zustaendig} welt="marketing" onWahl={z => void teil(rollenWechsel(b, { zustaendig: z }))} />
          <Uebergeben api={api} art="beitrag" id={b.id} jetzt={autor} klein />
        </div>
      </Feldzeile>
      <Feldzeile label="Erscheint als">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl label="Erscheint als" leer="+ Absender" liste={STIMMEN_WAHL} wert={b.stimme ?? null} onWahl={s => void teil(rollenWechsel(b, { stimme: s }))} />
          {!b.stimme && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>In wessen Namen erscheint es — Profil, Absender?</span>}
        </div>
      </Feldzeile>
      <Feldzeile label="Freigabe">
        <FreigabeBlock f={b.freigabe} stand={stand} an={stimme} ich={ich} heute={heute} erledigt={b.status === 'veroeffentlicht'} ohne={ohne}
          onAnfragen={an => { void teil({ freigabe: freigabeAnfrage(an, ich, jetzt()) }); melde(`„${b.titel}“ liegt jetzt bei ${nameVon(an)} zur Freigabe.`); }}
          onFreigeben={() => { if (stimme) void teil({ freigabe: freigabeOk(b.freigabe, stimme, jetzt()) }); }}
          onAenderung={n => { const f = stimme ? aenderungsWunsch(b.freigabe, stimme, n, jetzt()) : null; if (f) void teil({ freigabe: f }); }} />
      </Feldzeile>
      <Feldzeile label="Status"><Wahl label="Status" liste={BEITRAG_STATUS} wert={b.status} farbe={STATUS_FARBE[b.status]} onWahl={statusWahl} /></Feldzeile>
      {(statusHinweis || (b.status === 'geplant' && sperre)) && (
        <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, margin: '2px 0 6px', lineHeight: 1.5 }}>{statusHinweis || `Geplant, aber: ${sperre}`}</div>
      )}
      <Feldzeile label="Kanal"><Wahl label="Kanal" liste={BEITRAG_KANAELE} wert={b.kanal} onWahl={kanal => void teil({ kanal })} /></Feldzeile>
      <Feldzeile label="Säule">{einstellung.saeulen.length ? <Wahl label="Säule" liste={SAEULEN.filter(x => x.id)} wert={b.saeule || null} onWahl={s => void teil({ saeule: s })} onLeeren={() => void teil({ saeule: null })} /> : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Themensäulen legst du unter „Positionierung“ an.</span>}</Feldzeile>
      <Feldzeile label="Datum"><Feld typ="date" breite={170} wert={b.datum ?? ''} platzhalter="Datum" onFertig={d => void teil({ datum: d || null })} /></Feldzeile>
      <Feldzeile label="Link"><Feld wert={b.link ?? ''} platzhalter="https://… (nach dem Veröffentlichen)" onFertig={l => void teil({ link: l.trim() || null })} /></Feldzeile>
      <Feldzeile label="Kosten (€)">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Feld typ="number" breite={140} wert={b.kostenEuro ? String(b.kostenEuro) : ''} platzhalter="0" onFertig={t => { const n = Math.round(Number(t)); void teil({ kostenEuro: Number.isFinite(n) && n > 0 ? n : null }); }} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Anzeigen, Produktion, Tools — für „Kosten je Anfrage“ in der Marketing-Strecke.</span>
        </div>
      </Feldzeile>
      <div style={{ marginTop: 6 }}><Textfeld wert={b.text ?? ''} zeilen={8} max={8000} platzhalter="Text des Beitrags" onFertig={t => void textAendern({ text: t || null })} /></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Knopf leise aus={!b.text} onClick={async () => melde((await kopieren(`${b.text ?? ''}`)) ? 'Text kopiert — veröffentlichen bleibt bei euch.' : 'Kopieren nicht möglich.')}>Text kopieren</Knopf>
        {b.link && <Knopf leise onClick={() => window.open(b.link, '_blank', 'noopener')}>Link öffnen</Knopf>}
        <Knopf leise onClick={() => { schliessen(); beitragLoeschen(ablage, b, (api.crm?.stand.newsletter ?? []).filter(n => n.beitragIds.includes(b.id)).length); }}>In den Papierkorb</Knopf>
      </div>
      {b.geaendertVon && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Zuletzt geändert von {nameVon(b.geaendertVon)} · {datum(b.geaendert.slice(0, 10), heute)}</div>}

      {b.quellen.length > 0 && (
        <div style={{ marginTop: 12, fontSize: TYP.bedien, color: C.inkLeise }}>
          Thema aus Gesprächen mit: {b.quellen.map((id, i) => <span key={id}>{i ? ', ' : ''}<button onClick={() => zuKontakt(id)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{name(id)}</button></span>)}
          <span> — Namen nur mit Freigabe der Person nennen.</span>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Ueberschrift rechts={`${w.reaktionen} Reaktionen · ${w.gespraeche} Gespräche · ${w.anfragen} Anfragen`}>Wirkung</Ueberschrift>
        {b.wirkung.length > 0 && (
          <div style={{ display: 'grid', gap: 0, marginBottom: 10 }}>
            {b.wirkung.map((x, i) => (
              <div key={`${x.kontaktId}-${x.art}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien }}>
                <Punkt farbe={x.art === 'reaktion' ? LEUCHT.puls : LEUCHT.gut} groesse={7} />
                <button onClick={() => zuKontakt(x.kontaktId)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, textAlign: 'left' }}>{name(x.kontaktId)}</button>
                <span style={{ color: C.inkDim }}>{WIRKUNG_ARTEN.find(a => a.id === x.art)?.label}</span>
                <span style={{ color: C.inkLeise, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datum(x.am, heute)}{x.notiz ? ` · ${x.notiz}` : ''}</span>
                <button onClick={() => void teil({ wirkung: b.wirkung.filter((_, j) => j !== i) })} title="Eintrag entfernen (der Verlauf der Person bleibt)" aria-label="Eintrag entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 13 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wirkung</span><Wahl label="Wirkung" liste={WIRKUNG_ARTEN} wert={art} onWahl={setArt} /></span>
          <input value={notiz} maxLength={300} onChange={e => setNotiz(e.target.value)} placeholder="Notiz (optional): was hat die Person gesagt?" aria-label="Notiz zur Wirkung" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <PersonWahl kontakte={kontakte} onWahl={k => void eintragen(k.id)} platzhalter="Wer? Person suchen und anklicken" />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{art === 'reaktion' ? 'Reaktionen zählen am Beitrag.' : 'Gespräch und Anfrage stehen zusätzlich im Verlauf der Person — sie zählen als durch Content ausgelöst.'}</div>
          {hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{hinweis}</div>}
        </div>
      </div>
    </Karte>
  );
}
