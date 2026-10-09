// ─── Medien — AWS Signature Version 4 für S3-kompatible Speicher (09.10., Paket 5) ──────────────────────────────────────────
// Die Umsetzung liegt seit dem Nachzug (Instanz-Export/-Löschen) in lib/medien/s3-kern.mjs — dort braucht sie auch das Löschskript
// (nacktes Node, kein TS-Lader). Hier nur der gewohnte Einstieg für die App und die Tests (AWS-Beispiel „GET Object“).
export { LEERER_HASH, awsKodieren, kanonischeAbfrage, signiere, zuSignierenFuer } from './s3-kern.mjs';
export type { SignierEingabe } from './s3-kern.mjs';
