import React from "react";
import type { Feedback, ResumeData } from "../../types/resume";

const Summary: React.FC<{ feedback: Feedback; meta?: ResumeData }> = ({ feedback, meta }) => {
  return (
    <div className="rounded-xl bg-white/70 p-4 border">
      <p className="text-gray-700">
        <b>Company:</b> {meta?.companyName ?? "—"}
      </p>
      <p className="text-gray-700">
        <b>Job Title:</b> {meta?.jobTitle ?? "—"}
      </p>
      <p className="text-gray-700">
        <b>Overall Score:</b> {feedback.overallScore ?? "—"}
      </p>
    </div>
  );
};

export default Summary;
