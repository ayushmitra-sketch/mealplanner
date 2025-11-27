"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  Eraser,
  Loader2,
  Plus,
  PlusIcon,
  Square,
} from "lucide-react";
import { MessageWall } from "@/components/messages/message-wall";
import { ChatHeader } from "@/app/parts/chat-header";
import { ChatHeaderBlock } from "@/app/parts/chat-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UIMessage } from "ai";
import { useEffect, useState, useRef } from "react";
import {
  AI_NAME,
  CLEAR_CHAT_TEXT,
  OWNER_NAME,
  WELCOME_MESSAGE,
} from "@/config";
import Image from "next/image";
import Link from "next/link";

/* ---------------- validation + storage ---------------- */

const formSchema = z.object({
  message: z.string().min(1, "Message cannot be empty.").max(2000),
});

const STORAGE_KEY = "chat-messages";

type StorageData = {
  messages: UIMessage[];
  durations: Record<string, number>;
};

const loadMessagesFromStorage = (): {
  messages: UIMessage[];
  durations: Record<string, number>;
} => {
  if (typeof window === "undefined") return { messages: [], durations: {} };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { messages: [], durations: {} };
    const parsed = JSON.parse(stored);
    return {
      messages: parsed.messages || [],
      durations: parsed.durations || {},
    };
  } catch (error) {
    console.error("Failed to load messages from localStorage:", error);
    return { messages: [], durations: {} };
  }
};

const saveMessagesToStorage = (messages: UIMessage[], durations: Record<string, number>) => {
  if (typeof window === "undefined") return;
  try {
    const data: StorageData = { messages, durations };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save messages to localStorage:", error);
  }
};

/* ---------------- page component ---------------- */

