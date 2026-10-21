// ─── Prozesse — Tor der Werkstatt-Routen (Server, Etappe B1, 21.10.) ─────────────────────────────────────────────────────────────────────────────────
// Seit B2 (21.10.) dieselbe Funktion wie das Tor der Landkarte — EINE Stelle: lib/prozesse/zugang.ts `prozesseZugang`. Der Name `werkstattZugang` bleibt
// (Routen und Routen-Register nennen ihn), die Regeln stehen dort.

export { prozesseZugang as werkstattZugang, NUR_BUSINESS_PROZESSE, type ProzesseTor as WerkstattTor } from './zugang';
