"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "./button";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const chatMutation = api.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
  });

  function send() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    chatMutation.mutate({ message: trimmed });
  }

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button size="lg" onClick={() => setOpen((v) => !v)}>
          {open ? "Close Chat" : "Chat"}
        </Button>
      </div>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[90vw] rounded-lg border border-[rgb(var(--color-foreground))/0.12] bg-[rgb(var(--color-card))] shadow-xl">
          <div className="flex items-center justify-between border-b border-[rgb(var(--color-foreground))/0.1] px-4 py-2">
            <div className="font-semibold">Assistant</div>
            <button className="text-sm opacity-70 hover:opacity-100" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="h-72 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="text-sm text-[rgb(var(--color-foreground))/0.6]">Ask anything about the app.</p>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={
                      "inline-block max-w-[80%] rounded px-3 py-2 text-sm " +
                      (m.role === "user" ? "bg-blue-600 text-white" : "bg-[rgb(var(--color-foreground))/0.06]")
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-[rgb(var(--color-foreground))/0.1] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Type your message..."
              className="flex-1 rounded border border-[rgb(var(--color-foreground))/0.15] bg-transparent px-3 py-2 outline-none focus:ring"
            />
            <Button onClick={send} disabled={chatMutation.isPending}>
              {chatMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}


