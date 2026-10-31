/**
 * Repositório de Rallies
 * Operações de CRUD para a tabela rallies
 */

const BaseRepository = require('./baseRepository');
const { INITIAL_RALLY_STATUS } = require('../constants/rallyStatus');

function domainError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

class RallyRepository extends BaseRepository {
  async selectedCatalog(ids) {
    if (!Array.isArray(ids) || ids.length !== 2 ||
        ids.some(id => !Number.isSafeInteger(id) || id <= 0) || ids[0] === ids[1]) {
      throw domainError(400, 'Selecione exatamente duas tribos oficiais distintas.');
    }
    const selected = await this.all('SELECT id, nome, cor FROM tribos_catalogo WHERE id IN (?, ?) ORDER BY id', ids);
    if (selected.length !== 2) throw domainError(400, 'A seleção contém uma tribo que não pertence ao catálogo oficial.');
    return selected;
  }

  async attachTribes(rallies) {
    if (!rallies.length) return rallies;
    const rows = await this.all(`SELECT id, rally_id, catalogo_id, nome, cor FROM tribos
      WHERE rally_id IN (${rallies.map(() => '?').join(', ')}) ORDER BY nome`, rallies.map(rally => rally.id));
    const grouped = new Map(rallies.map(rally => [rally.id, []]));
    for (const { rally_id, ...tribe } of rows) grouped.get(rally_id)?.push(tribe);
    return rallies.map(rally => ({ ...rally, tribos: grouped.get(rally.id) }));
  }

  async mutableRally(id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw domainError(400, 'ID inválido');
    const rally = await this.findById(id);
    if (!rally) throw domainError(404, 'Rally não encontrado');
    if (rally.legado) throw domainError(409, 'Edições legadas são preservadas somente para consulta.');
    return rally;
  }

  /**
   * Cria um novo rally e duas participacoes oficiais na mesma transacao.
   * @param {Object} rally - Dados do rally
   * @returns {Promise<Object>}
   */
  async create(rally) {
    const { nome, descricao, data_inicio, data_fim, tribos_ids } = rally;
    if (Object.hasOwn(rally, 'legado')) throw domainError(400, 'Novos Rallys não podem ser declarados como legado.');

    return this.db.transaction(async () => {
      const selected = await this.selectedCatalog(tribos_ids);
      const sql = `
        INSERT INTO rallies (nome, descricao, data_inicio, data_fim, status)
        VALUES (?, ?, ?, ?, ?)
      `;

      const result = await this.run(sql, [nome, descricao, data_inicio, data_fim, INITIAL_RALLY_STATUS]);

      const insertTribo = `
        INSERT INTO tribos (rally_id, catalogo_id, nome, descricao, cor)
        VALUES (?, ?, ?, ?, ?)
      `;

      for (const tribo of selected) {
        await this.run(insertTribo, [
          result.id,
          tribo.id,
          tribo.nome,
          `Tribo de ${tribo.nome}`,
          tribo.cor
        ]);
      }

      return this.findById(result.id);
    });
  }

  /**
   * Busca um rally por ID
   * @param {number} id - ID do rally
   * @returns {Promise<Object>}
   */
  async findById(id) {
    const sql = `
      SELECT
        id, nome, descricao, data_inicio, data_fim, status, legado,
        data_criacao, data_atualizacao
      FROM rallies
      WHERE id = ?
    `;
    const row = await this.get(sql, [id]);
    return row ? (await this.attachTribes([row]))[0] : undefined;
  }

  /**
   * Busca todos os rallies
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    let sql = `
      SELECT
        id, nome, descricao, data_inicio, data_fim, status, legado,
        data_criacao, data_atualizacao
      FROM rallies
    `;
    const params = [];

    if (options.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY data_inicio DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return this.attachTribes(await this.all(sql, params));
  }

  /**
   * Busca o rally ativo
   * @returns {Promise<Object>}
   */
  async findActive() {
    const sql = `
      SELECT
        id, nome, descricao, data_inicio, data_fim, status, legado,
        data_criacao, data_atualizacao
      FROM rallies
      WHERE status = 'ativo'
      ORDER BY data_inicio DESC
      LIMIT 1
    `;
    const row = await this.get(sql);
    return row ? (await this.attachTribes([row]))[0] : undefined;
  }

