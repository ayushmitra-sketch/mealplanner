"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import { ArrowUp, Loader2, Square, PlusIcon } from "lucide-react";

import { MessageWall } from "@/components/messages/message-wall";
import { ChatHeader } from "@/app/parts/chat-header";
import { ChatHeaderBlock } from "@/app/parts/chat-header";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
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
  message: z.string().min(1).max(2000),
});

const STORAGE_KEY = "chat-messages-v2";

const loadMessagesFromStorage = (): { messages: UIMessage[]; durations: Record<string, number> } => {
  if (typeof window === "undefined") return { messages: [], durations: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], durations: {} };
    const parsed = JSON.parse(raw);
    return {
      messages: parsed.messages || [],
      durations: parsed.durations || {},
    };
  } catch (e) {
    console.error("loadMessages error", e);
    return { messages: [], durations: {} };
  }
};

const saveMessagesToStorage = (messages: UIMessage[], durations: Record<string, number>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, durations }));
  } catch (e) {
    console.error("saveMessages error", e);
  }
};

/* ---------------- Utility components ---------------- */

function ProgressRing({ size = 120, stroke = 10, progress = 0 }: { size?: number; stroke?: number; progress: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="block">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38A169" />
          <stop offset="100%" stopColor="#2F855A" />
        </linearGradient>
      </defs>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={radius} fill="transparent" stroke="#e6f0ea" strokeWidth={stroke} />
        <circle
          r={radius}
          fill="transparent"
          stroke="url(#g1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform="rotate(-90)"
        />
        <text textAnchor="middle" dy="6" className="text-[18px] font-semibold" style={{ fill: "#22543D" }}>
          {Math.round(progress)}%
        </text>
      </g>
    </svg>
  );
}

/* ---------------- Main page ---------------- */

