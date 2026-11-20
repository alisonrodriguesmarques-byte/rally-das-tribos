exports.up = async function up(knex) {
  await knex.schema.alterTable('usuarios', t => t.boolean('email_notificacoes').notNullable().defaultTo(false));
  await knex.schema.createTable('notificacoes', t => {
    t.increments('id'); t.integer('usuario_id').notNullable().references('usuarios.id');
    t.string('tipo').notNullable(); t.string('titulo').notNullable(); t.text('mensagem').notNullable(); t.string('destino').notNullable();
    t.timestamp('criado_em').notNullable().defaultTo(knex.fn.now()); t.timestamp('lido_em');
    t.index(['usuario_id','criado_em']); t.index(['usuario_id','lido_em']);
  });
  await knex.schema.createTable('notificacoes_email', t => {
    t.increments('id'); t.integer('notificacao_id').notNullable().unique().references('notificacoes.id');
    t.string('status').notNullable().defaultTo('pendente'); t.integer('tentativas').notNullable().defaultTo(0);
    t.timestamp('proxima_em').notNullable().defaultTo(knex.fn.now()); t.timestamp('lock_em'); t.string('lock_token');
    t.string('ultimo_erro'); t.timestamp('enviado_em'); t.index(['status','proxima_em']);
  });
};
exports.down = async function down() { throw new Error('Migração de produção: restaure uma cópia de backup em vez de apagar notificações.'); };
