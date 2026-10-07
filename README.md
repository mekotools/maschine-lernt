# Maschine lernt

Ein Browser-Werkzeug, mit dem man einer Maschine etwas beibringt: Kamera oder
Bilddateien zeigen, Klassen anlegen, Beispiele aufnehmen — und sofort sehen, wie
die Maschine urteilt.

**Kein Konto. Keine Anmeldung. Keine Übertragung.** Alles rechnet auf dem Gerät.
Die Bilder verlassen es nicht, und das Bildnetz wird mit ausgeliefert statt von
einem fremden Server geholt.

## Wie es arbeitet

1. Ein fertig trainiertes Bildnetz (MobileNet) verwandelt jedes Bild in einen
   Zahlenvektor aus 1280 Merkmalen. Es erkennt dabei nicht „Apfel" oder „Banane" —
   es beschreibt das Bild nur.
2. Ein k-Nächste-Nachbarn-Klassifikator merkt sich die Zahlenvektoren der
   aufgenommenen Beispiele.
3. Bei jedem neuen Bild sucht er die ähnlichsten gemerkten Beispiele und bildet
   daraus ein Urteil mit Balken je Klasse.

Diese drei Schritte entsprechen dem Aufbau der offenen
Teachable-Machine-Bauvorlage von Google (Apache-2.0). Der Bauapparat von 2018
war nicht mehr tragfähig; die Bausteine sind auf heutige, gepflegte Fassungen
gestellt:

- `@tensorflow/tfjs` 4.22.0
- `@tensorflow-models/mobilenet` 2.1.1
- `@tensorflow-models/knn-classifier` 1.2.6
- Baukette: Vite 8

## Selbst bauen

```bash
npm ci
npm run gewichte     # holt das Bildnetz nach public/modelle und prüft die Fingerabdrücke
npm run build        # erzeugt dist/
npm run vorschau     # zeigt dist/ lokal an
```

Für die Entwicklung: `npm run dev`.

Die Kamera gibt der Browser nur über HTTPS oder auf `localhost` heraus — sonst
bleiben nur die Bilddateien.

## Auslieferung

Das Abbild wird in zwei Stufen gebaut (siehe `Dockerfile`): in der Baustufe
werden die Netzgewichte geholt, gegen `scripts/gewichte.sha256` geprüft und die
Seite übersetzt; ausgeliefert wird ein nginx mit reinen Dateien. Es gibt keinen
Server-Prozess, keine Datenbank, keine Sitzungen.

## Herkunft

Angelegt und geschrieben von einem KI-Assistenten (Hermes Agent, Nous Research)
im Auftrag von Till L., 06.10.2026. Vorlage: die Bausteinwahl der
Teachable-Machine-Bauvorlage von Google Creative Lab (Apache-2.0); übernommen
wurde das Rezept, kein fremder Quelltext. Alle Texte, die Oberfläche und die
Sicherung der Modelle sind eigene Arbeit.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
