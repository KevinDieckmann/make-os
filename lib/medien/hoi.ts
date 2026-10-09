// ─── Medien — Lagebild für den Head of IT (09.10., Paket 5) — nur Zahlen und Zustände, nie Namen, nie Inhalte ─────────────────────
// Befunde (lib/hoi/lage.ts hängt `medienBefunde` an):
//   Speicher „Ordner“ auf dem Server   gelb  „Medienspeicher nicht eingerichtet“ — die Medien liegen auf der Server-Platte und sind von der
//                                            Nachtsicherung ausgenommen (Plattenausfall = weg); Object Storage einrichten
//   S3 halb eingerichtet               gelb  eine Variable fehlt — es läuft der Ordner
//   belegt ≥ 80 % / ≥ 95 % der Grenze  gelb / rot  „Speicher fast voll“ — Ordner-Rückfall (Grenze MAKE_OS_MEDIEN_ORDNER_MB, Vorgabe 2 GB);
//                                            zählt Medien UND liegengebliebene Stücke (voll ist voll), Wächter tests/medien-nachzug.test.ts
//   Schlüssel mit altem Datenschlüssel gelb  vor dem Entfernen des alten Datenschlüssels erst umschlüsseln lassen (Rotation, Pflege)
//   offene Uploads älter als 1 Tag     grau  Zähler (räumt die Pflege nach 7 Tagen weg)

import type { Befund } from '@/lib/hoi/lage';

export interface MedienLage {
  modus: 'ordner' | 's3' | 'aus';
  s3Halb: boolean;
  /** Ordner: belegte Bytes und Grenze. */
  belegt?: number;
  grenze?: number;
  medien: number;
  altSchluessel: number;
  uploadsAlt: number;
}

const gb = (n: number) => `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1).replace('.', ',')} GB`;

/** Befunde aus der Lage (rein). `server` = Produktion (dort ist der Ordner nur ein Notbehelf). */
export function medienBefunde(l: MedienLage | null | undefined, server = process.env.NODE_ENV === 'production'): Befund[] {
  if (!l || l.modus === 'aus') return [];
  const b: Befund[] = [];
  const label = 'Medienspeicher';
  if (l.s3Halb) b.push({ id: 'medien-s3-halb', bereich: 'app', label, ampel: 'gelb', wert: 'Object Storage halb eingerichtet', satz: 'Eine Variable des Object Storage fehlt — es läuft der Ordner auf dem Server. deploy/medien-speicher-verbinden.sh erneut ausführen.' });
  if (l.modus === 'ordner') {
    const anteil = l.grenze ? (l.belegt ?? 0) / l.grenze : 0;
    if (anteil >= 0.8) b.push({ id: 'medien-voll', bereich: 'app', label, ampel: anteil >= 0.95 ? 'rot' : 'gelb', wert: `Speicher fast voll (${gb(l.belegt ?? 0)} von ${gb(l.grenze ?? 0)})`, satz: 'Fotos und Videos füllen den Ordner auf dem Server. Object Storage einrichten (deploy/medien-speicher-verbinden.sh, UPDATES.md 09.10.) oder Medien aus dem Papierkorb endgültig löschen.' });
    else if (server && l.medien > 0) b.push({ id: 'medien-ordner', bereich: 'app', label, ampel: 'gelb', wert: `Ordner auf dem Server (${l.medien} Medien)`, satz: 'Medienspeicher nicht eingerichtet: die Medien liegen auf der Server-Platte, außerhalb der Nachtsicherung. Object Storage einrichten (deploy/medien-speicher-verbinden.sh).' });
  }
  if (l.altSchluessel > 0) b.push({ id: 'medien-schluessel', bereich: 'sicherheit', label, ampel: 'gelb', wert: `${l.altSchluessel} Medien-Schlüssel mit altem Datenschlüssel`, satz: 'Vor dem Entfernen des alten Datenschlüssels erst umschlüsseln (Rotation) bzw. den täglichen Lauf abwarten — sonst lassen sich diese Medien nicht mehr öffnen.' });
  if (l.uploadsAlt > 0) b.push({ id: 'medien-uploads', bereich: 'app', label, ampel: 'grau', wert: `${l.uploadsAlt} unfertige Uploads`, satz: 'Liegengebliebene Uploads (App geschlossen, Netz weg) — der tägliche Lauf räumt sie nach 7 Tagen weg.' });
  return b;
}

/** Die Lage einsammeln (Server). Wirft nie — im Zweifel null. */
export async function medienLage(): Promise<MedienLage | null> {
  try {
    const { medienKonfig, s3Unvollstaendig, medienSpeicher } = await import('./speicher');
    const k = medienKonfig();
    const { ladeKatalog, haushaltsPersonen } = await import('./server');
    const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
    const { medienBestand, medienPrivatBestand } = await import('./typen');
    const { schluesselAktuell } = await import('./krypto');
    let medien = 0, altSchluessel = 0;
    for (const n of [medienBestand(await karteiHaushalt()), ...(await haushaltsPersonen()).map(medienPrivatBestand)]) {
      const kat = await ladeKatalog(n);
      medien += kat.medien.length;
      altSchluessel += kat.medien.filter(m => !schluesselAktuell(m.schluessel)).length;
    }
    const { alleSitzungen } = await import('./upload-server');
    const gestern = Date.now() - 864e5;
    const uploadsAlt = (await alleSitzungen()).filter(s => Date.parse(s.angelegt) < gestern).length;
    const l: MedienLage = { modus: k.modus, s3Halb: s3Unvollstaendig(), medien, altSchluessel, uploadsAlt };
    if (k.modus === 'ordner') { const s = await medienSpeicher(); l.belegt = s?.belegt ? await s.belegt() : 0; l.grenze = k.grenze; }
    return l;
  } catch { return null; }
}
