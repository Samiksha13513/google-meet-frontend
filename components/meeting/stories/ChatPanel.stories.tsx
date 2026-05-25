import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChatPanel } from "../ChatPanel";

const meta = {
  title: "Meeting/ChatPanel",
  component: ChatPanel,
  args: {
    messages: [
      {
        id: "message-1",
        meetingId: "meeting-1",
        senderName: "Alex",
        body: "Can everyone hear me?",
        messageType: "TEXT",
        createdAt: new Date().toISOString(),
      },
    ],
    onSend: () => undefined,
  },
} satisfies Meta<typeof ChatPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { messages: [] } };
