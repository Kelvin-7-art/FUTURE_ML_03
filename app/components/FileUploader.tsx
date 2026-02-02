import React, { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

// ✅ format bytes into human-readable size
function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);

  const decimals = i === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

type Props = {
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
};

export default function FileUploader({ onFileSelected, disabled = false }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], _rejected: FileRejection[]) => {
      const file = acceptedFiles?.[0] ?? null;
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const rejectionMessage =
    fileRejections?.[0]?.errors?.[0]?.message ??
    (fileRejections?.length ? "File rejected. Please upload a PDF under 20 MB." : "");

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    onFileSelected(null);
  };

  return (
    <div className="w-full gradient-border p-1 rounded-xl">
      <div
        {...getRootProps()}
        className={`w-full rounded-xl border border-dashed p-6 bg-white/70 ${
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {/* name="resume" makes it appear in FormData as "resume" */}
        <input {...getInputProps()} name="resume" />

        {isDragActive ? (
          <p className="text-center text-gray-700">Drop the PDF here ...</p>
        ) : (
          <div className="space-y-4 text-center">
            {/* icon */}
            <div className="mx-auto w-16 h-16 flex items-center justify-center">
              <img src="/icons/info.svg" alt="upload" className="size-20" />
            </div>

            {selectedFile ? (
              <div
                className="uploader-selected-file flex items-center justify-between gap-3 bg-white/80 rounded-lg p-3"
                onClick={(e) => {
                  // ✅ prevent opening file picker when clicking inside selected file
                  e.stopPropagation();
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img src="/images/pdf.png" alt="pdf" className="size-10 shrink-0" />

                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">{formatSize(selectedFile.size)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="p-2 cursor-pointer shrink-0"
                  onClick={handleRemove}
                  aria-label="Remove file"
                  title="Remove file"
                >
                  <img src="/icons/cross.svg" alt="remove" className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-700">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-gray-500">PDF (max 20 MB)</p>
              </div>
            )}
          </div>
        )}

        {rejectionMessage && (
          <p className="mt-3 text-sm text-red-600 text-center">{rejectionMessage}</p>
        )}
      </div>
    </div>
  );
}
