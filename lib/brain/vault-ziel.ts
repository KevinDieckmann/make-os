// ─── Wohin die App ins Brain schreiben darf (29.09., B2) ─────────────────────
// Kevin 29.09. (BRAIN_SERVER_PLAN.md): Der Server-Vault ist die Wahrheit, der Mac-Vault nur eine Arbeitskopie.
// Die App schreibt deshalb NUR in einen ausdrücklich konfigurierten Vault (`MAKE_VAULT_DIR`, auf dem Server `/vault`
// aus compose.yml) — nie in einen Vault auf dem Mac (Schreibtisch, iCloud, ~/Vaults), auch nicht über einen Umweg
// (Symlink). Tests setzen `MAKE_VAULT_DIR` auf einen Temp-Ordner.
//   · App-Tagesbericht (Vorschlag in `_inbox/zoe`): braucht nur den konfigurierten Vault.
//   · `_App/`-Spiegel (direkt geschrieben): zusätzlich `MAKE_OS_APP_SPIEGEL=an` — eingeschaltet erst auf Kevins Wort
//     (Plan Schritt 3, UPDATES.md).
// Ohne Ziel wird nichts geschrieben, der Grund steht im Log.

import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export type VaultZiel = { ok: true; pfad: string } | { ok: false; grund: string };

/** Orte auf dem Mac, an denen Kevins echter Vault liegt oder liegen wird — dorthin schreibt die App nie. */
function macOrte(): string[] {
  const h = homedir();
  return [path.join(h, 'Desktop'), path.join(h, 'Library', 'Mobile Documents'), path.join(h, 'Vaults'), path.join(h, 'Documents')];
}
const echt = (p: string) => { try { return realpathSync(p); } catch { return path.resolve(p); } };
const unter = (p: string, ort: string) => p === ort || p.startsWith(ort + path.sep);

/** Der Vault, in den die App schreiben darf — oder der Grund, warum nicht. */
export function vaultZiel(opt: { spiegel?: boolean } = {}): VaultZiel {
  const roh = process.env.MAKE_VAULT_DIR?.trim();
  if (!roh) return { ok: false, grund: 'Vault-Pfad nicht konfiguriert (MAKE_VAULT_DIR) — nichts ins Brain geschrieben.' };
  const pfad = echt(roh.replace(/^~(?=$|\/)/, homedir()));
  if (roh.includes('Mobile Documents') || macOrte().some(o => unter(pfad, echt(o)) || unter(pfad, o))) {
    return { ok: false, grund: `Vault ${pfad} liegt auf dem Mac (Schreibtisch/iCloud/Vaults) — die App schreibt nur in den Server-Vault.` };
  }
  if (opt.spiegel && process.env.MAKE_OS_APP_SPIEGEL?.trim() !== 'an') return { ok: false, grund: '_App-Spiegel ist aus (MAKE_OS_APP_SPIEGEL=an schaltet ihn ein — erst auf Kevins Wort).' };
  return { ok: true, pfad };
}

/** Link in die App: mit `MAKE_OS_ADRESSE` absolut (in Obsidian klickbar), sonst der Pfad. */
export function appLink(pfad: string): string {
  const basis = (process.env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '');
  return basis ? `${basis}${pfad}` : pfad;
}
