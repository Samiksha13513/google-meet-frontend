# Backend WebRTC Signaling Integration Guide

This document specifies what the backend MUST do for WebRTC remote video to work.

## Socket.IO Event Flow

### Scenario: Peer A and Peer B join meeting

```
PEER A                          BACKEND                         PEER B
   |                              |                               |
   |-------- join-room ---------->|                               |
   |                              |---- user-joined ----->|       |
   |                              |                       |       |
   |<-------- user-joined --------|                       |       |
   |  (from other users already   |                       |       |
   |   in room, if any)           |                       |       |
   |                              |                    (creates   |
   |                              |                     offer)    |
   |                              |                       |       |
   |                              |<----- offer ---------|       |
   |                    (routes to |                       |       |
   |                     peer A)   |                       |       |
   |  (creates answer)             |                       |       |
   |       |                       |                       |       |
   |-------- answer ------------->|-------- answer ----->|       |
   |                              |                       |       |
   |-------- ice-candidate ------>|--- ice-candidate --->|       |
   |       (many)                 |       (routed)        |       |
   |                              |                       |       |
   |<----- ice-candidate ---------|<-- ice-candidate ----|       |
   |       (from Peer B)          |       (routed)        |       |
   |                              |                       |       |
   | (ICE negotiation complete, connection established) |
   |                              |                       |       |
   |<==== WebRTC media stream ============================>|     |
   |   (audio/video flows peer-to-peer)                  |       |
```

## Required Backend Implementation

### 1. Socket.IO Rooms & Broadcasting

```javascript
// CORRECT: Use socket.io rooms
io.on("connection", (socket) => {
  socket.on("join-room", ({ meetingCode, displayName }) => {
    // Step 1: Join the room
    socket.join(meetingCode);
    
    // Step 2: Notify OTHER users in the room that a new user joined
    // IMPORTANT: Do NOT send to the joining user themselves
    socket.broadcast.to(meetingCode).emit("user-joined", {
      userId: socket.id,
      displayName: displayName,
    });
    
    // Step 3: Send the joining user list of current participants
    // (Optional: helps with participant list UI)
    const clients = io.sockets.adapter.rooms.get(meetingCode);
    socket.emit("room:presence", {
      participants: Array.from(clients || []).map(id => ({
        id,
        displayName: "User"
      }))
    });
  });

  socket.on("offer", ({ meetingCode, offer }) => {
    // Route offer to all OTHER peers in the room
    socket.broadcast.to(meetingCode).emit("offer", {
      offer,
      from: socket.id,
    });
  });

  socket.on("answer", ({ meetingCode, answer }) => {
    // Route answer to all OTHER peers in the room
    socket.broadcast.to(meetingCode).emit("answer", {
      answer,
      from: socket.id,
    });
  });

  socket.on("ice-candidate", ({ meetingCode, candidate }) => {
    // Route ICE candidate to all OTHER peers
    socket.broadcast.to(meetingCode).emit("ice-candidate", {
      candidate,
      from: socket.id,
    });
  });

  socket.on("disconnect", () => {
    // Get all rooms this socket was in
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      // Notify other users
      socket.broadcast.to(room).emit("participant:left", {
        participantId: socket.id,
      });
    });
  });
});
```

### 2. IMPORTANT: Broadcast vs Emit

```javascript
// WRONG - Sends to everyone INCLUDING the sender
io.to(meetingCode).emit("offer", offer);

// WRONG - Sends to everyone INCLUDING the sender
socket.to(meetingCode).emit("offer", offer);

// CORRECT - Sends to everyone EXCEPT the sender
socket.broadcast.to(meetingCode).emit("offer", offer);
```

### 3. Error Handling & Acknowledgments

```javascript
io.on("connection", (socket) => {
  socket.on("join-room", (payload, callback) => {
    try {
      // Validate payload
      if (!payload.meetingCode) {
        return callback({ ok: false, error: "Meeting code required" });
      }

      socket.join(payload.meetingCode);
      socket.broadcast.to(payload.meetingCode).emit("user-joined");

      // Send acknowledgment
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });
});
```

### 4. Multiple Peer Handling (3+ users)

When 3+ users are in the room, each new user joining must:
1. Send offer to ALL existing users
2. Receive answers from each existing user
3. Exchange ICE candidates with each peer

```javascript
// When peer joins and others already in room
socket.on("join-room", ({ meetingCode, displayName }) => {
  const existingUsers = io.sockets.adapter.rooms.get(meetingCode) || [];
  
  socket.join(meetingCode);

  // Send to each existing user: "a new peer joined, expect their offer"
  socket.broadcast.to(meetingCode).emit("user-joined", {
    userId: socket.id,
    displayName,
  });

  // Tell the new peer how many users are already here
  // (Frontend creates peer connections for each)
  socket.emit("room:presence", {
    participants: Array.from(existingUsers)
      .filter(id => id !== socket.id)
      .map(id => ({ id }))
  });
});
```

