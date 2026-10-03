// ─── Eine Person im CRM-Bestand: entfernen, umbiegen, aufzählen (27.09.) ────
// Prüfbericht 27.09. (Feinschliff 3): Art.-17-Löschung, Dubletten-Zusammenführung
// und Art.-15-Auskunft kannten je eine andere Teilmenge der Listen, in denen eine
// Person vorkommt — Follow-ups, Deal-Rollen, Power-Hour-Karten und Anträge
// blieben stehen. Ab jetzt kennt GENAU EINE Stelle alle Verweise; der Test
// prüft, dass nach dem Entfernen die Kennung nirgends mehr im Bestand steht.

import type { CrmBestand, FollowUp, Teilnahme } from './typen';
import { angebotePersonOhne, angebotePersonUm, angebotePersonAuskunft } from './angebote';
import { localDay } from '@/lib/zeit';

const ohne = (ids: string[], id: string) => ids.filter(x => x !== id);
const um = (ids: string[], alt: string, neu: string) => Array.from(new Set(ids.map(x => (x === alt ? neu : x))));


/** Zielpersonen besuchter Events (03.10., lib/crm/besuche-form.ts): die Person fällt aus der Liste; ohne Treffer bleibt das Event unverändert (===). */
const zielOhne = (events: CrmBestand['events'], id: string): CrmBestand['events'] => (events ?? []).map(e => {
  if (!e.zielpersonen?.some(z => z.kontaktId === id)) return e;
  const rest = e.zielpersonen.filter(z => z.kontaktId !== id);
  const { zielpersonen: _weg, ...ohneZiel } = e;
  return rest.length ? { ...e, zielpersonen: rest } : ohneZiel;
});
/** Zielpersonen nach dem Umbiegen: `alt` wird `neu`, ohne Doppelte (steht `neu` schon drin, gewinnt dessen Eintrag; „getroffen“ bleibt, wenn eine der beiden getroffen war). */
const zielUm = (events: CrmBestand['events'], alt: string, neu: string): CrmBestand['events'] => (events ?? []).map(e => {
  if (!e.zielpersonen?.some(z => z.kontaktId === alt)) return e;
  const getroffen = e.zielpersonen.some(z => (z.kontaktId === alt || z.kontaktId === neu) && z.getroffen);
  const vorhanden = e.zielpersonen.some(z => z.kontaktId === neu);
  const liste = e.zielpersonen.flatMap(z => (z.kontaktId === alt ? (vorhanden ? [] : [{ ...z, kontaktId: neu }]) : [z]))
    .map(z => (z.kontaktId === neu && getroffen ? { ...z, getroffen: true } : z));
  return { ...e, zielpersonen: liste };
});

/** Person aus allen Listen entfernen (Art. 17). Follow-ups AN die Person fallen weg; Anträge behalten den Vorgang, verlieren aber den Verweis. */
export function personEntfernen(crm: CrmBestand, id: string): CrmBestand {
  const rollenOhne = (r?: Record<string, unknown>) => { if (!r || !(id in r)) return r; const { [id]: _weg, ...rest } = r; return Object.keys(rest).length ? rest : undefined; };
  return {
    ...crm,
    chancen: crm.chancen.map(c => (c.kontaktIds.includes(id) || c.personenRollen?.[id] ? { ...c, kontaktIds: ohne(c.kontaktIds, id), ...(rollenOhne(c.personenRollen) ? { personenRollen: rollenOhne(c.personenRollen) as typeof c.personenRollen } : { personenRollen: undefined }) } : c)),
    mandate: crm.mandate.map(m => (m.kontaktIds.includes(id) ? { ...m, kontaktIds: ohne(m.kontaktIds, id) } : m)),
    teilnahmen: crm.teilnahmen.filter(t => t.kontaktId !== id),
    events: zielOhne(crm.events, id),
    kampagnen: (crm.kampagnen ?? []).map(k => (k.kontaktIds.includes(id) || k.ergebnisse.some(e => e.kontaktId === id) ? { ...k, kontaktIds: ohne(k.kontaktIds, id), ergebnisse: k.ergebnisse.filter(e => e.kontaktId !== id) } : k)),
    beitraege: (crm.beitraege ?? []).map(b => (b.quellen.includes(id) || b.wirkung.some(w => w.kontaktId === id) ? { ...b, quellen: ohne(b.quellen, id), wirkung: b.wirkung.filter(w => w.kontaktId !== id) } : b)),
    followups: (crm.followups ?? []).filter(f => f.kontaktId !== id && !(f.bezug.art === 'kontakt' && f.bezug.id === id)),
    sitzungen: (crm.sitzungen ?? []).map(s => (s.karten.some(k => k.kontaktId === id) ? { ...s, karten: s.karten.filter(k => k.kontaktId !== id) } : s)),
    antraege: (crm.antraege ?? []).map(a => (a.kontaktId === id ? { ...a, kontaktId: undefined } : a)),
    // Angebote (28.09.): Entwürfe fallen weg; gestellte sind Geschäftsunterlagen — Personenbezug lösen statt löschen.
    angebote: angebotePersonOhne(crm.angebote ?? [], id, localDay()),
  };
}

