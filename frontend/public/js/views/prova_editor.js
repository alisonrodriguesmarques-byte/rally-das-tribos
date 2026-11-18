import { api } from '../api.js';
import { esc, modal, opcoes, toast, tratarErro } from '../ui.js';
 
export const TIPOS_Q = {
  multipla_escolha: 'Múltipla escolha', verdadeiro_falso: 'Verdadeiro ou falso', complete: 'Complete o versículo',
  aberta: 'Pergunta aberta (correção manual)', associacao: 'Associação (ligar pares)', ordem: 'Colocar em ordem',
};
 
export function gabarito(q) {
  const alts = q.alternativas || [];
  switch (q.tipo) {
    case 'multipla_escolha':
    case 'verdadeiro_falso': return `Resposta: ${esc(alts.find((a) => a.correta)?.texto || '—')}`;
    case 'complete': return `Aceitas: ${(q.respostas_aceitas || []).map((a) => esc(a.texto)).join(' / ')}`;
    case 'ordem': return `Ordem: ${[...alts].sort((a, b) => a.posicao_correta - b.posicao_correta).map((a) => esc(a.texto)).join(' → ')}`;
    case 'associacao': return alts.filter((x) => x.lado === 'A').map((x) => `${esc(x.texto)} ↔ ${esc(alts.find((b) => b.lado === 'B' && b.par_chave === x.par_chave)?.texto || '')}`).join('; ');
    default: return 'Correção manual';
  }
}
 
const linhaAlt = (a = {}, i = 0) => `<div class="linha" style="margin-bottom:.4rem"><input type="radio" name="correta" value="${i}"${a.correta ? ' checked' : ''} aria-label="Correta" style="width:auto">
  <input class="cresce" data-alt value="${esc(a.texto || '')}" placeholder="Alternativa ${i + 1}"></div>`;
const linhaPar = (p = {}) => `<div class="linha" style="margin-bottom:.4rem"><input class="cresce" data-a value="${esc(p.a || '')}" placeholder="Ex.: Moisés"><span>↔</span><input class="cresce" data-b value="${esc(p.b || '')}" placeholder="Ex.: Mar Vermelho"></div>`;
 
function editorItens(tipo, q = {}) {
  const alts = q.tipo === tipo ? (q.alternativas || []) : [];
  if (tipo === 'multipla_escolha') {
    const linhas = alts.length ? alts : [{}, {}, {}, {}];
    return `<p class="suave" style="margin:.2rem 0">Alternativas (marque a correta)</p><div id="alts">${linhas.map(linhaAlt).join('')}</div>
      <button type="button" class="btn btn--peq" id="mais-alt">+ Alternativa</button>`;
  }
  if (tipo === 'verdadeiro_falso') {
    const v = alts.find((a) => a.texto === 'Verdadeiro');
    const c = v && !v.correta ? 'F' : 'V';
    return `<p class="suave" style="margin:.2rem 0">Resposta correta</p>
      <label class="opcao"><input type="radio" name="vf" value="V"${c === 'V' ? ' checked' : ''}> Verdadeiro</label>
      <label class="opcao"><input type="radio" name="vf" value="F"${c === 'F' ? ' checked' : ''}> Falso</label>`;
  }
  if (tipo === 'complete') {
    return `<label class="campo"><span>Respostas aceitas (uma por linha)</span><textarea name="aceitas" placeholder="mundo">${esc((q.tipo === tipo ? q.respostas_aceitas || [] : []).map((a) => a.texto).join('\n'))}</textarea>
      <small>Acentos, maiúsculas e pontuação são ignorados na correção.</small></label>`;
  }
  if (tipo === 'ordem') {
    const itens = [...alts].sort((a, b) => a.posicao_correta - b.posicao_correta).map((a) => a.texto).join('\n');
    return `<label class="campo"><span>Itens na ordem CORRETA (um por linha)</span><textarea name="itens" placeholder="Gênesis&#10;Êxodo&#10;Levítico">${esc(itens)}</textarea>
      <small>Para quem responde, os itens aparecem embaralhados. Pontuação proporcional aos acertos.</small></label>`;
  }
  if (tipo === 'associacao') {
    const a = alts.filter((x) => x.lado === 'A');
    const pares = a.length ? a.map((x) => ({ a: x.texto, b: alts.find((y) => y.lado === 'B' && y.par_chave === x.par_chave)?.texto })) : [{}, {}, {}];
    return `<p class="suave" style="margin:.2rem 0">Pares corretos</p><div id="pares">${pares.map(linhaPar).join('')}</div>
      <button type="button" class="btn btn--peq" id="mais-par">+ Par</button><p class="suave pequeno">Pontuação proporcional aos pares certos.</p>`;
  }
  return '<p class="suave">Quem responde escreve livremente. Você corrige depois, na aba Resultados.</p>';
}
 
