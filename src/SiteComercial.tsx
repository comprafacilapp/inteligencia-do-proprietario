import { useState } from 'react';

const apresentadora =
  '/inteligencia-do-proprietario/Profissional%20A%20Apontar%20Para%20o%20Espa%C3%A7o.png';

const recursos = [
  { icone: '◈', titulo: 'Diagnósticos automáticos', texto: 'Entenda mudanças nas receitas, despesas e resultados com informações claras.' },
  { icone: '✦', titulo: 'Oportunidades reais', texto: 'Identifique pontos de atenção e possibilidades de melhoria nos dados disponíveis.' },
  { icone: '◎', titulo: 'Decisões mais seguras', texto: 'Organize ações importantes e acompanhe as decisões tomadas.' },
  { icone: '▥', titulo: 'Resultados no seu ritmo', texto: 'Acompanhe a evolução da empresa sem substituir seu sistema de gestão.' },
];

export default function SiteComercial() {
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const informarPreparacao = () => setMostrarAviso(true);

   const documentoAtual = new URLSearchParams(
    window.location.search
  ).get('documento');

  const documentos = {
    privacidade: {
      titulo: 'Política de Privacidade',
      texto: [
        'O PREVANZIA é uma plataforma de inteligência empresarial que utiliza informações fornecidas pelos usuários para gerar análises, diagnósticos e recomendações.',
        'Podemos tratar dados de cadastro, autenticação, identificação de empresas, informações financeiras importadas, registros de decisões e solicitações de atendimento.',
        'Os dados são utilizados para funcionamento da plataforma, autenticação, organização das empresas, geração de análises e prestação de suporte.',
        'A plataforma utiliza serviços tecnológicos, incluindo Firebase, para autenticação e armazenamento de informações.',
        'Os titulares podem solicitar informações, correção ou exclusão de dados pessoais nas hipóteses previstas na LGPD pelo e-mail contato.prevanzia@gmail.com.',
        'Esta política é preliminar e será complementada com identificação do responsável, informações sobre fornecedores, retenção e procedimentos de exclusão antes da comercialização.',
      ],
    },
    termos: {
      titulo: 'Termos de Uso',
      texto: [
        'O PREVANZIA oferece ferramentas de inteligência empresarial para apoiar proprietários na análise de informações financeiras e na tomada de decisões.',
        'O usuário é responsável pela veracidade das informações fornecidas e pela autorização para utilizar os dados importados.',
        'Os diagnósticos e recomendações são informativos e não representam garantia de lucro ou substituição de orientação profissional.',
        'O usuário deve proteger suas credenciais e utilizar a plataforma de maneira lícita.',
        'Os planos e o teste gratuito apresentados no site ainda estão em preparação e não estão disponíveis para contratação.',
        'Dúvidas e solicitações podem ser encaminhadas para contato.prevanzia@gmail.com.',
      ],
    },
    assinaturas: {
      titulo: 'Assinaturas e Cancelamento',
      texto: [
        'Plano Essencial: R$ 39,90 por mês, com utilização prevista para até uma empresa.',
        'Plano Profissional: R$ 69,90 por mês, com utilização prevista para até três empresas.',
        'Está previsto um teste gratuito de sete dias, cujas condições serão apresentadas antes da ativação.',
        'Os meios de pagamento, renovação, cancelamento e reembolso serão informados antes do início das contratações.',
        'Será respeitado o direito de arrependimento nas situações em que a legislação brasileira o determinar.',
        'Atendimento: contato.prevanzia@gmail.com.',
      ],
    },
  };

  const documentoSelecionado =
    documentoAtual === 'privacidade' ||
    documentoAtual === 'termos' ||
    documentoAtual === 'assinaturas'
      ? documentos[documentoAtual]
      : null;

  if (documentoSelecionado) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f2f6fb',
          color: '#152a41',
          fontFamily: 'Arial, sans-serif',
          padding: '40px 5%',
        }}
      >
        <main
          style={{
            maxWidth: 850,
            margin: '0 auto',
            background: '#ffffff',
            padding: '35px',
            borderRadius: 16,
            lineHeight: 1.8,
          }}
        >
          <a
            href="?pagina=site"
            style={{ color: '#0876a7', fontWeight: 700 }}
          >
            ← Voltar ao site do PREVANZIA
          </a>

          <h1>{documentoSelecionado.titulo}</h1>

          <p><strong>Versão preliminar — 23/10/2026</strong></p>

          {documentoSelecionado.texto.map((paragrafo, indice) => (
            <p key={indice}>{paragrafo}</p>
          ))}

          <p>
            <strong>Contato:</strong> contato.prevanzia@gmail.com
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="prevanzia-site">
      <style>{`
        .prevanzia-site { min-height:100vh; background:#f2f6fb; color:#152a41; font-family:Arial,Helvetica,sans-serif; }
        .prevanzia-site * { box-sizing:border-box; }
        .prevanzia-site .topo { background:#061a30; color:#fff; border-bottom:1px solid #21445f; }
        .prevanzia-site .topo-interno { max-width:1440px; margin:auto; padding:18px 5%; display:flex; align-items:center; justify-content:space-between; gap:22px; flex-wrap:wrap; }
        .prevanzia-site .marca { font-weight:900; font-size:25px; letter-spacing:1.6px; color:#fff; text-decoration:none; }
        .prevanzia-site .marca span { color:#31c6f1; margin-right:8px; }
        .prevanzia-site .navegacao { display:flex; align-items:center; flex-wrap:wrap; gap:23px; }
        .prevanzia-site .navegacao a { color:#d7e9f7; text-decoration:none; font-size:14px; }
        .prevanzia-site .navegacao a:hover { color:#6cdbff; }
        .prevanzia-site button { cursor:pointer; font-family:inherit; }
        .prevanzia-site .botao { background:#24b9ec; color:#05233b; border:0; border-radius:10px; padding:15px 23px; font-size:15px; font-weight:800; box-shadow:0 7px 22px #009de52d; }
        .prevanzia-site .botao:hover { background:#66d7fa; }
        .prevanzia-site .botao-menor { padding:11px 17px; font-size:13px; }
        .prevanzia-site .hero { background:radial-gradient(ellipse at 76% 32%,#12517c 0%,#0a3155 36%,#061a30 80%); color:#fff; overflow:hidden; }
        .prevanzia-site .hero-interno { max-width:1500px; margin:auto; padding:64px 5% 50px; }
        .prevanzia-site .hero-grade { display:grid; grid-template-columns:minmax(280px,0.95fr) minmax(0,1.65fr); gap:24px; align-items:center; }
        .prevanzia-site .chamada { position:relative; z-index:2; }
        .prevanzia-site .sobretitulo { font-size:12px; font-weight:800; letter-spacing:2px; color:#5ad4ff; margin:0 0 23px; }
        .prevanzia-site h1 { font-size:clamp(36px,4.4vw,66px); line-height:1.09; letter-spacing:-1.8px; margin:0 0 24px; }
        .prevanzia-site h1 em { font-style:normal; color:#5bd5ff; }
        .prevanzia-site .resumo { max-width:480px; color:#c3d9e9; font-size:17px; line-height:1.75; margin:0 0 28px; }
        .prevanzia-site .sem-cartao { color:#a7c9dd; font-size:12px; margin-top:14px; }
        .prevanzia-site .beneficios-curtos { display:flex; flex-wrap:wrap; gap:10px 20px; margin-top:30px; font-size:12px; color:#b9e6f7; }
        .prevanzia-site .beneficios-curtos span::before { content:'✓'; color:#48dcbd; font-weight:900; margin-right:7px; }
        .prevanzia-site .vitrine { position:relative; display:flex; align-items:flex-end; justify-content:flex-end; min-width:0; min-height:455px; }
        .prevanzia-site .pessoa { position:relative; z-index:2; width:43%; max-width:350px; margin-right:-7%; align-self:flex-end; object-fit:contain; filter:drop-shadow(0 18px 20px #0005); }
        .prevanzia-site .painel { position:relative; z-index:1; width:69%; max-width:620px; background:#f8fbff; border:9px solid #122b43; border-radius:17px; box-shadow:0 26px 60px #0008; color:#21334a; overflow:hidden; margin-bottom:20px; }
        .prevanzia-site .painel-topo { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px; background:#eaf2fa; border-bottom:1px solid #dbe6f1; font-size:13px; }
        .prevanzia-site .painel-topo strong { color:#0b4773; }
        .prevanzia-site .demo { font-size:10px; color:#57718b; background:#d9e9f7; border-radius:99px; padding:5px 8px; }
        .prevanzia-site .painel-conteudo { padding:16px; }
        .prevanzia-site .indicadores { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
        .prevanzia-site .indicador { background:#fff; border:1px solid #e0eaf3; border-radius:9px; padding:11px 8px; }
        .prevanzia-site .indicador small { display:block; color:#61758a; font-size:10px; margin-bottom:7px; }
        .prevanzia-site .indicador strong { display:block; font-size:clamp(11px,1.25vw,19px); white-space:nowrap; }
        .prevanzia-site .indicador .positivo { color:#0e9779; }
        .prevanzia-site .grafico-area { margin-top:12px; padding:14px; background:#fff; border:1px solid #e0eaf3; border-radius:9px; }
        .prevanzia-site .grafico-area h3 { font-size:12px; margin:0 0 10px; }
        .prevanzia-site .grafico { width:100%; height:auto; display:block; }
        .prevanzia-site .alertas { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:12px; }
        .prevanzia-site .alerta { background:#fff; border:1px solid #e0eaf3; border-radius:9px; padding:11px; font-size:10px; line-height:1.5; }
        .prevanzia-site .alerta strong { display:block; font-size:11px; margin-bottom:4px; }
        .prevanzia-site .alerta.atencao strong { color:#b26b12; }
        .prevanzia-site .alerta.oportunidade strong { color:#087e75; }
        .prevanzia-site .aviso-demo { font-size:10px; color:#72879c; text-align:right; margin:10px 0 0; }
        .prevanzia-site .recursos-hero { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:15px; margin-top:35px; }
        .prevanzia-site .recurso-hero { background:#0e3150; border:1px solid #28516c; border-radius:14px; padding:19px; }
        .prevanzia-site .recurso-hero .icone { color:#58d6ff; font-size:25px; display:block; margin-bottom:10px; }
        .prevanzia-site .recurso-hero h3 { font-size:14px; margin:0 0 8px; }
        .prevanzia-site .recurso-hero p { color:#b7cedf; font-size:12px; line-height:1.6; margin:0; }
        .prevanzia-site .secao { max-width:1150px; padding:75px 5%; margin:auto; }
        .prevanzia-site .titulo-secao { font-size:clamp(27px,3vw,36px); text-align:center; margin:0 0 14px; }
        .prevanzia-site .subtitulo-secao { text-align:center; color:#63768b; line-height:1.7; margin:0 auto 35px; max-width:690px; }
        .prevanzia-site .cartoes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px; }
        .prevanzia-site .cartao { background:#fff; border-radius:17px; padding:30px; box-shadow:0 8px 26px #0b345010; }
        .prevanzia-site .cartao h3 { margin-top:0; }
        .prevanzia-site .cartao p { line-height:1.7; color:#60758a; }
        .prevanzia-site .preco { font-size:37px; font-weight:800; margin:20px 0; }
        .prevanzia-site .preco span { font-size:15px; font-weight:400; }
        .prevanzia-site .plano-destaque { border:2px solid #21b7e8; }
        .prevanzia-site .plano-item { color:#4e647a; font-size:14px; margin:13px 0; }
        .prevanzia-site .plano-item::before { content:'✓'; color:#119caa; font-weight:900; margin-right:9px; }
        .prevanzia-site .sobre { text-align:center; max-width:760px; margin:auto; line-height:1.9; color:#546b81; }
        .prevanzia-site .rodape { background:#061a30; color:#fff; text-align:center; padding:35px 20px; }
        .prevanzia-site .rodape p { color:#a9c4d9; }
        .prevanzia-site .modal-fundo { position:fixed; inset:0; z-index:1000; background:#000b; display:flex; align-items:center; justify-content:center; padding:20px; }
        .prevanzia-site .modal { background:#fff; color:#14263d; padding:30px; border-radius:16px; width:100%; max-width:440px; text-align:center; box-shadow:0 20px 60px #0005; }
        .prevanzia-site .modal p { line-height:1.7; }
        @media(max-width:1080px) {
          .prevanzia-site .hero-grade { grid-template-columns:1fr; }
          .prevanzia-site .chamada { text-align:center; }
          .prevanzia-site .resumo { margin-left:auto; margin-right:auto; }
          .prevanzia-site .beneficios-curtos { justify-content:center; }
          .prevanzia-site .vitrine { justify-content:center; min-height:0; }
          .prevanzia-site .pessoa { width:34%; margin-right:-5%; }
          .prevanzia-site .painel { width:64%; }
          .prevanzia-site .recursos-hero { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
        @media(max-width:600px) {
          .prevanzia-site .topo-interno { justify-content:center; padding:17px 5%; }
          .prevanzia-site .navegacao { justify-content:center; gap:13px; }
          .prevanzia-site .navegacao a { font-size:12px; }
          .prevanzia-site .hero-interno { padding:43px 5% 35px; }
          .prevanzia-site h1 { font-size:37px; }
          .prevanzia-site .resumo { font-size:15px; }
          .prevanzia-site .vitrine { display:block; }
          .prevanzia-site .pessoa { display:block; width:65%; max-width:280px; margin:0 auto -22px; }
          .prevanzia-site .painel { width:100%; max-width:480px; margin:0 auto; border-width:6px; }
          .prevanzia-site .painel-conteudo { padding:10px; }
          .prevanzia-site .indicador { padding:8px 5px; }
          .prevanzia-site .indicador strong { font-size:12px; }
          .prevanzia-site .alertas { grid-template-columns:1fr; }
          .prevanzia-site .recursos-hero { grid-template-columns:1fr; }
          .prevanzia-site .cartoes { grid-template-columns:1fr; }
          .prevanzia-site .secao { padding:55px 5%; }
        }
      `}</style>

      <header className="topo">
        <div className="topo-interno">
          <a className="marca" href="#inicio"><span>◈</span>PREVANZIA</a>
          <nav className="navegacao" aria-label="Navegação principal">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
            <a href="#sobre">Sobre</a>
            <a href="/inteligencia-do-proprietario/">Entrar</a>
            <button type="button" className="botao botao-menor" onClick={informarPreparacao}>Experimente grátis</button>
          </nav>
        </div>
      </header>

      <main>
        <section id="inicio" className="hero">
          <div className="hero-interno">
            <div className="hero-grade">
              <div className="chamada">
                <p className="sobretitulo">INTELIGÊNCIA PARA PROPRIETÁRIOS</p>
                <h1>Antecipe o futuro.<br /><em>Decida com inteligência.</em></h1>
                <p className="resumo">Transforme os dados financeiros da sua empresa em diagnósticos, oportunidades e informações para tomar decisões mais inteligentes.</p>
                <button type="button" className="botao" onClick={informarPreparacao}>Experimente grátis por 7 dias →</button>
                <p className="sem-cartao">Sem cartão de crédito para iniciar o teste, quando disponível.</p>
                <div className="beneficios-curtos">
                  <span>Sem substituir seu sistema</span>
                  <span>Dados da sua empresa</span>
                  <span>Decisões explicáveis</span>
                </div>
              </div>

              <div className="vitrine" aria-label="Apresentação ilustrativa da plataforma">
                <img className="pessoa" src={apresentadora} alt="Apresentadora do PREVANZIA apontando para o painel" />
                <div className="painel">
                  <div className="painel-topo"><strong>◈ PREVANZIA | Visão executiva</strong><span className="demo">DEMONSTRAÇÃO</span></div>
                  <div className="painel-conteudo">
                    <div className="indicadores">
                      <div className="indicador"><small>Receitas</small><strong>R$ 84.500</strong></div>
                      <div className="indicador"><small>Despesas</small><strong>R$ 61.200</strong></div>
                      <div className="indicador"><small>Resultado</small><strong className="positivo">R$ 23.300</strong></div>
                    </div>
                    <div className="grafico-area">
                      <h3>Evolução financeira — exemplo ilustrativo</h3>
                      <svg className="grafico" viewBox="0 0 460 150" role="img" aria-label="Gráfico demonstrativo com linhas de receitas e despesas ao longo de seis meses">
                        <g stroke="#e3eaf2" strokeWidth="1"><line x1="20" y1="25" x2="445" y2="25"/><line x1="20" y1="60" x2="445" y2="60"/><line x1="20" y1="95" x2="445" y2="95"/><line x1="20" y1="130" x2="445" y2="130"/></g>
                        <polyline points="20,90 105,75 190,82 275,48 360,56 445,22" fill="none" stroke="#1689db" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="20,111 105,104 190,108 275,88 360,96 445,77" fill="none" stroke="#f0a15a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                        <g fill="#1689db"><circle cx="20" cy="90" r="4"/><circle cx="105" cy="75" r="4"/><circle cx="190" cy="82" r="4"/><circle cx="275" cy="48" r="4"/><circle cx="360" cy="56" r="4"/><circle cx="445" cy="22" r="4"/></g>
                      </svg>
                      <div style={{display:'flex',gap:16,fontSize:10,color:'#62758a'}}><span>🔵 Receitas</span><span>🟠 Despesas</span></div>
                    </div>
                    <div className="alertas">
                      <div className="alerta atencao"><strong>⚠ Atenção identificada</strong>Despesas em crescimento no período.</div>
                      <div className="alerta oportunidade"><strong>✦ Oportunidade</strong>Investigue categorias com maior variação.</div>
                    </div>
                    <p className="aviso-demo">Valores e gráficos fictícios, apenas para apresentação.</p>
                  </div>
                </div>
              </div>
            </div>
            <div id="recursos" className="recursos-hero">
              {recursos.map((recurso) => (
                <article className="recurso-hero" key={recurso.titulo}>
                  <span className="icone" aria-hidden="true">{recurso.icone}</span>
                  <h3>{recurso.titulo}</h3>
                  <p>{recurso.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="secao">
          <h2 className="titulo-secao">Muito mais do que números</h2>
          <p className="subtitulo-secao">O PREVANZIA transforma informações financeiras em apoio à decisão. Não é necessário abandonar o sistema que sua empresa já utiliza.</p>
          <div className="cartoes">
            <article className="cartao"><h3>📁 Importe dados financeiros</h3><p>Utilize arquivos financeiros para alimentar as análises e manter o foco na sua empresa.</p></article>
            <article className="cartao"><h3>📊 Entenda o que mudou</h3><p>Compare receitas, despesas e resultados, investigando variações e pontos de atenção.</p></article>
            <article className="cartao"><h3>💡 Descubra oportunidades</h3><p>Receba informações e sugestões baseadas nos dados disponíveis, com explicações para avaliar.</p></article>
            <article className="cartao"><h3>🎯 Decida e acompanhe</h3><p>Registre decisões e acompanhe os resultados das ações realizadas.</p></article>
          </div>
        </section>

        <section id="planos" className="secao">
          <h2 className="titulo-secao">Escolha seu plano</h2>
          <p className="subtitulo-secao">Planos previstos para o lançamento. O teste gratuito de 7 dias e a contratação ainda estão em preparação.</p>
          <div className="cartoes">
            <article className="cartao">
              <h3>Essencial</h3><div className="preco">R$ 39,90<span>/mês</span></div>
              <p className="plano-item">Até 1 empresa</p><p className="plano-item">Diagnósticos e oportunidades</p><p className="plano-item">Decisões e resultados</p><p className="plano-item">Importação de dados financeiros</p>
              <button type="button" className="botao" onClick={informarPreparacao}>Escolher Essencial</button>
            </article>
            <article className="cartao plano-destaque">
              <h3>Profissional</h3><div className="preco">R$ 69,90<span>/mês</span></div>
              <p className="plano-item">Até 3 empresas</p><p className="plano-item">Diagnósticos e oportunidades</p><p className="plano-item">Decisões e resultados</p><p className="plano-item">Importação de dados financeiros</p>
              <button type="button" className="botao" onClick={informarPreparacao}>Escolher Profissional</button>
            </article>
          </div>
        </section>

        <section id="sobre" className="secao">
          <h2 className="titulo-secao">O PREVANZIA trabalha ao lado do proprietário</h2>
          <p className="sobre">O PREVANZIA não pretende substituir o sistema de gestão da sua empresa. Sua proposta é transformar dados existentes em informações úteis para identificar problemas, compreender causas, recomendar ações e acompanhar resultados.</p>
        </section>
      </main>

     <footer className="rodape">
  <strong>PREVANZIA</strong>
  <p>Antecipe o futuro. Decida com inteligência.</p>

  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 20,
      marginTop: 20,
    }}
  >
    <a href="?pagina=site&documento=privacidade" style={{ color: '#8ddfff' }}>
      Política de Privacidade
    </a>

    <a href="?pagina=site&documento=termos" style={{ color: '#8ddfff' }}>
      Termos de Uso
    </a>

    <a href="?pagina=site&documento=assinaturas" style={{ color: '#8ddfff' }}>
      Assinaturas e Cancelamento
    </a>
  </div>

  <p>Contato: contato.prevanzia@gmail.com</p>
</footer>

      {mostrarAviso && (
        <div className="modal-fundo" role="dialog" aria-modal="true" aria-label="Aviso de disponibilidade">
          <div className="modal">
            <h2>Estamos preparando essa novidade!</h2>
            <p>O período gratuito e as assinaturas do PREVANZIA estarão disponíveis após a conclusão da integração de pagamentos.</p>
            <button type="button" className="botao" onClick={() => setMostrarAviso(false)}>Entendi</button>
          </div>
        </div>
      )}
    </div>
  );
}
