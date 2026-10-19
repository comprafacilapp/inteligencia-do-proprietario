import { useEffect, useRef, useState } from 'react';
import './App.css';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  runTransaction,
  query,
  where,
} from 'firebase/firestore';

type LancamentoFinanceiro = {
  id: string;
  empresaId: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  origem?: 'MANUAL' | 'CSV' | 'EXCEL' | 'API';
  importadoEm?: string;
  arquivoOrigem?: string;
  importacaoId?: string;
  sistemaOrigem?: string;
};

// FASE 3 — MODELO UNIVERSAL DE DADOS

type HistoricoImportacao = {
  id: string;
  empresaId: string;
  nomeArquivo: string;
  importadoEm: string;
  sistemaOrigem?: string;
  novos: number;
  duplicados: number;
  totalRegistros: number;
};

type OrigemDados = {
  sistema: string;
  tipo: 'MANUAL' | 'CSV' | 'EXCEL' | 'API';
  importadoEm: string;
  identificadorExterno?: string;
  arquivoOrigem?: string;
  importacaoId?: string;
};

type RegistroFinanceiroUniversal = {
  id: string;
  empresaId: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: 'RECEITA' | 'DESPESA';
  valorCentavos: number;
  moeda: string;
  origem: OrigemDados;
};

type ClienteUniversal = {
  id: string;
  empresaId: string;
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  origem: OrigemDados;
};

type ServicoUniversal = {
  id: string;
  empresaId: string;
  descricao: string;
  valorCentavos: number;
  custoCentavos?: number;
  moeda: string;
  origem: OrigemDados;
};

type DadosUniversaisEmpresa = {
  empresaId: string;
  registrosFinanceiros: RegistroFinanceiroUniversal[];
  clientes: ClienteUniversal[];
  servicos: ServicoUniversal[];
  atualizadoEm: string;
};

// ESTRUTURA EMPRESARIAL — PREVANZIA
export type EmpresaPrevanzia = {
  id: string;
  nome: string;
  documento?: string;
  proprietarioUid: string;
  criadaEm: string;
};
export type AcessoEmpresaPrevanzia = {
  empresaId: string;
  usuarioUid: string;
  perfil: 'PROPRIETARIO' | 'CONFIANCA';
  ativo: boolean;
};

// FASE 3 — VALIDAÇÃO DOS REGISTROS FINANCEIROS UNIVERSAIS

function validarRegistroFinanceiroUniversal(
  registro: RegistroFinanceiroUniversal
): boolean {
  const dataValida =
    /^\d{4}-\d{2}-\d{2}$/.test(registro.data) &&
    !Number.isNaN(Date.parse(`${registro.data}T00:00:00`));

  return (
    registro.id.trim().length > 0 &&
    registro.empresaId.trim().length > 0 &&
    dataValida &&
    registro.descricao.trim().length > 0 &&
    registro.categoria.trim().length > 0 &&
    (registro.tipo === 'RECEITA' || registro.tipo === 'DESPESA') &&
    Number.isSafeInteger(registro.valorCentavos) &&
    registro.valorCentavos >= 0 &&
    registro.moeda === 'BRL' &&
    registro.origem.sistema.trim().length > 0 &&
    ['MANUAL', 'CSV', 'EXCEL', 'API'].includes(registro.origem.tipo)
  );
}

type AcompanhamentoDecisao = {
  origem: string;
  registradaEm: string;
  periodoBase: string;
  inicioBase: string;
  fimBase: string;
  receitasBase: number;
  despesasBase: number;
  resultadoBase: number;
  quantidadeBase?: number;
  avaliadaEm?: string;
  inicioAvaliacao?: string;
  fimAvaliacao?: string;
  quantidadeAvaliacao?: number;
  receitasAvaliacao?: number;
  despesasAvaliacao?: number;
  resultadoAvaliacao?: number;
};

type Alerta = {
  titulo: string;
  descricao: string;
  nivel: 'alto' | 'medio';
};

type DiagnosticoCalculado = {
  receitas: number;
  despesas: number;
  resultado: number;
  percentualDespesas: number | null;
  quantidade: number;
  alertas: Alerta[];
  oportunidades: string[];
  resumo: string;
  recomendacao: string;

  // COLE O CÓDIGO NOVO AQUI
  maiorCategoriaDespesa?: {
    nome: string;
    valor: number;
  };
};

