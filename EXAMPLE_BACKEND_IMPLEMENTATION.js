/**
 * EXAMPLE BACKEND IMPLEMENTATION
 * 
 * This is a reference implementation for the backend signaling server
 * required to make WebRTC remote video work across networks.
 * 
 * Your actual backend might be in Node.js/Express, but the logic is the same.
 * 
 * KEY PRINCIPLE:
 * When peer A sends something, route it to all OTHER peers in the room.
 * NOT back to peer A, and NOT to peers outside the room.
 */

// ============================================================
// EXAMPLE: Node.js + Socket.IO Backend
// ============================================================

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const twilio = require("twilio");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: [
      "https://google-meet-frontend-theta.vercel.app", // Your Vercel frontend
      "http://localhost:3000", // Development
    ],
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// ============================================================
// ROOM MANAGEMENT
// ============================================================

const rooms = new Map(); // meetingCode -> Set<socketId>

// ============================================================
// TURN SERVER ENDPOINT (Important for cross-network)
// ============================================================

app.get("/api/turn-servers", authenticate, (req, res) => {
  try {
    // Create Twilio token
    const token = new twilio.jwt.AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { ttl: 3600 } // Valid for 1 hour
    );

    token.addVideoGrant();

    // Get TURN servers from Twilio using the token
    const iceServers = twilio.iceServers(token.toJwt());

    res.json({
      iceServers: iceServers, // Array of TURN servers with credentials
      ttl: 3600, // Token valid for 1 hour
    });
  } catch (error) {
    console.error("[TURN] Error:", error);
    res.status(500).json({ error: "Failed to generate TURN servers" });
  }
});

// ============================================================
// SOCKET.IO CONNECTION & ROOM MANAGEMENT
// ============================================================

