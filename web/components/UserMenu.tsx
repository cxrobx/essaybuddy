"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session?.user) return null;

  const initials = (session.user.name || session.user.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-macos-elevated transition-colors"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-6 h-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-macos-accent text-white text-xs flex items-center justify-center font-medium">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-xl border border-macos-border bg-macos-surface shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-macos-border">
            <p className="text-sm font-medium text-macos-text truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-macos-text-secondary truncate">
              {session.user.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left px-3 py-2 text-sm text-macos-text hover:bg-macos-elevated transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
