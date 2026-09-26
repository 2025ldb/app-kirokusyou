export function normalizeQuery(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function toWareki(isoDate: string, withWeekday = false): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  const label =
    year >= 2019
      ? `令和${year - 2018}年${month}月${day}日`
      : `${year}年${month}月${day}日`;
  return withWeekday ? `${label}（${weekday}）` : label;
}

export function eventNeedsWind(event: string): boolean {
  return /100m|200m|110m|100mH|走幅跳|三段跳|１００ｍ|２００ｍ/i.test(
    event.normalize("NFKC"),
  );
}

export function displayName(name: string): string {
  const opens = name.match(/\(/g)?.length ?? 0;
  const closes = name.match(/\)/g)?.length ?? 0;
  if (opens !== closes) {
    return name.replace(/\s*\([^)]*$/, "").trim();
  }
  return name;
}

export function displayEvent(event: string): string {
  return event.normalize("NFKC");
}

export function isMeetRecord(comment: string): boolean {
  return comment
    .normalize("NFKC")
    .toUpperCase()
    .split(/[\s,\/]+/)
    .includes("NGR");
}

export function displayMark(row: {
  markLabel: string;
  mark: string;
  wind: string;
  comment: string;
  event: string;
}): string {
  const mark = row.markLabel || row.mark;
  const parts = [mark];
  if (eventNeedsWind(row.event) && row.wind) {
    parts.push(`（風 ${row.wind}m）`);
  }
  if (isMeetRecord(row.comment)) {
    parts.push("大会新記録");
  }
  return parts.filter(Boolean).join("　");
}

export const ASSOCIATION = "日置地区陸上競技協会";
export const PRESIDENT = "宇田　栄";
export const STADIUM = "伊集院総合運動公園あいハウジング陸上競技場";
