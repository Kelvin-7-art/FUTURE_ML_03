import React, { type FormEvent } from "react";
import { useNavigate } from "react-router";

import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";

import { prepareInstructions } from "~/constants";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";
import { convertPdfToImage } from "~/lib/pdf2img";

export default function Upload() {
  const navigate = useNavigate();
  const { fs, ai, kv } = usePuterStore();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [statusText, setStatusText] = React.useState("");
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);

  // Normalize different possible fs.upload return shapes
  const pickUploaded = (uploaded: any) => {
    if (Array.isArray(uploaded)) return uploaded[0];
    if (uploaded?.file) return uploaded.file;
    return uploaded;
  };

  // prepareInstructions: support either (obj) or (title, desc)
  const buildInstructions = (jobTitle: string, jobDescription: string): string => {
    const fn: any = prepareInstructions;
    if (fn.length === 1) return fn({ jobTitle, jobDescription });
    return fn(jobTitle, jobDescription);
  };

  // Helper: safely extract string from Puter / Ollama AIResponse
  const extractFeedbackText = (feedback: any): string => {
    if (!feedback) return "";

    // Some implementations might return a string directly
    if (typeof feedback === "string") return feedback;

    // Common Puter structure: feedback.message.content or feedback.message.content[0].text
    const msg = feedback?.message;
    if (typeof msg?.content === "string") return msg.content;
    if (Array.isArray(msg?.content) && typeof msg.content?.[0]?.text === "string")
      return msg.content[0].text;

    // If our Ollama fallback mapped JSON into an object, it may already contain scores
    // In that case, we can just stringify it and parse as JSON later.
    if (typeof feedback === "object") return JSON.stringify(feedback);

    return "";
  };

  const handleAnalyze = async (params: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    const { companyName, jobTitle, jobDescription, file } = params;

    try {
      setIsProcessing(true);

      // 1) Upload PDF
      setStatusText("Uploading the PDF...");
      const uploadedPdfRaw = await fs.upload([file]);
      const uploadedPdf = pickUploaded(uploadedPdfRaw);

      console.log("uploadedPdfRaw:", uploadedPdfRaw);
      console.log("uploadedPdf:", uploadedPdf);

      if (!uploadedPdf?.path) {
        setStatusText("Error: Failed to upload PDF.");
        return;
      }

      // 2) Convert PDF -> image (PNG)
      setStatusText("Converting to image...");
      const imageResult = await convertPdfToImage(file);

      console.log("imageResult:", imageResult);

      const imageFile = imageResult?.file ?? null;
      if (!imageFile) {
        setStatusText(imageResult?.error || "Error: Failed to convert PDF to image.");
        return;
      }

      // 3) Upload image
      setStatusText("Uploading the image...");
      const uploadedImgRaw = await fs.upload([imageFile]);
      const uploadedImg = pickUploaded(uploadedImgRaw);

      console.log("uploadedImgRaw:", uploadedImgRaw);
      console.log("uploadedImg:", uploadedImg);

      if (!uploadedImg?.path) {
        setStatusText("Error: Failed to upload image.");
        return;
      }

      // 4) Prepare + save initial data
      setStatusText("Preparing data...");
      const uuid = generateUUID();

      const data: any = {
        id: uuid,
        resumePath: uploadedPdf.path,
        imagePath: uploadedImg.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: "",
      };

      // Save initial placeholder state so /resume/:id can load something even if AI fails
      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      console.log("Saved initial data to KV:", `resume:${uuid}`, data);

      // 5) AI feedback (Puter -> fallback to Ollama handled inside ai.feedback now)
      setStatusText("Analyzing...");
      const instructions = buildInstructions(jobTitle, jobDescription);

      // IMPORTANT: include context in the message so Ollama fallback has enough info
      const combinedMessage = `
Job Title: ${jobTitle}
Company: ${companyName}

Job Description:
${jobDescription}

Instructions:
${instructions}

Return ONLY valid JSON as instructed.
`.trim();

      const feedback = await ai.feedback(uploadedPdf.path, combinedMessage);
      console.log("feedback raw:", feedback);

      if (!feedback) {
        setStatusText("Error: Failed to get feedback from AI.");
        return;
      }

      const feedbackText = extractFeedbackText(feedback);
      console.log("feedbackText:", feedbackText);

      if (!feedbackText) {
        setStatusText("Error: AI returned empty feedback.");
        return;
      }

      // Parse JSON feedback
      try {
        data.feedback = JSON.parse(feedbackText);
      } catch {
        // If the fallback already returned object-like AIResponse, attempt direct assign
        if (typeof feedback === "object") {
          data.feedback = feedback;
        } else {
          setStatusText("Error: AI response was not valid JSON.");
          return;
        }
      }

      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      console.log("Saved FINAL data to KV:", `resume:${uuid}`, data);

      setStatusText("Analysis complete. Redirecting...");
      setTimeout(() => navigate(`/resume/${uuid}`), 800);
    } catch (err) {
      console.error(err);
      setStatusText("Error: Something went wrong during analysis.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!resumeFile) {
      alert("Please upload your resume PDF.");
      return;
    }

    const formData = new FormData(e.currentTarget);

    const companyName = String(formData.get("companyName") ?? "");
    const jobTitle = String(formData.get("jobTitle") ?? "");
    const jobDescription = String(formData.get("jobDescription") ?? "");

    console.log("SUBMIT ->", { companyName, jobTitle, jobDescription, file: resumeFile });

    handleAnalyze({ companyName, jobTitle, jobDescription, file: resumeFile });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
      <Navbar />

      <section className="main-section">
        <div className="page-heading py-16">
          <h1>Smart Feedback for your dream job</h1>

          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img
                src="/images/resume-scan.gif"
                alt="Scanning Resume"
                className="w-72 mx-auto mt-6"
              />
            </>
          ) : (
            <h2>Drop your resume for ATS + improvement tips</h2>
          )}

          {!isProcessing && (
            <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input
                  type="text"
                  id="company-name"
                  name="companyName"
                  required
                  className="company-name"
                />
              </div>

              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input
                  type="text"
                  id="job-title"
                  name="jobTitle"
                  required
                  className="job-title"
                />
              </div>

              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea
                  rows={5}
                  id="job-description"
                  name="jobDescription"
                  required
                  className="job-description"
                />
              </div>

              <div className="form-div">
                <label>Upload Resume (PDF)</label>
                <FileUploader onFileSelected={setResumeFile} disabled={isProcessing} />
              </div>

              <button className="auth-button" type="submit" disabled={isProcessing}>
                Analyze Resume
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
