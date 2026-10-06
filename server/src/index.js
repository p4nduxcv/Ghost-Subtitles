import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createSession, applyMessage, snapshot } from './session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const ROOM_RE = /^[a-z0-9-]{1,32}$/;
const MAX_MESSAGE_BYTES = 4096;

export function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

  // In production the server also serves the built React app.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^\/(?!ws|health).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });

  /** @type {Map<string, {session: ReturnType<typeof createSession>, clients: Set<import('ws').WebSocket>}>} */
  const rooms = new Map();

  function getRoom(name) {
    let room = rooms.get(name);
    if (!room) {
      room = { session: createSession(), clients: new Set() };
      rooms.set(name, room);
    }
    return room;
  }

  function broadcast(room, msg) {
    const data = JSON.stringify(msg);
    for (const client of room.clients) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  }

  function presence(room) {
    let controllers = 0;
    let displays = 0;
    for (const c of room.clients) {
      if (c.role === 'controller') controllers += 1;
      else displays += 1;
    }
    return { type: 'presence', controllers, displays };
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const roomParam = (url.searchParams.get('room') || 'main').toLowerCase();
    const roomName = ROOM_RE.test(roomParam) ? roomParam : 'main';
    ws.role = url.searchParams.get('role') === 'controller' ? 'controller' : 'display';
    ws.isAlive = true;

    const room = getRoom(roomName);
    room.clients.add(ws);
    ws.send(JSON.stringify(snapshot(room.session)));
    broadcast(room, presence(room));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      // Only controllers may change the shared state; displays just watch.
      if (ws.role !== 'controller') return;
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const out = applyMessage(room.session, msg);
      if (out) broadcast(room, out);
    });

    ws.on('close', () => {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        // Keep an empty room's transcript for a while so a refresh doesn't lose it.
        room.emptySince = Date.now();
      } else {
        broadcast(room, presence(room));
      }
    });
  });

  // Drop dead sockets and forget rooms that stayed empty for an hour.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
    const now = Date.now();
    for (const [name, room] of rooms) {
      if (room.clients.size === 0 && room.emptySince && now - room.emptySince > 60 * 60 * 1000) rooms.delete(name);
      if (room.clients.size > 0) room.emptySince = undefined;
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));
  server.on('close', () => wss.close());

  return server;
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const PORT = Number(process.env.PORT) || 3001;
  const server = createServer();
  server.listen(PORT, '0.0.0.0', () => {
    const prod = fs.existsSync(CLIENT_DIST) && process.env.NODE_ENV === 'production';
    const webPort = prod ? PORT : 5173;
    console.log(`\n  Ghost subtitles server on port ${PORT}`);
    console.log(`  Controller (needs mic):  http://localhost:${webPort}/`);
    for (const ip of lanAddresses()) console.log(`  Second screen on LAN:    http://${ip}:${webPort}/display`);
    console.log('');
  });
}
