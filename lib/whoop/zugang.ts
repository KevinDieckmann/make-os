// ─── WHOOP — wer darf die Verbindung verwalten? (Server, 08.10.2026) ─────────────────────────────────────────────────────
// Status, Verbinden, Rückruf, Trennen, „Jetzt abgleichen“: NUR die Person selbst (Sitzung), im Haushalt des Inhabers — nie ein anderes
// Konto (Kevin sieht und trennt Malins WHOOP nicht und umgekehrt), nie der Dienstweg (ZOE, Takt, Skripte; 403). Keine Personen-Parameter.
export const NUR_SELBST_WHOOP = { ok: false, fehler: 'Die WHOOP-Verbindung verwaltet nur die Person selbst — angemeldet, nie über den Dienstweg.' } as const;
// Die Routen rufen `eigenePerson(req, schreibend, NUR_SELBST_WHOOP)` (lib/google/zugang.ts) direkt — so sieht der Wächter des Routen-Registers das Tor.
