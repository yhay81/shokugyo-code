# Source and transformation

## Official source

- Service: 政府統計の総合窓口 e-Stat
- Classification: 日本標準職業分類（平成21年［2009年］12月統計基準設定）
- Source: <https://www.e-stat.go.jp/classifications/terms/20>
- Revision: `02`
- Retrieved: 2026-08-02
- CSV: 149,426 bytes
- SHA-256: `9291694fd144cd6ca65414a183a074bd1ffad80ff7c9aa8b82e12d0852eb699a`

## Dimensions

The official interface reports 416 results. The CSV contains one code-less search advisory followed by 415 unique codes: 12 major classifications, 74 middle classifications, and 329 minor classifications.

## Transformation / 加工

The generator downloads the public UTF-8 CSV, verifies its hash, title, columns, dimensions, uniqueness, known records, and every parent reference. It removes only the code-less advisory row, normalizes line endings, and derives hierarchy level, parent code, and major code from official order and code structure. Official names and descriptions are not summarized in the data.

Examples and non-matching examples remain on e-Stat detail pages and are linked rather than copied. Use follows the [e-Stat terms of use](https://www.e-stat.go.jp/terms-of-use); attribution and transformation are disclosed, and no official endorsement is implied.

## Classification boundary

This product covers the statistical standard 日本標準職業分類. It is not the separate 令和4年改定「厚生労働省編職業分類」used in Hello Work operations. Surveys may also regroup the standard. Users must confirm the classification and revision required by the destination.
