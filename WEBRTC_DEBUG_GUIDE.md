# WebRTC Remote Video Debug & Production Setup Guide

## Issue Summary

**Symptom:** Two users join same meeting link, but one or both see blank/black remote video

**Root Causes:**
1. **Missing TURN Server** - STUN only works on same network; cross-network fails
2. **ICE Gathering Timeout** - Candidates not collected in time
3. **Signaling Race Conditions** - offer/answer sent before peer ready
4. **Socket Signaling Issues** - events not reaching backend or misrouted
5. **Browser Autoplay Policies** - Remote video blocked without user gesture
6. **No Error Handling** - Failures silently ignored

---

## Frontend Fixes Applied

### 1. Enhanced Logging
All WebRTC events now log with `[WebRTC]` prefix:
- Offer/answer creation and delivery
- ICE candidates generated/added
- Remote stream attachment
- Connection state changes
- Error details

**Check logs:**
```bash
# Open DevTools Console (F12) in both clients
# Look for [WebRTC] entries
# Should see:
# [WebRTC] Peer connection created
# [WebRTC] Added local track (kind: video/audio)
# [WebRTC] Created offer
# [WebRTC] ICE candidate generated
# [WebRTC] ontrack fired (when remote stream arrives)
# [WebRTC] Remote stream attached to video element
```

### 2. Proper ontrack Handler
- Logs incoming stream details
- Handles autoplay blocks
- Falls back to muting if needed
- Prevents duplicate stream attachment

### 3. Error Handling in Signaling
- Try/catch around offer/answer/ICE operations
- State validation before SDP operations
- Error logging for debugging

### 4. Connection State Monitoring
Both handlers now log:
- `connectionState` (new, connecting, connected, disconnected, failed, closed)
- `iceConnectionState` (new, checking, connected, completed, failed, disconnected, closed)
- `iceGatheringState` (new, gathering, complete)
- `signalingState` (stable, have-local-offer, have-remote-offer, have-local-pranswer, have-remote-pranswer)

---

## Backend Requirements

The backend **MUST**:

1. **Implement proper socket.io signaling:**
   ```javascript
   // When peer1 joins room
   socket.broadcast.to(roomId).emit("user-joined");
   
   // When peer1 sends offer
   socket.broadcast.to(roomId).emit("offer", { offer });
   
   // Ensure offer goes to peer2, NOT back to peer1
   ```

2. **Use socket.io rooms correctly:**
   ```javascript
   socket.join(roomId);  // Add to room
   socket.broadcast.to(roomId).emit(...)  // Send to others only
   ```

3. **Implement TURN server integration:**
   ```javascript
   // Endpoint: GET /api/turn-servers
   // Returns array of TURN credentials for all clients
   const turnServers = [
     {
       urls: ["turn:your-turn-server.com:3478"],
       username: "tempuser",
       credential: "temppass"
     }
   ];
   ```

---

## Production TURN Server Setup

### Option 1: Twilio (Recommended - Easy)
1. Sign up at https://www.twilio.com
2. Go to Console > Account > API Keys & Credentials
3. Get your Account SID and Auth Token
4. Backend endpoint to fetch TURN credentials:
   ```javascript
   const twilio = require('twilio');
   app.get('/api/turn-servers', (req, res) => {
     const token = twilio.jwt.AccessToken(
       process.env.TWILIO_ACCOUNT_SID,
       process.env.TWILIO_API_KEY,
       process.env.TWILIO_API_SECRET
     );
     token.addVideoGrant();
     const grant = token.toJwt();
     
     res.json(twilio.iceServers(grant));
   });
   ```

### Option 2: AWS Kinesis Video Streams
1. Create WebRTC signaling channel
2. Get TURN servers via GetSignalingChannelEndpoint API
3. Pass to frontend

### Option 3: Self-Hosted Coturn
1. Deploy coturn server (Ubuntu):
   ```bash
   sudo apt install coturn
   sudo nano /etc/coturn/turnserver.conf
   # Enable external_ip, set credentials
   sudo systemctl start coturn
   ```
2. Use in peer connection:
   ```javascript
   {
     urls: "turn:your-domain.com:3478",
     username: "user",
     credential: "pass"
   }
   ```

---

## Step-by-Step Testing

### Test 1: Same WiFi (STUN only)
```
1. Open browser on Laptop A at http://localhost:3000
2. Open browser on Laptop B at http://localhost:3000
3. Both users sign in and join same meeting
4. Expected: Both see each other (STUN works locally)
5. Check logs: [WebRTC] ontrack fired on both sides
```

