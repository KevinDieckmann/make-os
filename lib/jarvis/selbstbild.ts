// ─── MAKE OS — Was die Software über sich selbst weiß ───────────────────────
// Kevins Wunsch vom 07.09.: „dass die ganze Software da auch im Grunde
// genommen drin ist" — also im Gehirn.
//
// Der Text hier wird NICHT geschrieben, sondern aus den echten Quellen
// gerechnet: dem Agentenverzeichnis, dem Werkzeug-Register, den Speichern und
// dem Bauplan. Eine von Hand gepflegte Beschreibung wäre nach zwei Tagen
// falsch — und eine falsche Beschreibung im Gehirn ist schlimmer als keine,
// weil Jarvis daraus antwortet.

import { readdir, stat } from 'node:fs/promises';
import { DEPARTMENTS, STATUS_LABEL, AUTONOMY_LABEL } from '@/lib/make-one/agents-data';
import { REGISTER, RISIKO_LABEL } from './register';
import { WERKZEUGE } from './werkzeuge';
import { AUSFUEHRBAR, AGENT_ZWECK } from './agenten';
import { MASSEN_GRENZE } from '@/lib/store/massen-wache';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

const heute = () => localDay();

/** Ein Blatt: Dateiname ohne Endung, plus der Inhalt. */
export interface Blatt { name: string; text: string }

function ueberblick(): Blatt {
  const alle = DEPARTMENTS.flatMap(d => d.agents);
  const live = alle.filter(a => a.status === 'live').length;
  return {
    name: 'MAKE OS — Überblick',
    text: [
      '# MAKE OS',
      '',
      'Kevins und Malins privates Betriebssystem. Läuft lokal auf dem Mac, Port 3001.',
      'Alle Daten liegen als JSON-Dateien unter `.data` — nichts in einer fremden Cloud.',
      '',
      '## Die Teile',
      '',
      '- **Jarvis** — die zentrale Intelligenz. Nimmt Aufträge entgegen, führt Werkzeuge aus,',
      `  startet Agenten. Erreichbar auf jeder Seite; der Empfang liegt unter \`/jarvis\`.`,
      `- **${alle.length} Agenten** in ${DEPARTMENTS.length} Abteilungen, davon ${live} live.`,
      '- **Der Stapel** (`/os/stapel`) — was Jarvis vorbereitet hat und auf Freigabe wartet,',
      '  was gerade im Hintergrund läuft, was er sich gemerkt hat, und was er getan hat.',
      '- **Der Arbeiter** — ein eigener Prozess neben der App. Holt Aufträge aus der',
      '  Warteschlange und lässt sie ausführen, mehrere gleichzeitig, auch nachts.',
      '- **Der Takt** — entscheidet serverseitig, was fällig ist: Morgenlauf, Tageslauf,',
      '  Abendlauf, Verbesserungs-Loop.',
      '- **Das Gehirn** — diese Notizen hier plus Kevins Vaults, durchsuchbar für Jarvis.',
      '',
      '## Die drei Räume',
      '',
      'Kevin, Malin und gemeinsam. Persönliche Bestände (Vitalwerte, Journal, Routinen)',
      'liegen je Person getrennt; Zahlen, Aufgaben und Kontakte sind gemeinsam.',
      '',
      '> Diese Notiz wird täglich neu erzeugt. Von Hand geändert wird sie beim nächsten Lauf überschrieben.',
    ].join('\n'),
  };
}

function agenten(): Blatt {
  const zeilen: string[] = ['# Die Agenten', ''];
  for (const abt of DEPARTMENTS) {
    zeilen.push(`## ${abt.name}`, '', `_${abt.mission}_`, '');
    for (const a of abt.agents) {
      const erreichbar = (AUSFUEHRBAR as readonly string[]).includes(a.id);
      zeilen.push(
        `### ${a.name}`,
        '',
        `- **Status:** ${STATUS_LABEL[a.status]}${a.gate ? ` · Freigabe: ${a.gate}` : ''}`,
        `- **Autonomie:** ${AUTONOMY_LABEL[a.autonomy]}`,
        `- **Jarvis kann ihn starten:** ${erreichbar ? `ja — ${AGENT_ZWECK[a.id as never] ?? ''}` : 'nein'}`,
        `- **Kann:** ${a.funktionen.join(' · ')}`,
        '',
        a.bauplan,
        '',
      );
    }
  }
  zeilen.push('> Täglich neu erzeugt aus dem Agentenverzeichnis der Software.');
  return { name: 'MAKE OS — Agenten', text: zeilen.join('\n') };
}

