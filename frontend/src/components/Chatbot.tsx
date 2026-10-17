
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  destination?: string | null;
  destinationLabel?: string | null;
};

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi! I'm Verdict Guide. Ask me where to find a feature or how to get started.",
    },
  ]);

  const location = useLocation();
  const navigate = useNavigate();

  async function sendMessage(text = input) {
    const question = text.trim();

    if (!question || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", text: question },
    ]);

    setInput("");
    setLoading(true);

    try {
      const result = await api.sendChatbotMessage({
        message: question,
        current_page: location.pathname,
      });

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: result.reply,
          destination: result.destination,
          destinationLabel: result.destination_label,
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Sorry, I couldn't respond. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <section
          className="mb-3 flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          aria-label="Verdict Guide chatbot"
        >
          <header className="flex items-center justify-between bg-brand-600 p-4 text-white">
            <div>
              <h2 className="font-semibold">Verdict Guide</h2>
              <p className="text-xs text-white/80">
                Ask me where to go next
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chatbot"
              className="rounded-lg px-3 py-1 hover:bg-white/15"
            >
              ✕
            </button>
          </header>

          <div
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <div
                key={`${index}-${message.role}`}
                className={`max-w-[90%] rounded-xl p-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-brand-600 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>

                {message.role === "assistant" &&
                  message.destination && (
                    <button
                      type="button"
                      onClick={() => {
                        if (message.destination) {
                          navigate(message.destination);
                          setOpen(false);
                        }
                      }}
                      className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      Open {message.destinationLabel || "page"} →
                    </button>
                  )}
              </div>
            ))}

            {loading && (
              <p className="text-sm text-slate-500">
                Verdict Guide is thinking…
              </p>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-slate-200 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Where should I go?"
              maxLength={2000}
              aria-label="Message Verdict Guide"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "..." : "Send"}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close Verdict Guide" : "Open Verdict Guide"}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg transition hover:scale-105"
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
