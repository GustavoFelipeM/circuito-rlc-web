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

// Resolução da Equação Diferencial do circuito RLC usando o RK4
function simularCircuito(R: number, L: number, C: number, A: number, omega_fonte: number, B: number) {
    let pontos: Circuito[] = []; 

    const totalPontos: number = 10000;

    // Frequência e atenuação para descobrir a velocidade do circuito
    const omega_0 = 1 / Math.sqrt(L * C);
    const alpha = R / (2 * L);

    // Ajusta a janela de tempo com base na velocidade do circuito.
    let tempoTotal = 50 / Math.max(alpha, omega_0, 0.1);

    // Limite de segurança entre 0.1 milissegundos e 5 segundos
    tempoTotal = Math.max(0.0001, Math.min(tempoTotal, 5));

    let t: number = 0; // tempo inicial
    let q: number = 0; // carga inicial
    let i: number = 0; // corrente inicial

    const dt: number = tempoTotal / totalPontos;

    const dqdt = (corrente: number) => corrente;
    
    // A variação da corrente (di/dt) vem da Lei de Kirchhoff das Malhas
    const didt = (carga: number, corrente: number, tempo: number) => {
        let V_t = A * Math.sin(omega_fonte * tempo) + B;
        return (V_t - (R * corrente) - (carga / C)) / L;
    };

    for (let k = 0; k < totalPontos; k++) {
        let v_cap = q / C;

        pontos.push({
            tempo: t,
            carga: q,
            corrente: i,
            tensao: v_cap
        });

        // ALGORITMO RK4 //

        // k1: inclinação no início do intervalo
        let k1_q = dqdt(i);
        let k1_i = didt(q, i, t);

        // k2: inclinação no ponto médio (usando a previsão de k1)
        let k2_q = dqdt(i + 0.5 * dt * k1_i);
        let k2_i = didt(q + 0.5 * dt * k1_q, i + 0.5 * dt * k1_i, t + 0.5 * dt);

        // k3: inclinação no ponto médio (usando a previsão refinada de k2)
        let k3_q = dqdt(i + 0.5 * dt * k2_i);
        let k3_i = didt(q + 0.5 * dt * k2_q, i + 0.5 * dt * k2_i, t + 0.5 * dt);

        // k4: inclinação no final do intervalo (usando k3)
        let k4_q = dqdt(i + dt * k3_i);
        let k4_i = didt(q + dt * k3_q, i + dt * k3_i, t + dt);

        // Atualização das variáveis pela média ponderada das inclinações de Runge-Kutta
        q = q + (dt / 6) * (k1_q + 2 * k2_q + 2 * k3_q + k4_q);
        i = i + (dt / 6) * (k1_i + 2 * k2_i + 2 * k3_i + k4_i);
        
        // Avança o tempo
        t = t + dt;
    }

    return pontos;
}

// Função que converte valores para unidades padrões
function obterValorComUnidade(idInput: string, idSelect: string): number {
    const valor = parseFloat((document.getElementById(idInput) as HTMLInputElement).value);
    const multiplicador = parseFloat((document.getElementById(idSelect) as HTMLInputElement).value);
    return valor * multiplicador;
}

