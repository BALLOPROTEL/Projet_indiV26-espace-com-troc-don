#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build_report.py <report-directory>")

    report_dir = Path(sys.argv[1])
    baseline = load_json(report_dir / "baseline-summary.json")
    stress = load_json(report_dir / "stress-summary.json")

    max_current = 0
    max_desired = 0

    with (report_dir / "hpa-history.csv").open(
        newline="", encoding="utf-8"
    ) as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                max_current = max(
                    max_current, int(row["current_replicas"] or 0)
                )
                max_desired = max(
                    max_desired, int(row["desired_replicas"] or 0)
                )
            except ValueError:
                continue

    max_replicas = max(max_current, max_desired)

    lines = [
        "# LOT 8 — Rapport de charge local",
        "",
        "> Ces mesures proviennent d'un environnement Minikube local.",
        "> Elles ne représentent pas un dimensionnement de production.",
        "",
        "## Résultats",
        "",
        "| Scénario | Samples | Débit req/s | Erreurs | p50 ms | p95 ms | p99 ms | Max ms |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]

    for result in (baseline, stress):
        latency = result["latency_ms"]
        lines.append(
            "| {scenario} | {samples} | {throughput} | {errors:.3f}% | "
            "{p50:.3f} | {p95:.3f} | {p99:.3f} | {max_value:.3f} |".format(
                scenario=result["scenario"],
                samples=result["samples"],
                throughput=result["throughput_rps"],
                errors=result["error_rate_percent"],
                p50=latency["p50"],
                p95=latency["p95"],
                p99=latency["p99"],
                max_value=latency["max"],
            )
        )

    lines.extend(
        [
            "",
            "## HPA",
            "",
            f"- maximum current replicas observé : **{max_current}**",
            f"- maximum desired replicas observé : **{max_desired}**",
            f"- scale-up au-dessus de 1 replica : **{'OUI' if max_replicas > 1 else 'NON'}**",
            "",
            "## Fichiers de preuve",
            "",
            "- baseline-results.jtl",
            "- stress-results.jtl",
            "- baseline-summary.json",
            "- stress-summary.json",
            "- hpa-history.csv",
            "- hpa-before.txt",
            "- hpa-after.txt",
            "",
        ]
    )

    rendered = "\n".join(lines)
    (report_dir / "report.md").write_text(
        rendered + "\n", encoding="utf-8"
    )
    print(rendered)

    return 0 if max_replicas > 1 else 2


if __name__ == "__main__":
    raise SystemExit(main())
