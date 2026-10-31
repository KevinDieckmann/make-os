// ─── Funde — zweites Suchprofil: innovative Start-ups und Unternehmer (ICP), rein und getestet (31.10.2026) ───────────────────────────
// Kevin: „weitere Firmen finden, die auf unser Sales-Profil passen. Start-ups, innovative Firmen …“ — Region Deutschland, Zielgruppen innovative Start-ups
// und innovative Unternehmer (inhabergeführt, bauen Neues auf; Mittelstand NICHT in dieser Runde), nur öffentliche kostenlose Quellen, jede Angabe mit Quelle.
// Nachtrag Kevin (31.10.): „Scale-ups kannst du auch mit dazu nehmen, die brauchen auch immer Struktur im Sales. Als eigene Liste, die müssen alle jeweils
// anders angesprochen werden mit anderen Problemen.“ → Zielgruppe `scaleup` (eigenes Profil, eigene Kampagne, Einstieg „Struktur“) statt Ausschluss.
// Raster aus der Positionierung (Für wen: Start-ups → Sichtbarkeit, Vertrieb sobald das Produkt fertig ist; Unternehmer mit fertigem Produkt, 5–50 Mitarbeitende,
// Tech/KI/FinTech/Gesundheit/Sport/Ernährung/innovative Dienstleister → Vertrieb und Sichtbarkeit; „Kein Inkubator“). Das Raster steht als DATEN hier (prüfbar,
// in der Oberfläche anzeigbar); Merkmale nur aus dem, was die Firma selbst veröffentlicht (Startseite, Karriere-Hinweise, Impressum) bzw. die Quelle (Förderer).

export interface IcpMerkmale {
  /** Sitz in Deutschland laut Impressum (PLZ + Ort bzw. „Deutschland/Germany“). */
  deutschland: boolean;
  /** Produkt am Markt erkennbar: Preise, Demo/Testen, Kunden/Referenzen, App-Store. */
  produktLive: boolean;
  /** Richtet sich an Unternehmen (B2B). */
  b2b: boolean;
  /** Sucht Verstärkung im Vertrieb (Sales/Vertrieb/Business Development in Stellen-Hinweisen). */
  vertriebGesucht: boolean;
  /** Teil eines Konzerns bzw. einer Gruppe — Ausschluss. */
  konzern: boolean;
  /** Selbst Agentur/Beratung für Vertrieb oder Marketing — Ausschluss (Wettbewerb). */
  wettbewerb: boolean;
  /** Größte Selbstangabe zur Teamgröße („Wir sind 120 Mitarbeitende“), sonst null. */
  mitarbeitende: number | null;
  /** Offene Stellen auf der Karriereseite (gezählte „(m/w/d)“-Angaben). */
  stellen: number;
  /** Vertriebsleitung (Head of Sales, Vertriebsleitung, CSO/CRO, VP Sales) auf Team-/Über-uns-Seite: ja · nein (Teamseite gelesen, keine) · unbekannt. */
  vertriebsleitung: 'ja' | 'nein' | 'unbekannt';
  /** Firmenprofil bei LinkedIn verlinkt (Weg für eine Vernetzung). */
  linkedin: boolean;
  /** Website schwach (keine Beschreibung/strukturierten Daten bzw. sehr wenig Text) — Einstieg Sichtbarkeit. */
  sichtbarkeitSchwach: boolean;
}

export interface IcpKontext {
  /** Thema in Stichworten (aus der Quelle bzw. der Website). */
  thema?: string;
  /** Förder-/Investor-Signal aus der Quelle (z. B. „Portfolio eines Landesfonds“). */
  signal?: string;
  stadt?: string;
  /** Geschäftsführung/Inhaber aus dem Impressum bekannt. */
  geschaeftsfuehrung: boolean;
  /** Art laut Quelle (Recherche) — Vorrang vor der Ableitung, außer Größe spricht dagegen. */
  art?: IcpArt;
  gruendungsjahr?: number;
  /** Heute (Jahr) — für „schon einige Jahre am Markt“. */
  jahrHeute?: number;
}