  /**
   * Atualiza um rally
   * @param {number} id - ID do rally
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    if (Object.hasOwn(data, 'tribos_ids') || Object.hasOwn(data, 'legado')) {
      throw domainError(400, 'Use a seleção específica de tribos; o marcador de legado não é editável.');
    }
    return this.db.transaction(async () => {
      const rally = await this.mutableRally(id);
      if (['encerrado', 'arquivado', 'cancelado'].includes(rally.status)) {
        throw domainError(409, 'Esta edição está encerrada para alterações.');
      }
      const fields = ['nome', 'descricao', 'data_inicio', 'data_fim'].filter(field => data[field] !== undefined);
      if (!fields.length) throw domainError(400, 'Nenhum campo válido para atualização');
      await this.run(`UPDATE rallies SET ${fields.map(field => field + ' = ?').join(', ')} WHERE id = ?`,
        [...fields.map(field => data[field]), id]);
      return this.findById(id);
    });
  }

  async replaceSelection(id, ids) {
    return this.db.transaction(async () => {
      const rally = await this.mutableRally(id);
      if (rally.status !== INITIAL_RALLY_STATUS) {
        throw domainError(409, 'As tribos participantes só podem ser escolhidas durante o planejamento. Os integrantes continuam independentes dessa seleção.');
      }
      const selected = await this.selectedCatalog(ids);
      const keep = new Set(selected.map(tribe => tribe.id));
      const removed = rally.tribos.filter(tribe => !keep.has(tribe.catalogo_id));
      // Historical membership and activity assignments also prevent deleting a
      // participation. Draft activities can already target tribes in planning.
      const dependents = ['membros_tribo', 'pontuacoes', 'quiz_respostas', 'historico_pontuacoes', 'dinamicas',
        'missao_tribos', 'prova_tribos', 'mission_deliveries', 'exam_attempts'];
      for (const tribe of removed) {
        for (const table of dependents) {
          if (await this.get(`SELECT 1 AS linked FROM ${table} WHERE tribo_id = ? LIMIT 1`, [tribe.id])) {
            throw domainError(409, 'A tribo possui integrantes, atividades, resultados ou histórico; sua participação não pode ser substituída.');
          }
        }
      }
      for (const tribe of removed) await this.run('DELETE FROM tribos WHERE id = ? AND rally_id = ?', [tribe.id, id]);
      const current = new Set(rally.tribos.map(tribe => tribe.catalogo_id));
      for (const tribe of selected) {
        if (!current.has(tribe.id)) {
          await this.run('INSERT INTO tribos (rally_id, catalogo_id, nome, descricao, cor) VALUES (?, ?, ?, ?, ?)',
            [id, tribe.id, tribe.nome, `Tribo de ${tribe.nome}`, tribe.cor]);
        }
      }
      return this.findById(id);
    });
  }

  /**
   * Aplica uma transição de estado validando o estado atual do rally.
   * @param {number} id
   * @param {string} expectedStatus
   * @param {string} nextStatus
   * @param {string} invalidMessage
   * @returns {Promise<Object>}
   */
  async _transitionStatus(id, expectedStatus, nextStatus, invalidMessage) {
    return this.db.transaction(async () => {
      const rally = await this.mutableRally(id);
      if (!rally) {
        const err = new Error('Rally não encontrado');
        err.status = 404;
        throw err;
      }
      if (rally.status !== expectedStatus) {
        const err = new Error(invalidMessage);
        err.status = 400;
        throw err;
      }

      const result = await this.run(
        'UPDATE rallies SET status = ? WHERE id = ? AND status = ?',
        [nextStatus, id, expectedStatus]
      );
      if (result.changes !== 1) {
        const err = new Error(invalidMessage);
        err.status = 400;
        throw err;
      }
      return this.findById(id);
    });
  }

