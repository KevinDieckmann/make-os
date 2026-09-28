// ─── CRM — Kanal-Ampel nach DSGVO und § 7 UWG (rein, getestet) ─────────────
// Keine Rechtsberatung — einmal anwaltlich gegenlesen lassen. Die Regeln
// R1–R9 aus docs/konzepte/crm-sales-marketing-events.md als Code:
//   R1 Werbung per Mail/LinkedIn/Social nur mit Einwilligung oder § 7 Abs. 3
//      (LinkedIn-Nachrichten gelten als elektronische Post, OLG Hamm)
//   R2 Bestandskunde nur, wenn es ein Mandat gibt — Widerspruchshinweis Pflicht
//   R3 Telefon B2B nur mit mutmaßlicher Einwilligung: konkreter Anlass aus einer
//      bestehenden Beziehung, nicht „passt zum Betrieb“
//   R4 Kommunikation im laufenden Mandat und Antworten auf Anfragen sind frei
//   R9 Werbesperre sperrt alles, sofort
//   U2 (28.09.): Einschränkung nach Art. 18 sperrt alles wie die Werbesperre; werbliche
//      Mail grün nur mit VOLLEM Einwilligungs-Nachweis (Zeitpunkt, wer, Wortlaut, Beleg —
//      Altbestand gelb); Bestandskunde grün nur mit Mandat UND Vermerk „Hinweis bei
//      Erhebung erteilt“ (§ 7 Abs. 3 Nr. 4 UWG), sonst gelb mit Grund
// Ergebnis ist eine Ampel je Kanal: grün (Grundlage da), gelb (vertretbar,
// mit Bedingung), rot (nicht zulässig — nur „Grundlage klären“).
// In KEMARIS Operations prüfte nur der Mail-Versand die Einwilligung, Telefon
// und LinkedIn gar nicht, und die Sperre wurde nirgends gelesen — hier gilt
// die Ampel für jede Karte, jeden Entwurf und jedes Agentenpaket.

import type { Kontakt, EinwilligungKanal, Einwilligung } from '@/lib/make-one/crm';
import { hatTyp } from './mehrfach';
import { nachweisLuecken } from './einwilligung';

export type Kanal = 'mail' | 'linkedin' | 'telefon' | 'newsletter' | 'einladung' | 'vernetzen';
export type Farbe = 'gruen' | 'gelb' | 'rot';
export interface KanalStatus { kanal: Kanal; farbe: Farbe; grund: string; grundlage?: string }

export interface Kontext {
  /** Es gibt ein aktives Mandat oder eine Rechnung mit dieser Person. */
  hatMandat?: boolean;
  /** Es gibt eine offene Chance (bestehende geschäftliche Beziehung). */
  hatChance?: boolean;
}

/** Die tragfähigste gültige Einwilligung des Kanals: voller Nachweis vor unvollständigem, echte Einwilligung vor Anfrage (U2). */
const gueltig = (k: Kontakt, kanal: EinwilligungKanal) => {
  const l = (k.einwilligungen ?? []).filter(e => e.kanal === kanal && !e.widerrufenAm);
  const rang = (e: Einwilligung) => (e.grundlage === 'anfrage' ? 2 : nachweisLuecken(e).length ? 1 : 0);
  return l.reduce<Einwilligung | undefined>((best, e) => (!best || rang(e) < rang(best) ? e : best), undefined);
};
/** Persönlich bekannt: Netzwerk, Kreis A/B, oder schon im Gespräch gewesen. */
export function bekannt(k: Kontakt): boolean {
  return k.kreis === 'A' || k.kreis === 'B' || hatTyp(k, 'Netzwerk') || k.lebensphase === 'partner' || k.lebensphase === 'multiplikator'
    || ['gespraech', 'termin', 'angebot', 'gewonnen'].includes(k.stufe) || (k.aktivitaeten ?? []).some(a => a.art === 'antwort' || a.art === 'gespraech' || a.art === 'termin');
}

