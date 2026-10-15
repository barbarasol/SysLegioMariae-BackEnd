import type {
  NextFunction,
  Response
} from 'express';

import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';

import type {
  FiltrosListarUsuarios
} from '../services/usuario.service.js';

import * as usuarioService
  from '../services/usuario.service.js';

import {
  HttpError
} from '../utils/http-error.js';

function obterQueryString(
  valor: unknown
): string | undefined {

  if (
    typeof valor === 'string'
  ) {
    return valor;
  }

  if (
    Array.isArray(valor) &&
    typeof valor[0] === 'string'
  ) {
    return valor[0];
  }

  return undefined;
}

function obterCampoOrdenacao(
  valor: unknown
):
FiltrosListarUsuarios['ordenarPor'] {

  const campo =
    obterQueryString(
      valor
    );

  if (
    campo === 'nome' ||
    campo === 'cpf' ||
    campo === 'celular' ||
    campo === 'email'
  ) {
    return campo;
  }

  return undefined;
}

function obterDirecaoOrdenacao(
  valor: unknown
):
FiltrosListarUsuarios['direcao'] {

  const direcao =
    obterQueryString(
      valor
    )?.toLowerCase();

  return direcao === 'desc'
    ? 'desc'
    : 'asc';
}

function obterIdParametro(
  valor: unknown
): string {

  const id =
    typeof valor === 'string'
      ? valor.trim()
      : '';

  if (
    !id ||
    !/^\d+$/.test(id)
  ) {
    throw new HttpError(
      400,
      'Identificador do usuário inválido.'
    );
  }

  return id;
}

function exigirAutenticacao(
  req: AuthenticatedRequest
): string {

  const usuarioId =
    req.auth?.usuarioId;

  if (!usuarioId) {
    throw new HttpError(
      401,
      'Sessão não autenticada.'
    );
  }

  return String(
    usuarioId
  );
}

export async function listarPerfisGlobais(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirAutenticacao(
      req
    );

    const perfis =
      await usuarioService
        .listarPerfisGlobais();

    res.status(200).json({
      perfis
    });
  } catch (error) {
    next(error);
  }
}


function obterParametroCodigo(
  valor: unknown,
  campo: string
): string {

  const codigo =
    typeof valor === 'string'
      ? valor
          .trim()
          .toUpperCase()
      : '';

  if (
    !codigo ||
    !/^[A-Z0-9_]+$/.test(
      codigo
    )
  ) {
    throw new HttpError(
      400,
      `${campo} inválido.`
    );
  }

  return codigo;
}

function obterParametroIdNumerico(
  valor: unknown,
  campo: string
): string {

  const id =
    typeof valor === 'string'
      ? valor.trim()
      : '';

  if (
    !id ||
    !/^\d+$/.test(id)
  ) {
    throw new HttpError(
      400,
      `${campo} inválido.`
    );
  }

  return id;
}

export async function listarPerfisUnidade(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirAutenticacao(
      req
    );

    const perfis =
      await usuarioService
        .listarPerfisUnidade();

    res.status(200).json({
      perfis
    });
  } catch (error) {
    next(error);
  }
}

export async function listarUnidadesDisponiveis(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirAutenticacao(
      req
    );

    const unidades =
      await usuarioService
        .listarUnidadesDisponiveis();

    res.status(200).json({
      unidades
    });
  } catch (error) {
    next(error);
  }
}

export async function listarAcessosUnidade(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirAutenticacao(
      req
    );

    const usuarioId =
      obterIdParametro(
        req.params.id
      );

    const acessos =
      await usuarioService
        .listarAcessosUnidade(
          usuarioId
        );

    res.status(200).json({
      acessos
    });
  } catch (error) {
    next(error);
  }
}

export async function adicionarAcessoUnidade(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioAutenticadoId =
      exigirAutenticacao(
        req
      );

    const usuarioId =
      obterIdParametro(
        req.params.id
      );

    const {
      unidadeId,
      perfilCodigo,
      observacao
    } = req.body ?? {};

    const acesso =
      await usuarioService
        .adicionarAcessoUnidade(
          usuarioId,
          {
            unidadeId,
            perfilCodigo,
            observacao
          },
          usuarioAutenticadoId
        );

    res.status(201).json({
      acesso
    });
  } catch (error) {
    next(error);
  }
}

