'use client';

// ─── Werkzeug-Muster — „Automationen & Head“ eines Bereichs (22.10.; Rückmeldung: „Jeder Bereich hat einen eigenen Automation & Head of Bereich, wo wir die
// Automatisierungen dem jeweiligen Bereich bauen können wie mit den Prozessen — also eigentlich die Prozesse.“) ──────────────────────────────────────────
// Der wiederverwendbare Baustein für die Seite eines Werkzeugs (lib/make-one/werkzeuge.ts `automation`: Bereiche der Landkarte + Head + Ort auf der Seite):
//   · die Prozesse dieser Bereiche — DIESELBEN Daten wie das Werkzeug Prozesse (GET /api/prozesse/landkarte, angepasste Fassung; Läufe GET /api/prozesse/laeufe),
//     mit Zustand (Entwurf · Probelauf · scharf · pausiert); „Öffnen“ führt in die Werkstatt
//   · „+ Prozess“ (vorbelegt mit dem Bereich) und „Aus Vorlage“ (Galerie gefiltert auf die Bereiche) — derselbe Schreibweg wie die Werkstatt
//   · die System-Prozesse des Bereichs mit ihren Stellschrauben (dieselbe Karte wie im Steckbrief)
//   · die Karte des Heads (GET /api/agenten?space=business — serverseitig gefiltert): offene Vorschläge, Einstellungen, „Head fragen“; trägt das Werkzeug
//     mehrere Heads (`weitereHeads`, z. B. Markttraktion: Sales, Marketing, Event), steht je Head eine Karte nebeneinander — „Head fragen“ nur am ersten
//     (der Vorschlag gilt dem Bereich, nicht einem Head)
// Nur vorhandene Wege und Routen; geschrieben wird nur über die Fenster und Karten, die es schon gibt. Die Liste ist serverseitig auf Business gefiltert —
// gefiltert nach Bereich wird hier im Browser (lib/prozesse/bereich-automationen.ts, rein).
// Je Space (22.10. abends, Werkzeuge Gruppe A): ein Werkzeug in beiden Bereichen (Finanzen, Planung) trägt je Space eine Fassung (`automationVon`). In Privat gibt
// es keine Prozesse (die Landkarte ist Business) — dort stehen nur die Karten der Heads (GET /api/agenten?space=privat, serverseitig gefiltert), ohne Abruf der
// Landkarte. Einzelne Prozesse (`prozesse`, z. B. Monatsabschluss) und die Prozesse der Seite (`weitereProzesse`, z. B. die der Produkte) kommen dazu.
// Gruppe B (Kalender, Inbox, Aufgaben, Gesundheit, Familie) nutzt denselben Baustein: `space` fest (Business bzw. Privat), einzelne Prozesse z. B. Terminbuchung.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSpace } from '@/hooks/useSpace';
import type { SpaceId } from '@/lib/make-one/space-regeln';
import { Plus, LayoutTemplate, Sparkles, Workflow, Settings2, Inbox as InboxIcon, MessageSquare } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Zeile, Chip, Knopf, Hinweis, Leerzustand, Raster } from '../ui';
import { WEG } from '@/lib/wege';
import { AUTOMATION_LABEL, automationHeads, automationVon, type Werkzeug, type WerkzeugAutomation } from '@/lib/make-one/werkzeuge';
import { automationenFuer, automationLage, type AutomationGruppe } from '@/lib/prozesse/bereich-automationen';
import { BEREICH_IDS, type ProzessBereich } from '@/lib/prozesse/definition';
import type { StellschraubenRechte } from '@/lib/prozesse/stellschrauben';
import type { HeadKarte } from '@/lib/agenten/typen';
import { useLandkarte } from '../prozesse/daten';
import { useLandkarteAnpassung } from '../prozesse/LandkarteAnpassen';
import { useLaufZahlen } from '../prozesse/laeufe-daten';
import { useWerkstattListe } from '../prozesse/werkstatt-daten';
import { NeuerProzessFenster } from '../prozesse/WerkstattUebersicht';
import { VorlagenGalerie } from '../prozesse/VorlagenGalerie';
import { HeadFragenFenster } from '../prozesse/HeadFragen';
import { StellschraubenKarte } from '../prozesse/Stellschrauben';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
/** Der erste feste Bereich des Werkzeugs (Vorbelegung für „+ Prozess“ und „Head fragen“). */
const ersterBereich = (l: readonly string[]): ProzessBereich | undefined => l.find((b): b is ProzessBereich => (BEREICH_IDS as readonly string[]).includes(b));

