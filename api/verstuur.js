/**
 * Binck Tuinen – verwerking van het contactformulier op Vercel (serverless functie).
 * Verstuurt de aanvraag per e-mail via Resend (https://resend.com).
 *
 * Instellen in Vercel (Project > Settings > Environment Variables):
 *   RESEND_API_KEY    (verplicht)  API-sleutel van Resend
 *   MAIL_FROM         (aanbevolen) bv. "Website Binck Tuinen <info@jouwdomein.nl>" (domein moet bij Resend geverifieerd zijn)
 *                                  Zonder deze waarde wordt "onboarding@resend.dev" gebruikt: alleen geschikt om te testen.
 *   MAIL_TO           (optioneel)  standaard Bincktuinen@gmail.com
 *   TURNSTILE_SECRET  (optioneel)  Cloudflare Turnstile secret key voor extra spambeveiliging
 */

const MAX_FOTOS = 3;
const MAX_FOTO_BYTES = 1.6 * 1024 * 1024;   // per foto, na verkleinen in de browser
const MIN_SECONDEN = 4;
const MAX_PER_UUR = 5;

const DIENSTEN = {
  tuinaanleg: 'Tuinaanleg',
  tuinrenovatie: 'Tuinrenovatie',
  tuinonderhoud: 'Tuinonderhoud',
  anders: 'Anders',
};

const hits = new Map(); // eenvoudige limiet per IP (per serverinstantie)

function schoon(s, max) {
  return String(s == null ? '' : s).replace(/\0/g, '').replace(/<[^>]*>/g, '').replace(/\r/g, '').trim().slice(0, max);
}
function eenRegel(s, max) {
  return schoon(s, max).replace(/[\r\n\t]+/g, ' ');
}
function veld(v) { return Array.isArray(v) ? v[0] : v; }

function fotoType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg' };
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png' };
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { ext: 'webp' };
  return null;
}

