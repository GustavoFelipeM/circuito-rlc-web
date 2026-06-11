declare var Chart: any;

// Gerenciamento de estado global da página
let meuGrafico: any = null;
let dadosGlobais: Circuito[] = [];

// Molde para garantir a estrutura correta dos pontos gerados
interface Circuito {
    tempo: number;
    carga: number;
    corrente: number;
    tensao: number;
}

// Resolução da Equação Diferencial do circuito RLC usando o RK4
function simularCircuito(
    R: number, 
    L: number, 
    C: number, 
    tipoFonte: 'AC' | 'DC', 
    A: number, 
    f_fonte: number, 
    B: number,
    V_dc: number
) {
    let pontos: Circuito[] = []; 

    // Frequência natural e atenuação para descobrir a velocidade de resposta do circuito
    const omega_0 = 1 / Math.sqrt(L * C);
    const alpha = R / (2 * L);

    // Ajusta a janela de tempo final (t_F) de forma dinâmica
    let tempoTotal = 50 / Math.max(alpha, omega_0, 0.1);
    tempoTotal = Math.max(0.0001, Math.min(tempoTotal, 5));

    let t: number = 0; // t_I (tempo inicial)
    let q: number = 0; // carga inicial
    let i: number = 0; // corrente inicial

    let dt_base: number = tempoTotal / 10000;
    let dt = dt_base;

    const dqdt = (corrente: number) => corrente;
    
    // A variação da corrente (di/dt) modelada pelas Leis de Kirchhoff
    const didt = (carga: number, corrente: number, tempo: number) => {
        let V_t = 0;
        
        if (tipoFonte === 'DC') {
            V_t = V_dc; // Fonte Contínua
        } else {
            // Transforma a Frequência em Hz (f) para Frequência Angular (w = 2 * PI * f)
            let omega = 2 * Math.PI * f_fonte;
            V_t = A * Math.sin(omega * tempo) + B; // Fonte Alternada
        }
        
        return (V_t - (R * corrente) - (carga / C)) / L;
    };

    while (t <= tempoTotal) {
        let v_cap = q / C;

        pontos.push({
            tempo: t,
            carga: q,
            corrente: i,
            tensao: v_cap
        });

        if (t >= tempoTotal) {
            break;
        }

        // Se o próximo passo (t + dt) ultrapassar o limite final estabelecido (tempoTotal),
        // o delta_t é reduzido dinamicamente para fechar o cálculo exatamente na borda final.
        if (t + dt > tempoTotal) {
            dt = tempoTotal - t;
        }

        if (dt <= 0) break;

        // ALGORITMO RUNGE-KUTTA DE 4ª ORDEM (RK4) //
        let k1_q = dqdt(i);
        let k1_i = didt(q, i, t);

        let k2_q = dqdt(i + 0.5 * dt * k1_i);
        let k2_i = didt(q + 0.5 * dt * k1_q, i + 0.5 * dt * k1_i, t + 0.5 * dt);

        let k3_q = dqdt(i + 0.5 * dt * k2_i);
        let k3_i = didt(q + 0.5 * dt * k2_q, i + 0.5 * dt * k2_i, t + 0.5 * dt);

        let k4_q = dqdt(i + dt * k3_i);
        let k4_i = didt(q + dt * k3_q, i + dt * k3_i, t + dt);

        // Atualização dos estados por média ponderada
        q = q + (dt / 6) * (k1_q + 2 * k2_q + 2 * k3_q + k4_q);
        i = i + (dt / 6) * (k1_i + 2 * k2_i + 2 * k3_i + k4_i);
        
        // Avança o tempo usando o passo computado
        t = t + dt;
    }

    return pontos;
}

// Função auxiliar que converte valores baseados nos multiplicadores das unidades do HTML
function obterValorComUnidade(idInput: string, idSelect: string): number {
    const valorInput = document.getElementById(idInput) as HTMLInputElement;
    const selectUnidade = document.getElementById(idSelect) as HTMLSelectElement;
    
    if (!valorInput || !selectUnidade) return 0;
    
    const valor = parseFloat(valorInput.value) || 0;
    const multiplicador = parseFloat(selectUnidade.value) || 1;
    return valor * multiplicador;
}

