// ─── Prozesse — die Landkarte lesen (Server, Etappe A, 21.10.; ANALYSE_100.md Punkte 4, 27, 74) ─────────────────────────────────────────────
// EINE Stelle, die zusammenträgt, was die Landkarte zeigt — nur Business, nur lesen, schreibt nie:
//   Prozesse   das Register der System-Prozesse (./register.ts) + die Vorlagen aus dem Fulfillment-Bestand (./vorlagen.ts `prozessAusVorlage`)
//              + die Prozesse der Werkstatt (./werkstatt-landkarte.ts `prozessAusWerkstatt`, Bestand `prozesse--<h>`)
//   Zahlen     aus den VORHANDENEN Lesewegen, nichts neu gezählt (eine Wahrheit mit den Fachseiten):
//                Leads, Deals, Nach der Leistung  `kreislauf` (lib/crm/planung.ts) — dieselben Zahlen wie Markttraktion › Planung › Kreislauf
//                Follow-up                         `faellige` (lib/crm/followup.ts) — fällig bis heute, überfällig rot
//                Event-Nachfassen (Punkt 74)       `besuchUebersicht` (lib/crm/besuche.ts) — offen · rechtzeitig nachgefasst
//                Fulfillment                       `cockpitDaten` (laufende Fälle von Mandaten einer Business-Gesellschaft) und je Vorlage
//                                                  `kundenJeKnoten` (lib/fulfillment/regeln.ts) — die Zahl der Fälle an jedem Knoten
//                Werkstatt-Prozesse (30.10.)       die Läufe des Motors (`werkstattFallZahl`, lib/prozesse/kreislauf-heute.ts) — offen · wartet · fertig 30 Tage
// Die Kartei kommt über `kontakteFuerVerarbeitung` (Art. 18: eingeschränkte Personen fehlen ganz). Die Antwort trägt nur Titel aus Register und Vorlagen
// und Zahlen — keine Personen, keine Namen, keine Beträge. Jeder Teil ist für sich abgesichert: scheitert er, fehlt seine Zahl (nie eine erfundene Null).
// Stellschrauben (22.10.): je System-Prozess die Einstellungen, die er liest (lib/prozesse/stellschrauben-server.ts) — nur Werte, keine Personen.
// Eine Minute gemerkt je Haushalt und Tag (jede Schreibung über local-db setzt den Speicher zurück).

import { merken } from '@/lib/store/memo';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { localDay } from '@/lib/zeit';
import { SYSTEM_PROZESSE } from './register';
import { prozessAusVorlageMit } from './vorlagen';
import { inWerkstatt } from '@/lib/fulfillment/prozesse/werkstatt-marke';
import { zahlSchluessel } from './modell';
import type { LandkarteDaten, ProzessDef, ZaehlerArt, Zahl } from './typen';

async function sicher<T>(f: () => Promise<T>): Promise<T | null> {
  try { return await f(); } catch { return null; }
}

