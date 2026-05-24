/**
 * ICE Server Configuration for WebRTC
 *
 * STUN: Used for NAT/firewall traversal on same network
 * TURN: Used for relay when direct connection fails (cross-network, mobile)
 *
 * Production Setup Instructions:
 *
 * 1. LOCAL/SAME-NETWORK TESTING:
 *    - Only STUN needed
 *    - Works fine with provided Google STUN servers
 *
 * 2. CROSS-NETWORK/MOBILE PRODUCTION:
 *    - MUST use TURN servers
 *    - Options:
 *      a) Managed services: Twilio, AWS, Google Cloud
 *      b) Self-hosted: coturn server
 *      c) Free public: limited, not recommended for production
 *
 * 3. TWILIO TURN SERVER (Recommended for Production):
 *    - Sign up at twilio.com
 *    - Get TURN credentials from your account
 *    - Use the URLs provided in Twilio console
 *
 * 4. AWS KINESIS VIDEO STREAMS:
 *    - Use GetSignalingChannelEndpoint
 *    - Get TURN servers dynamically
 *
 * 5. SELF-HOSTED COTURN:
 *    - Deploy coturn server
 *    - Use: turn:your-domain.com:3478
 *    - Generate temp credentials via backend
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: "password" | "oauth";
}

/**
 * Get ICE servers with TURN configuration
 * For production, fetch TURN credentials from your backend
 */
export async function getIceServers(
  turnServerUrl?: string
): Promise<IceServerConfig[]> {
  const stunServers: IceServerConfig[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  // If a TURN server URL is provided, add it
  if (turnServerUrl) {
    try {
      // Try to fetch dynamic TURN credentials from backend
      const response = await fetch(turnServerUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      });

      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload)) {
          return [...stunServers, ...payload];
        }

        if (payload?.iceServers && Array.isArray(payload.iceServers)) {
          return [...stunServers, ...payload.iceServers];
        }

        console.warn(
          "[ICE] TURN endpoint response did not contain iceServers, using STUN-only",
          payload
        );
        return stunServers;
      }
    } catch (error) {
      console.warn("[ICE] Failed to fetch dynamic TURN servers:", error);
    }
  }

  // Fallback: Return STUN only (works for same-network, fails for cross-network)
  console.warn(
    "[ICE] Using STUN-only. For cross-network/mobile, configure TURN servers"
  );
  return stunServers;
}

/**
 * Example TURN server for cross-network testing
 * Replace credentials and URL for production
 */
export const FALLBACK_TURN_SERVER: IceServerConfig = {
  urls: [
    "turn:turnserver.example.com:3478",
    "turn:turnserver.example.com:3479?transport=tcp",
  ],
  username: "username",
  credential: "password",
};
