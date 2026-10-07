// ─── WhatsApp — der Spiegel der Business-Nummer und der Zustand der Verbindung (Server, 07.10.2026) ─────────────────────
// Zwei Bestände (verschlüsselte Hülle wie jeder Bestand, lib/store/local-db.ts), beide je INSTANZ (die Nummer gehört der Instanz):
//   `whatsapp-spiegel`  Nachrichten (WAMID → Nachricht) und Gesprächspartner (wa_id → Profilname, letzte eingehende Nachricht,
//                       gelesen bis). Personendaten Dritter → Speicher-Register (Art. 15/17, Frist „WhatsApp-Spiegel“).
//                       Wichtig: anders als bei Mail ist der Spiegel die EINZIGE dauerhafte Kopie — die Cloud API hält Nachrichten
//                       höchstens 30 Tage (Faktendatei A4). Deshalb wird hier nie nach Anzahl gekürzt, nur nach der Frist.
//   `whatsapp-zustand`  Webhook zuletzt/Zähler, Telefonnummer-Angaben (Cache), Vorlagen-Liste (Cache), Zustand des Schlüssels —
//                       keine Personendaten.
// Der Webhook schreibt über `webhookAnwenden` (rein, idempotent über die WAMID); Senden über `ausgehendMerken`.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { zeilenfrei } from '@/lib/gmail/mime';
import { metaFehler } from './fehler';
import { statusWeiter, WA_GRENZEN, WA_ID, WA_NUMMER, type Vorlage, type WaArt, type WaKontakt, type WaMedium, type WaNachricht, type WaStatus } from './typen';

export const WA_SPIEGEL = 'whatsapp-spiegel';
export const WA_ZUSTAND = 'whatsapp-zustand';

export interface WaSpiegel { v: 1; nachrichten: Record<string, WaNachricht>; kontakte: Record<string, WaKontakt> }

export interface WaZustand {
  v: 1;
  webhook?: { zuletzt?: string; anzahl: number; abgelehnt: number; zuletztAbgelehnt?: string };
  telefon?: { at: string; nummer?: string; anzeigename?: string; qualitaet?: string; durchsatz?: string };
  vorlagen?: { at: string; liste: Vorlage[] };
  /** Zugriffsschlüssel: zuletzt abgelehnt (→ „Verbindung erneuern“) und ob die Glocke schon geläutet hat. */
  token?: { fehlerAt?: string; gemeldet?: boolean; okAt?: string };
  /** Registrierung der Nummer aus MAKE OS (nur Zeitpunkt + gewählter Speicherort — nie die PIN). */
  registriert?: { am: string; speicherort: 'DE' | 'ohne' };
  /** Letzter Fehler beim Prüfen der Verbindung (deutscher Satz, kein Rohtext von Meta). */
  fehler?: { at: string; text: string };
}

export const leererSpiegel = (): WaSpiegel => ({ v: 1, nachrichten: {}, kontakte: {} });

export async function ladeWaSpiegel(): Promise<WaSpiegel> {
  const s = await loadJson<WaSpiegel>(WA_SPIEGEL);
  return s && s.v === 1 && s.nachrichten && s.kontakte ? s : leererSpiegel();
}

export async function aendereWaSpiegel(mutate: (s: WaSpiegel) => WaSpiegel | null): Promise<WaSpiegel> {
  let ergebnis = leererSpiegel();
  await updateJson<WaSpiegel>(WA_SPIEGEL, cur => {
    const s = cur && cur.v === 1 && cur.nachrichten ? cur : leererSpiegel();
    const neu = mutate(s);
    ergebnis = neu ?? s;
    return neu ?? s;
  });
  return ergebnis;
}

export async function ladeWaZustand(): Promise<WaZustand> {
  const z = await loadJson<WaZustand>(WA_ZUSTAND);
  return z && z.v === 1 ? z : { v: 1 };
}

export async function aendereWaZustand(mutate: (z: WaZustand) => WaZustand): Promise<WaZustand> {
  let ergebnis: WaZustand = { v: 1 };
  await updateJson<WaZustand>(WA_ZUSTAND, cur => { ergebnis = mutate(cur && cur.v === 1 ? cur : { v: 1 }); return ergebnis; });
  return ergebnis;
}

// ── Webhook → Spiegel (rein) ────────────────────────────────────────────────

