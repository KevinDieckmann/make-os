'use client';

// ─── Fulfillment › Onboarding (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 3.1, 3.2) ──────────────────────────────────────────────────────
// Kandidaten: Mandate (aktiv oder Angebot, Business-Gesellschaft, ohne Fall) mit unterschriebenem Vertrag, angenommenem Angebot oder gewonnenem
// Deal — mit der 24-h-Uhr der Willkommensmail. „Starten“ legt den Fall an (Paket-Vorlage vorgewählt aus der Zuordnung des Produkts),
// „Ausblenden“ setzt nur eine Marke. Dieselbe Karte steht als `OnboardingHinweis` in Produkte & Mandate › Mandate (nur, wenn es Kandidaten gibt —
// sonst bleibt die Seite genau wie bisher). Darunter die laufenden Onboardings und die Einstellungen (Willkommen in … Stunden, Nachsorge-Tage).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TIEF } from '@/lib/make-one/design';
import { MUSTER_ONBOARDING } from '@/lib/fulfillment/muster';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Feldzeile, Punkt, LEUCHT } from '../../ui';
import { Fenster } from '../../Fenster';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import type { CrmApi } from '../../crm/daten';
import { useUebersicht, useUebersichtKurz, fallAktion, vorlagenOps, holeJson, fehlerText, neueAnfrageId, geaendert, type Kandidat } from './daten';
import { klein, feld, Leiste, Meldung } from './teile';

const GRUND: Record<Kandidat['grund'], string> = { vertrag: 'Vertrag unterschrieben', angebot: 'Angebot angenommen', deal: 'Deal gewonnen' };

function uhrText(k: Kandidat): { text: string; farbe: string } | null {
  if (!k.uhr.faellig) return null;
  if (k.uhr.ueberfaellig) return { text: 'Willkommensmail überfällig', farbe: LEUCHT.kritisch };
  const d = new Date(k.uhr.faellig);
  return { text: `Willkommen bis ${d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}`, farbe: (k.uhr.restStunden ?? 99) <= 6 ? LEUCHT.achtung : LEUCHT.gut };
}

/** Kandidaten-Liste mit Start-Dialog — geteilt von Fulfillment › Onboarding und dem Einhänger in Produkte & Mandate. */
function KandidatenKarte({ kandidaten, pakete, i, ruhig = false }: { kandidaten: Kandidat[]; pakete: { id: string; titel: string; zusatz?: true }[]; i: number; ruhig?: boolean }) {
  const [start, setStart] = useState<Kandidat | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const aus = async (k: Kandidat) => {
    const a = await holeJson('/api/fulfillment/fall', { method: 'PATCH', body: JSON.stringify({ mandatId: k.mandatId, ops: [{ op: 'onboarding-aus', aus: true }] }) });
    if (a.ok) geaendert(); else setMeldung(fehlerText(a));
  };
  return (
    <Karte i={i} {...(ruhig ? {} : { akzent: LEUCHT.gut })}>
      {ruhig
        ? <Ueberschrift rechts={<span>{kandidaten.length}</span>}>Bestandsmandate — Fall starten?</Ueberschrift>
        : <Ueberschrift farbe={LEUCHT.gut} erklaerung="fulfillment.willkommen24h" rechts={<span>{kandidaten.length}</span>}>Neue Kunden — Fall starten</Ueberschrift>}
      {ruhig && <div style={klein}>Vor der Einrichtung von Fulfillment unterschrieben — ohne Uhr und ohne Glocke. Ein Fall startet nur, wenn du ihn anlegst.</div>}
      <Meldung text={meldung} art="kritisch" />
      <Liste>
        {kandidaten.map(k => {
          const u = uhrText(k);
          return (
            <Zeile key={k.mandatId} links={<Punkt farbe={u?.farbe ?? LEUCHT.gut} />} titel={k.kunde} umbrechen
              unter={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{k.titel} · {GRUND[k.grund]}{u && <Chip farbe={u.farbe}>{u.text}</Chip>}{k.vorgeschlagen && <Chip farbe={C.inkDim}>im Stapel vorgeschlagen</Chip>}</span>}
              rechts={<Leiste><Knopf leise onClick={() => aus(k)}>Ausblenden</Knopf><Knopf haupt onClick={() => setStart(k)}>Fall starten</Knopf></Leiste>} />
          );
        })}
      </Liste>
      {start && <StartDialog k={start} pakete={pakete} onZu={() => setStart(null)} />}
    </Karte>
  );
}