// Calcula e exibe os dados teóricos no Dashboard
function atualizarDashboard(R: number, L: number, C: number) {
    // Fórmulas teóricas do circuito RLC série
    const alpha = R / (2 * L);
    const omega_0 = 1 / Math.sqrt(L * C);
    const f_0 = omega_0 / (2 * Math.PI);

    let tipoAmortecimento = "";
    
    // Usamos uma pequena margem de tolerância para o criticamente amortecido devido a imprecisões de ponto flutuante
    if (Math.abs(alpha - omega_0) < 0.001 * omega_0) {
        tipoAmortecimento = "Crítico";
        document.getElementById('out-tipo')!.style.color = "#d39e00";
    } else if (alpha > omega_0) {
        tipoAmortecimento = "Superamortecido";
        document.getElementById('out-tipo')!.style.color = "#dc3545";
    } else {
        tipoAmortecimento = "Subamortecido";
        document.getElementById('out-tipo')!.style.color = "#28a745";
    }

    // Atualiza o DOM formatando para 2 casas decimais ou notação exponencial se muito grande
    document.getElementById('out-tipo')!.innerText = tipoAmortecimento;
    document.getElementById('out-alpha')!.innerText = alpha > 10000 ? alpha.toExponential(2) : alpha.toFixed(2);
    document.getElementById('out-omega')!.innerText = omega_0 > 10000 ? omega_0.toExponential(2) : omega_0.toFixed(2);
    document.getElementById('out-f0')!.innerText = f_0 > 10000 ? f_0.toExponential(2) : f_0.toFixed(2);
}

function executarSimulacao() {
    const R = obterValorComUnidade('resistencia', 'unidade-resistencia');
    const L = obterValorComUnidade('indutancia', 'unidade-indutancia');
    const C = obterValorComUnidade('capacitancia', 'unidade-capacitancia');
    const A = obterValorComUnidade('amplitude_a', 'unidade-amplitude'); 
    const omega_fonte = obterValorComUnidade('omega_fonte', 'unidade-omega'); 
    const B = obterValorComUnidade('offset_b', 'unidade-offset');

    atualizarDashboard(R, L, C);

    const dados = simularCircuito(R, L, C, A, omega_fonte, B);
    dadosGlobais = dados; // Salva no escopo global para permitir a exportação do CSV

    console.log(dados);

    // Separação dos dados em arrays unidimensionais exigidos pelo Chart.js
    const listaTempos = dados.map(ponto => ponto.tempo);
    const listaTensoes = dados.map(ponto => ponto.tensao);
    const listaCorrentes = dados.map(ponto => ponto.corrente);

    const ctx = (document.getElementById('graficoRLC') as HTMLCanvasElement).getContext('2d');

    // Evita sobreposição de gráficos ao renderizar novas simulações
    if (meuGrafico) {
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
function exportarCSV() {
    if (dadosGlobais.length === 0) {
        alert("Por favor, clique em 'Simular Circuito' primeiro");
        return;
    }

    let conteudoCSV = "Tempo (s), carga (C), Corrente (A), Tensao (V)\n";

    dadosGlobais.forEach(ponto => {
        conteudoCSV += `${ponto.tempo}, ${ponto.carga}, ${ponto.corrente}, ${ponto.tensao}\n`;
    });

    // Criação do objeto binário (Blob) para simular o download do arquivo local
    const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "simulacao_rlc.csv");
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Inicialização do controle do acordeão com checagem de tipos estritos do TypeScript
function gerenciarAcordeonFonte() {
    const botaoFonte = document.getElementById('btnAlternarFonte') as HTMLElement | null;
    const conteudoFonte = document.getElementById('conteudoFonte') as HTMLElement | null;
    const setaFonte = document.getElementById('seta-accordion') as HTMLElement | null;
    
    if (botaoFonte && conteudoFonte && setaFonte) {
        botaoFonte.addEventListener('click', () => {
            if (conteudoFonte.style.display === 'none' || conteudoFonte.style.display === '') {
                conteudoFonte.style.display = 'block';
                setaFonte.style.transform = 'rotate(180deg)';
                botaoFonte.style.backgroundColor = '#dee2e6';
            } else {
                conteudoFonte.style.display = 'none';
                setaFonte.style.transform = 'rotate(0deg)';
                botaoFonte.style.backgroundColor = '#e9ecef';
            }
        });
    }
}

// Vinculação dos eventos de botões e ciclo de vida da página
document.getElementById('btnCalcular')?.addEventListener('click', executarSimulacao);
document.getElementById('btnExportar')?.addEventListener('click', exportarCSV);

// Executa os scripts e uma simulação prévia assim que o DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
    gerenciarAcordeonFonte();
    executarSimulacao();
});

export {};