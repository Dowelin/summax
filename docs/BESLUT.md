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
- **Matematisk inmatning:** MathLive 0.101 i stället för KaTeX (beslutat 26 okt). KaTeX ritar bara matematik som ska läsas; MathLive är ett skrivfält där "/" ger ett staplat bråk. Det laddas från jsDelivr; går det inte att ladda används ett vanligt textfält med förhandsvisning. När markören står i en ifylld nämnare eller exponent hoppar den ut vid +, −, = och ·, så att man kan skriva som på papper. Uppgiftstexterna ritas fortfarande med den egna renderaren i `src/ui/math.ts`.
- **Räknerader (beslutat 26 okt):** varje uppgift har ett räknehäfte. Ekvationer: varje rad är en ekvation som kontrolleras exakt (samma lösning som uppgiften), och svaret skrivs som x = …. Övriga områden: varje likhetstecken på en uträkningsrad kontrolleras exakt (båda sidor samma värde), och svaret skrivs på en separat svarsrad. Raderna är frivilliga. En rad som inte stämmer räknas som hjälp, inte som försök.
- **Bråkverkstad (beslutat 26 okt):** i bråkuppgifter (T3.5 nivå 1–2) arbetar Samuel direkt i bråken. Han klickar på en täljare eller nämnare, väljer · eller : och ett tal, och skriver själv resultatet. Ett bråk som bara ändrats på ena stället markeras tills han gjort samma sak med den andra delen. Bråk med samma nämnare kan slås ihop; han räknar ut den nya täljaren. Varje korrekt steg skrivs som en rad i räknehäftet. Räknefel räknas som hjälp. Reglerna finns i `src/tasks/fractionWork.ts`.
- **Nivåstyrning:** tillfälligt enkel (två säkra svar i rad höjer, två olösta i rad sänker). Den riktiga modellen – 4 rätt av 5 på minst två dagar, *osäker*, *avtagande* – kräver sparad historik och kommer med Firebase.
- **Design (26 okt):** kapitelfärger som i en lärobok, tumregister i sidans kant och rutat papper i räknehäftet. Typsnitt: Source Serif 4 för uppgifter, Source Sans 3 för gränssnittet och Kalam för bockarna i marginalen.
