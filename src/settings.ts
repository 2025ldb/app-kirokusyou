export type OrgSettings = {
  organizer: string;
  president: string;
  stadium: string;
  adminPassword: string;
};

export const DEFAULT_SETTINGS: OrgSettings = {
  organizer: "日置地区陸上競技協会",
  president: "宇田　栄",
  stadium: "伊集院総合運動公園あいハウジング陸上競技場",
  adminPassword: "hioki",
};

const STORAGE_KEY = "kirokusyou-settings";

export function loadLocalSettings(): Partial<OrgSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<OrgSettings>) : {};
  } catch {
    return {};
  }
}

export function saveLocalSettings(settings: OrgSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function mergeSettings(base: OrgSettings, overlay: Partial<OrgSettings>): OrgSettings {
  return { ...base, ...overlay };
}

const EXTRA_MEETS_KEY = "kirokusyou-meets-extra";

export function loadExtraMeets<T>(): T[] {
  try {
    const raw = localStorage.getItem(EXTRA_MEETS_KEY);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function saveExtraMeets<T>(meets: T[]): void {
  localStorage.setItem(EXTRA_MEETS_KEY, JSON.stringify(meets));
}

export function mergeMeetsById<T extends { id: string; date: string }>(published: T[], extras: T[]): T[] {
  const byId = new Map(published.map((meet) => [meet.id, meet]));
  for (const extra of extras) byId.set(extra.id, extra);
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}
