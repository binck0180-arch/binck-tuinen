<?php
/**
 * Binck Tuinen – verwerking van het contactformulier.
 * Verstuurt de aanvraag per e-mail naar Bincktuinen@gmail.com.
 * Vereist hosting met PHP 7.4+ en een werkende mail()-functie (standaard bij vrijwel alle Nederlandse hosters).
 */

// ===== INSTELLINGEN =====
const ONTVANGER        = 'Bincktuinen@gmail.com';
const AFZENDER_NAAM    = 'Website Binck Tuinen';
const AFZENDER_ADRES   = '';          // Leeg = automatisch noreply@jouwdomein. Zet hier bij voorkeur een adres van je eigen domein, bv. 'info@bincktuinen.nl'
const MAX_FOTO_BYTES   = 5 * 1024 * 1024;
const MAX_FOTOS        = 3;
const MAX_PER_UUR      = 5;           // maximaal aantal aanvragen per IP-adres per uur
const MIN_SECONDEN     = 4;           // sneller dan dit invullen = bot
const TURNSTILE_SECRET = '';          // Optioneel: Cloudflare Turnstile secret key (zie README)

mb_internal_encoding('UTF-8');

function antwoord(bool $ok, string $fout = '', int $code = 200): void {
    $wilJson = isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;
    if ($wilJson) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'fout' => $fout]);
    } else {
        if ($ok) { header('Location: ../bedankt.html', true, 303); }
        else { header('Content-Type: text/html; charset=utf-8'); http_response_code($code);
               echo '<!DOCTYPE html><meta charset="utf-8"><title>Er ging iets mis</title><p style="font-family:sans-serif;max-width:40rem;margin:4rem auto">'
                  . htmlspecialchars($fout, ENT_QUOTES) . ' <a href="../contact.html">Terug naar het formulier</a></p>'; }
    }
    exit;
}

function schoon(string $s, int $max): string {
    $s = str_replace(["\r", "\0"], '', $s);
    $s = trim(strip_tags($s));
    return mb_substr($s, 0, $max);
}
function eenregel(string $s, int $max): string {   // voorkomt header-injectie
    return trim(preg_replace('/[\r\n\t]+/', ' ', schoon($s, $max)));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { antwoord(false, 'Ongeldig verzoek.', 405); }

// ----- Spambeveiliging 1: honeypot -----
if (!empty($_POST['website'])) { antwoord(true); }   // doe alsof het gelukt is, bots leren er niets van

// ----- Spambeveiliging 2: invultijd -----
if (!empty($_POST['tijd']) && ctype_digit((string)$_POST['tijd'])) {
    $verstreken = (time() * 1000 - (int)$_POST['tijd']) / 1000;
    if ($verstreken < MIN_SECONDEN) { antwoord(false, 'Het formulier is te snel verstuurd. Probeer het nog eens.', 429); }
}

// ----- Spambeveiliging 3: limiet per IP -----
$ip   = $_SERVER['REMOTE_ADDR'] ?? 'onbekend';
$bestand = sys_get_temp_dir() . '/binck_rl_' . md5($ip);
$tijden = [];
if (is_file($bestand)) { $tijden = array_filter(array_map('intval', explode(',', (string)@file_get_contents($bestand))), fn($t) => $t > time() - 3600); }
if (count($tijden) >= MAX_PER_UUR) { antwoord(false, 'Je hebt te veel aanvragen verstuurd. Probeer het later opnieuw of bel ons.', 429); }

// ----- Spambeveiliging 4 (optioneel): Cloudflare Turnstile -----
if (TURNSTILE_SECRET !== '') {
    $token = $_POST['cf-turnstile-response'] ?? '';
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-type: application/x-www-form-urlencoded\r\n", 'timeout' => 8,
        'content' => http_build_query(['secret' => TURNSTILE_SECRET, 'response' => $token, 'remoteip' => $ip])]]);
    $res = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $ctx);
    $j = $res ? json_decode($res, true) : null;
    if (empty($j['success'])) { antwoord(false, 'De spamcontrole is mislukt. Ververs de pagina en probeer het opnieuw.', 400); }
}

// ----- Validatie -----
$naam     = eenregel($_POST['naam'] ?? '', 100);
$email    = eenregel($_POST['email'] ?? '', 150);
$telefoon = eenregel($_POST['telefoon'] ?? '', 30);
$dienstSleutel = $_POST['dienst'] ?? 'anders';
$diensten = ['tuinaanleg' => 'Tuinaanleg', 'tuinrenovatie' => 'Tuinrenovatie', 'tuinonderhoud' => 'Tuinonderhoud', 'anders' => 'Anders'];
$dienst   = $diensten[$dienstSleutel] ?? 'Anders';
$bericht  = schoon($_POST['bericht'] ?? '', 4000);

