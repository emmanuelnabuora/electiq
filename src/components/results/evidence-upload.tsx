"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadResultDocument } from "@/lib/actions/results";

export function EvidenceUpload({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("submissionId", submissionId);
      formData.set("file", file);
      await uploadResultDocument(formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="text-sm text-light file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white"
        />
        <Button type="button" variant="secondary" onClick={handleUpload} disabled={uploading}>
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload evidence"}
        </Button>
      </div>
      {error && <p className="text-sm text-critical">{error}</p>}
    </div>
  );
}
