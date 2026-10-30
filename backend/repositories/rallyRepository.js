/**
 * Repositório de Rallies
 * Operações de CRUD para a tabela rallies
 */

const BaseRepository = require('./baseRepository');
const { TRIBOS_OFICIAIS, NOMES_TRIBOS_OFICIAIS } = require('../constants/tribosOficiais');
const { INITIAL_RALLY_STATUS } = require('../constants/rallyStatus');

class RallyRepository extends BaseRepository {
  /**
   * Cria um novo rally e as 12 tribos oficiais na mesma transação.
   * @param {Object} rally - Dados do rally
   * @returns {Promise<Object>}
   */
  async create(rally) {
    const { nome, descricao, data_inicio, data_fim } = rally;

    return this.db.transaction(async () => {
      const sql = `
        INSERT INTO rallies (nome, descricao, data_inicio, data_fim, status)
        VALUES (?, ?, ?, ?, ?)
      `;

      const result = await this.run(sql, [nome, descricao, data_inicio, data_fim, INITIAL_RALLY_STATUS]);

      const insertTribo = `
        INSERT INTO tribos (rally_id, nome, descricao, cor)
        VALUES (?, ?, ?, ?)
      `;

      for (const tribo of TRIBOS_OFICIAIS) {
        await this.run(insertTribo, [
          result.id,
          tribo.nome,
          `Tribo de ${tribo.nome}`,
          tribo.cor
        ]);
      }

      const created = await this.findById(result.id);
      created.tribos = await this.db.all(
        'SELECT id, nome, cor FROM tribos WHERE rally_id = ? ORDER BY nome',
        [result.id]
      );
      return created;
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
        id, nome, descricao, data_inicio, data_fim, status,
        data_criacao, data_atualizacao
      FROM rallies
      WHERE id = ?
    `;
    return this.get(sql, [id]);
  }

  /**
   * Busca todos os rallies
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    let sql = `
      SELECT
        id, nome, descricao, data_inicio, data_fim, status,
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

    return this.all(sql, params);
  }

  /**
   * Busca o rally ativo
   * @returns {Promise<Object>}
   */
  async findActive() {
    const sql = `
      SELECT
        id, nome, descricao, data_inicio, data_fim, status,
        data_criacao, data_atualizacao
      FROM rallies
      WHERE status = 'ativo'
      ORDER BY data_inicio DESC
      LIMIT 1
    `;
    return this.get(sql);
  }

  /**
   * Atualiza um rally
   * @param {number} id - ID do rally
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const allowedFields = ['nome', 'descricao', 'data_inicio', 'data_fim'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) {
      throw new Error('Nenhum campo válido para atualização');
    }

    values.push(id);
    const sql = `UPDATE rallies SET ${updates.join(', ')} WHERE id = ?`;
    await this.run(sql, values);

    return this.findById(id);
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
      const rally = await this.findById(id);
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
   * Inicia um rally em planejamento, após validar as 12 tribos oficiais.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async start(id) {
    return this.db.transaction(async () => {
      const rally = await this.findById(id);
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
      const tribos = await this.db.all('SELECT nome FROM tribos WHERE rally_id = ?', [id]);
      const nomes = tribos.map((tribo) => tribo.nome);
      const faltando = NOMES_TRIBOS_OFICIAIS.filter((nome) => !nomes.includes(nome));
      if (faltando.length > 0 || nomes.length !== NOMES_TRIBOS_OFICIAIS.length) {
        const err = new Error('Não é possível iniciar o rally: é necessário ter exatamente as 12 tribos oficiais');
        err.status = 400;
        throw err;
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
