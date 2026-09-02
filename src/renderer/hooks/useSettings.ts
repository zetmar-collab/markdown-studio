import { useCallback, useEffect, useMemo, useState } from "react";
import { createTranslator } from "../../shared/i18n";
import { DEFAULT_SETTINGS, type AppSettings } from "../../shared/settings";
import type { PlatformInfo } from "../../types/electron-api";

/**
 * Settings live in the main process (userData/settings.json) so the native menu
 * and the renderer always agree, and so a large document can never blow a
 * localStorage quota and take the UI down with it.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [platform, setPlatform] = useState<PlatformInfo>({
    version: "",
    isStoreBuild: false,
    platform: "win32"
  });

  useEffect(() => {
    let cancelled = false;
    void window.markdownStudio.getPlatformInfo().then((info) => {
      if (!cancelled) setPlatform(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void window.markdownStudio.getSettings().then((value) => {
      if (cancelled) return;
      setSettings(value);
      setLoaded(true);
    });
    const unsubscribe = window.markdownStudio.onSettingsChanged((value) => setSettings(value));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await window.markdownStudio.updateSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const reset = useCallback(async () => {
    const next = await window.markdownStudio.resetSettings();
    setSettings(next);
    return next;
  }, []);

  const t = useMemo(() => createTranslator(settings.language), [settings.language]);

  return { settings, update, reset, t, loaded, platform };
}
