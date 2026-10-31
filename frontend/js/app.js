'use strict';

// Authentication state and CSRF token stay in memory. The opaque session cookie
// is managed by the browser and is never read or stored by this application.
const state = { session: null, epoch: 0, pendingRequests: new Set(), signingOut: false, page: 'dashboard', catalog: null, currentRally: null, rallyListSeq: 0, rallyDetailSeq: 0, teamSeq: 0, teamSearchSeq: 0, teamRallyId: null, teamData: null, teamPerson: null, teamAction: null, personEditing: null };
const byId = id => document.getElementById(id);
const roles = { admin: 'Administrador', lider: 'Cabeça da tribo', auxiliar: 'Auxiliar', participante: 'Participante' };
const approvalLabels = { pendente: 'Pendente', aprovado: 'Aprovada', rejeitado: 'Rejeitada' };
const rallyLabels = { planejamento: 'Planejamento', ativo: 'Ativo', encerrado: 'Encerrado', arquivado: 'Arquivado', cancelado: 'Cancelado' };
const rallyClasses = { planejamento: 'planning', ativo: 'active', encerrado: 'closed', arquivado: 'archived', cancelado: 'cancelled' };
let toastTimer;

class ApiError extends Error {
    constructor(message, status = 0) { super(message); this.status = status; }
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function message(id, text = '', error = false) {
    const target = byId(id);
    target.textContent = text;
    target.hidden = !text;
    target.classList.toggle('error', error);
}

function toast(text) {
    clearTimeout(toastTimer);
    const target = byId('app-message');
    target.textContent = text;
    target.hidden = false;
    toastTimer = setTimeout(() => { target.hidden = true; target.textContent = ''; }, 6500);
}

function resetSession(messageText = '') {
    clearScorePage();
    clearActivities();
    state.epoch++;
    state.session = null;
    for (const controller of state.pendingRequests) controller.abort();
    state.pendingRequests.clear();
    byId('workspace-view').hidden = true;
    byId('loading-view').hidden = true;
    byId('login-view').hidden = false;
    byId('login-form').reset();
    byId('create-user-form').reset();
    clearRallyWorkspace();
    clearTeamWorkspace();
    if (byId('decision-dialog').open) byId('decision-dialog').close('cancel');
    byId('decision-description').textContent = '';
    byId('decision-reason').value = '';
    byId('rallies-list').replaceChildren();
    byId('users-list').replaceChildren();
    byId('session-name').textContent = '';
    byId('session-role').textContent = '';
    for (const id of ['stat-rallies', 'stat-active', 'stat-pending', 'accounts-total']) byId(id).textContent = '—';
    byId('pending-nav-count').hidden = true;
    for (const id of ['dashboard-error', 'users-error', 'create-user-feedback']) message(id);
    message('login-error', messageText, Boolean(messageText));
    clearTimeout(toastTimer);
    byId('app-message').hidden = true;
    byId('app-message').textContent = '';
    document.title = 'Entrar · Rally das Tribos';
}

async function request(path, options = {}) {
    const { method = 'GET', body, publicRequest = false, epoch = state.epoch } = options;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && !publicRequest) {
        if (!state.session?.csrfToken) throw new ApiError('Entre novamente para continuar.', 401);
        headers['X-CSRF-Token'] = state.session.csrfToken;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    state.pendingRequests.add(controller);
    try {
        const response = await fetch(path, {
            method, headers, credentials: 'same-origin', cache: 'no-store',
            body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal
        });
        let result;
        try { result = await response.json(); }
        catch { throw new ApiError('Não foi possível interpretar a resposta. Tente novamente.', response.status); }
        if (!response.ok || result.success !== true) {
            if (response.status === 401 && !publicRequest && epoch === state.epoch) {
                resetSession('Sua sessão terminou. Entre novamente para continuar.');
                byId('login-email').focus();
            }
            const detail = typeof result.error === 'string' ? result.error.slice(0, 240) : 'Não foi possível concluir esta operação.';
            throw new ApiError(response.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : detail, response.status);
        }
        return result.data;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
        clearTimeout(timer);
        state.pendingRequests.delete(controller);
    }
}

function emptyState(title, description) {
    const node = element('div', 'empty-state');
    node.append(element('strong', '', title), element('p', '', description));
    return node;
}

function loading(targetId, text) {
    const target = byId(targetId);
    target.setAttribute('aria-busy', 'true');
    target.replaceChildren(element('p', 'empty-state', text));
}

function setPage(page, focus = false, selectedId) {
    if (!state.session) return;
    if (!['dashboard','missions','exams'].includes(page) && state.session.user.tipo_usuario !== 'admin') return;
    if (state.page !== page) {
        if (state.page === 'scores') scoreSequence++;
        if (['missions', 'exams'].includes(state.page)) { activities.seq++; activities.attempt = null; }
    }
    state.page = page;
    for (const name of ['dashboard', 'users', 'rallies', 'teams', 'scores', 'missions', 'exams']) {
        const active = page === name;
        byId(name + '-panel').hidden = !active;
        byId('nav-' + name).classList.toggle('active', active);
        if (active) byId('nav-' + name).setAttribute('aria-current', 'page');
        else byId('nav-' + name).removeAttribute('aria-current');
    }
    const titles = { missions: ['Missões','missions-title'], exams: ['Provas','exams-title'], scores: ['Pontos e ranking', 'scores-title'], dashboard: ['Painel', 'dashboard-title'], users: ['Contas e acessos', 'users-title'], rallies: ['Rallys e tribos', 'rallies-management-title'], teams: ['Gestão de equipes', 'teams-title'] };
    document.title = titles[page][0] + ' · Rally das Tribos';
    if (focus) byId(titles[page][1]).focus();
    if (page === 'users') loadUsers();
    if (page === 'rallies') loadRallyManagement(selectedId);
    if (page === 'teams') loadTeamRallies(selectedId);
    if (page === 'scores') loadScorePage();
    if (page === 'missions' || page === 'exams') loadActivities(page);
}

function acceptSession(data) {
    if (!data?.user || typeof data.csrfToken !== 'string') throw new ApiError('Não foi possível confirmar seu acesso. Entre novamente.');
    state.epoch++;
    state.session = data;
    byId('login-form').reset();
    byId('loading-view').hidden = true;
    byId('login-view').hidden = true;
    byId('workspace-view').hidden = false;
    byId('session-name').textContent = data.user.nome_completo;
    byId('session-role').textContent = roles[data.user.tipo_usuario] || 'Usuário';
    const admin = data.user.tipo_usuario === 'admin';
    byId('nav-users').hidden = !admin;
    byId('nav-rallies').hidden = !admin;
    byId('nav-teams').hidden = !admin;
    byId('nav-scores').hidden = !admin;
    byId('nav-missions').hidden = false;
    byId('nav-exams').hidden = false;
    if (!admin) {
        clearScorePage();
        clearActivities();
        clearRallyWorkspace();
        clearTeamWorkspace();
        byId('rallies-list').replaceChildren();
        byId('users-list').replaceChildren();
    }
    byId('admin-dashboard').hidden = !admin;
    byId('restricted-profile').hidden = admin;
    byId('refresh-dashboard').hidden = !admin;
    byId('dashboard-description').textContent = admin
        ? 'Acompanhe as edições e os acessos da organização.'
        : 'Você está conectado com segurança à sua conta.';
    setPage('dashboard');
    byId('dashboard-title').focus();
    if (admin) loadDashboard();
}

function displayRallies(rallies) {
    const target = byId('rallies-list');
    target.replaceChildren();
    if (!rallies.length) {
        target.append(emptyState('Uma nova jornada está por vir', 'Ainda não há edições cadastradas.'));
        return;
    }
    for (const rally of rallies) {
        const row = element('article', 'rally-item');
        const info = element('div');
        info.append(element('h3', '', rally.nome));
        const formatDate = value => {
            const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
            return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR');
        };
        info.append(element('p', '', formatDate(rally.data_inicio) + ' — ' + formatDate(rally.data_fim)));
        const controls = element('div', 'rally-badges');
        controls.append(statusBadge(rally));
        if (Number(rally.legado)) controls.append(element('span', 'tag neutral', 'Edição histórica'));
        controls.append(actionButton('Ver edição', 'secondary', () => setPage('rallies', true, rally.id)));
        row.append(info, controls);
        target.append(row);
    }
}

function statusBadge(rally) {
    return element('span', 'tag ' + (rallyClasses[rally.status] || 'neutral'), rallyLabels[rally.status] || 'Status não informado');
}

function dateLabel(value) {
    const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR');
}

function clearRallyWorkspace() {
    state.catalog = null;
    state.currentRally = null;
    state.rallyListSeq++;
    state.rallyDetailSeq++;
    byId('create-rally-form').reset();
    byId('rally-end-date').removeAttribute('min');
    byId('create-rally-card').hidden = true;
    byId('new-rally-button').setAttribute('aria-expanded', 'false');
    byId('rally-editions-list').replaceChildren();
    byId('rally-detail').replaceChildren();
    byId('rally-detail').hidden = true;
    byId('rally-detail-empty').hidden = false;
    if (byId('rally-action-dialog').open) byId('rally-action-dialog').close('cancel');
    byId('rally-action-description').textContent = '';
    for (const id of ['rally-tribe-a', 'rally-tribe-b']) {
        const select = byId(id);
        select.replaceChildren(element('option', '', 'Escolha uma tribo'));
        select.options[0].value = '';
        select.disabled = true;
        select.setCustomValidity('');
    }
    byId('create-rally-submit').disabled = true;
    for (const id of ['create-rally-feedback', 'rallies-management-error', 'rally-detail-error']) message(id);
}

function populateTribeSelect(select, selected = '') {
    select.replaceChildren();
    const placeholder = element('option', '', 'Escolha uma tribo');
    placeholder.value = '';
    select.append(placeholder);
    for (const tribe of state.catalog || []) {
        const option = element('option', '', tribe.nome);
        option.value = String(tribe.id);
        select.append(option);
    }
    select.value = String(selected ?? '');
    select.disabled = !state.catalog?.length;
}

function distinctTribes(first, second) {
    second.setCustomValidity(first.value && first.value === second.value ? 'Escolha duas tribos diferentes.' : '');
    for (const option of first.options) option.disabled = Boolean(option.value && option.value === second.value && option.value !== first.value);
    for (const option of second.options) option.disabled = Boolean(option.value && option.value === first.value && option.value !== second.value);
    return Boolean(first.value && second.value && first.value !== second.value);
}

function selectionValues(first, second) {
    if (!distinctTribes(first, second)) {
        second.reportValidity();
        throw new ApiError('Selecione duas tribos oficiais distintas.');
    }
    return [Number(first.value), Number(second.value)];
}

function showCreateRally(show) {
    byId('create-rally-card').hidden = !show;
    byId('new-rally-button').setAttribute('aria-expanded', String(show));
    if (show) {
        message('create-rally-feedback');
        byId('rally-name').focus();
    }
}

function displayRallyEditions(rallies) {
    const list = byId('rally-editions-list');
    list.replaceChildren();
    if (!rallies.length) {
        list.append(emptyState('Nenhuma edição cadastrada', 'Crie um Rally e escolha suas duas tribos.'));
        return;
    }
    for (const rally of rallies) {
        const card = element('article', 'rally-edition');
        card.dataset.rallyId = String(rally.id);
        card.classList.toggle('selected', rally.id === state.currentRally?.id);
        const badges = element('div', 'rally-badges');
        badges.append(statusBadge(rally));
        if (Number(rally.legado)) badges.append(element('span', 'tag neutral', 'Edição histórica'));
        card.append(element('h3', '', rally.nome), element('p', '', dateLabel(rally.data_inicio) + ' — ' + dateLabel(rally.data_fim)), badges,
            actionButton('Consultar edição', 'secondary', () => openRallyDetail(rally.id, true)));
        list.append(card);
    }
}

async function loadRallyManagement(selectId = state.currentRally?.id) {
    if (state.session?.user.tipo_usuario !== 'admin') return;
    const epoch = state.epoch;
    const sequence = ++state.rallyListSeq;
    const button = byId('refresh-rallies');
    button.disabled = true;
    message('rallies-management-error');
    loading('rally-editions-list', 'Carregando as edições…');
    try {
        const [rallies, catalog] = await Promise.all([request('/api/rallies', { epoch }), request('/api/tribos/catalogo', { epoch })]);
        if (epoch !== state.epoch || sequence !== state.rallyListSeq) return;
        if (!Array.isArray(catalog) || catalog.length !== 12) throw new ApiError('Não foi possível carregar o catálogo oficial completo.');
        state.catalog = catalog;
        const first = byId('rally-tribe-a');
        const second = byId('rally-tribe-b');
        const selected = [first.value, second.value];
        populateTribeSelect(first, selected[0]);
        populateTribeSelect(second, selected[1]);
        distinctTribes(first, second);
        byId('create-rally-submit').disabled = false;
        displayRallyEditions(rallies);
        if (selectId) await openRallyDetail(selectId);
    } catch (error) {
        if (epoch !== state.epoch || sequence !== state.rallyListSeq) return;
        byId('rally-editions-list').replaceChildren();
        message('rallies-management-error', error.message, true);
    } finally {
        if (epoch === state.epoch && sequence === state.rallyListSeq) {
            button.disabled = false;
            byId('rally-editions-list').removeAttribute('aria-busy');
        }
    }
}

async function openRallyDetail(id, focus = false) {
    if (state.session?.user.tipo_usuario !== 'admin') return;
    const epoch = state.epoch;
    const sequence = ++state.rallyDetailSeq;
    message('rally-detail-error');
    byId('rally-detail-empty').hidden = true;
    byId('rally-detail').hidden = false;
    loading('rally-detail', 'Carregando a edição…');
    try {
        const rally = await request('/api/rallies/' + encodeURIComponent(id), { epoch });
        if (epoch !== state.epoch || sequence !== state.rallyDetailSeq) return;
        state.currentRally = rally;
        displayRallyDetail(rally);
        for (const card of byId('rally-editions-list').children) card.classList.toggle('selected', card.dataset.rallyId === String(rally.id));
        if (focus) {
            byId('rally-detail-title').focus();
            byId('rally-detail').scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
    } catch (error) {
        if (epoch !== state.epoch || sequence !== state.rallyDetailSeq) return;
        state.currentRally = null;
        byId('rally-detail').replaceChildren();
        message('rally-detail-error', error.message, true);
    } finally {
        if (epoch === state.epoch && sequence === state.rallyDetailSeq) byId('rally-detail').removeAttribute('aria-busy');
    }
}

function displayRallyDetail(rally) {
    const detail = byId('rally-detail');
    detail.replaceChildren();
    const header = element('div', 'rally-detail-header');
    const badges = element('div', 'rally-badges');
    badges.append(statusBadge(rally));
    if (Number(rally.legado)) badges.append(element('span', 'tag neutral', 'Edição histórica'));
    const title = element('h2', '', rally.nome);
    title.id = 'rally-detail-title';
    title.tabIndex = -1;
    header.append(badges, title, element('p', 'rally-detail-dates', dateLabel(rally.data_inicio) + ' — ' + dateLabel(rally.data_fim)));
    detail.append(header);
    if (rally.descricao) detail.append(element('p', 'rally-description', rally.descricao));
    const tribes = element('div', 'rally-tribes');
    for (const tribe of rally.tribos || []) {
        const card = element('article', 'rally-tribe');
        card.append(element('h3', '', tribe.nome));
        if (Number.isFinite(tribe.pontuacao_total)) card.append(element('p', '', tribe.pontuacao_total.toLocaleString('pt-BR') + ' pontos'));
        tribes.append(card);
    }
    detail.append(element('h3', '', Number(rally.legado) ? 'Tribos desta edição histórica' : 'As duas tribos desta edição'), tribes);
    detail.append(actionButton(Number(rally.legado) ? 'Consultar integrantes' : 'Gerenciar integrantes', 'secondary', () => setPage('teams', true, rally.id)));
    if (Number(rally.legado)) {
        detail.append(element('p', 'rally-detail-note', 'Edição histórica preservada para consulta. Suas tribos e registros anteriores não serão convertidos para a regra das novas edições.'));
        return;
    }
    detail.append(element('p', 'rally-detail-note', ['planejamento', 'ativo'].includes(rally.status)
        ? 'Após o início, as tribos escolhidas permanecem. Os integrantes poderão mudar com histórico.'
        : 'Esta edição está preservada para consulta. Alterações de integrantes são feitas durante o planejamento ou com o Rally ativo, mantendo o histórico.'));
    if (rally.status === 'planejamento') {
        const form = element('form', 'rally-selection-form');
        form.id = 'edit-rally-tribes-form';
        form.append(element('h3', '', 'Revisar a escolha das tribos'));
        form.append(element('p', 'field-help', 'Disponível durante o planejamento. Trocas que afetem vínculos ou registros existentes serão recusadas para preservar o histórico.'));
        const fields = element('div', 'form-grid');
        for (const [index, label] of ['Primeira tribo da edição', 'Segunda tribo da edição'].entries()) {
            const field = element('div', 'field');
            const id = 'edit-rally-tribe-' + (index === 0 ? 'a' : 'b');
            const select = element('select');
            select.id = id;
            select.required = true;
            const caption = element('label', '', label);
            caption.htmlFor = id;
            populateTribeSelect(select, rally.tribos?.[index]?.catalogo_id);
            field.append(caption, select);
            fields.append(field);
        }
        const first = fields.querySelector('#edit-rally-tribe-a');
        const second = fields.querySelector('#edit-rally-tribe-b');
        first.addEventListener('change', () => distinctTribes(first, second));
        second.addEventListener('change', () => distinctTribes(first, second));
        distinctTribes(first, second);
        const feedback = element('p', 'form-message');
        feedback.id = 'edit-rally-tribes-feedback';
        feedback.hidden = true;
        feedback.setAttribute('role', 'status');
        const actions = element('div', 'form-actions');
        const submit = element('button', 'button secondary', 'Salvar escolha das tribos');
        submit.type = 'submit';
        actions.append(submit);
        form.append(fields, feedback, actions);
        form.addEventListener('submit', event => saveRallySelection(event, rally.id, first, second, submit));
        detail.append(form);
    }
    const transitions = {
        planejamento: [['start', 'Iniciar Rally', 'primary'], ['cancelar', 'Cancelar edição', 'danger']],
        ativo: [['encerrar', 'Encerrar Rally', 'secondary']],
        encerrado: [['arquivar', 'Arquivar edição', 'secondary']]
    };
    if (transitions[rally.status]) {
        const actions = element('div', 'rally-actions');
        for (const [route, label, style] of transitions[rally.status]) actions.append(actionButton(label, style, () => transitionRally(rally, route, label)));
        detail.append(actions);
    }
}

async function saveRallySelection(event, id, first, second, button) {
    event.preventDefault();
    const epoch = state.epoch;
    const sequence = state.rallyDetailSeq;
    message('edit-rally-tribes-feedback');
    button.disabled = true;
    try {
        const tribos_ids = selectionValues(first, second);
        await request('/api/rallies/' + encodeURIComponent(id) + '/tribos', { method: 'PUT', body: { tribos_ids }, epoch });
        if (epoch !== state.epoch || sequence !== state.rallyDetailSeq) return;
        toast('Escolha das duas tribos atualizada.');
        await loadRallyManagement(id);
    } catch (error) {
        if (epoch === state.epoch && sequence === state.rallyDetailSeq) message('edit-rally-tribes-feedback', error.message, true);
    } finally { button.disabled = false; }
}

function confirmRallyAction(rally, route, label) {
    const descriptions = {
        start: 'Ao iniciar, a escolha das duas tribos será mantida nesta edição. Os integrantes poderão mudar com histórico.',
        encerrar: 'A competição será encerrada. Confira os resultados antes de continuar.',
        arquivar: 'A edição encerrada ficará disponível no histórico para consulta.',
        cancelar: 'Esta edição em planejamento será cancelada.'
    };
    const dialog = byId('rally-action-dialog');
    if (dialog.open) return Promise.resolve(false);
    byId('rally-action-title').textContent = label;
    byId('rally-action-description').textContent = rally.nome + '. ' + descriptions[route];
    byId('rally-action-confirm').textContent = label;
    dialog.returnValue = 'cancel';
    dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}

async function transitionRally(rally, route, label) {
    const epoch = state.epoch;
    const sequence = state.rallyDetailSeq;
    if (!await confirmRallyAction(rally, route, label) || epoch !== state.epoch || sequence !== state.rallyDetailSeq) return;
    for (const button of byId('rally-detail').querySelectorAll('button')) button.disabled = true;
    message('rally-detail-error');
    try {
        await request('/api/rallies/' + encodeURIComponent(rally.id) + '/' + route, { method: 'PATCH', body: {}, epoch });
        if (epoch !== state.epoch || sequence !== state.rallyDetailSeq) return;
        toast('Edição atualizada com sucesso.');
        await loadRallyManagement(rally.id);
    } catch (error) {
        if (epoch === state.epoch && sequence === state.rallyDetailSeq) message('rally-detail-error', error.message, true);
    } finally {
        if (epoch === state.epoch) for (const button of byId('rally-detail').querySelectorAll('button')) button.disabled = false;
    }
}

function updatePending(users) {
    const pending = users.filter(user => user.aprovacao === 'pendente').length;
    byId('stat-pending').textContent = String(pending);
    byId('pending-nav-count').textContent = String(pending);
    byId('pending-nav-count').hidden = pending === 0;
}

async function loadDashboard() {
    if (state.session?.user.tipo_usuario !== 'admin') return;
    const epoch = state.epoch;
    const button = byId('refresh-dashboard');
    button.disabled = true;
    message('dashboard-error');
    loading('rallies-list', 'Carregando as edições…');
    try {
        const [rallies, users] = await Promise.all([request('/api/rallies', { epoch }), request('/api/admin/users', { epoch })]);
        if (epoch !== state.epoch) return;
        byId('stat-rallies').textContent = String(rallies.length);
        byId('stat-active').textContent = String(rallies.filter(rally => rally.status === 'ativo').length);
        updatePending(users);
        displayRallies(rallies);
    } catch (error) {
        if (epoch !== state.epoch) return;
        byId('rallies-list').replaceChildren();
        for (const id of ['stat-rallies', 'stat-active', 'stat-pending']) byId(id).textContent = '—';
        message('dashboard-error', error.message, true);
    } finally {
        if (epoch === state.epoch) byId('rallies-list').removeAttribute('aria-busy');
        button.disabled = false;
    }
}

function actionButton(label, className, action) {
    const button = element('button', 'button small ' + className, label);
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
}

function displayUsers(users) {
    const target = byId('users-list');
    target.replaceChildren();
    byId('accounts-total').textContent = users.length + (users.length === 1 ? ' conta' : ' contas');
    if (!users.length) {
        target.append(emptyState('Nenhuma conta encontrada', 'As contas da organização aparecerão aqui.'));
        return;
    }
    const ordered = [...users].sort((a, b) => Number(b.aprovacao === 'pendente') - Number(a.aprovacao === 'pendente') || String(a.nome_completo).localeCompare(String(b.nome_completo), 'pt-BR'));
    for (const user of ordered) {
        const row = element('article', 'user-item');
        const heading = element('div', 'user-heading');
        const identity = element('div');
        identity.append(element('h3', '', user.nome_completo), element('p', '', user.email));
        heading.append(identity, element('span', 'user-role', roles[user.tipo_usuario] || 'Usuário'));
        const statuses = element('div', 'user-statuses');
        const approvalClass = { pendente: 'pending', aprovado: 'approved', rejeitado: 'rejected' }[user.aprovacao] || 'neutral';
        statuses.append(element('span', 'tag ' + approvalClass, approvalLabels[user.aprovacao] || 'Não informada'));
        statuses.append(element('span', 'tag ' + (user.status === 'ativo' ? 'active' : 'inactive'), user.status === 'ativo' ? 'Ativa' : 'Inativa'));
        row.append(heading, statuses);
        const actions = element('div', 'user-actions');
        if (user.tipo_usuario !== 'admin' && user.id !== state.session.user.id) {
            if (user.aprovacao === 'pendente') {
                actions.append(actionButton('Aprovar', 'primary', () => changeAccount(user, 'approval', 'aprovado')));
                actions.append(actionButton('Rejeitar', 'danger', () => changeAccount(user, 'approval', 'rejeitado')));
            }
            if (user.aprovacao === 'aprovado') {
                const active = user.status === 'ativo';
                actions.append(actionButton(active ? 'Desativar acesso' : 'Reativar acesso', active ? 'danger' : 'secondary', () => changeAccount(user, 'status', active ? 'inativo' : 'ativo')));
            }
        } else {
            actions.append(element('p', '', user.id === state.session.user.id ? 'Sua conta administrativa' : 'Conta administrativa'));
        }
        if (actions.childNodes.length) row.append(actions);
        target.append(row);
    }
}

async function loadUsers() {
    if (state.session?.user.tipo_usuario !== 'admin') return;
    const epoch = state.epoch;
    const button = byId('refresh-users');
    button.disabled = true;
    message('users-error');
    loading('users-list', 'Carregando as contas…');
    try {
        const users = await request('/api/admin/users', { epoch });
        if (epoch !== state.epoch) return;
        updatePending(users);
        displayUsers(users);
    } catch (error) {
        if (epoch !== state.epoch) return;
        byId('users-list').replaceChildren();
        message('users-error', error.message, true);
    } finally {
        if (epoch === state.epoch) byId('users-list').removeAttribute('aria-busy');
        button.disabled = false;
    }
}

async function changeAccount(user, operation, value) {
    const verb = operation === 'approval' ? (value === 'aprovado' ? 'aprovar' : 'rejeitar') : (value === 'ativo' ? 'reativar' : 'desativar');
    const epoch = state.epoch;
    const reason = await askDecisionReason(user, verb);
    if (reason === null || epoch !== state.epoch) return;
    for (const button of byId('users-list').querySelectorAll('button')) button.disabled = true;
    message('users-error');
    try {
        await request('/api/admin/users/' + encodeURIComponent(user.id) + '/' + operation, {
            method: 'PATCH', epoch,
            body: { [operation === 'approval' ? 'aprovacao' : 'status']: value, motivo: reason.trim() }
        });
        if (epoch !== state.epoch) return;
        toast('Decisão registrada. Os acessos foram atualizados.');
        await loadUsers();
    } catch (error) {
        if (epoch !== state.epoch) return;
        message('users-error', error.message, true);
    } finally {
        if (epoch === state.epoch) for (const button of byId('users-list').querySelectorAll('button')) button.disabled = false;
    }
}

function askDecisionReason(user, verb) {
    const dialog = byId('decision-dialog');
    if (dialog.open) return Promise.resolve(null);
    const reason = byId('decision-reason');
    reason.value = '';
    reason.setCustomValidity('');
    byId('decision-description').textContent = 'Você vai ' + verb + ' o acesso de ' + user.nome_completo + '. Informe o motivo desta decisão.';
    byId('decision-confirm').textContent = verb.charAt(0).toUpperCase() + verb.slice(1) + ' acesso';
    dialog.returnValue = 'cancel';
    dialog.showModal();
    reason.focus();
    return new Promise(resolve => {
        dialog.addEventListener('close', () => {
            const approved = dialog.returnValue === 'confirm';
            const value = approved ? reason.value.trim() : null;
            reason.value = '';
            resolve(value);
        }, { once: true });
    });
}

byId('decision-form').addEventListener('submit', event => {
    event.preventDefault();
    const reason = byId('decision-reason');
    reason.setCustomValidity(reason.value.trim() ? '' : 'Informe o motivo desta decisão.');
    if (reason.reportValidity()) byId('decision-dialog').close('confirm');
});
byId('decision-reason').addEventListener('input', event => event.target.setCustomValidity(''));
byId('decision-cancel').addEventListener('click', () => byId('decision-dialog').close('cancel'));

byId('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const epoch = state.epoch;
    const button = byId('login-submit');
    button.disabled = true;
    message('login-error');
    const email = byId('login-email').value.trim();
    let password = byId('login-password').value;
    try {
        const pending = request('/api/auth/login', { method: 'POST', publicRequest: true, body: { email, password }, epoch });
        password = '';
        byId('login-password').value = '';
        const data = await pending;
        if (epoch !== state.epoch) return;
        acceptSession(data);
    } catch (error) {
        if (epoch === state.epoch) message('login-error', error.message, true);
    } finally {
        password = '';
        byId('login-password').value = '';
        button.disabled = false;
    }
});

byId('logout-button').addEventListener('click', async () => {
    const epoch = state.epoch;
    const button = byId('logout-button');
    button.disabled = true;
    state.signingOut = true;
    try {
        await request('/api/auth/logout', { method: 'POST', body: {}, epoch });
        if (epoch !== state.epoch) return;
        resetSession();
        toast('Você saiu da sua conta.');
        byId('login-email').focus();
    } catch (error) {
        if (epoch === state.epoch) toast('Não foi possível encerrar a sessão. Tente sair novamente.');
    } finally { state.signingOut = false; button.disabled = false; }
});

byId('create-user-form').addEventListener('submit', async event => {
    event.preventDefault();
    const epoch = state.epoch;
    message('create-user-feedback');
    if (byId('new-user-password').value !== byId('new-user-confirm').value) {
        message('create-user-feedback', 'As senhas precisam ser iguais.', true);
        byId('new-user-confirm').focus();
        return;
    }
    const button = byId('create-user-submit');
    button.disabled = true;
    try {
        const pending = request('/api/admin/users', {
            method: 'POST', epoch,
            body: {
                nome_completo: byId('new-user-name').value.trim(), email: byId('new-user-email').value.trim(),
                tipo_usuario: byId('new-user-role').value, password: byId('new-user-password').value
            }
        });
        byId('new-user-password').value = '';
        byId('new-user-confirm').value = '';
        await pending;
        if (epoch !== state.epoch) return;
        byId('create-user-form').reset();
        message('create-user-feedback', 'Conta criada. Revise e aprove o acesso na lista de contas.');
        await loadUsers();
    } catch (error) {
        if (epoch === state.epoch) message('create-user-feedback', error.message, true);
    } finally {
        byId('new-user-password').value = '';
        byId('new-user-confirm').value = '';
        button.disabled = false;
    }
});

byId('nav-dashboard').addEventListener('click', () => setPage('dashboard', true));
byId('nav-users').addEventListener('click', () => setPage('users', true));
byId('review-accounts').addEventListener('click', () => setPage('users', true));
byId('refresh-dashboard').addEventListener('click', loadDashboard);
byId('refresh-users').addEventListener('click', loadUsers);

byId('nav-rallies').addEventListener('click', () => setPage('rallies', true));
byId('manage-rallies').addEventListener('click', () => setPage('rallies', true));
byId('refresh-rallies').addEventListener('click', () => loadRallyManagement());
byId('new-rally-button').addEventListener('click', () => showCreateRally(byId('create-rally-card').hidden));
byId('cancel-create-rally').addEventListener('click', () => { showCreateRally(false); byId('new-rally-button').focus(); });
for (const id of ['rally-tribe-a', 'rally-tribe-b']) byId(id).addEventListener('change', () => distinctTribes(byId('rally-tribe-a'), byId('rally-tribe-b')));
byId('rally-start-date').addEventListener('change', () => { byId('rally-end-date').min = byId('rally-start-date').value; });
byId('create-rally-form').addEventListener('submit', async event => {
    event.preventDefault();
    const epoch = state.epoch;
    const button = byId('create-rally-submit');
    message('create-rally-feedback');
    button.disabled = true;
    try {
        const tribos_ids = selectionValues(byId('rally-tribe-a'), byId('rally-tribe-b'));
        if (byId('rally-end-date').value < byId('rally-start-date').value) throw new ApiError('A data de encerramento deve ser igual ou posterior à data de início.');
        const created = await request('/api/rallies', { method: 'POST', epoch, body: {
            nome: byId('rally-name').value.trim(), descricao: byId('rally-description').value.trim(),
            data_inicio: byId('rally-start-date').value, data_fim: byId('rally-end-date').value, tribos_ids
        } });
        if (epoch !== state.epoch) return;
        byId('create-rally-form').reset();
        byId('rally-end-date').removeAttribute('min');
        showCreateRally(false);
        toast('Rally criado em planejamento com duas tribos.');
        await loadRallyManagement(created.id);
        byId('rally-detail-title')?.focus();
    } catch (error) {
        if (epoch === state.epoch) message('create-rally-feedback', error.message, true);
    } finally {
        if (epoch === state.epoch) button.disabled = !state.catalog?.length;
    }
});
byId('rally-action-form').addEventListener('submit', event => { event.preventDefault(); byId('rally-action-dialog').close('confirm'); });
byId('rally-action-cancel').addEventListener('click', () => byId('rally-action-dialog').close('cancel'));

// Teams are edition-scoped; the person registry is global and reused by ID.
function todayDate() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = type => parts.find(part => part.type === type).value;
    return value('year') + '-' + value('month') + '-' + value('day');
}

