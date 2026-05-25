import { Mic } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VideoControlButton } from "../VideoControlButton";

const meta = {
  title: "Meeting/VideoControlButton",
  component: VideoControlButton,
  args: {
    label: "Microphone",
    icon: <Mic className="h-5 w-5" />,
  },
} satisfies Meta<typeof VideoControlButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Active: Story = { args: { active: true } };
export const Destructive: Story = { args: { destructive: true } };
