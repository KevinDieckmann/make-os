// ─── Öffentliche Seiten — „gibt es gerade nicht“ (30.10.) ─────────────────────────────────────────────────────────
// Für /check, /buchen/<slug> und /newsletter, die auch unter der Adresse einer Website laufen (fokusinnovation.de leitet nur diese Pfade an
// die App): ist der Check bzw. die Anmeldung aus oder die Buchungsseite unbekannt, sieht der Besucher diese ruhige Seite — ohne Namen und Zeichen der
// Anwendung (sonst stünde im Tab der Titel der App). Hell wie Check und Buchung, keine Links ins Innere.

export function NichtDa({ text }: { text: string }) {
  return (
    <main style={{ minHeight: '100dvh', background: '#F6F4F0', color: '#111316', display: 'grid', placeItems: 'center', padding: '32px 16px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <p style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Diese Seite gibt es gerade nicht.</p>
        <p style={{ color: '#5F6468', margin: 0, lineHeight: 1.55 }}>{text}</p>
      </div>
    </main>
  );
}