function teamWritable() {
    return state.session?.user.tipo_usuario === 'admin' && state.teamData && !Number(state.teamData.rally.legado) && ['planejamento', 'ativo'].includes(state.teamData.rally.status);
}

function clearTeamSelection() {
    state.teamPerson = null;
    byId('team-assignment-card').hidden = true;
    byId('selected-person-name').textContent = '';
    byId('team-assignment-form').reset();
    byId('assignment-tribe').replaceChildren();
    message('team-assignment-feedback');
}

function closePersonForm() {
    state.personEditing = null;
    byId('person-create-card').hidden = true;
    byId('show-person-form').setAttribute('aria-expanded', 'false');
    byId('person-create-form').reset();
    byId('person-edit-reason-field').hidden = true;
    byId('person-edit-reason').required = false;
    byId('person-create-title').textContent = 'Novo cadastro de pessoa';
    byId('person-create-submit').textContent = 'Salvar pessoa';
    message('person-create-feedback');
}

function clearTeamWorkspace() {
    state.teamSeq++;
    state.teamSearchSeq++;
    state.teamRallyId = null;
    state.teamData = null;
    state.teamAction = null;
    if (byId('team-action-dialog').open) byId('team-action-dialog').close('cancel');
    byId('team-action-form').reset();
    byId('team-action-description').textContent = '';
    byId('team-action-tribe').replaceChildren();
    message('team-action-error');
    byId('team-rally-select').replaceChildren(element('option', '', 'Selecione uma edição'));
    byId('team-rally-select').firstChild.value = '';
    byId('teams-content').hidden = true;
    byId('teams-empty').hidden = false;
    byId('team-tribes').replaceChildren();
    byId('team-history').replaceChildren();
    byId('team-history-count').textContent = '';
    byId('teams-edition-note').textContent = 'Escolha uma edição para consultar ou organizar suas equipes.';
    byId('person-search-form').reset();
    byId('person-results').replaceChildren();
    message('person-search-feedback');
    message('teams-error');
    clearTeamSelection();
    closePersonForm();
}