export type IcpZielgruppe = 'startup' | 'unternehmer' | 'scaleup';
/** Woher die Firma kommt (Art der Quelle): Förder-/Hochschul-/Startup-Liste, Innovationspreis/ZIM, Finanzierungsrunde/Wachstums-Ranking. */
export type IcpArt = IcpZielgruppe;

export interface IcpErgebnis {
  score: number;
  stufe: 'A' | 'B' | 'C';
  /** Gesetzt = fällt raus (Muss verletzt oder Ausschluss). */
  ausschluss?: string;
  /** Start-up, innovativer Unternehmer oder Scale-up (je eigene Liste, eigene Kampagne, eigene Ansprache). */
  zielgruppe: IcpZielgruppe;
  /** Vertrieb aufbauen · Sichtbarkeit zuerst · Struktur im wachsenden Vertrieb (Scale-up). */
  einstieg: 'vertrieb' | 'sichtbarkeit' | 'struktur';
  mitarbeitende?: number;
  vertriebsleitung?: 'ja' | 'nein' | 'unbekannt';
  /** Lead-Score für die Ansprache 0–100: Passung + Erreichbarkeit + Geschäftsführung + fehlende Vertriebsleitung (`prioritaetVon`). */
  prioritaet?: number;
  gruende: string[];
  aufhaenger: string[];
  gemessenAm: string;
}

/** Das Raster — Muss, Kann (mit Punkten), Ausschlüsse. Wird angezeigt und von `icpBewerten` genau so gerechnet. */
export const ICP_RASTER = {
  muss: [
    'Sitz in Deutschland (Impressum)',
    'Eigenes, neues Produkt bzw. eigene Lösung (Software, KI, FinTech, Gesundheit, Sport, Ernährung, innovative Dienstleistung, Hardware)',
    'Unabhängig, inhaber- bzw. gründergeführt (keine Konzerntochter)',
    'Aktiv: eigene, erreichbare Website mit Impressum',
  ],
  kann: [
    { punkte: 25, text: 'Produkt am Markt (Preise, Demo, Kunden/Referenzen) — sonst Einstieg Sichtbarkeit (5)' },
    { punkte: 20, text: 'Sucht Verstärkung im Vertrieb (Stellen-Hinweis)' },
    { punkte: 15, text: 'B2B — verkauft an Unternehmen' },
    { punkte: 10, text: 'Förderung oder Investor laut öffentlicher Quelle' },
    { punkte: 10, text: 'Thema in unserem Fokus (KI, Software, FinTech, Gesundheit, Sport, Ernährung)' },
    { punkte: 10, text: 'Geschäftsführung namentlich bekannt (Impressum)' },
    { punkte: 5, text: 'Sitz in Berlin (Abende, persönliches Treffen)' },
    { punkte: 5, text: 'Website schwach — Anlass für Sichtbarkeit' },
  ],
  zielgruppen: [
    'Start-up: jung, gründergeführt (Förder-, Hochschul-, Startup-Listen, Seed) — Einstieg Vertrieb aufbauen (Produkt am Markt) bzw. Sichtbarkeit (noch nicht)',
    'Innovativer Unternehmer: inhabergeführt, fertiges Produkt, rund 5–50 Mitarbeitende, oft einige Jahre am Markt (Innovationspreise, ZIM) — Einstieg planbares Neugeschäft',
    'Scale-up: ab 50 Mitarbeitenden laut Website, mindestens 8 offene Stellen oder Wachstumsrunde (Series A und später) — Einstieg Struktur im Vertrieb',
  ],
  prioritaet: 'Lead-Score für die Ansprache = 60 % Passung + Erreichbarkeit (Handy 20 · Festnetz 12 · nur Mail 6) + Geschäftsführung bekannt 10 + keine Vertriebsleitung sichtbar 10',
  ausschluss: [
    'Konzern- bzw. Gruppentochter',
    'Selbst Vertriebs-/Marketing-Agentur oder Beratung (Wettbewerb)',
    'Kein Sitz in Deutschland bzw. keine erreichbare Website',
    'Mittelstand ab 250 Mitarbeitenden bzw. Konzerngröße ab 1.000 (nicht in dieser Runde)',
  ],
  stufen: 'A ab 70 Punkten · B 50–69 · C unter 50',
} as const;

