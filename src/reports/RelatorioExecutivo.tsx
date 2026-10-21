
type RelatorioExecutivoProps = {
  empresa: string;
  periodo: string;
  receitas: number;
  despesas: number;
  alertas: string[];
  oportunidades: string[];
  decisoes: string[];
};

export default function RelatorioExecutivo({
  empresa,
  periodo,
  receitas,
  despesas,
  alertas,
  oportunidades,
  decisoes,
}: RelatorioExecutivoProps) {
  const moeda = (valor: number) =>
    valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const gerarPDF = () => {
    const conteudo = document.getElementById('relatorio-executivo');

    if (!conteudo) {
      alert('Não foi possível localizar o relatório.');
      return;
    }

    const janela = window.open('', '_blank');

    if (!janela) {
      alert('Permita a abertura de janelas para gerar o PDF.');
      return;
    }

    janela.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Relatório Executivo - PREVANZIA</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              color: #214b58;
              line-height: 1.6;
            }
            h2, h3 { color: #214b58; }
            h3 {
              margin-top: 28px;
              border-bottom: 1px solid #dce9e4;
              padding-bottom: 8px;
            }
            button { display: none; }
            @page { size: A4; margin: 15mm; }
          </style>
        </head>
        <body>${conteudo.innerHTML}</body>
      </html>
    `);

    janela.document.close();
    janela.focus();
    janela.print();
  };
  return (
      <section id="relatorio-executivo">
      <h2>Relatório Executivo — PREVANZIA</h2>
      <p>Antecipe o futuro. Decida com inteligência.</p>

      <h3>Empresa: {empresa}</h3>
      <p>Período: {periodo}</p>

      <h3>Resumo financeiro</h3>
      <p>Receitas: {moeda(receitas)}</p>
      <p>Despesas: {moeda(despesas)}</p>
      <p>Resultado: {moeda(receitas - despesas)}</p>

      <h3>Alertas</h3>
      {alertas.length
        ? alertas.map((item, i) => <p key={i}>{item}</p>)
        : <p>Nenhum alerta disponível.</p>}

      <h3>Oportunidades</h3>
      {oportunidades.length
        ? oportunidades.map((item, i) => <p key={i}>{item}</p>)
        : <p>Nenhuma oportunidade disponível.</p>}

      <h3>Decisões</h3>
      {decisoes.length
        ? decisoes.map((item, i) => <p key={i}>{item}</p>)
        : <p>Nenhuma decisão registrada.</p>}

      <button type="button" onClick={gerarPDF}>
        Gerar PDF Executivo
      </button>
    </section>
  );
}
