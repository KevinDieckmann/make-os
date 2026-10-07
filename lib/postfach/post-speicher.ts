// ─── Postfächer — ein Postfach im Arbeitsspeicher (Server, 06.10.2026) ────────────────────────────────────────────
// Ein kleiner IMAP/SMTP-Nachbau ohne Netz: Ordner mit UIDVALIDITY/UIDNEXT, Nachrichten als Rohbytes mit Flags, SEARCH SINCE /
// Message-ID, FETCH (Quelle gekürzt + BODYSTRUCTURE), STORE, MOVE, APPEND, IDLE-Anstoß. Er dient
//   · den Tests (tests/postfach-*.test.ts) als Gegenstelle mit denselben Randfällen wie ein echter Server und
//   · der Demo-Instanz (lib/postfach/demo-post.ts) als erfundenes Postfach — nie mit echter Post, nie im Betrieb.
// Fehlerfälle zum Vorführen/Prüfen: Passwort „falsch“ → Anmeldung abgelehnt; `idle: false` → kein IDLE.

import { kopfzeilen, parameter, type StrukturKnoten } from './rfc822';
import { PostfachFehler, FEHLER_TEXT, type Abruf, type ImapSitzung, type ImapZugang, type OrdnerInfo } from './transport';

interface Gespeichert { uid: number; flags: Set<string>; internalDate: string; roh: Buffer; messageId?: string }
interface OrdnerDaten { pfad: string; specialUse?: string; uidValidity: string; uidNext: number; nachrichten: Gespeichert[] }

const midAus = (roh: Buffer): string | undefined => {
  const kopfEnde = roh.indexOf('\r\n\r\n') >= 0 ? roh.indexOf('\r\n\r\n') : roh.indexOf('\n\n');
  const k = kopfzeilen(kopfEnde >= 0 ? roh.subarray(0, kopfEnde) : roh);
  return (/<[^<>\s]+>/.exec(k.find(h => h.name.toLowerCase() === 'message-id')?.value ?? '') ?? [])[0];
};

/** BODYSTRUCTURE nachbauen (vereinfacht: Typ, Name, Disposition, Größe, Teil-Kennung nach IMAP-Zählung). */
function struktur(roh: Buffer, part = '', tiefe = 0): StrukturKnoten {
  const crlf = roh.indexOf('\r\n\r\n'), lf = roh.indexOf('\n\n');
  const [kEnde, kLaenge] = crlf >= 0 && (lf < 0 || crlf <= lf) ? [crlf, 4] : lf >= 0 ? [lf, 2] : [roh.length, 0];
  const h = kopfzeilen(roh.subarray(0, kEnde));
  const w = (n: string) => h.find(x => x.name.toLowerCase() === n)?.value;
  const ct = w('content-type') ?? 'text/plain';
  const typ = (ct.split(';')[0] ?? 'text/plain').trim().toLowerCase();
  const koerper = roh.subarray(kEnde + kLaenge);
  if (typ.startsWith('multipart/') && tiefe < 6) {
    const grenze = parameter(ct, 'boundary');
    const kinder: StrukturKnoten[] = [];
    if (grenze) {
      const teile = koerper.toString('latin1').split(`--${grenze}`).slice(1).filter(t => !t.startsWith('--'));
      teile.forEach((t, i) => kinder.push(struktur(Buffer.from(t.replace(/^\r?\n/, ''), 'latin1'), part ? `${part}.${i + 1}` : String(i + 1), tiefe + 1)));
    }
    return { type: typ, childNodes: kinder, ...(part ? { part } : {}) };
  }
  const dispo = w('content-disposition');
  const name = parameter(dispo, 'filename') ?? parameter(ct, 'name');
  return {
    part: part || '1', type: typ, size: koerper.length, encoding: (w('content-transfer-encoding') ?? '7bit').toLowerCase(),
    ...(name ? { parameters: { name } } : {}), ...(dispo ? { disposition: dispo.split(';')[0].trim().toLowerCase(), ...(name ? { dispositionParameters: { filename: name } } : {}) } : {}),
    ...(w('content-id') ? { id: w('content-id') } : {}),
  };
}

