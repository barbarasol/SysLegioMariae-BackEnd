import type {NextFunction,Response} from 'express';
import type {AuthenticatedRequest} from '../middlewares/auth.middleware.js';
import {HttpError} from '../utils/http-error.js';
import * as svc from '../services/tesouraria.service.js';

function uid(req:AuthenticatedRequest):string {
  if(!req.auth?.usuarioId) throw new HttpError(401,'Não autenticado.');
  return String(req.auth.usuarioId);
}
const q=(v:unknown)=> typeof v==='string'?v:'';
function handler(fn:(req:AuthenticatedRequest)=>Promise<unknown>) {
  return async (req:AuthenticatedRequest,res:Response,next:NextFunction):Promise<void>=>{
    try{ res.json(await fn(req)); }catch(error){next(error);}
  };
}
export const unidades=handler(req=>svc.minhasUnidades(uid(req)));
export const catalogos=handler(req=>svc.catalogos(uid(req),q(req.query.unidadeId)));
export const reunioes=handler(req=>svc.listarReunioes(uid(req),q(req.query.unidadeId)));
export const lancamentos=handler(req=>svc.lancamentos(uid(req),q(req.query.unidadeId),q(req.query.reuniaoId)));
export const novaReuniao=handler(req=>svc.criarReuniao(uid(req),req.body ?? {}));
export const novaConta=handler(req=>svc.criarConta(uid(req),req.body ?? {}));
export const novoLancamento=handler(req=>svc.criarLancamento(uid(req),req.body ?? {}));
export const fechar=handler(req=>svc.fecharReuniao(uid(req),String(req.body?.unidadeId??''),String(req.body?.reuniaoId??'')));

export const consultarSaldoImplantacao=handler(req=>svc.saldoImplantacao(uid(req),q(req.query.unidadeId)));
export const novoSaldoImplantacao=handler(req=>svc.criarSaldoImplantacao(uid(req),req.body??{}));

export const fontes=handler(req=>svc.listarFontes(uid(req),q(req.query.unidadeId)));
export const novaFonte=handler(req=>svc.criarFonte(uid(req),req.body??{}));
export const editarFonte=handler(req=>svc.atualizarFonte(uid(req),String(req.params.id??''),req.body??{}));

export const fornecedores=handler(req=>svc.listarFornecedores(uid(req),q(req.query.unidadeId)));
export const novoFornecedor=handler(req=>svc.criarFornecedor(uid(req),req.body??{}));
export const editarFornecedor=handler(req=>svc.atualizarFornecedor(uid(req),String(req.params.id??''),req.body??{}));
