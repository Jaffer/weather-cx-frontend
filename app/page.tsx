"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  CloudSun,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  intent?: string | null;
  confidence?: number | null;
  isError?: boolean;
}

let messageCounter = 0;
function generateMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

function getCurrentTimeString(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-welcome",
      sender: "bot",
      text: "Hello! I am your Dialogflow CX AI Assistant. How can I help you today?",
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [activeError, setActiveError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setSessionId((current) => (current ? current : createSessionId()));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Smooth scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Reset chat conversation
  const handleResetChat = () => {
    const newSession = createSessionId();
    setSessionId(newSession);
    setMessages([
      {
        id: generateMessageId("welcome"),
        sender: "bot",
        text: "Conversation reset. New session started. How can I assist you?",
        timestamp: getCurrentTimeString(),
      },
    ]);
    setActiveError(null);
    setInput("");
    inputRef.current?.focus();
  };

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend ?? input).trim();
    if (!messageText || isLoading) return;

    setActiveError(null);

    const currentTime = getCurrentTimeString();

    const userMessage: Message = {
      id: generateMessageId("user"),
      sender: "user",
      text: messageText,
      timestamp: currentTime,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const currentSession = sessionId || createSessionId();
      if (!sessionId) {
        setSessionId(currentSession);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          sessionId: currentSession,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server responded with ${response.status}`);
      }

      const botMessage: Message = {
        id: generateMessageId("bot"),
        sender: "bot",
        text: data.reply || "No text response received from agent.",
        timestamp: getCurrentTimeString(),
        intent: data.match?.intent || null,
        confidence: data.match?.confidence || null,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to connect to agent";
      setActiveError(errorMsg);

      const errorBotMessage: Message = {
        id: generateMessageId("bot-err"),
        sender: "bot",
        text: `Error: ${errorMsg}`,
        timestamp: getCurrentTimeString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Preset sample prompts
  const samplePrompts = [
    "What's the weather forecast today?",
    "Will it rain in New York this weekend?",
    "Check humidity and wind speed",
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 md:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-500/20 text-white">
            <CloudSun className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white tracking-tight">
                Dialogflow CX Agent
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-[220px] sm:max-w-xs font-mono">
              Session: {sessionId ? `${sessionId.slice(0, 16)}...` : "Initializing"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetChat}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
            title="Reset Conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Active Error Banner */}
          {activeError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs md:text-sm text-red-200 shadow-sm"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-300">Connection Note</p>
                <p className="text-red-300/90">{activeError}</p>
                <p className="text-red-400/80 text-[11px]">
                  Ensure your .env.local file has valid Dialogflow CX credentials
                  and agent location configured.
                </p>
              </div>
            </motion.div>
          )}

          {/* Messages Stream */}
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={`flex w-full items-end gap-2.5 ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Bot Avatar */}
                  {!isUser && (
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${
                        msg.isError
                          ? "bg-red-600"
                          : "bg-zinc-800 border border-zinc-700 text-blue-400"
                      }`}
                    >
                      {msg.isError ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[75%] ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`group relative whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
                        isUser
                          ? "rounded-br-sm bg-blue-600 text-white font-normal"
                          : msg.isError
                          ? "rounded-bl-sm border border-red-500/40 bg-red-950/50 text-red-200"
                          : "rounded-bl-sm border border-zinc-800 bg-zinc-900 text-zinc-100"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Metadata & Timestamp */}
                    <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-400">
                      <span>{msg.timestamp}</span>
                      {msg.intent && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-400 font-mono">
                          {msg.intent}
                        </span>
                      )}
                      {isUser && <CheckCircle2 className="h-3 w-3 text-zinc-400" />}
                    </div>
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-blue-400">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-zinc-800 bg-zinc-900 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" />
                <span className="ml-2 text-xs text-zinc-400 font-medium">
                  Agent is thinking...
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Quick Prompts & Bottom Input Bar */}
      <footer className="border-t border-zinc-800 bg-zinc-900/90 p-4 md:px-8 backdrop-blur-md">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Quick Starter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="flex items-center gap-1 text-zinc-400 shrink-0 font-medium text-[11px]">
              <Sparkles className="h-3 w-3 text-amber-400" /> Suggestions:
            </span>
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-zinc-700/80 bg-zinc-800/70 px-3 py-1 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50 text-xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message to Dialogflow CX..."
              disabled={isLoading}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-14 text-sm text-zinc-100 placeholder-zinc-500 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span>Press Enter to send</span>
            <span>Dialogflow CX v3 API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
