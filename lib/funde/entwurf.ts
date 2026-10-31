// ─── Funde — Mail-Entwurf und Anruf-Leitfaden (rein, getestet; KAMPAGNE_HOMEPAGE_PLAN.md › Kevins Entscheidungen) ─────────────
// Die Mail ist eine VORLAGE (keine KI) — wie die Angebots-Mail des Formulars: kurz, persönlich, genau ein Anliegen, mit Link zur Vorschau,
// dem Angebot aus dem Katalog, Art.-14-Hinweis (Quelle, Zweck, Widerspruch) und Abmeldelink. Sie geht nur nach Freigabe im ZOE-Stapel und
// nur, wenn ein Inhaber „eigenes Risiko“ eingeschaltet hat: Werbe-Mail ohne Einwilligung ist nach § 7 Abs. 2 Nr. 2 UWG unzulässig, die
// Kanal-Ampel bleibt rot (RISIKO_HINWEIS). Der Anruf nach 72 h steht als Follow-up mit Leitfaden an.

import type { Fund, FundEntwurf } from './typen';
import { ANRUF_NACH_TAGEN } from './typen';
import { adresseZeile } from './vorschau';

export const RISIKO_HINWEIS = 'Werbe-Mail und Werbeanruf ohne Einwilligung sind auch an Firmen unzulässig (§ 7 Abs. 2 UWG) und abmahnfähig — die Kanal-Ampel bleibt rot. Freigeschaltet nur auf eigenes Risiko des Inhabers; vorher anwaltlich prüfen lassen. Hinweis, keine Rechtsberatung.';

export interface AngebotKurz { name: string; preis?: string }
export interface EntwurfKontext {
  absender: string;
  /** Öffentlicher Vorschau-Link (erst nach Freigabe bekannt) — im Entwurf steht ein Platzhalter. */
  link?: string;
  abmelden?: string;
  datenschutz: { verantwortlich?: string; mail: string; seite?: string };
  angebot?: AngebotKurz | null;
  /** Unterschrift (Vorname der freigebenden Person, sonst der Absender). */
  unterschrift?: string;
}

export const LINK_PLATZHALTER = '{{vorschau-link}}';
export const ABMELDE_PLATZHALTER = '{{abmelde-link}}';

