# Proposta: testa permissões com iscas sintéticas fixas; nunca abre bancos.
# Executar como RallyDev, sem elevação; T11 espera negação ao ler ACLs protegidas.
# T13/T14 não implementados. A VERIFICAR: erros de hardlink e permissões efetivas.
[CmdletBinding()]
param([switch]$Aplicar)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Diretorio = 'C:\rally\decoys'
$Isca = Join-Path $Diretorio 'fixture.txt'
$IscaExclusao = Join-Path $Diretorio 'fixture-delete-probe.txt'
$Falhas = 0
$ArtefatosCriados = [Collections.Generic.List[string]]::new()

if (-not $Aplicar) {
    Write-Output 'SIMULAÇÃO: executaria T1–T12 com fixtures sintéticas fixas; nenhum acesso foi tentado.'
    Write-Output 'Use -Aplicar como RallyDev, sem elevação. A isca ausente será reportada como REPROVADO.'
    return
}

function Registrar-Resultado {
    param([string]$Teste, [bool]$Aprovado, [string]$Detalhe)
    $Estado = if ($Aprovado) { 'APROVADO' } else { 'REPROVADO' }
    $Codigo = if ($Aprovado) { 0 } else { 1 }
    Write-Output "$Estado $Teste (código $Codigo): $Detalhe"
    if (-not $Aprovado) { $script:Falhas++ }
}

function Testar-Negacao {
    param(
        [Parameter(Mandatory)][string]$Teste,
        [Parameter(Mandatory)][scriptblock]$Acao,
        [switch]$Isca
    )
    try {
        & $Acao
        $script:UltimaOperacaoPermitida = $true
        Registrar-Resultado $Teste $false 'a operação foi permitida'
    } catch {
        $Erro = $_.Exception
        $Tipo = $Erro.GetType().FullName
        $HResult = $Erro.HResult
        $Mensagem = $Erro.Message
        $Ausente = $Erro -is [IO.FileNotFoundException] -or
            $Erro -is [IO.DirectoryNotFoundException] -or
            $HResult -eq -2147024894 -or $HResult -eq -2147024893 -or
            $Mensagem -match '(?i)not found|does not exist|cannot find path|não existe|não encontrado'
        $Negado = -not $Ausente -and (
            $Erro -is [UnauthorizedAccessException] -or
            $Erro -is [Security.SecurityException] -or
            $HResult -eq -2147024891 -or
            $Mensagem -match '(?i)access.*denied|acesso negado'
        )
        if ($Ausente) {
            $script:UltimaOperacaoPermitida = $false
            $DetalheAusente = if ($Isca) { 'isca ausente' } else { 'caminho/alvo ausente' }
            Registrar-Resultado $Teste $false "$DetalheAusente; tipo=$Tipo; HResult=$HResult"
        } elseif ($Negado) {
            $script:UltimaOperacaoPermitida = $false
            Registrar-Resultado $Teste $true "acesso negado; tipo=$Tipo; HResult=$HResult"
        } else {
            $script:UltimaOperacaoPermitida = $false
            Registrar-Resultado $Teste $false "erro não classificado como acesso negado; tipo=$Tipo; HResult=$HResult; mensagem=$Mensagem"
        }
    }
}

function New-ProbeFile {
    param([Parameter(Mandatory)][string]$Path)
    $Stream = $null
    try {
        $Stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $script:ArtefatosCriados.Add($Path)
        $Bytes = [Text.Encoding]::UTF8.GetBytes('synthetic')
        $Stream.Write($Bytes, 0, $Bytes.Length)
    } finally {
        if ($null -ne $Stream) { $Stream.Dispose() }
    }
}

function Get-ProbePath {
    param([string]$Pasta, [string]$Nome)
    return Join-Path $Pasta ($Nome + '-' + [Guid]::NewGuid().ToString('N') + '.tmp')
}

$Identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identidade)
$IsRallyDev = $Identidade.Name -like '*\RallyDev'
$IsAdmin = $Principal.IsInRole([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
Registrar-Resultado 'T1 identidade e grupos' ($IsRallyDev -and -not $IsAdmin) 'identidade terminada em \RallyDev e token sem Administradores'
if (-not $IsRallyDev -or $IsAdmin) {
    Read-Host 'Execução recusada. Pressione ENTER para fechar'
    exit 1
}

try {
    # Não usar Test-Path em decoys/isca: uma ACL correta pode ocultar a existência.
    Testar-Negacao 'T2 leitura da isca' { [IO.File]::ReadAllText($Isca) | Out-Null } -Isca

    Testar-Negacao 'T3 gravação/anexo da isca' {
        $Stream = $null
        $TamanhoOriginal = $null
        try {
            $Stream = [IO.File]::Open($Isca, [IO.FileMode]::Open, [IO.FileAccess]::Write, [IO.FileShare]::Read)
            $TamanhoOriginal = $Stream.Length
            $Stream.Position = $TamanhoOriginal
            $Stream.WriteByte(0x20)
        } finally {
            if ($null -ne $Stream) {
                try {
                    if ($null -ne $TamanhoOriginal) { $Stream.SetLength($TamanhoOriginal) }
                } finally {
                    $Stream.Dispose()
                }
            }
        }
    } -Isca

    $Renomeada = $Isca + '.rename-probe-' + [Guid]::NewGuid().ToString('N')
    Testar-Negacao 'T4 renomeação da isca' {
        $RenomeouIsca = $false
        try {
            [IO.File]::Move($Isca, $Renomeada)
            $RenomeouIsca = $true
            [IO.File]::Move($Renomeada, $Isca)
            $RenomeouIsca = $false
        } finally {
            if ($RenomeouIsca -and [IO.File]::Exists($Renomeada) -and -not [IO.File]::Exists($Isca)) {
                [IO.File]::Move($Renomeada, $Isca)
            }
        }
    } -Isca

    Testar-Negacao 'T5 exclusão da isca auxiliar' { Remove-Item -LiteralPath $IscaExclusao -Force -ErrorAction Stop } -Isca
    if ($script:UltimaOperacaoPermitida) {
        Write-Output 'AÇÃO NECESSÁRIA: T5 foi permitido; recrie manualmente fixture-delete-probe.txt sintética. fixture.txt original não foi removida.'
    }

    foreach ($Sufixo in @('wal-probe', 'shm-probe', 'journal-probe')) {
        $Probe = Get-ProbePath -Pasta $Diretorio -Nome $Sufixo
        Testar-Negacao "T6 criação $Sufixo" { New-ProbeFile -Path $Probe } -Isca
    }

    $App = 'C:\rally\app'
    $AppProbe = Get-ProbePath -Pasta $App -Nome 'codex-acl-probe'
    Testar-Negacao 'T7 escrita no código' { New-ProbeFile -Path $AppProbe }

    $Dev = Join-Path $env:LOCALAPPDATA 'RallyDasTribos\dev'
    $Test = Join-Path $env:LOCALAPPDATA 'RallyDasTribos\test'
    if (Test-Path -LiteralPath $Dev -PathType Container) {
        $DevProbe = Get-ProbePath -Pasta $Dev -Nome 'acl-probe'
        New-ProbeFile -Path $DevProbe
        Registrar-Resultado 'T8 escrita dev' $true 'arquivo sintético criado'
        $DevRenomeado = $DevProbe + '.renamed'
        [IO.File]::Move($DevProbe, $DevRenomeado)
        $ArtefatosCriados.Remove($DevProbe)
        $ArtefatosCriados.Add($DevRenomeado)
        [IO.File]::Delete($DevRenomeado)
        $ArtefatosCriados.Remove($DevRenomeado)
        Registrar-Resultado 'T9 auxiliares dev' $true 'criar, renomear e excluir concluídos'
    } else {
        Write-Output 'IGNORADO T8/T9 dev: diretório dev não existe.'
    }
    if (Test-Path -LiteralPath $Test -PathType Container) {
        $TestProbe = Get-ProbePath -Pasta $Test -Nome 'acl-probe'
        New-ProbeFile -Path $TestProbe
        $TestRenomeado = $TestProbe + '.renamed'
        [IO.File]::Move($TestProbe, $TestRenomeado)
        $ArtefatosCriados.Remove($TestProbe)
        $ArtefatosCriados.Add($TestRenomeado)
        [IO.File]::Delete($TestRenomeado)
        $ArtefatosCriados.Remove($TestRenomeado)
        Registrar-Resultado 'T9 auxiliares test' $true 'criar, renomear e excluir concluídos'
    } else {
        Write-Output 'IGNORADO T9 test: diretório test não existe.'
    }

    if (Test-Path -LiteralPath $Dev -PathType Container) {
        $LinkProbe = Get-ProbePath -Pasta $Dev -Nome 'link-probe'
        Testar-Negacao 'T10 criação de hardlink para isca' {
            New-Item -ItemType HardLink -Path $LinkProbe -Target $Isca -ErrorAction Stop | Out-Null
            $ArtefatosCriados.Add($LinkProbe)
        } -Isca
    } else {
        Write-Output 'IGNORADO T10: diretório dev não existe.'
    }

    foreach ($Alvo in @('C:\RallyCofre', 'C:\rally\backend', 'C:\rally\canary')) {
        Testar-Negacao "T11 leitura da ACL de $Alvo" { $null = Get-Acl -LiteralPath $Alvo }
    }

    foreach ($Alvo in @('C:\RallyCofre', 'C:\rally\canary')) {
        $Probe = Get-ProbePath -Pasta $Alvo -Nome 'acl-probe'
        Testar-Negacao "T12 criação em $Alvo" { New-ProbeFile -Path $Probe }
    }
} catch {
    $Falhas++
    Write-Output "REPROVADO execução dos testes: tipo=$($_.Exception.GetType().FullName); detalhe=$($_.Exception.Message)"
} finally {
    foreach ($Artefato in @($ArtefatosCriados)) {
        try {
            Remove-Item -LiteralPath $Artefato -Force -ErrorAction Stop
        } catch {
            $Falhas++
            Write-Output "REPROVADO LIMPEZA: arquivo criado pelo teste não removido; caminho=$Artefato; tipo=$($_.Exception.GetType().FullName)"
        }
    }
}

Write-Output 'NÃO IMPLEMENTADOS NESTA FASE: T13 e T14 (gates G1–G8).'
$CodigoSaida = if ($Falhas -gt 0) { 1 } else { 0 }
Read-Host 'Testes concluídos. Pressione ENTER para fechar esta janela'
exit $CodigoSaida
