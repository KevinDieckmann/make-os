'use client';

// ─── Werkzeug-Muster — „Automationen & Head“ eines Bereichs (22.10.; Rückmeldung: „Jeder Bereich hat einen eigenen Automation & Head of Bereich, wo wir die
// Automatisierungen dem jeweiligen Bereich bauen können wie mit den Prozessen — also eigentlich die Prozesse.“) ──────────────────────────────────────────
// Der wiederverwendbare Baustein für die Seite eines Werkzeugs (lib/make-one/werkzeuge.ts `automation`: Bereiche der Landkarte + Head + Ort auf der Seite):
//   · die Prozesse dieser Bereiche — DIESELBEN Daten wie das Werkzeug Prozesse (GET /api/prozesse/landkarte, angepasste Fassung; Läufe GET /api/prozesse/laeufe),
//     mit Zustand (Entwurf · Probelauf · scharf · pausiert); „Öffnen“ führt in die Werkstatt
//   · „+ Prozess“ (vorbelegt mit dem Bereich) und „Aus Vorlage“ (Galerie gefiltert auf die Bereiche) — derselbe Schreibweg wie die Werkstatt
//   · die System-Prozesse des Bereichs mit ihren Stellschrauben (dieselbe Karte wie im Steckbrief)
//   · die Karte des Heads (GET /api/agenten?space=business — serverseitig gefiltert): offene Vorschläge, Einstellungen, „Head fragen“
// Nur vorhandene Wege und Routen; geschrieben wird nur über die Fenster und Karten, die es schon gibt. Die Liste ist serverseitig auf Business gefiltert —
// gefiltert nach Bereich wird hier im Browser (lib/prozesse/bereich-automationen.ts, rein).

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LayoutTemplate, Sparkles, Workflow, Settings2, Inbox as InboxIcon, MessageSquare } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Zeile, Chip, Knopf, Hinweis, Leerzustand } from '../ui';
import { WEG } from '@/lib/wege';
import { AUTOMATION_LABEL, type Werkzeug } from '@/lib/make-one/werkzeuge';
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

