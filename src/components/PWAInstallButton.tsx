import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white shrink-0 cursor-pointer"
        aria-label="Install App"
        title="Install CAxis App"
      >
        <Download className="h-4 w-4 shrink-0" />
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-black/[0.08] bg-white p-6 shadow-xl dark:border-white/[0.07] dark:bg-[#121215]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.08] bg-zinc-100 text-zinc-900 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-white">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-[#09090B] dark:text-[#FAFAFA]">
                    Install CAxis
                  </h3>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    Offline-Ready Progressive Web App
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              {isIOS ? (
                <div className="rounded-lg border border-black/[0.08] bg-[#FAFAFA] p-4 dark:border-white/[0.07] dark:bg-[#09090B]">
                  <p className="font-medium text-[#09090B] dark:text-[#FAFAFA] mb-1.5 text-xs">
                    Install on iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed text-[#71717A] dark:text-[#A1A1AA]">
                    <li>Tap the <strong>Share</strong> icon at the bottom of Safari.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> in the top-right corner to launch CAxis full-screen.</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg border border-black/[0.08] bg-[#FAFAFA] p-4 dark:border-white/[0.07] dark:bg-[#09090B]">
                  <p className="font-medium text-[#09090B] dark:text-[#FAFAFA] mb-1.5 text-xs">
                    Install on Android / Desktop (Chrome or Edge):
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed text-[#71717A] dark:text-[#A1A1AA]">
                    <li>Open the browser address bar or menu (<strong>⋮</strong>).</li>
                    <li>Select <strong>Install CAxis</strong> or <strong>Add to Home Screen</strong>.</li>
                    <li>If viewing inside a preview frame, open the standalone app URL in a new tab first to trigger native installation.</li>
                  </ol>
                </div>
              )}
              <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                All 4 PRC subject question banks, accounting tables, and KaTeX math formulas are cached locally so you can practice offline with zero bandwidth.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#09090B] shadow-md dark:border-white/[0.07] dark:bg-[#121215] dark:text-[#FAFAFA]">
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span>Offline Mode · Local question bank active</span>
    </div>
  );
};
