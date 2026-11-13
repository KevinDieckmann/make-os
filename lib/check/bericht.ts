// ─── Checks — der Bericht per E-Mail (31.10., rein, getestet) ─────────────────────────────────────────────────────────────────────
// Kevin 31.10.: der ganze Bericht geht per Mail an die Person, die ihre Adresse angegeben hat (bisher stand im Ergebnis „Ihren Bericht schicken wir
// Ihnen per E-Mail“, verschickt wurde aber nichts — jetzt stimmt das Versprechen). Fester Text aus dem gerechneten Ergebnis (lib/check/ergebnis.ts
// `ergebnisAnsicht`) und den Angaben der Instanz (Marke, Angebote, Buchungsseite, Verantwortlicher) — KEINE KI, nichts vom Teilnehmer außer dem
// geprüften Vornamen. Versand: lib/check/bericht-server.ts über den Website-Absender (lib/oeffentlich/website-post.ts).

import type { ErgebnisAnsicht } from './ergebnis';

export interface BerichtAngebot { titel: string; text?: string; link?: string }
export interface BerichtWerte {
  marke: string;
  /** Name des Checks (z. B. „Innovations-Check“). */
  check: string;
  vorname?: string;
  ansicht: Omit<ErgebnisAnsicht, 'schritte'> & { schritte: (Omit<ErgebnisAnsicht['schritte'][number], 'angebot'> & { angebot?: BerichtAngebot })[] };
  /** Satz zum Erstgespräch und — falls es eine Buchungsseite gibt — die volle Adresse über die Website. */
  gespraech: { satz: string; link: string | null };
  verantwortlich: string;
  datenschutzLink: string | null;
}

const ohneKlammer = (n: string) => n.replace(/ \(.*\)$/, '');

/** Der Bericht als gut gegliederter Text — Stufe + Gesamt, je Bereich Wert (+ Branche), Einordnung, nächste Schritte, Erstgespräch, Absender. */
export function berichtMail(w: BerichtWerte): { betreff: string; text: string } {
  const a = w.ansicht;
  const iv = a.innovation;
  const teile: string[] = [
    w.vorname ? `Guten Tag ${w.vorname},` : 'Guten Tag,',
    '',
    `danke, dass Sie den ${w.check} gemacht haben. Hier ist Ihr Bericht.`,
    '',
    'IHR ERGEBNIS',
    `Stufe ${a.stufe}: ${ohneKlammer(a.stufeName)} — ${a.gesamt} von 100 Punkten`,
    ...(a.stufeKurz ? [a.stufeKurz] : []),
    ...(a.genauigkeit === 'vorlaeufig' ? ['Das ist ein vorläufiges Ergebnis — mit den Fragen der ausführlichen Fassung wird es genauer.'] : []),
    `Die Stufen: ${a.stufen.map(x => `${x.stufe} ${ohneKlammer(x.name)}`).join(' · ')}`,
  ];
  if (a.gruppen?.length) {
    // Sichtbarkeits- und Vertriebs-Check (13.11.): je Überschrift ihr Wert, darunter ihre Bereiche.
    for (const g of a.gruppen) teile.push('', `${g.name.toUpperCase()}: ${g.wert ?? '—'} von 100`, ...a.saeulen.filter(x => g.saeulen.includes(x.key)).map(x => `· ${x.name}: ${x.wert ?? '—'} von 100`));
  } else if (a.saeulen.length > 1) {
    teile.push('', 'IHRE BEREICHE', ...a.saeulen.map(x => `· ${x.name}: ${x.wert ?? '—'} von 100`));
  }
  if (iv?.achsen.length) {
    teile.push('', a.saeulen.length > 1 ? `INNOVATION IM DETAIL (Stufe ${iv.stufe}: ${ohneKlammer(iv.stufeName)})` : 'IHRE BEREICHE IM VERGLEICH MIT IHRER BRANCHE',
      ...iv.achsen.map(x => `· ${x.name}: ${x.wert} von 100 (Ihre Branche: ${x.branche})`));
    if (iv.branchenSatz) teile.push('', iv.branchenSatz);
  }
  const einordnung = a.saeulen.length > 1 && iv ? [...a.zoe, ...iv.zoe] : a.zoe;
  if (einordnung.length) teile.push('', 'EINORDNUNG', ...einordnung);
  if (a.schritte.length) {
    teile.push('', 'IHRE NÄCHSTEN SCHRITTE');
    a.schritte.forEach((x, i) => {
      teile.push(`${i + 1}. ${x.name} (${x.wert} von 100)`, `   ${x.text}`);
      if (x.angebot) teile.push(`   Passendes Angebot: ${x.angebot.titel}${x.angebot.text ? ` — ${x.angebot.text}` : ''}`, ...(x.angebot.link ? [`   ${x.angebot.link}`] : []));
    });
  }
  teile.push('', 'KOSTENLOSES ERSTGESPRÄCH', w.gespraech.satz, ...(w.gespraech.link ? [`Termin wählen: ${w.gespraech.link}`] : ['Antworten Sie einfach auf diese Mail, dann finden wir einen Termin.']));
  teile.push(
    '', 'Viele Grüße', w.marke, '', '—',
    `Absender: ${w.marke} · Verantwortlich: ${w.verantwortlich}`,
    `Datenschutz: Wir nutzen Ihre Angaben für Ihren Bericht und Ihr Gespräch und haben Ihre Anfrage in unserem Kundensystem angelegt (Art. 6 Abs. 1 lit. b DSGVO).${w.datenschutzLink ? ` Mehr: ${w.datenschutzLink}` : ''}`,
    'Sie bekommen diese Mail, weil Sie den Bericht auf unserer Website angefordert haben. Waren Sie das nicht, ignorieren Sie sie und schreiben Sie uns kurz — wir löschen Ihre Angaben.',
  );
  return { betreff: `Ihr Bericht: ${w.check} — ${w.marke}`, text: teile.join('\n') };
}