/** Die Zahlen der Markttraktion (Kreislauf, Follow-up, besuchte Events) — ein Lesen der Kartei, des CRM und der Planung. */
async function markttraktionZahlen(heute: string): Promise<Partial<Record<ZaehlerArt, Zahl>>> {
  const [{ kontakteFuerVerarbeitung, eingeschraenkteKennungen }, { ladeCrm }, { leads }, { faellige }, { kreislauf, zuordnen }, { ladePlanung }, { besuchUebersicht }, { WEG }, { nachfassWerktage }] = await Promise.all([
    import('@/lib/crm/verarbeitung'), import('@/lib/crm/speicher'), import('@/lib/crm/leads'), import('@/lib/crm/followup'), import('@/lib/crm/planung'),
    import('@/lib/crm/planung-server'), import('@/lib/crm/besuche'), import('@/lib/wege'), import('@/lib/crm/stellschrauben'),
  ]);
  const [kontakte, crm, ausgeblendet, plan] = await Promise.all([kontakteFuerVerarbeitung(), ladeCrm(), eingeschraenkteKennungen(), ladePlanung()]);
  const raus: Partial<Record<ZaehlerArt, Zahl>> = {};
  const f = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten, ausgeblendet }).filter(x => x.faellig <= heute);
  const ueber = f.filter(x => x.faellig < heute).length;
  raus.followup = { wert: f.length, wort: 'fällig', ...(ueber ? { zweite: { wert: ueber, wort: 'überfällig', rot: true as const } } : {}), href: WEG.followup() };
  const zeilen = leads(kontakte, crm, heute);
  const k = kreislauf({ heute, kanaele: plan.kanaele, zeilen, crm, kontakte, nachLeistung: plan.nachLeistung, followup: { faellig: f.length, ueberfaellig: ueber }, zuordnung: zuordnen(plan.kanaele, zeilen, crm) });
  const stufe = (id: string) => k.stufen.find(s => s.id === id);
  const leadsSt = stufe('leads'), dealsSt = stufe('deals'), nachSt = stufe('nachher');
  if (leadsSt) raus.leads = { wert: leadsSt.anzahl, wort: 'in Arbeit', href: leadsSt.href };
  if (dealsSt) raus.deals = { wert: dealsSt.anzahl, wort: 'offen', href: dealsSt.href };
  if (nachSt) raus.nachher = { wert: nachSt.anzahl, wort: 'Kunden offen', href: nachSt.href };
  const besuche = besuchUebersicht(crm.events ?? [], { teilnahmen: crm.teilnahmen ?? [], kontakte, chancen: crm.chancen ?? [], heute, nachfassWerktage: nachfassWerktage(crm.wertelisten) });
  if (besuche.zeilen.length) {
    const offen = besuche.zeilen.reduce((a, z) => a + z.wirkung.nachfassenOffen, 0);
    raus['event-nachfassen'] = { wert: offen, wort: 'offen', zweite: { wert: besuche.summe.nachgefasst, wort: 'rechtzeitig nachgefasst' }, href: WEG.besuch(undefined, 'wirkung') };
  }
  return raus;
}

/** Fulfillment: laufende Fälle, Fälle im Onboarding und je Vorlage die Zahl an jedem Knoten. */
async function fulfillmentZahlen(heute: string, vorlagen: readonly import('@/lib/fulfillment/typen').ProzessVorlage[], privat: boolean): Promise<{ arten: Partial<Record<ZaehlerArt, Zahl>>; knoten: Record<string, Zahl> }> {
  const [{ cockpitDaten }, { fulfillmentLesen }, { kundenJeKnoten, mandatInSicht }, { phaseVonKnoten }, { WEG }] = await Promise.all([
    import('@/lib/fulfillment/prozesse/server'), import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/regeln'), import('@/lib/fulfillment/prozesse/fluss-struktur'), import('@/lib/wege'),
  ]);
  // Fälle der Privat-Arbeits-Einheit (25.10.) zählen nur für ein Konto mit Privat-Recht — auch als Zahl nie für ein Konto „nur Business“.
  const zeilen = (await cockpitDaten(heute)).zeilen.filter(z => mandatInSicht(z.gesellschaft, privat));
  const arten: Partial<Record<ZaehlerArt, Zahl>> = {};
  if (zeilen.length) arten.faelle = { wert: zeilen.length, wort: zeilen.length === 1 ? 'Fall läuft' : 'Fälle laufen', href: WEG.fulfillment() };
  const ob = zeilen.filter(z => z.status === 'onboarding').length;
  if (ob) arten.onboarding = { wert: ob, wort: 'im Onboarding', href: WEG.fulfillment('onboarding') };
  // Nur Fälle, die das Cockpit zeigt und diese Sicht sehen darf (`mandatInSicht`) — dieselbe Grenze wie überall im Fulfillment.
  const sichtbar = new Set(zeilen.map(z => z.mandatId));
  const faelle = Object.values((await fulfillmentLesen('faelle')).faelle).filter(f => sichtbar.has(f.mandatId));
  const knoten: Record<string, Zahl> = {};
  for (const v of vorlagen) {
    const je = kundenJeKnoten(v, faelle);
    const wurzel = v.knoten.find(k => !k.elternId);
    const fall = (n: number): Zahl => ({ wert: n, wort: n === 1 ? 'Fall' : 'Fälle', href: WEG.fulfillment() });
    // Die Kachel eines Pakets zählt seine Fälle; die Landkarte (Hochhaus) zählt nur an ihren Etagen (alle Fälle stehen schon an „Lieferung“).
    if (wurzel && v.art !== 'landkarte' && je[wurzel.id]?.length) knoten[v.id] = fall(je[wurzel.id].length);
    // Phasen und Schritte (auch in benannten Teilprozessen) — der Schlüssel aus der Phase, in der der Knoten liegt.
    for (const [id, l] of Object.entries(je)) {
      const ph = l.length ? phaseVonKnoten(v.knoten, id) : null;
      if (ph) knoten[zahlSchluessel(id === ph ? { p: v.id, ph } : { p: v.id, ph, s: id })] = fall(l.length);
    }
  }
  return { arten, knoten };
}

