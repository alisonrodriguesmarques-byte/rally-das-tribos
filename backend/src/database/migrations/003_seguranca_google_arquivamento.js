// Migração aditiva: conserva contas, IDs, pontos, relatórios e histórico.
exports.up = async function (knex) {
  await knex.schema.alterTable('usuarios',t=>t.integer('auth_versao').notNullable().defaultTo(0));
  await knex.schema.alterTable('pessoas',t=>t.timestamp('excluido_em'));
  await knex.schema.alterTable('rallies',t=>{t.timestamp('arquivado_em');t.integer('arquivado_por').references('usuarios.id');});
  await knex.schema.createTable('google_vinculos',t=>{
    t.increments('id');t.string('google_sub').notNullable().unique();t.string('email').notNullable();t.string('nome');
    t.integer('usuario_id').unique().references('usuarios.id');
    t.string('status').notNullable().defaultTo('pendente').checkIn(['pendente','aprovado','rejeitado']);
    t.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());t.timestamp('atualizado_em').notNullable().defaultTo(knex.fn.now());
    t.integer('aprovado_por').references('usuarios.id');t.index(['status','criado_em']);
  });
};
exports.down = async function () { throw new Error('Migração de produção sem rollback destrutivo automático. Restaure somente por plano de recuperação validado.'); };
