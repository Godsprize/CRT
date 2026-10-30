$ErrorActionPreference = "Stop"

$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$node = if (Get-Command node -ErrorAction SilentlyContinue) {
  "node"
} elseif (Test-Path $bundledNode) {
  $bundledNode
} else {
  throw "Node.js was not found. Install Node.js 22+ or run this inside the Codex desktop runtime."
}

& $node "--test"
exit $LASTEXITCODE
