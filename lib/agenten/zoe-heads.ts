// ─── ZOE steuert die Heads: `an_head` und `head_fragen` (09.10., Paket 4a; AGENTEN_KONZEPT.md C3 „ZOE steuert Heads“) ───────────
// Entscheidung (Fragerunde Teil 1, Nr. 1/11): „Heads sind links sozusagen die Ordner — da kann ich mit ZOE sprechen, und sie kann die Heads mit
// Threads erreichen.“ · „ZOE beauftragt nur Heads“ · Tiefe 2 fest (ZOE → Head → Mitarbeiter).
//
//   an_head      legt beim Head einen Thread an (Auftrag von ZOE, Eltern = der ZOE-Thread), Systemnachricht „An … gesendet“ im ZOE-Thread,
//                Lauf über die Warteschlange (`faden`, kein zweiter Hintergrund-Mechanismus). Der Bericht kommt als Verweis in den
//                ZOE-Thread und als Glocke (lib/agenten/delegation.ts `ergebnisSchreiben`). Register: frei — es reiht nur ein; jede
//                Wirkung des Heads bleibt ein Vorschlag im Stapel.
//   head_fragen  synchroner Head-Lauf NUR mit dem Kontext dieses Heads, nur lesende Werkzeuge (keine Delegation, keine Vorschläge);
//                die Antwort geht als `fremd('agent', …)` an ZOE zurück (lib/zoe/fremd.ts) — nie Zustimmung eines Menschen.
//
// Sicht: Heads werden IMMER für die AUSLÖSENDE Person aufgelöst (lib/agenten/sicht.ts) — ein Konto „nur Business“ erreicht über ZOE
// keinen Privat-Head, und ZOE einer Person nie die Privat-Heads einer anderen. Ohne Person: nichts (Regel 5).

import { neueKennung } from '@/lib/kennung';
import type { WerkzeugKontext } from '@/lib/zoe/werkzeuge';
import { GRENZEN, agentSchluessel, type AgentRef, type HeadDef, type KiKategorie } from './typen';
import { headDef, KATALOG } from './katalog';
import { headSichtbar, kategorienFuer, headsFuer, type KontoSicht } from './sicht';
import { anhaengen, auftragText, gedaechtnisFuer, neuerFaden, offeneLaeufe, textPruefen, type AuftragKarte, type FadenKern, type FadenKopfKern, type NachrichtKern } from './faeden';
import { ablageAendernFuer, bestandLesen, sichtLaden } from './faeden-server';

const KEINE_PERSON = 'Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person (kein Systemlauf).';
const UNBEKANNT = 'Nicht ausgeführt: Diesen Head gibt es für diese Person nicht (oder er ist nicht sichtbar).';
const iso = () => new Date().toISOString();

/** Einen Head aus der Eingabe des Modells — Kennung, Kurzname oder Name; nur, wenn die Person ihn sieht. */
export function headAusEingabe(roh: unknown, sicht: KontoSicht): HeadDef | null {
  const t = String(roh ?? '').trim().toLowerCase();
  if (!t) return null;
  const h = KATALOG.find(x => x.id === t || x.kurz.toLowerCase() === t || x.name.toLowerCase() === t) ?? null;
  return h && headSichtbar(sicht, h.id) ? h : null;
}

/** Die Heads, die ZOE dieser Person anbietet (Name, Auftrag) — für Prompt und Werkzeug-Schema. */
export async function zoeHeadsFuer(person: string): Promise<{ sicht: KontoSicht; heads: HeadDef[] }> {
  const sicht = await sichtLaden(person);
  return { sicht, heads: headsFuer(sicht) };
}

/** Der Abschnitt im ZOE-Prompt: welche Heads es für diese Person gibt — statt der alten Agenten-Liste (`agentRoster`). */
export function headsImPrompt(heads: readonly HeadDef[]): string {
  if (!heads.length) return '';
  return heads.map(h => `- ${h.id} · ${h.name} (${h.bereich === 'business' ? 'Business' : 'Privat'}) — ${h.auftrag}`).join('\n');
}

/** Die KI-Kategorien, die eine Head-Antwort in ZOEs nächsten Prompt trägt — dieselben, mit denen der Head lief (Schalter, Einwilligung). */
export async function headFrageKategorien(person: string, headId: string): Promise<KiKategorie[]> {
  const sicht = await sichtLaden(person);
  const h = headDef(headId);
  if (!h || !headSichtbar(sicht, h.id)) return [];
  const [{ kiSchalterFuer }, { aktiveKategorien }] = await Promise.all([import('@/lib/datenschutz/ki-einstellungen'), import('./werkzeuge')]);
  return aktiveKategorien(kategorienFuer(h, sicht), await kiSchalterFuer(person), sicht.gesundheit.verarbeiten && sicht.gesundheit.ki);
}

