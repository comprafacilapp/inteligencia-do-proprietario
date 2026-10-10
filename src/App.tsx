import { useEffect, useState } from 'react';
import './App.css';

type Alerta = {
  titulo: string;
  descricao: string;
  nivel: 'alto' | 'medio';
};

const alertas: Alerta[] = [
  {
    titulo: 'Queda na margem de lucro',
    descricao: 'A margem estimada caiu de 31% para 23% neste período.',
    nivel: 'alto',
  },
  {
    titulo: 'Despesas em crescimento',
    descricao: 'As despesas aumentaram 18% em relação ao período anterior.',
    nivel: 'medio',
  },
  {
    titulo: 'Recebimentos atrasados',
    descricao: 'Existem R$ 8.450 em recebimentos que precisam de atenção.',
    nivel: 'medio',
  },
];

const oportunidades = [
  'Revisar serviços com margem abaixo do esperado.',
  'Identificar clientes com potencial de recompra.',
  'Negociar custos com fornecedores recorrentes.',
];

function App() {
  const [periodo, setPeriodo] = useState('Este mês');
  const [secao, setSecao] = useState('Visão geral');
  const [novaDecisao, setNovaDecisao] = useState('');
  const [decisoes, setDecisoes] = useState<string[]>(() => {
    try {
      const salvas = localStorage.getItem('prevanzia_decisoes');
      const dados: unknown = salvas ? JSON.parse(salvas) : [];

      return Array.isArray(dados) &&
        dados.every((item) => typeof item === 'string')
        ? dados
        : [];
    } catch {
      return [];
    }
  });
  const [alertaSelecionado, setAlertaSelecionado] = useState<string | null>(
    null
  );
  const [resultadosDecisoes, setResultadosDecisoes] = useState<
    Record<string, 'PENDENTE' | 'POSITIVO' | 'NEGATIVO'>
  >(() => {
    try {
      const salvos = localStorage.getItem('prevanzia_resultados');
      return salvos ? JSON.parse(salvos) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(
      'prevanzia_resultados',
      JSON.stringify(resultadosDecisoes)
    );
  }, [resultadosDecisoes]);

  const [impactosDecisoes, setImpactosDecisoes] = useState<
    Record<string, number>
  >(() => {
    try {
      const salvos = localStorage.getItem('prevanzia_impactos');
      const dados: unknown = salvos ? JSON.parse(salvos) : {};

      if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) {
        return {};
      }

      return Object.fromEntries(
        Object.entries(dados).filter(
          ([, valor]) =>
            typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
        )
      );
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(
      'prevanzia_impactos',
      JSON.stringify(impactosDecisoes)
    );
  }, [impactosDecisoes]);

  useEffect(() => {
    localStorage.setItem('prevanzia_decisoes', JSON.stringify(decisoes));
  }, [decisoes]);

  const secoes = [
    'Visão geral',
    'Diagnóstico',
    'Oportunidades',
    'Decisões',
    'Resultados',
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
          <strong>Modo demonstração</strong>
          <span>
            Os valores abaixo são fictícios. Ainda não há dados reais
            conectados.
          </span>
        </div>

        {secao === 'Visão geral' && (
          <>
            <section className="saude">
              <div>
                <p className="sobretitulo">SAÚDE DA EMPRESA</p>
                <h2>Atenção necessária</h2>
                <p>
                  Encontramos sinais que merecem análise antes das próximas
                  decisões.
                </p>
              </div>
              <span className="saude-indicador">● Atenção</span>
            </section>

            <section className="indicadores">
              <article className="indicador">
                <span>Receita estimada</span>
                <strong>R$ 84.500</strong>
                <small className="positivo">
                  ↑ 8,2% em relação ao período anterior
                </small>
              </article>

              <article className="indicador">
                <span>Despesas estimadas</span>
                <strong>R$ 65.065</strong>
                <small className="negativo">
                  ↑ 18% em relação ao período anterior
                </small>
              </article>

              <article className="indicador">
                <span>Resultado estimado</span>
                <strong>R$ 19.435</strong>
                <small>Receita menos despesas informadas</small>
              </article>

              <article className="indicador">
                <span>Margem estimada</span>
                <strong>23%</strong>
                <small className="negativo">↓ 8 pontos percentuais</small>
              </article>
            </section>

            <div className="duas-colunas">
              <section className="painel">
                <div className="painel-cabecalho">
                  <div>
                    <p className="sobretitulo">O QUE MUDOU?</p>
                    <h2>Alertas importantes</h2>
                  </div>
                  <span className="contador">{alertas.length} alertas</span>
                </div>

                {alertas.map((alerta) => (
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
                            lineHeight: '1.6',
                          }}
                        >
                          <strong>Diagnóstico preliminar</strong>
                          <p>
                            Este alerta merece investigação. Compare os dados do
                            período atual com os anteriores para identificar
                            possíveis causas.
                          </p>
                          <p>
                            <strong>Próxima ação:</strong> confira os registros
                            financeiros relacionados antes de tomar uma decisão.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </section>

              <section className="painel">
                <div className="painel-cabecalho">
                  <div>
                    <p className="sobretitulo">POSSIBILIDADES</p>
                    <h2>Oportunidades identificadas</h2>
                  </div>
                </div>

                {oportunidades.map((item, indice) => (
                  <article className="oportunidade" key={item}>
                    <span>{String(indice + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </article>
                ))}
              </section>
            </div>

            <section className="recomendacao">
              <div>
                <p className="sobretitulo">PRÓXIMA DECISÃO</p>
                <h2>Investigue a redução da margem</h2>
                <p>
                  Compare custos, descontos e preços praticados antes de decidir
                  qualquer reajuste.
                </p>
              </div>
              <span className="recomendacao-etiqueta">
                Recomendação demonstrativa
              </span>
            </section>
          </>
        )}
        {secao === 'Diagnóstico' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">ANÁLISE EMPRESARIAL</p>
                <h2>Diagnóstico financeiro</h2>
              </div>
              <span className="contador">3 pontos de atenção</span>
            </div>

            {alertas.map((alerta) => (
              <article className="alerta" key={alerta.titulo}>
                <span className={`alerta-marcador ${alerta.nivel}`} />
                <div>
                  <h3>{alerta.titulo}</h3>
                  <p>{alerta.descricao}</p>
                </div>
              </article>
            ))}

            <div className="recomendacao">
              <div>
                <p className="sobretitulo">ORIENTAÇÃO INICIAL</p>
                <h2>Investigue antes de decidir</h2>
                <p>
                  Compare receitas, despesas e recebimentos dos períodos
                  anteriores para investigar as possíveis causas.
                </p>
              </div>
            </div>
          </section>
        )}
        {secao === 'Oportunidades' && (
          <section className="painel">
            <div className="painel-cabecalho">
              <div>
                <p className="sobretitulo">POTENCIAL DE MELHORIA</p>
                <h2>Oportunidades para a empresa</h2>
              </div>
              <span className="contador">3 sugestões</span>
            </div>

            {oportunidades.map((item, indice) => (
              <article className="oportunidade" key={item}>
                <span>{String(indice + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </article>
            ))}

            <div className="recomendacao">
              <div>
                <p className="sobretitulo">PRÓXIMO PASSO</p>
                <h2>Escolha uma oportunidade para investigar</h2>
                <p>
                  Avalie o potencial de ganho, os custos e os riscos antes de
                  transformar uma sugestão em decisão.
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

            <form
              onSubmit={(evento) => {
                evento.preventDefault();

                if (!novaDecisao.trim()) return;

                setDecisoes([...decisoes, novaDecisao.trim()]);
                setNovaDecisao('');
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
                Nenhuma decisão registrada nesta sessão.
              </p>
            ) : (
              <div style={{ marginTop: '20px' }}>
                {decisoes.map((decisao, indice) => (
                  <article className="oportunidade" key={indice}>
                    <span>{String(indice + 1).padStart(2, '0')}</span>
                    <p>{decisao}</p>
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
                padding: '20px',
                background: '#eaf6f5',
                borderRadius: '12px',
                marginTop: '20px',
                marginBottom: '20px',
              }}
            >
              <p style={{ margin: '0 0 8px' }}>
                Ganhos financeiros registrados
              </p>

              <strong
                style={{
                  fontSize: '28px',
                  color: '#214b58',
                }}
              >
                {Object.entries(impactosDecisoes)
                  .filter(
                    ([indice]) => resultadosDecisoes[indice] === 'POSITIVO'
                  )
                  .reduce((total, [, valor]) => total + valor, 0)
                  .toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
              </strong>

              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Soma dos valores das decisões com resultado positivo.
              </p>
            </div>
            {/* COLE O CÓDIGO NOVO AQUI */}
            <div
              style={{
                padding: '20px',
                background: '#fff1f0',
                borderRadius: '12px',
                marginBottom: '20px',
              }}
            >
              <p style={{ margin: '0 0 8px' }}>
                Perdas financeiras registradas
              </p>

              <strong
                style={{
                  fontSize: '28px',
                  color: '#b42318',
                }}
              >
                {Object.entries(impactosDecisoes)
                  .filter(
                    ([indice]) => resultadosDecisoes[indice] === 'NEGATIVO'
                  )
                  .reduce((total, [, valor]) => total + valor, 0)
                  .toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
              </strong>

              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Soma dos valores das decisões com resultado negativo.
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
              <p style={{ margin: '0 0 8px' }}>Saldo financeiro das decisões</p>

              <strong
                style={{
                  fontSize: '28px',
                  color: '#214b58',
                }}
              >
                {(
                  Object.entries(impactosDecisoes)
                    .filter(
                      ([indice]) => resultadosDecisoes[indice] === 'POSITIVO'
                    )
                    .reduce((total, [, valor]) => total + valor, 0) -
                  Object.entries(impactosDecisoes)
                    .filter(
                      ([indice]) => resultadosDecisoes[indice] === 'NEGATIVO'
                    )
                    .reduce((total, [, valor]) => total + valor, 0)
                ).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>

              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Ganhos registrados menos perdas registradas.
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
                          Resultado:{' '}
                          {resultadosDecisoes[String(indice)] || 'PENDENTE'}
                        </p>
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
                                onClick={() =>
                                  setResultadosDecisoes((anteriores) => ({
                                    ...anteriores,
                                    [String(indice)]: resultado,
                                  }))
                                }
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
        <footer>PREVANZIA • Inteligência para decidir melhor</footer>
      </main>
    </div>
  );
}

export default App;
