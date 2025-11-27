"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import { ArrowUp, Loader2, Square, PlusIcon, Eraser } from "lucide-react";

import { MessageWall } from "@/components/messages/message-wall";
import { ChatHeader } from "@/app/parts/chat-header";
import { ChatHeaderBlock } from "@/app/parts/chat-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

/* ---------------- constants + storage keys ---------------- */

const STORAGE_KEY = "chat-messages"; // existing messages storage
const SAVED_CONVS_KEY = "nutribuddy-saved-convs"; // saved conversations (history)
const PROFILE_KEY = "nutribuddy-profile";

const formSchema = z.object({
  message: z.string().min(1).max(2000),
});

/* ---------------- small helper types ---------------- */

type SavedConversation = {
  id: string;
  title: string;
  createdAt: string; // ISO
  messages: UIMessage[];
};

/* ---------------- tiny helpers ---------------- */

const dateFmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const loadSavedConversations = (): SavedConversation[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_CONVS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedConversation[];
  } catch {
    return [];
  }
};

const saveSavedConversations = (convs: SavedConversation[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_CONVS_KEY, JSON.stringify(convs));
};

const loadProfile = () => {
  if (typeof window === "undefined") return { name: "", age: "", heightCm: "", weightKg: "", activity: "Moderate" };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { name: "", age: "", heightCm: "", weightKg: "", activity: "Moderate" };
    return JSON.parse(raw);
  } catch {
    return { name: "", age: "", heightCm: "", weightKg: "", activity: "Moderate" };
  }
};

const saveProfile = (p: any) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
};

/* ---------------- small UI helper - ProgressRing ---------------- */

function ProgressRing({ size = 96, stroke = 10, progress = 0 }: { size?: number; stroke?: number; progress: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="block">
      <defs>
        <linearGradient id="nutri-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={radius} fill="transparent" stroke="#EEF6F0" strokeWidth={stroke} />
        <circle
          r={radius}
          fill="transparent"
          stroke="url(#nutri-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform="rotate(-90)"
        />
        <text textAnchor="middle" dy="6" style={{ fontSize: 14, fontWeight: 600, fill: "#065F46" }}>
          {Math.round(progress)}%
        </text>
      </g>
    </svg>
  );
}

/* ---------------- MAIN PAGE (drop-in) ---------------- */

