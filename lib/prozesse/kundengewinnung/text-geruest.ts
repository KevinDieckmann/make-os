// ─── Prozesse · Kundengewinnung — das Text-Gerüst eines „Text-Entwurfs“ ohne Text (22.10. spät, Bausteine mit eigenem Weg) ─────────────────────────────
// Ein Schritt „Text-Entwurf“ (crm.entwurf-text) ohne Text in der Maske wurde bisher eine Aufgabe „schreib den Text“. Jetzt baut der Motor ein GERÜST aus
// den Platzhaltern des Falls (Anrede der Akte, Name, Firma, Deal, nächster Schritt, offene Kernfragen, Event, Kampagne) und dem Anlass der Vorlage — nach
// dem Muster des Inbox-Entwurfs (lib/inbox/entwurf.ts `entwurfSystem`: Anrede Du/Sie aus der Akte, kurz, keine Werbung über das Verabredete hinaus,
// § 7 UWG), aber OHNE Modell (Regelwerk zuerst: kein Budget, kein fremder Text, immer gleich). Der Text geht als Vorschlag „nur Text zum Kopieren“
// (lib/zoe/crm-vorschlag.ts NUR_TEXT) in den Stapel — dort prüfen Kanal-Ampel, Werbesperre und Art. 18; versendet wird nichts. Rein und client-sicher.
// Keine Namen im Code: alles Persönliche kommt aus den Platzhaltern; ohne Wert fällt der Satzteil weg (nie „undefined“, nie ein erfundener Name).

/** Die Arten, für die es ein Gerüst gibt (dieselben wie die Maske von crm.entwurf-text). */
export const GERUEST_ARTEN = ['nachricht_entwurf', 'anruf_leitfaden', 'einladung_entwurf', 'danke_entwurf'] as const;
export type GeruestArt = typeof GERUEST_ARTEN[number];
export const istGeruestArt = (v: unknown): v is GeruestArt => typeof v === 'string' && (GERUEST_ARTEN as readonly string[]).includes(v);

/** Höchstlänge des Gerüsts (die Vorschlags-Art nimmt bis 6000 Zeichen). */
export const GERUEST_MAX = 2000;

const wort = (v: unknown, n = 160): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const tagText = (v: unknown): string => { const t = wort(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : ''; };

/** Die Anrede aus der Akte (Du/Sie) — ohne Namen schlicht „Guten Tag,“ bzw. „Hallo,“. */
export function gruss(p: Readonly<Record<string, unknown>>): string {
  const du = wort(p['kontakt.anrede']) === 'Du';
  const vor = wort(p['kontakt.vorname'], 80), nach = wort(p['kontakt.nachname'], 80);
  if (du) return `Hallo${vor || nach ? ` ${vor || nach}` : ''},`;
  const name = [vor, nach].filter(Boolean).join(' ');
  return `Guten Tag${name ? ` ${name}` : ''},`;
}

/**
 * Das Gerüst (rein). `p` = Platzhalter des Laufs (lib/prozesse/lauf-server.ts `fallInfo`), `anlass` aus der Maske, `titel` = Titel des Schritts.
 * Leer nur, wenn die Art unbekannt ist — dann bleibt es beim Menschen-Schritt.
 */
export function textGeruest(a: { art: unknown; kanal?: unknown; anlass?: unknown; titel: string; p: Readonly<Record<string, unknown>> }): string {
  if (!istGeruestArt(a.art)) return '';
  const p = a.p;
  const du = wort(p['kontakt.anrede']) === 'Du';
  const anlass = wort(a.anlass, 300);
  const firma = wort(p['firma.name']), deal = wort(p['deal.titel']), schritt = wort(p['deal.naechster-schritt'], 200);
  const event = wort(p['event.titel']), eventTag = tagText(p['event.datum']), kampagne = wort(p['kampagne.titel']);
  const thema = deal || kampagne;
  const offen = wort(p['lead.offene-fragen'], 400).split('·').map(x => x.trim()).filter(Boolean);
  const sie = (s: string, d: string) => (du ? d : s);
  let zeilen: string[];
  switch (a.art) {
    case 'anruf_leitfaden': {
      const fragen = offen.length
        ? offen.map(f => `   · ${f}`)
        : [sie('   · Was ist Ihnen gerade am wichtigsten?', '   · Was ist dir gerade am wichtigsten?'), '   · Wer entscheidet mit?', '   · Bis wann soll es stehen?'];
      zeilen = [
        `Leitfaden: ${wort(a.titel, 120) || 'Anruf'}`,
        `Anlass: ${anlass || 'Anknüpfen an den letzten Kontakt'}`,
        '',
        `1. Einstieg: „${gruss(p).replace(/,$/, '')} — ${sie('ich rufe kurz an', 'ich ruf kurz an')}${anlass ? ` wegen: ${anlass}` : ''}.“ Passt es gerade?`,
        `2. Lage${thema ? ` zu „${thema}“` : firma ? ` bei ${firma}` : ''} — nachfragen:`,
        ...fragen,
        `3. Nächster Schritt: ${schritt || 'einen konkreten nächsten Schritt mit Datum vereinbaren'}.`,
        '4. Danach: Ergebnis als Aktivität festhalten (bei gelber Telefon-Ampel den Anlass mit notieren).',
      ];
      break;
    }
    case 'einladung_entwurf': {
      const wann = eventTag ? ` am ${eventTag}` : '';
      zeilen = [
        gruss(p), '',
        `${event ? `wir laden zu „${event}“${wann} ein` : 'wir laden zu unserem nächsten Abend ein'} — ${sie('wir würden uns freuen, wenn Sie dabei sind', 'ich würde mich freuen, wenn du dabei bist')}.`,
        sie('Geben Sie mir gern kurz Bescheid, ob es passt.', 'Sag mir einfach kurz Bescheid, ob es passt.'),
        '', 'Beste Grüße',
      ];
      break;
    }
    case 'danke_entwurf': {
      zeilen = [
        gruss(p), '',
        `danke für das gute Gespräch${event ? ` bei „${event}“` : ''}.${anlass ? ` ${anlass}.` : ''}`,
        'Wie besprochen melde ich mich mit dem nächsten Schritt.',
        '', 'Beste Grüße',
      ];
      break;
    }
    default: {
      // Nachricht (Mail bzw. LinkedIn): anknüpfen und um ein kurzes Gespräch bitten — ob das zulässig ist, sagt die Kanal-Ampel im Vorschlag.
      const linkedin = wort(a.kanal) === 'linkedin';
      zeilen = [
        gruss(p), '',
        anlass ? `ich melde mich wegen: ${anlass}.` : `ich wollte kurz anknüpfen${thema ? ` — es geht um „${thema}“` : firma ? ` — mit Blick auf ${firma}` : ''}.`,
        sie(`Hätten Sie in den nächsten Tagen ${linkedin ? '15 Minuten für einen kurzen Austausch' : '15 Minuten für ein kurzes Gespräch'}?`, `Hast du in den nächsten Tagen ${linkedin ? '15 Minuten für einen kurzen Austausch' : '15 Minuten für ein kurzes Gespräch'}?`),
        '', 'Beste Grüße',
      ];
    }
  }
  return zeilen.join('\n').slice(0, GERUEST_MAX);
}
