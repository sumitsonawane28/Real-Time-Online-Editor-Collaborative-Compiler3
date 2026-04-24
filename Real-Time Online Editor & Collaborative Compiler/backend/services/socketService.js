/**
 * socketService.js
 *
 * Room map structure:
 *   rooms: Map<roomId, Map<socketId, { username, permission, color }>>
 *
 * roomState: Map<roomId, { code, language, fileId }>
 *   — holds the latest code so new joiners get current state immediately
 *
 * userIndex: Map<socketId, roomId>
 *   — fast reverse lookup on disconnect
 */

const Message = require('../models/Message');
const { executeCodeStreaming } = require('./codeRunner');

// roomId → currently running execution (to prevent parallel runs per room)
const runningJobs = new Map();

const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6'];

// roomId → Map<socketId, { username, permission, color }>
const rooms = new Map();

// roomId → { code, language, fileId }
const roomState = new Map();

// socketId → roomId  (for fast disconnect lookup)
const userIndex = new Map();

function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) return [];
  return [...rooms.get(roomId).entries()].map(([socketId, data]) => ({
    socketId,
    ...data,
  }));
}

function assignColor(roomId) {
  const used = rooms.has(roomId)
    ? [...rooms.get(roomId).values()].map((u) => u.color)
    : [];
  return COLORS.find((c) => !used.includes(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`[socket] connected  ${socket.id}`);

    /* ─────────────────────────────────────────────────────────────
     * join-room
     * Payload: { roomId, username, permission? }
     * ───────────────────────────────────────────────────────────── */
    socket.on('join-room', ({ roomId, username, permission = 'edit' }) => {
      if (!roomId || !username) return;

      // Leave any previous room cleanly
      const prevRoom = userIndex.get(socket.id);
      if (prevRoom && prevRoom !== roomId) {
        _leaveRoom(socket, io, prevRoom);
      }

      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const color = assignColor(roomId);
      rooms.get(roomId).set(socket.id, { username, permission, color });
      userIndex.set(socket.id, roomId);

      // Persist on socket for disconnect
      socket.data.roomId   = roomId;
      socket.data.username = username;

      // Tell everyone (including sender) the updated user list
      io.to(roomId).emit('room-users', getRoomUsers(roomId));

      // Tell others a new user joined
      socket.to(roomId).emit('user-joined', { username, color, permission });

      // Send current code state to the new joiner only
      if (roomState.has(roomId)) {
        socket.emit('sync-state', roomState.get(roomId));
      }

      console.log(`[socket] ${username} joined room ${roomId} (${permission})`);
    });

    /* ─────────────────────────────────────────────────────────────
     * code-change
     * Payload: { roomId, code, language, fileId }
     * Only broadcast to OTHER sockets in the room (not sender).
     * ───────────────────────────────────────────────────────────── */
    socket.on('code-change', ({ roomId, code, language, fileId }) => {
      if (!roomId) return;

      // Update server-side state so late joiners get latest code
      roomState.set(roomId, { code, language, fileId });

      // Broadcast to everyone EXCEPT the sender — prevents echo loop
      socket.to(roomId).emit('code-change', { code, language, fileId });
    });

    /* ─────────────────────────────────────────────────────────────
     * language-change
     * Payload: { roomId, fileId, language }
     * ───────────────────────────────────────────────────────────── */
    socket.on('language-change', ({ roomId, fileId, language }) => {
      if (!roomId) return;

      // Update cached state language
      if (roomState.has(roomId)) {
        roomState.get(roomId).language = language;
        roomState.get(roomId).fileId   = fileId;
      } else {
        roomState.set(roomId, { code: '', language, fileId });
      }

      socket.to(roomId).emit('language-change', { fileId, language });
    });

    /* ─────────────────────────────────────────────────────────────
     * cursor-change
     * Payload: { roomId, cursor: { lineNumber, column }, username }
     * ───────────────────────────────────────────────────────────── */
    socket.on('cursor-change', ({ roomId, cursor, username }) => {
      const userData = rooms.get(roomId)?.get(socket.id);
      const color    = userData?.color || '#3b82f6';
      socket.to(roomId).emit('cursor-change', { cursor, username, socketId: socket.id, color });
    });

    /* ─────────────────────────────────────────────────────────────
     * file-created
     * Payload: { roomId, file: { id, name, language, content } }
     * Broadcast a new file to all OTHER users in the room.
     * ───────────────────────────────────────────────────────────── */
    socket.on('file-created', ({ roomId, file }) => {
      if (!roomId || !file) return;
      socket.to(roomId).emit('file-created', { file });
    });

    /* ─────────────────────────────────────────────────────────────
     * file-deleted
     * Payload: { roomId, fileId }
     * Broadcast a file deletion to all OTHER users in the room.
     * ───────────────────────────────────────────────────────────── */
    socket.on('file-deleted', ({ roomId, fileId }) => {
      if (!roomId || !fileId) return;
      socket.to(roomId).emit('file-deleted', { fileId });
    });

    /* ─────────────────────────────────────────────────────────────
     * send-message
     * Payload: { roomId, user, text, avatar }
     * ───────────────────────────────────────────────────────────── */
    socket.on('send-message', async ({ roomId, user, text, avatar }) => {
      if (!roomId || !text?.trim()) return;

      const msg = {
        id:        Date.now().toString(),
        user,
        text,
        avatar,
        timestamp: new Date().toISOString(),
      };

      // Persist to DB (non-critical)
      try { await Message.create({ roomId, user, text, avatar }); } catch {}

      // Broadcast to ALL in room (including sender so they see it confirmed)
      io.to(roomId).emit('receive-message', msg);
    });

    /* ─────────────────────────────────────────────────────────────
     * change-permission
     * Payload: { roomId, username, permission }
     * Only the room owner / any editor can call this.
     * ───────────────────────────────────────────────────────────── */
    socket.on('change-permission', ({ roomId, username, permission }) => {
      if (!rooms.has(roomId)) return;

      // Find the target socket by username
      for (const [sid, data] of rooms.get(roomId).entries()) {
        if (data.username === username) {
          rooms.get(roomId).set(sid, { ...data, permission });

          // Notify the target user
          io.to(sid).emit('permission-changed', { username, permission });
          break;
        }
      }

      // Broadcast updated user list
      io.to(roomId).emit('room-users', getRoomUsers(roomId));
    });

    /* ─────────────────────────────────────────────────────────────
     * invite-user
     * Payload: { roomId, roomName, invitedBy, targetUsername, permission }
     * Finds the target user's socket and sends them an invite event.
     * ───────────────────────────────────────────────────────────── */
    socket.on('invite-user', ({ roomId, roomName, invitedBy, targetUsername, permission }) => {
      // Search all connected sockets for the target username
      for (const [sid, rid] of userIndex.entries()) {
        const roomMap = rooms.get(rid);
        if (!roomMap) continue;
        const userData = roomMap.get(sid);
        if (userData?.username === targetUsername) {
          io.to(sid).emit('invited', { roomId, roomName, invitedBy, permission });
          return;
        }
      }
      // If not found, emit back to sender
      socket.emit('invite-error', { message: `User "${targetUsername}" is not currently online.` });
    });

    /* ─────────────────────────────────────────────────────────────
     * run-code  (streaming execution shared with entire room)
     * Payload: { roomId, code, language, triggeredBy }
     *
     * Flow:
     *  1. Emit run-start  → all room members clear their terminal
     *  2. Each output line → emit run-output to ALL room members
     *  3. Emit run-end    → all room members know execution finished
     * ───────────────────────────────────────────────────────────── */
    socket.on('run-code', async ({ roomId, code, language, triggeredBy }) => {
      if (!roomId || !code || !language) return;

      // Prevent parallel runs in the same room
      if (runningJobs.get(roomId)) {
        socket.emit('run-output', {
          roomId,
          line: '⚠ Another execution is already running in this room.',
          isError: true,
        });
        return;
      }

      runningJobs.set(roomId, true);

      // Tell ALL room members (including sender) that a run started
      io.to(roomId).emit('run-start', {
        roomId,
        language,
        triggeredBy: triggeredBy || 'unknown',
        timestamp: Date.now(),
      });

      try {
        await executeCodeStreaming(code, language, (line, isError) => {
          // Broadcast each output line to ALL room members in real-time
          io.to(roomId).emit('run-output', { roomId, line, isError });
        });
      } finally {
        runningJobs.delete(roomId);
        // Tell ALL room members execution is done
        io.to(roomId).emit('run-end', { roomId, timestamp: Date.now() });
      }
    });

    /* ─────────────────────────────────────────────────────────────
     * request-state
     * Payload: { roomId }
     * Client can explicitly ask for current room state.
     * ───────────────────────────────────────────────────────────── */
    socket.on('request-state', ({ roomId }) => {
      if (roomState.has(roomId)) {
        socket.emit('sync-state', roomState.get(roomId));
      }
    });

    /* ─────────────────────────────────────────────────────────────
     * disconnect
     * ───────────────────────────────────────────────────────────── */
    socket.on('disconnect', (reason) => {
      const roomId = userIndex.get(socket.id) || socket.data.roomId;
      if (roomId) _leaveRoom(socket, io, roomId);
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
    });
  });
};

/* ── Helper: cleanly remove a socket from a room ── */
function _leaveRoom(socket, io, roomId) {
  const roomMap = rooms.get(roomId);
  if (!roomMap) return;

  const userData = roomMap.get(socket.id);
  const username = userData?.username || socket.data.username || 'Unknown';

  roomMap.delete(socket.id);
  userIndex.delete(socket.id);
  socket.leave(roomId);

  if (roomMap.size === 0) {
    // Last person left — clean up room state
    rooms.delete(roomId);
    roomState.delete(roomId);
  } else {
    io.to(roomId).emit('room-users', getRoomUsers(roomId));
    io.to(roomId).emit('user-left', { username });
  }
}
