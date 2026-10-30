# Proposta: simula, verifica ACLs ou aplica allow-list a diretórios aprovados.
# Não abre arquivos/bancos; cofre/backend não são alterados sem opção explícita.
# A VERIFICAR: /save, /restore, /remove:g com SIDs, enumeração de ACL e herança.
[CmdletBinding()]
param(
    [switch]$Aplicar,
    [switch]$Verificar,
    [switch]$ReaplicarProtegidos,
    [switch]$ConfirmarOperador,
    [ValidateSet('decoys', 'canary', 'app', 'dev', 'test')]
    [string]$SomenteAlvo
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SidAdministradores = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$SidSystem = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$SidUsuarios = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')
$SidUsuariosAutenticados = [Security.Principal.SecurityIdentifier]::new('S-1-5-11')
$Cofre = 'C:\RallyCofre'
$Backend = 'C:\rally\backend'
$Decoys = 'C:\rally\decoys'
$Canary = 'C:\rally\canary'
$App = 'C:\rally\app'
$Isca = Join-Path $Decoys 'fixture.txt'
$IscaExclusao = Join-Path $Decoys 'fixture-delete-probe.txt'
$Protegidos = @($Cofre, $Backend)
$Criaveis = @($Decoys, $Canary)
$AlvosFixos = @($Cofre, $Backend, $Decoys, $Canary, $App)
$AlvosDevTest = @()
$Alvos = @($AlvosFixos)
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $Cofre "acl-backups\$Stamp"

function Get-PathNormalizado {
    param([Parameter(Mandatory)][string]$Path)
    return [IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-CaminhoConhecidoDeBanco {
    param([Parameter(Mandatory)][string]$Path)
    # Comparação textual somente; nenhum arquivo de banco ou sidecar é consultado.
    $BancosConhecidos = @(
        'C:\Users\Alison\OneDrive\Desktop\rally-das-tribos\data\rally-das-tribos.db',
        'C:\Users\Alison\AppData\Local\Temp\rally-das-tribos-audit\rally-das-tribos-test.db',
        'C:\rally\backend\rally.db'
    )
    $Normalizado = Get-PathNormalizado $Path
    foreach ($Banco in $BancosConhecidos) {
        $BancoNormalizado = Get-PathNormalizado $Banco
        if ($Normalizado.Equals($BancoNormalizado, [StringComparison]::OrdinalIgnoreCase) -or
            $BancoNormalizado.StartsWith($Normalizado + '\', [StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Formatar-Comando {
    param([Parameter(Mandatory)][string[]]$Argumentos)
    $Partes = foreach ($Argumento in $Argumentos) {
        '"' + $Argumento.Replace('"', '\"') + '"'
    }
    return 'icacls.exe ' + ($Partes -join ' ')
}

function New-FixtureSintetica {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content
    )
    if ([IO.File]::Exists($Path)) { return }
    $Bytes = [Text.Encoding]::UTF8.GetBytes($Content)
    $Stream = $null
    try {
        $Stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $Stream.Write($Bytes, 0, $Bytes.Length)
    } finally {
        if ($null -ne $Stream) { $Stream.Dispose() }
    }
}

function Invoke-IcaclsPlanejado {
    param(
        [Parameter(Mandatory)][string[]]$Argumentos,
        [Parameter(Mandatory)][string]$Descricao
    )
    $Linha = Formatar-Comando $Argumentos
    if (-not $Aplicar) {
        Write-Output "SIMULAÇÃO [$Descricao]: $Linha"
        return
    }
    Write-Output "EXECUTANDO [$Descricao]: $Linha"
    & icacls.exe @Argumentos
    if ($LASTEXITCODE -ne 0) {
        throw "icacls falhou em '$Descricao' (código $LASTEXITCODE). ACL pode estar parcial. Reverta com 99-reverter.ps1 -Identificador $Stamp -Aplicar."
    }
}

function Get-SidDosDireitos {
    param([Parameter(Mandatory)][Security.AccessControl.AuthorizationRule[]]$Regras)
    $Mapa = @{}
    foreach ($Regra in $Regras) {
        $SidRegra = $Regra.IdentityReference.Value
        if (-not $Mapa.ContainsKey($SidRegra)) { $Mapa[$SidRegra] = 0 }
        $Mapa[$SidRegra] = $Mapa[$SidRegra] -bor [int]$Regra.FileSystemRights
    }
    return $Mapa
}

function Testar-ArvoreAcl {
    param(
        [Parameter(Mandatory)][string]$Alvo,
        [Parameter(Mandatory)][hashtable]$DireitosEsperados
    )
    $Itens = @((Get-Item -LiteralPath $Alvo -ErrorAction Stop))
    $Itens += @(Get-ChildItem -LiteralPath $Alvo -Force -Recurse -ErrorAction Stop)
    $Falhou = $false
    $FalhasFilhos = 0
    $TotalFilhos = 0
    $BitSynchronize = [int][Security.AccessControl.FileSystemRights]::Synchronize
    $IndiceItem = 0
    foreach ($Item in $Itens) {
        $EhRaiz = $IndiceItem -eq 0
        $IndiceItem++
        try {
            $Acl = Get-Acl -LiteralPath $Item.FullName -ErrorAction Stop
        } catch {
            if ($EhRaiz) { throw }
            $Falhou = $true
            $FalhasFilhos++
            Write-Host "REPROVADO ACL: falha ao ler filho $($Item.FullName); tipo=$($_.Exception.GetType().FullName)"
            continue
        }
        if ($EhRaiz) {
            Write-Host "ACL raiz $($Item.FullName): $($Acl.Sddl)"
        } else {
            $TotalFilhos++
        }
        if ($EhRaiz -and -not $Acl.AreAccessRulesProtected) {
            $Falhou = $true
            Write-Host "REPROVADO ACL: herança ativa em $($Item.FullName)"
        }
        $Regras = @($Acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
        $Mapa = Get-SidDosDireitos -Regras $Regras
        if ($EhRaiz) {
            $SidDono = $Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
            if ($SidDono -ne $SidAdministradores.Value) {
                $Falhou = $true
                Write-Host "REPROVADO ACL: dono diferente de Administradores em $($Item.FullName)"
            }
        }
        foreach ($Sid in $Mapa.Keys) {
            if (-not $DireitosEsperados.ContainsKey($Sid)) {
                $Falhou = $true
                Write-Host "REPROVADO ACL: SID inesperado $Sid em $($Item.FullName)"
                if (-not $EhRaiz) { $FalhasFilhos++ }
            }
        }
        foreach ($SidProibido in @('S-1-5-11', 'S-1-5-32-545', 'S-1-1-0')) {
            if ($Mapa.ContainsKey($SidProibido)) {
                $Falhou = $true
                Write-Host "REPROVADO ACL: SID proibido $SidProibido em $($Item.FullName)"
                if (-not $EhRaiz) { $FalhasFilhos++ }
            }
        }
        foreach ($SidEsperado in $DireitosEsperados.Keys) {
            if (-not $Mapa.ContainsKey($SidEsperado)) {
                $Falhou = $true
                Write-Host "REPROVADO ACL: SID esperado ausente $SidEsperado em $($Item.FullName)"
                if (-not $EhRaiz) { $FalhasFilhos++ }
                continue
            }
            $RegraDireitos = $Mapa[$SidEsperado] -band (-bnot $BitSynchronize)
            $Esperado = [int]$DireitosEsperados[$SidEsperado] -band (-bnot $BitSynchronize)
            if ($RegraDireitos -ne $Esperado) {
                $Falhou = $true
                Write-Host "REPROVADO ACL: direitos divergentes para $SidEsperado em $($Item.FullName): $RegraDireitos; esperado=$Esperado"
                if (-not $EhRaiz) { $FalhasFilhos++ }
            }
            if ($EhRaiz -and $Item.PSIsContainer) {
                $FlagsHeranca = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit
                $RegrasSid = @($Regras | Where-Object { $_.IdentityReference.Value -eq $SidEsperado })
                foreach ($RegraSid in $RegrasSid) {
                    if (($RegraSid.InheritanceFlags -band $FlagsHeranca) -ne $FlagsHeranca) {
                        $Falhou = $true
                        Write-Host "REPROVADO ACL: ACE sem OI/CI para $SidEsperado em diretório $($Item.FullName)"
                    }
                }
            }
            if (@($Regras | Where-Object { $_.IdentityReference.Value -eq $SidEsperado -and $_.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow }).Count -gt 0) {
                if ($EhRaiz) {
                    $Falhou = $true
                    Write-Host "REPROVADO ACL: ACE de negação para $SidEsperado em $($Item.FullName)"
                }
            }
        }
    }
    Write-Host "Filhos verificados: $TotalFilhos; falhas nos filhos: $FalhasFilhos."
    if ($Falhou) {
        Write-Host "REPROVADO ACL do alvo: $Alvo"
        return $false
    }
    Write-Host "APROVADO ACL do alvo: $Alvo"
    return $true
}

if ($Aplicar -and $Verificar) { throw 'Use -Aplicar ou -Verificar, não ambos.' }
if ($ReaplicarProtegidos -and -not $Aplicar) { throw '-ReaplicarProtegidos exige -Aplicar.' }
if ($Aplicar -and -not $ConfirmarOperador) { throw 'A aplicação exige -ConfirmarOperador após revisar a identidade do operador.' }

$Identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identidade)
$SidAtual = $Identidade.User
$Elevado = $Principal.IsInRole($SidAdministradores)
if (($Aplicar -or $Verificar) -and -not $Elevado) {
    throw 'Aplicação e verificação de ACL exigem PowerShell elevado.'
}

$ComandoGetLocalUser = Get-Command Get-LocalUser -ErrorAction SilentlyContinue
$Conta = if ($ComandoGetLocalUser) { Get-LocalUser -Name 'RallyDev' -ErrorAction SilentlyContinue } else { $null }
$RallyDevExiste = $null -ne $Conta
$SidRallyDev = if ($RallyDevExiste) { $Conta.SID } else { '<SID de RallyDev>' }
if (-not $RallyDevExiste) {
    if ($Aplicar) { throw 'A aplicação exige que a conta RallyDev exista.' }
    Write-Output 'RallyDev ausente: verificações específicas não realizadas.'
}
$Perfil = if ($RallyDevExiste) { Get-CimInstance -ClassName Win32_UserProfile -Filter "SID = '$($SidRallyDev.Value)'" -ErrorAction SilentlyContinue } else { $null }
if ($null -ne $Perfil -and $Perfil.LocalPath) {
    $AlvosDevTest = @(
        (Join-Path $Perfil.LocalPath 'AppData\Local\RallyDasTribos\dev'),
        (Join-Path $Perfil.LocalPath 'AppData\Local\RallyDasTribos\test')
    )
    $Alvos += $AlvosDevTest
}

if ($SomenteAlvo) {
    $AlvoPorNome = @{
        decoys = $Decoys
        canary = $Canary
        app = $App
    }
    if ($AlvosDevTest.Count -eq 2) {
        $AlvoPorNome['dev'] = $AlvosDevTest[0]
        $AlvoPorNome['test'] = $AlvosDevTest[1]
    } elseif ($SomenteAlvo -in @('dev', 'test')) {
        throw "-SomenteAlvo '$SomenteAlvo' exige que o perfil RallyDev esteja disponível."
    }
    $Alvos = @($AlvoPorNome[$SomenteAlvo])
}

foreach ($Alvo in $Alvos) {
    if ((Test-CaminhoConhecidoDeBanco $Alvo) -and ($Alvo -notin $Protegidos)) {
        throw 'Alvo coincide com caminho que contém ou é pai de banco conhecido; operação recusada.'
    }
}

$DireitosPorAlvo = @{}
foreach ($Alvo in $Alvos) {
    $Esperados = @{
        $SidAdministradores.Value = [int][Security.AccessControl.FileSystemRights]::FullControl
        $SidSystem.Value = [int][Security.AccessControl.FileSystemRights]::FullControl
    }
    if ($Alvo -eq $App) {
        $Esperados[$SidAtual.Value] = [int][Security.AccessControl.FileSystemRights]::Modify
        if ($RallyDevExiste) { $Esperados[$SidRallyDev.Value] = [int][Security.AccessControl.FileSystemRights]::ReadAndExecute }
    } elseif ($Alvo -in $AlvosDevTest) {
        $Esperados[$SidRallyDev.Value] = [int][Security.AccessControl.FileSystemRights]::Modify
    }
    $DireitosPorAlvo[$Alvo] = $Esperados
}

if ($Verificar) {
    $FalhaVerificacao = $false
    foreach ($Alvo in $Alvos) {
        if (-not (Test-Path -LiteralPath $Alvo -PathType Container)) {
            Write-Output "REPROVADO ACL: diretório ausente ou inacessível: $Alvo"
            $FalhaVerificacao = $true
            continue
        }
        try {
            if (-not (Testar-ArvoreAcl -Alvo $Alvo -DireitosEsperados $DireitosPorAlvo[$Alvo])) {
                $FalhaVerificacao = $true
            }
        } catch {
            Write-Output "REPROVADO ACL: falha ao ler $Alvo; tipo=$($_.Exception.GetType().FullName); detalhe=$($_.Exception.Message)"
            $FalhaVerificacao = $true
        }
    }
    if ($FalhaVerificacao) { throw 'Verificação ACL encontrou falhas; nenhuma alteração foi feita.' }
    Write-Output 'Verificação concluída; nenhuma ACL foi alterada.'
    return
}

$AlvosDeAplicacao = @($Alvos | Where-Object { $_ -notin $Protegidos -or $ReaplicarProtegidos })
if (-not $Aplicar) {
    Write-Output 'SIMULAÇÃO: nenhuma ACL será lida ou alterada. Os alvos protegidos são omitidos, salvo -ReaplicarProtegidos com -Aplicar.'
    Write-Output "Operador que receberia Modificar em app: nome=$($Identidade.Name); SID=$($SidAtual.Value)"
    if ($Perfil -and $Perfil.LocalPath) { Write-Output "Perfil RallyDev resolvido por SID: $($Perfil.LocalPath)" }
    foreach ($Alvo in $AlvosDeAplicacao) {
        $Leaf = Split-Path -Leaf $Alvo
        $ArquivoBackup = Join-Path $BackupDir "$Leaf.acl"
        $Pai = Split-Path -Parent $Alvo
        Write-Output "DIRETÓRIO DE TRABALHO PARA /save: $Pai"
        $ArgumentosBackup = if ($Alvo -in $Protegidos) {
            @($Leaf, '/save', $ArquivoBackup, '/c')
        } else {
            @($Leaf, '/save', $ArquivoBackup, '/t', '/c')
        }
        Write-Output ('SIMULAÇÃO: ' + (Formatar-Comando $ArgumentosBackup))
        $AcesSimuladas = @()
        foreach ($Grant in $DireitosPorAlvo[$Alvo].GetEnumerator()) {
            $Direito = [Security.AccessControl.FileSystemRights]$Grant.Value
            $CodigoDireito = if ($Direito -eq [Security.AccessControl.FileSystemRights]::FullControl) { 'F' } elseif ($Direito -eq [Security.AccessControl.FileSystemRights]::Modify) { 'M' } else { 'RX' }
            $AcesSimuladas += '*' + $Grant.Key + ":(OI)(CI)$CodigoDireito"
        }
        if ($Alvo -eq $App -and -not $RallyDevExiste) {
            $AcesSimuladas += '*<SID de RallyDev>:(OI)(CI)RX'
        }
        Write-Output ('SIMULAÇÃO: ' + (Formatar-Comando (@($Alvo, '/grant:r') + $AcesSimuladas)))
        Write-Output ('SIMULAÇÃO: ' + (Formatar-Comando @($Alvo, '/inheritance:r')))
        $SidsSimuladosParaRemover = @('*S-1-5-11', '*S-1-5-32-545', '*S-1-1-0')
        if (($Alvo -in $Protegidos -or $Alvo -in $Criaveis) -and $RallyDevExiste) {
            $SidsSimuladosParaRemover += '*' + $SidRallyDev.Value
        }
        Write-Output ('SIMULAÇÃO: ' + (Formatar-Comando (@($Alvo, '/remove:g') + $SidsSimuladosParaRemover)))
        Write-Output ('SIMULAÇÃO: ' + (Formatar-Comando @($Alvo, '/setowner', ('*' + $SidAdministradores.Value), '/t', '/c')))
    }
    Write-Output "SIMULAÇÃO: criaria fixtures sintéticas em $Isca e $IscaExclusao antes de aplicar ACL, caso ainda não existam."
    return
}

# Pré-condições de aplicação. Somente decoys/canary/dev/test podem ser criados.
foreach ($Alvo in $Alvos) {
    if (Test-Path -LiteralPath $Alvo -PathType Container) { continue }
    if ($Alvo -in $Criaveis -or $Alvo -in $AlvosDevTest) {
        New-Item -ItemType Directory -Path $Alvo -Force | Out-Null
    } else {
        throw "Diretório obrigatório ausente: $Alvo"
    }
}
if (-not $SomenteAlvo) {
    foreach ($AlvoProtegido in $Protegidos) {
        $AclProtegida = Get-Acl -LiteralPath $AlvoProtegido -ErrorAction Stop
        Write-Output "ACL preservada (nenhuma alteração sem -ReaplicarProtegidos): $AlvoProtegido $($AclProtegida.Sddl)"
    }
}
if ($Alvos -contains $Decoys) {
    if (-not (Test-Path -LiteralPath 'C:\rally' -PathType Container)) {
        throw 'C:\rally deve existir antes de criar decoys.'
    }
    New-FixtureSintetica -Path $Isca -Content 'Fixture sintética para testes de ACL. Sem dados reais.'
    New-FixtureSintetica -Path $IscaExclusao -Content 'Fixture sintética descartável para teste de exclusão. Sem dados reais.'
}

if (-not (Test-Path -LiteralPath $Cofre -PathType Container)) { throw 'Cofre ausente; backups protegidos não podem ser criados.' }
if (-not (Test-Path -LiteralPath $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

# Salvar a ACL de cada alvo num arquivo próprio antes de qualquer alteração.
foreach ($Alvo in $AlvosDeAplicacao) {
    $Leaf = Split-Path -Leaf $Alvo
    $ArquivoBackup = Join-Path $BackupDir "$Leaf.acl"
    $Pai = Split-Path -Parent $Alvo
    Push-Location $Pai
    try {
        $ArgumentosBackup = if ($Alvo -in $Protegidos) { @($Leaf, '/save', $ArquivoBackup, '/c') } else { @($Leaf, '/save', $ArquivoBackup, '/t', '/c') }
        Invoke-IcaclsPlanejado -Argumentos $ArgumentosBackup -Descricao "backup de $Alvo"
        if (-not (Test-Path -LiteralPath $ArquivoBackup -PathType Leaf)) {
            throw "Backup ACL não foi criado para $Alvo; nenhuma ACL foi alterada."
        }
    } finally {
        Pop-Location
    }
}

try {
    Write-Output "Operador da ACL de app: nome=$($Identidade.Name); SID=$($SidAtual.Value)"
    foreach ($Alvo in $AlvosDeAplicacao) {
        if ($Alvo -eq $App -and -not $ConfirmarOperador) { throw 'Confirme o SID do operador antes de conceder acesso ao app.' }
        $Aces = @()
        foreach ($Grant in $DireitosPorAlvo[$Alvo].GetEnumerator()) {
            $Direito = [Security.AccessControl.FileSystemRights]$Grant.Value
            $CodigoDireito = if ($Direito -eq [Security.AccessControl.FileSystemRights]::FullControl) { 'F' } elseif ($Direito -eq [Security.AccessControl.FileSystemRights]::Modify) { 'M' } else { 'RX' }
            $Aces += '*' + $Grant.Key + ":(OI)(CI)$CodigoDireito"
        }
        Invoke-IcaclsPlanejado -Argumentos (@($Alvo, '/grant:r') + $Aces) -Descricao "grant allow-list em $Alvo"
        Invoke-IcaclsPlanejado -Argumentos @($Alvo, '/inheritance:r') -Descricao "remover herança em $Alvo"
        $SidsParaRemover = @('*S-1-5-11', '*S-1-5-32-545', '*S-1-1-0')
        if ($Alvo -in $Protegidos -or $Alvo -in $Criaveis) {
            if ($RallyDevExiste) { $SidsParaRemover += '*' + $SidRallyDev.Value }
        }
        Invoke-IcaclsPlanejado -Argumentos (@($Alvo, '/remove:g') + $SidsParaRemover) -Descricao "remover grupos amplos de $Alvo"
        Invoke-IcaclsPlanejado -Argumentos @($Alvo, '/setowner', ('*' + $SidAdministradores.Value), '/t', '/c') -Descricao "definir dono em $Alvo"
        if (-not (Testar-ArvoreAcl -Alvo $Alvo -DireitosEsperados $DireitosPorAlvo[$Alvo])) {
            throw "Verificação após aplicação reprovou $Alvo; interrompendo sequência."
        }
    }
} catch {
    Write-Error "Aplicação interrompida. Pare e reverta os alvos alterados com 99-reverter.ps1 -Identificador $Stamp -Aplicar. Atenção: reverter decoys/canary devolve o estado aberto anterior à aplicação. Detalhe: $($_.Exception.Message)"
    throw
}

Write-Output "Backups individuais em $BackupDir. Identificador para reversão: $Stamp"
