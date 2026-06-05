export type LocalMediaDevicePreferences = {
  audioInputId?: string;
  videoInputId?: string;
};

const buildDeviceConstraint = (deviceId?: string): boolean | MediaTrackConstraints =>
  deviceId ? { deviceId: { exact: deviceId } } : true;

export const getLocalStream = async (
  preferences: LocalMediaDevicePreferences = {}
) => {
  const stream =
    await navigator.mediaDevices.getUserMedia({
      video: buildDeviceConstraint(preferences.videoInputId),
      audio: buildDeviceConstraint(preferences.audioInputId),
    });

  return stream;
};

export const getReplacementTrack = async (
  kind: "audioinput" | "videoinput",
  deviceId?: string
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: kind === "audioinput" ? buildDeviceConstraint(deviceId) : false,
    video: kind === "videoinput" ? buildDeviceConstraint(deviceId) : false,
  });

  const track =
    kind === "audioinput"
      ? stream.getAudioTracks()[0]
      : stream.getVideoTracks()[0];

  stream.getTracks().forEach((streamTrack) => {
    if (streamTrack !== track) {
      streamTrack.stop();
    }
  });

  if (!track) {
    throw new Error(`No ${kind === "audioinput" ? "microphone" : "camera"} track returned.`);
  }

  return track;
};
