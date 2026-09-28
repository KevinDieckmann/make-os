// ─── Markttraktion · Zahlungsmöglichkeiten eines Kunden (rein, getestet, 28.09.) ──
// Kevin (Kontakt öffnen, Reiter „Umsatz“): „… aber auch die Zahlungsmöglichkeiten.“
// Zahlungsweg, Zahlungsziel, Rechnungsempfänger, USt-IdNr., Referenz des Kunden,
// bei SEPA Mandatsreferenz und -datum. Gespeichert an der Firma (`Firma.zahlung`),
// bei einer Person ohne Firma an der Person (`Kontakt.zahlung`).
//
// IBAN: liegt wie alles im verschlüsselten Bestand, wird in der Oberfläche NUR
// maskiert gezeigt (`ibanMaskiert`), geht in keinen Export und an keinen Agenten
// (`zahlungOhneIban` für jeden Weg nach draußen). Client-sicher: keine Server-Importe.

import type { Zahlungsdaten, Zahlungsweg } from './typen';

export const ZAHLUNGSWEGE: readonly { id: Zahlungsweg; label: string }[] = [
  { id: 'ueberweisung', label: 'Überweisung' },
  { id: 'sepa', label: 'SEPA-Lastschrift' },
  { id: 'karte', label: 'Kreditkarte / PayPal-Link' },
  { id: 'bar', label: 'Bar' },
];
export const ZAHLUNGSWEG_LABEL = Object.fromEntries(ZAHLUNGSWEGE.map(w => [w.id, w.label])) as Record<Zahlungsweg, string>;

/** Zahlungsziel: höchstens so viele Tage. */
export const ZIEL_MAX_TAGE = 180;

