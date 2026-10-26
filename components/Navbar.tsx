"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PieChart,
  BookMarked,
  Trophy,
  ShieldAlert,
  LogOut,
  LogIn,
  ChevronDown,
  Menu,
  X,
  UserRound,
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
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

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
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut({ scope: "global" });
      if (error) throw error;
      // Replace prevents the authenticated page from remaining in browser history.
      router.replace("/");
      router.refresh();
      setProfileOpen(false);
    } catch (error) {
      console.error("Sign out failed:", error);
      setSigningOut(false);
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: PieChart },
    { label: "DSA Sheets", href: "/sheets", icon: BookMarked },
    { label: "KIIT Leaderboard", href: "/leaderboard", icon: Trophy },
    ...(user?.role === "ADMIN"
      ? [{ label: "Admin Panel", href: "/admin", icon: ShieldAlert }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-outline-subtle bg-surface-page/95 backdrop-blur-md px-3 sm:px-4 lg:px-8 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
          {/* Brand Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-content-primary shadow-lg shadow-brand-primary/30 group-hover:scale-105 transition">
              <img
                src="/cn.webp"
                alt="CN logo"
                className="w-7 h-7 object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-content-primary">
                  CODING NINJAS
                </span>
                <span className="text-[10px] bg-brand-primary/20 text-brand-accent border border-brand-primary/30 px-2 py-0.5 rounded-full font-bold">
                  KIIT CHAPTER
                </span>
              </div>
              <p className="text-[11px] text-content-muted font-medium">
                DSA Mastery Tracker Platform
              </p>
            </div>
          </Link>

        <nav className="hidden md:flex items-center justify-center gap-1 flex-1 min-w-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg font-semibold text-xs lg:text-sm transition ${isActive ? "text-content-primary bg-brand-primary shadow-md shadow-brand-primary/20" : "text-content-muted hover:text-content-primary hover:bg-surface-elevated"}`}>
              <Icon className="w-4 h-4" /><span>{item.label}</span>
            </Link>;
          })}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
            <button aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"} onClick={() => setMobileNavOpen((open) => !open)} className="md:hidden p-2 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-elevated transition">
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button aria-label="Open account menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-surface-elevated transition">
                  <div className="relative">
                  <UserAvatar
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                    sizeClasses="w-8 h-8"
                    className="border border-brand-primary"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-status-success rounded-full border-2 border-surface-page"></span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-content-muted" />
                </button>
                {profileOpen && <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-outline-subtle bg-surface-card p-1.5 shadow-xl">
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-content-primary hover:bg-surface-elevated"><UserRound className="w-4 h-4" /> Profile</Link>
                  <button onClick={handleLogout} disabled={signingOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-status-danger hover:bg-surface-elevated disabled:opacity-50"><LogOut className={`w-4 h-4 ${signingOut ? "animate-pulse" : ""}`} /> Sign out</button>
                </div>}
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={signingIn}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-hover disabled:opacity-60 text-content-primary text-xs font-bold transition shadow-md shadow-brand-primary/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>
                  {signingIn ? "Redirecting..." : "Sign in with Google"}
                </span>
              </button>
            )}
          </div>
      </div>
      {mobileNavOpen && <nav className="md:hidden max-w-7xl mx-auto mt-2 border-t border-outline-subtle pt-2 grid grid-cols-2 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link onClick={() => setMobileNavOpen(false)}
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-xs transition ${
                  isActive
                    ? "text-content-primary bg-brand-primary shadow-md shadow-brand-primary/20"
                    : "text-content-muted hover:text-content-primary hover:bg-surface-elevated"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>}
    </header>
  );
}
