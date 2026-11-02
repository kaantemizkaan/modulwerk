[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Get-HomeworkDatabase {
    param(
        [string]$WorkspaceRoot = (Get-Location).Path
    )

    # Unicode-safe German characters
    $c_ae       = [char]0x00E4
    $c_oe       = [char]0x00F6
    $c_lower_ue = [char]0x00FC
    $c_upper_ue = [char]0x00DC

    $str_Praesenzuebung = "Pr$($c_ae)senz$($c_lower_ue)bung"
    $str_Uebungsblatt   = "$($c_upper_ue)bungsblatt"
    $str_Aufgabe        = "Aufgabe"
    $str_LoesungVorh    = "L$($c_oe)sung vorhanden"
    $str_LoesungenVorh  = "L$($c_oe)sungen vorhanden"

    $dbPath = Join-Path $WorkspaceRoot "homework_db.json"
    $existingDb = @{
        version = "2.3"
        last_scanned = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        tasks = @()
        ignored_tasks = @()
    }

    if (Test-Path $dbPath) {
        try {
            $jsonContent = [System.IO.File]::ReadAllText($dbPath, [System.Text.Encoding]::UTF8)
            $parsed = $jsonContent | ConvertFrom-Json
            if ($parsed.tasks) {
                $existingDb = $parsed
            }
        } catch {
            Write-Warning "Database read error: $_"
        }
    }

    $ignoredTaskIds = @{}
    $ignoredPaths = @{}
    if ($existingDb.ignored_tasks) {
        foreach ($it in $existingDb.ignored_tasks) {
            if ($it.id) { $ignoredTaskIds[$it.id] = $true }
            if ($it.file_path) {
                $normPath = ($it.file_path -replace '/', '\').ToLower()
                $ignoredPaths[$normPath] = $true
            }
        }
    }

    $userOverrides = @{}
    $userOverridesByPath = @{}
    $customTasks = @()
    foreach ($t in $existingDb.tasks) {
        if ($t.is_custom -eq $true) {
            if (-not $ignoredTaskIds[$t.id]) {
                $customTasks += $t
            }
        } else {
            $entry = @{
                manual_status = $t.manual_status
                notes         = $t.notes
                priority      = $t.priority
                due_date      = $t.due_date
                is_optional   = $t.is_optional
            }
            if ($t.id) {
                $userOverrides[$t.id] = $entry
            }
            if ($t.file_path) {
                $normP = ($t.file_path -replace '/', '\').ToLower()
                $userOverridesByPath[$normP] = $entry
            }
        }
    }

    function Format-FileSize([long]$bytes) {
        if ($bytes -ge 1048576) { return "{0:N1} MB" -f ($bytes / 1048576) }
        if ($bytes -ge 1024) { return "{0:N0} KB" -f ($bytes / 1024) }
        return "$bytes B"
    }

    function Normalize-Name([string]$val) {
        if ([string]::IsNullOrWhiteSpace($val)) { return "" }
        return ($val.Normalize([System.Text.NormalizationForm]::FormC).ToLower() -replace '[^a-z0-9]', '')
    }

    function Get-SheetNumber([string]$fileName, [string]$folderName) {
        $combined = "$folderName $fileName"
        if ($combined -match '(?i)(?:blatt|ueb|ex|hausaufgabe|praesenz|praktikum|tutorium)[_\s-]*0*(\d+)') {
            return "Blatt " + $Matches[1].PadLeft(2, '0')
        }
        if ($fileName -match '(?i)\[blatt\s*0*(\d+)\]') {
            return "Blatt " + $Matches[1].PadLeft(2, '0')
        }
        return "Blatt 01"
    }

    function Get-Category([string]$fileName, [string]$folderName) {
        if ($fileName -match '(?i)hausaufgabe' -or $folderName -match '(?i)hausaufgabe') { return "Hausaufgabe" }
        if ($fileName -match '(?i)praesenz' -or $folderName -match '(?i)praesenz') { return $str_Praesenzuebung }
        if ($folderName -match '(?i)praktikum' -or $fileName -match '(?i)praktikum') { return "Praktikum" }
        if ($folderName -match '(?i)tutorium' -or $fileName -match '(?i)tutorium|arbeitsblatt') { return "Tutorium" }
        return $str_Uebungsblatt
    }

    function Format-DisplayTitle([string]$subject, [string]$cat, [string]$sheet, [string]$rawName) {
        $clean = ([IO.Path]::GetFileNameWithoutExtension($rawName)).Normalize([System.Text.NormalizationForm]::FormC)
        if ($clean -match '^(?i)(?:ueb|ex|blatt|praesenz|hausaufgabe)0*(\d+)$' -or $clean -match '^\d+-(?:ex|ueb)$') {
            return "$subject $cat ($sheet)"
        }
        $formatted = $clean -replace '_', ' '
        $formatted = $formatted -replace '(?i)uebungsblatt', $str_Uebungsblatt
        $formatted = $formatted -replace '(?i)praesenzuebung', $str_Praesenzuebung
        $formatted = $formatted -replace '(?i)uebung', "$($c_upper_ue)bung"
        $formatted = $formatted -replace '(?i)loesung', "L$($c_oe)sung"
        $formatted = $formatted -replace '(?i)fu_r|fu\u0308r', "f$($c_lower_ue)r"
        return $formatted.Trim()
    }

    $subjects = @('Analysis', 'EiP', 'Lineare Algebra', 'Statistik')
    $scannedTasks = @()

    foreach ($subj in $subjects) {
        $subjDir = Join-Path $WorkspaceRoot $subj
        if (-not (Test-Path $subjDir)) { continue }

        $subDirs = Get-ChildItem -Path $subjDir -Directory | Where-Object { $_.Name -ne 'Vorlesung' }

        foreach ($subDir in $subDirs) {
            $praktikumDirs = @()
            if ($subDir.Name -match '(?i)praktikum') {
                $subPraktika = Get-ChildItem -Path $subDir.FullName -Directory | Where-Object { $_.Name -match '(?i)praktikum' }
                if ($subPraktika.Count -gt 0) {
                    $praktikumDirs += $subPraktika
                } else {
                    $praktikumDirs += $subDir
                }
            }

            if ($praktikumDirs.Count -gt 0) {
                foreach ($pd in $praktikumDirs) {
                    $relFolder = $pd.FullName.Substring($WorkspaceRoot.Length + 1)
                    $normRelFolder = ($relFolder -replace '/', '\').ToLower()
                    $taskId = "task-$subj-praktikum-$($pd.Name)" -replace '[^a-zA-Z0-9_-]', '_'

                    # Skip if ignored/permanently deleted
                    if ($ignoredTaskIds[$taskId] -or $ignoredPaths[$normRelFolder]) {
                        continue
                    }

                    $codeFiles = Get-ChildItem -Path $pd.FullName -Filter "*.java"
                    $totalSize = ($codeFiles | Measure-Object -Property Length -Sum).Sum
                    if ($totalSize -eq $null) { $totalSize = 0 }
                    $sheet = Get-SheetNumber $pd.Name $pd.Name

                    $override = if ($userOverrides[$taskId]) { $userOverrides[$taskId] } elseif ($userOverridesByPath[$normRelFolder]) { $userOverridesByPath[$normRelFolder] } else { $null }
                    $autoDone = ($codeFiles.Count -gt 0)
                    $manualStatus = if ($override) { $override.manual_status } else { $null }
                    $isCompleted = if ($manualStatus -ne $null) { [bool]$manualStatus } else { $autoDone }

                    $codeList = ($codeFiles | Select-Object -ExpandProperty Name) -join ", "
                    $sizeFormatted = Format-FileSize $totalSize
                    $solutionNote = if ($codeFiles.Count -gt 0) { "$($codeFiles.Count) Java-Dateien ($sizeFormatted)" } else { $null }

                    $isOpt = if ($override -and $override.is_optional -ne $null) { [bool]$override.is_optional } else { $false }

                    $scannedTasks += [PSCustomObject]@{
                        id = $taskId
                        subject = $subj
                        category = "Praktikum"
                        sheet = $sheet
                        title = "$subj $($pd.Name -replace '_', ' ')"
                        file_path = $relFolder
                        file_name = $pd.Name
                        file_size = "$($codeFiles.Count) Java-Dateien"
                        file_ext = "JAVA"
                        is_folder = $true
                        solution_path = $relFolder
                        solution_name = "$($codeFiles.Count) Java-Dateien"
                        solution_size = $sizeFormatted
                        solution_ext = "JAVA"
                        solution_note = $solutionNote
                        auto_detected = $autoDone
                        manual_status = $manualStatus
                        completed = $isCompleted
                        is_optional = $isOpt
                        notes = if ($override) { [string]$override.notes } else { "" }
                        priority = if ($override -and $override.priority) { $override.priority } else { "normal" }
                        due_date = if ($override) { $override.due_date } else { $null }
                        is_custom = $false
                        last_modified = ($pd.LastWriteTime).ToString("yyyy-MM-ddTHH:mm:ss")
                    }
                }
            }

            $allFiles = Get-ChildItem -Path $subDir.FullName -Recurse -File | Where-Object {
                $_.Extension -match '(?i)\.(pdf|docx?|txt|java)$' -and
                $_.Directory.Name -notmatch '(?i)praktikum_\d+'
            }

            $solRegex = "(?i)(loesung|l$($c_oe)sung|l\u00f6sung|l\u0308sung|solution|ausarbeitung|theorie|musterl$($c_oe)sung|musterloesung)"

            $solutionFiles = $allFiles | Where-Object {
                $norm = $_.Name.Normalize([System.Text.NormalizationForm]::FormC)
                $norm -match $solRegex
            }

            $assignmentFiles = $allFiles | Where-Object {
                $norm = $_.Name.Normalize([System.Text.NormalizationForm]::FormC)
                $norm -notmatch $solRegex -and $_.Name -notmatch '(?i)notizen'
            }

            foreach ($af in $assignmentFiles) {
                $relFile = $af.FullName.Substring($WorkspaceRoot.Length + 1)
                $normRelFile = ($relFile -replace '/', '\').ToLower()
                $cat = Get-Category $af.Name $af.Directory.Name
                $sheet = Get-SheetNumber $af.Name $af.Directory.Name
                $rawCleanTitle = [IO.Path]::GetFileNameWithoutExtension($af.Name)
                $displayTitle = Format-DisplayTitle $subj $cat $sheet $af.Name
                $taskId = "task-$subj-$($af.Directory.Name)-$($rawCleanTitle)" -replace '[^a-zA-Z0-9_-]', '_'

                # Skip if ignored/permanently deleted
                if ($ignoredTaskIds[$taskId] -or $ignoredPaths[$normRelFile]) {
                    continue
                }

                $taskNorm = Normalize-Name $rawCleanTitle
                $matchingSols = @()

                $sameDirSols = $solutionFiles | Where-Object { $_.DirectoryName -eq $af.DirectoryName }
                $sameDirAssignments = $assignmentFiles | Where-Object {
                    $_.DirectoryName -eq $af.DirectoryName -and (Get-SheetNumber $_.Name $_.Directory.Name) -eq $sheet
                }

                foreach ($sf in $sameDirSols) {
                    $solRawClean = [IO.Path]::GetFileNameWithoutExtension($sf.Name)
                    $solNorm = (Normalize-Name $solRawClean) -replace '(?i)(loesung|lsung|solution|ausarbeitung|theorie|musterlsung)', ''
                    $solSheet = Get-SheetNumber $sf.Name $sf.Directory.Name

                    # Criterion 1: Direct or substring match
                    $isDirect = ($taskNorm -eq $solNorm -or 
                                ($solNorm.Length -ge 4 -and $taskNorm.Contains($solNorm)) -or 
                                ($taskNorm.Length -ge 4 -and $solNorm.Contains($taskNorm)))

                    # Criterion 2: Category match when multiple assignments in same sheet
                    $catMatch = $false
                    if ($cat -eq "Hausaufgabe" -and $sf.Name -match '(?i)hausaufgabe') { $catMatch = $true }
                    if ($cat -eq $str_Praesenzuebung -and $sf.Name -match '(?i)praesenz') { $catMatch = $true }
                    if ($cat -eq "Tutorium" -and $sf.Name -match '(?i)tutorium') { $catMatch = $true }

                    # Criterion 3: Only assignment in this directory for this sheet
                    $isSoleInSheet = ($sameDirAssignments.Count -le 1 -and $solSheet -eq $sheet)

                    # Criterion 4: Sol sheet matches and category matches
                    $isCatAndSheetMatch = ($catMatch -and $solSheet -eq $sheet)

                    if ($isDirect -or $isCatAndSheetMatch -or $isSoleInSheet) {
                        $matchingSols += $sf
                    }
                }

                $matchingSol = if ($matchingSols.Count -gt 0) { $matchingSols[0] } else { $null }
                $solRelPath = if ($matchingSol) { $matchingSol.FullName.Substring($WorkspaceRoot.Length + 1) } else { $null }
                
                $solNote = if ($matchingSols.Count -gt 1) {
                    "$($matchingSols.Count) $($str_LoesungenVorh): " + (($matchingSols | Select-Object -ExpandProperty Name) -join ", ")
                } elseif ($matchingSol) {
                    "$($str_LoesungVorh): $($matchingSol.Name)"
                } else {
                    $null
                }

                $fileSize = Format-FileSize $af.Length
                $fileExt = $af.Extension.TrimStart('.').ToUpper()

                $solName = if ($matchingSol) { $matchingSol.Name } else { $null }
                $solSize = if ($matchingSol) { Format-FileSize $matchingSol.Length } else { $null }
                $solExt = if ($matchingSol) { $matchingSol.Extension.TrimStart('.').ToUpper() } else { $null }

                $override = if ($userOverrides[$taskId]) { $userOverrides[$taskId] } elseif ($userOverridesByPath[$normRelFile]) { $userOverridesByPath[$normRelFile] } else { $null }
                $autoDone = ($matchingSol -ne $null)
                $manualStatus = if ($override) { $override.manual_status } else { $null }
                $isCompleted = if ($manualStatus -ne $null) { [bool]$manualStatus } else { $autoDone }

                # Default: Präsenzübung & Tutorium are optional, Hausaufgabe & Übungsblatt are mandatory
                $defaultOptional = ($cat -eq $str_Praesenzuebung -or $cat -eq "Tutorium")
                $isOpt = if ($override -and $override.is_optional -ne $null) { [bool]$override.is_optional } else { $defaultOptional }

                $scannedTasks += [PSCustomObject]@{
                    id = $taskId
                    subject = $subj
                    category = $cat
                    sheet = $sheet
                    title = $displayTitle
                    file_path = $relFile
                    file_name = $af.Name
                    file_size = $fileSize
                    file_ext = $fileExt
                    is_folder = $false
                    solution_path = $solRelPath
                    solution_name = $solName
                    solution_size = $solSize
                    solution_ext = $solExt
                    solution_note = $solNote
                    auto_detected = $autoDone
                    manual_status = $manualStatus
                    completed = $isCompleted
                    is_optional = $isOpt
                    notes = if ($override) { [string]$override.notes } else { "" }
                    priority = if ($override -and $override.priority) { $override.priority } else { "normal" }
                    due_date = if ($override) { $override.due_date } else { $null }
                    is_custom = $false
                    last_modified = ($af.LastWriteTime).ToString("yyyy-MM-ddTHH:mm:ss")
                }
            }
        }
    }

    $allTasks = @($scannedTasks + $customTasks)
    $sortedTasks = $allTasks | Sort-Object subject, sheet, category, title

    $mandatoryTasks = @($sortedTasks | Where-Object { -not $_.is_optional })
    $optionalTasks  = @($sortedTasks | Where-Object { [bool]$_.is_optional })

    $finalDb = [PSCustomObject]@{
        version = "2.3"
        last_scanned = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        total_count = $sortedTasks.Count
        completed_count = ($sortedTasks | Where-Object { $_.completed -eq $true }).Count
        pending_count = ($sortedTasks | Where-Object { $_.completed -ne $true }).Count
        mandatory_count = $mandatoryTasks.Count
        mandatory_completed = ($mandatoryTasks | Where-Object { $_.completed -eq $true }).Count
        optional_count = $optionalTasks.Count
        optional_completed = ($optionalTasks | Where-Object { $_.completed -eq $true }).Count
        ignored_tasks = if ($existingDb.ignored_tasks) { @($existingDb.ignored_tasks) } else { @() }
        tasks = $sortedTasks
    }

    $jsonOutput = $finalDb | ConvertTo-Json -Depth 5
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($dbPath, $jsonOutput, $utf8NoBom)

    return $finalDb
}

if ($MyInvocation.InvocationName -ne '.') {
    $res = Get-HomeworkDatabase
    Write-Host "Gesamt: $($res.total_count) | Pflicht: $($res.mandatory_completed)/$($res.mandatory_count) | Optional: $($res.optional_completed)/$($res.optional_count)"
}