/** Der Kopf des Heads (Ausschnitt aus GET /api/agenten — nur, was die Karte zeigt). */
export type HeadKurz = Pick<HeadKarte, 'id' | 'name' | 'kurz' | 'auftrag' | 'aktiv' | 'gesperrt'> & { zaehler: Pick<HeadKarte['zaehler'], 'freigaben' | 'laufend'> };

/** Ein weiterer Head des Bereichs (Karte neben der ersten): Kennung und Daten wie `head`. */
export interface WeitererHead { id: string; head?: HeadKurz | null }

/** Die Ansicht ohne Abrufe (Tests rendern sie mit Beispieldaten). */
export function BereichAutomationenAnsicht({ werkzeug, gruppen, head, headId, weitere = [], darfBauen, schrauben, fehler, laedt, onNeu, onVorlage, onHead, onGespeichert, space = 'business', mitProzessen = true }: {
  werkzeug: Werkzeug;
  /** Der Bereich der Sicht (Freigaben-Link der Head-Karten). */
  space?: SpaceId;
  /** Ohne Prozesse (Privat): nur die Karten der Heads — keine Landkarte, kein „Head fragen“ (der Vorschlag ist ein Prozess). */
  mitProzessen?: boolean;
  gruppen: AutomationGruppe[];
  /** Der Head des Bereichs: Daten, `null` = für diese Person nicht sichtbar bzw. nicht da, `undefined` = lädt. */
  head?: HeadKurz | null;
  headId?: string;
  /** Weitere Heads des Bereichs — je eine Karte neben der des Heads (ohne „Head fragen“). */
  weitere?: readonly WeitererHead[];
  /** Darf die Person Entwürfe bauen (Werkstatt-Rechte)? */
  darfBauen: boolean;
  schrauben: { rechte?: StellschraubenRechte; stand?: string };
  fehler?: string | null;
  laedt?: boolean;
  onNeu: () => void; onVorlage: () => void; onHead: () => void;
  onGespeichert: () => Promise<void> | void;
}) {
  const lage = automationLage(gruppen);
  const lageText = [
    lage.scharf && `${lage.scharf} scharf`, lage.probelauf && `${lage.probelauf} im Probelauf`, lage.pausiert && `${lage.pausiert} pausiert`,
    lage.entwurf && `${lage.entwurf} ${lage.entwurf === 1 ? 'Entwurf' : 'Entwürfe'}`, lage.system && `${lage.system} System`, lage.pakete && `${lage.pakete} ${lage.pakete === 1 ? 'Paket' : 'Pakete'}`,
  ].filter(Boolean).join(' · ');
  const fragen = mitProzessen ? onHead : undefined;
  return (
    <div className="wz-automationen" style={{ display: 'grid', gap: 16 }} data-werkzeug={werkzeug.id}>
      {mitProzessen && <Karte>
        <Ueberschrift rechts={darfBauen ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
            <Knopf leise onClick={onVorlage} titel="Einen Prozess aus einer Vorlage dieses Bereichs anlegen"><span className="pz-knopf-inhalt"><LayoutTemplate size={15} aria-hidden />Aus Vorlage</span></Knopf>
            <Knopf onClick={onNeu} titel="Einen eigenen Prozess für diesen Bereich anlegen — gebaut wird in der Werkstatt"><span className="pz-knopf-inhalt"><Plus size={15} aria-hidden />Prozess</span></Knopf>
          </span>
        ) : undefined}>{`${AUTOMATION_LABEL} · ${werkzeug.name}`}</Ueberschrift>
        <p style={klein}>{lageText || 'Die Abläufe dieses Bereichs — gebaut und gesteuert wie im Werkzeug Prozesse.'}</p>
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        {laedt && !fehler && <p style={klein}>Die Prozesse laden …</p>}
        {!laedt && !fehler && gruppen.map(g => (
          <section key={g.bereich.id} aria-label={g.bereich.titel} style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...MIKRO, color: g.bereich.ton }}>{g.bereich.titel}</div>
            {!g.zeilen.length && <p style={klein}>Noch kein Prozess in diesem Bereich.</p>}
            {g.zeilen.map(z => (
              <div key={z.id} style={{ display: 'grid', gap: 6 }}>
                <Zeile umbrechen links={<Workflow size={18} aria-hidden color={C.inkDim} />} titel={z.titel}
                  unter={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}><Chip farbe={BEDEUTUNG_FARBE[z.bedeutung]}>{z.zustandName}</Chip><span>{z.satz}</span>{z.ausgeblendet && <span style={{ color: C.inkLeise }}>· auf der Landkarte ausgeblendet</span>}</span>}
                  rechts={<Knopf leise href={z.href}>{z.linkText}</Knopf>} />
                {z.art === 'system' && !!z.p.stellschrauben?.length && <StellschraubenKarte p={z.p} rechte={schrauben.rechte} stand={schrauben.stand} onGespeichert={onGespeichert} />}
              </div>
            ))}
          </section>
        ))}
        {!laedt && !fehler && !gruppen.length && <Leerzustand symbol={<Workflow size={20} />} titel="Kein Bereich der Landkarte zugeordnet">Dieses Werkzeug nennt keinen Bereich der Prozess-Landkarte.</Leerzustand>}
      </Karte>}
      {headId && !weitere.length && <HeadKarteBereich head={head} headId={headId} onHead={fragen} darfBauen={darfBauen} space={space} />}
      {headId && weitere.length > 0 && (
        <Raster min={280}>
          <HeadKarteBereich head={head} headId={headId} onHead={fragen} darfBauen={darfBauen} space={space} />
          {weitere.map(w => <HeadKarteBereich key={w.id} head={w.head} headId={w.id} darfBauen={false} space={space} />)}
        </Raster>
      )}
    </div>
  );
}

