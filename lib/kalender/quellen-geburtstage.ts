// ─── Kalender-Quelle „Geburtstage“ (29.09., Paket K2, rein) ─────────────────
// Kevin 29.09.: Geburtstage aus Familie und CRM als eigener, schaltbarer Kalender — ganztägig, jährlich, mit Alter,
// wenn das Jahr bekannt ist; ein Klick öffnet die Person bzw. die Kontaktakte. Privat (Familie) und Business (CRM)
// bleiben nach Space getrennt (`space` an jedem Eintrag).
//
// EINE Stelle je Person (Kevin: „alles sauber verbunden“):
//   · Der Geburtstag liegt am CRM-Kontakt (`Kontakt.geburtstag`) ODER an der Familien-Person (`Mensch.geburtstag`),
//     Format lib/kalender/geburtstag.ts.
//   · Ist eine Familien-Person auch ein CRM-Kontakt — gleicher Name (`normName`, ohne Titel/Umlaute; die frühere
//     Verknüpfung `Mensch.kontaktId` ist seit F2 N4 entfernt) —, erscheint sie EINMAL. VORRANG hat die Familie (privat gepflegt, kein
//     Import fasst sie an); fehlt dort der Tag, gilt der des Kontakts. Der Eintrag steht dann im Privat-Space.
//   · In der Familie FÜHRT der Mensch (`Mensch.geburtstag`). Ein „Wichtiger Tag“ der Art „geburtstag“ verweist nur auf
//     ihn (`menschId`, dann ohne eigenes Datum) und erscheint hier nie zusätzlich. Alte Einträge ohne Verweis: gleicher
//     Name wie ein Mensch → der Mensch (fehlt dort der Tag, gilt der des Eintrags); sonst ein eigener Eintrag.
// Datenschutz: eingeschränkte Kontakte (Art. 18) kommen hier gar nicht an — der Server liest die Kartei nur über
// `kontakteFuerVerarbeitung()`; „nur ich“-Einträge der Familie sieht nur, wer sie angelegt hat (`sichtFuer`).
// Wer liest: `geburtstageIm` (quellen-geburtstage-server.ts) — Kalender, Glocke, Heute, Familie, Kontaktakte, ZOE.

import { geburtstagLesen, geburtstagImJahr, type GeburtstagTeile, type GeburtstagHerkunft, type Geburtstag, type AnlassAktion } from './geburtstag';
import { normName } from '@/lib/make-one/crm';

export { GEBURTSTAGE_KALENDER, GEBURTSTAG_FARBE, geburtstagTitel, geburtstagSatz, type Geburtstag, type GeburtstagHerkunft } from './geburtstag';

/** Eine Person mit Geburtstag, wie sie aus einer Quelle kommt. */
export interface GeburtstagQuelle {
  /** Stabile Kennung je Person: `fam-<mensch>`, `tag-<wichtigerTag>`, `crm-<kontakt>`. */
  id: string;
  name: string;
  /** Gespeicherte Form (TT.MM. oder JJJJ-MM-TT) — tolerant gelesen. */
  geburtstag: string;
  herkunft: GeburtstagHerkunft;
  space: 'privat' | 'business';
  /** Ziel beim Klick (Menschen-Seite, Familie, Kontaktakte). */
  href: string;
  /** Verknüpfter CRM-Kontakt (Familie ↔ CRM) bzw. der Kontakt selbst. */
  kontaktId?: string;
  /** Wer daran erinnert wird (Glocke): Familie = alle, die den Eintrag sehen; CRM = wer die Beziehung hält. */
  zustaendig?: string;
  /** Familien-Person (`fam-…`). */
  menschId?: string;
  /** Wichtiger Tag der Familie zu diesem Geburtstag (Vorlauf, Aktion, erledigte Jahre) — nur Verweis + seine Felder. */
  anlass?: QuelleAnlass;
}
export interface QuelleAnlass { tagId: string; aktion: AnlassAktion; vorlaufTage: number; erledigt: readonly number[] }

type TagRoh = { id: string; titel: string; art: string; datum: string; menschId?: string; aktion?: string; vorlaufTage?: number; erledigt?: readonly number[] };
const AKTIONEN: readonly AnlassAktion[] = ['geschenk', 'karte', 'anruf', 'feier'];
/** Die Felder eines Wichtigen Tages als Anlass (Vorlauf 0–60 Tage, erledigte Jahre als Zahlen). */
function anlassVon(t: TagRoh): QuelleAnlass {
  const v = Number(t.vorlaufTage);
  return {
    tagId: t.id, aktion: AKTIONEN.includes(t.aktion as AnlassAktion) ? (t.aktion as AnlassAktion) : 'geschenk',
    vorlaufTage: Number.isFinite(v) ? Math.min(60, Math.max(0, Math.round(v))) : 10,
    erledigt: Array.isArray(t.erledigt) ? t.erledigt.filter(j => Number.isInteger(j)) : [],
  };
}


