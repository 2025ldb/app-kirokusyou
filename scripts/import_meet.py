#!/usr/bin/env python3
"""日置地区陸協の競技結果HTMLから記録証用データを取り込む。"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
import urllib.request
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

USER_AGENT = "HiokiKirokusyouImporter/1.0 (secretariat; +https://hiokiekiden.com/)"
EVENT_RE = re.compile(
    r"(１００ｍＨ|１１０ｍＨ|４００ｍＨ|３００ｍＨ|４×１００ｍ|４×４００ｍ|"
    r"１００００ｍ|５０００ｍ|３０００ｍ|１５００ｍ|８００ｍ|４００ｍ|２００ｍ|１００ｍ|"
    r"走幅跳|三段跳|走高跳|棒高跳|砲丸投|円盤投|やり投|ハンマー投)"
)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    return raw.decode("cp932", errors="replace")


def strip_html(value: str) -> str:
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = unescape(value)
    value = value.replace("\xa0", " ")
    return re.sub(r"[ \t]+\n", "\n", value).strip()


def nfkc(value: str) -> str:
    return unicodedata.normalize("NFKC", value or "")


def split_title(title: str) -> tuple[str, str, str]:
    title = re.sub(r"\s+", " ", title).strip()
    match = EVENT_RE.search(title)
    if not match:
        return title, "", ""
    return title[: match.start()].strip(), match.group(1), title[match.end() :].strip()


def expand_headers(header_html: str) -> list[str]:
    headers: list[str] = []
    for attrs, text in re.findall(r"<th([^>]*)>(.*?)</th>", header_html, flags=re.S | re.I):
        label = nfkc(strip_html(text))
        colspan_match = re.search(r"colspan\s*=\s*['\"]?(\d+)", attrs, flags=re.I)
        colspan = int(colspan_match.group(1)) if colspan_match else 1
        if label == "氏名" and colspan >= 2:
            headers.extend(["氏名", "カナ"])
        else:
            headers.extend([label] * colspan)
    return headers


def parse_cells(row_html: str) -> list[str]:
    return [strip_html(cell) for cell in re.findall(r"<td[^>]*>(.*?)</td>", row_html, flags=re.S | re.I)]


def parse_wind(text: str) -> str:
    match = re.search(r"([+-]?\d+(?:\.\d+)?)", text.replace("−", "-"))
    return match.group(1) if match else ""


def format_record_label(raw: str, event: str) -> str:
    raw = nfkc(raw).strip()
    if not raw:
        return ""
    if re.fullmatch(r"\d+:\d{2}(?:\.\d+)?", raw):
        minutes, rest = raw.split(":", 1)
        if "." in rest:
            seconds, frac = rest.split(".", 1)
            return f"{int(minutes)}分{int(seconds)}秒{frac}"
        return f"{int(minutes)}分{int(rest)}秒"
    if re.fullmatch(r"\d+(?:\.\d+)?", raw):
        if "." in raw:
            whole, frac = raw.split(".", 1)
            return f"{whole}秒{frac}"
        unit = "m" if any(token in event for token in ("跳", "投")) else "秒"
        return f"{raw}{unit}"
    return raw


def parse_name(raw: str) -> tuple[str, str]:
    raw = re.sub(r"[ \t]+", " ", raw).strip()
    grade = ""
    match = re.search(r"\((\d+)\)\s*$", raw)
    if match:
        grade = match.group(1)
        raw = raw[: match.start()].strip()
    return raw, grade


def is_official_round(round_name: str) -> bool:
    text = nfkc(round_name)
    if "総合" in text or text == "決勝":
        return True
    return False


def official_pages(index_html: str) -> list[str]:
    wanted: dict[str, str] = {}
    for href, label in re.findall(r'href="(rel\d+\.html)"[^>]*>([^<]+)', index_html):
        text = nfkc(strip_html(label))
        if text in {"決勝"} or "総合" in text:
            wanted[href] = text
    return sorted(wanted)


def parse_result_page(html: str, source: str) -> dict:
    title = strip_html(re.search(r"<h1>(.*?)</h1>", html, flags=re.S).group(1))
    category, event, round_name = split_title(title)
    meet_match = re.search(r"<h3>(.*?)</h3>", html, flags=re.S)
    meet_name = re.sub(r"\s+", " ", strip_html(meet_match.group(1))) if meet_match else ""

    info = strip_html(re.search(r'<p class="h3-align">(.*?)</p>', html, flags=re.S).group(1)) if re.search(r'class="h3-align"', html) else ""
    date_match = re.search(r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日", info)
    time_match = re.search(r"(\d{1,2})時(\d{1,2})分", info)
    referee_match = re.search(r"審\s*判\s*長[:：]\s*([^\n]+)", info)
    recorder_match = re.search(r"記録主任[:：]\s*([^\n]+)", info)
    venue = ""
    for line in info.splitlines():
        if "競技場" in line or "陸上" in line:
            venue = line.strip()

    page_wind = ""
    wind_match = re.search(r'class="wind">([^<]+)', html)
    if wind_match:
        page_wind = parse_wind(wind_match.group(1))

    contents = html.split('name="CONTENTS"', 1)[-1]
    table_match = re.search(r"<table>(.*?)</table>", contents, flags=re.S | re.I)
    if not table_match:
        return {
            "title": title,
            "meetName": meet_name,
            "performances": [],
        }

    table = table_match.group(1)
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", table, flags=re.S | re.I)
    if not rows:
        return {"title": title, "meetName": meet_name, "performances": []}

    headers = expand_headers(rows[0])
    performances = []
    for row in rows[1:]:
        cells = parse_cells(row)
        if not cells:
            continue
        data = {headers[i]: cells[i] if i < len(cells) else "" for i in range(len(headers))}
        name_raw = data.get("氏名", "")
        name, grade = parse_name(name_raw)
        affiliation = data.get("所属", "")
        prefecture, team = ("", affiliation)
        if "\n" in affiliation:
            prefecture, team = affiliation.split("\n", 1)
            prefecture, team = prefecture.strip(), team.strip()

        record_raw = data.get("記録", "")
        record_lines = [line.strip() for line in record_raw.splitlines() if line.strip()]
        mark = record_lines[0] if record_lines else ""
        wind = page_wind
        if len(record_lines) > 1:
            wind = parse_wind(record_lines[1]) or wind

        comment = nfkc(data.get("コメント", "") or data.get("ｺﾒﾝﾄ", "")).strip()
        rank = nfkc(data.get("順位", "")).strip()
        bib = nfkc(data.get("Bib", "")).strip()
        valid = bool(mark) and comment.upper() not in {"DNS", "DNF", "DQ", "DSQ"}

        search_bits = [
            bib,
            name,
            name_raw,
            data.get("カナ", ""),
            prefecture,
            team,
            category,
            event,
            round_name,
            meet_name,
        ]
        performances.append(
            {
                "id": f"{source.replace('.html', '')}-{bib}-{event}",
                "bib": bib,
                "name": name,
                "nameRaw": name_raw,
                "kana": nfkc(data.get("カナ", "")).strip(),
                "grade": grade,
                "prefecture": prefecture,
                "team": team,
                "rank": rank,
                "lane": nfkc(data.get("レーン", "") or data.get("ORD.", "")).strip(),
                "heat": nfkc(data.get("組", "")).strip(),
                "heatPlace": nfkc(data.get("着", "")).strip(),
                "mark": nfkc(mark).strip(),
                "markLabel": format_record_label(mark, event),
                "wind": wind,
                "comment": comment,
                "valid": valid,
                "category": category,
                "event": event,
                "round": nfkc(round_name),
                "title": nfkc(title),
                "source": source,
                "searchText": nfkc(" ".join(search_bits)).lower(),
            }
        )

    started = ""
    if date_match and time_match:
        started = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d} {int(time_match.group(1)):02d}:{int(time_match.group(2)):02d}"

    return {
        "title": nfkc(title),
        "meetName": meet_name,
        "category": category,
        "event": event,
        "round": nfkc(round_name),
        "dateLabel": date_match.group(0) if date_match else "",
        "started": started,
        "venue": venue,
        "referee": referee_match.group(1).strip() if referee_match else "",
        "recorder": recorder_match.group(1).strip() if recorder_match else "",
        "wind": page_wind,
        "source": source,
        "performances": performances,
    }


def import_meet(index_url: str) -> dict:
    index_html = fetch(index_url)
    meet_match = re.search(r"<h3>(.*?)</h3>", index_html, flags=re.S)
    meet_name = re.sub(r"\s+", " ", strip_html(meet_match.group(1))) if meet_match else ""
    pages = official_pages(index_html)
    events = []
    performances = []
    meta = {
        "venue": "",
        "referee": "",
        "recorder": "",
        "dateLabel": "",
        "date": "",
    }

    for i, page in enumerate(pages):
        html = fetch(urljoin(index_url, page))
        parsed = parse_result_page(html, page)
        events.append(
            {
                "title": parsed["title"],
                "category": parsed["category"],
                "event": parsed["event"],
                "round": parsed["round"],
                "source": page,
            }
        )
        performances.extend(parsed["performances"])
        for key in ("venue", "referee", "recorder", "dateLabel"):
            if parsed.get(key) and not meta[key]:
                meta[key] = parsed[key]
        if parsed.get("started") and not meta["date"]:
            meta["date"] = parsed["started"][:10]
        if i < len(pages) - 1:
            time.sleep(0.05)

    meet_id = re.search(r"/result/(\d{8})/", index_url)
    return {
        "id": meet_id.group(1) if meet_id else meta["date"].replace("-", ""),
        "name": meet_name,
        "date": meta["date"],
        "dateLabel": meta["dateLabel"],
        "venue": meta["venue"] or "伊集院総合運動公園あいハウジング陸上競技場",
        "referee": meta["referee"],
        "recorder": meta["recorder"],
        "president": "宇田　栄",
        "organizer": "日置地区陸上競技協会",
        "sourceUrl": index_url,
        "events": events,
        "performances": performances,
    }


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else "https://hiokiekiden.com/result/20260926/kyougi.html"
    meet = import_meet(url)
    out_dir = Path(__file__).resolve().parents[1] / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "meets.json"
    payload = {"meets": [meet]}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    valid = sum(1 for row in meet["performances"] if row["valid"])
    print(f"wrote {path}")
    print(f"meet: {meet['name']}")
    print(f"events: {len(meet['events'])}")
    print(f"performances: {len(meet['performances'])} (valid {valid})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