function lerQuestao(form) {
  const tipo = form.elements.tipo.value;
  const d = {
    tipo,
    enunciado: form.elements.enunciado.value.trim(),
    referencia_biblica: form.elements.referencia_biblica.value.trim(),
    pontos: form.elements.pontos.value,
    imagem_url: form.elements.imagem_url.value.trim(),
    video_url: form.elements.video_url.value.trim(),
  };
  if (tipo === 'multipla_escolha') {
    const correta = form.querySelector('[name=correta]:checked')?.value;
    d.alternativas = [...form.querySelectorAll('[data-alt]')].map((x, i) => ({ texto: x.value.trim(), correta: String(i) === correta })).filter((a) => a.texto);
  } else if (tipo === 'verdadeiro_falso') {
    const v = form.querySelector('[name=vf]:checked')?.value || 'V';
    d.alternativas = [{ texto: 'Verdadeiro', correta: v === 'V' }, { texto: 'Falso', correta: v === 'F' }];
  } else if (tipo === 'complete') {
    d.respostas_aceitas = form.elements.aceitas.value.split('\n').map((s) => s.trim()).filter(Boolean);
  } else if (tipo === 'ordem') {
    d.alternativas = form.elements.itens.value.split('\n').map((s) => s.trim()).filter(Boolean).map((texto) => ({ texto }));
  } else if (tipo === 'associacao') {
    d.pares = [...form.querySelectorAll('#pares > div')].map((l) => ({ a: l.querySelector('[data-a]').value.trim(), b: l.querySelector('[data-b]').value.trim() }));
  }
  return d;
}
 
export function abrirQuestao(provaId, q, aoSalvar) {
  modal({
    titulo: q ? 'Editar questão' : 'Nova questão',
    html: `<form>
      <label class="campo"><span>Tipo</span><select name="tipo">${opcoes(Object.entries(TIPOS_Q), q?.tipo || 'multipla_escolha')}</select></label>
      <label class="campo"><span>Enunciado *</span><textarea name="enunciado" required>${esc(q?.enunciado || '')}</textarea></label>
      <div class="grade"><label class="campo"><span>Referência bíblica</span><input name="referencia_biblica" maxlength="80" value="${esc(q?.referencia_biblica || '')}" placeholder="Jo 3:16"></label>
      <label class="campo"><span>Pontos *</span><input name="pontos" type="number" min="0" step="1" required value="${q?.pontos ?? 100}"></label></div>
      <div id="itens"></div>
      <details style="margin:.6rem 0"><summary class="suave">Imagem ou vídeo (opcional)</summary>
        <label class="campo"><span>Link da imagem</span><input name="imagem_url" type="url" value="${esc(q?.imagem_url || '')}"></label>
        <label class="campo"><span>Link do vídeo</span><input name="video_url" type="url" value="${esc(q?.video_url || '')}"></label></details>
      <button class="btn btn--primario btn--bloco" type="submit">Salvar questão</button></form>`,
    aoAbrir: (el, fechar) => {
      const form = el.querySelector('form');
      const itens = el.querySelector('#itens');
      const desenhar = () => { itens.innerHTML = editorItens(form.elements.tipo.value, q || {}); };
      form.elements.tipo.addEventListener('change', desenhar);
      desenhar();
      itens.addEventListener('click', (e) => {
        if (e.target.id === 'mais-alt') itens.querySelector('#alts').insertAdjacentHTML('beforeend', linhaAlt({}, itens.querySelectorAll('[data-alt]').length));
        if (e.target.id === 'mais-par') itens.querySelector('#pares').insertAdjacentHTML('beforeend', linhaPar());
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        try {
          const d = lerQuestao(form);
          if (q) await api('PATCH', `/questoes/${q.id}`, d);
          else await api('POST', `/provas/${provaId}/questoes`, d);
          toast('Questão salva.');
          fechar();
          aoSalvar();
        } catch (err) {
          tratarErro(err, form);
          btn.disabled = false;
        }
      });
    },
  });
}