/** Die Karte des Heads: Auftrag, offene Vorschläge (Freigaben), Gespräch, Einstellungen, „Head fragen“ (einen Prozess für den Bereich vorschlagen lassen). */
function HeadKarteBereich({ head, headId, onHead, darfBauen, space }: { head?: HeadKurz | null; headId: string; onHead?: () => void; darfBauen: boolean; space: SpaceId }) {
  if (head === undefined) return <Karte flach><p style={klein}>Der Head lädt …</p></Karte>;
  if (head === null) return <Karte flach><Hinweis art="info" titel="Head dieses Bereichs">Der Head ist für dich hier nicht zu sehen — die Agenten zeigen, wer dir zur Verfügung steht.</Hinweis><Knopf leise href={WEG.agenten()}>Zu den Agenten ›</Knopf></Karte>;
  return (
    <Karte flach>
      <Ueberschrift rechts={head.gesperrt ? <Chip farbe={C.inkDim}>angehalten</Chip> : head.aktiv ? undefined : <Chip farbe={C.inkDim}>aus</Chip>}>{head.name}</Ueberschrift>
      <p style={klein}>{head.gesperrt?.text ?? head.auftrag}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Knopf leise href={WEG.freigaben(undefined, space)} titel="Offene Vorschläge in den Freigaben"><span className="pz-knopf-inhalt"><InboxIcon size={15} aria-hidden />{head.zaehler.freigaben ? `${head.zaehler.freigaben} offene Vorschläge` : 'Keine offenen Vorschläge'}</span></Knopf>
        <Knopf leise href={WEG.agenten({ h: headId })}><span className="pz-knopf-inhalt"><MessageSquare size={15} aria-hidden />Gespräch</span></Knopf>
        <Knopf leise href={WEG.agenten({ h: headId, r: 'einstellungen' })}><span className="pz-knopf-inhalt"><Settings2 size={15} aria-hidden />Einstellungen</span></Knopf>
        {darfBauen && onHead && <Knopf onClick={onHead} titel="Den Head einen Prozess für diesen Bereich vorschlagen lassen — übernommen erst mit deinem Klick"><span className="pz-knopf-inhalt"><Sparkles size={15} aria-hidden />Head fragen</span></Knopf>}
      </div>
    </Karte>
  );
}

