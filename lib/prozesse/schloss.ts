// ─── Prozesse — das Freigabe-Schloss hinter jeder Außenwirkung (Etappe B1, 21.10.; ANALYSE_100.md Punkte 55, 62) ──────────────────────────────────
// Eiserne Regel 3 sichtbar gemacht: hinter jeden Knoten der Klassen außen · Geld · Löschen (Mail, WhatsApp, Einladung, Angebot stellen, Rechnung, Papierkorb)
// und hinter jeden Agenten-Schritt mit solchen Werkzeugen bzw. mit dem „tödlichen Dreieck“ (lib/prozesse/agent-schritt.ts `rechteProfil`) setzt diese
// Regel automatisch eine Freigabe in die Menschen-Bahn — mit Schloss (`schloss.fuer`), NICHT entfernbar:
//   · fehlt ein Schloss, wird es eingesetzt (feste Kennung aus der Kennung des Knotens — idempotent, beim Speichern UND beim Veröffentlichen);
//   · wurde es gelöscht, kommt es beim nächsten Speichern wieder; steht es woanders, rückt es direkt hinter seinen Knoten;
//   · braucht der Knoten keins mehr (gelöscht, andere Klasse), fällt das Schloss weg (und Zweige, die darauf zeigten, werden gelöst).
// Ändern darf man am Schloss nur, wohin „abgelehnt“ und „abgelaufen“ führen und wer freigibt — Form, Bahn, Marke, Lage im Strang setzt die Regel.
// Der Motor (Etappe C) legt am Knoten nur einen Vorschlag in den Stapel; die Wirkung geschieht erst mit „freigegeben“ am Schloss. Rein und client-sicher.

import type { ProzessDefinition, ProzessForm, ProzessKnoten, Rechteklasse, SchlossMarke } from './definition';
import { FREIGABE_BAUSTEIN, FORM_KLASSE, brauchtSchloss, katalogEintrag, klasseVonEintrag } from './baustein-katalog';
import { agentSchlossGrund, rechteProfil, type AgentKontext } from './agent-schritt';
import { schritteDer, phasen } from './fluss';

type K = ProzessKnoten<ProzessForm>;

/** Feste Kennung des Schlosses hinter einem Knoten (Form wie `fk-<uuid>`, aus der Kennung abgeleitet — so ist das Einsetzen idempotent). */
export function schlossKennung(knotenId: string): string {
  const h = (seed: number) => {
    let a = seed >>> 0;
    for (let i = 0; i < knotenId.length; i++) a = Math.imul(a ^ knotenId.charCodeAt(i), 16777619) >>> 0;
    return a.toString(16).padStart(8, '0');
  };
  const x = `${h(0x811c9dc5)}${h(0x01000193)}${h(0x2545f491)}${h(0x9e3779b9)}`;
  return `fk-${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20, 32)}`;
}

/** Was die Regel über einen Knoten wissen muss: seine Klasse (Katalog, Form) und bei Agenten das Rechte-Profil. `laufFremd` aus dem Auslöser. */
export interface SchlossKontext extends AgentKontext { laufFremd?: boolean }

/** Braucht dieser Knoten ein Schloss — und warum? (rein) */
export function schlossGrund(k: K, kx: SchlossKontext = {}): SchlossMarke['grund'] | null {
  if (k.form === 'freigabe' || k.form === 'ausloeser' || k.form === 'ende') return null;
  if (k.form === 'agent' && k.agent) return agentSchlossGrund(rechteProfil(k.agent, { laufFremd: kx.laufFremd }, kx));
  const e = katalogEintrag(k.katalog?.id);
  const klasse: Rechteklasse | null = e ? klasseVonEintrag(e) : FORM_KLASSE[k.form ?? 'schritt'];
  return brauchtSchloss(klasse) ? klasse : null;
}

const GRUND_TEXT: Readonly<Record<SchlossMarke['grund'], string>> = {
  aussen: 'wirkt nach außen', geld: 'ändert Finanzbestände', loeschen: 'löscht', dreieck: 'private Daten, fremder Text und ein Weg nach außen',
};
export const schlossText = (g: SchlossMarke['grund']): string => `Freigabe nötig — ${GRUND_TEXT[g]}.`;

/**
 * Die Schlösser setzen (rein, idempotent): liefert die Definition mit genau einem Schloss direkt hinter jedem Knoten, der eins braucht — und welche
 * Schlösser neu bzw. weggefallen sind. Ein Schloss steht als Geschwister direkt hinter seinem Knoten (Rang), die Ränge werden lückenlos.
 */
