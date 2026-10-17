// ─── Fulfillment · Kunde — dieselben Bilder als PDF (nur Server; 12.10., Fulfillment extern, „ein Bild“) ──────────────────────────────────────────
// Der 2-Wochen-Report (lib/crm/treppe-pdf.ts, mit Fall) und der Wirkungsbericht (lib/fulfillment/prozesse/wirkung-pdf.ts) zeichnen mit DIESEM Gerüst:
// ruhiger Kopf (Anbieter, Titel, Kunde, Stand), Lage-Kasten mit Ampel und drei Sätzen, die Reise als EINE Zeile mit „hier stehen wir“ (seit 17.10. —
// dieselbe Zeichnung wie die Kunden-Seite), Wert-Balken (vorher → jetzt → Ziel), Spalten, erste Erfolge, Hinweis-Kästen, Fuß mit „Seite n von m“. Gerechnet
// wird nichts hier — die Modelle kommen aus lib/fulfillment/kunde/bild.ts (`kundenReise`, `wertModell`), dieselben wie auf der Kunden-Seite. pdf-lib mit Helvetica/WinAnsi
// (`sicherFuer`/`umbrechen` aus dem Angebot); `erstellt` fest übergeben → gleiche Eingabe, gleiche Bytes. Keine Bilder von außen, keine Marken im Code.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { sicherFuer, umbrechen } from '@/lib/crm/angebot-pdf';
import { wertModell, type KundenAmpel, type KundenLage, type KundenQuickWin, type KundenReiseSpalte, type KundenWert } from './bild';

export const A4: [number, number] = [595.28, 841.89];
export const RAND = 50;
export const BREIT = A4[0] - 2 * RAND;
const OBEN = A4[1] - 52;
const UNTEN = 68;

/** Farben der Kunden-Dokumente — ruhig, druckfest; der Akzent ist der Petrol-Ton des Design-Standards in Druckstärke. */
export const PDF_FARBE = {
  tinte: rgb(0.1, 0.1, 0.12), leise: rgb(0.42, 0.43, 0.46), linie: rgb(0.86, 0.87, 0.89), flaeche: rgb(0.962, 0.968, 0.972), schiene: rgb(0.9, 0.91, 0.92),
  akzent: rgb(0.13, 0.66, 0.62), akzentTief: rgb(0.05, 0.44, 0.41), akzentHell: rgb(0.78, 0.92, 0.9),
  gut: rgb(0.16, 0.6, 0.37), achtung: rgb(0.86, 0.58, 0.08), kritisch: rgb(0.8, 0.25, 0.25),
} as const;
export const AMPEL_PDF: Record<KundenAmpel, RGB> = { gruen: PDF_FARBE.gut, gelb: PDF_FARBE.achtung, rot: PDF_FARBE.kritisch };

type TextOpt = { fett?: boolean; farbe?: RGB; x?: number; breite?: number; zeile?: number };

/** Das Blatt: Seiten, Schriften, Cursor (`y` = Oberkante des nächsten Inhalts) und die Zeichen-Bausteine. */
export class PdfBlatt {
  seiten: PDFPage[] = [];
  seite!: PDFPage;
  y = 0;
  private constructor(readonly doc: PDFDocument, readonly f: PDFFont, readonly fb: PDFFont, readonly s: (t: string) => string) {}

  static async neu(meta: { titel: string; betreff?: string; autor?: string; erstellt: Date }): Promise<PdfBlatt> {
    const doc = await PDFDocument.create();
    doc.setTitle(meta.titel);
    if (meta.betreff) doc.setSubject(meta.betreff);
    if (meta.autor) doc.setAuthor(meta.autor);
    doc.setCreator('Projektbericht');
    doc.setProducer('pdf-lib');
    doc.setCreationDate(meta.erstellt);
    doc.setModificationDate(meta.erstellt);
    doc.setLanguage('de-DE');
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const fb = await doc.embedFont(StandardFonts.HelveticaBold);
    const b = new PdfBlatt(doc, f, fb, sicherFuer(f));
    b.neueSeite();
    return b;
  }

