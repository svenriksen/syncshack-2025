"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export default function ChatPage() {
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
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Chat</h1>
      <div className="mb-4 h-[50vh] w-full overflow-y-auto rounded border p-3">
        {messages.length === 0 && (
          <p className="text-gray-500">Start the conversation by typing a message below.</p>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  "inline-block max-w-[80%] rounded px-3 py-2 " +
                  (m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type your message..."
          className="flex-1 rounded border px-3 py-2 outline-none focus:ring"
        />
        <button
          onClick={send}
          disabled={chatMutation.isPending}
          className="rounded bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {chatMutation.isPending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}


