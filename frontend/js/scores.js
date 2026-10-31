'use strict';
let scoreSequence = 0, scoreDraft = null, scoreFieldId = 0;

function clearScorePage() {
    scoreSequence++;
    scoreDraft = null;
    byId('score-content').replaceChildren();
    byId('score-content').removeAttribute('aria-busy');
    message('score-error');
    byId('score-edition').disabled = false;
    byId('score-edition').replaceChildren(new Option('Selecione uma edição', ''));
}

function scoreError(error) {
    message('score-error', error.message, true);
    if (state.page === 'scores' && state.session) byId('score-error').focus();
}

async function loadScorePage() {
    const epoch = state.epoch, seq = ++scoreSequence;
    scoreDraft = null;
    message('score-error');
    const select = byId('score-edition');
    select.disabled = true;
    select.replaceChildren(new Option('Carregando edições…', ''));
    loading('score-content', 'Buscando as edições do Rally…');
    try {
        const rows = await request('/api/rallies');
        if (epoch !== state.epoch || seq !== scoreSequence) return;
        select.replaceChildren(new Option('Selecione uma edição', ''));
        for (const r of rows) select.add(new Option(r.nome + (r.legado ? ' · Histórica' : ''), r.id));
        byId('score-content').replaceChildren(emptyState(rows.length ? 'Uma classificação para cada edição' : 'Ainda não há edições', rows.length ? 'Selecione um Rally para consultar os pontos e seu histórico.' : 'Crie uma edição em Rallys para começar a organizar a competição.'));
    } catch (error) {
        if (epoch === state.epoch && seq === scoreSequence) {
            select.replaceChildren(new Option('Não foi possível carregar', ''));
            byId('score-content').replaceChildren(emptyState('Não foi possível buscar as edições', 'Use Atualizar ranking para tentar novamente.'));
            scoreError(error);
        }
    } finally {
        if (epoch === state.epoch && seq === scoreSequence) {
            select.disabled = false;
            byId('score-content').removeAttribute('aria-busy');
        }
    }
}

function scoreInput(label, type = 'text') {
    const wrap = element('div', 'field'), input = document.createElement('input'), caption = element('label', '', label);
    input.type = type;
    input.id = 'score-field-' + ++scoreFieldId;
    caption.htmlFor = input.id;
    input.required = true;
    wrap.append(caption, input);
    return { wrap, input };
}

async function refreshScores() {
    const id = byId('score-edition').value, epoch = state.epoch, seq = ++scoreSequence;
    scoreDraft = null;
    message('score-error');
    if (!id) {
        byId('score-content').replaceChildren(emptyState('Uma classificação para cada edição', 'Selecione um Rally para consultar os pontos e seu histórico.'));
        byId('score-content').removeAttribute('aria-busy');
        return;
    }
    loading('score-content', 'Atualizando classificação e histórico…');
    try {
        const data = await request('/api/pontuacoes/' + id);
        if (epoch !== state.epoch || seq !== scoreSequence) return;
        byId('score-content').replaceChildren();
        renderScores(data, id, epoch, seq);
    } catch (error) {
        if (epoch === state.epoch && seq === scoreSequence) {
            byId('score-content').replaceChildren(emptyState('Classificação indisponível', 'Use Atualizar ranking para tentar novamente.'));
            scoreError(error);
        }
    } finally {
        if (epoch === state.epoch && seq === scoreSequence) byId('score-content').removeAttribute('aria-busy');
    }
}

