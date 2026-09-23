<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

$config = require __DIR__ . '/server-config.php';
$url = (string)($config['live_telemetry_url'] ?? '');
$timeout = (float)($config['timeout_seconds'] ?? 0.9);

function fetchJsonLive($url, $timeout) {
    if ($url === '') return null;
    $body = false;
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => (int)max(250, $timeout * 1000),
            CURLOPT_TIMEOUT_MS => (int)max(500, ($timeout + 0.7) * 1000),
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'SpawnMap.ai telemetry-live/0.1',
        ]);
        $body = curl_exec($c);
        $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
        curl_close($c);
        if ($code < 200 || $code >= 300) $body = false;
    } elseif (ini_get('allow_url_fopen')) {
        $ctx = stream_context_create(['http' => [
            'method' => 'GET',
            'timeout' => max(1.0, $timeout + 0.7),
            'header' => "Accept: application/json\r\nUser-Agent: SpawnMap.ai telemetry-live/0.1\r\n",
            'ignore_errors' => true,
        ]]);
        $body = @file_get_contents($url, false, $ctx);
    }
    if (!is_string($body) || $body === '') return null;
    $d = json_decode($body, true);
    return is_array($d) ? $d : null;
}

$data = fetchJsonLive($url, $timeout);
if (is_array($data)) {
    $data['available'] = true;
    $data['source'] = $data['source'] ?? 'vps-live-telemetry';
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

// Deliberately explicit: current public collector does not yet publish a live scoreboard/death-event feed.
echo json_encode([
    'available' => false,
    'source' => null,
    'leaderboardAvailable' => false,
    'deathEventsAvailable' => false,
    'message' => 'Live player ranking and exact death events are not published by the collector yet.'
], JSON_UNESCAPED_SLASHES);
