# Didaktik: Maschine lernt

## Die eine Einsicht

Eine Maschine „weiß" nicht, was ein Apfel ist. Sie hat Beispiele gesehen und
vergleicht. Wer das einmal selbst gebaut hat, versteht, warum ein
Erkennungssystem auf falschen oder einseitigen Daten so zuverlässig falsch
antwortet — und warum ein Prozentwert nichts über Wahrheit sagt.

## Wie das Werkzeug arbeitet, in Laiensprache

**Erstens: beschreiben.** Ein fertig trainiertes Bildnetz (MobileNet) verwandelt
jedes Bild in eine Liste aus 1280 Zahlen — so etwas wie ein Steckbrief des
Bildes: hell oder dunkel, kantig oder rund, viel Struktur oder wenig. Es erkennt
dabei **nichts** von dem, was Sie als Klasse benennen. Es beschreibt nur.

**Zweitens: merken.** Für jedes aufgenommene Beispiel merkt sich das Werkzeug
diesen Steckbrief. Das ist die ganze „Lernphase" — es wird nichts umtrainiert,
nichts trainiert, was man nicht sofort wieder wegwerfen könnte.

**Drittens: vergleichen.** Bei einem neuen Bild sucht es die ähnlichsten
gemerkten Steckbriefe (k-Nächste-Nachbarn, kurz kNN) und zählt, zu welcher Klasse
die Mehrheit gehört. Daraus entstehen die Balken.

**Viertens: nichts herausgeben.** Alles rechnet auf dem Gerät. Die Bilder werden
nicht übertragen, es gibt kein Konto und keine Zählung. Das lässt sich im
Browser nachprüfen (Netzwerkanzeige) — eine schöne Aufgabe für ältere Klassen.

## Wo die Methode notwendig scheitert

Diese Grenzen sind keine Fehler des Werkzeugs, sondern sein Lehrinhalt:

1. **Die Welt ist nicht im Netz enthalten.** Das Bildnetz kennt nur die
   Bildarten, mit denen es einmal gefüttert wurde. Für Dinge, die es nicht
   beschreiben kann, sind zwei Bilder fast identisch — das Urteil wird beliebig.
   Erlebbar mit flächigen Farben und einfachen Formen.
2. **Die Beispiele entscheiden.** Wer einseitig sammelt, bekommt ein einseitiges
   Urteil. Das ist die Brücke zu Datenverzerrung („Bias") in echten Systemen.
3. **Der Hintergrund lernt mit.** Das Modell hat keine Ahnung, was „das Objekt"
   ist. Es vergleicht das ganze Bild. Deshalb der Test mit gewechseltem
   Hintergrund: bleibt das Urteil stabil?
4. **Ähnlichkeit ist nicht Sicherheit.** „87 %" heißt: die Mehrheit der
   ähnlichsten Beispiele gehörte zu dieser Klasse. Es heißt nicht: „die Maschine
   ist sich sicher".

## Anschlüsse im Unterricht

- **Wie Maschinen Bilder aufteilen:** im Werkzeug „Gradienten" unseres Katalogs
  (GAN Lab) und im „Transformer Explainer" weitergehen.
- **Was ein Netz überhaupt rechnet:** „CNN Explainer" im Katalog.
- **Datenschutz als Haltung:** die Netzwerkanzeige im Browser öffnen und zeigen,
  dass keine einzige Anfrage nach draußen geht. Vergleichen mit einem
  Bilderkennungsdienst, der die Bilder hochlädt.

## Für wen es gedacht ist

Ab Jahrgangsstufe 5 (mit Anleitung), selbstständig ab Jahrgangsstufe 8, und in
der Berufsschule als Einstieg in Data Literacy. Es braucht keine Vorkenntnisse
in Programmierung.
