// ─── Verzeichnis (Art. 30): Verarbeitung „KI-Funktionen (ZOE, automatische Läufe)“ (05.10.) ───────────────────────────
// Eigener, abgegrenzter Eintrag des DSGVO-Pakets „KI, Gesundheit, Telegram“ — bewusst NICHT in lib/crm/datenschutz.ts
// (dort baut ein paralleles Paket Verantwortlichen/VVT/AVV); angeschlossen in app/api/crm/stammdaten/route.ts wie die
// übrigen Nachträge (idempotent; vorhandene, auch von Hand geänderte Einträge bleiben). Rein.

import type { Verarbeitung } from '@/lib/crm/typen';
import { UG_NAME } from '@/lib/einheiten';
import { tagVon } from '@/lib/zeit';
import { KI_EMPFAENGER, KI_PROTOKOLL_MONATE } from './ki-protokoll';
import type { AnbieterId } from '@/lib/ki/anbieter';

export const VV_KI = 'vv-ki';
/** Neue Verarbeitung (09.10., Paket 6a): KI über das Anbieter-Tor — nachgetragen, sobald ein neuer Zugang eingerichtet ist. */
export const VV_KI_ANBIETER = 'vv-ki-anbieter';

/** vv-ki bis 08.10. (Empfänger-Satz mit „Data Privacy Framework“) — eine unveränderte alte Fassung wird beim Nachtragen gehoben. */
const KI_EMPFAENGER_ALT = 'Anthropic PBC, San Francisco (USA) — KI-Modell (Drittland; EU-US Data Privacy Framework bzw. Standardvertragsklauseln)';
const VV_KI_DRITTLAND = 'USA — Standardvertragsklauseln (Anthropic; nicht im EU-US Data Privacy Framework); Telegram nur für neutrale Hinweise (Inhalte nur mit ausdrücklicher Ausnahme der Person)';
const VV_KI_ALT: Partial<Record<keyof Verarbeitung, { alt: string; neu: string }>> = {
  empfaenger: { alt: `${KI_EMPFAENGER_ALT} als Auftragsverarbeiter; Web-Suche nur, wenn eingeschaltet`, neu: `${KI_EMPFAENGER} als Auftragsverarbeiter; Web-Suche nur, wenn eingeschaltet` },
  drittland: { alt: 'USA — EU-US Data Privacy Framework bzw. Standardvertragsklauseln (Anthropic); Telegram nur für neutrale Hinweise (Inhalte nur mit ausdrücklicher Ausnahme der Person)', neu: VV_KI_DRITTLAND },
};

export function verarbeitungKi(jetzt: string): Verarbeitung {
  return {
    id: VV_KI, name: 'KI-Funktionen (ZOE im Gespräch, Entwürfe, automatische Läufe)',
    zweck: 'Assistenz im Alltag und Geschäft: Fragen beantworten, Entwürfe (Mails, Ansprachen, Texte) vorbereiten, Lagebilder und Vorschläge — nichts verlässt das System ohne Freigabe eines Menschen',
    personen: 'Personen des Haushalts (Konten); Kontakte der Markttraktion, Absender im Postfach, Teilnehmende von Terminen',
    daten: 'je Bereich, soweit für ZOE erlaubt (System › Datenschutz): Aufgaben, Termine, Kontakte/Deals, Finanzzahlen, Notizen im Brain; Gesundheitswerte NUR mit ausdrücklicher Einwilligung „An die KI geben“ (Art. 9) — an die ZOE des Partners nur zusätzlich mit „Mit dem Partner teilen“; in automatischen Läufen Namen und Adressen von Kontakten durch Platzhalter ersetzt (Pseudonymisierung)',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO (eigene Arbeitsmittel, berechtigtes Interesse an effizienter Bearbeitung); Gesundheit: Art. 9 Abs. 2 lit. a (Einwilligung je Zweck, widerrufbar)',
    empfaenger: `${KI_EMPFAENGER} als Auftragsverarbeiter; Web-Suche nur, wenn eingeschaltet`,
    drittland: VV_KI_DRITTLAND,
    loeschfrist: `Beim Anbieter nach dessen Aufbewahrungsregeln für API-Daten (prüfen/AVV); KI-Protokoll (nur Metadaten) ${KI_PROTOKOLL_MONATE} Monate`,
    toms: 'EINE Stelle für alle Modell-Aufrufe (KI-Tor): Schalter je Instanz und Person (Hintergrund-KI, Web-Suche, Bereiche), Einwilligungsprüfung Art. 9, Pseudonymisierung in Hintergrund-Läufen, KI-Protokoll ohne Inhalte, Fremdtext gekapselt, schreibende Werkzeuge nur als Vorschlag, KI-Kennzeichnung (KI-VO Art. 50)',
    verantwortlich: UG_NAME, stand: tagVon(jetzt),
  };
}

