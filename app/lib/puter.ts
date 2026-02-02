import { create } from "zustand";

declare global {
  interface Window {
    puter: {
      auth: {
        getUser: () => Promise<PuterUser>;
        isSignedIn: () => Promise<boolean>;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
      };
      fs: {
        write: (path: string, data: string | File | Blob) => Promise<File | undefined>;
        read: (path: string) => Promise<Blob>;
        upload: (file: File[] | Blob[]) => Promise<FSItem>;
        delete: (path: string) => Promise<void>;
        readdir: (path: string) => Promise<FSItem[] | undefined>;
      };
      ai: {
        chat: (
          prompt: string | ChatMessage[],
          imageURL?: string | PuterChatOptions,
          testMode?: boolean,
          options?: PuterChatOptions
        ) => Promise<Object>;
        img2txt: (image: string | File | Blob, testMode?: boolean) => Promise<string>;
      };
      kv: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<boolean>;
        delete: (key: string) => Promise<boolean>;
        list: (pattern: string, returnValues?: boolean) => Promise<string[]>;
        flush: () => Promise<boolean>;
      };
    };
  }
}

interface PuterStore {
  isLoading: boolean;
  error: string | null;
  puterReady: boolean;

  auth: {
    user: PuterUser | null;
    isAuthenticated: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    checkAuthStatus: () => Promise<boolean>;
    getUser: () => PuterUser | null;
  };

  fs: {
    write: (path: string, data: string | File | Blob) => Promise<File | undefined>;
    read: (path: string) => Promise<Blob | undefined>;
    upload: (file: File[] | Blob[]) => Promise<FSItem | undefined>;
    delete: (path: string) => Promise<void>;
    readDir: (path: string) => Promise<FSItem[] | undefined>;
  };

  ai: {
    chat: (
      prompt: string | ChatMessage[],
      imageURL?: string | PuterChatOptions,
      testMode?: boolean,
      options?: PuterChatOptions
    ) => Promise<AIResponse | undefined>;

    /**
     * Generates ATS feedback using Puter AI if available.
     * Falls back to Ollama (local LLM) if Puter fails or has no credits.
     */
    feedback: (path: string, message: string) => Promise<AIResponse | undefined>;

    img2txt: (image: string | File | Blob, testMode?: boolean) => Promise<string | undefined>;
  };

  kv: {
    get: (key: string) => Promise<string | null | undefined>;
    set: (key: string, value: string) => Promise<boolean | undefined>;
    delete: (key: string) => Promise<boolean | undefined>;
    list: (pattern: string, returnValues?: boolean) => Promise<string[] | KVItem[] | undefined>;
    flush: () => Promise<boolean | undefined>;
  };

  init: () => void;
  clearError: () => void;
}

const getPuter = (): typeof window.puter | null =>
  typeof window !== "undefined" && window.puter ? window.puter : null;

/**
 * ===== Ollama Local AI settings =====
 * Change the model to what you actually pulled, e.g.:
 *  - "llama3.2:3b"
 *  - "qwen2.5:3b"
 *  - "llama3.1:8b" (big)
 */
const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";

/**
 * Converts a Blob (PDF) to base64 string (for optional OCR / future use).
 * Not required for current feedback flow, but useful if you want to extract text locally later.
 */
async function blobToTextSafe(blob: Blob): Promise<string> {
  try {
    return await blob.text();
  } catch {
    return "";
  }
}

/**
 * Normalize Ollama output into your app's expected AIResponse-like shape.
 * Your UI expects overallScore + categories with tips.
 */
function toAIResponseFromJSON(parsed: any): AIResponse {
  // Try to map to the shape your UI expects
  // If your AIResponse differs, adjust here once and the rest of the app stays stable.
  return {
    id: crypto.randomUUID(),
    overallScore: parsed?.overallScore ?? parsed?.overall_score ?? 70,
    content: parsed?.content ?? { score: parsed?.contentScore ?? 70, tips: parsed?.contentTips ?? [] },
    skills: parsed?.skills ?? { score: 70, tips: parsed?.skillsTips ?? [], missing: parsed?.skillsMissing ?? [] },
    structure: parsed?.structure ?? { score: 70, tips: parsed?.structureTips ?? [] },
    toneAndStyle: parsed?.toneAndStyle ?? parsed?.tone_and_style ?? { score: 70, tips: parsed?.toneTips ?? [] },
    tips: parsed?.tips ?? [],
    // Keep any extra fields
    ...(parsed ?? {}),
  } as AIResponse;
}

