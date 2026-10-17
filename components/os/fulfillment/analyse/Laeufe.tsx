'use client';

// ─── Fulfillment · Analyse — Läufe je Welle (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.2/4.3) ──────────────────────────────────────────────────────
// Je Agent eine Zeile: Zustand, Schätzung („ca. x · höchstens y“), Gründe einer Sperre, Starten NUR für genau diesen Lauf nach einer Rückfrage mit
// Kosten und Datenweg (kein „alle starten“; das Minimalset ist nur ein Vorschlag). Darunter die Läufe: laufend (Abbrechen), Entwurf (Abschnitte
// anhaken → übernehmen, oder verwerfen), Fehler mit Satz.
// 11.10. (Design, Rückmeldung: „Wellen-Bild mit Status je Agent, Kosten je Lauf vor dem Start klar“): oben das Wellen-Bild (Welle 0–3, je Agent eine
// Marke in seiner Stufenfarbe) und EIN Vorschlag „nächster Lauf“ mit seiner Schätzung als Hauptaktion (`naechsterLauf`, startet nach derselben
// Rückfrage wie jede Zeile). Sätze, die bei vielen Agenten gleich stehen (KI aus, Web-Suche aus), stehen EINMAL oben statt in jeder Zeile.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { agentAbschnitte } from '@/lib/erklaerungen/typen';
import { FULFILLMENT_AGENT_TEXTE } from '@/lib/erklaerungen/fulfillment-analyse';
import { euroText } from '@/lib/ki/kosten';
import type { AbschnittId, AnalyseLauf } from '@/lib/fulfillment/typen';
import { ABSCHNITT_LABEL, LAUF_LABEL } from '@/lib/fulfillment/analyse/sicht';
import { alsErgebnis, STECKBRIEF_LABEL, type SteckbriefFeld } from '@/lib/fulfillment/analyse/ausgabe';
import { Karte, Ueberschrift, Zeile, Knopf, Chip, Hinweis, MehrfachPillen, Liste, eingabe, LEUCHT, useRueckfrage } from '../../ui';
import { wellenBild, naechsterLauf, gemeinsameSaetze, ohneGemeinsame } from '@/lib/fulfillment/prozesse/darstellung';
import { WellenBild, Legende, AgentMarke } from '../reise/bilder';
import { senden, fehlerVon, anfrageId, type AgentLage, type AnalyseApi } from './daten';
import { useOhneKuerzel } from '../prozesse/daten';
import { agentText } from '@/lib/fulfillment/analyse/agenten';
import { BeispielMarke } from '../../BeispielMarke';
import { anzahl } from '@/lib/text/zahlwort';

type Rueck = ReturnType<typeof useRueckfrage>;
const ZUSTAND_FARBE = { bereit: LEUCHT.gut, gesperrt: C.inkLeise, laeuft: LEUCHT.planung } as const;
const LAUF_FARBE: Partial<Record<AnalyseLauf['status'], string>> = { laeuft: LEUCHT.planung, fertig: LEUCHT.achtung, fehler: LEUCHT.kritisch, uebernommen: LEUCHT.gut };
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const WELLEN = [{ w: 0, t: 'Welle 0 · Start' }, { w: 1, t: 'Welle 1 · Unternehmen' }, { w: 2, t: 'Welle 2 · Vertiefung' }, { w: 3, t: 'Welle 3 · Synthese und Prüfung' }];

function datenweg(a: AgentLage): string {
  if (a.art === 'regel') return 'Ohne Modell, ohne Kosten — nichts verlässt das Haus.';
  if (a.personen === 'karten') return 'Firma, Funktion und gelesene Seiten gehen über das KI-Tor an das Modell (Kategorien Markttraktion und Web, ohne Pseudonym — der Auftrag ist die Funktion). Nur beruflich, nur Positivliste.';
  return a.web ? 'Firma, Domain und gelesene Seiten gehen über das KI-Tor an das Modell (Kategorien Markttraktion und Web); höchstens 5 Suchen, höchstens 20 Seiten.' : 'Abschnitte bzw. freigegebene Unterlagen dieses Mandats gehen über das KI-Tor an das Modell (Kategorie Markttraktion).';
}

