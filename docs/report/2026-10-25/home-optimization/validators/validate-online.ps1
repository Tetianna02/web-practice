param([string]$Stage = 'after', [switch]$OnlyCss, [switch]$OnlyHtml, [string]$CssProfile = 'css3svg')
$ErrorActionPreference = 'Stop'
$reportDirectory = $PSScriptRoot
$projectDirectory = (Resolve-Path -LiteralPath (Join-Path $reportDirectory '../../../../..')).Path
$summaries = [System.Collections.Generic.List[object]]::new()
$htmlInputs = [System.Collections.Generic.List[object]]::new()
$htmlInputs.Add(@{ Name = 'source'; Path = (Join-Path $projectDirectory 'index.html') })
$domDirectory = Join-Path $reportDirectory '../after/dom'
if (Test-Path -LiteralPath $domDirectory) {
    Get-ChildItem -LiteralPath $domDirectory -Filter '*.html' | ForEach-Object { $htmlInputs.Add(@{ Name = $_.BaseName; Path = $_.FullName }) }
}
if (-not $OnlyCss) { foreach ($inputFile in $htmlInputs) {
    $outputName = 'nu-' + $inputFile.Name + '-' + $Stage
    try {
        $response = Invoke-WebRequest -Uri 'https://validator.w3.org/nu/?out=json' -Method Post -ContentType 'text/html; charset=utf-8' -Body ([System.IO.File]::ReadAllBytes($inputFile.Path)) -TimeoutSec 60
        [System.IO.File]::WriteAllText((Join-Path $reportDirectory ($outputName + '.json')), $response.Content)
        $parsed = $response.Content | ConvertFrom-Json
        $summaries.Add(@{ Service = 'Nu HTML'; Input = $inputFile.Name; Status = $response.StatusCode; Errors = @($parsed.messages | Where-Object type -eq 'error').Count; Warnings = @($parsed.messages | Where-Object subType -eq 'warning').Count; Output = $outputName + '.json' })
    } catch {
        $summaries.Add(@{ Service = 'Nu HTML'; Input = $inputFile.Name; Failure = $_.Exception.Message })
    }
} }
if (-not $OnlyHtml) { foreach ($cssName in @('_variables', 'style')) {
    $outputName = 'jigsaw-' + $cssName + '-' + $Stage
    try {
        $cssText = [System.IO.File]::ReadAllText((Join-Path $projectDirectory ('assets/css/' + $cssName + '.css')))
        $form = @{ text = $cssText; profile = $CssProfile; usermedium = 'all'; warning = '2'; output = 'soap12'; lang = 'en' }
        $response = Invoke-WebRequest -Uri 'https://jigsaw.w3.org/css-validator/validator' -Method Post -Form $form -TimeoutSec 60
        [System.IO.File]::WriteAllText((Join-Path $reportDirectory ($outputName + '.xml')), $response.Content)
        [xml]$parsed = $response.Content
        $validation = $parsed.SelectSingleNode("//*[local-name()='cssvalidationresponse']")
        $result = @{
            Validity = $validation.SelectSingleNode(".//*[local-name()='validity']").InnerText
            ErrorCount = [int]$validation.SelectSingleNode(".//*[local-name()='errorcount']").InnerText
            WarningCount = [int]$validation.SelectSingleNode(".//*[local-name()='warningcount']").InnerText
            Errors = @($validation.SelectNodes(".//*[local-name()='error']") | ForEach-Object { @{ Line = $_.SelectSingleNode("./*[local-name()='line']").InnerText; Message = $_.SelectSingleNode("./*[local-name()='message']").InnerText; Context = $_.SelectSingleNode("./*[local-name()='context']").InnerText } })
            Warnings = @($validation.SelectNodes(".//*[local-name()='warning']") | ForEach-Object { @{ Line = $_.SelectSingleNode("./*[local-name()='line']").InnerText; Message = $_.SelectSingleNode("./*[local-name()='message']").InnerText } })
        }
        $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportDirectory ($outputName + '.json')) -Encoding utf8
        $summaries.Add(@{ Service = 'Jigsaw ' + $CssProfile + ' SOAP'; Input = $cssName; Status = $response.StatusCode; Validity = $result.Validity; Errors = $result.ErrorCount; Warnings = $result.WarningCount; Output = $outputName + '.xml' })
    } catch {
        $summaries.Add(@{ Service = 'Jigsaw CSS3'; Input = $cssName; Failure = $_.Exception.Message })
    }
} }
$summary = @{ Timestamp = (Get-Date).ToUniversalTime().ToString('o'); Stage = $Stage; Results = $summaries }
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportDirectory ('validator-summary-' + $Stage + '.json')) -Encoding utf8
$summary | ConvertTo-Json -Depth 5
