import { api } from '../api.js';
import { ehAdmin, ehLider, somenteLeitura, estado } from '../estado.js';
import { esc, fmtData, definirTitulo, vazio, etiqueta, modal, aoEnviar, toast, confirmar, acao, on } from '../ui.js';
import { regraMissao, formMissao, ligarFormMissao, abrirEntrega, itemEntrega, ligarEntregas, TIPOS } from './missoes.js';
 
export default async function missao(el, { id }) {
  const m = await api('GET', `/missoes/${id}`);
  definirTitulo('Missão');
  const admin = ehAdmin();
  const editavel = !somenteLeitura();
  const tribosNomes = m.todas_tribos ? 'Todas as tribos' : estado.tribos.filter((t) => m.tribos.includes(t.id)).map((t) => t.nome).join(', ');
 
  el.innerHTML = `<div class="cartao">
      <div class="linha linha--entre"><h1 style="margin:0">${esc(m.titulo)}</h1>${etiqueta(m.status)}</div>
      ${m.descricao ? `<p class="quebra" style="white-space:pre-line">${esc(m.descricao)}</p>` : ''}
      <ul class="lista">
        <li><span class="cresce suave">Pontuação</span><b class="direita">${esc(regraMissao(m))}</b></li>
        <li><span class="cresce suave">Tipo</span><span class="direita">${esc(TIPOS[m.tipo_pontuacao])}</span></li>
        <li><span class="cresce suave">Período</span><span>${fmtData(m.data_inicio)}${m.data_limite ? ` a ${fmtData(m.data_limite)}` : ''}</span></li>
        <li><span class="cresce suave">Categoria</span><span>${esc(m.categoria_nome || 'Missões especiais')}</span></li>
        <li><span class="cresce suave">Tribos</span><span class="direita">${esc(tribosNomes)}</span></li>
        ${admin ? `<li><span class="cresce suave">Aprovação</span><span>${m.requer_aprovacao ? 'Obrigatória' : 'Automática'}</span></li>` : ''}
      </ul>
      ${m.observacoes ? `<p class="suave pequeno quebra">${esc(m.observacoes)}</p>` : ''}
      <div class="botoes" style="margin-top:.7rem">
        ${editavel && m.status === 'aberta' && (admin || ehLider()) ? `<button class="btn btn--ouro" id="enviar">${admin ? 'Registrar resultado' : 'Enviar resultado'}</button>` : ''}
        ${admin && editavel ? `<button class="btn" id="editar">Editar</button>
          ${m.status === 'aberta' ? '<button class="btn" data-status="encerrada">Encerrar</button><button class="btn btn--perigo" data-status="cancelada">Cancelar</button>' : '<button class="btn" data-status="aberta">Reabrir</button>'}` : ''}
      </div></div>
    <div class="secao-titulo"><h2>${admin ? 'Entregas das tribos' : 'Entregas da minha tribo'}</h2></div>
    <div class="cartao">${m.entregas.length ? `<ul class="lista" id="entregas">${m.entregas.map((e) => itemEntrega(e, { admin })).join('')}</ul>` : vazio('Nenhuma entrega ainda.')}</div>`;
 
  const recarregar = () => missao(el, { id });
  el.querySelector('#enviar')?.addEventListener('click', () => abrirEntrega(m, recarregar));
  el.querySelector('#editar')?.addEventListener('click', () => modal({
    titulo: 'Editar missão',
    html: formMissao(m),
    aoAbrir: (mm, fechar) => {
      ligarFormMissao(mm);
      aoEnviar(mm.querySelector('form'), async (d) => {
        await api('PATCH', `/missoes/${m.id}`, d);
        toast('Missão atualizada.');
        fechar();
        recarregar();
      });
    },
  }));
  on(el, 'click', '[data-status]', async (b) => {
    const st = b.dataset.status;
    const rot = { encerrada: 'Encerrar', cancelada: 'Cancelar', aberta: 'Reabrir' }[st];
    const ok = await confirmar({
      titulo: `${rot} missão`, botao: rot, perigo: st === 'cancelada',
      mensagem: st === 'cancelada' ? '<p>A missão some para as tribos. Pontos já aprovados continuam valendo (cancele-os pelas entregas, se precisar).</p>' : `<p>${rot} esta missão?</p>`,
    });
    if (ok) await acao(b, async () => { await api('PATCH', `/missoes/${m.id}`, { status: st }); recarregar(); });
  });
  const lista = el.querySelector('#entregas');
  if (lista && admin) ligarEntregas(lista, m.entregas, () => m, recarregar);
}
