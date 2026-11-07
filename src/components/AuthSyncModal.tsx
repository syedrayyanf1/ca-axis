import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { CAxisLogo } from './CAxisLogo';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface NavbarAuthControlProps {
  user: User | null;
  syncStatus: SyncStatus;
  onOpenAuthModal: () => void;
  onSignOut: () => Promise<void>;
  onManualSync: () => Promise<void>;
  onResetProgress: () => Promise<void>;
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

function getShortUsername(email?: string): string {
  if (!email) return 'account';
  return email.split('@')[0] || email;
}

export const NavbarAuthControl: React.FC<NavbarAuthControlProps> = ({
  user,
  syncStatus,
  onOpenAuthModal,
  onSignOut,
  onManualSync,
  onResetProgress,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        setConfirmReset(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div ref={containerRef} className="relative flex items-center gap-1.5 shrink-0">
        {/* Compact Reset Progress icon button / popover when logged out */}
        <button
          type="button"
          onClick={() => {
            setDropdownOpen((prev) => !prev);
            setConfirmReset(false);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-[#09090B] dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white shrink-0 cursor-pointer"
          title="Reset Progress"
          aria-label="Reset Progress"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#121215]">
            <div className="px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Local Study Progress
            </div>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
                <span>Reset Progress</span>
              </button>
            ) : (
              <div className="mt-1 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2">
                <p className="mb-2 text-[11px] text-rose-600 dark:text-rose-300">
                  Clear all local exam history?
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetProgress();
                      setConfirmReset(false);
                      setDropdownOpen(false);
                    }}
                    className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onOpenAuthModal}
          style={{ fontFamily: "'Montserrat', sans-serif" }}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-xs font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Cloud className="h-3.5 w-3.5" />
          <span style={{ fontFamily: "'Montserrat', sans-serif" }}>Sign In / Sync</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Single Compact Sleek Account Pill */}
      <button
        type="button"
        onClick={() => {
          setDropdownOpen((prev) => !prev);
          setConfirmReset(false);
        }}
        style={{ fontFamily: "'Montserrat', sans-serif" }}
        className="flex items-center gap-2 rounded-xl border border-black/10 bg-zinc-100 px-2.5 py-1.5 text-xs font-bold text-zinc-900 transition-colors hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white/20 cursor-pointer"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <span
          style={{ fontFamily: "'Montserrat', sans-serif" }}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-black shrink-0"
        >
          {getUserInitials(user.email)}
        </span>

        {syncStatus === 'syncing' ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-emerald-400 shrink-0" />
        ) : syncStatus === 'error' ? (
          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="Local Saved" />
        ) : (
          <span
            className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] shrink-0"
            title="Cloud Synced"
          />
        )}

        <span
          style={{ fontFamily: "'Montserrat', sans-serif" }}
          className="max-w-[110px] truncate hidden sm:inline font-bold"
        >
          {getShortUsername(user.email)}
        </span>

        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Clean Dropdown Popover */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#121215]">
          {/* 1. Full Email Address & Cloud Synced Status */}
          <div className="border-b border-black/[0.07] px-2.5 pt-1.5 pb-2.5 dark:border-white/[0.07]">
            <p className="truncate text-xs font-semibold text-[#09090B] dark:text-white">
              {user.email}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
              {syncStatus === 'syncing' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                  <span className="text-zinc-500 dark:text-zinc-400">Syncing with Cloud...</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-amber-500 dark:text-amber-400">Local Saved</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Cloud Synced</span>
                </>
              )}
            </div>
          </div>

          {/* 2. Sync Now Action Button */}
          <div className="py-1">
            <button
              type="button"
              onClick={async () => {
                await onManualSync();
              }}
              disabled={syncStatus === 'syncing'}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-zinc-400 ${
                  syncStatus === 'syncing' ? 'animate-spin text-emerald-400' : ''
                }`}
              />
              <span>Sync Now</span>
            </button>

            {/* 3. Reset Progress Action Button */}
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
                <span>Reset Progress</span>
              </button>
            ) : (
              <div className="my-1 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2">
                <p className="mb-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                  Reset local &amp; cloud progress?
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetProgress();
                      setConfirmReset(false);
                      setDropdownOpen(false);
                    }}
                    className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Divider Line + Sign Out Button in Subtle Red/Rose Text */}
          <div className="border-t border-black/[0.07] pt-1 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={async () => {
                setDropdownOpen(false);
                await onSignOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
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
            <CAxisLogo containerClassName="h-10 w-10" svgClassName="h-6 w-6" />
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
