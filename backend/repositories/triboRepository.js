/**
 * Repositório de Tribos
 * Operações de CRUD para a tabela tribos
 */

const BaseRepository = require('./baseRepository');

function domainError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

class TriboRepository extends BaseRepository {
  async catalog() {
    return this.all('SELECT id, nome, cor FROM tribos_catalogo ORDER BY id');
  }

  /**
   * Cria uma nova tribo
   * @param {Object} tribo - Dados da tribo
   * @returns {Promise<Object>}
   */
  async create() {
    throw domainError(409, 'As tribos participantes são escolhidas em pares no Rally; use a seleção de tribos da edição.');
  }

  /**
   * Busca uma tribo por ID
   * @param {number} id - ID da tribo
   * @returns {Promise<Object>}
   */
  async findById(id) {
    const sql = `
      SELECT
        t.id, t.rally_id, t.catalogo_id, t.nome, t.descricao, t.cor,
        t.data_criacao, t.data_atualizacao,
        r.nome as rally_nome
      FROM tribos t
      LEFT JOIN rallies r ON t.rally_id = r.id
      WHERE t.id = ?
    `;
    return this.get(sql, [id]);
  }

  /**
   * Busca todas as tribos de um rally
   * @param {number} rallyId - ID do rally
   * @returns {Promise<Array>}
   */
  async findByRally(rallyId) {
    const sql = `
      SELECT
        t.id, t.rally_id, t.catalogo_id, t.nome, t.descricao, t.cor,
        t.data_criacao, t.data_atualizacao,
        (
          SELECT COUNT(DISTINCT mt.participante_id)
          FROM membros_tribo mt
          WHERE mt.tribo_id = t.id
            AND mt.ativo = 1
        ) as total_participantes,
        COALESCE(
          (
            SELECT SUM(p.pontos)
            FROM pontuacoes p
            WHERE p.tribo_id = t.id
              AND p.rally_id = t.rally_id
          ),
          0
        ) as pontuacao_total
      FROM tribos t
      WHERE t.rally_id = ?
      ORDER BY t.nome
    `;
    return this.all(sql, [rallyId]);
  }

  /**
   * Busca todas as tribos
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    let sql = `
      SELECT
        t.id, t.rally_id, t.catalogo_id, t.nome, t.descricao, t.cor,
        t.data_criacao, t.data_atualizacao,
        r.nome as rally_nome
      FROM tribos t
      LEFT JOIN rallies r ON t.rally_id = r.id
    `;
    const params = [];

    if (options.rally_id) {
      sql += ' WHERE t.rally_id = ?';
      params.push(options.rally_id);
    }

    sql += ' ORDER BY t.nome';

    return this.all(sql, params);
  }

  /**
   * Atualiza uma tribo
   * @param {number} id - ID da tribo
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    if (['nome', 'rally_id', 'catalogo_id'].some(field => Object.hasOwn(data, field))) {
      throw domainError(409, 'A identidade da tribo só pode mudar pela seleção oficial no planejamento do Rally.');
    }
    return this.db.transaction(async () => {
      const owner = await this.get(`SELECT r.legado, r.status FROM tribos t
        JOIN rallies r ON r.id = t.rally_id WHERE t.id = ?`, [id]);
      if (!owner) throw domainError(404, 'Tribo não encontrada');
      if (owner.legado || ['encerrado', 'arquivado', 'cancelado'].includes(owner.status)) {
        throw domainError(409, 'Esta edição é preservada somente para consulta.');
      }
      const fields = ['descricao', 'cor'].filter(field => data[field] !== undefined);
      if (!fields.length) throw domainError(400, 'Nenhum campo válido para atualização');
      await this.run(`UPDATE tribos SET ${fields.map(field => field + ' = ?').join(', ')} WHERE id = ?`,
        [...fields.map(field => data[field]), id]);
      return this.findById(id);
    });
  }

  /**
   * Deleta uma tribo
   * @param {number} id - ID da tribo
   * @returns {Promise<Object>}
   */
  async delete() {
    throw domainError(409, 'A participação de uma tribo não pode ser excluída isoladamente; use a seleção do Rally durante o planejamento.');
  }

  /**
   * Busca o ranking atual das tribos de um rally
   * @param {number} rallyId - ID do rally
   * @returns {Promise<Array>}
   */
  async getRanking(rallyId) {
    const sql = `
      SELECT
        s.id,
        s.nome,
        s.cor,
        s.total_participantes,
        s.pontuacao_total,
        RANK() OVER (ORDER BY s.pontuacao_total DESC) AS posicao
      FROM (
        SELECT
          t.id,
          t.nome,
          t.cor,
          (SELECT COUNT(*) FROM membros_tribo mt WHERE mt.tribo_id = t.id AND mt.ativo = 1) AS total_participantes,
          COALESCE((SELECT SUM(p.pontos) FROM pontuacoes p WHERE p.tribo_id = t.id AND p.rally_id = t.rally_id), 0) AS pontuacao_total
        FROM tribos t
        WHERE t.rally_id = ?
      ) s
      ORDER BY s.pontuacao_total DESC, s.nome COLLATE NOCASE ASC
    `;
    return this.all(sql, [rallyId]);
  }

  /**
   * Busca os membros de uma tribo
   * @param {number} triboId - ID da tribo
   * @returns {Promise<Array>}
   */
  async getMembros(triboId) {
    const sql = `
      SELECT
        mt.id as membro_id,
        mt.papel,
        mt.ativo,
        mt.data_entrada,
        mt.data_saida,
        p.id as participante_id,
        p.nome_completo,
        p.nome_apelido,
        p.foto_url
      FROM membros_tribo mt
      JOIN participantes p ON mt.participante_id = p.id
      WHERE mt.tribo_id = ?
      ORDER BY mt.papel DESC, p.nome_completo
    `;
    return this.all(sql, [triboId]);
  }

  /**
   * Busca o líder de uma tribo
   * @param {number} triboId - ID da tribo
   * @returns {Promise<Object>}
   */
  async getLider(triboId) {
    const sql = `
      SELECT
        p.id, p.nome_completo, p.nome_apelido, p.foto_url
      FROM membros_tribo mt
      JOIN participantes p ON mt.participante_id = p.id
      WHERE mt.tribo_id = ? AND mt.papel = 'lider' AND mt.ativo = 1
      LIMIT 1
    `;
    return this.get(sql, [triboId]);
  }

  /**
   * Busca o auxiliar de uma tribo
   * @param {number} triboId - ID da tribo
   * @returns {Promise<Object>}
   */
  async getAuxiliar(triboId) {
    const sql = `
      SELECT
        p.id, p.nome_completo, p.nome_apelido, p.foto_url
      FROM membros_tribo mt
      JOIN participantes p ON mt.participante_id = p.id
      WHERE mt.tribo_id = ? AND mt.papel = 'auxiliar' AND mt.ativo = 1
      LIMIT 1
    `;
    return this.get(sql, [triboId]);
  }
}

module.exports = TriboRepository;
