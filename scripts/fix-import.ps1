$content = Get-Content 'src/components/FlicksFeed.tsx' -Raw
$old = 'import { useSoundEffects } from "../hooks/useSoundEffects";'
$new = 'import { useSoundEffects } from "../hooks/useSoundEffects";' + [Environment]::NewLine + 'import { PullToRefresh } from "./PullToRefresh";'
$content = $content.Replace($old, $new, [System.StringComparison]::Ordinal)
Set-Content 'src/components/FlicksFeed.tsx' -Value $content -NoNewLine
Write-Host 'import added'
