// ─── Nachgebauter Gmail (nur für Tests): Gmail API v1 + die OAuth-Endpunkte des GoogleFake ───
// Ein kleiner, ehrlicher Server im Speicher: Postfach mit Nachrichten (Nachrichtenbaum wie `format=full`), Threads, Labels,
// `history.list` mit `historyId` (und 404 bei zu altem Stand), `messages.send` (Rohnachricht wird gemerkt), `modify`,
// `attachments.get`, `sendAs.list`, `watch`/`stop`. Alles erfundene Daten (@example.invalid / @makeinnovation.test) — nie ein
// echtes Google-Konto. Die Token-Endpunkte (Code-Tausch, Erneuern, Widerruf) kommen vom GoogleFake.
import { GoogleFake, type Aufruf } from './google-fake';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

interface Teil { partId?: string; mimeType: string; filename?: string; headers?: { name: string; value: string }[]; body: { attachmentId?: string; size?: number; data?: string }; parts?: Teil[] }
interface FNachricht { id: string; threadId: string; labelIds: string[]; internalDate: number; headers: { name: string; value: string }[]; payload: Teil; snippet: string; roh?: string; anhaenge: Record<string, Buffer> }

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (d: unknown, status = 200, kopf: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(d), { status, headers: { 'content-type': 'application/json', ...kopf } });

export interface MailEingabe {
  id?: string; threadId?: string;
  /** „Name <a@b.test>“ oder nur die Adresse. */
  von: string; an?: string; cc?: string; betreff?: string; betreffRoh?: string;
  text?: string; html?: string;
  /** Zeichensatz der Körper (Standard UTF-8) — die Bytes werden so kodiert. */
  charset?: string;
  labels?: string[];
  /** Minuten vor „jetzt“ (Standard 5). */
  vorMin?: number;
  kopf?: Record<string, string>;
  anhaenge?: { name: string; typ?: string; inhalt?: string; groesse?: number; eingebettet?: boolean }[];
  messageId?: string;
}

export class GmailFake {
  basis = new GoogleFake();
  adresse = 'kevin@makeinnovation.test';
  nachrichten = new Map<string, FNachricht>();
  historie: { id: number; art: 'added' | 'deleted' | 'labelsAdded' | 'labelsRemoved'; msg: string }[] = [];
  zaehler = 1000;
  idNr = 0;
  /** Alle `history.list` mit einem `startHistoryId` unterhalb davon antworten 404. */
  historieAbAb = 0;
  gesendet: { raw: string; threadId?: string; von?: string }[] = [];
  aufrufe: Aufruf[] = [];
  aliase: { sendAsEmail: string; displayName?: string; isDefault?: boolean; isPrimary?: boolean; verificationStatus?: string }[] = [
    { sendAsEmail: 'kevin@makeinnovation.test', displayName: 'Kevin Beispiel', isPrimary: true, isDefault: true, verificationStatus: 'accepted' },
    { sendAsEmail: 'hello@makeinnovation.test', displayName: 'MAKE Hello', verificationStatus: 'accepted' },
    { sendAsEmail: 'alt@makeinnovation.test', displayName: 'Unbestätigt', verificationStatus: 'pending' },
  ];
  fehler: { teil: string; methode?: string; status: number; kopf?: Record<string, string>; body?: unknown; einmal?: boolean }[] = [];
  watchAntwort = { historyId: '5000', expiration: String(Date.now() + 7 * 86_400_000) };
  seite = 100;

  constructor() {
    this.basis.scopeGewaehrt = `${this.basis.scopeGewaehrt} ${GMAIL_SCOPE}`;
    this.basis.konto = { email: this.adresse, hd: 'makeinnovation.test', email_verified: true };
  }

  private neueId(): string { return `18c${(++this.idNr).toString(16).padStart(8, '0')}ab`; }
  private ereignis(art: 'added' | 'deleted' | 'labelsAdded' | 'labelsRemoved', msg: string) { this.historie.push({ id: ++this.zaehler, art, msg }); }
  /** Der aktuelle Zähler (`historyId`). */
  get historyId(): string { return String(this.zaehler); }

