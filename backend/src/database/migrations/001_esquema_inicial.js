/**
 * Esquema inicial do Rally das Tribos.
 * Escrito com o schema builder do Knex para funcionar em SQLite e PostgreSQL.
 */
 
function auditavel(t, knex) {
  t.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());
}
 
exports.up = async function up(knex) {
  await knex.schema.createTable('pessoas', (t) => {
    t.increments('id');
    t.string('nome_completo').notNullable();
    t.string('apelido');
    t.string('foto_url');
    t.string('telefone');
    t.boolean('ativo').notNullable().defaultTo(true);
    auditavel(t, knex);
    t.timestamp('atualizado_em').notNullable().defaultTo(knex.fn.now());
    t.index(['nome_completo']);
  });
 
  await knex.schema.createTable('usuarios', (t) => {
    t.increments('id');
    t.integer('pessoa_id').unique().references('pessoas.id');
    t.string('email').notNullable().unique();
    t.string('senha_hash').notNullable();
    t.string('papel').notNullable().defaultTo('membro').checkIn(['admin', 'membro']);
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('ultimo_login');
    auditavel(t, knex);
  });
 
  await knex.schema.createTable('rallies', (t) => {
    t.increments('id');
    t.string('nome').notNullable();
    t.date('data_inicio').notNullable();
    t.date('data_fim').notNullable();
    t.string('status').notNullable().defaultTo('planejado').checkIn(['planejado', 'ativo', 'encerrado']);
    t.integer('criado_por').references('usuarios.id');
    auditavel(t, knex);
  });
 
  await knex.schema.createTable('tribos', (t) => {
    t.increments('id');
    t.string('nome').notNullable().unique();
    t.string('slug').notNullable().unique();
    t.string('cor');
    t.integer('ordem').notNullable();
  });
 
  await knex.schema.createTable('rally_tribos', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.integer('tribo_id').notNullable().references('tribos.id');
    t.integer('cabeca_pessoa_id').references('pessoas.id');
    t.integer('auxiliar_pessoa_id').references('pessoas.id');
    t.unique(['rally_id', 'tribo_id']);
  });
 
  await knex.schema.createTable('membros_tribo', (t) => {
    t.increments('id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.integer('pessoa_id').notNullable().references('pessoas.id');
    t.timestamp('entrou_em').notNullable().defaultTo(knex.fn.now());
    t.timestamp('saiu_em');
    t.string('motivo_saida');
    t.string('status').notNullable().defaultTo('ativo').checkIn(['ativo', 'inativo']);
    t.index(['pessoa_id']);
    t.index(['rally_tribo_id', 'status']);
  });
 
  await knex.schema.createTable('categorias', (t) => {
    t.increments('id');
    t.string('nome').notNullable().unique();
    t.string('cor');
    t.boolean('ativa').notNullable().defaultTo(true);
  });
 
  await knex.schema.createTable('lancamentos', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.integer('categoria_id').references('categorias.id');
    t.integer('pessoa_id').references('pessoas.id');
    t.integer('pontos').notNullable();
    t.string('motivo').notNullable();
    t.string('origem_tipo').notNullable().checkIn(['missao', 'dinamica', 'prova', 'manual']);
    t.integer('origem_id');
    t.date('data_referencia').notNullable();
    t.string('status').notNullable().defaultTo('ativo').checkIn(['ativo', 'cancelado']);
    t.integer('criado_por').notNullable().references('usuarios.id');
    auditavel(t, knex);
    t.integer('cancelado_por').references('usuarios.id');
    t.timestamp('cancelado_em');
    t.string('motivo_cancelamento');
    t.index(['rally_id', 'status', 'rally_tribo_id']);
    t.index(['rally_id', 'data_referencia']);
    t.index(['origem_tipo', 'origem_id']);
  });
 
  await knex.schema.createTable('lancamentos_historico', (t) => {
    t.increments('id');
    t.integer('lancamento_id').notNullable().references('lancamentos.id');
    t.string('acao').notNullable().checkIn(['criacao', 'edicao', 'cancelamento', 'reativacao']);
    t.integer('pontos_anteriores');
    t.integer('pontos_novos');
    t.string('motivo');
    t.integer('usuario_id').notNullable().references('usuarios.id');
    t.timestamp('em').notNullable().defaultTo(knex.fn.now());
  });
 
  await knex.schema.createTable('auditoria', (t) => {
    t.increments('id');
    t.string('entidade').notNullable();
    t.integer('entidade_id').notNullable();
    t.string('acao').notNullable();
    t.text('antes_json');
    t.text('depois_json');
    t.integer('usuario_id').references('usuarios.id');
    t.timestamp('em').notNullable().defaultTo(knex.fn.now());
    t.index(['entidade', 'entidade_id']);
  });
 
  await knex.schema.createTable('missoes', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.integer('categoria_id').references('categorias.id');
    t.string('titulo').notNullable();
    t.text('descricao');
    t.text('observacoes');
    t.date('data_inicio').notNullable();
    t.date('data_limite');
    t.string('tipo_pontuacao').notNullable().checkIn(['fixa', 'quantidade', 'meta', 'manual']);
    t.integer('pontos');
    t.integer('meta_quantidade');
    t.integer('limite_por_tribo');
    t.boolean('requer_aprovacao').notNullable().defaultTo(true);
    t.boolean('todas_tribos').notNullable().defaultTo(true);
    t.string('status').notNullable().defaultTo('aberta').checkIn(['aberta', 'encerrada', 'cancelada']);
    t.integer('criado_por').references('usuarios.id');
    auditavel(t, knex);
    t.index(['rally_id', 'data_inicio']);
  });
 
  await knex.schema.createTable('missao_tribos', (t) => {
    t.integer('missao_id').notNullable().references('missoes.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.primary(['missao_id', 'rally_tribo_id']);
  });
 
  await knex.schema.createTable('missao_entregas', (t) => {
    t.increments('id');
    t.integer('missao_id').notNullable().references('missoes.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.integer('quantidade');
    t.integer('pontos_manual');
    t.string('evidencia_url');
    t.text('observacao');
    t.string('status').notNullable().defaultTo('enviada').checkIn(['enviada', 'aprovada', 'rejeitada']);
    t.integer('enviado_por').references('usuarios.id');
    t.timestamp('enviado_em').notNullable().defaultTo(knex.fn.now());
    t.integer('avaliado_por').references('usuarios.id');
    t.timestamp('avaliado_em');
    t.text('observacao_admin');
    t.integer('lancamento_id').references('lancamentos.id');
  });
 
  await knex.schema.createTable('dinamicas', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.integer('missao_id').references('missoes.id');
    t.integer('categoria_id').references('categorias.id');
    t.string('titulo').notNullable();
    t.string('tema');
    t.text('descricao');
    t.date('data_encontro');
    t.integer('responsavel_pessoa_id').references('pessoas.id');
    t.integer('pontos_previstos');
    t.string('status').notNullable().defaultTo('pendente')
      .checkIn(['pendente', 'enviada', 'aprovada', 'realizada', 'nao_realizada']);
    t.text('resultado');
    t.string('evidencia_url');
    t.text('observacao_admin');
    t.integer('lancamento_id').references('lancamentos.id');
    auditavel(t, knex);
  });
 
  await knex.schema.createTable('provas', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.integer('categoria_id').references('categorias.id');
    t.string('titulo').notNullable();
    t.text('descricao');
    t.string('modo').notNullable().defaultTo('tribo').checkIn(['tribo', 'individual']);
    t.string('agregacao').notNullable().defaultTo('soma').checkIn(['soma', 'media', 'melhor']);
    t.timestamp('disponivel_de');
    t.timestamp('disponivel_ate');
    t.integer('tempo_limite_seg');
    t.integer('max_tentativas');
    t.boolean('embaralhar').notNullable().defaultTo(false);
    t.boolean('todas_tribos').notNullable().defaultTo(true);
    t.string('status').notNullable().defaultTo('rascunho')
      .checkIn(['rascunho', 'publicada', 'encerrada', 'cancelada']);
    t.integer('criado_por').references('usuarios.id');
    auditavel(t, knex);
  });
 
  await knex.schema.createTable('prova_tribos', (t) => {
    t.integer('prova_id').notNullable().references('provas.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.primary(['prova_id', 'rally_tribo_id']);
  });
 
  await knex.schema.createTable('questoes', (t) => {
    t.increments('id');
    t.integer('prova_id').notNullable().references('provas.id');
    t.string('tipo').notNullable()
      .checkIn(['multipla_escolha', 'verdadeiro_falso', 'complete', 'aberta', 'associacao', 'ordem']);
    t.text('enunciado').notNullable();
    t.string('referencia_biblica');
    t.string('imagem_url');
    t.string('video_url');
    t.integer('pontos').notNullable().defaultTo(100);
    t.integer('ordem').notNullable().defaultTo(0);
    t.boolean('removida').notNullable().defaultTo(false);
    t.index(['prova_id', 'ordem']);
  });
 
  await knex.schema.createTable('alternativas', (t) => {
    t.increments('id');
    t.integer('questao_id').notNullable().references('questoes.id');
    t.text('texto').notNullable();
    t.boolean('correta').notNullable().defaultTo(false);
    t.integer('posicao_correta');
    t.string('lado').checkIn(['A', 'B']);
    t.string('par_chave');
    t.integer('ordem').notNullable().defaultTo(0);
  });
 
  await knex.schema.createTable('respostas_aceitas', (t) => {
    t.increments('id');
    t.integer('questao_id').notNullable().references('questoes.id');
    t.string('texto').notNullable();
  });
 
  await knex.schema.createTable('tentativas', (t) => {
    t.increments('id');
    t.integer('prova_id').notNullable().references('provas.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.integer('pessoa_id').references('pessoas.id');
    t.integer('usuario_id').references('usuarios.id');
    t.integer('numero').notNullable().defaultTo(1);
    t.timestamp('iniciada_em').notNullable().defaultTo(knex.fn.now());
    t.timestamp('finalizada_em');
    t.integer('pontos_obtidos');
    t.boolean('fora_do_tempo').notNullable().defaultTo(false);
    t.string('status').notNullable().defaultTo('em_andamento')
      .checkIn(['em_andamento', 'aguardando_correcao', 'corrigida', 'anulada']);
    t.index(['prova_id', 'rally_tribo_id']);
  });
 
  await knex.schema.createTable('respostas', (t) => {
    t.increments('id');
    t.integer('tentativa_id').notNullable().references('tentativas.id');
    t.integer('questao_id').notNullable().references('questoes.id');
    t.integer('alternativa_id').references('alternativas.id');
    t.text('texto');
    t.text('resposta_json');
    t.boolean('correta');
    t.integer('pontos_obtidos');
    t.integer('corrigida_por').references('usuarios.id');
    t.timestamp('corrigida_em');
    t.unique(['tentativa_id', 'questao_id']);
  });
 
  await knex.schema.createTable('prova_resultados', (t) => {
    t.increments('id');
    t.integer('prova_id').notNullable().references('provas.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.integer('pontos').notNullable();
    t.integer('lancamento_id').references('lancamentos.id');
    t.timestamp('calculado_em').notNullable().defaultTo(knex.fn.now());
    t.unique(['prova_id', 'rally_tribo_id']);
  });
 
  await knex.schema.createTable('encontros', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.date('data').notNullable();
    t.string('titulo');
  });
 
  await knex.schema.createTable('presencas', (t) => {
    t.integer('encontro_id').notNullable().references('encontros.id');
    t.integer('pessoa_id').notNullable().references('pessoas.id');
    t.timestamp('chegou_em');
    t.primary(['encontro_id', 'pessoa_id']);
  });
};
 
exports.down = async function down(knex) {
  const tabelas = [
    'presencas', 'encontros', 'prova_resultados', 'respostas', 'tentativas', 'respostas_aceitas',
    'alternativas', 'questoes', 'prova_tribos', 'provas', 'dinamicas', 'missao_entregas',
    'missao_tribos', 'missoes', 'auditoria', 'lancamentos_historico', 'lancamentos', 'categorias',
    'membros_tribo', 'rally_tribos', 'tribos', 'rallies', 'usuarios', 'pessoas',
  ];
  for (const t of tabelas) await knex.schema.dropTableIfExists(t);
};