export function Laeufe({ mandatId, api, rueck }: { mandatId: string; api: AnalyseApi; rueck: Rueck }) {
  const lage = api.lage;
  const [grund, setGrund] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  // 15.10. (Abnahme B5): Gründe nennen nie „F1“ — der Abstimmungspunkt heißt wie im Ablauf des Falls.
  const kuerzel = useOhneKuerzel(mandatId);
  if (!lage) return <Hinweis art="info">Die Läufe werden geladen …</Hinweis>;
  const starten = async (a: AgentLage, funktion?: string, cent = a.schaetzung.cent, hoechstens = a.schaetzung.hoechstensText) => {
    const ok = await rueck.bestaetigen({
      titel: `${a.name}${funktion ? ` · ${funktion}` : ''} starten?`,
      text: `${a.art === 'regel' ? 'Ohne Kosten.' : `Kosten ${euroText(cent, true)}, höchstens ${hoechstens} — darüber bricht der Lauf ab.`}\n${datenweg(a)}\nDas Ergebnis ist ein Entwurf: in das Dossier kommt erst, was du übernimmst.`,
      ja: a.art === 'regel' ? 'Prüfen' : 'Starten',
    });
    if (!ok) return;
    const key = `${a.id}:${funktion ?? ''}`;
    const r = await senden('/api/fulfillment/analyse', { aktion: 'starten', mandatId, agent: a.id, bestaetigtCent: cent, anfrageId: anfrageId(), ...(funktion ? { funktion } : {}), ...(grund[key]?.trim() ? { grund: grund[key].trim() } : {}) });
    if (r.status === 409 && r.j.kostenRueckfrage) {
      const s = r.j.schaetzung as { cent: number; hoechstensText: string };
      setMeldung(`Die Schätzung hat sich geändert (${euroText(s.cent, true)}) — bitte neu bestätigen.`);
      return starten(a, funktion, s.cent, s.hoechstensText);
    }
    setMeldung(fehlerVon(r));
    await api.laden();
  };
  const imMinimal = lage.minimalset.map(x => agentText(x)).join(', ');
  const wellen = wellenBild(lage.agenten);
  const naechster = naechsterLauf(lage.agenten.filter(a => !a.funktionen), lage.minimalset);
  const gemeinsam = new Set(gemeinsameSaetze(lage.agenten));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Karte>
        <Ueberschrift erklaerung="fulfillment.wellen" rechts={<span>bisher {euroText(lage.kostenCent)}</span>}>Stand der Analyse</Ueberschrift>
        <WellenBild wellen={wellen} />
        <Legende eintraege={[
          { zeichen: <AgentMarke id="a" name="Agent" stufe="uebernommen" />, text: 'im Dossier' },
          { zeichen: <AgentMarke id="a" name="Agent" stufe="entwurf" />, text: 'Entwurf prüfen' },
          { zeichen: <AgentMarke id="a" name="Agent" stufe="bereit" />, text: 'bereit' },
          { zeichen: <AgentMarke id="a" name="Agent" stufe="gesperrt" />, text: 'noch gesperrt' },
        ]} />
        {naechster ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Knopf haupt onClick={() => starten(naechster)}>{naechster.art === 'regel' ? `${naechster.name} prüfen (ohne Kosten)` : `${naechster.name} starten (${naechster.schaetzung.text})`}</Knopf>
            <span style={klein}>{naechster.imMinimalset ? 'Nächster Lauf aus dem Minimalset' : 'Nächster bereiter Lauf'}{naechster.art === 'regel' ? '' : ` · höchstens ${naechster.schaetzung.hoechstensText}`} — startet erst nach deiner Bestätigung.</span>
          </div>
        ) : <div style={klein}>Gerade ist kein Lauf bereit — die Gründe stehen unten je Agent.</div>}
      </Karte>
      <Ueberschrift erklaerung="fulfillment.laufBestaetigen">Läufe — jeder einzeln bestätigt</Ueberschrift>
      <Hinweis art="info" titel="Jeder Lauf einzeln">
        Vorschlag Minimalset: {imMinimal}. Nichts startet von selbst — jeder Lauf nur mit deinem Klick auf genau diesen Lauf. Gleichzeitig: {lage.gleichzeitig.laufend} von {lage.gleichzeitig.max}. Bisher {euroText(lage.kostenCent)}.
      </Hinweis>
      {gemeinsam.size > 0 && <Hinweis art="neutral" titel="Gilt für viele Läufe">{kuerzel([...gemeinsam].join(' '))}</Hinweis>}
      {meldung && <Hinweis art="achtung">{meldung}</Hinweis>}
      {WELLEN.map(({ w, t }) => (
        <Karte key={w}>
          <Ueberschrift>{t}</Ueberschrift>
          <Liste>
            {lage.agenten.filter(a => a.welle === w).map(a => {
              const text = FULFILLMENT_AGENT_TEXTE[a.id];
              const zeilen = a.funktionen ?? [null];
              return zeilen.map(f => {
                const zustand = f ? f.zustand : a.zustand;
                const key = `${a.id}:${f?.funktion ?? ''}`;
                const grundNoetig = f ? f.grundNoetig : a.grundNoetig;
                return (
                  <div key={key} style={{ display: 'grid', gap: 6 }}>
                    <Zeile
                      titel={<>{a.name}{f ? ` · ${f.funktion}` : ''}</>}
                      unter={`${a.art === 'regel' ? 'ohne Kosten' : `${a.schaetzung.text} · höchstens ${a.schaetzung.hoechstensText}${a.schaetzung.quelle === 'gemessen' ? ' (aus gemessenen Läufen)' : ''}`}${(f?.laeufe ?? a.laeufe) ? ` · ${f?.laeufe ?? a.laeufe}× gelaufen` : ''}${(f?.letzter ?? a.letzter) ? ` · zuletzt ${LAUF_LABEL[(f?.letzter ?? a.letzter) as AnalyseLauf['status']] ?? ''}` : ''}`}
                      erklaerung={text ? agentAbschnitte(text) : undefined}
                      rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Chip farbe={ZUSTAND_FARBE[zustand]}>{zustand === 'laeuft' ? 'läuft' : zustand}</Chip>
                        {a.id !== 'tb' && <Knopf aus={zustand !== 'bereit' || (grundNoetig && !grund[key]?.trim())} onClick={() => starten(a, f?.funktion)}>{a.art === 'regel' ? 'Prüfen' : 'Starten'}</Knopf>}
                      </span>}
                    />
                    {a.id === 'tb' && <div style={klein}>Der Tiefenbericht startet unter „Tiefenbericht“ — nur für dich lesbar.</div>}
                    {zustand === 'gesperrt' && a.gruende.length > 0 && ohneGemeinsame(a.gruende.join(' '), gemeinsam) && <div style={klein}>{kuerzel(ohneGemeinsame(a.gruende.join(' '), gemeinsam))}</div>}
                    {a.hinweise.length > 0 && ohneGemeinsame(a.hinweise.join(' '), gemeinsam) && <div style={klein}>{kuerzel(ohneGemeinsame(a.hinweise.join(' '), gemeinsam))}</div>}
                    {grundNoetig && zustand === 'bereit' && (
                      <input style={eingabe} maxLength={300} placeholder="Grund für einen weiteren Lauf (Pflicht ab dem vierten)" value={grund[key] ?? ''} onChange={e => setGrund(g => ({ ...g, [key]: e.target.value }))} aria-label="Grund für einen weiteren Lauf" />
                    )}
                  </div>
                );
              });
            })}
          </Liste>
        </Karte>
      ))}
      <LaufListe mandatId={mandatId} api={api} rueck={rueck} />
    </div>
  );
}

