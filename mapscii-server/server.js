import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 9870;

const wss = new WebSocketServer({ port: PORT });
console.log(`MapSCII WebSocket bridge running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const lat = url.searchParams.get('lat') || '48.02';
  const lon = url.searchParams.get('lon') || '66.92';
  const zoom = url.searchParams.get('zoom') || '3';
  const cols = parseInt(url.searchParams.get('cols') || '160');
  const rows = parseInt(url.searchParams.get('rows') || '50');

  console.log(`[+] Client connected: lat=${lat} lon=${lon} zoom=${zoom} ${cols}x${rows}`);

  let proc;
  try {
    const mapsciiPath = join(__dirname, 'node_modules', '.bin', 'mapscii');
    proc = pty.spawn(mapsciiPath, [
      '--latitude', lat,
      '--longitude', lon,
      '--zoom', zoom,
    ], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: __dirname,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    console.error('[!] Failed to spawn MapSCII:', err.message);
    ws.send(`\x1b[31mError: Could not start MapSCII process.\r\n${err.message}\x1b[0m`);
    ws.close();
    return;
  }

  proc.onData((data) => {
    try {
      if (ws.readyState === 1) ws.send(data);
    } catch { /* connection lost */ }
  });

  ws.on('message', (msg) => {
    try {
      proc.write(msg.toString());
    } catch { /* process gone */ }
  });

  ws.on('close', () => {
    console.log('[-] Client disconnected');
    try { proc.kill(); } catch {}
  });

  proc.onExit(({ exitCode }) => {
    console.log(`[~] MapSCII exited with code ${exitCode}`);
    try { if (ws.readyState === 1) ws.close(); } catch {}
  });
});