export function schlossSetzen<D extends Pick<ProzessDefinition, 'knoten'>>(d: D, kx: SchlossKontext = {}): { definition: D; gesetzt: string[]; entfernt: string[] } {
  const schritte = new Map<string, K>();
  for (const p of phasen(d)) for (const s of schritteDer(d, p.id)) schritte.set(s.id, s);
  const noetig = new Map<string, SchlossMarke['grund']>();
  for (const s of schritte.values()) { const g = schlossGrund(s, kx); if (g) noetig.set(s.id, g); }
  let kn: K[] = [...d.knoten];
  const entfernt: string[] = [];
  const gesetzt: string[] = [];
  // 1) Schlösser ohne (gültigen) Knoten bzw. doppelte fallen weg.
  const gesehen = new Set<string>();
  kn = kn.filter(k => {
    if (!k.schloss) return true;
    const ok = noetig.has(k.schloss.fuer) && !gesehen.has(k.schloss.fuer) && k.id === schlossKennung(k.schloss.fuer);
    if (!ok) { entfernt.push(k.id); return false; }
    gesehen.add(k.schloss.fuer);
    return true;
  });
  if (entfernt.length) {
    const weg = new Set(entfernt);
    kn = kn.map(k => {
      if (!k.zweige) return k;
      const z = { ...k.zweige };
      let anders = false;
      for (const a of ['ja', 'nein', 'fehler', 'abgelaufen'] as const) if (z[a] && weg.has(z[a]!)) { delete z[a]; anders = true; }
      if (!anders) return k;
      const n = { ...k };
      if (Object.keys(z).length) n.zweige = z; else delete n.zweige;
      return n;
    });
  }
  // 2) Je Knoten das Schloss (neu bzw. berichtigt) direkt dahinter. Nur berührte Eltern-Knoten bekommen danach lückenlose Ränge.
  const beruehrt = new Set<string>();
  const nachRang = (a: K, b: K) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const [fuer, grund] of noetig) {
    const x = kn.find(k => k.id === fuer)!;
    const id = schlossKennung(fuer);
    const alt = kn.find(k => k.id === id);
    const geschwister = kn.filter(k => k.elternId === x.elternId).sort(nachRang);
    const direktDahinter = !!alt && alt.elternId === x.elternId && geschwister.indexOf(alt) === geschwister.indexOf(x) + 1;
    const schloss: K = {
      ...(alt ?? {}),
      id, titel: alt?.titel ?? 'Freigabe', rang: direktDahinter ? alt!.rang : x.rang + 0.5, form: 'freigabe', bahn: 'mensch',
      schloss: { fuer, grund }, katalog: { id: FREIGABE_BAUSTEIN, ...(alt?.katalog?.werte ? { werte: alt.katalog.werte } : {}) },
      elternId: x.elternId,
    };
    // Ein Schloss trägt nur „abgelehnt“ und „abgelaufen“.
    if (schloss.zweige) {
      const z = { ...(schloss.zweige.nein ? { nein: schloss.zweige.nein } : {}), ...(schloss.zweige.abgelaufen ? { abgelaufen: schloss.zweige.abgelaufen } : {}) };
      if (Object.keys(z).length) schloss.zweige = z; else delete schloss.zweige;
    }
    if (alt && JSON.stringify(alt) === JSON.stringify(schloss)) continue;
    if (!alt) gesetzt.push(id);
    if (!direktDahinter) { beruehrt.add(x.elternId ?? ''); if (alt) beruehrt.add(alt.elternId ?? ''); }
    kn = [...kn.filter(k => k.id !== id), schloss];
  }
  for (const id of entfernt) { const k = d.knoten.find(x => x.id === id); if (k) beruehrt.add(k.elternId ?? ''); }
  // 3) Ränge lückenlos — nur in berührten Eltern-Knoten (das Schloss mit x.5 steht direkt hinter seinem Knoten).
  for (const e of beruehrt) {
    const g = kn.filter(k => (k.elternId ?? '') === e).sort(nachRang);
    const rang = new Map(g.map((k, i) => [k.id, i + 1]));
    kn = kn.map(k => ((k.elternId ?? '') === e && k.rang !== rang.get(k.id) ? { ...k, rang: rang.get(k.id)! } : k));
  }
  // Unverändert → dieselbe Definition (stabile Fingerabdrücke).
  const vorher = JSON.stringify([...d.knoten].sort((a, b) => (a.id < b.id ? -1 : 1)));
  const nachher = JSON.stringify([...kn].sort((a, b) => (a.id < b.id ? -1 : 1)));
  if (vorher === nachher) return { definition: d, gesetzt: [], entfernt: [] };
  return { definition: { ...d, knoten: kn }, gesetzt, entfernt };
}

/** Fehlt irgendwo ein Schloss bzw. steht eins falsch? (rein — die Prüfung beim Veröffentlichen; `schlossSetzen` hätte etwas geändert.) */
export const schlossFehlt = (d: Pick<ProzessDefinition, 'knoten'>, kx: SchlossKontext = {}): boolean => schlossSetzen(d, kx).definition !== d;
