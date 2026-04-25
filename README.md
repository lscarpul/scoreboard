# Baseball Scoreboard Live (OBS-ready)

Web app con 2 pagine:
- **Overlay pubblica**: `/overlay` (o `/`) da usare in OBS Browser Source.
- **Pannello admin**: `/admin` per modificare il punteggio in tempo reale da qualunque dispositivo.

## Funzioni principali

- Database locale SQLite (`data/scoreboard.db`)
- Multi-partita (creazione e selezione match)
- Aggiornamento live via WebSocket (`socket.io`)
- Line score baseball 1-9 inning + `R/H/E`
- Count: balls, strikes, outs
- Gestione battitore corrente (`Away/Home`) e lato in attacco
- Roster da 9 giocatori per team con statistiche live:
   - `AB`, `H`, `2B`, `3B`, `HR`, `BB`, `SO`, `RBI`, `AVG`
- Ruoli tramite PIN:
   - `ADMIN_PIN`: admin completo (crea partite + modifica)
   - `SCORER_PIN`: può modificare score e statistiche
- Login socket con token temporaneo (evita invio del PIN a ogni update)
- Ottimizzazioni server per deploy online:
   - `helmet` (hardening HTTP headers)
   - `compression` (risposte più leggere)
   - `rate-limit` base anti abuso

## Installazione

1. Installa dipendenze:
   ```bash
   npm install
   ```

2. Imposta variabili ambiente consigliate:
   - Windows PowerShell:
     ```powershell
     $env:ADMIN_PIN="1234"
       $env:SCORER_PIN="5678"
       $env:AUTH_SECRET="una-stringa-lunga-casuale"
       $env:CORS_ORIGIN="https://tuodominio.it"
     ```

3. Avvia app:
   ```bash
   npm start
   ```

4. Apri:
   - Overlay: `http://localhost:3000/overlay`
   - Admin: `http://localhost:3000/admin`

### Overlay su match specifico

Puoi forzare una partita specifica in OBS usando:

- `http://localhost:3000/overlay?matchId=<ID_MATCH>`

## Uso su OBS

Aggiungi una **Browser Source** con URL dell'overlay, ad esempio:
- `http://IP-DEL-TUO-PC:3000/overlay`

Consigli:
- Width: 1920
- Height: 1080
- Shutdown source when not visible: off
- Refresh browser when scene becomes active: on

## Accesso da altri dispositivi

Usa l'IP locale del PC che esegue il server, ad esempio:
- Admin da telefono: `http://192.168.1.50:3000/admin`
- Overlay da OBS su altro PC: `http://192.168.1.50:3000/overlay`

## Deploy online consigliato (telefono + PC live)

Per usarlo come sito pubblico in modo stabile:

1. Metti il server dietro reverse proxy HTTPS (Nginx/Caddy/Cloudflare Tunnel)
2. Imposta dominio (es. `scoreboard.tuodominio.it`)
3. Esegui il processo in background (PM2 o servizio di sistema)
4. Fai backup periodico di `data/scoreboard.db`
5. Separa URL admin e overlay se possibile (es. subdomain dedicati)

## Evoluzioni consigliate (step successivo)

- Login utente con account veri (non solo PIN)
- Storico eventi play-by-play (singolo, doppio, HR, K, BB, ecc.)
- Dashboard statistiche partita complete stile MLB
- DB remoto (PostgreSQL) per deploy cloud multi-dispositivo
