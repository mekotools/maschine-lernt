# Betriebsart „Haltungen"

Neben „Bilder und Dinge" gibt es die Betriebsart **Haltungen**. Dort lernt die
Maschine keine Motive, sondern Körperhaltungen. Diese Seite erklärt, was dabei
gerechnet wird, was gemessen wurde und wo die Grenzen liegen — auch die
unangenehmen.

## Was gerechnet wird

Ein zweites, fertig trainiertes Netz (MediaPipe Pose Landmarker, Fassung „lite")
sucht im Bildausschnitt **33 Körperpunkte**: Nase, Augen, Ohren, Schultern,
Ellbogen, Handgelenke, Hüften, Knie, Fußknöchel und einige Zwischenpunkte.

Zu jedem Punkt liefert es vier Zahlen: **x** und **y** (die Lage im Bild, 0 bis 1),
**z** (die Tiefe gegenüber der Hüfte) und die **Sichtbarkeit** (wie verlässlich
der Punkt ist). Das sind 33 × 4 = **132 Zahlen**. Diese 132 Zahlen sind das, was
die Maschine lernt — genau wie bei Bildern die 1280 Zahlen des Bildnetzes.

Die Punkte werden im Bild **gezeichnet**, damit jeder sehen kann, was die Maschine
gerade sieht. Blasse Punkte sind verdeckt oder außerhalb des Bildes; solche Zahlen
sind unzuverlässig, das steht auch unter dem Urteil.

## Was gemessen wurde

Gemessen am 7. Oktober 2026 mit fünf echten Aufnahmen von Personen (Original und
Spiegelbild) und drei Bildern ohne Person (Züge):

- **Breite der erkannten Punkte** (1,00 = volle Bildbreite): Personen 0,81 bis
  1,11 — Züge 0,155 bis 0,157.
- **Mittlere Sichtbarkeit**: Personen 0,48 bis 0,64 — Züge 0,82 bis 0,84.
- **Mittlere Tiefe**: Personen 0,59 bis 0,95 — Züge 0,13 bis 0,15.

Der zweite und dritte Wert sind die Überraschung: Auf Bildern **ohne** Person ist
sich das Netz seiner Sache **sicherer** als bei echten Personen. Es passt ein
flaches, senkrechtes Skelett an — anatomisch unmöglich, aber mit hoher
Sichtbarkeit.

Deshalb prüft das Werkzeug die **Breite** nach: Liegt sie unter 0,25, wird das
Bild **abgewiesen** und der Grund genannt, statt still ein erfundenes Skelett
mitzulernen. Zwischen beiden Gruppen liegt der Faktor fünf — die Prüfung ist
keine Vermutung, sondern eine Messung.

## Grenzen

- **Ohne Grafikbeschleuniger wird es zäh.** Auf dem Prüfrechner stand kein echtes
  Grafikwerk zur Verfügung; eine Haltungsrechnung dauerte dort **über fünf
  Sekunden**. Auf einem Gerät mit Grafikbeschleuniger sind es Millisekunden. Das
  Werkzeug nennt den benutzten Rechenweg in der Standzeile — dort steht „GPU"
  oder „CPU". Ohne Grafikbeschleuniger rechnet es langsamer und deutlich ruhiger
  (rund einmal je Sekunde statt zweimal).
- **Die Lage im Bild gehört mit zum Gelernten.** Wer für dieselbe Haltung einmal
  nah und einmal fern steht, liefert unterschiedliche Zahlen. Für eine tragfähige
  Klasse deshalb dieselbe Haltung mehrfach zeigen, ohne den Bildausschnitt völlig
  zu wechseln.
- **Zwei Betriebsarten, zwei Lernstände.** Die 132 Zahlen einer Haltung und die
  1280 Zahlen eines Bildes sind nicht vergleichbar. Deshalb führt jede Betriebsart
  ihren eigenen Lernstand, und eine Sicherung vermerkt ausdrücklich, zu welcher
  Betriebsart sie gehört. Beim Laden wird bei Bedarf umgeschaltet — gemischt wird
  nie.
- **Kein Personenbezug.** Es gibt keine Gesichtserkennung und keine
  Wiedererkennung. Gelernt werden Zahlen über Körperpunkte, und alles bleibt auf
  dem Gerät.

## Wo es im Unterricht passt

Die Betriebsart macht eine zweite Seite von „Lernen aus Beispielen" sichtbar:
Beim Bildnetz staunt man, wie gut ein fertiges Netz Motive ordnet. Bei den
Haltungen sieht man dem Netz bei der **Arbeit** zu — samt der Frage, wann man
seinen Ergebnissen **nicht** trauen darf. Ein Bild ohne Person, das trotzdem ein
Skelett bekommt, ist dafür ein gutes Beispiel: Ein Balken ist keine Wahrheit,
sondern eine Ähnlichkeit.
