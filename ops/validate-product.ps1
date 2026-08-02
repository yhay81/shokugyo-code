[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Required = @("DECISIONS.md","EXPERIMENT.md","LICENSE","METRICS.md","PRIVACY.md","README.md","SECURITY.md","SOURCE.md","STACK.md",".github\workflows\ci.yml","migrations\0001_telemetry.sql","ops\product-metrics.ps1","ops\product-metrics.sql","ops\submit-indexnow.ps1","public\app.js","public\data\index.json","public\favicon.svg","public\manifest.webmanifest","public\og.svg","public\robots.txt","scripts\build-data.mjs","src\worker.tsx","test\occupation-data.test.ts","test\surface.test.ts")
foreach ($Path in $Required) { if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $Path))) { throw "Missing required file: $Path" } }
$Worker = Get-Content -Raw (Join-Path $RepoRoot "src\worker.tsx"); $App = Get-Content -Raw (Join-Path $RepoRoot "public\app.js"); $Css = Get-Content -Raw (Join-Path $RepoRoot "public\styles.css"); $Migration = Get-Content -Raw (Join-Path $RepoRoot "migrations\0001_telemetry.sql"); $Source = Get-Content -Raw (Join-Path $RepoRoot "SOURCE.md"); $Wrangler = Get-Content -Raw (Join-Path $RepoRoot "wrangler.jsonc"); $DataPath = Join-Path $RepoRoot "public\data\index.json"; $Data = Get-Content -Raw $DataPath | ConvertFrom-Json; $Surface = "$Worker`n$App"
if (-not $Worker.Contains('class="workbench"') -or -not $Worker.Contains('class="worker-row"') -or -not $Worker.Contains('class="job-rail"') -or -not $Worker.Contains('class="major-grid"') -or -not $Worker.Contains('class="compare-tray"') -or -not $App.Contains('element("article", `job-card') -or -not $App.Contains('element("article", "compared-row")')) { throw "Expected occupation workbench and comparison design" }
if ($Surface -match '(?i)public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性') { throw "Research copy on product surface" }
if ($Css -match '(?i)gradient') { throw "CSS gradients are not allowed" }
if ($Surface -match '(?i)innerHTML|eval\(|new Function|dangerouslySetInnerHTML') { throw "Official data interpreted as markup" }
if (-not $Worker.Contains('app.post("/api/telemetry"') -or $Worker.Contains('app.post("/api/search"') -or -not $App.Contains('fetch(DATA_URL')) { throw "Search must stay local" }
if ($Migration -match '(?i)job_description|classification_code|query|search_term|email|phone|advertising|password') { throw "Sensitive fields in telemetry" }
if (-not $Migration.Contains("CHECK(event_name IN") -or -not $Worker.Contains("35 * 86400")) { throw "Telemetry retention contract missing" }
if (-not $Source.Contains("平成21年［2009年］12月") -or -not $Source.Contains("415") -or -not $Source.Contains("e-Stat terms of use") -or -not $Source.Contains("Transformation / 加工") -or -not $Source.Contains("厚生労働省編職業分類")) { throw "Source boundary incomplete" }
if (-not $App.Contains('state.compared.length >= 4') -or -not $App.Contains('value.slice(0, 4)') -or -not $App.Contains("trailItems(item, state)")) { throw "Four-way comparison contract missing" }
if ($Surface -match '(?i)better-auth|betterAuth') { throw "Authentication is unnecessary" }
if ($Wrangler.Contains("00000000-0000-0000-0000-000000000000")) { throw "D1 database ID missing" }
if ($Data.counts.total -ne 415 -or $Data.counts.major -ne 12 -or $Data.counts.middle -ne 74 -or $Data.counts.minor -ne 329) { throw "Official dimensions incorrect" }
if ($Data.source.bytes -ne 149426 -or $Data.source.interfaceRows -ne 416 -or $Data.source.revision -ne "02" -or $Data.source.sha256 -ne "9291694fd144cd6ca65414a183a074bd1ffad80ff7c9aa8b82e12d0852eb699a") { throw "Official source metadata incorrect" }
$Codes = @($Data.items | ForEach-Object { [string]$_.c }); if (@($Codes | Sort-Object -Unique).Count -ne 415) { throw "Codes not unique" }; $CodeSet = [Collections.Generic.HashSet[string]]::new([string[]]$Codes); foreach ($Item in $Data.items) { if ([string]$Item.p -and -not $CodeSet.Contains([string]$Item.p)) { throw "Missing parent $($Item.p)" } }; if (-not $CodeSet.Contains("051") -or -not $CodeSet.Contains("421") -or -not $CodeSet.Contains("999")) { throw "Known codes missing" }
if ((Get-Item $DataPath).Length -gt 230000) { throw "Dataset too large" }; if ((Get-Item (Join-Path $RepoRoot "public\og.svg")).Length -lt 1500) { throw "OG image too small" }; if ((Get-Item (Join-Path $RepoRoot "public\app.js")).Length -lt 11000) { throw "Client too small" }
$KeyFiles = @(Get-ChildItem (Join-Path $RepoRoot "public") -File | Where-Object { $_.Name -match '^[a-zA-Z0-9-]{8,128}\.txt$' }); if ($KeyFiles.Count -ne 1 -or (Get-Content -Raw $KeyFiles[0].FullName).Trim() -ne $KeyFiles[0].BaseName) { throw "IndexNow key invalid" }
Write-Output "Product release contract is satisfied"
