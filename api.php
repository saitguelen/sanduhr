<?php
/**
 * Sanduhr – kleine JSON-API für den Verlauf.
 *
 *   GET  api.php?action=list   → letzte 10 Durchläufe
 *   POST api.php?action=add    → {"seconds": 300} speichern
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const DATA_FILE   = __DIR__ . '/data/history.json';
const MAX_ENTRIES = 50;

function respond($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function loadHistory(): array
{
    if (!is_file(DATA_FILE)) {
        return [];
    }
    $data = json_decode((string) file_get_contents(DATA_FILE), true);
    return is_array($data) ? $data : [];
}

$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'list' && $method === 'GET') {
    respond(array_slice(loadHistory(), 0, 10));
}

if ($action === 'add' && $method === 'POST') {
    $input   = json_decode((string) file_get_contents('php://input'), true);
    $seconds = isset($input['seconds']) ? (int) $input['seconds'] : 0;

    if ($seconds < 1 || $seconds > 36000) {
        respond(['error' => 'Ungültige Dauer'], 400);
    }

    $dir = dirname(DATA_FILE);
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
        respond(['error' => 'Datenordner kann nicht angelegt werden'], 500);
    }

    // Datei sperren, damit gleichzeitige Anfragen nichts überschreiben
    $fp = fopen(DATA_FILE, 'c+');
    if ($fp === false) {
        respond(['error' => 'Datei kann nicht geöffnet werden'], 500);
    }
    flock($fp, LOCK_EX);
    $list = json_decode((string) stream_get_contents($fp), true);
    if (!is_array($list)) {
        $list = [];
    }

    array_unshift($list, [
        'seconds'    => $seconds,
        'finishedAt' => date('c'),
    ]);
    $list = array_slice($list, 0, MAX_ENTRIES);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    respond(['ok' => true]);
}

respond(['error' => 'Unbekannte Aktion'], 400);
