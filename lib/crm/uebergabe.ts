// ─── Markttraktion — Übergabe an Kevin oder Malin (Server) ──────────────────
// Genutzt von /api/crm/uebergabe und ZOE (Werkzeug uebergeben). Wirkung:
// Zuständigkeit wechselt (Kontakt: „Hält die Beziehung“, Chance: besitzer,
// sonst zustaendig), am Kontakt steht die Übergabe im Verlauf, mit Notiz und
// Frist wird sie dort zum nächsten Schritt (→ Power Hour der anderen Person),
// und die andere Person bekommt eine Aufgabe mit Link. Nichts wird versendet.
// 28.09. spät (Aufgaben wie Monday/ClickUp): die Aufgabe trägt den CRM-Bezug (`bezug`: Kontakt bzw. Deal/Mandat
// + Firma) und, wo er feststeht, ihren Space (aktives Mandat → Mandant `m-<firmaId>`, sonst die Gesellschaft).
// Der Link bleibt zusätzlich in der Beschreibung (andere Leser, z. B. Art. 15/17, nutzen ihn).

import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { aendereCrm } from './speicher';
import { wer, nameVon, BEIDE } from './team';
import { markttraktion, mandateLink } from './adresse';
import { einheitAusBezug } from '@/lib/aufgaben/einheit';
import type { CrmBestand, CrmListe } from './typen';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { gesellschaftAusEinheit } from '@/lib/einheiten';
import { einheitFuer, istSpaceId, mandantSpaceId } from '@/lib/aufgaben/struktur';
import { bezugSauber } from '@/lib/aufgaben/saeubern';
import type { AufgabeBezug, AufgabenSpaceId } from '@/types/tasks';

import { tagVon } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
export const UEBERGABE_ARTEN = ['kontakt', 'kontakte', 'chance', 'mandat', 'event', 'kampagne', 'beitrag', 'newsletter'] as const;
type Art = typeof UEBERGABE_ARTEN[number];
const LISTE: Partial<Record<Art, CrmListe>> = { chance: 'chancen', mandat: 'mandate', event: 'events', kampagne: 'kampagnen', beitrag: 'beitraege', newsletter: 'newsletter' };
const ZIEL: Partial<Record<Art, [string, string?]>> = { chance: ['deals', 'akte'], mandat: ['deals', 'kunden'], event: ['event'], kampagne: ['marketing', 'kampagnen'], beitrag: ['marketing', 'redaktion'], newsletter: ['marketing', 'newsletter'] };
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export interface UebergabeEingabe { art?: string; id?: string; ids?: string[]; an?: string; notiz?: string; frist?: string }
export type UebergabeErgebnis = { ok: true; anzahl: number; an: string; aufgabe: boolean; text: string } | { ok: false; fehler: string; status: number };

