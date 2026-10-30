/**
 * Repositório Base
 * Classe abstrata para operações comuns do banco de dados
 */

class BaseRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Executa uma query que não retorna dados
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros
   * @returns {Promise}
   */
  async run(sql, params = []) {
    return this.db.run(sql, params);
  }

  /**
   * Executa uma query que retorna uma única linha
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros
   * @returns {Promise<Object>}
   */
  async get(sql, params = []) {
    return this.db.get(sql, params);
  }

  /**
   * Executa uma query que retorna múltiplas linhas
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros
   * @returns {Promise<Array>}
   */
  async all(sql, params = []) {
    return this.db.all(sql, params);
  }

  /**
   * Insere um registro
   * @param {string} table - Nome da tabela
   * @param {Object} data - Dados a inserir
   * @returns {Promise<Object>} - Retorna o ID inserido
   */
  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = await this.run(sql, values);

    return { id: result.id, ...data };
  }

  /**
   * Atualiza um registro
   * @param {string} table - Nome da tabela
   * @param {Object} data - Dados a atualizar
   * @param {string} where - Condição WHERE
   * @param {Array} whereParams - Parâmetros do WHERE
   * @returns {Promise<Object>}
   */
  async update(table, data, where, whereParams = []) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    const result = await this.run(sql, [...values, ...whereParams]);

    return { changes: result.changes };
  }

  /**
   * Deleta um registro
   * @param {string} table - Nome da tabela
   * @param {string} where - Condição WHERE
   * @param {Array} params - Parâmetros
   * @returns {Promise<Object>}
   */
  async delete(table, where, params = []) {
    const sql = `DELETE FROM ${table} WHERE ${where}`;
    const result = await this.run(sql, params);

    return { changes: result.changes };
  }

  /**
   * Busca por ID
   * @param {string} table - Nome da tabela
   * @param {number} id - ID do registro
   * @returns {Promise<Object>}
   */
  async findById(table, id) {
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    return this.get(sql, [id]);
  }

  /**
   * Busca todos os registros
   * @param {string} table - Nome da tabela
   * @param {Object} options - Opções (orderBy, limit, offset)
   * @returns {Promise<Array>}
   */
  async findAll(table, options = {}) {
    let sql = `SELECT * FROM ${table}`;
    const params = [];

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    return this.all(sql, params);
  }

  /**
   * Conta registros
   * @param {string} table - Nome da tabela
   * @param {string} where - Condição WHERE (opcional)
   * @param {Array} params - Parâmetros (opcional)
   * @returns {Promise<number>}
   */
  async count(table, where = '1=1', params = []) {
    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`;
    const result = await this.get(sql, params);
    return result.count;
  }
}

module.exports = BaseRepository;