async function loadTeamRallies(selectedId = state.teamRallyId) {
    if (state.session?.user.tipo_usuario !== 'admin') return;
    const epoch = state.epoch;
    const sequence = ++state.teamSeq;
    const select = byId('team-rally-select');
    select.disabled = true;
    byId('refresh-teams').disabled = true;
    message('teams-error');
    try {
        const editions = await request('/api/rallies', { epoch });
        if (epoch !== state.epoch || sequence !== state.teamSeq) return;
        select.replaceChildren(element('option', '', editions.length ? 'Selecione uma edição' : 'Nenhuma edição cadastrada'));
        select.firstChild.value = '';
        for (const rally of editions) {
            const option = element('option', '', rally.nome + ' · ' + (Number(rally.legado) ? 'Histórico' : rallyLabels[rally.status] || rally.status));
            option.value = String(rally.id);
            select.append(option);
        }
        const valid = editions.some(rally => rally.id === Number(selectedId));
        select.value = valid ? String(selectedId) : '';
        select.disabled = false;
        if (valid) await loadTeamEdition(Number(selectedId));
        else {
            state.teamRallyId = null;
            state.teamData = null;
            byId('teams-content').hidden = true;
            byId('teams-empty').hidden = false;
        }
    } catch (error) {
        if (epoch === state.epoch && sequence === state.teamSeq) message('teams-error', error.message, true);
    } finally {
        if (epoch === state.epoch) { select.disabled = false; byId('refresh-teams').disabled = false; }
    }
}