/**
 * Start-Dialog: Ablauf (vorgewählt aus der Zuordnung des Produkts; ohne Zuordnung der erste Ablauf, der kein Zusatzmodul ist — 17.10. spät, vorher konnte das
 * ein Zusatzmodul sein) und Starttag (heute) — legt den Fall an (idempotent über die Anfrage) und öffnet ihn.
 */
export function StartDialog({ k, pakete, onZu }: { k: Pick<Kandidat, 'mandatId' | 'kunde' | 'vorlage'> & { leistungId?: string }; pakete: { id: string; titel: string; zusatz?: true }[]; onZu: () => void }) {
  const router = useRouter();
  const [vorlage, setVorlage] = useState<string | null>(k.vorlage?.id ?? pakete.find(p => !p.zusatz)?.id ?? pakete[0]?.id ?? null);
  const [tag, setTag] = useState(localDay());
  const [fehler, setFehler] = useState<string | null>(null);
  const [anfrage] = useState(neueAnfrageId);
  const los = async () => {
    if (!vorlage) { setFehler('Bitte einen Ablauf wählen.'); return; }
    const a = await fallAktion({ aktion: 'starten', mandatId: k.mandatId, vorlageId: vorlage, start: tag, anfrageId: anfrage });
    // Das Produkt merkt sich den Ablauf (17.10., Gesamtprüfung — maximal einfach): hatte es noch keinen, ist der gewählte beim nächsten Mal vorgewählt. Nur ein
    // Ablauf des Pakets (kein Zusatzmodul); wer keine Abläufe bearbeiten darf, bekommt 403 — der Fall läuft trotzdem.
    if (a.ok && k.leistungId && !k.vorlage && vorlage && !pakete.find(p => p.id === vorlage)?.zusatz) await vorlagenOps([{ op: 'zuordnung', leistungId: k.leistungId, vorlageId: vorlage }]).catch(() => null);
    if (a.ok) { onZu(); router.push(WEG.fall(k.mandatId)); } else setFehler(fehlerText(a));
  };
  return (
    <Fenster titel={`Fall starten: ${k.kunde}`} onZu={onZu} breit={560}>
      <form onSubmit={e => { e.preventDefault(); void los(); }} style={{ display: 'grid', gap: 12 }}>
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        {!pakete.length && <Hinweis art="achtung">Noch kein Ablauf — unter Fulfillment › Übersicht „Aus Muster anlegen“.</Hinweis>}
        <Feldzeile label="Ablauf" erklaerung="fulfillment.zuordnung">
          <Wahl label="Ablauf" liste={pakete.map(p => ({ id: p.id, label: p.zusatz ? `${p.titel} (Zusatzmodul)` : p.titel }))} wert={vorlage} onWahl={setVorlage} />
        </Feldzeile>
        <Feldzeile label="Start"><input type="date" value={tag} onChange={e => setTag(e.target.value)} style={feld} /></Feldzeile>
        <div style={klein}>{pakete.find(p => p.id === vorlage)?.zusatz
          ? 'Zusatzmodul: der Fall übernimmt die Schritte des Ablaufs und startet ohne Onboarding — die erste Phase läuft sofort.'
          : 'Der Fall übernimmt die Schritte des Ablaufs und legt die acht Onboarding-Schritte an. Danach bereitest du die Willkommensmail vor — gesendet wird erst mit deinem Klick.'}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" aus={!vorlage}>Fall anlegen</Knopf>
        </div>
      </form>
    </Fenster>
  );
}

/** Einhänger in Produkte & Mandate › Mandate: die Karte erscheint NUR, wenn es Kandidaten gibt (sonst bleibt die Seite wie bisher). */
export function OnboardingHinweis(_p: { api: CrmApi }) {
  const { daten } = useUebersichtKurz();
  // Nur neue Kandidaten — Bestandsmandate stehen ruhig unter Fulfillment › Onboarding (Prüf-Fund 11.10.).
  const neu = daten?.kandidaten.filter(k => !k.bestand) ?? [];
  if (!neu.length || !daten) return null;
  return <KandidatenKarte kandidaten={neu} pakete={daten.prozesse.filter(p => p.art === 'paket')} i={1} />;
}

