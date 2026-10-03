// ─── Nachgebauter Google (nur für Tests): OAuth-Endpunkte + Calendar API v3 ───
// Ein kleiner, ehrlicher Server im Speicher: Token (Code-Tausch, Erneuern, Widerruf), Kalenderliste, Ereignisse mit
// syncToken, 410, Seiten, ETag/If-Match (412), eigene IDs (409), Löschen (cancelled), watch/stop. Alles erfundene Daten
// (@example.invalid / @makeinnovation.test) — nie ein echtes Google-Konto.
import { createHash } from 'node:crypto';

export interface Aufruf { methode: string; pfad: string; query: URLSearchParams; body: unknown; kopf: Record<string, string> }
type Ev = Record<string, unknown> & { id: string; _v: number };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const jwt = (nutzlast: Record<string, unknown>) => `${b64({ alg: 'RS256' })}.${b64(nutzlast)}.sig`;
const json = (d: unknown, status = 200, kopf: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(d), { status, headers: { 'content-type': 'application/json', ...kopf } });

export class GoogleFake {
  aufrufe: Aufruf[] = [];
  /** Wen der Code-Tausch meldet. */
  konto = { email: 'kevin@makeinnovation.test', hd: 'makeinnovation.test', email_verified: true };
  scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
  refreshOk = true;
  tokenNr = 0;
  gueltig = new Set<string>();
  widerrufen: string[] = [];
  events = new Map<string, Ev>();
  version = 1;
  etagNr = 1;
  seite = 250;
  /** Der nächste Listen-Aufruf mit syncToken antwortet 410. */
  gone = false;
  /** Statuscodes, mit denen die nächsten Aufrufe (nach Pfad-Teil) antworten. */
  fehler: { teil: string; methode?: string; status: number; kopf?: Record<string, string>; body?: unknown; einmal?: boolean }[] = [];
  kalenderId = 'kevin@makeinnovation.test';
  kalenderListe: Record<string, unknown>[] = [{ id: 'kevin@makeinnovation.test', summary: 'kevin@makeinnovation.test', primary: true, accessRole: 'owner', backgroundColor: '#9fe1e7', timeZone: 'Europe/Berlin' }, { id: 'team@group.calendar.google.test', summary: 'Team', accessRole: 'writer', backgroundColor: '#ffad46' }, { id: 'feiertage@group.calendar.google.test', summary: 'Feiertage', accessRole: 'reader' }];

  /** Ein Ereignis von außen anlegen (z. B. „in Google geändert“). */
  setze(e: Record<string, unknown> & { id: string }): Ev {
    const alt = this.events.get(e.id);
    const neu = { organizer: { email: this.kalenderId, self: true }, status: 'confirmed', ...alt, ...e, etag: `"g${this.etagNr++}"`, updated: new Date().toISOString(), _v: ++this.version } as Ev;
    this.events.set(e.id, neu);
    return neu;
  }
  loesche(id: string): void {
    const alt = this.events.get(id);
    this.events.set(id, { ...(alt ?? { id }), id, status: 'cancelled', etag: `"g${this.etagNr++}"`, _v: ++this.version } as Ev);
  }
  token(): string { const t = `zugriff-${++this.tokenNr}`; this.gueltig.add(t); return t; }

  private rein(e: Ev) { const { _v, ...rest } = e; void _v; return rest; }

