process.env.DB_CLIENT='better-sqlite3';delete process.env.DATABASE_URL;process.env.DB_FILE=':memory:';
const {randomBytes}=require('node:crypto');process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');process.env.JWT_SECRET=randomBytes(32).toString('hex');
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const request=require('supertest');
const db=require('../src/database/connection');const {criarApp}=require('../src/app');let app,admin;
before(async()=>{await db.migrate.latest();await db.seed.run();app=criarApp();admin=request.agent(app);assert.equal((await admin.post('/api/auth/login').send({email:'admin@rally.local',senha:process.env.ADMIN_PASSWORD})).status,200);});
after(()=>db.destroy());
test('respostas privadas não são cacheadas e possuem CSP sem scripts inline',async()=>{
 const res=await admin.get('/api/auth/me');assert.equal(res.headers['cache-control'],'no-store');assert.ok(res.headers['content-security-policy'].includes("script-src 'self'"));assert.ok(res.headers['content-security-policy'].includes("frame-ancestors 'none'"));assert.equal(res.headers['x-content-type-options'],'nosniff');
});
test('requisições de outra origem são recusadas antes de modificar dados',async()=>{
 const before=Number((await db('pessoas').count({n:'*'}).first()).n);
 assert.equal((await admin.post('/api/pessoas').set('Origin','https://fora.example').send({nome_completo:'Não cadastrar'})).status,403);
 assert.equal((await admin.post('/api/pessoas').set('Sec-Fetch-Site','cross-site').send({nome_completo:'Não cadastrar'})).status,403);
 assert.equal(Number((await db('pessoas').count({n:'*'}).first()).n),before);
});
test('formulário externo não pode executar comandos JSON',async()=>{
 assert.equal((await admin.post('/api/pessoas').type('form').send({nome_completo:'Não cadastrar'})).status,415);
});
test('planilhas exportadas neutralizam fórmulas em textos e preservam números',()=>{
 const {celulaCsv}=require('../src/utils/csv');assert.ok(celulaCsv('=HYPERLINK("https://fora.example")').startsWith('"\''));assert.equal(celulaCsv(-500),'"-500"');
});
test('login limita tentativas com erro genérico sem expor usuário',async()=>{
 let last;for(let i=0;i<31;i++)last=await request(app).post('/api/auth/login').send({email:'sem-conta@example.test',senha:'falha'});
 assert.equal(last.status,429);assert.ok(last.headers['retry-after']);
});