const txt = (v: unknown, n: number) => { const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** IBAN in Grundform: ohne Leerzeichen, groß. */
export const ibanGrundform = (v: unknown) => String(v ?? '').replace(/[\s-]+/g, '').toUpperCase();

/** Ist das eine gültige IBAN (Aufbau + Prüfziffer nach ISO 13616, Modulo 97)? */
export function ibanGueltig(v: unknown): boolean {
  const i = ibanGrundform(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(i)) return false;
  if (i.startsWith('DE') && i.length !== 22) return false;
  const umgestellt = `${i.slice(4)}${i.slice(0, 4)}`;
  let rest = 0;
  for (const z of umgestellt) {
    const wert = /\d/.test(z) ? z : String(z.charCodeAt(0) - 55);
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

/** Die einzige Form, in der eine IBAN auf dem Bildschirm steht: Länderkennung + Prüfziffer, Rest verdeckt, letzte vier. */
export function ibanMaskiert(v: unknown): string | undefined {
  const i = ibanGrundform(v);
  if (i.length < 8) return undefined;
  return `${i.slice(0, 4)} •••• •••• ${i.slice(-4)}`;
}

/** Nur https-Links (Zahlungslink, z. B. PayPal) — nie javascript: o. Ä. */
function link(v: unknown): string | undefined {
  const t = String(v ?? '').trim().slice(0, 400);
  return /^https:\/\/[^\s<>"]+$/i.test(t) ? t : undefined;
}

/**
 * Zahlungsdaten aus dem Netz prüfen — was nicht passt, fällt weg. Eine IBAN mit
 * falscher Prüfziffer wird NICHT gespeichert (lieber leer als falsch). Liefert
 * undefined, wenn nichts übrig bleibt (dann entfällt das Feld).
 */
export function zahlungSaeubern(v: unknown): Zahlungsdaten | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const weg = ZAHLUNGSWEGE.some(w => w.id === o.weg) ? (o.weg as Zahlungsweg) : undefined;
  const ziel = Number(o.zielTage);
  const e = o.empfaenger && typeof o.empfaenger === 'object' ? o.empfaenger as Record<string, unknown> : {};
  const mail = txt(e.email, 160)?.toLowerCase();
  const empfaenger = {
    ...(txt(e.name, 160) ? { name: txt(e.name, 160) } : {}),
    ...(mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? { email: mail } : {}),
    ...(txt(e.anschrift, 300) ? { anschrift: txt(e.anschrift, 300) } : {}),
  };
  const iban = ibanGueltig(o.iban) ? ibanGrundform(o.iban) : undefined;
  const s = o.sepa && typeof o.sepa === 'object' ? o.sepa as Record<string, unknown> : {};
  const sepa = { ...(txt(s.mandatsreferenz, 35) ? { mandatsreferenz: txt(s.mandatsreferenz, 35) } : {}), ...(tag(s.datum) ? { datum: tag(s.datum) } : {}) };
  const ust = txt(o.ustId, 20)?.replace(/\s+/g, '').toUpperCase();
  const d: Zahlungsdaten = {
    ...(weg ? { weg } : {}),
    ...(Number.isFinite(ziel) && ziel >= 0 && String(o.zielTage ?? '') !== '' ? { zielTage: Math.min(ZIEL_MAX_TAGE, Math.round(ziel)) } : {}),
    ...(Object.keys(empfaenger).length ? { empfaenger } : {}),
    ...(ust && /^[A-Z]{2}[A-Z0-9+*.]{2,13}$/.test(ust) ? { ustId: ust } : {}),
    ...(txt(o.referenz, 80) ? { referenz: txt(o.referenz, 80) } : {}),
    ...(iban ? { iban } : {}),
    ...(weg === 'sepa' && Object.keys(sepa).length ? { sepa } : {}),
    ...(link(o.link) ? { link: link(o.link) } : {}),
    ...(txt(o.notiz, 400) ? { notiz: txt(o.notiz, 400) } : {}),
  };
  if (!Object.keys(d).length) return undefined;
  return { ...d, ...(txt(o.geaendert, 25) ? { geaendert: txt(o.geaendert, 25) } : {}), ...(/^[a-z0-9-]{1,40}$/.test(String(o.geaendertVon ?? '')) ? { geaendertVon: String(o.geaendertVon) } : {}) };
}

/** Für jeden Weg nach draußen (Export, Agenten, Zusammenfassungen): alles außer der IBAN. */
export function zahlungOhneIban(z: Zahlungsdaten | undefined): Omit<Zahlungsdaten, 'iban'> | undefined {
  if (!z) return undefined;
  const { iban: _iban, ...rest } = z; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

// ── IBAN serverseitig maskieren (28.09., Paket H4) ─────────────────────────────
// Kein Weg an den Browser trägt die volle IBAN: Bestand (/api/crm/bestand) und Kartei
// (/api/state/kontakte und alle Routen, die einen Kontakt zurückgeben — über
// `fuerPerson`) liefern `iban` nur maskiert plus `ibanGesetzt: true`.
// Beim Speichern heißt ein maskierter, leerer oder fehlender IBAN-Wert „unverändert“
// (die gespeicherte bleibt); nur eine neue gültige IBAN ersetzt; Entfernen geht nur
// ausdrücklich über `ibanEntfernen: true`. Ausnahme: die Auskunft nach Art. 15.

/** Die Form für den Browser: IBAN maskiert, dazu `ibanGesetzt`. Ohne IBAN unverändert. */
export function zahlungMaskiert<Z extends Zahlungsdaten | undefined>(z: Z): Z {
  if (!z?.iban) return z;
  return { ...z, iban: ibanMaskiert(z.iban), ibanGesetzt: true } as Z;
}

/** `maskiereIban` — dieselbe Maskierung für eine einzelne IBAN (Name aus dem Auftrag H4). */
export const maskiereIban = ibanMaskiert;

/**
 * Eingehende Zahlungsdaten (roh, aus dem Netz) auf die gespeicherten legen:
 * neue gültige IBAN → ersetzt; sonst `ibanEntfernen: true` → weg; sonst bleibt die gespeicherte.
 * Danach dieselbe Säuberung wie immer (`zahlungSaeubern`).
 */
export function zahlungZusammenfuehren(roh: unknown, alt: Zahlungsdaten | undefined): Zahlungsdaten | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  const neueIban = ibanGueltig(o.iban) ? ibanGrundform(o.iban) : undefined;
  const iban = neueIban ?? (o.ibanEntfernen === true ? undefined : alt?.iban);
  return zahlungSaeubern({ ...o, iban });
}

/** Für schon gesäuberte Daten (ganzer Eintrag): trägt der neue Stand keine IBAN, bleibt die gespeicherte. */
export function ibanBehalten(neu: Zahlungsdaten | undefined, alt: Zahlungsdaten | undefined): Zahlungsdaten | undefined {
  if (neu?.iban || !alt?.iban) return neu;
  return { ...(neu ?? {}), iban: alt.iban };
}

/** Für die Anzeige: dieselben Daten, die IBAN nur maskiert. */
export function zahlungFuerAnzeige(z: Zahlungsdaten | undefined): (Omit<Zahlungsdaten, 'iban'> & { ibanMaskiert?: string }) | undefined {
  if (!z) return undefined;
  const rest = zahlungOhneIban(z)!;
  return { ...rest, ...(z.iban ? { ibanMaskiert: ibanMaskiert(z.iban) } : {}) };
}

/** Wo stehen die Zahlungsdaten dieses Kontakts? An der Firma, wenn es eine gibt — sonst an der Person. */
export function zahlungsQuelle(k: { firmaId?: string }, firma: { id: string } | undefined): 'firma' | 'kontakt' {
  return k.firmaId && firma ? 'firma' : 'kontakt';
}

/** Was fehlt noch für eine saubere Rechnung? (Hinweise, keine Pflicht) */
export function zahlungLuecken(z: Zahlungsdaten | undefined): string[] {
  const l: string[] = [];
  if (!z?.weg) l.push('Zahlungsweg');
  if (z?.zielTage == null) l.push('Zahlungsziel');
  if (!z?.empfaenger?.name) l.push('Rechnungsempfänger');
  if (!z?.empfaenger?.email && !z?.empfaenger?.anschrift) l.push('Anschrift oder Rechnungs-E-Mail');
  if (z?.weg === 'sepa' && (!z.iban || !z.sepa?.mandatsreferenz || !z.sepa?.datum)) l.push('SEPA-Mandat (IBAN, Referenz, Datum)');
  return l;
}