/** Preis kurz aus dem Katalog: „990 € einmalig“, „ab 29 € / Monat“. */
export function preisKurz(p: { betrag: number; bis?: number; einheit?: string; basis?: 'monat' | 'jahr' | 'einmalig' } | undefined): string | undefined {
  if (!p || !Number.isFinite(p.betrag) || p.betrag <= 0) return undefined;
  const e = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €`;
  const basis = p.basis === 'monat' ? ' / Monat' : p.basis === 'jahr' ? ' / Jahr' : p.basis === 'einmalig' ? ' einmalig' : p.einheit ? ` ${p.einheit}` : '';
  return `${p.bis && p.bis > p.betrag ? `${e(p.betrag)}–${e(p.bis)}` : e(p.betrag)}${basis}`;
}

/** Ein bis zwei Gründe aus der Bewertung, als Satz für die Mail. */
function anlass(f: Pick<Fund, 'bewertung'> & Partial<Pick<Fund, 'analyse'>>): string {
  // Mit Niveau-Analyse: die zwei stärksten Lücken (Gäste-Sicht), sonst die Gründe der Bewertung.
  if (f.analyse?.aufhaenger.length) return `Mir ist bei Ihrer Website aufgefallen: ${f.analyse.aufhaenger.slice(0, 2).map(x => x.replace(/\.$/, '')).join(' Und: ')}.`;
  const b = f.bewertung;
  if (!b || !b.website) return 'Ich habe gesehen, dass Sie noch keine eigene Website haben.';
  if (b.erreichbar === false) return `Ich wollte mir Ihre Website ansehen: ${(b.gruende[0] ?? 'Sie war nicht erreichbar.').replace(/^Die /, 'die ').replace(/^Das /, 'das ')}`;
  const g = b.gruende.filter(x => !/Keine deutlichen/.test(x)).slice(0, 2).map(x => x.replace(/\.$/, ''));
  return g.length ? `Mir ist bei Ihrer Website aufgefallen: ${g.join('; ')}.` : 'Ich habe mir Ihre Website angesehen.';
}

/** Die Mail (Betreff + Text) und der Anruf-Leitfaden. Ohne Link/Abmeldelink stehen Platzhalter — die Freigabe setzt sie ein. */
export function entwurfBauen(f: Pick<Fund, 'name' | 'bewertung' | 'adresse' | 'quelle'> & Partial<Pick<Fund, 'inhaber' | 'inhaberArt' | 'quellen' | 'instagram' | 'mobil' | 'telefon' | 'analyse' | 'branche' | 'icp' | 'thema'>>, k: EntwurfKontext): FundEntwurf {
  if (f.branche === 'startup' || f.branche === 'unternehmer' || f.branche === 'scaleup') return entwurfStartup(f, k);
  const link = k.link ?? LINK_PLATZHALTER;
  const ab = k.abmelden ?? ABMELDE_PLATZHALTER;
  const angebot = k.angebot ? `\n\nUnser Angebot: ${k.angebot.name}${k.angebot.preis ? ` — ${k.angebot.preis}` : ''}. Sie sagen, was rein soll, wir kümmern uns um den Rest.` : '';
  const quelle = f.quelle === 'osm'
    ? `aus OpenStreetMap (öffentlich zugängliches Verzeichnis)${f.quellen && Object.keys(f.quellen).length ? ' und weiteren öffentlich zugänglichen Angaben zu Ihrem Betrieb (z. B. Impressum)' : ''}`
    : 'aus öffentlich zugänglichen Angaben zu Ihrem Betrieb';
  const ds = [
    '—',
    `Datenschutz: Verantwortlich ist ${k.datenschutz.verantwortlich || k.absender}. Ihre geschäftliche Adresse haben wir ${quelle}. Wir nutzen sie, um Ihnen diesen Entwurf anzubieten (Art. 6 Abs. 1 lit. f DSGVO). Speicherdauer und Ihre Rechte (Auskunft, Löschung, Widerspruch): ${k.datenschutz.seite || k.datenschutz.mail}.`,
    `Sie können jederzeit widersprechen: antworten Sie einfach mit „Nein danke“ oder klicken Sie hier: ${ab}`,
    `Fragen an ${k.datenschutz.mail}${k.datenschutz.seite ? ` · ${k.datenschutz.seite}` : ''}`,
  ].join('\n');
  const text = [
    // Mit Namen nur, wenn der Inhaber aus einer Anbieterkennzeichnung stammt — ein OSM-„operator“ ist Gemeinschaftswissen und kann veraltet sein.
    f.inhaber && f.inhaberArt === 'person' && !(f.quellen?.inhaber ?? '').includes('openstreetmap.org') ? `Guten Tag ${f.inhaber},` : 'Guten Tag,',
    '',
    `${anlass(f)} Deshalb habe ich einen kleinen Entwurf gebaut, wie eine neue Seite für ${f.name} aussehen könnte:`,
    link,
    `Der Entwurf ist unverbindlich und nur über diesen Link zu sehen.${angebot}`,
    '',
    `Wenn es Sie interessiert, antworten Sie kurz auf diese Mail. Sonst melde ich mich in ${ANRUF_NACH_TAGEN} Tagen einmal telefonisch.`,
    '',
    'Viele Grüße',
    k.unterschrift ? `${k.unterschrift}\n${k.absender}` : k.absender,
    '',
    ds,
  ].join('\n');
  return { betreff: `Ein Entwurf für die Website von ${f.name}`.slice(0, 140), text, anruf: anrufLeitfaden(f), ki: false };
}

export function anrufLeitfaden(f: Pick<Fund, 'name' | 'bewertung' | 'adresse'> & Partial<Pick<Fund, 'inhaber' | 'instagram' | 'mobil' | 'telefon' | 'quellen' | 'analyse'>>): string {
  const adr = adresseZeile(f.adresse);
  return [
    `Anruf bei ${f.name}${adr ? ` (${adr})` : ''} — nur, wenn keine Antwort und keine Abmeldung kam.`,
    ...(f.mobil || f.telefon ? [`Nummer: ${f.mobil ? `${f.mobil} (Handy)` : ''}${f.mobil && f.telefon ? ' · ' : ''}${f.telefon ? `${f.telefon} (Festnetz)` : ''} — außerhalb der Stoßzeiten anrufen (nicht 12–14 und ab 18 Uhr).`] : []),
    ...(f.bewertung && !f.bewertung.website ? ['Website laut Verzeichnis: keine — vor dem Anruf kurz selbst suchen (oft fehlt nur der Eintrag).'] : []),
    ...(f.inhaber ? [`Inhaber/Betreiber laut ${f.quellen?.inhaber?.includes('openstreetmap.org') ? 'OpenStreetMap (bitte bestätigen)' : 'Impressum'}: ${f.inhaber} — nach ihm/ihr fragen.`] : ['Inhaber unbekannt — im Gespräch nach dem Inhaber bzw. der Inhaberin fragen.']),
    ...(f.instagram ? [`Vorher ansehen: Instagram @${f.instagram} (Stil, Fotos, aktuelle Themen).`] : []),
    ...(f.analyse ? [`Website-Niveau ${f.analyse.niveau}/100 (unser Standard = 100) — Aufhänger:`, ...f.analyse.aufhaenger.map(a => `  • ${a}`)] : []),
    '1. Kurz vorstellen, Bezug auf die Mail mit dem Website-Entwurf.',
    '2. Fragen: „Haben Sie sich den Entwurf ansehen können?“',
    '3. Bei Interesse: Termin für 15 Minuten oder Angebot schicken (über die Markttraktion).',
    '4. Bei „Nein“: freundlich verabschieden, sofort Werbesperre setzen (Akte › Daten).',
    `Anlass: ${anlass(f)}`,
  ].join('\n');
}

type StartupFund = Pick<Fund, 'name' | 'adresse'> & Partial<Pick<Fund, 'inhaber' | 'inhaberArt' | 'quellen' | 'mobil' | 'telefon' | 'icp' | 'thema' | 'branche'>>;
const istScaleup = (f: StartupFund) => f.branche === 'scaleup' || f.icp?.zielgruppe === 'scaleup';
const istUnternehmer = (f: StartupFund) => f.branche === 'unternehmer' || f.icp?.zielgruppe === 'unternehmer';
const grussVon = (f: StartupFund) => (f.inhaber && f.inhaberArt === 'person' && !(f.quellen?.inhaber ?? '').includes('openstreetmap.org') ? `Guten Tag ${f.inhaber},` : 'Guten Tag,');

/**
 * Profil Start-ups (lib/funde/icp.ts): Vorlage für Brief bzw. Mail (keine KI, keine Website-Vorschau, keine erfundenen Zahlen — nur die belegte Zahl im
 * Aufhänger mit Quelle). Absender = Gesellschaft aus dem Register; Software- und Produktnamen von uns werden nie genannt. Mail ohne Einwilligung bleibt rot
 * (§ 7 UWG) — der Text taugt genauso als Brief; gesendet wird nur über die Freigabe.
 */
function entwurfStartup(f: StartupFund, k: EntwurfKontext): FundEntwurf {
  const ab = k.abmelden ?? ABMELDE_PLATZHALTER;
  const anlassSatz = f.icp?.aufhaenger[0] ?? 'Wir haben Ihr Unternehmen in einer öffentlichen Liste innovativer Firmen gefunden.';
  const scale = istScaleup(f), unt = !scale && istUnternehmer(f);
  const einstieg = f.icp?.einstieg === 'sichtbarkeit' ? 'Positionierung und Sichtbarkeit' : 'Vertrieb und Kundengewinnung';
  const angebot = k.angebot ? `\nAls Einstieg passt oft: ${k.angebot.name}${k.angebot.preis ? ` (${k.angebot.preis})` : ''}.` : '';
  const text = [
    grussVon(f), '',
    anlassSatz, '',
    scale
      // Scale-ups (Kevin 31.10.): anderes Problem — Struktur im wachsenden Vertrieb, nicht „Vertrieb überhaupt“.
      ? `Wir sind ${k.absender} aus Berlin. Wir bringen Struktur in wachsende Vertriebsteams: klare Abläufe von der Anfrage bis zum Abschluss, eine Pipeline, auf die man sich verlassen kann, und eine Einarbeitung, die neue Vertriebler schnell produktiv macht — und wir setzen selbst mit um.`
      : unt
      // Innovative Unternehmer: fertiges Produkt, Neugeschäft planbar machen.
      ? `Wir sind ${k.absender} aus Berlin. Wir helfen innovativen Unternehmen, aus einem guten Produkt planbares Neugeschäft zu machen: sichtbar werden, mit System verkaufen, die richtigen Menschen kennenlernen — und wir setzen selbst mit um.`
      : `Wir sind ${k.absender} aus Berlin. Wir bringen Neues in den Markt: sichtbar machen, mit System verkaufen und die richtigen Menschen verbinden — und wir setzen selbst mit um, bis Ihr Team allein abschließt.`,
    scale
      ? `Hätten Sie Lust auf ein Gespräch von 15 Minuten? Ich zeige Ihnen gern, wo wir bei ${f.name} ansetzen würden.${angebot}`
      : `Hätten Sie Lust auf ein Gespräch von 15 Minuten? Ich zeige Ihnen gern, wie wir bei ${f.name} im Bereich ${einstieg} anfangen würden.${angebot}`, '',
    'Viele Grüße', k.unterschrift ? `${k.unterschrift}\n${k.absender}` : k.absender, '',
    '—',
    `Datenschutz: Verantwortlich ist ${k.datenschutz.verantwortlich || k.absender}. Ihre geschäftlichen Angaben haben wir aus öffentlich zugänglichen Quellen (Förder- bzw. Portfolio-Liste, Ihre Website und Ihr Impressum). Wir nutzen sie, um Ihnen dieses Gespräch anzubieten (Art. 6 Abs. 1 lit. f DSGVO). Speicherdauer und Ihre Rechte (Auskunft, Löschung, Widerspruch): ${k.datenschutz.seite || k.datenschutz.mail}.`,
    `Sie können jederzeit widersprechen: antworten Sie mit „Nein danke“ oder klicken Sie hier: ${ab}`,
  ].join('\n');
  return { betreff: (scale ? `${f.name}: Struktur für den wachsenden Vertrieb` : unt ? `${f.name}: planbares Neugeschäft` : `${f.name}: vom Produkt in den Markt`).slice(0, 140), text, anruf: anrufLeitfadenStartup(f), ki: false };
}

export const ZIELGRUPPE_NAME: Record<NonNullable<Fund['icp']>['zielgruppe'], string> = { startup: 'Start-up', unternehmer: 'Unternehmer', scaleup: 'Scale-up' };
export const EINSTIEG: Record<NonNullable<Fund['icp']>['einstieg'], string> = { vertrieb: 'Vertrieb', sichtbarkeit: 'Sichtbarkeit', struktur: 'Struktur im Vertrieb' };

function anrufLeitfadenStartup(f: StartupFund): string {
  return [
    `Anruf bei ${f.name}${f.thema ? ` (${f.thema})` : ''}. Kaltanruf ohne Vorkontakt ist rot (§ 7 UWG) — nur nach Reaktion auf Brief/Vernetzung oder auf eigenes Risiko.`,
    ...(f.mobil || f.telefon ? [`Nummer: ${[f.mobil && `${f.mobil} (Handy)`, f.telefon && `${f.telefon} (Festnetz)`].filter(Boolean).join(' · ')}`] : []),
    f.inhaber ? `Geschäftsführung laut Impressum: ${f.inhaber} — nach ihm/ihr fragen.` : 'Geschäftsführung unbekannt — im Gespräch erfragen.',
    ...(f.icp ? [`ICP ${f.icp.score}/100 (Stufe ${f.icp.stufe}), Einstieg ${EINSTIEG[f.icp.einstieg]} — Aufhänger:`, ...f.icp.aufhaenger.map(a => `  • ${a}`)] : []),
    '1. Kurz vorstellen (Absender, Berlin), Bezug auf den Anlass.',
    istScaleup(f) ? '2. Fragen: „Wie viele Leute verkaufen bei Ihnen heute — und wie werden neue Vertriebler eingearbeitet?“' : istUnternehmer(f) ? '2. Fragen: „Woher kommen heute Ihre neuen Kunden — und wie planbar ist das?“' : '2. Fragen: „Wie gewinnen Sie heute neue Kunden — und wer macht das bei Ihnen?“',
    '3. Bei Interesse: 15-Minuten-Termin oder Einladung zum Abend; nichts versprechen, was nicht im Katalog steht.',
    '4. Bei „Nein“: freundlich verabschieden, sofort Werbesperre setzen (Akte › Daten).',
  ].join('\n');
}

/** Platzhalter durch echte Links ersetzen (Freigabe). */
export function linksEinsetzen(text: string, link: string, abmelden: string | null): string {
  return text.split(LINK_PLATZHALTER).join(link).split(ABMELDE_PLATZHALTER).join(abmelden ?? 'eine kurze Antwort mit „Nein danke“ genügt');
}
