"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Editor from "@/components/Editor";

function EditorWithParams() {
  const searchParams = useSearchParams();
  return <Editor essayId={searchParams.get("id")} />;
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-macos-bg text-macos-text-secondary text-sm">
          Loading...
        </div>
      }
    >
      <EditorWithParams />
    </Suspense>
  );
}
