// ─── Nachgebauter iCloud-CalDAV-Server (nur für Tests) ───────────────────────
// Principal → calendar-home-set → Kalenderliste → REPORT (calendar-data) → PUT/DELETE mit If-Match/If-None-Match.
// Mehrere Kalender; Termine als ICS-Text. Alles erfunden (@example.invalid), nie echtes iCloud.
export interface IcsObjekt { ics: string; etag: string }
export class IcloudFake {
  readonly HOME = 'https://p42-caldav.icloud.com/123/calendars/';
  kalender: Record<string, { name: string; objekte: Record<string, IcsObjekt> }> = {};
  ctag = 1;
  etagNr = 1;
  aufrufe: { methode: string; url: string; body?: string }[] = [];
  adresse = 'kevin.konto@example.invalid';

  add(id: string, name: string): this { this.kalender[id] = { name, objekte: {} }; return this; }
  setze(kal: string, datei: string, ics: string): void { this.kalender[kal].objekte[datei] = { ics, etag: `e${this.etagNr++}` }; this.ctag++; }
  datei(kal: string, uid: string): string | undefined { return Object.keys(this.kalender[kal].objekte).find(d => this.kalender[kal].objekte[d].ics.includes(`UID:${uid}`)); }

  private ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
  private esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  handle = async (url: string, init: RequestInit = {}): Promise<Response | null> => {
    if (!/icloud\.com/.test(url)) return null;
    const methode = String(init.method ?? 'GET').toUpperCase();
    this.aufrufe.push({ methode, url, ...(typeof init.body === 'string' ? { body: init.body } : {}) });
    const kopf = (init.headers ?? {}) as Record<string, string>;
    if (url === 'https://caldav.icloud.com/' && methode === 'PROPFIND') return this.ms('<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>');
    if (url === 'https://caldav.icloud.com/123/principal/') return this.ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>${this.HOME}</d:href></c:calendar-home-set><c:calendar-user-address-set><d:href>mailto:${this.adresse}</d:href></c:calendar-user-address-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
    if (url === this.HOME && methode === 'PROPFIND') {
      return this.ms(Object.entries(this.kalender).map(([id, k]) => `<d:response><d:href>/123/calendars/${id}/</d:href><d:propstat><d:prop><d:displayname>${k.name}</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>${this.ctag}</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
    }
    for (const [id, k] of Object.entries(this.kalender)) {
      const basis = `${this.HOME}${id}/`;
      if (url === basis && methode === 'REPORT') {
        return this.ms(Object.entries(k.objekte).map(([n, o]) => `<d:response><d:href>/123/calendars/${id}/${n}</d:href><d:propstat><d:prop><d:getetag>"${o.etag}"</d:getetag><c:calendar-data>${this.esc(o.ics)}</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
      }
      if (url.startsWith(basis)) {
        const n = decodeURIComponent(url.slice(basis.length));
        const da = k.objekte[n];
        if (methode === 'PUT') {
          if (kopf['If-Match'] && (!da || `"${da.etag}"` !== kopf['If-Match'])) return new Response('', { status: 412 });
          if (kopf['If-None-Match'] === '*' && da) return new Response('', { status: 412 });
          k.objekte[n] = { ics: String(init.body), etag: `e${this.etagNr++}` }; this.ctag++;
          return new Response(null, { status: da ? 204 : 201 });
        }
        if (methode === 'DELETE') { if (!da) return new Response(null, { status: 404 }); delete k.objekte[n]; this.ctag++; return new Response(null, { status: 204 }); }
        if (methode === 'GET') return da ? new Response(da.ics, { status: 200, headers: { etag: `"${da.etag}"` } }) : new Response('', { status: 404 });
      }
    }
    return new Response('nicht gefunden', { status: 404 });
  };
}

export const einfachIcs = (uid: string, titel: string, tag: string, von = '100000', bis = '110000', extra = ''): string =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//DE\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:${tag.replace(/-/g, '')}T${von}\r\nDTEND;TZID=Europe/Berlin:${tag.replace(/-/g, '')}T${bis}\r\nSUMMARY:${titel}\r\nTRANSP:OPAQUE\r\n${extra}END:VEVENT\r\nEND:VCALENDAR`;
