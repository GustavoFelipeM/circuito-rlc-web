declare var Chart: any;

// Gerenciamento de estado global da página
let meuGrafico: any = null;
let dadosGlobais: Circuito[] = [];

// Molde para garantir a estrutura correta dos 10.000 pontos
interface Circuito {
    tempo: number;
    carga: number;
    corrente: number;
    tensao: number;
}

// Resolução da Equação Diferencial do circuito RLC usando o Método de Euler
function simularCircuito(R: number, L: number, C: number, V_in: number){
    let pontos: Circuito[] = []; 

    const totalPontos: number = 10000;
    let t: number = 0; // tempo inicial
    let q: number = 0; // carga inicial
    let i: number = 0; // corrente inicial

    // Janela de tempo de 0.5s dividida pelo total de amostras
    const dt: number = 0.5 / totalPontos;

    for (let k = 0; k <totalPontos; k++){
        let v_cap = q / C;

        pontos.push({
            tempo: t,
            carga: q,
            corrente: i,
            tensao: v_cap
        });

        // Isolação do termo di/dt da equação diferencial do RLC em série
        let didt = (V_in - (R * i) - v_cap) / L;

        // Atualização das variáveis pelo passo de tempo (Aproximação de Euler)
        q = q + (i * dt);
        i = i + (didt * dt);
        t = t + dt;
    }

    return pontos;
}

function executarSimulacao(){
    const R = parseFloat((document.getElementById('resistencia') as HTMLInputElement).value);
    const L = parseFloat((document.getElementById('indutancia') as HTMLInputElement).value);
    const C = parseFloat((document.getElementById('capacitancia') as HTMLInputElement).value);
    const V_in = parseFloat((document.getElementById('tensao') as HTMLInputElement).value);

    const dados = simularCircuito(R, L, C, V_in);
    dadosGlobais = dados; // Salva no escopo global para permitir a exportação do CSV

    console.log(dados);

    // Separação dos dados em arrays unidimensionais exigidos pelo Chart.js
    const listaTempos = dados.map(ponto => ponto.tempo);
    const listaTensoes = dados.map(ponto => ponto.tensao);
    const listaCorrentes =dados.map(ponto => ponto.corrente);

    const ctx = (document.getElementById('graficoRLC') as HTMLCanvasElement).getContext('2d');

    // Evita sobreposição de gráficos ao renderizar novas simulações
    if (meuGrafico){
        meuGrafico.destroy();
    }

    meuGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: listaTempos.map(t => t.toFixed(4)),
            datasets: [
                {
                    label: 'Tensão no Capacitor (V)',
                    data: listaTensoes,
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1.5,
                    pointRadius: 0, // Desativa os pontos individuais para não travar a renderização de 10k itens
                    yAxisID: 'y'
                },
                {
                    label: 'Corrente no Circuito (A)',
                    data: listaCorrentes,
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Tensão (V)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Corrente (A)' },
                    grid: { drawOnChartArea: false }
                },
                x: {
                    title: { display: true, text: 'Tempo (s)' }
                }
            }
        }
    });
}

// Formata a tabela de dados e dispara o download do arquivo de texto formatado
function exportarCSV (){
    if (dadosGlobais.length === 0){
        alert("Por favor, clique em 'Simular Circuito' primeiro")
        return;
    }

    let conteudoCSV = "Tempo (s), carga (C), Corrente (A), Tensao (V)\n"

    dadosGlobais.forEach(ponto => {
        conteudoCSV += `${ponto.tempo}, ${ponto.carga}, ${ponto.corrente}, ${ponto.tensao}\n`;
    })

    // Criação do objeto binário (Blob) para simular o download do arquivo local
    const blob = new Blob([conteudoCSV], {type: 'text/csv;charset=utf8;' })
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "simulacao_rlc.csv");
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Vinculação dos eventos de botões e ciclo de vida da página
document.getElementById('btnCalcular')?.addEventListener('click', executarSimulacao)
document.getElementById('btnExportar')?.addEventListener('click', exportarCSV)

// Executa uma simulação prévia assim que o DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
    executarSimulacao();
});

export {}