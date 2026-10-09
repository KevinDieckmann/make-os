// ─── Fixture: Aufgaben-Bestand und Aufgaben-Ablage im Format des Online-Stands (origin/main 1de19d8c, 09.10.2026) ───────────
// Gekürzt aus einem Ordner, den der ALTE Stand selbst gesät und beschrieben hat (Demo-Saat + Routen in-process: Aufgaben am
// Meilenstein über /api/tasks/create, Unteraufgaben über `parentId`, Dateien über /api/aufgaben/dateien) — nur erfundene Daten.
// Wichtig sind die Formen, die der neue Code nicht selbst schreibt: Meilenstein-Projekte `pm-<space>` (auch Mandanten-Space),
// Listen `lm-<meilenstein>-<suffix>`, Aufgaben `mtg-…` mit `listeId`, und Dateien „am Meilenstein“ (Meilenstein › Dateien) mit
// `listeId` und OHNE `aufgabeId` — auch an einem Meilenstein, der (noch) keine Aufgabe hat.
// Genutzt von tests/neustart-umzug-online.test.ts.

const t = (id: string, title: string, felder: Record<string, unknown>) => ({
  id, title, description: 'Beispiel-Aufgabe (Demo).', status: 'todo', priority: 'medium', assignee: 'lena', tags: [], subTasks: [], dependencies: [],
  sortOrder: 0, createdAt: '2026-10-09T16:23:37.842Z', updatedAt: '2026-10-09T16:23:37.842Z', spaceId: 'kdv', angelegtVon: 'lena', space: 'business',
  einheit: 'KD Ventures', verlauf: [{ am: '2026-10-09T16:23:37.842Z', von: 'lena', was: 'angelegt' }], ...felder,
});
const ms = (id: string, spaceId: string) => ({
  id, title: 'Meilensteine', description: '', category: 'business', owner: 'both', color: '#E0A84E', tags: [], archived: false, spaceId,
  createdAt: '2026-10-09T16:23:37.170Z', updatedAt: '2026-10-09T16:23:37.170Z',
});

export const ONLINE_TASKS = {
  projects: [ms('pm-kdv', 'kdv'), ms('pm-m-f-demo-lumen', 'm-f-demo-lumen')],
  tasks: [
    t('mtg-20261009162337-89bc7da7', 'Zehn Wunschkunden recherchieren', { projectId: 'pm-kdv', listeId: 'lm-ms-demo-pipeline-1vqpkws', priority: 'high', dueDate: '2026-10-12', sortOrder: 22 }),
    t('mtg-20261009162558-4b3b7591', 'Branchenliste Maschinenbau', { projectId: 'pm-kdv', listeId: 'lm-ms-demo-pipeline-1vqpkws', parentId: 'mtg-20261009162337-89bc7da7', sortOrder: 32 }),
    t('mtg-20261009162558-45525f23', 'Verbände prüfen', { projectId: 'pm-kdv', listeId: 'lm-ms-demo-pipeline-1vqpkws', parentId: 'mtg-20261009162558-4b3b7591', sortOrder: 33 }),
    t('mtg-20261009162337-193fe107', 'Beta-Funktionen festlegen', { projectId: 'pm-kdv', listeId: 'lm-ms-demo-cockpit-m6hvxf', assignee: 'jonas', angelegtVon: 'jonas', sortOrder: 25 }),
  ],
  listen: [
    { id: 'lm-ms-demo-pipeline-1vqpkws', projektId: 'pm-kdv', titel: 'Pipeline: 10 qualifizierte Gespräche', sortOrder: 20261027 },
    { id: 'lm-ms-demo-cockpit-m6hvxf', projektId: 'pm-kdv', titel: 'Cockpit 2.0 Beta fertig', sortOrder: 20261103 },
    { id: 'lm-ms-demo-rollout-tsbb93', projektId: 'pm-m-f-demo-lumen', titel: 'Rollout bei Lumen (5 Standorte)', sortOrder: 20261128 },
    { id: 'lm-ms-demo-leer-q2w3e4', projektId: 'pm-kdv', titel: 'Meilenstein ohne Aufgaben und Dateien', sortOrder: 20261218 },
  ],
  statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 3,
};

const txt = (name: string, groesse: number) => ({ name, typ: 'text/plain', groesse, verschluesselt: true });
/** Inhalt je Datei-Kennung (die Größe im Eintrag passt dazu). */
export const ONLINE_DATEI_INHALT: Record<string, string> = {
  'd-08ee5817-2f30-40cf-aba4-a64a02f56495': 'Wunschkunden:\n- Firma A\n- Firma B\n',
  'd-b1287ce6-a47f-418f-b739-c2c7b1d3588d': 'Beta-Umfang\n',
  'd-1f7ed76d-9d53-44e6-b0db-7e376c129e0c': 'Standorte 1-5\n',
  'd-5a5a5a5a-1111-4222-8333-444444444444': 'Protokoll Meilenstein-Projekt\n',
};
export const ONLINE_AUFGABEN_DATEIEN = {
  eintraege: [
    // an einer Aufgabe (Meilenstein „Pipeline“)
    { id: 'd-08ee5817-2f30-40cf-aba4-a64a02f56495', art: 'sonstig', projektId: 'pm-kdv', aufgabeId: 'mtg-20261009162337-89bc7da7', bereich: 'business', datei: txt('wunschkunden.txt', 34), hochgeladenAm: '2026-10-09T16:25:58.906Z', hochgeladenVon: 'lena' },
    // am Meilenstein „Cockpit“ (hat Aufgaben) — Liste, keine Aufgabe
    { id: 'd-b1287ce6-a47f-418f-b739-c2c7b1d3588d', art: 'sonstig', projektId: 'pm-kdv', listeId: 'lm-ms-demo-cockpit-m6hvxf', bereich: 'business', datei: txt('beta-scope.txt', 12), hochgeladenAm: '2026-10-09T16:36:38.176Z', hochgeladenVon: 'lena' },
    // am Meilenstein „Rollout“ (Mandanten-Space, KEINE Aufgabe) — Liste, keine Aufgabe
    { id: 'd-1f7ed76d-9d53-44e6-b0db-7e376c129e0c', art: 'sonstig', projektId: 'pm-m-f-demo-lumen', listeId: 'lm-ms-demo-rollout-tsbb93', bereich: 'business', datei: txt('rollout-plan.txt', 14), hochgeladenAm: '2026-10-09T16:36:38.131Z', hochgeladenVon: 'lena' },
    // am Projekt „Meilensteine“ selbst (Projektseite › Dateien)
    { id: 'd-5a5a5a5a-1111-4222-8333-444444444444', art: 'sonstig', projektId: 'pm-kdv', bereich: 'business', datei: txt('protokoll.txt', 30), hochgeladenAm: '2026-10-09T16:40:00.000Z', hochgeladenVon: 'jonas' },
  ],
};
