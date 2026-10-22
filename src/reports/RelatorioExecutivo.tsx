
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
            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #214b58;
              background: #fff;
              margin: 0;
              font-size: 11pt;
              line-height: 1.45;
            }

            #relatorio-executivo {
              max-width: none;
              padding: 0;
              margin: 0;
            }

            h2 {
              font-size: 20pt;
              line-height: 1.2;
              margin: 0 0 5mm;
              color: #173f4b;
            }

            h2 + p {
              font-size: 10pt;
              color: #57747b;
              margin-bottom: 9mm;
            }

            h3 {
              font-size: 12pt;
              margin: 6mm 0 3mm;
              padding-bottom: 2mm;
              border-bottom: 1px solid #dce9e4;
              color: #173f4b;
              break-after: avoid;
              page-break-after: avoid;
            }

            p {
              font-size: 10.5pt;
              line-height: 1.45;
              margin: 2.5mm 0;
              overflow-wrap: anywhere;
              white-space: normal;
              orphans: 2;
              widows: 2;
            }

            .empresa-relatorio {
              font-weight: bold;
            }

            .resumo-financeiro {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 4mm;
              margin: 4mm 0 6mm;
            }

            .indicador {
              border: 1px solid #dce9e4;
              border-radius: 5px;
              padding: 4mm;
              break-inside: avoid;
            }

            .indicador span {
              display: block;
              font-size: 9pt;
              color: #57747b;
              margin-bottom: 2mm;
            }

            .indicador strong {
              font-size: 13pt;
              color: #173f4b;
            }

            .item-relatorio {
              margin: 3mm 0;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            button {
              display: none !important;
            }

            @page {
              size: A4;
              margin: 15mm;
            }

            @media print {
              html, body {
                margin: 0;
                padding: 0;
              }

              h2, h3 {
                break-after: avoid;
              }

              .item-relatorio,
              .indicador {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>${conteudo.innerHTML}</body>
      </html>
    `);

    janela.document.close();
    janela.focus();

    janela.addEventListener('load', () => {
      janela.print();
    });
  };

  const renderizarItens = (
    itens: string[],
    mensagemVazia: string
  ) =>
    itens.length ? (
      itens.map((item, i) => (
        <p className="item-relatorio" key={i}>
          {item}
        </p>
      ))
    ) : (
      <p>{mensagemVazia}</p>
    );

  return (
    <section id="relatorio-executivo">
      <h2>Relatório Executivo — PREVANZIA</h2>
      <p>Antecipe o futuro. Decida com inteligência.</p>

      <h3 className="empresa-relatorio">
        Empresa: {empresa}
      </h3>
      <p>Período: {periodo}</p>

      <h3>Resumo financeiro</h3>
      <div className="resumo-financeiro">
        <div className="indicador">
          <span>Receitas</span>
          <strong>{moeda(receitas)}</strong>
        </div>
        <div className="indicador">
          <span>Despesas</span>
          <strong>{moeda(despesas)}</strong>
        </div>
        <div className="indicador">
          <span>Resultado</span>
          <strong>{moeda(receitas - despesas)}</strong>
        </div>
      </div>

      <h3>Alertas</h3>
      {renderizarItens(alertas, 'Nenhum alerta disponível.')}

      <h3>Oportunidades</h3>
      {renderizarItens(
        oportunidades,
        'Nenhuma oportunidade disponível.'
      )}

      <h3>Decisões</h3>
      {renderizarItens(
        decisoes,
        'Nenhuma decisão registrada.'
      )}

      <button type="button" onClick={gerarPDF}>
        Gerar PDF Executivo
      </button>
    </section>
  );
}
