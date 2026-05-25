# WebRTC Remote Video: Production Deployment Checklist

## Quick Fix Summary

**Problem:** Remote video blank when users join from different networks/devices

**Root Causes Fixed:**
1. ✅ Missing TURN server configuration
2. ✅ No error handling in WebRTC signaling
3. ✅ Silent failures in peer connection
4. ✅ Incomplete logging for debugging
5. ✅ Autoplay policy blocks
6. ✅ Hard-coded socket/API URLs

**Files Changed:**
- `webrtc/peer.ts` - Added logging, STUN/TURN setup
- `webrtc/ice-servers.ts` - NEW: ICE server configuration
- `app/meeting-room/page.tsx` - Added comprehensive debug logging, proper ontrack handling
- `services/auth.ts` - Dynamic API URL (origin-based)
- `lib/socket.ts` - Dynamic socket URL (origin-based)

---

## Immediate Fixes (Already Applied)

### Frontend Changes
```javascript
// All WebRTC events now log with [WebRTC] prefix
// Offer/answer/ICE operations wrapped in try/catch
// ontrack handler with autoplay fallback
// Connection state monitoring
// ICE gathering completion detection
```

### What This Fixes
- ✅ Can see detailed logs in console during calls
- ✅ Understand exactly where connection fails
- ✅ Remote video autoplays correctly even with audio
- ✅ Better error messages for troubleshooting

---

## Production Setup (Backend Required)

### Step 1: Configure Environment Variables

**On Vercel (Frontend):**
```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
```

**On Render (Backend):**
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_API_KEY=your_api_key
TWILIO_API_SECRET=your_api_secret
```

### Step 2: Backend Signaling Verification

Ensure backend:
- [ ] Uses `socket.broadcast.to(meetingCode)` (NOT `socket.to()` or `io.to()`)
- [ ] Sends "user-joined" only to OTHER peers
- [ ] Routes offer/answer/ICE events correctly
- [ ] Implements `/api/turn-servers` endpoint for TURN credentials

See: `BACKEND_SIGNALING_SPEC.md` for complete implementation

### Step 3: TURN Server Setup

Choose one:

**Option A: Twilio (Easiest)**
1. Create Twilio account
2. Add env vars to Render
3. Backend fetches credentials automatically

**Option B: Self-Hosted Coturn**
1. Deploy coturn server
2. Update ICE servers in `webrtc/peer.ts`
3. Pass credentials to frontend

**Option C: AWS Kinesis Video**
1. Create signaling channel
2. Implement GetSignalingChannelEndpoint call
3. Return ICE servers to frontend

---

## Testing Guide

### Test 1: Same WiFi (Baseline)
```
1. Deploy frontend to Vercel (or use localhost)
2. Open two browser windows on same WiFi
3. Both join same meeting
✓ Both should see each other
✓ Check console for [WebRTC] logs
```

### Test 2: Different Networks (Requires TURN)
```
1. One device on home WiFi
2. One device on mobile data / different WiFi
3. Both open same meeting link
✓ Should see each other
✗ If blank: TURN server not working
  - Check backend /api/turn-servers returns data
  - Check credentials are valid
```

### Test 3: Debug Console
```
# Open DevTools (F12)
# Type in console:

socket.connected           // Should be true
socket.id                  // Should have value

// Check for these logs:
// [WebRTC] Peer connection created ✓
// [WebRTC] Added local track ✓
// [WebRTC] ontrack fired ✓ (CRITICAL)
// [WebRTC] Remote stream attached ✓
// [WebRTC] Connection state: connected ✓
```

### Test 4: Network Tab
```
# DevTools Network tab
# Filter by WS (WebSocket)
# Should see connection to backend
# Should see WebSocket messages:
# - user-joined
# - offer
# - answer
# - ice-candidate (multiple)
```

---

## What to Do If Remote Video Still Blank

### Flow: Diagnosis → Fix

```
1. Are BOTH users connected to socket?
   - Check: socket.connected === true
   - If NO: Backend not reachable
   - Fix: Check NEXT_PUBLIC_SOCKET_URL

2. Does offer/answer exchange work?
   - Check console: [WebRTC] Created offer ✓
   - Check console: [WebRTC] Set remote description (offer) ✓
   - If missing: Signaling broken
   - Fix: Check backend socket.broadcast.to() usage

3. Do ICE candidates get exchanged?
   - Check console: [WebRTC] ICE candidate generated (multiple) ✓
   - If missing: ICE not starting
   - Fix: Check browser ICE settings / firewall

4. Does ontrack fire?
   - Check console: [WebRTC] ontrack fired ✓
   - This is CRITICAL - if missing, remote never sent video
   - Check remote user's local stream creation
   - Check if their addTrack() succeeded

5. What's the ICE connection state?
   - In console: peerRef.current.iceConnectionState
   - "new" or "checking": Still negotiating
   - "connected" or "completed": Should work
   - "failed": No path found, need TURN
   - Fix: Add TURN server
```

---

## Debugging Commands (Browser Console)

```javascript
// Check socket connection
socket.connected
socket.id

// Check peer connection state
const peer = peerRef.current;
{
  connectionState: peer.connectionState,
  iceConnectionState: peer.iceConnectionState,
  iceGatheringState: peer.iceGatheringState,
  signalingState: peer.signalingState,
  senders: peer.getSenders().length,
  receivers: peer.getReceivers().length,
  candidates: peer.getStats()
}

// Check remote video element
$0  // Select <video> element
$0.srcObject          // Should be MediaStream
$0.srcObject?.getTracks()  // Should show tracks
$0.readyState         // Should be 4 (HAVE_ENOUGH_DATA)
$0.currentTime        // Should be increasing
```

---

## Monitoring in Production

Add these metrics to your analytics:

```javascript
// Track ICE failures
peer.onconnectionstatechange = () => {
  if (peer.connectionState === "failed") {
    analytics.track("webrtc_ice_failed", {
      iceState: peer.iceConnectionState,
      timestamp: Date.now()
    });
  }
};

// Track remote stream received
peer.ontrack = (event) => {
  analytics.track("remote_stream_received", {
    streamId: event.streams[0].id,
    tracks: event.streams[0].getTracks().length
  });
};
```

---

## Deployment Checklist (Complete)

### Before Going Live

- [ ] Backend implements socket.broadcast.to() correctly
- [ ] Backend has TURN credentials endpoint ready
- [ ] Env vars set on both Vercel and Render
- [ ] Test on 2 different networks
- [ ] Test on mobile device
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Check browser console has NO errors
- [ ] Monitor [WebRTC] logs during call

### Monitoring After Deploy

- [ ] Log ice_connection_failed events
- [ ] Monitor for signaling timeouts
- [ ] Track remote_stream_received rate
- [ ] Alert if >5% calls fail

---

## Files to Review

1. `WEBRTC_DEBUG_GUIDE.md` - Detailed troubleshooting guide
2. `BACKEND_SIGNALING_SPEC.md` - Backend implementation spec
3. `webrtc/ice-servers.ts` - TURN configuration options
4. `webrtc/peer.ts` - Peer connection setup with logging
5. `app/meeting-room/page.tsx` - Full signaling with error handling

---

## Support

If remote video is still blank after following this guide:

1. **Check [WebRTC] logs** in both client consoles
2. **Review backend logs** for socket events
3. **Verify TURN endpoint** returns data: `curl https://backend/api/turn-servers`
4. **Test ICE states** using commands above
5. **Check network**: Are both clients actually connected to socket?

The logs tell the whole story - if ontrack never fires, the problem is always the remote peer's stream or the signaling path.