async function loadTeamEdition(id) {
    if (state.session?.user.tipo_usuario !== 'admin') return;
    const epoch = state.epoch;
    const sequence = ++state.teamSeq;
    state.teamRallyId = id || null;
    state.teamData = null;
    state.teamSearchSeq++;
    state.teamAction = null;
    if (byId('team-action-dialog').open) byId('team-action-dialog').close('cancel');
    clearTeamSelection();
    closePersonForm();
    byId('person-results').replaceChildren();
    byId('person-search-form').reset();
    byId('team-tribes').replaceChildren();
    byId('team-history').replaceChildren();
    byId('teams-content').hidden = true;
    byId('teams-empty').hidden = Boolean(id);
    message('teams-error');
    message('person-search-feedback');
    byId('teams-edition-note').textContent = id ? 'Carregando as equipes desta edição…' : 'Escolha uma edição para consultar ou organizar suas equipes.';
    if (!id) return;
    try {
        const data = await request('/api/equipes/' + encodeURIComponent(id), { epoch });
        if (epoch !== state.epoch || sequence !== state.teamSeq || state.teamRallyId !== id) return;
        state.teamData = data;
        byId('teams-content').hidden = false;
        byId('teams-edition-note').textContent = teamWritable()
            ? 'Entradas, saídas e transferências preservam os períodos anteriores. Cada tribo pode ter um cabeça e um auxiliar ativos.'
            : 'Edição histórica ou finalizada: equipes e vínculos preservados somente para consulta.';
        byId('team-people-tools').hidden = !teamWritable();
        renderTeamCards();
        renderTeamHistory();
    } catch (error) {
        if (epoch !== state.epoch || sequence !== state.teamSeq) return;
        byId('teams-edition-note').textContent = 'Não foi possível carregar esta edição.';
        message('teams-error', error.message, true);
    }
}

