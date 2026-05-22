import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReconnectOverlay } from "../ReconnectOverlay";

const meta = {
  title: "Feedback/ReconnectOverlay",
  component: ReconnectOverlay,
  args: {
    visible: true,
  },
} satisfies Meta<typeof ReconnectOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};
export const Hidden: Story = { args: { visible: false } };
