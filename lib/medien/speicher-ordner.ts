// ─── Medienspeicher „Ordner“ (09.10., Paket 5) — Entwicklung, Tests, und der Server, solange kein Object Storage eingerichtet ist ──
// Liegt unter `<daten>/medien` (bzw. MAKE_OS_MEDIEN_DIR) und ist von der Nachtsicherung ausgenommen (deploy/sicherung.sh) — Medien sind
// groß; ihre Sicherung ist der Object Storage (Zweitkopie = V2, Kevins Entscheidung). Nur Chiffrat (lib/medien/krypto.ts).
//   obj/<objekt>.mkm              fertige Objekte (Datei 0600, Ordner 0700)
//   teile/<upload>/<nr>.mkm       Stücke eines laufenden Uploads — beim Abschließen der Reihe nach zusammengefügt (tmp → fsync → rename)
// Grenze: `grenze` Bytes für alles zusammen — darüber lehnt der Upload ab (507), der HOI meldet ab 80 % „fast voll“.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { atomarSchreiben } from '@/lib/store/atomar.mjs';
import { objektOk, SpeicherFehler, type MedienSpeicher, type OrdnerKonfig } from './speicher';

const UPLOAD_OK = /^u-[a-f0-9]{24}$/;

export function ordnerSpeicher(k: OrdnerKonfig): MedienSpeicher {
  const basis = path.resolve(k.ordner);
  const objPfad = (o: string) => {
    if (!objektOk(o)) throw new SpeicherFehler('Unzulässiger Objekt-Name.', 400);
    const p = path.join(basis, 'obj', `${o}.mkm`);
    if (!p.startsWith(path.join(basis, 'obj') + path.sep)) throw new SpeicherFehler('Unzulässiger Objekt-Name.', 400);
    return p;
  };
  const teilOrdner = (u: string) => { if (!UPLOAD_OK.test(u)) throw new SpeicherFehler('Unzulässige Upload-Kennung.', 400); return path.join(basis, 'teile', u); };

  let belegtCache: { zeit: number; n: number } | null = null;
  async function groesse(d: string): Promise<number> {
    let n = 0;
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) n += await groesse(p);
      else if (e.isFile()) n += (await fs.stat(p).catch(() => ({ size: 0 }))).size;
    }
    return n;
  }
  const belegt = async () => {
    if (belegtCache && Date.now() - belegtCache.zeit < 30_000) return belegtCache.n;
    const n = await groesse(basis);
    belegtCache = { zeit: Date.now(), n };
    return n;
  };
  const platz = async (dazu: number) => {
    if ((await belegt()) + dazu > k.grenze) throw new SpeicherFehler('Der Medienspeicher ist voll — Object Storage einrichten (deploy/medien-speicher-verbinden.sh) oder Medien löschen.', 507, 'voll');
    belegtCache = belegtCache ? { ...belegtCache, n: belegtCache.n + dazu } : null;
  };

  return {
    modus: 'ordner',
    belegt,
    async beginnen(objekt) {
      objPfad(objekt);
      const u = `u-${randomBytes(12).toString('hex')}`;
      await fs.mkdir(teilOrdner(u), { recursive: true, mode: 0o700 });
      return u;
    },
    async teil(objekt, upload, nr, bytes) {
      objPfad(objekt);
      if (!Number.isInteger(nr) || nr < 0 || nr > 9999) throw new SpeicherFehler('Unzulässige Stück-Nummer.', 400);
      const d = teilOrdner(upload);
      await fs.access(d).catch(() => { throw new SpeicherFehler('Upload unbekannt.', 404); });
      await platz(bytes.length);
      await atomarSchreiben(path.join(d, `${nr}.mkm`), bytes);
      return `"${randomBytes(8).toString('hex')}"`;
    },
    async abschliessen(objekt, upload, teile) {
      const ziel = objPfad(objekt);
      const d = teilOrdner(upload);
      await fs.mkdir(path.dirname(ziel), { recursive: true, mode: 0o700 });
      const tmp = `${ziel}.${randomBytes(4).toString('hex')}.tmp`;
      const fh = await fs.open(tmp, 'w', 0o600);
      try {
        for (const t of [...teile].sort((a, b) => a.nr - b.nr)) {
          const b = await fs.readFile(path.join(d, `${t.nr}.mkm`)).catch(() => { throw new SpeicherFehler(`Stück ${t.nr} fehlt im Speicher.`, 409); });
          await fh.write(b);
        }
        await fh.sync();
      } catch (e) { await fh.close().catch(() => {}); await fs.unlink(tmp).catch(() => {}); throw e; }
      await fh.close();
      await fs.rename(tmp, ziel);
      await fs.rm(d, { recursive: true, force: true });
    },
    async abbrechen(_objekt, upload) {
      await fs.rm(teilOrdner(upload), { recursive: true, force: true });
      belegtCache = null;
    },
    async schreiben(objekt, bytes) {
      const p = objPfad(objekt);
      await platz(bytes.length);
      await fs.mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
      await atomarSchreiben(p, bytes);
    },
    async lesen(objekt, bereich) {
      const p = objPfad(objekt);
      let fh: import('node:fs').promises.FileHandle;
      try { fh = await fs.open(p, 'r'); } catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null; throw e; }
      try {
        if (!bereich) return await fh.readFile();
        const laenge = bereich.bis - bereich.von + 1;
        const b = Buffer.alloc(laenge);
        const { bytesRead } = await fh.read(b, 0, laenge, bereich.von);
        return b.subarray(0, bytesRead);
      } finally { await fh.close(); }
    },
    async loeschen(objekt) {
      await fs.unlink(objPfad(objekt)).catch(() => {});
      belegtCache = null;
    },
  };
}