function memberName(member) {
    return member.nome_completo + (member.nome_apelido ? ' · ' + member.nome_apelido : '');
}

function renderTeamCards() {
    const target = byId('team-tribes');
    target.replaceChildren();
    for (const tribe of state.teamData.tribos) {
        const card = element('section', 'surface team-card');
        card.dataset.tribeId = String(tribe.id);
        card.setAttribute('aria-label', 'Equipe ' + tribe.nome);
        const header = element('div', 'team-tribe-heading');
        const identity = element('div');
        identity.append(element('p', 'section-kicker', 'Equipe desta edição'), element('h2', '', tribe.nome));
        const members = tribe.membros || [];
        header.append(identity, element('span', 'tag active', members.length + (members.length === 1 ? ' integrante' : ' integrantes')));
        card.append(header);
        for (const [role, title] of [['lider', 'Cabeça da tribo'], ['auxiliar', 'Auxiliar'], ['participante', 'Participantes']]) {
            const group = element('div', 'team-role-group');
            group.append(element('h3', '', title));
            const matching = members.filter(member => member.papel === role);
            if (!matching.length) group.append(element('p', 'team-empty-role', role === 'participante' ? 'Nenhum participante vinculado.' : 'Vaga não preenchida.'));
            for (const member of matching) {
                const row = element('article', 'team-member');
                row.dataset.memberId = String(member.id);
                row.append(element('strong', '', member.nome_completo));
                if (member.nome_apelido) row.append(element('p', '', member.nome_apelido));
                row.append(element('p', '', 'Entrada em ' + dateLabel(member.data_entrada)));
                if (teamWritable()) {
                    const actions = element('div', 'team-member-actions');
                    actions.append(actionButton('Transferir', 'secondary', () => openTeamAction(member, 'transferencia')),
                        actionButton('Alterar papel', 'secondary', () => openTeamAction(member, 'papel')),
                        actionButton('Registrar saída', 'danger', () => openTeamAction(member, 'saida')));
                    row.append(actions);
                }
                group.append(row);
            }
            card.append(group);
        }
        target.append(card);
    }
}

