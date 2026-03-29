"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationsForUser,
} from "@/lib/local-db";
import type { Notification } from "@/lib/types";

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeNotificationsForUser(user.id, setItems, console.error);
  }, [user]);

  const count = items.filter((n) => !n.isRead).length;

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-[var(--mc-muted)] hover:bg-slate-100 hover:text-[var(--mc-text)]"
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {count > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--mc-accent)] ring-2 ring-white" />
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-[var(--mc-border)] bg-[var(--mc-surface)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--mc-border)] px-3 py-2">
              <span className="text-sm font-medium">Notifications</span>
              {count > 0 && (
                <button
                  type="button"
                  className="text-xs text-[var(--mc-accent)] hover:underline"
                  onClick={() => {
                    void markAllNotificationsRead(user.id).catch(console.error);
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {items.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-[var(--mc-muted)]">
                  No notifications
                </li>
              )}
              {items.map((n) => {
                const urgent = n.message.startsWith("New urgent");
                return (
                  <li key={n.id}>
                    <Link
                      href={`/cases/${n.caseId}`}
                      className={`block px-3 py-2 text-sm hover:bg-slate-50 ${
                        n.isRead
                          ? "text-[var(--mc-muted)]"
                          : urgent
                            ? "font-semibold text-red-800"
                            : "font-medium text-[var(--mc-text)]"
                      }`}
                      onClick={() => {
                        void markNotificationRead(n.id).catch(console.error);
                        setOpen(false);
                      }}
                    >
                      {n.message}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-[var(--mc-border)] px-3 py-2 text-xs text-[var(--mc-muted)]">
              Matches your profile specialty in real time.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
