# Baseball Scoreboard Live

Versione frontend-only pronta per **GitHub Pages** e **Firebase Realtime Database**.

## Pagine

- `index.html` = overlay da usare in OBS
- `admin.html` = pannello admin da telefono o PC

## Come funziona

- nessun backend Node.js
- il browser legge e scrive direttamente su Firebase RTDB
- aggiornamento live tramite polling rapido
- supporto multi-partita, lineup, stats giocatori e battere corrente

## Database Firebase

Endpoint usato dall'app:

- `https://scoreboardbaseball-default-rtdb.europe-west1.firebasedatabase.app/scoreboard.json`

Se il database è vuoto, l’app crea automaticamente la struttura iniziale.

## Regole Firebase

Per test rapido puoi usare le regole di esempio in [firebase-rules.example.json](firebase-rules.example.json).

Poi, quando vuoi proteggere meglio il progetto, conviene passare a Firebase Auth e regole più restrittive.

## Nuove impostazioni utili

- `autoAdvanceBatters`: avanza il battitore dopo un evento plate appearance
- `autoSortRosterByNumber`: mantiene il roster in ordine lineup
- `showBatterStrip`: mostra o nasconde il box dei battitori nell'overlay
- `compactOverlay`: versione più compatta per OBS

## Battere automatico

Nell'admin trovi anche i pulsanti per:

- `Prossimo battitore`
- `1B`, `2B`, `3B`, `HR`, `BB`, `Out`

Così puoi tenere il battitore corrente sempre allineato con l'ordine di battuta.

## Pubblicazione su GitHub Pages

1. Tieni nel repo la root con:
   - `index.html`
   - `admin.html`
   - cartella `public/`
2. Attiva GitHub Pages sulla root del repository
3. Apri:
   - overlay: `https://tuo-utente.github.io/scoreboard/`
   - admin: `https://tuo-utente.github.io/scoreboard/admin.html`

## Uso su OBS

Aggiungi una **Browser Source** con l’URL della pagina `index.html` pubblicata su GitHub Pages.

Consigli:
- Width: 1920
- Height: 1080
- Shutdown source when not visible: off
- Refresh browser when scene becomes active: on

## Nota pratica

L’editor admin include un piccolo blocco UI locale, ma la vera protezione va fatta con le **Rules di Firebase** o con Firebase Auth.

Se vuoi, il prossimo passo utile è creare delle regole Firebase più sicure per consentire solo a te di scrivere dati.