function renderTeamHistory() {
    const target = byId('team-history');
    target.replaceChildren();
    const history = state.teamData.historico || [];
    byId('team-history-count').textContent = history.length + (history.length === 1 ? ' vínculo' : ' vínculos');
    if (!history.length) {
        target.append(emptyState('A história começa com as pessoas', 'As entradas e movimentações aparecerão aqui.'));
        return;
    }
    for (const member of [...history].sort((a, b) => String(b.data_entrada).localeCompare(String(a.data_entrada)) || b.id - a.id)) {
        const row = element('article', 'team-history-item');
        const title = element('div');
        title.append(element('strong', '', memberName(member)), element('span', 'tag ' + (Number(member.ativo) ? 'active' : 'inactive'), Number(member.ativo) ? 'Ativo' : 'Encerrado'));
        row.append(title,
            element('p', '', member.tribo_nome + ' · ' + (roles[member.papel] || 'Participante')),
            element('p', '', dateLabel(member.data_entrada) + ' → ' + (member.data_saida ? dateLabel(member.data_saida) : 'Em participação')));
        target.append(row);
    }
}

function populateTeamTribes(select, { exclude = null, selected = '' } = {}) {
    select.replaceChildren(element('option', '', 'Selecione a tribo'));
    select.firstChild.value = '';
    for (const tribe of state.teamData?.tribos || []) {
        if (tribe.id === exclude) continue;
        const option = element('option', '', tribe.nome);
        option.value = String(tribe.id);
        select.append(option);
    }
    select.value = String(selected);
}