/**
 * Die Produkte je Prozess anhängen (Prozesse × Fulfillment, 22.10.): Werkstatt-Prozesse über `Leistung.prozessId`, Pakete über `zuordnung` — nur Name, Kennung, Link.
 * Ein Werkstatt-Prozess an einem Produkt startet mit jedem neuen Mandat dieses Produkts; das steht vorne im Auslöser des Steckbriefs.
 */
async function mitProdukten(l: readonly ProzessDef[], katalog: readonly import('@/lib/crm/typen').Leistung[], zuordnung: Readonly<Record<string, { vorlageId: string }>>): Promise<ProzessDef[]> {
  const [{ produkteVonProzess, produkteVonVorlage }, { WEG }] = await Promise.all([import('./produkt-bindung'), import('@/lib/wege')]);
  return l.map(p => {
    const v = p.quelle === 'werkstatt' ? produkteVonProzess(katalog, p.id) : p.quelle === 'vorlage' ? produkteVonVorlage(katalog, zuordnung, p.id) : [];
    if (!v.length) return p;
    const steckbrief = p.quelle === 'werkstatt' ? { ...p.steckbrief, ausloeser: `Neues Mandat bzw. Zusatzmodul des Produkts · ${p.steckbrief.ausloeser}` } : p.steckbrief;
    return { ...p, steckbrief, produkte: v.map(x => ({ id: x.id, name: x.name, href: WEG.produkt(x.id) })) };
  });
}