### Test 2: Different Networks (TURN required)
```
1. Deploy frontend to Vercel: https://your-app.vercel.app
2. Deploy backend to Render with TURN endpoint
3. Laptop A: Open https://your-app.vercel.app on home WiFi
4. Mobile B: Open same URL on mobile data
5. Expected: Both see each other
6. If blank: Check browser console for [WebRTC] errors
   - Look for: ICE connection failed / No ICE candidates gathered
   - If yes: Backend TURN endpoint not working
```

### Test 3: Chrome/Firefox Network Throttling
```
1. Open DevTools (F12)
2. Go to Network tab
3. Throttle to "Slow 4G" or "Offline"
4. Both should still work with TURN
5. If fails: TURN server may not be public-accessible
```

---

## Debugging Checklist

### If remote video is blank:

**Check 1: Socket Connection**
```javascript
// In browser console
socket.connected  // Should be true
socket.id         // Should have a value
```

**Check 2: WebRTC Logs**
```
Look for in console:
[WebRTC] Peer connection created ✓
[WebRTC] Added local track (kind: video) ✓
[WebRTC] Created offer ✓
[WebRTC] ICE candidate generated ✓ (should appear multiple times)
[WebRTC] Set remote description (offer) ✓
[WebRTC] ontrack fired ✓ (MOST IMPORTANT - if missing, stream never arrived)
[WebRTC] Remote stream attached to video element ✓
[WebRTC] Connection state changed: connected ✓
```

**If ontrack never fires:**
- Remote peer never sent their video track
- Check if they even have camera permission
- Check if their local stream was created
- Check ICE connection state: should reach "connected" or "completed"

**Check 3: ICE State**
```javascript
// In console
const peer = peerRef.current;  // Access the peer connection
console.log({
  connection: peer.connectionState,
  ice: peer.iceConnectionState,
  gathering: peer.iceGatheringState,
  signaling: peer.signalingState
});
// 
// Expected progression:
// connectionState: new → connecting → connected
// iceConnectionState: new → checking → connected/completed
// iceGatheringState: new → gathering → complete
// signalingState: stable → have-local-offer → stable (after answer)
```

**Check 4: Remote Video Element**
```javascript
// In console
$0  // Select <video> element for remote
$0.srcObject  // Should be a MediaStream
$0.srcObject?.getTracks()  // Should show video+audio tracks
$0.readyState  // Should be 4 (HAVE_ENOUGH_DATA)
```

**Check 5: Network (DevTools Network Tab)**
- Look for WebSocket (WS) connection to backend
- Should show 101 Switching Protocols
- Check Network → WS for message flow:
  - `join-room` ✓
  - `offer` ✓
  - `answer` ✓
  - `ice-candidate` ✓ (many)

---

## Common Issues & Fixes

### Issue: "Connection state: failed"
**Cause:** ICE couldn't find any path between peers
**Fix:** 
- Add TURN server
- Check NAT/Firewall
- Verify ICE candidates being sent

### Issue: "ontrack never fires"
**Cause:** Remote stream never arrived
**Fix:**
- Check if remote peer's addTrack() succeeded
- Verify offer/answer exchanged correctly
- Check ICE connection state

### Issue: "Connection works but audio/video frozen"
**Cause:** Some packets lost, connection unstable
**Fix:**
- Check network quality (throttle test)
- TURN relay may be needed
- Check codec support

### Issue: "Autoplay blocked" warnings
**Cause:** Browser blocking unmuted audio autoplay
**Fix:** Already handled - code mutes remote video on first play attempt

---

## Vercel Deployment Checklist

```env
# .env.production (Vercel)
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
```

## Render Deployment Checklist

```
- Ensure backend supports WebSockets
- Environment variables set correctly
- CORS configured for frontend origin
- TURN endpoint accessible publicly
- Backend receives: user-joined, offer, answer, ice-candidate
- Backend sends: user-joined, offer, answer, ice-candidate
```

---

## Production Monitoring

Add these metrics to track call quality:
```javascript
// In peer.oniceconnectionstatechange
const iceState = peer.iceConnectionState;
if (iceState === "failed") {
  // Alert admin / report to analytics
  analytics.track("ice_connection_failed");
}

// In peer.ontrack
analytics.track("remote_stream_received", {
  timestamp: Date.now(),
  streamId: event.streams[0].id
});
```

---

## Next Steps

1. **Immediate:** Review console logs on both clients during video call
2. **This Week:** Deploy TURN server configuration to backend
3. **Testing:** Run Test 2 (Different Networks) to verify TURN working
4. **Production:** Monitor ice_connection_failed events
5. **Optimization:** Add codec constraints if bandwidth-limited

