// ─── E-Rechnung — ZUGFeRD/Factur-X: XML in die PDF legen und aus einer PDF holen (Server, 31.10.) ─
// Ausgang: die CII-XML (lib/finanzen/erechnung/cii.ts) liegt als eingebettete Datei „factur-x.xml“ in der Rechnungs-PDF —
// Beziehung `AFRelationship /Alternative`, im Katalog unter /AF und /Names/EmbeddedFiles (pdf-lib `attach`), Typ text/xml, dazu
// XMP-Metadaten mit dem Factur-X-Schema (fx:DocumentType, DocumentFileName, Version, ConformanceLevel) samt PDF/A-Erweiterungsschema.
// Bewusst NICHT behauptet: PDF/A-3-Konformität (pdfaid). Dafür fehlen eingebettete Schriften (pdf-lib braucht für eigene Schriften
// @pdf-lib/fontkit — eine neue Abhängigkeit) und ein OutputIntent mit ICC-Profil. Die XML ist vollständig; die Hülle ist „ZUGFeRD-artig“,
// nicht PDF/A-validiert (Bericht 31.10., CLAUDE.md › E-Rechnung).
// Eingang: `eingebetteteXml` sucht in einer fremden PDF nach factur-x.xml / zugferd-invoice.xml / xrechnung.xml (bzw. irgendeiner .xml)
// und entpackt sie mit Größengrenze (zlib maxOutputLength) — nie mehr als XML_MAX_BYTES, kein JavaScript, keine Aktionen.

import { inflateSync } from 'node:zlib';
import { AFRelationship, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString, PDFRef } from 'pdf-lib';
import { FACTURX_DATEI } from './cii';
import { xmlText, XML_MAX_BYTES } from './xml';


const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** XMP-Paket mit Factur-X-Schema (ohne PDF/A-Behauptung). */
export function xmpPaket(o: { titel: string; autor: string; erstellt: Date; konformitaet?: string }): string {
  const k = o.konformitaet ?? 'EN 16931';
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(o.titel)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${xmlText(o.autor)}</rdf:li></rdf:Seq></dc:creator>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>MAKE OS · pdf-lib</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>MAKE OS</xmp:CreatorTool><xmp:CreateDate>${iso(o.erstellt)}</xmp:CreateDate><xmp:ModifyDate>${iso(o.erstellt)}</xmp:ModifyDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>${FACTURX_DATEI}</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>${xmlText(k)}</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description></rdf:li>
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Die CII-XML als „factur-x.xml“ (AFRelationship Alternative) in ein pdf-lib-Dokument legen und die XMP-Metadaten setzen.
 * Vor `doc.save()` aufrufen (lib/crm/angebot-pdf.ts `vorSpeichern`). Feste Zeiten → gleiche Eingabe, gleiche Bytes (Prüfsumme).
 */
export async function facturXEinbetten(doc: PDFDocument, xml: string, o: { erstellt: Date; titel: string; autor: string }): Promise<void> {
  await doc.attach(new TextEncoder().encode(xml), FACTURX_DATEI, {
    mimeType: 'text/xml', description: 'Factur-X/ZUGFeRD-Rechnung (EN 16931)', creationDate: o.erstellt, modificationDate: o.erstellt,
    afRelationship: AFRelationship.Alternative,
  });
  const xmp = new TextEncoder().encode(xmpPaket(o));
  const strom = doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML', Length: xmp.length });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(strom));
}

const XML_NAME = /^(factur-x|zugferd-invoice|zugferd_invoice|xrechnung)\.xml$/i;

function nameVon(spec: PDFDict): string {
  for (const k of ['UF', 'F']) {
    const v = spec.lookup(PDFName.of(k));
    if (v instanceof PDFString || v instanceof PDFHexString) return v.decodeText();
  }
  return '';
}

/** Inhalt eines Datei-Stroms entpacken — nur FlateDecode oder ungepackt, mit Größengrenze. */
function stromInhalt(s: PDFRawStream): Uint8Array | null {
  const filter = s.dict.lookup(PDFName.of('Filter'));
  const roh = s.contents;
  const name = filter instanceof PDFName ? filter.asString() : filter instanceof PDFArray && filter.size() === 1 ? String(filter.lookup(0)) : filter === undefined ? '' : '?';
  if (name === '') return roh.length <= XML_MAX_BYTES ? roh : null;
  if (name === '/FlateDecode') {
    try { return inflateSync(roh, { maxOutputLength: XML_MAX_BYTES }); } catch { return null; }
  }
  return null;
}

function dateienSammeln(doc: PDFDocument): { name: string; spec: PDFDict }[] {
  const raus: { name: string; spec: PDFDict }[] = [];
  const gesehen = new Set<PDFDict>();
  const nimm = (o: unknown) => {
    const spec = o instanceof PDFRef ? doc.context.lookup(o) : o;
    if (spec instanceof PDFDict && !gesehen.has(spec)) { gesehen.add(spec); raus.push({ name: nameVon(spec), spec }); }
  };
  // /AF am Katalog (Factur-X) …
  const af = doc.catalog.lookup(PDFName.of('AF'));
  if (af instanceof PDFArray) for (let i = 0; i < Math.min(af.size(), 50); i++) nimm(af.get(i));
  // … und der Namensbaum /Names/EmbeddedFiles (flach + eine Ebene Kinder).
  const names = doc.catalog.lookup(PDFName.of('Names'));
  const ef = names instanceof PDFDict ? names.lookup(PDFName.of('EmbeddedFiles')) : undefined;
  const blatt = (n: unknown) => {
    const arr = n instanceof PDFDict ? n.lookup(PDFName.of('Names')) : undefined;
    if (arr instanceof PDFArray) for (let i = 1; i < Math.min(arr.size(), 100); i += 2) nimm(arr.get(i));
  };
  if (ef instanceof PDFDict) {
    blatt(ef);
    const kids = ef.lookup(PDFName.of('Kids'));
    if (kids instanceof PDFArray) for (let i = 0; i < Math.min(kids.size(), 20); i++) blatt(kids.lookup(i));
  }
  return raus;
}

/** Die eingebettete Rechnungs-XML einer PDF (ZUGFeRD/Factur-X/XRechnung) — sonst null. Wirft nie (fremde PDF). */
export async function eingebetteteXml(bytes: Uint8Array): Promise<{ name: string; xml: string } | null> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false }); } catch { return null; }
  let dateien: { name: string; spec: PDFDict }[];
  try { dateien = dateienSammeln(doc); } catch { return null; }
  const reihe = [...dateien.filter(d => XML_NAME.test(d.name)), ...dateien.filter(d => !XML_NAME.test(d.name) && /\.xml$/i.test(d.name))];
  for (const d of reihe) {
    try {
      const efd = d.spec.lookup(PDFName.of('EF'));
      const ref = efd instanceof PDFDict ? efd.get(PDFName.of('F')) ?? efd.get(PDFName.of('UF')) : undefined;
      const s = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      if (!(s instanceof PDFRawStream)) continue;
      const inhalt = stromInhalt(s);
      if (!inhalt) continue;
      return { name: d.name.slice(0, 80), xml: new TextDecoder('utf-8').decode(inhalt) };
    } catch { /* nächste Datei */ }
  }
  return null;
}
