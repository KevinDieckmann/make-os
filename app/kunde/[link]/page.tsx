// ─── Kunden-Link — öffentliche Seite (Fulfillment C2, 10.10. — kommt AUSGESCHALTET; FULFILLMENT_KONZEPT.md 5.4) ───────────────────────────────────
// Ohne Anmeldung nur `/kunde/kl-<24 hex>` (middleware.ts `KUNDE_SEITE`, nur GET); strenge Köpfe aus next.config.mjs und Caddy (no-referrer, noindex,
// no-store, keine Rahmen, CSP ohne fremde Quellen). Das Token steht NUR im Fragment (`#t=…` bzw. `#p=…`) und erreicht den Server nie über die Adresse —
// die Seite selbst kennt kein Token und liest keine Daten des Mandats: Sind die Schalter aus (Umgebung `MAKE_OS_KUNDENLINK` oder Instanz), zeigt sie
// nur „nicht aktiv“; sonst lädt `KundenSeite` im Browser über `/api/kunde/<kl-…>` (dort Drossel, Token, dieselbe 404 für jede Fehlerart).
// Die Seite ist je Netz gedrosselt (wie die Buchungsseite). Kein Tracking, keine fremden Schriften oder Bilder.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';
import { KENNUNG } from '@/lib/fulfillment/grenzen';
import { kundenLinkSchalter } from '@/lib/fulfillment/kunde/server';
import { KundenSeite } from '@/components/os/fulfillment/kunde/KundenSeite';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = { title: 'Euer Projekt', robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** So viele Aufrufe der Seite je Netz und Viertelstunde frei, danach wächst die Wartezeit. */
const SEITE_FREI = 40;

const rahmen = { minHeight: '100vh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text, padding: '24px 16px 48px', boxSizing: 'border-box' as const };
const spalte = { maxWidth: 720, margin: '0 auto', display: 'grid', gap: 16 };

function Hinweisseite({ titel, text }: { titel: string; text: string }) {
  return (
    <main style={rahmen}>
      <div style={{ ...spalte, maxWidth: 560 }}>
        <section style={{ background: C.flaeche, borderRadius: 16, padding: 18 }}>
          <h1 style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 24, margin: 0, lineHeight: 1.2 }}>{titel}</h1>
          <p style={{ color: C.inkDim, fontSize: 15, lineHeight: 1.55, marginBottom: 0 }}>{text}</p>
        </section>
      </div>
    </main>
  );
}

export default async function KundenLinkSeite({ params }: { params: Promise<{ link: string }> }) {
  const { link } = await params;
  const schluessel = `kunde-seite:${netzVon(adresseAusKoepfen(await headers()))}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return <Hinweisseite titel="Gerade zu viele Aufrufe" text={`Bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal versuchen.`} />;
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  const aktiv = KENNUNG.kundenLink.test(link) && (await kundenLinkSchalter().catch(() => null))?.an === true;
  if (!aktiv) return <Hinweisseite titel="Dieser Link ist nicht aktiv." text="Bitte wendet euch an eure Ansprechperson — sie schickt euch bei Bedarf einen neuen Link." />;
  return (
    <main style={rahmen} className="ui-seite">
      <div style={spalte}>
        <KundenSeite linkId={link} />
      </div>
    </main>
  );
}