export async function alterarAcessoUnidade(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioAutenticadoId =
      exigirAutenticacao(
        req
      );

    const usuarioId =
      obterIdParametro(
        req.params.id
      );

    const unidadeIdAtual =
      obterParametroIdNumerico(
        req.params.unidadeId,
        'Identificador da unidade'
      );

    const perfilCodigoAtual =
      obterParametroCodigo(
        req.params.perfilCodigo,
        'Perfil da unidade'
      );

    const {
      unidadeId,
      perfilCodigo,
      observacao
    } = req.body ?? {};

    const acesso =
      await usuarioService
        .alterarAcessoUnidade(
          usuarioId,
          unidadeIdAtual,
          perfilCodigoAtual,
          {
            unidadeId,
            perfilCodigo,
            observacao
          },
          usuarioAutenticadoId
        );

    res.status(200).json({
      acesso
    });
  } catch (error) {
    next(error);
  }
}

export async function removerAcessoUnidade(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioAutenticadoId =
      exigirAutenticacao(
        req
      );

    const usuarioId =
      obterIdParametro(
        req.params.id
      );

    const unidadeId =
      obterParametroIdNumerico(
        req.params.unidadeId,
        'Identificador da unidade'
      );

    const perfilCodigo =
      obterParametroCodigo(
        req.params.perfilCodigo,
        'Perfil da unidade'
      );

    await usuarioService
      .removerAcessoUnidade(
        usuarioId,
        unidadeId,
        perfilCodigo,
        usuarioAutenticadoId
      );

    res.status(200).json({
      message:
        'Acesso à unidade removido com sucesso.'
    });
  } catch (error) {
    next(error);
  }
}

export async function listar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirAutenticacao(
      req
    );

    const resultado =
      await usuarioService.listar({
        nome:
          obterQueryString(
            req.query.nome
          ),

        cpf:
          obterQueryString(
            req.query.cpf
          ),

        celular:
          obterQueryString(
            req.query.celular
          ),

        email:
          obterQueryString(
            req.query.email
          ),

        ordenarPor:
          obterCampoOrdenacao(
            req.query.ordenarPor
          ),

        direcao:
          obterDirecaoOrdenacao(
            req.query.direcao
          )
      });

    res.status(200).json({
      usuarios:
        resultado
    });
  } catch (error) {
    next(error);
  }
}

export async function atualizar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioAutenticadoId =
      exigirAutenticacao(
        req
      );

    const usuarioId =
      obterIdParametro(
        req.params.id
      );

    const {
      nome,
      nomePreferido,
      cpf,
      celular,
      email,
      status,
      perfilCodigo
    } = req.body ?? {};

    if (
      usuarioId ===
        usuarioAutenticadoId &&
      status &&
      String(status)
        .toUpperCase() !==
        'ATIVO'
    ) {
      throw new HttpError(
        400,
        'Você não pode bloquear ou inativar o próprio usuário.'
      );
    }

    const usuario =
      await usuarioService
        .atualizar(
          usuarioId,
          {
            nome,
            nomePreferido,
            cpf,
            celular,
            email,
            status,
            perfilCodigo
          }
        );

    res.status(200).json({
      usuario
    });
  } catch (error) {
    next(error);
  }
}

export async function excluir(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioAutenticadoId =
      exigirAutenticacao(
        req
      );

    const usuarioId =
      obterIdParametro(
        req.params.id
      );

    if (
      usuarioId ===
      usuarioAutenticadoId
    ) {
      throw new HttpError(
        400,
        'Você não pode excluir o próprio usuário.'
      );
    }

    await usuarioService.excluir(
      usuarioId
    );

    res.status(200).json({
      message:
        'Usuário excluído com sucesso.'
    });
  } catch (error) {
    next(error);
  }
}

export async function cadastroPublico(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      nome,
      email,
      senha,
      nomePreferido,
      cpf,
      celular
    } = req.body ?? {};

    const resultado =
      await usuarioService.criar({
        nome,
        email,
        senha,
        nomePreferido,
        cpf,
        celular
      });

    res.status(201).json(
      resultado
    );
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
    exigirAutenticacao(
      req
    );

    const {
      nome,
      email,
      senha,
      nomePreferido,
      cpf,
      celular
    } = req.body ?? {};

    const resultado =
      await usuarioService.criar({
        nome,
        email,
        senha,
        nomePreferido,
        cpf,
        celular
      });

    res.status(201).json(
      resultado
    );
  } catch (error) {
    next(error);
  }
}
