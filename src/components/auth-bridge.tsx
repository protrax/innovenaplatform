"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Supabase's admin.generateLink(type: "magiclink") returns links that use the
// implicit OAuth flow — tokens land in the URL hash fragment, not the query
// string. Our server-side callback (/api/auth/callback) can't see hash
// fragments, so this client handler extracts the tokens and calls
// supabase.auth.setSession(), then forces a full page reload so the server
// reads the fresh cookies.
//
// Mounted in the root layout so this runs on any page the user lands on.
export function AuthBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorCode = params.get("error_code");

    if (errorCode) return; // /logg-inn handles error hashes
    if (!accessToken || !refreshToken) return;

    const supabase = createClient();
    (async () => {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.error("[auth-bridge] setSession failed:", error);
        return;
      }
      // Full page reload so server reads the freshly-set session cookies.
      // router.refresh() alone can race the cookie write and give stale SSR.
      const cleanUrl = window.location.pathname + window.location.search;
      window.location.replace(cleanUrl);
    })();
  }, []);

  return null;
}
