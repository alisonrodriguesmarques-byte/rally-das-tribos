# Proposta: cria ou verifica RallyDev como usuário padrão, sem privilégios especiais.
# Não configura logon automático nem grava/exibe senha. Não altera conta preexistente.
# A VERIFICAR: New-LocalUser pode já incluir Usuários; perfil requer primeiro uso.
[CmdletBinding()]
param([switch]$Aplicar)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SidAdministradores = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$SidUsuarios = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')
$Nome = 'RallyDev'

function Test-SecureStringEqual {
    param(
        [Parameter(Mandatory)][System.Security.SecureString]$Primeira,
        [Parameter(Mandatory)][System.Security.SecureString]$Segunda
    )
    $PtrPrimeira = [IntPtr]::Zero
    $PtrSegunda = [IntPtr]::Zero
    try {
        $PtrPrimeira = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Primeira)
        $PtrSegunda = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Segunda)
        $BytesPrimeira = [Runtime.InteropServices.Marshal]::ReadInt32($PtrPrimeira, -4)
        $BytesSegunda = [Runtime.InteropServices.Marshal]::ReadInt32($PtrSegunda, -4)
        if ($BytesPrimeira -ne $BytesSegunda) { return $false }
        for ($Indice = 0; $Indice -lt ($BytesPrimeira / 2); $Indice++) {
            $Offset = $Indice * 2
            if ([Runtime.InteropServices.Marshal]::ReadInt16($PtrPrimeira, $Offset) -ne
                [Runtime.InteropServices.Marshal]::ReadInt16($PtrSegunda, $Offset)) {
                return $false
            }
        }
        return $true
    } finally {
        if ($PtrPrimeira -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PtrPrimeira) }
        if ($PtrSegunda -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PtrSegunda) }
    }
}

function Get-MembrosGrupoPorSid {
    param([Parameter(Mandatory)][Security.Principal.SecurityIdentifier]$SidGrupo)
    try {
        $Membros = @(Get-LocalGroupMember -SID $SidGrupo -ErrorAction Stop)
        return [pscustomobject]@{ Verificado = $true; Membros = $Membros; Erro = $null }
    } catch {
        return [pscustomobject]@{ Verificado = $false; Membros = @(); Erro = $_.Exception.GetType().FullName }
    }
}

$Identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identidade)
if ($Aplicar -and -not $Principal.IsInRole($SidAdministradores)) {
    throw 'A criação exige PowerShell elevado.'
}
if (-not (Get-Command Get-LocalUser -ErrorAction SilentlyContinue)) {
    throw 'Os cmdlets de contas locais não estão disponíveis.'
}

$Conta = Get-LocalUser -ErrorAction Stop |
    Where-Object { $_.Name -eq $Nome } |
    Select-Object -First 1
$ContaCriadaNestaExecucao = $false
if ($null -ne $Conta) {
    Write-Output 'RallyDev já existe; será somente verificada, sem alterações.'
} elseif (-not $Aplicar) {
    Write-Output 'SIMULAÇÃO: criaria RallyDev como usuário padrão e adicionaria ao grupo S-1-5-32-545.'
    Write-Output 'Nenhuma senha foi solicitada ou criada.'
    return
} else {
    $SenhaUm = $null
    $SenhaDois = $null
    try {
        $SenhaUm = Read-Host 'Digite a senha para RallyDev' -AsSecureString
        $SenhaDois = Read-Host 'Confirme a senha para RallyDev' -AsSecureString
        if ($SenhaUm.Length -lt 1) { throw 'Senha vazia não permitida.' }
        if (-not (Test-SecureStringEqual -Primeira $SenhaUm -Segunda $SenhaDois)) {
            throw 'As senhas informadas não coincidem.'
        }
        $Conta = New-LocalUser -Name $Nome -Password $SenhaUm -Description 'Conta padrão de desenvolvimento do Rally das Tribos' -ErrorAction Stop
        $ContaCriadaNestaExecucao = $true
    } finally {
        if ($null -ne $SenhaUm) { $SenhaUm.Dispose() }
        if ($null -ne $SenhaDois) { $SenhaDois.Dispose() }
        Remove-Variable SenhaUm, SenhaDois -ErrorAction SilentlyContinue
    }
}

