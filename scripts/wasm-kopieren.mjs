#!/usr/bin/env node
// Kopiert die WebAssembly-Dateien der Bildverarbeitung aus node_modules ins
// oeffentliche Verzeichnis.
//
// Bewusst aus dem eigenen Paket statt von einem fremden Server: im Betrieb darf
// die Seite ausschliesslich eigene Adressen laden. Ohne diesen Schritt zeigt
// die Voreinstellung des Pakets auf einen fremden Ablagedienst.
//
// Nur die Fassung mit SIMD (vision_wasm_internal.*): das ist die schnelle
// Variante, die jeder heutige Browser beherrscht. Die Ausweichfassung ohne SIMD
// spart man sich, sie kostet weitere 13 MB im Abbild.
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const QUELLE = "node_modules/@mediapipe/tasks-vision/wasm";
const ZIEL = "public/mediapipe/wasm";
const DATEIEN = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];

await mkdir(ZIEL, { recursive: true });
let gesamt = 0;
for (const name of DATEIEN) {
  const von = join(QUELLE, name);
  const nach = join(ZIEL, name);
  const masse = await stat(von);
  await copyFile(von, nach);
  gesamt += masse.size;
  console.log(`  ${name}: ${(masse.size / 1024 / 1024).toFixed(2)} MB`);
}
console.log(`  Fertig: ${DATEIEN.length} Dateien, ${(gesamt / 1024 / 1024).toFixed(2)} MB in ${ZIEL}`);