interface RohMedium { id?: unknown; mime_type?: unknown; sha256?: unknown; caption?: unknown; filename?: unknown; voice?: unknown; file_size?: unknown }
interface RohNachricht {
  from?: unknown; id?: unknown; timestamp?: unknown; type?: unknown; context?: { id?: unknown };
  text?: { body?: unknown }; image?: RohMedium; document?: RohMedium; audio?: RohMedium; video?: RohMedium; sticker?: RohMedium;
  location?: { latitude?: unknown; longitude?: unknown; name?: unknown; address?: unknown };
  contacts?: { name?: { formatted_name?: unknown; first_name?: unknown; last_name?: unknown }; phones?: { phone?: unknown; wa_id?: unknown }[] }[];
  button?: { text?: unknown }; interactive?: { button_reply?: { title?: unknown }; list_reply?: { title?: unknown } }; reaction?: { emoji?: unknown };
}
interface RohStatus { id?: unknown; status?: unknown; timestamp?: unknown; recipient_id?: unknown; errors?: { code?: unknown }[] }
export interface WebhookWert {
  metadata?: { phone_number_id?: unknown; display_phone_number?: unknown };
  contacts?: { profile?: { name?: unknown }; wa_id?: unknown }[];
  messages?: RohNachricht[];
  statuses?: RohStatus[];
}
export interface WebhookKoerper { object?: unknown; entry?: { id?: unknown; changes?: { field?: unknown; value?: WebhookWert }[] }[] }

