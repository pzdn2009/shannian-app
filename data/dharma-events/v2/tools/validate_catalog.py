#!/usr/bin/env python3
import datetime as dt
import json
import sys
from pathlib import Path
from urllib.parse import urlparse


def fail(message: str) -> None:
    raise ValueError(message)


def parse_time(value: str, label: str) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{label}: invalid ISO 8601 time") from error
    if parsed.tzinfo is None:
        fail(f"{label}: timezone offset is required")
    return parsed


def require_https(value: str, label: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        fail(f"{label}: HTTPS URL is required")


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parents[1] / "catalog.json")
    catalog = json.loads(path.read_text(encoding="utf-8"))
    if catalog.get("protocolVersion") != 2:
        fail("protocolVersion must be 2")
    if catalog.get("region") != "SG" or catalog.get("timeZone") != "Asia/Singapore":
        fail("region/timeZone must be SG/Asia/Singapore")
    updated_at = parse_time(catalog["updatedAt"], "updatedAt")

    temple_ids = [temple["id"] for temple in catalog["temples"]]
    if len(temple_ids) != len(set(temple_ids)):
        fail("duplicate temple id")

    event_ids: set[str] = set()
    for event in catalog["events"]:
        label = event["id"]
        if label in event_ids:
            fail(f"{label}: duplicate event id")
        event_ids.add(label)
        if event["templeID"] not in temple_ids:
            fail(f"{label}: unknown templeID")
        if not event.get("schedule"):
            fail(f"{label}: schedule is required")
        session_ids: set[str] = set()
        previous_start: dt.datetime | None = None
        latest_end: dt.datetime | None = None
        for session in event["schedule"]:
            session_label = f"{label}/{session['id']}"
            if session["id"] in session_ids:
                fail(f"{session_label}: duplicate session id")
            session_ids.add(session["id"])
            start = parse_time(session["start"], f"{session_label}/start")
            if previous_start and start < previous_start:
                fail(f"{session_label}: schedule must be chronological")
            previous_start = start
            end = parse_time(session["end"], f"{session_label}/end") if "end" in session else start
            if end < start or ("end" in session and end == start):
                fail(f"{session_label}: end must be later than start")
            latest_end = max(latest_end or end, end)
        if event["status"] == "published":
            require_https(event.get("sourceURL", ""), f"{label}/sourceURL")
            parse_time(event.get("verifiedAt", ""), f"{label}/verifiedAt")
            if latest_end and latest_end < updated_at:
                fail(f"{label}: expired published event must be removed")
        for key in ("sourceURL", "signupURL"):
            if key in event:
                require_https(event[key], f"{label}/{key}")
        if poster := event.get("poster"):
            require_https(poster["url"], f"{label}/poster/url")
            require_https(poster["thumbnailURL"], f"{label}/poster/thumbnailURL")

    print(f"OK: {len(catalog['temples'])} temples, {len(catalog['events'])} events")


if __name__ == "__main__":
    try:
        main()
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
