// ─── MAKE OS — Demo-Instanz: Agenten-Bereich und „Fotos & Videos“ (09.10., Paket 4c) — Server ─────────────────────────────────────
// Teil der Saat (lib/demo/saat.ts ruft `agentenUndMedienSaen`). Alles erfunden, nichts Echtes (Wächter tests/demo.test.ts liest jede Datei).
// Ohne KI-Schlüssel sieht die Demo vollständig aus: es wird NIE ein Modell aufgerufen — Antworten und Berichte der Agenten sind gespeichert.
//
// Über die ROUTEN in-process (wie die übrige Saat): Skills (POST /api/agenten/skills: anlegen, aktivieren), geplante Hintergrundaufgaben
// (POST /api/agenten/laeufe: planen), Medien (POST /api/medien: Album, Freigabe, an Head; Upload in Stücken über /api/medien/upload).
// Direkt über die Schreibstellen der Pakete — begründete Ausnahmen, weil es dafür keinen Weg OHNE Modellaufruf gibt:
//   · Threads mit Antworten und Berichten: `bestandAendern` (lib/agenten/faeden-server.ts — dieselbe Schreibstelle wie der Lauf; im Browser
//     entsteht eine Antwort nur über das Modell)
//   · der Testlauf des aktiven Skills: im Werkstatt-Bestand vermerkt (ein echter Testlauf ruft das Modell) — EINGESCHALTET wird er danach über
//     die Route, die `aktivierenFehlt` wie immer prüft
//   · der Vorschlag des Heads zu einem gegebenen Medium: `medienVorschlagAblegen` (lib/medien/heads.ts — so legt ihn ein Agent ab)
// Die Bilder sind kleine, hier erzeugte Farbflächen (PNG) — keine Fotos, keine Personen.

import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { updateJson } from '@/lib/store/local-db';
import { bauKennung, BAU_KOPF } from '@/lib/bau/kennung';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { headsIm } from '@/lib/agenten/katalog';
import { agentSchluessel, skillsHaushaltBestand, type AgentRef, type WerkstattBestand } from '@/lib/agenten/typen';
import { demoUuid } from './schutz';

type Modul = Record<string, unknown>;
type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const uuid = (schluessel: string) => demoUuid(`agenten:${schluessel}`, sha);

