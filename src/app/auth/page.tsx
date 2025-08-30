"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "../_components/button";

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleDiscordSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("discord", { callbackUrl: "/" });
    } catch (error) {
      console.error("Discord sign in error:", error);
      setMessage("Failed to sign in with Discord");
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-white/70 text-sm">
        Sign in to start tracking trips and growing your garden.
      </p>
      
      {message && (
        <div className={`rounded-[var(--radius-sm)] p-3 text-sm ${
          message.includes("Check your email") 
            ? "bg-green-500/10 text-green-400" 
            : "bg-red-500/10 text-red-400"
        }`}>
          {message}
        </div>
      )}

      <div className="card space-y-3 p-5">
        <Button 
          className="w-full" 
          size="lg" 
          onClick={handleDiscordSignIn}
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Continue with Discord"}
        </Button>
      </div>
      
      <div className="text-sm text-white/60">
        By continuing you agree to our terms. <Link href="/" className="text-[rgb(var(--color-primary))] hover:underline">Back home</Link>
      </div>
    </div>
  );
}
