#!/usr/bin/env bash
# Holt die Gewichte des Bildnetzes ins eigene Verzeichnis.
#
# Warum ueberhaupt: laedt man das Netz ohne eigene Adresse, holt TensorFlow.js die
# Gewichte von tfhub.dev. In Schulnetzen ist das oft gesperrt — das Werkzeug waere
# dann erreichbar, aber funktionslos. Deshalb liegen die Gewichte bei der Seite.
#
# Aufruf: npm run gewichte
set -euo pipefail

QUELLE="${QUELLE:-https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2}"
ZIEL="$(cd "$(dirname "$0")/.." && pwd)/public/modelle/mobilenet"

mkdir -p "$ZIEL"
echo "Quelle: $QUELLE"
echo "Ziel:   $ZIEL"

holen() {
  local name="$1"
  local adresse="$2"
  if [ -s "$ZIEL/$name" ]; then
    echo "  vorhanden: $name"
    return
  fi
  echo "  hole:      $name"
  curl -fsSL --retry 3 --retry-delay 2 -o "$ZIEL/$name.part" "$adresse"
  mv "$ZIEL/$name.part" "$ZIEL/$name"
}

holen "model.json" "${QUELLE}/model.json?tfjs-format=file"
for n in 1 2 3 4; do
  holen "group1-shard${n}of4.bin" "${QUELLE}/group1-shard${n}of4.bin?tfjs-format=file"
done

# Fingerabdruecke pruefen: die gueltigen Werte stehen fest in scripts/gewichte.sha256.
# Weicht eine Datei ab, bricht der Bau ab — lieber kein Abbild als ein falsches.
SOLL="$(cd "$(dirname "$0")" && pwd)/gewichte.sha256"
if [ -f "$SOLL" ]; then
  echo "Pruefe Fingerabdruecke gegen $(basename "$SOLL") ..."
  (cd "$ZIEL" && sha256sum -c "$SOLL")
else
  (cd "$ZIEL" && sha256sum ./* > SHA256SUMS)
  echo "Hinweis: keine festgeschriebenen Fingerabdruecke gefunden; SHA256SUMS neu erzeugt."
fi

echo "Fertig. Gesamtgroesse:"
du -sh "$ZIEL"