const nameSchluessel = (name: string) => normName(name, '');
const monatTag = (t: GeburtstagTeile) => `${t.monat}-${t.tag}`;

/** Was die Familie beisteuert (bereits nach Sicht der Person gefiltert). Rein. */
export function familieQuellen(
  f: { menschen?: readonly { id: string; name: string; geburtstag?: string | null }[]; tage?: readonly TagRoh[] },
  links: { mensch: string; tag: string },
): GeburtstagQuelle[] {
  const raus: GeburtstagQuelle[] = [];
  // Der Wichtige Tag „Geburtstag“ eines Menschen (Verweis `menschId`) trägt Vorlauf/Aktion/erledigt — der erste zählt.
  const tagZuMensch = new Map<string, TagRoh>();
  for (const t of f.tage ?? []) if (t?.art === 'geburtstag' && t.menschId && !tagZuMensch.has(t.menschId)) tagZuMensch.set(t.menschId, t);
  for (const m of f.menschen ?? []) {
    if (!m?.id || !m.name?.trim()) continue;
    const tag = tagZuMensch.get(m.id);
    // Auch ohne eigenen Tag aufnehmen — trägt ein CRM-Kontakt gleichen Namens einen, kommt er von dort (vereinen).
    raus.push({ id: `fam-${m.id}`, name: m.name.trim().slice(0, 120), geburtstag: m.geburtstag ?? '', herkunft: 'familie', space: 'privat', href: links.mensch, menschId: m.id, ...(tag ? { anlass: anlassVon(tag) } : {}) });
  }
  for (const t of f.tage ?? []) {
    // Verweist der Tag auf einen Menschen, führt der Mensch — kein zweiter Eintrag.
    if (t?.art !== 'geburtstag' || t.menschId || !geburtstagLesen(t.datum)) continue;
    const name = String(t.titel ?? '').replace(/^\s*geburtstag\s*(von\s+)?/i, '').replace(/^[\s:–-]+/, '').trim() || String(t.titel ?? '').trim();
    if (!name) continue;
    raus.push({ id: `tag-${t.id}`, name: name.slice(0, 120), geburtstag: t.datum, herkunft: 'wichtiger-tag', space: 'privat', href: links.tag, anlass: anlassVon(t) });
  }
  return raus;
}

