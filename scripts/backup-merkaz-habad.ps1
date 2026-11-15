#requires -Version 5.1
<#
.MERKAZ-HABAD / Secure manual backup
Prerequisites: PostgreSQL client (pg_dump, pg_restore, psql), git, age.
Provide PGHOST, PGPORT, PGUSER, PGDATABASE and PGPASSFILE environment
variables for the authorized DB connection. Never commit any DB secrets.
The age recipient must be a public encryption recipient already owned by
the merchant. A corresponding private key is required to decrypt.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$AgeRecipient,
  [string]$OutputDirectory = "$HOME\MerkazHabadBackups",
  [string]$StorageExportDirectory = ""
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
foreach ($name in @('pg_dump','pg_restore','psql','git','age')) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required tool missing: $name"
  }
}
foreach ($name in @('PGHOST','PGUSER','PGDATABASE','PGPASSFILE')) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Set $name in your current session before executing (never write it into the repository)."
  }
}
if (-not (Test-Path -LiteralPath $env:PGPASSFILE -PathType Leaf)) {
  throw "PGPASSFILE not found. Check file path and access permissions."
}
if ($env:PGDATABASE -eq 'postgres' -and !$env:PGHOST) {throw 'Missing explicit target database'}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path ([IO.Path]::GetTempPath()) ("merkaz-backup-" + [guid]::NewGuid().ToString('N'))
$dump = Join-Path $work 'database.dump'
$list = Join-Path $work 'database-contents.txt'
$repoDir = Join-Path $work 'repository'
$storageDir = Join-Path $work 'storage-export'
$zip = Join-Path $work 'backup.zip'
$encrypted = Join-Path $work 'backup.zip.age'
New-Item -ItemType Directory -Path $work -Force | Out-Null
try {
  # Fail closed if Storage contains objects but the merchant has not provided
  # an independently downloaded copy of those bytes.
  $storageCount = (& psql -X -A -t -v ON_ERROR_STOP=1 -c 'select count(*) from storage.objects').Trim()
  if ($LASTEXITCODE -ne 0 -or $storageCount -notmatch '^\d+$') {throw 'Unable to check Supabase Storage objects'}
  $storageCount = [int]$storageCount
  if ($storageCount -gt 0 -and [string]::IsNullOrWhiteSpace($StorageExportDirectory)) {
    throw "Supabase Storage contains $storageCount objects. Export their original bytes separately, then pass -StorageExportDirectory; database.dump alone is NOT sufficient."
  }
  if (-not [string]::IsNullOrWhiteSpace($StorageExportDirectory)) {
    if (-not (Test-Path -LiteralPath $StorageExportDirectory -PathType Container)) {throw 'Storage export folder missing'}
    New-Item -ItemType Directory -Path $storageDir | Out-Null
    Copy-Item -Path (Join-Path $StorageExportDirectory '*') -Destination $storageDir -Recurse -Force
    if ($storageCount -gt 0 -and -not (Get-ChildItem -LiteralPath $storageDir -File -Recurse)) {
      throw 'Storage export folder is empty'
    }
  }
  & pg_dump --format=custom --no-owner --no-acl --file $dump
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dump)) {throw 'pg_dump failed'}
  & pg_restore --list $dump | Out-File -FilePath $list -Encoding utf8
  if ($LASTEXITCODE -ne 0) {throw 'pg_restore could not read the dump archive'}
  & git clone --depth 1 --single-branch https://github.com/shimon3/mercazhabad.git $repoDir
  if ($LASTEXITCODE -ne 0) {throw 'Repository copy failed'}
  # The repository contains the catalog's statically hosted product photographs.
  & git -C $repoDir rev-parse HEAD | Out-File (Join-Path $work 'git-commit.txt') -Encoding ascii
  if ($LASTEXITCODE -ne 0) {throw 'Could not record deployed repository revision'}
  $manifest = @(
    'Merkaz Habad encrypted backup — ' + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'),
    'Database: PostgreSQL custom archive (includes sensitive auth and customer data)',
    'Repository: GitHub main branch, shallow clone including static assets',
    'Supabase Storage objects reported: ' + $storageCount,
    'Supabase Storage original binary export included: ' + [bool]$StorageExportDirectory,
    'ARCHIVE LISTABILITY CHECK PASSED. FULL RESTORATION HAS NOT BEEN TESTED.',
    'Restore only in an isolated non-production PostgreSQL/Supabase environment.'
  )
  $manifest | Set-Content -Path (Join-Path $work 'MANIFEST.txt') -Encoding UTF8
  Compress-Archive -LiteralPath $dump,$list,$repoDir,(Join-Path $work 'git-commit.txt'),(Join-Path $work 'MANIFEST.txt') -DestinationPath $zip -CompressionLevel Optimal
  if (Test-Path $storageDir) {
    # Recreate zip with the storage directory included.
    Remove-Item -LiteralPath $zip -Force
    Compress-Archive -LiteralPath $dump,$list,$repoDir,$storageDir,(Join-Path $work 'git-commit.txt'),(Join-Path $work 'MANIFEST.txt') -DestinationPath $zip -CompressionLevel Optimal
  }
  & age -r $AgeRecipient -o $encrypted $zip
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $encrypted)) {throw 'Backup encryption failed'}
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $destination = Join-Path $OutputDirectory ("MerkazHabad-$stamp.zip.age")
  Move-Item -LiteralPath $encrypted -Destination $destination
  $checksum = Get-FileHash -Algorithm SHA256 -LiteralPath $destination
  "$($checksum.Hash)  $(Split-Path -Leaf $destination)" | Set-Content -Path ($destination + '.sha256') -Encoding ascii
  Write-Output ("ENCRYPTED BACKUP: " + $destination)
  Write-Output ("SHA256: " + $checksum.Hash)
  Write-Warning "Archive listing verified, not a full restore test. Copy to a second secure location and test an isolated restore."
}
finally {
  # Plaintext DB dumps must not be kept on the workstation.
  if (Test-Path -LiteralPath $work) {Remove-Item -LiteralPath $work -Recurse -Force}
}
