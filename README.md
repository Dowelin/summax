# SummaX

Adaptiv matematikträning för Samuel, åk 6, med acceleration mot åk 7–9.
Appen ska se ut och kännas som en välskriven mattebok: en uppgift i taget,
inga poäng, inga streaks, ingen spelvärld.

Bakgrund och beslut finns i [docs/BESLUT.md](docs/BESLUT.md).

## Läget just nu (Fas 4, prototyp)

- Fyra områden: bråk (T3.5), procent (F2.1), ekvationer (A2.1–A2.3) och omkrets och area (G2.1–G2.4).
- 18 uppgiftsmallar på nivå 1–4, var och en med fyra ledtrådar och kända felmönster.
- Exakt rättning med bråktal (`bigint`), aldrig flyttal. Rätt värde i fel form räknas inte som fel.
- Räknehäfte med räknerader som kontrolleras exakt, och matematikfältet MathLive.
- Ingen inloggning och ingen databas ännu. Nivåerna sparas bara i webbläsaren.

## Kom igång

Kräver Node 22.18 eller senare (Node kör TypeScript-testerna direkt).

```sh
npm install        # bara TypeScript
npm test           # alla tester, 10 000 varianter per mall
npm run build      # bygger dist/
npm run serve      # http://localhost:5173
```

Färre varianter vid snabb testning: `SUMMAX_VARIANTS=500 npm test`.

En bestämd uppgift kan öppnas för felsökning med `#uppgift=<mall-id>:<frö>`,
t.ex. `http://localhost:5173/#uppgift=T3.5-2-olika-namnare:7`. Lägg till `?textfalt` för att prova utan MathLive.

## Struktur

```
src/core/      exakta tal, tolkning av svar, rättning, enheter, slump
src/tasks/     uppgiftsmallar per område, figurer, felklassning
src/session.ts träningspass och (tillfällig) nivåstyrning
src/ui/        gränssnitt och matematisk typografi
tests/         enhetstester och mallarnas 10 000-variantstester
```

## Lägga till en mall

En mall definieras med `defineTemplate` och måste ha:

1. `generate` – väljer parametrar med den deterministiska slumpen.
2. `build` – uppgiftstext, svarsbeskrivning, fyra ledtrådar (den sista slutar med facit) och felmönster.
3. `verify` – facit räknat på ett *annat* sätt än i `build`.
4. `constraints` – villkor som varje variant måste uppfylla.

Lägg den i rätt lista i `src/tasks/` så körs den automatiskt genom testerna.
En mall som inte klarar dem når aldrig Samuel.
