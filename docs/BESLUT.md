# Beslut från Fas 1–4

Sammanfattning av de beslut som styr koden. Fullständiga underlag finns i
dokumenten *Fas 1: Läroplansanalys och kunskapsmatris* och *Fas 3: Design och
teknisk arkitektur* i claude.ai-projektet SummaX.

## Fas 1 – Kunskapsmatris

- Matrisen är en färdighetsgraf: 6 domäner → 28 områden → 87 färdigheter (T, A, G, S, F, P).
- Nivå 1–5 mäter **djup inom en färdighet**. Innehåll från åk 7–9 är **egna färdigheter** som låses upp när förkunskaperna är på minst nivå 3.
- Nivåer visas aldrig som E/C/A.
- Konstruktion med passare och programmering tränas utanför appen.
- Färdigheterna beskrivs matematiskt och *mappas* mot Lgr22, eftersom kursplanerna byts hösten 2028.
- Prototypens områden: T3 Bråk, F2 Procent i tillämpning, A2 Ekvationer, G2 Omkrets och area.

## Fas 2 – Samuel

- Stark i det mesta, särskilt huvudräkning; vann skolans Känguru i åk 5. Ser ofta svaret utan att visa vägen.
- Gör slarvfel när han har bråttom → appen belönar aldrig snabbhet och visar ingen klocka.
- Ogillar att misslyckas men ger inte upp → svåra uppgifter märks som svåra, ingen synlig nivåsänkning efter enstaka fel.
- Frivilligt: inga streaks eller påminnelser. Diagnosen är 10–12 minuter och går att avbryta.
- Föräldern vill bara se en översikt; "Förklara för förälder" stryks, egna pass byggs sist (Fas 7).
- Skolans Chromebook: webbapp i Chrome med egen inloggning, inte skolans Google-konto.

## Fas 3 – Design och arkitektur

- Ser ut som en mattebok: papperston, serif för uppgifter, en spalt (max ca 680 px), tekniska svartvita figurer.
- Samma drift som Emils värld: Firebase (hosting, inloggning, databas i EU) och GitHub. Testmiljö `summax-test` uppdateras automatiskt, `summax` släpps manuellt.
- All matematik körs i webbläsaren, utan AI och utan serverkod.
- Rättningen räknar exakt med bråktal. Godkänn bara det som bevisligen är rätt, underkänn bara det som bevisligen är fel.
- Varje mall testas med 10 000 varianter och oberoende facit.
- TypeScript (beslutat). Namnet SummaX (beslutat).

## Fas 4 – Prototyp, avvikelser från Fas 3

- **Byggverktyg:** Fas 3 föreslog Vite och Vitest. Prototypen byggs med bara TypeScript och Nodes inbyggda testverktyg, eftersom paketregistret inte gick att nå från utvecklingsmiljön. Det ger färre beroenden; Vite kan läggas till senare om det behövs.
- **Matematisk typografi:** Fas 3 föreslog KaTeX. Prototypen har en egen liten renderare för bråk, minustecken och variabler (`src/ui/math.ts`), vilket räcker för åk 6–9. KaTeX kan bytas in senare.
- **Nivåstyrning:** tillfälligt enkel (två säkra svar i rad höjer, två olösta i rad sänker). Den riktiga modellen – 4 rätt av 5 på minst två dagar, *osäker*, *avtagande* – kräver sparad historik och kommer med Firebase.
- Typsnitt: Source Serif 4 för uppgifter och Source Sans 3 för gränssnittet.
