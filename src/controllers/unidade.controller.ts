import type {
  NextFunction,
  Response
} from 'express';
import * as unidadeService from '../services/unidade.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';

function exigirUsuarioId(req: AuthenticatedRequest): string {
  const usuarioId = req.auth?.usuarioId;

  if (!usuarioId) {
    throw new HttpError(401, 'Sessão não autenticada.');
  }

  return String(usuarioId);
}

export async function criar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const solicitanteUsuarioId = exigirUsuarioId(req);

    const {
      tipoCodigo,
      nome,
      nomeReduzido,
      email,
      celular,
      telefone,
      site,
      municipioId,
      igrejaId,
      dataConstituicao,
      diaReuniaoId,
      horarioInicioReuniao,
      horarioFimReuniao,
      fusoHorario,
      unidadeSuperiorId,
      observacao
    } = req.body ?? {};

    const resultado = await unidadeService.criar({
      tipoCodigo,
      nome,
      nomeReduzido,
      email,
      celular,
      telefone,
      site,
      municipioId,
      igrejaId,
      dataConstituicao,
      diaReuniaoId,
      horarioInicioReuniao,
      horarioFimReuniao,
      fusoHorario,
      unidadeSuperiorId,
      observacao,
      solicitanteUsuarioId
    });

    res.status(201).json(resultado);
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
    const tipo = String(req.query.tipo ?? '').trim();
    res.json(await unidadeService.listar(tipo || null));
  } catch (error) {
    next(error);
  }
}

export async function listarTipos(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await unidadeService.listarTipos());
  } catch (error) {
    next(error);
  }
}

export async function listarDiasReuniao(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(
      await unidadeService.listarDiasReuniao(
        req.query.q
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function listarFusosHorarios(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(
      await unidadeService.listarFusosHorarios(
        req.query.q
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function listarPaises(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await unidadeService.listarPaises());
  } catch (error) {
    next(error);
  }
}

export async function listarUfs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(
      await unidadeService.listarUfs(
        req.query.paisId,
        req.query.q
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function criarUf(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirUsuarioId(req);

    const resultado = await unidadeService.criarUf({
      paisId: req.body?.paisId,
      nome: req.body?.nome,
      sigla: req.body?.sigla,
      codigoIso: req.body?.codigoIso
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

export async function listarMunicipios(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(
      await unidadeService.listarMunicipios(
        req.query.ufId,
        req.query.q
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function criarMunicipio(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    exigirUsuarioId(req);

    const resultado = await unidadeService.criarMunicipio({
      ufId: req.body?.ufId,
      nome: req.body?.nome
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

export async function listarSubdivisoesLocais(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(
      await unidadeService.listarSubdivisoesLocais(
        req.query.municipioId,
        req.query.q
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function criarSubdivisaoLocal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = exigirUsuarioId(req);

    const resultado = await unidadeService.criarSubdivisaoLocal({
      municipioId: req.body?.municipioId,
      nome: req.body?.nome,
      tipo: req.body?.tipo,
      codigo: req.body?.codigo,
      usuarioId
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

export async function buscarCodigosPostais(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resultados = await unidadeService.buscarCodigosPostais(
      req.query.paisId,
      req.query.codigoPostal,
      req.query.municipioId
    );

    res.json({
      encontrado: resultados.length > 0,
      quantidade: resultados.length,
      resultados
    });
  } catch (error) {
    next(error);
  }
}

export async function criarCodigoPostal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = exigirUsuarioId(req);

    const resultado = await unidadeService.criarCodigoPostal({
      paisId: req.body?.paisId,
      municipioId: req.body?.municipioId,
      subdivisaoLocalId: req.body?.subdivisaoLocalId,
      codigoPostal: req.body?.codigoPostal,
      tipoLogradouro: req.body?.tipoLogradouro,
      logradouro: req.body?.logradouro,
      bairro: req.body?.bairro,
      localidade: req.body?.localidade,
      usuarioId
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

export async function listarIgrejas(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(
      await unidadeService.listarIgrejas(
        req.query.municipioId,
        req.query.subdivisaoLocalId
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function criarIgreja(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = exigirUsuarioId(req);

    const {
      nome,
      padre,
      municipioId,
      subdivisaoLocalId,
      codigoPostalId,
      codigoPostal,
      tipoLogradouro,
      logradouro,
      bairro,
      localidade,
      numeroLogradouro,
      complemento,
      celular,
      telefone,
      telefone2,
      email,
      site
    } = req.body ?? {};

    const igreja = await unidadeService.criarIgreja({
      nome,
      padre,
      municipioId,
      subdivisaoLocalId,
      codigoPostalId,
      codigoPostal,
      tipoLogradouro,
      logradouro,
      bairro,
      localidade,
      numeroLogradouro,
      complemento,
      celular,
      telefone,
      telefone2,
      email,
      site,
      usuarioId
    });

    res.status(201).json(igreja);
  } catch (error) {
    next(error);
  }
}

export async function listarEstrutura(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await unidadeService.listarEstrutura());
  } catch (error) {
    next(error);
  }
}

export async function obterPorId(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(await unidadeService.obterPorId(req.params.id));
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
    const usuarioId = exigirUsuarioId(req);
    const {
      tipoCodigo,
      nome,
      nomeReduzido,
      email,
      celular,
      telefone,
      site,
      municipioId,
      igrejaId,
      dataConstituicao,
      diaReuniaoId,
      horarioInicioReuniao,
      horarioFimReuniao,
      fusoHorario,
      unidadeSuperiorId,
      observacao
    } = req.body ?? {};

    const resultado = await unidadeService.atualizar(
      req.params.id,
      {
        tipoCodigo,
        nome,
        nomeReduzido,
        email,
        celular,
        telefone,
        site,
        municipioId,
        igrejaId,
        dataConstituicao,
        diaReuniaoId,
        horarioInicioReuniao,
        horarioFimReuniao,
        fusoHorario,
        unidadeSuperiorId,
        observacao,
        usuarioId
      }
    );

    res.json(resultado);
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
    const usuarioId = exigirUsuarioId(req);
    await unidadeService.excluirLogicamente(req.params.id, usuarioId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

