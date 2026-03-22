const WebSocket = require('ws');
const http = require('http');
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'create_room') {
        const code = Math.random().toString(36).substr(2, 4).toUpperCase();
        rooms.set(code, { host: ws, guest: null });
        ws.roomCode = code;
        ws.isHost = true;
        ws.send(JSON.stringify({ type: 'room_created', code }));
        console.log(`Room created: ${code}`);
      } else if (msg.type === 'join_room') {
        const room = rooms.get(msg.code);
        if (room && !room.guest) {
          room.guest = ws;
          ws.roomCode = msg.code;
          ws.isHost = false;
          ws.send(JSON.stringify({ type: 'joined', code: msg.code }));
          room.host.send(JSON.stringify({ type: 'guest_joined' }));
          console.log(`Guest joined room: ${msg.code}`);
        } else {
          ws.send(JSON.stringify({ type: 'error', msg: 'Room not found or full' }));
        }
      } else {
        // Relay to other player in room
        const room = rooms.get(ws.roomCode);
        if (room) {
          const target = ws.isHost ? room.guest : room.host;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(data);
          }
        }
      }
    } catch (e) {
      console.error('Message parse error:', e.message);
    }
  });

  ws.on('close', () => {
    if (ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        const other = ws.isHost ? room.guest : room.host;
        if (other && other.readyState === WebSocket.OPEN) {
          other.send(JSON.stringify({ type: 'peer_disconnected' }));
        }
        rooms.delete(ws.roomCode);
        console.log(`Room closed: ${ws.roomCode}`);
      }
    }
  });

  ws.on('error', (e) => console.error('WS error:', e.message));
});

server.listen(3001, () => console.log('WS relay server on :3001'));
