
import { useState } from 'react'
import './App.css'

type Alerta = {
  titulo: string
  descricao: string
  nivel: 'alto' | 'medio'
}

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
]

const oportunidades = [
  'Revisar serviços com margem abaixo do esperado.',
  'Identificar clientes com potencial de recompra.',
  'Negociar custos com fornecedores recorrentes.',
]

function App() {
  const [periodo, setPeriodo] = useState('Este mês')
  const [secao, setSecao] = useState('Visão geral')

  const secoes = [
    'Visão geral',
    'Diagnóstico',
    'Oportunidades',
    'Decisões',
    'Resultados',
  ]

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
            Os valores abaixo são fictícios. Ainda não há dados reais conectados.
          </span>
        </div>

        <section className="saude">
          <div>
            <p className="sobretitulo">SAÚDE DA EMPRESA</p>
            <h2>Atenção necessária</h2>
            <p>
              Encontramos sinais que merecem análise antes das próximas decisões.
            </p>
          </div>
          <span className="saude-indicador">● Atenção</span>
        </section>

        <section className="indicadores">
          <article className="indicador">
            <span>Receita estimada</span>
            <strong>R$ 84.500</strong>
            <small className="positivo">↑ 8,2% em relação ao período anterior</small>
          </article>

          <article className="indicador">
            <span>Despesas estimadas</span>
            <strong>R$ 65.065</strong>
            <small className="negativo">↑ 18% em relação ao período anterior</small>
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
              <article className="alerta" key={alerta.titulo}>
                <span className={`alerta-marcador ${alerta.nivel}`} />
                <div>
                  <h3>{alerta.titulo}</h3>
                  <p>{alerta.descricao}</p>
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
          <span className="recomendacao-etiqueta">Recomendação demonstrativa</span>
        </section>

        <footer>
          PREVANZIA • Inteligência para decidir melhor
        </footer>
      </main>
    </div>
  )
}

export default App
