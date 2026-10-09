// ─── KI-Anbieter: Einrichtung aus der Umgebung (09.10.2026, Paket 6a) — Server ──────────────────────────────────────────────
// Schlüssel NIE im Code: alles kommt aus der Umgebung des Servers, gesetzt nur über deploy/ki-anbieter-verbinden.sh (fragt verdeckt).
// Diese Datei liest die Umgebung und gibt nach außen nur ja/nein, Regionen und Stufen heraus — nie Werte (`konfigUebersicht`).
//
//   MAKE_OS_KI_ANBIETER_TOR   aus (Vorgabe) | an | streng — `aus` = askText wie bisher (Anthropic direkt); `an` = das Tor wählt je Aufruf
//                              den Zugang (Mindeststufen, Register); `streng` = zusätzlich AVV-Pflicht auch für Anthropic direkt
//   ANTHROPIC_API_KEY          Anthropic direkt (wie bisher)
//   GOOGLE_VERTEX_PROJEKT      Projekt-ID in Google Cloud
//   GOOGLE_VERTEX_DIENSTKONTO  Schlüssel des Dienstkontos (JSON, Base64) — nur Rolle „Vertex AI User“
//   GOOGLE_VERTEX_CLAUDE       an = Claude über Vertex EU ist im Model Garden freigeschaltet
//   GOOGLE_VERTEX_CLAUDE_REGION  eu (Vorgabe) oder eine Region europe-… — nie außerhalb der EU (sonst gilt der Zugang als nicht eingerichtet)
//   GOOGLE_VERTEX_ZDR          bestaetigt = Zero Data Retention bei Google beantragt und bestätigt (sonst Stufe „eu“, nicht „eu-zdr“)
//   GOOGLE_VERTEX_MEDIEN       an = Gemini-Bilder/-Video/-Tiefenbericht über Vertex erlaubt
//   MISTRAL_API_KEY            Mistral (EU-Endpunkt)
//   MISTRAL_ZDR                bestaetigt = ZDR und Training-Opt-out bei Mistral gesetzt
//   MISTRAL_TRANSKRIPTION_MODELL  optional, Vorgabe voxtral-mini-latest

import { KI_ANBIETER, wirksameStufe, type AnbieterId, type DatenschutzStufe } from './anbieter';
import { pruefUrl } from './pruefendpunkt';

export type TorModus = 'aus' | 'an' | 'streng';
type Env = Record<string, string | undefined>;

export function torModus(env: Env = process.env): TorModus {
  const v = (env.MAKE_OS_KI_ANBIETER_TOR ?? '').trim().toLowerCase();
  return v === 'an' || v === 'streng' ? v : 'aus';
}

const PROJEKT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
/** EU-Regionen für Claude auf Vertex: Multi-Region „eu“ oder eine Region „europe-…“. */
export const istEuRegion = (r: string): boolean => r === 'eu' || /^europe-[a-z]+[0-9]{1,2}$/.test(r);

export interface Dienstkonto { client_email: string; private_key: string; token_uri: string; project_id?: string }

/** Den Dienstkonto-Schlüssel lesen (Base64 eines JSON) — null, wenn er fehlt oder nicht passt. Wirft nie, loggt nie Werte. */
export function dienstkontoAus(env: Env = process.env): Dienstkonto | null {
  const roh = (env.GOOGLE_VERTEX_DIENSTKONTO ?? '').trim();
  if (!roh || roh.length > 20_000) return null;
  try {
    const j = JSON.parse(Buffer.from(roh, 'base64').toString('utf8')) as Record<string, unknown>;
    if (j.type !== 'service_account') return null;
    const mail = typeof j.client_email === 'string' ? j.client_email : '';
    const key = typeof j.private_key === 'string' ? j.private_key : '';
    const uri = typeof j.token_uri === 'string' ? j.token_uri : 'https://oauth2.googleapis.com/token';
    if (!/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(mail) || !key.includes('PRIVATE KEY')) return null;
    if (uri !== 'https://oauth2.googleapis.com/token') return null; // Token nur bei Google holen — nie an eine Adresse aus der Datei
    return { client_email: mail, private_key: key, token_uri: uri, ...(typeof j.project_id === 'string' ? { project_id: j.project_id } : {}) };
  } catch { return null; }
}

export interface VertexKonfig { projekt: string; claudeRegion: string; konto: Dienstkonto }
export function vertexKonfig(env: Env = process.env): VertexKonfig | null {
  const projekt = (env.GOOGLE_VERTEX_PROJEKT ?? '').trim();
  const konto = dienstkontoAus(env);
  if (!PROJEKT.test(projekt) || !konto) return null;
  const claudeRegion = (env.GOOGLE_VERTEX_CLAUDE_REGION ?? 'eu').trim().toLowerCase() || 'eu';
  return { projekt, claudeRegion, konto };
}

const an = (v: string | undefined) => (v ?? '').trim().toLowerCase() === 'an';
const bestaetigt = (v: string | undefined) => (v ?? '').trim().toLowerCase() === 'bestaetigt';

export function anbieterEingerichtet(id: AnbieterId, env: Env = process.env): boolean {
  switch (id) {
    // Prüfendpunkt (lib/ki/pruefendpunkt.ts, nur loopback + Demo/Entwicklung): das nachgebaute Modell steht für Anthropic direkt.
    case 'anthropic': return !!(env.ANTHROPIC_API_KEY ?? '').trim() || pruefUrl(env) !== null;
    case 'anthropic-vertex-eu': { const v = vertexKonfig(env); return !!v && an(env.GOOGLE_VERTEX_CLAUDE) && istEuRegion(v.claudeRegion); }
    case 'google-vertex': return !!vertexKonfig(env) && an(env.GOOGLE_VERTEX_MEDIEN);
    case 'mistral': return /^[A-Za-z0-9]{16,128}$/.test((env.MISTRAL_API_KEY ?? '').trim());
  }
}

export function zdrBestaetigt(id: AnbieterId, env: Env = process.env): boolean {
  const a = KI_ANBIETER.find(x => x.id === id);
  return !!a?.zdrUmgebung && bestaetigt(env[a.zdrUmgebung]);
}

export interface AnbieterUebersicht { id: AnbieterId; name: string; eingerichtet: boolean; stufe: DatenschutzStufe; region: string; zdr: boolean }
/** Für Oberfläche, HOI und Auskunft: nur ja/nein, Stufe und Region — nie Schlüssel, Projekt oder Konto. */
export function konfigUebersicht(env: Env = process.env): { tor: TorModus; anbieter: AnbieterUebersicht[] } {
  return {
    tor: torModus(env),
    anbieter: KI_ANBIETER.map(a => {
      const zdr = zdrBestaetigt(a.id, env);
      return { id: a.id, name: a.name, eingerichtet: anbieterEingerichtet(a.id, env), stufe: wirksameStufe(a, { zdr }), region: a.region, zdr };
    }),
  };
}

/** Die eingerichteten Zugänge (für Verzeichnis und Auskunft). */
export const kiAnbieterEingerichtet = (env: Env = process.env): AnbieterId[] => KI_ANBIETER.filter(a => anbieterEingerichtet(a.id, env)).map(a => a.id);

export const transkriptionsModell = (env: Env = process.env): string => {
  const m = (env.MISTRAL_TRANSKRIPTION_MODELL ?? '').trim();
  return /^[a-z0-9][a-z0-9.-]{2,60}$/.test(m) ? m : 'voxtral-mini-latest';
};
