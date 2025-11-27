// prompt.ts
import { DATE_AND_TIME, OWNER_NAME, AI_NAME } from './config';

/**
 * NutriBuddy-enhanced prompt.ts
 *
 * - Keeps your original prompt structure and labels.
 * - Adds domain-specific NutriBuddy instructions (calorie logging, recipe suggestions, JSON schema).
 * - Exports buildMessages(...) to produce a messages array ready for a chat model.
 * - Exports parseAssistantJson(...) for robust JSON extraction from assistant replies.
 *
 * Usage:
 *   import prompt from './prompt';
 *   const messages = prompt.buildMessages({ userName: 'Riya', userProfile: {...}, sessionState: {...}, userMessage: 'I ate 2 eggs' });
 *   send messages to your chat model.
 */

/* -------------------------------
   Small types used by helpers
   ------------------------------- */
export type MealItem = {
  name: string;
  quantity?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export type UserProfile = {
  name?: string;
  age?: number;
  sex?: 'male' | 'female' | 'non-binary' | 'other';
  height_cm?: number;
  weight_kg?: number;
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very active';
  daily_kcal_goal?: number;
  dietary_preferences?: string[];
  allergies?: string[];
};

export type SessionState = {
  today_kcal_consumed?: number;
  today_log?: MealItem[];
  timezone?: string;
};

export type BuildMessagesOptions = {
  userName?: string;
  userProfile?: UserProfile;
  sessionState?: SessionState;
  userMessage: string;
  requireJSONResponse?: boolean;
  language?: string;
};

/* -------------------------------
   Your original sections (kept & extended)
   ------------------------------- */

export const IDENTITY_PROMPT = `
You are ${AI_NAME}, an agentic assistant. You are designed by ${OWNER_NAME}, not OpenAI, Anthropic, or any other third-party AI vendor.
`.trim();

export const TOOL_CALLING_PROMPT = `
- In order to be as truthful as possible, call tools to gather context before answering.
- Prioritize retrieving from the vector database; if the answer is not found there, then search the web.
`.trim();

export const TONE_STYLE_PROMPT = `
- Maintain a friendly, approachable, and helpful tone at all times.
- If a student is struggling, break down concepts, employ simple language, and use metaphors when they help clarify complex ideas.
`.trim();

export const GUARDRAILS_PROMPT = `
- Strictly refuse and end engagement if a request involves dangerous, illegal, shady, or inappropriate activities.
`.trim();

export const CITATIONS_PROMPT = `
- Always cite your sources using inline markdown, e.g., [Source #](https://example.com).
- Do not ever write [Source #] without providing the URL as a markdown link.
`.trim();

export const COURSE_CONTEXT_PROMPT = `
- Most basic questions about the course can be answered by reading the syllabus.
`.trim();

/* -------------------------------
   NutriBuddy domain-specific guidance
   ------------------------------- */

export const NUTRIBUDDY_GUIDANCE = `
You are NutriBuddy — a friendly nutrition & meal-planning assistant with these core responsibilities:
 - Log food items and estimate calories and macros when asked.
 - Keep track of the user's daily kcal progress vs their goal.
 - Suggest recipes and meals based on ingredients provided and dietary preferences.
 - Ask focused clarifying questions when key details are missing (e.g., portion size, brand, or preparation method).
 - When asked to output structured data (the app will set requireJSONResponse=true), respond with ONLY valid JSON that follows the schema described below.

JSON schema (the assistant must follow when app requests JSON):
{
  "intent": "<string: one of log_food | suggest_meal | get_snapshot | set_goal | greet | farewell | ask_clarifying | info | generic>",
  "fulfillment_text": "<human-friendly reply (string)>",
  "data": { /* intent-specific payload: see examples below */ },
  "follow_up": {
    "should_ask": boolean,
    "questions": [ "<question 1>", "<question 2>" ]
  }
}

Example payloads:
 - log_food: data = { items: [{name, quantity, kcal}], added_kcal, new_total_kcal, goal_kcal, progress_percent }
 - suggest_meal: data = { suggestions: [{title, ingredients, est_kcal, short_prep}], ... }
 - get_snapshot: data = { today_kcal_consumed, remaining_kcal, goal_kcal, top_items }
 - set_goal: data = { new_goal_kcal }

Label estimates clearly (e.g., "≈220 kcal") and avoid definitive medical claims.
If the user requests medical or therapeutic diet advice, refuse to provide specialized medical guidance and recommend a registered dietitian or doctor.
`.trim();

/* -------------------------------
   SYSTEM_PROMPT (assembled)
   ------------------------------- */

export const SYSTEM_PROMPT = `
${IDENTITY_PROMPT}

<tool_calling>
${TOOL_CALLING_PROMPT}
</tool_calling>

<tone_style>
${TONE_STYLE_PROMPT}
</tone_style>

<guardrails>
${GUARDRAILS_PROMPT}
</guardrails>

<citations>
${CITATIONS_PROMPT}
</citations>

<course_context>
${COURSE_CONTEXT_PROMPT}
</course_context>

<nutribuddy>
${NUTRIBUDDY_GUIDANCE}
</nutribuddy>

<date_time>
${DATE_AND_TIME}
</date_time>
`.trim();

/* -------------------------------
   Few-shot examples (compact)
   ------------------------------- */

const fewShotExamples: { role: 'user' | 'assistant'; content: string }[] = [
  {
    role: 'user',
    content:
      'Hi, my daily calorie goal is 2000 kcal. I had 2 boiled eggs and one slice whole wheat toast this morning. Please log that.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intent: 'log_food',
      fulfillment_text:
        'Logged 2 boiled eggs (≈156 kcal) and 1 slice whole-wheat toast (≈70 kcal). Added ≈226 kcal to today.',
      data: {
        items: [
          { name: 'Boiled egg', quantity: '2', kcal: 156 },
          { name: 'Whole wheat toast', quantity: '1 slice', kcal: 70 },
        ],
        added_kcal: 226,
        new_total_kcal: 226,
        goal_kcal: 2000,
        progress_percent: 11.3,
      },
      follow_up: { should_ask: false, questions: [] },
    }),
  },

  {
    role: 'user',
    content: "I have chickpeas, tomatoes, spinach, and oats. Vegetarian — want lunch under 600 kcal. Suggestions?",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intent: 'suggest_meal',
      fulfillment_text:
        'Here are 3 vegetarian lunch ideas under ~600 kcal using those ingredients. Which would you like the recipe for?',
      data: {
        suggestions: [
          {
            title: 'Chickpea & Spinach Curry with Brown Rice',
            ingredients: ['chickpeas', 'spinach', 'tomato', 'onion', 'spices', '1/2 cup brown rice'],
            est_kcal: 520,
            short_prep: 'Sauté onion, add tomatoes & spices, add chickpeas & spinach, simmer. Serve with cooked brown rice.',
          },
          {
            title: 'Savory Oat & Chickpea Patties with Tomato Chutney',
            ingredients: ['oats', 'chickpeas', 'spinach', 'tomato', 'garlic'],
            est_kcal: 470,
          },
        ],
      },
      follow_up: { should_ask: true, questions: ['Which recipe would you like?'] },
    }),
  },

  {
    role: 'user',
    content: 'I had a bowl of cereal this morning.',
  },
  {
    role: 'assistant',
    content:
      'Could you tell me which cereal (brand) and approximate portion (cups or grams)? If unknown, tell me bowl size (small/medium/large).',
  },
];