/** Was das CRM beisteuert — nur Kontakte mit Geburtstag. Die Kartei muss schon ohne eingeschränkte Personen sein. Rein. */
export function crmQuellen(
  kontakte: readonly { id: string; vorname?: string; nachname?: string; geburtstag?: string; eingeschraenkt?: unknown; besitzer?: string }[],
  href: (id: string) => string,
  zustaendig: (k: { besitzer?: string }) => string | undefined,
): GeburtstagQuelle[] {
  const raus: GeburtstagQuelle[] = [];
  for (const k of kontakte) {
    // Doppelt gesichert: auch wenn ein Aufrufer die ganze Kartei gibt, erscheint niemand mit Einschränkung (Art. 18).
    if (!k?.id || k.eingeschraenkt || !geburtstagLesen(k.geburtstag)) continue;
    const name = `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim();
    if (!name) continue;
    const z = zustaendig(k);
    raus.push({ id: `crm-${k.id}`, name, geburtstag: k.geburtstag!, herkunft: 'crm', space: 'business', href: href(k.id), kontaktId: k.id, ...(z ? { zustaendig: z } : {}) });
  }
  return raus;
}

/**
 * Familie und CRM zu EINER Liste je Person (Vorrang Familie, siehe Kopf). Familien-Personen ohne Tag und ohne
 * verknüpften Kontakt mit Tag fallen weg; ein alter Wichtiger Tag (ohne Verweis) fällt weg, wenn er einen Menschen gleichen
 * Namens betrifft (der Mensch führt) oder dieselbe Person mit demselben Tag schon da ist.
 */
export function quellenVereinen(familie: readonly GeburtstagQuelle[], crm: readonly GeburtstagQuelle[]): GeburtstagQuelle[] {
  const crmNachId = new Map(crm.filter(c => c.kontaktId).map(c => [c.kontaktId!, c]));
  const crmNachName = new Map<string, GeburtstagQuelle>();
  for (const c of crm) { const s = nameSchluessel(c.name); if (s && !crmNachName.has(s)) crmNachName.set(s, c); }
  const verbraucht = new Set<string>();
  const raus: GeburtstagQuelle[] = [];
  const menschen = familie.filter(q => q.herkunft === 'familie');
  for (const m of menschen) {
    const s = nameSchluessel(m.name);
    const partner = (m.kontaktId ? crmNachId.get(m.kontaktId) : undefined) ?? (s ? crmNachName.get(s) : undefined);
    if (partner) verbraucht.add(partner.id);
    const eigener = geburtstagLesen(m.geburtstag);
    if (eigener) raus.push({ ...m, ...(partner ? { kontaktId: partner.kontaktId } : {}) });
    else if (partner) raus.push({ ...m, geburtstag: partner.geburtstag, kontaktId: partner.kontaktId });
  }
  // Alte Wichtige Tage ohne Verweis: gleicher Name wie ein Mensch → der Mensch führt (ohne eigenen Tag: dieser Tag).
  const menschNachName = new Map<string, GeburtstagQuelle>();
  for (const m of menschen) { const s = nameSchluessel(m.name); if (s && !menschNachName.has(s)) menschNachName.set(s, m); }
  const schonDa = new Set(raus.map(r => { const t = geburtstagLesen(r.geburtstag); return t ? `${nameSchluessel(r.name)}|${monatTag(t)}` : ''; }));
  for (const w of familie.filter(q => q.herkunft === 'wichtiger-tag')) {
    const t = geburtstagLesen(w.geburtstag);
    if (!t) continue;
    const s = nameSchluessel(w.name);
    const mensch = s ? menschNachName.get(s) : undefined;
    if (mensch) {
      const i = raus.findIndex(r => r.id === mensch.id);
      if (i < 0) { raus.push({ ...mensch, geburtstag: w.geburtstag, ...(!mensch.anlass && w.anlass ? { anlass: w.anlass } : {}) }); schonDa.add(`${s}|${monatTag(t)}`); }
      else if (!raus[i].anlass && w.anlass) raus[i] = { ...raus[i], anlass: w.anlass }; // der alte Tag trägt Vorlauf/erledigt weiter
      continue;
    }
    const schluessel = `${s}|${monatTag(t)}`;
    if (s && schonDa.has(schluessel)) continue;
    // Titel wie „Mama“ gegen einen CRM-Kontakt gleichen Namens: Familie gewinnt auch hier.
    const partner = s ? crmNachName.get(s) : undefined;
    if (partner && geburtstagLesen(partner.geburtstag) && monatTag(geburtstagLesen(partner.geburtstag)!) === monatTag(t)) verbraucht.add(partner.id);
    schonDa.add(schluessel);
    raus.push(w);
  }
  for (const c of crm) if (!verbraucht.has(c.id)) raus.push(c);
  return raus;
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Alle Geburtstage im Zeitraum [von, bis) — jährlich wiederholt, mit Alter, nach Tag und Name. Höchstens 5 Jahre. Rein. */
export function geburtstageAus(quellen: readonly GeburtstagQuelle[], von: string, bis: string): Geburtstag[] {
  if (!TAG.test(von) || !TAG.test(bis) || bis <= von) return [];
  const j0 = Number(von.slice(0, 4)), j1 = Math.min(Number(bis.slice(0, 4)), j0 + 5);
  const raus: Geburtstag[] = [];
  for (const q of quellen) {
    const t = geburtstagLesen(q.geburtstag);
    if (!t) continue;
    for (let j = j0; j <= j1; j++) {
      const tag = geburtstagImJahr(t, j);
      if (tag < von || tag >= bis) continue;
      if (t.jahr !== undefined && j < t.jahr) continue;
      const alter = t.jahr !== undefined ? j - t.jahr : undefined;
      raus.push({
        id: `${q.id}-${j}`, name: q.name, tag, ...(alter !== undefined ? { alter } : {}), herkunft: q.herkunft, space: q.space, href: q.href,
        ...(q.kontaktId ? { kontaktId: q.kontaktId } : {}), ...(q.zustaendig ? { zustaendig: q.zustaendig } : {}),
        ...(q.menschId ? { menschId: q.menschId } : {}),
        ...(q.anlass ? { anlass: { tagId: q.anlass.tagId, aktion: q.anlass.aktion, vorlaufTage: q.anlass.vorlaufTage, erledigt: q.anlass.erledigt.includes(j) } } : {}),
      });
    }
  }
  return raus.sort((a, b) => a.tag.localeCompare(b.tag) || a.name.localeCompare(b.name, 'de'));
}

