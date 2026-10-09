// ─── Medien — KI-Vorschläge im Freigabe-Stapel (09.10., Paket 4c) — Server ──────────────────────────────────────────────────────
// Stapel-Art `medien` (lib/zoe/stapel-arten.ts → lib/medien/heads.ts `MEDIEN_STAPEL_ART`) kennt seit Paket 4c drei Werkzeuge:
//   medien_vorschlag  (Paket 5)  Auswahl, Zuschnitte, Texte eines Heads zu Medien eines Auftrags — lib/medien/heads.ts
//   ki_bild           (4c)       ein Agent hat ein Bild ERZEUGT (es liegt als Medium mit `ki.vorschlag = 'offen'` in der Ablage): Freigeben =
//                                übernehmen (ab dann freigebbar wie jedes Medium), Ablehnen = Papierkorb (30 Tage)
//   ki_auftrag        (4c)       etwas, das erst der KLICK erzeugt: jedes Video (Kevin 08.10.: „Video nur mit Klick und Kostenschätzung“) und
//                                Bilder aus einem Thread mit fremdem Text (Schutz vor eingeschleusten Aufträgen, die Geld kosten). Der Klick
//                                bestätigt genau die gezeigte Schätzung — wird es teurer, fragt das Anbieter-Tor erneut (409, bleibt offen).
// Nur die Person, für die der Agent vorbereitet hat, entscheidet; nie als Sammelfreigabe; der Dienstweg kommt hier nie an (Stapel-Route).

import { neueKennung } from '@/lib/kennung';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { ArtErgebnis, StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { SichtbarAngabe } from '@/lib/ki/kennzeichnung';
import type { KiMediumErgebnis } from '@/lib/ki/aufruf';
import { euroText } from '@/lib/ki/kosten';
import { text as textSauber } from './regeln';

export const KI_BILD_WERKZEUG = 'ki_bild';
export const KI_AUFTRAG_WERKZEUG = 'ki_auftrag';
export const KI_GRUPPE = 'medien';

/** Was ein KI-Auftrag trägt (erst der Klick führt ihn aus). Alles gesäubert, kein Text Dritter. */
export interface KiAuftragEingabe {
  art: 'bild' | 'video';
  prompt: string;
  modell?: string;
  aufloesung?: string;
  seitenverhaeltnis?: string;
  sekunden?: number;
  sichtbar?: SichtbarAngabe;
  album?: string;
  name?: string;
  /** Bild bearbeiten: Foto der Ablage (geprüft beim Klick erneut — `kiVorlageLaden`). */
  vorlage?: { mediumId: string; headId?: string };
  /** Wer vorgeschlagen hat (`agentSchluessel`) und für welchen Head. */
  agent: string;
  head: string;
  /** Die gezeigte Schätzung — der Klick bestätigt genau diesen Betrag. */
  schaetzungCent: number;
  schaetzungText: string;
}

const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): ArtErgebnis => ({ ok: false, status, fehler });

/** Ein erzeugtes Bild als Vorschlag in den Stapel (Bezug = das Medium). */
export async function kiBildVorschlagAblegen(o: { person: string; medium: KiMediumErgebnis; agent: string; head: string; anlass: string; begruendung?: string }): Promise<{ vorschlagId: string }> {
  const { lege } = await import('@/lib/zoe/stapel');
  const v = await lege({
    werkzeug: KI_BILD_WERKZEUG, gruppe: KI_GRUPPE, titel: `Bild übernehmen (KI-generiert, ${euroText(o.medium.kosten.euroCent, o.medium.kosten.geschaetzt)})`,
    nachher: `Neues Bild in „Fotos & Videos“${o.medium.zeichenNoetig ? ' · beim Veröffentlichen sichtbar „KI-generiert“' : ''}`,
    eingabe: { mediumId: o.medium.id, head: o.head, agent: o.agent, ...(o.begruendung ? { begruendung: o.begruendung.slice(0, 400) } : {}) },
    anlass: o.anlass, person: o.person, quelle: 'lauf', bezug: { art: 'medien', id: o.medium.id },
  });
  return { vorschlagId: v.id };
}

/** Einen Auftrag (Video bzw. Bild aus einem Thread mit fremdem Text) als Vorschlag mit Kostenschätzung — ausgeführt erst per Klick. */
export async function kiAuftragVorschlagAblegen(o: { person: string; eingabe: KiAuftragEingabe; anlass: string }): Promise<{ vorschlagId: string }> {
  const { lege } = await import('@/lib/zoe/stapel');
  const e = o.eingabe;
  const was = e.art === 'video' ? `Video erzeugen (${e.sekunden ?? '?'} s)` : e.vorlage ? 'Foto mit KI bearbeiten' : 'Bild erzeugen';
  const v = await lege({
    werkzeug: KI_AUFTRAG_WERKZEUG, gruppe: KI_GRUPPE, titel: `${was} — ${e.schaetzungText}`,
    nachher: `Erst dein Klick startet den Auftrag (Kosten ${e.schaetzungText}); das Ergebnis landet in „Fotos & Videos“.`,
    eingabe: e as unknown as Record<string, unknown>, anlass: o.anlass, person: o.person, quelle: 'lauf', bezug: { art: 'medien', id: neueKennung('ka') },
  });
  return { vorschlagId: v.id };
}

/** Prüfung beim Beanspruchen: Art, Werkzeug, Person. */
const pruefeVon = (person: string, werkzeug: string) => (v: Vorschlag) => {
  if (v.bezug?.art !== 'medien' || v.werkzeug !== werkzeug) return { status: 404 as const, fehler: 'Vorschlag nicht gefunden.' };
  if (v.person && v.person !== person) return { status: 403 as const, fehler: 'Nur die Person, für die der Agent ihn vorbereitet hat, entscheidet.' };
  return null;
};