  handle = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const u = new URL(url);
    const methode = (init.method ?? 'GET').toUpperCase();
    const kopf: Record<string, string> = {};
    for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) kopf[k.toLowerCase()] = v;
    let body: unknown = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* Formular */ } }
    this.aufrufe.push({ methode, pfad: u.pathname, query: u.searchParams, body, kopf });

    const f = this.fehler.findIndex(x => u.pathname.includes(x.teil) && (!x.methode || x.methode === methode));
    if (f >= 0) { const x = this.fehler[f]; if (x.einmal !== false) this.fehler.splice(f, 1); return json(x.body ?? { error: { code: x.status, message: 'Fehler' } }, x.status, x.kopf); }

    // ── OAuth ──
    if (u.hostname === 'oauth2.googleapis.com' && u.pathname === '/token') {
      const p = new URLSearchParams(String(init.body));
      if (p.get('grant_type') === 'authorization_code') {
        if (!p.get('code_verifier') || p.get('code') === 'falsch') return json({ error: 'invalid_grant' }, 400);
        const t = this.token();
        return json({ access_token: t, refresh_token: 'erneuerung-geheim-1', expires_in: 3600, scope: this.scopeGewaehrt, token_type: 'Bearer', id_token: jwt({ ...this.konto, sub: '1234' }) });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (!this.refreshOk) return json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400);
        return json({ access_token: this.token(), expires_in: 3600, scope: this.scopeGewaehrt, token_type: 'Bearer' });
      }
    }
    if (u.hostname === 'oauth2.googleapis.com' && u.pathname === '/revoke') { this.widerrufen.push(new URLSearchParams(String(init.body)).get('token') ?? ''); return json({}, 200); }

    // ── Calendar API (ab hier nur mit gültigem Token) ──
    const auth = (kopf.authorization ?? '').replace(/^Bearer /, '');
    if (u.hostname !== 'www.googleapis.com') return json({}, 404);
    if (!this.gueltig.has(auth)) return json({ error: { code: 401, message: 'Invalid Credentials', status: 'UNAUTHENTICATED' } }, 401);
    const m = /^\/calendar\/v3(\/.*)$/.exec(u.pathname);
    if (!m) return json({}, 404);
    const pfad = m[1];

    if (pfad === '/users/me/calendarList' && methode === 'GET') return json({ items: this.kalenderListe });
    const cl = /^\/users\/me\/calendarList\/(.+)$/.exec(pfad);
    if (cl && methode === 'GET') {
      const id = decodeURIComponent(cl[1]);
      const k = id === 'primary' ? this.kalenderListe.find(x => x.primary) : this.kalenderListe.find(x => x.id === id);
      return k ? json(k) : json({ error: { code: 404, message: 'Not Found' } }, 404);
    }
    if (pfad === '/channels/stop' && methode === 'POST') return json({}, 204);

    const ev = /^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(pfad);
    const watch = /^\/calendars\/([^/]+)\/events\/watch$/.exec(pfad);
    if (watch && methode === 'POST') {
      const b = body as { id: string; token: string; address: string };
      return json({ kind: 'api#channel', id: b.id, resourceId: `res-${b.id.slice(-6)}`, resourceUri: 'x', token: b.token, expiration: String(Date.now() + 7 * 86_400_000) });
    }
    if (!ev) return json({}, 404);
    const id = ev[2] ? decodeURIComponent(ev[2]) : null;

    if (!id && methode === 'GET') {
      const st = u.searchParams.get('syncToken');
      if (st && this.gone) { this.gone = false; return json({ error: { code: 410, message: 'Sync token is no longer valid, a full sync is required.' } }, 410); }
      const von = st ? Number(st.replace(/^st/, '')) : 0;
      let liste = [...this.events.values()].filter(e => e._v > von);
      if (!st) liste = liste.filter(e => e.status !== 'cancelled' || u.searchParams.get('showDeleted') === 'true');
      liste.sort((a, b) => a._v - b._v);
      const ab = Number(u.searchParams.get('pageToken') ?? 0);
      const seite = liste.slice(ab, ab + this.seite);
      const mehr = ab + this.seite < liste.length;
      return json({ kind: 'calendar#events', items: seite.map(e => this.rein(e)), ...(mehr ? { nextPageToken: String(ab + this.seite) } : { nextSyncToken: `st${this.version}` }) });
    }
    if (!id && methode === 'POST') {
      const b = body as Record<string, unknown> & { id?: string };
      if (b.id && this.events.has(b.id)) return json({ error: { code: 409, message: 'The requested identifier already exists.', errors: [{ reason: 'duplicate' }] } }, 409);
      const neu = this.setze({ ...b, id: b.id ?? createHash('sha1').update(String(Math.random())).digest('hex').slice(0, 20) });
      return json(this.rein(neu));
    }
    if (id && methode === 'GET') { const e = this.events.get(id); return e ? json(this.rein(e), 200, { etag: String(e.etag) }) : json({ error: { code: 404 } }, 404); }
    if (id && (methode === 'PATCH' || methode === 'PUT' || methode === 'DELETE')) {
      const e = this.events.get(id);
      if (!e) return json({ error: { code: 404, message: 'Not Found' } }, 404);
      const im = kopf['if-match'];
      if (im && e.status !== 'cancelled' && im !== String(e.etag)) return json({ error: { code: 412, message: 'Precondition Failed' } }, 412);
      if (methode === 'DELETE') { if (e.status === 'cancelled') return json({ error: { code: 410, message: 'Resource has been deleted' } }, 410); this.loesche(id); return json({}, 204); }
      if (methode === 'PATCH' && e.status === 'cancelled') return json({ error: { code: 410, message: 'Resource has been deleted' } }, 410);
      const b = body as Record<string, unknown>;
      if (methode === 'PUT') return json(this.rein(this.setze({ ...b, id })));
      const ext = (b.extendedProperties as { private?: Record<string, unknown> } | undefined)?.private;
      const privat = { ...((e.extendedProperties as { private?: Record<string, unknown> } | undefined)?.private ?? {}) };
      if (ext) for (const [k, v] of Object.entries(ext)) { if (v === null) delete privat[k]; else privat[k] = v; }
      const merge: Record<string, unknown> = { ...b };
      for (const [k, v] of Object.entries(merge)) if (v === null) delete merge[k];
      const neu = this.setze({ ...e, ...merge, id, ...(ext ? { extendedProperties: { private: privat } } : {}) });
      for (const [k, v] of Object.entries(b)) if (v === null) delete (neu as Record<string, unknown>)[k];
      return json(this.rein(neu));
    }
    return json({}, 404);
  };
}

/** Die Aufrufe an einen Pfad-Teil (und Methode). */
export const aufrufeAn = (g: GoogleFake, teil: string, methode?: string): Aufruf[] => g.aufrufe.filter(a => a.pfad.includes(teil) && (!methode || a.methode === methode));
