#!/usr/bin/env python3
import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0.0

    ordered = sorted(values)
    rank = max(1, math.ceil((percentile_value / 100.0) * len(ordered)))
    return ordered[rank - 1]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Summarize a JMeter CSV JTL file."
    )
    parser.add_argument("jtl", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--scenario", default="unknown")
    args = parser.parse_args()

    elapsed_ms: list[float] = []
    timestamps_ms: list[int] = []
    status_codes: Counter[str] = Counter()
    errors = 0

    with args.jtl.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {"timeStamp", "elapsed", "success", "responseCode"}
        missing = required.difference(reader.fieldnames or [])
        if missing:
            raise SystemExit(
                f"Missing required JTL columns: {', '.join(sorted(missing))}"
            )

        for row in reader:
            elapsed_ms.append(float(row["elapsed"]))
            timestamps_ms.append(int(row["timeStamp"]))
            status_codes[row["responseCode"]] += 1
            if row["success"].strip().lower() != "true":
                errors += 1

    samples = len(elapsed_ms)
    if samples == 0:
        raise SystemExit("JTL file contains no samples.")

    started_ms = min(timestamps_ms)
    finished_ms = max(
        timestamp + elapsed
        for timestamp, elapsed in zip(timestamps_ms, elapsed_ms)
    )
    duration_seconds = max((finished_ms - started_ms) / 1000.0, 0.001)

    summary = {
        "scenario": args.scenario,
        "samples": samples,
        "duration_seconds": round(duration_seconds, 3),
        "throughput_rps": round(samples / duration_seconds, 3),
        "errors": errors,
        "error_rate_percent": round((errors / samples) * 100.0, 3),
        "latency_ms": {
            "mean": round(sum(elapsed_ms) / samples, 3),
            "p50": round(percentile(elapsed_ms, 50), 3),
            "p95": round(percentile(elapsed_ms, 95), 3),
            "p99": round(percentile(elapsed_ms, 99), 3),
            "max": round(max(elapsed_ms), 3),
        },
        "status_codes": dict(sorted(status_codes.items())),
    }

    rendered = json.dumps(summary, indent=2, sort_keys=True)
    print(rendered)

    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