const FOKUS = /\b(ki|ai|künstliche intelligenz|machine learning|software|saas|plattform|app|fintech|finanz|payment|health|gesundheit|medizin|medtech|pflege|sport|fitness|ernährung|food|lebensmittel|energie|climate|klima|mobility|robot|automatisier)/i;

/**
 * Größte Selbstangabe zur Teamgröße („Wir sind 120 Mitarbeitende“, „our team of 150 people“) — nie Kundengrößen („750 Mitarbeitende auf 350 Plätzen“,
 * „Bis zu 2000 Mitarbeitende“ als Preisstufe). Rein.
 */
export function teamGroesse(text: string): number | null {
  const re = /\b(?:wir sind|we are|unser(?:e)? team (?:aus|von|mit|umfasst)|our team of|a team of|ein team (?:aus|von))\s*(?:über|mehr als|rund|ca\.|more than|over|about)?\s*(\d{1,3}(?:[.,]\d{3})?|\d{2,5})\s*\+?\s*(?:mitarbeitende|mitarbeiter(?:innen)?|kolleg(?:innen|en)|beschäftigte|employees|team members|people|menschen|köpfe)\b/gi;
  let max: number | null = null;
  for (const t of text.matchAll(re)) { const n = Number(t[1].replace(/[.,]/g, '')); if (n > 0 && n < 1e6) max = Math.max(max ?? 0, n); }
  return max;
}
/** Offene Stellen: „(m/w/d)“, „(w/m/d)“, „(all genders)“, „(f/m/d)“ auf der Karriereseite. Rein. */
export const stellenZahl = (karriere: string): number => (karriere.match(/\((?:m\/w\/d|w\/m\/d|m\/f\/d|f\/m\/d|m\/w\/x|all genders|d\/f\/m|gn\*?)\)/gi) ?? []).length;
/** Wachstumsrunde laut Quelle (Series B und später). */
export const wachstumsrunde = (signal?: string): boolean => !!signal && /\b(series|serie|finanzierungsrunde der serie)\s*[a-e]\b|\bgrowth round\b|\bwachstumsrunde\b|\bfast 50\b|\bft ?1000\b|wachstumschampion/i.test(signal);

/** Vertriebsleitung auf Team-/Über-uns-/Karriereseite — Rollen, nie Namen. `teamGelesen` = eine Team-/Über-uns-Seite lag vor. Rein. */
export const VERTRIEBSLEITUNG = /\b(head of (?:sales|revenue|business development|growth)|vp(?:\.|,)? (?:of )?sales|vice president(?:,)? sales|chief (?:sales|revenue|commercial) officer|director (?:of )?sales|sales director|vertriebsleit(?:er|erin|ung)|leiter(?:in)? (?:des )?vertrieb[s]?|leitung (?:des )?vertrieb[s]?|bereichsleit(?:er|erin|ung) vertrieb|gesamtvertriebsleit\w*|head of vertrieb)/gi;
/** Eine Rolle zählt nur, wenn sie besetzt ist — nicht als Stellenanzeige („Head of Sales (m/w/d)“, „wir suchen …“). */
export function vertriebsleitungAus(team: string, teamGelesen: boolean): 'ja' | 'nein' | 'unbekannt' {
  for (const m of team.matchAll(VERTRIEBSLEITUNG)) {
    const i = m.index ?? 0, vor = team.slice(Math.max(0, i - 50), i), nach = team.slice(i + m[0].length, i + m[0].length + 40);
    if (/\((?:m\/w\/d|w\/m\/d|m\/f\/d|f\/m\/d|all genders|gn\*?|d\/f\/m)\)|\bjob\b|bewerben|apply/i.test(nach) || /such(?:en|t)|hiring|wir stellen ein|job|stelle|karriere|career/i.test(vor)) continue;
    return 'ja';
  }
  return teamGelesen ? 'nein' : 'unbekannt';
}