function updateTeamRoles(select, tribeId, { excludeMemberId = null, selected = select.value } = {}) {
    const tribe = state.teamData?.tribos.find(item => item.id === Number(tribeId));
    const occupied = new Set((tribe?.membros || []).filter(member => member.id !== excludeMemberId).map(member => member.papel));
    for (const option of select.options) option.disabled = option.value !== 'participante' && occupied.has(option.value);
    const chosen = [...select.options].find(option => option.value === selected);
    select.value = chosen && !chosen.disabled ? selected : '';
}

async function searchPeople() {
    if (!teamWritable()) return;
    const epoch = state.epoch;
    const sequence = ++state.teamSearchSeq;
    const rallyId = state.teamRallyId;
    const query = byId('person-search').value.trim();
    const button = byId('person-search-submit');
    button.disabled = true;
    message('person-search-feedback');
    loading('person-results', 'Buscando pessoas no cadastro…');
    try {
        const people = await request('/api/participantes?q=' + encodeURIComponent(query) + '&limit=50', { epoch });
        if (epoch !== state.epoch || sequence !== state.teamSearchSeq || rallyId !== state.teamRallyId) return;
        const target = byId('person-results');
        target.removeAttribute('aria-busy');
        target.replaceChildren();
        if (!people.length) target.append(emptyState('Nenhuma pessoa encontrada', 'Confira a busca. Se esta pessoa ainda não tiver cadastro, use Cadastrar pessoa.'));
        for (const person of people) {
            const row = element('article', 'person-result');
            row.dataset.personId = String(person.id);
            const identity = element('div');
            identity.append(element('strong', '', person.nome_completo));
            if (person.nome_apelido) identity.append(element('p', '', person.nome_apelido));
            const inEdition = state.teamData.historico.some(link => link.participante_id === person.id && Number(link.ativo));
            if (inEdition) identity.append(element('p', '', 'Já participa desta edição. Use as ações do vínculo atual.'));
            if (person.status !== 'ativo') identity.append(element('p', '', 'Cadastro inativo.'));
            const choose = actionButton('Selecionar pessoa', 'secondary small', () => selectTeamPerson(person));
            choose.disabled = inEdition || person.status !== 'ativo';
            const actions = element('div', 'person-selection-actions');
            actions.append(choose, actionButton('Corrigir cadastro', 'quiet small', () => showPersonForm(person)));
            row.append(identity, actions);
            target.append(row);
        }
        if (people.length === 50) target.append(element('p', 'field-help', 'Mostrando até 50 pessoas. Refine a busca para encontrar outros cadastros.'));
    } catch (error) {
        if (epoch === state.epoch && sequence === state.teamSearchSeq && rallyId === state.teamRallyId) {
            byId('person-results').replaceChildren();
            message('person-search-feedback', error.message, true);
        }
    } finally {
        if (epoch === state.epoch) button.disabled = false;
    }
}

function selectTeamPerson(person) {
    if (!teamWritable()) return;
    state.teamPerson = person;
    byId('selected-person-name').textContent = memberName(person);
    byId('team-assignment-card').hidden = false;
    byId('team-assignment-form').reset();
    populateTeamTribes(byId('assignment-tribe'));
    byId('assignment-date').value = todayDate();
    updateTeamRoles(byId('assignment-role'), null, { selected: 'participante' });
    message('team-assignment-feedback');
    byId('assignment-tribe').focus();
}

function showPersonForm(person = null) {
    if (!teamWritable()) return;
    closePersonForm();
    state.personEditing = person;
    byId('person-create-card').hidden = false;
    byId('show-person-form').setAttribute('aria-expanded', 'true');
    byId('person-create-title').textContent = person ? 'Corrigir cadastro global' : 'Novo cadastro de pessoa';
    byId('person-create-submit').textContent = person ? 'Salvar correção' : 'Salvar pessoa';
    byId('person-edit-reason-field').hidden = !person;
    byId('person-edit-reason').required = Boolean(person);
    if (person) {
        byId('person-name').value = person.nome_completo;
        byId('person-nickname').value = person.nome_apelido || '';
    }
    byId('person-name').focus();
}

async function savePerson(event) {
    event.preventDefault();
    if (!teamWritable()) return;
    const epoch = state.epoch;
    const rallyId = state.teamRallyId;
    const person = state.personEditing;
    const button = byId('person-create-submit');
    button.disabled = true;
    message('person-create-feedback');
    try {
        const body = { nome_completo: byId('person-name').value.trim(), nome_apelido: byId('person-nickname').value.trim() };
        if (person) body.motivo = byId('person-edit-reason').value.trim();
        const saved = await request('/api/participantes' + (person ? '/' + encodeURIComponent(person.id) : ''), { epoch, method: person ? 'PUT' : 'POST', body });
        if (epoch !== state.epoch || rallyId !== state.teamRallyId) return;
        closePersonForm();
        byId('person-search').value = saved.nome_completo;
        await searchPeople();
        if (state.teamData.historico.some(link => link.participante_id === saved.id && Number(link.ativo))) clearTeamSelection();
        else selectTeamPerson(saved);
        toast(person ? 'Cadastro corrigido. A pessoa mantém sua identidade e histórico.' : 'Pessoa cadastrada. Agora selecione sua equipe nesta edição.');
    } catch (error) {
        if (epoch === state.epoch && rallyId === state.teamRallyId) message('person-create-feedback', error.message, true);
    } finally { button.disabled = false; }
}