/** `protokollWer` fürs Änderungsprotokoll (Route: `werAus(req)`, ZOE: `{ art: 'zoe', person }`); fehlt es, gilt die laufende Anfrage. */
export async function uebergeben(b: UebergabeEingabe, person: string, protokollWer?: Wer, herkunft?: { quelle: 'zoe'; freigegebenVon?: string }): Promise<UebergabeErgebnis> {
  const art = UEBERGABE_ARTEN.includes(b.art as Art) ? (b.art as Art) : null;
  const an = wer(b.an);
  const notiz = String(b.notiz ?? '').trim().slice(0, 600);
  const frist = tagOk(b.frist);
  if (!art || !an) return { ok: false, fehler: 'art und an (kevin, malin, beide) nötig.', status: 400 };
  const jetzt = new Date().toISOString();
  const vonName = nameVon(person);
  let titel = '';
  let link = '';
  let anzahl = 0;
  /** Business-Einheit der Aufgabe (Prüfbericht F1) — aus der Gesellschaft von Deal/Mandat, wie bei den Heads. */
  let einheit: string | undefined;
  /** CRM-Bezug der Aufgabe (nur Kennungen) und — bei aktivem Mandat — der Mandanten-Space. */
  let bezug: AufgabeBezug | undefined;
  let mandantSpace: AufgabenSpaceId | undefined;

  if (art === 'kontakt' || art === 'kontakte') {
    const ids = new Set((art === 'kontakt' ? [b.id] : (b.ids ?? [])).map(String).filter(x => /^c-[a-z0-9-]{4,60}$/.test(x)).slice(0, 300));
    if (!ids.size) return { ok: false, fehler: 'Keine gültigen Kontakte.', status: 400 };
    const namen: string[] = [];
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      return { ...f, kontakte: f.kontakte.map(k => {
        if (!ids.has(k.id) || ausgenommen(k)) return k;
        anzahl++; namen.push(anzeigename(k));
        const eintrag = { am: jetzt, art: 'uebergabe' as const, von: person, text: `an ${nameVon(an)}${notiz ? `: ${notiz}` : ''}`, ...(herkunft ? { quelle: 'zoe' as const, ...(herkunft.freigegebenVon ? { freigegebenVon: herkunft.freigegebenVon } : {}) } : {}) };
        return { ...k, besitzer: an, aktivitaeten: [...(k.aktivitaeten ?? []), eintrag], geaendertAm: tagVon(jetzt),
          ...(art === 'kontakt' && notiz && frist ? { naechsterSchritt: { text: notiz.slice(0, 300), datum: frist } } : {}) };
      }) };
    }, protokollWer);
    if (!anzahl) return { ok: false, fehler: 'Nichts übergeben — gesperrt oder nicht gefunden.', status: 404 };
    titel = anzahl === 1 ? namen[0] : `${anzahl} Kontakte`;
    link = art === 'kontakt' ? markttraktion('kontakte', undefined, Array.from(ids)[0]) : `${markttraktion('kontakte')}&wer=${an}`;
    if (art === 'kontakt') bezug = bezugSauber({ kontaktId: Array.from(ids)[0] });
  } else {
    const liste = LISTE[art]!;
    const id = String(b.id ?? '');
    const feld = art === 'chance' ? 'besitzer' : 'zustaendig';
    await aendereCrm(c => {
      const l = c[liste] as unknown as ({ id: string; titel?: string; name?: string; kunde?: string } & Record<string, unknown>)[];
      const i = l.findIndex(x => x.id === id);
      if (i < 0) return c;
      const x = l[i];
      anzahl = 1; titel = String(x.titel ?? x.name ?? x.kunde ?? id);
      einheit = art === 'chance' ? einheitAusBezug(c, { chanceId: id }) : art === 'mandat' ? einheitAusBezug(c, { mandatId: id }) : undefined;
      const firmaId = typeof x.firmaId === 'string' && x.firmaId ? x.firmaId : undefined;
      if (art === 'chance') bezug = bezugSauber({ dealId: id, firmaId });
      if (art === 'mandat') {
        bezug = bezugSauber({ mandatId: id, firmaId });
        if (x.status === 'aktiv' && firmaId && istSpaceId(mandantSpaceId(firmaId))) mandantSpace = mandantSpaceId(firmaId);
      }
      const neu = [...l]; neu[i] = { ...x, [feld]: an, geaendert: jetzt, geaendertVon: person };
      // Schreibt jetzt die Stimme selbst, braucht es keine Freigabe mehr.
      if (liste === 'beitraege' && x.freigabe && x.stimme === an) delete (neu[i] as Record<string, unknown>).freigabe;
      return { ...c, [liste]: neu } as CrmBestand;
    }, protokollWer);
    if (!anzahl) return { ok: false, fehler: 'Eintrag nicht gefunden.', status: 404 };
    const [s, a] = ZIEL[art]!;
    // Mandate leben seit 25.09. unter Produkte & Mandate — der Link öffnet genau dieses Mandat.
    // Der Link öffnet das Objekt selbst (Akte, Event, Kampagne …), nicht nur die Liste (Prüfbericht 27.09., Punkt 9).
    link = art === 'mandat' ? mandateLink('mandate', id) : markttraktion(s, a, id);
  }

  // Die andere Person bekommt eine Aufgabe — nicht, wer sich selbst etwas gibt, und nicht bei „beide“.
  let aufgabe = false;
  if (an !== person && an !== BEIDE) {
    // Space: aktives Mandat → Mandant, sonst die Gesellschaft der Einheit; sonst keiner (die Übernahme leitet ihn ab).
    const spaceId: AufgabenSpaceId | undefined = mandantSpace ?? gesellschaftAusEinheit(einheit);
    const ort = spaceId ? { spaceId, space: 'business', ...(einheitFuer(spaceId, einheit) ? { einheit: einheitFuer(spaceId, einheit) } : {}) } : einheit ? { space: 'business', einheit } : {};
    // Über den Schreibweg (29.09., Paket T1): Anlegerin, Zeitstempel, Verlauf, Meldung an die Empfängerin.
    await systemAufgabenAendern(() => {
      const t = { ...ort, ...(bezug ? { bezug } : {}), id: neueKennung('ueb'), title: `Von ${vonName}: ${titel}`.slice(0, 200),
        description: `${vonName} hat dir ${art === 'kontakte' ? `${anzahl} Kontakte` : titel} in der Markttraktion übergeben.${notiz ? `\n\n„${notiz}“` : ''}\n\n${link}`,
        status: 'todo', priority: 'medium', assignee: an, tags: ['markttraktion', 'uebergabe'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...(frist ? { dueDate: frist } : {}) };
      return { neu: [t] };
    }, { person, wer: { art: 'system', person }, jetzt });
    aufgabe = true;
  }
  return { ok: true, anzahl, an, aufgabe, text: `${titel} → ${nameVon(an)}${aufgabe ? ' · Aufgabe angelegt' : ''}` };
}
