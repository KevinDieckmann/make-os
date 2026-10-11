// ─── Fulfillment · Analyse — Lage der Läufe für die Oberfläche (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.2/4.3) — nur Server ─────────────────────
// GET `/api/fulfillment/analyse?m=`: je Agent der Zustand (bereit · gesperrt mit Gründen · läuft · erledigt), die SCHÄTZUNG je Lauf („ca. x“ und
// „höchstens y“), wie oft er lief (der 4. nur mit Grund), die KI-Lage der Person EHRLICH (kein Zugang, Bereich aus, Web-Suche aus, Tiefenbericht aus
// — mit Satz und Weg zu den Schaltern; nichts wird umgeschaltet) und das Minimalset als Vorschlag (es startet nie von selbst). Liest nur.

import type { AnalyseAgentId } from '../typen';
import { fulfillmentLesen } from '../speicher';
import { AGENTEN, AGENT_IDS, MINIMALSET, GLEICHZEITIG_MAX, LAEUFE_JE_AGENT, sperrGruende, hinweise, laufZahl, laufStatusAnzeige, laufVerwaist, letzterLauf } from './agenten';
import { schaetzen } from './schaetzen';
import { kiLage, KI_SAETZE, laufDaten, messungenAus, modelleJeStufe, tiefenberichtFrage } from './lauf';
import { laufFuerAntwort } from './sicht';

export interface AgentLage {
  id: AnalyseAgentId; name: string; welle: number; art: 'modell' | 'regel' | 'tiefenbericht'; web: boolean; personen: string;
  zustand: 'bereit' | 'gesperrt' | 'laeuft'; letzter?: string; gruende: string[]; hinweise: string[];
  schaetzung: ReturnType<typeof schaetzen>; laeufe: number; grundNoetig: boolean; imMinimalset: boolean;
  /** Nur A4: je Funktion aus F1. */
  funktionen?: { funktion: string; zustand: 'bereit' | 'gesperrt' | 'laeuft'; letzter?: string; laeufe: number; grundNoetig: boolean }[];
}

export async function analyseLage(mandatId: string, person: string): Promise<Record<string, unknown> | null> {
  const datei = await fulfillmentLesen('dossiers');
  const d = datei.dossiers[mandatId];
  if (!d) return null;
  const jetzt = Date.now();
  const [daten, ki, modelle] = await Promise.all([laufDaten(mandatId), kiLage(person), modelleJeStufe()]);
  const messungen = messungenAus(datei);
  const laufendInstanz = Object.values(datei.dossiers).flatMap(x => x.laeufe).filter(l => l.status === 'laeuft' && !laufVerwaist(l, jetzt)).length;
  const kiGruende = (id: AnalyseAgentId): string[] => {
    const a = AGENTEN[id];
    if (a.art === 'tiefenbericht') return ki.tiefenbericht ? [] : [KI_SAETZE.tiefenbericht];
    if (a.art !== 'modell') return [];
    return [!ki.kiZugang ? KI_SAETZE.kiZugang : '', !ki.bereichCrm ? KI_SAETZE.bereichCrm : '', a.web && !ki.websuche ? KI_SAETZE.websuche : ''].filter(Boolean);
  };
  const agenten: AgentLage[] = AGENT_IDS.map(id => {
    const a = AGENTEN[id];
    const gruende = [...sperrGruende(d, id, { playbook: daten.playbook, register: daten.register, jetztMs: jetzt }), ...kiGruende(id)];
    const laeuft = d.laeufe.some(l => l.agent === id && laufStatusAnzeige(l, jetzt) === 'laeuft');
    const n = laufZahl(d, id);
    const letzter = letzterLauf(d, id);
    const basis: AgentLage = {
      id, name: a.name, welle: a.welle, art: a.art, web: a.web, personen: a.personen,
      zustand: laeuft ? 'laeuft' : gruende.length ? 'gesperrt' : 'bereit', ...(letzter ? { letzter: laufStatusAnzeige(letzter, jetzt) } : {}),
      gruende, hinweise: hinweise(id, { playbook: daten.playbook, register: daten.register, jetztMs: jetzt }),
      schaetzung: schaetzen(id, { messungen: messungen[id] ?? [], modelle }), laeufe: n, grundNoetig: a.personen !== 'karten' && a.art === 'modell' && n >= LAEUFE_JE_AGENT,
      imMinimalset: MINIMALSET.includes(id),
    };
    if (a.personen === 'karten') {
      basis.funktionen = (d.f1?.funktionen ?? []).map(f => {
        const l = letzterLauf(d, id, f);
        const nf = laufZahl(d, id, f);
        const lf = !!l && laufStatusAnzeige(l, jetzt) === 'laeuft';
        return { funktion: f, zustand: lf ? 'laeuft' : gruende.length ? 'gesperrt' : 'bereit', ...(l ? { letzter: laufStatusAnzeige(l, jetzt) } : {}), laeufe: nf, grundNoetig: nf >= LAEUFE_JE_AGENT };
      });
    }
    return basis;
  });
  return {
    agenten, laeufe: d.laeufe.map(l => laufFuerAntwort(l, jetzt)), ki, kiSaetze: KI_SAETZE, minimalset: MINIMALSET,
    gleichzeitig: { laufend: laufendInstanz, max: GLEICHZEITIG_MAX }, kostenCent: Math.round(d.laeufe.reduce((s, l) => s + (l.kostenCent ?? 0), 0)),
    tiefenbericht: { frage: tiefenberichtFrage(d), vorhanden: !!d.leseteil, eigen: d.leseteil?.person === person },
  };
}