/**
 * Teilnahmen nach dem Umbiegen: hatten beide Personen eine Teilnahme am SELBEN Event (28.09., F2),
 * bleibt eine — die der behaltenen Person (`neu`). Der Status kommt aus der zuletzt geänderten
 * Teilnahme (jüngste Auskunft gewinnt, bei Gleichstand die behaltene), leere Felder füllt die andere.
 */
function teilnahmenUm(liste: Teilnahme[], alt: string, neu: string): Teilnahme[] {
  const vonNeu = new Map(liste.filter(t => t.kontaktId === neu).map(t => [t.eventId, t]));
  const weg = new Set<string>();
  const gemischt = new Map<string, Teilnahme>();
  for (const t of liste) {
    if (t.kontaktId !== alt) continue;
    const n = vonNeu.get(t.eventId);
    if (!n) continue;
    weg.add(t.id);
    const basis = gemischt.get(n.id) ?? n;
    const raus: Teilnahme = { ...basis };
    for (const f of Object.keys(t) as (keyof Teilnahme)[]) {
      if (f === 'id' || f === 'kontaktId' || f === 'eventId') continue;
      const v = t[f];
      if (v !== undefined && v !== '' && (raus[f] === undefined || raus[f] === '')) (raus as unknown as Record<string, unknown>)[f] = v;
    }
    if ((t.geaendert ?? '') > (basis.geaendert ?? '')) { raus.status = t.status; raus.geaendert = t.geaendert; }
    gemischt.set(n.id, raus);
  }
  return liste.filter(t => !weg.has(t.id)).map(t => gemischt.get(t.id) ?? (t.kontaktId === alt ? { ...t, kontaktId: neu } : t));
}

