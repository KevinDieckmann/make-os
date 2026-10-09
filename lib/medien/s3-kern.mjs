// ─── Medien — S3-Kern ohne Abhängigkeiten (09.10., Paket 5; als .mjs seit dem Nachzug Instanz-Export/-Löschen) ─────────────────────
// Hetzner Object Storage spricht S3 (research/agenten/MEDIEN.md B4). Statt eines SDK (Hunderte KB, eigene Abhängigkeiten) signiert MAKE OS
// die wenigen Aufrufe selbst — nach der veröffentlichten Beschreibung „Signature Version 4“ (Canonical Request → String to Sign →
// abgeleiteter Schlüssel → HMAC). Geprüft gegen das Beispiel „GET Object“ der AWS-Doku (tests/medien-speicher.test.ts).
// Warum .mjs (wie lib/store/atomar.mjs): dieselbe Signatur, dieselbe Konfiguration und dieselben Aufrufe braucht das Löschskript
// scripts/instanz-loeschen.mjs — es läuft mit nacktem Node (im Server-Bild gibt es keinen TS-Lader). Die App nimmt sie über
// lib/medien/s3-signatur.ts, lib/medien/speicher.ts und lib/medien/speicher-s3.ts — EIN Weg, keine zweite S3-Umsetzung.
// Nur node:crypto. Zugangsdaten nur als Parameter — nie ins Log, nie in Fehlermeldungen.

import { createHash, createHmac } from 'node:crypto';

// ── Namen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

const OBJEKT_OK = /^[a-z0-9][a-z0-9-]{0,62}(\/[a-z0-9][a-z0-9-]{0,80}){1,4}$/;
const PRAEFIX_OK = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** Ein zulässiger Objekt-Name (keine Punkte, keine Pfad-Tricks, nur Kennungen). */
export const objektOk = o => typeof o === 'string' && OBJEKT_OK.test(o) && !o.includes('..');
/** Ein zulässiges Präfix der Instanz (Listen und Löschen der ganzen Instanz laufen nur darunter). */
export const praefixOk = p => typeof p === 'string' && PRAEFIX_OK.test(p);

// ── Signatur (AWS Signature Version 4) ───────────────────────────────────────────────────────────────────────────────

