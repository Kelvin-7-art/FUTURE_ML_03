import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Navbar from "~/components/Navbar";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import { usePuterStore } from "~/lib/puter";

// ✅ Use ONE shared type source (no local duplicates)
import type { Feedback, ResumeData } from "../../types/resume";

/* =========================
   Helpers
========================= */
function normalizeFeedback(input: any): Feedback | null {
  if (!input) return null;

  // If string, try parse
  if (typeof input === "string") {
    try {
      return normalizeFeedback(JSON.parse(input));
    } catch {
      return null;
    }
  }

  if (typeof input !== "object") return null;

  // Sometimes the feedback is nested
  const maybe =
    input?.feedback && typeof input.feedback === "object" ? input.feedback : input;

  // Normalize alternate keys
  if (!maybe.toneAndStyle && maybe.tone_and_style) {
    maybe.toneAndStyle = maybe.tone_and_style;
  }
  if (maybe.overallScore == null && maybe.overall_score != null) {
    maybe.overallScore = maybe.overall_score;
  }

  return maybe as Feedback;
}

export default function Resume() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { auth, isLoading, fs, kv } = usePuterStore();

  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [resumeUrl, setResumeUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Redirect to auth if not signed in
  useEffect(() => {
    if (!id) return;
    if (!isLoading && !auth.isAuthenticated) {
      navigate(`/auth?next=${encodeURIComponent(`/resume/${id}`)}`, {
        replace: true,
      });
    }
  }, [id, isLoading, auth.isAuthenticated, navigate]);

  // ✅ Load resume record + blobs (kv + fs)
  useEffect(() => {
    let cancelled = false;

    // Clean up old URLs before loading new ones
    if (resumeUrl) URL.revokeObjectURL(resumeUrl);
    if (imageUrl) URL.revokeObjectURL(imageUrl);

    const loadResume = async () => {
      setPageLoading(true);
      setError("");

      try {
        if (!id) {
          setError("Missing resume id.");
          return;
        }

        const raw = await kv.get(`resume:${id}`);
        if (!raw) {
          setError("No saved resume data found for this id.");
          return;
        }

        const data: ResumeData = JSON.parse(raw);

        // ✅ PDF blob -> object URL
        const pdfBlobRaw = await fs.read(data.resumePath);
        if (!pdfBlobRaw) {
          setError("Failed to load resume PDF.");
          return;
        }
        const pdfBlob = new Blob([pdfBlobRaw], { type: "application/pdf" });
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // ✅ Image blob -> object URL
        const imgBlobRaw = await fs.read(data.imagePath);
        if (!imgBlobRaw) {
          setError("Failed to load resume image.");
          return;
        }
        const imgUrl = URL.createObjectURL(imgBlobRaw);

        const fb = normalizeFeedback(data.feedback);

        if (cancelled) return;

        setResumeData(data);
        setResumeUrl(pdfUrl);
        setImageUrl(imgUrl);
        setFeedback(fb);

        console.log("Loaded:", { pdfUrl, imgUrl, feedback: fb, data });
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load resume feedback.");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    loadResume();

    return () => {
      cancelled = true;
      try {
        if (resumeUrl) URL.revokeObjectURL(resumeUrl);
        if (imageUrl) URL.revokeObjectURL(imageUrl);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kv, fs]);

  const atsScore = useMemo(() => feedback?.ATS?.score ?? 0, [feedback]);
  const atsTips = useMemo(() => feedback?.ATS?.tips ?? [], [feedback]);

  return (
    <main className="pt-0">
      <Navbar />

      {/* Top Nav */}
      <nav className="resume-nav">
        <Link to="/" className="back-button">
          <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
          <span className="text-gray-800 text-sm font-semibold">
            Back to Homepage
          </span>
        </Link>
      </nav>

      {/* Main Layout */}
      <div className="flex flex-row w-full max-lg:flex-col-reverse">
        {/* Left Side: Resume Preview */}
        <section className="feedback-section bg-[url('/images/bg-small.svg')] bg-cover h-[100vh] sticky top-0 flex items-center justify-center">
          {pageLoading ? (
            <img
              src="/images/resume-scan-2.gif"
              alt="Loading"
              className="w-full max-w-md"
            />
          ) : imageUrl && resumeUrl ? (
            <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] w-[90%] max-w-2xl">
              <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={imageUrl}
                  className="w-full h-full object-contain rounded-2xl"
                  title="resume"
                  alt="resume preview"
                />
              </a>
            </div>
          ) : (
            <div className="text-sm text-gray-700 bg-white/70 border rounded-xl p-4">
              Could not load resume preview.
            </div>
          )}
        </section>

        {/* Right Side: Feedback */}
        <section className="feedback-section p-6">
          <h2 className="text-4xl !text-black font-bold">Resume Review</h2>

          {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}

          {pageLoading && !error && (
            <div className="mt-6">
              <img
                src="/images/resume-scan-2.gif"
                alt="Loading feedback"
                className="w-full max-w-md"
              />
            </div>
          )}

          {!pageLoading && feedback ? (
            <div className="flex flex-col gap-8 animate-in fade-in duration-1000 mt-6">
              <Summary feedback={feedback} meta={resumeData ?? undefined} />
              <ATS score={atsScore} suggestions={atsTips} />
              <Details feedback={feedback} />
            </div>
          ) : null}

          {!pageLoading && !feedback && !error && (
            <div className="mt-6 rounded-xl bg-white/70 p-4 border">
              <p className="text-sm text-gray-700">
                Feedback not available. Try re-running the analysis.
              </p>
              <button
                className="auth-button mt-3"
                onClick={() => navigate("/upload")}
              >
                Upload another
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
