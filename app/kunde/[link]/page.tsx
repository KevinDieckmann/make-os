// ─── Kunden-Link — öffentliche Seite (STUB aus C0; gehört Paket C2 — kommt AUSGESCHALTET) ─────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md 5.4: ohne Anmeldung nur `/kunde/kl-<24 hex>` (middleware.ts `KUNDE_SEITE`, nur GET). Das Token steht NUR im Fragment (`#t=…`)
// und erreicht den Server nie über die Adresse. Bis Paket C2 (und bis Betrieb + Inhaber den Link einschalten) zeigt die Seite nur: nicht aktiv.

import type { Metadata } from 'next';
import { seite, rahmen, karte, titel, leise } from '@/components/buchen/stil';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = { title: 'Kunden-Link', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function KundenLinkSeite() {
  return (
    <main style={seite}>
      <div style={{ ...rahmen, maxWidth: 560 }}>
        <div style={karte}>
          <h1 style={titel}>Dieser Link ist nicht aktiv.</h1>
          <p style={{ ...leise, marginTop: 12 }}>Bitte wenden Sie sich an Ihre Ansprechperson — sie schickt Ihnen bei Bedarf einen neuen Link.</p>
        </div>
      </div>
    </main>
  );
}
