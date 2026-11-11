#!/usr/bin/env python3
"""巡检新加坡寺院官方页面，生成待人工核验的候选报告。

本脚本刻意不直接修改 catalog.json。法会日期、时区、地点和报名链接必须
由维护者对照官方页面确认，再进入 published 目录。
"""

import argparse
import datetime as dt
import hashlib
import html
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


KEYWORDS = re.compile(
    r"(法会|共修|拜忏|忏法|诵经|祈福|供天|佛七|佛二|"
    r"ceremony|puja|repentance|chanting|dharma\s+assembly)",
    re.IGNORECASE,
)
DATE = re.compile(
    r"(?:20(?:26|27)[-/.\s年]\d{1,2}[-/.\s月]\d{1,2}日?|"
    r"\d{1,2}[-/.]\d{1,2}[-/.]20(?:26|27)|"
    r"\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20(?:26|27))",
    re.IGNORECASE,
)


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.ignored = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "svg", "noscript"}:
            self.ignored += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "svg", "noscript"} and self.ignored:
            self.ignored -= 1

    def handle_data(self, data: str) -> None:
        if not self.ignored:
            self.parts.append(data)


def visible_text(source: str) -> str:
    parser = TextExtractor()
    parser.feed(source)
    return re.sub(r"\s+", " ", html.unescape(" ".join(parser.parts))).strip()


def parsed_dates(text: str) -> list[dt.date]:
    values: list[dt.date] = []
    for match in DATE.finditer(text):
        source = match.group(0).replace("年", "-").replace("月", "-").replace("日", "")
        for pattern in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y"):
            try:
                values.append(dt.datetime.strptime(source.strip(), pattern).date())
                break
            except ValueError:
                continue
    return values


def candidate_snippets(text: str, cutoff: dt.date) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()
    for match in KEYWORDS.finditer(text):
        start = max(0, match.start() - 90)
        end = min(len(text), match.end() + 150)
        snippet = text[start:end].strip(" -|\n\t")
        dates = parsed_dates(snippet)
        if not dates or max(dates) < cutoff or snippet in seen:
            continue
        seen.add(snippet)
        candidates.append(snippet[:260])
        if len(candidates) >= 30:
            break
    return candidates


def fetch(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ShannianDharmaEventBot/2.0 (+https://github.com/pzdn2009/shannian-app)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        content = response.read(3_000_000)
        charset = response.headers.get_content_charset() or "utf-8"
    return content, charset


def main() -> None:
    root = Path(__file__).parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=Path, default=root / "sources.json")
    parser.add_argument("--output", type=Path, default=root / "crawl-report.json")
    parser.add_argument("--from-date", type=dt.date.fromisoformat, default=dt.date.today())
    args = parser.parse_args()
    config = json.loads(args.sources.read_text(encoding="utf-8"))
    results = []
    for source in config["sources"]:
        item = {"id": source["id"], "name": source["name"], "url": source["url"]}
        try:
            content, charset = fetch(source["url"])
            text = visible_text(content.decode(charset, errors="replace"))
            item.update(
                status="ok",
                sha256=hashlib.sha256(content).hexdigest(),
                candidates=candidate_snippets(text, args.from_date),
            )
        except Exception as error:  # Network failures belong in the report.
            item.update(status="error", error=str(error))
        results.append(item)
    report = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "fromDate": args.from_date.isoformat(),
        "policy": config["policy"],
        "sources": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    ok = sum(item["status"] == "ok" for item in results)
    candidates = sum(len(item.get("candidates", [])) for item in results)
    print(f"Crawled {ok}/{len(results)} official sources; {candidates} candidates")


if __name__ == "__main__":
    main()
