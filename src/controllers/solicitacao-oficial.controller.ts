import type {
  NextFunction,
  Request,
  Response
} from 'express';
import * as service from '../services/solicitacao-oficial.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';

/** Normaliza valor de query para string ou null. */
function queryString(valor: unknown): string | null {
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    return limpo === '' ? null : limpo;
  }

  return null;
}

function usuarioAutenticado(req: AuthenticatedRequest): string {
  const usuarioId = req.auth?.usuarioId;

  if (!usuarioId) {
    throw new HttpError(401, 'Sessao nao autenticada.');
  }

  return String(usuarioId);
}

export async function listar(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dados = await service.listar({
      status: queryString(req.query.status),
      unidadeId: queryString(req.query.unidadeId),
      busca: queryString(req.query.busca)
    });

    res.json(dados);
  } catch (error) {
    next(error);
  }
}

export async function resumo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await service.resumo());
  } catch (error) {
    next(error);
  }
}

export async function catalogos(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await service.catalogos());
  } catch (error) {
    next(error);
  }
}

export async function buscarMembros(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const busca = queryString(req.query.busca) ?? '';
    res.json(await service.buscarMembros(busca));
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
    const corpo = req.body ?? {};

    const dados = await service.criar({
      origem: corpo.origem,
      membroId: corpo.membroId ?? null,

      pessoaNome: corpo.pessoaNome ?? null,
      pessoaNomePreferido: corpo.pessoaNomePreferido ?? null,
      pessoaCpf: corpo.pessoaCpf ?? null,
      pessoaDataNascimento: corpo.pessoaDataNascimento ?? null,
      pessoaEmail: corpo.pessoaEmail ?? null,
      pessoaCelular: corpo.pessoaCelular ?? null,
      pessoaTelefone: corpo.pessoaTelefone ?? null,

      dtIngresso: corpo.dtIngresso ?? null,
      dtCompromisso: corpo.dtCompromisso ?? null,
      pretoriano: corpo.pretoriano === true,
      adjutor: corpo.adjutor === true,
      mesc: corpo.mesc === true,
      catequista: corpo.catequista === true,
      coroinha: corpo.coroinha === true,

      unidadeId: corpo.unidadeId,
      cargoId: corpo.cargoId,
      numeroMandato: corpo.numeroMandato ?? null,
      dataInicio: corpo.dataInicio,
      dataFim: corpo.dataFim ?? null,

      justificativa: corpo.justificativa ?? null,

      solicitanteUsuarioId: usuarioAutenticado(req)
    });

    res.status(201).json(dados);
  } catch (error) {
    next(error);
  }
}

export async function aprovar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');

    const dados = await service.aprovar(
      id,
      usuarioAutenticado(req),
      req.body?.resposta ?? null
    );

    res.json(dados);
  } catch (error) {
    next(error);
  }
}

export async function rejeitar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');

    const dados = await service.rejeitar(
      id,
      usuarioAutenticado(req),
      req.body?.resposta ?? null
    );

    res.json(dados);
  } catch (error) {
    next(error);
  }
}