  /** Eine Nachricht ins Postfach legen (mit `history`-Eintrag). */
  mail(o: MailEingabe): FNachricht {
    const id = o.id ?? this.neueId();
    const charset = o.charset ?? 'utf-8';
    const kodiere = (t: string) => (charset.toLowerCase() === 'utf-8' ? Buffer.from(t, 'utf8') : Buffer.from(t, 'latin1'));
    const koepfe = [
      { name: 'From', value: o.von }, { name: 'To', value: o.an ?? this.adresse }, ...(o.cc ? [{ name: 'Cc', value: o.cc }] : []),
      { name: 'Subject', value: o.betreffRoh ?? o.betreff ?? '(kein Betreff)' },
      { name: 'Date', value: new Date(Date.now() - (o.vorMin ?? 5) * 60_000).toUTCString() },
      { name: 'Message-ID', value: o.messageId ?? `<${id}@mail.example.invalid>` },
      ...Object.entries(o.kopf ?? {}).map(([name, value]) => ({ name, value })),
    ];
    const ct = (t: string) => ({ name: 'Content-Type', value: `${t}; charset="${charset}"` });
    const plain: Teil | null = o.text !== undefined ? { partId: '0.0', mimeType: 'text/plain', headers: [ct('text/plain')], body: { size: o.text.length, data: b64u(kodiere(o.text)) } } : null;
    const html: Teil | null = o.html !== undefined ? { partId: plain ? '0.1' : '0.0', mimeType: 'text/html', headers: [ct('text/html')], body: { size: o.html.length, data: b64u(kodiere(o.html)) } } : null;
    let koerper: Teil = plain && html
      ? { partId: '0', mimeType: 'multipart/alternative', headers: [{ name: 'Content-Type', value: 'multipart/alternative; boundary="x"' }], body: { size: 0 }, parts: [plain, html] }
      : { ...(plain ?? html ?? { mimeType: 'text/plain', body: { size: 0 } }), partId: '0' };
    const anhaenge: Record<string, Buffer> = {};
    if (o.anhaenge?.length) {
      const teile: Teil[] = o.anhaenge.map((a, i) => {
        const aid = `ANG-${id}-${i}-${Math.floor(Math.random() * 1e6)}`;
        const inhalt = Buffer.from(a.inhalt ?? `Inhalt von ${a.name}`);
        anhaenge[aid] = inhalt;
        return { partId: `0.${i + 1}`, mimeType: a.typ ?? 'application/pdf', filename: a.name, headers: [{ name: 'Content-Disposition', value: a.eingebettet ? 'inline' : `attachment; filename="${a.name}"` }, ...(a.eingebettet ? [{ name: 'Content-ID', value: `<cid-${i}>` }] : [])], body: { attachmentId: aid, size: a.groesse ?? inhalt.length } };
      });
      koerper = { partId: '0', mimeType: 'multipart/mixed', headers: [{ name: 'Content-Type', value: 'multipart/mixed; boundary="y"' }], body: { size: 0 }, parts: [{ ...koerper, partId: '0.0' }, ...teile] };
    }
    const n: FNachricht = {
      id, threadId: o.threadId ?? id, labelIds: o.labels ?? ['INBOX', 'UNREAD'], internalDate: Date.now() - (o.vorMin ?? 5) * 60_000,
      headers: koepfe, payload: { ...koerper, headers: [...koepfe, ...(koerper.headers ?? [])] }, snippet: (o.text ?? o.html?.replace(/<[^>]+>/g, ' ') ?? '').replace(/\s+/g, ' ').slice(0, 100), anhaenge,
    };
    this.nachrichten.set(id, n);
    this.ereignis('added', id);
    return n;
  }