export default function ChatPage() {
  // client state
  const [isClient, setIsClient] = useState(false);
  const stored = typeof window !== "undefined" ? loadMessagesFromStorage() : { messages: [], durations: {} };
  const [initialMessages] = useState<UIMessage[]>(stored.messages);
  const [durations, setDurations] = useState<Record<string, number>>(stored.durations || {});
  const [isTyping, setIsTyping] = useState(false);

  // chat hook
  const { messages, sendMessage, status, stop, setMessages } = useChat({ messages: initialMessages });

  // typed ref for autoscroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const welcomeShownRef = useRef(false);

  // mock user profile (for insights demo)
  const [profile, setProfile] = useState({ age: 28, heightCm: 172, weightKg: 72, calorieGoal: 2200 });

  // on mount: set client & load
  useEffect(() => {
    setIsClient(true);
    setDurations(stored.durations || {});
    setMessages(stored.messages || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(() => {
    if (isClient) saveMessagesToStorage(messages, durations);
  }, [messages, durations, isClient]);

  // welcome if empty
  useEffect(() => {
    if (isClient && initialMessages.length === 0 && !welcomeShownRef.current) {
      const w: UIMessage = {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text", text: WELCOME_MESSAGE }],
      };
      setMessages([w]);
      saveMessagesToStorage([w], {});
      welcomeShownRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // durations handler (from MessageWall)
  const handleDurationChange = (key: string, duration: number) => {
    setDurations((prev) => ({ ...prev, [key]: duration }));
  };

  // form
  const form = useForm<{ message: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  function onSubmit(data: { message: string }) {
    // UI polish: set typing until assistant responds (useChat manages responses)
    setIsTyping(true);
    sendMessage({ text: data.message });
    form.reset();
    // fallback hide typing after 1200ms in case streaming is slow
    setTimeout(() => setIsTyping(false), 1200);
  }

  function clearChat() {
    setMessages([]);
    setDurations({});
    saveMessagesToStorage([], {});
    toast.success("Chat cleared");
  }

  // derive simple metrics for Insights panel
  const latestCalories = (() => {
    // naive parse: search messages for numbers + kcal — demo only
    const text = messages.map((m) => (m.parts?.map(p => (p as any).text).join(" ") || (m as any).text || "")).join(" ");
    const match = text.match(/(\d{2,4})\s?k?c?a?l?/i);
    return match ? Number(match[1]) : null;
  })();

  const calorieProgress = Math.min(100, profile.calorieGoal ? ((latestCalories || 0) / profile.calorieGoal) * 100 : 0);

  // quick prompts for flow
  const quickPrompts = [
    "Create a 1800 kcal vegetarian day plan",
    "Suggest a high-protein snack",
    "Count calories for: 1 bowl rice, dal, salad",
  ];

  /* ---------------- Render ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#F6FBF7] font-sans antialiased">
      <main className="max-w-7xl mx-auto grid grid-cols-12 gap-6 p-6">
        {/* LEFT NAV (mini) */}
        <nav className="col-span-1 hidden lg:flex flex-col items-center gap-4 pt-6">
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">🥗</div>
          <button title="Home" className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">🏠</button>
          <button title="Analytics" className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">📈</button>
          <button title="Saved" className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">💾</button>
          <div className="mt-auto text-xs text-slate-400">v1.0</div>
        </nav>

        {/* CENTER: Chat */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          {/* Hero header (large, elegant) */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_6px_24px_rgba(17,24,39,0.06)] border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">🥗</div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800">NutriBuddy — Smart Nutrition Chat</h1>
                <p className="text-sm text-slate-500 mt-1">Ask about meals, calories, recipes, or upload a photo of your plate.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={clearChat}><PlusIcon className="size-4 mr-1" />New</Button>
              <Button size="sm" onClick={() => toast.success("Saved to profile (demo)")}>Save</Button>
            </div>
          </div>

          {/* Chat card */}
          <div className="bg-white rounded-3xl p-4 shadow-lg border border-slate-100 flex-1 flex flex-col overflow-hidden">
            {/* header inside card */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Avatar>
                    <AvatarImage src="/logo.png" />
                    <AvatarFallback>NB</AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">Conversation</div>
                  <div className="text-xs text-slate-500">Live chat with {AI_NAME}</div>
                </div>
              </div>

              <div className="text-sm text-slate-500">Status: {status}</div>
            </div>

            {/* messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                {/* MessageWall delegates rendering; keep it */}
                <MessageWall messages={messages} status={status} durations={durations} onDurationChange={handleDurationChange} />

                {/* compact typing indicator */}
                {isTyping && (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">AI</div>
                    <div className="px-3 py-2 rounded-lg bg-slate-100">NutriBuddy is typing…</div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* composer area (sticky look) */}
            <div className="px-4 py-4 border-t border-slate-100 bg-gradient-to-t from-white to-transparent">
              <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto">
                <FieldGroup>
                  <Controller
                    name="message"
                    control={form.control}
                    render={({ field }) => (
                      <Field className="flex items-center gap-3">
                        <Input
                          {...field}
                          placeholder="Type: 'Build a vegetarian 1800 kcal plan' or paste a meal..."
                          className="flex-1 h-14 rounded-full border border-slate-200 shadow-sm px-5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />

                        {/* send / stop */}
                        {(status === "ready" || status === "error") && (
                          <Button type="submit" size="icon" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                            <ArrowUp className="size-4" />
                          </Button>
                        )}
                        {(status === "streaming" || status === "submitted") && (
                          <Button size="icon" className="rounded-full bg-slate-100" onClick={() => stop()}>
                            <Square className="size-4 text-slate-700" />
                          </Button>
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>

                {/* quick prompt row */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        form.setValue("message", q);
                        toast.success("Prompt loaded — press Enter to send");
                      }}
                      className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* RIGHT: Insights & suggestions */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Today's snapshot</h3>
            <p className="text-xs text-slate-500 mt-1">Calories & macros (quick view)</p>

            <div className="mt-4 flex items-center gap-4">
              <div>
                <ProgressRing size={120} stroke={10} progress={calorieProgress} />
              </div>

              <div className="flex-1">
                <div className="text-sm text-slate-700 font-semibold">{latestCalories ? `${latestCalories} kcal logged` : "No calories logged"}</div>
                <div className="text-xs text-slate-500 mt-2">Goal: {profile.calorieGoal} kcal</div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-800">30g</div>
                    <div className="text-xs text-slate-500">Protein</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-800">60g</div>
                    <div className="text-xs text-slate-500">Carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-800">20g</div>
                    <div className="text-xs text-slate-500">Fat</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => toast("Exported (demo)")}>Export</Button>
              <Button size="sm" onClick={() => toast("Saved to meal plans (demo)")}>Save plan</Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Suggested meals</h3>
            <p className="text-xs text-slate-500 mt-1">Ready-to-send meal suggestions</p>

            <ul className="mt-4 space-y-3">
              {[
                { title: "Grilled paneer bowl", kcal: 420 },
                { title: "Quinoa salad with roasted veg", kcal: 350 },
                { title: "Chickpea curry + brown rice", kcal: 560 },
              ].map((m) => (
                <li key={m.title} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{m.title}</div>
                    <div className="text-xs text-slate-500">{m.kcal} kcal</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm"
                      onClick={() => {
                        // load meal into message composer (user must press enter)
                        toast.success("Loaded into composer (press Enter)");
                        form.setValue("message", `Recipe: ${m.title} — please give portions and calories.`);
                      }}
                    >
                      Load
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-xs text-slate-500">
            © {new Date().getFullYear()} {OWNER_NAME} • <Link href="/terms" className="underline">Terms</Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
