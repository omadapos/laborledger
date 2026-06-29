"use client";

import { useEffect, useState } from "react";

import { OFFLINE_BANNER_COPY, isBrowserOffline } from "@/lib/offline";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(isBrowserOffline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-950"
      role="status"
    >
      {OFFLINE_BANNER_COPY}
    </div>
  );
}
