# Proposta: restaura backups ACL individuais criados pelo script 02.
# Nunca abre bancos; somente localiza e restaura arquivos .acl.
# A VERIFICAR: icacls /restore recebe a pasta PAI do alvo salvo; reversão exige elevação.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{8}-\d{6}$')]
    [string]$Identificador,
    [switch]$Aplicar,
    [switch]$ConfirmarReversao
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$BackupDir = Join-Path 'C:\RallyCofre\acl-backups' $Identificador
$AlvosAutorizados = @(
    'C:\RallyCofre',
    'C:\rally\backend',
    'C:\rally\decoys',
    'C:\rally\canary',
    'C:\rally\app'
)

function Formatar-Comando {
    param([string[]]$Argumentos)
    return 'icacls.exe ' + (($Argumentos | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' ')
}

$Identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identidade)
if ($Aplicar -and -not $Principal.IsInRole([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
    throw 'A reversão exige PowerShell elevado.'
}
$ContaRallyDev = Get-LocalUser -Name 'RallyDev' -ErrorAction SilentlyContinue
if ($null -ne $ContaRallyDev) {
    $PerfilRallyDev = Get-CimInstance -ClassName Win32_UserProfile -Filter "SID = '$($ContaRallyDev.SID.Value)'" -ErrorAction SilentlyContinue
    if ($null -ne $PerfilRallyDev -and $PerfilRallyDev.LocalPath) {
        $AlvosAutorizados += @(
            (Join-Path $PerfilRallyDev.LocalPath 'AppData\Local\RallyDasTribos\dev'),
            (Join-Path $PerfilRallyDev.LocalPath 'AppData\Local\RallyDasTribos\test')
        )
    }
}
if (-not (Test-Path -LiteralPath $BackupDir -PathType Container)) {
    throw "Conjunto de backup não encontrado: $Identificador"
}

$Arquivos = @(Get-ChildItem -LiteralPath $BackupDir -Filter '*.acl' -File)
if ($Arquivos.Count -eq 0) { throw 'Nenhum backup por alvo encontrado.' }

foreach ($Arquivo in $Arquivos) {
    $Leaf = [IO.Path]::GetFileNameWithoutExtension($Arquivo.Name)
    $Alvo = $AlvosAutorizados | Where-Object { (Split-Path -Leaf $_) -eq $Leaf } | Select-Object -First 1
    if (-not $Alvo) { throw "Arquivo de backup não corresponde a alvo reconhecido: $($Arquivo.Name)" }
    if ($Aplicar -and $Alvo -in @('C:\RallyCofre', 'C:\rally\backend') -and -not $ConfirmarReversao) {
        throw "Restaurar $Alvo exige -ConfirmarReversao explícito."
    }
    $Pai = Split-Path -Parent $Alvo
    $Argumentos = @($Pai, '/restore', $Arquivo.FullName)
    $Linha = Formatar-Comando $Argumentos
    if (-not $Aplicar) {
        Write-Output "SIMULAÇÃO: $Linha"
        continue
    }
    Write-Output "EXECUTANDO: $Linha"
    & icacls.exe @Argumentos
    if ($LASTEXITCODE -ne 0) {
        throw "Restauração interrompida para $Alvo; código $LASTEXITCODE. Revise as ACLs manualmente."
    }
}

Write-Output 'Restauração de DACLs concluída; confira as ACLs de cada alvo.'
Write-Output 'A VERIFICAR: icacls /save pode não preservar o proprietário; se confirmado, restaure o dono manualmente.'