function calcularDiagnostico(
  registros: RegistroFinanceiroUniversal[],
  registrosAnteriores: RegistroFinanceiroUniversal[],
  moeda: (valor: number) => string
): DiagnosticoCalculado {
  const somar = (
    itens: RegistroFinanceiroUniversal[],
    tipo: 'RECEITA' | 'DESPESA'
  ) =>
    itens
      .filter((item) => item.tipo === tipo)
      .reduce((total, item) => total + item.valorCentavos, 0) / 100;
  const receitas = somar(registros, 'RECEITA');
  const despesas = somar(registros, 'DESPESA');
  const resultado = receitas - despesas;
  const percentualDespesas = receitas > 0 ? (despesas / receitas) * 100 : null;
  const receitasAnteriores = somar(registrosAnteriores, 'RECEITA');
  const despesasAnteriores = somar(registrosAnteriores, 'DESPESA');
  const alertas: Alerta[] = [];
  const oportunidades: string[] = [];

  if (registros.length === 0) {
    return {
      receitas,
      despesas,
      resultado,
      percentualDespesas,
      quantidade: 0,
      alertas: [],
      oportunidades: [],
      resumo:
        'Não há lançamentos no período selecionado. Importe um CSV ou registre receitas e despesas.',
      recomendacao:
        'Cadastre os movimentos financeiros do período para iniciar a análise.',
    };
  }

  if (resultado < 0) {
    alertas.push({
      titulo: 'Despesas superiores às receitas',
      nivel: 'alto',
      descricao: `As despesas superam as receitas em ${moeda(
        Math.abs(resultado)
      )} neste período.`,
    });
    oportunidades.push(
      'Identificar as despesas que podem ser reduzidas e verificar receitas ainda não registradas.'
    );
  } else if (resultado === 0 && receitas > 0) {
    alertas.push({
      titulo: 'Resultado financeiro zerado',
      nivel: 'medio',
      descricao:
        'As despesas consumiram todas as receitas registradas neste período.',
    });
    oportunidades.push(
      'Revisar despesas recorrentes e preços para criar uma reserva financeira.'
    );
  }

  if (receitas === 0 && despesas > 0) {
    alertas.push({
      titulo: 'Sem receitas registradas',
      nivel: 'alto',
      descricao: `Há ${moeda(
        despesas
      )} em despesas, mas nenhuma receita cadastrada no período.`,
    });
    oportunidades.push(
      'Verificar se faltam receitas no arquivo importado ou se houve um período sem faturamento.'
    );
  } else if (percentualDespesas !== null && percentualDespesas >= 80) {
    alertas.push({
      titulo: 'Despesas elevadas em relação às receitas',
      // Critério inicial de exposição financeira: a partir de 90% das
      // receitas comprometidas, a prioridade sobe para alta.
      // A análise permanece limitada aos lançamentos disponíveis.
      nivel: percentualDespesas >= 90 ? 'alto' : 'medio',
      descricao: `As despesas representam ${percentualDespesas
        .toFixed(1)
        .replace('.', ',')}% das receitas registradas.`,
    });
    oportunidades.push(
      'Analisar as categorias de maior gasto e negociar custos quando possível.'
    );
  }

  if (registrosAnteriores.length > 0) {
    if (receitasAnteriores > 0 && receitas < receitasAnteriores) {
      const queda =
        ((receitasAnteriores - receitas) / receitasAnteriores) * 100;
      alertas.push({
        titulo: 'Receitas abaixo do período anterior',
        nivel: queda >= 20 ? 'alto' : 'medio',
        descricao: `As receitas registradas caíram ${queda
          .toFixed(1)
          .replace('.', ',')}% em relação ao período de comparação.`,
      });
      oportunidades.push(
        'Verificar quais serviços ou fontes de receita tiveram menor movimento.'
      );
    }
    if (despesasAnteriores > 0 && despesas > despesasAnteriores) {
      const aumento =
        ((despesas - despesasAnteriores) / despesasAnteriores) * 100;

      const categoriasAtuais = categoriasComparativas(registros);
      const categoriasAnteriores = categoriasComparativas(registrosAnteriores);

      const aumentosPorCategoria = [...categoriasAtuais.entries()]
        .map(([chave, categoria]) => ({
          nome: categoria.nome,
          diferenca:
            categoria.total - (categoriasAnteriores.get(chave)?.total ?? 0),
        }))
        .filter((categoria) => categoria.diferenca > 0)
        .sort((a, b) => b.diferenca - a.diferenca);

      const maiorAumento = aumentosPorCategoria[0];

      // COLE O CÓDIGO NOVO AQUI
      const valoresMaiorAumento = maiorAumento
        ? {
            anterior:
              categoriasAnteriores.get(
                chaveCategoriaComparativa(maiorAumento.nome)
              )?.total ?? 0,
            atual:
              categoriasAtuais.get(chaveCategoriaComparativa(maiorAumento.nome))
                ?.total ?? 0,
          }
        : null;

      // COLE O CÓDIGO NOVO AQUI
      const lancamentosParaInvestigar = maiorAumento
        ? registros
            .filter(
              (registro) =>
                registro.tipo === 'DESPESA' &&
                chaveCategoriaComparativa(registro.categoria) ===
                  chaveCategoriaComparativa(maiorAumento.nome)
            )
            .sort((a, b) => b.valorCentavos - a.valorCentavos)
            .slice(0, 3)
        : [];

      alertas.push({
        titulo: 'Despesas acima do período anterior',

        nivel: aumento >= 20 ? 'alto' : 'medio',
        descricao: `As despesas registradas aumentaram ${aumento
          .toFixed(1)
          .replace('.', ',')}% na comparação.${
          maiorAumento
            ? ` A categoria "${
                maiorAumento.nome
              }" apresentou o maior aumento identificado: ${moeda(
                maiorAumento.diferenca
              )}.`
            : ''
        }`,
      });

      // COLE O CÓDIGO NOVO AQUI

      // COLE O CÓDIGO NOVO AQUI

      oportunidades.push(
        maiorAumento
          ? `PLANO DE AÇÃO — ${
              maiorAumento.nome
            }: no período anterior, os gastos foram ${moeda(
              valoresMaiorAumento?.anterior ?? 0
            )}; no período atual, foram ${moeda(
              valoresMaiorAumento?.atual ?? 0
            )}. Aumento identificado: ${moeda(maiorAumento.diferenca)}. ${
              lancamentosParaInvestigar.length > 0
                ? `Maiores lançamentos do período atual para investigação (não são necessariamente a causa do aumento): ${lancamentosParaInvestigar
                    .map(
                      (registro) =>
                        `${registro.descricao} (${registro.data}): ${moeda(
                          registro.valorCentavos / 100
                        )}`
                    )
                    .join('; ')}. `
                : ''
            }Soluções sugeridas: 1) Revisar os lançamentos apresentados; 2) Negociar preços e condições com fornecedores, quando aplicável; 3) Avaliar a redução de desperdícios e despesas dispensáveis, sem prejudicar a operação.`
          : 'PLANO DE AÇÃO — Despesas em crescimento: 1) Identificar os gastos que aumentaram; 2) Revisar contratos e condições de compra; 3) Avaliar despesas que podem ser reduzidas sem prejudicar a operação.'
      );
    }
  }

  // CATEGORIAS — PADRONIZAÇÃO PARA O DIAGNÓSTICO
  const gastosPorCategoria = new Map<string, number>();

  for (const registro of registros) {
    if (registro.tipo === 'DESPESA') {
      const chave = chaveCategoriaComparativa(registro.categoria);
      if (!chave) continue;

      gastosPorCategoria.set(
        chave,
        (gastosPorCategoria.get(chave) ?? 0) + registro.valorCentavos / 100
      );
    }
  }

  // COLE O CÓDIGO NOVO AQUI

  const maiorGasto = [...gastosPorCategoria.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  // COLE O CÓDIGO NOVO AQUI
  if (maiorGasto && despesas > 0) {
    const categoriaJaRecomendada = oportunidades.some(
      (texto) =>
        texto.startsWith('PLANO DE AÇÃO — ') &&
        texto
          .toLocaleLowerCase('pt-BR')
          .includes(maiorGasto[0].toLocaleLowerCase('pt-BR'))
    );

    if (!categoriaJaRecomendada) {
      oportunidades.push(
        `Examinar a categoria de despesa "${
          maiorGasto[0]
        }", responsável por ${moeda(maiorGasto[1])} dos gastos registrados.`
      );
    }
  }
  // Alertas graves aparecem antes dos avisos moderados.
  alertas.sort(
    (a, b) => (a.nivel === 'alto' ? 0 : 1) - (b.nivel === 'alto' ? 0 : 1)
  );

  if (alertas.length === 0) {
    oportunidades.unshift(
      'Manter o acompanhamento das receitas e despesas e comparar os próximos períodos.'
    );
  }
  return {
    receitas,
    despesas,
    resultado,
    percentualDespesas,
    quantidade: registros.length,

    // COLE O CÓDIGO NOVO AQUI
    maiorCategoriaDespesa: maiorGasto
      ? {
          nome: maiorGasto[0],
          valor: maiorGasto[1],
        }
      : undefined,

    alertas,
    oportunidades: [...new Set(oportunidades)].slice(0, 5),
    resumo:
      resultado >= 0
        ? `As receitas registradas cobrem as despesas do período, com diferença de ${moeda(
            resultado
          )}.`
        : `As despesas registradas superam as receitas em ${moeda(
            Math.abs(resultado)
          )}.`,
    recomendacao:
      registros.length === 0
        ? 'Importe ou registre lançamentos para receber orientações baseadas nos dados da empresa.'
        : receitas === 0 && despesas > 0
        ? `Confira se faltam receitas registradas e revise a categoria de maior despesa${
            maiorGasto ? ` (${maiorGasto[0]}: ${moeda(maiorGasto[1])})` : ''
          }. Não é possível avaliar a margem sem receitas.`
        : percentualDespesas !== null && percentualDespesas >= 80
        ? `As despesas consomem ${percentualDespesas
            .toFixed(1)
            .replace('.', ',')}% das receitas. ${
            maiorGasto
              ? `Comece examinando a categoria "${
                  maiorGasto[0]
                }", que soma ${moeda(maiorGasto[1])}. `
              : ''
          }Confira os lançamentos dessa categoria, identifique gastos recorrentes e avalie quais custos podem ser renegociados sem comprometer a operação. Compare com outro período equivalente antes de decidir.`
        : resultado < 0
        ? `O período apresenta diferença negativa de ${moeda(
            Math.abs(resultado)
          )}. Confira a integridade das receitas e despesas e examine os maiores gastos antes de definir uma ação.`
        : alertas.length > 0
        ? 'Confira quais indicadores mudaram em relação ao período anterior, investigue as categorias envolvidas e valide a cobertura dos lançamentos antes de decidir.'
        : 'Acompanhe a evolução das receitas e despesas, confira se todos os lançamentos foram registrados e compare períodos equivalentes.',
  };
}

// INTELIGÊNCIA COMPARATIVA — períodos consecutivos de mesma duração.
// Comparações são descritivas e dependem da cobertura dos lançamentos.
function somarTipoComparativo(
  registros: RegistroFinanceiroUniversal[],
  tipo: 'RECEITA' | 'DESPESA'
): number {
  return (
    registros
      .filter((registro) => registro.tipo === tipo)
      .reduce((total, registro) => total + registro.valorCentavos, 0) / 100
  );
}

function chaveCategoriaComparativa(nome: string): string {
  const chave = nome
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');

  // Equivalência explícita para erro de digitação observado nos dados de teste.
  // Não aplicar correção aproximada indiscriminada: categorias distintas podem ser parecidas.
  const equivalencias: Record<string, string> = {
    mateiais: 'materiais',
  };
  return equivalencias[chave] ?? chave;
}

function nomeCategoriaComparativa(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  return limpo.replace(
    /(^|\s)(\p{L})/gu,
    (_, espaco: string, letra: string) =>
      espaco + letra.toLocaleUpperCase('pt-BR')
  );
}

function categoriasComparativas(registros: RegistroFinanceiroUniversal[]) {
  const categorias = new Map<string, { nome: string; total: number }>();
  for (const registro of registros) {
    if (registro.tipo !== 'DESPESA') continue;
    const chave = chaveCategoriaComparativa(registro.categoria);
    if (!chave) continue;
    const anterior = categorias.get(chave);
    categorias.set(chave, {
      nome: nomeCategoriaComparativa(chave),
      total: (anterior?.total ?? 0) + registro.valorCentavos / 100,
    });
  }
  return categorias;
}

function App() {
  const [usuarioAtual, setUsuarioAtual] = useState<User | null>(
    () => auth.currentUser
  );
  // Identificação provisória da empresa.
  // Mantém compatibilidade com os lançamentos existentes.
  // COLE O CÓDIGO NOVO AQUI
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState<
    string | null
  >(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;

    return localStorage.getItem(`prevanzia_empresa_selecionada_${uid}`);
  });
  // Recupera a empresa selecionada após a autenticação.
  useEffect(() => {
    if (!usuarioAtual) {
      setEmpresaSelecionadaId(null);
      return;
    }

    const idSalvo = localStorage.getItem(
      `prevanzia_empresa_selecionada_${usuarioAtual.uid}`
    );

    setEmpresaSelecionadaId(idSalvo);
  }, [usuarioAtual]);
  const [empresasCadastradas, setEmpresasCadastradas] = useState<
    EmpresaPrevanzia[]
  >([]);
  const empresaIdAtual = empresasCadastradas.some(
    (empresa) =>
      empresa.id === empresaSelecionadaId &&
      empresa.proprietarioUid === usuarioAtual?.uid
  )
    ? empresaSelecionadaId!
    : 'empresa_demo';
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [documentoEmpresa, setDocumentoEmpresa] = useState('');

  // COLE O CÓDIGO NOVO AQUI

  // PREVANZIA — Leitura das empresas do proprietário
  useEffect(() => {
    if (!usuarioAtual) {
      setEmpresasCadastradas([]);
      return;
    }

    const consultaEmpresas = query(
      collection(db, 'empresas'),
      where('proprietarioUid', '==', usuarioAtual.uid)
    );

    const cancelarEmpresas = onSnapshot(
      consultaEmpresas,
      (resultado) => {
        const empresas = resultado.docs.map(
          (documento) => documento.data() as EmpresaPrevanzia
        );

        setEmpresasCadastradas(empresas);
        // COLE O CÓDIGO NOVO AQUI
        setEmpresaSelecionadaId((idAtual) => {
          if (!idAtual) return null;

          const autorizada = empresas.some(
            (empresa) =>
              empresa.id === idAtual &&
              empresa.proprietarioUid === usuarioAtual.uid
          );

          if (!autorizada) {
            localStorage.removeItem(
              `prevanzia_empresa_selecionada_${usuarioAtual.uid}`
            );
            return null;
          }

          return idAtual;
        });
      },
      (erro) => {
        console.error('Erro ao carregar empresas:', erro);
      }
    );

    return () => cancelarEmpresas();
  }, [usuarioAtual]);

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, (usuario) => {
      setLancamentosCarregados(false);
      setUidLancamentos(null);
      setLancamentosFinanceiros([]);
      setUsuarioAtual(usuario);
    });

    return () => cancelar();
  }, []);
  const [lancamentosCarregados, setLancamentosCarregados] = useState(false);
  const [uidLancamentos, setUidLancamentos] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('Este mês');
  const [lancamentosFinanceiros, setLancamentosFinanceiros] = useState<
    LancamentoFinanceiro[]
  >(() => {
    try {
      const chaveUsuario = auth.currentUser?.uid;
      const chaveLocal = chaveUsuario
        ? `prevanzia_lancamentos_financeiros_${chaveUsuario}`
        : null;
      const salvos = chaveLocal ? localStorage.getItem(chaveLocal) : null;
      const dados: unknown = salvos ? JSON.parse(salvos) : [];

      return Array.isArray(dados) &&
        dados.every(
          (item) =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.empresaId === 'string' &&
            typeof item.data === 'string' &&
            typeof item.descricao === 'string' &&
            typeof item.categoria === 'string' &&
            (item.tipo === 'RECEITA' || item.tipo === 'DESPESA') &&
            typeof item.valor === 'number' &&
            Number.isFinite(item.valor) &&
            item.valor >= 0
        )
        ? (dados as LancamentoFinanceiro[])
        : [];
    } catch {
      return [];
    }
  });
  // Sincronização por UID: primeiro lê a nuvem e os dados locais do próprio usuário.
  // A gravação só começa depois do primeiro snapshot, evitando sobrescritas prematuras.
  const idsNuvem = useRef<Set<string>>(new Set());
  const idsEmEnvio = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      !usuarioAtual ||
      !lancamentosCarregados ||
      uidLancamentos !== usuarioAtual.uid
    )
      return;

    const chaveLocal = `prevanzia_lancamentos_financeiros_${usuarioAtual.uid}`;
    localStorage.setItem(chaveLocal, JSON.stringify(lancamentosFinanceiros));

    for (const lancamento of lancamentosFinanceiros) {
      if (
        idsNuvem.current.has(lancamento.id) ||
        idsEmEnvio.current.has(lancamento.id)
      )
        continue;
      idsEmEnvio.current.add(lancamento.id);
      setDoc(
        doc(db, 'usuarios', usuarioAtual.uid, 'lancamentos', lancamento.id),
        lancamento
      )
        .then(() => {
          idsNuvem.current.add(lancamento.id);
        })
        .catch((erro) => {
          console.error('Falha ao sincronizar lançamento:', erro);
          // Mantém a cópia local para permitir nova tentativa.
        })
        .finally(() => {
          idsEmEnvio.current.delete(lancamento.id);
        });
    }
  }, [
    usuarioAtual,
    lancamentosFinanceiros,
    lancamentosCarregados,
    uidLancamentos,
  ]);

  useEffect(() => {
    if (!usuarioAtual) {
      setLancamentosCarregados(false);
      setUidLancamentos(null);
      return;
    }

    let ativo = true;
    setLancamentosCarregados(false);
    setUidLancamentos(null);
    idsNuvem.current = new Set();
    idsEmEnvio.current = new Set();

    const chaveLocal = `prevanzia_lancamentos_financeiros_${usuarioAtual.uid}`;
    let locais: LancamentoFinanceiro[] = [];
    try {
      const salvo = localStorage.getItem(chaveLocal);
      const dados: unknown = salvo ? JSON.parse(salvo) : [];
      if (Array.isArray(dados)) {
        locais = dados.filter(
          (item): item is LancamentoFinanceiro =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.empresaId === 'string' &&
            typeof item.data === 'string' &&
            typeof item.descricao === 'string' &&
            typeof item.categoria === 'string' &&
            (item.tipo === 'RECEITA' || item.tipo === 'DESPESA') &&
            typeof item.valor === 'number' &&
            Number.isFinite(item.valor) &&
            item.valor >= 0
        );
      }
    } catch (erro) {
      console.error('Erro ao recuperar lançamentos locais:', erro);
    }

    const referencia = collection(
      db,
      'usuarios',
      usuarioAtual.uid,
      'lancamentos'
    );
    const cancelarLeitura = onSnapshot(
      referencia,
      (resultado) => {
        if (!ativo) return;
        const nuvem = resultado.docs
          .map((documento) => documento.data())
          .filter(
            (item): item is LancamentoFinanceiro =>
              item !== null &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.empresaId === 'string' &&
              typeof item.data === 'string' &&
              typeof item.descricao === 'string' &&
              typeof item.categoria === 'string' &&
              (item.tipo === 'RECEITA' || item.tipo === 'DESPESA') &&
              typeof item.valor === 'number' &&
              Number.isFinite(item.valor) &&
              item.valor >= 0
          );
        idsNuvem.current = new Set(nuvem.map((item) => item.id));
        setLancamentosFinanceiros((anteriores) => {
          const unicos = new Map<string, LancamentoFinanceiro>();
          for (const item of locais) unicos.set(item.id, item);
          for (const item of anteriores) unicos.set(item.id, item);
          for (const item of nuvem) unicos.set(item.id, item);
          return Array.from(unicos.values());
        });
        locais = [];
        setUidLancamentos(usuarioAtual.uid);
        setLancamentosCarregados(true);
      },
      (erro) => {
        console.error('Erro ao ler lançamentos do Firestore:', erro);
        // Não libera escrita se a leitura inicial falhar.
      }
    );

    return () => {
      ativo = false;
      cancelarLeitura();
    };
  }, [usuarioAtual]);
  // FASE 4 — HISTÓRICO CSV: SINCRONIZAÇÃO ISOLADA POR USUÁRIO
  const [historicoImportacoes, setHistoricoImportacoes] = useState<
    HistoricoImportacao[]
  >([]);
  const [uidHistoricoCarregado, setUidHistoricoCarregado] = useState<
    string | null
  >(null);
  const idsHistoricoNuvem = useRef<Set<string>>(new Set());
  const idsHistoricoEnviando = useRef<Set<string>>(new Set());

  const validarHistoricoImportacao = (
    item: unknown
  ): item is HistoricoImportacao => {
    if (item === null || typeof item !== 'object') return false;
    const registro = item as Record<string, unknown>;
    return (
      typeof registro.id === 'string' &&
      typeof registro.empresaId === 'string' &&
      typeof registro.nomeArquivo === 'string' &&
      typeof registro.importadoEm === 'string' &&
      typeof registro.novos === 'number' &&
      Number.isSafeInteger(registro.novos) &&
      registro.novos >= 0 &&
      typeof registro.duplicados === 'number' &&
      Number.isSafeInteger(registro.duplicados) &&
      registro.duplicados >= 0 &&
      typeof registro.totalRegistros === 'number' &&
      Number.isSafeInteger(registro.totalRegistros) &&
      registro.totalRegistros >= 0
    );
  };

  useEffect(() => {
    setUidHistoricoCarregado(null);
    setHistoricoImportacoes([]);
    idsHistoricoNuvem.current = new Set();
    idsHistoricoEnviando.current = new Set();
    if (!usuarioAtual) return;

    const uid = usuarioAtual.uid;
    let ativo = true;
    const chaveLocal = `prevanzia_historico_importacoes_${uid}`;
    let locais: HistoricoImportacao[] = [];
    try {
      const salvos = localStorage.getItem(chaveLocal);
      const dados: unknown = salvos ? JSON.parse(salvos) : [];
      if (Array.isArray(dados))
        locais = dados.filter(validarHistoricoImportacao);
    } catch (erro) {
      console.error('Erro ao ler histórico de arquivos local:', erro);
    }

    const cancelar = onSnapshot(
      collection(db, 'usuarios', uid, 'historicoImportacoes'),
      (resultado) => {
        if (!ativo) return;
        const nuvem = resultado.docs
          .map((documento) => documento.data())
          .filter(validarHistoricoImportacao);
        idsHistoricoNuvem.current = new Set(nuvem.map((item) => item.id));
        setHistoricoImportacoes((anteriores) => {
          const unicos = new Map<string, HistoricoImportacao>();
          for (const item of locais) unicos.set(item.id, item);
          for (const item of anteriores) unicos.set(item.id, item);
          for (const item of nuvem) unicos.set(item.id, item);
          return [...unicos.values()].sort((a, b) =>
            b.importadoEm.localeCompare(a.importadoEm)
          );
        });
        locais = [];
        setUidHistoricoCarregado(uid);
      },
      (erro) => {
        console.error('Erro ao ler histórico de arquivos do Firestore:', erro);
        // Não grava enquanto a leitura inicial não funcionar.
      }
    );
    return () => {
      ativo = false;
      cancelar();
    };
  }, [usuarioAtual]);

  useEffect(() => {
    if (!usuarioAtual || uidHistoricoCarregado !== usuarioAtual.uid) return;
    const uid = usuarioAtual.uid;
    localStorage.setItem(
      `prevanzia_historico_importacoes_${uid}`,
      JSON.stringify(historicoImportacoes)
    );
    for (const item of historicoImportacoes) {
      if (
        idsHistoricoNuvem.current.has(item.id) ||
        idsHistoricoEnviando.current.has(item.id)
      )
        continue;
      idsHistoricoEnviando.current.add(item.id);
      setDoc(doc(db, 'usuarios', uid, 'historicoImportacoes', item.id), item)
        .then(() => {
          idsHistoricoNuvem.current.add(item.id);
        })
        .catch((erro) =>
          console.error('Erro ao enviar histórico de arquivos:', erro)
        )
        .finally(() => {
          idsHistoricoEnviando.current.delete(item.id);
        });
    }
  }, [historicoImportacoes, usuarioAtual, uidHistoricoCarregado]);

  // Mapeamento provisório: nenhum lançamento é salvo antes da confirmação.
  const camposCSV = [
    'data',
    'descricao',
    'categoria',
    'tipo',
    'valor',
  ] as const;
  type CampoCSV = (typeof camposCSV)[number];
  const [arquivoPendenteCSV, setArquivoPendenteCSV] = useState<File | null>(
    null
  );

  // COLE O CÓDIGO NOVO AQUI
  const [sistemaOrigemImportacao, setSistemaOrigemImportacao] =
    useState<string>('');
  const [colunasPendentesCSV, setColunasPendentesCSV] = useState<string[]>([]);
  const [mapaCSV, setMapaCSV] = useState<Record<CampoCSV, string>>({
    data: '',
    descricao: '',
    categoria: '',
    tipo: '',
    valor: '',
  });

  // Importa a primeira aba do Excel; usa o mesmo fluxo de mapeamento,
  // validação de registros, histórico e deduplicação do CSV.
  async function importarArquivoExcel(
    arquivo: File,
    mapaConfirmado?: Record<CampoCSV, string>
  ) {
    if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
      alert('O arquivo deve ter entre 1 byte e 5 MB.');
      return;
    }
    try {
      // A API oficial de read-excel-file retorna uma matriz de linhas.
      // Algumas versões/empacotamentos podem devolver um objeto com rows.
      // Não tratar objetos arbitrários como linhas: informar a estrutura real.
      // @ts-ignore -- declarações ausentes para a entrada browser neste projeto
      const moduloExcel = await import('read-excel-file/browser');
      const leitorExcel = moduloExcel.default;
      type CelulaExcel = string | number | boolean | Date | null;
      const resultadoExcel: unknown = await leitorExcel(arquivo);
      console.log('RESULTADO REAL DO EXCEL:', resultadoExcel);

      const objetoExcel =
        resultadoExcel !== null && typeof resultadoExcel === 'object'
          ? (resultadoExcel as Record<string, unknown>)
          : null;
      // A biblioteca retorna abas no formato { sheet, data }.
      const primeiraAba =
        Array.isArray(resultadoExcel) && resultadoExcel.length > 0
          ? resultadoExcel[0]
          : null;

      const possiveisLinhas =
        primeiraAba && typeof primeiraAba === 'object' && 'data' in primeiraAba
          ? primeiraAba.data
          : Array.isArray(resultadoExcel)
          ? resultadoExcel
          : objetoExcel?.rows;

      if (
        !Array.isArray(possiveisLinhas) ||
        !possiveisLinhas.every((linha: unknown) => Array.isArray(linha))
      ) {
        const formato = Array.isArray(resultadoExcel)
          ? 'lista com elementos que não são linhas'
          : objetoExcel
          ? `objeto com propriedades: ${
              Object.keys(objetoExcel).join(', ') || '(nenhuma)'
            }`
          : typeof resultadoExcel;
        throw new Error(
          `A leitura do Excel não retornou linhas válidas (${formato}). ` +
            'Confira se o arquivo é realmente .xlsx e não um arquivo renomeado.'
        );
      }
      const planilha = possiveisLinhas as CelulaExcel[][];

      const linhas = planilha
        .map((linha, indiceLinha) =>
          linha.map((celula, indiceColuna) => {
            if (celula === null || celula === undefined) return '';
            if (celula instanceof Date) {
              return `${celula.getUTCFullYear()}-${String(
                celula.getUTCMonth() + 1
              ).padStart(2, '0')}-${String(celula.getUTCDate()).padStart(
                2,
                '0'
              )}`;
            }
            if (typeof celula === 'number' && indiceLinha > 0) {
              // Datas numéricas do Excel são convertidas apenas em colunas
              // cujo cabeçalho identifica inequivocamente o campo data.
              const titulo = String(planilha[0]?.[indiceColuna] ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
              if (
                (titulo === 'data' ||
                  titulo.startsWith('data') ||
                  titulo === 'date' ||
                  titulo === 'dtmovimento') &&
                celula >= 1 &&
                celula <= 2958465 &&
                Number.isInteger(celula)
              ) {
                const dia = new Date(
                  Date.UTC(1899, 11, 30) + celula * 86400000
                );
                return dia.toISOString().slice(0, 10);
              }
            }
            return String(celula).trim();
          })
        )
        .filter((linha) => linha.some((valor) => valor !== ''));
      if (linhas.length < 2) {
        alert('A primeira aba do Excel não contém lançamentos.');
        return;
      }
      await importarArquivoCSV(arquivo, mapaConfirmado, linhas);
    } catch (erro) {
      console.error('Falha ao ler planilha Excel:', erro);
      alert(
        'Erro ao importar Excel: ' +
          (erro instanceof Error ? erro.message : String(erro))
      );
    }
  }

  // FASE 4 — IMPORTAÇÃO DE DADOS FINANCEIROS POR CSV

  // FASE 4 — IMPORTAÇÃO CSV COM VALIDAÇÃO E PROTEÇÃO CONTRA DUPLICAÇÃO

  async function importarArquivoCSV(
    arquivo: File,
    mapaConfirmado?: Record<CampoCSV, string>,
    linhasExcel?: string[][]
  ) {
    if (
      !usuarioAtual ||
      uidHistoricoCarregado !== usuarioAtual.uid ||
      !lancamentosCarregados ||
      uidLancamentos !== usuarioAtual.uid
    ) {
      alert('Aguarde a sincronização dos dados antes de importar o arquivo.');
      return;
    }
    // COLE O CÓDIGO NOVO AQUI
    if (empresaIdAtual === 'empresa_demo') {
      alert(
        'Selecione uma empresa cadastrada antes de importar dados financeiros.'
      );
      return;
    }
    try {
      if (arquivo.size === 0) {
        alert('O arquivo está vazio.');
        return;
      }

      if (arquivo.size > 5 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 5 MB.');
        return;
      }

      // CSV e Excel convergem para as mesmas validações e deduplicação.
      const linhas: string[][] = linhasExcel
        ? linhasExcel.map((linha) => [...linha])
        : [];
      if (!linhasExcel) {
        const conteudo = (await arquivo.text())
          .replace(/^\uFEFF/, '')
          .replace(/\r\n?/g, '\n');

        if (!conteudo.trim()) {
          alert('O arquivo está vazio.');
          return;
        }

        // Detecta o separador fora de campos entre aspas. Aceita CSV com
        // ponto e vírgula, vírgula ou tabulação, sem confundir valores decimais.
        const primeiraLinha = conteudo.split('\n')[0];
        const contagens = new Map<string, number>([
          [';', 0],
          [',', 0],
          ['\t', 0],
        ]);
        let aspasCabecalho = false;
        for (let i = 0; i < primeiraLinha.length; i++) {
          const caractere = primeiraLinha[i];
          if (caractere === '"') {
            if (aspasCabecalho && primeiraLinha[i + 1] === '"') i++;
            else aspasCabecalho = !aspasCabecalho;
          } else if (!aspasCabecalho && contagens.has(caractere)) {
            contagens.set(caractere, (contagens.get(caractere) ?? 0) + 1);
          }
        }
        const separador = [...contagens.entries()].sort(
          (a, b) => b[1] - a[1]
        )[0][0];
        if ((contagens.get(separador) ?? 0) === 0) {
          alert(
            'Não foi possível identificar as colunas do CSV. Use vírgula, ponto e vírgula ou tabulação.'
          );
          return;
        }

        // Lê CSV respeitando aspas e separadores dentro dos campos.

        let linha: string[] = [];
        let campo = '';
        let entreAspas = false;

        for (let i = 0; i < conteudo.length; i++) {
          const caractere = conteudo[i];

          if (caractere === '"') {
            if (entreAspas && conteudo[i + 1] === '"') {
              campo += '"';
              i++;
            } else {
              entreAspas = !entreAspas;
            }
          } else if (caractere === separador && !entreAspas) {
            linha.push(campo.trim());
            campo = '';
          } else if (caractere === '\n' && !entreAspas) {
            linha.push(campo.trim());

            if (linha.some((valor) => valor.length > 0)) {
              linhas.push(linha);
            }

            linha = [];
            campo = '';
          } else {
            campo += caractere;
          }
        }

        if (entreAspas) {
          alert('CSV inválido: existem aspas sem fechamento.');
          return;
        }

        linha.push(campo.trim());

        if (linha.some((valor) => valor.length > 0)) {
          linhas.push(linha);
        }

        if (linhas.length < 2) {
          alert('O arquivo CSV não contém lançamentos.');
          return;
        }
      }
      if (linhas.length < 2) {
        alert('O arquivo não contém lançamentos.');
        return;
      }

      // FASE 4 — PADRONIZAÇÃO DOS CABEÇALHOS CSV

      const normalizarCabecalho = (texto: string) =>
        texto
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');

      // Equivalências explícitas e conservadoras. Cabeçalhos que possam
      // significar mais de um campo continuam exigindo confirmação manual.
      const nomesAceitos: Record<CampoCSV, string[]> = {
        data: [
          'data',
          'datalancamento',
          'datamovimento',
          'date',
          'datapagamento',
          'datarecebimento',
          'dataemissao',
          'dataefetivacao',
          'datadaoperacao',
          'datatransacao',
          'datadatransacao',
          'datadomovimento',
          'datadoregistro',
          'datacompetencia',
          'dataregistro',
          'dtmovimento',
        ],
        descricao: [
          'descricao',
          'historico',
          'detalhes',
          'description',
          'observacao',
          'descricaodomovimento',
          'descricaodaoperacao',
          'descricaodatransacao',
          'historicolancamento',
          'historicodomovimento',
          'detalhesdomovimento',
          'nomedomovimento',
          'discriminacao',
          'memo',
          'narrativa',
          'complemento',
          'historicooperacao',
          'descricaooperacao',
        ],
        categoria: [
          'categoria',
          'grupo',
          'category',
          'grupofinanceiro',
          'categoriafinanceira',
          'categoriadolancamento',
          'categoriadomovimento',
          'grupodecontas',
          'classificacao',
          'planodecontas',
          'centrodecusto',
        ],
        tipo: [
          'tipo',
          'natureza',
          'tipomovimento',
          'type',
          'naturezadaoperacao',
          'naturezadomovimento',
          'tipodelancamento',
          'tipodetransacao',
          'tipodaoperacao',
          'tipodomovimento',
          'entradaousaida',
          'receitaoudespesa',
          'creditooudebito',
        ],
        valor: [
          'valor',
          'valorbruto',
          'amount',
          'quantia',
          'valoremreais',
          'valordomovimento',
          'valordaoperacao',
          'valordatransacao',
          'valordolancamento',
          'valortotal',
          'montante',
          'montantetotal',
          'valorliquido',
          'valorpago',
          'valorrecebido',
          'valorbrl',
        ],
      };

      const cabecalhoOriginal = linhas[0].map(normalizarCabecalho);

      const cabecalho = cabecalhoOriginal.map((nome) => {
        for (const [campo, alternativas] of Object.entries(nomesAceitos)) {
          if (alternativas.includes(nome)) {
            return campo;
          }
        }

        return nome;
      });

      // Em arquivos desconhecidos, pedir confirmação apenas dos campos não identificados.
      // Mapeamentos manuais referenciam a posição original, sem renomear o CSV.
      if (mapaConfirmado) {
        for (const campoObrigatorio of camposCSV) {
          const posicao = Number(mapaConfirmado[campoObrigatorio]);
          if (
            !Number.isInteger(posicao) ||
            posicao < 0 ||
            posicao >= cabecalho.length
          ) {
            alert(
              'Confira as cinco informações necessárias antes de importar.'
            );
            return;
          }
        }
        if (
          new Set(camposCSV.map((campo) => mapaConfirmado[campo])).size !==
          camposCSV.length
        ) {
          alert('Cada informação precisa utilizar uma coluna diferente.');
          return;
        }
        // Colunas não selecionadas são ignoradas; evita aliases duplicados.
        for (let posicao = 0; posicao < cabecalho.length; posicao++) {
          cabecalho[posicao] = `coluna_nao_usada_${posicao}`;
        }
        for (const campoObrigatorio of camposCSV) {
          cabecalho[Number(mapaConfirmado[campoObrigatorio])] =
            campoObrigatorio;
        }
      } else {
        const faltantes = camposCSV.filter(
          (campo) => cabecalho.filter((nome) => nome === campo).length !== 1
        );
        if (faltantes.length > 0) {
          const sugestoes = {} as Record<CampoCSV, string>;
          for (const campo of camposCSV) {
            const posicao = cabecalho.indexOf(campo);
            sugestoes[campo] = posicao >= 0 ? String(posicao) : '';
          }
          setMapaCSV(sugestoes);
          setColunasPendentesCSV(linhas[0]);
          setArquivoPendenteCSV(arquivo);
          return;
        }
      }

      const obrigatorios = [...camposCSV];
      if (
        !obrigatorios.every((nome) => cabecalho.includes(nome)) ||
        obrigatorios.some(
          (nome) => cabecalho.filter((coluna) => coluna === nome).length !== 1
        )
      ) {
        alert('Não foi possível identificar as colunas. Confira o mapeamento.');
        return;
      }

      const indice = (nome: string) => cabecalho.indexOf(nome);

      const novosLancamentos: LancamentoFinanceiro[] = [];
      const importacaoId = crypto.randomUUID();
      const importadoEm = new Date().toISOString();

      // Identificador estável para evitar importações repetidas.
      const chaveRegistro = (
        registro: Pick<
          LancamentoFinanceiro,
          'empresaId' | 'data' | 'descricao' | 'categoria' | 'tipo' | 'valor'
        >
      ) =>
        JSON.stringify([
          registro.empresaId,
          registro.data,
          registro.descricao.trim().toLowerCase(),
          registro.categoria.trim().toLowerCase(),
          registro.tipo,
          Math.round(registro.valor * 100),
        ]);

      const chavesExistentes = new Set(
        lancamentosFinanceiros.map(chaveRegistro)
      );

      let duplicados = 0;

      for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i];

        if (colunas.length !== cabecalho.length) {
          alert(
            `Linha ${
              i + 1
            }: quantidade de colunas incorreta. Importação cancelada.`
          );
          return;
        }

        const dataTexto = colunas[indice('data')].trim();
        const descricao = colunas[indice('descricao')].trim();
        const categoria = colunas[indice('categoria')].trim();
        const tipoOriginal = colunas[indice('tipo')]
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        // Somente equivalências inequívocas: nunca adivinhar a natureza
        // de um lançamento a partir de um valor ou descrição.
        const tiposReceita = [
          'RECEITA',
          'ENTRADA',
          'CREDITO',
          'CREDIT',
          'INCOME',
          'R',
        ];
        const tiposDespesa = [
          'DESPESA',
          'SAIDA',
          'DEBITO',
          'DEBIT',
          'EXPENSE',
          'D',
        ];
        const tipoTexto = tiposReceita.includes(tipoOriginal)
          ? 'RECEITA'
          : tiposDespesa.includes(tipoOriginal)
          ? 'DESPESA'
          : '';
        const valorTexto = colunas[indice('valor')].trim();

        // FASE 4 — DATAS BRASILEIRAS E INTERNACIONAIS

        let data = dataTexto;

        const dataBrasileira = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(
          dataTexto
        );

        if (dataBrasileira) {
          const [, dia, mes, ano] = dataBrasileira;
          data = `${ano}-${mes}-${dia}`;
        }

        const dataFormatoValido = /^\d{4}-\d{2}-\d{2}$/.test(data);

        const dataObjeto = dataFormatoValido
          ? new Date(`${data}T12:00:00Z`)
          : new Date(NaN);

        const dataValida =
          !Number.isNaN(dataObjeto.getTime()) &&
          dataObjeto.toISOString().slice(0, 10) === data;

        // FASE 4 — VALORES BRASILEIROS E INTERNACIONAIS

        // Aceita moeda explícita e espaços, sem aceitar sinais negativos:
        // a natureza (receita/despesa) precisa vir da coluna tipo.
        const valorLimpo = valorTexto.replace(/^R\$\s*/i, '').trim();
        let valorNormalizado = valorLimpo;
        let formatoValorValido = false;

        if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(valorLimpo)) {
          // Exemplo: 1.500,50
          valorNormalizado = valorLimpo.replace(/\./g, '').replace(',', '.');
          formatoValorValido = true;
        } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(valorLimpo)) {
          // Exemplo: 1,500.50
          valorNormalizado = valorLimpo.replace(/,/g, '');
          formatoValorValido = true;
        } else if (/^\d+(?:[.,]\d{1,2})?$/.test(valorLimpo)) {
          // Exemplos: 1500,50 / 1500.50 / 1500
          valorNormalizado = valorLimpo.replace(',', '.');
          formatoValorValido = true;
        }

        const valor = formatoValorValido ? Number(valorNormalizado) : NaN;

        const tipoValido = tipoTexto === 'RECEITA' || tipoTexto === 'DESPESA';

        if (
          !dataValida ||
          !descricao ||
          !categoria ||
          !tipoValido ||
          !formatoValorValido ||
          !Number.isFinite(valor) ||
          valor <= 0 ||
          !Number.isSafeInteger(Math.round(valor * 100))
        ) {
          alert(`Linha ${i + 1}: dados inválidos. Importação cancelada.`);
          return;
        }
        const registro: LancamentoFinanceiro = {
          id: crypto.randomUUID(),
          empresaId: empresaIdAtual,
          data,
          descricao,
          categoria,
          tipo: tipoTexto as 'RECEITA' | 'DESPESA',
          valor,
          origem: linhasExcel ? 'EXCEL' : 'CSV',
          importadoEm,
          arquivoOrigem: arquivo.name,
          importacaoId,

          // COLE O CÓDIGO NOVO AQUI
          sistemaOrigem: sistemaOrigemImportacao.trim() || 'ARQUIVO IMPORTADO',
        };

        const chave = chaveRegistro(registro);

        if (chavesExistentes.has(chave)) {
          duplicados++;
          continue;
        }

        chavesExistentes.add(chave);
        novosLancamentos.push(registro);
      }

      // Registra também tentativas válidas em que todos os itens eram duplicados.
      const eventoImportacao: HistoricoImportacao = {
        id: importacaoId,
        sistemaOrigem: sistemaOrigemImportacao.trim() || 'ARQUIVO IMPORTADO',
        // COLE O CÓDIGO NOVO AQUI
        empresaId: empresaIdAtual,
        nomeArquivo: arquivo.name,
        importadoEm,
        novos: novosLancamentos.length,
        duplicados,
        totalRegistros: linhas.length - 1,
      };

      if (novosLancamentos.length > 0) {
        setLancamentosFinanceiros((anteriores) => [
          ...anteriores,
          ...novosLancamentos,
        ]);
      }
      setHistoricoImportacoes((anteriores) => [
        eventoImportacao,
        ...anteriores,
      ]);

      alert(
        `${novosLancamentos.length} lançamento(s) importado(s).\n` +
          `${duplicados} duplicado(s) ignorado(s).`
      );
    } catch {
      alert('Não foi possível processar o arquivo CSV.');
    }
  }

  function adicionarLancamentoFinanceiro(lancamento: LancamentoFinanceiro) {
    setLancamentosFinanceiros((anteriores) => {
      const jaExiste = anteriores.some(
        (item) =>
          item.empresaId === lancamento.empresaId && item.id === lancamento.id
      );

      if (jaExiste) {
        return anteriores;
      }

      return [...anteriores, lancamento];
    });
  }

  // MARCO 11 — RESUMO FINANCEIRO AUTOMÁTICO

  const lancamentosEmpresa = lancamentosFinanceiros.filter(
    (lancamento) => lancamento.empresaId === empresaIdAtual
  );
  // FASE 3 — CONVERSÃO PARA O MODELO UNIVERSAL

  const registrosFinanceirosUniversais: RegistroFinanceiroUniversal[] =
    lancamentosEmpresa.map((lancamento) => ({
      id: lancamento.id,
      empresaId: lancamento.empresaId,
      data: lancamento.data,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      tipo: lancamento.tipo,
      valorCentavos: Math.round(lancamento.valor * 100),
      moeda: 'BRL',
      origem: {
        sistema: lancamento.sistemaOrigem ?? 'PREVANZIA',
        tipo: lancamento.origem ?? 'MANUAL',
        importadoEm: lancamento.importadoEm ?? '',
        identificadorExterno: lancamento.id,
        arquivoOrigem: lancamento.arquivoOrigem,
        importacaoId: lancamento.importacaoId,
      },
    }));

  // FASE 3 — UTILIZAÇÃO SOMENTE DE REGISTROS VÁLIDOS

  const registrosFinanceirosValidos = registrosFinanceirosUniversais.filter(
    validarRegistroFinanceiroUniversal
  );

  const dadosUniversaisEmpresa: DadosUniversaisEmpresa = {
    empresaId: empresaIdAtual,
    registrosFinanceiros: registrosFinanceirosValidos,
    clientes: [],
    servicos: [],
    atualizadoEm: '',
  };

  // FASE 3 — CÁLCULOS A PARTIR DOS DADOS UNIVERSAIS

  const totalReceitas =
    dadosUniversaisEmpresa.registrosFinanceiros
      .filter((registro) => registro.tipo === 'RECEITA')
      .reduce((total, registro) => total + registro.valorCentavos, 0) / 100;

  const totalDespesas =
    dadosUniversaisEmpresa.registrosFinanceiros
      .filter((registro) => registro.tipo === 'DESPESA')
      .reduce((total, registro) => total + registro.valorCentavos, 0) / 100;

  const saldoFinanceiro = totalReceitas - totalDespesas;

  const situacaoFinanceira =
    saldoFinanceiro > 0
      ? 'POSITIVO'
      : saldoFinanceiro < 0
      ? 'NEGATIVO'
      : 'ZERADO';

  const formatarValorFinanceiro = (valor: number) =>
    valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  // INTELIGÊNCIA FINANCEIRA — FILTRO DE PERÍODO E COMPARAÇÃO REAL
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioMesAnterior = new Date(
    hoje.getFullYear(),
    hoje.getMonth() - 1,
    1
  );
  const inicio90Dias = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - 89
  );
  const dataISO = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(data.getDate()).padStart(2, '0')}`;
  const limiteFinal = dataISO(hoje);
  const inicioAtual =
    periodo === 'Mês anterior'
      ? dataISO(inicioMesAnterior)
      : periodo === 'Últimos 90 dias'
      ? dataISO(inicio90Dias)
      : dataISO(inicioMes);
  const fimAtual =
    periodo === 'Mês anterior'
      ? dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0))
      : limiteFinal;
  const registrosDoPeriodo = dadosUniversaisEmpresa.registrosFinanceiros.filter(
    (registro) => registro.data >= inicioAtual && registro.data <= fimAtual
  );
  // Compara meses pelo mesmo intervalo de dias do calendário.
  // Para os últimos 90 dias, mantém duas janelas consecutivas de 90 dias.
  const diasNoPeriodo =
    Math.round(
      (Date.parse(`${fimAtual}T00:00:00Z`) -
        Date.parse(`${inicioAtual}T00:00:00Z`)) /
        86400000
    ) + 1;
  const inicioComparacaoEquivalente =
    periodo === 'Este mês'
      ? dataISO(inicioMesAnterior)
      : periodo === 'Mês anterior'
      ? dataISO(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1))
      : dataISO(
          new Date(
            Date.parse(`${inicioAtual}T12:00:00Z`) - diasNoPeriodo * 86400000
          )
        );
  const fimComparacaoEquivalente =
    periodo === 'Este mês'
      ? dataISO(
          new Date(
            hoje.getFullYear(),
            hoje.getMonth() - 1,
            Math.min(
              hoje.getDate(),
              new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate()
            )
          )
        )
      : periodo === 'Mês anterior'
      ? dataISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 0))
      : dataISO(new Date(Date.parse(`${inicioAtual}T12:00:00Z`) - 86400000));
  const registrosComparacao =
    dadosUniversaisEmpresa.registrosFinanceiros.filter(
      (registro) =>
        registro.data >= inicioComparacaoEquivalente &&
        registro.data <= fimComparacaoEquivalente
    );
  const comparacaoDisponivel =
    registrosDoPeriodo.length > 0 && registrosComparacao.length > 0;
  const receitaComparacao = somarTipoComparativo(
    registrosComparacao,
    'RECEITA'
  );
  const despesaComparacao = somarTipoComparativo(
    registrosComparacao,
    'DESPESA'
  );
  const receitaAtual = somarTipoComparativo(registrosDoPeriodo, 'RECEITA');
  const despesaAtual = somarTipoComparativo(registrosDoPeriodo, 'DESPESA');
  // FASE 5 — Decomposição aritmética da mudança do resultado registrado.
  // Não atribui causalidade nem confunde alteração de margem com alteração de lucro.
  const variacaoReceitas = receitaAtual - receitaComparacao;
  const variacaoDespesas = despesaAtual - despesaComparacao;
  const contribuicaoReceitas = variacaoReceitas;
  const contribuicaoDespesas = -variacaoDespesas;
  const variacaoResultado = contribuicaoReceitas + contribuicaoDespesas;
  const diagnostico = calcularDiagnostico(
    registrosDoPeriodo,
    registrosComparacao,
    formatarValorFinanceiro
  );
  const dadosFinanceirosIncompletos =
    diagnostico.quantidade > 0 &&
    diagnostico.receitas > 0 &&
    diagnostico.despesas === 0;
  // Uma única fonte de alertas para todas as seções do aplicativo.
  const alertas = [
    ...diagnostico.alertas,
    ...(dadosFinanceirosIncompletos
      ? [
          {
            titulo: 'Despesas não informadas',
            descricao:
              'Existem receitas registradas, mas nenhuma despesa neste período. Verifique se os gastos foram importados ou cadastrados antes de avaliar o resultado.',
            nivel: 'medio' as const,
          },
        ]
      : []),
  ];
  // Consolidar alertas correlatos em uma única orientação executiva.
  // Os alertas originais continuam disponíveis para outras regras internas.
  const alertaPrioritario =
    diagnostico.resultado < 0 && diagnostico.receitas > 0
      ? {
          titulo: 'Atenção: suas despesas superaram as receitas.',
          descricao: `O resultado registrado ficou negativo em ${formatarValorFinanceiro(
            Math.abs(diagnostico.resultado)
          )}. ${
            comparacaoDisponivel && variacaoDespesas > 0
              ? `As despesas aumentaram ${formatarValorFinanceiro(
                  variacaoDespesas
                )} em relação ao período anterior.`
              : 'Confira quais despesas estão comprometendo o resultado.'
          }`,
          recomendacao:
            'Investigue os gastos que mais pesaram no período e avalie quais podem ser reduzidos sem comprometer a operação.',
          nivel: 'alto' as const,
        }
      : dadosFinanceirosIncompletos
      ? {
          titulo: 'Confira se os dados de despesas estão completos.',
          descricao:
            'Há receitas registradas, mas nenhuma despesa informada neste período.',
          recomendacao:
            'Verifique a importação dos gastos antes de tomar decisões.',
          nivel: 'medio' as const,
        }
      : alertas.length > 0
      ? {
          titulo: alertas[0].titulo,
          descricao: alertas[0].descricao,
          recomendacao:
            'Confira os registros relacionados a esse ponto antes de decidir.',
          nivel: alertas[0].nivel,
        }
      : null;

  // Oportunidades exigem evidência de risco relevante nos registros.
  // Não transformar dicas genéricas nem pequenas variações de teste em oportunidades.
  const oportunidadesRelevantes =
    !dadosFinanceirosIncompletos && diagnostico.quantidade >= 5
      ? alertas
          .filter((alerta) => alerta.nivel === 'alto')
          .map((alerta) => {
            if (alerta.titulo.includes('Despesas'))
              return 'Investigar os gastos que estão comprometendo o resultado e avaliar reduções sem prejudicar a operação.';
            if (alerta.titulo.includes('Receitas'))
              return 'Identificar as fontes de receita que perderam movimento e avaliar medidas de recuperação.';
            return 'Investigar o ponto de atenção identificado antes de definir uma ação.';
          })
          .filter((item, indice, lista) => lista.indexOf(item) === indice)
          .slice(0, 3)
      : [];

  const [secao, setSecao] = useState('Visão geral');
  const [novaDecisao, setNovaDecisao] = useState('');
  const [descricaoLancamento, setDescricaoLancamento] = useState('');
  const [tipoLancamento, setTipoLancamento] = useState<'RECEITA' | 'DESPESA'>(
    'RECEITA'
  );
  const [valorLancamento, setValorLancamento] = useState('');
  const [categoriaLancamento, setCategoriaLancamento] = useState('');
  const [dataLancamento, setDataLancamento] = useState(
    new Date().toLocaleDateString('en-CA')
  );
  // As decisões são carregadas somente depois da autenticação e da leitura da nuvem.
  const [decisoes, setDecisoes] = useState<string[]>([]);
  const [acompanhamentos, setAcompanhamentos] = useState<
    Record<string, AcompanhamentoDecisao>
  >({});

  const registrarDecisaoVinculada = (texto: string, origem: string) => {
    if (
      !usuarioAtual ||
      empresaIdAtual === 'empresa_demo' ||
      chaveDecisoesCarregada !== `${usuarioAtual.uid}:${empresaIdAtual}`
    ) {
      alert('Selecione uma empresa e aguarde as decisões serem carregadas.');
      return;
    }
    const descricao = texto.trim();
    if (!descricao) return;

    // Impede a mesma decisão no mesmo período, preservando decisões de outros períodos.
    const normalizar = (valor: string) =>
      valor
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    const jaRegistrada = decisoes.some((decisao, indice) => {
      const anterior = acompanhamentos[String(indice)];
      return (
        normalizar(decisao) === normalizar(descricao) &&
        (!anterior ||
          (anterior.inicioBase === inicioAtual &&
            anterior.fimBase === fimAtual))
      );
    });
    if (jaRegistrada) {
      alert('Esta decisão já foi registrada para o período selecionado.');
      return;
    }

    const indice = decisoes.length;
    setDecisoes((anteriores) => [...anteriores, descricao]);
    setAcompanhamentos((anteriores) => ({
      ...anteriores,
      [String(indice)]: {
        origem,
        registradaEm: new Date().toISOString(),
        periodoBase: periodo,
        inicioBase: inicioAtual,
        fimBase: fimAtual,
        receitasBase: diagnostico.receitas,
        despesasBase: diagnostico.despesas,
        resultadoBase: diagnostico.resultado,
        quantidadeBase: diagnostico.quantidade,
      },
    }));
    setNovaDecisao('');
  };

  const registrarAvaliacao = (indice: number) => {
    if (
      !usuarioAtual ||
      empresaIdAtual === 'empresa_demo' ||
      chaveDecisoesCarregada !== `${usuarioAtual.uid}:${empresaIdAtual}`
    )
      return;
    const chave = String(indice);
    const acompanhamento = acompanhamentos[chave];
    if (!acompanhamento) return;

    const dias = (inicio: string, fim: string) => {
      const a = Date.parse(`${inicio}T12:00:00Z`);
      const b = Date.parse(`${fim}T12:00:00Z`);
      return Number.isFinite(a) && Number.isFinite(b) && b >= a
        ? Math.round((b - a) / 86400000) + 1
        : 0;
    };

    if (inicioAtual <= acompanhamento.fimBase) {
      alert(
        'Escolha um período posterior ao período-base da decisão. Não é possível medir o resultado com os mesmos dados ou com períodos sobrepostos.'
      );
      return;
    }

    if (
      dias(inicioAtual, fimAtual) !==
      dias(acompanhamento.inicioBase, acompanhamento.fimBase)
    ) {
      alert(
        'Os períodos têm durações diferentes. Selecione períodos de mesma duração para uma comparação válida.'
      );
      return;
    }

    if (
      (acompanhamento.quantidadeBase ?? 0) === 0 ||
      diagnostico.quantidade === 0
    ) {
      alert(
        'Faltam lançamentos financeiros em um dos períodos. Importe dados reais antes de registrar a avaliação.'
      );
      return;
    }

    setAcompanhamentos((anteriores) => ({
      ...anteriores,
      [chave]: {
        ...anteriores[chave],
        avaliadaEm: new Date().toISOString(),
        inicioAvaliacao: inicioAtual,
        fimAvaliacao: fimAtual,
        quantidadeAvaliacao: diagnostico.quantidade,
        receitasAvaliacao: diagnostico.receitas,
        despesasAvaliacao: diagnostico.despesas,
        resultadoAvaliacao: diagnostico.resultado,
      },
    }));
  };

  const [resultadosDecisoes, setResultadosDecisoes] = useState<
    Record<string, 'PENDENTE' | 'POSITIVO' | 'NEGATIVO'>
  >({});
  const [impactosDecisoes, setImpactosDecisoes] = useState<
    Record<string, number>
  >({});

  // FASE 7 — Serialização estável para comparar snapshots do Firestore.
  // A ordem das chaves de objetos não altera a equivalência dos dados.
  const serializarDecisoesEstavel = (valor: unknown): string => {
    const normalizar = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(normalizar);
      if (item !== null && typeof item === 'object') {
        return Object.fromEntries(
          Object.entries(item as Record<string, unknown>)
            .filter(([, conteudo]) => conteudo !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([chave, conteudo]) => [chave, normalizar(conteudo)])
        );
      }
      return item;
    };
    return JSON.stringify(normalizar(valor));
  };

  // FASE 7 — Decisões isoladas por empresa. O documento antigo é preservado.
  const [chaveDecisoesCarregada, setChaveDecisoesCarregada] = useState<
    string | null
  >(null);
  const ultimoPacoteDecisoes = useRef('');
  const envioDecisoesPendente = useRef(false);
  const chaveDecisoesRef = useRef<string | null>(null);

  useEffect(() => {
    setChaveDecisoesCarregada(null);
    setDecisoes([]);
    setAcompanhamentos({});
    setResultadosDecisoes({});
    setImpactosDecisoes({});
    ultimoPacoteDecisoes.current = '';
    envioDecisoesPendente.current = false;

    const uid = usuarioAtual?.uid;
    const empresaValida =
      !!uid &&
      empresaIdAtual !== 'empresa_demo' &&
      empresasCadastradas.some(
        (e) => e.id === empresaIdAtual && e.proprietarioUid === uid
      );
    const chave = empresaValida ? `${uid}:${empresaIdAtual}` : null;
    chaveDecisoesRef.current = chave;
    if (!uid || !chave) return;

    let ativo = true;
    let inicializando = false;
    const referencia = doc(
      db,
      'usuarios',
      uid,
      'empresas',
      empresaIdAtual,
      'configuracoes',
      'decisoes'
    );

    const validarPacote = (valor: unknown) => {
      const dados =
        valor && typeof valor === 'object'
          ? (valor as Record<string, unknown>)
          : {};
      const lista =
        Array.isArray(dados.decisoes) &&
        dados.decisoes.every((item) => typeof item === 'string')
          ? (dados.decisoes as string[])
          : [];
      const objeto = (v: unknown): Record<string, unknown> =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? (v as Record<string, unknown>)
          : {};
      const acompanhamentosValidos = Object.fromEntries(
        Object.entries(objeto(dados.acompanhamentos)).filter(
          ([, v]) =>
            v !== null &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            typeof (v as Record<string, unknown>).origem === 'string' &&
            typeof (v as Record<string, unknown>).registradaEm === 'string'
        )
      ) as Record<string, AcompanhamentoDecisao>;
      const resultadosValidos = Object.fromEntries(
        Object.entries(objeto(dados.resultados)).filter(
          ([, v]) => v === 'PENDENTE' || v === 'POSITIVO' || v === 'NEGATIVO'
        )
      ) as Record<string, 'PENDENTE' | 'POSITIVO' | 'NEGATIVO'>;
      const impactosValidos = Object.fromEntries(
        Object.entries(objeto(dados.impactos)).filter(
          ([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0
        )
      ) as Record<string, number>;
      return {
        decisoes: lista,
        acompanhamentos: acompanhamentosValidos,
        resultados: resultadosValidos,
        impactos: impactosValidos,
      };
    };

    const aplicar = (pacote: ReturnType<typeof validarPacote>) => {
      if (!ativo || chaveDecisoesRef.current !== chave) return;
      ultimoPacoteDecisoes.current = serializarDecisoesEstavel(pacote);
      setDecisoes(pacote.decisoes);
      setAcompanhamentos(pacote.acompanhamentos);
      setResultadosDecisoes(pacote.resultados);
      setImpactosDecisoes(pacote.impactos);
      setChaveDecisoesCarregada(chave);
    };

    const cancelar = onSnapshot(
      referencia,
      async (snapshot) => {
        if (
          !ativo ||
          chaveDecisoesRef.current !== chave ||
          snapshot.metadata.hasPendingWrites ||
          envioDecisoesPendente.current
        )
          return;
        if (snapshot.exists()) {
          aplicar(validarPacote(snapshot.data()));
          return;
        }
        if (inicializando) return;
        inicializando = true;
        try {
          // FASE 7 — Inicialização isolada por empresa.
          // O documento legado permanece intacto.
          // COLE O CÓDIGO NOVO AQUI
          const inicial = validarPacote({});

          if (!ativo || chaveDecisoesRef.current !== chave) return;
          envioDecisoesPendente.current = true;

          // Não sobrescrever um documento criado por outro dispositivo.
          await runTransaction(db, async (transacao) => {
            const existente = await transacao.get(referencia);
            if (!existente.exists()) {
              transacao.set(referencia, inicial);
            }
          });

          if (!ativo || chaveDecisoesRef.current !== chave) return;
          const atualizado = await getDoc(referencia);
          if (atualizado.exists()) {
            aplicar(validarPacote(atualizado.data()));
          }
        } catch (erro) {
          console.error('Falha ao preparar decisões da empresa:', erro);
          alert(
            'Não foi possível carregar as decisões desta empresa. Confira o Firebase.'
          );
        } finally {
          inicializando = false;
          envioDecisoesPendente.current = false;
        }
      },
      (erro) => {
        console.error('Falha ao ler decisões da empresa:', erro);
        alert(
          'Falha na leitura das decisões. Não registre novas decisões até corrigir a conexão.'
        );
      }
    );

    return () => {
      ativo = false;
      cancelar();
    };
  }, [usuarioAtual, empresaIdAtual, empresasCadastradas]);

  // FASE 7 — Evita gravações concorrentes e detecta edição em outro dispositivo.
  const [revisaoSalvamentoDecisoes, setRevisaoSalvamentoDecisoes] = useState(0);
  const salvamentoDecisoesEmAndamento = useRef(false);
  const bloqueioConflitoDecisoes = useRef(false);

  useEffect(() => {
    // Um conflito precisa ser resolvido antes de permitir novos envios.
    bloqueioConflitoDecisoes.current = false;
    salvamentoDecisoesEmAndamento.current = false;
  }, [usuarioAtual?.uid, empresaIdAtual]);

  useEffect(() => {
    if (!usuarioAtual || empresaIdAtual === 'empresa_demo') return;
    const chave = `${usuarioAtual.uid}:${empresaIdAtual}`;
    if (chaveDecisoesCarregada !== chave || chaveDecisoesRef.current !== chave)
      return;
    if (bloqueioConflitoDecisoes.current) return;

    const pacote = {
      decisoes,
      acompanhamentos,
      resultados: resultadosDecisoes,
      impactos: impactosDecisoes,
    };
    const serializado = serializarDecisoesEstavel(pacote);
    if (serializado === ultimoPacoteDecisoes.current) return;

    // Agrupa alterações do mesmo clique (decisão + acompanhamento).
    const temporizador = window.setTimeout(async () => {
      if (
        chaveDecisoesRef.current !== chave ||
        bloqueioConflitoDecisoes.current ||
        salvamentoDecisoesEmAndamento.current
      )
        return;

      salvamentoDecisoesEmAndamento.current = true;
      envioDecisoesPendente.current = true;
      const base = ultimoPacoteDecisoes.current;
      const referencia = doc(
        db,
        'usuarios',
        usuarioAtual.uid,
        'empresas',
        empresaIdAtual,
        'configuracoes',
        'decisoes'
      );
      try {
        await runTransaction(db, async (transacao) => {
          const remoto = await transacao.get(referencia);
          // Se outro dispositivo alterou o documento, não sobrescrever.
          const dadosRemotos = remoto.exists() ? remoto.data() : null;
          const remotoSerializado = dadosRemotos
            ? serializarDecisoesEstavel({
                decisoes: dadosRemotos.decisoes ?? [],
                acompanhamentos: dadosRemotos.acompanhamentos ?? {},
                resultados: dadosRemotos.resultados ?? {},
                impactos: dadosRemotos.impactos ?? {},
              })
            : '';
          if (remotoSerializado !== base) {
            throw new Error('CONFLITO_DECISOES');
          }
          transacao.set(referencia, pacote);
        });
        if (chaveDecisoesRef.current === chave) {
          ultimoPacoteDecisoes.current = serializado;
        }
      } catch (erro) {
        console.error('Falha ao salvar decisões da empresa:', erro);
        if (chaveDecisoesRef.current === chave) {
          bloqueioConflitoDecisoes.current = true;
          if (erro instanceof Error && erro.message === 'CONFLITO_DECISOES') {
            alert(
              'As decisões foram alteradas em outro dispositivo. ' +
                'Sua alteração NÃO foi sobrescrita na nuvem. ' +
                'Não feche esta aba; confira as decisões antes de atualizar.'
            );
          } else {
            alert(
              'Não foi possível salvar as decisões. ' +
                'Não feche esta aba até verificar a conexão.'
            );
          }
        }
      } finally {
        salvamentoDecisoesEmAndamento.current = false;
        envioDecisoesPendente.current = false;
        if (
          chaveDecisoesRef.current === chave &&
          !bloqueioConflitoDecisoes.current
        ) {
          setRevisaoSalvamentoDecisoes((valor) => valor + 1);
        }
      }
    }, 400);

    return () => window.clearTimeout(temporizador);
  }, [
    usuarioAtual,
    empresaIdAtual,
    chaveDecisoesCarregada,
    decisoes,
    acompanhamentos,
    resultadosDecisoes,
    impactosDecisoes,
    revisaoSalvamentoDecisoes,
  ]);

  // Valores informados pelo usuário, não ganhos causalmente comprovados.
  const impactoFinanceiroAvaliado = (tipo: 'POSITIVO' | 'NEGATIVO') => {
    const duracao = (inicio: string, fim: string) => {
      const a = Date.parse(`${inicio}T12:00:00Z`);
      const b = Date.parse(`${fim}T12:00:00Z`);

      return Number.isFinite(a) && Number.isFinite(b) && b >= a
        ? Math.round((b - a) / 86400000) + 1
        : 0;
    };

    return Object.entries(impactosDecisoes)
      .filter(([indice, valor]) => {
        const acompanhamento = acompanhamentos[indice];

        if (
          resultadosDecisoes[indice] !== tipo ||
          !Number.isFinite(valor) ||
          valor < 0 ||
          !acompanhamento?.avaliadaEm ||
          !acompanhamento.inicioBase ||
          !acompanhamento.fimBase ||
          !acompanhamento.inicioAvaliacao ||
          !acompanhamento.fimAvaliacao ||
          (acompanhamento.quantidadeBase ?? 0) <= 0 ||
          (acompanhamento.quantidadeAvaliacao ?? 0) <= 0
        ) {
          return false;
        }

        const diasBase = duracao(
          acompanhamento.inicioBase,
          acompanhamento.fimBase
        );

        return (
          acompanhamento.inicioAvaliacao > acompanhamento.fimBase &&
          diasBase > 0 &&
          diasBase ===
            duracao(acompanhamento.inicioAvaliacao, acompanhamento.fimAvaliacao)
        );
      })
      .reduce((total, [, valor]) => total + valor, 0);
  };

  const decisaoPossuiAvaliacaoValida = (indice: number): boolean => {
    const a = acompanhamentos[String(indice)];
    if (
      !a?.avaliadaEm ||
      !a.inicioBase ||
      !a.fimBase ||
      !a.inicioAvaliacao ||
      !a.fimAvaliacao ||
      (a.quantidadeBase ?? 0) <= 0 ||
      (a.quantidadeAvaliacao ?? 0) <= 0
    )
      return false;
    const dias = (inicio: string, fim: string) => {
      const primeiro = Date.parse(`${inicio}T12:00:00Z`);
      const ultimo = Date.parse(`${fim}T12:00:00Z`);
      return Number.isFinite(primeiro) &&
        Number.isFinite(ultimo) &&
        ultimo >= primeiro
        ? Math.round((ultimo - primeiro) / 86400000) + 1
        : 0;
    };
    const base = dias(a.inicioBase, a.fimBase);
    return (
      a.inicioAvaliacao > a.fimBase &&
      base > 0 &&
      base === dias(a.inicioAvaliacao, a.fimAvaliacao)
    );
  };

  // Avaliação automática descritiva: janela posterior de igual duração,
  // sem alterar decisões, avaliações históricas ou classificações manuais.
  const comparacoesAutomaticas = decisoes.map((_, indice) => {
    const base = acompanhamentos[String(indice)];
    if (!base?.inicioBase || !base.fimBase || (base.quantidadeBase ?? 0) <= 0)
      return null;
    const inicioMs = Date.parse(`${base.inicioBase}T12:00:00Z`);
    const fimMs = Date.parse(`${base.fimBase}T12:00:00Z`);
    const duracao = Math.round((fimMs - inicioMs) / 86400000) + 1;
    if (!Number.isFinite(duracao) || duracao <= 0) return null;
    const inicioPosterior = dataISO(new Date(fimMs + 86400000));
    const fimPosterior = dataISO(new Date(fimMs + duracao * 86400000));
    // Não usar janela incompleta nem períodos futuros.
    if (fimPosterior > dataISO(new Date())) return null;
    const posteriores = dadosUniversaisEmpresa.registrosFinanceiros.filter(
      (registro) =>
        registro.data >= inicioPosterior && registro.data <= fimPosterior
    );
    if (!posteriores.length) return null;
    const receitas = somarTipoComparativo(posteriores, 'RECEITA');
    const despesas = somarTipoComparativo(posteriores, 'DESPESA');
    const resultado = receitas - despesas;
    const diferenca = resultado - base.resultadoBase;
    return { inicioPosterior, fimPosterior, resultado, diferenca };
  });

  const comparacoesDisponiveis = comparacoesAutomaticas.filter(
    (item) => item !== null
  ).length;

  const positivasAvaliadas = decisoes.filter(
    (_, i) =>
      resultadosDecisoes[String(i)] === 'POSITIVO' &&
      decisaoPossuiAvaliacaoValida(i)
  ).length;
  const negativasAvaliadas = decisoes.filter(
    (_, i) =>
      resultadosDecisoes[String(i)] === 'NEGATIVO' &&
      decisaoPossuiAvaliacaoValida(i)
  ).length;

  const ganhosAvaliados = impactoFinanceiroAvaliado('POSITIVO');
  const perdasAvaliadas = impactoFinanceiroAvaliado('NEGATIVO');

  const formatarImpactoAvaliado = (valor: number) =>
    valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const secoes = [
    'Visão geral',
    'Diagnóstico',
    'Oportunidades',
    'Decisões',
    'Resultados',
    'Fontes de dados',
    'Empresas',
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marca">
          <div className="marca-icone">P</div>
          <div>
            <strong>PREVANZIA</strong>
            <small>Inteligência empresarial</small>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut(auth)}
          style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Sair da conta
        </button>

        <p className="menu-titulo">PAINEL DO PROPRIETÁRIO</p>

        <nav
          className="menu"
          style={{ flexWrap: 'wrap', overflowX: 'visible', maxWidth: '100%' }}
        >
          {secoes.map((item) => (
            <button
              key={item}
              className={secao === item ? 'ativo' : ''}
              onClick={() => setSecao(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-rodape">
          <span className="status-ponto" />
          Ambiente de demonstração
        </div>
      </aside>

      <main className="conteudo">
        <header className="topo">
          <div>
            <p className="sobretitulo">CENTRAL DE INTELIGÊNCIA</p>
            <h1>{secao}</h1>
            <p className="subtitulo">
              Entenda o que acontece na empresa e decida com mais segurança.
            </p>
          </div>

          <select
            value={periodo}
            onChange={(evento) => setPeriodo(evento.target.value)}
            aria-label="Selecionar período"
          >
            <option>Este mês</option>
            <option>Mês anterior</option>
            <option>Últimos 90 dias</option>
          </select>
        </header>

        <div className="aviso-demo">
          <strong>Análise dos lançamentos cadastrados</strong>
          <span>
            Indicadores calculados com os lançamentos disponíveis na conta. Não
            incluem contas a receber, contas a pagar, impostos ou custos não
            informados. Registros de teste não representam uma empresa real.
          </span>
        </div>

        {secao === 'Visão geral' && (
          <section className="painel" style={{ maxWidth: '880px' }}>
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">
                  ANÁLISE PARA O PROPRIETÁRIO • {periodo.toUpperCase()}
                </p>
                <h2>O que você precisa saber</h2>
              </div>
            </div>

            <article
              style={{
                marginTop: '24px',
                padding: '26px',
                background: '#f8fbfb',
                border: '1px solid #e0e9e9',
                borderRadius: '14px',
              }}
            >
              <p className="sobretitulo">SITUAÇÃO DA EMPRESA</p>
              <h2 style={{ margin: '10px 0 14px', lineHeight: 1.3 }}>
                {diagnostico.quantidade === 0
                  ? 'Ainda não tenho informações suficientes para analisar sua empresa.'
                  : dadosFinanceirosIncompletos
                  ? 'Precisamos conferir os dados antes de tirar conclusões.'
                  : comparacaoDisponivel
                  ? variacaoResultado > 0
                    ? 'Sua empresa apresentou uma melhora no resultado registrado.'
                    : variacaoResultado < 0
                    ? 'O resultado registrado da sua empresa caiu.'
                    : 'O resultado registrado da sua empresa ficou estável.'
                  : diagnostico.resultado < 0
                  ? 'As despesas registradas superaram as receitas.'
                  : 'Já consigo analisar os registros, mas ainda falta uma comparação.'}
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: 1.7,
                  marginBottom: '18px',
                }}
              >
                {diagnostico.quantidade === 0
                  ? 'Importe os dados do sistema que você já utiliza. Assim poderei identificar o que merece sua atenção.'
                  : dadosFinanceirosIncompletos
                  ? 'Encontrei receitas, mas não há despesas informadas. Confira se a importação incluiu todos os gastos antes de avaliar o resultado.'
                  : comparacaoDisponivel
                  ? `Na comparação com o período anterior, a diferença entre o que entrou e o que saiu ${
                      variacaoResultado > 0
                        ? 'melhorou'
                        : variacaoResultado < 0
                        ? 'diminuiu'
                        : 'não mudou'
                    } ${formatarValorFinanceiro(
                      Math.abs(variacaoResultado)
                    )}. ${
                      Math.abs(contribuicaoDespesas) >=
                      Math.abs(contribuicaoReceitas)
                        ? `As despesas ${
                            variacaoDespesas > 0
                              ? 'aumentaram'
                              : variacaoDespesas < 0
                              ? 'diminuíram'
                              : 'permaneceram iguais'
                          } ${formatarValorFinanceiro(
                            Math.abs(variacaoDespesas)
                          )} e foram o fator mais relevante nessa diferença.`
                        : `As receitas ${
                            variacaoReceitas > 0
                              ? 'aumentaram'
                              : variacaoReceitas < 0
                              ? 'diminuíram'
                              : 'permaneceram iguais'
                          } ${formatarValorFinanceiro(
                            Math.abs(variacaoReceitas)
                          )} e foram o fator mais relevante nessa diferença.`
                    }`
                  : 'Já tenho alguns registros, mas ainda não há dados suficientes de outro período para dizer se houve melhora ou piora.'}
              </p>
              <div
                style={{ borderTop: '1px solid #dce5e7', paddingTop: '18px' }}
              >
                <p className="sobretitulo">MINHA RECOMENDAÇÃO</p>
                <p
                  style={{
                    fontSize: '16px',
                    lineHeight: 1.7,
                    marginTop: '8px',
                  }}
                >
                  {diagnostico.quantidade === 0
                    ? 'Comece importando os registros disponíveis. Não é necessário cadastrar tudo novamente.'
                    : dadosFinanceirosIncompletos
                    ? 'Confirme se os gastos da empresa estão completos. Sem eles, qualquer conclusão pode ser enganosa.'
                    : comparacaoDisponivel
                    ? Math.abs(contribuicaoDespesas) >=
                      Math.abs(contribuicaoReceitas)
                      ? variacaoDespesas < 0
                        ? 'Descubra o que permitiu gastar menos e avalie se essa economia pode continuar sem prejudicar os serviços.'
                        : variacaoDespesas > 0
                        ? 'Identifique quais gastos aumentaram e verifique se esse aumento era necessário.'
                        : 'Confira as despesas e acompanhe os próximos períodos antes de decidir.'
                      : variacaoReceitas < 0
                      ? 'Identifique quais serviços ou clientes geraram menos receita e avalie as possíveis causas.'
                      : variacaoReceitas > 0
                      ? 'Descubra quais serviços ou clientes contribuíram para o aumento das receitas e avalie se ele pode continuar.'
                      : 'Acompanhe as receitas nos próximos períodos para entender se houve uma mudança consistente.'
                    : 'Importe registros de outro período para que eu possa comparar a evolução da empresa.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSecao(
                    diagnostico.quantidade === 0
                      ? 'Fontes de dados'
                      : 'Diagnóstico'
                  )
                }
                style={{
                  marginTop: '22px',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  background: '#214b58',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {diagnostico.quantidade === 0
                  ? 'Importar dados'
                  : 'Ver detalhes da análise'}
              </button>
            </article>
            <p
              style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}
            >
              Análise baseada nos registros disponíveis. Não representa lucro
              líquido nem comprova a causa de uma mudança.
            </p>
          </section>
        )}
        {secao === 'Diagnóstico' && (
          <section className="painel" style={{ maxWidth: '880px' }}>
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">
                  POR TRÁS DA ANÁLISE • {periodo.toUpperCase()}
                </p>
                <h2>Por que chegamos a essa conclusão?</h2>
              </div>
            </div>
            <article
              style={{
                padding: '22px',
                background: '#f4f9f7',
                border: '1px solid #dce9e4',
                borderRadius: '16px',
                lineHeight: 1.65,
              }}
            >
              {diagnostico.quantidade === 0 ? (
                <p>
                  Ainda não há registros neste período. Importe os dados da
                  empresa para iniciar a análise.
                </p>
              ) : dadosFinanceirosIncompletos ? (
                <p>
                  Encontramos receitas, mas nenhuma despesa registrada. Antes de
                  avaliar o resultado, confira se todos os gastos foram
                  importados.
                </p>
              ) : !comparacaoDisponivel ? (
                <p>
                  Encontramos {diagnostico.quantidade} lançamento(s) neste
                  período, mas ainda não há registros suficientes no período
                  anterior para uma comparação confiável.
                </p>
              ) : (
                <>
                  <p className="sobretitulo">O QUE OS DADOS MOSTRAM</p>
                  <p>
                    No período atual, as receitas registradas somam{' '}
                    <strong>{formatarValorFinanceiro(receitaAtual)}</strong> e
                    as despesas,{' '}
                    <strong>{formatarValorFinanceiro(despesaAtual)}</strong>.
                  </p>
                  <p>
                    No período anterior equivalente, foram{' '}
                    <strong>
                      {formatarValorFinanceiro(receitaComparacao)}
                    </strong>{' '}
                    em receitas e{' '}
                    <strong>
                      {formatarValorFinanceiro(despesaComparacao)}
                    </strong>{' '}
                    em despesas.
                  </p>
                  <div
                    style={{
                      borderTop: '1px solid #dce9e4',
                      marginTop: '16px',
                      paddingTop: '14px',
                    }}
                  >
                    <p className="sobretitulo">O QUE EXPLICA A DIFERENÇA</p>
                    <p>
                      {variacaoDespesas !== 0 &&
                      Math.abs(contribuicaoDespesas) >=
                        Math.abs(contribuicaoReceitas)
                        ? `A maior mudança foi nas despesas, que ${
                            variacaoDespesas < 0 ? 'caíram' : 'subiram'
                          } ${formatarValorFinanceiro(
                            Math.abs(variacaoDespesas)
                          )}.`
                        : variacaoReceitas !== 0
                        ? `A maior mudança foi nas receitas, que ${
                            variacaoReceitas > 0 ? 'subiram' : 'caíram'
                          } ${formatarValorFinanceiro(
                            Math.abs(variacaoReceitas)
                          )}.`
                        : 'As receitas e despesas registradas não apresentaram variação entre os períodos.'}{' '}
                      A diferença no resultado foi de{' '}
                      {variacaoResultado > 0
                        ? '+'
                        : variacaoResultado < 0
                        ? '−'
                        : ''}
                      {formatarValorFinanceiro(Math.abs(variacaoResultado))}.
                    </p>
                  </div>
                </>
              )}
            </article>
            <p
              style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}
            >
              Comparação dos lançamentos disponíveis, não uma comprovação de
              causa ou de lucro líquido.
            </p>
            {alertaPrioritario && (
              <div style={{ marginTop: '18px' }}>
                <h3 style={{ marginBottom: '12px' }}>
                  Principal ponto de atenção
                </h3>
                <article className="alerta">
                  <span
                    className={`alerta-marcador ${alertaPrioritario.nivel}`}
                  />
                  <div>
                    <h3>{alertaPrioritario.titulo}</h3>
                    <p>{alertaPrioritario.descricao}</p>
                    <p style={{ marginTop: '12px' }}>
                      <strong>Minha recomendação:</strong>{' '}
                      {alertaPrioritario.recomendacao}
                    </p>
                  </div>
                </article>
                {alertas.length > 1 && (
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: '#64748b' }}>
                      Consultar os {alertas.length} alertas técnicos (opcional)
                    </summary>
                    <div style={{ marginTop: '12px' }}>
                      {alertas.map((alerta, indice) => (
                        <article
                          className="alerta"
                          key={`${alerta.titulo}-${indice}`}
                        >
                          <span className={`alerta-marcador ${alerta.nivel}`} />
                          <div>
                            <h3>{alerta.titulo}</h3>
                            <p>{alerta.descricao}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </section>
        )}
        {secao === 'Oportunidades' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">
                  OPORTUNIDADES • {periodo.toUpperCase()}
                </p>
                <h2>Onde vale a pena agir?</h2>
              </div>
            </div>
            {oportunidadesRelevantes.length === 0 ? (
              <article
                style={{
                  padding: '22px',
                  background: '#f4f9f7',
                  border: '1px solid #dce9e4',
                  borderRadius: '16px',
                  lineHeight: 1.65,
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Nenhuma oportunidade relevante identificada neste período.
                </h3>
                <p style={{ marginBottom: 0 }}>
                  {dadosFinanceirosIncompletos || diagnostico.quantidade < 5
                    ? 'Os registros disponíveis ainda são limitados para recomendar ações específicas com segurança. Confira se os dados da empresa estão completos.'
                    : 'As regras atuais não identificaram um problema prioritário que justifique uma recomendação adicional. Isso não significa que não existam oportunidades na empresa.'}
                </p>
              </article>
            ) : (
              <>
                <p style={{ color: '#64748b' }}>
                  Pontos prioritários identificados nos registros disponíveis:
                </p>
                {oportunidadesRelevantes.map((item, indice) => (
                  <article className="oportunidade" key={item}>
                    <span>{String(indice + 1).padStart(2, '0')}</span>
                    <div>
                      <p>{item}</p>
                    </div>
                  </article>
                ))}
              </>
            )}
            <p
              style={{ marginTop: '14px', color: '#64748b', fontSize: '13px' }}
            >
              Recomendações baseadas apenas nos dados disponíveis; não são
              previsões nem garantias de resultado.
            </p>
          </section>
        )}
        {secao === 'Decisões' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">ESCOLHAS DO PROPRIETÁRIO</p>
                <h2>Decisões em acompanhamento</h2>
              </div>
              <span className="contador">{decisoes.length} registradas</span>
            </div>
            <p className="subtitulo">
              O PREVANZIA acompanha as decisões registradas e verifica mudanças
              nos indicadores quando houver dados posteriores comparáveis.
            </p>
            {decisoes.length === 0 ? (
              <p>Nenhuma decisão registrada até agora.</p>
            ) : (
              <div style={{ marginTop: '20px' }}>
                {decisoes.map((decisao, indice) => {
                  const acompanhamento = acompanhamentos[String(indice)];
                  const avaliada = decisaoPossuiAvaliacaoValida(indice);
                  const comparacaoAutomatica = comparacoesAutomaticas[indice];
                  return (
                    <article className="oportunidade" key={indice}>
                      <span>{String(indice + 1).padStart(2, '0')}</span>
                      <div>
                        <p>{decisao}</p>
                        <small style={{ color: '#64748b' }}>
                          {comparacaoAutomatica
                            ? `Comparação automática: resultado ${
                                comparacaoAutomatica.diferenca > 0
                                  ? 'melhorou'
                                  : comparacaoAutomatica.diferenca < 0
                                  ? 'piorou'
                                  : 'ficou estável'
                              } em ${formatarValorFinanceiro(
                                Math.abs(comparacaoAutomatica.diferenca)
                              )} no período posterior. Isso não comprova a causa.`
                            : avaliada
                            ? 'Há uma comparação posterior registrada.'
                            : 'Aguardando dados de um período posterior equivalente.'}
                        </small>
                        {acompanhamento && (
                          <p
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              marginTop: '6px',
                            }}
                          >
                            Origem: {acompanhamento.origem}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <details
              style={{
                marginTop: '22px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '16px',
              }}
            >
              <summary
                style={{ cursor: 'pointer', color: '#214b58', fontWeight: 600 }}
              >
                Registrar uma decisão manualmente
              </summary>
              <form
                style={{ marginTop: '14px' }}
                onSubmit={(evento) => {
                  evento.preventDefault();
                  if (!novaDecisao.trim()) return;
                  registrarDecisaoVinculada(novaDecisao, 'Decisão manual');
                }}
              >
                <input
                  type="text"
                  value={novaDecisao}
                  onChange={(evento) => setNovaDecisao(evento.target.value)}
                  placeholder="Ex.: Rever condições com fornecedores"
                  aria-label="Nova decisão"
                  style={{
                    width: '100%',
                    padding: '13px',
                    border: '1px solid #dce4ef',
                    borderRadius: '10px',
                    marginBottom: '12px',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#214b58',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    fontWeight: 700,
                  }}
                >
                  Registrar decisão
                </button>
              </form>
            </details>
          </section>
        )}
        {secao === 'Resultados' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">O QUE ACONTECEU DEPOIS?</p>
                <h2>Acompanhamento dos resultados</h2>
              </div>
            </div>
            <article
              style={{
                padding: '22px',
                background: '#f4f9f7',
                border: '1px solid #dce9e4',
                borderRadius: '16px',
                lineHeight: 1.65,
              }}
            >
              <h3 style={{ fontSize: '21px', marginTop: 0 }}>
                {decisoes.length === 0
                  ? 'Ainda não há decisões para acompanhar.'
                  : comparacoesDisponiveis === 0
                  ? 'Ainda não temos resultados posteriores suficientes.'
                  : 'O PREVANZIA identificou mudanças após algumas decisões.'}
              </h3>
              <p>
                {decisoes.length === 0
                  ? 'Quando uma decisão for registrada, ela poderá ser acompanhada com os dados da empresa.'
                  : `Você possui ${decisoes.length} ${
                      decisoes.length === 1
                        ? 'decisão registrada'
                        : 'decisões registradas'
                    }. ${
                      comparacoesDisponiveis === 0
                        ? 'Ainda não há períodos posteriores completos com registros suficientes para uma comparação.'
                        : `Já foi possível comparar automaticamente ${comparacoesDisponiveis} ${
                            comparacoesDisponiveis === 1
                              ? 'decisão'
                              : 'decisões'
                          } com períodos posteriores.`
                    }`}
              </p>
              <div
                style={{
                  borderTop: '1px solid #dce9e4',
                  paddingTop: '12px',
                  marginTop: '12px',
                }}
              >
                <p className="sobretitulo">PRÓXIMO PASSO</p>
                <p style={{ marginBottom: 0 }}>
                  {decisoes.length === 0
                    ? 'Acompanhe as recomendações do PREVANZIA antes de registrar uma decisão.'
                    : 'O PREVANZIA fará a comparação automaticamente quando houver registros de um período posterior completo e equivalente. Mudanças observadas não comprovam que a decisão foi sua causa.'}
                </p>
              </div>
            </article>
            <details style={{ marginTop: '20px' }}>
              <summary
                style={{ cursor: 'pointer', color: '#214b58', fontWeight: 600 }}
              >
                Consultar histórico e avaliações detalhadas (opcional)
              </summary>
              <div style={{ marginTop: '18px' }}>
                <div className="painel-cabecalho">
                  <div>
                    <p className="sobretitulo">ACOMPANHAMENTO</p>
                    <h2>Resultados das decisões</h2>
                  </div>
                  <span className="contador">{decisoes.length} decisões</span>
                </div>

                <p className="subtitulo">
                  Acompanhe as decisões registradas e os resultados que ainda
                  precisam ser avaliados.
                </p>

                <div
                  style={{
                    padding: '16px 20px',
                    background: '#f0fdf4',
                    borderRadius: '12px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Decisões com resultado positivo
                  </p>

                  <strong style={{ fontSize: '28px', color: '#166534' }}>
                    {positivasAvaliadas}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px 20px',
                    background: '#fff1f2',
                    borderRadius: '12px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Decisões com resultado negativo
                  </p>

                  <strong style={{ fontSize: '28px', color: '#b91c1c' }}>
                    {negativasAvaliadas}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px 20px',
                    background: '#fff7ed',
                    borderRadius: '12px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Decisões pendentes de avaliação
                  </p>

                  <strong style={{ fontSize: '28px', color: '#c2410c' }}>
                    {decisoes.length - positivasAvaliadas - negativasAvaliadas}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px 20px',
                    background: '#eef2ff',
                    borderRadius: '12px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Taxa de sucesso das decisões
                  </p>

                  <strong style={{ fontSize: '28px', color: '#3730a3' }}>
                    {positivasAvaliadas + negativasAvaliadas === 0
                      ? 'Aguardando avaliações'
                      : `${(
                          (positivasAvaliadas /
                            (positivasAvaliadas + negativasAvaliadas)) *
                          100
                        )
                          .toFixed(1)
                          .replace('.', ',')}%`}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '20px',
                    background: '#eaf6f5',
                    borderRadius: '12px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Valores positivos informados após avaliação
                  </p>

                  <strong
                    style={{
                      fontSize: '28px',
                      color: '#214b58',
                    }}
                  >
                    {formatarImpactoAvaliado(ganhosAvaliados)}
                  </strong>

                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    Valores positivos informados para decisões com avaliação
                    financeira válida.
                  </p>
                </div>
                <div
                  style={{
                    padding: '20px',
                    background: '#fff1f0',
                    borderRadius: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Valores negativos informados após avaliação
                  </p>

                  <strong
                    style={{
                      fontSize: '28px',
                      color: '#b42318',
                    }}
                  >
                    {formatarImpactoAvaliado(perdasAvaliadas)}
                  </strong>

                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    Valores negativos informados para decisões com avaliação
                    financeira válida.
                  </p>
                </div>

                <div
                  style={{
                    padding: '20px',
                    background: '#eef2ff',
                    borderRadius: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Saldo dos impactos informados
                  </p>

                  <strong
                    style={{
                      fontSize: '28px',
                      color: '#214b58',
                    }}
                  >
                    {formatarImpactoAvaliado(ganhosAvaliados - perdasAvaliadas)}
                  </strong>

                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    Diferença entre valores informados após avaliações válidas;
                    não comprova causalidade.
                  </p>
                </div>

                <div
                  style={{
                    padding: '20px',
                    background: '#f0f9ff',
                    borderRadius: '12px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ margin: '0 0 8px' }}>
                    Percentual de ganhos financeiros
                  </p>

                  <strong style={{ fontSize: '28px', color: '#0369a1' }}>
                    {ganhosAvaliados + perdasAvaliadas === 0
                      ? 'Aguardando resultados financeiros'
                      : `${(
                          (ganhosAvaliados /
                            (ganhosAvaliados + perdasAvaliadas)) *
                          100
                        )
                          .toFixed(1)
                          .replace('.', ',')}%`}
                  </strong>

                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    Participação dos valores positivos informados no total de
                    impactos avaliados.
                  </p>
                </div>

                {decisoes.length === 0 ? (
                  <p className="subtitulo">
                    Nenhuma decisão registrada para acompanhar.
                  </p>
                ) : (
                  <div style={{ marginTop: '20px' }}>
                    {decisoes.map((decisao, indice) => (
                      <article className="oportunidade" key={indice}>
                        <span>{String(indice + 1).padStart(2, '0')}</span>
                        <div>
                          <div>
                            <strong>{decisao}</strong>
                            {/* CÓDIGO NOVO COMEÇA AQUI */}
                            <p>
                              Classificação informada:{' '}
                              {resultadosDecisoes[String(indice)] || 'PENDENTE'}
                            </p>
                            {acompanhamentos[String(indice)] &&
                              (() => {
                                const acompanhamento =
                                  acompanhamentos[String(indice)];
                                const duracaoDias = (
                                  inicio: string,
                                  fim: string
                                ) => {
                                  const primeiro = Date.parse(
                                    `${inicio}T12:00:00Z`
                                  );
                                  const ultimo = Date.parse(`${fim}T12:00:00Z`);
                                  return Number.isFinite(primeiro) &&
                                    Number.isFinite(ultimo)
                                    ? Math.round(
                                        (ultimo - primeiro) / 86400000
                                      ) + 1
                                    : 0;
                                };
                                const temAvaliacao =
                                  acompanhamento.resultadoAvaliacao !==
                                  undefined;
                                const dadosSuficientes =
                                  (acompanhamento.quantidadeBase ?? 0) > 0 &&
                                  (acompanhamento.quantidadeAvaliacao ?? 0) > 0;
                                const janelasDiferentes =
                                  acompanhamento.inicioBase !==
                                    acompanhamento.inicioAvaliacao ||
                                  acompanhamento.fimBase !==
                                    acompanhamento.fimAvaliacao;
                                const duracoesIguais =
                                  duracaoDias(
                                    acompanhamento.inicioBase,
                                    acompanhamento.fimBase
                                  ) > 0 &&
                                  duracaoDias(
                                    acompanhamento.inicioBase,
                                    acompanhamento.fimBase
                                  ) ===
                                    duracaoDias(
                                      acompanhamento.inicioAvaliacao ?? '',
                                      acompanhamento.fimAvaliacao ?? ''
                                    );
                                const comparacaoPossivel =
                                  temAvaliacao &&
                                  dadosSuficientes &&
                                  janelasDiferentes &&
                                  duracoesIguais;
                                const variacao =
                                  acompanhamento.resultadoAvaliacao ===
                                  undefined
                                    ? null
                                    : acompanhamento.resultadoAvaliacao -
                                      acompanhamento.resultadoBase;
                                return (
                                  <div
                                    style={{
                                      margin: '12px 0',
                                      padding: '14px',
                                      borderRadius: '10px',
                                      background: '#f1f5f9',
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    <strong>
                                      Indicadores associados à decisão
                                    </strong>
                                    <p>Origem: {acompanhamento.origem}</p>
                                    <p>
                                      Base ({acompanhamento.periodoBase}):
                                      receitas{' '}
                                      {formatarValorFinanceiro(
                                        acompanhamento.receitasBase
                                      )}
                                      , despesas{' '}
                                      {formatarValorFinanceiro(
                                        acompanhamento.despesasBase
                                      )}
                                      , resultado{' '}
                                      {formatarValorFinanceiro(
                                        acompanhamento.resultadoBase
                                      )}
                                      .
                                    </p>
                                    {acompanhamento.avaliadaEm &&
                                      acompanhamento.resultadoAvaliacao !==
                                        undefined && (
                                        <p>
                                          Última avaliação (
                                          {new Date(
                                            acompanhamento.avaliadaEm
                                          ).toLocaleString('pt-BR')}
                                          ): receitas{' '}
                                          {formatarValorFinanceiro(
                                            acompanhamento.receitasAvaliacao ??
                                              0
                                          )}
                                          , despesas{' '}
                                          {formatarValorFinanceiro(
                                            acompanhamento.despesasAvaliacao ??
                                              0
                                          )}
                                          , resultado{' '}
                                          {formatarValorFinanceiro(
                                            acompanhamento.resultadoAvaliacao
                                          )}
                                          .{' '}
                                          {comparacaoPossivel
                                            ? `Diferença observada: ${formatarValorFinanceiro(
                                                variacao ?? 0
                                              )}.`
                                            : 'Diferença não apresentada como comparação válida.'}
                                        </p>
                                      )}
                                    <p
                                      style={{
                                        fontSize: '12px',
                                        color: '#64748b',
                                      }}
                                    >
                                      Comparação descritiva, não comprova que a
                                      decisão causou a mudança. Confira se os
                                      períodos e lançamentos são comparáveis.
                                    </p>
                                    {temAvaliacao && (
                                      <p
                                        style={{
                                          fontSize: '12px',
                                          color: comparacaoPossivel
                                            ? '#166534'
                                            : '#92400e',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {comparacaoPossivel
                                          ? 'Comparação descritiva entre períodos de mesma duração e com lançamentos registrados. Não demonstra causalidade.'
                                          : !dadosSuficientes
                                          ? 'Comparação limitada: faltam lançamentos em uma das avaliações, ou a avaliação antiga não registrou a quantidade.'
                                          : !janelasDiferentes
                                          ? 'Mesma janela de datas: os valores podem refletir apenas novos lançamentos, não uma evolução entre períodos.'
                                          : 'Períodos com durações diferentes: não é adequado comparar diretamente os totais.'}
                                      </p>
                                    )}
                                    <p
                                      style={{
                                        fontSize: '12px',
                                        color: '#64748b',
                                      }}
                                    >
                                      Base: {acompanhamento.inicioBase} a{' '}
                                      {acompanhamento.fimBase}.
                                      {acompanhamento.inicioAvaliacao &&
                                        acompanhamento.fimAvaliacao &&
                                        ` Avaliação: ${acompanhamento.inicioAvaliacao} a ${acompanhamento.fimAvaliacao}.`}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => registrarAvaliacao(indice)}
                                      style={{
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        background: '#214b58',
                                        color: '#fff',
                                        border: 0,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Registrar avaliação do período selecionado
                                    </button>
                                  </div>
                                );
                              })()}

                            <div
                              style={{
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                                marginTop: '10px',
                              }}
                            >
                              {(
                                ['PENDENTE', 'POSITIVO', 'NEGATIVO'] as const
                              ).map((resultado) => (
                                <button
                                  key={resultado}
                                  type="button"
                                  onClick={() => {
                                    const acompanhamento =
                                      acompanhamentos[String(indice)];

                                    if (resultado !== 'PENDENTE') {
                                      const temDados =
                                        acompanhamento &&
                                        (acompanhamento.quantidadeBase ?? 0) >
                                          0 &&
                                        (acompanhamento.quantidadeAvaliacao ??
                                          0) > 0;

                                      const periodoPosterior =
                                        acompanhamento?.inicioAvaliacao &&
                                        acompanhamento.inicioAvaliacao >
                                          acompanhamento.fimBase;

                                      const duracao = (
                                        inicio: string,
                                        fim: string
                                      ) => {
                                        const a = Date.parse(
                                          `${inicio}T12:00:00Z`
                                        );
                                        const b = Date.parse(
                                          `${fim}T12:00:00Z`
                                        );

                                        return Number.isFinite(a) &&
                                          Number.isFinite(b) &&
                                          b >= a
                                          ? Math.round((b - a) / 86400000) + 1
                                          : 0;
                                      };

                                      const periodosComparaveis =
                                        acompanhamento &&
                                        duracao(
                                          acompanhamento.inicioBase,
                                          acompanhamento.fimBase
                                        ) > 0 &&
                                        duracao(
                                          acompanhamento.inicioBase,
                                          acompanhamento.fimBase
                                        ) ===
                                          duracao(
                                            acompanhamento.inicioAvaliacao ??
                                              '',
                                            acompanhamento.fimAvaliacao ?? ''
                                          );

                                      if (
                                        !temDados ||
                                        !periodoPosterior ||
                                        !periodosComparaveis
                                      ) {
                                        alert(
                                          'Esta decisão ainda não possui uma avaliação financeira válida. Registre uma comparação entre períodos posteriores e equivalentes antes de classificá-la.'
                                        );
                                        return;
                                      }
                                    }

                                    setResultadosDecisoes((anteriores) => ({
                                      ...anteriores,
                                      [String(indice)]: resultado,
                                    }));
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #dce4ef',
                                    cursor: 'pointer',
                                    background:
                                      resultadosDecisoes[String(indice)] ===
                                      resultado
                                        ? '#214b58'
                                        : '#ffffff',
                                    color:
                                      resultadosDecisoes[String(indice)] ===
                                      resultado
                                        ? '#ffffff'
                                        : '#214b58',
                                  }}
                                >
                                  {resultado === 'PENDENTE'
                                    ? 'Pendente'
                                    : resultado === 'POSITIVO'
                                    ? 'Positivo'
                                    : 'Negativo'}
                                </button>
                              ))}
                            </div>
                            <div style={{ marginTop: '16px' }}>
                              <label
                                htmlFor={`impacto-${indice}`}
                                style={{
                                  display: 'block',
                                  marginBottom: '8px',
                                  fontWeight: 600,
                                }}
                              >
                                Impacto financeiro (R$)
                              </label>

                              <input
                                id={`impacto-${indice}`}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Ex.: 1500,00"
                                value={impactosDecisoes[String(indice)] ?? ''}
                                onChange={(evento) => {
                                  const valor = evento.target.value;

                                  setImpactosDecisoes((anteriores) => {
                                    const atualizados = { ...anteriores };

                                    if (valor === '') {
                                      delete atualizados[String(indice)];
                                    } else {
                                      const numero = Number(valor);

                                      if (
                                        Number.isFinite(numero) &&
                                        numero >= 0
                                      ) {
                                        atualizados[String(indice)] = numero;
                                      }
                                    }

                                    return atualizados;
                                  });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  border: '1px solid #dce4ef',
                                  borderRadius: '10px',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </section>
        )}

        {/* CADASTRO DE EMPRESAS — PREVANZIA */}
        {secao === 'Empresas' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">ESTRUTURA EMPRESARIAL</p>
                <h2>Cadastrar empresa</h2>
              </div>
            </div>

            <p className="subtitulo">
              Identifique a empresa que será acompanhada pelo PREVANZIA.
            </p>

            {/* COLE O CÓDIGO NOVO AQUI */}
            <div style={{ display: 'grid', gap: '18px', marginTop: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                }}
              >
                <strong>Nome da empresa (obrigatório)</strong>
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  placeholder="Digite o nome da empresa"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                }}
              >
                <strong>CPF ou CNPJ (opcional)</strong>
                <input
                  type="text"
                  value={documentoEmpresa}
                  onChange={(e) => setDocumentoEmpresa(e.target.value)}
                  placeholder="Digite o CPF ou CNPJ"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                />
              </label>
            </div>

            {/* COLE O CÓDIGO NOVO AQUI */}
            <button
              type="button"
              disabled={!nomeEmpresa.trim() || !usuarioAtual}
              onClick={async () => {
                if (!usuarioAtual || !nomeEmpresa.trim()) return;

                const id = crypto.randomUUID();

                const empresa: EmpresaPrevanzia = {
                  id,
                  nome: nomeEmpresa.trim(),
                  ...(documentoEmpresa.trim()
                    ? { documento: documentoEmpresa.trim() }
                    : {}),
                  proprietarioUid: usuarioAtual.uid,
                  criadaEm: new Date().toISOString(),
                };

                try {
                  await setDoc(doc(db, 'empresas', id), empresa);
                  alert('Empresa cadastrada com sucesso!');
                  setNomeEmpresa('');
                  setDocumentoEmpresa('');
                } catch (erro) {
                  console.error('Erro ao cadastrar empresa:', erro);
                  alert('Não foi possível cadastrar a empresa.');
                }
              }}
              style={{
                marginTop: '20px',
                padding: '12px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cadastrar empresa
            </button>
            {/* LISTAGEM DAS EMPRESAS CADASTRADAS */}
            <div style={{ marginTop: '28px' }}>
              <h3>Minhas empresas</h3>

              {empresasCadastradas.length === 0 ? (
                <p className="subtitulo">
                  Nenhuma empresa cadastrada encontrada.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {empresasCadastradas.map((empresa) => (
                    <div
                      key={empresa.id}
                      style={{
                        padding: '16px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                      }}
                    >
                      <strong>{empresa.nome}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          if (!usuarioAtual) return;

                          setEmpresaSelecionadaId(empresa.id);

                          localStorage.setItem(
                            `prevanzia_empresa_selecionada_${usuarioAtual.uid}`,
                            empresa.id
                          );
                        }}
                        style={{
                          display: 'block',
                          marginTop: '12px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        {empresaSelecionadaId === empresa.id
                          ? 'Empresa selecionada'
                          : 'Selecionar empresa'}
                      </button>
                      {empresa.documento && (
                        <p>CPF/CNPJ: {empresa.documento}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {secao === 'Fontes de dados' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">FONTES DA INTELIGÊNCIA</p>
                <h2>Importe os dados da sua empresa</h2>
              </div>
              <span className="contador">
                {lancamentosEmpresa.length} lançamentos
              </span>
            </div>

            <p className="subtitulo">
              Utilize os arquivos exportados do sistema que sua empresa já usa.
              O PREVANZIA analisa esses registros sem exigir que você refaça a
              gestão financeira aqui.
            </p>

            {/* FASE 4 — IMPORTAÇÃO DE ARQUIVOS CSV */}

            <div
              style={{
                padding: '22px',
                marginBottom: '28px',
                border: '1px solid #dce4ef',
                borderRadius: '14px',
                background: '#f8fafc',
              }}
            >
              <p className="sobretitulo">ENTRADA DE DADOS</p>

              <h3 style={{ marginTop: '8px' }}>Importar dados financeiros</h3>

              <p
                style={{
                  color: '#64748b',
                  lineHeight: 1.6,
                  marginBottom: '18px',
                }}
              >
                Selecione um arquivo CSV ou Excel (.xlsx) para carregar receitas
                e despesas na PREVANZIA.
              </p>

              {/* Seletor de arquivos com aparência profissional */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '14px',
                  border: '1px solid #dce4ef',
                  borderRadius: '12px',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <span style={{ fontSize: '26px' }}>📊</span>
                  <div>
                    <strong style={{ display: 'block', color: '#17324d' }}>
                      Excel ou CSV
                    </strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Arquivos de até 5 MB
                    </span>
                  </div>
                </div>

                <label
                  htmlFor="arquivo-csv-prevanzia"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 18px',
                    background: '#0f766e',
                    color: '#ffffff',
                    borderRadius: '9px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  ↑ Selecionar arquivo
                </label>

                {/* COLE O CÓDIGO NOVO AQUI — identificação do ERP */}
                <div style={{ marginTop: '14px' }}>
                  <label
                    htmlFor="sistema-origem-prevanzia"
                    style={{ display: 'block', marginBottom: '6px' }}
                  >
                    Sistema de origem dos dados
                  </label>

                  <input
                    id="sistema-origem-prevanzia"
                    type="text"
                    placeholder="Ex.: Omie, Bling ou outro ERP"
                    value={sistemaOrigemImportacao}
                    onChange={(evento) =>
                      setSistemaOrigemImportacao(evento.target.value)
                    }
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* COLE O CÓDIGO NOVO AQUI — input oculto, mantendo a importação */}
                <input
                  id="arquivo-csv-prevanzia"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={async (evento) => {
                    const arquivo = evento.target.files?.[0];

                    if (!arquivo) {
                      return;
                    }

                    if (!/\.(csv|xlsx)$/i.test(arquivo.name)) {
                      alert('Selecione um arquivo CSV ou Excel (.xlsx).');
                      evento.target.value = '';
                      return;
                    }

                    if (/\.xlsx$/i.test(arquivo.name)) {
                      await importarArquivoExcel(arquivo);
                    } else {
                      await importarArquivoCSV(arquivo);
                    }

                    evento.target.value = '';
                  }}
                  style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    opacity: 0,
                    overflow: 'hidden',
                  }}
                />
              </div>

              {arquivoPendenteCSV && (
                <div
                  style={{
                    marginTop: '18px',
                    padding: '16px',
                    border: '1px solid #94a3b8',
                    borderRadius: '12px',
                    background: '#fff',
                  }}
                >
                  <strong>Confirme as informações do arquivo</strong>
                  <p style={{ lineHeight: 1.5 }}>
                    Não reconhecemos todas as colunas de{' '}
                    {arquivoPendenteCSV.name}. Selecione onde está cada
                    informação. Nada será importado antes da confirmação.
                  </p>
                  {camposCSV.map((campo) => (
                    <label
                      key={campo}
                      style={{ display: 'block', marginTop: '12px' }}
                    >
                      <span
                        style={{
                          display: 'block',
                          marginBottom: '4px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {campo === 'descricao'
                          ? 'Descrição'
                          : campo === 'categoria'
                          ? 'Categoria'
                          : campo === 'valor'
                          ? 'Valor'
                          : campo === 'data'
                          ? 'Data'
                          : 'Tipo (receita/despesa)'}
                      </span>
                      <select
                        value={mapaCSV[campo]}
                        onChange={(evento) =>
                          setMapaCSV((anterior) => ({
                            ...anterior,
                            [campo]: evento.target.value,
                          }))
                        }
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <option value="">Escolha a coluna</option>
                        {colunasPendentesCSV.map((coluna, posicao) => (
                          <option key={posicao} value={String(posicao)}>
                            {coluna || `Coluna ${posicao + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      marginTop: '16px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        const posicoes = camposCSV.map(
                          (campo) => mapaCSV[campo]
                        );
                        if (
                          posicoes.some((posicao) => posicao === '') ||
                          new Set(posicoes).size !== 5
                        ) {
                          alert(
                            'Selecione cinco colunas diferentes para continuar.'
                          );
                          return;
                        }
                        const arquivo = arquivoPendenteCSV;
                        if (/\.xlsx$/i.test(arquivo.name)) {
                          await importarArquivoExcel(arquivo, mapaCSV);
                        } else {
                          await importarArquivoCSV(arquivo, mapaCSV);
                        }
                        setArquivoPendenteCSV(null);
                      }}
                      style={{ padding: '10px 16px', cursor: 'pointer' }}
                    >
                      Confirmar e importar
                    </button>
                    <button
                      type="button"
                      onClick={() => setArquivoPendenteCSV(null)}
                      style={{ padding: '10px 16px', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>
                    O arquivo precisa informar a natureza do movimento (receita
                    ou despesa). Se não houver alguma dessas informações,
                    cancele a importação.
                  </p>
                </div>
              )}

              <p
                style={{
                  fontSize: '13px',
                  color: '#64748b',
                  marginTop: '14px',
                  lineHeight: 1.6,
                }}
              >
                Colunas necessárias: data, descricao, categoria, tipo e valor.
              </p>
            </div>

            {/* FASE 4 — HISTÓRICO DE IMPORTAÇÕES */}
            <div
              style={{
                padding: '20px',
                border: '1px solid #dce4ef',
                borderRadius: '14px',
                background: '#ffffff',
                marginBottom: '28px',
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Histórico de importações de arquivos
              </h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>
                Arquivos processados nesta conta, inclusive importações sem
                registros novos. Arquivos anteriores à implantação deste
                histórico não aparecem aqui.
              </p>
              {historicoImportacoes.filter(
                (item) => item.empresaId === empresaIdAtual
              ).length === 0 ? (
                <p className="subtitulo">
                  Nenhuma importação registrada ainda.
                </p>
              ) : (
                <div
                  style={{ display: 'grid', gap: '12px', marginTop: '16px' }}
                >
                  {historicoImportacoes
                    .filter((item) => item.empresaId === empresaIdAtual)
                    .map((item) => (
                      <article
                        key={item.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '14px',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <strong>{item.nomeArquivo}</strong>
                        <p style={{ margin: '6px 0', fontSize: '13px' }}>
                          Importado em:{' '}
                          {new Date(item.importadoEm).toLocaleString('pt-BR')}
                        </p>

                        {/* COLE O CÓDIGO NOVO AQUI */}
                        <p style={{ margin: '6px 0', fontSize: '13px' }}>
                          Sistema de origem:{' '}
                          <strong>
                            {item.sistemaOrigem || 'Não informado'}
                          </strong>
                        </p>
                        <p style={{ margin: '6px 0', fontSize: '13px' }}>
                          {item.totalRegistros} registro(s) no arquivo •{' '}
                          {item.novos} novo(s) • {item.duplicados} duplicado(s)
                        </p>
                      </article>
                    ))}
                </div>
              )}
            </div>

            <details
              style={{
                marginTop: '20px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '18px',
              }}
            >
              <summary
                style={{ cursor: 'pointer', fontWeight: 600, color: '#214b58' }}
              >
                Consultar lançamentos e indicadores importados (opcional)
              </summary>
              <div style={{ marginTop: '18px' }}>
                {/* MARCO 11 — RESUMO FINANCEIRO AUTOMÁTICO */}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                    marginTop: '24px',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: '#ecfdf5',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    <p style={{ margin: '0 0 10px', color: '#166534' }}>
                      Total de receitas
                    </p>
                    <strong style={{ fontSize: '24px', color: '#166534' }}>
                      {formatarValorFinanceiro(totalReceitas)}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <p style={{ margin: '0 0 10px', color: '#991b1b' }}>
                      Total de despesas
                    </p>
                    <strong style={{ fontSize: '24px', color: '#991b1b' }}>
                      {formatarValorFinanceiro(totalDespesas)}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    <p style={{ margin: '0 0 10px', color: '#1e40af' }}>
                      Saldo financeiro
                    </p>
                    <strong
                      style={{
                        fontSize: '24px',
                        color: saldoFinanceiro < 0 ? '#b91c1c' : '#1e40af',
                      }}
                    >
                      {formatarValorFinanceiro(saldoFinanceiro)}
                    </strong>
                  </div>
                </div>

                <p
                  style={{
                    fontWeight: 700,
                    marginBottom: '24px',
                    color:
                      situacaoFinanceira === 'POSITIVO'
                        ? '#166534'
                        : situacaoFinanceira === 'NEGATIVO'
                        ? '#b91c1c'
                        : '#64748b',
                  }}
                >
                  Situação financeira:{' '}
                  {situacaoFinanceira === 'POSITIVO'
                    ? 'Saldo positivo'
                    : situacaoFinanceira === 'NEGATIVO'
                    ? 'Saldo negativo'
                    : 'Saldo zerado'}
                </p>

                <details style={{ marginTop: '20px' }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#214b58',
                    }}
                  >
                    Registrar lançamento manualmente (uso excepcional)
                  </summary>
                  <div style={{ marginTop: '12px' }}>
                    <form
                      onSubmit={(evento) => {
                        evento.preventDefault();

                        // FASE 7 — Impede gravações sem empresa autorizada.
                        if (
                          !usuarioAtual ||
                          empresaIdAtual === 'empresa_demo' ||
                          !empresasCadastradas.some(
                            (empresa) =>
                              empresa.id === empresaIdAtual &&
                              empresa.proprietarioUid === usuarioAtual.uid
                          ) ||
                          !lancamentosCarregados ||
                          uidLancamentos !== usuarioAtual.uid
                        ) {
                          alert(
                            'Selecione uma empresa cadastrada e aguarde a sincronização antes de registrar lançamentos.'
                          );
                          return;
                        }

                        const descricao = descricaoLancamento.trim();
                        const categoria = categoriaLancamento.trim();
                        const valor = Number(valorLancamento.replace(',', '.'));

                        if (
                          !descricao ||
                          !categoria ||
                          !dataLancamento ||
                          !Number.isFinite(valor) ||
                          valor <= 0
                        ) {
                          alert(
                            'Preencha todos os campos com valores válidos.'
                          );
                          return;
                        }

                        const novoLancamento: LancamentoFinanceiro = {
                          id: crypto.randomUUID(),
                          empresaId: empresaIdAtual,
                          data: dataLancamento,
                          descricao,
                          categoria,
                          tipo: tipoLancamento,
                          valor,
                        };

                        adicionarLancamentoFinanceiro(novoLancamento);

                        setDescricaoLancamento('');
                        setCategoriaLancamento('');
                        setValorLancamento('');
                      }}
                      style={{
                        display: 'grid',
                        gap: '14px',
                        marginTop: '24px',
                        marginBottom: '28px',
                      }}
                    >
                      <label>
                        Descrição
                        <input
                          type="text"
                          required
                          value={descricaoLancamento}
                          onChange={(evento) =>
                            setDescricaoLancamento(evento.target.value)
                          }
                          placeholder="Ex.: Lavagem de veículo"
                          style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '12px',
                            marginTop: '6px',
                            border: '1px solid #dce4ef',
                            borderRadius: '10px',
                          }}
                        />
                      </label>

                      <label>
                        Tipo de lançamento
                        <select
                          value={tipoLancamento}
                          onChange={(evento) =>
                            setTipoLancamento(
                              evento.target.value as 'RECEITA' | 'DESPESA'
                            )
                          }
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '12px',
                            marginTop: '6px',
                            border: '1px solid #dce4ef',
                            borderRadius: '10px',
                          }}
                        >
                          <option value="RECEITA">Receita</option>
                          <option value="DESPESA">Despesa</option>
                        </select>
                      </label>

                      <label>
                        Categoria
                        <input
                          type="text"
                          required
                          value={categoriaLancamento}
                          onChange={(evento) =>
                            setCategoriaLancamento(evento.target.value)
                          }
                          placeholder="Ex.: Serviços, vendas, combustível"
                          style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '12px',
                            marginTop: '6px',
                            border: '1px solid #dce4ef',
                            borderRadius: '10px',
                          }}
                        />
                      </label>

                      <label>
                        Valor (R$)
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={valorLancamento}
                          onChange={(evento) =>
                            setValorLancamento(evento.target.value)
                          }
                          placeholder="Ex.: 1500.00"
                          style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '12px',
                            marginTop: '6px',
                            border: '1px solid #dce4ef',
                            borderRadius: '10px',
                          }}
                        />
                      </label>

                      <label>
                        Data
                        <input
                          type="date"
                          required
                          value={dataLancamento}
                          onChange={(evento) =>
                            setDataLancamento(evento.target.value)
                          }
                          style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '12px',
                            marginTop: '6px',
                            border: '1px solid #dce4ef',
                            borderRadius: '10px',
                          }}
                        />
                      </label>

                      <button
                        type="submit"
                        style={{
                          background: '#214b58',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Registrar lançamento
                      </button>
                    </form>
                  </div>
                </details>
                <h3>Histórico financeiro</h3>

                {lancamentosEmpresa.length === 0 ? (
                  <p className="subtitulo">
                    Nenhum lançamento financeiro cadastrado.
                  </p>
                ) : (
                  <div
                    style={{ display: 'grid', gap: '12px', marginTop: '16px' }}
                  >
                    {lancamentosEmpresa.map((lancamento) => (
                      <article
                        key={`${lancamento.empresaId}-${lancamento.id}`}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          background:
                            lancamento.tipo === 'RECEITA'
                              ? '#ecfdf5'
                              : '#fef2f2',
                        }}
                      >
                        <strong>{lancamento.descricao}</strong>

                        <p style={{ margin: '8px 0' }}>
                          {lancamento.tipo === 'RECEITA'
                            ? 'Receita'
                            : 'Despesa'}
                          {' • '}
                          {lancamento.categoria}
                        </p>

                        <p style={{ margin: '8px 0' }}>
                          Data: {lancamento.data.split('-').reverse().join('/')}
                        </p>

                        <p
                          style={{
                            margin: '8px 0',
                            fontSize: '13px',
                            color: '#475569',
                          }}
                        >
                          Origem:{' '}
                          {lancamento.origem === 'CSV'
                            ? 'Arquivo CSV'
                            : lancamento.origem === 'EXCEL'
                            ? 'Arquivo Excel'
                            : lancamento.origem === 'API'
                            ? 'Sistema integrado'
                            : 'Lançamento manual'}
                        </p>

                        {lancamento.arquivoOrigem && (
                          <p
                            style={{
                              margin: '8px 0',
                              fontSize: '13px',
                              color: '#475569',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            Arquivo: {lancamento.arquivoOrigem}
                          </p>
                        )}

                        {lancamento.importadoEm && (
                          <p
                            style={{
                              margin: '8px 0',
                              fontSize: '13px',
                              color: '#475569',
                            }}
                          >
                            Importado em:{' '}
                            {new Date(lancamento.importadoEm).toLocaleString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </p>
                        )}

                        <strong
                          style={{
                            color:
                              lancamento.tipo === 'RECEITA'
                                ? '#166534'
                                : '#b91c1c',
                          }}
                        >
                          {lancamento.valor.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </section>
        )}

        <footer>PREVANZIA • Inteligência para decidir melhor</footer>
      </main>
    </div>
  );
}

export default App;
