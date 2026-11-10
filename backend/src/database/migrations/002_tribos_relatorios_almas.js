exports.up = async function up(knex) {
  const jose = await knex('tribos').where({ slug: 'jose' }).first();
  if (jose) await knex('tribos').where({ id: jose.id }).update({ nome: 'Manassés', slug: 'manasses', ordem: 11 });
  if (await knex('tribos').first()) {
    let efraim = await knex('tribos').where({ slug: 'efraim' }).first();
    if (!efraim) {
      const [linha] = await knex('tribos').insert({ nome: 'Efraim', slug: 'efraim', cor: '#6366f1', ordem: 12 }).returning('id');
      efraim = { id: linha.id ?? linha };
    }
    await knex('tribos').where({ slug: 'benjamim' }).update({ ordem: 13 });
    for (const rally of await knex('rallies').select('id')) {
      if (!(await knex('rally_tribos').where({ rally_id: rally.id, tribo_id: efraim.id }).first())) await knex('rally_tribos').insert({ rally_id: rally.id, tribo_id: efraim.id });
    }
  }
  await knex.schema.createTable('relatorios_almas', (t) => {
    t.increments('id');
    t.integer('rally_id').notNullable().references('rallies.id');
    t.integer('rally_tribo_id').notNullable().references('rally_tribos.id');
    t.date('semana_inicio').notNullable(); t.date('semana_fim').notNullable();
    t.text('dias_json').notNullable(); t.integer('novas').notNullable(); t.integer('afastadas').notNullable();
    t.string('status').notNullable().defaultTo('rascunho').checkIn(['rascunho', 'enviado', 'conferido']);
    t.integer('responsavel_id').notNullable().references('usuarios.id'); t.string('responsavel_nome').notNullable();
    t.timestamp('enviado_em'); t.integer('avaliado_por').references('usuarios.id'); t.timestamp('avaliado_em');
    t.text('observacao_admin'); t.timestamp('atualizado_em').notNullable();
    t.unique(['rally_tribo_id', 'semana_inicio']); t.index(['rally_id', 'semana_inicio', 'status']);
  });
};
// O catálogo atualizado preserva vínculos; rollback não desfaz essa atualização.
exports.down = async (knex) => knex.schema.dropTableIfExists('relatorios_almas');
