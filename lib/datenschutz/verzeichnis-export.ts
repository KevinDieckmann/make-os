// ─── Verzeichnis der Verarbeitungstätigkeiten als Dokument (05.10., rein, getestet) ─
// Art. 30 Abs. 1 DSGVO, Abs. 3: schriftlich bzw. elektronisch. EIN Dokument aus EINER Quelle: Verantwortlicher (Einrichtung),
// Verarbeitungen (CRM-Bestand `verarbeitungen`), Empfänger/AVV (Einrichtung), Löschfristen (lib/crm/loeschfristen.ts).
// JSON zum Weitergeben/Archivieren, HTML zum Drucken (Browser › Drucken › als PDF). Alles escaped — Texte stammen aus Eingaben.
// Hinweis, keine Rechtsberatung.

import type { Verarbeitung } from '@/lib/crm/typen';
import { avvText, garantieText, rolleText, verantwortlichAufloesen, verantwortlicherAuskunft, VERANTWORTLICHER_FEHLT, type Empfaenger, type Verantwortlicher } from './einrichtung';
import { LOESCHFRISTEN, SICHERUNG_SATZ, fristText, type Fristen } from '@/lib/crm/loeschfristen';
import { tagVon } from '@/lib/zeit';

export interface VerzeichnisDokument {
  titel: string; stand: string; hinweis: string;
  verantwortlicher: Record<string, unknown>;
  verarbeitungen: (Omit<Verarbeitung, 'empfaengerIds'> & { empfaengerRegister: { name: string; rolle: string; drittland: string; avv: string }[] })[];
  empfaenger: { name: string; rolle: string; zweck: string; daten: string; drittland: string; garantie: string; avv: string; inGebrauch: boolean }[];
  loeschfristen: { titel: string; frist: string; norm: string }[];
  sicherungen: string;
}

export function verzeichnisDokument(a: { verarbeitungen: readonly Verarbeitung[]; verantwortlicher: Verantwortlicher | null; empfaenger: readonly Empfaenger[]; fristen: Fristen; jetzt: string }): VerzeichnisDokument {
  const nachId = new Map(a.empfaenger.map(e => [e.id, e]));
  return {
    titel: 'Verzeichnis von Verarbeitungstätigkeiten (Art. 30 Abs. 1 DSGVO)',
    stand: tagVon(a.jetzt),
    hinweis: 'Aus MAKE OS erzeugt. Entwurf — keine Rechtsberatung, einmal anwaltlich gegenlesen.',
    verantwortlicher: verantwortlicherAuskunft(a.verantwortlicher),
    verarbeitungen: a.verarbeitungen.map(({ empfaengerIds, ...v }) => ({
      ...v, verantwortlich: verantwortlichAufloesen(v.verantwortlich, a.verantwortlicher),
      empfaengerRegister: (empfaengerIds ?? []).map(id => nachId.get(id)).filter((e): e is Empfaenger => !!e && !e.archiviert).map(e => ({ name: e.name, rolle: rolleText(e.rolle), drittland: e.drittland ? `${e.drittland} (${garantieText(e.garantie)})` : 'EU/EWR', avv: e.rolle === 'auftragsverarbeiter' ? avvText(e.avv) : '—' })),
    })),
    empfaenger: a.empfaenger.map(e => ({ name: e.name, rolle: rolleText(e.rolle), zweck: e.zweck, daten: e.daten, drittland: e.drittland || 'EU/EWR', garantie: e.drittland ? garantieText(e.garantie) : '—', avv: e.rolle === 'auftragsverarbeiter' ? avvText(e.avv) : e.avv.status === 'nicht-noetig' ? 'nicht nötig' : '—', inGebrauch: !e.archiviert })),
    loeschfristen: LOESCHFRISTEN.map(f => ({ titel: f.titel, frist: fristText(f.id, a.fristen[f.id]), norm: f.norm })),
    sicherungen: SICHERUNG_SATZ,
  };
}

const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const zeilen = (t: unknown) => esc(t).replace(/\n/g, '<br>');