function LaufListe({ mandatId, api, rueck }: { mandatId: string; api: AnalyseApi; rueck: Rueck }) {
  const lage = api.lage!;
  const stand = api.dossier?.stand ?? '';
  const [wahl, setWahl] = useState<Record<string, string[]>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  const laeufe = [...lage.laeufe].reverse();
  if (!laeufe.length) return null;
  const schritt = async (body: Record<string, unknown>) => {
    const r = await senden('/api/fulfillment/dossier', { mandatId, stand, ...body });
    setMeldung(fehlerVon(r));
    await api.laden();
  };
  return (
    <Karte>
      <Ueberschrift>Läufe und Entwürfe</Ueberschrift>
      {meldung && <Hinweis art="achtung">{meldung}</Hinweis>}
      <Liste>
        {laeufe.map(l => {
          const e = alsErgebnis(l.ergebnis);
          const abschnitte = e ? (Object.entries(e.abschnitte).filter(([, v]) => v?.length) as [AbschnittId, unknown[]][]) : [];
          const auswahl = wahl[l.id] ?? [...abschnitte.map(([k]) => k), ...(e?.diagnose ? ['diagnose'] : [])];
          const a4 = l.agent === 'a4' ? (l.ergebnis as { karten?: number; funktion?: string } | undefined) : undefined;
          return (
            <div key={l.id} style={{ display: 'grid', gap: 6, paddingBottom: 8 }}>
              <Zeile titel={<>{`${agentText(l.agent)}${a4?.funktion ? ` · ${a4.funktion}` : ''} · ${LAUF_LABEL[l.status]}`}{l.beispiel && <> <BeispielMarke /></>}</>}
                unter={`${l.gestartetAm ? new Date(l.gestartetAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''}${typeof l.kostenCent === 'number' ? ` · ${euroText(l.kostenCent)}` : ` · bestätigt ${euroText(l.bestaetigtCent)}`}${l.grund ? ` · Grund: ${l.grund}` : ''}`}
                rechts={<Chip farbe={LAUF_FARBE[l.status] ?? C.inkLeise}>{LAUF_LABEL[l.status]}</Chip>} umbrechen />
              {l.fehler && <div style={klein}>{l.fehler}</div>}
              {l.status === 'laeuft' && <div><Knopf leise onClick={async () => { const r = await senden('/api/fulfillment/analyse', { aktion: 'abbrechen', mandatId, laufId: l.id }); setMeldung(fehlerVon(r)); await api.laden(); }}>Abbrechen</Knopf></div>}
              {a4 && <div style={klein}>{a4.karten ? `${anzahl(a4.karten, 'Karte', 'Karten')} als Entwurf im Personenteil — dort prüfen.` : 'Keine sichere Karte — nichts im Personenteil.'}</div>}
              {e && l.status === 'fertig' && (
                <>
                  {abschnitte.map(([k, v]) => <div key={k} style={klein}>{ABSCHNITT_LABEL[k]}: {anzahl(v.length, 'Aussage', 'Aussagen')}</div>)}
                  {e.steckbrief && <div style={klein}>Steckbrief: {Object.entries(e.steckbrief).map(([f, x]) => `${STECKBRIEF_LABEL[f as SteckbriefFeld]} ${x!.wert}`).join(' · ')}</div>}
                  {e.diagnose && <div style={klein}>Diagnose-Entwurf: {anzahl(e.diagnose.top5.length, 'Maßnahme', 'Maßnahmen')}, {anzahl(e.diagnose.quickWins.length, 'Quick Win', 'Quick Wins')}, {anzahl(e.diagnose.fragen.length, 'Frage', 'Fragen')}</div>}
                  {e.befunde && <div style={klein}>Prüfer: {anzahl(e.befunde.length, 'Befund', 'Befunde')} — nach dem Übernehmen unter „Recht & Prüfung“ neu prüfen.</div>}
                  {(e.zaehler.ohneQuelle + e.zaehler.verworfen + e.zaehler.negativ + e.zaehler.gesperrt) > 0 && (
                    <div style={klein}>Gesäubert: {e.zaehler.ohneQuelle} ohne Beleg → offene Fragen · {e.zaehler.verworfen} verworfen · {e.zaehler.gesperrt} gesperrte Quellen · {e.zaehler.negativ} laut Negativliste{e.ausgelassen.length ? ` (${e.ausgelassen.join(', ')})` : ''}{e.zaehler.gekuerzt ? ` · ${e.zaehler.gekuerzt} gekürzt` : ''}</div>
                  )}
                  {abschnitte.length + (e.diagnose ? 1 : 0) > 1 && (
                    <MehrfachPillen liste={[...abschnitte.map(([k]) => ({ id: k as string, label: ABSCHNITT_LABEL[k] })), ...(e.diagnose ? [{ id: 'diagnose', label: 'Diagnose-Entwurf' }] : [])]} aktiv={auswahl} onWahl={x => setWahl(w => ({ ...w, [l.id]: x }))} />
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Knopf onClick={() => schritt({ aktion: 'uebernehmen', laufId: l.id, abschnitte: auswahl })}>In das Dossier übernehmen</Knopf>
                    <Knopf leise onClick={async () => { if (await rueck.bestaetigen({ titel: 'Entwurf verwerfen?', text: 'Der Entwurf wird gelöscht; der Lauf bleibt mit seinen Kosten in der Liste.', ja: 'Verwerfen', gefahr: true })) await schritt({ aktion: 'verwerfen', laufId: l.id }); }}>Verwerfen</Knopf>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </Liste>
    </Karte>
  );
}