/** Alle Heads einer Fassung aus EINEM Abruf (GET /api/agenten?space=… — serverseitig gefiltert): `undefined` = lädt, sonst je Kennung die Karte bzw. null. */
function useHeads(a: WerkzeugAutomation | null, space: SpaceId): { headId?: string; weitereIds: string[]; headVon: (id: string) => HeadKurz | null | undefined } {
  const [heads, setHeads] = useState<HeadKurz[] | undefined>(undefined);
  const headIds = automationHeads(a);
  const schluessel = headIds.join(',');
  useEffect(() => {
    if (!schluessel) return;
    let an = true;
    void fetch(`/api/agenten?space=${space}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { heads?: HeadKurz[] } | null) => { if (an) setHeads(j?.heads ?? []); });
    return () => { an = false; };
  }, [schluessel, space]);
  return { headId: headIds[0], weitereIds: headIds.slice(1), headVon: id => (heads === undefined ? undefined : heads.find(h => h.id === id) ?? null) };
}

/**
 * Der Baustein mit Daten — auf der Seite eines Werkzeugs dort, wo `automationVon(werkzeug, space).href` hinzeigt. `space` ohne Angabe = die Wahl im Kopf;
 * `weitereProzesse` = Prozesse, die die Seite beisteuert (Produkte & Mandate: `Leistung.prozessId` der Produkte).
 */
const KEINE: readonly string[] = [];
export function BereichAutomationen({ werkzeug, space: spaceVorgabe, weitereProzesse = KEINE }: { werkzeug: Werkzeug; space?: SpaceId; weitereProzesse?: readonly string[] }) {
  const { wahl } = useSpace();
  const space = spaceVorgabe ?? wahl;
  const a = automationVon(werkzeug, space);
  if (!a) return null;
  const mitProzessen = space === 'business' && (a.bereiche.length > 0 || (a.prozesse?.length ?? 0) > 0 || weitereProzesse.length > 0);
  return mitProzessen
    ? <MitProzessen key={space} werkzeug={werkzeug} a={a} space={space} weitereProzesse={weitereProzesse} />
    : <NurHeads key={space} werkzeug={werkzeug} a={a} space={space} />;
}

/** Privat (bzw. ohne Prozesse): nur die Karten der Heads — die Landkarte wird gar nicht erst geladen. */
function NurHeads({ werkzeug, a, space }: { werkzeug: Werkzeug; a: WerkzeugAutomation; space: SpaceId }) {
  const h = useHeads(a, space);
  return (
    <BereichAutomationenAnsicht werkzeug={werkzeug} space={space} mitProzessen={false} gruppen={[]} head={h.headId ? h.headVon(h.headId) : undefined} headId={h.headId}
      weitere={h.weitereIds.map(id => ({ id, head: h.headVon(id) }))} darfBauen={false} schrauben={{}}
      onNeu={() => {}} onVorlage={() => {}} onHead={() => {}} onGespeichert={() => {}} />
  );
}

function MitProzessen({ werkzeug, a, space, weitereProzesse }: { werkzeug: Werkzeug; a: WerkzeugAutomation; space: SpaceId; weitereProzesse: readonly string[] }) {
  const router = useRouter();
  const { daten, fehler, neu } = useLandkarte();
  const anp = useLandkarteAnpassung(daten);
  const laeufe = useLaufZahlen();
  const liste = useWerkstattListe();
  const [neuOffen, setNeuOffen] = useState(false);
  const [vorlageOffen, setVorlageOffen] = useState(false);
  const [headOffen, setHeadOffen] = useState(false);
  const h = useHeads(a, space);
  const einzeln = useMemo(() => [...(a.prozesse ?? []), ...weitereProzesse], [a.prozesse, weitereProzesse]);
  const gruppen = useMemo(() => (daten ? automationenFuer(anp.ansicht, a.bereiche, laeufe ?? {}, einzeln) : []), [a.bereiche, einzeln, daten, anp.ansicht, laeufe]);
  // Vorbelegung („+ Prozess“, „Head fragen“, Galerie): die ganzen Bereiche des Werkzeugs, sonst die Bereiche seiner einzelnen Prozesse.
  const bereiche = a.bereiche.length ? a.bereiche : gruppen.map(g => g.bereich.id);
  const bereich = ersterBereich(bereiche);
  const inDieWerkstatt = async (id: string) => { await neu(); router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt' })); };
  return (
    <>
      <BereichAutomationenAnsicht werkzeug={werkzeug} space={space} gruppen={gruppen} head={h.headId ? h.headVon(h.headId) : undefined} headId={h.headId}
        weitere={h.weitereIds.map(id => ({ id, head: h.headVon(id) }))} darfBauen={!!liste.daten?.rechte.entwurf}
        schrauben={{ rechte: daten?.stellschraubenRechte, stand: daten?.stellschraubenStand }} fehler={!daten ? fehler : null} laedt={!daten && !fehler}
        onNeu={() => setNeuOffen(true)} onVorlage={() => setVorlageOffen(true)} onHead={() => setHeadOffen(true)} onGespeichert={neu} />
      {neuOffen && <NeuerProzessFenster onZu={() => setNeuOffen(false)} bereichVorgabe={bereich} onAngelegt={async id => { setNeuOffen(false); await inDieWerkstatt(id); }} />}
      {vorlageOffen && <VorlagenGalerie bereiche={bereiche} onZu={() => setVorlageOffen(false)} onAngelegt={async id => { setVorlageOffen(false); await inDieWerkstatt(id); }} />}
      {headOffen && <HeadFragenFenster bereichVorgabe={bereich} onZu={() => setHeadOffen(false)} onUebernommen={async r => { setHeadOffen(false); await inDieWerkstatt(r.prozessId); }} />}
    </>
  );
}
