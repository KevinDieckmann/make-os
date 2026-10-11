// Update-Probe: jiti (Lader der Probe) streicht „node:“ und findet das nur so erreichbare Modul `node:sqlite` dann nicht —
// diese Brücke reicht es unverändert durch (Brain-Index im Arbeitsspeicher wie auf dem Server). Nur für scripts/update-probe/kind.mjs.
module.exports = process.getBuiltinModule('node:sqlite');