/** Verweise von `alt` auf `neu` umbiegen (Dubletten zusammenführen) — nichts geht verloren, nichts doppelt. */
export function personUmbiegen(crm: CrmBestand, alt: string, neu: string): CrmBestand {
  if (alt === neu) return crm;
  const rollenUm = (r?: Record<string, unknown>) => { if (!r || !(alt in r)) return r; const { [alt]: rolle, ...rest } = r; return { ...rest, ...(neu in rest ? {} : { [neu]: rolle }) }; };
  const fu = (f: FollowUp): FollowUp => ({ ...f, ...(f.kontaktId === alt ? { kontaktId: neu } : {}), ...(f.bezug.art === 'kontakt' && f.bezug.id === alt ? { bezug: { ...f.bezug, id: neu } } : {}) });
  return {
    ...crm,
    chancen: crm.chancen.map(c => (c.kontaktIds.includes(alt) || c.personenRollen?.[alt] ? { ...c, kontaktIds: um(c.kontaktIds, alt, neu), ...(c.personenRollen ? { personenRollen: rollenUm(c.personenRollen) as typeof c.personenRollen } : {}) } : c)),
    mandate: crm.mandate.map(m => (m.kontaktIds.includes(alt) ? { ...m, kontaktIds: um(m.kontaktIds, alt, neu) } : m)),
    teilnahmen: teilnahmenUm(crm.teilnahmen, alt, neu),
    events: zielUm(crm.events, alt, neu),
    kampagnen: (crm.kampagnen ?? []).map(k => (k.kontaktIds.includes(alt) || k.ergebnisse.some(e => e.kontaktId === alt)
      ? { ...k, kontaktIds: um(k.kontaktIds, alt, neu), ergebnisse: k.ergebnisse.map(e => (e.kontaktId === alt ? { ...e, kontaktId: neu } : e)) } : k)),
    beitraege: (crm.beitraege ?? []).map(b => (b.quellen.includes(alt) || b.wirkung.some(w => w.kontaktId === alt)
      ? { ...b, quellen: um(b.quellen, alt, neu), wirkung: b.wirkung.map(w => (w.kontaktId === alt ? { ...w, kontaktId: neu } : w)) } : b)),
    followups: (crm.followups ?? []).map(fu),
    // Eine Power-Hour-Karte je Person: stand die behaltene schon in der Sitzung, fällt die Karte der alten weg.
    sitzungen: (crm.sitzungen ?? []).map(s => (s.karten.some(k => k.kontaktId === alt)
      ? { ...s, karten: s.karten.some(k => k.kontaktId === neu) ? s.karten.filter(k => k.kontaktId !== alt) : s.karten.map(k => (k.kontaktId === alt ? { ...k, kontaktId: neu } : k)) } : s)),
    antraege: (crm.antraege ?? []).map(a => (a.kontaktId === alt ? { ...a, kontaktId: neu } : a)),
    angebote: angebotePersonUm(crm.angebote ?? [], alt, neu),
  };
}

/** Alles, was der Bestand über eine Person hält — für die Auskunft nach Art. 15 (die Kartei kommt aus dem Kontakte-Bestand dazu). */
export function personVerweise(crm: CrmBestand, id: string) {
  return {
    chancen: crm.chancen.filter(c => c.kontaktIds.includes(id) || !!c.personenRollen?.[id]).map(c => ({ ...c, ...(c.personenRollen?.[id] ? { rolle: c.personenRollen[id] } : {}) })),
    mandate: crm.mandate.filter(m => m.kontaktIds.includes(id)),
    events: crm.teilnahmen.filter(t => t.kontaktId === id).map(t => ({ ...t, event: crm.events.find(e => e.id === t.eventId)?.titel })),
    // Besuchte Events (03.10.): auf welcher Zielliste („wen wollen wir treffen“) die Person steht.
    eventZiele: (crm.events ?? []).filter(e => e.zielpersonen?.some(z => z.kontaktId === id)).map(e => ({ id: e.id, titel: e.titel, datum: e.datum, getroffen: e.zielpersonen!.find(z => z.kontaktId === id)?.getroffen === true })),
    followups: (crm.followups ?? []).filter(f => f.kontaktId === id || (f.bezug.art === 'kontakt' && f.bezug.id === id)),
    kampagnen: (crm.kampagnen ?? []).filter(k => k.kontaktIds.includes(id) || k.ergebnisse.some(e => e.kontaktId === id)).map(k => ({ id: k.id, name: k.name, status: k.status, ergebnisse: k.ergebnisse.filter(e => e.kontaktId === id) })),
    beitraege: (crm.beitraege ?? []).filter(b => b.quellen.includes(id) || b.wirkung.some(w => w.kontaktId === id)).map(b => ({ id: b.id, titel: b.titel, quelle: b.quellen.includes(id), wirkung: b.wirkung.filter(w => w.kontaktId === id) })),
    powerHours: (crm.sitzungen ?? []).filter(s => s.karten.some(k => k.kontaktId === id)).map(s => ({ datum: s.datum, karten: s.karten.filter(k => k.kontaktId === id) })),
    antraege: (crm.antraege ?? []).filter(a => a.kontaktId === id),
    angebote: angebotePersonAuskunft(crm.angebote ?? [], id),
  };
}
