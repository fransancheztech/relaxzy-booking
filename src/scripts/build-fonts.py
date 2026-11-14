"""Builds the app's font files in src/app/fonts from Google's originals.

The app keeps its fonts in the project, so a build never downloads them (a failed download from
Google Fonts used to break builds). This trims each font to the characters the app needs:

  * Inter-Variable.woff2: Inter, every weight, at its small-text optical size (14), for Latin
    (Spanish, English and any European client name), Greek, punctuation, currency and arrows.
  * NotoSansThaiLooped-Variable.woff2: Noto Sans Thai Looped, every weight, normal width, Thai
    only. The looped style (small circles on the letters) is the one Thai staff find easier to
    read; the loopless Noto Sans Thai was tried first.

Characters outside these (emoji, ★, ⚠, ✔…) come from the device's own fonts.

Usage (Python 3, once):
    pip install fonttools brotli
    curl -LO "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf"
    curl -LO "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthailooped/NotoSansThaiLooped%5Bwdth,wght%5D.ttf"
    python src/scripts/build-fonts.py <folder with both .ttf files> src/app/fonts
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

INTER_RANGES = (
    "U+0000-024F,U+0259,U+02C6-02DD,U+0300-036F,U+0370-03FF,U+2000-206F,U+20A0-20CF,"
    "U+2100-2122,U+2190-21FF,U+2212-2215,U+2260-2265,U+25CF,U+FEFF,U+FFFD"
)
# Thai, the zero-width characters Thai text uses, and the dotted circle shown under lone marks.
THAI_RANGES = "U+0E00-0E7F,U+200B-200D,U+25CC"


def parse(ranges):
    codes = []
    for part in ranges.split(","):
        lo, _, hi = part.removeprefix("U+").partition("-")
        codes.extend(range(int(lo, 16), int(hi or lo, 16) + 1))
    return codes


def trim(font, ranges):
    options = subset.Options()
    options.layout_features = ["*"]  # every OpenType feature: tabular digits, Thai mark placement…
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=parse(ranges))
    subsetter.subset(font)
    return font


def save(font, path):
    font.flavor = "woff2"
    font.save(path)
    print(f"{path}: {path.stat().st_size / 1024:.0f} KB, {len(font.getBestCmap())} characters")


def main(src, out):
    out.mkdir(parents=True, exist_ok=True)
    # Trim before pinning an axis: the other order fails on the Noto Thai fonts.
    inter = trim(TTFont(src / "Inter[opsz,wght].ttf"), INTER_RANGES)
    save(instancer.instantiateVariableFont(inter, {"opsz": 14}), out / "Inter-Variable.woff2")
    thai = trim(TTFont(src / "NotoSansThaiLooped[wdth,wght].ttf"), THAI_RANGES)
    save(instancer.instantiateVariableFont(thai, {"wdth": 100}), out / "NotoSansThaiLooped-Variable.woff2")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