async function assignTeamPerson(event) {
    event.preventDefault();
    if (!teamWritable() || !state.teamPerson) return;
    const epoch = state.epoch;
    const rallyId = state.teamRallyId;
    const personId = state.teamPerson.id;
    const button = byId('team-assignment-submit');
    button.disabled = true;
    message('team-assignment-feedback');
    try {
        await request('/api/equipes/' + encodeURIComponent(rallyId) + '/membros', { method: 'POST', epoch, body: {
            participante_id: personId, tribo_id: Number(byId('assignment-tribe').value), papel: byId('assignment-role').value,
            data_entrada: byId('assignment-date').value, motivo: byId('assignment-reason').value.trim()
        } });
        if (epoch !== state.epoch || rallyId !== state.teamRallyId) return;
        toast('Integrante adicionado. O período de participação foi registrado.');
        await loadTeamEdition(rallyId);
    } catch (error) {
        if (epoch === state.epoch && rallyId === state.teamRallyId) message('team-assignment-feedback', error.message, true);
    } finally { button.disabled = false; }
}

function openTeamAction(member, operation) {
    if (!teamWritable() || byId('team-action-dialog').open) return;
    const dialog = byId('team-action-dialog');
    state.teamAction = { member, operation, rallyId: state.teamRallyId, epoch: state.epoch };
    byId('team-action-form').reset();
    message('team-action-error');
    const titles = { saida: 'Registrar saída', transferencia: 'Transferir integrante', papel: 'Alterar papel na equipe' };
    byId('team-action-title').textContent = titles[operation];
    byId('team-action-submit').textContent = titles[operation];
    byId('team-action-submit').disabled = false;
    byId('team-action-description').textContent = memberName(member) + '. O período atual será encerrado e preservado no histórico.' + (operation === 'saida' ? '' : ' Um novo vínculo será criado para a continuidade da participação.');
    byId('team-action-tribe-field').hidden = operation !== 'transferencia';
    byId('team-action-tribe').required = operation === 'transferencia';
    byId('team-action-role-field').hidden = operation === 'saida';
    byId('team-action-role').required = operation !== 'saida';
    byId('team-action-date').value = todayDate();
    byId('team-action-date').min = String(member.data_entrada).slice(0, 10);
    populateTeamTribes(byId('team-action-tribe'), { exclude: member.tribo_id });
    updateTeamRoles(byId('team-action-role'), operation === 'papel' ? member.tribo_id : null, { excludeMemberId: member.id, selected: member.papel });
    dialog.returnValue = 'cancel';
    dialog.showModal();
    (operation === 'transferencia' ? byId('team-action-tribe') : operation === 'papel' ? byId('team-action-role') : byId('team-action-date')).focus();
}

async function saveTeamAction(event) {
    event.preventDefault();
    const action = state.teamAction;
    if (!action || !teamWritable() || action.epoch !== state.epoch || action.rallyId !== state.teamRallyId) return;
    const { epoch, rallyId, member, operation } = action;
    const button = byId('team-action-submit');
    button.disabled = true;
    message('team-action-error');
    const body = { motivo: byId('team-action-reason').value.trim() };
    if (operation === 'saida') body.data_saida = byId('team-action-date').value;
    else {
        body.data = byId('team-action-date').value;
        body.papel = byId('team-action-role').value;
        if (operation === 'transferencia') body.tribo_destino_id = Number(byId('team-action-tribe').value);
    }
    try {
        await request('/api/equipes/' + encodeURIComponent(rallyId) + '/membros/' + encodeURIComponent(member.id) + '/' + operation, { method: 'POST', body, epoch });
        if (epoch !== state.epoch || rallyId !== state.teamRallyId || action !== state.teamAction) return;
        byId('team-action-dialog').close('confirm');
        toast('Movimentação registrada. O período anterior permanece no histórico.');
        await loadTeamEdition(rallyId);
    } catch (error) {
        if (epoch === state.epoch && rallyId === state.teamRallyId && action === state.teamAction) message('team-action-error', error.message, true);
    } finally { if (state.teamAction === action) button.disabled = false; }
}

byId('nav-teams').addEventListener('click', () => setPage('teams', true));
byId('refresh-teams').addEventListener('click', () => loadTeamRallies());
byId('team-rally-select').addEventListener('change', () => loadTeamEdition(Number(byId('team-rally-select').value) || null));
byId('person-search-form').addEventListener('submit', event => { event.preventDefault(); searchPeople(); });
byId('show-person-form').addEventListener('click', () => showPersonForm());
byId('cancel-person-create').addEventListener('click', closePersonForm);
byId('cancel-person-selection').addEventListener('click', clearTeamSelection);
byId('edit-selected-person').addEventListener('click', () => { if (state.teamPerson) showPersonForm(state.teamPerson); });
byId('person-create-form').addEventListener('submit', savePerson);
byId('team-assignment-form').addEventListener('submit', assignTeamPerson);
byId('assignment-tribe').addEventListener('change', () => updateTeamRoles(byId('assignment-role'), byId('assignment-tribe').value));
byId('team-action-form').addEventListener('submit', saveTeamAction);
byId('team-action-cancel').addEventListener('click', () => byId('team-action-dialog').close('cancel'));
byId('team-action-dialog').addEventListener('close', () => {
    state.teamAction = null;
    byId('team-action-form').reset();
    byId('team-action-description').textContent = '';
    byId('team-action-tribe').replaceChildren();
    message('team-action-error');
});
byId('team-action-tribe').addEventListener('change', () => updateTeamRoles(byId('team-action-role'), byId('team-action-tribe').value, { selected: byId('team-action-role').value }));

async function restoreSession() {
    if (state.signingOut) return;
    const epoch = state.epoch;
    try {
        const data = await request('/api/auth/session', { publicRequest: true, epoch });
        if (epoch === state.epoch && !state.signingOut) {
            const sameIdentity = state.session?.user.id === data.user.id && state.session?.user.tipo_usuario === data.user.tipo_usuario;
            if (sameIdentity) state.session = data;
            else acceptSession(data);
        }
    } catch (error) {
        if (epoch !== state.epoch) return;
        resetSession(error.status === 401 ? '' : error.message);
    }
}

// Recheck after returning to the tab, so deactivation or expiry clears private
// content even when the user has not yet clicked an administrative action.
window.addEventListener('pageshow', event => {
    if (event.persisted) restoreSession();
});
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.session) restoreSession();
});
// Wait for every deferred screen script before restoring private state.
window.addEventListener('DOMContentLoaded', restoreSession, { once: true });
