import { Capacitor } from "@capacitor/core";

/**
 * Open a file chooser synchronously from a user gesture. Android WebViews
 * support showPicker on newer versions; older WebViews fall back to click().
 */
export function openFilePicker(input: HTMLInputElement | null): void {
  if (!input) return;

  if (Capacitor.isNativePlatform()) {
    const nativeInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };
    if (typeof nativeInput.showPicker === "function") {
      try {
        nativeInput.showPicker();
        return;
      } catch {
        // Keep the click fallback synchronous while the user gesture is active.
      }
    }
  }

  input.click();
}
