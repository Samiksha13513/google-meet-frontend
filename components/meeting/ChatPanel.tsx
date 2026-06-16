import { Copy, Send } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  const send = () => {
    const value = message.trim();
    if (!value) return;
    onSend(value);
    setMessage("");
  };

  const copyMessage = async (body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col bg-white text-[#202124]">
      <header className="border-b border-[#dadce0] px-5 py-4">
        <h2 className="text-base font-medium">In-call messages</h2>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {copied && (
          <div className="sticky top-0 z-10 mx-auto w-fit rounded-full bg-[#323639] px-3 py-1.5 text-xs text-white shadow-lg">
            Message copied
          </div>
        )}
        {messages.length === 0 ? (
          <p className="text-sm text-[#5f6368]">Messages sent here are visible to everyone in the meeting.</p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="group rounded-xl px-2 py-1 transition-colors hover:bg-[#f1f3f4]">
              <div className="text-xs text-[#5f6368]">{item.senderName}</div>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm">{item.body}</p>
                <button
                  type="button"
                  onClick={() => void copyMessage(item.body)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#e8eaed] hover:text-[#202124] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1a73e8] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  title="Copy text"
                  aria-label="Copy message text"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
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