/** Einen Teil (IMAP-Zählung) aus der Rohnachricht holen — Transfer-Encoding aufgelöst. */
function teilHolen(roh: Buffer, teil: string): { bytes: Buffer; typ?: string } | null {
  const pfad = teil.split('.').map(Number);
  let aktuell = roh;
  for (let i = 0; i < pfad.length; i++) {
    const crlf = aktuell.indexOf('\r\n\r\n'), lf = aktuell.indexOf('\n\n');
    const [kEnde, kLaenge] = crlf >= 0 && (lf < 0 || crlf <= lf) ? [crlf, 4] : [lf, 2];
    const h = kopfzeilen(aktuell.subarray(0, Math.max(0, kEnde)));
    const ct = h.find(x => x.name.toLowerCase() === 'content-type')?.value ?? 'text/plain';
    const grenze = parameter(ct, 'boundary');
    if (!grenze) return pfad.length === 1 && pfad[0] === 1 ? { bytes: aktuell.subarray(kEnde + kLaenge) } : null;
    const teile = aktuell.subarray(kEnde + kLaenge).toString('latin1').split(`--${grenze}`).slice(1).filter(t => !t.startsWith('--'));
    const t = teile[pfad[i] - 1];
    if (t === undefined) return null;
    aktuell = Buffer.from(t.replace(/^\r?\n/, '').replace(/\r?\n$/, ''), 'latin1');
  }
  const crlf = aktuell.indexOf('\r\n\r\n'), lf = aktuell.indexOf('\n\n');
  const [kEnde, kLaenge] = crlf >= 0 && (lf < 0 || crlf <= lf) ? [crlf, 4] : [lf, 2];
  const h = kopfzeilen(aktuell.subarray(0, Math.max(0, kEnde)));
  const cte = (h.find(x => x.name.toLowerCase() === 'content-transfer-encoding')?.value ?? '').toLowerCase();
  const typ = (h.find(x => x.name.toLowerCase() === 'content-type')?.value ?? '').split(';')[0].trim() || undefined;
  const k = aktuell.subarray(kEnde + kLaenge);
  return { bytes: cte === 'base64' ? Buffer.from(k.toString('latin1').replace(/\s+/g, ''), 'base64') : k, ...(typ ? { typ } : {}) };
}

/** Ein Postfach im Speicher. */
export class PostSpeicher {
  ordner = new Map<string, OrdnerDaten>();
  /** Anmeldungen (Zähler — Tests prüfen, dass nach „anmeldung“ nicht weiter angefragt wird). */
  anmeldungen = 0;
  gesendet: { von: string; an: string[]; roh: Buffer }[] = [];
  passwort: string;
  idle = true;
  /** Sendet der Anbieter selbst eine Kopie nach „Gesendet“ (wie manche Server)? */
  legtGesendetSelbstAb = false;
  /** Ein Fehler für die nächste Anmeldung (z. B. Netz) — Tests. */
  naechsterFehler: PostfachFehler | null = null;
  private hoerer = new Set<() => void>();

  constructor(o: { passwort?: string; ordner?: { pfad: string; specialUse?: string }[]; idle?: boolean } = {}) {
    this.passwort = o.passwort ?? 'geheim';
    if (o.idle === false) this.idle = false;
    for (const x of o.ordner ?? [{ pfad: 'INBOX', specialUse: '\\Inbox' }, { pfad: 'Sent Messages', specialUse: '\\Sent' }, { pfad: 'Archive', specialUse: '\\Archive' }]) this.ordnerAnlegen(x.pfad, x.specialUse);
  }

  ordnerAnlegen(pfad: string, specialUse?: string): void {
    if (!this.ordner.has(pfad)) this.ordner.set(pfad, { pfad, ...(specialUse ? { specialUse } : {}), uidValidity: String(1000 + this.ordner.size), uidNext: 1, nachrichten: [] });
  }

  /** Nachricht ablegen (wie ein Eingang beim Anbieter). Liefert die UID. */
  ablegen(pfad: string, roh: string | Buffer, o: { flags?: string[]; am?: string } = {}): number {
    const f = this.ordner.get(pfad);
    if (!f) throw new Error(`Ordner ${pfad} fehlt`);
    const b = Buffer.isBuffer(roh) ? roh : Buffer.from(roh.replace(/\r?\n/g, '\r\n'), 'utf8');
    const uid = f.uidNext++;
    f.nachrichten.push({ uid, flags: new Set(o.flags ?? []), internalDate: o.am ?? new Date().toISOString(), roh: b, messageId: midAus(b) });
    if (pfad === 'INBOX') this.hoerer.forEach(h => h());
    return uid;
  }

  /** UIDVALIDITY ändern (Server hat den Ordner neu aufgebaut) — alle UIDs werden neu vergeben. */
  neuNummerieren(pfad: string): void {
    const f = this.ordner.get(pfad)!;
    f.uidValidity = String(Number(f.uidValidity) + 100);
    f.uidNext = 1;
    for (const n of f.nachrichten) n.uid = f.uidNext++;
  }

  nachrichten(pfad: string): Gespeichert[] { return this.ordner.get(pfad)?.nachrichten ?? []; }