  /** Labels ändern (von außen, z. B. „in Gmail archiviert“). */
  labels(id: string, add: string[] = [], remove: string[] = []): void {
    const n = this.nachrichten.get(id); if (!n) return;
    n.labelIds = [...n.labelIds.filter(l => !remove.includes(l)), ...add.filter(l => !n.labelIds.includes(l))];
    if (add.length) this.ereignis('labelsAdded', id);
    if (remove.length) this.ereignis('labelsRemoved', id);
  }
  loesche(id: string): void { this.nachrichten.delete(id); this.ereignis('deleted', id); }

  private ausgabe(n: FNachricht, format: string) {
    const { id, threadId, labelIds, snippet } = n;
    if (format === 'minimal') return { id, threadId, labelIds, snippet, historyId: this.historyId };
    return { id, threadId, labelIds, snippet, historyId: this.historyId, internalDate: String(n.internalDate), sizeEstimate: 2048, payload: n.payload };
  }

  handle = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const u = new URL(url);
    if (u.hostname !== 'gmail.googleapis.com') return this.basis.handle(url, init);
    const methode = (init.method ?? 'GET').toUpperCase();
    const kopf: Record<string, string> = {};
    for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) kopf[k.toLowerCase()] = v;
    let body: unknown = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* Formular */ } }
    this.aufrufe.push({ methode, pfad: u.pathname, query: u.searchParams, body, kopf });

    const f = this.fehler.findIndex(x => u.pathname.includes(x.teil) && (!x.methode || x.methode === methode));
    if (f >= 0) { const x = this.fehler[f]; if (x.einmal !== false) this.fehler.splice(f, 1); return json(x.body ?? { error: { code: x.status, message: 'Fehler' } }, x.status, x.kopf); }

    const auth = (kopf.authorization ?? '').replace(/^Bearer /, '');
    if (!this.basis.gueltig.has(auth)) return json({ error: { code: 401, message: 'Invalid Credentials', status: 'UNAUTHENTICATED' } }, 401);
    const m = /^\/gmail\/v1\/users\/me(\/.*)$/.exec(u.pathname);
    if (!m) return json({}, 404);
    const pfad = m[1];

    if (pfad === '/profile') return json({ emailAddress: this.adresse, historyId: this.historyId, messagesTotal: this.nachrichten.size });

    if (pfad === '/messages' && methode === 'GET') {
      const label = u.searchParams.get('labelIds');
      const tage = /newer_than:(\d+)d/.exec(u.searchParams.get('q') ?? '')?.[1];
      const grenze = tage ? Date.now() - Number(tage) * 86_400_000 : 0;
      const liste = [...this.nachrichten.values()].filter(n => (!label || n.labelIds.includes(label)) && n.internalDate >= grenze).sort((a, b) => b.internalDate - a.internalDate);
      const ab = Number(u.searchParams.get('pageToken') ?? 0);
      const teil = liste.slice(ab, ab + this.seite);
      return json({ messages: teil.map(n => ({ id: n.id, threadId: n.threadId })), ...(ab + this.seite < liste.length ? { nextPageToken: String(ab + this.seite) } : {}), resultSizeEstimate: liste.length });
    }

    if (pfad === '/messages/send' && methode === 'POST') {
      const b = body as { raw: string; threadId?: string };
      const roh = Buffer.from(b.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      this.gesendet.push({ raw: roh, ...(b.threadId ? { threadId: b.threadId } : {}) });
      const kopfTeil = roh.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
      const wert = (n: string) => new RegExp(`^${n}:\\s*(.*)$`, 'im').exec(kopfTeil)?.[1] ?? '';
      const id = this.neueId();
      const n: FNachricht = { id, threadId: b.threadId ?? id, labelIds: ['SENT'], internalDate: Date.now(), headers: [], snippet: '', roh, anhaenge: {},
        payload: { partId: '0', mimeType: 'text/plain', headers: [{ name: 'From', value: wert('From') }, { name: 'To', value: wert('To') }, ...(wert('Cc') ? [{ name: 'Cc', value: wert('Cc') }] : []), { name: 'Subject', value: wert('Subject') }, { name: 'Message-ID', value: wert('Message-ID') }, { name: 'In-Reply-To', value: wert('In-Reply-To') }, { name: 'References', value: wert('References') }, { name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { size: 5, data: b64u('(gesendet)') } } };
      this.nachrichten.set(id, n);
      this.ereignis('added', id);
      return json({ id, threadId: n.threadId, labelIds: ['SENT'] });
    }

    const msg = /^\/messages\/([^/]+)$/.exec(pfad);
    if (msg && methode === 'GET') {
      const n = this.nachrichten.get(decodeURIComponent(msg[1]));
      return n ? json(this.ausgabe(n, u.searchParams.get('format') ?? 'full')) : json({ error: { code: 404, message: 'Requested entity was not found.' } }, 404);
    }
    const mod = /^\/(messages|threads)\/([^/]+)\/modify$/.exec(pfad);
    if (mod && methode === 'POST') {
      const b = body as { addLabelIds?: string[]; removeLabelIds?: string[] };
      const id = decodeURIComponent(mod[2]);
      const ziele = mod[1] === 'threads' ? [...this.nachrichten.values()].filter(n => n.threadId === id) : [this.nachrichten.get(id)].filter((x): x is FNachricht => !!x);
      if (!ziele.length) return json({ error: { code: 404, message: 'Requested entity was not found.' } }, 404);
      for (const n of ziele) this.labels(n.id, b.addLabelIds ?? [], b.removeLabelIds ?? []);
      return json({ id, ...(mod[1] === 'threads' ? { messages: ziele.map(n => ({ id: n.id })) } : { labelIds: ziele[0].labelIds }) });
    }
    const ang = /^\/messages\/([^/]+)\/attachments\/(.+)$/.exec(pfad);
    if (ang && methode === 'GET') {
      const n = this.nachrichten.get(decodeURIComponent(ang[1]));
      const inhalt = n?.anhaenge[decodeURIComponent(ang[2])];
      return inhalt ? json({ size: inhalt.length, data: b64u(inhalt) }) : json({ error: { code: 404, message: 'Attachment not found' } }, 404);
    }

    if (pfad === '/history' && methode === 'GET') {
      const ab = Number(u.searchParams.get('startHistoryId'));
      if (!Number.isFinite(ab) || ab < this.historieAbAb) return json({ error: { code: 404, message: 'Requested entity was not found.' } }, 404);
      const ereignisse = this.historie.filter(h => h.id > ab);
      const mitNachricht = (id: string) => { const n = this.nachrichten.get(id); return { message: { id, threadId: n?.threadId ?? id, labelIds: n?.labelIds ?? [] } }; };
      return json({
        history: ereignisse.map(h => ({ id: String(h.id), ...(h.art === 'added' ? { messagesAdded: [mitNachricht(h.msg)] } : h.art === 'deleted' ? { messagesDeleted: [{ message: { id: h.msg } }] } : h.art === 'labelsAdded' ? { labelsAdded: [{ ...mitNachricht(h.msg), labelIds: [] }] } : { labelsRemoved: [{ ...mitNachricht(h.msg), labelIds: [] }] }) })),
        historyId: this.historyId,
      });
    }
    if (pfad === '/settings/sendAs') return json({ sendAs: this.aliase });
    if (pfad === '/watch' && methode === 'POST') return json(this.watchAntwort);
    if (pfad === '/stop' && methode === 'POST') return json({}, 204);
    return json({}, 404);
  };
}

/** Die Aufrufe an einen Pfad-Teil (und Methode). */
export const gmailAufrufe = (g: GmailFake, teil: string, methode?: string): Aufruf[] => g.aufrufe.filter(a => a.pfad.includes(teil) && (!methode || a.methode === methode));