export function Onboarding() {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const laufend = Object.values(daten.faelle).filter(f => f.status === 'onboarding').sort((a, b) => Number(b.willkommenUeberfaellig) - Number(a.willkommenUeberfaellig));
  const pakete = daten.prozesse.filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, ...(p.zusatz ? { zusatz: true as const } : {}) }));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Abnahme B7: der Satz passt zur Liste darunter — „kein neues Mandat wartet auf den Start“, wenn schon Onboardings laufen. */}
      {daten.kandidaten.some(k => !k.bestand)
        ? <KandidatenKarte kandidaten={daten.kandidaten.filter(k => !k.bestand)} pakete={pakete} i={1} />
        : <Hinweis art="info">{laufend.length
          ? `Kein neues Mandat wartet auf den Start — ${laufend.length === 1 ? 'ein Onboarding läuft' : `${laufend.length} Onboardings laufen`} (unten). Ein neues Mandat erscheint hier, sobald der Vertrag unterschrieben, ein Angebot angenommen oder der Deal gewonnen ist.`
          : 'Kein Mandat wartet aufs Onboarding. Ein Mandat erscheint hier, sobald der Vertrag unterschrieben, ein Angebot angenommen oder der Deal gewonnen ist.'}</Hinweis>}
      {daten.kandidaten.some(k => k.bestand) && <KandidatenKarte kandidaten={daten.kandidaten.filter(k => k.bestand)} pakete={pakete} i={2} ruhig />}
      <Karte i={2}>
        <Ueberschrift rechts={<span>{laufend.length}</span>}>Laufende Onboardings</Ueberschrift>
        {!laufend.length ? <div style={klein}>Gerade läuft kein Onboarding.</div> : (
          <Liste>
            {laufend.map(f => {
              // Dieselbe Zahl wie das Band im Fall (erfüllt oder entfallen, alle acht — Abnahme: hier „1 von 8“, im Fall „0 von 8“).
              const gesamt = MUSTER_ONBOARDING.length, fertig = f.onboardingErfuellt ?? 0;
              const farbe = f.willkommenUeberfaellig ? LEUCHT.kritisch : LEUCHT.planung;
              return (
                <Zeile key={f.mandatId} links={<Punkt farbe={f.willkommenUeberfaellig ? LEUCHT.kritisch : LEUCHT.gut} />} titel={f.kunde} onClick={() => router.push(WEG.fall(f.mandatId))} umbrechen
                  unter={<span style={{ display: 'grid', gap: 6 }}>
                    <span>{fertig} von {gesamt} Schritten erfüllt{f.willkommenUeberfaellig ? ' · Willkommensmail überfällig' : ''}</span>
                    <span role="img" aria-label={`${fertig} von ${gesamt} Onboarding-Schritten erfüllt`} style={{ display: 'grid', gridTemplateColumns: `repeat(${gesamt}, minmax(0, 1fr))`, gap: 3, maxWidth: 260 }}>
                      {Array.from({ length: gesamt }, (_, i) => <span key={i} style={{ height: 6, borderRadius: 3, background: i < fertig ? TIEF.verlauf(LEUCHT.gut) : `${farbe}33` }} />)}
                    </span>
                  </span>} />
              );
            })}
          </Liste>
        )}
      </Karte>
      <Einstellungen daten={daten} />
    </div>
  );
}

function Einstellungen({ daten }: { daten: NonNullable<ReturnType<typeof useUebersicht>['daten']> }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const setze = async (felder: Record<string, unknown>) => { const a = await vorlagenOps([{ op: 'einstellungen', felder }]); setFehler(a.ok ? null : fehlerText(a)); };
  const e = daten.einstellungen;
  return (
    <Karte i={3}>
      <Ueberschrift>Takt des Onboardings</Ueberschrift>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <Feldzeile label="Willkommensmail spätestens nach (Stunden)" erklaerung="fulfillment.einstellungWillkommen">
        <input inputMode="numeric" defaultValue={String(e.willkommenStunden)} onBlur={x => { const n = Number(x.target.value); if (n && n !== e.willkommenStunden) void setze({ willkommenStunden: n }); }} style={feld} />
      </Feldzeile>
      <Feldzeile label="Nachsorge nach Mandatsende (Tage, durch Komma)" erklaerung="fulfillment.nachsorge">
        <input defaultValue={e.nachsorgeTage.join(', ')} onBlur={x => { const l = x.target.value.split(',').map(t => Number(t.trim())).filter(n => Number.isInteger(n) && n > 0); if (l.length && l.join(',') !== e.nachsorgeTage.join(',')) void setze({ nachsorgeTage: l }); }} style={feld} />
      </Feldzeile>
    </Karte>
  );
}
