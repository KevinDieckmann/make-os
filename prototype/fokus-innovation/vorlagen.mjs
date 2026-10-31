// ─── Kostenlos › Vorlagen bauen (30.10.) ─────────────────────────────────────────────────────────────────────────────────────
// Kevin 30.10.: „Die Leute müssen die Sachen sauber umsetzen können — da fehlt bei den PDFs manchmal noch was.“ Darum je Vorlage:
//   inhalt/vorlagen/<id>.html          → dateien/vorlagen/<id>.pdf   (Druck A4 über Chrome ohne Kopf/Fuß, Gestaltung in basis.css)
//   inhalt/vorlagen/<id>.tabelle.json  → dateien/vorlagen/<id>.xlsx  (Tabelle zum Ausfüllen am Rechner, mit Formeln; Excel, Numbers, Google Tabellen)
//   Vorschau (31.10.)                  → assets/bild/vorlagen/<id>-titel.jpg + <id>-seite.jpg (Titelseite und `vorschau_seite` aus inhalt/vorlagen.json,
//                                         gerendert mit PDFKit über werkzeug/pdfseiten.swift — nur am Mac).
// dateien/ ist NICHT öffentlich: bauen.mjs verteilt kurze Vorlagen nach assets/vorlagen, lange nach unterlagen/ (nur per E-Mail, Kevin 31.10.).
// Aufruf:  node prototype/fokus-innovation/vorlagen.mjs [id …]   (ohne id: alle). Danach `node bauen.mjs` — die Seite liest Größe und
// Seitenzahl aus den gebauten Dateien (inhalt/vorlagen.json nennt nur, was es gibt). Nie echte Namen, Firmen oder Zahlen in Beispielen.
//
// Format der Tabellen-Beschreibung (`<id>.tabelle.json`):
//   { "blaetter": [ { "name": "Pipeline", "spalten": [{ "titel": "Nr.", "breite": 6, "stil": "zahl" }, …],
//                     "zeilen": [ [ "Text", 12, { "f": "B{r}*C{r}", "stil": "euro" }, null ], … ],
//                     "wiederholen": { "zeile": [ … ], "anzahl": 50 },   // Zeile mit {r} (Zeilennummer) n-mal anhängen
//                     "auswahl": [ { "spalte": "I", "werte": ["Gespräch", "Angebot"] } ],   // Liste zum Wählen über alle Datenzeilen
//                     "fixieren": true } ] }
//   Zellen: Text, Zahl, null (leer) oder { "v": Wert | "f": Formel ohne „=“, "stil": … }. {r} = Zeile der Zelle.
//   Stile: titel · kopf · text · hinweis · zahl · prozent · euro · datum · eingabe (helle Fläche = hier eintragen) · fett

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crc32 } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = join(HIER, 'inhalt', 'vorlagen');
const ZIEL = join(HIER, 'dateien', 'vorlagen');
const BILDER = join(HIER, 'assets', 'bild', 'vorlagen');
const VORLAGEN = JSON.parse(readFileSync(join(HIER, 'inhalt', 'vorlagen.json'), 'utf8')).vorlagen;
const AB_SEITEN = JSON.parse(readFileSync(join(HIER, 'inhalt', 'fokus.json'), 'utf8')).kostenlos?.vorlagen?.per_mail_ab_seiten ?? Infinity;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── PDF ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function pdfBauen(id) {
  const html = join(QUELLE, `${id}.html`);
  if (!existsSync(html)) return null;
  const ziel = join(ZIEL, `${id}.pdf`);
  execFileSync('nice', ['-n', '10', CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', `--print-to-pdf=${ziel}`, `file://${html}`], { stdio: 'ignore' });
  const roh = readFileSync(ziel);
  const seiten = (roh.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  return { datei: `${id}.pdf`, seiten, kb: Math.round(roh.length / 1024) };
}

// ── XLSX (Office Open XML, ohne Paket: ZIP „gespeichert“ + CRC32 aus node:zlib) ───────────────────────────────────────────────────
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const spalteName = (n) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
// Reihenfolge = Index in styles.xml (cellXfs)
const STILE = ['standard', 'titel', 'kopf', 'text', 'hinweis', 'zahl', 'prozent', 'euro', 'datum', 'eingabe', 'fett', 'eingabe-zahl', 'eingabe-euro', 'eingabe-datum', 'eingabe-prozent'];
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0 &quot;€&quot;"/><numFmt numFmtId="165" formatCode="DD.MM.YYYY"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><i/><sz val="10"/><color rgb="FF62666B"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6F4F0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF111316"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${STILE.length}">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="bottom"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="165" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="9" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function zelle(wert, spalte, r, stilVorgabe) {
  const ref = `${spalteName(spalte)}${r}`;
  const o = wert !== null && typeof wert === 'object' ? wert : { v: wert };
  const stilName = o.stil ?? stilVorgabe ?? 'standard';
  const s = STILE.indexOf(stilName);
  if (s < 0) throw new Error(`Stil „${stilName}“ gibt es nicht (${ref})`);
  const sAttr = s ? ` s="${s}"` : '';
  if (o.f !== undefined) return `<c r="${ref}"${sAttr}><f>${xml(String(o.f).replace(/\{r\}/g, r).replace(/^=/, ''))}</f></c>`;
  const v = o.v;
  if (v === null || v === undefined || v === '') return s ? `<c r="${ref}"${sAttr}/>` : '';
  if (typeof v === 'number') return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xml(String(v).replace(/\{r\}/g, r))}</t></is></c>`;
}

function blattXml(b) {
  const spalten = b.spalten ?? [];
  const zeilen = [];
  let r = 0;
  if (spalten.some((s) => s.titel)) zeilen.push({ r: ++r, zellen: spalten.map((s) => ({ v: s.titel ?? '', stil: 'kopf' })), kopf: true });
  const datenAb = r + 1;
  for (const z of b.zeilen ?? []) zeilen.push({ r: ++r, zellen: z });
  if (b.wiederholen) for (let i = 0; i < b.wiederholen.anzahl; i++) zeilen.push({ r: ++r, zellen: b.wiederholen.zeile });
  const datenBis = Math.max(r, datenAb);
  const koepfe = spalten.some((s) => s.titel);
  const ansicht = b.fixieren && koepfe ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const cols = spalten.length ? `<cols>${spalten.map((s, i) => `<col min="${i + 1}" max="${i + 1}" width="${s.breite ?? 14}" customWidth="1"/>`).join('')}</cols>` : '';
  const rows = zeilen.map((z) => `<row r="${z.r}">${z.zellen.map((w, i) => zelle(w, i, z.r, z.kopf ? 'kopf' : spalten[i]?.stil)).join('')}</row>`).join('');
  const auswahl = (b.auswahl ?? []).map((a) => {
    const liste = `"${a.werte.map((w) => String(w).replace(/"/g, '')).join(',')}"`;
    if (liste.length > 257) throw new Error(`Auswahl in ${b.name} zu lang (Excel: höchstens 255 Zeichen)`);
    return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${a.spalte}${datenAb}:${a.spalte}${datenBis}"><formula1>${xml(liste)}</formula1></dataValidation>`;
  });
  const dv = auswahl.length ? `<dataValidations count="${auswahl.length}">${auswahl.join('')}</dataValidations>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${ansicht}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${dv}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function zip(dateien) {
  const teile = [], verzeichnis = [];
  let pos = 0;
  const zeit = 0x5f00, datum = 0x5d5e; // fest: 30.10.2026 11:48 — gleiche Eingabe = gleiche Datei
  for (const [name, inhalt] of dateien) {
    const daten = Buffer.from(inhalt, 'utf8'), n = Buffer.from(name, 'utf8'), crc = crc32(daten) >>> 0;
    const kopf = Buffer.alloc(30); kopf.writeUInt32LE(0x04034b50, 0); kopf.writeUInt16LE(20, 4); kopf.writeUInt16LE(0x0800, 6); kopf.writeUInt16LE(0, 8);
    kopf.writeUInt16LE(zeit, 10); kopf.writeUInt16LE(datum, 12); kopf.writeUInt32LE(crc, 14); kopf.writeUInt32LE(daten.length, 18); kopf.writeUInt32LE(daten.length, 22); kopf.writeUInt16LE(n.length, 26); kopf.writeUInt16LE(0, 28);
    teile.push(kopf, n, daten);
    const z = Buffer.alloc(46); z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt16LE(0x0800, 8); z.writeUInt16LE(0, 10);
    z.writeUInt16LE(zeit, 12); z.writeUInt16LE(datum, 14); z.writeUInt32LE(crc, 16); z.writeUInt32LE(daten.length, 20); z.writeUInt32LE(daten.length, 24); z.writeUInt16LE(n.length, 28); z.writeUInt32LE(pos, 42);
    verzeichnis.push(z, n);
    pos += 30 + n.length + daten.length;
  }
  const vz = Buffer.concat(verzeichnis);
  const ende = Buffer.alloc(22); ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(dateien.length, 8); ende.writeUInt16LE(dateien.length, 10); ende.writeUInt32LE(vz.length, 12); ende.writeUInt32LE(pos, 16);
  return Buffer.concat([...teile, vz, ende]);
}

function xlsxBauen(id) {
  const quelle = join(QUELLE, `${id}.tabelle.json`);
  if (!existsSync(quelle)) return null;
  const t = JSON.parse(readFileSync(quelle, 'utf8'));
  if (!Array.isArray(t.blaetter) || !t.blaetter.length) throw new Error(`${id}.tabelle.json: blaetter fehlt`);
  const namen = t.blaetter.map((b) => { if (!/^[^\\/?*[\]:]{1,31}$/.test(b.name)) throw new Error(`Blattname „${b.name}“ ungültig (≤ 31 Zeichen, ohne \\ / ? * [ ] :)`); return b.name; });
  const dateien = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${namen.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets>${namen.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${namen.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${namen.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...t.blaetter.map((b, i) => [`xl/worksheets/sheet${i + 1}.xml`, blattXml(b)]),
  ];
  const ziel = join(ZIEL, `${id}.xlsx`);
  const daten = zip(dateien);
  writeFileSync(ziel, daten);
  return { datei: `${id}.xlsx`, blaetter: namen.length, kb: Math.max(1, Math.round(daten.length / 1024)) };
}

const argumente = process.argv.slice(2);
// `--nur-vorschau`: nur die Vorschaubilder neu (PDFs und Tabellen bleiben byte-gleich).
const nurVorschau = argumente.includes('--nur-vorschau');
const namen = argumente.filter((a) => !a.startsWith('--'));
const ids = namen.length ? namen
  : [...new Set(readdirSync(QUELLE).filter((f) => /\.(html|tabelle\.json)$/.test(f)).map((f) => f.replace(/\.(tabelle\.json|html)$/, '')))];
// ── Vorschau: Titelseite und eine Beispielseite als Bild (PDFKit über Swift, einmal übersetzt) ───────────────────────────────────
let pdfWerkzeug = null;
function vorschauBauen(id) {
  const pdf = join(ZIEL, `${id}.pdf`);
  const v = VORLAGEN.find((x) => x.id === id);
  if (!existsSync(pdf) || !v) return null;
  // Nur lange Vorlagen haben eine Vorschau-Seite (die kurzen lädt man direkt).
  if ((readFileSync(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length < AB_SEITEN) return null;
  if (!pdfWerkzeug) {
    pdfWerkzeug = join(tmpdir(), 'fokus-pdfseiten');
    execFileSync('nice', ['-n', '10', 'swiftc', '-O', '-o', pdfWerkzeug, join(HIER, 'werkzeug', 'pdfseiten.swift')], { stdio: 'ignore' });
  }
  mkdirSync(BILDER, { recursive: true });
  const seite = v.vorschau_seite ?? 2;
  execFileSync(pdfWerkzeug, ['bild', pdf, '1', '640', join(BILDER, `${id}-titel.jpg`)]);
  execFileSync(pdfWerkzeug, ['bild', pdf, String(seite), '900', join(BILDER, `${id}-seite.jpg`)]);
  return seite;
}

for (const id of ids) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Kennung „${id}“: nur a–z, 0–9, -`);
  if (nurVorschau) { const s = vorschauBauen(id); console.log(`${id}: Vorschau ${s ? `Seite ${s}` : '—'}`); continue; }
  const p = pdfBauen(id), x = xlsxBauen(id);
  if (p) vorschauBauen(id);
  if (!p && !x) throw new Error(`Zu „${id}“ gibt es weder ${id}.html noch ${id}.tabelle.json`);
  console.log(`${id}: ${p ? `PDF ${p.seiten} S., ${p.kb} KB` : '—'} · ${x ? `XLSX ${x.blaetter} Blätter, ${x.kb} KB` : '—'}`);
}