/** Der Auftrag von ZOE als Karte (Ziel, Format, Grenzen, Quellen — C3): ZOE schreibt das Ziel, der Rest ist fest. */
export const auftragVonZoe = (ziel: string): AuftragKarte => ({
  ziel,
  format: 'Kurzer Bericht an ZOE: Ergebnis zuerst, Belege als Verweise, offene Punkte und was im Freigabe-Stapel liegt.',
  grenzen: 'Nichts nach außen; alles Schreibende nur als Vorschlag im Freigabe-Stapel; keine privaten Daten in Business-Texte.',
  quellen: 'Die Daten und Werkzeuge deines Bereichs.',
});

/** Offene Läufe, die ZOE angestoßen hat (Heads mit Auftrag aus einem ZOE-Thread) — zählen in die Grenze „≤ 3 offene Läufe je Person“ mit. */
const offeneHeadLaeufe = (b: { faeden: readonly Pick<FadenKopfKern, 'agent' | 'kette' | 'lauf'>[] }): number =>
  b.faeden.filter(f => f.agent.art === 'head' && f.kette?.[0] === 'zoe' && f.lauf && (f.lauf.status === 'wartet' || f.lauf.status === 'laeuft')).length;

/**
 * `an_head`: Auftrag an einen Head. Legt den Thread an (Eltern = ZOE-Thread, wenn ZOE in einem spricht), reiht den Lauf ein und
 * vermerkt im ZOE-Thread „An … gesendet“. Nach Fremdtext im Gespräch erbt der Head-Thread die Marken („nur Vorschlag“, Web nur mit Klick).
 */
export async function anHead(input: Record<string, unknown>, _origin: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  if (!person) return KEINE_PERSON;
  const sicht = await sichtLaden(person);
  if (!sicht.imHaushalt) return 'Nicht ausgeführt: Heads gibt es nur im Haushalt des Inhabers.';
  const head = headAusEingabe(input.head, sicht);
  if (!head) return UNBEKANNT;
  const t = textPruefen(input.auftrag, GRENZEN.auftragZeichen, 'Auftrag');
  if (!t.ok) return `Nicht ausgeführt: ${t.fehler}`;
  const { umfangFuer, einreihen } = await import('./delegation');
  const { agentAufloesen } = await import('./gespraech');
  const u = await umfangFuer(person);
  const agent: AgentRef = { art: 'head', headId: head.id };
  const a = await agentAufloesen(agent, u);
  if ('ok' in a && a.ok === false) return `Nicht ausgeführt: ${a.fehler}`;
  if ('einstellung' in a && a.einstellung.notAus) return 'Nicht ausgeführt: Not-Aus ist gesetzt — die Agenten halten an.';
  // Gegenprüfung 09.10.: Not-Aus, „aus“ und Monatsbudget DIESES Heads schon hier — sonst entstünde ein Thread, dessen Lauf gleich wieder anhält.
  const sperre = await (await import('./einstellung')).laufSperre(person, head.id).catch(() => null);
  if (sperre) return `Nicht ausgeführt: ${sperre.text}`;

  const zoe = kontext?.zoe;
  const jetzt = iso();
  const karte = auftragVonZoe(t.text);
  // Vom Stapel freigegeben (nach Fremdtext im Gespräch gestapelt): der Auftragstext kann Fremdtext tragen — der Head arbeitet dann „nur Vorschlag“.
  const fremdGelesen = !!zoe?.fremdGelesen || !!kontext?.freigegebenVon;
  const vertraulich = !!zoe?.vertraulich || !!kontext?.freigegebenVon;
  // E3 (09.10.): EINE Sperre über den Index; geladen wird nur der ZOE-Thread (Eltern), geschrieben Eltern, Kind und Index.
  const r = await ablageAendernFuer<FadenKern>(person, async ab => {
    const b = ab.index();
    if (offeneLaeufe(b) + offeneHeadLaeufe(b) >= GRENZEN.offeneLaeufeJePerson) return { ok: false, status: 409, fehler: `Höchstens ${GRENZEN.offeneLaeufeJePerson} offene Läufe gleichzeitig — warte, bis einer fertig ist.` };
    const ek = zoe?.fadenId ? ab.kopf(zoe.fadenId) : null;
    const eltern = ek && ek.agent.art === 'zoe' && ek.besitzer === person ? await ab.faden(ek.id) ?? undefined : undefined;
    const kind = neuerFaden({ id: neueKennung('fd'), besitzer: person, agent, bereich: head.bereich, titel: t.text, jetzt, ...(eltern ? { elternId: eltern.id } : {}), fremdGelesen: fremdGelesen || !!eltern?.fremdGelesen, vertraulich: vertraulich || !!eltern?.vertraulich, kette: ['zoe', agentSchluessel(agent)] });
    const nachricht: NachrichtKern = { id: neueKennung('nr'), rolle: 'agent', von: 'zoe', text: auftragText(karte), zeit: jetzt, auftrag: karte };
    const k = anhaengen(kind, [nachricht], jetzt);
    if (!k.ok) return k;
    const mit = ab.hinzu(k.faden);
    if (mit) return mit;
    if (eltern) {
      const gesendet: NachrichtKern = { id: neueKennung('nr'), rolle: 'system', von: 'system', text: `An ${head.name} gesendet: „${k.faden.titel}“`, zeit: jetzt, verweis: { art: 'gesendet', fadenId: kind.id, titel: k.faden.titel }, auftrag: karte };
      const e = anhaengen(eltern, [gesendet], jetzt);
      if (e.ok) ab.setze(e.faden);
    }
    return { e: k.faden };
  });
  if (!r.ok) return `Nicht ausgeführt: ${r.fehler}`;
  await einreihen(person, r.e.id, { hintergrund: false });
  return `An ${head.name} gesendet (Thread „${r.e.titel}“) — ${head.kurz} arbeitet im Hintergrund; der Bericht kommt in dieses Gespräch und als Glocke. Schreibendes legt ${head.kurz} nur als Vorschlag in den Freigabe-Stapel.`;
}