/**
 * Konzern-Zugehörigkeit nur aus dem Impressum und nur als Aussage über die Firma selbst — nie über Dienstleister im Datenschutz-Teil
 * („Amazon Web Services … ist eine Tochtergesellschaft der Amazon.com“), Kunden oder eigene Töchter (31.10.). Rein.
 */
export function konzernAus(impressum: string): boolean {
  const re = /\b(ein unternehmen der|a company of the|teil der [A-ZÄÖÜ][\p{L}-]+[- ]?(?:gruppe|group)|eine (?:100 ?%ige )?tochter(?:gesellschaft)? der|is a subsidiary of|a member of the [A-Z][\w-]+ group)\b/giu;
  for (const m of impressum.matchAll(re)) {
    const umfeld = impressum.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + 80);
    if (!/amazon|aws|google|alphabet|microsoft|meta platforms|facebook|linkedin|cloudflare|hubspot|salesforce|stripe|paypal|hetzner|ionos|strato|vimeo|youtube/i.test(umfeld)) return true;
  }
  return false;
}

/** Merkmale aus Startseite, Impressum und (falls vorhanden) Karriere- und Team-Seite. Rein. */
export function icpMerkmaleAus(seiten: { start: string; impressum?: string; karriere?: string; team?: string }): IcpMerkmale {
  const text = (h: string) => h.slice(0, 1_500_000).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const s = seiten.start, desc = /<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']{0,400})/i.exec(s)?.[1] ?? '', st = `${desc} ${text(s)}`, imp = text(seiten.impressum ?? ''), kar = text(seiten.karriere ?? '');
  const titel = /<title[^>]*>([^<]{0,160})<\/title>/i.exec(s)?.[1] ?? '';
  return {
    deutschland: /\b\d{5}\s+[A-ZÄÖÜ][\p{L}.-]+/u.test(imp) || /\b(Deutschland|Germany)\b/.test(imp),
    produktLive: /preise|pricing|tarife|jetzt testen|kostenlos testen|free trial|demo (vereinbaren|anfragen|buchen)|book a demo|request a demo|kunden(stimmen)?\b|referenzen|case stud|erfolgsgeschichten|app store|google play|jetzt kaufen|shop\b/i.test(st),
    b2b: /\bb2b\b|für unternehmen|for (teams|businesses|enterprises)|unternehmenskunden|mittelstand|kmu|enterprise|für ihr unternehmen|für firmen/i.test(st),
    vertriebGesucht: /(sales|vertrieb|business development|account (executive|manager)|key account|bizdev)[^.]{0,80}(m\/w\/d|w\/m\/d|\(all genders\)|gesucht|job|stelle)|(m\/w\/d|w\/m\/d)[^.]{0,80}(sales|vertrieb|business development)/i.test(`${st} ${kar}`),
    konzern: konzernAus(imp),
    wettbewerb: /\b(agentur|agency|unternehmensberatung|consulting|beratung)\b/i.test(titel) && /\b(vertrieb|sales|marketing|werbung|leadgenerierung)\b/i.test(titel),
    mitarbeitende: teamGroesse(`${st} ${kar}`),
    stellen: stellenZahl(seiten.karriere ?? ''),
    vertriebsleitung: vertriebsleitungAus(`${text(seiten.team ?? '')} ${st}`, !!seiten.team),
    linkedin: /linkedin\.com\/company\//i.test(s),
    sichtbarkeitSchwach: !/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{40,}/i.test(s) || st.length < 800,
  };
}

/**
 * Zielgruppe: Scale-up ab 50 Mitarbeitenden, 8 offenen Stellen oder Wachstumsrunde (außer ein Innovationspreis-Unternehmer bis 100 Mitarbeitende);
 * innovativer Unternehmer laut Quelle oder schon acht Jahre am Markt ohne Gründungs-/Finanzierungs-Signal; sonst Start-up. Rein.
 */