  /**
   * Arquiva somente um rally encerrado.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async archive(id) {
    return this._transitionStatus(
      id,
      'encerrado',
      'arquivado',
      'Somente um rally encerrado pode ser arquivado'
    );
  }

  /**
   * Encerra somente um rally ativo.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async close(id) {
    return this._transitionStatus(
      id,
      'ativo',
      'encerrado',
      'Somente um rally ativo pode ser encerrado'
    );
  }

  /**
   * Cancela somente um rally em planejamento.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async cancel(id) {
    return this._transitionStatus(
      id,
      INITIAL_RALLY_STATUS,
      'cancelado',
      'Somente um rally em planejamento pode ser cancelado'
    );
  }
  /**
   * Deleta um rally (apenas se não tiver dados dependentes)
   * @param {number} id - ID do rally
   * @returns {Promise<Object>}
   */
  async delete(id) {
    await this.mutableRally(id);
    const error = (message) => {
      const err = new Error(message);
      err.status = 409;
      throw err;
    };

    const tribosCount = await super.count('tribos', 'rally_id = ?', [id]);
    if (tribosCount > 0) {
      error('Não é possível excluir rally com tribos cadastradas');
    }

    const participantesCount = await super.count(
      'participantes',
      'id IN (SELECT participante_id FROM membros_tribo JOIN tribos ON membros_tribo.tribo_id = tribos.id WHERE tribos.rally_id = ?)',
      [id]
    );
    if (participantesCount > 0) {
      error('Não é possível excluir rally com participantes vinculados');
    }

    const missoesCount = await super.count('missoes', 'rally_id = ?', [id]);
    if (missoesCount > 0) {
      error('Não é possível excluir rally com missões cadastradas');
    }

    const provasCount = await super.count('provas', 'rally_id = ?', [id]);
    if (provasCount > 0) {
      error('Não é possível excluir rally com provas cadastradas');
    }

    const dinamicasCount = await super.count('dinamicas', 'rally_id = ?', [id]);
    if (dinamicasCount > 0) {
      error('Não é possível excluir rally com dinâmicas cadastradas');
    }

    const pontuacoesCount = await super.count('pontuacoes', 'rally_id = ?', [id]);
    if (pontuacoesCount > 0) {
      error('Não é possível excluir rally com pontuações registradas');
    }

    return super.delete('rallies', 'id = ?', [id]);
  }

  /**
   * Inicia um novo rally em planejamento, apos validar duas tribos oficiais distintas.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async start(id) {
    return this.db.transaction(async () => {
      const rally = await this.mutableRally(id);
      if (!rally) {
        const err = new Error('Rally não encontrado');
        err.status = 404;
        throw err;
      }
      if (rally.status !== INITIAL_RALLY_STATUS) {
        const err = new Error('Somente um rally em planejamento pode ser iniciado');
        err.status = 400;
        throw err;
      }
      const tribos = await this.db.all(`SELECT t.catalogo_id, t.nome, c.nome AS nome_oficial
        FROM tribos t LEFT JOIN tribos_catalogo c ON c.id = t.catalogo_id WHERE t.rally_id = ?`, [id]);
      if (tribos.length !== 2 || new Set(tribos.map(tribe => tribe.catalogo_id)).size !== 2 ||
          tribos.some(tribe => !tribe.catalogo_id || tribe.nome !== tribe.nome_oficial)) {
        throw domainError(400, 'Não é possível iniciar o Rally: selecione exatamente duas tribos oficiais distintas.');
      }
      const result = await this.run(
        'UPDATE rallies SET status = ? WHERE id = ? AND status = ?',
        ['ativo', id, INITIAL_RALLY_STATUS]
      );
      if (result.changes !== 1) {
        const err = new Error('Somente um rally em planejamento pode ser iniciado');
        err.status = 400;
        throw err;
      }
      return this.findById(id);
    });
  }

  /**
   * Conta o total de rallies
   * @param {string} status - Filtrar por status (opcional)
   * @returns {Promise<number>}
   */
  async countRallies(status = null) {
    let where = '1=1';
    const params = [];

    if (status) {
      where = 'status = ?';
      params.push(status);
    }

    return super.count('rallies', where, params);
  }
}

module.exports = RallyRepository;