module.exports = async function handler(req, res) {
  const wilJson = String(req.headers.accept || '').includes('application/json');
  const antwoord = (ok, fout, code) => {
    if (wilJson) {
      res.status(code || (ok ? 200 : 400)).setHeader('Cache-Control', 'no-store');
      return res.json(ok ? { ok: true } : { ok: false, fout });
    }
    if (ok) { res.setHeader('Location', '/bedankt.html'); return res.status(303).end(); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const veilig = String(fout).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return res.status(code || 400).send('<!DOCTYPE html><meta charset="utf-8"><title>Er ging iets mis</title><p style="font-family:sans-serif;max-width:40rem;margin:4rem auto">' + veilig + ' <a href="/contact.html">Terug naar het formulier</a></p>');
  };

  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return antwoord(false, 'Ongeldig verzoek.', 405); }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  // Spambeveiliging 1: honeypot (bots leren er niets van)
  if (schoon(veld(b.website), 200)) return antwoord(true);

  // Spambeveiliging 2: invultijd
  const tijd = parseInt(veld(b.tijd), 10);
  if (tijd && (Date.now() - tijd) / 1000 < MIN_SECONDEN) return antwoord(false, 'Het formulier is te snel verstuurd. Probeer het nog eens.', 429);

  // Spambeveiliging 3: limiet per IP
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'onbekend';
  const nu = Date.now();
  const lijst = (hits.get(ip) || []).filter((t) => t > nu - 3600 * 1000);
  if (lijst.length >= MAX_PER_UUR) return antwoord(false, 'Je hebt te veel aanvragen verstuurd. Probeer het later opnieuw of bel ons.', 429);

  // Spambeveiliging 4 (optioneel): Cloudflare Turnstile
  if (process.env.TURNSTILE_SECRET) {
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: String(veld(b['cf-turnstile-response']) || ''), remoteip: ip }),
      });
      const j = await r.json();
      if (!j.success) return antwoord(false, 'De spamcontrole is mislukt. Ververs de pagina en probeer het opnieuw.', 400);
    } catch (e) { return antwoord(false, 'De spamcontrole kon niet worden uitgevoerd. Probeer het later opnieuw.', 502); }
  }

  // Validatie
  const naam = eenRegel(veld(b.naam), 100);
  const email = eenRegel(veld(b.email), 150);
  const telefoon = eenRegel(veld(b.telefoon), 30);
  const dienst = DIENSTEN[veld(b.dienst)] || 'Anders';
  const bericht = schoon(veld(b.bericht), 4000);

  if (naam.length < 2) return antwoord(false, 'Vul je naam in.', 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return antwoord(false, 'Vul een geldig e-mailadres in.', 422);
  if (bericht.length < 10) return antwoord(false, 'Omschrijf kort wat je wilt laten doen.', 422);
  if (!veld(b.privacy)) return antwoord(false, 'Ga akkoord met de privacyverklaring om door te gaan.', 422);
  if (telefoon && !/^[0-9 +().\-]{6,30}$/.test(telefoon)) return antwoord(false, 'Het telefoonnummer lijkt niet te kloppen.', 422);

  // Foto's (komen als base64 binnen, in de browser al verkleind)
  const bijlagen = [];
  const fotos = Array.isArray(b.fotos) ? b.fotos : [];
  if (fotos.length > MAX_FOTOS) return antwoord(false, "Voeg maximaal " + MAX_FOTOS + " foto's toe.", 422);
  for (let i = 0; i < fotos.length; i++) {
    const data = fotos[i] && typeof fotos[i].data === 'string' ? fotos[i].data.replace(/^data:[^,]*,/, '') : '';
    if (!data) continue;
    const buf = Buffer.from(data, 'base64');
    if (buf.length > MAX_FOTO_BYTES) return antwoord(false, 'Een foto is te groot. Kies een kleinere foto.', 422);
    const type = fotoType(buf);
    if (!type) return antwoord(false, "Alleen JPG-, PNG- of WebP-foto's zijn toegestaan.", 422);
    bijlagen.push({ filename: 'tuinfoto-' + (bijlagen.length + 1) + '.' + type.ext, content: buf.toString('base64') });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY ontbreekt in de Vercel-instellingen.');
    return antwoord(false, 'Het versturen is nog niet ingesteld. Bel ons gerust op 06 47 30 10 48.', 500);
  }

  const tekst =
    'Nieuwe aanvraag via de website van Binck Tuinen\n' +
    '------------------------------------------------\n' +
    'Naam:       ' + naam + '\n' +
    'E-mail:     ' + email + '\n' +
    'Telefoon:   ' + (telefoon || '-') + '\n' +
    'Dienst:     ' + dienst + '\n' +
    "Foto's:     " + bijlagen.length + ' bijgevoegd\n\n' +
    'Bericht:\n' + bericht + '\n\n' +
    '------------------------------------------------\n' +
    'Antwoorden op deze e-mail gaat rechtstreeks naar de aanvrager.\n';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Website Binck Tuinen <onboarding@resend.dev>',
        to: [process.env.MAIL_TO || 'Bincktuinen@gmail.com'],
        reply_to: email,
        subject: 'Nieuwe aanvraag via website: ' + dienst + ' – ' + naam,
        text: tekst,
        attachments: bijlagen.length ? bijlagen : undefined,
      }),
    });
    if (!r.ok) {
      console.error('Resend fout', r.status, await r.text());
      return antwoord(false, 'Het versturen is niet gelukt. Probeer het later opnieuw of bel ons op 06 47 30 10 48.', 502);
    }
  } catch (e) {
    console.error('Resend verzoek mislukt', e);
    return antwoord(false, 'Het versturen is niet gelukt. Probeer het later opnieuw of bel ons op 06 47 30 10 48.', 502);
  }

  lijst.push(nu); hits.set(ip, lijst);
  return antwoord(true);
};
