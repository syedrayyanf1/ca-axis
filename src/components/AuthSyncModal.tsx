import React, { useState } from 'react';
import { CheckCircle2, Cloud, Loader2, LogOut, RefreshCw, User as UserIcon, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface NavbarAuthControlProps {
  user: User | null;
  syncStatus: SyncStatus;
  onOpenAuthModal: () => void;
  onSignOut: () => Promise<void>;
  onManualSync: () => Promise<void>;
}

function getUserInitials(email?: string): string {
  if (!email) return 'CA';
  const localPart = email.split('@')[0] || '';
  const segments = localPart.split(/[._-]/).filter(Boolean);
  if (segments.length >= 2) {
    return (segments[0][0] + segments[1][0]).toUpperCase();
  }
  return localPart.slice(0, 2).toUpperCase() || 'CA';
}

export const NavbarAuthControl: React.FC<NavbarAuthControlProps> = ({
  user,
  syncStatus,
  onOpenAuthModal,
  onSignOut,
  onManualSync,
}) => {
  if (!user) {
    return (
      <button
        type="button"
        onClick={onOpenAuthModal}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Sign In / Sync</span>
      </button>
    );
  }

  const initials = getUserInitials(user.email);

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Sync Status & User Identity Pill */}
      <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-2.5 py-1 dark:border-white/[0.07] dark:bg-[#121215]">
        <span
          className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-semibold text-white dark:bg-white dark:text-black shrink-0"
          title={user.email || 'Signed in user'}
        >
          {initials}
        </span>

        <div className="hidden md:flex flex-col leading-none">
          <span className="max-w-[140px] truncate text-[11px] font-medium text-[#09090B] dark:text-white">
            {user.email}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {syncStatus === 'syncing' ? (
              <>
                <Loader2 className="h-2.5 w-2.5 animate-spin text-[#6366F1]" />
                <span>Sync Status: Syncing...</span>
              </>
            ) : syncStatus === 'error' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>Sync Status: Local Saved</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
                <span>Sync Status: Cloud Synced</span>
              </>
            )}
          </span>
        </div>

        {/* Compact mobile sync badge */}
        <span className="md:hidden text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {syncStatus === 'syncing' ? 'Syncing...' : 'Cloud Synced'}
        </span>

        <button
          type="button"
          onClick={onManualSync}
          disabled={syncStatus === 'syncing'}
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          title="Sync progress with cloud now"
          aria-label="Sync progress with cloud now"
        >
          <RefreshCw className={`h-3 w-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sign Out Button */}
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-[#09090B] dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
        title="Sign Out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
};

interface AuthSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthSyncModal: React.FC<AuthSyncModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorMessage(error.message);
        } else if (data.user) {
          onAuthSuccess(data.user);
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorMessage(error.message);
        } else if (data.session && data.user) {
          onAuthSuccess(data.user);
          onClose();
        } else if (data.user) {
          setInfoMessage(
            'Account created! If email confirmation is enabled, please check your inbox to verify, or switch to Sign In.'
          );
          setMode('signin');
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-black/[0.08] bg-white p-6 shadow-xl dark:border-white/[0.07] dark:bg-[#121215]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.08] bg-zinc-100 text-[#09090B] dark:border-white/[0.07] dark:bg-zinc-800 dark:text-white">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-[#09090B] dark:text-white">
                {mode === 'signin' ? 'Sign In to CAxis' : 'Create CAxis Account'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Two-way cloud sync for your PRC test history &amp; accuracy stats
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-black/[0.06] bg-zinc-100 p-1 dark:border-white/[0.06] dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-[#09090B] dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-[#09090B] dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@icap.edu.pk"
              className="w-full rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-3.5 py-2 text-sm text-[#09090B] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white dark:focus:border-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-3.5 py-2 text-sm text-[#09090B] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white dark:focus:border-white"
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-3.5 py-2.5 text-xs text-[#09090B] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6366F1]" />
              <span>{infoMessage}</span>
            </div>
          )}

          <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-3 text-xs text-zinc-500 dark:border-white/[0.06] dark:bg-[#09090B] dark:text-zinc-400">
            Local progress is preserved automatically. Signing in merges your offline attempts with your cloud profile in <span className="font-medium text-[#09090B] dark:text-zinc-200">user_progress</span>.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {mode === 'signin' ? 'Sign In & Sync Progress' : 'Create Account & Sync'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