/** Die Landkarte (siehe Kopf). */
export async function landkarteLesen(heute = localDay(), o: { privat?: boolean } = {}): Promise<Omit<LandkarteDaten, 'ok'>> {
  const { fulfillmentHaushalt } = await import('@/lib/fulfillment/speicher');
  const h = await fulfillmentHaushalt();
  // `privat` (25.10.): mit Privat-Recht zählen die Fälle der Privat-Arbeits-Einheit mit — der Merker trennt beide Fassungen.
  const privat = o.privat === true;
  return merken(`prozesse-landkarte:${h}:${heute}${privat ? ':privat' : ''}`, 60_000, async () => {
    const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
    const datei = await sicher(() => fulfillmentLesen('vorlagen'));
    // Die Landkarte des Fulfillments (Hochhaus) zuerst, dann Pakete, dann Abläufe — in der Reihenfolge des Bestands.
    const reihe = { landkarte: 0, paket: 1, ablauf: 2 } as const;
    const vorlagen = [...(datei?.prozesse ?? [])].sort((a, b) => (reihe[a.art] ?? 3) - (reihe[b.art] ?? 3));
    // Prozesse der Werkstatt (Etappe B2): je eine Kachel in ihrem Bereich der Fliege — jüngste Version bzw. Entwurf, archivierte fehlen.
    const eintraege = await sicher(async () => (await (await import('./werkstatt-server')).prozesseLesen(h)).prozesse);
    const werkstatt = await sicher(async () => {
      const { prozessAusWerkstatt } = await import('./werkstatt-landkarte');
      return (eintraege ?? []).map(prozessAusWerkstatt).filter((p): p is ProzessDef => !!p);
    });
    const alle: ProzessDef[] = [...SYSTEM_PROZESSE, ...vorlagen.map(v => prozessAusVorlageMit(v, !!datei && inWerkstatt(datei, v.id))).filter((p): p is ProzessDef => !!p), ...(werkstatt ?? [])];
    // Prozesse × Fulfillment (22.10.): welche Produkte auf einen Prozess zeigen (Werkstatt über `Leistung.prozessId`, Pakete über die Zuordnung des Fulfillments).
    const produkte = await sicher(async () => (await import('@/lib/crm/speicher')).ladeCrm());
    const mitProd = produkte ? await mitProdukten(alle, produkte.leistungen, datei?.zuordnung ?? {}) : alle;
    // Stellschrauben (22.10.): die Einstellungen, die die System-Prozesse heute schon lesen — aus den vorhandenen Beständen (nur lesen; geändert wird über
    // deren Routen). Scheitert es ganz, fehlen sie (die Landkarte bleibt, wie sie war).
    const mitSchrauben = await sicher(async () => {
      const { stellschraubenQuellenLesen, mitStellschrauben } = await import('./stellschrauben-server');
      const q = await stellschraubenQuellenLesen(h, { ...(produkte ? { crm: produkte } : {}), ...(datei ? { fulfillment: datei.einstellungen } : {}) });
      return { prozesse: mitStellschrauben(mitProd, q), stand: q.werteStand };
    });
    // Überführung (22.10., Paket Ü): welche System-Prozesse in die Werkstatt umziehen können und wie es steht — dazu am Werkstatt-Prozess, wen er ersetzt.
    const prozesse = (eintraege ? await sicher(async () => (await import('./ueberfuehrung-server')).mitUeberfuehrung(mitSchrauben?.prozesse ?? mitProd, eintraege, h)) : null) ?? mitSchrauben?.prozesse ?? mitProd;
    const [mt, ff] = await Promise.all([sicher(() => markttraktionZahlen(heute)), sicher(() => fulfillmentZahlen(heute, vorlagen, privat))]);
    const arten = { ...(mt ?? {}), ...(ff?.arten ?? {}) };
    const zahlen: Record<string, Zahl> = { ...(ff?.knoten ?? {}) };
    for (const p of prozesse) if (p.zaehler && arten[p.zaehler]) zahlen[p.id] = arten[p.zaehler]!;
    // Kreislauf sehen (30.10.): Werkstatt-Prozesse zeigen ihre Fallzahlen (offen · wartet · fertig der letzten 30 Tage) in derselben Form — nur scharfe Läufe,
    // Läufe zu Mandaten der Privat-Arbeits-Einheit nur mit Privat-Recht (`verborgeneMandate`, dieselbe Grenze wie GET /api/prozesse/laeufe).
    await sicher(async () => {
      const [{ laeufeLesen }, { werkstattFallZahl }, { verborgeneMandate }] = await Promise.all([import('./lauf-server'), import('./kreislauf-heute'), import('@/lib/fulfillment/zugang')]);
      const [l, verborgen] = await Promise.all([laeufeLesen(h), verborgeneMandate(privat)]);
      for (const p of prozesse) {
        if (p.quelle !== 'werkstatt' || zahlen[p.id]) continue;
        const z = werkstattFallZahl(l.laeufe, p.id, heute, verborgen);
        if (z) zahlen[p.id] = z;
      }
    });
    // Eine Null zeigt die Landkarte nie (DESIGN_STANDARD.md) — dann gibt es dort keine Zahl.
    for (const [k, z] of Object.entries(zahlen)) if (!(z.wert > 0) && !((z.zweite?.wert ?? 0) > 0)) delete zahlen[k];
    // Landkarte anpassen (22.10.): die gespeicherten Abweichungen gehen mit — angewendet wird im Bild (lib/prozesse/landkarte-anpassung.ts `landkarteAnsicht`),
    // die Prozesse bleiben hier die der Vorgabe (der Schreibweg vergleicht gegen sie). Ohne Bestand fehlt das Feld (die Antwort wie bisher).
    const anp = await sicher(async () => {
      const [{ anpassungLesen, anpassungStand }, { istVorgabe }] = await Promise.all([import('./landkarte-anpassung-server'), import('./landkarte-anpassung')]);
      const a = await anpassungLesen(h);
      return { anpassung: istVorgabe(a) ? null : a, anpassungStand: anpassungStand(a) };
    });
    const mit = {
      ...(anp ? { ...(anp.anpassung ? { anpassung: anp.anpassung } : {}), anpassungStand: anp.anpassungStand } : {}),
      // Stand des Bestands `prozesse-stellschrauben--<h>` (für 409 beim Ändern einer neuen Stellschraube).
      ...(mitSchrauben?.stand ? { stellschraubenStand: mitSchrauben.stand } : {}),
    };
    return { prozesse, zahlen, ...mit, stand: fingerabdruck({ prozesse, zahlen, ...mit }) };
  });
}
