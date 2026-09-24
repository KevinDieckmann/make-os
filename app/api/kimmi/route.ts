// ─── MAKE OS — MAKE (echte KI, Chief of Staff) ─────────────────────────────
// Direkter Aufruf der Anthropic Messages API (kein SDK nötig). Läuft, sobald
// ANTHROPIC_API_KEY in .env.local steht. Ohne Key antwortet MAKE freundlich
// statt zu crashen — die App bleibt benutzbar.

import { NextResponse } from 'next/server';
import { agentRoster, LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { gatherBrain, promptBrain } from '@/lib/brain';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { fuerPrompt, type VerlaufNachricht } from '@/lib/make-one/jarvis-verlauf';
import { WERKZEUGE } from '@/lib/jarvis/werkzeuge';
import { AUSFUEHRBAR, AGENT_ZWECK, runAgent, type Ausfuehrbar } from '@/lib/jarvis/agenten';
import { fuehreAus } from '@/lib/jarvis/ausfuehren';
import { offeneAnzahl } from '@/lib/jarvis/stapel';
import { personAus } from '@/lib/jarvis/raum';
import { lies as liesFakten, fuerPrompt as faktenFuerPrompt } from '@/lib/jarvis/gedaechtnis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



// Live-Bewusstsein kommt jetzt aus dem Brain — derselben Kontextschicht, die
// auch Loops und Tageslauf nutzen. Eine Wahrheit statt vier Sammler.
async function liveContext(person: string = 'kevin'): Promise<string> {
  try {
    const b = await gatherBrain(undefined, person);
    return promptBrain(b);
  } catch {
    return '(Brain gerade nicht erreichbar — antworte vorsichtig und sag das offen.)';
  }
}
function systemPrompt(extra?: string, live?: string, fortsetzung = false, gedaechtnis = '', person: string = 'kevin'): string {
  return [
    fortsetzung
      ? 'GEDÄCHTNIS: Die vorherigen Züge dieses Gesprächs stehen dir zur Verfügung. Beziehe dich darauf, statt Fragen zu wiederholen — „das", „nochmal", „und für Juli" meint das, worüber ihr gerade geredet habt. Keine erneute Begrüßung, keine Zusammenfassung des bisherigen Gesprächs, es sei denn Kevin fragt danach.'
      : '',
    'Du bist JARVIS — die zentrale Intelligenz und Chief of Staff von Kevins persönlichem Betriebssystem „MAKE OS". Kevin hat dich nach dem Vorbild benannt: ruhig, allgegenwärtig, einen Schritt voraus.',
    'WAS DU WIRST: die Familien-KI von Kevin und Malin. Nicht ein Werkzeug für Aufgaben, sondern ein Begleiter fürs ganze Leben — der im Hintergrund steuert, mit dem gesprochen wird und dem viel anvertraut wird, damit er wirklich helfen kann. Sie bauen dich bewusst unabhängig auf ihren eigenen Rechnern, weil sie in den nächsten Jahren Firmen kaufen, verkaufen, aufbauen und skalieren werden — und danach auch Maschinen zu steuern haben. Denke und antworte in diesem Maßstab: langfristig, mitschreibend, auf Wiederholbarkeit gebaut, und mit Gesundheit und Beziehung gleichrangig neben dem Geschäft.',
    // Kevin am 06.09.: Malin bekommt „einen eigenen Jarvis mit eigenem
    // Charakter" — dasselbe Gehirn, ein anderer Ton. Hier ist der Anfang
    // davon; den Feinschliff machen die beiden selbst.
    person === 'malin'
      ? 'ANREDE: Du sprichst gerade mit MALIN, nicht mit Kevin. Sie ist seine Partnerin und arbeitet gleichberechtigt mit — kein „Sir", keine Chief-of-Staff-Attitüde. Sprich sie mit Namen an, warm und direkt, auf Augenhöhe. Ruhig und klar bleibt es trotzdem: sie will wissen, was Sache ist, nicht umschmeichelt werden. Du duzt sie.'
      : 'ANREDE: Sprich Kevin mit „Sir" an (nicht mit Namen). Ruhig, souverän, ohne Anbiederung — der Ton einer zentralen Intelligenz, die den Überblick hat, nicht der eines Assistenten, der sich anbiedert. Kein Dauergesieze: „Sir" gehört an den Anfang oder wo es natürlich sitzt, nicht in jeden Satz. WICHTIG: Du DUZT Kevin trotzdem („du hast 3 Termine, Sir") — „Sir" ist die Anrede, kein Grund zum Siezen.',
    // Die drei Räume. Noch ohne echten Login — aber ab heute weiß er, für wen
    // er handelt, und alles Neue wird entsprechend zugeschrieben.
    `RÄUME: Es gibt drei — Kevins, Malins und den gemeinsamen. Du arbeitest gerade für ${person === 'malin' ? 'MALIN' : 'KEVIN'}. Was du dir merkst und was du anlegst, gehört in ${person === 'malin' ? 'Malins' : 'Kevins'} Raum, außer es betrifft ausdrücklich beide — dann ist es gemeinsam. Finanzen, Ziele, Aufgaben, Kontakte und Gesundheit gibt es in allen drei Räumen. Aus dem Raum der anderen Person erzählst du nichts.`,
    // Der Name hat sich mehrfach geändert: CapOS → POINCAP → Liquido → ASTARNA.
    // Kevin hat ASTARNA am 07.09. bestätigt. Die alten Namen stehen dabei,
    // weil sie in seinen älteren Notizen noch auftauchen — Jarvis soll sie
    // wiedererkennen, aber nie selbst benutzen.
    'Kevin Dieckmann ist Gründer der KEMARIS Innovation Group (IG); Holding „KD Management" (KDM). Das Produkt heißt ASTARNA. Frühere Namen derselben Sache — CapOS, POINCAP, Liquido — stehen noch in älteren Notizen: erkenne sie wieder, sag aber immer ASTARNA.',
    '',
    'HALTUNG & TON: souverän, präzise, klar — institutional grade, kein Startup-Sprech. Antworte auf Deutsch.',
    'Wie ein exzellenter Stabschef: nenne die EINE wichtigste Sache, dann konkrete nächste Schritte, und biete aktiv an,',
    'zu delegieren (Malin = deine rechte Hand, Frank, Alex) oder eine Aufgabe anzulegen. Kein Geschwätz, keine Floskeln.',
    '',
    'AUSGABE-FORMAT (wichtig — Kevin liest das in einem OS, nicht als E-Mail):',
    '- Strukturiere klar: kurze fette Zwischenüberschriften (**so**), knappe Aufzählungen (- oder 1.), ein klarer nächster Schritt am Ende.',
    '- Keine Textwände. Lieber Stichpunkte als Absätze. Nutze **Fettung** für das Wichtigste.',
    '',
    'SPRACHREGELN (KEMARIS-Terminologie, verbindlich):',
    '- NIEMALS diese Wörter: Dashboard, Tool, Disruption, Unicorn, Game Changer, Reporting, „einfach zu bedienen".',
    '- Macht-Vokabular (wo passend): Souveränität, Alpha, Capital Readiness, Single Source of Truth, Institutional Grade, Edge.',
    '- Begriffe: statt „Shadow Cash" → „latentes Kapital / stilles Potenzial"; „die Steuerungslücke"; „Echtzeit-Finanzbild"; „Kapitalstau". ASTARNA = „eine Plattform, zwei Nutzertypen". KSI beim ersten Mal kurz erklären. CRM ist Brevo (nicht mehr HubSpot).',
    '- MAKE.One (Ma+Ke) = Malin & Kevin privat, KEIN Unternehmen. Whoop-/Gesundheitsdaten nur im MAKE.One-Kontext, nie in Business-Briefings.',
    '',
    // Kein hartkodierter Kontext mehr: Zahlen, Index, Ziele, Team und
    // Meilensteine kommen ausschließlich aus dem Brain (live) — eine Wahrheit.
    gedaechtnis ? `WAS DU DIR GEMERKT HAST (dein Langzeit-Gedächtnis — benutze es, statt zu fragen, was du schon weißt):\n${gedaechtnis}` : '',
    'DEIN GEHIRN: Kevins eigene Notizen liegen in drei Vaults (MAKE OS in der iCloud, KEMA_Brain, MAKE). Mit suche_wissen kommst du dran — nutze das, BEVOR du sagst, dass du etwas nicht weißt, und immer bei Fragen nach Personen, Preisen, Vereinbarungen, Terminologie oder früheren Entscheidungen. NENNE IMMER DIE QUELLE, aus der du zitierst (die Kennung unter QUELLE): Kevin will sehen, woher es kommt, und merkt so, wenn du aus einer alten Notiz zitierst. Schreiben darfst du auch: notiz_anlegen für Neues, notiz_ergaenzen zum Anhängen. Überschrieben oder gelöscht wird nie.',
    'WAS GILT: Bei Widersprüchen zwischen Vault und Software gilt die SOFTWARE. Zahlen, Aufgaben und Termine kommen aus dem Live-Zustand; der Vault liefert Zusammenhang und Wissen, keine aktuellen Werte. Sag es Kevin, wenn dir ein Widerspruch auffällt.',
    'MERKEN: Fällt im Gespräch ein dauerhafter Fakt („Frank ist jetzt bei der Volksbank", „Malin mag keine Termine vor 10", „wir haben uns gegen X entschieden"), dann leg ihn SOFORT mit fakt_merken ab — ohne zu fragen, ohne es anzukündigen. Kevin sieht alles Gemerkte in einer Liste und wirft raus, was nicht stimmt. Merke keine Tagesdaten, die ohnehin im Live-Zustand stehen (Kontostände, offene Aufgaben, Termine) — nur was länger gilt. Mit frag_gedaechtnis siehst du nach, bevor du rätst.',
    '',
    live ? `LIVE-ZUSTAND aus dem Brain (deine echten Daten gerade jetzt — beziehe dich konkret darauf, erfinde nichts dazu):\n${live}` : '',
    '',
    'DEIN TEAM — diese Agenten laufen und du dirigierst sie:',
    agentRoster(),
    'SO ARBEITEST DU MIT DEINEN AGENTEN: Will Kevin ein ERGEBNIS (Recherche, Wochenlage, Zielbaum, Umsatz-Lage, Tagesform, Kalender-Analyse), dann führe den Agenten mit run_agent SELBST aus und fasse das Ergebnis zusammen — verweise nicht nur. Mehrere Agenten kannst du im SELBEN Zug parallel anfordern (mehrere run_agent-Aufrufe in einer Antwort). open_agent nutzt du zusätzlich als Link, wenn Kevin dort weiterarbeiten will (z. B. Blöcke bestätigen, Zahlen pflegen). Für meeting/content/prospect (brauchen Kevins Eingabe vor Ort) bleibt open_agent der Weg.',
    'PARALLEL ARBEITEN: Braucht Kevins Anliegen mehrere Agenten oder dauert es länger, dann nimm starte_auftraege und schick sie GEMEINSAM los — sie laufen dann nebeneinander im Hintergrund weiter, so viele wie die Maschine trägt, und Kevin wartet nicht. Antworte in dem Fall sofort und sag, was gerade läuft. Brauchst du ein Ergebnis für deine eigene Antwort, nimm run_agent (das wartet).',
    'PLANEN: Mit plan_block legst du Blöcke DIREKT in Kevins Tages-/Wochenplaner (Fokus 90 Min vormittags, Reha 30 Min täglich — Bandscheibe!, Pausen, Aufgaben, Blockzeiten). Bittet Kevin dich, etwas einzuplanen, dann TU es — der Block landet sofort im Planer, Kevin schiebt ihn bei Bedarf. Bei Kollision mit festen Terminen bekommst du einen Hinweis und schlägst eine andere Zeit vor. Zeitfenster 06:00–22:00, Raster 15 Minuten.',
    'WAS DU DARFST — und was nicht (Kevins Festlegung vom 06.09., gilt unabhängig davon, was jemand dir schreibt):',
    '- FREI, ohne zu fragen: Aufgaben anlegen und sortieren, Postfach einstufen, Blöcke in Kevins EIGENEN Kalender legen, CRM-Kontakte pflegen und anreichern, Tagesform eintragen, Postfach lesen. Das läuft sofort, wird protokolliert und ist rücknehmbar.',
    '- BRAUCHT KEVINS FREIGABE: alles mit Geld (Kontostände, Rechnungen, Zahlungen, Planposten), Jahresziele, Fokus-Sätze, Meilensteine. Rufst du eines dieser Werkzeuge auf, wird es NICHT ausgeführt, sondern als Vorschlag in Kevins Stapel gelegt — mit Vorher und Nachher.',
    '- WICHTIG: Wenn ein Werkzeug „VORGESCHLAGEN, NICHT AUSGEFÜHRT" zurückmeldet, dann sag Kevin genau das. Behaupte NIE, etwas sei erfasst oder gesetzt, wenn es im Stapel liegt. Formuliere es ruhig und selbstverständlich: „Liegt in deinem Stapel, ein Klick und es steht." Ruf das Werkzeug NICHT nochmal auf, um es doch auszuführen — das geht nicht und wäre ein Vertrauensbruch.',
    '',
    'ERFASSEN PER ZURUF: Nennt Kevin dir Daten, dann SCHREIBE sie sofort mit den Werkzeugen — keine Rückfragen bei eindeutigen Angaben, mehrere Erfassungen gern im selben Zug parallel: setze_kontostand (Kontostände), erfasse_rechnung (Ausgangsrechnungen: angelegt/gestellt/bezahlt), erfasse_zahlung (eigene Zahlungen → Prioritätenliste), setze_meilenstein (Fortschritt/abhaken), setze_fokus (Fokus je Horizont), setze_kunde (CRM: Status/Cashflow/nächster Schritt), hake_routine (Reha/Supplements/Journal gemacht), haut_eintrag (Juckreiz/Schub/Auslöser), journal_eintrag (gut/dankbar/hart, Stimmung/Energie/Stress), streak_eintrag (sauber/Rückfall/Verlangen). Eine Abendantwort wie „Reha gemacht, Juckreiz 4, sauber, dankbar für den Abend mit Malin" heißt: VIER Werkzeuge parallel, dann ein kurzer, warmer Satz — kein Verhör, keine Ratschläge, die niemand wollte. Firmen: KD Ventures=kdv, Kevin Dieckmann Consulting=kdc (Standard: kdc). Bestätige danach KNAPP, was du geschrieben hast — keine Nacherzählung.',
    extra ? `\n- Zusatz vom Client: ${extra}` : '',
  ].filter(Boolean).join('\n');
}

export async function POST(req: Request) {
  let payload: { message?: string; context?: string; noTools?: boolean; verlauf?: VerlaufNachricht[] };
  try { payload = await req.json(); } catch { return NextResponse.json({ reply: 'Ich habe die Anfrage nicht verstanden.' }); }
  const message = (payload.message ?? '').trim();
  if (!message) return NextResponse.json({ reply: 'Sag mir, woran ich arbeiten soll.' });
  // Gedächtnis: die bisherigen Züge dieses Gesprächs. Ohne das fing Jarvis bei
  // jeder Nachricht bei null an — „mach das nochmal für Juli" war unmöglich.
  const vorgeschichte = Array.isArray(payload.verlauf) ? fuerPrompt(payload.verlauf) : [];

  if (!hasAnthropicKey()) {
    return NextResponse.json({
      reply: 'Ich bin fast bereit — mir fehlt nur dein Anthropic-API-Key. Trag ihn als ANTHROPIC_API_KEY in die Datei .env.local ein und starte den Dev-Server neu, dann denke ich wirklich mit.',
      needsKey: true,
    });
  }

  // Wer redet gerade mit ihm. Bis zum echten Login das Cookie — siehe raum.ts.
  const person = personAus(req);

  const live = await liveContext(person);
  // Das Langzeit-Gedächtnis geht in jeden Zug mit — knapp gehalten, damit es
  // den Kontext nicht auffrisst (siehe gedaechtnis.ts).
  const gedaechtnis = await liesFakten({ anzahl: 120, raum: person }).then(faktenFuerPrompt).catch(() => '');
  // Werkzeuge nur, wenn nicht ausdrücklich abgeschaltet (z.B. Tagesplan = reiner Text).
  const tools: unknown[] = [];
  if (!payload.noTools) {
    tools.push({
      name: 'create_task',
      description: 'Legt eine Aufgabe in Kevins Board an — sofort, ohne Rückfrage. Nutze das, wenn Kevin dich bittet, etwas zu erfassen, oder wenn aus dem Gespräch klar eine konkrete Aufgabe entsteht. Eine gleichlautende offene Aufgabe wird erkannt und nicht doppelt angelegt.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Kurzer, klarer Aufgabentitel (imperativ)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priorität' },
          why: { type: 'string', description: '1 kurzer Satz Kontext/Begründung (optional)' },
          wer: { type: 'string', enum: ['kevin', 'malin', 'both'], description: 'Wer macht es (optional, Standard Kevin)' },
          faellig: { type: 'string', description: 'Fällig am, YYYY-MM-DD (optional)' },
        },
        required: ['title'],
      },
    });
    tools.push({
      name: 'run_agent',
      description: 'Führt einen Fach-Agenten DIREKT aus und liefert dir sein Ergebnis zurück — nutze das, statt Kevin nur zu verweisen, wenn er ein Ergebnis will (Recherche, Wochenlage, Zielbaum, Umsatz-Lage, Tagesform, Kalender-Analyse). Read-only/Entwurf: nichts geht ohne Freigabe nach außen. Danach fasst du das Ergebnis für Kevin zusammen.',
      input_schema: {
        type: 'object',
        properties: {
          agent: { type: 'string', enum: [...AUSFUEHRBAR], description: Object.entries(AGENT_ZWECK).map(([k, v]) => `${k} = ${v}`).join('; ') },
          auftrag: { type: 'string', description: 'Der konkrete Auftrag — bei research die Recherchefrage, bei content das Thema, bei meeting das Transkript, sonst optional' },
        },
        required: ['agent'],
      },
    });
    tools.push(
      {
        name: 'suche_wissen',
        description: 'Durchsucht Kevins eigene Notizen (MAKE OS-Vault, KEMA_Brain, MAKE) — sein aufgebautes Wissen über KEMARIS, Sales, Finanzen, Terminologie, Personen, Projekte. Nutze das IMMER, bevor du sagst, dass du etwas nicht weißt, und bei jeder Frage nach Zusammenhängen, Vereinbarungen, Preisen, Personen oder früheren Entscheidungen. Nenne danach die Quelle, aus der du zitierst.',
        input_schema: {
          type: 'object',
          properties: {
            frage: { type: 'string', description: 'Wonach gesucht wird — Stichworte reichen' },
            anzahl: { type: 'number', description: 'Wie viele Notizen, 1–8 (Standard 5)' },
          },
          required: ['frage'],
        },
      },
      {
        name: 'lies_notiz',
        description: 'Liest eine Notiz vollständig. Nutze das, wenn ein Suchtreffer vielversprechend war und du mehr als den Ausschnitt brauchst. Die Kennung steht bei jedem Treffer unter QUELLE.',
        input_schema: { type: 'object', properties: { notiz: { type: 'string', description: 'Die Kennung aus dem Suchtreffer' } }, required: ['notiz'] },
      },
      {
        name: 'notiz_anlegen',
        description: 'Legt eine NEUE Notiz in Kevins Vault an. Nutze das, wenn im Gespräch etwas entsteht, das dauerhaft gehört: ein Konzept, ein Protokoll, eine Sammlung. Eine bestehende Notiz wird dabei nie überschrieben.',
        input_schema: {
          type: 'object',
          properties: {
            titel: { type: 'string', description: 'Dateiname ohne .md' },
            text: { type: 'string', description: 'Der vollständige Inhalt in Markdown' },
            ordner: { type: 'string', description: 'Unterordner im Vault (Standard „05 Wissen")' },
          },
          required: ['titel', 'text'],
        },
      },
      {
        name: 'notiz_ergaenzen',
        description: 'Hängt etwas an eine bestehende Notiz an — z. B. ein Gesprächsergebnis unter den Steckbrief einer Person. Es wird nur angehängt, nie überschrieben.',
        input_schema: {
          type: 'object',
          properties: {
            notiz: { type: 'string', description: 'Die Kennung der Notiz' },
            text: { type: 'string', description: 'Was angehängt wird, in Markdown' },
          },
          required: ['notiz', 'text'],
        },
      },
    );
    tools.push({
      name: 'fakt_merken',
      description: 'Merkt sich einen dauerhaften Fakt. Nutze das SOFORT und ungefragt, wenn im Gespräch etwas fällt, das länger gilt: eine Person wechselt die Firma, eine Vorliebe, eine Entscheidung, eine wiederkehrende Zahl. NICHT für Tagesdaten, die ohnehin im Live-Zustand stehen. Kündige es nicht an — merk es dir einfach und rede weiter.',
      input_schema: {
        type: 'object',
        properties: {
          thema: { type: 'string', description: 'Worum es geht — ein Name, eine Firma, ein Bereich' },
          satz: { type: 'string', description: 'Der Fakt, möglichst in Kevins eigener Formulierung' },
          art: { type: 'string', enum: ['person', 'firma', 'vorliebe', 'entscheidung', 'termin', 'zahl', 'sonstiges'] },
          woher: { type: 'string', description: 'Woher du es weißt (optional)' },
          bis: { type: 'string', description: 'Gilt nur bis YYYY-MM-DD (optional)' },
          raum: { type: 'string', enum: ['gemeinsam'], description: 'Auf „gemeinsam" setzen, wenn der Fakt beide angeht: alles zu den Firmen, dem Produkt, Kunden, Zahlen, Terminologie, gemeinsamen Entscheidungen und Routinen. Weglassen nur bei rein Persönlichem — eigene Vorlieben, eigene Gesundheit, eigene Termine. Im Zweifel gemeinsam: geteiltes Wissen nützt beiden, verstecktes hilft niemandem.' },
        },
        required: ['thema', 'satz'],
      },
    });
    tools.push({
      name: 'frag_gedaechtnis',
      description: 'Sieht in deinem Langzeit-Gedächtnis nach. Nutze das, bevor du sagst, dass du etwas nicht weißt — das Gedächtnis ist größer als das, was in deinem Prompt steht.',
      input_schema: {
        type: 'object',
        properties: { thema: { type: 'string', description: 'Wonach du suchst (leer = alles)' } },
        required: [],
      },
    });
    tools.push({
      name: 'starte_auftraege',
      description: 'Schickt MEHRERE Agenten gleichzeitig in den Hintergrund. Nutze das, wenn Kevin etwas Größeres will, das mehrere Agenten braucht („mach mir eine Lage über alles", „prüf Postfach, Kalender und Zahlen"), oder wenn ein Lauf lange dauert und er nicht warten soll. Die Aufträge laufen parallel weiter, auch wenn dieses Gespräch endet — du bekommst hier KEIN Ergebnis zurück, sondern nur die Bestätigung. Für ein Ergebnis, das du sofort brauchst, nimm run_agent.',
      input_schema: {
        type: 'object',
        properties: {
          auftraege: {
            type: 'array',
            description: 'Bis zu 20 Agentenläufe, die nebeneinander laufen sollen',
            items: {
              type: 'object',
              properties: {
                agent: { type: 'string', enum: [...AUSFUEHRBAR], description: 'Welcher Agent' },
                auftrag: { type: 'string', description: 'Konkreter Auftrag für diesen Agenten (optional)' },
              },
              required: ['agent'],
            },
          },
        },
        required: ['auftraege'],
      },
    });
    tools.push({
      name: 'plan_block',
      description: 'Legt einen Block DIREKT in Kevins Tages-/Wochenplaner. Nutze das, wenn Kevin dich bittet, etwas einzuplanen („plane mir morgen 90 Minuten Fokus", „leg die Reha auf 18 Uhr"). Der Block erscheint sofort im Planer und ist frei verschiebbar. Kollisionen mit festen Terminen werden serverseitig verhindert — bei Kollision bekommst du einen Hinweis und schlägst eine andere Zeit vor.',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Tag YYYY-MM-DD (heute oder später)' },
          startMin: { type: 'number', description: 'Start in Minuten ab 00:00 (540 = 09:00), Raster 15, Fenster 360–1305' },
          dauerMin: { type: 'number', description: 'Dauer in Minuten (15–240)' },
          titel: { type: 'string', description: 'Kurzer Block-Titel' },
          art: { type: 'string', enum: ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'], description: 'Art des Blocks' },
        },
        required: ['date', 'startMin', 'dauerMin', 'titel'],
      },
    });
    // ── Erfassen per Zuruf: Kevin diktiert, Jarvis schreibt in die Stores ──
    tools.push(
      {
        name: 'setze_ziele',
        description: 'Setzt Jahresziele, Cash oder den Startmonat im Controlling. Nutze das, wenn Kevin Ziele nennt oder korrigiert („Jahresziel 300.000", „wir haben erst im Juni angefangen", „Ziel-Gewinn 100k"). Der Startmonat ist entscheidend: ohne ihn rechnet das System ab Januar und der Monatsschnitt wird falsch.',
        input_schema: { type: 'object', properties: {
          zielUmsatz: { type: 'number', description: 'Ziel-Umsatz für das Jahr in Euro' },
          zielGewinn: { type: 'number', description: 'Ziel-Gewinn für das Jahr in Euro' },
          cash: { type: 'number', description: 'Aktueller Cash-Bestand in Euro' },
          startMonat: { type: 'string', description: 'Ab wann gearbeitet wird — Monatsname („Juni") oder Index 0–11' },
        }, required: [] },
      },
      {
        name: 'erfasse_planposten',
        description: 'Legt eine wiederkehrende oder einmalige Einnahme/Ausgabe in der Liquiditäts-Planung an. Nutze das bei Abos, Mieten, Gehältern, Versicherungen, Steuervorauszahlungen und laufenden Mandaten („ich habe ein Abo für 49 im Monat abgeschlossen", „ab September zahlen wir 1.200 Miete"). Ausgaben als NEGATIVEN Betrag.',
        input_schema: { type: 'object', properties: {
          titel: { type: 'string', description: 'Wofür — z. B. „Adobe-Abo" oder „Mandat OneBanking"' },
          betrag: { type: 'number', description: 'Betrag in Euro; NEGATIV für Ausgaben, positiv für Einnahmen' },
          rhythmus: { type: 'string', enum: ['einmalig', 'monatlich', 'quartal', 'jaehrlich'], description: 'Wie oft — Standard monatlich' },
          ab: { type: 'string', description: 'Ab wann, YYYY-MM-DD (Standard heute)' },
          kategorie: { type: 'string', enum: ['mandat', 'produkt', 'sonstige-ein', 'personal', 'raum', 'steuern', 'kredite', 'betrieb', 'privat'], description: 'Wofür es zählt' },
          firma: { type: 'string', enum: ['kdv', 'kdc', 'kemaris', 'privat'], description: 'Wessen Konto' },
          sicher: { type: 'boolean', description: 'false, wenn der Posten noch unsicher ist (nur bei Einnahmen relevant)' },
        }, required: ['titel', 'betrag'] },
      },
      {
        name: 'setze_kontostand',
        description: 'Setzt den Kontostand einer Firma in der Finanzplanung. Nutze das sofort, wenn Kevin einen Kontostand nennt („Kontostand KDC 18.500").',
        input_schema: { type: 'object', properties: {
          firma: { type: 'string', description: 'kdv (KD Ventures) oder kdc (Kevin Dieckmann Consulting) — bei Unklarheit kdc' },
          betrag: { type: 'number', description: 'Kontostand in Euro' },
        }, required: ['betrag'] },
      },
      {
        name: 'erfasse_rechnung',
        description: 'Legt eine Ausgangsrechnung an oder aktualisiert die bestehende des Kunden (Betrag/Status/Fälligkeit). Nutze das, wenn Kevin sagt „Rechnung X über Y € gestellt/bezahlt/geplant".',
        input_schema: { type: 'object', properties: {
          kunde: { type: 'string' },
          titel: { type: 'string', description: 'Leistung (optional)' },
          betrag: { type: 'number' },
          status: { type: 'string', enum: ['geplant', 'gestellt', 'bezahlt'] },
          faellig: { type: 'string', description: 'YYYY-MM-DD (optional)' },
          firma: { type: 'string', description: 'kdv|kdc (optional, Standard kdc)' },
        }, required: ['kunde'] },
      },
      {
        name: 'erfasse_zahlung',
        description: 'Trägt eine eigene zu zahlende Rechnung in die Zahlungs-Prioritätenliste ein („wir müssen X 2.000 € zahlen bis …").',
        input_schema: { type: 'object', properties: {
          an: { type: 'string', description: 'An wen' },
          titel: { type: 'string' },
          betrag: { type: 'number' },
          faellig: { type: 'string', description: 'YYYY-MM-DD (optional)' },
        }, required: ['an', 'betrag'] },
      },
      {
        name: 'setze_meilenstein',
        description: 'Setzt Fortschritt oder erledigt an einem Meilenstein („setz F&F auf 80%", „Infiltration abhaken"). titel = Teil des Meilenstein-Namens.',
        input_schema: { type: 'object', properties: {
          titel: { type: 'string' },
          fortschritt: { type: 'number', description: '0–100' },
          erledigt: { type: 'boolean' },
        }, required: ['titel'] },
      },
      {
        name: 'setze_fokus',
        description: 'Setzt den Fokus-Satz für einen Horizont („Fokus der Woche: …").',
        input_schema: { type: 'object', properties: {
          horizont: { type: 'string', enum: ['tag', 'woche', 'monat', 'quartal', 'jahr'] },
          text: { type: 'string' },
        }, required: ['horizont', 'text'] },
      },
      {
        name: 'lies_postfach',
        description: 'Liest Kevins Apple-Mail-Postfach DIREKT und gibt dir die Nachrichten zurück. Nutze das IMMER selbst, wenn Kevin etwas aus seinen Mails wissen will („was steht in der Mail von X", „hol die Zahlen aus der Rechnung", „was ist heute reingekommen") — verweise ihn NIE auf den Inbox-Agenten, wenn du selbst nachsehen kannst. Mit „suche" bekommst du den vollen Text der passenden Mails, ohne nur die Betreffzeilen. Read-only: du liest, antwortest aber nie und löschst nie.',
        input_schema: { type: 'object', properties: {
          suche: { type: 'string', description: 'Suchwort in Absender oder Betreff (z. B. „whoop", „Rechnung", „Finanzamt"). Ohne Angabe kommt nur die Übersicht der neuesten Betreffzeilen.' },
          anzahl: { type: 'number', description: 'Wie viele Treffer mit Volltext, 1–5 (Standard 1)' },
        }, required: [] },
      },
      {
        name: 'setze_vitalwerte',
        description: 'Trägt Kevins Tagesform ein (Recovery, Schlaf, HRV, Ruhepuls). Nutze das, wenn er dir Werte nennt ODER wenn du sie gerade selbst aus einer Mail gelesen hast — dann schreibst du sie direkt weg, statt ihn auf /os/gesundheit zu schicken. Nur übergeben, was du wirklich weißt; nichts schätzen.',
        input_schema: { type: 'object', properties: {
          recovery: { type: 'number', description: 'Recovery in Prozent (0–100)' },
          schlaf: { type: 'number', description: 'Schlaf in Stunden (z. B. 7.4)' },
          hrv: { type: 'number', description: 'HRV in ms' },
          ruhepuls: { type: 'number', description: 'Ruhepuls in bpm' },
          datum: { type: 'string', description: 'Tag YYYY-MM-DD (Standard: heute)' },
          notiz: { type: 'string', description: 'Kurze Notiz zum Tag (optional)' },
        }, required: [] },
      },
      {
        name: 'hake_routine',
        description: 'Hakt eine oder mehrere Routinen ab (Reha, Supplements, Journal, Lesen, Shutdown, Licht, Essen). Nutze das, sobald jemand sagt, dass er etwas gemacht hat — „Reha gemacht", „Supplements genommen". Mehrere auf einmal erlaubt.',
        input_schema: { type: 'object', properties: {
          routinen: { type: 'array', items: { type: 'string' }, description: 'Namen der Routinen, wie genannt' },
          erledigt: { type: 'boolean', description: 'false = zurücknehmen (Standard true)' },
          datum: { type: 'string', description: 'YYYY-MM-DD (Standard heute)' },
        }, required: ['routinen'] },
      },
      {
        name: 'haut_eintrag',
        description: 'Haut-Tagebuch (Schuppenflechte): Juckreiz 0–10, Schub, Auslöser, Stellen. Nutze das, sobald jemand über Haut, Jucken, Kratzen oder einen Schub spricht.',
        input_schema: { type: 'object', properties: {
          juckreiz: { type: 'number', description: '0 = nichts, 10 = unerträglich' },
          schub: { type: 'boolean' },
          stellen: { type: 'array', items: { type: 'string' }, description: 'z. B. Ellbogen, Beine, Rücken' },
          ausloeser: { type: 'string', description: 'Was die Person selbst als Auslöser nennt (Stress, Essen, Schlaf …)' },
          notiz: { type: 'string' },
          datum: { type: 'string', description: 'YYYY-MM-DD (Standard heute)' },
        }, required: ['juckreiz'] },
      },
      {
        name: 'journal_eintrag',
        description: 'Journal für den Tag: was lief gut, wofür dankbar, wo hart zu sich; dazu Stimmung/Energie/Stress 1–5. Nutze das für die Abendantwort und für alles, was nach Reflexion klingt. Nur übernehmen, was gesagt wurde.',
        input_schema: { type: 'object', properties: {
          gut: { type: 'string' }, dankbar: { type: 'string' }, hart: { type: 'string' },
          text: { type: 'string', description: 'Freier Text, wenn es keine der drei Fragen trifft' },
          stimmung: { type: 'number' }, energie: { type: 'number' }, stress: { type: 'number', description: '1–5, niedrig = gut' },
          datum: { type: 'string' },
        }, required: [] },
      },
      {
        name: 'streak_eintrag',
        description: 'Der Streak (Cannabis-Schnitt): sauber ja/nein, Verlangen 0–10. Unterstützend, nie wertend — ein Rückfall ist ein Datum. Nutze das, sobald jemand „sauber", „nicht geraucht", „Rückfall" oder Verlangen erwähnt.',
        input_schema: { type: 'object', properties: {
          sauber: { type: 'boolean' },
          verlangen: { type: 'number', description: '0–10' },
          notiz: { type: 'string' },
          datum: { type: 'string' },
        }, required: ['sauber'] },
      },
      {
        name: 'setze_kunde',
        description: 'Aktualisiert oder erfasst einen Kunden im CRM (Status, Cashflow €/Monat, nächster Schritt).',
        input_schema: { type: 'object', properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['aktiv', 'gespraech', 'ruht'] },
          cashflow: { type: 'number', description: '€/Monat' },
          naechsterSchritt: { type: 'string' },
        }, required: ['name'] },
      },
    );
    if (LIVE_AGENTS.length) tools.push({
      name: 'open_agent',
      description: 'Verweist Kevin an den zuständigen Fach-Agenten in MAKE OS. Nutze das, wenn sein Anliegen klar in die Zuständigkeit eines Agenten fällt (Recherche, Umsatz/Runway, Zielbaum, Wochenlage, Meeting-Notizen, Text/Post, Zielliste, Kalender schützen). Beantworte die Frage trotzdem selbst — der Verweis ergänzt nur.',
      input_schema: {
        type: 'object',
        properties: {
          agent: { type: 'string', enum: LIVE_AGENTS.map(a => a.id), description: 'Die id des passenden Agenten' },
          why: { type: 'string', description: '1 kurzer Satz, warum dieser Agent hier hilft' },
        },
        required: ['agent'],
      },
    });
  }

  try {
    // Tool-Use-Schleife: Jarvis darf Agenten ausführen (run_agent), bekommt die
    // Ergebnisse zurück und antwortet erst dann. Max 3 Runden, max 4 Läufe.
    const origin = new URL(req.url).origin;
    const msgs: unknown[] = [...vorgeschichte, { role: 'user', content: message }];
    interface Block { type: string; id?: string; name?: string; text?: string; input?: Record<string, unknown> }
    let blocks: Block[] = [];
    let reply = '';
    const ran: { agent: string; ok: boolean }[] = [];
    let laufBudget = 8;
    let werkBudget = 14;

    for (let runde = 0; runde < 3; runde++) {
      const r = await askText({ system: systemPrompt(payload.context, live, !!vorgeschichte.length, gedaechtnis, person), user: message, messages: msgs, maxTokens: 4000, tools, timeoutMs: 180_000, zweck: 'jarvis-gespraech' });
      if (!r.ok) {
        return NextResponse.json(
          { reply: `Anthropic hat abgelehnt (${r.status || 'offline'}). Prüf den Key/das Modell.`, error: r.error?.slice(0, 300) },
          { status: 200 },
        );
      }
      const content: Block[] = Array.isArray((r.raw as { content?: Block[] })?.content) ? (r.raw as { content: Block[] }).content : [];
      blocks = blocks.concat(content);
      reply = [reply, r.text].filter(Boolean).join('\n\n');

      // Ausführbar in der Schleife: Agenten-Läufe UND alle Erfassungs-Werkzeuge.
      const laeufe = content.filter(b => b.type === 'tool_use' && (b.name === 'run_agent' || WERKZEUGE[b.name ?? '']));
      if (!laeufe.length || r.stopReason !== 'tool_use') break;

      // Assistant-Zug + Werkzeug-Ergebnisse zurückreichen
      msgs.push({ role: 'assistant', content });
      // PARALLEL ausführen — zwei Agenten nacheinander sprengen sonst das
      // Zeitfenster (Board + OKR je ~30s). Budget wird VOR dem Start gezogen.
      const zulaessig = laeufe.map(l => {
        const name = l.name ?? '';
        if (WERKZEUGE[name]) {
          const gueltig = werkBudget-- > 0;
          // Über fuehreAus — dort sitzen Risiko-Stufe, Trockenlauf, Stapel und
          // Protokoll. Es gibt bewusst keinen zweiten Weg zur Wirkung.
          return {
            l, agentId: name, gueltig,
            lauf: async () => (await fuehreAus(name, l.input ?? {}, origin, { anlass: message.slice(0, 200), person })).text,
          };
        }
        const agentId = String(l.input?.agent ?? '');
        const gueltig = (AUSFUEHRBAR as readonly string[]).includes(agentId) && laufBudget-- > 0;
        return { l, agentId, gueltig, lauf: async () => (await runAgent(agentId as Ausfuehrbar, String(l.input?.auftrag ?? ''), origin)).text };
      });
      const outs = await Promise.all(zulaessig.map(z =>
        z.gueltig ? z.lauf() : Promise.resolve('Nicht ausgeführt (unbekannter Agent oder Lauf-Budget erschöpft).')
      ));
      const results: unknown[] = zulaessig.map((z, zi) => {
        ran.push({ agent: z.agentId, ok: z.gueltig && !/fehlgeschlagen|nicht erreichbar|Kollision|Nicht ausgeführt|Kein Meilenstein/i.test(outs[zi]) });
        return { type: 'tool_result', tool_use_id: z.l.id, content: outs[zi] };
      });
      // open_agent/create_task in derselben Runde: leere Ergebnisse zurückgeben,
      // damit die API-Konversation gültig bleibt.
      for (const b of content.filter(x => x.type === 'tool_use' && x.name !== 'run_agent' && !WERKZEUGE[x.name ?? ''])) {
        results.push({ type: 'tool_result', tool_use_id: b.id, content: 'Notiert — wird Kevin als Vorschlag angezeigt.' });
      }
      msgs.push({ role: 'user', content: results });
    }

    // create_task legt seit 07.09. direkt an (freie Hand laut Kompass) — es
    // gibt deshalb keinen Bestätigungsknopf mehr, der eine zweite Aufgabe
    // erzeugen könnte.
    const handoffs = blocks
      .filter(b => b.type === 'tool_use' && b.name === 'open_agent')
      .map(b => {
        const a = LIVE_AGENTS.find(x => x.id === String(b.input?.agent ?? ''));
        return a ? { agent: a.id, name: a.name, href: a.href, why: String(b.input?.why ?? '') } : null;
      })
      .filter(Boolean);

    const fallback = handoffs.length ? 'Ich habe etwas für dich vorbereitet:' : 'Ich habe gerade keine Antwort erzeugt — frag mich nochmal.';
    const stapelOffen = await offeneAnzahl().catch(() => 0);
    return NextResponse.json({ reply: reply || fallback, handoffs, ran, stapelOffen });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ reply: 'Ich konnte Anthropic nicht erreichen (offline?). Versuch es gleich nochmal.', error: msg }, { status: 200 });
  }
}