export function zielgruppeVon(m: Pick<IcpMerkmale, 'mitarbeitende' | 'stellen'>, signal?: string, k: Pick<IcpKontext, 'art' | 'gruendungsjahr' | 'jahrHeute'> = {}): IcpZielgruppe {
  const ma = m.mitarbeitende ?? 0;
  if (k.art === 'unternehmer' && ma <= 100) return 'unternehmer';
  if (k.art === 'scaleup' || ma >= 50 || m.stellen >= 8 || wachstumsrunde(signal)) return 'scaleup';
  if (k.art === 'unternehmer') return 'unternehmer';
  if (k.art !== 'startup' && k.gruendungsjahr && k.jahrHeute && k.jahrHeute - k.gruendungsjahr >= 8) return 'unternehmer';
  return 'startup';
}

/** Lead-Score für die Ansprache (siehe `ICP_RASTER.prioritaet`). Rein. */
export function prioritaetVon(score: number, w: { mobil?: string; telefon?: string; email?: string; geschaeftsfuehrung: boolean; vertriebsleitung?: 'ja' | 'nein' | 'unbekannt' }): number {
  if (score <= 0) return 0;
  const erreichbar = w.mobil ? 20 : w.telefon ? 12 : w.email ? 6 : 0;
  return Math.min(100, Math.round(score * 0.6 + erreichbar + (w.geschaeftsfuehrung ? 10 : 0) + (w.vertriebsleitung === 'nein' ? 10 : 0)));
}

