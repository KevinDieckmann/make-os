// ─── Netzadresse in der Anzeige (17.10., Abnahme 3 · C4) ────────────────────────────────────────────────────────────────────────
// Das Anmeldeprotokoll speichert die (gekürzte) Netzadresse. Konto › „Zuletzt“ zeigte sie roh („::1:…“). Lesbar: ein Zugriff vom selben
// Rechner heißt „dieses Gerät (lokal)“, ein Zugriff aus dem eigenen Netz „im lokalen Netz“, alles andere „Netz <gekürzte Adresse>“. Rein.

const LOKAL = /^(::1|127\.|::ffff:127\.|localhost)/i;
const PRIVAT = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|f[cd][0-9a-f]{2}:|fe80:)/i;

export function adresseLesbar(adresse: string | null | undefined): string {
  const a = (adresse ?? '').trim();
  if (!a || a === 'unbekannt') return 'Netz unbekannt';
  if (LOKAL.test(a)) return 'dieses Gerät (lokal)';
  if (PRIVAT.test(a)) return 'im lokalen Netz';
  return `Netz ${a}`;
}