export const LEERER_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** URI-Kodierung nach AWS: nur A–Z a–z 0–9 - . _ ~ bleiben, alles andere %XX (Großbuchstaben). `schraeg` = „/“ bleibt (Pfad). */
export function awsKodieren(s, schraeg = false) {
  let raus = '';
  for (const b of Buffer.from(s, 'utf8')) {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9\-._~]/.test(c) || (schraeg && c === '/')) raus += c;
    else raus += `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return raus;
}

/** Kanonische Abfrage: nach Schlüssel sortiert, Schlüssel und Werte kodiert, `a=` für leere Werte. */
export function kanonischeAbfrage(abfrage) {
  return Object.keys(abfrage).sort().map(k => `${awsKodieren(k)}=${awsKodieren(abfrage[k])}`).join('&');
}

const hmac = (k, t) => createHmac('sha256', k).update(t, 'utf8').digest();
const hex = b => createHash('sha256').update(b).digest('hex');

/** Signierte Köpfe: `authorization`, `x-amz-date`, `x-amz-content-sha256` (+ die übergebenen). */
export function signiere(e) {
  const datum = e.jetzt.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  const tag = datum.slice(0, 8);
  const koepfe = { host: e.host, 'x-amz-content-sha256': e.nutzlast, 'x-amz-date': datum };
  for (const [k, v] of Object.entries(e.kopf ?? {})) koepfe[k.toLowerCase()] = v.trim();
  const namen = Object.keys(koepfe).sort();
  const kanonisch = [
    e.methode.toUpperCase(),
    e.pfad,
    kanonischeAbfrage(e.abfrage),
    namen.map(n => `${n}:${koepfe[n].replace(/\s+/g, ' ')}\n`).join(''),
    namen.join(';'),
    e.nutzlast,
  ].join('\n');
  const umfang = `${tag}/${e.region}/s3/aws4_request`;
  const zuSignieren = ['AWS4-HMAC-SHA256', datum, umfang, hex(kanonisch)].join('\n');
  const schluessel = hmac(hmac(hmac(hmac(`AWS4${e.geheimnis}`, tag), e.region), 's3'), 'aws4_request');
  const signatur = createHmac('sha256', schluessel).update(zuSignieren, 'utf8').digest('hex');
  const { host: _h, ...rest } = koepfe;
  return { ...rest, authorization: `AWS4-HMAC-SHA256 Credential=${e.zugang}/${umfang}, SignedHeaders=${namen.join(';')}, Signature=${signatur}` };
}

/** Nur für den Test gegen die AWS-Doku: der String to Sign derselben Eingabe. */
export function zuSignierenFuer(e) {
  const datum = e.jetzt.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const koepfe = { host: e.host, 'x-amz-content-sha256': e.nutzlast, 'x-amz-date': datum };
  for (const [k, v] of Object.entries(e.kopf ?? {})) koepfe[k.toLowerCase()] = v.trim();
  const namen = Object.keys(koepfe).sort();
  const kanonisch = [e.methode.toUpperCase(), e.pfad, kanonischeAbfrage(e.abfrage), namen.map(n => `${n}:${koepfe[n]}\n`).join(''), namen.join(';'), e.nutzlast].join('\n');
  return ['AWS4-HMAC-SHA256', datum, `${datum.slice(0, 8)}/${e.region}/s3/aws4_request`, hex(kanonisch)].join('\n');
}

// ── Konfiguration (nur aus der Umgebung — Instanz-fähig, nichts fest im Code) ────────────────────────────────────────

export const S3_VARIABLEN = ['MAKE_OS_MEDIEN_S3_ENDPUNKT', 'MAKE_OS_MEDIEN_S3_BUCKET', 'MAKE_OS_MEDIEN_S3_ZUGANG', 'MAKE_OS_MEDIEN_S3_GEHEIMNIS'];

/** Präfix der Instanz (`MAKE_OS_MEDIEN_PRAEFIX`, Vorgabe `m`). */
export function praefixAus(env) {
  const roh = String(env.MAKE_OS_MEDIEN_PRAEFIX ?? '').trim().toLowerCase();
  return PRAEFIX_OK.test(roh) ? roh : 'm';
}

/** Der S3-Teil der Konfiguration — `null`, wenn er fehlt oder unvollständig/ungültig ist (dann läuft der Ordner). */
export function s3KonfigAus(env) {
  const endpunkt = String(env.MAKE_OS_MEDIEN_S3_ENDPUNKT ?? '').trim().replace(/\/+$/, '');
  const bucket = String(env.MAKE_OS_MEDIEN_S3_BUCKET ?? '').trim();
  const zugang = String(env.MAKE_OS_MEDIEN_S3_ZUGANG ?? '').trim();
  const geheimnis = String(env.MAKE_OS_MEDIEN_S3_GEHEIMNIS ?? '').trim();
  if (!(endpunkt && bucket && zugang && geheimnis && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(endpunkt) && /^[a-z0-9][a-z0-9.-]{1,62}$/.test(bucket))) return null;
  // Region: ausdrücklich, sonst der erste Teil des Hosts (Hetzner: nbg1.your-objectstorage.com → nbg1). [A] am echten Bucket prüfen.
  const region = String(env.MAKE_OS_MEDIEN_S3_REGION ?? '').trim() || new URL(endpunkt).hostname.split('.')[0] || 'us-east-1';
  const stil = String(env.MAKE_OS_MEDIEN_S3_STIL ?? '').trim().toLowerCase() === 'host' ? 'host' : 'pfad';
  return { modus: 's3', endpunkt, bucket, zugang, geheimnis, region, stil, praefix: praefixAus(env) };
}

/** Steht irgendeine S3-Variable in der Umgebung (auch unvollständig)? */
export const s3Angegeben = env => S3_VARIABLEN.some(k => String(env[k] ?? '').trim());

// ── XML (Antworten des Speichers — keine Regex über den ganzen Körper) ─────────────────────────────────────────────

/** Erster Wert `<tag>…</tag>` (≤ 2.048 Zeichen), Entitäten &quot;/&amp; aufgelöst — sonst null. */
export function xmlWert(xml, tag) {
  const m = new RegExp(`<${tag}>([^<]{0,2048})</${tag}>`).exec(xml);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
}
/** Alle Blöcke `<tag>…</tag>` einer Liste — per `split` (linear). `<Upload>` trifft nie `<UploadId>`. */
export const xmlBloecke = (xml, tag) => xml.split(`<${tag}>`).slice(1).map(b => b.split(`</${tag}>`)[0]);

// ── Aufrufe ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const ZEIT_MS = 120_000;
/** Höchstens so viele Seiten je Liste (1.000 Einträge je Seite) — Schutz gegen einen Speicher, der nie „fertig“ sagt. */
const SEITEN_MAX = 10_000;

/**
 * Die gemeinsame Grundlage für App und Löschskript: signierte Aufrufe (`rufe`) und die Wege, die beide brauchen — löschen, Upload abbrechen,
 * auflisten (ListObjectsV2, seitenweise über `continuation-token`), offene Uploads (ListMultipartUploads, über `key-marker`/`upload-id-marker`).
 * Listen nur unter `<präfix>/`. `fehler(text, status, code)` baut den Fehler (App: SpeicherFehler). Fehler tragen nur Status und S3-Code.
 */
export function s3Basis(k, holen, fehler) {
  const basis = new URL(k.endpunkt);
  const host = k.stil === 'host' ? `${k.bucket}.${basis.host}` : basis.host;
  const pfadVon = objekt => {
    if (!objektOk(objekt)) throw fehler('Unzulässiger Objekt-Name.', 400);
    return k.stil === 'host' ? `/${awsKodieren(objekt, true)}` : `/${awsKodieren(k.bucket)}/${awsKodieren(objekt, true)}`;
  };
  /** Bucket-Ebene (nur die beiden Listen): Pfad-Stil `/<bucket>`, Host-Stil `/`. */
  const bucketPfad = k.stil === 'host' ? '/' : `/${awsKodieren(k.bucket)}`;
  const praefixPruefen = p => { if (!praefixOk(p)) throw fehler('Unzulässiges Präfix.', 400); };

  /** Ein signierter Aufruf; `objekt: null` = Bucket-Ebene. Antwort nur bei erwartetem Status (`ok`, Vorgabe 200), sonst Fehler. */
  async function rufe(methode, objekt, o = {}) {
    const pfad = objekt === null ? bucketPfad : pfadVon(objekt);
    const abfrage = o.abfrage ?? {};
    const koerper = o.koerper;
    const nutzlast = koerper ? createHash('sha256').update(koerper).digest('hex') : LEERER_HASH;
    const signiert = signiere({ methode, host, pfad, abfrage, kopf: o.kopf, nutzlast, zugang: k.zugang, geheimnis: k.geheimnis, region: k.region, jetzt: new Date() });
    const q = Object.keys(abfrage).sort().map(x => `${awsKodieren(x)}=${awsKodieren(abfrage[x])}`).join('&');
    const url = `${basis.protocol}//${host}${pfad}${q ? `?${q}` : ''}`;
    const ctrl = new AbortController();
    const uhr = setTimeout(() => ctrl.abort(), ZEIT_MS);
    let r;
    try {
      r = await holen(url, {
        method: methode, signal: ctrl.signal, redirect: 'error',
        headers: { ...signiert, ...(o.kopf ?? {}), ...(koerper ? { 'content-type': 'application/octet-stream' } : {}) },
        ...(koerper ? { body: new Uint8Array(koerper.buffer, koerper.byteOffset, koerper.byteLength) } : {}),
      });
    } catch (e) {
      throw fehler(`Medienspeicher nicht erreichbar (${e instanceof Error && e.name === 'AbortError' ? 'Zeitüberschreitung' : 'Netz'}).`, 503);
    } finally { clearTimeout(uhr); }
    if ((o.ok ?? [200]).includes(r.status)) return r;
    const text = await r.text().catch(() => '');
    const code = xmlWert(text, 'Code') ?? undefined;
    throw fehler(`Medienspeicher antwortet ${r.status}${code ? ` (${code})` : ''}.`, r.status >= 500 || r.status === 429 ? 503 : 502, code);
  }

  return {
    rufe,
    async loeschen(objekt) {
      await rufe('DELETE', objekt, { ok: [200, 204, 404] });
    },
    async abbrechen(objekt, upload) {
      await rufe('DELETE', objekt, { abfrage: { uploadId: upload }, ok: [200, 204, 404] });
    },
    async *auflisten(praefix) {
      praefixPruefen(praefix);
      let token = null;
      for (let seite = 0; seite < SEITEN_MAX; seite++) {
        const abfrage = { 'list-type': '2', prefix: `${praefix}/`, 'max-keys': '1000', ...(token ? { 'continuation-token': token } : {}) };
        const xml = await (await rufe('GET', null, { abfrage })).text();
        for (const b of xmlBloecke(xml, 'Contents')) {
          const objekt = xmlWert(b, 'Key');
          if (!objekt) continue;
          const bytes = Number(xmlWert(b, 'Size') ?? 0) || 0;
          yield objektOk(objekt) && objekt.startsWith(`${praefix}/`) ? { objekt, bytes } : { objekt, bytes, fremd: true };
        }
        const weiter = xmlWert(xml, 'IsTruncated') === 'true' ? xmlWert(xml, 'NextContinuationToken') : null;
        if (!weiter || weiter === token) return;
        token = weiter;
      }
      throw fehler('Medienspeicher: Liste endet nicht (zu viele Seiten).', 502);
    },
    async *offeneUploads(praefix) {
      praefixPruefen(praefix);
      let keyMarker = '', idMarker = '';
      for (let seite = 0; seite < SEITEN_MAX; seite++) {
        const abfrage = { uploads: '', prefix: `${praefix}/`, ...(keyMarker ? { 'key-marker': keyMarker } : {}), ...(idMarker ? { 'upload-id-marker': idMarker } : {}) };
        const xml = await (await rufe('GET', null, { abfrage })).text();
        for (const b of xmlBloecke(xml, 'Upload')) {
          const objekt = xmlWert(b, 'Key'), upload = xmlWert(b, 'UploadId');
          if (objekt && upload) yield { objekt, upload };
        }
        if (xmlWert(xml, 'IsTruncated') !== 'true') return;
        const nk = xmlWert(xml, 'NextKeyMarker') ?? '', ni = xmlWert(xml, 'NextUploadIdMarker') ?? '';
        if (!nk || (nk === keyMarker && ni === idMarker)) return;
        keyMarker = nk; idMarker = ni;
      }
      throw fehler('Medienspeicher: Liste endet nicht (zu viele Seiten).', 502);
    },
  };
}