export default function ChatPage() {
  const [isClient, setIsClient] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const stored = typeof window !== "undefined" ? loadMessagesFromStorage() : { messages: [], durations: {} };
  const [initialMessages] = useState<UIMessage[]>(stored.messages);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: initialMessages,
  });

  const [showProfile, setShowProfile] = useState(false);
  const welcomeMessageShownRef = useRef<boolean>(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
    setDurations(stored.durations);
    setMessages(stored.messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isClient) {
      saveMessagesToStorage(messages, durations);
    }
  }, [durations, messages, isClient]);

  useEffect(() => {
    if (isClient && initialMessages.length === 0 && !welcomeMessageShownRef.current) {
      const welcomeMessage: UIMessage = {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: WELCOME_MESSAGE,
          },
        ],
      };
      setMessages([welcomeMessage]);
      saveMessagesToStorage([welcomeMessage], {});
      welcomeMessageShownRef.current = true;
    }
  }, [isClient, initialMessages.length, setMessages]);

  // auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDurationChange = (key: string, duration: number) => {
    setDurations((prev) => {
      const next = { ...prev };
      next[key] = duration;
      return next;
    });
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    // keep streaming logic intact
    setIsTyping(true);
    sendMessage({ text: data.message });
    form.reset();

    // subtle typing state cleared when useChat pushes assistant response
    setTimeout(() => setIsTyping(false), 900);
  }

  function clearChat() {
    const newMessages: UIMessage[] = [];
    const newDurations = {};
    setMessages(newMessages);
    setDurations(newDurations);
    saveMessagesToStorage(newMessages, newDurations);
    toast.success("Chat cleared");
  }

  const quickPrompts = [
    "Build a balanced 1500 kcal vegetarian day plan",
    "Count calories for: 1 bowl rice, 1 cup dal, salad",
    "Recipe from: paneer, spinach, tomato",
    "Vegetarian high-protein dinner",
    "Low-carb quick lunch ideas",
  ];

  // small animated send icon (returns JSX so we can reuse)
  function SendIconAnimated() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9-7-9-7-9 7 9 7z" />
      </svg>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <main className="max-w-6xl mx-auto grid grid-cols-12 gap-6 px-4 py-6">
        {/* LEFT: quick actions (hidden on small screens) */}
        <aside className="col-span-3 hidden md:flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-lg">🥗</div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">NutriBuddy</div>
                  <div className="text-xs text-slate-500">Smart nutrition chat</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => toast("New chat (demo)")}>
                  <Plus className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={clearChat}>
                  <Eraser className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-slate-600 mb-2">Quick prompts</div>
              <div className="flex flex-col gap-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      form.setValue("message", p);
                      // focus is handled by browser; user can hit Enter
                    }}
                    className="text-left px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-slate-600 mb-2">Saved plans</div>
              <ul className="flex flex-col gap-2">
                <li className="px-3 py-2 rounded-lg bg-white border border-slate-100">Vegetarian • 1800 kcal</li>
                <li className="px-3 py-2 rounded-lg bg-white border border-slate-100">Low-carb • 1500 kcal</li>
              </ul>
            </div>

            <div className="mt-4 text-xs text-slate-400">© {new Date().getFullYear()} {OWNER_NAME}</div>
          </div>
        </aside>

        {/* MAIN: chat area */}
        <section className="col-span-12 md:col-span-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* header */}
            <div className="px-5 py-4 border-b border-slate-100">
              <ChatHeader>
                <ChatHeaderBlock />
                <ChatHeaderBlock className="justify-center items-center">
                  <Avatar className="size-8 ring-1 ring-emerald-100">
                    <AvatarImage src="/logo.png" />
                    <AvatarFallback>
                      <Image src="/logo.png" alt="Logo" width={36} height={36} />
                    </AvatarFallback>
                  </Avatar>
                  <p className="tracking-tight text-slate-700">Chat with {AI_NAME}</p>
                </ChatHeaderBlock>
                <ChatHeaderBlock className="justify-end">
                  <Button variant="outline" size="sm" onClick={clearChat}>
                    <PlusIcon className="size-4 mr-2" />
                    {CLEAR_CHAT_TEXT}
                  </Button>
                </ChatHeaderBlock>
              </ChatHeader>
            </div>

            {/* messages */}
            <div className="px-5 py-6 h-[68vh] overflow-y-auto">
              <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                {isClient ? (
                  <>
                    <MessageWall messages={messages} status={status} durations={durations} onDurationChange={handleDurationChange} />
                    {status === "submitted" && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="size-4 animate-spin" />
                        <span className="text-sm">Processing...</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-center">
                    <Loader2 className="size-4 animate-spin text-slate-400" />
                  </div>
                )}

                {/* typing indicator (subtle) */}
                {isTyping && (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-xs">AI</div>
                    <div className="px-3 py-2 rounded-lg bg-slate-100 animate-pulse">NutriBuddy is typing…</div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* composer */}
            <div className="px-5 py-4 border-t border-slate-100 bg-gradient-to-t from-white to-transparent">
              <form id="chat-form" onSubmit={form.handleSubmit(onSubmit)}>
                <FieldGroup>
                  <Controller
                    name="message"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid} className="flex items-center gap-3">
                        <FieldLabel htmlFor="chat-form-message" className="sr-only">Message</FieldLabel>
                        <div className="relative flex-1">
                          <Input
                            {...field}
                            id="chat-form-message"
                            className="h-12 pr-16 pl-4 bg-white border border-slate-100 rounded-full shadow-sm"
                            placeholder="Type your message — e.g., 'Low-carb dinner ideas'"
                            disabled={status === "streaming"}
                            aria-invalid={fieldState.invalid}
                            autoComplete="off"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit(onSubmit)();
                              }
                            }}
                          />

                          {/* send / stop button */}
                          {(status === "ready" || status === "error") && (
                            <Button
                              type="submit"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-md"
                              disabled={!field.value.trim()}
                              aria-label="Send message"
                            >
                              <div className="p-1 text-white">
                                <ArrowUp className="size-4" />
                              </div>
                            </Button>
                          )}

                          {(status === "streaming" || status === "submitted") && (
                            <Button
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 hover:bg-slate-200 shadow-sm"
                              onClick={() => stop()}
                              aria-label="Stop"
                            >
                              <Square className="size-4" />
                            </Button>
                          )}
                        </div>

                        {/* quick attach / voice (visual only) */}
                        <div className="hidden sm:flex items-center gap-2">
                          <label className="p-2 rounded-full bg-slate-50 border border-slate-100 cursor-pointer">
                            📎
                            <input type="file" className="hidden" accept="image/*" />
                          </label>
                          <button type="button" className="px-3 py-2 rounded-full bg-emerald-50 text-emerald-700">Voice</button>
                        </div>
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>

              {/* prompt chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {["Build a meal plan", "Count my calories", "Recipe from ingredients", "Vegetarian", "Keto"].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      form.setValue("message", chip);
                      // small visual cue
                      toast.success("Prompt loaded — press Enter to send");
                    }}
                    className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 text-xs text-slate-500">
              © {new Date().getFullYear()} {OWNER_NAME} • <Link href="/terms" className="underline">Terms</Link> • Powered by <Link href="https://ringel.ai/" className="underline">Ringel.AI</Link>
            </div>
          </div>
        </section>

        {/* RIGHT: profile & saved plans (hidden on small screens) */}
        <aside className="col-span-3 hidden md:flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Profile</h3>
            <p className="text-sm text-slate-600 mt-2">Fill age, height, weight and preferences for personalized plans.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <div className="text-slate-500">Age: —</div>
              <div className="text-slate-500">Height: —</div>
              <div className="text-slate-500">Weight: —</div>
            </div>
            <Button className="mt-3 w-full" onClick={() => setShowProfile(true)}>Edit Profile</Button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Saved plans</h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="p-2 rounded-lg bg-white border border-slate-100 flex justify-between items-center">Vegetarian 1800 kcal <button className="text-xs text-emerald-700">Export</button></li>
              <li className="p-2 rounded-lg bg-white border border-slate-100 flex justify-between items-center">Low-carb 1500 kcal <button className="text-xs text-emerald-700">Export</button></li>
            </ul>
          </div>
        </aside>
      </main>

      {/* profile modal */}
      {showProfile && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-lg">
            <h3 className="text-lg font-semibold text-slate-800">Profile & Preferences</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="flex flex-col text-sm">
                Age
                <input className="mt-1 p-2 rounded border border-slate-100" />
              </label>
              <label className="flex flex-col text-sm">
                Height (cm)
                <input className="mt-1 p-2 rounded border border-slate-100" />
              </label>
              <label className="flex flex-col text-sm">
                Weight (kg)
                <input className="mt-1 p-2 rounded border border-slate-100" />
              </label>
              <label className="flex flex-col text-sm">
                Activity level
                <select className="mt-1 p-2 rounded border border-slate-100">
                  <option>Sedentary</option>
                  <option>Light</option>
                  <option>Moderate</option>
                  <option>Active</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowProfile(false)}>Cancel</Button>
              <Button onClick={() => setShowProfile(false)}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
