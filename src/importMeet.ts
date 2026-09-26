import type { Meet, MeetEvent, Performance } from "./types";
import { ASSOCIATION, STADIUM } from "./format";

const EVENT_RE =
  /(１００ｍＨ|１１０ｍＨ|４００ｍＨ|３００ｍＨ|４×１００ｍ|４×４００ｍ|１００００ｍ|５０００ｍ|３０００ｍ|１５００ｍ|８００ｍ|４００ｍ|２００ｍ|１００ｍ|走幅跳|三段跳|走高跳|棒高跳|砲丸投|円盤投|やり投|ハンマー投)/;

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function nfkc(value: string): string {
  return (value || "").normalize("NFKC");
}

function splitTitle(title: string): [string, string, string] {
  const compact = title.replace(/\s+/g, " ").trim();
  const match = EVENT_RE.exec(compact);
  if (!match || match.index === undefined) return [compact, "", ""];
  return [compact.slice(0, match.index).trim(), match[1], compact.slice(match.index + match[1].length).trim()];
}

function parseWind(text: string): string {
  const match = text.replace("−", "-").match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function formatRecordLabel(raw: string, event: string): string {
  const value = nfkc(raw).trim();
  if (!value) return "";
  if (/^\d+:\d{2}(?:\.\d+)?$/.test(value)) {
    const [minutes, rest] = value.split(":");
    if (rest.includes(".")) {
      const [seconds, frac] = rest.split(".");
      return `${Number(minutes)}分${Number(seconds)}秒${frac}`;
    }
    return `${Number(minutes)}分${Number(rest)}秒`;
  }
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    if (value.includes(".")) {
      const [whole, frac] = value.split(".");
      return `${whole}秒${frac}`;
    }
    return /跳|投/.test(event) ? `${value}m` : `${value}秒`;
  }
  return value;
}

function parseName(raw: string): [string, string] {
  const cleaned = raw.replace(/[ \t]+/g, " ").trim();
  const match = cleaned.match(/\((\d+)\)\s*$/);
  if (!match) return [cleaned, ""];
  return [cleaned.slice(0, match.index).trim(), match[1]];
}

function expandHeaders(headerHtml: string): string[] {
  const headers: string[] = [];
  const re = /<th([^>]*)>(.*?)<\/th>/gis;
  let match: RegExpExecArray | null;
  while ((match = re.exec(headerHtml))) {
    const label = nfkc(stripHtml(match[2]));
    const span = match[1].match(/colspan\s*=\s*['"]?(\d+)/i);
    const colspan = span ? Number(span[1]) : 1;
    if (label === "氏名" && colspan >= 2) headers.push("氏名", "カナ");
    else for (let i = 0; i < colspan; i += 1) headers.push(label);
  }
  return headers;
}

function parseCells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map((match) => stripHtml(match[1]));
}

function officialPages(indexHtml: string): string[] {
  const wanted = new Set<string>();
  const re = /href="(rel\d+\.html)"[^>]*>([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(indexHtml))) {
    const text = nfkc(stripHtml(match[2]));
    if (text === "決勝" || text.includes("総合")) wanted.add(match[1]);
  }
  return [...wanted].sort();
}

function parseResultPage(html: string, source: string) {
  const title = stripHtml(html.match(/<h1>(.*?)<\/h1>/s)?.[1] || "");
  const [category, event, roundName] = splitTitle(title);
  const meetName = stripHtml(html.match(/<h3>(.*?)<\/h3>/s)?.[1] || "").replace(/\s+/g, " ");
  const info = stripHtml(html.match(/<p class="h3-align">(.*?)<\/p>/s)?.[1] || "");
  const dateMatch = info.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  const timeMatch = info.match(/(\d{1,2})時(\d{1,2})分/);
  const referee = info.match(/審\s*判\s*長[:：]\s*([^\n]+)/)?.[1]?.trim() || "";
  const recorder = info.match(/記録主任[:：]\s*([^\n]+)/)?.[1]?.trim() || "";
  let venue = "";
  for (const line of info.split("\n")) {
    if (line.includes("競技場") || line.includes("陸上")) venue = line.trim();
  }
  const pageWind = parseWind(html.match(/class="wind">([^<]+)/)?.[1] || "");
  const contents = html.split('name="CONTENTS"').at(-1) || "";
  const table = contents.match(/<table>(.*?)<\/table>/is)?.[1] || "";
  const rows = [...table.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gis)].map((match) => match[1]);
  const performances: Performance[] = [];
  if (rows.length) {
    const headers = expandHeaders(rows[0]);
    for (const row of rows.slice(1)) {
      const cells = parseCells(row);
      if (!cells.length) continue;
      const data: Record<string, string> = {};
      headers.forEach((header, index) => {
        data[header] = cells[index] || "";
      });
      const nameRaw = data["氏名"] || "";
      const [name, grade] = parseName(nameRaw);
      const affiliation = data["所属"] || "";
      const [prefecture, team] = affiliation.includes("\n")
        ? affiliation.split("\n", 2).map((part) => part.trim())
        : ["", affiliation];
      const recordLines = (data["記録"] || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const mark = recordLines[0] || "";
      const wind = recordLines[1] ? parseWind(recordLines[1]) || pageWind : pageWind;
      const comment = nfkc(data["コメント"] || data["ｺﾒﾝﾄ"] || "").trim();
      const bib = nfkc(data["Bib"] || "").trim();
      performances.push({
        id: `${source.replace(".html", "")}-${bib}-${event}`,
        bib,
        name,
        nameRaw,
        kana: nfkc(data["カナ"] || "").trim(),
        grade,
        prefecture,
        team,
        rank: nfkc(data["順位"] || "").trim(),
        lane: nfkc(data["レーン"] || data["ORD."] || "").trim(),
        heat: nfkc(data["組"] || "").trim(),
        heatPlace: nfkc(data["着"] || "").trim(),
        mark: nfkc(mark).trim(),
        markLabel: formatRecordLabel(mark, event),
        wind,
        comment,
        valid: Boolean(mark) && !["DNS", "DNF", "DQ", "DSQ"].includes(comment.toUpperCase()),
        category,
        event,
        round: nfkc(roundName),
        title: nfkc(title),
        source,
        searchText: nfkc(
          [bib, name, nameRaw, data["カナ"] || "", prefecture, team, category, event, roundName, meetName].join(" "),
        ).toLowerCase(),
      });
    }
  }

  let started = "";
  if (dateMatch && timeMatch) {
    started = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")} ${timeMatch[1].padStart(2, "0")}:${timeMatch[2].padStart(2, "0")}`;
  }

  return {
    title: nfkc(title),
    meetName,
    category,
    event,
    round: nfkc(roundName),
    dateLabel: dateMatch?.[0] || "",
    started,
    venue,
    referee,
    recorder,
    performances,
  };
}

function decodeBuffer(buffer: ArrayBuffer): string {
  for (const encoding of ["shift_jis", "shift-jis", "windows-31j", "utf-8"]) {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      continue;
    }
  }
  return new TextDecoder().decode(buffer);
}