const txt = (v: unknown, max: number): string => {
  const t = typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') : '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const zeile = (v: unknown, max: number): string => zeilenfrei(txt(v, max)).trim();
const amAus = (ts: unknown, jetzt: string): string => {
  const n = Number(ts);
  return Number.isFinite(n) && n > 1_000_000_000 && n < 10_000_000_000 ? new Date(n * 1000).toISOString() : jetzt;
};

const MIME = /^[a-z0-9.+-]{1,60}\/[a-z0-9.+-]{1,80}(;\s?[a-z0-9=.+ -]{1,60})?$/i;
function medium(r: RohMedium | undefined): WaMedium | undefined {
  if (!r || typeof r.id !== 'string' || !/^[0-9]{3,40}$/.test(r.id)) return undefined;
  const mime = typeof r.mime_type === 'string' && MIME.test(r.mime_type) ? r.mime_type.toLowerCase() : 'application/octet-stream';
  const name = r.filename !== undefined ? zeile(r.filename, 200).replace(/[\\/]/g, '_') : '';
  const sha = typeof r.sha256 === 'string' && /^[A-Za-z0-9+/=]{20,100}$/.test(r.sha256) ? r.sha256 : undefined;
  const groesse = Number(r.file_size);
  return { mediaId: r.id, mime, ...(name ? { name } : {}), ...(sha ? { sha256: sha } : {}), ...(Number.isFinite(groesse) && groesse > 0 ? { groesse } : {}), zustand: 'offen' };
}

/** Eine eingehende Nachricht von Meta → unsere Form (rein). null bei unbrauchbarer Form. */
export function nachrichtAus(r: RohNachricht, jetzt: string): WaNachricht | null {
  if (typeof r.from !== 'string' || !WA_NUMMER.test(r.from) || typeof r.id !== 'string' || !WA_ID.test(r.id)) return null;
  const typ = typeof r.type === 'string' ? r.type : '';
  const basis = { id: r.id, nummer: r.from, richtung: 'ein' as const, am: amAus(r.timestamp, jetzt), ...(typeof r.context?.id === 'string' && WA_ID.test(r.context.id) ? { antwortAuf: r.context.id } : {}) };
  const mit = (art: WaArt, text: string, m?: WaMedium): WaNachricht => ({ ...basis, art, text: txt(text, WA_GRENZEN.text), ...(m ? { medium: m } : {}) });
  switch (typ) {
    case 'text': return mit('text', txt(r.text?.body, WA_GRENZEN.text));
    case 'image': return mit('bild', txt(r.image?.caption, WA_GRENZEN.text), medium(r.image));
    case 'document': return mit('dokument', txt(r.document?.caption, WA_GRENZEN.text), medium(r.document));
    case 'audio': return mit(r.audio?.voice === true ? 'sprachnachricht' : 'audio', '', medium(r.audio));
    case 'video': return mit('video', txt(r.video?.caption, WA_GRENZEN.text), medium(r.video));
    case 'sticker': return mit('sticker', '', medium(r.sticker));
    case 'location': {
      const lat = Number(r.location?.latitude), lng = Number(r.location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return mit('ort', 'Standort (ohne gültige Angabe)');
      const name = zeile(r.location?.name, 200), adresse = zeile(r.location?.address, 300);
      return { ...mit('ort', [name, adresse].filter(Boolean).join(' · ') || 'Standort'), ort: { lat, lng, ...(name ? { name } : {}), ...(adresse ? { adresse } : {}) } };
    }
    case 'contacts': {
      const kontakte = (Array.isArray(r.contacts) ? r.contacts : []).slice(0, 10).map(c => ({
        name: zeile(c?.name?.formatted_name, 120) || [zeile(c?.name?.first_name, 60), zeile(c?.name?.last_name, 60)].filter(Boolean).join(' ') || 'Kontakt',
        telefone: (Array.isArray(c?.phones) ? c.phones : []).slice(0, 5).map(p => zeile(p?.phone, 40)).filter(Boolean),
      }));
      return { ...mit('kontakte', kontakte.map(k => k.name).join(', ') || 'Kontakt'), kontakte };
    }
    case 'button': return mit('text', txt(r.button?.text, WA_GRENZEN.text)); // Knopf-Antwort auf eine Vorlage (Annahme: Form laut älterer Meta-Doku)
    case 'interactive': return mit('text', txt(r.interactive?.button_reply?.title ?? r.interactive?.list_reply?.title, WA_GRENZEN.text));
    case 'reaction': return mit('sonstiges', `Reaktion ${zeile(r.reaction?.emoji, 8)}`.trim());
    default: return mit('sonstiges', 'Nachricht, die WhatsApp über die Schnittstelle nicht liefert (z. B. Umfrage) — bitte in der WhatsApp-Business-App ansehen, falls dort vorhanden.');
  }
}

const STATUS: Record<string, WaStatus> = { sent: 'gesendet', delivered: 'zugestellt', read: 'gelesen', played: 'gelesen', failed: 'fehlgeschlagen' };

export interface WebhookErgebnis {
  spiegel: WaSpiegel;
  /** Neue Nachrichten (schon bekannte WAMIDs zählen nicht — Meta wiederholt bis zu 36 h). */
  neu: number;
  status: number;
  /** Meldungen für eine andere Nummer (gleiches Konto) oder in fremder Form — bestätigt, nicht verarbeitet. */
  uebersprungen: number;
  /** WAMIDs mit Medien, die nachzuladen sind. */
  medien: string[];
  /** Neue eingehende Nachrichten je wa_id (für die Glocke/Inbox). */
  von: string[];
}

/**
 * Einen geprüften Webhook-Körper auf den Spiegel anwenden (rein, idempotent): neue Nachrichten über die WAMID, Profilnamen,
 * „zuletzt eingehend“ (24-h-Fenster), Zustellstände (nur vorwärts). Nur Meldungen für UNSERE Telefonnummer-ID.
 */
export function webhookAnwenden(s: WaSpiegel, koerper: WebhookKoerper, telefonnummerId: string, jetzt: string): WebhookErgebnis {
  const nachrichten = { ...s.nachrichten };
  const kontakte = { ...s.kontakte };
  let neu = 0, status = 0, uebersprungen = 0, gesehen = 0;
  const medien: string[] = [];
  const von = new Set<string>();
  if (koerper?.object !== 'whatsapp_business_account' || !Array.isArray(koerper.entry)) return { spiegel: s, neu, status, uebersprungen: 1, medien, von: [] };
  for (const e of koerper.entry) {
    for (const c of Array.isArray(e?.changes) ? e.changes : []) {
      const w = c?.value;
      if (c?.field !== 'messages' || !w || String(w.metadata?.phone_number_id ?? '') !== telefonnummerId) { uebersprungen++; continue; }
      for (const p of Array.isArray(w.contacts) ? w.contacts : []) {
        const n = typeof p?.wa_id === 'string' && WA_NUMMER.test(p.wa_id) ? p.wa_id : null;
        const name = zeile(p?.profile?.name, 120);
        if (n && name && kontakte[n]?.name !== name) kontakte[n] = { ...(kontakte[n] ?? { nummer: n }), name };
      }
      for (const r of Array.isArray(w.messages) ? w.messages : []) {
        if (++gesehen > WA_GRENZEN.jeWebhook) { uebersprungen++; continue; }
        const m = nachrichtAus(r, jetzt);
        if (!m) { uebersprungen++; continue; }
        if (nachrichten[m.id]) continue;
        nachrichten[m.id] = m;
        neu++;
        von.add(m.nummer);
        if (m.medium) medien.push(m.id);
        const k = kontakte[m.nummer] ?? { nummer: m.nummer };
        kontakte[m.nummer] = { ...k, ...(!k.zuletztEingehend || m.am > k.zuletztEingehend ? { zuletztEingehend: m.am } : {}) };
      }
      for (const r of Array.isArray(w.statuses) ? w.statuses : []) {
        if (++gesehen > WA_GRENZEN.jeWebhook) { uebersprungen++; continue; }
        const id = typeof r?.id === 'string' ? r.id : '';
        const st = STATUS[String(r?.status ?? '')];
        const alt = nachrichten[id];
        if (!alt || alt.richtung !== 'aus' || !st) { uebersprungen++; continue; }
        if (!statusWeiter(alt.status, st)) continue;
        const code = st === 'fehlgeschlagen' ? Number(r.errors?.[0]?.code) : NaN;
        nachrichten[id] = { ...alt, status: st, statusAm: amAus(r.timestamp, jetzt), ...(st === 'fehlgeschlagen' ? { fehler: { code: Number.isFinite(code) ? code : 0, text: metaFehler(Number.isFinite(code) ? code : undefined).text } } : {}) };
        status++;
      }
    }
  }
  const geaendert = neu || status || Object.keys(kontakte).length !== Object.keys(s.kontakte).length || Object.entries(kontakte).some(([k, v]) => s.kontakte[k] !== v);
  return { spiegel: geaendert ? { v: 1, nachrichten, kontakte } : s, neu, status, uebersprungen, medien, von: [...von] };
}

/** Eine gesendete Nachricht merken (rein). */
export function ausgehendMerken(s: WaSpiegel, m: WaNachricht): WaSpiegel {
  if (s.nachrichten[m.id]) return s;
  const k = s.kontakte[m.nummer] ?? { nummer: m.nummer };
  return { v: 1, nachrichten: { ...s.nachrichten, [m.id]: m }, kontakte: { ...s.kontakte, [m.nummer]: k } };
}

/** Gelesen/ungelesen für ein Gespräch (rein). Gilt für alle, die das geteilte Business-Postfach sehen. */
export function gelesenSetzen(s: WaSpiegel, nummer: string, gelesen: boolean, jetzt: string): WaSpiegel {
  const k = s.kontakte[nummer];
  if (!k) return s;
  if (gelesen) return { ...s, kontakte: { ...s.kontakte, [nummer]: { ...k, gelesenBis: jetzt } } };
  const { gelesenBis: _g, ...rest } = k;
  return { ...s, kontakte: { ...s.kontakte, [nummer]: rest } };
}

/**
 * Aufbewahren (rein): Nachrichten vor `grenzeTag` fallen weg, Gesprächspartner ohne Nachrichten ebenso. Liefert die Dateien der
 * entfernten Medien (der Aufrufer löscht sie).
 */
export function waAufbewahren(s: WaSpiegel, grenzeTag: string): { spiegel: WaSpiegel; weg: number; dateien: string[] } {
  const nachrichten: Record<string, WaNachricht> = {};
  const dateien: string[] = [];
  let weg = 0;
  for (const [id, m] of Object.entries(s.nachrichten)) {
    if (m.am.slice(0, 10) < grenzeTag) { weg++; if (m.medium?.datei) dateien.push(m.medium.datei); continue; }
    nachrichten[id] = m;
  }
  if (!weg) return { spiegel: s, weg: 0, dateien };
  const da = new Set(Object.values(nachrichten).map(m => m.nummer));
  const kontakte = Object.fromEntries(Object.entries(s.kontakte).filter(([n]) => da.has(n)));
  return { spiegel: { v: 1, nachrichten, kontakte }, weg, dateien };
}
