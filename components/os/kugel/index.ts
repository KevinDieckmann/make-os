// MAKE OS — Kugel (05.10.2026): ein Kern für ZOE und das Brain. Import `from './kugel'` bzw. `from '../kugel'`.
export { Kugel, KUGEL_VORGABEN, KUGEL_FARBEN, useRuhig, type KugelProps } from './Kugel';
export { ZoeKugel, ZOE_KUGEL_TON, type ZoeKugelProps } from './ZoeKugel';
export { starteMotor, webglMoeglich, type Motor, type MotorOptionen, type KugelDaten, type Messung } from './motor';
export { zoeParameter, ZOE_ZUSTAND, type KugelZustand, type ZoeZustand } from './geometrie';
export { zoeWolke, ZOE_PUNKTE } from './wolke';
