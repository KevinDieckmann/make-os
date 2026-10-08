// ─── Nachgebautes WHOOP (nur für Tests): OAuth-Endpunkte + API v2 ─────────────────────────────────────────────────────────
// Ein kleiner Server im Speicher nach der Doku (research/whoop/FAKTEN_WHOOP.md): Code-Tausch, Erneuern MIT Rotation (das alte
// Refresh-Token gilt danach nicht mehr), Widerruf `DELETE /v2/user/access`, Profil, Sammlungen mit `records` + `next_token`, 429.
// Mehrere Konten (Kevin und Malin haben je IHR WHOOP). Alles erfunden (@example.invalid) — kein echtes WHOOP-Konto, kein Netz.

export interface WAufruf { methode: string; pfad: string; query: URLSearchParams; body: string; auth: string }
interface Konto { userId: number; email: string; recovery: Record<string, unknown>[]; sleep: Record<string, unknown>[]; cycle: Record<string, unknown>[]; workout: Record<string, unknown>[] }

const json = (d: unknown, status = 200, kopf: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(d), { status, headers: { 'content-type': 'application/json', ...kopf } });

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export class WhoopFake {
  aufrufe: WAufruf[] = [];
  konten = new Map<number, Konto>();
  /** Code → WHOOP-Kennung. */
  codes = new Map<string, number>();
  /** Gültige Zugriffstoken → WHOOP-Kennung. */
  zugriff = new Map<string, number>();
  /** Gültige Refresh-Token → WHOOP-Kennung (rotieren). */
  refresh = new Map<string, number>();
  nr = 0;
  widerrufen: number[] = [];
  scope = 'offline read:recovery read:cycles read:workout read:sleep read:profile';
  seite = 25;
  /** Statuscodes für die nächsten Aufrufe (Pfad-Teil). */
  fehler: { teil: string; status: number; kopf?: Record<string, string>; einmal?: boolean }[] = [];

  konto(userId: number, email: string): Konto {
    const k: Konto = { userId, email, recovery: [], sleep: [], cycle: [], workout: [] };
    this.konten.set(userId, k);
    return k;
  }
  /** Ein Code für die Anmeldung dieses Kontos. */
  code(userId: number): string { const c = `code-${userId}-${++this.nr}`; this.codes.set(c, userId); return c; }
  /** Zugriff von außen ungültig machen (z. B. in der WHOOP-App widerrufen). */
  allesWiderrufen(userId: number): void {
    for (const [t, u] of [...this.zugriff]) if (u === userId) this.zugriff.delete(t);
    for (const [t, u] of [...this.refresh]) if (u === userId) this.refresh.delete(t);
  }
  /** Nur die Zugriffstoken ablaufen lassen (Erneuern bleibt möglich). */
  zugriffAbgelaufen(): void { this.zugriff.clear(); }

  private tokens(userId: number) {
    const a = `acc-${userId}-${++this.nr}`, r = `ref-${userId}-${++this.nr}`;
    this.zugriff.set(a, userId); this.refresh.set(r, userId);
    return { access_token: a, refresh_token: r, expires_in: 3600, scope: this.scope, token_type: 'bearer' };
  }

  async handle(u: string, i: RequestInit = {}): Promise<Response> {
    const url = new URL(u);
    const methode = (i.method ?? 'GET').toUpperCase();
    const body = typeof i.body === 'string' ? i.body : '';
    const kopf = new Headers(i.headers as HeadersInit | undefined);
    const auth = kopf.get('authorization') ?? '';
    this.aufrufe.push({ methode, pfad: url.pathname, query: url.searchParams, body, auth });
    if (url.hostname !== 'api.prod.whoop.com') throw new Error(`Unerwarteter Host im Test: ${url.hostname}`);
    const f = this.fehler.find(x => url.pathname.includes(x.teil));
    if (f) { if (f.einmal) this.fehler.splice(this.fehler.indexOf(f), 1); return json({ error: 'fake' }, f.status, f.kopf); }

    if (url.pathname === '/oauth/oauth2/token') {
      const p = new URLSearchParams(body);
      if (p.get('client_id') !== 'whoop-client-test' || p.get('client_secret') !== 'whoop-geheimnis-test') return json({ error: 'invalid_client' }, 401);
      if (p.get('grant_type') === 'authorization_code') {
        const userId = this.codes.get(p.get('code') ?? '');
        if (!userId) return json({ error: 'invalid_grant' }, 400);
        this.codes.delete(p.get('code')!);
        return json(this.tokens(userId));
      }
      if (p.get('grant_type') === 'refresh_token') {
        const r = p.get('refresh_token') ?? '';
        const userId = this.refresh.get(r);
        if (!userId) return json({ error: 'invalid_grant' }, 400);
        // Rotation (Doku): alte Token gelten nicht mehr.
        this.refresh.delete(r);
        for (const [t, x] of [...this.zugriff]) if (x === userId) this.zugriff.delete(t);
        return json(this.tokens(userId));
      }
      return json({ error: 'unsupported_grant_type' }, 400);
    }

    const userId = this.zugriff.get(auth.replace(/^Bearer\s+/, ''));
    if (!userId) return json({ error: 'unauthorized' }, 401);
    const k = this.konten.get(userId)!;
    const pfad = url.pathname.replace(/^\/developer/, '');
    if (pfad === '/v2/user/access' && methode === 'DELETE') { this.widerrufen.push(userId); this.allesWiderrufen(userId); return new Response(null, { status: 204 }); }
    if (pfad === '/v2/user/profile/basic') return json({ user_id: userId, email: k.email, first_name: 'Test', last_name: 'Person' });
    const quelle = pfad === '/v2/recovery' ? k.recovery : pfad === '/v2/activity/sleep' ? k.sleep : pfad === '/v2/cycle' ? k.cycle : pfad === '/v2/activity/workout' ? k.workout : null;
    if (!quelle) return json({ error: 'not found' }, 404);
    const start = Date.parse(url.searchParams.get('start') ?? '1970-01-01T00:00:00Z');
    const zeit = (r: Record<string, unknown>) => Date.parse(String(r.start ?? r.created_at));
    const alle = quelle.filter(r => zeit(r) >= start);
    const ab = Number(url.searchParams.get('nextToken') ?? 0);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 10), 25, this.seite);
    const records = alle.slice(ab, ab + limit);
    return json({ records, ...(ab + limit < alle.length ? { next_token: String(ab + limit) } : {}) });
  }
}

