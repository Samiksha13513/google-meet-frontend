"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const joinMeetingSchema = z.object({
  meetingCode: z
    .string()
    .trim()
    .min(3, "Enter a meeting code")
    .regex(/^[a-zA-Z0-9-]+$/, "Meeting codes can only contain letters, numbers, and dashes"),
});

type JoinMeetingValues = z.infer<typeof joinMeetingSchema>;

type JoinMeetingFormProps = {
  onJoin: (meetingCode: string) => void | Promise<void>;
  loading?: boolean;
};

export function JoinMeetingForm({ onJoin, loading = false }: JoinMeetingFormProps) {
  const form = useForm<JoinMeetingValues>({
    resolver: zodResolver(joinMeetingSchema),
    defaultValues: { meetingCode: "" },
  });

  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={form.handleSubmit(({ meetingCode }) => onJoin(meetingCode))}
    >
      <div className="relative">
        <Keyboard className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#5f6368]" />
        <Input
          aria-label="Meeting code"
          placeholder="Enter a code or nickname"
          className="h-12 w-[260px] rounded-md pl-10"
          {...form.register("meetingCode")}
        />
        {form.formState.errors.meetingCode && (
          <p className="mt-1 text-sm text-[#d93025]">
            {form.formState.errors.meetingCode.message}
          </p>
        )}
      </div>

      <Button type="submit" variant="ghost" disabled={loading}>
        Join
      </Button>
    </form>
  );
}
