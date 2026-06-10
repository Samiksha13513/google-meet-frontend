import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ParticipantTile } from "../ParticipantTile";

const meta = {
  title: "Meeting/ParticipantTile",
  component: ParticipantTile,
  args: {
    participant: {
      id: "participant-1",
      meetingId: "meeting-1",
      displayName: "",
      role: "HOST",
      status: "JOINED",
      micEnabled: false,
      cameraEnabled: false,
      handRaised: false,
      screenSharing: false,
    },
  },
} satisfies Meta<typeof ParticipantTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Muted: Story = {};
export const Speaking: Story = { args: { speaking: true } };
export const Presenting: Story = {
  args: {
    participant: {
      ...meta.args.participant,
      screenSharing: true,
    },
  },
};