  neueSeite() { this.seite = this.doc.addPage(A4); this.seiten.push(this.seite); this.y = OBEN; }
  /** Platz für `h` Punkte — sonst neue Seite. */
  platz(h: number) { if (this.y - h < UNTEN) this.neueSeite(); }
  breite(t: string, groesse: number, fett = false) { return (fett ? this.fb : this.f).widthOfTextAtSize(this.s(t), groesse); }
  text(t: string, x: number, yy: number, groesse: number, o: { fett?: boolean; farbe?: RGB } = {}) {
    this.seite.drawText(this.s(t), { x, y: yy, size: groesse, font: o.fett ? this.fb : this.f, color: o.farbe ?? PDF_FARBE.tinte });
  }
  zeilen(t: string, groesse: number, breite: number, fett = false) { return umbrechen(this.s(t), fett ? this.fb : this.f, groesse, breite); }
  /** Ein Absatz ab dem Cursor (umbrochen, Seitenwechsel je Zeile). */
  absatz(t: string, groesse: number, o: TextOpt = {}) {
    const zh = o.zeile ?? groesse * 1.42;
    for (const z of this.zeilen(t, groesse, o.breite ?? BREIT, o.fett)) { this.platz(zh); this.y -= zh; if (z) this.text(z, o.x ?? RAND, this.y + (zh - groesse) * 0.35, groesse, o); }
  }
  abstand(h: number) { this.y -= h; }
  /** Ein Rechteck mit runden Ecken (Oberkante `yOben`). */
  kasten(x: number, yOben: number, w: number, h: number, o: { farbe?: RGB; rand?: RGB; r?: number } = {}) {
    const r = Math.min(o.r ?? 8, h / 2, w / 2);
    const pfad = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    this.seite.drawSvgPath(pfad, { x, y: yOben, ...(o.farbe ? { color: o.farbe } : {}), ...(o.rand ? { borderColor: o.rand, borderWidth: 0.6 } : {}) });
  }
  /** Eine Raute (Abstimmungspunkt) um den Mittelpunkt. */
  raute(cx: number, cy: number, g: number, gefuellt: boolean, farbe: RGB) {
    this.seite.drawSvgPath(`M 0 ${-g} L ${g} 0 L 0 ${g} L ${-g} 0 Z`, { x: cx, y: cy, color: gefuellt ? farbe : rgb(1, 1, 1), borderColor: farbe, borderWidth: 1 });
  }
  punkt(cx: number, cy: number, r: number, gefuellt: boolean, farbe: RGB) {
    this.seite.drawCircle({ x: cx, y: cy, size: r, color: gefuellt ? farbe : rgb(1, 1, 1), borderColor: farbe, borderWidth: gefuellt ? 0 : 1 });
  }

