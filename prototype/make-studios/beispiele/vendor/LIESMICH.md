# Gemeinsame Bibliotheken der Beispielseiten

Selbst abgelegt, damit keine Seite einen fremden Server oder ein Inline-Skript (Importmap) braucht.

| Bibliothek | Version | Quelle |
|---|---|---|
| three.js (build + GLTFLoader, DRACOLoader, BufferGeometryUtils, RoomEnvironment, Draco-Decoder gltf) | 0.180.0 | cdn.jsdelivr.net/npm/three@0.180.0 |
| Lenis | 1.3.26 | cdn.jsdelivr.net/npm/lenis@1.3.26/dist |

Einzige Änderung: In den Erweiterungen unter `three/examples/jsm/` ist `from 'three'` durch den relativen Pfad
`'../../../build/three.module.js'` ersetzt (sonst bräuchte es eine Importmap).

Einbinden aus `beispiele/<seite>/seite.js`:

```js
import * as THREE from '../vendor/three/build/three.module.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/three/examples/jsm/loaders/DRACOLoader.js';
import Lenis from '../vendor/lenis/lenis.mjs';
// Draco: new DRACOLoader().setDecoderPath('../vendor/three/examples/jsm/libs/draco/gltf/')
```