function renderScores(data, id, epoch, seq) {
    const target = byId('score-content'), ranking = element('section', 'surface ranking-surface');
    ranking.append(element('p', 'section-kicker', data.rally.nome), element('h2', '', 'Classificação'));
    const rows = element('ol', 'ranking-list');
    for (const t of data.ranking) {
        const row = element('li', 'ranking-row');
        if (t.posicao === 1) row.classList.add('ranking-leader');
        row.append(element('span', 'ranking-position', t.posicao + 'º'), element('strong', 'ranking-tribe', t.nome), element('span', 'ranking-points', t.pontuacao_total + ' pontos'));
        rows.append(row);
    }
    ranking.append(rows, element('p', 'field-help', 'Empates compartilham a mesma posição. Os pontos permanecem na tribo em que foram conquistados.'));
    target.append(ranking);
    const writable = !data.rally.legado && data.rally.status === 'ativo';
    if (writable) {
        const surface = element('section', 'surface');
        surface.append(element('p', 'section-kicker', 'Um registro, efeito imediato'), element('h2', '', 'Lançamento administrativo'), element('p', 'muted small-copy', 'Informe a tribo, os pontos e a justificativa. O valor será somado à classificação ao confirmar.'));
        const form = document.createElement('form'), tribeField = element('div', 'field'), tribeLabel = element('label', '', 'Tribo pontuada'), tribe = document.createElement('select');
        tribe.id = 'score-field-' + ++scoreFieldId;
        tribeLabel.htmlFor = tribe.id;
        for (const t of data.ranking) tribe.add(new Option(t.nome, t.id));
        tribeField.append(tribeLabel, tribe);
        const points = scoreInput('Pontos', 'number'), reason = scoreInput('Justificativa');
        points.input.min = 1; points.input.max = 1000000; points.input.step = 1;
        reason.input.maxLength = 500;
        const button = element('button', 'button primary', 'Lançar pontos');
        button.type = 'submit';
        form.append(tribeField, points.wrap, reason.wrap, button);
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const payload = { tribo_id: Number(tribe.value), pontos: Number(points.input.value), justificativa: reason.input.value };
            const signature = JSON.stringify(payload);
            if (scoreDraft?.signature !== signature) scoreDraft = { signature, key: crypto.randomUUID() };
            button.disabled = true;
            try {
                await request('/api/pontuacoes/' + id, { method: 'POST', body: { ...payload, request_key: scoreDraft.key } });
                if (epoch === state.epoch && seq === scoreSequence) { await refreshScores(); toast('Pontos registrados na classificação.'); }
            } catch (error) { if (epoch === state.epoch && seq === scoreSequence) scoreError(error); }
            finally { button.disabled = false; }
        });
        surface.append(form); target.append(surface);
    } else target.append(element('p', 'notice', 'Edição somente para consulta. Lançamentos exigem Rally ativo.'));

    const history = element('section', 'score-history');
    history.append(element('h2', '', 'Histórico de lançamentos'));
    if (!data.lancamentos.length) history.append(emptyState('Os pontos começam aqui', 'A edição ainda não tem lançamentos. Missões aprovadas e provas concluídas também aparecerão neste histórico.'));
    const origins = { manual: 'Lançamento administrativo', missao: 'Missão aprovada', quiz: 'Quiz', prova: 'Prova' };
    for (const p of data.lancamentos) {
        const row = element('article', 'surface score-entry');
        row.append(element('p', 'section-kicker', origins[p.tipo_origem] || 'Pontuação'), element('h3', '', `${p.tribo_nome}: ${p.pontos} pontos`), element('p', '', p.descricao), element('p', 'field-help', `${p.data_registro} · ${p.responsavel || 'Responsável não disponível'}`));
        if (p.corrige_id) row.append(element('p', 'field-help', 'Correção vinculada ao lançamento #' + p.corrige_id));
        if (p.compensa_id) row.append(element('p', 'field-help', 'Compensação do lançamento #' + p.compensa_id));
        if (p.compensado) row.append(element('p', 'field-help', 'Lançamento compensado; original preservado.'));
        if (writable && !p.compensado && !p.compensa_id && p.pontos > 0 && p.tipo_origem === 'manual') {
            const details = document.createElement('details');
            details.append(element('summary', '', 'Corrigir lançamento'));
            const form = document.createElement('form'), points = scoreInput('Pontuação correta (zero para estornar)', 'number'), reason = scoreInput('Motivo da correção');
            points.input.min = 0; points.input.max = 1000000; points.input.step = 1; reason.input.maxLength = 500;
            const button = element('button', 'button secondary', 'Registrar correção');
            button.type = 'submit';
            let draft;
            form.append(points.wrap, reason.wrap, button);
            form.addEventListener('submit', async e => {
                e.preventDefault();
                const payload = { pontos: Number(points.input.value), justificativa: reason.input.value }, signature = JSON.stringify(payload);
                if (draft?.signature !== signature) draft = { signature, key: crypto.randomUUID() };
                button.disabled = true;
                try {
                    await request(`/api/pontuacoes/${id}/${p.id}/corrigir`, { method: 'POST', body: { ...payload, request_key: draft.key } });
                    if (epoch === state.epoch && seq === scoreSequence) { await refreshScores(); toast('Correção registrada. O histórico foi preservado.'); }
                } catch (error) { if (epoch === state.epoch && seq === scoreSequence) scoreError(error); }
                finally { button.disabled = false; }
            });
            details.append(form); row.append(details);
        }
        history.append(row);
    }
    target.append(history);
}
byId('nav-scores').addEventListener('click', () => setPage('scores', true));
byId('score-edition').addEventListener('change', refreshScores);
byId('refresh-scores').addEventListener('click', () => byId('score-edition').value ? refreshScores() : loadScorePage());