  // ── Bausteine ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Kopf: Akzentlinie, Anbieter links, Stand rechts, großer Titel, Kunde, eine leise Zeile darunter. */
  kopf(k: { anbieter?: string; titel: string; kunde: string; zeile?: string; stand: string }) {
    this.seite.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: PDF_FARBE.akzent });
    const yo = this.y;
    if (k.anbieter) this.text(k.anbieter.toUpperCase(), RAND, yo, 8.5, { fett: true, farbe: PDF_FARBE.akzentTief });
    const st = `Stand ${k.stand}`;
    this.text(st, RAND + BREIT - this.breite(st, 8.5), yo, 8.5, { farbe: PDF_FARBE.leise });
    this.y = yo - 34;
    this.text(k.titel, RAND, this.y, 24, { fett: true });
    this.y -= 8;
    this.absatz(k.kunde, 13.5, { fett: true });
    if (k.zeile) this.absatz(k.zeile, 10, { farbe: PDF_FARBE.leise });
    this.abstand(10);
  }

  /** Abschnittsüberschrift in Großbuchstaben mit feiner Linie. */
  abschnitt(titel: string, rechts?: string) {
    this.platz(42);
    this.y -= 20;
    this.text(titel.toUpperCase(), RAND, this.y, 8.5, { fett: true, farbe: PDF_FARBE.akzentTief });
    if (rechts) this.text(rechts, RAND + BREIT - this.breite(rechts, 8.5), this.y, 8.5, { farbe: PDF_FARBE.leise });
    this.y -= 6;
    this.seite.drawLine({ start: { x: RAND, y: this.y }, end: { x: RAND + BREIT, y: this.y }, thickness: 0.5, color: PDF_FARBE.linie });
    this.y -= 4;
  }

  /** Aufzählung mit Akzent-Punkt. */
  punkte(l: readonly string[], o: { x?: number; breite?: number; groesse?: number } = {}) {
    const x = o.x ?? RAND, b = o.breite ?? BREIT, g = o.groesse ?? 10.5;
    for (const p of l) {
      const z = this.zeilen(p, g, b - 14);
      this.platz(g * 1.45 * Math.min(2, z.length));
      z.forEach((zeile, i) => { this.y -= g * 1.45; if (i === 0) this.punkt(x + 4, this.y + g * 0.32, 1.9, true, PDF_FARBE.akzent); if (zeile) this.text(zeile, x + 14, this.y, g); });
    }
  }

  /** Die Lage: getönter Kasten mit Ampel-Punkt, Titel und drei Sätzen. */
  lage(l: KundenLage, extra?: string) {
    const innen = BREIT - 44;
    const saetze = l.saetze.flatMap(x => this.zeilen(x, 10.5, innen));
    const ex = extra ? this.zeilen(extra, 9, innen) : [];
    const h = 44 + saetze.length * 15 + (ex.length ? 6 + ex.length * 12 : 0) + 14;
    this.platz(h + 8);
    const yo = this.y;
    const farbe = AMPEL_PDF[l.ampel];
    this.kasten(RAND, yo, BREIT, h, { farbe: PDF_FARBE.flaeche, rand: PDF_FARBE.linie, r: 10 });
    this.punkt(RAND + 22, yo - 22 - 4.5, 5.5, true, farbe);
    this.text(l.titel, RAND + 34, yo - 22 - 9, 13, { fett: true });
    let y = yo - 22 - 16 - 6;
    for (const z of saetze) { y -= 15; this.text(z, RAND + 34, y, 10.5); }
    if (ex.length) { y -= 6; for (const z of ex) { y -= 12; this.text(z, RAND + 34, y, 9, { farbe: PDF_FARBE.leise }); } }
    this.y = yo - h - 4;
  }

  /**
   * Die Reise als EINE Zeile (17.10., Miro-Standard — dieselbe Zeichnung wie Kunden-Seite und Fall, Modell `kundenReise`): je Phase eine Beschriftung
   * (erledigt getönt, laufend mit Akzent-Rahmen und „hier stehen wir“ darüber, kommend leer), Abstimmungspunkte als Raute zwischen den Phasen, unter der
   * laufenden Phase „als Nächstes“ als kurze Kästchen (Rest „+n“), unten das Band mit dem, was beim Kunden liegt.
   */
  reise(spalten: readonly KundenReiseSpalte[], o: { hier?: string; naechstes?: string; band?: string } = {}) {
    if (!spalten.length) return;
    const n = spalten.length;
    const luecke = 12;
    const w = (BREIT - luecke * (n - 1)) / n;
    const titel = spalten.map(s => this.zeilen(s.titel, 8.5, Math.max(24, w - 10), s.zustand === 'jetzt').slice(0, 2));
    const pille = 10 + Math.max(1, ...titel.map(t => t.length)) * 10.5;
    const jetzt = spalten.find(s => s.zustand === 'jetzt');
    const kaestchen = (jetzt?.kaestchen ?? []).map(k => this.zeilen(k.titel, 8.5, Math.max(24, w - 12)).slice(0, 2));
    const kasten = kaestchen.reduce((a, z) => a + 8 + z.length * 10.5 + 4, 0) + (jetzt?.mehr ? 14 : 0) + (kaestchen.length ? 14 : 0);
    const h = 14 + pille + 8 + kasten + 22;
    this.platz(h + 8);
    const yo = this.y - 14;
    const yp = yo - 4;
    spalten.forEach((s, i) => {
      const x = RAND + i * (w + luecke);
      if (s.zustand === 'jetzt') this.text((o.hier ?? 'Hier stehen wir').toUpperCase(), x, yo + 2, 7.5, { fett: true, farbe: PDF_FARBE.akzentTief });
      this.kasten(x, yp, w, pille, s.zustand === 'fertig' ? { farbe: PDF_FARBE.akzentHell, r: 6 } : s.zustand === 'jetzt' ? { farbe: PDF_FARBE.flaeche, rand: PDF_FARBE.akzent, r: 6 } : { rand: PDF_FARBE.linie, r: 6 });
      titel[i].forEach((z, j) => this.text(z, x + 5, yp - 12 - j * 10.5, 8.5, { fett: s.zustand === 'jetzt', farbe: s.zustand === 'offen' ? PDF_FARBE.leise : PDF_FARBE.tinte }));
      if (s.raute) this.raute(x + w + luecke / 2, yp - pille / 2, 4.2, s.raute.gegeben, s.raute.gegeben ? PDF_FARBE.gut : PDF_FARBE.leise);
      if (s === jetzt && kaestchen.length) {
        let y = yp - pille - 8;
        this.text((o.naechstes ?? 'Als Nächstes').toUpperCase(), x, y - 7, 7, { fett: true, farbe: PDF_FARBE.leise });
        y -= 12;
        kaestchen.forEach((z, j) => {
          const kh = 6 + z.length * 10.5;
          this.kasten(x, y, w, kh, { farbe: j === 0 ? PDF_FARBE.akzentHell : PDF_FARBE.flaeche, ...(j === 0 ? { rand: PDF_FARBE.akzent } : {}), r: 4 });
          z.forEach((zeile, q) => this.text(zeile, x + 5, y - 10.5 - q * 10.5, 8.5, { fett: j === 0 }));
          y -= kh + 4;
        });
        if (s.mehr) this.text(`+ ${s.mehr} weitere`, x + 5, y - 9, 8, { farbe: PDF_FARBE.leise });
      }
    });
    // Das Band unten: durchgehend, an der laufenden Phase, was beim Kunden liegt.
    const yb = yo - 4 - pille - 8 - kasten - 4;
    this.kasten(RAND, yb, BREIT, 14, { farbe: PDF_FARBE.flaeche, rand: PDF_FARBE.linie, r: 7 });
    if (o.band) this.text(o.band.toUpperCase().slice(0, 40), RAND + 6, yb - 10, 7, { fett: true, farbe: PDF_FARBE.leise });
    spalten.forEach((s, i) => { if (s.band?.text) this.text(s.band.text, RAND + i * (w + luecke) + 5 + (i === 0 && o.band ? Math.min(w / 2, this.breite(o.band.toUpperCase().slice(0, 40), 7, true) + 8) : 0), yb - 10, 8, { fett: true, farbe: PDF_FARBE.achtung }); });
    this.y = yb - 14 - 6;
  }

  /** Ein Wert-Balken: Name und „vorher → jetzt → Ziel“, darunter die Schiene (vorher links, Ziel rechts), gefüllt bis „jetzt“. */
  wertBalken(w: KundenWert, o: { gross?: boolean } = {}) {
    const m = wertModell(w);
    const g = o.gross ? 12 : 10.5;
    const zahl = m.anteil != null ? `${Math.round(m.anteil * 100)} %` : '';
    this.platz(o.gross ? 64 : 50);
    this.y -= g * 1.4;
    const name = this.zeilen(w.name, g, BREIT - 80, true)[0] ?? '';
    this.text(name, RAND, this.y, g, { fett: true });
    if (zahl) this.text(zahl, RAND + BREIT - this.breite(zahl, g, true), this.y, g, { fett: true, farbe: m.erreicht ? PDF_FARBE.gut : PDF_FARBE.akzentTief });
    if (m.anteil != null) {
      const hb = o.gross ? 10 : 7;
      const yo = this.y - 8;
      this.kasten(RAND, yo, BREIT, hb, { farbe: PDF_FARBE.schiene, r: hb / 2 });
      this.kasten(RAND, yo, Math.max(hb, BREIT * m.anteil), hb, { farbe: m.erreicht ? PDF_FARBE.gut : PDF_FARBE.akzent, r: hb / 2 });
      this.punkt(RAND + Math.max(hb / 2, BREIT * m.anteil - hb / 2), yo - hb / 2, hb / 2 + 1.5, true, m.erreicht ? PDF_FARBE.gut : PDF_FARBE.akzentTief);
      this.y = yo - hb - 11;
      const links = `vorher ${w.vorher}`, rechts = `Ziel ${w.ziel}${w.bis ? ` · bis ${w.bis}` : ''}`, mitte = `jetzt ${w.jetzt}`;
      this.text(links, RAND, this.y, 8.5, { farbe: PDF_FARBE.leise });
      this.text(rechts, RAND + BREIT - this.breite(rechts, 8.5), this.y, 8.5, { farbe: PDF_FARBE.leise });
      const xm = Math.min(RAND + BREIT - this.breite(rechts, 8.5) - this.breite(mitte, 8.5, true) - 12, Math.max(RAND + this.breite(links, 8.5) + 12, RAND + BREIT * m.anteil - this.breite(mitte, 8.5, true) / 2));
      this.text(mitte, xm, this.y, 8.5, { fett: true, farbe: PDF_FARBE.akzentTief });
      this.y -= 6;
    } else {
      this.y -= 13;
      this.text(m.zeile, RAND, this.y, 9.5, { farbe: PDF_FARBE.leise });
      this.y -= 6;
    }
  }

  /** Bis zu drei Spalten nebeneinander (Titel + Punkte, höchstens `max` je Spalte, Rest „+ n weitere“). */
  spalten(sp: readonly { titel: string; punkte: readonly string[]; leer: string; farbe?: RGB }[], max = 4) {
    const luecke = 16;
    const w = (BREIT - luecke * (sp.length - 1)) / sp.length;
    const inhalt = sp.map(s => {
      const l = s.punkte.length ? s.punkte.slice(0, max) : [s.leer];
      const zeilen = l.map(p => this.zeilen(p, 9.5, w - 12).slice(0, 3));
      const mehr = s.punkte.length > max ? `+ ${s.punkte.length - max} weitere — siehe Details` : '';
      return { s, zeilen, mehr, leer: !s.punkte.length };
    });
    const hoehe = Math.max(...inhalt.map(c => 16 + c.zeilen.reduce((a, z) => a + z.length * 12.5 + 4, 0) + (c.mehr ? 14 : 0)));
    this.platz(hoehe + 22);
    this.y -= 18;
    const yo = this.y;
    inhalt.forEach((c, i) => {
      const x = RAND + i * (w + luecke);
      this.text(c.s.titel.toUpperCase(), x, yo, 8.5, { fett: true, farbe: c.s.farbe ?? PDF_FARBE.akzentTief });
      this.seite.drawLine({ start: { x, y: yo - 5 }, end: { x: x + w, y: yo - 5 }, thickness: 0.5, color: PDF_FARBE.linie });
      let y = yo - 8;
      for (const z of c.zeilen) {
        z.forEach((zeile, j) => { y -= 12.5; if (j === 0 && !c.leer) this.punkt(x + 3, y + 3.2, 1.7, true, c.s.farbe ?? PDF_FARBE.akzent); this.text(zeile, x + (c.leer ? 0 : 10), y, 9.5, { farbe: c.leer ? PDF_FARBE.leise : PDF_FARBE.tinte }); });
        y -= 4;
      }
      if (c.mehr) { y -= 12; this.text(c.mehr, x, y, 8.5, { farbe: PDF_FARBE.leise }); }
    });
    this.y = yo - hoehe;
  }

  /** Erste Erfolge: gefüllter Punkt = erreicht (mit Datum), Ring = geplant (bis …). */
  erfolge(l: readonly KundenQuickWin[], max = 4, o: { ja?: string; nein?: string } = {}) {
    for (const q of l.slice(0, max)) {
      const rechts = q.erledigt ? (o.ja ?? `erreicht ${q.am ?? ''}`.trim()) : (o.nein ?? (q.bis ? `geplant bis ${q.bis}` : 'geplant'));
      const z = this.zeilen(q.text, 10, BREIT - 30 - this.breite(rechts, 8.5, q.erledigt) - 12);
      this.platz(z.length * 13.5 + 4);
      z.forEach((zeile, j) => {
        this.y -= 13.5;
        if (j === 0) {
          this.punkt(RAND + 5, this.y + 3.4, 3.6, q.erledigt, q.erledigt ? PDF_FARBE.gut : PDF_FARBE.leise);
          this.text(rechts, RAND + BREIT - this.breite(rechts, 8.5, q.erledigt), this.y, 8.5, { farbe: q.erledigt ? PDF_FARBE.gut : PDF_FARBE.leise, fett: q.erledigt });
        }
        this.text(zeile, RAND + 18, this.y, 10, { farbe: q.erledigt ? PDF_FARBE.tinte : PDF_FARBE.leise });
      });
      this.y -= 3;
    }
    if (l.length > max) this.absatz(`+ ${l.length - max} weitere`, 8.5, { farbe: PDF_FARBE.leise, x: RAND + 18 });
  }

  /** Ein Hinweis-Kasten (leise Fläche, optional mit Titel). */
  hinweis(text: string, o: { titel?: string; farbe?: RGB } = {}) {
    const innen = BREIT - 32;
    const z = this.zeilen(text, 9.5, innen);
    const h = 14 + (o.titel ? 16 : 0) + z.length * 13 + 10;
    this.platz(h + 10);
    this.y -= 8;
    const yo = this.y;
    this.kasten(RAND, yo, BREIT, h, { farbe: PDF_FARBE.flaeche, r: 8 });
    let y = yo - 14;
    if (o.titel) { y -= 4; this.text(o.titel, RAND + 16, y, 10.5, { fett: true, farbe: o.farbe ?? PDF_FARBE.tinte }); y -= 4; }
    for (const zeile of z) { y -= 13; this.text(zeile, RAND + 16, y, 9.5, { farbe: PDF_FARBE.leise }); }
    this.y = yo - h;
  }

  /** Ein Zitat (nur mit vermerkter Einwilligung — der Aufrufer prüft). */
  zitat(text: string) {
    const z = this.zeilen(`„${text}“`, 12, BREIT - 40);
    const h = 18 + z.length * 17 + 10;
    this.platz(h + 10);
    this.y -= 8;
    const yo = this.y;
    this.seite.drawRectangle({ x: RAND, y: yo - h, width: 3, height: h, color: PDF_FARBE.akzent });
    let y = yo - 10;
    for (const zeile of z) { y -= 17; this.text(zeile, RAND + 18, y, 12, { farbe: PDF_FARBE.tinte }); }
    this.y = yo - h;
  }

  /** Fuß auf jeder Seite (Titel · Kunde · Stand, „Seite n von m“) und die Bytes. */
  async fertig(fuss: string): Promise<Uint8Array> {
    const s = this.s(fuss);
    const text = s.length > 96 ? `${s.slice(0, 95)}...` : s;
    this.seiten.forEach((p, i) => {
      p.drawLine({ start: { x: RAND, y: 46 }, end: { x: RAND + BREIT, y: 46 }, thickness: 0.4, color: PDF_FARBE.linie });
      p.drawText(text, { x: RAND, y: 32, size: 8, font: this.f, color: PDF_FARBE.leise });
      const nr = this.s(`Seite ${i + 1} von ${this.seiten.length}`);
      p.drawText(nr, { x: RAND + BREIT - this.f.widthOfTextAtSize(nr, 8), y: 32, size: 8, font: this.f, color: PDF_FARBE.leise });
    });
    return this.doc.save({ useObjectStreams: false });
  }
}
