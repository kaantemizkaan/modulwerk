param(
    [switch]$NoBrowser
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
$ScannerScript = Join-Path $PSScriptRoot "scan_homework.ps1"
$HtmlFile = Join-Path $WorkspaceRoot "Modulwerk.html"
if (-not (Test-Path -LiteralPath $HtmlFile)) {
    $HtmlFile = Join-Path $WorkspaceRoot "Odev_Takip.html"
}
$DbFile = Join-Path $WorkspaceRoot "homework_db.json"

. $ScannerScript

Write-Host ">>> Initial scan in progress..." -ForegroundColor Cyan
$null = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot

$port = 5050
$listener = $null
$started = $false

while (-not $started -and $port -lt 5100) {
    try {
        $listener = New-Object System.Net.HttpListener
        $prefix = "http://localhost:$port/"
        $listener.Prefixes.Add($prefix)
        $listener.Start()
        $started = $true
    } catch {
        $port++
    }
}

if (-not $started) {
    Write-Error "No available port found between 5050 and 5100."
    exit 1
}

$url = "http://localhost:$port/"
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Modulwerk Server Active" -ForegroundColor Green
Write-Host "  URL: $url" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C or close this window to stop." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Green

if (-not $NoBrowser) {
    Start-Process $url
}

$script:needsRescan = $false
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WorkspaceRoot
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite'

$fileAction = {
    param($source, $eventArgs)
    $name = $eventArgs.Name
    if ($name -match '(?i)\.(git|gemini|vscode|tracker|json|html|bat)$') { return }
    $script:needsRescan = $true
}

Register-ObjectEvent $watcher "Created" -Action $fileAction | Out-Null
Register-ObjectEvent $watcher "Changed" -Action $fileAction | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $fileAction | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $fileAction | Out-Null

function Resolve-SafePath([string]$relPath) {
    if ([string]::IsNullOrWhiteSpace($relPath)) { return $null }
    
    $normalized = $relPath -replace '/', '\'

    # Try 1: Direct literal path join
    $full = Join-Path $WorkspaceRoot $normalized
    if (Test-Path -LiteralPath $full) {
        return $full
    }

    # Try 2: Unicode Normalization FormC & FormD
    $formC = Join-Path $WorkspaceRoot ($normalized.Normalize([System.Text.NormalizationForm]::FormC))
    if (Test-Path -LiteralPath $formC) {
        return $formC
    }
    $formD = Join-Path $WorkspaceRoot ($normalized.Normalize([System.Text.NormalizationForm]::FormD))
    if (Test-Path -LiteralPath $formD) {
        return $formD
    }

    # Try 3: Directory leaf match
    $parent = Split-Path -Parent $full
    $leaf = Split-Path -Leaf $full
    if (Test-Path -LiteralPath $parent) {
        $normLeaf = $leaf.Normalize([System.Text.NormalizationForm]::FormC)
        $matching = Get-ChildItem -LiteralPath $parent | Where-Object {
            $_.Name.Normalize([System.Text.NormalizationForm]::FormC) -eq $normLeaf
        } | Select-Object -First 1
        if ($matching) {
            return $matching.FullName
        }
    }

    # Try 4: Trim any leading slashes or workspace repetitions
    $cleanRel = $normalized -replace '^[\/\\]+', ''
    $cleanFull = Join-Path $WorkspaceRoot $cleanRel
    if (Test-Path -LiteralPath $cleanFull) {
        return $cleanFull
    }

    return $null
}

function Get-ProposedStandardName {
    param(
        [string]$Subject,
        [string]$Category,
        [string]$Sheet,
        [bool]$IsSolution,
        [string]$CurrentFileName,
        [string]$DirectoryPath
    )

    if ([string]::IsNullOrWhiteSpace($CurrentFileName)) { return $null }
    $ext = [System.IO.Path]::GetExtension($CurrentFileName).ToLower()

    $subjKey = switch ($Subject) {
        "Analysis"        { "Analysis" }
        "EiP"             { "EiP" }
        "Lineare Algebra" { "Lineare_Algebra" }
        "Statistik"       { "Statistik" }
        default           { $Subject -replace '\s+', '_' }
    }

    $catKey = switch -Regex ($Category) {
        "(?i)hausaufgabe"      { "Hausaufgabe" }
        "(?i)praesenz|pr.senz" { "Praesenzuebung" }
        "(?i)praktikum"        { "Praktikum" }
        "(?i)tutorium"         { "Tutorium" }
        default                { "Uebungsblatt" }
    }

    $sheetNum = "01"
    if ($Sheet -match '0*(\d+)') {
        $sheetNum = $Matches[1].PadLeft(2, '0')
    }

    $baseTarget = ($subjKey, $catKey, $sheetNum) -join '_'

    if ($IsSolution) {
        if ($CurrentFileName -match '(?i)ausarbeitung') {
            $baseTarget += "_Loesung_Ausarbeitung"
        } elseif ($CurrentFileName -match '(?i)theorie') {
            $baseTarget += "_Loesung_Theorie"
        } else {
            $baseTarget += "_Loesung"
        }
    } else {
        if ($CurrentFileName -match '(?i)informatiker') {
            $baseTarget += "_Informatiker"
        } elseif ($CurrentFileName -match '(?i)arbeitsblatt') {
            $baseTarget += "_Arbeitsblatt"
        }
    }

    $proposedName = "$baseTarget$ext"

    # Collision check: if proposedName exists in DirectoryPath and is not the current file
    if ($DirectoryPath -and (Test-Path -LiteralPath $DirectoryPath)) {
        $targetPath = Join-Path $DirectoryPath $proposedName
        $srcPath = Join-Path $DirectoryPath $CurrentFileName
        if ((Test-Path -LiteralPath $targetPath) -and ($targetPath.ToLower() -ne $srcPath.ToLower())) {
            $counter = 2
            while (Test-Path -LiteralPath (Join-Path $DirectoryPath "$($baseTarget)_$counter$ext")) {
                $counter++
            }
            $proposedName = "$($baseTarget)_$counter$ext"
        }
    }

    return $proposedName
}

function Send-JsonResponse($response, $data, [int]$statusCode = 200) {
    $response.StatusCode = $statusCode
    $response.ContentType = "application/json; charset=utf-8"
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

    $json = $data | ConvertTo-Json -Depth 6
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

function Send-HtmlResponse($response, [string]$html) {
    $response.StatusCode = 200
    $response.ContentType = "text/html; charset=utf-8"
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

function Read-RequestBody($request) {
    if (-not $request.HasEntityBody) { return $null }
    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
    $body = $reader.ReadToEnd()
    $reader.Close()
    if ([string]::IsNullOrWhiteSpace($body)) { return $null }
    return ($body | ConvertFrom-Json)
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response
            $rawUrl = $request.RawUrl.Split('?')[0]
            $method = $request.HttpMethod

            if ($method -eq "OPTIONS") {
                $response.StatusCode = 204
                $response.AddHeader("Access-Control-Allow-Origin", "*")
                $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")
                $response.OutputStream.Close()
                continue
            }

            if ($script:needsRescan) {
                $script:needsRescan = $false
                . $ScannerScript
                $null = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot
            }

            switch -Regex ($rawUrl) {
                '^/$' {
                    if (Test-Path -LiteralPath $HtmlFile) {
                        $html = [System.IO.File]::ReadAllText($HtmlFile, [System.Text.Encoding]::UTF8)
                        Send-HtmlResponse $response $html
                    } else {
                        Send-HtmlResponse $response "<h1>Modulwerk.html nicht gefunden</h1>"
                    }
                }

                '^(?:/static|/\.tracker/static)/(.*)$' {
                    $relUrl = $Matches[1].Split('?')[0] # Strip query params if any
                    $relPath = [System.Uri]::UnescapeDataString($relUrl) -replace '/', '\'
                    $staticRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "static"))
                    $filePath = [System.IO.Path]::GetFullPath((Join-Path $staticRoot $relPath))

                    if ($filePath.StartsWith($staticRoot, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.File]::Exists($filePath)) {
                        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                        $contentType = switch ($ext) {
                            ".css"   { "text/css; charset=utf-8" }
                            ".js"    { "application/javascript; charset=utf-8" }
                            ".json"  { "application/json; charset=utf-8" }
                            ".svg"   { "image/svg+xml" }
                            ".png"   { "image/png" }
                            ".jpg"   { "image/jpeg" }
                            ".ico"   { "image/x-icon" }
                            ".woff2" { "font/woff2" }
                            ".woff"  { "font/woff" }
                            ".html"  { "text/html; charset=utf-8" }
                            default  { "application/octet-stream" }
                        }
                        $bytes = [System.IO.File]::ReadAllBytes($filePath)
                        $response.StatusCode = 200
                        $response.ContentType = $contentType
                        $response.AddHeader("Access-Control-Allow-Origin", "*")
                        $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
                        $response.ContentLength64 = $bytes.Length
                        $response.OutputStream.Write($bytes, 0, $bytes.Length)
                        $response.OutputStream.Close()
                    } else {
                        $response.StatusCode = 404
                        $response.Close()
                    }
                }

                '^/file$' {
                    $id = $request.QueryString["id"]
                    $path = $request.QueryString["path"]
                    $type = $request.QueryString["type"]
                    $targetPath = $null

                    if ($id) {
                        $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                        $t = $dbContent.tasks | Where-Object { $_.id -eq $id } | Select-Object -First 1
                        if ($t) {
                            $targetPath = if ($type -eq "solution" -and $t.solution_path) { $t.solution_path } else { $t.file_path }
                        }
                    } elseif ($path) {
                        $targetPath = $path
                    }

                    $resolved = if ($targetPath) { Resolve-SafePath $targetPath } else { $null }

                    if ($resolved -and [System.IO.File]::Exists($resolved)) {
                        $ext = [IO.Path]::GetExtension($resolved).ToLower()
                        $contentType = switch ($ext) {
                            ".pdf"  { "application/pdf" }
                            ".java" { "text/plain; charset=utf-8" }
                            ".txt"  { "text/plain; charset=utf-8" }
                            ".html" { "text/html; charset=utf-8" }
                            default { "application/octet-stream" }
                        }
                        $bytes = [System.IO.File]::ReadAllBytes($resolved)
                        $safeName = [System.IO.Path]::GetFileName($resolved) -replace '[^\x20-\x7E]', '_'
                        $response.StatusCode = 200
                        $response.ContentType = $contentType
                        $response.AddHeader("Access-Control-Allow-Origin", "*")
                        $response.AddHeader("Content-Disposition", "inline; filename=`"$safeName`"")
                        $response.ContentLength64 = $bytes.Length
                        $response.OutputStream.Write($bytes, 0, $bytes.Length)
                        $response.OutputStream.Close()
                    } else {
                        $response.StatusCode = 404
                        $response.Close()
                    }
                }

                '^/api/tasks$' {
                    if ($method -eq "GET") {
                        . $ScannerScript
                        $data = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot
                        Send-JsonResponse $response $data
                    }
                }

                '^/api/scan$' {
                    if ($method -eq "POST") {
                        . $ScannerScript
                        $data = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot
                        Send-JsonResponse $response @{ success = $true; data = $data }
                    }
                }

                '^/api/upload$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.filename -and $body.dataBase64) {
                            try {
                                $bytes = [System.Convert]::FromBase64String($body.dataBase64)
                                $origName = [System.IO.Path]::GetFileName($body.filename)
                                $rawName = $origName -replace '[\\/:*?"<>|]', '_'
                                $isSol = [bool]$body.isSolution

                                $targetDir = $null
                                $cleanFileName = $rawName

                                # Case 1: Target Task specified
                                if ($body.targetTaskId) {
                                    $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                                    $taskObj = $dbContent.tasks | Where-Object { $_.id -eq $body.targetTaskId } | Select-Object -First 1
                                    if ($taskObj) {
                                        if ($taskObj.is_folder) {
                                            $targetDir = Join-Path $WorkspaceRoot ($taskObj.file_path -replace '/', '\')
                                        } elseif ($taskObj.file_path) {
                                            $fullFilePath = Join-Path $WorkspaceRoot ($taskObj.file_path -replace '/', '\')
                                            $targetDir = Split-Path $fullFilePath -Parent
                                        }
                                    }
                                }

                                # Case 1.5: Target Subject & Sheet specified (e.g. from Matrix view slot drop)
                                if (-not $targetDir -and $body.targetSubject -and $body.targetSheet) {
                                    $subj = [string]$body.targetSubject
                                    $sheetNum = 1
                                    if ($body.targetSheet -match '0*(\d+)') {
                                        $sheetNum = [int]$Matches[1]
                                    }
                                    $sheetFolder = "Blatt_" + $sheetNum.ToString().PadLeft(2, '0')
                                    if ($body.targetCategory -match '(?i)praesenz' -and $subj -eq 'Analysis') {
                                        $targetDir = Join-Path $WorkspaceRoot "Analysis\PrazensBlatter\$sheetFolder"
                                    } elseif ($subj -eq 'EiP' -and ($body.targetCategory -match '(?i)praktikum' -or [System.IO.Path]::GetExtension($rawName).ToLower() -eq '.java')) {
                                        $targetDir = Join-Path $WorkspaceRoot "EiP\Praktikum\Praktikum_$($sheetNum.ToString().PadLeft(2, '0'))"
                                    } elseif ($subj -eq 'Statistik' -and $body.targetCategory -match '(?i)tutorium') {
                                        $targetDir = Join-Path $WorkspaceRoot "Statistik\Tutorium_Mathe"
                                    } else {
                                        $targetDir = Join-Path $WorkspaceRoot "$subj\Uebungen\$sheetFolder"
                                    }
                                }

                                # Case 2: Auto-detect from filename if no target directory
                                if (-not $targetDir) {
                                    $subj = if ($rawName -match '(?i)analysis') { 'Analysis' }
                                            elseif ($rawName -match '(?i)eip|programmierung|java') { 'EiP' }
                                            elseif ($rawName -match '(?i)linear|linalg|algebra') { 'Lineare Algebra' }
                                            elseif ($rawName -match '(?i)statistik|deskriptiv') { 'Statistik' }
                                            else { 'Analysis' }

                                    $sheetNum = 1
                                    if ($rawName -match '(?i)(?:blatt|ueb|ex|hausaufgabe|praesenz|praktikum|tutorium)[_\s-]*0*(\d+)') {
                                        $sheetNum = [int]$Matches[1]
                                    } elseif ($rawName -match '(?i)\[blatt\s*0*(\d+)\]') {
                                        $sheetNum = [int]$Matches[1]
                                    } elseif ($rawName -match '(?i)0*(\d+)[_\s-]*(?:ex|ueb)') {
                                        $sheetNum = [int]$Matches[1]
                                    } elseif ($rawName -match '\b0*(\d+)\b') {
                                        $sheetNum = [int]$Matches[1]
                                    }
                                    $sheetFolder = "Blatt_" + $sheetNum.ToString().PadLeft(2, '0')

                                    if ($rawName -match '(?i)praesenz' -and $subj -eq 'Analysis') {
                                        $targetDir = Join-Path $WorkspaceRoot "Analysis\PrazensBlatter\$sheetFolder"
                                    } elseif ($rawName -match '(?i)praktikum' -or [System.IO.Path]::GetExtension($rawName).ToLower() -eq '.java') {
                                        $praktFolder = "Praktikum_" + $sheetNum.ToString().PadLeft(2, '0')
                                        $targetDir = Join-Path $WorkspaceRoot "EiP\Praktikum\$praktFolder"
                                    } elseif ($rawName -match '(?i)tutorium') {
                                        $targetDir = Join-Path $WorkspaceRoot "Statistik\Tutorium_Mathe"
                                    } else {
                                        $targetDir = Join-Path $WorkspaceRoot "$subj\Uebungen\$sheetFolder"
                                    }
                                }

                                if (-not (Test-Path -LiteralPath $targetDir)) {
                                    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
                                }

                                # If intended as solution and filename does not contain solution keyword, add _Loesung
                                $c_oe = [char]0x00F6
                                $solDetectRegex = "(?i)(loesung|l$($c_oe)sung|l\u00f6sung|l\u0308sung|solution|ausarbeitung|theorie|musterl$($c_oe)sung|musterloesung)"
                                if ($isSol -and ($cleanFileName.Normalize([System.Text.NormalizationForm]::FormC) -notmatch $solDetectRegex)) {
                                    $bName = [System.IO.Path]::GetFileNameWithoutExtension($cleanFileName)
                                    $ext = [System.IO.Path]::GetExtension($cleanFileName)
                                    $cleanFileName = "${bName}_Loesung${ext}"
                                }

                                $destFullPath = Join-Path $targetDir $cleanFileName
                                [System.IO.File]::WriteAllBytes($destFullPath, $bytes)

                                # Trigger rescan immediately
                                . $ScannerScript
                                $freshDb = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot

                                $relSaved = $destFullPath.Substring($WorkspaceRoot.Length + 1) -replace '\\', '/'
                                Send-JsonResponse $response @{
                                    success = $true
                                    message = "File saved successfully: $cleanFileName"
                                    path = $relSaved
                                    filename = $cleanFileName
                                    data = $freshDb
                                }
                            } catch {
                                Send-JsonResponse $response @{ success = $false; error = $_.Exception.Message } 500
                            }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Invalid file data" } 400
                        }
                    }
                }

                '^/api/toggle$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $found = $false
                            foreach ($t in $dbContent.tasks) {
                                if ($t.id -eq $body.id) {
                                    $newStatus = (-not [bool]$t.completed)
                                    $t.completed = $newStatus
                                    $t.manual_status = $newStatus
                                    $found = $true
                                    break
                                }
                            }
                            if ($found) {
                                $mandatoryTasks = @($dbContent.tasks | Where-Object { -not $_.is_optional })
                                $optionalTasks  = @($dbContent.tasks | Where-Object { [bool]$_.is_optional })
                                $dbContent.total_count = $dbContent.tasks.Count
                                $dbContent.completed_count = ($dbContent.tasks | Where-Object { $_.completed -eq $true }).Count
                                $dbContent.pending_count = ($dbContent.tasks | Where-Object { $_.completed -ne $true }).Count
                                $dbContent.mandatory_count = $mandatoryTasks.Count
                                $dbContent.mandatory_completed = ($mandatoryTasks | Where-Object { $_.completed -eq $true }).Count
                                $dbContent.optional_count = $optionalTasks.Count
                                $dbContent.optional_completed = ($optionalTasks | Where-Object { $_.completed -eq $true }).Count

                                $jsonOut = $dbContent | ConvertTo-Json -Depth 6
                                [System.IO.File]::WriteAllText($DbFile, $jsonOut, $utf8NoBom)
                                Send-JsonResponse $response @{
                                    success = $true
                                    task = $t
                                    stats = @{
                                        total = $dbContent.total_count
                                        completed = $dbContent.completed_count
                                        pending = $dbContent.pending_count
                                        mandatory_count = $dbContent.mandatory_count
                                        mandatory_completed = $dbContent.mandatory_completed
                                        optional_count = $dbContent.optional_count
                                        optional_completed = $dbContent.optional_completed
                                    }
                                }
                            } else {
                                Send-JsonResponse $response @{ success = $false; error = "Aufgabe nicht gefunden" } 404
                            }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Ungueltige Anfrage" } 400
                        }
                    }
                }

                '^/api/toggle-optional$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $found = $false
                            foreach ($t in $dbContent.tasks) {
                                if ($t.id -eq $body.id) {
                                    $newOpt = (-not [bool]$t.is_optional)
                                    $t.is_optional = $newOpt
                                    $found = $true
                                    break
                                }
                            }
                            if ($found) {
                                $mandatoryTasks = @($dbContent.tasks | Where-Object { -not $_.is_optional })
                                $optionalTasks  = @($dbContent.tasks | Where-Object { [bool]$_.is_optional })
                                $dbContent.total_count = $dbContent.tasks.Count
                                $dbContent.completed_count = ($dbContent.tasks | Where-Object { $_.completed -eq $true }).Count
                                $dbContent.pending_count = ($dbContent.tasks | Where-Object { $_.completed -ne $true }).Count
                                $dbContent.mandatory_count = $mandatoryTasks.Count
                                $dbContent.mandatory_completed = ($mandatoryTasks | Where-Object { $_.completed -eq $true }).Count
                                $dbContent.optional_count = $optionalTasks.Count
                                $dbContent.optional_completed = ($optionalTasks | Where-Object { $_.completed -eq $true }).Count

                                $jsonOut = $dbContent | ConvertTo-Json -Depth 6
                                [System.IO.File]::WriteAllText($DbFile, $jsonOut, $utf8NoBom)
                                Send-JsonResponse $response @{
                                    success = $true
                                    task = $t
                                    stats = @{
                                        total = $dbContent.total_count
                                        completed = $dbContent.completed_count
                                        pending = $dbContent.pending_count
                                        mandatory_count = $dbContent.mandatory_count
                                        mandatory_completed = $dbContent.mandatory_completed
                                        optional_count = $dbContent.optional_count
                                        optional_completed = $dbContent.optional_completed
                                    }
                                }
                            } else {
                                Send-JsonResponse $response @{ success = $false; error = "Aufgabe nicht gefunden" } 404
                            }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Ungueltige Anfrage" } 400
                        }
                    }
                }

                '^/api/note$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $found = $false
                            foreach ($t in $dbContent.tasks) {
                                if ($t.id -eq $body.id) {
                                    $t.notes = [string]$body.notes
                                    $found = $true
                                    break
                                }
                            }
                            if ($found) {
                                $jsonOut = $dbContent | ConvertTo-Json -Depth 6
                                [System.IO.File]::WriteAllText($DbFile, $jsonOut, $utf8NoBom)
                                Send-JsonResponse $response @{ success = $true }
                            } else {
                                Send-JsonResponse $response @{ success = $false; error = "Aufgabe nicht gefunden" } 404
                            }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Ungueltige Anfrage" } 400
                        }
                    }
                }

                '^/api/open-file$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        $targetPath = $null

                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $t = $dbContent.tasks | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
                            if ($t) {
                                $targetPath = if ($body.type -eq "solution" -and $t.solution_path) { $t.solution_path } else { $t.file_path }
                            }
                        } elseif ($body -and $body.path) {
                            $targetPath = $body.path
                        }

                        $resolved = if ($targetPath) { Resolve-SafePath $targetPath } else { $null }

                        if ($resolved) {
                            if ([System.IO.Directory]::Exists($resolved)) {
                                Start-Process "explorer.exe" -ArgumentList "`"$resolved`""
                            } else {
                                Start-Process -FilePath $resolved
                            }
                            Send-JsonResponse $response @{ success = $true; path = $resolved }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Datei nicht gefunden: $targetPath" } 404
                        }
                    }
                }

                '^/api/open-folder$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        $targetPath = $null

                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $t = $dbContent.tasks | Where-Object { $_.id -eq $body.id } | Select-Object -First 1
                            if ($t) { $targetPath = $t.file_path }
                        } elseif ($body -and $body.path) {
                            $targetPath = $body.path
                        }

                        $resolved = if ($targetPath) { Resolve-SafePath $targetPath } else { $null }

                        if ($resolved) {
                            if ([System.IO.Directory]::Exists($resolved)) {
                                Start-Process "explorer.exe" -ArgumentList "`"$resolved`""
                            } else {
                                Start-Process "explorer.exe" -ArgumentList "/select,`"$resolved`""
                            }
                            Send-JsonResponse $response @{ success = $true; path = $resolved }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Ordner nicht gefunden: $targetPath" } 404
                        }
                    }
                }

                '^/api/add-task$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.title) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $newId = "custom-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            $isOpt = if ($body.is_optional -ne $null) { [bool]$body.is_optional } else { $false }
                            $newTask = [PSCustomObject]@{
                                id = $newId
                                subject = if ($body.subject) { [string]$body.subject } else { "Allgemein" }
                                category = if ($body.category) { [string]$body.category } else { "Aufgabe" }
                                sheet = if ($body.sheet) { [string]$body.sheet } else { "Blatt 01" }
                                title = [string]$body.title
                                file_path = ""
                                file_name = ""
                                file_size = ""
                                file_ext = ""
                                is_folder = $false
                                solution_path = $null
                                solution_name = $null
                                solution_size = $null
                                solution_ext = $null
                                solution_note = $null
                                auto_detected = $false
                                manual_status = $false
                                completed = $false
                                is_optional = $isOpt
                                notes = if ($body.notes) { [string]$body.notes } else { "" }
                                priority = if ($body.priority) { [string]$body.priority } else { "normal" }
                                due_date = if ($body.due_date) { [string]$body.due_date } else { $null }
                                is_custom = $true
                                last_modified = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
                            }
                            $tasksList = [System.Collections.ArrayList]@($dbContent.tasks)
                            $tasksList.Add($newTask) | Out-Null
                            $dbContent.tasks = $tasksList
                            $dbContent.total_count = $tasksList.Count
                            $dbContent.pending_count++

                            $mandatoryTasks = @($dbContent.tasks | Where-Object { -not $_.is_optional })
                            $optionalTasks  = @($dbContent.tasks | Where-Object { [bool]$_.is_optional })
                            $dbContent.mandatory_count = $mandatoryTasks.Count
                            $dbContent.mandatory_completed = ($mandatoryTasks | Where-Object { $_.completed -eq $true }).Count
                            $dbContent.optional_count = $optionalTasks.Count
                            $dbContent.optional_completed = ($optionalTasks | Where-Object { $_.completed -eq $true }).Count

                            $jsonOut = $dbContent | ConvertTo-Json -Depth 6
                            [System.IO.File]::WriteAllText($DbFile, $jsonOut, $utf8NoBom)
                            Send-JsonResponse $response @{ success = $true; task = $newTask }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Titel erforderlich" } 400
                        }
                    }
                }

                '^/api/delete-task$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            $taskToDelete = $dbContent.tasks | Where-Object { $_.id -eq $body.id } | Select-Object -First 1

                            if ($taskToDelete) {
                                # Option: physically delete file from disk if requested
                                if ($body.deleteFromDisk) {
                                    if ($taskToDelete.file_path) {
                                        $resolvedFile = Resolve-SafePath $taskToDelete.file_path
                                        if ($resolvedFile) {
                                            if ([System.IO.File]::Exists($resolvedFile)) {
                                                Remove-Item -LiteralPath $resolvedFile -Force -ErrorAction SilentlyContinue
                                            } elseif ([System.IO.Directory]::Exists($resolvedFile)) {
                                                Remove-Item -LiteralPath $resolvedFile -Recurse -Force -ErrorAction SilentlyContinue
                                            }
                                        }
                                    }
                                }

                                # Add to ignored_tasks list so scanner never re-adds it
                                $ignoredList = [System.Collections.ArrayList]@()
                                if ($dbContent.ignored_tasks) {
                                    foreach ($it in $dbContent.ignored_tasks) {
                                        if ($it.id -ne $taskToDelete.id) {
                                            $ignoredList.Add($it) | Out-Null
                                        }
                                    }
                                }
                                $newIgnoreEntry = [PSCustomObject]@{
                                    id = $taskToDelete.id
                                    subject = $taskToDelete.subject
                                    title = $taskToDelete.title
                                    file_path = $taskToDelete.file_path
                                    file_name = $taskToDelete.file_name
                                    deleted_from_disk = [bool]$body.deleteFromDisk
                                    deleted_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
                                }
                                $ignoredList.Add($newIgnoreEntry) | Out-Null
                                $dbContent.ignored_tasks = $ignoredList

                                # Remove task from active tasks
                                $filtered = @($dbContent.tasks | Where-Object { $_.id -ne $body.id })
                                $dbContent.tasks = $filtered
                                $dbContent.total_count = $filtered.Count
                                $dbContent.completed_count = ($filtered | Where-Object { $_.completed -eq $true }).Count
                                $dbContent.pending_count = ($filtered | Where-Object { $_.completed -ne $true }).Count

                                $mandatoryTasks = @($dbContent.tasks | Where-Object { -not $_.is_optional })
                                $optionalTasks  = @($dbContent.tasks | Where-Object { [bool]$_.is_optional })
                                $dbContent.mandatory_count = $mandatoryTasks.Count
                                $dbContent.mandatory_completed = ($mandatoryTasks | Where-Object { $_.completed -eq $true }).Count
                                $dbContent.optional_count = $optionalTasks.Count
                                $dbContent.optional_completed = ($optionalTasks | Where-Object { $_.completed -eq $true }).Count

                                $jsonOut = $dbContent | ConvertTo-Json -Depth 6
                                [System.IO.File]::WriteAllText($DbFile, $jsonOut, $utf8NoBom)
                                Send-JsonResponse $response @{ success = $true; message = "Task permanently deleted"; data = $dbContent }
                            } else {
                                Send-JsonResponse $response @{ success = $false; error = "Task not found" } 404
                            }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "Invalid request" } 400
                        }
                    }
                }

                '^/api/restore-task$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        if ($body -and $body.id) {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            if ($dbContent.ignored_tasks) {
                                $newIgnored = @($dbContent.ignored_tasks | Where-Object { $_.id -ne $body.id })
                                $dbContent.ignored_tasks = $newIgnored
                                $jsonOut = $dbContent | ConvertTo-Json -Depth 6
                                [System.IO.File]::WriteAllText($DbFile, $jsonOut, $utf8NoBom)
                                . $ScannerScript
                                $freshDb = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot
                                Send-JsonResponse $response @{ success = $true; message = "Task restored successfully"; data = $freshDb }
                            } else {
                                Send-JsonResponse $response @{ success = $false; error = "No ignored tasks found" } 404
                            }
                        } else {
                            Send-JsonResponse $response @{ success = $false; error = "ID required" } 400
                        }
                    }
                }

                '^/api/ignored-tasks$' {
                    if ($method -eq "GET") {
                        $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                        $list = if ($dbContent.ignored_tasks) { $dbContent.ignored_tasks } else { @() }
                        Send-JsonResponse $response @{ success = $true; ignored_tasks = $list }
                    }
                }

                '^/api/normalize-preview$' {
                    if ($method -eq "GET") {
                        $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                        $candidates = @()

                        foreach ($t in $dbContent.tasks) {
                            # 1. Assignment file
                            if (-not $t.is_folder -and $t.file_path -and $t.file_name) {
                                $fullF = Resolve-SafePath $t.file_path
                                $parentDir = if ($fullF) { Split-Path $fullF -Parent } else { $null }
                                $prop = Get-ProposedStandardName -Subject $t.subject -Category $t.category -Sheet $t.sheet -IsSolution $false -CurrentFileName $t.file_name -DirectoryPath $parentDir
                                if ($prop -and $prop -ne $t.file_name) {
                                    $candidates += [PSCustomObject]@{
                                        taskId = $t.id
                                        type = "Assignment"
                                        subject = $t.subject
                                        category = $t.category
                                        sheet = $t.sheet
                                        currentName = $t.file_name
                                        proposedName = $prop
                                        currentRelPath = $t.file_path
                                        isSolution = $false
                                    }
                                }
                            }

                            # 2. Solution file
                            if ($t.solution_path -and $t.solution_name -and ($t.solution_name -notmatch '(?i)Java files')) {
                                $fullS = Resolve-SafePath $t.solution_path
                                $parentDir = if ($fullS) { Split-Path $fullS -Parent } else { $null }
                                $propSol = Get-ProposedStandardName -Subject $t.subject -Category $t.category -Sheet $t.sheet -IsSolution $true -CurrentFileName $t.solution_name -DirectoryPath $parentDir
                                if ($propSol -and $propSol -ne $t.solution_name) {
                                    $candidates += [PSCustomObject]@{
                                        taskId = $t.id
                                        type = "Solution"
                                        subject = $t.subject
                                        category = $t.category
                                        sheet = $t.sheet
                                        currentName = $t.solution_name
                                        proposedName = $propSol
                                        currentRelPath = $t.solution_path
                                        isSolution = $true
                                    }
                                }
                            }
                        }

                        Send-JsonResponse $response @{
                            success = $true
                            count = $candidates.Count
                            candidates = $candidates
                        }
                    }
                }

                '^/api/normalize-execute$' {
                    if ($method -eq "POST") {
                        $body = Read-RequestBody $request
                        $itemsToRename = @()

                        if ($body -and $body.items -and $body.items.Count -gt 0) {
                            $itemsToRename = $body.items
                        } else {
                            $dbContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
                            foreach ($t in $dbContent.tasks) {
                                if (-not $t.is_folder -and $t.file_path -and $t.file_name) {
                                    $fullF = Resolve-SafePath $t.file_path
                                    $parentDir = if ($fullF) { Split-Path $fullF -Parent } else { $null }
                                    $prop = Get-ProposedStandardName -Subject $t.subject -Category $t.category -Sheet $t.sheet -IsSolution $false -CurrentFileName $t.file_name -DirectoryPath $parentDir
                                    if ($prop -and $prop -ne $t.file_name) {
                                        $itemsToRename += [PSCustomObject]@{
                                            currentRelPath = $t.file_path
                                            proposedName = $prop
                                            isSolution = $false
                                            taskId = $t.id
                                        }
                                    }
                                }
                                if ($t.solution_path -and $t.solution_name -and ($t.solution_name -notmatch '(?i)Java-Dateien')) {
                                    $fullS = Resolve-SafePath $t.solution_path
                                    $parentDir = if ($fullS) { Split-Path $fullS -Parent } else { $null }
                                    $propSol = Get-ProposedStandardName -Subject $t.subject -Category $t.category -Sheet $t.sheet -IsSolution $true -CurrentFileName $t.solution_name -DirectoryPath $parentDir
                                    if ($propSol -and $propSol -ne $t.solution_name) {
                                        $itemsToRename += [PSCustomObject]@{
                                            currentRelPath = $t.solution_path
                                            proposedName = $propSol
                                            isSolution = $true
                                            taskId = $t.id
                                        }
                                    }
                                }
                            }
                        }

                        $renamedCount = 0
                        $errors = @()

                        foreach ($item in $itemsToRename) {
                            $srcResolved = Resolve-SafePath $item.currentRelPath
                            if (-not $srcResolved -or -not (Test-Path -LiteralPath $srcResolved)) {
                                $errors += "File not found: $($item.currentRelPath)"
                                continue
                            }

                            $parent = Split-Path -LiteralPath $srcResolved -Parent
                            $destPath = Join-Path $parent $item.proposedName

                            if ((Test-Path -LiteralPath $destPath) -and ($destPath.ToLower() -ne $srcResolved.ToLower())) {
                                $errors += "Destination file already exists: $($item.proposedName)"
                                continue
                            }

                            try {
                                Move-Item -LiteralPath $srcResolved -Destination $destPath -Force
                                $renamedCount++
                            } catch {
                                $errors += "Error renaming $($item.currentRelPath): $_"
                            }
                        }

                        . $ScannerScript
                        $freshDb = Get-HomeworkDatabase -WorkspaceRoot $WorkspaceRoot

                        Send-JsonResponse $response @{
                            success = $true
                            renamedCount = $renamedCount
                            errors = $errors
                            message = "$renamedCount file names standardized successfully"
                            data = $freshDb
                        }
                    }
                }

                default {
                    Send-JsonResponse $response @{ error = "Not found" } 404
                }
            }
        } catch {
            Write-Warning "Request error: $_"
            try {
                $context.Response.StatusCode = 500
                $context.Response.Close()
            } catch {}
        }
    }
} finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
        $listener.Close()
    }
    if ($watcher) {
        $watcher.Dispose()
    }
}