/** Score, Stufe, Zielgruppe, Einstieg, Gründe und Gesprächsaufhänger gegen `ICP_RASTER`. Rein. */
export function icpBewerten(m: IcpMerkmale, k: IcpKontext, gemessenAm: string): IcpErgebnis {
  const gruende: string[] = [];
  let ausschluss: string | undefined;
  if (!m.deutschland) ausschluss = 'Kein Sitz in Deutschland im Impressum erkennbar.';
  else if (m.konzern) ausschluss = 'Gehört zu einem Konzern bzw. einer Gruppe.';
  else if ((m.mitarbeitende ?? 0) >= 1000) ausschluss = 'Konzerngröße (ab 1.000 Mitarbeitenden laut Website) — nicht in dieser Runde.';
  else if (k.art === 'unternehmer' && (m.mitarbeitende ?? 0) >= 250) ausschluss = 'Mittelstand (ab 250 Mitarbeitenden laut Website) — nicht in dieser Runde.';
  else if (m.wettbewerb) ausschluss = 'Selbst Agentur bzw. Beratung für Vertrieb/Marketing (Wettbewerb).';
  const zielgruppe = zielgruppeVon(m, k.signal, k);
  let p = 0;
  const plus = (b: boolean, n: number, satz: string) => { if (b) { p += n; gruende.push(satz); } };
  if (m.produktLive) plus(true, 25, 'Produkt am Markt (Preise, Demo oder Kunden auf der Website).');
  else { p += 5; gruende.push('Produkt noch nicht klar am Markt — Einstieg über Sichtbarkeit und Positionierung.'); }
  plus(m.vertriebGesucht, 20, 'Sucht gerade Verstärkung im Vertrieb.');
  plus(m.b2b, 15, 'Verkauft an Unternehmen (B2B).');
  plus(!!k.signal, 10, `Förderung/Investor laut Quelle: ${k.signal}.`);
  plus(!!k.thema && FOKUS.test(k.thema), 10, `Thema im Fokus: ${k.thema}.`);
  plus(k.geschaeftsfuehrung, 10, 'Geschäftsführung im Impressum genannt.');
  plus(!!k.stadt && /berlin/i.test(k.stadt), 5, 'Sitz in Berlin.');
  plus(m.sichtbarkeitSchwach, 5, 'Website eher schwach — Anlass für Sichtbarkeit.');
  if (m.vertriebsleitung === 'nein') gruende.push('Keine Vertriebsleitung auf der Website zu sehen — Bedarf an Struktur im Vertrieb.');
  if (m.vertriebsleitung === 'ja') gruende.push('Vertriebsleitung vorhanden — Ansprache über Struktur und Tempo, nicht über Aufbau.');
  if (zielgruppe === 'scaleup') gruende.push(`Scale-up: ${[m.mitarbeitende != null && m.mitarbeitende >= 50 ? `rund ${m.mitarbeitende} Mitarbeitende laut Website` : '', m.stellen >= 8 ? `${m.stellen} offene Stellen` : '', wachstumsrunde(k.signal) ? 'Wachstumsrunde laut Quelle' : ''].filter(Boolean).join(', ')}.`);
  const score = ausschluss ? 0 : Math.min(100, p);
  const aufhaenger: string[] = [];
  if (zielgruppe === 'scaleup') {
    // Scale-ups: das Problem ist nicht „Vertrieb überhaupt“, sondern Struktur im wachsenden Vertrieb.
    if (m.vertriebsleitung === 'nein') aufhaenger.push('Auf Ihrer Website ist keine Vertriebsleitung zu sehen — gerade im Wachstum entscheidet, wer den Vertrieb führt und nach welchen Regeln.');
    if (m.vertriebGesucht) aufhaenger.push('Sie stellen gerade im Vertrieb ein — damit neue Kolleginnen und Kollegen schnell abschließen, braucht es ein Playbook, klare Stufen und eine saubere Einarbeitung.');
    aufhaenger.push('Wenn ein Team wächst, entscheidet im Vertrieb die Struktur: eine Pipeline, der man trauen kann, gleiche Abläufe für alle und eine Führung, die auf Zahlen schaut.');
    if (k.signal && wachstumsrunde(k.signal)) aufhaenger.push(`Bezug: ${k.signal} — nach einer Runde steigen die Umsatzziele, und der Vertrieb muss mitwachsen.`);
  } else if (zielgruppe === 'unternehmer') {
    // Innovative Unternehmer: fertiges Produkt, Neugeschäft oft über Empfehlung — planbar machen.
    if (m.vertriebGesucht) aufhaenger.push('Sie suchen Verstärkung im Vertrieb — wir bauen mit Ihnen Abläufe, damit neue Leute schnell Gespräche und Abschlüsse bringen.');
    aufhaenger.push('Ihr Produkt funktioniert und hat Kunden — oft kommt Neugeschäft aber über Empfehlung und ist nicht planbar. Genau das ändern wir mit Ihnen.');
    if (k.signal) aufhaenger.push(`Bezug: ${k.signal} — die Auszeichnung zeigt, was Sie können; jetzt soll der Markt es sehen.`);
    if (m.sichtbarkeitSchwach) aufhaenger.push('Ihre Website zeigt noch nicht in fünf Sekunden, was Sie besser machen — das kostet Anfragen.');
  } else {
    if (m.vertriebGesucht) aufhaenger.push('Sie suchen gerade Verstärkung im Vertrieb — wir bauen Vertrieb mit Ihnen auf und machen vor, bis Ihr Team selbst abschließt.');
    if (m.produktLive && !m.vertriebGesucht) aufhaenger.push('Ihr Produkt ist am Markt — für viele Start-ups ist danach Vertrieb und Kundengewinnung die größte Herausforderung (Deutscher Startup Monitor 2025: 63,5 %).');
    if (!m.produktLive) aufhaenger.push('Bevor der Vertrieb startet: eine klare Positionierung und eine Seite, die in fünf Sekunden zeigt, was Sie lösen.');
    if (k.signal) aufhaenger.push(`Bezug: ${k.signal} — jetzt kommt es darauf an, dass der Markt Sie sieht.`);
    if (m.sichtbarkeitSchwach && m.produktLive) aufhaenger.push('Ihre Website erklärt das Produkt noch nicht in fünf Sekunden — das kostet Anfragen.');
  }
  aufhaenger.push('Einladung zu unserem nächsten Abend: Gründer, Mittelständler und Macher an einem Tisch (Termine folgen).');
  return {
    score, stufe: score >= 70 ? 'A' : score >= 50 ? 'B' : 'C', ...(ausschluss ? { ausschluss } : {}), zielgruppe,
    einstieg: zielgruppe === 'scaleup' ? 'struktur' : m.produktLive ? 'vertrieb' : 'sichtbarkeit', ...(m.mitarbeitende != null ? { mitarbeitende: m.mitarbeitende } : {}),
    vertriebsleitung: m.vertriebsleitung,
    gruende, aufhaenger: aufhaenger.slice(0, 3), gemessenAm,
  };
}
