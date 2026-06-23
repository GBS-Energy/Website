<?php
declare(strict_types=1);

// IONOS-compatible contact form handler.
// Adjust recipient/sender to your domain mailboxes.
const GBS_CONTACT_RECIPIENT = 'kontakt@gbsenergy.de';
const GBS_SPEICHERINVEST_RECIPIENT = 'speicher@gbsag.com';
const GBS_CONTACT_SENDER = 'noreply@gbsag.com';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Method not allowed.';
    exit;
}

$posted = static function (string $key): string {
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }
    return trim($value);
};

$respond = static function (int $status, bool $ok, string $message): void {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $isJson = stripos($accept, 'application/json') !== false || (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest');
    if ($isJson) {
        header('Content-Type: application/json; charset=UTF-8');
        http_response_code($status);
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/plain; charset=UTF-8');
    http_response_code($status);
    echo $message;
    exit;
};

// Honeypot: pretend success for bots.
if ($posted('company') !== '') {
    $respond(200, true, 'Vielen Dank. Ihre Anfrage wurde gesendet.');
}

$topic = $posted('topic');
$name = $posted('name');
$email = $posted('email');
$phone = $posted('phone');
$location = $posted('location');
$trafo = $posted('trafo');
$area = $posted('area');
$flurstueck = $posted('flurstueck');
$gemarkung = $posted('gemarkung');
$dimensions = $posted('dimensions');
$message = $posted('message');
$authorityConsent = $posted('authority_consent_request');
$consent = $posted('consent');
$subject = $posted('subject');
$bodyFromClient = $posted('body');
$formType = $posted('form_type');

if ($formType === 'speicherinvest') {
    $firstName = $posted('first_name');
    $lastName = $posted('last_name');
    $address = $posted('address');
    $investMessage = $posted('message');

    if ($firstName === '' || $lastName === '' || $phone === '' || $email === '' || $address === '' || $consent === '') {
        $respond(400, false, 'Bitte füllen Sie alle Pflichtfelder vollständig aus.');
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $respond(400, false, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    }

    $cleanHeaderValue = static function (string $value): string {
        return trim(str_replace(["\r", "\n"], ' ', $value));
    };

    $safeSubject = $subject !== '' ? $subject : ('Speicherinvest-Anfrage - ' . $firstName . ' ' . $lastName);
    $safeSubject = $cleanHeaderValue($safeSubject);
    if ($safeSubject === '') {
        $safeSubject = 'Speicherinvest-Anfrage';
    }

    $lines = [];
    $lines[] = 'Speicherinvest-Anfrage über Website';
    $lines[] = '---------------------------------';
    $lines[] = 'Name: ' . $lastName;
    $lines[] = 'Vorname: ' . $firstName;
    $lines[] = 'Telefon: ' . $phone;
    $lines[] = 'E-Mail: ' . $email;
    $lines[] = 'Komplette Adresse: ' . $address;
    $lines[] = '';
    $lines[] = 'Nachricht:';
    $lines[] = $investMessage !== '' ? $investMessage : '-';
    $lines[] = '';
    $lines[] = 'DSGVO-Einwilligung: Ja';
    $lines[] = '---';
    $lines[] = 'Absender-IP: ' . ($_SERVER['REMOTE_ADDR'] ?? '-');
    $lines[] = 'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? '-');

    $mailBody = implode("\n", $lines);

    $encodedSubject = '=?UTF-8?B?' . base64_encode($safeSubject) . '?=';
    $sender = $cleanHeaderValue(GBS_CONTACT_SENDER);
    $replyTo = $cleanHeaderValue($email);

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'From: GBS Energy GmbH <' . $sender . '>';
    $headers[] = 'Reply-To: ' . $replyTo;
    $headers[] = 'X-Mailer: PHP/' . phpversion();

    $ok = @mail(GBS_SPEICHERINVEST_RECIPIENT, $encodedSubject, $mailBody, implode("\r\n", $headers), '-f ' . $sender);
    if (!$ok) {
        $respond(500, false, 'Ihre Anfrage konnte aktuell nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an speicher@gbsag.com.');
    }

    $respond(200, true, 'Vielen Dank. Ihre Anfrage wurde gesendet.');
}

if ($topic === '' || $name === '' || $email === '' || $location === '' || $message === '' || $consent === '') {
    $respond(400, false, 'Bitte füllen Sie alle Pflichtfelder aus.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $respond(400, false, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
}

$cleanHeaderValue = static function (string $value): string {
    return trim(str_replace(["\r", "\n"], ' ', $value));
};

$safeSubject = $subject !== '' ? $subject : ('Website-Anfrage - ' . $topic);
$safeSubject = $cleanHeaderValue($safeSubject);
if ($safeSubject === '') {
    $safeSubject = 'Website-Anfrage';
}

$lines = [];
$lines[] = 'Anfrage über Website';
$lines[] = '---------------------';
$lines[] = 'Anliegen: ' . $topic;
$lines[] = 'Name: ' . $name;
$lines[] = 'E-Mail: ' . $email;
$lines[] = 'Telefon: ' . ($phone !== '' ? $phone : '-');
$lines[] = 'PLZ/Ort: ' . $location;
$lines[] = 'Trafo/Netzpunkt: ' . ($trafo !== '' ? $trafo : '-');
$lines[] = 'Fläche: ' . ($area !== '' ? $area : '-');
$lines[] = 'Flurstück-Nr.: ' . ($flurstueck !== '' ? $flurstueck : '-');
$lines[] = 'Gemarkung: ' . ($gemarkung !== '' ? $gemarkung : '-');
$lines[] = 'Maße: ' . ($dimensions !== '' ? $dimensions : '-');
$lines[] = 'Vollmacht/Einwilligungsformular angefordert: ' . ($authorityConsent !== '' ? 'Ja' : 'Nein');
$lines[] = '';
$lines[] = 'Nachricht:';
$lines[] = $message;
$lines[] = '';
$lines[] = '---';
$lines[] = 'Absender-IP: ' . ($_SERVER['REMOTE_ADDR'] ?? '-');
$lines[] = 'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? '-');

if ($bodyFromClient !== '') {
    $lines[] = '';
    $lines[] = '---';
    $lines[] = 'Client-Zusammenfassung:';
    $lines[] = $bodyFromClient;
}

$mailBody = implode("\n", $lines);

$encodedSubject = '=?UTF-8?B?' . base64_encode($safeSubject) . '?=';
$sender = $cleanHeaderValue(GBS_CONTACT_SENDER);
$replyTo = $cleanHeaderValue($email);

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headers[] = 'From: GBS Energy GmbH <' . $sender . '>';
$headers[] = 'Reply-To: ' . $replyTo;
$headers[] = 'X-Mailer: PHP/' . phpversion();

$ok = @mail(GBS_CONTACT_RECIPIENT, $encodedSubject, $mailBody, implode("\r\n", $headers), '-f ' . $sender);
if (!$ok) {
    $respond(500, false, 'Ihre Anfrage konnte aktuell nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an kontakt@gbsenergy.de.');
}

$respond(200, true, 'Vielen Dank. Ihre Anfrage wurde gesendet.');
