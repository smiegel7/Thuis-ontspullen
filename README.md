# Thuis Ontspullen (PWA)

Een Nederlandstalige, lokale ontspullen-app voor thuis (PWA). Je kunt meerdere woningen/profielen beheren, spullen per ruimte registreren, bewaartermijnen bijhouden, foto's toevoegen en deadlines naar je agenda exporteren. Gegevens blijven op je eigen apparaat.

## Functies
- **Meerdere woningen/profielen**: bijv. thuis, kantoor, vakantiehuis of per gezinslid.
- **Ruimtes per woning**: toevoegen/verwijderen.
- **Items toevoegen, bewerken, verwijderen** met:
  - naam, ruimte, categorie, status
  - bewaartermijn in maanden
  - **exacte einddatum** (optioneel)
  - laatst gebruikt, notitie
  - **foto** (lokaal; afbeelding wordt verkleind opgeslagen)
- **Statussen**: Te beoordelen, Houden, Weggeven, Verkopen, Weggooien.
- **Zoekfunctie**: zoeken in naam, categorie, ruimte, notitie en status.
- **Sorteren**: nieuwste, naam, ruimte, status, bewaartermijn/einddatum.
- **Dubbele spullen detectie**: mogelijke duplicaten op basis van genormaliseerde naam, met overzicht en filter.
- **Automatische bewaartermijnregels per categorie**: stel per categorie een standaard aantal maanden in; de app kan dit voorstel invullen bij nieuwe items.
- **Aandacht/herinneringen**:
  - overzicht van items die aandacht nodig hebben
  - **export naar agenda (.ics)** voor alle deadlines of alleen aandachtspunten
  - per item een agenda-exportknop (als er een einddatum/bewaartermijn is)
- **Backup**: export/import als JSON.
- **PWA**: installeerbaar/offline-cache waar ondersteund.

## Privacy en opslag
- Alle gegevens worden lokaal opgeslagen in de browser (`localStorage`).
- Foto's worden client-side verkleind (JPEG) opgeslagen als data-URL. Veel of grote foto's kunnen de lokale opslaglimiet bereiken.
- Er is geen server/cloudopslag in deze versie.

## Bestanden
- `index.html` – interface
- `styles.css` – opmaak
- `app.js` – logica, opslag, migratie, .ics-export
- `manifest.webmanifest` – PWA-manifest
- `sw.js` – service worker
- `icon.svg` – app-icoon

## Gebruiken / downloaden
1. Kopieer of zip de hele projectmap om de app te downloaden/meenemen.
2. Open `index.html` voor een snelle test.
3. Aanbevolen voor PWA/service worker: start een lokale webserver in deze map.

Voorbeeld (als Python werkt):
```powershell
cd "C:\Users\AS\Documents\Default Project"
python -m http.server 8000
```
Open daarna `http://localhost:8000`.

## Agenda (.ics)
Gebruik “Exporteer deadlines (.ics)” of de knop per item. Het .ics-bestand kun je importeren in veel agenda-apps (zoals Outlook, Google Calendar, Apple Calendar), afhankelijk van je apparaat/workflow.
