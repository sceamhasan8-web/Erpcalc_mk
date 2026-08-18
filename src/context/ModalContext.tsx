"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Trash2,
  HelpCircle,
} from "lucide-react";

export type ModalType = "danger" | "error" | "warning" | "info" | "success" | "question";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface AlertDialogOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ModalType;
  duration?: number;
}

interface ModalContextValue {
  showConfirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
  showAlert: (options: AlertDialogOptions | string) => Promise<void>;
  showToast: (
    options: string | { message: string; title?: string; type?: ModalType; duration?: number },
    type?: ModalType
  ) => void;
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
  alert: (options: AlertDialogOptions | string) => Promise<void>;
  toast: {
    (message: string, type?: ModalType): void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

// Global reference for standalone calls outside React component trees if needed
let globalModalHandlers: {
  showConfirm?: (opts: ConfirmDialogOptions | string) => Promise<boolean>;
  showAlert?: (opts: AlertDialogOptions | string) => Promise<void>;
  showToast?: (opts: any, type?: ModalType) => void;
} = {};

export function ModalProvider({ children }: { children: ReactNode }) {
  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { message: "" },
  });

  // Alert state
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertDialogOptions;
    resolve?: () => void;
  }>({
    isOpen: false,
    options: { message: "" },
  });

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Show confirm implementation
  const showConfirm = useCallback(
    (options: ConfirmDialogOptions | string): Promise<boolean> => {
      const opts: ConfirmDialogOptions =
        typeof options === "string" ? { message: options } : options;
      return new Promise<boolean>((resolve) => {
        setConfirmState({
          isOpen: true,
          options: {
            title: opts.title || (opts.type === "danger" ? "Confirm Deletion" : "Confirmation"),
            message: opts.message,
            type: opts.type || (opts.message.toLowerCase().includes("delete") ? "danger" : "question"),
            confirmText: opts.confirmText || (opts.type === "danger" || opts.message.toLowerCase().includes("delete") ? "Delete" : "Confirm"),
            cancelText: opts.cancelText || "Cancel",
            destructive: opts.destructive ?? (opts.type === "danger" || opts.message.toLowerCase().includes("delete")),
          },
          resolve,
        });
      });
    },
    []
  );

  // Show alert implementation
  const showAlert = useCallback(
    (options: AlertDialogOptions | string): Promise<void> => {
      const opts: AlertDialogOptions =
        typeof options === "string" ? { message: options } : options;
      return new Promise<void>((resolve) => {
        const isError =
          opts.type === "error" ||
          opts.message.toLowerCase().includes("error") ||
          opts.message.toLowerCase().includes("failed") ||
          opts.message.toLowerCase().includes("unable") ||
          opts.message.toLowerCase().includes("cannot");

        const isSuccess =
          opts.type === "success" ||
          opts.message.toLowerCase().includes("success") ||
          opts.message.toLowerCase().includes("completed");

        const inferredType: ModalType =
          opts.type || (isError ? "error" : isSuccess ? "success" : "info");

        let defaultTitle = "Notice";
        if (inferredType === "error") defaultTitle = "Action Failed";
        else if (inferredType === "warning") defaultTitle = "Attention Required";
        else if (inferredType === "success") defaultTitle = "Successful";
        else if (inferredType === "info") defaultTitle = "Information";

        setAlertState({
          isOpen: true,
          options: {
            title: opts.title || defaultTitle,
            message: opts.message,
            type: inferredType,
            confirmText: opts.confirmText || "Got it",
          },
          resolve,
        });
      });
    },
    []
  );

  // Show toast implementation
  const showToast = useCallback(
    (
      options: string | { message: string; title?: string; type?: ModalType; duration?: number },
      type?: ModalType
    ) => {
      const id = Math.random().toString(36).substring(2, 9);
      const opts =
        typeof options === "string"
          ? { message: options, type: type || "info", duration: 4000 }
          : { duration: 4000, ...options, type: options.type || type || "info" };

      const newToast: ToastItem = {
        id,
        title: opts.title,
        message: opts.message,
        type: opts.type || "info",
        duration: opts.duration,
      };

      setToasts((prev) => [...prev, newToast]);

      if (opts.duration && opts.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, opts.duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Handlers for confirm dialog
  const handleConfirmClose = (result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  // Handlers for alert dialog
  const handleAlertClose = () => {
    if (alertState.resolve) {
      alertState.resolve();
    }
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  // Setup global handlers
  useEffect(() => {
    globalModalHandlers = {
      showConfirm,
      showAlert,
      showToast,
    };
  }, [showConfirm, showAlert, showToast]);

  // Keyboard shortcut support (Escape closes dialogs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmState.isOpen) {
          handleConfirmClose(false);
        } else if (alertState.isOpen) {
          handleAlertClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmState.isOpen, alertState.isOpen]);

  // Helper object for toast.success etc
  const toastObj = Object.assign(
    (msg: string, type: ModalType = "info") => showToast(msg, type),
    {
      success: (msg: string, title?: string) =>
        showToast({ message: msg, title: title || "Success", type: "success" }),
      error: (msg: string, title?: string) =>
        showToast({ message: msg, title: title || "Error", type: "error" }),
      warning: (msg: string, title?: string) =>
        showToast({ message: msg, title: title || "Warning", type: "warning" }),
      info: (msg: string, title?: string) =>
        showToast({ message: msg, title: title || "Info", type: "info" }),
    }
  );

  return (
    <ModalContext.Provider
      value={{
        showConfirm,
        showAlert,
        showToast,
        confirm: showConfirm,
        alert: showAlert,
        toast: toastObj,
      }}
    >
      {children}

      {/* Confirmation Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-md bg-white dark:bg-[#0e172a] rounded-2xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-700/80 transform transition-all animate-scale-up"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-3.5 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner ${
                  confirmState.options.type === "danger"
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50"
                    : confirmState.options.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50"
                }`}
              >
                {confirmState.options.type === "danger" ? (
                  <Trash2 className="w-6 h-6 stroke-[2.2]" />
                ) : confirmState.options.type === "warning" ? (
                  <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
                ) : (
                  <HelpCircle className="w-6 h-6 stroke-[2.2]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {confirmState.options.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl transition-all active:scale-95 focus:outline-none"
              >
                {confirmState.options.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                autoFocus
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md transition-all active:scale-95 focus:outline-none flex items-center gap-2 ${
                  confirmState.options.destructive || confirmState.options.type === "danger"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-rose-600/25"
                    : confirmState.options.type === "warning"
                    ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25"
                    : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/25"
                }`}
              >
                {confirmState.options.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-md bg-white dark:bg-[#0e172a] rounded-2xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-700/80 transform transition-all animate-scale-up"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-3.5 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner ${
                  alertState.options.type === "error" || alertState.options.type === "danger"
                    ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/50"
                    : alertState.options.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50"
                    : alertState.options.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50"
                }`}
              >
                {alertState.options.type === "error" || alertState.options.type === "danger" ? (
                  <AlertCircle className="w-6 h-6 stroke-[2.2]" />
                ) : alertState.options.type === "warning" ? (
                  <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
                ) : alertState.options.type === "success" ? (
                  <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
                ) : (
                  <Info className="w-6 h-6 stroke-[2.2]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {alertState.options.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                  {alertState.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleAlertClose}
                autoFocus
                className={`w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md transition-all active:scale-95 focus:outline-none flex items-center justify-center gap-2 ${
                  alertState.options.type === "error" || alertState.options.type === "danger"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/25"
                    : alertState.options.type === "warning"
                    ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25"
                    : alertState.options.type === "success"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25"
                    : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/25"
                }`}
              >
                {alertState.options.confirmText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-slide-in-right ${
              t.type === "success"
                ? "bg-emerald-950/90 text-emerald-100 border-emerald-700/50 shadow-emerald-950/30"
                : t.type === "error" || t.type === "danger"
                ? "bg-red-950/90 text-red-100 border-red-700/50 shadow-red-950/30"
                : t.type === "warning"
                ? "bg-amber-950/90 text-amber-100 border-amber-700/50 shadow-amber-950/30"
                : "bg-slate-900/90 text-slate-100 border-slate-700/60 shadow-slate-950/40"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {t.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : t.type === "error" || t.type === "danger" ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : t.type === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <Info className="w-5 h-5 text-blue-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {t.title && (
                <p className="text-sm font-bold leading-tight mb-0.5">{t.title}</p>
              )}
              <p className="text-xs text-slate-200/90 leading-snug break-words">
                {t.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