export default function ChatPage() {
  // client flags & storage
  const [isClient, setIsClient] = useState(false);
  const stored = typeof window !== "undefined" ? (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { messages: [], durations: {} };
      const parsed = JSON.parse(raw);
      return { messages: parsed.messages || [], durations: parsed.durations || {} };
    } catch {
      return { messages: [], durations: {} };
    }
  })() : { messages: [], durations: {} };

  const [initialMessages] = useState<UIMessage[]>(stored.messages || []);
  const [durations, setDurations] = useState<Record<string, number>>(stored.durations || {});
  const [isTyping, setIsTyping] = useState(false);

  // saved conversations & profile
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>(() => loadSavedConversations());
  const [profile, setProfileState] = useState(() => loadProfile());

  // chat hook
  const { messages, sendMessage, status, stop, setMessages } = useChat({ messages: initialMessages });

  // refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const welcomeShownRef = useRef(false);

  // form
  const form = useForm<{ message: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  // mount: wire storage
  useEffect(() => {
    setIsClient(true);
    setDurations(stored.durations || {});
    setMessages(stored.messages || []);
    // reload saved convs & profile
    setSavedConversations(loadSavedConversations());
    setProfileState(loadProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist messages/durations whenever they change
  useEffect(() => {
    if (!isClient) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, durations }));
    } catch (e) {
      // ignore
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [messages, durations, isClient]);

  // welcome
  useEffect(() => {
    if (isClient && initialMessages.length === 0 && !welcomeShownRef.current) {
      const welcome: UIMessage = {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text", text: WELCOME_MESSAGE }],
      };
      setMessages([welcome]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [welcome], durations: {} }));
      welcomeShownRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // durations handler used by MessageWall
  const handleDurationChange = (key: string, duration: number) => {
    setDurations((prev) => ({ ...prev, [key]: duration }));
  };

  // quick calorie parse for Insights demo
  const latestCalories = (() => {
    const txt = messages
      .map((m) => {
        if (m.parts && m.parts.length) return m.parts.map((p: any) => p.text).join(" ");
        return (m as any).text || "";
      })
      .join(" ");
    const match = txt.match(/(\d{2,4})\s?k?c?a?l?/i);
    return match ? Number(match[1]) : null;
  })();

  // progress for demo
  const calorieGoal = Number(profile?.calorieGoal) || 2200;
  const calorieProgress = Math.min(100, calorieGoal ? ((latestCalories || 0) / calorieGoal) * 100 : 0);

  /* ---------------- actions: save / load conversations ---------------- */

  function saveCurrentConversation() {
    // prompt for title
    const title = window.prompt("Enter a title for this conversation (e.g., 'Weight loss plan - Jan 5')", `Chat ${new Date().toLocaleString()}`);
    if (!title) return;
    const conv: SavedConversation = {
      id: `conv-${Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      messages: messages,
    };
    const next = [conv, ...savedConversations].slice(0, 50);
    setSavedConversations(next);
    saveSavedConversations(next);
    toast.success("Conversation saved");
  }

  function loadConversation(conv: SavedConversation) {
    setMessages(conv.messages);
    // persist to main storage as active chat
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: conv.messages, durations }));
    toast.success(`Loaded "${conv.title}"`);
  }

  function deleteConversation(convId: string) {
    const next = savedConversations.filter((c) => c.id !== convId);
    setSavedConversations(next);
    saveSavedConversations(next);
    toast.success("Removed conversation");
  }

  function clearChat() {
    setMessages([]);
    setDurations({});
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [], durations: {} }));
    } catch {}
    toast.success("Chat cleared");
  }

  function onSubmit(data: { message: string }) {
    setIsTyping(true);
    sendMessage({ text: data.message });
    form.reset();
    setTimeout(() => setIsTyping(false), 1000);
  }

  // profile editing (inline)
  function updateProfile(updates: Partial<any>) {
    const next = { ...profile, ...updates };
    setProfileState(next);
    saveProfile(next);
    toast.success("Profile updated");
  }

  const quickPrompts = [
    "Create a 1800 kcal vegetarian day plan",
    "High-protein snack ideas",
    "Count calories: 1 bowl rice, dal, salad",
  ];

  /* ---------------- UI (background pattern + panels) ---------------- */

  return (
    <div
      // patterned background — light subtle SVG repeated via CSS background-image inline
      style={{
        backgroundImage:
          `radial-gradient(circle at 1px 1px, rgba(34,197,94,0.03) 0.5px, transparent 0.5px)`,
        backgroundSize: "10px 10px",
      }}
      className="min-h-screen font-sans antialiased"
    >
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6">
        {/* LEFT: profile + saved chats (panel) */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          {/* Personal data card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-xl">🥗</div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Personal data</div>
                  <div className="text-xs text-slate-500">Editable — saved locally</div>
                </div>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => { document.getElementById("profile-name")?.focus(); }}>
                  Edit
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <label className="flex flex-col">
                <span className="text-xs text-slate-500">Name</span>
                <input id="profile-name" value={profile.name || ""} onChange={(e) => updateProfile({ name: e.target.value })} className="mt-1 p-2 rounded border border-slate-100" />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col text-xs">
                  <span className="text-slate-500">Age</span>
                  <input value={profile.age || ""} onChange={(e) => updateProfile({ age: e.target.value })} className="mt-1 p-2 rounded border border-slate-100" />
                </label>
                <label className="flex flex-col text-xs">
                  <span className="text-slate-500">Height (cm)</span>
                  <input value={profile.heightCm || ""} onChange={(e) => updateProfile({ heightCm: e.target.value })} className="mt-1 p-2 rounded border border-slate-100" />
                </label>
                <label className="flex flex-col text-xs">
                  <span className="text-slate-500">Weight (kg)</span>
                  <input value={profile.weightKg || ""} onChange={(e) => updateProfile({ weightKg: e.target.value })} className="mt-1 p-2 rounded border border-slate-100" />
                </label>
              </div>

              <label className="flex flex-col text-xs">
                <span className="text-slate-500">Activity level</span>
                <select value={profile.activity || "Moderate"} onChange={(e) => updateProfile({ activity: e.target.value })} className="mt-1 p-2 rounded border border-slate-100">
                  <option>Sedentary</option>
                  <option>Light</option>
                  <option>Moderate</option>
                  <option>Active</option>
                </select>
              </label>
            </div>
          </div>

          {/* Saved conversations list */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-800">Past chats</div>
              <div className="text-xs text-slate-500">{savedConversations.length} saved</div>
            </div>

            {savedConversations.length === 0 ? (
              <div className="text-xs text-slate-500">No saved conversations yet. Use "Save" in the chat header.</div>
            ) : (
              <ul className="space-y-2">
                {savedConversations.map((c) => (
                  <li key={c.id} className="p-2 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-between">
                    <div>
                      <button onClick={() => loadConversation(c)} className="text-sm font-medium text-slate-800 text-left">
                        {c.title}
                      </button>
                      <div className="text-xs text-slate-500">{dateFmt(c.createdAt)}</div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <button onClick={() => loadConversation(c)} className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Open</button>
                      <button onClick={() => deleteConversation(c.id)} className="text-xs text-red-500 mt-1">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* CENTER: chat area */}
        <section className="col-span-12 lg:col-span-6 flex flex-col gap-4">
          {/* top hero */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">🥗</div>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">NutriBuddy</h1>
                <p className="text-xs text-slate-500">Smart Nutrition Chat — personalized to you</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={saveCurrentConversation}><PlusIcon className="size-4 mr-1" />Save</Button>
              <Button variant="outline" size="sm" onClick={clearChat}><Eraser className="size-4 mr-1" />Clear</Button>
            </div>
          </div>

          {/* chat card with internal scroll + sticky composer */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col h-[72vh] overflow-hidden">
            {/* header inside */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="/logo.png" />
                  <AvatarFallback>NB</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium text-slate-800">Conversation</div>
                  <div className="text-xs text-slate-500">Chat with {AI_NAME}</div>
                </div>
              </div>

              <div className="text-xs text-slate-500">Status: {status}</div>
            </div>

            {/* messages: scroll inside */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                <MessageWall messages={messages} status={status} durations={durations} onDurationChange={handleDurationChange} />

                {isTyping && (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">AI</div>
                    <div className="px-3 py-2 rounded-lg bg-slate-100">NutriBuddy is typing…</div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* composer */}
            <div className="sticky bottom-0 bg-white px-4 py-4 border-t border-slate-100">
              <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto">
                <FieldGroup>
                  <Controller
                    name="message"
                    control={form.control}
                    render={({ field }) => (
                      <Field className="flex items-center gap-3">
                        <Input
                          {...field}
                          placeholder="Type: 'Build me a 1500 kcal vegetarian dinner'"
                          className="flex-1 h-14 rounded-full border border-slate-200 shadow-sm px-5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />

                        {(status === "ready" || status === "error") && (
                          <Button type="submit" size="icon" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md" disabled={!field.value.trim()}>
                            <ArrowUp className="size-4 text-white" />
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

        {/* RIGHT: Insights */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Today's snapshot</h3>
            <p className="text-xs text-slate-500 mt-1">Calories & macros</p>

            <div className="mt-4 flex items-center gap-4">
              <ProgressRing size={96} stroke={10} progress={calorieProgress} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">{latestCalories ? `${latestCalories} kcal logged` : "No calories logged"}</div>
                <div className="text-xs text-slate-500 mt-2">Goal: {calorieGoal} kcal</div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-800">Protein</div>
                    <div className="text-xs text-slate-500">30g</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-800">Carbs</div>
                    <div className="text-xs text-slate-500">60g</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-800">Fat</div>
                    <div className="text-xs text-slate-500">20g</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success("Exported (demo)")}>Export</Button>
              <Button size="sm" onClick={() => toast.success("Saved (demo)")}>Save</Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Suggested meals</h3>
            <ul className="mt-3 space-y-3">
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
                  <div>
                    <button
                      className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm"
                      onClick={() => {
                        form.setValue("message", `Recipe: ${m.title} — portions and calories please.`);
                        toast.success("Loaded into composer (press Enter)");
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
