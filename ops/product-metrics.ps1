[CmdletBinding()]
param([switch]$Local)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Sql = (Get-Content (Join-Path $PSScriptRoot "product-metrics.sql")) -join " "
$Target = if ($Local) { "--local" } else { "--remote" }
$Output = & $Wrangler d1 execute shokugyo-code $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) { throw "D1 metrics query failed" }
$Row = ((($Output -join [Environment]::NewLine) | ConvertFrom-Json)[0]).results[0]
function Get-Percent { param([int]$Numerator, [int]$Denominator) if ($Denominator -eq 0) { return $null }; [Math]::Round(($Numerator / $Denominator) * 100, 1) }
$Users = [int]$Row.users
$Successful = [int]$Row.successful_searches
$NoResult = [int]$Row.no_result_searches
[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o"); service = "shokugyo-code"; environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{ users=$Users; major_selectors=[int]$Row.major_selectors; searchers=[int]$Row.searchers; successful_searches=$Successful; no_result_searches=$NoResult; level_changers=[int]$Row.level_changers; comparers=[int]$Row.comparers; copiers=[int]$Row.copiers; official_openers=[int]$Row.official_openers; returned=[int]$Row.returned; searchers_7d=[int]$Row.searchers_7d; copiers_7d=[int]$Row.copiers_7d; qa_rows=[int]$Row.qa_rows }
    rates = [ordered]@{ search_percent=Get-Percent ([int]$Row.searchers) $Users; successful_search_percent=Get-Percent $Successful ($Successful+$NoResult); compare_percent=Get-Percent ([int]$Row.comparers) $Users; copy_percent=Get-Percent ([int]$Row.copiers) $Users; official_open_percent=Get-Percent ([int]$Row.official_openers) $Users; return_percent=Get-Percent ([int]$Row.returned) $Users }
} | ConvertTo-Json -Depth 4
