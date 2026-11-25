import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

const S = 'legio';
type Perfil = 'CONSULTA'|'LANCAMENTO'|'GESTOR';
type Linha = Record<string, unknown>;

function id(v: unknown, rotulo = 'Identificador'): string {
  const s = String(v ?? '');
  if (!/^[1-9]\d*$/.test(s)) throw new HttpError(400, `${rotulo} inválido.`);
  return s;
}
function data(v: unknown, rotulo = 'Data'): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      Number.isNaN(Date.parse(`${v}T12:00:00Z`)) || new Date(`${v}T12:00:00Z`).toISOString().slice(0,10) !== v) {
    throw new HttpError(400, `${rotulo} inválida.`);
  }
  return v;
}
function texto(v: unknown, nome: string, max = 500): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new HttpError(400, `${nome} obrigatório ou muito longo.`);
  return v.trim();
}
function opcional(v: unknown, max=500): string | null { return typeof v === 'string' && v.trim() ? v.trim().slice(0,max) : null; }
function valor(v: unknown): string {
  const s = String(v ?? '');
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(s) || Number(s) <= 0) throw new HttpError(400, 'Valor inválido (use ponto decimal).');
  return s;
}
function em<T>(v: unknown, validos: readonly T[], nome: string): T {
  if (!validos.includes(v as T)) throw new HttpError(400, `${nome} inválido.`);
  return v as T;
}
async function consultar<T extends object>(sql: string, replacements: Record<string,unknown> = {}, transaction?: Transaction): Promise<T[]> {
  return sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT, transaction });
}
/** Perfil global consultado diretamente no banco; não confiar em papéis enviados pelo cliente. */
async function ehPlatformOwner(usuarioId: string, transaction?: Transaction): Promise<boolean> {
  const linhas = await consultar<{ permitido: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM legio.usuario u
      JOIN legio.usuario_perfil_global upg ON upg.usuario_id = u.id
      JOIN legio.perfil_acesso pa ON pa.id = upg.perfil_id
      WHERE u.id = CAST(:usuario AS bigint) AND u.status = 'ATIVO'
        AND pa.codigo = 'PLATFORM_OWNER' AND pa.escopo = 'GLOBAL'
        AND pa.ativo = TRUE
    ) AS permitido`, { usuario: id(usuarioId) }, transaction);
  return linhas[0]?.permitido === true;
}

async function autorizado(usuarioId: string, unidadeId: string, escrita = false, transaction?: Transaction): Promise<Perfil> {
  const usuario = id(usuarioId);
  const unidade = id(unidadeId);
  if (await ehPlatformOwner(usuario, transaction)) {
    // PLATFORM_OWNER é gestor financeiro global, somente para unidades existentes e ativas.
    const existente = await consultar<{ id: string }>(`
      SELECT id::text AS id FROM ${S}.unidade_legionaria
      WHERE id = :unidade AND ativo = TRUE LIMIT 1`, { unidade }, transaction);
    if (!existente.length) throw new HttpError(404, 'Unidade não encontrada ou inativa.');
    return 'GESTOR';
  }
  const linhas = await consultar<{perfil: Perfil}>(`
    SELECT perfil FROM ${S}.tesouraria_permissao_unidade
    WHERE usuario_id = :usuario AND unidade_id = :unidade AND ativo = TRUE
      AND revogado_em IS NULL LIMIT 1`, {usuario, unidade}, transaction);
  const perfil = linhas[0]?.perfil;
  if (!perfil || (escrita && perfil === 'CONSULTA')) {
    throw new HttpError(403, 'Você não possui permissão financeira para esta unidade.');
  }
  return perfil;
}

export async function minhasUnidades(usuarioId: string) {
  const usuario = id(usuarioId);
  if (await ehPlatformOwner(usuario)) {
    return consultar<{id:string; nome:string; perfil:Perfil; tipo:string}>(`
      SELECT u.id::text AS id, u.nome, 'GESTOR'::text AS perfil, t.codigo AS tipo
      FROM ${S}.unidade_legionaria u
      JOIN ${S}.tipo_unidade t ON t.id = u.tipo_unidade_id
      WHERE u.ativo = TRUE
      ORDER BY u.nome`);
  }
  return consultar<{id:string; nome:string; perfil:Perfil; tipo:string}>(`
    SELECT u.id::text AS id, u.nome, p.perfil, t.codigo AS tipo
    FROM ${S}.tesouraria_permissao_unidade p
    JOIN ${S}.unidade_legionaria u ON u.id = p.unidade_id
    JOIN ${S}.tipo_unidade t ON t.id = u.tipo_unidade_id
    WHERE p.usuario_id = :usuario AND p.ativo = TRUE AND p.revogado_em IS NULL
      AND u.ativo = TRUE
    ORDER BY u.nome`, {usuario});
}
export async function catalogos(usuarioId:string, unidadeId:string) {
  await autorizado(usuarioId,unidadeId);
  const [contas,categorias,contrapartes,unidades] = await Promise.all([
    consultar(`SELECT id::text AS id,nome,tipo,saldo_inicial AS "saldoInicial" FROM ${S}.tesouraria_conta WHERE unidade_id=:u AND ativo=TRUE ORDER BY nome`,{u:unidadeId}),
    consultar(`SELECT id::text AS id,nome,tipo,grupo FROM ${S}.tesouraria_categoria WHERE ativo=TRUE AND (unidade_id IS NULL OR unidade_id=:u) ORDER BY tipo,ordem,nome`,{u:unidadeId}),
    consultar(`SELECT c.id::text AS id,c.tipo,COALESCE(u.nome,c.nome_externo) AS nome FROM ${S}.tesouraria_contraparte c LEFT JOIN ${S}.unidade_legionaria u ON u.id=c.unidade_relacionada_id WHERE c.unidade_id=:u AND c.ativo=TRUE
      AND NOT EXISTS (SELECT 1 FROM ${S}.tesouraria_fornecedor f
                      WHERE f.contraparte_id=c.id AND f.unidade_id=c.unidade_id)
      ORDER BY nome`,{u:unidadeId}),
    // Somente nome e identificador: não concede acesso financeiro às demais unidades.
    consultar(`SELECT id::text AS id,nome FROM ${S}.unidade_legionaria WHERE ativo=TRUE AND status_aprovacao='APROVADA' ORDER BY nome LIMIT 100000`)
  ]);
  return { contas,categorias,contrapartes,unidades };
}
/** Base historica: uma unica implantacao por unidade, validada no servidor. */
export async function saldoImplantacao(usuarioId: string, unidadeId: string) {
  const unidade = id(unidadeId, 'Unidade');
  await autorizado(usuarioId, unidade);
  const [linhas] = await Promise.all([
    consultar<{ id: string; dataReferencia: string; saldoAnterior: string; observacao: string|null }>(`
      SELECT id::text AS id, to_char(data_referencia,'YYYY-MM-DD') AS "dataReferencia",
             saldo_anterior::text AS "saldoAnterior", observacao
      FROM ${S}.tesouraria_saldo_implantacao WHERE unidade_id=:u`, {u:unidade})
  ]);
  const [contas, reunioes] = await Promise.all([
    consultar<{saldo: string}>(`SELECT COALESCE(SUM(saldo_inicial),0)::text AS saldo
      FROM ${S}.tesouraria_conta WHERE unidade_id=:u`, {u:unidade}),
    consultar<{primeiraData: string|null; fechadas: string}>(`
      SELECT to_char(MIN(data_reuniao),'YYYY-MM-DD') AS "primeiraData",
             COUNT(*) FILTER (WHERE status='FECHADA')::text AS fechadas
      FROM ${S}.tesouraria_reuniao WHERE unidade_id=:u`, {u:unidade})
  ]);
  return { registro: linhas[0] ?? null,
    saldoInicialContas: contas[0]?.saldo ?? '0',
    primeiraDataReuniao: reunioes[0]?.primeiraData ?? null,
    possuiReuniaoFechada: Number(reunioes[0]?.fechadas ?? '0') > 0 };
}

export async function criarSaldoImplantacao(usuarioId: string, body: Linha) {
  const unidade = id(body.unidadeId,'Unidade');
  if ((await autorizado(usuarioId, unidade)) !== 'GESTOR')
    throw new HttpError(403,'Somente o gestor pode informar o saldo inicial.');
  const dia = data(body.dataReferencia,'Data da reunião anterior');
  const saldo = String(body.saldoAnterior ?? '');
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(saldo))
    throw new HttpError(400,'Saldo anterior inválido. Informe um valor positivo ou zero.');
  return sequelize.transaction(async transaction => {
    await consultar(`SELECT pg_advisory_xact_lock(59321,CAST(:u AS integer)) AS bloqueio`,{u:unidade},transaction);
    const existente = await consultar<{id:string}>(`
      SELECT id::text AS id FROM ${S}.tesouraria_saldo_implantacao WHERE unidade_id=:u`,{u:unidade},transaction);
    if (existente.length) throw new HttpError(409,'O saldo de partida já foi informado para esta unidade.');
    const base = await consultar<{saldo:string}>(`
      SELECT COALESCE(SUM(saldo_inicial),0)::text AS saldo
      FROM ${S}.tesouraria_conta WHERE unidade_id=:u`,{u:unidade},transaction);
    if (Number(base[0]?.saldo??0)!==0)
      throw new HttpError(409,'Já existe saldo inicial nas contas desta unidade. Não é possível duplicar o saldo de partida.');
    const limites=await consultar<{primeira:string|null;fechadas:string}>(`
      SELECT to_char(MIN(data_reuniao),'YYYY-MM-DD') AS primeira,
             COUNT(*) FILTER (WHERE status='FECHADA')::text AS fechadas
      FROM ${S}.tesouraria_reuniao WHERE unidade_id=:u`,{u:unidade},transaction);
    if(Number(limites[0]?.fechadas??0)>0)
      throw new HttpError(409,'Não é possível definir o saldo inicial após fechar uma reunião.');
    if(limites[0]?.primeira && dia >= limites[0].primeira!)
      throw new HttpError(400,'A data da última reunião anterior deve ser menor que a primeira reunião cadastrada.');
    const rows=await consultar<{id:string}>(`
      INSERT INTO ${S}.tesouraria_saldo_implantacao
        (unidade_id,data_referencia,saldo_anterior,observacao,usuario_cadastro_id)
      VALUES (:u,:dia,:saldo,:obs,:usuario) RETURNING id::text AS id`,
      {u:unidade,dia,saldo,obs:opcional(body.observacao,2000),usuario:id(usuarioId)},transaction);
    return rows[0];
  });
}

/** Lista todo o histórico sem exigir competência. O mês decorre da data da reunião. */
export async function listarReunioes(usuarioId: string, unidadeId: string) {
  await autorizado(usuarioId, unidadeId);
  return consultar(`SELECT r.reuniao_id::text AS id, r.data_reuniao AS "dataReuniao", r.competencia,
    r.status, r.saldo_inicial AS "saldoInicial", r.total_receitas AS "totalReceitas",
    r.total_despesas AS "totalDespesas", r.saldo_final AS "saldoFinal",
    r.quantidade_lancamentos AS "quantidadeLancamentos"
    FROM ${S}.tesouraria_vw_saldo_reuniao r
    WHERE r.unidade_id = :u
    ORDER BY r.data_reuniao DESC, r.reuniao_id DESC
    LIMIT 500`, {u: id(unidadeId)});
}
export async function lancamentos(usuarioId:string,unidadeId:string,reuniaoId:string) {
  await autorizado(usuarioId,unidadeId);
  return consultar(`SELECT l.id::text AS id,l.reuniao_id::text AS "reuniaoId",l.data_lancamento AS data,
    l.tipo,l.valor,l.finalidade,l.situacao,l.forma_pagamento AS "formaPagamento",
    cat.nome AS categoria, coalesce(u.nome,cp.nome_externo) AS contraparte, c.nome AS conta
    FROM ${S}.tesouraria_lancamento l
    JOIN ${S}.tesouraria_categoria cat ON cat.id=l.categoria_id
    JOIN ${S}.tesouraria_contraparte cp ON cp.id=l.contraparte_id
    LEFT JOIN ${S}.unidade_legionaria u ON u.id=cp.unidade_relacionada_id
    JOIN ${S}.tesouraria_conta c ON c.id=l.conta_id
    WHERE l.unidade_id=:u AND l.reuniao_id=:r
    ORDER BY l.data_lancamento DESC,l.id DESC LIMIT 1000`,{u:unidadeId,r:id(reuniaoId)});
}
export async function criarReuniao(usuarioId:string, body: Linha) {
  const unidadeId=id(body.unidadeId,'Unidade'); await autorizado(usuarioId,unidadeId,true);
  const dia=data(body.dataReuniao); const competencia=`${dia.slice(0,7)}-01`;
  return sequelize.transaction(async transaction => {
    const result=await consultar<{id:string}>(`
      INSERT INTO ${S}.tesouraria_reuniao (unidade_id,data_reuniao,competencia,observacao,criado_por_usuario_id)
      VALUES (:u,:dia,:mes,:obs,:usuario) RETURNING id::text AS id`,
      {u:unidadeId,dia,mes:competencia,obs:opcional(body.observacao,2000),usuario:id(usuarioId)},transaction);
    return result[0];
  });
}
export async function criarConta(usuarioId:string, body:Linha) {
  const unidadeId=id(body.unidadeId,'Unidade');
  if ((await autorizado(usuarioId,unidadeId)) !== 'GESTOR')
    throw new HttpError(403,'Somente o gestor pode cadastrar contas.');

  const nome = texto(body.nome,'Nome',140);
  const tipo=em(body.tipo,['CAIXA','BANCO','APLICACAO','OUTRA'] as const,'Tipo da conta');
  const dataInicial=data(body.dataSaldoInicial,'Data-base');
  const saldo=String(body.saldoInicial??'0');
  if(!/^\d{1,13}(\.\d{1,2})?$/.test(saldo))
    throw new HttpError(400,'Saldo inicial inválido. Utilize valor não negativo com ponto decimal.');

  // O saldo da reunião anterior deve ser lançado na implantação, não novamente na conta.
  // O trigger do PostgreSQL já protege isso; a pré-validação evita um erro 500 sem explicação.
  if (Number(saldo) !== 0) {
    const [historico, implantacao] = await Promise.all([
      consultar<{existe:boolean}>(`
        SELECT EXISTS(SELECT 1 FROM ${S}.tesouraria_reuniao WHERE unidade_id=:u) AS existe`,{u:unidadeId}),
      consultar<{existe:boolean}>(`
        SELECT EXISTS(SELECT 1 FROM ${S}.tesouraria_saldo_implantacao WHERE unidade_id=:u) AS existe`,{u:unidadeId})
    ]);
    if (historico[0]?.existe || implantacao[0]?.existe) {
      throw new HttpError(409,
        'A unidade já tem reunião cadastrada ou saldo anterior informado. Cadastre esta conta com saldo inicial R$ 0,00. Para transportar o saldo da reunião anterior, use a opção Informar saldo anterior.');
    }
  }

  // O PostgreSQL mantém a validação final de integridade e concorrência.
  const rows=await consultar<{id:string}>(`
    INSERT INTO ${S}.tesouraria_conta
      (unidade_id,nome,tipo,banco_nome,agencia,conta_numero,data_saldo_inicial,saldo_inicial)
    VALUES (:u,:nome,:tipo,:banco,:agencia,:numero,:dia,:saldo)
    RETURNING id::text AS id`,
    {u:unidadeId,nome,tipo,banco:opcional(body.bancoNome,140),
      agencia:opcional(body.agencia,30),numero:opcional(body.contaNumero,40),dia:dataInicial,saldo});
  return rows[0];
}
export async function criarLancamento(usuarioId:string, body:Linha) {
  const unidadeId=id(body.unidadeId,'Unidade'); await autorizado(usuarioId,unidadeId,true);
  const reuniaoId=id(body.reuniaoId,'Reunião'); const contaId=id(body.contaId,'Conta');
  const categoriaId=id(body.categoriaId,'Categoria'); const dia=data(body.dataLancamento);
  const tipo=em(body.tipo,['RECEITA','DESPESA'] as const,'Tipo de lançamento');
  const forma = body.formaPagamento ? em(body.formaPagamento,['PIX','DINHEIRO','TRANSFERENCIA','BOLETO','CARTAO','CHEQUE','OUTRA'] as const,'Forma') : null;
  return sequelize.transaction(async transaction=> {
    // Data do movimento pode ser historica. A competencia contabil da reuniao e definida pela data da reuniao.
    // Validar antes de cadastrar uma contraparte, evitando resíduos e erros SQL pouco claros.
    // FOR UPDATE coordena a validação com um eventual fechamento da reunião.
    const reunioes = await consultar<{ dataReuniao: string; status: string }>(`
      SELECT to_char(data_reuniao, 'YYYY-MM-DD') AS "dataReuniao", status
      FROM ${S}.tesouraria_reuniao
      WHERE id = :reuniao AND unidade_id = :u
      FOR UPDATE`, { reuniao: reuniaoId, u: unidadeId }, transaction);
    const reuniao = reunioes[0];
    if (!reuniao) throw new HttpError(404, 'Reunião não encontrada nesta unidade.');
    if (reuniao.status !== 'ABERTA') throw new HttpError(409, 'Esta reunião está fechada e não aceita lançamentos.');
    if (dia > reuniao.dataReuniao) {
      throw new HttpError(400, `A data do lançamento não pode ultrapassar a data da reunião (${reuniao.dataReuniao}). Registre a movimentação na reunião seguinte.`);
    }
    let contraparteId:string;
    if(body.contraparteId) contraparteId=id(body.contraparteId,'Fonte');
    else {
      const relacionada=body.unidadeRelacionadaId ? id(body.unidadeRelacionadaId,'Unidade relacionada') : null;
      const nome=relacionada ? null : texto(body.nomeExterno,'Fonte externa',200);
      const rows=await consultar<{id:string}>(`
        INSERT INTO ${S}.tesouraria_contraparte (unidade_id,tipo,unidade_relacionada_id,nome_externo)
        VALUES (:u,:tipo,:relacionada,:nome) RETURNING id::text AS id`,
        {u:unidadeId,tipo:relacionada?'UNIDADE':'EXTERNA',relacionada,nome},transaction);
      contraparteId=rows[0].id;
    }
    const rows=await consultar<{id:string}>(`
      INSERT INTO ${S}.tesouraria_lancamento
      (unidade_id,reuniao_id,conta_id,competencia,data_lancamento,tipo,categoria_id,contraparte_id,valor,finalidade,
       forma_pagamento,situacao,observacao,criado_por_usuario_id)
      VALUES (:u,:reuniao,:conta,:mes,:dia,:tipo,:categoria,:contraparte,:valor,:finalidade,:forma,'CONFIRMADO',:obs,:usuario)
      RETURNING id::text AS id`,{
        u:unidadeId,reuniao:reuniaoId,conta:contaId,mes:`${reuniao.dataReuniao.slice(0,7)}-01`,dia,tipo,categoria:categoriaId,
        contraparte:contraparteId,valor:valor(body.valor),finalidade:texto(body.finalidade,'Finalidade',3000),forma,
        obs:opcional(body.observacao,3000),usuario:id(usuarioId)
      },transaction);
    return rows[0];
  });
}
export async function fecharReuniao(usuarioId:string, unidadeId:string,reuniaoId:string) {
  if ((await autorizado(usuarioId,unidadeId)) !== 'GESTOR') throw new HttpError(403,'Somente gestor pode fechar uma reunião.');
  const rows=await consultar<{id:string}>(`
    UPDATE ${S}.tesouraria_reuniao
       SET status='FECHADA', fechado_em=now(), fechado_por_usuario_id=:usuario,
           atualizado_por_usuario_id=:usuario
     WHERE id=:r AND unidade_id=:u AND status='ABERTA'
     RETURNING id::text AS id`,{u:id(unidadeId),r:id(reuniaoId),usuario:id(usuarioId)});
  if (!rows.length) throw new HttpError(404,'Reunião não encontrada ou já fechada.');
  return rows[0];
}


/** Fontes pagadoras/recebedoras cadastradas para a Tesouraria da unidade. */
export async function listarFontes(usuarioId: string, unidadeId: string) {
  const unidade = id(unidadeId, 'Unidade');
  await autorizado(usuarioId, unidade);
  return consultar<{ id: string; nome: string; contraparteId: string; criadoEm: string }>(`
    SELECT f.id::text AS id,
           f.fonte_pagadora_recebedora AS nome,
           f.contraparte_id::text AS "contraparteId",
           f.created_at AS "criadoEm"
      FROM ${S}.tesouraria_fonte_pagadora_recebedora f
     WHERE f.unidade_id = :unidade AND f.ativo = TRUE
     ORDER BY f.fonte_pagadora_recebedora`, { unidade });
}

/** Cria a fonte e a contraparte financeira juntas, sem registros órfãos. */
export async function criarFonte(usuarioId: string, body: Linha) {
  const unidade = id(body.unidadeId, 'Unidade');
  await autorizado(usuarioId, unidade, true);
  const nome = texto(body.fontePagadoraRecebedora, 'Fonte pagadora/recebedora', 200);
  const usuario = id(usuarioId, 'Usuário');
  return sequelize.transaction(async transaction => {
    // Serializa os cadastros simultâneos da mesma unidade e evita duplicidades por nome.
    await consultar(`SELECT pg_advisory_xact_lock(59322, CAST(:unidade AS integer)) AS bloqueio`,
      { unidade }, transaction);
    const repetidas = await consultar<{ id: string }>(`
      SELECT id::text AS id FROM ${S}.tesouraria_fonte_pagadora_recebedora
       WHERE unidade_id = :unidade AND lower(btrim(fonte_pagadora_recebedora)) = lower(btrim(:nome))
       LIMIT 1`, { unidade, nome }, transaction);
    if (repetidas.length) throw new HttpError(409, 'Esta fonte já está cadastrada para a unidade.');

    const contrapartes = await consultar<{ id: string }>(`
      INSERT INTO ${S}.tesouraria_contraparte
        (unidade_id, tipo, nome_externo)
      VALUES (:unidade, 'EXTERNA', :nome)
      RETURNING id::text AS id`, { unidade, nome }, transaction);
    const contraparte = contrapartes[0];
    if (!contraparte) throw new HttpError(500, 'Não foi possível criar a contraparte financeira.');

    const fontes = await consultar<{ id: string; contraparteId: string; nome: string }>(`
      INSERT INTO ${S}.tesouraria_fonte_pagadora_recebedora
        (unidade_id, fonte_pagadora_recebedora, contraparte_id, usuario_cadastro_id)
      VALUES (:unidade, :nome, :contraparte, :usuario)
      RETURNING id::text AS id, contraparte_id::text AS "contraparteId",
                fonte_pagadora_recebedora AS nome`,
      { unidade, nome, contraparte: contraparte.id, usuario }, transaction);
    return fontes[0];
  });
}

/** Atualiza o nome da fonte e sua contraparte; conserva os IDs dos lançamentos. */
export async function atualizarFonte(usuarioId: string, fonteId: string, body: Linha) {
  const unidade = id(body.unidadeId, 'Unidade');
  await autorizado(usuarioId, unidade, true);
  const fonte = id(fonteId, 'Fonte');
  const nome = texto(body.fontePagadoraRecebedora, 'Fonte pagadora/recebedora', 200);
  const usuario = id(usuarioId, 'Usuário');
  return sequelize.transaction(async transaction => {
    await consultar(`SELECT pg_advisory_xact_lock(59322, CAST(:unidade AS integer)) AS bloqueio`,
      { unidade }, transaction);
    const existentes = await consultar<{ contraparteId: string }>(`
      SELECT contraparte_id::text AS "contraparteId"
        FROM ${S}.tesouraria_fonte_pagadora_recebedora
       WHERE id = :fonte AND unidade_id = :unidade AND ativo = TRUE
       FOR UPDATE`, { fonte, unidade }, transaction);
    if (!existentes.length) throw new HttpError(404, 'Fonte não encontrada nesta unidade.');
    const repetidas = await consultar<{ id: string }>(`
      SELECT id::text AS id FROM ${S}.tesouraria_fonte_pagadora_recebedora
       WHERE unidade_id = :unidade AND id <> :fonte
         AND lower(btrim(fonte_pagadora_recebedora)) = lower(btrim(:nome))
       LIMIT 1`, { unidade, fonte, nome }, transaction);
    if (repetidas.length) throw new HttpError(409, 'Já existe outra fonte com esse nome.');

    // Altera a contraparte utilizada nos relatórios; os lançamentos permanecem vinculados por ID.
    await consultar(`UPDATE ${S}.tesouraria_contraparte
      SET nome_externo = :nome, updated_at = now()
      WHERE id = :contraparte AND unidade_id = :unidade AND tipo = 'EXTERNA'
      RETURNING id`, { nome, contraparte: existentes[0].contraparteId, unidade }, transaction);
    const alteradas = await consultar<{ id: string; contraparteId: string; nome: string }>(`
      UPDATE ${S}.tesouraria_fonte_pagadora_recebedora
         SET fonte_pagadora_recebedora = :nome,
             usuario_alteracao_id = :usuario, updated_at = now()
       WHERE id = :fonte AND unidade_id = :unidade
       RETURNING id::text AS id, contraparte_id::text AS "contraparteId",
                 fonte_pagadora_recebedora AS nome`,
      { nome, usuario, fonte, unidade }, transaction);
    return alteradas[0];
  });
}


/** Fornecedores externos da unidade: cadastro separado de fontes e unidades. */
export async function listarFornecedores(usuarioId: string, unidadeId: string) {
  const unidade = id(unidadeId, 'Unidade');
  await autorizado(usuarioId, unidade);
  return consultar<{
    id: string; nome: string; nomeFantasia: string|null; cpfCnpj: string|null;
    tipo: string; categoriaServico: string|null; telefone: string|null;
    email: string|null; observacao: string|null; contraparteId: string;
  }>(`SELECT id::text AS id, nome,
       nome_fantasia AS "nomeFantasia", cpf_cnpj AS "cpfCnpj", tipo,
       categoria_servico AS "categoriaServico", telefone, email, observacao,
       contraparte_id::text AS "contraparteId"
    FROM ${S}.tesouraria_fornecedor
    WHERE unidade_id=:unidade AND ativo=TRUE
    ORDER BY nome`, {unidade});
}

function dadosFornecedor(body: Linha) {
  const nome = texto(body.nome, 'Nome do fornecedor', 200);
  const tipo = em(body.tipo ?? 'EMPRESA', ['EMPRESA','PESSOA','OUTRO'] as const, 'Tipo do fornecedor');
  const cpfCnpj = opcional(body.cpfCnpj, 18);
  if (cpfCnpj && !/^[0-9.\/-]{11,18}$/.test(cpfCnpj))
    throw new HttpError(400, 'CPF/CNPJ inválido.');
  const email = opcional(body.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, 'E-mail inválido.');
  return {
    nome, tipo, cpfCnpj, email,
    fantasia: opcional(body.nomeFantasia, 200),
    categoria: opcional(body.categoriaServico, 100),
    telefone: opcional(body.telefone, 30),
    observacao: opcional(body.observacao, 3000)
  };
}

/** Cria fornecedor e contraparte em uma transacao, preservando os IDs. */
export async function criarFornecedor(usuarioId: string, body: Linha) {
  const unidade = id(body.unidadeId, 'Unidade');
  await autorizado(usuarioId, unidade, true);
  const usuario = id(usuarioId, 'Usuário');
  const d = dadosFornecedor(body);
  return sequelize.transaction(async transaction => {
    await consultar('SELECT pg_advisory_xact_lock(59323, CAST(:unidade AS integer)) AS bloqueio', {unidade}, transaction);
    const existentes = await consultar<{id:string}>(`
      SELECT id::text AS id FROM ${S}.tesouraria_fornecedor
      WHERE unidade_id=:unidade AND lower(btrim(nome))=lower(btrim(:nome)) LIMIT 1`,
      {unidade, nome:d.nome}, transaction);
    if (existentes.length) throw new HttpError(409, 'Fornecedor já cadastrado nesta unidade.');
    const contrapartes = await consultar<{id:string}>(`
      INSERT INTO ${S}.tesouraria_contraparte (unidade_id,tipo,nome_externo)
      VALUES (:unidade,'EXTERNA',:nome) RETURNING id::text AS id`,
      {unidade,nome:d.nome},transaction);
    const contraparte = contrapartes[0];
    if (!contraparte) throw new HttpError(500,'Não foi possível criar a contraparte do fornecedor.');
    const rows = await consultar<{id:string;contraparteId:string;nome:string}>(`
      INSERT INTO ${S}.tesouraria_fornecedor
        (unidade_id,nome,nome_fantasia,cpf_cnpj,tipo,categoria_servico,telefone,email,
         contraparte_id,observacao,usuario_cadastro_id)
      VALUES (:unidade,:nome,:fantasia,:cpfCnpj,:tipo,:categoria,:telefone,:email,
              :contraparte,:observacao,:usuario)
      RETURNING id::text AS id, nome, contraparte_id::text AS "contraparteId"`,
      {...d,unidade,contraparte:contraparte.id,usuario},transaction);
    return rows[0];
  });
}

/** Alteracoes permanecem auditaveis pelos campos usuariais; vinculos nao mudam. */
export async function atualizarFornecedor(usuarioId:string, fornecedorId:string, body:Linha) {
  const unidade=id(body.unidadeId,'Unidade');
  await autorizado(usuarioId,unidade,true);
  const fornecedor=id(fornecedorId,'Fornecedor');
  const usuario=id(usuarioId,'Usuário');
  const d=dadosFornecedor(body);
  return sequelize.transaction(async transaction => {
    await consultar('SELECT pg_advisory_xact_lock(59323, CAST(:unidade AS integer)) AS bloqueio', {unidade}, transaction);
    const atuais=await consultar<{contraparteId:string}>(`
      SELECT contraparte_id::text AS "contraparteId" FROM ${S}.tesouraria_fornecedor
      WHERE id=:fornecedor AND unidade_id=:unidade AND ativo=TRUE FOR UPDATE`,
      {fornecedor,unidade},transaction);
    if (!atuais.length) throw new HttpError(404,'Fornecedor não encontrado nesta unidade.');
    const repetidos=await consultar<{id:string}>(`
      SELECT id::text AS id FROM ${S}.tesouraria_fornecedor
      WHERE unidade_id=:unidade AND id<>:fornecedor
        AND lower(btrim(nome))=lower(btrim(:nome)) LIMIT 1`,
      {unidade,fornecedor,nome:d.nome},transaction);
    if (repetidos.length) throw new HttpError(409,'Já existe outro fornecedor com esse nome.');
    await consultar(`UPDATE ${S}.tesouraria_contraparte
      SET nome_externo=:nome, updated_at=now()
      WHERE id=:contraparte AND unidade_id=:unidade AND tipo='EXTERNA'
      RETURNING id`,{unidade,nome:d.nome,contraparte:atuais[0].contraparteId},transaction);
    const rows=await consultar<{id:string;nome:string;contraparteId:string}>(`
      UPDATE ${S}.tesouraria_fornecedor
      SET nome=:nome,nome_fantasia=:fantasia,cpf_cnpj=:cpfCnpj,tipo=:tipo,
          categoria_servico=:categoria,telefone=:telefone,email=:email,
          observacao=:observacao,usuario_alteracao_id=:usuario,updated_at=now()
      WHERE id=:fornecedor AND unidade_id=:unidade
      RETURNING id::text AS id,nome,contraparte_id::text AS "contraparteId"`,
      {...d,usuario,fornecedor,unidade},transaction);
    return rows[0];
  });
}
