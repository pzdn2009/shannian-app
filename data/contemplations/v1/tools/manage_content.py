#!/usr/bin/env python3
"""Prepare and validate the public contemplation content tree."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "catalog.json"
HASH = re.compile(r"^[0-9a-f]{64}$")
ID = re.compile(r"^[a-z0-9]+(?:[.-][a-z0-9]+)*$")


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_child(parent: Path, relative: str, label: str) -> Path:
    candidate = (parent / relative).resolve()
    if parent.resolve() not in candidate.parents:
        fail(f"{label}: path escapes its content directory")
    return candidate


def require_https(value: str, label: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        fail(f"{label}: HTTPS URL is required")


def validate() -> None:
    catalog = load_json(CATALOG_PATH)
    if catalog.get("protocolVersion") != 1:
        fail("catalog: protocolVersion must be 1")
    require_https(catalog.get("contentBaseURL", ""), "contentBaseURL")
    if not catalog["contentBaseURL"].endswith("/"):
        fail("contentBaseURL must end with /")

    category_ids = [value["id"] for value in catalog.get("categories", [])]
    if len(category_ids) != len(set(category_ids)):
        fail("catalog: duplicate category id")

    item_ids: set[str] = set()
    for entry in catalog.get("items", []):
        item_id = entry["id"]
        if not ID.fullmatch(item_id) or item_id in item_ids:
            fail(f"catalog: invalid or duplicate item id {item_id}")
        item_ids.add(item_id)
        if entry["categoryID"] not in category_ids:
            fail(f"{item_id}: unknown categoryID")
        if entry["status"] not in {"published", "hidden", "retired"}:
            fail(f"{item_id}: invalid status")
        manifest_path = safe_child(ROOT / "items", entry["file"], item_id)
        if not manifest_path.is_file() or digest(manifest_path) != entry["sha256"]:
            fail(f"{item_id}: item.json SHA-256 mismatch")

        manifest = load_json(manifest_path)
        if manifest.get("protocolVersion") != 1 or manifest.get("id") != item_id:
            fail(f"{item_id}: manifest identity mismatch")
        if manifest.get("contentVersion") != entry.get("contentVersion"):
            fail(f"{item_id}: contentVersion mismatch")
        if manifest.get("categoryID") != entry.get("categoryID"):
            fail(f"{item_id}: categoryID mismatch")
        source = manifest.get("source", {})
        if source.get("kind") not in {"canonical-text", "editorial-guide", "shannian-practice"}:
            fail(f"{item_id}: invalid source kind")
        if not source.get("citation"):
            fail(f"{item_id}: source citation is required")
        if source.get("url"):
            require_https(source["url"], f"{item_id}/source/url")

        unit_ids: set[str] = set()
        item_dir = manifest_path.parent
        units = manifest.get("units", [])
        if not units:
            fail(f"{item_id}: invalid unit count")
        for unit in units:
            unit_id = unit["id"]
            if not ID.fullmatch(unit_id) or unit_id in unit_ids:
                fail(f"{item_id}: invalid or duplicate unit id {unit_id}")
            unit_ids.add(unit_id)
            text_path = safe_child(item_dir, unit["file"], f"{item_id}/{unit_id}")
            if text_path.suffix != ".txt" or not text_path.is_file():
                fail(f"{item_id}/{unit_id}: missing txt file")
            text = text_path.read_text(encoding="utf-8")
            if not text.strip():
                fail(f"{item_id}/{unit_id}: txt file is empty")
            if not HASH.fullmatch(unit.get("sha256", "")) or digest(text_path) != unit["sha256"]:
                fail(f"{item_id}/{unit_id}: txt SHA-256 mismatch")


def next_revision(previous: str, today: str) -> str:
    prefix, _, suffix = previous.partition(".")
    sequence = int(suffix) + 1 if prefix == today and suffix.isdigit() else 1
    return f"{today}.{sequence}"


def publish(item_ids: list[str]) -> None:
    catalog = load_json(CATALOG_PATH)
    published: list[tuple[str, int]] = []
    for item_id in item_ids:
        entry = next((value for value in catalog["items"] if value["id"] == item_id), None)
        if entry is None:
            fail(f"unknown item id: {item_id}")
        manifest_path = safe_child(ROOT / "items", entry["file"], item_id)
        manifest = load_json(manifest_path)
        for unit in manifest["units"]:
            text_path = safe_child(manifest_path.parent, unit["file"], f"{item_id}/{unit['id']}")
            unit["sha256"] = digest(text_path)
        manifest["contentVersion"] = int(manifest.get("contentVersion", 0)) + 1
        write_json(manifest_path, manifest)
        entry["contentVersion"] = manifest["contentVersion"]
        entry["sha256"] = digest(manifest_path)
        published.append((item_id, manifest["contentVersion"]))

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    today = (now + dt.timedelta(hours=8)).date().isoformat()
    catalog["revision"] = next_revision(catalog.get("revision", ""), today)
    catalog["updatedAt"] = now.isoformat().replace("+00:00", "Z")
    write_json(CATALOG_PATH, catalog)
    validate()
    versions = ", ".join(f"{item_id}={version}" for item_id, version in published)
    print(f"prepared {versions} revision={catalog['revision']}")


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "check"
    if command == "check" and len(sys.argv) == 2:
        validate()
        print("contemplation content is valid")
        return
    if command == "publish" and len(sys.argv) >= 3:
        publish(sys.argv[2:])
        return
    fail("usage: manage_content.py check | publish <item-id> [item-id ...]")


if __name__ == "__main__":
    main()