---

## Event Message Formats

### join-room
**Frontend sends:**
```json
{
  "meetingCode": "abc123",
  "displayName": "John Doe"
}
```

**Backend response (ack):**
```json
{
  "ok": true
}
```

### user-joined
**Backend broadcasts:**
```json
{
  "userId": "socket-id",
  "displayName": "John Doe"
}
```

### offer
**Frontend sends:**
```json
{
  "roomId": "abc123",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\n..."
  }
}
```

**Backend broadcasts to others:**
```json
{
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\n..."
  },
  "from": "sender-socket-id"
}
```

### answer
**Frontend sends:**
```json
{
  "roomId": "abc123",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\n..."
  }
}
```

**Backend broadcasts to others:**
```json
{
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\n..."
  },
  "from": "sender-socket-id"
}
```

### ice-candidate
**Frontend sends:**
```json
{
  "roomId": "abc123",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

**Backend broadcasts to others:**
```json
{
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  },
  "from": "sender-socket-id"
}
```

---

## TURN Server Integration (For Render Backend)

### Endpoint: GET /api/turn-servers

When frontend requests TURN credentials:

```javascript
// Example with Twilio
const twilio = require("twilio");

app.get("/api/turn-servers", authenticate, (req, res) => {
  try {
    const token = new twilio.jwt.AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { ttl: 3600 } // Valid for 1 hour
    );

    token.addVideoGrant();

    // Get TURN servers from Twilio
    const iceServers = twilio.iceServers(token.toJwt());

    res.json({
      iceServers: iceServers,
      ttl: 3600,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Frontend would call this during peer connection creation:

```javascript
// In frontend webrtc/peer.ts
export const createPeerConnection = async () => {
  let iceServers = DEFAULT_STUN_SERVERS;

  try {
    // Try to fetch TURN credentials
    const response = await fetch("/api/turn-servers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const { iceServers: turnServers } = await response.json();
      iceServers = [...DEFAULT_STUN_SERVERS, ...turnServers];
    }
  } catch (error) {
    console.warn("Could not fetch TURN servers, using STUN only");
  }

  return new RTCPeerConnection({ iceServers });
};
```

---

## Testing Checklist

- [ ] Backend receives "join-room" from first peer
- [ ] Backend broadcasts "user-joined" to room (not to joiner)
- [ ] Second peer receives "user-joined" and creates offer
- [ ] Backend receives offer from second peer
- [ ] Backend broadcasts offer to first peer (not to offerer)
- [ ] First peer receives offer and creates answer
- [ ] Backend receives answer from first peer
- [ ] Backend broadcasts answer to second peer
- [ ] Both peers exchange ICE candidates
- [ ] ICE connection reaches "connected" state
- [ ] ontrack fires on both sides
- [ ] Remote video appears on both sides

---

## Common Backend Mistakes

### ❌ WRONG
```javascript
// Sends offer back to the sender
socket.to(meetingCode).emit("offer", offer);

// Sends to the sender too
io.to(meetingCode).emit("offer", offer);

// Doesn't use rooms - broadcasts to ALL users
socket.broadcast.emit("offer", offer);

// Mixed event names (frontend expects "offer", backend sends "webrtc-offer")
socket.emit("webrtc-offer", offer);
```

### ✅ CORRECT
```javascript
// Only to other peers in the room
socket.broadcast.to(meetingCode).emit("offer", offer);

// Consistent event names with frontend
socket.broadcast.to(meetingCode).emit("offer", { offer, from: socket.id });

// Proper room management
socket.join(meetingCode);
socket.broadcast.to(meetingCode).emit("user-joined");
```

---

## Render Deployment Notes

1. **WebSocket Support:** Render Web Services support WebSockets natively
2. **Environment Variables:**
   ```
   TWILIO_ACCOUNT_SID=...
   TWILIO_API_KEY=...
   TWILIO_API_SECRET=...
   ```
3. **CORS:** Configure for Vercel frontend origin
4. **Health Check:** Implement `/health` endpoint

---

## Monitoring & Debugging

Add logs to backend:

```javascript
socket.on("join-room", ({ meetingCode }) => {
  console.log(`[${meetingCode}] User ${socket.id} joined`);
  socket.join(meetingCode);
  
  const roomSize = io.sockets.adapter.rooms.get(meetingCode).size;
  console.log(`[${meetingCode}] Room now has ${roomSize} users`);
});

socket.on("offer", ({ meetingCode, offer }) => {
  console.log(`[${meetingCode}] Offer from ${socket.id} -> broadcasting`);
});
```

This helps debug socket issues when remote video is blank.
