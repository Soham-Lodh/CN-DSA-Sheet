"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PieChart,
  BookMarked,
  Trophy,
  User,
  ShieldAlert,
  LogOut,
  LogIn,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { createClient, startGoogleSignIn } from "@/lib/supabase/client";
import { UserAvatar } from "./UserAvatar";
import type { Profile } from "@prisma/client";

interface NavbarProps {
  user?: Profile | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  // The navbar CTA starts Google OAuth directly instead of linking to "/".
  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const error = await startGoogleSignIn();
      if (error) {
        console.error("Sign in failed:", error.message);
        router.push("/?error=auth_failed");
      }
    } catch (err: any) {
      console.error("Sign in failed:", err?.message || err);
      router.push("/?error=auth_failed");
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: PieChart },
    { label: "DSA Sheets", href: "/sheets", icon: BookMarked },
    { label: "KIIT Leaderboard", href: "/leaderboard", icon: Trophy },
    { label: "Profile", href: "/profile", icon: User },
    ...(user?.role === "ADMIN"
      ? [{ label: "Admin Panel", href: "/admin", icon: ShieldAlert }]
      : []),
  ];

  return (
    <>
      {/* Top Header / Brand Bar */}
      <header className="sticky top-0 z-50 glass-card border-b border-slate-800 bg-slateDark-900/95 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cnOrange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-cnOrange-600/30 group-hover:scale-105 transition">
                <img src="/cn.webp" alt="CN logo" className="w-7 h-7 object-contain" />
              </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">CODING NINJAS</span>
                <span className="text-[10px] bg-cnOrange-500/20 text-cnOrange-400 border border-cnOrange-500/30 px-2 py-0.5 rounded-full font-bold">
                  KIIT CHAPTER
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">DSA Mastery Tracker Platform</p>
            </div>
          </Link>

          {/* User Profile Pill or Sign In Button */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-slateDark-800/90 px-3 py-1.5 rounded-full border border-slate-700">
                <div className="relative">
                  <UserAvatar
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                    sizeClasses="w-8 h-8"
                    className="border border-cnOrange-500"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"></span>
                </div>
                <div className="hidden md:block text-left pr-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>{user.name}</span>
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    {user.role === "ADMIN" && (
                      <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1 py-0.2 rounded font-mono">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {user.rollNumber || user.email}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-white text-xs pl-2 border-l border-slate-700 transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={signingIn}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cnOrange-600 hover:bg-cnOrange-700 disabled:opacity-60 text-white text-xs font-bold transition shadow-md shadow-cnOrange-600/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{signingIn ? "Redirecting..." : "Sign in with Google"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Interactive Navigation Tab Bar */}
      <nav className="bg-slateDark-850 border-b border-slate-800 px-4 lg:px-8 py-2.5 sticky top-[61px] z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto custom-scrollbar gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition ${
                    isActive
                      ? "text-white bg-cnOrange-600 shadow-md shadow-cnOrange-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-900/80 px-3 py-1.5 rounded-md border border-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-cnOrange-500" />
            <span>KIIT Autonomous Chapter</span>
          </div>
        </div>
      </nav>
    </>
  );
}
