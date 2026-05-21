from __future__ import annotations

import argparse
import re
from pathlib import Path

from fontTools import subset


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_FONT_DIR = PROJECT_ROOT / "fonts"
DEFAULT_RESOURCE_DIR = PROJECT_ROOT / "resources"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "dist"
DEFAULT_CHARSET_FILE = DEFAULT_RESOURCE_DIR / "3500常用字.txt"


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8-sig", "gbk"):
        try:
            return path.read_text(encoding=encoding, errors="ignore")
        except UnicodeError:
            continue
    return path.read_text(encoding="utf-8", errors="ignore")


def normalize_charset_file(charset_file: Path) -> int:
    content = read_text_with_fallback(charset_file)
    cleaned_content = re.sub(r"\s+", "", content)
    sorted_chars = "".join(sorted(set(cleaned_content)))

    tmp_file = charset_file.with_suffix(charset_file.suffix + ".tmp")
    tmp_file.write_text(sorted_chars, encoding="utf-8")
    tmp_file.replace(charset_file)
    return len(sorted_chars)


def subset_font(input_font: Path, output_font: Path, charset_file: Path) -> None:
    if output_font.exists():
        output_font.unlink()

    subset.main(
        [
            str(input_font),
            f"--output-file={output_font}",
            "--flavor=woff2",
            f"--text-file={charset_file}",
            "--layout-features=*",
            "--no-hinting",
        ]
    )


def find_ttf_fonts(font_dir: Path) -> list[Path]:
    return sorted(font_dir.glob("*.ttf"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Batch subset TTF fonts into WOFF2 files using a normalized charset file."
    )
    parser.add_argument(
        "--font-dir",
        type=Path,
        default=DEFAULT_FONT_DIR,
        help=f"Directory containing source .ttf fonts. Default: {DEFAULT_FONT_DIR}",
    )
    parser.add_argument(
        "--charset",
        type=Path,
        default=DEFAULT_CHARSET_FILE,
        help=f"Charset text file used for subsetting. Default: {DEFAULT_CHARSET_FILE}",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for generated .woff2 files. Default: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument(
        "--suffix",
        default="-3500",
        help="Suffix appended to each generated file name before .woff2. Default: -3500",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    font_dir = args.font_dir.resolve()
    charset_file = args.charset.resolve()
    output_dir = args.output_dir.resolve()

    print("=== 开始执行批量字体子集化流程 ===")

    if not charset_file.is_file():
        print(f"缺少字符集文件: {charset_file}")
        return 1

    if not font_dir.is_dir():
        print(f"缺少字体目录: {font_dir}")
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"正在整理字符集: {charset_file}")
    char_count = normalize_charset_file(charset_file)
    print(f"字符集整理完成，共 {char_count} 个唯一字符")

    ttf_files = find_ttf_fonts(font_dir)
    if not ttf_files:
        print(f"没有找到任何 .ttf 文件: {font_dir}")
        return 1

    print(f"找到 {len(ttf_files)} 个 .ttf 文件，准备压缩")
    print("----------------------------------------")

    for input_font in ttf_files:
        output_font = output_dir / f"{input_font.stem}{args.suffix}.woff2"
        print(f"正在压缩: {input_font.name} -> {output_font.name}")
        subset_font(input_font, output_font, charset_file)
        print(f"完成: {output_font}")
        print("----------------------------------------")

    print("所有 TTF 字体已全部批量压缩完毕")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