/**
 * Calls Ollama locally with a strict "JSON only" prompt.
 * If JSON parsing fails, we return a safe fallback response.
 */
async function ollamaFeedback(prompt: string): Promise<AIResponse> {
  const strictPrompt = `
You are an ATS resume analyzer.

Return ONLY valid JSON. No markdown. No explanations outside JSON.

Required JSON schema:
{
  "overallScore": number,
  "content": { "score": number, "tips": Array<{ "type": "good"|"improve", "tip": string, "explanation"?: string }> },
  "skills": { "score": number, "tips": Array<{ "type": "good"|"improve", "tip": string, "explanation"?: string }> },
  "structure": { "score": number, "tips": Array<{ "type": "good"|"improve", "tip": string, "explanation"?: string }> },
  "toneAndStyle": { "score": number, "tips": Array<{ "type": "good"|"improve", "tip": string, "explanation"?: string }> },
  "tips": Array<{ "type": "good"|"improve", "tip": string, "explanation"?: string }>
}

Analyze based on the following input:
${prompt}
`.trim();

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: strictPrompt,
      stream: false,
      options: {
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Ollama request failed (${res.status}): ${txt}`);
  }

  const data = (await res.json()) as { response?: string };

  const raw = data?.response ?? "";
  try {
    // Some models may add whitespace/newlines — trim is fine
    const parsed = JSON.parse(raw.trim());
    return toAIResponseFromJSON(parsed);
  } catch {
    // Fallback if model didn't return valid JSON
    return toAIResponseFromJSON({
      overallScore: 65,
      tips: [
        { type: "improve", tip: "AI returned non-JSON output. Try a different model or simplify the input." },
      ],
      content: { score: 65, tips: [{ type: "improve", tip: "Add more role-specific keywords and measurable achievements." }] },
      skills: { score: 60, tips: [{ type: "improve", tip: "List key tools/skills explicitly to improve ATS matching." }] },
      structure: { score: 70, tips: [{ type: "good", tip: "Structure looks mostly clear; ensure consistent headings and spacing." }] },
      toneAndStyle: { score: 65, tips: [{ type: "improve", tip: "Use stronger action verbs and quantify results." }] },
    });
  }
}

export const usePuterStore = create<PuterStore>((set, get) => {
  const setError = (msg: string) => {
    set({
      error: msg,
      isLoading: false,
      auth: {
        user: null,
        isAuthenticated: false,
        signIn: get().auth.signIn,
        signOut: get().auth.signOut,
        refreshUser: get().auth.refreshUser,
        checkAuthStatus: get().auth.checkAuthStatus,
        getUser: get().auth.getUser,
      },
    });
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const isSignedIn = await puter.auth.isSignedIn();
      if (isSignedIn) {
        const user = await puter.auth.getUser();
        set({
          auth: {
            user,
            isAuthenticated: true,
            signIn: get().auth.signIn,
            signOut: get().auth.signOut,
            refreshUser: get().auth.refreshUser,
            checkAuthStatus: get().auth.checkAuthStatus,
            getUser: () => user,
          },
          isLoading: false,
        });
        return true;
      } else {
        set({
          auth: {
            user: null,
            isAuthenticated: false,
            signIn: get().auth.signIn,
            signOut: get().auth.signOut,
            refreshUser: get().auth.refreshUser,
            checkAuthStatus: get().auth.checkAuthStatus,
            getUser: () => null,
          },
          isLoading: false,
        });
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to check auth status";
      setError(msg);
      return false;
    }
  };

  const signIn = async (): Promise<void> => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await puter.auth.signIn();
      await checkAuthStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
    }
  };

  const signOut = async (): Promise<void> => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await puter.auth.signOut();
      set({
        auth: {
          user: null,
          isAuthenticated: false,
          signIn: get().auth.signIn,
          signOut: get().auth.signOut,
          refreshUser: get().auth.refreshUser,
          checkAuthStatus: get().auth.checkAuthStatus,
          getUser: () => null,
        },
        isLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign out failed";
      setError(msg);
    }
  };

  const refreshUser = async (): Promise<void> => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const user = await puter.auth.getUser();
      set({
        auth: {
          user,
          isAuthenticated: true,
          signIn: get().auth.signIn,
          signOut: get().auth.signOut,
          refreshUser: get().auth.refreshUser,
          checkAuthStatus: get().auth.checkAuthStatus,
          getUser: () => user,
        },
        isLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to refresh user";
      setError(msg);
    }
  };

  const init = (): void => {
    const puter = getPuter();
    if (puter) {
      set({ puterReady: true });
      checkAuthStatus();
      return;
    }

    const interval = setInterval(() => {
      if (getPuter()) {
        clearInterval(interval);
        set({ puterReady: true });
        checkAuthStatus();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      if (!getPuter()) {
        setError("Puter.js failed to load within 10 seconds");
      }
    }, 10000);
  };

  const write = async (path: string, data: string | File | Blob) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.fs.write(path, data);
  };

  const readDir = async (path: string) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.fs.readdir(path);
  };

  const readFile = async (path: string) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.fs.read(path);
  };

  const upload = async (files: File[] | Blob[]) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.fs.upload(files);
  };

  const deleteFile = async (path: string) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.fs.delete(path);
  };

  const chat = async (
    prompt: string | ChatMessage[],
    imageURL?: string | PuterChatOptions,
    testMode?: boolean,
    options?: PuterChatOptions
  ) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.ai.chat(prompt, imageURL, testMode, options) as Promise<AIResponse | undefined>;
  };

  /**
   * ===== Updated feedback() =====
   * 1) Try Puter AI (if you have credits)
   * 2) If it errors, fallback to local Ollama
   */
  const feedback = async (path: string, message: string) => {
    const puter = getPuter();

    // If Puter isn't available at all, go straight to Ollama
    if (!puter) {
      // We don't have resume text here yet; message likely contains jobDesc + instructions
      // We'll try to also read the file content if possible.
      // If read fails, Ollama still responds based on message alone.
      try {
        // Optional: attempt to read PDF blob and include minimal info
        const blob = await readFile(path);
        const fileText = blob ? await blobToTextSafe(blob) : "";
        const combined = `${message}\n\n(Resume file path: ${path})\n(Resume raw text if extractable: ${fileText.slice(
          0,
          6000
        )})`;
        return await ollamaFeedback(combined);
      } catch (e) {
        return await ollamaFeedback(message);
      }
    }

    // Try Puter first
    try {
      return (await puter.ai.chat(
        [
          {
            role: "user",
            content: [
              { type: "file", puter_path: path },
              { type: "text", text: message },
            ],
          },
        ],
        { model: "claude-3-7-sonnet" as any }
      )) as AIResponse | undefined;
    } catch (err) {
      // Fallback to Ollama if Puter fails (credits, rate limit, etc.)
      try {
        const blob = await readFile(path);
        const fileText = blob ? await blobToTextSafe(blob) : "";
        const combined = `${message}\n\n(Resume file path: ${path})\n(Resume raw text if extractable: ${fileText.slice(
          0,
          6000
        )})`;
        const local = await ollamaFeedback(combined);
        return local;
      } catch {
        const local = await ollamaFeedback(message);
        return local;
      }
    }
  };

  const img2txt = async (image: string | File | Blob, testMode?: boolean) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.ai.img2txt(image, testMode);
  };

  const getKV = async (key: string) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.kv.get(key);
  };

  const setKV = async (key: string, value: string) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.kv.set(key, value);
  };

  const deleteKV = async (key: string) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.kv.delete(key);
  };

  const listKV = async (pattern: string, returnValues?: boolean) => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.kv.list(pattern, returnValues ?? false);
  };

  const flushKV = async () => {
    const puter = getPuter();
    if (!puter) {
      setError("Puter.js not available");
      return;
    }
    return puter.kv.flush();
  };

  return {
    isLoading: true,
    error: null,
    puterReady: false,

    auth: {
      user: null,
      isAuthenticated: false,
      signIn,
      signOut,
      refreshUser,
      checkAuthStatus,
      getUser: () => get().auth.user,
    },

    fs: {
      write: (path: string, data: string | File | Blob) => write(path, data),
      read: (path: string) => readFile(path),
      readDir: (path: string) => readDir(path),
      upload: (files: File[] | Blob[]) => upload(files),
      delete: (path: string) => deleteFile(path),
    },

    ai: {
      chat: (prompt, imageURL, testMode, options) => chat(prompt, imageURL, testMode, options),
      feedback: (path: string, message: string) => feedback(path, message),
      img2txt: (image: string | File | Blob, testMode?: boolean) => img2txt(image, testMode),
    },

    kv: {
      get: (key: string) => getKV(key),
      set: (key: string, value: string) => setKV(key, value),
      delete: (key: string) => deleteKV(key),
      list: (pattern: string, returnValues?: boolean) => listKV(pattern, returnValues),
      flush: () => flushKV(),
    },

    init,
    clearError: () => set({ error: null }),
  };
});
