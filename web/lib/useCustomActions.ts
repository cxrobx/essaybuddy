"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomAction } from "./types";

const STORAGE_KEY = "zora-custom-actions";

export function useCustomActions() {
  const [actions, setActions] = useState<CustomAction[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setActions(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((next: CustomAction[]) => {
    setActions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addAction = useCallback(
    (name: string, instructions: string) => {
      const action: CustomAction = { id: crypto.randomUUID(), name, instructions };
      persist([...actions, action]);
    },
    [actions, persist]
  );

  const updateAction = useCallback(
    (id: string, name: string, instructions: string) => {
      persist(actions.map((a) => (a.id === id ? { ...a, name, instructions } : a)));
    },
    [actions, persist]
  );

  const deleteAction = useCallback(
    (id: string) => {
      persist(actions.filter((a) => a.id !== id));
    },
    [actions, persist]
  );

  return { actions, addAction, updateAction, deleteAction };
}