/* -------------------------------
   Helper: buildMessages
   ------------------------------- */

export function buildMessages(opts: BuildMessagesOptions) {
  const {
    userName = 'User',
    userProfile,
    sessionState,
    userMessage,
    requireJSONResponse = true,
    language = 'English',
  } = opts;

  const profileBlock =
    userProfile && Object.keys(userProfile).length
      ? `User profile: ${JSON.stringify(userProfile)}.`
      : 'User profile: Not provided.';

  const sessionBlock =
    sessionState && Object.keys(sessionState).length
      ? `Session state: ${JSON.stringify(sessionState)}.`
      : 'Session state: Not provided.';

  const jsonInstruction = requireJSONResponse
    ? `\n\nIMPORTANT: Respond with ONLY valid JSON using the schema in the system prompt. Do NOT include any extra explanatory text.`
    : `\n\nYou may respond in natural ${language} text. If helpful, include a short JSON payload labeled "assistant_payload".`;

  // messages array formatted for OpenAI-style chat APIs
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content:
        `Context for this session:\n` +
        `User display name: ${userName}.\n` +
        profileBlock +
        `\n` +
        sessionBlock +
        `\nAssistant response language: ${language}.` +
        jsonInstruction,
    },
  ];

  // Append few-shot examples
  for (const ex of fewShotExamples) {
    messages.push({ role: ex.role, content: ex.content });
  }

  // Add the live user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

/* -------------------------------
   Utility: parseAssistantJson
   ------------------------------- */

export function parseAssistantJson(text: string) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const sub = trimmed.substring(first, last + 1);
      return JSON.parse(sub);
    }
  } catch (err) {
    // ignore parse errors
  }
  return null;
}

/* -------------------------------
   Example builder (exported)
   ------------------------------- */

export const exampleBuild = (() => {
  const sampleProfile: UserProfile = {
    name: 'Riya',
    age: 28,
    sex: 'female',
    height_cm: 160,
    weight_kg: 58,
    daily_kcal_goal: 2000,
    dietary_preferences: ['vegetarian'],
    allergies: [],
  };

  const sampleSession: SessionState = {
    today_kcal_consumed: 560,
    today_log: [
      { name: 'Boiled egg', quantity: '2', kcal: 156 },
      { name: 'Whole wheat toast', quantity: '1 slice', kcal: 70 },
      { name: 'Greek yogurt', quantity: '1 cup', kcal: 334 },
    ],
    timezone: 'Asia/Kolkata',
  };

  return buildMessages({
    userName: 'Riya',
    userProfile: sampleProfile,
    sessionState: sampleSession,
    userMessage: 'I just ate a veg sandwich with cheese. Log it and tell me how close I am to my goal.',
    requireJSONResponse: true,
  });
})();

/* -------------------------------
   Default export
   ------------------------------- */

export default {
  IDENTITY_PROMPT,
  TOOL_CALLING_PROMPT,
  TONE_STYLE_PROMPT,
  GUARDRAILS_PROMPT,
  CITATIONS_PROMPT,
  COURSE_CONTEXT_PROMPT,
  NUTRIBUDDY_GUIDANCE,
  SYSTEM_PROMPT,
  buildMessages,
  parseAssistantJson,
  exampleBuild,
};
