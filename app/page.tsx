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
  MessageSquare,
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

export default function ChatPage() {
  // client flag
  const [isClient, setIsClient] = useState(false);

  // durations (for MessageWall)
  const [durations, setDurations] = useState<Record<string, number>>({});

  // load stored messages
  const stored = typeof window !== "undefined" ? loadMessagesFromStorage() : { messages: [], durations: {} };
  const [initialMessages] = useState<UIMessage[]>(stored.messages);

  // core chat hook
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: initialMessages,
  });

  // UI-specific state
  const [showProfile, setShowProfile] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true); // collapse left on mobile if needed
  const welcomeMessageShownRef = useRef<boolean>(false);

  // wire initial storage to state
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

  // show a welcome assistant message if chat empty
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

  // durations handler used by MessageWall
  const handleDurationChange = (key: string, duration: number) => {
    setDurations((prev) => {
      const next = { ...prev };
      next[key] = duration;
      return next;
    });
  };

  // react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    sendMessage({ text: data.message });
    form.reset();
  }

  function clearChat() {
    const newMessages: UIMessage[] = [];
    const newDurations = {};
    setMessages(newMessages);
    setDurations(newDurations);
    saveMessagesToStorage(newMessages, newDurations);
    toast.success("Chat cleared");
  }

  // Derive some simple "conversations" for left panel:
  // We treat each assistant message that includes "My weight" or similar as a named conversation.
  // Simpler approach: show "Main Chat" and quick presets below.
  const quickPrompts = [
    "Build a meal plan",
    "Count my calories",
    "Recipe from ingredients",
    "Vegetarian plan",
    "Keto plan",
    "Show me low-carb dinner ideas",
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      <main className="max-w-7xl mx-auto grid grid-cols-12 gap-6 px-4 py-6">
        {/* ---------- LEFT COLUMN: Conversations & Quick Actions ---------- */}
        <aside className="col-span-3 bg-white dark:bg-[#0b0b0b] rounded-2xl shadow-sm p-4 hidden lg:flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-lg">🥗</div>
              <div>
                <div className="text-sm font-semibold">NutriBuddy</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Smart nutrition chat</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => toast("This is a demo")}>
                <Plus className="size-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={clearChat}>
                <Eraser className="size-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <div className="mt-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Quick prompts</div>
              <div className="flex flex-col gap-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    className="text-left px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#0f1720] hover:bg-slate-200"
                    onClick={() => {
                      form.setValue("message", p);
                      // focus composer (if desired)
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Saved plans</div>
              <ul className="flex flex-col gap-2">
                <li className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#071218]">Vegetarian • 1800 kcal</li>
                <li className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#071218]">Low-carb • 1500 kcal</li>
              </ul>
            </div>
          </div>

          <footer className="text-xs text-slate-400">© {new Date().getFullYear()} {OWNER_NAME}</footer>
        </aside>

        {/* ---------- MAIN COLUMN: Chat Area ---------- */}
        <section className="col-span-12 lg:col-span-6 bg-white dark:bg-[#050505] rounded-2xl shadow-sm p-0 flex flex-col overflow-hidden">
          {/* Header (keeps your ChatHeader) */}
          <div className="sticky top-0 z-30 bg-transparent px-4 pt-4 pb-2">
            <ChatHeader>
              <ChatHeaderBlock />
              <ChatHeaderBlock className="justify-center items-center">
                <Avatar className="size-8 ring-1 ring-primary">
                  <AvatarImage src="/logo.png" />
                  <AvatarFallback>
                    <Image src="/logo.png" alt="Logo" width={36} height={36} />
                  </AvatarFallback>
                </Avatar>
                <p className="tracking-tight">Chat with {AI_NAME}</p>
              </ChatHeaderBlock>
              <ChatHeaderBlock className="justify-end">
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={clearChat}>
                  <PlusIcon className="size-4" />
                  {CLEAR_CHAT_TEXT}
                </Button>
              </ChatHeaderBlock>
            </ChatHeader>
          </div>

          {/* Messages scroll region */}
          <div className="px-5 py-4 h-[70vh] overflow-y-auto">
            <div className="flex flex-col items-center">
              {isClient ? (
                <>
                  <MessageWall messages={messages} status={status} durations={durations} onDurationChange={handleDurationChange} />
                  {status === "submitted" && (
                    <div className="flex justify-start max-w-3xl w-full mt-3">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-center max-w-2xl w-full">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Composer area (keeps your form) */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 bg-gradient-to-t from-transparent to-background/50">
            <form id="chat-form" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  name="message"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="chat-form-message" className="sr-only">Message</FieldLabel>
                      <div className="relative">
                        <Input
                          {...field}
                          id="chat-form-message"
                          className="h-12 pr-16 pl-4 bg-card rounded-2xl"
                          placeholder="Type your message here..."
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
                        {(status === "ready" || status === "error") && (
                          <Button
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                            type="submit"
                            disabled={!field.value.trim()}
                            size="icon"
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                        )}
                        {(status === "streaming" || status === "submitted") && (
                          <Button
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                            size="icon"
                            onClick={() => stop()}
                          >
                            <Square className="size-4" />
                          </Button>
                        )}
                      </div>
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </div>

          <div className="px-5 py-2 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {OWNER_NAME} • <Link href="/terms" className="underline">Terms of Use</Link> • Powered by <Link href="https://ringel.ai/" className="underline">Ringel.AI</Link>
          </div>
        </section>

        {/* ---------- RIGHT COLUMN: Profile & Tools ---------- */}
        <aside className="col-span-12 lg:col-span-3 bg-white dark:bg-[#0b0b0b] rounded-2xl shadow-sm p-4 hidden lg:flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Profile</h3>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Add age, height, weight, allergies, preferences for personalized plans.</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="text-xs text-slate-500">Age</div>
              <div className="text-xs text-slate-500">Height</div>
              <div className="text-xs text-slate-500">Weight</div>
            </div>
            <Button className="mt-3 w-full" onClick={() => setShowProfile(true)}>Edit Profile</Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Saved plans</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="p-2 rounded bg-slate-50 dark:bg-[#071218]">Vegetarian 1800 kcal • Export</li>
              <li className="p-2 rounded bg-slate-50 dark:bg-[#071218]">Low-carb 1500 kcal • Export</li>
            </ul>
          </div>

          <div className="mt-auto text-xs text-slate-400">Help • Privacy • Terms</div>
        </aside>
      </main>

      {/* ---------- Profile Modal ---------- */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
          <div className="bg-white dark:bg-[#051017] rounded-2xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold">Profile & Preferences</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="flex flex-col text-sm">
                Age
                <input className="mt-1 p-2 rounded border bg-transparent" />
              </label>
              <label className="flex flex-col text-sm">
                Height (cm)
                <input className="mt-1 p-2 rounded border bg-transparent" />
              </label>
              <label className="flex flex-col text-sm">
                Weight (kg)
                <input className="mt-1 p-2 rounded border bg-transparent" />
              </label>
              <label className="flex flex-col text-sm">
                Activity level
                <select className="mt-1 p-2 rounded border bg-transparent">
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