/** Eine Route in-process aufrufen (JSON oder rohe Bytes), wie lib/demo/saat.ts `rufe` — mit Parametern für dynamische Routen. */
async function rufe(modul: Promise<Modul>, methode: 'GET' | 'POST' | 'PUT', pfad: string, person: string, o: { json?: unknown; roh?: Buffer; kopf?: Record<string, string>; params?: Record<string, string> } = {}): Promise<Record<string, unknown>> {
  const fn = (await modul)[methode] as Handler | undefined;
  if (!fn) throw new Error(`${methode} ${pfad}: Route kennt die Methode nicht.`);
  const kopf: Record<string, string> = { 'x-make-user': person, ...(o.roh ? { 'content-type': 'application/octet-stream' } : { 'content-type': 'application/json' }), ...(o.kopf ?? {}) };
  const bau = bauKennung();
  if (bau) kopf[BAU_KOPF] = bau;
  const body = o.roh ? new Uint8Array(o.roh) : o.json === undefined ? undefined : JSON.stringify(o.json);
  const r = await fn(new Request(`http://demo.invalid${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body }) }), o.params ? { params: Promise.resolve(o.params) } : undefined);
  const text = await r.text();
  let j: Record<string, unknown> = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { roh: text.slice(0, 200) }; }
  if (!r.ok || j.ok === false) throw new Error(`${methode} ${pfad} → ${r.status}: ${String(j.error ?? j.fehler ?? text.slice(0, 300))}`);
  return j;
}

const R = {
  skills: () => import('@/app/api/agenten/skills/route') as Promise<Modul>,
  laeufe: () => import('@/app/api/agenten/laeufe/route') as Promise<Modul>,
  medien: () => import('@/app/api/medien/route') as Promise<Modul>,
  upload: () => import('@/app/api/medien/upload/route') as Promise<Modul>,
  uploadTeil: () => import('@/app/api/medien/upload/[id]/route') as Promise<Modul>,
};

// ── Kleine Farbflächen als PNG (ohne Bild-Bibliothek) ─────────────────────────────────────────────────────────────────────

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Buffer): number { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function block(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const pruef = Buffer.alloc(4); pruef.writeUInt32BE(crc32(td));
  return Buffer.concat([laenge, td, pruef]);
}
/** Ein Verlauf zwischen zwei Farben mit einem hellen Kreis — erkennbar verschieden, aber nur Formen. */
export function demoPng(breite: number, hoehe: number, von: [number, number, number], nach: [number, number, number]): Buffer {
  const zeilen: Buffer[] = [];
  for (let y = 0; y < hoehe; y++) {
    const z = Buffer.alloc(1 + breite * 3);
    for (let x = 0; x < breite; x++) {
      const t = (x + y) / (breite + hoehe);
      const dx = x - breite * 0.62, dy = y - hoehe * 0.38;
      const kreis = dx * dx + dy * dy < (Math.min(breite, hoehe) * 0.18) ** 2;
      for (let k = 0; k < 3; k++) z[1 + x * 3 + k] = kreis ? 245 : Math.round(von[k] + (nach[k] - von[k]) * t);
    }
    zeilen.push(z);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0); ihdr.writeUInt32BE(hoehe, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), block('IHDR', ihdr), block('IDAT', deflateSync(Buffer.concat(zeilen))), block('IEND', Buffer.alloc(0))]);
}

/** Ein Bild über den Upload-Weg (anlegen → Stück → Vorschau → fertig) — wie die Warteschlange im Browser. */
async function hochladen(person: string, schluessel: string, png: Buffer, meta: Record<string, unknown>): Promise<string> {
  const id = uuid(`medium:${schluessel}`);
  const s = await rufe(R.upload(), 'POST', '/api/medien/upload', person, { json: { id, typ: 'image/png', bytes: png.length, bereich: 'business', ortsdatenEntfernt: true, erkennbarePersonen: 'nein', breite: 96, hoehe: 96, ...meta } });
  const upId = (s.sitzung as { id: string }).id;
  const hash = createHash('sha256').update(png).digest('hex');
  await rufe(R.uploadTeil(), 'PUT', `/api/medien/upload/${upId}?teil=0`, person, { roh: png, kopf: { 'x-make-sha256': hash }, params: { id: upId } });
  await rufe(R.uploadTeil(), 'PUT', `/api/medien/upload/${upId}?variante=raster`, person, { roh: png, params: { id: upId } });
  await rufe(R.uploadTeil(), 'PUT', `/api/medien/upload/${upId}?variante=ansicht`, person, { roh: png, params: { id: upId } });
  const pruefsumme = createHash('sha256').update(Buffer.from(hash, 'hex')).digest('hex');
  const f = await rufe(R.uploadTeil(), 'POST', `/api/medien/upload/${upId}`, person, { json: { pruefsumme }, params: { id: upId } });
  return (f.medium as { id: string }).id;
}

// ── Threads (gespeicherte Antworten, kein Modell) ─────────────────────────────────────────────────────────────────────────

/** Je Business-Head ein Gespräch (Frage der Person, Antwort des Heads) — erfunden, ohne echte Namen oder Beträge. */
const GESPRAECHE: Record<string, { wer: 'lena' | 'jonas'; frage: string; antwort: string }[]> = {
  sales: [
    { wer: 'lena', frage: 'Welche drei Deals sollten wir diese Woche zuerst anfassen?', antwort: 'Zuerst „Diagnose Grünfeld Bau“ (Angebot liegt, Entscheidung in zwei Wochen), dann „Begleitung Atlas Software“ (Workshop steht an) und „Cockpit für Seeblick Hotels“ (Demo-Termin vorbereiten). Für alle drei liegt der nächste Schritt als Vorschlag im Stapel. (Beispiel)' },
    { wer: 'lena', frage: 'Bitte recherchiere passende Zielfirmen wie unsere besten Kunden.', antwort: 'Ich habe „Recherche & Prospecting“ beauftragt — der Bericht steht unten. Fünf Firmen passen zum Profil; Ansprache nur über die Kanäle mit grüner Ampel. (Beispiel)' },
  ],
  marketing: [
    { wer: 'lena', frage: 'Was posten wir nächste Woche?', antwort: 'Drei Vorschläge: ein Rückblick auf das Sommerfest mit einem freigegebenen Bild, ein kurzer Tipp zu Kennzahlen und eine Einladung zum Webinar. Texte liegen als Entwurf bereit — veröffentlicht wird von Hand. (Beispiel)' },
    { wer: 'lena', frage: 'Mach aus den Sommerfest-Fotos einen Beitrag.', antwort: '„Bild & Video“ hat das gegebene Foto angesehen und Alt-Text und Post-Entwurf vorgeschlagen — der Vorschlag liegt im Freigabe-Stapel. (Beispiel)' },
  ],
  event: [{ wer: 'lena', frage: 'Wie bereiten wir den nächsten Abend vor?', antwort: 'Ziel festlegen, Gästemischung aus Kundschaft und Zielkunden, Einladung zwei Wochen vorher, Nachfassen binnen 48 Stunden. Eine Checkliste liegt als Aufgaben-Vorschlag bereit. (Beispiel)' }],
  finanzen: [{ wer: 'jonas', frage: 'Wie sieht die Liquidität im nächsten Quartal aus?', antwort: 'Die Kasse reicht bei heutigem Plan gut über das Quartal; zwei Rechnungen sind bald fällig. Hinweis, keine Steuerberatung. (Beispiel)' }],
  it: [{ wer: 'jonas', frage: 'Gibt es etwas im Betrieb, das ich wissen muss?', antwort: 'Das Lagebild ist grün: Sicherung der letzten Nacht vollständig, keine Auffälligkeiten. (Beispiel)' }],
  operations: [{ wer: 'lena', frage: 'Was liegt im Business-Postfach offen?', antwort: 'Zwei Anfragen warten auf Antwort, eine Rechnung gehört in die Buchhaltung. Ich habe drei Aufgaben vorgeschlagen. (Beispiel)' }],
  kundenerfolg: [{ wer: 'lena', frage: 'Welches Mandat braucht gerade Aufmerksamkeit?', antwort: 'Die Cockpit-Einführung bei Lumen: die Datenanbindung „Lager“ ist offen. Ein Review-Termin ist als Vorschlag vorbereitet. (Beispiel)' }],
  strategie: [{ wer: 'lena', frage: 'Sind wir beim Jahresziel auf Kurs?', antwort: 'Beim wiederkehrenden Umsatz knapp unter dem Kurs; der Meilenstein „Pipeline: 10 qualifizierte Gespräche“ entscheidet. Board-Bericht folgt am Freitag. (Beispiel)' }],
  produkt: [{ wer: 'jonas', frage: 'Was sind die drei wichtigsten Wünsche für Cockpit 2.0?', antwort: 'Kennzahlen je Standort, Export als PDF und eine Ansicht fürs Handy — als Karten im Bauplan vorgeschlagen. (Beispiel)' }],
  recht: [{ wer: 'lena', frage: 'Welche Datenschutz-Punkte sind offen?', antwort: 'Ein Auftragsverarbeitungsvertrag ist noch zu bestätigen. Hinweis, keine Rechtsberatung. (Beispiel)' }],
  research: [{ wer: 'lena', frage: 'Was bewegt den Markt für Kennzahlen-Software gerade?', antwort: 'Drei Trends: Planung direkt im Cockpit, KI-Zusammenfassungen und mehr Datenschutz-Anforderungen. Quellen stehen in der Notiz im Brain. (Beispiel)' }],
};

/** Zwei Mitarbeiter-Aufträge mit Bericht in den Head-Thread (wie `delegieren` + `ergebnisSchreiben`, nur ohne Lauf). */
const AUFTRAEGE: { head: string; mitarbeiter: string; frageIndex: number; auftrag: { ziel: string; format: string; grenzen: string; quellen: string }; bericht: string }[] = [
  { head: 'sales', mitarbeiter: 'sales-recherche', frageIndex: 1, auftrag: { ziel: 'Fünf Zielfirmen wie unsere besten Kunden', format: 'Liste mit Grund und Kanal-Ampel', grenzen: 'nichts senden, nur Vorschläge', quellen: 'Kartei, Zielkunden-Profil' },
    bericht: 'Fünf Firmen aus Maschinenbau und Logistik mit 100–400 Mitarbeitenden passen; zwei davon kennen wir schon über Veranstaltungen. Vorschläge für die Qualifizierung liegen im Stapel. (Beispiel)' },
  { head: 'marketing', mitarbeiter: 'marketing-bild-video', frageIndex: 1, auftrag: { ziel: 'Beitrag aus den Sommerfest-Fotos', format: 'Alt-Text und Post-Entwurf je Bild', grenzen: 'nur die gegebenen Fotos, nur Vorschläge, kein Bild erzeugen', quellen: 'Fotos & Videos (Auftrag des Heads)' },
    bericht: 'Das gegebene Foto eignet sich als Titelbild (ruhige Fläche für Text). Alt-Text und Post-Entwurf liegen als Vorschlag im Freigabe-Stapel. (Beispiel)' },
];

async function faedenSaen(personen: { lena: string; jonas: string }, jetzt: Date, medium?: string): Promise<number> {
  const { bestandAendern } = await import('@/lib/agenten/faeden-server');
  const { neuerFaden, anhaengen, fadenHinzu, auftragText } = await import('@/lib/agenten/faeden');
  type Kern = import('@/lib/agenten/faeden').FadenKern;
  type NKern = import('@/lib/agenten/faeden').NachrichtKern;
  let n = 0;
  const zeit = (min: number) => new Date(jetzt.getTime() - min * 60_000).toISOString();
  const nachricht = (schluessel: string, x: Omit<NKern, 'id'>): NKern => ({ id: `nr-${uuid(`nr:${schluessel}`)}`, ...x });
  for (const head of headsIm('business')) {
    const liste = GESPRAECHE[head.id] ?? [];
    for (let i = 0; i < liste.length; i++) {
      const g = liste[i];
      const person = personen[g.wer];
      const agent: AgentRef = { art: 'head', headId: head.id };
      const id = `fd-${uuid(`faden:${head.id}:${i}`)}`;
      const t0 = zeit(600 - n * 20);
      let f: Kern = neuerFaden({ id, besitzer: person, agent, bereich: 'business', titel: g.frage, jetzt: t0, kette: [agentSchluessel(agent)] });
      const msgs: NKern[] = [
        nachricht(`${id}:frage`, { rolle: 'person', von: person, text: g.frage, zeit: t0, ...(head.id === 'marketing' && i === 1 && medium ? { anhaenge: [{ art: 'medium' as const, id: medium, name: 'Bühne (Beispiel)' }] } : {}) }),
        nachricht(`${id}:antwort`, { rolle: 'agent', von: agentSchluessel(agent), text: g.antwort, zeit: zeit(598 - n * 20), ki: true, kosten: { cent: 0 } }),
      ];
      const a = AUFTRAEGE.find(x => x.head === head.id && x.frageIndex === i);
      let kind: Kern | null = null;
      if (a) {
        const kindAgent: AgentRef = { art: 'mitarbeiter', headId: head.id, mitarbeiterId: a.mitarbeiter };
        const kindId = `fd-${uuid(`faden:${head.id}:${a.mitarbeiter}`)}`;
        kind = neuerFaden({ id: kindId, besitzer: person, agent: kindAgent, bereich: 'business', titel: a.auftrag.ziel, jetzt: zeit(597 - n * 20), elternId: id, kette: [agentSchluessel(agent), agentSchluessel(kindAgent)] });
        const k = anhaengen(kind, [
          nachricht(`${kindId}:auftrag`, { rolle: 'agent', von: agentSchluessel(agent), text: auftragText(a.auftrag), zeit: zeit(597 - n * 20), auftrag: a.auftrag }),
          nachricht(`${kindId}:bericht`, { rolle: 'agent', von: agentSchluessel(kindAgent), text: a.bericht, zeit: zeit(590 - n * 20), ki: true, kosten: { cent: 0 }, fremd: 'agent' }),
        ], zeit(590 - n * 20));
        if (!k.ok) throw new Error(k.fehler);
        kind = { ...k.faden, ...(head.id === 'marketing' ? { geteilt: { am: jetzt.toISOString(), von: person } } : {}), status: 'fertig', lauf: { status: 'fertig', schritte: [{ id: 's1', titel: 'Runde 1', status: 'fertig' }], start: zeit(597 - n * 20), ende: zeit(590 - n * 20), kostenCent: 0 }, gelesenAm: jetzt.toISOString() };
        msgs.push(nachricht(`${id}:gesendet`, { rolle: 'system', von: 'system', text: `An Thread „${kind.titel}“ gesendet`, zeit: zeit(597 - n * 20), verweis: { art: 'gesendet', fadenId: kindId, titel: kind.titel }, auftrag: a.auftrag }));
        msgs.push(nachricht(`${id}:bericht`, { rolle: 'system', von: 'system', text: `Bericht aus Thread „${kind.titel}“ (fertig):\n${a.bericht}`, zeit: zeit(590 - n * 20), verweis: { art: 'bericht', fadenId: kindId, titel: kind.titel }, fremd: 'agent' }));
      }
      const h = anhaengen(f, msgs, msgs[msgs.length - 1].zeit);
      if (!h.ok) throw new Error(h.fehler);
      f = { ...h.faden, gelesenAm: jetzt.toISOString(), ...(head.id === 'marketing' ? { geteilt: { am: jetzt.toISOString(), von: person } } : {}) };
      const r = await bestandAendern<null>(person, b => {
        if (b.faeden.some(x => x.id === id)) return { bestand: b, e: null };
        const x = fadenHinzu(b, f);
        if (!x.ok) return x;
        const y = kind ? fadenHinzu(x.bestand, kind) : x;
        return y.ok ? { bestand: y.bestand, e: null } : y;
      });
      if (!r.ok) throw new Error(r.fehler);
      n += kind ? 2 : 1;
    }
  }
  return n;
}

// ── Skills, Hintergrundaufgaben ───────────────────────────────────────────────────────────────────────────────────────

const SKILLS = [
  { headId: 'sales', name: 'wochenstart-pipeline', aktiv: true, beschreibung: 'Montags vor dem Wochenstart: offene Deals nach Dringlichkeit ordnen und je Deal den nächsten Schritt vorschlagen.',
    anleitung: '1. Pipeline lesen. 2. Deals ohne nächsten Schritt oder mit überfälligem Schritt zuerst. 3. Je Deal einen Schritt vorschlagen (nur Vorschlag). 4. Kurz zusammenfassen.',
    werkzeuge: ['pipeline', 'crm_vorschlag'], ausloeser: { art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '07:30', tage: [1] } },
  { headId: 'marketing', name: 'beitrag-aus-fotos', aktiv: false, beschreibung: 'Wenn Fotos eines Events gegeben wurden: einen Beitrag mit Alt-Text und Post-Entwurf vorschlagen.',
    anleitung: '1. Gegebene Medien ansehen (nur Angaben). 2. Das ruhigste Bild als Titel vorschlagen. 3. Alt-Text und Post-Entwurf in der eigenen Sprache. 4. Nichts veröffentlichen.',
    werkzeuge: ['marketing_lage', 'crm_vorschlag'], ausloeser: { art: 'hand' } },
  { headId: 'finanzen', name: 'zahlungserinnerung-entwurf', aktiv: false, beschreibung: 'Bei überfälligen Rechnungen eine freundliche Zahlungserinnerung entwerfen — verschickt wird von Hand.',
    anleitung: '1. Offene Rechnungen prüfen. 2. Je überfällige Rechnung einen kurzen, freundlichen Entwurf. 3. Nichts verschicken.',
    werkzeuge: ['mandate_lage', 'create_task'], ausloeser: { art: 'hand' } },
] as const;
const TESTS = [
  { eingabe: 'Beispiel mit drei offenen Vorgängen', erwartet: ['Vorschlag'] },
  { eingabe: 'Beispiel ohne offene Vorgänge', erwartet: ['nichts'] },
  { eingabe: 'Beispiel mit einem überfälligen Vorgang', erwartet: ['zuerst'] },
];

async function skillsSaen(person: string, haushalt: string, jetzt: Date): Promise<number> {
  let n = 0;
  for (const s of SKILLS) {
    const a = await rufe(R.skills(), 'POST', '/api/agenten/skills', person, { json: { aktion: 'anlegen', anfrageId: uuid(`skill:${s.name}`), skill: { headId: s.headId, name: s.name, beschreibung: s.beschreibung, anleitung: s.anleitung, werkzeuge: s.werkzeuge, ausloeser: s.ausloeser, tests: TESTS, ergebnis: 'stapel' } } });
    const id = (a.skill as { id: string }).id;
    n++;
    if (!s.aktiv) continue;
    // Gespeicherter Testlauf (siehe Kopf) — eingeschaltet wird danach über die Route (prüft `aktivierenFehlt`).
    const am = new Date(Math.max(Date.now(), jetzt.getTime()) + 1000).toISOString();
    await updateJson<WerkstattBestand>(skillsHaushaltBestand(haushalt), w => ({ ...(w as WerkstattBestand), skills: (w?.skills ?? []).map(x => (x.id === id ? { ...x, testlauf: { am, von: person, ok: true, ergebnisse: TESTS.map((_, i) => ({ test: i, ok: true, notiz: 'Demo: gespeicherter Testlauf (kein Modellaufruf)' })) } } : x)) }));
    const g = await rufe(R.skills(), 'GET', `/api/agenten/skills?id=${id}`, person);
    await rufe(R.skills(), 'POST', '/api/agenten/skills', person, { json: { aktion: 'aktivieren', id, stand: g.stand } });
  }
  return n;
}

async function planSaen(person: string, heute: string): Promise<number> {
  const aufgaben = [
    { agent: { art: 'head', headId: 'marketing' }, titel: 'Beiträge der Woche planen', auftrag: 'Ziel: drei Beitragsideen für die nächste Woche. Format: je Idee ein Satz und ein Bildvorschlag aus den gegebenen Fotos. Grenzen: nichts veröffentlichen. Quellen: Redaktionsplan, Fotos & Videos.', zeitplan: { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '09:00', tage: [4] } },
    { agent: { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-recherche' }, titel: 'Zielfirmen für die Messe recherchieren', auftrag: 'Ziel: zehn Firmen, die zur Messe passen. Format: Liste mit Grund. Grenzen: nur Vorschläge, nichts senden. Quellen: Kartei, Web.', zeitplan: { art: 'einmalig', wann: `${tagPlus(heute, 2)}T10:00:00` } },
  ];
  for (const a of aufgaben) await rufe(R.laeufe(), 'POST', '/api/agenten/laeufe', person, { json: { aktion: 'planen', anfrageId: uuid(`plan:${a.titel}`), aufgabe: a, kostenBestaetigt: true } });
  return aufgaben.length;
}

// ── Fotos & Videos ───────────────────────────────────────────────────────────────────────────────────────────────────

async function medienSaen(personen: { lena: string; jonas: string }, heute: string): Promise<{ anzahl: number; anHead: string }> {
  const al = await rufe(R.medien(), 'POST', '/api/medien', personen.lena, { json: { aktion: 'album-anlegen', bereich: 'business', art: 'frei', titel: 'Sommerfest (Beispiel)' } });
  const album = (al.album as { id: string }).id;
  const eins = await hochladen(personen.lena, 'buehne', demoPng(96, 96, [33, 181, 170], [12, 40, 60]), { album, name: 'Bühne (Beispiel)' });
  const zwei = await hochladen(personen.jonas, 'stand', demoPng(96, 96, [222, 158, 99], [60, 30, 20]), { album, name: 'Stand (Beispiel)' });
  const drei = await hochladen(personen.lena, 'abendlicht', demoPng(96, 96, [167, 155, 255], [20, 18, 50]), { album, name: 'Abendlicht (Beispiel)' });
  // Eins: freigegeben (keine Personen → ohne Vier-Augen). Zwei: Freigabe angefragt. Drei: an den Head of Marketing gegeben (Auswahl + Texte).
  await rufe(R.medien(), 'POST', '/api/medien', personen.lena, { json: { aktion: 'freigabe', id: eins, schritt: 'freigeben', kanaele: ['website', 'social'], bis: tagPlus(heute, 365) } });
  await rufe(R.medien(), 'POST', '/api/medien', personen.jonas, { json: { aktion: 'freigabe', id: zwei, schritt: 'anfragen', kanaele: ['social'], bis: tagPlus(heute, 180) } });
  const h = await rufe(R.medien(), 'POST', '/api/medien', personen.lena, { json: { aktion: 'an-head', id: drei, head: 'marketing', auftrag: ['auswahl', 'text'], notiz: 'Für den Rückblick-Beitrag (Beispiel)', auftragId: `ha-${uuid('auftrag:abendlicht')}` } });
  const auftragId = ((h.medium as { heads: { head: string; auftragId: string }[] }).heads.find(x => x.head === 'marketing'))!.auftragId;
  const { medienVorschlagAblegen } = await import('@/lib/medien/heads');
  const v = await medienVorschlagAblegen({ person: personen.lena, headId: 'marketing', auftragId, titel: 'Abendlicht als Titelbild für den Rückblick (Beispiel)',
    auswahl: [{ mediumId: drei, begruendung: 'Ruhige Fläche oben rechts für den Text.' }],
    texte: [{ mediumId: drei, alt: 'Abstrakte Fläche in Violett mit hellem Kreis (Beispiel)', post: 'Danke für einen schönen Abend! Der Rückblick folgt. (Beispiel)' }] });
  if (!v.ok) throw new Error(v.fehler);
  return { anzahl: 3, anHead: drei };
}

/** Agenten-Bereich und Medien der Demo säen. Liefert die Schritte für den Bericht der Saat. */
export async function agentenUndMedienSaen(o: { lena: string; jonas: string; haushalt: string; heute: string; jetzt: Date }): Promise<{ name: string; anzahl: number }[]> {
  const personen = { lena: o.lena, jonas: o.jonas };
  const medien = await medienSaen(personen, o.heute);
  const faeden = await faedenSaen(personen, o.jetzt, medien.anHead);
  const skills = await skillsSaen(o.lena, o.haushalt, o.jetzt);
  const plan = await planSaen(o.lena, o.heute);
  return [
    { name: 'Fotos & Videos', anzahl: medien.anzahl },
    { name: 'Agenten: Threads', anzahl: faeden },
    { name: 'Agenten: Skills', anzahl: skills },
    { name: 'Agenten: Hintergrundaufgaben', anzahl: plan },
  ];
}
