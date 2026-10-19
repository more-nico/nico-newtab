import type { AppSettings, BuiltInEngineId } from "../types";
import { t } from "./i18n";

export const DEFAULT_ENGINE_ID: string = "default";
export const MAX_CUSTOM_ENGINES = 8;
export const MAX_ENGINE_NAME = 20;
export const SEARCH_PLACEHOLDER = "%s";

export type EngineGlyph =
  | "default"
  | "google"
  | "bing"
  | "baidu"
  | "duckduckgo";

export interface BuiltInEngine {
  id: BuiltInEngineId;
  /** Absent for "default", which delegates to the browser's own engine. */
  urlTemplate?: string;
  suggest: boolean;
  glyph: EngineGlyph;
}

export const BUILT_IN_ENGINES: readonly BuiltInEngine[] = [
  { id: "default", suggest: false, glyph: "default" },
  {
    id: "google",
    urlTemplate: "https://www.google.com/search?q=%s",
    suggest: true,
    glyph: "google",
  },
  {
    id: "bing",
    urlTemplate: "https://www.bing.com/search?q=%s",
    suggest: true,
    glyph: "bing",
  },
  {
    id: "baidu",
    urlTemplate: "https://www.baidu.com/s?wd=%s",
    suggest: true,
    glyph: "baidu",
  },
  {
    id: "duckduckgo",
    urlTemplate: "https://duckduckgo.com/?q=%s",
    suggest: true,
    glyph: "duckduckgo",
  },
];

/** Localized display name for a built-in engine (read at call time). */
export function builtInEngineName(id: BuiltInEngineId): string {
  return t().lib.engineNames[id];
}

export interface ResolvedEngine {
  id: string;
  name: string;
  /** Absent means the browser's own engine handles the query. */
  urlTemplate?: string;
  suggest: boolean;
  glyph?: EngineGlyph;
  kind: "builtin" | "custom";
}

const BUILT_IN_IDS = new Set<string>(BUILT_IN_ENGINES.map((e) => e.id));

export function isBuiltInEngineId(id: string): boolean {
  return BUILT_IN_IDS.has(id);
}

export function listEngines(settings: AppSettings): ResolvedEngine[] {
  return [
    ...BUILT_IN_ENGINES.map((engine) => ({
      id: engine.id,
      name: builtInEngineName(engine.id),
      urlTemplate: engine.urlTemplate,
      suggest: engine.suggest,
      glyph: engine.glyph,
      kind: "builtin" as const,
    })),
    ...settings.customEngines.map((engine) => ({
      id: engine.id,
      name: engine.name,
      urlTemplate: engine.urlTemplate,
      suggest: false,
      kind: "custom" as const,
    })),
  ];
}

/**
 * Never throws: an id that no longer resolves (engine removed in another tab,
 * or a stale backup) falls back to the browser default so the picker keeps a
 * meaningful label.
 */
export function resolveEngine(settings: AppSettings): ResolvedEngine {
  const engines = listEngines(settings);
  return (
    engines.find((engine) => engine.id === settings.searchEngine) ??
    engines.find((engine) => engine.id === DEFAULT_ENGINE_ID)!
  );
}

/** Substitutes an encoded query into a template holding exactly one `%s`. */
export function buildSearchUrl(template: string, text: string): string {
  return template.replace(SEARCH_PLACEHOLDER, encodeURIComponent(text.trim()));
}
