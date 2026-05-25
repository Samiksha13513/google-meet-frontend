import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "@/types/meeting";

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (message: string) => void;
};

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [message, setMessage] = useState("");

  const send = () => {
    const value = message.trim();
    if (!value) return;
    onSend(value);
    setMessage("");
  };

  return (
    <aside className="flex h-full w-full flex-col bg-white text-[#202124]">
      <header className="border-b border-[#dadce0] px-5 py-4">
        <h2 className="text-base font-medium">In-call messages</h2>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-[#5f6368]">Messages sent here are visible to everyone in the meeting.</p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="text-xs text-[#5f6368]">{item.senderName}</div>
              <p className="text-sm">{item.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 border-t border-[#dadce0] p-4">
        <Input
          aria-label="Message everyone"
          placeholder="Send a message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <Button size="icon" onClick={send} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