  /** Eine angemeldete Sitzung (wirft bei falschem Passwort). */
  async sitzung(z: Pick<ImapZugang, 'passwort'>): Promise<ImapSitzung> {
    this.anmeldungen++;
    if (this.naechsterFehler) { const e = this.naechsterFehler; this.naechsterFehler = null; throw e; }
    if (z.passwort !== this.passwort || z.passwort === 'falsch') throw new PostfachFehler('anmeldung', FEHLER_TEXT.anmeldung);
    let offen: OrdnerDaten | null = null;
    const ord = (): OrdnerDaten => { if (!offen) throw new PostfachFehler('server', 'Kein Ordner geöffnet.'); return offen; };
    const finde = (uids: readonly number[]) => ord().nachrichten.filter(n => uids.includes(n.uid));
    return {
      idle: this.idle,
      ordnerListe: async (): Promise<OrdnerInfo[]> => Array.from(this.ordner.values()).map(o => ({ pfad: o.pfad, ...(o.specialUse ? { specialUse: o.specialUse } : {}) })),
      oeffnen: async pfad => {
        const o = this.ordner.get(pfad);
        if (!o) throw new PostfachFehler('ordner', `Ordner „${pfad}“ fehlt.`);
        offen = o;
        return { uidValidity: o.uidValidity, uidNext: o.uidNext, anzahl: o.nachrichten.length };
      },
      uids: async seitTag => ord().nachrichten.filter(n => !seitTag || n.internalDate.slice(0, 10) >= seitTag).map(n => n.uid),
      holen: async (uids, quelleMax): Promise<Abruf[]> => finde(uids).map(n => ({ uid: n.uid, flags: Array.from(n.flags), internalDate: n.internalDate, groesse: n.roh.length, quelle: n.roh.subarray(0, quelleMax), struktur: struktur(n.roh) })),
      flags: async uids => finde(uids).map(n => ({ uid: n.uid, flags: Array.from(n.flags) })),
      flagsAendern: async (uids, hinzu, weg) => { for (const n of finde(uids)) { hinzu.forEach(f => n.flags.add(f)); weg.forEach(f => n.flags.delete(f)); } },
      verschieben: async (uids, ziel) => {
        const z = this.ordner.get(ziel);
        if (!z) throw new PostfachFehler('ordner', `Ordner „${ziel}“ fehlt.`);
        const o = ord();
        for (const n of finde(uids)) { o.nachrichten = o.nachrichten.filter(x => x !== n); z.nachrichten.push({ ...n, uid: z.uidNext++ }); }
      },
      ordnerAnlegen: async pfad => { this.ordnerAnlegen(pfad); },
      anhaengen: async (pfad, roh, flags) => { this.ablegen(pfad, roh, { flags: [...flags] }); },
      sucheMessageId: async mid => ord().nachrichten.filter(n => n.messageId === mid).map(n => n.uid),
      teil: async (uid, teil, max) => {
        const n = ord().nachrichten.find(x => x.uid === uid);
        const t = n ? teilHolen(n.roh, teil) : null;
        if (!t) throw new PostfachFehler('server', 'Diesen Anhang gibt es nicht (mehr).', 404);
        if (t.bytes.length > max) throw new PostfachFehler('server', 'Der Anhang ist zu groß.', 413);
        return t;
      },
      schliessen: async () => { offen = null; },
    };
  }

  /** SMTP-Annahme. */
  async senden(z: { passwort: string }, umschlag: { von: string; an: readonly string[] }, roh: Buffer): Promise<{ angenommen: string[] }> {
    if (z.passwort !== this.passwort || z.passwort === 'falsch') throw new PostfachFehler('anmeldung', FEHLER_TEXT.anmeldung);
    this.gesendet.push({ von: umschlag.von, an: [...umschlag.an], roh });
    if (this.legtGesendetSelbstAb) { const s = Array.from(this.ordner.values()).find(o => o.specialUse === '\\Sent'); if (s) this.ablegen(s.pfad, roh, { flags: ['\\Seen'] }); }
    return { angenommen: [...umschlag.an] };
  }

  /** IDLE: Hörer für neue Post im Posteingang. */
  beobachten(neu: () => void): () => void { this.hoerer.add(neu); return () => { this.hoerer.delete(neu); }; }
}

/** Eine Rohnachricht bauen (Tests/Demo) — einfache Form, optional mit Anhang. */
export function rohNachricht(o: {
  von: string; an: string; betreff: string; text: string; messageId: string; datum?: string; inReplyTo?: string; references?: string[];
  kopf?: Record<string, string>; anhang?: { name: string; typ: string; inhalt: string }; html?: boolean;
}): string {
  const kopf = [
    `From: ${o.von}`, `To: ${o.an}`, `Subject: ${o.betreff}`, `Date: ${new Date(o.datum ?? Date.now()).toUTCString()}`, `Message-ID: ${o.messageId}`,
    ...(o.inReplyTo ? [`In-Reply-To: ${o.inReplyTo}`] : []), ...(o.references?.length ? [`References: ${o.references.join(' ')}`] : []),
    ...Object.entries(o.kopf ?? {}).map(([k, v]) => `${k}: ${v}`), 'MIME-Version: 1.0',
  ];
  const textTeil = o.html ? `Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${o.text}` : `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${o.text}`;
  if (!o.anhang) return `${kopf.join('\r\n')}\r\n${textTeil}\r\n`;
  const g = `grenze-${o.messageId.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`;
  return `${kopf.join('\r\n')}\r\nContent-Type: multipart/mixed; boundary="${g}"\r\n\r\n--${g}\r\n${textTeil}\r\n--${g}\r\nContent-Type: ${o.anhang.typ}; name="${o.anhang.name}"\r\nContent-Disposition: attachment; filename="${o.anhang.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(o.anhang.inhalt).toString('base64')}\r\n--${g}--\r\n`;
}
