<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

$config = require __DIR__ . '/server-config.php';
$host = (string)($config['host'] ?? '');
$gamePort = (int)($config['game_port'] ?? 7777);
$queryPort = (int)($config['query_port'] ?? ($gamePort + 1));
$healthUrl = (string)($config['health_url'] ?? '');
$healthMaxAge = (int)($config['health_max_age_seconds'] ?? 90);
$timeout = (float)($config['timeout_seconds'] ?? 0.9);

function reply($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function fetchJson($url, $timeout) {
    if ($url === '') return null;
    $body = false;

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => (int)max(250, $timeout * 1000),
            CURLOPT_TIMEOUT_MS => (int)max(500, ($timeout + 0.7) * 1000),
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'SpawnMap.ai server-status/11.3',
        ]);
        $body = curl_exec($curl);
        $code = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($code < 200 || $code >= 300) $body = false;
    } elseif (ini_get('allow_url_fopen')) {
        $context = stream_context_create(['http' => [
            'method' => 'GET',
            'timeout' => max(1.0, $timeout + 0.7),
            'header' => "Accept: application/json\r\nUser-Agent: SpawnMap.ai server-status/11.3\r\n",
            'ignore_errors' => true,
        ]]);
        $body = @file_get_contents($url, false, $context);
    }

    if (!is_string($body) || $body === '') return null;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : null;
}

// Prefer the VPS health feed: unlike the classic GameSpy query it reports bots,
// humans, telemetry health and the exact running map artifact independently.
$health = fetchJson($healthUrl, $timeout);
if (is_array($health)) {
    $checkedAt = isset($health['checked_at']) ? (string)$health['checked_at'] : null;
    $checkedUnix = $checkedAt ? strtotime($checkedAt) : false;
    $fresh = $checkedUnix !== false && abs(time() - $checkedUnix) <= $healthMaxAge;
    $online = !empty($health['ok']) && !empty($health['game_process_alive']) && $fresh;
    $humans = isset($health['active_human_participants']) ? (int)$health['active_human_participants'] : (int)($health['human_players'] ?? 0);
    $bots = isset($health['active_bot_participants']) ? (int)$health['active_bot_participants'] : null;

    // Hossie is only reported when the health feed can identify it separately.
    // Do not guess a Hossie count from the generic bot population.
    $hossie = null;
    foreach (['active_hossie_participants','hossie_players','hossie_count'] as $key) {
        if (array_key_exists($key, $health) && is_numeric($health[$key])) {
            $hossie = (int)$health[$key];
            break;
        }
    }
    if ($hossie === null) {
        foreach (['participants','players'] as $listKey) {
            if (!empty($health[$listKey]) && is_array($health[$listKey])) {
                $count = 0;
                foreach ($health[$listKey] as $participant) {
                    if (!is_array($participant)) continue;
                    $haystack = strtolower(
                        (string)($participant['name'] ?? '') . ' ' .
                        (string)($participant['type'] ?? '') . ' ' .
                        (string)($participant['id'] ?? '')
                    );
                    if (strpos($haystack, 'hossie') !== false) $count++;
                }
                if ($count > 0) $hossie = $count;
            }
        }
    }
    $total = $bots === null ? $humans : ($humans + $bots);

    reply([
        'online' => $online,
        'configured' => true,
        'source' => 'vps-health',
        'players' => $total,
        'humans' => $humans,
        'bots' => $bots,
        'hossie' => $hossie,
        'maxPlayers' => isset($health['max_players']) ? (int)$health['max_players'] : null,
        'map' => $health['current_map'] ?? null,
        'mapSha256' => $health['map_sha256'] ?? null,
        'telemetry' => !empty($health['telemetry_collector_alive']),
        'checkedAt' => $checkedAt,
        'join' => 'unreal://' . $host . ':' . $gamePort,
        'joinAddress' => $host . ':' . $gamePort,
    ]);
}

if ($host === '') {
    reply([
        'online' => false,
        'configured' => false,
        'players' => null,
        'hossie' => null,
        'maxPlayers' => null,
        'map' => null,
    ]);
}

$errno = 0;
$errstr = '';
$socket = @stream_socket_client(
    'udp://' . $host . ':' . $queryPort,
    $errno,
    $errstr,
    $timeout,
    STREAM_CLIENT_CONNECT
);

if (!$socket) {
    reply(['online' => false, 'configured' => true, 'players' => null, 'maxPlayers' => null, 'map' => null]);
}

$sec = (int)floor($timeout);
$usec = (int)(($timeout - $sec) * 1000000);
stream_set_timeout($socket, $sec, $usec);
stream_set_blocking($socket, true);

// UE1 / UT GameSpy query protocol. The query listener is normally game port + 1.
// \info\ is enough for online state, map and player counts, and avoids the larger \status\ reply.
@fwrite($socket, "\\info\\");
$data = '';
$started = microtime(true);
while ((microtime(true) - $started) < $timeout) {
    $chunk = @fread($socket, 65535);
    if (is_string($chunk) && $chunk !== '') {
        $data .= $chunk;
        break; // \info\ is a compact single server-info response for our status needs.
    }
    $meta = stream_get_meta_data($socket);
    if (!empty($meta['timed_out'])) break;
    if ($chunk === false || $chunk === '') break;
}
fclose($socket);

if ($data === '') {
    reply(['online' => false, 'configured' => true, 'players' => null, 'maxPlayers' => null, 'map' => null]);
}

$parts = explode('\\', trim($data, "\\\0\r\n "));
$fields = [];
for ($i = 0; $i + 1 < count($parts); $i += 2) {
    if ($parts[$i] !== '') $fields[strtolower($parts[$i])] = $parts[$i + 1];
}

$players = isset($fields['numplayers']) && is_numeric($fields['numplayers']) ? (int)$fields['numplayers'] : null;
$maxPlayers = isset($fields['maxplayers']) && is_numeric($fields['maxplayers']) ? (int)$fields['maxplayers'] : null;
$map = $fields['mapname'] ?? null;

reply([
    'online' => true,
    'configured' => true,
    'source' => 'gamespy-query',
    'players' => $players,
    'humans' => $players,
    'bots' => null,
    'hossie' => null,
    'maxPlayers' => $maxPlayers,
    'map' => $map,
    'hostname' => $fields['hostname'] ?? null,
    'gameType' => $fields['gametype'] ?? null,
    'join' => 'unreal://' . $host . ':' . $gamePort,
    'joinAddress' => $host . ':' . $gamePort,
]);