async function decodeHtml(res: Response): Promise<string> {
  return decodeBuffer(await res.arrayBuffer());
}

export async function importMeetFromFiles(
  files: Record<string, string>,
  sourceUrl: string,
  president: string,
): Promise<Meet> {
  const indexName = Object.keys(files).find((name) => name.endsWith("kyougi.html")) || Object.keys(files)[0];
  const indexHtml = files[indexName];
  if (!indexHtml) throw new Error("kyougi.html が見つかりません");
  const meetName = stripHtml(indexHtml.match(/<h3>(.*?)<\/h3>/s)?.[1] || "").replace(/\s+/g, " ");
  const pages = officialPages(indexHtml);
  const events: MeetEvent[] = [];
  const performances: Performance[] = [];
  const meta = { venue: "", referee: "", recorder: "", dateLabel: "", date: "" };

  for (const page of pages) {
    const html = files[page];
    if (!html) continue;
    const parsed = parseResultPage(html, page);
    events.push({
      title: parsed.title,
      category: parsed.category,
      event: parsed.event,
      round: parsed.round,
      source: page,
    });
    performances.push(...parsed.performances);
    if (parsed.venue && !meta.venue) meta.venue = parsed.venue;
    if (parsed.referee && !meta.referee) meta.referee = parsed.referee;
    if (parsed.recorder && !meta.recorder) meta.recorder = parsed.recorder;
    if (parsed.dateLabel && !meta.dateLabel) meta.dateLabel = parsed.dateLabel;
    if (parsed.started && !meta.date) meta.date = parsed.started.slice(0, 10);
  }

  const id = sourceUrl.match(/\/result\/(\d{8})\//)?.[1] || meta.date.replaceAll("-", "");
  return {
    id,
    name: meetName,
    date: meta.date,
    dateLabel: meta.dateLabel,
    venue: STADIUM,
    referee: meta.referee,
    recorder: meta.recorder,
    president,
    organizer: ASSOCIATION,
    sourceUrl,
    events,
    performances,
  };
}

export async function importMeetFromUrl(indexUrl: string, president: string): Promise<Meet> {
  const url = new URL(indexUrl, window.location.origin);
  const fetchUrl =
    url.hostname.includes("hiokiekiden.com") || url.pathname.startsWith("/result/")
      ? `${url.pathname}${url.search}`
      : indexUrl;
  const indexRes = await fetch(fetchUrl);
  if (!indexRes.ok) throw new Error("結果ページを取得できませんでした");
  const indexHtml = await decodeHtml(indexRes);
  const pages = officialPages(indexHtml);
  const files: Record<string, string> = { "kyougi.html": indexHtml };
  const base = fetchUrl.replace(/[^/]+$/, "");
  for (const page of pages) {
    const res = await fetch(`${base}${page}`);
    if (!res.ok) continue;
    files[page] = await decodeHtml(res);
  }
  return importMeetFromFiles(files, indexUrl, president);
}

function basename(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

async function readHtmlFile(file: File): Promise<string> {
  return decodeBuffer(await file.arrayBuffer());
}

export async function importMeetFromFileList(fileList: FileList, president: string): Promise<Meet> {
  const files: Record<string, string> = {};
  for (const file of fileList) {
    files[basename(file.webkitRelativePath || file.name)] = await readHtmlFile(file);
  }
  const sourceUrl = "local-upload";
  return importMeetFromFiles(files, sourceUrl, president);
}