async function bildUebernehmen(vIn: Vorschlag, person: string): Promise<ArtErgebnis> {
  const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
  const a = await beanspruche(vIn.id, person, pruefeVon(person, KI_BILD_WERKZEUG));
  if (!a.ok) return nein(a.status, a.fehler);
  try {
    const { kiVorschlagEntscheiden } = await import('./ki-ablage');
    const r = await kiVorschlagEntscheiden(person, String(a.v.bezug!.id), 'uebernommen');
    if (!r.ok) { await loslassen(a.v.id); return nein(r.status === 404 || r.status === 403 ? r.status : 409, r.fehler); }
    const text = 'Bild übernommen — es liegt in „Fotos & Videos“ und ist jetzt freigebbar wie jedes Medium.';
    await entscheide(a.v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
    return { ok: true, text };
  } catch (e) { await loslassen(a.v.id); throw e; }
}

async function auftragAusfuehren(vIn: Vorschlag, person: string, opt: { eingabe?: Record<string, unknown> | null }): Promise<ArtErgebnis> {
  const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
  const a = await beanspruche(vIn.id, person, pruefeVon(person, KI_AUFTRAG_WERKZEUG));
  if (!a.ok) return nein(a.status, a.fehler);
  const e = a.v.eingabe as unknown as KiAuftragEingabe;
  // „Ändern & freigeben“: nur Beschreibung und Name — nie Schätzung, Modell, Länge oder Vorlage.
  const prompt = opt.eingabe && typeof opt.eingabe.prompt === 'string' ? textSauber(opt.eingabe.prompt, 4000) : e.prompt;
  const name = opt.eingabe && typeof opt.eingabe.name === 'string' ? textSauber(opt.eingabe.name, 120) : e.name;
  if (!prompt) { await loslassen(a.v.id); return nein(prompt === null ? 413 : 400, prompt === null ? 'Beschreibung zu lang (höchstens 4.000 Zeichen).' : 'Beschreibung fehlt.'); }
  try {
    const { kiBild, kiVideoStarten } = await import('@/lib/ki/aufruf');
    // Der Klick ist ein Aufruf der Person selbst (kein Hintergrund-Lauf); was hinausgeht, bestimmt allein der Auftrag.
    const ki = { lauf: 'aufruf' as const, person, kategorien: ['allgemein' as const] };
    const r = e.art === 'video'
      ? await kiVideoStarten({ ki, prompt, modell: e.modell as 'gemini-omni-1.1-flash' | undefined, sekunden: Number(e.sekunden), aufloesung: e.aufloesung as '1080p' | undefined, seitenverhaeltnis: e.seitenverhaeltnis as '16:9' | undefined, bestaetigtCent: e.schaetzungCent, ...(e.sichtbar ? { sichtbar: e.sichtbar } : {}), ...(e.album ? { album: e.album } : {}), ...(name ? { name } : {}), agent: e.agent })
      : await kiBild({ ki, prompt, modell: e.modell as 'gemini-nano-banana-2.1' | undefined, aufloesung: e.aufloesung as '1k' | undefined, seitenverhaeltnis: e.seitenverhaeltnis as '1:1' | undefined, ...(e.sichtbar ? { sichtbar: e.sichtbar } : {}), ...(e.album ? { album: e.album } : {}), ...(name ? { name } : {}), ...(e.vorlage ? { vorlage: e.vorlage } : {}), agent: e.agent, agentVorschlag: false });
    if (!r.ok) {
      await loslassen(a.v.id);
      const { kiSperrText, kiGesperrt } = await import('@/lib/anthropic');
      const status = r.status === 403 || r.status === 404 || r.status === 413 || r.status === 400 ? r.status : 409;
      return nein(status as 400 | 403 | 404 | 409 | 413, kiGesperrt({ error: r.error }) ? kiSperrText({ error: r.error }) : r.error);
    }
    const text = e.art === 'video'
      ? 'Video gestartet — es kommt in einigen Minuten in „Fotos & Videos“ (die Glocke meldet sich).'
      : 'Bild erzeugt — es liegt in „Fotos & Videos“.';
    await entscheide(a.v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
    return { ok: true, text };
  } catch (x) { await loslassen(a.v.id); throw x; }
}

/** Freigabe der KI-Werkzeuge der Stapel-Art `medien` (MEDIEN_STAPEL_ART leitet hierher). Nie als Sammelfreigabe — jeder kostet. */
export const KI_STAPEL: StapelArtFreigabe = {
  freigeben: async (v, person, opt) => {
    if (opt.sammel) return nein(409, 'KI-Medien kosten Geld — nur einzeln freigeben.');
    const { betrachterFuer } = await import('./server');
    if (!(await betrachterFuer(person))) return nein(403, 'Nur im Haushalt des Inhabers.');
    if (v.werkzeug === KI_BILD_WERKZEUG) return bildUebernehmen(v, person);
    if (v.werkzeug === KI_AUFTRAG_WERKZEUG) return auftragAusfuehren(v, person, opt);
    return nein(404, 'Vorschlag nicht gefunden.');
  },
  /** Abgelehnt: ein erzeugtes Bild geht in den Papierkorb (30 Tage wiederherstellbar); ein Auftrag wurde nie ausgeführt — nichts zu tun. */
  nachAblehnen: async (v, person) => {
    if (v.werkzeug !== KI_BILD_WERKZEUG || v.bezug?.art !== 'medien') return null;
    const { kiVorschlagEntscheiden } = await import('./ki-ablage');
    return kiVorschlagEntscheiden(person, v.bezug.id, 'verworfen');
  },
};