// Calcula e exibe os dados analíticos teóricos no Dashboard superior
function atualizarDashboard(R: number, L: number, C: number) {
    const alpha = R / (2 * L);
    const omega_0 = 1 / Math.sqrt(L * C);
    const f_0 = omega_0 / (2 * Math.PI);

    let tipoAmortecimento = "";
    const outTipo = document.getElementById('out-tipo');
    
    if (outTipo) {
        if (Math.abs(alpha - omega_0) < 0.001 * omega_0) {
            tipoAmortecimento = "Crítico";
            outTipo.style.color = "#d39e00";
        } else if (alpha > omega_0) {
            tipoAmortecimento = "Superamortecido";
            outTipo.style.color = "#dc3545";
        } else {
            tipoAmortecimento = "Subamortecido";
            outTipo.style.color = "#28a745";
        }
        outTipo.innerText = tipoAmortecimento;
    }

    const setTexto = (id: string, valor: number) => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = valor > 10000 ? valor.toExponential(2) : valor.toFixed(2);
        }
    };

    setTexto('out-alpha', alpha);
    setTexto('out-omega', omega_0);
    setTexto('out-f0', f_0);
}

function executarSimulacao() {
    const R = obterValorComUnidade('resistencia', 'unidade-resistencia');
    const L = obterValorComUnidade('indutancia', 'unidade-indutancia');
    const C = obterValorComUnidade('capacitancia', 'unidade-capacitancia');

    // Mapeia o estado do Toggle Switch do HTML para definir a fonte ativa
    const switchFonte = document.getElementById('switch-fonte') as HTMLInputElement | null;
    const tipoFonte = switchFonte && switchFonte.checked ? 'AC' : 'DC';

    let A = 0;
    let f_fonte = 0;
    let B = 0;
    let V_dc = 0;

    // Captura os dados de acordo com o painel que está ativo no momento
    if (tipoFonte === 'AC') {
        A = obterValorComUnidade('amplitude_a', 'unidade-amplitude');
        f_fonte = obterValorComUnidade('freq_fonte', 'unidade-frequencia');
        B = obterValorComUnidade('offset_b', 'unidade-offset');
    } else {
        V_dc = obterValorComUnidade('tensao_dc', 'unidade-tensao-dc');
    }

    atualizarDashboard(R, L, C);

    // Dispara o motor de cálculo numérico
    const dados = simularCircuito(R, L, C, tipoFonte, A, f_fonte, B, V_dc);
    dadosGlobais = dados; 

    // Prepara os vetores lineares mapeados para injeção no Chart.js
    const listaTempos = dados.map(ponto => ponto.tempo);
    const listaTensoes = dados.map(ponto => ponto.tensao);
    const listaCorrentes = dados.map(ponto => ponto.corrente);

    const canvas = document.getElementById('graficoRLC') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (meuGrafico) {
        meuGrafico.destroy();
    }

    meuGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: listaTempos.map(t => t.toFixed(5)),
            datasets: [
                {
                    label: 'Tensão no Capacitor (V)',
                    data: listaTensoes,
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1.5,
                    pointRadius: 0, 
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

function exportarCSV() {
    if (dadosGlobais.length === 0) {
        alert("Por favor, clique em 'Simular Circuito' primeiro");
        return;
    }

    let conteudoCSV = "Tempo (s), Carga (C), Corrente (A), Tensao (V)\n";
    dadosGlobais.forEach(ponto => {
        conteudoCSV += `${ponto.tempo}, ${ponto.carga}, ${ponto.corrente}, ${ponto.tensao}\n`;
    });

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

// Controla a alternância visual suave entre os painéis DC e AC baseada no Switch
function gerenciarAlternanciaDeFonte() {
    const switchFonte = document.getElementById('switch-fonte') as HTMLInputElement | null;
    const painelDC = document.getElementById('painel-dc') as HTMLElement | null;
    const painelAC = document.getElementById('painel-ac') as HTMLElement | null;
    
    if (switchFonte && painelDC && painelAC) {
        switchFonte.addEventListener('change', () => {
            if (switchFonte.checked) {
                painelAC.style.display = 'block';
                painelDC.style.display = 'none';
            } else {
                painelAC.style.display = 'none';
                painelDC.style.display = 'block';
            }
            executarSimulacao();
        });
    }
}

// Vinculação dos eventos de botões e ciclo de vida da página
document.getElementById('btnCalcular')?.addEventListener('click', executarSimulacao);
document.getElementById('btnExportar')?.addEventListener('click', exportarCSV);

// Executa os scripts e uma simulação prévia assim que o DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
    gerenciarAlternanciaDeFonte();
    executarSimulacao();
});

export {};