if (mb_strlen($naam) < 2)                          { antwoord(false, 'Vul je naam in.', 422); }
if (!filter_var($email, FILTER_VALIDATE_EMAIL))    { antwoord(false, 'Vul een geldig e-mailadres in.', 422); }
if (mb_strlen($bericht) < 10)                      { antwoord(false, 'Omschrijf kort wat je wilt laten doen.', 422); }
if (empty($_POST['privacy']))                      { antwoord(false, 'Ga akkoord met de privacyverklaring om door te gaan.', 422); }
if ($telefoon !== '' && !preg_match('/^[0-9 +().\-]{6,30}$/', $telefoon)) { antwoord(false, 'Het telefoonnummer lijkt niet te kloppen.', 422); }

// ----- Foto's -----
$bijlagen = [];
if (!empty($_FILES['fotos']['name'][0])) {
    $aantal = count($_FILES['fotos']['name']);
    if ($aantal > MAX_FOTOS) { antwoord(false, 'Voeg maximaal ' . MAX_FOTOS . " foto's toe.", 422); }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $toegestaan = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    for ($i = 0; $i < $aantal; $i++) {
        if ($_FILES['fotos']['error'][$i] === UPLOAD_ERR_NO_FILE) { continue; }
        if ($_FILES['fotos']['error'][$i] !== UPLOAD_ERR_OK || !is_uploaded_file($_FILES['fotos']['tmp_name'][$i])) { antwoord(false, 'Een foto kon niet worden geüpload (maximaal 5 MB per foto).', 422); }
        if ($_FILES['fotos']['size'][$i] > MAX_FOTO_BYTES) { antwoord(false, 'Een foto mag maximaal 5 MB groot zijn.', 422); }
        $mime = $finfo->file($_FILES['fotos']['tmp_name'][$i]);
        if (!isset($toegestaan[$mime]) || @getimagesize($_FILES['fotos']['tmp_name'][$i]) === false) { antwoord(false, "Alleen JPG-, PNG- of WebP-foto's zijn toegestaan.", 422); }
        $bijlagen[] = ['naam' => 'tuinfoto-' . ($i + 1) . '.' . $toegestaan[$mime], 'mime' => $mime, 'data' => file_get_contents($_FILES['fotos']['tmp_name'][$i])];
    }
}

// ----- Mail opbouwen -----
$host = preg_replace('/^www\./', '', preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
$van  = AFZENDER_ADRES !== '' ? AFZENDER_ADRES : 'noreply@' . $host;
$onderwerp = '=?UTF-8?B?' . base64_encode('Nieuwe aanvraag via website: ' . $dienst . ' – ' . $naam) . '?=';
$tekst = "Nieuwe aanvraag via de website van Binck Tuinen\n"
       . "------------------------------------------------\n"
       . "Naam:       $naam\nE-mail:     $email\nTelefoon:   " . ($telefoon ?: '-') . "\nDienst:     $dienst\nFoto's:     " . count($bijlagen) . " bijgevoegd\n\n"
       . "Bericht:\n$bericht\n\n------------------------------------------------\n"
       . 'Verzonden op ' . date('d-m-Y H:i') . " | IP: $ip\nAntwoorden op deze e-mail gaat rechtstreeks naar de aanvrager.\n";

$grens = 'b_' . bin2hex(random_bytes(12));
$headers  = 'From: =?UTF-8?B?' . base64_encode(AFZENDER_NAAM) . "?= <$van>\r\n";
$headers .= "Reply-To: =?UTF-8?B?" . base64_encode($naam) . "?= <$email>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
if ($bijlagen) {
    $headers .= "Content-Type: multipart/mixed; boundary=\"$grens\"\r\n";
    $body  = "--$grens\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($tekst)) . "\r\n";
    foreach ($bijlagen as $b) {
        $body .= "--$grens\r\nContent-Type: {$b['mime']}; name=\"{$b['naam']}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$b['naam']}\"\r\n\r\n" . chunk_split(base64_encode($b['data'])) . "\r\n";
    }
    $body .= "--$grens--";
} else {
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
    $body = chunk_split(base64_encode($tekst));
}

$verzonden = @mail(ONTVANGER, $onderwerp, $body, $headers, '-f' . $van);
if (!$verzonden) { $verzonden = @mail(ONTVANGER, $onderwerp, $body, $headers); }   // sommige hosters staan -f niet toe

if (!$verzonden) {
    error_log('Binck Tuinen formulier: mail() mislukt.');
    antwoord(false, 'Het versturen is niet gelukt. Probeer het later opnieuw of bel ons op 06 47 30 10 48.', 500);
}

$tijden[] = time();
@file_put_contents($bestand, implode(',', $tijden), LOCK_EX);
antwoord(true);
