"""Derive the ambient reconstruction koto from the unchanged A/B recordings."""
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOUNDS = ROOT / "resource_packs/rp_19_c6529ee0-0a34-4f28-b5ff-66d335fee9bc/sounds/infinite_castle"
# Soften the pluck and let quiet reflections outlast the dry original.
# Mono allows the engine to position this recording away from each listener.
FILTER = "highpass=f=100,lowpass=f=2200,aecho=0.8:0.85:140|290|470:0.32|0.20|0.12,lowpass=f=2600"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--output", type=Path, default=SOUNDS)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for variant in ("a", "b"):
        subprocess.run([
            args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(SOUNDS / f"koto_{variant}.ogg"), "-af", FILTER,
            "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5",
            "-map_metadata", "-1", str(args.output / f"koto_{variant}_distant.ogg"),
        ], check=True)


if __name__ == "__main__":
    main()
