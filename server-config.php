<?php
/*
 * SpawnMap.ai TO-GPT status bridge configuration.
 *
 * Optional deployment overrides:
 *   TO_GPT_SERVER_HOST
 *   TO_GPT_SERVER_PORT         (defaults to 7777)
 *   TO_GPT_SERVER_QUERY_PORT   (defaults to game port + 1)
 *   TO_GPT_SERVER_HEALTH_URL
 *
 * Made From Chat archive mode defaults to no live server dependency.\n * A future runner can still be attached explicitly through the environment variables above.
 */
$host = getenv('TO_GPT_SERVER_HOST') ?: '';
$gamePort = (int)(getenv('TO_GPT_SERVER_PORT') ?: 7777);
$queryPortEnv = getenv('TO_GPT_SERVER_QUERY_PORT');
$queryPort = $queryPortEnv !== false && $queryPortEnv !== '' ? (int)$queryPortEnv : ($gamePort + 1);
$healthUrl = getenv('TO_GPT_SERVER_HEALTH_URL') ?: '';
$liveTelemetryUrl = getenv('TO_GPT_LIVE_TELEMETRY_URL') ?: '';

return [
    'host' => trim($host),
    'game_port' => $gamePort,
    'query_port' => $queryPort,
    'health_url' => trim($healthUrl),
    'live_telemetry_url' => trim($liveTelemetryUrl),
    'health_max_age_seconds' => 90,
    'timeout_seconds' => 0.9,
];
