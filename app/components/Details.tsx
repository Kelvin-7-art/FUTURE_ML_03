import React from "react";
import type { Feedback } from "../../types/resume";

const Section = ({
  title,
  block,
}: {
  title: string;
  block?: { score?: number; tips?: Array<{ type?: string; tip?: string; explanation?: string }> };
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

      {!!block.tips?.length && (
        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-700">
          {block.tips.map((t, i) => (
            <li key={i}>
              {t.type ? <b className="mr-1">[{t.type}]</b> : null} {t.tip}
              {t.explanation ? <span className="text-gray-600"> — {t.explanation}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Details: React.FC<{ feedback: Feedback }> = ({ feedback }) => {
  return (
    <div className="grid gap-4">
      <Section title="Content" block={feedback.content} />
      <Section title="Skills" block={feedback.skills} />
      <Section title="Structure" block={feedback.structure} />
      <Section title="Tone & Style" block={feedback.toneAndStyle} />
    </div>
  );
};

export default Details;
