const service=require('../services/notificacoesService');
const {idParam}=require('./_helpers');
module.exports={
 async contar(req,res){res.json(await service.contar(req.usuario.id));},
 async listar(req,res){res.json(await service.listar(req.usuario.id,req.query.nao_lidas==='true'));},
 async ler(req,res){res.json(await service.ler(req.usuario.id,idParam(req)));},
 async lerTodas(req,res){res.json(await service.lerTodas(req.usuario.id));},
 async preferencias(req,res){res.json(await service.preferencias(req.usuario.id));},
 async atualizarPreferencias(req,res){res.json(await service.atualizarPreferencias(req.usuario.id,req.body||{}));},
 async criarAviso(req,res){res.status(201).json(await service.criarAviso(req.body||{},req.usuario));},
};
