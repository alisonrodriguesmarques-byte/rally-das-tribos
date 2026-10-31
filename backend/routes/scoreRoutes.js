'use strict';
const express=require('express');
module.exports=(service,auth)=>{const r=express.Router();r.use(auth.requireSession,auth.requireAdmin,auth.requireCsrf);
r.get('/:id',async(req,res,next)=>{try{res.json({success:true,data:await service.view(req.auth.user.id,req.params.id)});}catch(e){next(e);}});
r.post('/:id',async(req,res,next)=>{try{res.status(201).json({success:true,data:await service.mutate(req.auth.user.id,req.params.id,req.body)});}catch(e){next(e);}});
r.post('/:id/:score/corrigir',async(req,res,next)=>{try{res.json({success:true,data:await service.mutate(req.auth.user.id,req.params.id,req.body,req.params.score)});}catch(e){next(e);}});return r;};
