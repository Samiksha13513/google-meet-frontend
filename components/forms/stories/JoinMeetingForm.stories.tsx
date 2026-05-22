import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { JoinMeetingForm } from "../JoinMeetingForm";

const meta = {
  title: "Forms/JoinMeetingForm",
  component: JoinMeetingForm,
  args: {
    onJoin: () => undefined,
  },
} satisfies Meta<typeof JoinMeetingForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
