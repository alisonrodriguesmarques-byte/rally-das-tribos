"""Dados fictícios extraídos do roteiro do Devin. Não altera um rally existente."""
import json, os, urllib.request, http.cookiejar, getpass
B=os.environ.get('RALLY_URL','http://localhost:3000')
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(m,u,d=None):
    req=urllib.request.Request(B+'/api'+u,method=m,data=json.dumps(d).encode() if d is not None else None,headers={'Content-Type':'application/json'})
    with opener.open(req) as r: return json.load(r)
admin_email=os.environ.get('ADMIN_EMAIL','admin@rally.local')
admin_password=os.environ.get('ADMIN_PASSWORD') or getpass.getpass('Senha do administrador: ')
demo_password=os.environ.get('DEMO_PASSWORD') or getpass.getpass('Defina a senha do cabeça de demonstração: ')
if len(demo_password) < 8:
    raise SystemExit('Use pelo menos 8 caracteres para a senha de demonstração.')
api('POST','/auth/login',{'email':admin_email,'senha':admin_password})
rs=api('GET','/rallies')
if not rs:
    r=api('POST','/rallies',{'nome':'Rally das Tribos 2026','data_inicio':'2026-09-14','data_fim':'2026-12-13','status':'ativo'})
    rid=r['id']
    tribos=api('GET',f'/rallies/{rid}/tribos')
    nomes=['Ana Souza','Bruno Lima','Carla Dias','Daniel Rocha','Eduarda Melo','Felipe Alves','Gabriela Nunes','Henrique Costa','Isabela Ramos','João Pedro','Larissa Prado','Mateus Silva','Natália Gomes','Otávio Reis','Paula Freitas','Rafael Martins']
    ids=[api('POST','/pessoas',{'nome_completo':n,'apelido':n.split()[0]})['id'] for n in nomes]
    for i,t in enumerate(tribos[:4]):
        api('PATCH',f'/rally-tribos/{t["id"]}',{'cabeca_pessoa_id':ids[i*4],'auxiliar_pessoa_id':ids[i*4+1]})
        for pid in ids[i*4+2:i*4+4]: api('POST',f'/rally-tribos/{t["id"]}/membros',{'pessoa_id':pid})
    api('PUT',f'/pessoas/{ids[0]}/acesso',{'email':'ana@rally.local','senha':demo_password,'papel':'membro'})
    import random; random.seed(3)
    cats=api('GET','/categorias')
    for d in ['2026-09-20','2026-09-27','2026-10-04','2026-10-08']:
        for t in tribos:
            api('POST',f'/rallies/{rid}/lancamentos',{'rally_tribo_id':t['id'],'pontos':random.choice([500,1000,1500,2000,3000]),'motivo':'Presença no encontro','categoria_id':random.choice(cats)['id'],'data_referencia':d})
    m=api('POST',f'/rallies/{rid}/missoes',{'titulo':'Trazer convidados','descricao':'Cada convidado vale pontos','tipo_pontuacao':'quantidade','pontos':500,'limite_por_tribo':10,'data_inicio':'2026-10-01','data_limite':'2026-10-31','requer_aprovacao':True})
    api('POST',f'/missoes/{m["id"]}/entregas',{'rally_tribo_id':tribos[1]['id'],'quantidade':3,'observacao':'3 amigos vieram'})
    api('POST',f'/rallies/{rid}/dinamicas',{'rally_tribo_id':tribos[0]['id'],'titulo':'Gincana bíblica','tema':'Êxodo','data_encontro':'2026-10-10','pontos_previstos':2000})
    pv=api('POST',f'/rallies/{rid}/provas',{'titulo':'Quiz de Gênesis','modo':'tribo','max_tentativas':1})
    api('POST',f'/provas/{pv["id"]}/questoes',{'tipo':'multipla_escolha','enunciado':'Quem construiu a arca?','pontos':100,'alternativas':[{'texto':'Noé','correta':True},{'texto':'Moisés'},{'texto':'Abraão'}]})
    api('POST',f'/provas/{pv["id"]}/questoes',{'tipo':'aberta','enunciado':'O que Deus criou no primeiro dia?','pontos':200})
    api('PATCH',f'/provas/{pv["id"]}',{'status':'publicada'})
print('Demonstração disponível em '+B)
# O segundo quiz foi criado no teste de interface registrado pelo Devin.
rid=api('GET','/rallies')[0]['id']
if not any(p['titulo']=='Quiz Êxodo' for p in api('GET',f'/rallies/{rid}/provas')):
    p=api('POST',f'/rallies/{rid}/provas',{'titulo':'Quiz Êxodo','modo':'tribo','max_tentativas':1})
    qs=[
      {'tipo':'multipla_escolha','enunciado':'Pergunta multipla_escolha','alternativas':[{'texto':'Moisés','correta':True},{'texto':'Arão'}]},
      {'tipo':'verdadeiro_falso','enunciado':'Pergunta verdadeiro_falso','alternativas':[{'texto':'Verdadeiro','correta':True},{'texto':'Falso'}]},
      {'tipo':'complete','enunciado':'Pergunta complete','respostas_aceitas':['Luz','A luz']},
      {'tipo':'ordem','enunciado':'Pergunta ordem','alternativas':[{'texto':'Gênesis'},{'texto':'Êxodo'},{'texto':'Levítico'}]},
      {'tipo':'associacao','enunciado':'Pergunta associacao','pares':[{'a':'Moisés','b':'Sarça'},{'a':'Noé','b':'Arca'},{'a':'Davi','b':'Golias'}]},
    ]
    for q in qs: api('POST',f'/provas/{p["id"]}/questoes',{**q,'pontos':100})
    api('PATCH',f'/provas/{p["id"]}',{'status':'publicada'})
