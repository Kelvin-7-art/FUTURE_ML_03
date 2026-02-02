import type { Route } from "./+types/auth";
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { usePuterStore } from "~/lib/puter";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AI Resume Screener | Auth" },
    { name: "description", content: "Log into your account" },
  ];
}

export default function Auth() {
  const { isLoading, auth, puterReady } = usePuterStore();

  const location = useLocation();
  const navigate = useNavigate();

  const next = useMemo(() => {
    const value = new URLSearchParams(location.search).get("next");
    // prevent weird values
    if (!value || !value.startsWith("/")) return "/";
    return value;
  }, [location.search]);

  useEffect(() => {
    // ✅ only redirect when loading finished and auth is confirmed
    if (puterReady && !isLoading && auth.isAuthenticated) {
      navigate(next, { replace: true });
    }
  }, [puterReady, isLoading, auth.isAuthenticated, next, navigate]);

  const handleSignIn = async () => {
    await auth.signIn();
    // redirect will happen via useEffect when store updates
  };

  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen flex items-center justify-center">
      <div className="gradient-border p-1 rounded-lg">
        <section className="flex flex-col gap-8 bg-white rounded-2xl p-10 min-w-[360px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">Welcome</h1>
            <h2 className="text-gray-600">Log In To Continue Your Job Journey</h2>
          </div>

          <div>
            {!puterReady ? (
              <button className="auth-button animate-pulse" disabled>
                Loading Puter...
              </button>
            ) : isLoading ? (
              <button className="auth-button animate-pulse" disabled>
                Signing you in...
              </button>
            ) : auth.isAuthenticated ? (
              <button className="auth-button" onClick={handleSignOut}>
                Sign Out
              </button>
            ) : (
              <button className="auth-button" onClick={handleSignIn}>
                Sign In
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
