# Fangst v0.1.0

Installasjonsfri PWA for raske notater, ideer og dagbok. Frontend publiseres med GitHub Pages. Supabase brukes til innlogging og database.

## Funksjoner

- E-post/passord-innlogging
- Privat og jobb
- Notat, ide, dagbok, observasjon, beslutning, spørsmål, oppfølging og referanse
- Metadata med komma-separerte etiketter
- Søk, samlinger og dagbok
- Lange tekster og eksterne lenker
- Lokal offline-kø for nye og endrede oppføringer
- JSON- og CSV-eksport
- Utskriftsvennlig dagbok
- Responsivt PWA-grensesnitt

## 1. Opprett Supabase-prosjekt

1. Logg inn i Supabase Dashboard og velg **New project**.
2. Velg organisasjon, prosjektnavn, et sterkt databasepassord og ønsket region.
3. Når prosjektet er klart, åpner du **SQL Editor**.
4. Åpne `supabase/schema.sql` fra denne pakken, kopier hele innholdet og kjør det.
5. Åpne `supabase/policies.sql`, kopier hele innholdet og kjør det.
6. Åpne **Authentication > Providers > Email**. E-post/passord må være aktivert.
7. For enkel første test kan du enten beholde e-postbekreftelse, eller slå den av midlertidig. Ved e-postbekreftelse må brukeren klikke lenken før innlogging.
8. Åpne **Project Settings > API**. Kopier Project URL og publishable key eller anon key. Bruk aldri service_role key i appen.

## 2. Konfigurer appen

Åpne `js/config.js` i GitHub og erstatt plassholderne:

```js
export const CONFIG = {
  SUPABASE_URL: "https://DITT_PROSJEKT.supabase.co",
  SUPABASE_ANON_KEY: "DIN_PUBLISHABLE_ELLER_ANON_KEY",
  APP_VERSION: "0.1.0"
};
```

Project URL og publishable/anon key blir synlige i nettleseren. Sikkerheten håndheves av Row Level Security-policyene. Legg aldri databasepassord eller service_role key i repositoriet.

## 3. Last opp til GitHub

1. Opprett et nytt repository, for eksempel `fangst`.
2. Pakk ut ZIP-filen.
3. Last opp alle filene og mappene i roten av repositoryet. `index.html` skal ligge i repository-roten.
4. Commit endringene.
5. Åpne **Settings > Pages**.
6. Under **Build and deployment**, velg **Deploy from a branch**.
7. Velg branch `main`, mappe `/ (root)`, og trykk **Save**.
8. Åpne adressen GitHub Pages viser når publiseringen er ferdig.

## 4. Angi Site URL i Supabase

I Supabase åpner du **Authentication > URL Configuration**.

- Sett **Site URL** til GitHub Pages-adressen til appen.
- Legg samme adresse til under **Redirect URLs**.

Dette er særlig viktig når e-postbekreftelse brukes.

## 5. Test

1. Åpne appadressen.
2. Velg **Opprett bruker**.
3. Bekreft e-post dersom dette er aktivert.
4. Logg inn.
5. Lag en privat oppføring med metadata, for eksempel `Ironman, svømming`.
6. Kontroller at den vises under Hjem, Søk og Samlinger.
7. Lag en dagbokoppføring og kontroller Dagbok-fanen og utskrift.
8. Slå av nettverket, opprett en oppføring, slå på nettverket og kontroller synkroniseringsstatus.

## Oppdatering av PWA

Ved endringer som påvirker mellomlagrede filer, oppdater `CACHE`-verdien i `service-worker.js`, for eksempel fra `fangst-v0.1.0` til `fangst-v0.1.1`. Oppdater også `APP_VERSION` i `js/config.js`.

## Begrensninger i v0.1.0

- Vedleggsopplasting er ikke aktivert ennå. Eksterne lenker kan lagres.
- Offline-køen støtter oppretting og redigering. Sletting krever nett.
- Søket skjer i de siste 1000 hentede oppføringene i nettleseren.
- Markdown lagres som ren tekst. Rendring kan legges til senere.
- Automatisk metadataforslag er ikke inkludert.

## Filer

- `index.html`: hele brukergrensesnittet
- `css/app.css`: skjermlayout
- `css/print.css`: utskrift av dagbok
- `js/app.js`: app, autentisering, data og UI
- `js/db.js`: IndexedDB-basert offline-kø
- `js/config.js`: Supabase-konfigurasjon
- `service-worker.js`: PWA-hurtigbuffer
- `manifest.webmanifest`: PWA-manifest
- `supabase/schema.sql`: tabeller, visning og databasefunksjoner
- `supabase/policies.sql`: Row Level Security

## Personvern

Privat og jobb er felt i samme database i denne versjonen. Avklar godkjent lagringssted før jobbrelatert eller virksomhetssensitiv informasjon legges i løsningen.