$Conta = Get-LocalUser -Name $Nome -ErrorAction Stop
$ContaSid = $Conta.SID
if ($ContaCriadaNestaExecucao) {
    # Add-LocalGroupMember é chamado explicitamente; se já for membro porque
    # New-LocalUser o incluiu, confirma a associação sem alterar outros grupos.
    try {
        Add-LocalGroupMember -SID $SidUsuarios -Member $Conta -ErrorAction Stop
    } catch {
        $MembrosUsuarios = Get-MembrosGrupoPorSid -SidGrupo $SidUsuarios
        if (-not $MembrosUsuarios.Verificado -or
            -not (@($MembrosUsuarios.Membros | Where-Object { $_.SID -and $_.SID.Value -eq $ContaSid.Value }).Count -gt 0)) {
            throw "Conta criada, mas inclusão em Usuários não foi confirmada. Erro: $($_.Exception.GetType().FullName). Revise manualmente; não remova a conta automaticamente."
        }
    }
}

$FalhasConsulta = @()
$MembrosAdministradores = Get-MembrosGrupoPorSid -SidGrupo $SidAdministradores
if (-not $MembrosAdministradores.Verificado) {
    $FalhasConsulta += "S-1-5-32-544 ($($MembrosAdministradores.Erro))"
} else {
    $EhAdministrador = @($MembrosAdministradores.Membros | Where-Object { $_.SID -and $_.SID.Value -eq $ContaSid.Value }).Count -gt 0
    if ($EhAdministrador) {
        throw 'RallyDev aparece no grupo S-1-5-32-544; revise manualmente. Nenhuma associação foi removida.'
    }
}

$SidsEncontrados = @()
$GruposNaoConsultados = @()
foreach ($Grupo in Get-LocalGroup -ErrorAction Stop) {
    $ResultadoGrupo = Get-MembrosGrupoPorSid -SidGrupo $Grupo.SID
    if (-not $ResultadoGrupo.Verificado) {
        $GruposNaoConsultados += "$($Grupo.SID.Value) ($($ResultadoGrupo.Erro))"
        continue
    }
    if (@($ResultadoGrupo.Membros | Where-Object { $_.SID -and $_.SID.Value -eq $ContaSid.Value }).Count -gt 0) {
        $SidsEncontrados += $Grupo.SID.Value
    }
}

if ($SidsEncontrados -notcontains $SidUsuarios.Value) {
    Write-Output 'NÃO VERIFICADO: associação direta ao grupo Usuários (S-1-5-32-545) não confirmada.'
}
if ($GruposNaoConsultados.Count -gt 0) {
    Write-Output ('NÃO VERIFICADO: não foi possível enumerar: ' + ($GruposNaoConsultados -join ', '))
}
if ($FalhasConsulta.Count -gt 0) {
    Write-Output ('NÃO VERIFICADO: consulta explícita de Administradores falhou: ' + ($FalhasConsulta -join ', '))
}
if ($Conta.Enabled) {
    Write-Output 'Conta RallyDev habilitada: SIM.'
} else {
    Write-Output 'NÃO VERIFICADO: conta RallyDev não está habilitada; conta preexistente não foi alterada.'
}
if ($GruposNaoConsultados.Count -eq 0 -and $FalhasConsulta.Count -eq 0 -and
    $SidsEncontrados -contains $SidUsuarios.Value -and
    @($SidsEncontrados | Where-Object { $_ -ne $SidUsuarios.Value }).Count -eq 0) {
    Write-Output 'Verificação de grupos: somente S-1-5-32-545; S-1-5-32-544 ausente.'
} else {
    Write-Output 'Verificação de grupos: NÃO VERIFICADO integralmente; confira os itens acima.'
}
Write-Output 'A VERIFICAR: New-LocalUser pode já adicionar Usuários; perfil só é criado após primeiro uso com perfil carregado.'