// ── Erfundene Datensätze nach der v2-Form ───────────────────────────────────

export const schlaf = (n: number, ende: string, opt: { nap?: boolean; stunden?: number; state?: string } = {}) => {
  const ms = (opt.stunden ?? 7.5) * 3_600_000;
  return { id: uuid(n), cycle_id: n, v1_id: n, user_id: 1, start: new Date(Date.parse(ende) - ms - 1_800_000).toISOString(), end: ende, timezone_offset: '+02:00', nap: !!opt.nap, score_state: opt.state ?? 'SCORED',
    score: { stage_summary: { total_in_bed_time_milli: ms + 1_800_000, total_awake_time_milli: 1_800_000, total_light_sleep_time_milli: ms * 0.5, total_slow_wave_sleep_time_milli: ms * 0.25, total_rem_sleep_time_milli: ms * 0.25, sleep_cycle_count: 4, disturbance_count: 3 }, respiratory_rate: 15, sleep_performance_percentage: 91, sleep_consistency_percentage: 80, sleep_efficiency_percentage: 93 } };
};
export const erholung = (schlafNr: number, am: string, rec: number, opt: { hrv?: number; rhr?: number; state?: string } = {}) => ({
  cycle_id: schlafNr, sleep_id: uuid(schlafNr), user_id: 1, created_at: am, updated_at: am, score_state: opt.state ?? 'SCORED',
  score: { user_calibrating: false, recovery_score: rec, resting_heart_rate: opt.rhr ?? 52, hrv_rmssd_milli: opt.hrv ?? 61.4, spo2_percentage: 96.2, skin_temp_celsius: 33.71 },
});
export const zyklus = (n: number, start: string, strain: number) => ({ id: n, user_id: 1, start, end: null, timezone_offset: '+02:00', score_state: 'SCORED', score: { strain, kilojoule: 9000, average_heart_rate: 70, max_heart_rate: 160 } });
export const training = (n: number, start: string, minuten: number, sport: string, opt: { meter?: number; strain?: number } = {}) => ({
  id: uuid(n), v1_id: n, user_id: 1, start, end: new Date(Date.parse(start) + minuten * 60_000).toISOString(), timezone_offset: '+02:00', sport_name: sport, sport_id: sport === 'running' ? 0 : 45, score_state: 'SCORED',
  score: { strain: opt.strain ?? 11.2, average_heart_rate: 140, max_heart_rate: 172, kilojoule: 2092, percent_recorded: 100, ...(opt.meter !== undefined ? { distance_meter: opt.meter } : {}), altitude_gain_meter: 10, altitude_change_meter: 0, zone_durations: {} },
});
