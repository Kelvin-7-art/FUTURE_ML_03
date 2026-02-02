import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "~/components/Navbar";
import { usePuterStore } from "~/lib/puter";

type Tip = { type?: string; tip?: string; explanation?: string };

type ScoreBlock = {
  score?: number;
  tips?: Tip[];
  // optional fields some models might return
  matched?: string[];
  missing?: string[];
};

type Feedback = {
  overallScore?: number;

  // Some sources return ATS separately, others don't.
  ATS?: ScoreBlock;

  content?: ScoreBlock;
  skills?: ScoreBlock;
  structure?: ScoreBlock;
  toneAndStyle?: ScoreBlock;

  // Sometimes a top-level tips array exists
  tips?: Tip[];

  // Keep any extra fields without crashing
  [key: string]: any;
};

type ResumeData = {
  id: string;
  resumePath: string;
  imagePath: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  feedback: Feedback | string; // sometimes stored as string
};

function normalizeFeedback(input: any): Feedback | string {
  if (!input) return "";

  // If already object-like, return it
  if (typeof input === "object") {
    // Some implementations store the AIResponse directly, which may include overallScore at top.
    // Also sometimes the JSON is nested under "feedback".
    const maybe = input?.feedback && typeof input.feedback === "object" ? input.feedback : input;

    // If toneAndStyle is named tone_and_style
    if (!maybe.toneAndStyle && maybe.tone_and_style) {
      maybe.toneAndStyle = maybe.tone_and_style;
    }

    // If overallScore is named overall_score
    if (maybe.overallScore == null && maybe.overall_score != null) {
      maybe.overallScore = maybe.overall_score;
    }

    // If "ATS" is missing but top-level has overallScore & tips only, we can skip ATS
    return maybe as Feedback;
  }

  // If string, try JSON parse
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return normalizeFeedback(parsed) as Feedback;
    } catch {
      return input;
    }
  }

  // Fallback
  try {
    return JSON.parse(String(input));
  } catch {
    return String(input);
  }
}

export default function Resume() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { kv } = usePuterStore();

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ResumeData | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        if (!id) {
          setError("Missing resume id.");
          return;
        }

        // ✅ read what upload.tsx saved: kv.set(`resume:${uuid}`, JSON.stringify(data))
        const raw = await kv.get(`resume:${id}`);

        if (!raw) {
          setError("No saved resume data found for this id.");
          return;
        }

        const parsed: ResumeData = JSON.parse(raw);

        // Normalize feedback regardless of whether it's string/object
        parsed.feedback = normalizeFeedback(parsed.feedback) as any;

        // Some people accidentally store the whole object under data.feedback.feedback
        if (typeof parsed.feedback === "object" && (parsed.feedback as any)?.feedback) {
          parsed.feedback = normalizeFeedback((parsed.feedback as any).feedback) as any;
        }

        setData(parsed);
      } catch (e) {
        console.error(e);
        setError("Failed to load resume feedback.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, kv]);

  const Section = ({
    title,
    block,
    showMatchedMissing,
  }: {
    title: string;
    block?: ScoreBlock;
    showMatchedMissing?: boolean;
  }) => {
    if (!block) return null;

    return (
      <div className="rounded-xl bg-white/70 p-4 border">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <span className="text-sm text-gray-600">
            Score: <b>{block.score ?? "—"}</b>
          </span>
        </div>

        {showMatchedMissing && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {!!block.matched?.length && (
              <div className="rounded-lg bg-white/60 p-3 border">
                <p className="text-sm font-semibold text-gray-800">Matched</p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700">
                  {block.matched.map((s, i) => (
                    <li key={`m-${i}`}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!block.missing?.length && (
              <div className="rounded-lg bg-white/60 p-3 border">
                <p className="text-sm font-semibold text-gray-800">Missing</p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700">
                  {block.missing.map((s, i) => (
                    <li key={`x-${i}`}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!!block.tips?.length && (
          <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-700">
            {block.tips.map((t, i) => (
              <li key={i}>
                {t.type ? <b className="mr-1">[{t.type}]</b> : null}
                {t.tip}
                {t.explanation ? (
                  <span className="text-gray-600"> — {t.explanation}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const feedbackObj = data && typeof data.feedback === "object" ? (data.feedback as Feedback) : null;

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
      <Navbar />

      <section className="main-section">
        <div className="page-heading py-10">
          <div className="flex items-center justify-between gap-3">
            <h1>Resume Feedback</h1>
            <button className="auth-button" onClick={() => navigate("/upload")}>
              Upload another
            </button>
          </div>

          {loading && <p className="mt-6 text-gray-700">Loading feedback...</p>}

          {!loading && error && <p className="mt-6 text-red-600">{error}</p>}

          {!loading && data && (
            <div className="mt-6 space-y-5">
              <div className="rounded-xl bg-white/70 p-4 border">
                <p className="text-gray-700">
                  <b>Company:</b> {data.companyName}
                </p>
                <p className="text-gray-700">
                  <b>Job Title:</b> {data.jobTitle}
                </p>
                <p className="text-gray-700">
                  <b>Overall Score:</b> {feedbackObj?.overallScore ?? "—"}
                </p>
              </div>

              {feedbackObj ? (
                <div className="grid gap-4">
                  {/* ATS section may not exist depending on model */}
                  <Section title="ATS" block={feedbackObj.ATS} />
                  <Section title="Content" block={feedbackObj.content} />
                  <Section title="Skills" block={feedbackObj.skills} showMatchedMissing />
                  <Section title="Structure" block={feedbackObj.structure} />
                  <Section title="Tone & Style" block={feedbackObj.toneAndStyle} />

                  {!!feedbackObj.tips?.length && (
                    <div className="rounded-xl bg-white/70 p-4 border">
                      <h3 className="font-semibold text-gray-800">Overall Tips</h3>
                      <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-700">
                        {feedbackObj.tips.map((t, i) => (
                          <li key={i}>
                            {t.type ? <b className="mr-1">[{t.type}]</b> : null}
                            {t.tip}
                            {t.explanation ? (
                              <span className="text-gray-600"> — {t.explanation}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-white/70 p-4 border">
                  <h3 className="font-semibold text-gray-800">Feedback</h3>
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                    {String(data.feedback)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