/** Druckbares HTML (eigenständig, ohne Skripte, ohne fremde Quellen). */
export function verzeichnisHtml(d: VerzeichnisDokument): string {
  const v = d.verantwortlicher as { fehlt?: boolean; name?: string; anschrift?: string; kontakt?: string; telefon?: string; vertretung?: string; datenschutzbeauftragter?: { name?: string; kontakt?: string } };
  const vBlock = v.fehlt
    ? `<p class="fehlt">${esc(VERANTWORTLICHER_FEHLT)}</p>`
    : `<p><strong>${esc(v.name)}</strong><br>${zeilen(v.anschrift)}<br>${esc(v.kontakt)}${v.telefon ? ` · ${esc(v.telefon)}` : ''}${v.vertretung ? `<br>Vertreten durch: ${esc(v.vertretung)}` : ''}${v.datenschutzbeauftragter ? `<br>Datenschutzbeauftragter: ${esc([v.datenschutzbeauftragter.name, v.datenschutzbeauftragter.kontakt].filter(Boolean).join(', '))}` : ''}</p>`;
  const FELDER: [keyof VerzeichnisDokument['verarbeitungen'][number], string][] = [['zweck', 'Zweck'], ['personen', 'Betroffene'], ['daten', 'Datenkategorien'], ['rechtsgrundlage', 'Rechtsgrundlage'], ['empfaenger', 'Empfänger'], ['drittland', 'Drittland'], ['loeschfrist', 'Löschfrist'], ['toms', 'Schutzmaßnahmen (Art. 32)'], ['verantwortlich', 'Verantwortlich']];
  const vv = d.verarbeitungen.map((x, i) => `<section><h3>${i + 1}. ${esc(x.name)}</h3><table>${FELDER.map(([f, l]) => `<tr><th>${l}</th><td>${zeilen(x[f])}</td></tr>`).join('')}${x.empfaengerRegister.length ? `<tr><th>Empfänger laut Register</th><td>${x.empfaengerRegister.map(e => `${esc(e.name)} — ${esc(e.rolle)}, ${esc(e.drittland)}, AVV ${esc(e.avv)}`).join('<br>')}</td></tr>` : ''}<tr><th>Stand</th><td>${esc(x.stand)}</td></tr></table></section>`).join('');
  const emp = `<table class="liste"><tr><th>Empfänger</th><th>Rolle</th><th>Zweck / Daten</th><th>Drittland / Garantie</th><th>AVV</th></tr>${d.empfaenger.map(e => `<tr${e.inGebrauch ? '' : ' class="aus"'}><td>${esc(e.name)}${e.inGebrauch ? '' : ' (nicht in Gebrauch)'}</td><td>${esc(e.rolle)}</td><td>${esc(e.zweck)}<br><small>${esc(e.daten)}</small></td><td>${esc(e.drittland)}<br><small>${esc(e.garantie)}</small></td><td>${esc(e.avv)}</td></tr>`).join('')}</table>`;
  const lf = `<table class="liste"><tr><th>Datenart</th><th>Frist</th><th>Grundlage</th></tr>${d.loeschfristen.map(f => `<tr><td>${esc(f.titel)}</td><td>${esc(f.frist)}</td><td>${esc(f.norm)}</td></tr>`).join('')}</table><p>${esc(d.sicherungen)}</p>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(d.titel)}</title>
<style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;color:#111;background:#fff;max-width:960px;margin:24px auto;padding:0 16px}h1{font-size:22px}h2{font-size:18px;margin-top:32px;border-bottom:1px solid #ccc}h3{font-size:15px;margin:20px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top;text-align:left}th{width:190px;background:#f5f5f5;font-weight:600}table.liste th{width:auto}.fehlt{color:#b00;font-weight:600}.aus{color:#888}small{color:#555}.hinweis{color:#555}section{break-inside:avoid}@media print{body{margin:0}a{color:inherit}}</style></head>
<body><h1>${esc(d.titel)}</h1><p class="hinweis">Stand ${esc(d.stand)} · ${esc(d.hinweis)}</p>
<h2>Verantwortlicher</h2>${vBlock}
<h2>Verarbeitungstätigkeiten (${d.verarbeitungen.length})</h2>${vv}
<h2>Empfänger und Auftragsverarbeiter</h2>${emp}
<h2>Löschfristen</h2>${lf}
</body></html>`;
}