/**
 * `head_fragen`: der Head beantwortet EINE Frage — synchron, nur mit dem Kontext seines Bereichs und nur lesenden Werkzeugen (er legt
 * nichts an). Der Thread wird nicht gespeichert (eine Frage, keine Arbeit); das Lauf-Protokoll hält nur Metadaten fest.
 */
export async function headFragen(input: Record<string, unknown>, origin: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  if (!person) return KEINE_PERSON;
  const sicht = await sichtLaden(person);
  if (!sicht.imHaushalt) return 'Nicht ausgeführt: Heads gibt es nur im Haushalt des Inhabers.';
  const head = headAusEingabe(input.head, sicht);
  if (!head) return UNBEKANNT;
  const t = textPruefen(input.frage, 2_000, 'Frage');
  if (!t.ok) return `Nicht ausgeführt: ${t.fehler}`;
  const [{ umfangFuer }, { agentLauf }] = await Promise.all([import('./delegation'), import('./gespraech')]);
  const u = await umfangFuer(person);
  const agent: AgentRef = { art: 'head', headId: head.id };
  const jetzt = iso();
  const f0 = neuerFaden({ id: neueKennung('fd'), besitzer: person, agent, bereich: head.bereich, titel: t.text, jetzt, fremdGelesen: !!kontext?.zoe?.fremdGelesen, vertraulich: !!kontext?.zoe?.vertraulich, kette: ['zoe', agentSchluessel(agent)] });
  const k = anhaengen(f0, [{ id: neueKennung('nr'), rolle: 'agent', von: 'zoe', text: `FRAGE von ZOE (im Auftrag der Person, mit der ZOE spricht): ${t.text}`, zeit: jetzt }], jetzt);
  if (!k.ok) return `Nicht ausgeführt: ${k.fehler}`;
  const bestand = await bestandLesen(person);
  const ohne = { async ausfuehren() { return { text: 'Nicht angeboten.', ok: false }; } };
  const e = await agentLauf({
    sicht, umfang: u, faden: k.faden, modus: 'chat', origin, hintergrund: false, handler: ohne, gedaechtnis: gedaechtnisFuer(bestand, agent), nurLesen: true,
    zusatz: 'ZOE FRAGT DICH: Beantworte die Frage knapp mit dem, was du in deinem Bereich siehst (Zahlen genau so, wie sie kommen). Du legst nichts an und delegierst nicht. Fehlt dir etwas, sag es offen.',
  });
  // Agenten-Datenschicht (09.10.): kein Eintrag mehr im Ring `agent-log` (200 Einträge) — Chat-Züge und Thread-Läufe fluteten ihn und schoben
  // Loop-Historie und ZOEs „letzte Läufe“ hinaus. Der Lauf steht mit seinem Span an der Nachricht im Thread (`lauf`), der Auftrag in der Warteschlange.
  if (!e.ki) return `Nicht beantwortet: ${e.grund ?? 'keine Antwort'}.`;
  return `ANTWORT von ${head.name} (Daten aus seinem Bereich):\n${e.text}`;
}

/** Beim Bericht eines Head-Laufs: ist der Eltern-Thread ein ZOE-Thread? (dann geht der Bericht dorthin — delegation.ts) */
export async function zoeEltern(person: string, f: Pick<FadenKern, 'elternId' | 'agent'>): Promise<FadenKopfKern | null> {
  if (f.agent.art !== 'head' || !f.elternId) return null;
  const e = (await bestandLesen(person)).faeden.find(x => x.id === f.elternId);
  return e && e.agent.art === 'zoe' ? e : null;
}