function werkzeuge(): Blatt {
  const nachRisiko = { frei: [] as string[], freigabe: [] as string[], nie: [] as string[] };
  for (const name of Object.keys(WERKZEUGE)) {
    const r = REGISTER[name]?.risiko ?? 'freigabe';
    nachRisiko[r].push(`\`${name}\` (${REGISTER[name]?.gruppe ?? '—'})`);
  }
  return {
    name: 'MAKE OS — Werkzeuge und Grenzen',
    text: [
      '# Was Jarvis darf — und was nicht',
      '',
      'Die Stufe ist eine Eigenschaft des Werkzeugs, nicht eine Entscheidung des Modells.',
      'Sie steht in einer Tabelle im Code und lässt sich durch keinen Satz überreden.',
      '',
      `## Läuft durch (${RISIKO_LABEL.frei})`, '',
      nachRisiko.frei.map(x => `- ${x}`).join('\n') || '—', '',
      `## Braucht Kevins Freigabe (${RISIKO_LABEL.freigabe})`, '',
      nachRisiko.freigabe.map(x => `- ${x}`).join('\n') || '—', '',
      'Diese landen als Vorschlag im Stapel — mit Vorher und Nachher, gerechnet aus',
      'demselben Bestand, den die Ausführung anfassen würde.',
      '',
      '## Die Wächter', '',
      '- **Schrumpf-Wächter:** Verliert eine Liste mehr als die Hälfte, wird abgelehnt.',
      '  Absichtliches Leeren geht nur mit ausdrücklicher Bestätigung.',
      `- **Massen-Erledigung:** Kippen mehr als ${MASSEN_GRENZE} Aufgaben in einem Schreibvorgang`,
      '  auf erledigt, wird nachgefragt. Der Schrumpf-Wächter sieht das nicht — die Liste',
      '  bleibt ja gleich lang.',
      '- **Idempotenz:** Gleiche Wirkung, gleicher Schlüssel. Ein Wiederholungslauf legt',
      '  dieselbe Rechnung nicht zweimal an.',
      '- **Räume:** Was einer Person gehört, sieht die andere nicht — auch Jarvis nicht,',
      '  wenn er für sie arbeitet.',
      '- **Vault:** Anlegen und anhängen ja, überschreiben und löschen nein. Private',
      '  Ordner werden gar nicht erst geöffnet, statt später gefiltert.',
      '',
      '> Täglich neu erzeugt aus dem Werkzeug-Register der Software.',
    ].join('\n'),
  };
}

async function daten(): Promise<Blatt> {
  const zeilen: string[] = [
    '# Wo die Daten liegen', '',
    'Alles unter `.data` im Projektordner, als JSON. Täglich gesichert nach `.data/backup`',
    '(14 Stände). Was dauerhaft aufgehoben werden soll, liegt in `.data/archiv` — das läuft',
    'nicht weg.', '',
    '| Datei | Größe | Inhalt |', '|---|---|---|',
  ];
  try {
    const dateien = (await readdir('.data')).filter(f => f.endsWith('.json')).sort();
    for (const f of dateien) {
      try {
        const s = await stat(`.data/${f}`);
        const inhalt = await loadJson<Record<string, unknown>>(f.replace(/\.json$/, ''));
        const schluessel = inhalt && typeof inhalt === 'object' ? Object.keys(inhalt) : [];
        const menge = schluessel
          .map(k => (Array.isArray((inhalt as Record<string, unknown>)[k]) ? `${k}: ${((inhalt as Record<string, unknown[]>)[k]).length}` : null))
          .filter(Boolean).slice(0, 3).join(', ');
        zeilen.push(`| \`${f}\` | ${Math.max(1, Math.round(s.size / 1024))} KB | ${menge || schluessel.slice(0, 4).join(', ') || '—'} |`);
      } catch { /* eine Datei überspringen ist besser als keine Tabelle */ }
    }
  } catch {
    zeilen.push('| — | — | Verzeichnis nicht lesbar |');
  }
  zeilen.push('', '> Täglich neu erzeugt aus dem Datenverzeichnis der Software.');
  return { name: 'MAKE OS — Daten', text: zeilen.join('\n') };
}

async function stand(): Promise<Blatt> {
  interface Punkt { id: string; titel: string; status: string; prio?: number; strang?: string; angelegt?: string }
  const b = await loadJson<{ items?: Punkt[] }>('backlog');
  const items = b?.items ?? [];
  const fertig = items.filter(x => x.status === 'erledigt')
    .sort((a, c) => String(c.angelegt ?? '').localeCompare(String(a.angelegt ?? ''))).slice(0, 12);
  const offen = items.filter(x => x.status !== 'erledigt');
  const p1 = offen.filter(x => x.prio === 1);
  return {
    name: 'MAKE OS — Stand',
    text: [
      `# Stand vom ${heute()}`, '',
      `${items.length} Punkte im Bauplan, davon ${offen.length} offen und ${p1.length} mit erster Priorität.`,
      '', '## Zuletzt gebaut', '',
      fertig.map(x => `- ${x.titel}`).join('\n') || '—',
      '', '## Als Nächstes dran', '',
      p1.slice(0, 12).map(x => `- ${x.titel}`).join('\n') || '—',
      '', 'Die vollständige Liste steht in der Software unter `/os/bauplan` — sie ist dort',
      'die Wahrheit, diese Notiz nur der Auszug.',
      '', '> Täglich neu erzeugt aus dem Bauplan der Software.',
    ].join('\n'),
  };
}

/** Alle Blätter, frisch gerechnet. */
export async function blaetter(): Promise<Blatt[]> {
  return [ueberblick(), agenten(), werkzeuge(), await daten(), await stand()];
}
