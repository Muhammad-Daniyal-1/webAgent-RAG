"use client";
import { useState, useRef } from "react";
import { apiUrl } from "@/lib/config";

interface Props {
  onUploadSuccess: (fileName: string) => void;
}

export default function FileUpload({ onUploadSuccess }: Props) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setStatus("uploading");
    setMessage("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(apiUrl("/upload"), {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Upload failed");

      setStatus("done");
      setMessage(data.message);
      onUploadSuccess(file.name);
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-700 hover:border-gray-500 
                 rounded-xl p-8 text-center cursor-pointer transition-colors
                 bg-gray-900 hover:bg-gray-800"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {status === "idle" && (
        <>
          <p className="text-gray-300 font-medium">Drop a PDF or TXT here</p>
          <p className="text-gray-500 text-sm mt-1">or click to browse</p>
        </>
      )}

      {status === "uploading" && (
        <p className="text-blue-400 animate-pulse">Uploading and indexing...</p>
      )}

      {status === "done" && <p className="text-green-400 text-sm">{message}</p>}

      {status === "error" && <p className="text-red-400 text-sm">{message}</p>}
    </div>
  );
}
