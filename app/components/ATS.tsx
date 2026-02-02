import React from "react";
import type { Tip } from "../../types/resume";

const ATS: React.FC<{ score: number; suggestions: Tip[] }> = ({ score, suggestions }) => {
  return (
    <div className="rounded-xl bg-white/70 p-4 border">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-800">ATS</h3>
        <span className="text-sm text-gray-600">
          Score: <b>{score}</b>
        </span>
      </div>

      {!!suggestions?.length && (
        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-700">
          {suggestions.map((t, i) => (
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

export default ATS;