/** Verarbeitung „KI über das Anbieter-Tor“ (09.10.) — nur die eingerichteten neuen Zugänge stehen im Empfänger-Satz. */
export function verarbeitungKiAnbieter(jetzt: string, anbieter: readonly AnbieterId[]): Verarbeitung {
  const teile: string[] = [];
  if (anbieter.includes('anthropic-vertex-eu')) teile.push('Google Cloud Vertex AI, Region EU — Claude-Modell für Gesundheit (nur mit Einwilligung „An die KI geben“ und bestätigter Zero Data Retention), Privat-Finanzen und Familie');
  if (anbieter.includes('google-vertex')) teile.push('Google Cloud Vertex AI (global bzw. USA) — Bilder, Video und Tiefenberichte aus Motiv-/Themenbeschreibungen ohne Personendaten, nur im Budget bzw. auf Klick');
  if (anbieter.includes('mistral')) teile.push('Mistral AI (EU) — Transkription von Sprachaufnahmen, nur auf Schalter');
  return {
    id: VV_KI_ANBIETER, name: 'KI über weitere Anbieter (Claude in der EU, Bilder, Video, Tiefenbericht, Transkription)',
    zweck: 'Besonders geschützte Daten (Gesundheit, Privat-Finanzen, Familie) nur in der EU an die KI geben; Bilder und Videos für das Marketing erzeugen; Tiefenberichte zum Lesen; Sprachaufnahmen verschriftlichen — jede Wirkung nach außen nur nach Freigabe',
    personen: 'Personen des Haushalts (Konten); bei Transkription die aufgenommenen Personen',
    daten: 'gekapselte Ausschnitte wie bei ZOE (Claude in der EU); Motiv-/Themenbeschreibungen (Bilder, Video, Tiefenbericht); Sprachaufnahmen (Transkription); erzeugte Bilder und Videos samt eingebetteter Kennzeichnung (SynthID, C2PA) verschlüsselt in der eigenen Ablage',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO; Gesundheit: Art. 9 Abs. 2 lit. a (Einwilligung je Zweck, widerrufbar); Transkription fremder Stimmen nur mit Einwilligung der Sprechenden',
    empfaenger: `Auftragsverarbeiter über das Anbieter-Tor (Rückfall nie in eine schwächere Datenschutzstufe): ${teile.join('; ') || 'noch keiner eingerichtet'}`,
    empfaengerIds: ['hetzner', ...(anbieter.some(a => a === 'anthropic-vertex-eu' || a === 'google-vertex') ? ['google-vertex'] : []), ...(anbieter.includes('mistral') ? ['mistral'] : [])],
    drittland: 'Claude über Vertex: keines (Region EU); Bilder/Tiefenbericht/Video bei Google: global bzw. USA — Data Privacy Framework und Standardvertragsklauseln; Mistral: keines (EU)',
    loeschfrist: `Beim Anbieter nach dessen Regeln (Zero Data Retention beantragt bzw. „nicht speichern“); erzeugte Medien in der eigenen Ablage bis zur Löschung (Papierkorb 30 Tage); Tiefenberichte 30 Tage nur für die fragende Person; KI-Protokoll (nur Metadaten) ${KI_PROTOKOLL_MONATE} Monate`,
    toms: 'EIN Anbieter-Tor (lib/ki/tor.ts): Mindeststufe je Datenkategorie (Gesundheit nur EU mit Zero Data Retention), Rückfall nie schwächer, nur Anbieter mit bestätigtem AVV im Register, Budget und Grenze je Auftrag, Video/Tiefenbericht nur nach Kostenschätzung und Klick; Schlüssel nur in der Umgebung des Servers; Kennzeichnung der Anbieter (SynthID, C2PA) wird nie entfernt, sichtbares Zeichen bei realistischen Personen/Orten (KI-VO Art. 50)',
    verantwortlich: UG_NAME, stand: tagVon(jetzt),
  };
}

/**
 * Die KI-Einträge ergänzen bzw. heben (idempotent; gibt DIESELBE Liste zurück, wenn nichts zu tun ist — Aufrufer vergleichen die Referenz):
 * vv-ki, wenn er fehlt; unveränderte alte Fassungen von vv-ki (Empfänger/Drittland mit „Data Privacy Framework“) gehoben; vv-ki-anbieter,
 * sobald ein neuer Zugang eingerichtet ist (`anbieter`). Vorhandene, von Hand geänderte Einträge bleiben.
 */
export function verarbeitungKiNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string, anbieter: readonly AnbieterId[] = []): Verarbeitung[] {
  let l: Verarbeitung[] = vorhanden as Verarbeitung[];
  if (!l.some(v => v.id === VV_KI)) l = [...l, verarbeitungKi(jetzt)];
  let gehoben = false;
  const neu = l.map(v => {
    if (v.id !== VV_KI) return v;
    let x = v;
    for (const [k, w] of Object.entries(VV_KI_ALT) as [keyof Verarbeitung, { alt: string; neu: string }][]) if (String(x[k] ?? '') === w.alt) { x = { ...x, [k]: w.neu }; gehoben = true; }
    return x;
  });
  if (gehoben) l = neu;
  const neue = anbieter.filter(a => a !== 'anthropic');
  if (neue.length && !l.some(v => v.id === VV_KI_ANBIETER)) l = [...l, verarbeitungKiAnbieter(jetzt, neue)];
  return l;
}