export function kanalStatus(k: Kontakt, kanal: Kanal, ctx: Kontext = {}): KanalStatus {
  if (k.eingeschraenkt) return { kanal, farbe: 'rot', grund: `Verarbeitung eingeschränkt (Art. 18) seit ${k.eingeschraenkt.seit}` };
  if (k.werbesperre) return { kanal, farbe: 'rot', grund: `Werbesperre seit ${k.werbesperre.seit}` };
  const hat = (x: string | undefined) => !!(x ?? '').trim();
  const erreichbar = kanal === 'mail' || kanal === 'newsletter' || kanal === 'einladung' ? hat(k.email) : kanal === 'telefon' ? hat(k.telefon) || hat(k.sms) : hat(k.linkedin);
  if (!erreichbar) return { kanal, farbe: 'rot', grund: 'keine Adresse' };
  const mandat = ctx.hatMandat || k.lebensphase === 'kunde';

  if (kanal === 'newsletter') {
    const e = gueltig(k, 'newsletter');
    return e ? { kanal, farbe: 'gruen', grund: 'Double-Opt-in', grundlage: 'einwilligung' } : { kanal, farbe: 'rot', grund: 'Newsletter nur mit Double-Opt-in' };
  }
  if (kanal === 'vernetzen') {
    // Eine Vernetzungsanfrage ohne Werbebotschaft ist keine elektronische Werbung.
    return { kanal, farbe: 'gruen', grund: 'Vernetzung ohne Werbebotschaft' };
  }
  if (kanal === 'mail' || kanal === 'linkedin' || kanal === 'einladung') {
    const e = gueltig(k, kanal === 'linkedin' ? 'social' : kanal === 'einladung' ? 'einladung' : 'mail') ?? (kanal === 'einladung' ? gueltig(k, 'mail') : undefined);
    // Eine Anfrage erlaubt die Antwort (Vertragsanbahnung), keine Werbung — die braucht weiter die Einwilligung (27.09.).
    if (e && e.grundlage === 'anfrage') return { kanal, farbe: 'gelb', grund: 'Antwort auf Anfrage: antworten ja, Werbung erst mit Einwilligung', grundlage: e.grundlage };
    // Voller Nachweis (U2 #55): ohne Zeitpunkt, wer, Wortlaut und Beleg nicht grün — Altbestand bleibt gültig, aber nicht „frei“.
    const fehlt = e ? nachweisLuecken(e) : [];
    if (e && !fehlt.length) return { kanal, farbe: 'gruen', grund: `Einwilligung vom ${e.erteiltAm}`, grundlage: e.grundlage };
    // Bestandskundenprivileg (U2 #57): nur mit Hinweis auf das Widerspruchsrecht schon bei Erhebung der Adresse.
    if (mandat && k.hinweisBeiErhebung) return { kanal, farbe: 'gruen', grund: 'laufendes Mandat (Bestandskunde) — Widerspruchshinweis in jede Werbung', grundlage: 'bestandskunde_7_3' };
    if (e) return { kanal, farbe: 'gelb', grund: `Einwilligung vom ${e.erteiltAm} — Nachweis unvollständig (fehlt: ${fehlt.join(', ')}), vor Werbung ergänzen`, grundlage: e.grundlage };
    if (mandat) return { kanal, farbe: 'gelb', grund: 'Bestandskunde: Hinweis bei Erhebung fehlt (§ 7 Abs. 3 Nr. 4 UWG) — Vermerk setzen oder Einwilligung einholen', grundlage: 'bestandskunde_7_3' };
    if (bekannt(k)) return { kanal, farbe: 'gelb', grund: 'persönlich bekannt: persönliche Nachricht ja, Werbung erst mit Einwilligung' };
    return { kanal, farbe: 'rot', grund: kanal === 'linkedin' ? 'LinkedIn-Nachricht zählt als elektronische Post — ohne Einwilligung nur Vernetzen' : 'Werbe-Mail ohne Einwilligung ist abmahnfähig — Grundlage klären' };
  }
  // Telefon
  const t = gueltig(k, 'telefon');
  if (t) return { kanal, farbe: 'gruen', grund: `Einwilligung vom ${t.erteiltAm}`, grundlage: t.grundlage };
  if (mandat) return { kanal, farbe: 'gruen', grund: 'laufendes Mandat', grundlage: 'vertrag' };
  if (ctx.hatChance || bekannt(k)) return { kanal, farbe: 'gelb', grund: 'mutmaßliche Einwilligung: nur mit konkretem Anlass aus der Beziehung', grundlage: 'mutmasslich_b2b_tel' };
  return { kanal, farbe: 'rot', grund: 'Kaltanruf ohne Vorkontakt — „passt zum Betrieb“ reicht nicht (§ 7 Abs. 2 UWG)' };
}

export function ampel(k: Kontakt, ctx: Kontext = {}): KanalStatus[] {
  return (['telefon', 'mail', 'linkedin', 'vernetzen'] as Kanal[]).map(x => kanalStatus(k, x, ctx)).filter(s => s.grund !== 'keine Adresse');
}

/** Bester zulässiger Weg — grün vor gelb, Telefon und Mail vor LinkedIn; Vernetzen nur, wenn sonst nichts geht. */
export function besterKanal(k: Kontakt, ctx: Kontext = {}): KanalStatus | null {
  const l = ampel(k, ctx);
  return l.find(s => s.farbe === 'gruen' && s.kanal !== 'vernetzen') ?? l.find(s => s.farbe === 'gelb') ?? l.find(s => s.farbe === 'gruen') ?? null;
}

/** Art.-14-Uhr: Fremddaten ohne Information — ab Tag 25 rot (Frist ein Monat). */
export function art14(k: Kontakt, heute: string): { tage: number; faellig: boolean } | null {
  if (!k.fremddaten || k.art14InformiertAm) return null;
  const seit = Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${(k.importiertAm || heute).slice(0, 10)}T12:00:00Z`)) / 864e5);
  return { tage: seit, faellig: seit >= 25 };
}

/**
 * Anlass-Pflicht beim Anruf (28.09., U2 #58): bei gelber Telefon-Ampel trägt nur die mutmaßliche
 * Einwilligung (§ 7 Abs. 2 Nr. 1 UWG) — dann muss der konkrete Anlass aus der Beziehung an der
 * Aktivität stehen. Grün (Einwilligung, Mandat) braucht keinen, rot ist ohnehin kein Werbeanruf.
 */
export function anlassPflicht(k: Kontakt, ctx: Kontext = {}): boolean {
  return kanalStatus(k, 'telefon', ctx).farbe === 'gelb';
}
