// Envio por e-mail removido. Mantém interface inerte por compatibilidade,
// inclusive se variáveis antigas ainda estiverem configuradas no provedor.
module.exports={configuracao:()=>null,iniciarWorker:()=>()=>{},processarFila:async()=>({processadas:0}),criarTransport:()=>{throw Error('Envio por e-mail removido.');}};