/** Die Ansicht ohne Abrufe (Tests rendern sie mit Beispieldaten). */
export function BereichAutomationenAnsicht({ werkzeug, gruppen, head, headId, darfBauen, schrauben, fehler, laedt, onNeu, onVorlage, onHead, onGespeichert }: {
  werkzeug: Werkzeug;
  gruppen: AutomationGruppe[];
  /** Der Head des Bereichs: Daten, `null` = für diese Person nicht sichtbar bzw. nicht da, `undefined` = lädt. */
  head?: HeadKurz | null;
  headId?: string;
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
  return (
    <div className="wz-automationen" style={{ display: 'grid', gap: 16 }} data-werkzeug={werkzeug.id}>
      <Karte>
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
      </Karte>
      {headId && <HeadKarteBereich head={head} headId={headId} onHead={onHead} darfBauen={darfBauen} />}
    </div>
  );
}

/** Die Karte des Heads: Auftrag, offene Vorschläge (Freigaben), Gespräch, Einstellungen, „Head fragen“ (einen Prozess für den Bereich vorschlagen lassen). */
function HeadKarteBereich({ head, headId, onHead, darfBauen }: { head?: HeadKurz | null; headId: string; onHead: () => void; darfBauen: boolean }) {
  if (head === undefined) return <Karte flach><p style={klein}>Der Head lädt …</p></Karte>;
  if (head === null) return <Karte flach><Hinweis art="info" titel="Head dieses Bereichs">Der Head ist für dich hier nicht zu sehen — die Agenten zeigen, wer dir zur Verfügung steht.</Hinweis><Knopf leise href={WEG.agenten()}>Zu den Agenten ›</Knopf></Karte>;
  return (
    <Karte flach>
      <Ueberschrift rechts={head.gesperrt ? <Chip farbe={C.inkDim}>angehalten</Chip> : head.aktiv ? undefined : <Chip farbe={C.inkDim}>aus</Chip>}>{head.name}</Ueberschrift>
      <p style={klein}>{head.gesperrt?.text ?? head.auftrag}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Knopf leise href={WEG.freigaben(undefined, 'business')} titel="Offene Vorschläge in den Freigaben"><span className="pz-knopf-inhalt"><InboxIcon size={15} aria-hidden />{head.zaehler.freigaben ? `${head.zaehler.freigaben} offene Vorschläge` : 'Keine offenen Vorschläge'}</span></Knopf>
        <Knopf leise href={WEG.agenten({ h: headId })}><span className="pz-knopf-inhalt"><MessageSquare size={15} aria-hidden />Gespräch</span></Knopf>
        <Knopf leise href={WEG.agenten({ h: headId, r: 'einstellungen' })}><span className="pz-knopf-inhalt"><Settings2 size={15} aria-hidden />Einstellungen</span></Knopf>
        {darfBauen && <Knopf onClick={onHead} titel="Den Head einen Prozess für diesen Bereich vorschlagen lassen — übernommen erst mit deinem Klick"><span className="pz-knopf-inhalt"><Sparkles size={15} aria-hidden />Head fragen</span></Knopf>}
      </div>
    </Karte>
  );
}

/** Der Baustein mit Daten — auf der Seite eines Werkzeugs dort, wo `werkzeug.automation.href` hinzeigt. */
export function BereichAutomationen({ werkzeug }: { werkzeug: Werkzeug }) {
  const a = werkzeug.automation;
  const router = useRouter();
  const { daten, fehler, neu } = useLandkarte();
  const anp = useLandkarteAnpassung(daten);
  const laeufe = useLaufZahlen();
  const liste = useWerkstattListe();
  const [head, setHead] = useState<HeadKurz | null | undefined>(undefined);
  const [neuOffen, setNeuOffen] = useState(false);
  const [vorlageOffen, setVorlageOffen] = useState(false);
  const [headOffen, setHeadOffen] = useState(false);
  const headId = a?.head;
  useEffect(() => {
    if (!headId) return;
    let an = true;
    void fetch('/api/agenten?space=business', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { heads?: HeadKurz[] } | null) => { if (an) setHead(j?.heads?.find(h => h.id === headId) ?? null); });
    return () => { an = false; };
  }, [headId]);
  const gruppen = useMemo(() => (a && daten ? automationenFuer(anp.ansicht, a.bereiche, laeufe ?? {}) : []), [a, daten, anp.ansicht, laeufe]);
  if (!a) return null;
  const bereich = ersterBereich(a.bereiche);
  const inDieWerkstatt = async (id: string) => { await neu(); router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt' })); };
  return (
    <>
      <BereichAutomationenAnsicht werkzeug={werkzeug} gruppen={gruppen} head={head} headId={headId} darfBauen={!!liste.daten?.rechte.entwurf}
        schrauben={{ rechte: daten?.stellschraubenRechte, stand: daten?.stellschraubenStand }} fehler={!daten ? fehler : null} laedt={!daten && !fehler}
        onNeu={() => setNeuOffen(true)} onVorlage={() => setVorlageOffen(true)} onHead={() => setHeadOffen(true)} onGespeichert={neu} />
      {neuOffen && <NeuerProzessFenster onZu={() => setNeuOffen(false)} bereichVorgabe={bereich} onAngelegt={async id => { setNeuOffen(false); await inDieWerkstatt(id); }} />}
      {vorlageOffen && <VorlagenGalerie bereiche={a.bereiche} onZu={() => setVorlageOffen(false)} onAngelegt={async id => { setVorlageOffen(false); await inDieWerkstatt(id); }} />}
      {headOffen && <HeadFragenFenster bereichVorgabe={bereich} onZu={() => setHeadOffen(false)} onUebernommen={async r => { setHeadOffen(false); await inDieWerkstatt(r.prozessId); }} />}
    </>
  );
}