io.on("connection", (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // ========================================================
  // JOIN ROOM
  // ========================================================
  socket.on("join-room", ({ meetingCode, displayName }, callback) => {
    console.log(
      `[${meetingCode}] ${displayName} (${socket.id}) joining...`
    );

    try {
      // Validation
      if (!meetingCode) {
        return callback({ ok: false, error: "Meeting code required" });
      }

      // Add socket to room
      socket.join(meetingCode);

      // Track room membership
      if (!rooms.has(meetingCode)) {
        rooms.set(meetingCode, new Set());
      }
      rooms.get(meetingCode).add(socket.id);

      // Get list of users already in the room (excluding this one)
      const existingUsers = Array.from(
        io.sockets.adapter.rooms.get(meetingCode) || []
      ).filter((id) => id !== socket.id);

      console.log(
        `[${meetingCode}] Room size: ${
          rooms.get(meetingCode).size
        }, Existing users: ${existingUsers.length}`
      );

      // Step 1: Send "you joined" acknowledgment
      callback({ ok: true });

      // Step 2: Tell THIS user who's already in the room
      // They should create peer connections for each
      socket.emit("room:presence", {
        participants: existingUsers.map((id) => ({ id })),
      });

      // Step 3: Tell OTHER users in the room that someone joined
      // IMPORTANT: Use broadcast.to() to exclude the sender
      socket.broadcast.to(meetingCode).emit("user-joined", {
        userId: socket.id,
        displayName: displayName,
      });
    } catch (error) {
      console.error(`[${meetingCode}] Join error:`, error);
      callback({ ok: false, error: error.message });
    }
  });

  // ========================================================
  // OFFER (from one peer to others)
  // ========================================================
  socket.on("offer", ({ roomId, offer }) => {
    console.log(
      `[${roomId}] Offer from ${socket.id} -> broadcasting to room`
    );

    try {
      // Validate
      if (!roomId || !offer) {
        console.warn(`[${roomId}] Invalid offer data`);
        return;
      }

      // Route offer to all OTHER peers in the room
      // CRITICAL: Use broadcast.to() NOT to(). The difference:
      // - broadcast.to() = send to others in room, NOT to sender
      // - to() = send to everyone including sender
      socket.broadcast.to(roomId).emit("offer", {
        offer: offer,
        from: socket.id, // Help receiver know who this is from
      });

      console.log(`[${roomId}] Offer routed to other peers`);
    } catch (error) {
      console.error(`[${roomId}] Offer error:`, error);
    }
  });

  // ========================================================
  // ANSWER (response to offer)
  // ========================================================
  socket.on("answer", ({ roomId, answer }) => {
    console.log(
      `[${roomId}] Answer from ${socket.id} -> broadcasting to room`
    );

    try {
      // Validate
      if (!roomId || !answer) {
        console.warn(`[${roomId}] Invalid answer data`);
        return;
      }

      // Route answer to all OTHER peers in the room
      socket.broadcast.to(roomId).emit("answer", {
        answer: answer,
        from: socket.id,
      });

      console.log(`[${roomId}] Answer routed to other peers`);
    } catch (error) {
      console.error(`[${roomId}] Answer error:`, error);
    }
  });

  // ========================================================
  // ICE CANDIDATES
  // ========================================================
  socket.on("ice-candidate", ({ roomId, candidate }) => {
    if (!candidate) {
      console.log(`[${roomId}] ICE gathering complete from ${socket.id}`);
      return;
    }

    console.log(
      `[${roomId}] ICE candidate from ${socket.id} -> broadcasting`
    );

    try {
      // Route ICE candidate to all OTHER peers in the room
      socket.broadcast.to(roomId).emit("ice-candidate", {
        candidate: candidate,
        from: socket.id,
      });
    } catch (error) {
      console.error(`[${roomId}] ICE candidate error:`, error);
    }
  });

  // ========================================================
  // DISCONNECT
  // ========================================================
  socket.on("disconnect", () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);

    // Find all rooms this socket was in
    const userRooms = Array.from(socket.rooms).filter((room) =>
      rooms.has(room)
    );

    userRooms.forEach((roomId) => {
      rooms.get(roomId).delete(socket.id);

      // Notify remaining users that someone left
      socket.broadcast.to(roomId).emit("participant:left", {
        participantId: socket.id,
      });

      console.log(
        `[${roomId}] User disconnected, room size now: ${
          rooms.get(roomId).size
        }`
      );

      // Clean up empty rooms
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
        console.log(`[${roomId}] Room deleted (empty)`);
      }
    });
  });

  // ========================================================
  // ERROR HANDLING
  // ========================================================
  socket.on("error", (error) => {
    console.error(`[Socket] Error for ${socket.id}:`, error);
  });
});

// ============================================================
// HELPER: Authentication Middleware
// ============================================================

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verify token (implement your auth logic here)
  // For now, just accept any token
  next();
}

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] CORS enabled for:`);
  console.log(`  - https://google-meet-frontend-theta.vercel.app`);
  console.log(`  - http://localhost:3000`);
});

// ============================================================
// LOGGING HELPERS
// ============================================================

// Monitor room status
setInterval(() => {
  console.log("\n[Stats] Active rooms:");
  rooms.forEach((users, roomId) => {
    console.log(`  ${roomId}: ${users.size} users`);
  });
  console.log("");
}, 60000); // Every minute

// ============================================================
// KEY POINTS
// ============================================================

/**
 * 1. ALWAYS use socket.broadcast.to(roomId) to send to others
 *    - NOT socket.to(roomId) (includes sender)
 *    - NOT io.to(roomId) (global broadcast)
 *
 * 2. Room management:
 *    - socket.join(roomId) when peer joins
 *    - socket.leave(roomId) on disconnect
 *    - socket.rooms shows current rooms
 *
 * 3. Event names must match frontend:
 *    - Frontend sends: "offer", "answer", "ice-candidate", "join-room"
 *    - Backend sends: "user-joined", "offer", "answer", "ice-candidate"
 *
 * 4. Include metadata:
 *    - "from": socket.id so receiver knows who it's from
 *    - Include roomId to route correctly
 *
 * 5. Error handling:
 *    - Validate data before routing
 *    - Use try/catch for SDP operations
 *    - Log all operations for debugging
 *
 * 6. TURN server endpoint:
 *    - Fetch from Twilio / AWS / your provider
 *    - Return TURN credentials with expiry
 *    - Called by frontend before creating peer
 */
