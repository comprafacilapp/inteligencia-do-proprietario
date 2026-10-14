import { useEffect, useRef, useState } from 'react';
import './App.css';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';

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
};

// FASE 3 — MODELO UNIVERSAL DE DADOS

type HistoricoImportacao = {
  id: string;
  empresaId: string;
  nomeArquivo: string;
  importadoEm: string;
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
      alertas.push({
        titulo: 'Despesas acima do período anterior',
        nivel: aumento >= 20 ? 'alto' : 'medio',
        descricao: `As despesas registradas aumentaram ${aumento
          .toFixed(1)
          .replace('.', ',')}% na comparação.`,
      });
      oportunidades.push(
        'Comparar os gastos por categoria entre os períodos e investigar os aumentos.'
      );
    }
  }

  const gastosPorCategoria = new Map<string, number>();
  for (const registro of registros) {
    if (registro.tipo === 'DESPESA') {
      gastosPorCategoria.set(
        registro.categoria,
        (gastosPorCategoria.get(registro.categoria) ?? 0) +
          registro.valorCentavos / 100
      );
    }
  }
  const maiorGasto = [...gastosPorCategoria.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (maiorGasto && despesas > 0) {
    oportunidades.push(
      `Examinar a categoria de despesa "${
        maiorGasto[0]
      }", responsável por ${moeda(maiorGasto[1])} dos gastos registrados.`
    );
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
type LinhaComparativa = {
  titulo: string;
  atual: number;
  anterior: number;
  diferenca: number;
  percentual: number | null;
};

function somarTipoComparativo(
  registros: RegistroFinanceiroUniversal[],
  tipo: 'RECEITA' | 'DESPESA'
): number {
  return (
    registros
      .filter((item) => item.tipo === tipo)
      .reduce((total, item) => total + item.valorCentavos, 0) / 100
  );
}

function criarLinhaComparativa(
  titulo: string,
  atual: number,
  anterior: number
): LinhaComparativa {
  const diferenca = Math.round((atual - anterior) * 100) / 100;
  return {
    titulo,
    atual,
    anterior,
    diferenca,
    percentual: anterior > 0 ? (diferenca / anterior) * 100 : null,
  };
}

// Normaliza apenas a chave de comparação; os lançamentos originais permanecem intactos.
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
      console.error('Erro ao ler histórico CSV local:', erro);
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
        console.error('Erro ao ler histórico CSV do Firestore:', erro);
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
        .catch((erro) => console.error('Erro ao enviar histórico CSV:', erro))
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
  const [colunasPendentesCSV, setColunasPendentesCSV] = useState<string[]>([]);
  const [mapaCSV, setMapaCSV] = useState<Record<CampoCSV, string>>({
    data: '',
    descricao: '',
    categoria: '',
    tipo: '',
    valor: '',
  });

  // FASE 4 — IMPORTAÇÃO DE DADOS FINANCEIROS POR CSV

  // FASE 4 — IMPORTAÇÃO CSV COM VALIDAÇÃO E PROTEÇÃO CONTRA DUPLICAÇÃO

  async function importarArquivoCSV(
    arquivo: File,
    mapaConfirmado?: Record<CampoCSV, string>
  ) {
    if (
      !usuarioAtual ||
      uidHistoricoCarregado !== usuarioAtual.uid ||
      !lancamentosCarregados ||
      uidLancamentos !== usuarioAtual.uid
    ) {
      alert('Aguarde a sincronização dos dados antes de importar um CSV.');
      return;
    }
    try {
      if (arquivo.size === 0) {
        alert('O arquivo CSV está vazio.');
        return;
      }

      if (arquivo.size > 5 * 1024 * 1024) {
        alert('O arquivo CSV deve ter no máximo 5 MB.');
        return;
      }

      const conteudo = (await arquivo.text())
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n');

      if (!conteudo.trim()) {
        alert('O arquivo CSV está vazio.');
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
      const linhas: string[][] = [];
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
          empresaId: 'empresa_demo',
          data,
          descricao,
          categoria,
          tipo: tipoTexto as 'RECEITA' | 'DESPESA',
          valor,
          origem: 'CSV',
          importadoEm,
          arquivoOrigem: arquivo.name,
          importacaoId,
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
        empresaId: 'empresa_demo',
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
    (lancamento) => lancamento.empresaId === 'empresa_demo'
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
        sistema: 'PREVANZIA',
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
    empresaId: 'empresa_demo',
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
  // Janela imediatamente anterior, com o mesmo número de dias do período escolhido.
  // Evita comparar um mês em andamento com um mês anterior inteiro.
  const diasNoPeriodo =
    Math.round(
      (Date.parse(`${fimAtual}T00:00:00Z`) -
        Date.parse(`${inicioAtual}T00:00:00Z`)) /
        86400000
    ) + 1;
  const inicioComparacaoEquivalente = dataISO(
    new Date(Date.parse(`${inicioAtual}T12:00:00Z`) - diasNoPeriodo * 86400000)
  );
  const fimComparacaoEquivalente = dataISO(
    new Date(Date.parse(`${inicioAtual}T12:00:00Z`) - 86400000)
  );
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
  const linhasComparativas = [
    criarLinhaComparativa('Receitas', receitaAtual, receitaComparacao),
    criarLinhaComparativa('Despesas', despesaAtual, despesaComparacao),
    criarLinhaComparativa(
      'Receitas menos despesas',
      receitaAtual - despesaAtual,
      receitaComparacao - despesaComparacao
    ),
  ];
  const categoriasAtuais = categoriasComparativas(registrosDoPeriodo);
  const categoriasAnteriores = categoriasComparativas(registrosComparacao);
  const chavesCategorias = new Set([
    ...categoriasAtuais.keys(),
    ...categoriasAnteriores.keys(),
  ]);
  const variacoesCategoria = [...chavesCategorias]
    .map((chave) => {
      const atual = categoriasAtuais.get(chave);
      const anterior = categoriasAnteriores.get(chave);
      return criarLinhaComparativa(
        atual?.nome ?? anterior?.nome ?? chave,
        atual?.total ?? 0,
        anterior?.total ?? 0
      );
    })
    .sort(
      (a, b) =>
        Math.abs(b.diferenca) - Math.abs(a.diferenca) ||
        a.titulo.localeCompare(b.titulo, 'pt-BR')
    );
  const variacoesRelevantes = variacoesCategoria
    .filter((linha) => linha.diferenca !== 0)
    .slice(0, 5);
  const formatarDataComparativa = (valor: string) =>
    valor.split('-').reverse().join('/');
  const percentualComparativo = (linha: LinhaComparativa) =>
    linha.percentual === null
      ? 'Sem base percentual'
      : `${linha.percentual > 0 ? '+' : ''}${linha.percentual
          .toFixed(1)
          .replace('.', ',')}%`;
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
  const oportunidades = dadosFinanceirosIncompletos
    ? []
    : diagnostico.oportunidades;
  // RADAR EXECUTIVO — prioridades fundamentadas nos registros do período.
  // Valores associados são exposição observada, não perdas nem ganhos previstos.
  const radarPrioridades = [...alertas]
    .map((alerta) => {
      const titulo = alerta.titulo;
      const exposicao =
        titulo === 'Despesas superiores às receitas'
          ? Math.abs(diagnostico.resultado)
          : titulo === 'Despesas elevadas em relação às receitas' ||
            titulo === 'Despesas acima do período anterior'
          ? diagnostico.despesas
          : titulo === 'Sem receitas registradas'
          ? diagnostico.despesas
          : titulo === 'Receitas abaixo do período anterior'
          ? diagnostico.receitas
          : titulo === 'Resultado financeiro zerado'
          ? diagnostico.despesas
          : null;
      const prioridade = alerta.nivel === 'alto' ? 2 : 1;
      return { ...alerta, exposicao, prioridade };
    })
    .sort(
      (a, b) =>
        b.prioridade - a.prioridade ||
        (b.exposicao ?? 0) - (a.exposicao ?? 0) ||
        a.titulo.localeCompare(b.titulo, 'pt-BR')
    );

  // Ações concretas, sem estimar ganhos ou prometer resultados.
  const radarAcoes =
    diagnostico.quantidade === 0
      ? []
      : [
          ...new Set([
            ...radarPrioridades.map((alerta) =>
              alerta.titulo === 'Despesas não informadas'
                ? 'Conferir se todas as despesas do período foram importadas ou cadastradas.'
                : alerta.titulo === 'Despesas superiores às receitas'
                ? 'Revisar as despesas que excedem as receitas e confirmar a integridade dos registros.'
                : alerta.titulo === 'Sem receitas registradas'
                ? 'Verificar se houve receitas não importadas ou ausência de faturamento.'
                : alerta.titulo === 'Receitas abaixo do período anterior'
                ? 'Identificar quais serviços ou clientes explicam a queda das receitas.'
                : alerta.titulo === 'Despesas acima do período anterior'
                ? 'Comparar os gastos por categoria com o período anterior.'
                : alerta.titulo === 'Despesas elevadas em relação às receitas'
                ? 'Priorizar a revisão das maiores categorias de despesa.'
                : 'Conferir os lançamentos e revisar o equilíbrio entre receitas e despesas.'
            ),
            ...(dadosFinanceirosIncompletos ? [] : oportunidades),
            'Conferir se os lançamentos do período estão completos antes de decidir.',
            'Acompanhar os indicadores no próximo período para verificar a evolução.',
          ]),
        ].slice(0, 5);

  const normalizarTextoRadar = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const formatarPercentual = (numero: number | null) =>
    numero === null
      ? 'Sem receita no período'
      : `${numero.toFixed(1).replace('.', ',')}%`;

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

  // Relaciona uma recomendação à decisão já registrada no período.
  const localizarDecisaoRadar = (texto: string) =>
    decisoes.findIndex((decisao, indice) => {
      const acompanhamento = acompanhamentos[String(indice)];
      return (
        normalizarTextoRadar(decisao) === normalizarTextoRadar(texto) &&
        acompanhamento?.inicioBase === inicioAtual &&
        acompanhamento?.fimBase === fimAtual
      );
    });

  const registrarAvaliacao = (indice: number) => {
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

  const [alertaSelecionado, setAlertaSelecionado] = useState<string | null>(
    null
  );
  const [resultadosDecisoes, setResultadosDecisoes] = useState<
    Record<string, 'PENDENTE' | 'POSITIVO' | 'NEGATIVO'>
  >({});
  const [impactosDecisoes, setImpactosDecisoes] = useState<
    Record<string, number>
  >({});

  // FASE 07 — Decisões e avaliações sincronizadas por usuário.
  // A migração do armazenamento antigo requer autorização, pois suas chaves
  // não identificavam o usuário que criou os dados.
  const [uidDecisoesCarregado, setUidDecisoesCarregado] = useState<
    string | null
  >(null);
  const ultimoPacoteDecisoes = useRef('');
  const envioDecisoesPendente = useRef(false);
  const usuarioDecisoesRef = useRef<string | null>(null);

  useEffect(() => {
    setUidDecisoesCarregado(null);
    setDecisoes([]);
    setAcompanhamentos({});
    setResultadosDecisoes({});
    setImpactosDecisoes({});
    ultimoPacoteDecisoes.current = '';
    envioDecisoesPendente.current = false;
    usuarioDecisoesRef.current = usuarioAtual?.uid ?? null;
    if (!usuarioAtual) return;

    const uid = usuarioAtual.uid;
    let ativo = true;
    const referencia = doc(db, 'usuarios', uid, 'configuracoes', 'decisoes');

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
      if (!ativo || usuarioDecisoesRef.current !== uid) return;
      ultimoPacoteDecisoes.current = JSON.stringify(pacote);
      setDecisoes(pacote.decisoes);
      setAcompanhamentos(pacote.acompanhamentos);
      setResultadosDecisoes(pacote.resultados);
      setImpactosDecisoes(pacote.impactos);
      setUidDecisoesCarregado(uid);
    };

    const cancelar = onSnapshot(
      referencia,
      async (snapshot) => {
        if (!ativo || usuarioDecisoesRef.current !== uid) return;
        if (snapshot.metadata.hasPendingWrites || envioDecisoesPendente.current)
          return;
        if (snapshot.exists()) {
          aplicar(validarPacote(snapshot.data()));
          return;
        }

        // Apenas o primeiro acesso, quando ainda não há decisões na nuvem.
        // Nunca atribuir silenciosamente dados antigos sem UID à conta atual.
        let legado: ReturnType<typeof validarPacote> | null = null;
        try {
          const ler = (chave: string, padrao: unknown) => {
            const texto = localStorage.getItem(chave);
            return texto ? (JSON.parse(texto) as unknown) : padrao;
          };
          legado = validarPacote({
            decisoes: ler('prevanzia_decisoes', []),
            acompanhamentos: ler('prevanzia_acompanhamentos', {}),
            resultados: ler('prevanzia_resultados', {}),
            impactos: ler('prevanzia_impactos', {}),
          });
        } catch (erro) {
          console.error('Falha ao ler decisões antigas:', erro);
        }
        const possuiLegado =
          legado &&
          (legado.decisoes.length > 0 ||
            Object.keys(legado.acompanhamentos).length > 0 ||
            Object.keys(legado.resultados).length > 0 ||
            Object.keys(legado.impactos).length > 0);
        const autorizado =
          possuiLegado &&
          window.confirm(
            'Existem decisões antigas salvas neste navegador. Elas pertencem a esta conta? ' +
              'Clique em OK para sincronizá-las com esta conta; Cancelar para não importar.'
          );
        const inicial = autorizado && legado ? legado : validarPacote({});
        try {
          // merge preserva dados caso outro aparelho crie o documento primeiro.
          // Uma leitura posterior do Firestore confirma o conteúdo persistido.
          envioDecisoesPendente.current = true;
          await setDoc(referencia, inicial);
          if (ativo && usuarioDecisoesRef.current === uid) aplicar(inicial);
        } catch (erro) {
          console.error('Falha ao inicializar decisões no Firestore:', erro);
          alert(
            'Não foi possível carregar as decisões na nuvem. Verifique a conexão e as permissões.'
          );
        } finally {
          envioDecisoesPendente.current = false;
        }
      },
      (erro) => {
        console.error('Falha ao sincronizar decisões:', erro);
        alert(
          'Falha na leitura das decisões no Firebase. Não registre novas decisões até corrigir a conexão.'
        );
      }
    );

    return () => {
      ativo = false;
      cancelar();
    };
  }, [usuarioAtual]);

  useEffect(() => {
    if (!usuarioAtual || uidDecisoesCarregado !== usuarioAtual.uid) return;
    const pacote = {
      decisoes,
      acompanhamentos,
      resultados: resultadosDecisoes,
      impactos: impactosDecisoes,
    };
    const serializado = JSON.stringify(pacote);
    if (serializado === ultimoPacoteDecisoes.current) return;
    ultimoPacoteDecisoes.current = serializado;
    const uid = usuarioAtual.uid;
    envioDecisoesPendente.current = true;
    setDoc(doc(db, 'usuarios', uid, 'configuracoes', 'decisoes'), pacote)
      .catch((erro) => {
        console.error('Falha ao salvar decisões:', erro);
        ultimoPacoteDecisoes.current = '';
        alert(
          'Não foi possível salvar a decisão na nuvem. Confira sua conexão.'
        );
      })
      .finally(() => {
        envioDecisoesPendente.current = false;
      });
  }, [
    usuarioAtual,
    uidDecisoesCarregado,
    decisoes,
    acompanhamentos,
    resultadosDecisoes,
    impactosDecisoes,
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
    'Comparativos',
    'Oportunidades',
    'Decisões',
    'Resultados',
    'Dados financeiros',
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

        <nav className="menu">
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
          <>
            <section className="saude">
              <div>
                <p className="sobretitulo">
                  SAÚDE FINANCEIRA • {periodo.toUpperCase()}
                </p>
                <h2>
                  {diagnostico.quantidade === 0
                    ? 'Sem dados no período'
                    : diagnostico.despesas === 0
                    ? 'Dados insuficientes para avaliar'
                    : diagnostico.resultado < 0
                    ? 'Atenção necessária'
                    : alertas.length > 0
                    ? 'Pontos para investigar'
                    : 'Resultado não negativo'}
                </h2>
                <p>
                  {diagnostico.quantidade > 0 && diagnostico.despesas === 0
                    ? 'Existem receitas registradas, mas nenhuma despesa informada neste período. Não é possível avaliar o resultado real da empresa com segurança.'
                    : diagnostico.resumo}
                </p>
              </div>
              <span className="saude-indicador">
                {radarPrioridades.length} alerta(s)
              </span>
            </section>

            <section className="painel" style={{ marginBottom: '24px' }}>
              <div className="painel-cabecalho">
                <div>
                  <p className="sobretitulo">
                    RADAR EXECUTIVO • {periodo.toUpperCase()}
                  </p>
                  <h2>Prioridades e plano de ação</h2>
                </div>
                <span className="contador">
                  {radarPrioridades.length} prioridade(s)
                </span>
              </div>
              {diagnostico.quantidade === 0 ? (
                <p className="subtitulo">
                  Sem lançamentos neste período. Importe dados para ativar o
                  radar.
                </p>
              ) : (
                <>
                  <p className="subtitulo">
                    Análise de {diagnostico.quantidade} lançamento(s) entre{' '}
                    {inicioAtual.split('-').reverse().join('/')} e{' '}
                    {fimAtual.split('-').reverse().join('/')}. Os valores
                    representam movimentos registrados, não perdas previstas.
                  </p>
                  {dadosFinanceirosIncompletos ? (
                    <div
                      style={{
                        marginTop: '18px',
                        padding: '18px',
                        border: '1px solid #e9d8b5',
                        borderRadius: '12px',
                        background: '#fffaf0',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '8px' }}>
                        Verificar despesas não informadas
                      </strong>
                      <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
                        Existem receitas registradas, mas nenhuma despesa neste
                        período. Antes de avaliar a situação financeira,
                        confirme se os gastos foram importados ou cadastrados. A
                        ausência de despesas não comprova lucro.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSecao('Dados financeiros')}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #214b58',
                          background: '#fff',
                          color: '#214b58',
                        }}
                      >
                        Conferir dados financeiros
                      </button>
                    </div>
                  ) : radarPrioridades.length === 0 ? (
                    <p className="subtitulo">
                      Nenhum alerta disparado pelas regras atuais. Mantenha o
                      acompanhamento.
                    </p>
                  ) : (
                    <div
                      style={{ display: 'grid', gap: '12px', margin: '16px 0' }}
                    >
                      {radarPrioridades.map((item, indice) => {
                        const textoDecisao = `Investigar: ${item.titulo}`;
                        const indiceDecisao =
                          localizarDecisaoRadar(textoDecisao);
                        const resultadoDecisao =
                          indiceDecisao >= 0
                            ? resultadosDecisoes[String(indiceDecisao)] ??
                              'PENDENTE'
                            : null;
                        return (
                          <article
                            key={item.titulo}
                            style={{
                              padding: '16px',
                              border: '1px solid #dce4ef',
                              borderRadius: '12px',
                              background: '#f8fafc',
                            }}
                          >
                            <strong>
                              {indice + 1}. {item.titulo} —{' '}
                              {item.nivel === 'alto'
                                ? 'Prioridade alta'
                                : 'Prioridade moderada'}
                            </strong>
                            <p style={{ margin: '8px 0' }}>{item.descricao}</p>
                            {item.exposicao !== null && (
                              <p style={{ margin: '8px 0', fontSize: '13px' }}>
                                Valor relacionado nos registros:{' '}
                                <strong>
                                  {formatarValorFinanceiro(item.exposicao)}
                                </strong>
                              </p>
                            )}
                            <p style={{ margin: '8px 0', fontSize: '13px' }}>
                              Situação:{' '}
                              {resultadoDecisao === null
                                ? 'Sem decisão vinculada'
                                : resultadoDecisao === 'PENDENTE'
                                ? 'Decisão registrada — avaliação pendente'
                                : `Decisão avaliada como ${resultadoDecisao.toLowerCase()}`}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                if (indiceDecisao < 0) {
                                  registrarDecisaoVinculada(
                                    textoDecisao,
                                    `Radar: ${item.titulo}`
                                  );
                                }
                                setSecao('Decisões');
                              }}
                              style={{
                                padding: '9px 12px',
                                borderRadius: '8px',
                                border: '1px solid #214b58',
                                background: '#fff',
                                color: '#214b58',
                                cursor: 'pointer',
                              }}
                            >
                              {indiceDecisao >= 0
                                ? 'Ver decisão registrada'
                                : 'Transformar em decisão'}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {!dadosFinanceirosIncompletos && radarAcoes.length > 0 && (
                    <>
                      <h3>Plano de ação sugerido</h3>
                      <p className="subtitulo">
                        Recomendações baseadas nos dados disponíveis; não são
                        garantias de resultado.
                      </p>

                      <div
                        style={{
                          display: 'grid',
                          gap: '12px',
                          marginTop: '12px',
                        }}
                      >
                        {radarAcoes.map((acao, indice) => {
                          const indiceDecisao = localizarDecisaoRadar(acao);
                          return (
                            <article className="oportunidade" key={acao}>
                              <span>{String(indice + 1).padStart(2, '0')}</span>
                              <div>
                                <p>{acao}</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (indiceDecisao < 0) {
                                      registrarDecisaoVinculada(
                                        acao,
                                        'Plano de ação do Radar'
                                      );
                                    }
                                    setSecao('Decisões');
                                  }}
                                  style={{
                                    marginTop: '10px',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #214b58',
                                    background: '#fff',
                                    color: '#214b58',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {indiceDecisao >= 0
                                    ? 'Ver decisão registrada'
                                    : 'Registrar esta ação'}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="indicadores">
              <article className="indicador">
                <span>Receitas registradas</span>
                <strong>{formatarValorFinanceiro(diagnostico.receitas)}</strong>
                <small>{diagnostico.quantidade} lançamento(s) no período</small>
              </article>
              <article className="indicador">
                <span>Despesas registradas</span>
                <strong>{formatarValorFinanceiro(diagnostico.despesas)}</strong>
                <small>Somente despesas cadastradas</small>
              </article>
              <article className="indicador">
                <span>Receitas menos despesas</span>
                <strong>
                  {formatarValorFinanceiro(diagnostico.resultado)}
                </strong>
                <small>Não representa necessariamente lucro</small>
              </article>
              <article className="indicador">
                <span>Despesas / receitas</span>
                <strong>
                  {formatarPercentual(diagnostico.percentualDespesas)}
                </strong>
                <small>Proporção dos valores informados</small>
              </article>
            </section>

            <div className="duas-colunas">
              <section className="painel">
                <div className="painel-cabecalho">
                  <div>
                    <p className="sobretitulo">ANÁLISE AUTOMÁTICA</p>
                    <h2>Alertas financeiros</h2>
                  </div>
                  <span className="contador">{alertas.length} alertas</span>
                </div>
                {alertas.length === 0 ? (
                  <p className="subtitulo">
                    {diagnostico.quantidade === 0
                      ? 'Nenhum lançamento neste período para analisar.'
                      : 'Nenhum alerta disparado pelas regras atuais. Continue acompanhando.'}
                  </p>
                ) : (
                  alertas.map((alerta) => (
                    <article
                      className="alerta"
                      key={alerta.titulo}
                      onClick={() =>
                        setAlertaSelecionado(
                          alertaSelecionado === alerta.titulo
                            ? null
                            : alerta.titulo
                        )
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <span className={`alerta-marcador ${alerta.nivel}`} />
                      <div>
                        <h3>{alerta.titulo}</h3>
                        <p>{alerta.descricao}</p>
                        {alertaSelecionado === alerta.titulo && (
                          <div
                            style={{
                              marginTop: '12px',
                              padding: '14px',
                              background: '#f3f6fb',
                              borderRadius: '10px',
                              fontSize: '13px',
                              lineHeight: 1.6,
                            }}
                          >
                            <strong>
                              Prioridade{' '}
                              {alerta.nivel === 'alto' ? 'alta' : 'moderada'}
                            </strong>
                            <p>
                              Este alerta foi calculado a partir dos lançamentos
                              registrados nos períodos selecionados.
                            </p>
                            <p>
                              <strong>Motivo:</strong> {alerta.descricao}{' '}
                              <strong>Próxima ação:</strong>{' '}
                              {alerta.titulo.includes('Despesas') ||
                              alerta.titulo.includes('despesas')
                                ? 'revise as categorias de gastos e confirme se as receitas estão completas.'
                                : alerta.titulo.includes('Receitas') ||
                                  alerta.titulo.includes('receitas')
                                ? 'confira os lançamentos e identifique as fontes de receita que mudaram.'
                                : 'confira os dados e o período analisado antes de decidir.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </section>
              <section className="painel">
                <div className="painel-cabecalho">
                  <div>
                    <p className="sobretitulo">POSSIBILIDADES</p>
                    <h2>Oportunidades identificadas</h2>
                  </div>
                </div>
                {oportunidades.length === 0 ? (
                  <p className="subtitulo">
                    {dadosFinanceirosIncompletos
                      ? 'Ainda não é possível identificar oportunidades confiáveis: confira primeiro as despesas ausentes.'
                      : 'Não foram identificadas oportunidades com os dados disponíveis.'}
                  </p>
                ) : (
                  oportunidades.map((item, indice) => (
                    <article className="oportunidade" key={item}>
                      <span>{String(indice + 1).padStart(2, '0')}</span>
                      <p>{item}</p>
                    </article>
                  ))
                )}
              </section>
            </div>
            <section className="recomendacao">
              <div>
                <p className="sobretitulo">PRÓXIMA DECISÃO</p>
                <h2>
                  {dadosFinanceirosIncompletos
                    ? 'Confira as despesas do período'
                    : alertas.length > 0
                    ? 'Investigue os pontos de atenção'
                    : 'Mantenha os registros atualizados'}
                </h2>
                <p>
                  {dadosFinanceirosIncompletos
                    ? 'Antes de decidir, confirme se os gastos foram registrados. Sem essas informações, o saldo positivo não comprova lucro.'
                    : diagnostico.recomendacao}
                </p>
              </div>
              <span className="recomendacao-etiqueta">
                Análise automática dos registros
              </span>
            </section>
          </>
        )}
        {secao === 'Comparativos' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">
                  INTELIGÊNCIA COMPARATIVA • {periodo.toUpperCase()}
                </p>
                <h2>O que mudou nas finanças?</h2>
              </div>
              <span className="contador">
                {diasNoPeriodo} dia(s) por período
              </span>
            </div>
            <p className="subtitulo">
              Período selecionado: {formatarDataComparativa(inicioAtual)} a{' '}
              {formatarDataComparativa(fimAtual)}
              {' • '}Comparação:{' '}
              {formatarDataComparativa(inicioComparacaoEquivalente)} a{' '}
              {formatarDataComparativa(fimComparacaoEquivalente)}.
            </p>
            <p className="subtitulo">
              {registrosDoPeriodo.length} lançamento(s) no período atual e{' '}
              {registrosComparacao.length} no anterior. A comparação utiliza
              janelas consecutivas de mesma duração, mas não comprova que os
              registros estejam completos nem que diferenças sejam causadas por
              uma decisão.
            </p>
            {!comparacaoDisponivel ? (
              <div
                style={{
                  padding: '18px',
                  background: '#fff7ed',
                  borderRadius: '12px',
                  marginTop: '18px',
                }}
              >
                <strong>Comparação indisponível</strong>
                <p>
                  É necessário ter lançamentos nos dois períodos. Importe ou
                  registre dados financeiros antes de interpretar mudanças.
                  Nenhuma variação será presumida.
                </p>
                <button
                  type="button"
                  onClick={() => setSecao('Dados financeiros')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '9px',
                    border: '1px solid #214b58',
                    background: '#fff',
                    color: '#214b58',
                    cursor: 'pointer',
                  }}
                >
                  Ir para dados financeiros
                </button>
              </div>
            ) : (
              <>
                <div className="indicadores" style={{ marginTop: '20px' }}>
                  {linhasComparativas.map((linha) => (
                    <article className="indicador" key={linha.titulo}>
                      <span>{linha.titulo}</span>
                      <strong>{formatarValorFinanceiro(linha.atual)}</strong>
                      <small>
                        Antes: {formatarValorFinanceiro(linha.anterior)}
                      </small>
                      <small>
                        Diferença: {linha.diferenca > 0 ? '+' : ''}
                        {formatarValorFinanceiro(linha.diferenca)}
                        {' • '}
                        {percentualComparativo(linha)}
                      </small>
                    </article>
                  ))}
                </div>
                <div style={{ marginTop: '24px' }}>
                  <p className="sobretitulo">CATEGORIAS DE DESPESA</p>
                  <h2>Maiores mudanças por categoria</h2>
                  {variacoesRelevantes.length === 0 ? (
                    <p className="subtitulo">
                      Nenhuma diferença nas despesas por categoria entre os
                      registros disponíveis.
                    </p>
                  ) : (
                    variacoesRelevantes.map((linha, indice) => (
                      <article className="oportunidade" key={linha.titulo}>
                        <span>{String(indice + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{linha.titulo}</strong>
                          <p>
                            Atual: {formatarValorFinanceiro(linha.atual)} •
                            Anterior: {formatarValorFinanceiro(linha.anterior)}
                          </p>
                          <p>
                            {linha.diferenca > 0 ? 'Aumento' : 'Redução'} de{' '}
                            {formatarValorFinanceiro(Math.abs(linha.diferenca))}
                            . {percentualComparativo(linha)}.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              registrarDecisaoVinculada(
                                `Investigar ${
                                  linha.diferenca > 0 ? 'aumento' : 'redução'
                                } das despesas em ${linha.titulo}`,
                                'Inteligência Comparativa'
                              );
                              setSecao('Decisões');
                            }}
                            style={{
                              marginTop: '10px',
                              padding: '9px 12px',
                              borderRadius: '8px',
                              border: '1px solid #214b58',
                              background: '#fff',
                              color: '#214b58',
                              cursor: 'pointer',
                            }}
                          >
                            Transformar em decisão
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
                <div className="recomendacao" style={{ marginTop: '22px' }}>
                  <div>
                    <p className="sobretitulo">LEITURA EXECUTIVA</p>
                    <h2>O que merece atenção?</h2>
                    <p>
                      {linhasComparativas[0].diferenca < 0
                        ? 'As receitas registradas diminuíram. Verifique fontes de receita e cobertura dos lançamentos.'
                        : linhasComparativas[0].diferenca > 0
                        ? 'As receitas registradas aumentaram. Verifique se a mudança é recorrente.'
                        : 'As receitas registradas não variaram entre os períodos.'}
                    </p>
                    <p>
                      {linhasComparativas[1].diferenca > 0
                        ? 'As despesas registradas aumentaram. Investigue as categorias com maior diferença.'
                        : linhasComparativas[1].diferenca < 0
                        ? 'As despesas registradas diminuíram. Confira se os custos foram registrados integralmente.'
                        : 'As despesas registradas não variaram entre os períodos.'}
                    </p>
                    <p>
                      Esses números representam movimentos cadastrados, não
                      lucro líquido, projeção de caixa nem garantia de resultado
                      futuro.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
        {secao === 'Diagnóstico' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">
                  ANÁLISE EMPRESARIAL • {periodo.toUpperCase()}
                </p>
                <h2>Diagnóstico financeiro</h2>
              </div>
              <span className="contador">
                {alertas.length} pontos de atenção
              </span>
            </div>
            <p className="subtitulo">
              {dadosFinanceirosIncompletos
                ? 'Existem receitas registradas, mas nenhuma despesa informada. Os dados ainda não permitem avaliar o resultado financeiro com segurança.'
                : diagnostico.resumo}
            </p>
            <p>
              Receitas:{' '}
              <strong>{formatarValorFinanceiro(diagnostico.receitas)}</strong> •
              Despesas:{' '}
              <strong>{formatarValorFinanceiro(diagnostico.despesas)}</strong>
            </p>
            <p>
              Despesas sobre receitas:{' '}
              <strong>
                {formatarPercentual(diagnostico.percentualDespesas)}
              </strong>
            </p>
            {alertas.length === 0 ? (
              <p className="subtitulo">
                {diagnostico.quantidade === 0
                  ? 'Sem dados para diagnosticar.'
                  : 'Nenhum alerta encontrado pelas regras atuais.'}
              </p>
            ) : (
              alertas.map((alerta) => (
                <article className="alerta" key={alerta.titulo}>
                  <span className={`alerta-marcador ${alerta.nivel}`} />
                  <div>
                    <h3>
                      {alerta.titulo} — prioridade{' '}
                      {alerta.nivel === 'alto' ? 'alta' : 'moderada'}
                    </h3>
                    <p>{alerta.descricao}</p>
                    <button
                      type="button"
                      onClick={() => {
                        registrarDecisaoVinculada(
                          `Investigar: ${alerta.titulo}`,
                          `Alerta: ${alerta.titulo}`
                        );
                        setSecao('Decisões');
                      }}
                      style={{
                        marginTop: '10px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #214b58',
                        background: '#fff',
                        color: '#214b58',
                        cursor: 'pointer',
                      }}
                    >
                      Criar decisão deste alerta
                    </button>
                  </div>
                </article>
              ))
            )}
            <div className="recomendacao">
              <div>
                <p className="sobretitulo">ORIENTAÇÃO INICIAL</p>
                <h2>O que investigar agora</h2>
                <p>{diagnostico.recomendacao}</p>
              </div>
            </div>
          </section>
        )}
        {secao === 'Oportunidades' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">
                  POTENCIAL DE MELHORIA • {periodo.toUpperCase()}
                </p>
                <h2>Oportunidades para a empresa</h2>
              </div>
              <span className="contador">{oportunidades.length} sugestões</span>
            </div>
            {oportunidades.length === 0 ? (
              <p className="subtitulo">
                Importe ou registre movimentos financeiros para receber
                sugestões.
              </p>
            ) : (
              oportunidades.map((item, indice) => (
                <article className="oportunidade" key={item}>
                  <span>{String(indice + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{item}</p>
                    <button
                      type="button"
                      onClick={() => {
                        registrarDecisaoVinculada(
                          item,
                          'Oportunidade identificada'
                        );
                        setSecao('Decisões');
                      }}
                      style={{
                        marginTop: '10px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #214b58',
                        background: '#fff',
                        color: '#214b58',
                        cursor: 'pointer',
                      }}
                    >
                      Transformar em decisão
                    </button>
                  </div>
                </article>
              ))
            )}
            <div className="recomendacao">
              <div>
                <p className="sobretitulo">PRÓXIMO PASSO</p>
                <h2>Valide as oportunidades</h2>
                <p>
                  Estas sugestões são baseadas nos lançamentos disponíveis, não
                  em previsões ou garantias de ganho.
                </p>
              </div>
            </div>
          </section>
        )}
        {secao === 'Decisões' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">PLANO DE AÇÃO</p>
                <h2>Minhas decisões</h2>
              </div>
              <span className="contador">{decisoes.length} registradas</span>
            </div>

            <p className="subtitulo" style={{ marginBottom: '16px' }}>
              Registre as ações escolhidas para acompanhar seus efeitos. As
              decisões desta versão ficam salvas neste navegador.
            </p>
            <form
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
                placeholder="Ex.: Revisar preços dos serviços"
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
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  fontWeight: 700,
                }}
              >
                Registrar decisão
              </button>
            </form>

            {decisoes.length === 0 ? (
              <p className="subtitulo">
                Nenhuma decisão registrada nesta conta.
              </p>
            ) : (
              <div style={{ marginTop: '20px' }}>
                {decisoes.map((decisao, indice) => (
                  <article className="oportunidade" key={indice}>
                    <span>{String(indice + 1).padStart(2, '0')}</span>
                    <div>
                      <p>{decisao}</p>
                      {acompanhamentos[String(indice)] && (
                        <small style={{ color: '#64748b' }}>
                          {acompanhamentos[String(indice)].origem} • Base:{' '}
                          {acompanhamentos[String(indice)].periodoBase} •{' '}
                          Resultado inicial:{' '}
                          {formatarValorFinanceiro(
                            acompanhamentos[String(indice)].resultadoBase
                          )}
                        </small>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {secao === 'Resultados' && (
          <section className="painel">
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
              <p style={{ margin: '0 0 8px' }}>Taxa de sucesso das decisões</p>

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
              <p style={{ margin: '0 0 8px' }}>Saldo dos impactos informados</p>

              <strong
                style={{
                  fontSize: '28px',
                  color: '#214b58',
                }}
              >
                {formatarImpactoAvaliado(ganhosAvaliados - perdasAvaliadas)}
              </strong>

              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Diferença entre valores informados após avaliações válidas; não
                comprova causalidade.
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
                      (ganhosAvaliados / (ganhosAvaliados + perdasAvaliadas)) *
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
                                ? Math.round((ultimo - primeiro) / 86400000) + 1
                                : 0;
                            };
                            const temAvaliacao =
                              acompanhamento.resultadoAvaliacao !== undefined;
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
                              acompanhamento.resultadoAvaliacao === undefined
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
                                  Base ({acompanhamento.periodoBase}): receitas{' '}
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
                                        acompanhamento.receitasAvaliacao ?? 0
                                      )}
                                      , despesas{' '}
                                      {formatarValorFinanceiro(
                                        acompanhamento.despesasAvaliacao ?? 0
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
                                  style={{ fontSize: '12px', color: '#64748b' }}
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
                                  style={{ fontSize: '12px', color: '#64748b' }}
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
                          {(['PENDENTE', 'POSITIVO', 'NEGATIVO'] as const).map(
                            (resultado) => (
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
                                      const b = Date.parse(`${fim}T12:00:00Z`);

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
                                          acompanhamento.inicioAvaliacao ?? '',
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
                            )
                          )}
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

                                  if (Number.isFinite(numero) && numero >= 0) {
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
          </section>
        )}

        {secao === 'Dados financeiros' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">DADOS DA EMPRESA</p>
                <h2>Lançamentos financeiros</h2>
              </div>
              <span className="contador">
                {lancamentosFinanceiros.length} lançamentos
              </span>
            </div>

            <p className="subtitulo">
              Registre receitas e despesas para acompanhar a situação financeira
              da empresa. Os totais abaixo consideram todos os lançamentos
              cadastrados.
            </p>

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
                Selecione um arquivo CSV para carregar receitas e despesas na
                PREVANZIA.
              </p>

              <label
                htmlFor="arquivo-csv-prevanzia"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                Arquivo CSV
              </label>

              <input
                id="arquivo-csv-prevanzia"
                type="file"
                accept=".csv,text/csv"
                onChange={async (evento) => {
                  const arquivo = evento.target.files?.[0];

                  if (!arquivo) {
                    return;
                  }

                  if (!arquivo.name.toLowerCase().endsWith('.csv')) {
                    alert('Selecione um arquivo no formato CSV.');
                    evento.target.value = '';
                    return;
                  }

                  await importarArquivoCSV(arquivo);

                  evento.target.value = '';
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  border: '1px solid #dce4ef',
                  borderRadius: '10px',
                  background: '#ffffff',
                }}
              />

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
                        await importarArquivoCSV(arquivo, mapaCSV);
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
                    O arquivo precisa informar o tipo como RECEITA ou DESPESA.
                    Se não houver alguma dessas informações, cancele a
                    importação.
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

              <p
                style={{
                  fontSize: '13px',
                  color: '#b45309',
                  marginTop: '8px',
                  lineHeight: 1.6,
                }}
              >
                Versão de testes: utilize apenas arquivos fictícios. A proteção
                contra importações duplicadas está ativa.
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
              <h3 style={{ marginTop: 0 }}>Histórico de importações CSV</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>
                Arquivos processados nesta conta, inclusive importações sem
                registros novos. Arquivos anteriores à implantação deste
                histórico não aparecem aqui.
              </p>
              {historicoImportacoes.length === 0 ? (
                <p className="subtitulo">
                  Nenhuma importação registrada ainda.
                </p>
              ) : (
                <div
                  style={{ display: 'grid', gap: '12px', marginTop: '16px' }}
                >
                  {historicoImportacoes
                    .filter((item) => item.empresaId === 'empresa_demo')
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
                        <p style={{ margin: '6px 0', fontSize: '13px' }}>
                          {item.totalRegistros} registro(s) no arquivo •{' '}
                          {item.novos} novo(s) • {item.duplicados} duplicado(s)
                        </p>
                      </article>
                    ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(evento) => {
                evento.preventDefault();

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
                  alert('Preencha todos os campos com valores válidos.');
                  return;
                }

                const novoLancamento: LancamentoFinanceiro = {
                  id: crypto.randomUUID(),
                  empresaId: 'empresa_demo',
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
                  onChange={(evento) => setValorLancamento(evento.target.value)}
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
                  onChange={(evento) => setDataLancamento(evento.target.value)}
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

            <h3>Histórico financeiro</h3>

            {lancamentosFinanceiros.length === 0 ? (
              <p className="subtitulo">
                Nenhum lançamento financeiro cadastrado.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                {lancamentosFinanceiros.map((lancamento) => (
                  <article
                    key={`${lancamento.empresaId}-${lancamento.id}`}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background:
                        lancamento.tipo === 'RECEITA' ? '#ecfdf5' : '#fef2f2',
                    }}
                  >
                    <strong>{lancamento.descricao}</strong>

                    <p style={{ margin: '8px 0' }}>
                      {lancamento.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
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
                          lancamento.tipo === 'RECEITA' ? '#166534' : '#b91c1c',
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
          </section>
        )}

        <footer>PREVANZIA • Inteligência para decidir melhor</footer>
      </main>
    </div>
  );
}

export default App;
