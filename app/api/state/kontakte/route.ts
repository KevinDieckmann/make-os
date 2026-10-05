// ─── MAKE OS — Kontakte (das CRM) ───────────────────────────────────────────
// GET: alle Kontakte plus Stand der Pipeline. 443 Einträge sind klein genug,
// dass die Oberfläche selbst filtert — eine Suche über die Schnittstelle
// wäre eine zweite Wahrheit darüber, was „passt".
// PATCH: einzelne Änderungen (upsert/teil/delete) nach dem Zwei-Fenster-Muster —
// mit der Massen-Wache für Stufen: mehr als zwölf Kontakte auf einmal in
// eine andere Stufe ist nie ein Klick, sondern ein Fehler.
//
// Datenschicht Stufe 2 (27.09.):
//  · jede Zeile trägt `stand` (Fingerabdruck, lib/store/fingerabdruck.ts); der Browser
//    schickt ihn mit — passt er nicht mehr, 409 mit dem aktuellen Datensatz
//  · `teil`: nur Felder ändern (Kevin und Malin überschreiben sich nicht mehr)
//  · Delta: kennt der Server den Stand, den der Browser hat (ETag), gehen nur die
//    geänderten Zeilen und die gelöschten Kennungen über die Leitung
//  · Massen-Wache und Massenlösch-Schutz laufen in der Schreibsperre
//  · IBAN (28.09., H4): geht nur maskiert hinaus (`fuerPerson`), ein maskierter/leerer Wert
//    beim Speichern heißt „unverändert“; Löschmarken im Verlauf setzt nur /api/crm/aktivitaet
//  · Felder leeren (28.09., Prüfbericht F1): im `teil` heißt `null` „Feld entfernen“ (`teilAnwenden`)
//  · Private Notizen (28.09., F1, Regel 5): nur mit ausdrücklicher Person (`personStreng`) —
//    ein Dienstaufruf ohne Person bekommt keine, und was er schreibt, lässt sie stehen
//  · Zugang (28.09., K1 #66/#67): nur Haushalt des Inhabers (`karteiZugang`) — Dienstweg mit Person nur,
//    wenn die Person dazugehört; sonst 403
//  · Datenschutz (28.09., U2): Einwilligungen, „geprüft“, Hinweis bei Erhebung stempelt der Server
//    (`datenschutzStempeln`); Einschränkung (Art. 18) und Fristverlängerung ändert nur /api/crm/datenschutz;
//    eine eingeschränkte Person ist nicht bearbeitbar, eine neue Einwilligung braucht Wortlaut + Beleg (409)

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { deltaAus, staende, StandGedaechtnis } from '@/lib/kontakte/delta';
import { saeubereKontakt, kontaktVereinen, privatNotizVereinen, fuerPerson, teilAnwenden, massenStufe, pipelineStand, MASSEN_GRENZE, serverStempel, bezuegeSynchron, sperreAufhebenPruefen, sperreAufhebenVermerk, sperreBehalten, kontaktZuGross, type Kontakt } from '@/lib/make-one/crm';
import { sperren, entsperren, sperrlisteLaden, neuanlageSperre, SPERR_HINWEIS } from '@/lib/crm/sperrliste';
import { localDay } from '@/lib/zeit';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { karteiZugang, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { zahlungZusammenfuehren, ibanBehalten } from '@/lib/crm/zahlung';
import { personEntfernen, art17Vormerken, art17Verwerfen } from '@/lib/crm/person-bestaende';
import { ladeCrm } from '@/lib/crm/speicher';
import { firmaWechselAnwenden, firmaWechselFehlt, istFirmaWechsel, FIRMA_WECHSEL_FEHLT } from '@/lib/crm/stationen';
import { datenschutzStempeln, pruefeDatenschutz } from '@/lib/crm/datenschutz-stempel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bestand = { kontakte: Kontakt[] };

/** Fingerabdrücke je ausgeliefertem Stand — für das Delta (letzte 20 Stände, je Person eigener ETag). */
const gedaechtnis = new StandGedaechtnis(20);

/** Ohne private Notiz — für Dienstaufrufe ohne ausdrückliche Person. */
function ohnePrivat<K extends Pick<Kontakt, 'privatNotiz' | 'privatNotizVon'>>(k: K): K {
  if (k.privatNotiz === undefined && k.privatNotizVon === undefined) return k;
  const { privatNotiz: _n, privatNotizVon: _v, ...rest } = k;
  return rest as K;
}
/** Was hinausgeht: mit Person deren Sicht (`fuerPerson`), ohne Person keine private Notiz — IBAN immer maskiert. */
const sicht = (k: Kontakt, ich: string | null): Kontakt => (ich ? fuerPerson(k, ich) : ohnePrivat(fuerPerson(k, '')));

export async function GET(req: Request) {
  // Haushalt des Inhabers (28.09., K1 #66/#67) — vorher reichte „angemeldet“.
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  // Nie Rückfall auf „kevin“ (Regel 5): ohne ausdrückliche Person keine privaten Notizen.
  const ich = personStreng(req);
  // Der Abgleich fragt alle 20 Sekunden — unverändert gibt es 304 statt 750 KB (lib/http/json-antwort.ts).
  const etag = etagAus('k3', await speicherStand(['kontakte']), ich ?? '-ohne-person');
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const f = await loadJson<Bestand>('kontakte');
  // Stand VOR dem Ausblenden fremder privater Notizen rechnen — er beschreibt den gespeicherten Datensatz.
  const alle = mitStand(f?.kontakte ?? []).map(k => sicht(k, ich) as Kontakt & { stand: string });
  const stand = pipelineStand(alle);
  const alt = gedaechtnis.hole(req.headers.get('if-none-match'));
  gedaechtnis.merke(etag, staende(alle));
  if (alt && !new URL(req.url).searchParams.has('voll')) {
    const d = deltaAus(alt, alle);
    // Lohnt sich nur, wenn wirklich wenig anders ist — sonst ist die volle Liste einfacher.
    if (d.geaendert.length + d.geloescht.length <= Math.max(20, alle.length / 4)) return jsonAntwort(req, { delta: true, kontakte: d.geaendert, geloescht: d.geloescht, stand }, etag);
  }
  return jsonAntwort(req, { kontakte: alle, stand }, etag);
}

export async function PATCH(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  // Alter Tab nach dem Hochladen (29.09., A2): fremde Build-Kennung → 409 „bitte neu laden“ statt alter Regeln.
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let body: { ops?: unknown; erzwingen?: boolean };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Nie abschneiden (K2): zu viele Aktivitäten/Einwilligungen an einem Kontakt → 413 statt stillem Kürzen.
  const zuViel = Array.isArray(body.ops) ? (body.ops as ({ eintrag?: unknown; felder?: unknown } | null)[]).map(o => kontaktZuGross(o?.eintrag) ?? kontaktZuGross(o?.felder)).find(Boolean) : null;
  if (zuViel) return NextResponse.json({ error: zuViel }, { status: 413 });
  const roh = opsLesen<Kontakt>(body.ops, saeubereKontakt);
  // Mehr als 200 auf einmal: ablehnen, nie still kürzen (28.09., K1).
  if (!roh) return NextResponse.json({ error: opsFehler(body.ops) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  // Private Notizen nur mit ausdrücklicher Person (Regel 5) — ein Dienstaufruf ohne Person sieht sie nicht und fasst sie nicht an.
  const ich = personStreng(req);
  const person = ich ?? undefined;
  // Neue Kontakte: eine private Notiz gehört der Person, die sie anlegt.
  const ops = roh.map(o => (o.op === 'upsert' && o.eintrag ? { ...o, eintrag: ich ? privatNotizVereinen(o.eintrag, undefined, ich) : ohnePrivat(o.eintrag) } : o));

  // Löschen (28.09., F2): eine gelöschte Person verschwindet aus ALLEN Speichern (lib/crm/person-bestaende.ts) —
  // vorher blieben Deals, Follow-ups, Dateien, Head-Vorschläge … mit der toten Kennung stehen. Namen vorher merken (Freitext-Suche).
  const loeschIds = ops.flatMap(o => (o.op === 'delete' && o.id ? [o.id] : []));
  const geloeschtVorher = loeschIds.length ? new Map(((await loadJson<Bestand>('kontakte'))?.kontakte ?? []).filter(k => loeschIds.includes(k.id)).map(k => [k.id, k])) : new Map<string, Kontakt>();
  // Absichtsprotokoll (29.09., Paket D-C #17): VOR dem Löschen in der Kartei die Merkmale festhalten — bricht der Lauf
  // nach dem Kartei-Schreiben ab, räumt die Wiederaufnahme alle übrigen Speicher (mit Name/Adressen) nach. Wird das
  // Löschen abgelehnt (Art. 18, Stand), verfällt die Vormerkung.
  for (const [id, k] of Array.from(geloeschtVorher)) if (!k.eingeschraenkt) await art17Vormerken(id, k, { person, quelle: 'kartei' });

  /** Ergebnisse eines `teil` — beim anschließenden Vereinen ist ihre IBAN schon entschieden. */
  const ausTeil = new WeakSet<Kontakt>();
  /** Werbesperre mit Nachweis aufgehoben (K2 #64) — nach dem Schreiben von der Sperrliste nehmen. */
  const aufgehoben: Kontakt[] = [];
  // Server-Felder (K2 #68): geaendertAm/importiertAm/vonHand stempelt der Server — Browser-Werte zählen nicht.
  const heute = localDay();
  // Stationen/E-Mails (28.09.): `firmaId`/`firma`/`position` und `email` folgen der Hauptstation bzw. Haupt-Adresse
  // (`bezuegeSynchron`). Firmennamen nur laden, wenn eine Änderung Firma oder Stationen berührt.
  const firmaBeruehrt = ops.some(o => o.op === 'upsert' || (o.op === 'teil' && !!o.felder && ('stationen' in o.felder || 'firmaId' in o.felder)));
  const firmenNamen = firmaBeruehrt ? new Map((await ladeCrm()).firmen.map(f => [f.id, f.name])) : new Map<string, string>();
  const firmaName = (id: string) => firmenNamen.get(id);
  // U2 (28.09.): Datenschutz-Felder stempelt der Server — Person aus der Sitzung, sonst „system“ (nie „kevin“, Regel 5).
  const jetztIso = new Date().toISOString();
  const ds = (neu: Kontakt, alt: Kontakt | undefined) => datenschutzStempeln(neu, alt, ich ?? 'system', jetztIso, heute);
  // Sperrliste bei Neuanlage (28.09., Ablaufprüfung): Kartei, Visitenkarte, Einlass legen hier an — steht die neue Person
  // auf der Sperrliste, bekommt sie die Werbesperre (nicht blockiert, wie der Import es prüft) und die Antwort einen Hinweis.
  const sperrEintraege = ops.some(o => o.op === 'upsert') ? await sperrlisteLaden() : [];
  const neuGesperrt: string[] = [];
  const r = await listePatchen<Kontakt, Bestand>('kontakte', 'kontakte', ops, 20, undefined, {
    // Änderungsprotokoll (28.09., K1 #44): wer — aus der Sitzung bzw. dem Dienstweg, nie aus dem Body.
    wer: werAus(req),
    // Herkunft je Feld (27.09., „Online gewinnt“): was hier von Hand anders wird, überschreibt kein Import mehr.
    // IBAN (28.09., H4): ein ganzer Eintrag aus dem Browser trägt sie nur maskiert (fällt in der Säuberung weg) —
    // dann bleibt die gespeicherte. Ein `teil` hat die IBAN schon gegen den Altstand aufgelöst (ibanEntfernen wirkt).
    vereinen: (neu, alt) => {
      // Ohne Person bleibt die gespeicherte private Notiz, wie sie ist (der Aufrufer kannte sie nicht).
      const v = kontaktVereinen(ich ? neu : { ...ohnePrivat(neu), ...(alt.privatNotiz ? { privatNotiz: alt.privatNotiz, privatNotizVon: alt.privatNotizVon } : {}) }, alt, person);
      const zahlung = ausTeil.has(neu) ? v.zahlung : ibanBehalten(v.zahlung, alt.zahlung);
      const mitZahlung = zahlung === v.zahlung ? v : { ...v, zahlung };
      // K2: ein ganzer Eintrag hebt eine Sperre nie auf (Sperre gewinnt) — nur ein geprüfter `teil` mit Nachweis.
      return serverStempel(bezuegeSynchron(ds(ausTeil.has(neu) ? mitZahlung : sperreBehalten(mitZahlung, alt), alt), alt, heute, firmaName), alt, heute);
    },
    neu: roh => {
      const s = neuanlageSperre(roh, sperrEintraege, heute);
      if (s.hinweis) neuGesperrt.push(roh.id);
      return serverStempel(bezuegeSynchron(ds(s.kontakt, undefined), undefined, heute, firmaName), undefined, heute);
    },
    // `teil`: Felder auf den gespeicherten Kontakt legen, dann dieselbe Prüfung wie für einen ganzen Eintrag.
    // `null` = Feld entfernen (28.09., F1 — `teilAnwenden`), danach säubern; `vonHandMarkieren` (im `vereinen`) zählt das Leeren als von Hand.
    // Löschmarken setzt nur der Server (es gelten die gespeicherten); die IBAN kommt maskiert zurück und bleibt, wenn keine neue gültige kommt (28.09., H4).
    teil: (alt, roh) => {
      // Firma ändern mit Absicht (Kevin 28.09.): `firmaWechsel` wird hier in Stationen übersetzt und nie gespeichert.
      // „Korrektur“ ohne gespeicherte Stationen bleibt der einfache Altweg (nichts Neues zu schreiben).
      const { firmaWechsel: absicht, ...felder } = roh;
      if (istFirmaWechsel(absicht) && 'firmaId' in felder && !('stationen' in felder) && !(absicht === 'korrektur' && !Array.isArray(alt.stationen))) {
        const nach = typeof felder.firmaId === 'string' && felder.firmaId ? felder.firmaId : undefined;
        felder.stationen = firmaWechselAnwenden(alt, nach, absicht, heute, typeof felder.position === 'string' ? felder.position : undefined);
      }
      const eigene = ich ? felder : ohnePrivat(felder as Pick<Kontakt, 'privatNotiz' | 'privatNotizVon'>) as Record<string, unknown>;
      const zahlung = eigene.zahlung !== undefined && eigene.zahlung !== null ? { zahlung: zahlungZusammenfuehren(eigene.zahlung, alt.zahlung) } : {};
      const gesaeubert = saeubereKontakt({ ...teilAnwenden(alt, eigene), ...zahlung });
      // Werbesperre aufgehoben (geprüft in `pruefen`): System-Aktivität mit Nachweis, danach raus aus der Sperrliste.
      const k = gesaeubert && alt.werbesperre && !gesaeubert.werbesperre ? sperreAufhebenVermerk(alt, gesaeubert, ich ?? 'system', new Date().toISOString()) : gesaeubert;
      if (k && alt.werbesperre && !k.werbesperre) aufgehoben.push(k);
      if (k) ausTeil.add(k);
      return k;
    },
    // Massen-Wache INNERHALB der Sperre: wie viele Stufen würden sich ändern?
    pruefen: (liste, ops) => {
      // Datenschutz (U2): eingeschränkte Person nicht bearbeiten (Art. 18), neue Einwilligung nur mit Wortlaut + Beleg — auch mit `erzwingen`.
      for (const o of ops) {
        // Art. 18: eine eingeschränkte Person wird aufbewahrt — Löschen erst nach dem Aufheben (mit Grund).
        if (o.op === 'delete') { if (liste.find(k => k.id === o.id)?.eingeschraenkt) return 'Die Verarbeitung dieser Person ist eingeschränkt (Art. 18) — sie wird aufbewahrt. Erst die Einschränkung mit Grund aufheben, dann löschen.'; continue; }
        const alt = liste.find(k => k.id === (o.op === 'teil' ? o.id : o.eintrag?.id));
        const grund = o.op === 'teil' ? pruefeDatenschutz(alt, { art: 'teil', felder: o.felder ?? {} }, heute) : o.eintrag ? pruefeDatenschutz(alt, { art: 'upsert', eintrag: o.eintrag }, heute) : null;
        if (grund) return grund;
      }
      // Werbesperre aufheben nur mit Einwilligungs-Nachweis im selben Schritt (K2 #64) — gilt auch mit `erzwingen`.
      for (const o of ops) {
        if (o.op !== 'teil') continue;
        const alt = liste.find(k => k.id === o.id);
        const grund = alt ? sperreAufhebenPruefen(alt, o.felder ?? {}) : null;
        if (grund) return grund;
      }
      // Firma geändert ohne Absicht, obwohl Stationen gespeichert sind (Kevin 28.09.): ablehnen statt still beenden.
      for (const o of ops) {
        const alt = liste.find(k => k.id === (o.op === 'teil' ? o.id : o.eintrag?.id));
        if (o.op === 'teil' && firmaWechselFehlt(alt, o.felder ?? {})) return FIRMA_WECHSEL_FEHLT;
        if (o.op === 'upsert' && o.eintrag && firmaWechselFehlt(alt, o.eintrag as unknown as Record<string, unknown>, true)) return FIRMA_WECHSEL_FEHLT;
      }
      if (body.erzwingen) return null;
      const nachher = ops.flatMap(o => (o.op === 'upsert' && o.eintrag ? [o.eintrag] : o.op === 'teil' && typeof o.felder?.stufe === 'string' ? [{ ...(liste.find(k => k.id === o.id) ?? { id: o.id }), stufe: o.felder.stufe } as Kontakt] : []));
      const wechsel = massenStufe(liste, nachher);
      return wechsel > MASSEN_GRENZE ? `${wechsel} Kontakte würden die Stufe wechseln — das braucht eine ausdrückliche Bestätigung.` : null;
    },
  });
  if (!r.ok) {
    for (const id of Array.from(geloeschtVorher.keys())) await art17Verwerfen(id, 'kartei');
    return NextResponse.json({ error: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte.map(k => ({ ...k, aktuell: k.aktuell ? sicht(k.aktuell as Kontakt, ich) : undefined })) } : {}) }, { status: 409 });
  }
  // Sperrliste (K2 #60/#64): neue Sperren eintragen (idempotent), mit Nachweis aufgehobene austragen.
  const geschrieben = new Set((r.zeilen ?? []).map(z => z.id));
  const gesperrt = (r.next?.kontakte ?? []).filter(k => geschrieben.has(k.id) && k.werbesperre);
  if (gesperrt.length) await sperren(gesperrt, 'werbesperre', heute);
  for (const k of aufgehoben) await entsperren(k);
  for (const id of loeschIds) {
    if (!geloeschtVorher.has(id)) continue;
    if (!(r.next?.kontakte ?? []).some(k => k.id === id)) await personEntfernen(id, geloeschtVorher.get(id), { person });
    else await art17Verwerfen(id, 'kartei'); // nicht gelöscht → die Vormerkung verfällt
  }
  return NextResponse.json({ ok: true, angewandt: r.angewandt, zeilen: r.zeilen ?? [], stand: pipelineStand(r.next?.kontakte ?? []), ...(neuGesperrt.length ? { hinweis: SPERR_HINWEIS, gesperrtNeu: neuGesperrt } : {}) });
}
