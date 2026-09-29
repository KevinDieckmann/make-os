// ─── Öffentliche Buchungsseite (29.09., Paket K4) ───────────────────────────
// „30 min mit Kevin“: freie Plätze wählen, Name + E-Mail (+ Firma, Anliegen), Kenntnisnahme des Datenschutzhinweises
// mit Wortlaut und Fassung. Ohne Sitzung erreichbar (middleware.ts, nur diese Adresse und ihre Status-Seite). Zeigt nur
// freie Zeiten — keine Termininhalte, keine Namen, keinen Ort (den sieht der Buchende erst nach der Freigabe auf seiner
// Status-Seite).
// S1 #21 (29.09.): Die Seite selbst ist gedrosselt (je Netz, eigenes Budget wie die Lese-Drossel der API) und liest den
// verschlüsselten Bestand nicht mehr bei jedem Aufruf zweimal (Titel/Metadaten und Seite): `merken` hält nur den Titel
// einer aktiven Seite 30 s — jede Schreibung in einen Bestand macht ihn ungültig (lib/store/memo.ts).

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Buchen } from '@/components/buchen/Buchen';
import { slugOk } from '@/lib/kalender/buchung';
import { ladeBuchungBestand } from '@/lib/kalender/buchung-speicher';
import { merken } from '@/lib/store/memo';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };

/** So viele Aufrufe der Seite je Netz und Viertelstunde frei, danach wächst die Wartezeit (wie `LESEN_FREI` der API). */
const SEITE_FREI = 40;

/** Nur der Titel einer aktiven Seite — kurz gemerkt (nie Person, Kalender, Buchungen). */
async function seiteFuer(slug: string): Promise<{ titel: string } | null> {
  if (!slugOk(slug)) return null;
  return merken(`buchen-seite:${slug}`, 30_000, async () => {
    const s = (await ladeBuchungBestand()).seiten.find(x => x.slug === slug && x.aktiv);
    return s ? { titel: s.titel } : null;
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await seiteFuer((await params).slug);
  return { title: s ? `${s.titel} · Termin buchen` : 'Termin buchen', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function BuchenSeite({ params }: Props) {
  const { slug } = await params;
  const schluessel = `buchung-seite:${netzVon(adresseAusKoepfen(await headers()))}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) {
    return (
      <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 20 }}>Gerade zu viele Aufrufe</h1>
        <p>Bitte in {Math.ceil(p.warteSek / 60)} Min. noch einmal versuchen.</p>
      </main>
    );
  }
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  if (!(await seiteFuer(slug))) notFound();
  return <Buchen slug={slug} />;
}
