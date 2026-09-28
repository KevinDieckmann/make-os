// ─── Anfrage-Körper begrenzt lesen (Server, 28.09.) ─────────────────────────
// Für die Upload-Routen der Ablage (CRM-Dateien, Aufgaben-Dateien): nie mehr als `max` Bytes im Speicher —
// auch ohne (oder mit falschem) Content-Length. null = zu groß (→ 413).

/** Body lesen, aber nie mehr als `max` Bytes — auch ohne (oder mit falschem) Content-Length. */
export async function begrenztLesen(req: Request, max: number): Promise<Buffer | null> {
  const angegeben = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(angegeben) && angegeben > max) return null;
  if (!req.body) return Buffer.alloc(0);
  const leser = req.body.getReader();
  const teile: Uint8Array[] = [];
  let summe = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    summe += value.byteLength;
    if (summe > max) { await leser.cancel().catch(() => {}); return null; }
    teile.push(value);
  }
  return Buffer.concat(teile);
}
