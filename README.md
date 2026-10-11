# Website Binck Tuinen – handleiding

## Wat zit erin
- `index.html`, `diensten.html`, `ons-werk.html`, `over-ons.html`, `contact.html`, `privacy.html`, `bedankt.html`
- `css/style.css` (kleuren en lettertypen bovenaan in `:root`), `js/main.js`
- `api/verstuur.js`: verwerkt het contactformulier op Vercel en mailt naar Bincktuinen@gmail.com
- `img/`: logo, favicon en voorbeeldafbeeldingen
- `vercel.json`, `package.json`: instellingen voor Vercel
- `_php-alternatief/verstuur.php`: oude PHP-versie van het formulier, alleen nodig als je ooit op gewone PHP-hosting gaat. Op Vercel niet gebruiken.

## Online zetten: GitHub + Vercel

### 1. Op GitHub zetten
1. Maak een gratis account op github.com en kies **New repository** (naam bijv. `binck-tuinen`, op *Private* is prima).
2. Zet de bestanden erin. Makkelijkst: kies op de lege repo **uploading an existing file** en sleep de *inhoud* van de uitgepakte map erin (niet de map zelf; `index.html` moet bovenaan staan). Kies **Commit changes**.
   Heb je Git op je computer? Dan kan het ook: `git remote add origin <jouw-repo-url>` en `git push -u origin main` in deze map (er staat al een commit klaar).

### 2. E-mail instellen voor het formulier (Resend, gratis voor kleine aantallen)
1. Maak een account op resend.com en maak een **API key** aan.
2. Eerst testen: zonder verdere instellingen verstuurt Resend vanaf `onboarding@resend.dev`. Dat werkt alleen naar het e-mailadres waarmee je je bij Resend hebt aangemeld. Meld je dus aan met Bincktuinen@gmail.com.
3. Voor live: voeg je domein toe bij Resend (**Domains**) en zet de DNS-records die Resend toont in GoDaddy. Zo komen mails betrouwbaar aan en niet in de spam.

### 3. Op Vercel zetten
1. Maak een account op vercel.com (inloggen met GitHub is het makkelijkst) en kies **Add New > Project**.
2. Kies je repository en klik **Import**. Laat *Framework Preset* op **Other** staan en laat de overige velden leeg.
3. Voeg onder **Environment Variables** toe:
   - `RESEND_API_KEY` = je sleutel van Resend (verplicht)
   - `MAIL_FROM` = `Website Binck Tuinen <info@jouwdomein.nl>` (zodra je domein bij Resend is geverifieerd; voor testen weglaten)
   - `MAIL_TO` = alleen invullen als aanvragen naar een ander adres moeten dan Bincktuinen@gmail.com
4. Klik **Deploy**. Je krijgt een testadres zoals `binck-tuinen.vercel.app`.
5. **Test het formulier** (ook met foto) en controleer je inbox en spammap.

### 4. Je domein van GoDaddy koppelen
1. In Vercel: **Project > Settings > Domains** en voeg je domein toe (zowel `jouwdomein.nl` als `www.jouwdomein.nl`).
2. Vercel laat precies zien welke DNS-records je moet aanmaken. Zet die in GoDaddy bij **DNS** van je domein (meestal een A-record voor `@` en een CNAME voor `www`). Gebruik de waarden die Vercel toont.
3. Het kan een paar uur duren voordat het werkt. Vercel zet https er automatisch bij.

### 5. Daarna
- Vervang `JOUWDOMEIN.nl` in `sitemap.xml` en `robots.txt` door je echte domein en meld de sitemap aan bij Google Search Console.
- Elke wijziging die je naar GitHub stuurt, wordt door Vercel automatisch opnieuw gepubliceerd.

## Foto's vervangen
Vervang bestanden in `img/` door nieuwe foto's met **dezelfde bestandsnaam** (JPG):
- `hero.jpg`: wazige tuinachtergrond van de homepage (liefst 2000 px breed).
- `dienst-tuinaanleg.jpg`, `dienst-tuinrenovatie.jpg`, `dienst-tuinonderhoud.jpg`: foto's bij de diensten.
- `hovenier.jpg` (homepage) en `aan-het-werk.jpg` (Over ons).
- Fotogalerij "Ons werk": `werk-1.jpg` t/m `werk-8.jpg` (kleine versie, ~800 px breed, voor in de galerij) en `werk-1-groot.jpg` t/m `werk-8-groot.jpg` (grote versie voor als je erop klikt, ~1600 px).
- Voor/na-schuif (voorbeeldillustraties): `voor.jpg` en `na.jpg`. Vervang die door een eigen voor-en-na-foto van dezelfde tuin en pas daarna de tekst "Dit is een voorbeeld ter illustratie" in `ons-werk.html` aan.

Een foto toevoegen aan de galerij: kopieer in `ons-werk.html` een `<figure>`-blok, pas de bestandsnamen, de titel en de `alt`-tekst aan, en zet de kleine en grote versie in `img/`.

## Logo
`img/logo.png` is een transparante versie van je logo (alleen de witte logo-vormen, ongewijzigd). Het origineel staat in `img/logo-origineel.png`. De favicon is gemaakt van het plantje-met-schop-icoon.

## Teksten, sociale media en prijzen
- Alle teksten staan in de HTML-bestanden. In `over-ons.html` staat een commentaarregel waar je je persoonlijke verhaal kunt toevoegen.
- Sociale media: in de footer (op elke pagina) staat een uitgeschakeld blok; haal de commentaartekens weg en vul je links in.
- Er staan geen prijzen op de site.

## Spambeveiliging
Het formulier heeft een verborgen honeypot-veld, een minimale invultijd en een limiet van 5 aanvragen per IP per uur; foto's worden gecontroleerd op echt beeldmateriaal. Meer nodig? Maak een gratis Cloudflare Turnstile-widget, plak de widget-code in `contact.html` op de plek van de commentaarregel en zet de secret key als `TURNSTILE_SECRET` in Vercel.

## Privacy
`privacy.html` is een basisversie. Laat die controleren (en vul eventueel je KvK-nummer en adres aan) voordat je live gaat. Let op: via Resend en Vercel worden formuliergegevens verwerkt door die diensten; noem dat eventueel in de privacyverklaring.
