import { useState } from 'react';

const estilos = {
  pagina: {
    minHeight: '100vh',
    background: '#f4f7fb',
    color: '#14263d',
    fontFamily: 'Arial, sans-serif',
  },
  cabecalho: {
    background: '#10263c',
    color: '#ffffff',
    padding: '20px 6%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 16,
  },
  destaque: {
    background: 'linear-gradient(135deg, #10263c, #17476c)',
    color: '#ffffff',
    padding: '85px 6%',
    textAlign: 'center' as const,
  },
  botao: {
    background: '#21b7e8',
    color: '#08283d',
    border: 'none',
    borderRadius: 9,
    padding: '15px 24px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 15,
  },
  secao: {
    padding: '65px 6%',
    maxWidth: 1150,
    margin: 'auto',
  },
  grade: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 22,
    marginTop: 30,
  },
  cartao: {
    background: '#ffffff',
    borderRadius: 15,
    padding: 28,
    boxShadow: '0 5px 22px rgba(0,0,0,0.06)',
  },
} as const;

export default function SiteComercial() {
  const [mostrarAviso, setMostrarAviso] = useState(false);

  function informarPreparacao() {
    setMostrarAviso(true);
  }

  return (
    <div style={estilos.pagina}>
      <header style={estilos.cabecalho}>
        <strong style={{ fontSize: 25 }}>PREVANZIA</strong>

        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <a href="#recursos" style={{ color: '#ffffff' }}>
            Recursos
          </a>
          <a href="#planos" style={{ color: '#ffffff' }}>
            Planos
          </a>
          <a href="#sobre" style={{ color: '#ffffff' }}>
            Sobre
          </a>
        </nav>
      </header>

      <section style={estilos.destaque}>
        <p style={{ color: '#8ddfff', fontWeight: 700 }}>
          INTELIGÊNCIA PARA PROPRIETÁRIOS
        </p>

        <h1
          style={{
            fontSize: 'clamp(30px, 5vw, 52px)',
            maxWidth: 850,
            margin: '20px auto',
          }}
        >
          Antecipe o futuro.
          <br />
          Decida com inteligência.
        </h1>

        <p
          style={{
            fontSize: 19,
            maxWidth: 720,
            margin: '0 auto 30px',
            lineHeight: 1.7,
          }}
        >
          Transforme os dados financeiros da sua empresa em
          diagnósticos, oportunidades e informações para
          tomar decisões mais inteligentes.
        </p>

        <button
          type="button"
          style={estilos.botao}
          onClick={informarPreparacao}
        >
          Experimente grátis por 7 dias
        </button>

        <p style={{ fontSize: 13, marginTop: 18 }}>
          Sem cartão de crédito para iniciar o teste.
        </p>
      </section>

      <section id="recursos" style={estilos.secao}>
        <h2 style={{ textAlign: 'center', fontSize: 32 }}>
          Muito mais do que números
        </h2>

        <p style={{ textAlign: 'center', color: '#607087' }}>
          Inteligência empresarial para quem precisa decidir.
        </p>

        <div style={estilos.grade}>
          <article style={estilos.cartao}>
            <h3>📊 Diagnósticos</h3>
            <p>
              Entenda a evolução das receitas, despesas e
              resultados financeiros da empresa.
            </p>
          </article>

          <article style={estilos.cartao}>
            <h3>💡 Oportunidades</h3>
            <p>
              Identifique pontos de atenção e possibilidades
              de melhoria a partir dos dados disponíveis.
            </p>
          </article>

          <article style={estilos.cartao}>
            <h3>🎯 Decisões</h3>
            <p>
              Organize decisões importantes e acompanhe
              os resultados das ações realizadas.
            </p>
          </article>

          <article style={estilos.cartao}>
            <h3>📁 Importação de dados</h3>
            <p>
              Utilize arquivos financeiros para alimentar
              as análises sem precisar substituir seu
              sistema de gestão.
            </p>
          </article>
        </div>
      </section>

      <section
        id="planos"
        style={{ ...estilos.secao, textAlign: 'center' }}
      >
        <h2 style={{ fontSize: 32 }}>Escolha seu plano</h2>

        <p style={{ color: '#607087' }}>
          Comece com 7 dias gratuitos e escolha como continuar.
        </p>

        <div style={estilos.grade}>
          <article style={estilos.cartao}>
            <h3>Essencial</h3>

            <h2 style={{ fontSize: 35 }}>
              R$ 39,90
              <span style={{ fontSize: 15 }}>/mês</span>
            </h2>

            <p>Até 1 empresa</p>
            <p>Diagnósticos e oportunidades</p>
            <p>Decisões e resultados</p>
            <p>Importação de dados financeiros</p>

            <button
              type="button"
              style={estilos.botao}
              onClick={informarPreparacao}
            >
              Escolher Essencial
            </button>
          </article>

          <article
            style={{
              ...estilos.cartao,
              border: '2px solid #21b7e8',
            }}
          >
            <h3>Profissional</h3>

            <h2 style={{ fontSize: 35 }}>
              R$ 69,90
              <span style={{ fontSize: 15 }}>/mês</span>
            </h2>

            <p>Até 3 empresas</p>
            <p>Diagnósticos e oportunidades</p>
            <p>Decisões e resultados</p>
            <p>Importação de dados financeiros</p>

            <button
              type="button"
              style={estilos.botao}
              onClick={informarPreparacao}
            >
              Escolher Profissional
            </button>
          </article>
        </div>
      </section>

      <section
        id="sobre"
        style={{ ...estilos.secao, textAlign: 'center' }}
      >
        <h2>O PREVANZIA trabalha ao lado do proprietário</h2>

        <p
          style={{
            maxWidth: 750,
            margin: '20px auto',
            lineHeight: 1.8,
          }}
        >
          O PREVANZIA não pretende substituir o sistema
          de gestão da sua empresa. Sua proposta é transformar
          dados existentes em informações úteis para
          identificar problemas, compreender causas,
          recomendar ações e acompanhar resultados.
        </p>
      </section>

      <footer
        style={{
          background: '#10263c',
          color: '#ffffff',
          padding: 30,
          textAlign: 'center',
        }}
      >
        <strong>PREVANZIA</strong>
        <p>Antecipe o futuro. Decida com inteligência.</p>
      </footer>

      {mostrarAviso && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aviso de disponibilidade"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
