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

import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { listePatchen, opsLesen } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { deltaAus, staende, StandGedaechtnis } from '@/lib/kontakte/delta';
import { saeubereKontakt, kontaktVereinen, privatNotizVereinen, vonHandMarkieren, fuerPerson, teilAnwenden, massenStufe, pipelineStand, MASSEN_GRENZE, type Kontakt } from '@/lib/make-one/crm';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { zahlungZusammenfuehren, ibanBehalten } from '@/lib/crm/zahlung';
import { personEntfernen } from '@/lib/crm/person-bestaende';

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
  let body: { ops?: unknown; erzwingen?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = opsLesen<Kontakt>(body.ops, saeubereKontakt);
  if (!roh) return NextResponse.json({ error: 'ops muss eine Liste sein.' }, { status: 400 });
  // Private Notizen nur mit ausdrücklicher Person (Regel 5) — ein Dienstaufruf ohne Person sieht sie nicht und fasst sie nicht an.
  const ich = personStreng(req);
  const person = ich ?? undefined;
  // Neue Kontakte: eine private Notiz gehört der Person, die sie anlegt.
  const ops = roh.map(o => (o.op === 'upsert' && o.eintrag ? { ...o, eintrag: ich ? privatNotizVereinen(o.eintrag, undefined, ich) : ohnePrivat(o.eintrag) } : o));

  // Löschen (28.09., F2): eine gelöschte Person verschwindet aus ALLEN Speichern (lib/crm/person-bestaende.ts) —
  // vorher blieben Deals, Follow-ups, Dateien, Head-Vorschläge … mit der toten Kennung stehen. Namen vorher merken (Freitext-Suche).
  const loeschIds = ops.flatMap(o => (o.op === 'delete' && o.id ? [o.id] : []));
  const geloeschtVorher = loeschIds.length ? new Map(((await loadJson<Bestand>('kontakte'))?.kontakte ?? []).filter(k => loeschIds.includes(k.id)).map(k => [k.id, k])) : new Map<string, Kontakt>();

  /** Ergebnisse eines `teil` — beim anschließenden Vereinen ist ihre IBAN schon entschieden. */
  const ausTeil = new WeakSet<Kontakt>();
  const r = await listePatchen<Kontakt, Bestand>('kontakte', 'kontakte', ops, 20, undefined, {
    // Herkunft je Feld (27.09., „Online gewinnt“): was hier von Hand anders wird, überschreibt kein Import mehr.
    // IBAN (28.09., H4): ein ganzer Eintrag aus dem Browser trägt sie nur maskiert (fällt in der Säuberung weg) —
    // dann bleibt die gespeicherte. Ein `teil` hat die IBAN schon gegen den Altstand aufgelöst (ibanEntfernen wirkt).
    vereinen: (neu, alt) => {
      // Ohne Person bleibt die gespeicherte private Notiz, wie sie ist (der Aufrufer kannte sie nicht).
      const v = kontaktVereinen(ich ? neu : { ...ohnePrivat(neu), ...(alt.privatNotiz ? { privatNotiz: alt.privatNotiz, privatNotizVon: alt.privatNotizVon } : {}) }, alt, person);
      const zahlung = ausTeil.has(neu) ? v.zahlung : ibanBehalten(v.zahlung, alt.zahlung);
      return vonHandMarkieren(alt, zahlung === v.zahlung ? v : { ...v, zahlung });
    },
    neu: eintrag => vonHandMarkieren(undefined, eintrag),
    // `teil`: Felder auf den gespeicherten Kontakt legen, dann dieselbe Prüfung wie für einen ganzen Eintrag.
    // `null` = Feld entfernen (28.09., F1 — `teilAnwenden`), danach säubern; `vonHandMarkieren` (im `vereinen`) zählt das Leeren als von Hand.
    // Löschmarken setzt nur der Server (es gelten die gespeicherten); die IBAN kommt maskiert zurück und bleibt, wenn keine neue gültige kommt (28.09., H4).
    teil: (alt, felder) => {
      const eigene = ich ? felder : ohnePrivat(felder as Pick<Kontakt, 'privatNotiz' | 'privatNotizVon'>) as Record<string, unknown>;
      const zahlung = eigene.zahlung !== undefined && eigene.zahlung !== null ? { zahlung: zahlungZusammenfuehren(eigene.zahlung, alt.zahlung) } : {};
      const k = saeubereKontakt({ ...teilAnwenden(alt, eigene), ...zahlung });
      if (k) ausTeil.add(k);
      return k;
    },
    // Massen-Wache INNERHALB der Sperre: wie viele Stufen würden sich ändern?
    pruefen: (liste, ops) => {
      if (body.erzwingen) return null;
      const nachher = ops.flatMap(o => (o.op === 'upsert' && o.eintrag ? [o.eintrag] : o.op === 'teil' && typeof o.felder?.stufe === 'string' ? [{ ...(liste.find(k => k.id === o.id) ?? { id: o.id }), stufe: o.felder.stufe } as Kontakt] : []));
      const wechsel = massenStufe(liste, nachher);
      return wechsel > MASSEN_GRENZE ? `${wechsel} Kontakte würden die Stufe wechseln — das braucht eine ausdrückliche Bestätigung.` : null;
    },
  });
  if (!r.ok) return NextResponse.json({ error: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte.map(k => ({ ...k, aktuell: k.aktuell ? sicht(k.aktuell as Kontakt, ich) : undefined })) } : {}) }, { status: 409 });
  for (const id of loeschIds) if (geloeschtVorher.has(id) && !(r.next?.kontakte ?? []).some(k => k.id === id)) await personEntfernen(id, geloeschtVorher.get(id));
  return NextResponse.json({ ok: true, angewandt: r.angewandt, zeilen: r.zeilen ?? [], stand: pipelineStand(r.next?.kontakte ?? []) });
}
