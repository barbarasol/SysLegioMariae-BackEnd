import type {
  NextFunction,
  Response
} from 'express';
import * as membroService from '../services/membro.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';

/**
 * O req.query do Express pode trazer string, array ou objeto aninhado.
 * Como os filtros são escalares, extraímos apenas quando for string.
 */
function idUsuario(req: AuthenticatedRequest): string {
  const usuarioId = req.auth?.usuarioId;
  if (!usuarioId) {
    throw new HttpError(401, 'Sessão não autenticada.');
  }
  return String(usuarioId);
}

function queryString(valor: unknown): string | null {
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    return limpo === '' ? null : limpo;
  }

  return null;
}

/**
 * GET /api/membros
 * Filtros opcionais: ?busca=&status=&unidadeId=&categoria=
 */
export async function listar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filtros = {
      busca: queryString(req.query.busca),
      status: queryString(req.query.status),
      unidadeId: queryString(req.query.unidadeId),
      categoriaCodigo: queryString(req.query.categoria)
    };

    const membros = await membroService.listar(idUsuario(req), filtros);

    res.json(membros);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/membros/resumo
 * Contadores por status, para os cards da tela.
 */
export async function resumo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const contadores = await membroService.resumo(idUsuario(req));

    res.json(contadores);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/membros/catalogos
 * Categorias, cargos e unidades — alimenta os selects do formulário
 * numa única chamada.
 */
export async function catalogos(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dados = await membroService.catalogos(idUsuario(req));

    res.json(dados);
  } catch (error) {
    next(error);
  }
}

export async function criar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const solicitanteUsuarioId = idUsuario(req);

    const corpo = req.body ?? {};

    const resultado = await membroService.criar({
      nome: corpo.nome,
      nomePreferido: corpo.nomePreferido,
      cpf: corpo.cpf,
      rg: corpo.rg,
      dataNascimento: corpo.dataNascimento,
      email: corpo.email,
      celular: corpo.celular,
      telefone: corpo.telefone,

      dtRecrutamento: corpo.dtRecrutamento,
      dtIngresso: corpo.dtIngresso,
      dtCompromisso: corpo.dtCompromisso,
      formacaoEscolar: corpo.formacaoEscolar,
      aposentado: corpo.aposentado,
      pretoriano: corpo.pretoriano,
      adjutor: corpo.adjutor,
      mesc: corpo.mesc,
      catequista: corpo.catequista,
      coroinha: corpo.coroinha,
      status: corpo.status,
      observacao: corpo.observacao,

      unidadeId: corpo.unidadeId,
      categoriaCodigo: corpo.categoriaCodigo,
      principal: corpo.principal,
      dataInicio: corpo.dataInicio,

      cargoCodigo: corpo.cargoCodigo,
      numeroMandato: corpo.numeroMandato,

      solicitanteUsuarioId
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}


/** GET /api/membros/me — somente o próprio registro do usuário autenticado. */
export async function meuCadastro(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await membroService.meuCadastro(idUsuario(req)));
  } catch (error) { next(error); }
}

/** PATCH /api/membros/me — campos pessoais explicitamente autorizados. */
export async function atualizarMeuCadastro(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await membroService.atualizarMeuCadastro(idUsuario(req), req.body));
  } catch (error) { next(error); }
}
