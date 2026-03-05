"use client";

import { useCallback, useRef, useState } from "react";
import { updateEssay } from "./api";
import type { SaveStatus } from "./types";

export function useAutoSave(essayId: string | null) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const triggerSave = useCallback(
    async (data: Record<string, unknown>) => {
      if (!essayId) return;
      // Sequential saves — wait for previous save
      if (savingRef.current) return;
      savingRef.current = true;
      setStatus("saving");
      try {
        await updateEssay(essayId, data);
        setStatus("saved");
      } catch {
        setStatus("error");
      } finally {
        savingRef.current = false;
      }
    },
    [essayId]
  );

  const scheduleSave = useCallback(
    (data: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => triggerSave(data), 700);
    },
    [triggerSave]
  );

  const saveNow = useCallback(
    (data: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      triggerSave(data);
    },
    [triggerSave]
  );

  return { status, scheduleSave, saveNow };
}
