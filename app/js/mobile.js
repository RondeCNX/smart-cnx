// app/js/mobile.js
(async function initAppMobile() {

    // ================= BLOQUEIO DO GERENCIADOR DE SENHAS (GOOGLE/CHROME) =================
    function bloquearGerenciadorSenhasMobile() {
        const campos = document.querySelectorAll('input, textarea');

        campos.forEach((el, idx) => {
            if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'file') return;

            el.setAttribute('data-lpignore', 'true');
            el.setAttribute('data-1p-ignore', 'true');
            el.setAttribute('data-form-type', 'other');
            el.setAttribute('spellcheck', 'false');
            el.setAttribute('autocorrect', 'off');

            if (el.type === 'password') {
                // Impede o Chrome de associar os campos de "Alterar Senha" a um login
                el.setAttribute('autocomplete', 'new-password');
                el.setAttribute('name', `cnx_pass_${idx}_${Date.now()}`);

                // Mantém readonly enquanto não está em foco para o navegador ignorar o campo oculto
                el.readOnly = true;
                el.addEventListener('focus', () => { el.readOnly = false; });
                el.addEventListener('blur', () => { el.readOnly = true; });
            } else {
                // "one-time-code" ou valor aleatório força o Chrome a não sugerir nem salvar senha
                el.setAttribute('autocomplete', 'off');
                el.setAttribute('name', `cnx_field_${idx}_${Date.now()}`);
            }
        });
    }

    bloquearGerenciadorSenhasMobile();

    if (window.lucide) lucide.createIcons();


    // Converte automaticamente para CAIXA ALTA enquanto digita (exceto campos de senha)
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el) return;
        if (el.id === 'm-nova-senha' || el.id === 'm-confirma-senha') return;
        const isTexto = (el.tagName === 'TEXTAREA') || (el.tagName === 'INPUT' && el.type === 'text');
        if (!isTexto) return;

        const pos = el.selectionStart;
        const upper = el.value.toUpperCase();
        if (el.value !== upper) {
            el.value = upper;
            if (typeof pos === 'number') el.setSelectionRange(pos, pos);
        }
    });

    let permissoesMobile = { acessar: false, coleta_mac: false, requisicoes: false };
    let usuario = null;
    let isAdmin = false;
    let almoxarifadosPermitidos = [];
    let todosAlmoxarifados = [];
    let almoxMap = {};
    let produtosCache = [];
    let requisicoesCache = [];

    // Estado de Navegação e Pilha de Modais (History API)
    let viewAtual = 'home';
    let pilhaModais = [];
    let reqFormSujo = false;
    let popupAberto = false;

    // Estado do Modal Seletor (Tabela de Busca)
    let seletorListaAtual = [];
    let seletorCallback = null;

    // Estado Coleta MAC
    let html5QrCode = null;
    let scannerAtivo = false;
    let confAlmoxId = null;
    let confAlmoxNome = '';
    let confTipo = 'Estoque';
    let modeloSelecionado = null;
    let etapaScan = 'MAC';
    let macTemp = '';
    let loteMac = [];
    let bloqueioLeitura = false;

    // Estado Requisição Form
    let reqFormItens = [];
    let reqFormItensOriginais = [];


    //
    function temPermissaoMobile(chave) {
        if (isAdmin) return true;
        return Boolean(permissoesMobile?.[chave]);
    }

    function aplicarPermissoesInterfaceMobile() {
        const podeColeta = temPermissaoMobile('coleta_mac');
        const podeReq = temPermissaoMobile('requisicoes');

        document.querySelectorAll('#btn-menu-coleta, #btn-fab-coleta, [data-acao="coleta"], [data-view="coleta"]').forEach(el => {
            if (el.id === 'view-coleta') return;
            el.style.display = podeColeta ? '' : 'none';
        });

        document.querySelectorAll('#btn-menu-req, #btn-fab-nova-req, #btn-nova-req-mobile, [data-acao="requisicoes"], [data-view="requisicoes"]').forEach(el => {
            if (el.id === 'view-requisicoes') return;
            el.style.display = podeReq ? '' : 'none';
        });

        const fab = document.getElementById('btn-fab-acoes');
        if (fab && !podeColeta && !podeReq) {
            fab.style.display = 'none';
        }
    }

    // ================= POP-UPS PERSONALIZADOS =================
    function mAlert(titulo, msg) {
        return new Promise((resolve) => {
            popupAberto = true;
            const modal = document.getElementById('m-popup');
            document.getElementById('m-popup-title').innerText = titulo;
            document.getElementById('m-popup-msg').innerHTML = msg;
            document.getElementById('m-popup-cancel').style.display = 'none';
            const btnOk = document.getElementById('m-popup-ok');
            btnOk.innerText = 'OK';
            modal.classList.add('show');
            btnOk.onclick = () => {
                modal.classList.remove('show');
                popupAberto = false;
                resolve(true);
            };
        });
    }

    function mConfirm(titulo, msg, txtOk = 'Confirmar') {
        return new Promise((resolve) => {
            popupAberto = true;
            const modal = document.getElementById('m-popup');
            document.getElementById('m-popup-title').innerText = titulo;
            document.getElementById('m-popup-msg').innerHTML = msg;
            const btnCancel = document.getElementById('m-popup-cancel');
            const btnOk = document.getElementById('m-popup-ok');
            btnCancel.style.display = 'flex';
            btnOk.innerText = txtOk;
            modal.classList.add('show');
            btnOk.onclick = () => {
                modal.classList.remove('show');
                popupAberto = false;
                resolve(true);
            };
            btnCancel.onclick = () => {
                modal.classList.remove('show');
                popupAberto = false;
                resolve(false);
            };
        });
    }

    let toastTimer = null;

    function mostrarToast(msg, tipo = 'success', duracao = 1800) {
        const el = document.getElementById('m-toast');
        if (!el) return;
        el.innerText = msg;
        el.className = `m-toast ${tipo} show`;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove('show');
        }, duracao);
    }

    let audioCtx = null;
    function desbloquearAudio() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            if (!audioCtx) audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            // Pulso silencioso para liberar a saída de áudio no Android/iOS
            const buffer = audioCtx.createBuffer(1, 1, 22050);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
        } catch {}
    }
    document.addEventListener('touchstart', desbloquearAudio, { once: true, passive: true });
    document.addEventListener('click', desbloquearAudio, { once: true });

    function tocarBipConfirmacao(tipo = 'mac') {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            if (!audioCtx) audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const tocarNota = (freq, inicio, duracao) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, inicio);

                gain.gain.setValueAtTime(0.001, inicio);
                gain.gain.exponentialRampToValueAtTime(0.5, inicio + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(inicio);
                osc.stop(inicio + duracao + 0.02);
            };

            const agora = audioCtx.currentTime;
            if (tipo === 'serial') {
                // Bip duplo agudo ao concluir o equipamento (MAC + Série)
                tocarNota(1050, agora, 0.11);
                tocarNota(1400, agora + 0.13, 0.16);
            } else {
                // Bip simples ao ler o MAC
                tocarNota(950, agora, 0.13);
            }
        } catch (err) {
            console.warn('Áudio indisponível:', err);
        }
    }

    function focarAreaCamera() {
        const cardScanner = document.getElementById('coleta-passo-scanner');
        if (!cardScanner) return;
        setTimeout(() => {
            cardScanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    }

    // ================= CONTROLE DE MODAIS E BOTÃO VOLTAR (HISTORY API) =================
    window.history.replaceState({ app: 'smart-cnx', view: 'home' }, '');
    window.history.pushState({ app: 'smart-cnx', view: 'home', guard: true }, '');

    function abrirModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('show');
        if (!pilhaModais.includes(id)) pilhaModais.push(id);
        window.history.pushState({ app: 'smart-cnx', modal: id }, '');
        if (window.lucide) lucide.createIcons();
    }

    function fecharModalSilencioso(id) {
        document.getElementById(id)?.classList.remove('show');
        pilhaModais = pilhaModais.filter(m => m !== id);
    }

    async function tentarFecharModal(id) {
        if (id === 'modal-req-form' && reqFormSujo) {
            const conf = await mConfirm('Descartar Alterações', 'Existem dados não salvos nesta requisição. Deseja sair mesmo assim?', 'Sair');
            if (!conf) return false;
            reqFormSujo = false;
        }
        fecharModalSilencioso(id);
        return true;
    }

    let voltarEmAndamento = false;

    function coletaTemDadosPreenchidos() {
        const almox = document.getElementById('col-almoxarifado')?.value;
        const prod = document.getElementById('col-produto')?.value;
        const manual = document.getElementById('col-input-manual')?.value.trim();
        return Boolean(almox || prod || confAlmoxId || loteMac.length > 0 || macTemp || manual);
    }

    async function limparEstadoColeta() {
        await pararScanner();
        loteMac = [];
        renderizarLote();
        confAlmoxId = null;
        confAlmoxNome = '';
        modeloSelecionado = null;
        macTemp = '';
        setPickerValue('col-almoxarifado', 'lbl-pick-col-almox', '', '', 'Toque para buscar almoxarifado...');
        setPickerValue('col-produto', 'lbl-pick-col-prod', '', '', 'Toque para buscar produto...');
        const inpManual = document.getElementById('col-input-manual');
        if (inpManual) inpManual.value = '';
        const stepAtiva = document.getElementById('coleta-step-ativa');
        const stepSetup = document.getElementById('coleta-step-setup');
        if (stepAtiva) stepAtiva.style.display = 'none';
        if (stepSetup) stepSetup.style.display = 'block';
    }

    function contaTemDadosPreenchidos() {
        const s1 = document.getElementById('m-nova-senha')?.value.trim() || '';
        const s2 = document.getElementById('m-confirma-senha')?.value.trim() || '';
        return Boolean(s1 || s2);
    }

    function limparEstadoConta() {
        const s1 = document.getElementById('m-nova-senha');
        const s2 = document.getElementById('m-confirma-senha');
        if (s1) s1.value = '';
        if (s2) s2.value = '';
    }

    function atualizarRodapePorView(view) {
        const footer = document.querySelector('.m-footer');
        if (!footer) return;
        footer.classList.toggle('compact', view !== 'home');
    }

    async function navegarParaView(novaView, registrarHistorico = true) {
        if (novaView === viewAtual) return true;

        if (novaView === 'coleta' && !temPermissaoMobile('coleta_mac')) {
            await mAlert('Acesso Negado', 'Você não tem permissão para acessar a Coleta de MAC no mobile.');
            return false;
        }
        if (novaView === 'requisicoes' && !temPermissaoMobile('requisicoes')) {
            await mAlert('Acesso Negado', 'Você não tem permissão para acessar Requisições no mobile.');
            return false;
        }

        if (viewAtual === 'coleta' && coletaTemDadosPreenchidos()) {
            const msg = loteMac.length > 0
                ? `Existem <strong>${loteMac.length} equipamento(s)</strong> no lote atual ainda não enviados. Deseja sair e descartar os dados?`
                : 'Existem dados preenchidos nesta coleta. Deseja sair e descartá-los?';
            const conf = await mConfirm('Descartar Coleta', msg, 'Sair');
            if (!conf) return false;
            await limparEstadoColeta();
        } else if (viewAtual === 'coleta') {
            await limparEstadoColeta();
        }

        if (viewAtual === 'conta' && contaTemDadosPreenchidos()) {
            const conf = await mConfirm(
                'Descartar Alterações',
                'Existem alterações de senha não salvas na sua conta. Deseja sair e descartá-las?',
                'Sair'
            );
            if (!conf) return false;
            limparEstadoConta();
        }

        viewAtual = novaView;
        document.querySelectorAll('.m-view').forEach(v => {
            v.classList.toggle('active', v.id === `view-${novaView}`);
        });

        atualizarRodapePorView(novaView);

        if (registrarHistorico && novaView !== 'home') {
            window.history.pushState({ app: 'smart-cnx', view: novaView }, '');
        }

        if (novaView === 'requisicoes') carregarRequisicoesMobile();
        if (window.lucide) lucide.createIcons();
        return true;
    }

    async function acionarVoltar(origemPopstate = false) {
        if (popupAberto || voltarEmAndamento) {
            if (origemPopstate) window.history.pushState({ app: 'smart-cnx', view: viewAtual }, '');
            return;
        }

        voltarEmAndamento = true;
        try {
            // 1. Fecha o modal mais recente no topo da pilha
            if (pilhaModais.length > 0) {
                const topo = pilhaModais[pilhaModais.length - 1];
                const fechou = await tentarFecharModal(topo);
                if (!fechou) window.history.pushState({ app: 'smart-cnx', modal: topo }, '');
                return;
            }

            // 2. Navegação em etapas dentro da Coleta de MAC
            if (viewAtual === 'coleta') {
                const stepAtiva = document.getElementById('coleta-step-ativa');
                const stepSetup = document.getElementById('coleta-step-setup');
                const passoScan = document.getElementById('coleta-passo-scanner');

                // 2a. Da câmera -> valida se há leitura em andamento ou itens já bipados no lote
                if (stepAtiva.style.display !== 'none' && passoScan.style.display !== 'none') {
                    const manual = document.getElementById('col-input-manual')?.value.trim();
                    if (loteMac.length > 0 || macTemp || manual) {
                        const msg = loteMac.length > 0
                            ? `Existem <strong>${loteMac.length} equipamento(s)</strong> no lote atual. Deseja pausar a câmera e voltar para a seleção de modelo?`
                            : 'Existe um código em andamento nesta leitura. Deseja voltar para a seleção de modelo?';
                        const conf = await mConfirm('Sair da Câmera', msg, 'Voltar');
                        if (!conf) {
                            window.history.pushState({ app: 'smart-cnx', view: 'coleta' }, '');
                            return;
                        }
                    }
                    macTemp = '';
                    mostrarPassoModelo();
                    window.history.pushState({ app: 'smart-cnx', view: 'coleta' }, '');
                    return;
                }

                // 2b. Da seleção de modelo -> volta para seleção de almoxarifado
                if (stepAtiva.style.display !== 'none') {
                    const conf = await mConfirm(
                        'Voltar para Almoxarifado',
                        loteMac.length > 0
                            ? `Existem <strong>${loteMac.length} equipamento(s)</strong> no lote atual. Deseja voltar e descartar esta conferência?`
                            : 'Deseja voltar para a seleção de almoxarifado?',
                        'Voltar'
                    );
                    if (!conf) {
                        window.history.pushState({ app: 'smart-cnx', view: 'coleta' }, '');
                        return;
                    }
                    await pararScanner();
                    loteMac = [];
                    renderizarLote();
                    modeloSelecionado = null;
                    macTemp = '';
                    setPickerValue('col-produto', 'lbl-pick-col-prod', '', '', 'Toque para buscar produto...');
                    stepAtiva.style.display = 'none';
                    stepSetup.style.display = 'block';
                    window.history.pushState({ app: 'smart-cnx', view: 'coleta' }, '');
                    return;
                }

                // 2c. Da seleção de almoxarifado -> valida form sujo antes de voltar à Home
                if (coletaTemDadosPreenchidos()) {
                    const conf = await mConfirm(
                        'Descartar Coleta',
                        'Existem dados preenchidos nesta coleta. Deseja sair e descartá-los?',
                        'Sair'
                    );
                    if (!conf) {
                        window.history.pushState({ app: 'smart-cnx', view: 'coleta' }, '');
                        return;
                    }
                }
                await limparEstadoColeta();
                viewAtual = 'home';
                document.querySelectorAll('.m-view').forEach(v => v.classList.toggle('active', v.id === 'view-home'));
                atualizarRodapePorView('home');
                window.history.pushState({ app: 'smart-cnx', view: 'home', guard: true }, '');
                return;
            }

            // 3. Outras telas (incluindo Minha Conta) -> volta para a tela inicial
            if (viewAtual !== 'home') {
                const saiu = await navegarParaView('home', false);
                if (!saiu) {
                    window.history.pushState({ app: 'smart-cnx', view: viewAtual }, '');
                    return;
                }
                window.history.pushState({ app: 'smart-cnx', view: 'home', guard: true }, '');
                return;
            }

            // 4. Mantém no app evitando fechamento acidental
            window.history.pushState({ app: 'smart-cnx', view: 'home', guard: true }, '');
        } finally {
            voltarEmAndamento = false;
        }
    }

    window.addEventListener('popstate', () => acionarVoltar(true));

    // ================= MODAL SELETOR EM TABELA (ALMOXARIFADOS E PRODUTOS) =================
    function setPickerValue(inputId, labelId, valor, texto, placeholder) {
        const inp = document.getElementById(inputId);
        const lbl = document.getElementById(labelId);
        if (inp) inp.value = valor || '';
        if (lbl) {
            if (valor && texto) {
                lbl.innerText = texto;
                lbl.classList.remove('m-picker-placeholder');
            } else {
                lbl.innerText = placeholder;
                lbl.classList.add('m-picker-placeholder');
            }
        }
    }

    function renderizarTabelaSeletor(filtro = '') {
        const tbody = document.getElementById('seletor-tbody');
        if (!tbody) return;

        const termo = filtro.trim().toLowerCase();
        const filtrados = termo
            ? seletorListaAtual.filter(item => `${item.codigo || ''} ${item.descricao || ''}`.toLowerCase().includes(termo))
            : seletorListaAtual;

        if (filtrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:24px; color:#94a3b8;">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        // Limita a 150 linhas visíveis para manter rolagem instantânea no celular
        const exibidos = filtrados.slice(0, 150);
        tbody.innerHTML = exibidos.map(item => `
            <tr data-id="${item.id}">
                <td>${item.codigo || '-'}</td>
                <td>${item.descricao || '-'}</td>
            </tr>
        `).join('');

        tbody.querySelectorAll('tr[data-id]').forEach(tr => {
            tr.addEventListener('click', () => {
                const escolhido = seletorListaAtual.find(i => String(i.id) === String(tr.dataset.id));
                fecharModalSilencioso('modal-seletor');
                if (escolhido && seletorCallback) seletorCallback(escolhido);
            });
        });
    }

    function abrirSeletor(titulo, lista, callback) {
        seletorListaAtual = lista || [];
        seletorCallback = callback;

        document.getElementById('seletor-titulo').innerText = titulo;
        const inputBusca = document.getElementById('seletor-input-busca');
        inputBusca.value = '';
        renderizarTabelaSeletor('');
        abrirModal('modal-seletor');
        setTimeout(() => inputBusca.focus(), 120);
    }

    document.getElementById('seletor-input-busca')?.addEventListener('input', (e) => {
        renderizarTabelaSeletor(e.target.value);
    });

    document.getElementById('btn-fechar-seletor')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-seletor');
    });

    // ================= REGISTRO DE EVENTOS DA INTERFACE =================
    document.getElementById('btn-abrir-sobre')?.addEventListener('click', () => abrirModal('modal-sobre-mobile'));
    document.getElementById('btn-abrir-menu-header')?.addEventListener('click', () => abrirModal('modal-menu-header'));
    document.getElementById('btn-footer-conta')?.addEventListener('click', () => navegarParaView('conta'));
    document.getElementById('btn-fab-acoes')?.addEventListener('click', () => abrirModal('modal-fab-menu'));

    // Menu 3 riscos (cabeçalho)
    document.getElementById('btn-menu-home')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-menu-header');
        navegarParaView('home');
    });
    document.getElementById('btn-menu-coleta')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-menu-header');
        navegarParaView('coleta');
    });
    document.getElementById('btn-menu-req')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-menu-header');
        navegarParaView('requisicoes');
    });
    document.getElementById('btn-menu-conta')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-menu-header');
        navegarParaView('conta');
    });

    // Botões Voltar
    document.getElementById('btn-voltar-coleta')?.addEventListener('click', () => acionarVoltar());
    document.getElementById('btn-voltar-req')?.addEventListener('click', () => acionarVoltar());
    document.getElementById('btn-voltar-conta')?.addEventListener('click', () => acionarVoltar());

    // Botão Redondo (+) -> Atalhos diretos
    document.getElementById('btn-fab-coleta')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-fab-menu');
        navegarParaView('coleta');
    });
    document.getElementById('btn-fab-nova-req')?.addEventListener('click', () => {
        fecharModalSilencioso('modal-fab-menu');
        abrirFormNovaRequisicao();
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => fecharModalSilencioso(btn.dataset.close));
    });

    document.getElementById('btn-fechar-req-form')?.addEventListener('click', () => tentarFecharModal('modal-req-form'));
    document.getElementById('btn-cancelar-req-form')?.addEventListener('click', () => tentarFecharModal('modal-req-form'));
    document.getElementById('req-obs')?.addEventListener('input', () => { reqFormSujo = true; });

    // Abas do Modal de Requisição
    function mudarAbaReqForm(tabName) {
        document.querySelectorAll('[data-req-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.reqTab === tabName);
        });
        document.querySelectorAll('#modal-req-form .m-tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `req-tab-${tabName}`);
        });
    }

    document.querySelectorAll('[data-req-tab]').forEach(btn => {
        btn.addEventListener('click', () => mudarAbaReqForm(btn.dataset.reqTab));
    });

    // Pickers de Coleta de MAC
    document.getElementById('btn-pick-col-almox')?.addEventListener('click', () => {
        abrirSeletor('Selecionar Almoxarifado', almoxarifadosPermitidos, (item) => {
            setPickerValue('col-almoxarifado', 'lbl-pick-col-almox', item.id, `${item.codigo} - ${item.descricao}`, 'Toque para buscar almoxarifado...');
        });
    });

    document.getElementById('btn-pick-col-prod')?.addEventListener('click', () => {
        const somenteProdutos = produtosCache.filter(
            p => String(p.tipo || '').trim().toLowerCase() === 'produto'
        );
        abrirSeletor('Selecionar Modelo / Produto', somenteProdutos, (item) => {
            setPickerValue('col-produto', 'lbl-pick-col-prod', item.id, `${item.codigo} - ${item.descricao}`, 'Toque para buscar produto...');
        });
    });

    // Pickers de Requisição
    document.getElementById('btn-pick-req-sol')?.addEventListener('click', () => {
        const listaSol = (almoxarifadosPermitidos && almoxarifadosPermitidos.length > 0)
            ? almoxarifadosPermitidos
            : todosAlmoxarifados;

        abrirSeletor('Almoxarifado Solicitante', listaSol, (item) => {
            setPickerValue('req-almox-sol', 'lbl-pick-req-sol', item.id, `${item.codigo} - ${item.descricao}`, 'Toque para buscar solicitante...');
            reqFormSujo = true;

            if (item.almoxarifado_abastecedor_id) {
                const abast = todosAlmoxarifados.find(a => a.id === item.almoxarifado_abastecedor_id);
                if (abast) {
                    setPickerValue('req-almox-abast', 'lbl-pick-req-abast', abast.id, `${abast.codigo} - ${abast.descricao}`, 'Toque para buscar abastecedor...');
                }
            }
        });
    });

    document.getElementById('btn-pick-req-abast')?.addEventListener('click', () => {
        abrirSeletor('Almoxarifado Abastecedor', todosAlmoxarifados, (item) => {
            setPickerValue('req-almox-abast', 'lbl-pick-req-abast', item.id, `${item.codigo} - ${item.descricao}`, 'Toque para buscar abastecedor...');
            reqFormSujo = true;
        });
    });

    document.getElementById('btn-pick-req-prod')?.addEventListener('click', () => {
        const somenteConsumo = produtosCache.filter(
            p => String(p.tipo || '').trim().toLowerCase() === 'consumo'
        );
        abrirSeletor('Selecionar Produto (Consumo)', somenteConsumo, (item) => {
            const texto = `${item.codigo} - ${item.descricao}`;
            setPickerValue('req-item-prod', 'lbl-pick-req-prod', item.id, texto, 'Toque para buscar produto...');
            const inpNome = document.getElementById('req-item-prod-nome');
            if (inpNome) inpNome.value = texto;
        });
    });

    // ================= AUTENTICAÇÃO E CARGA INICIAL =================
    async function inicializar() {
        try {
            if (!window.db) throw new Error('Conexão com o banco de dados não inicializada.');

            const { data: { session } } = await window.db.auth.getSession();
            if (!session) {
                window.location.replace('../index.html');
                return;
            }

            const { data: user, error: userErr } = await window.db
                .from('usuarios')
                .select('id, nome_completo, email, avatar_url, acesso_todos_almoxarifados, permissoes, cargos(nome, permissoes)')
                .eq('id', session.user.id)
                .single();

            if (userErr || !user) {
                window.location.replace('../index.html');
                return;
            }

            usuario = user;
            isAdmin = usuario.cargos?.nome?.toUpperCase() === 'ADMINISTRADOR';

            const permsCargoMobile = (usuario.cargos?.permissoes?.mobile && typeof usuario.cargos.permissoes.mobile === 'object')
                ? usuario.cargos.permissoes.mobile
                : {};
            const permsUserMobile = (usuario.permissoes?.mobile && typeof usuario.permissoes.mobile === 'object')
                ? usuario.permissoes.mobile
                : {};

            permissoesMobile = {
                ...permsCargoMobile,
                ...permsUserMobile
            };

            if (!isAdmin && !permissoesMobile.acessar) {
                await mAlert('Acesso Negado', 'Seu usuário não possui permissão para acessar o Aplicativo Mobile.');
                window.location.replace('../index.html');
                return;
            }

            preencherPerfil();
            carregarVersao();
            aplicarPermissoesInterfaceMobile();

            const [resAlmox, resVinc, resProds] = await Promise.all([
                window.db.from('almoxarifados').select('id, codigo, descricao, almoxarifado_abastecedor_id').order('descricao'),
                window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', usuario.id),
                window.db.from('produtos').select('id, codigo, descricao, tipo').order('descricao')
            ]);

            todosAlmoxarifados = resAlmox.data || [];
            produtosCache = resProds.data || [];

            almoxMap = {};
            todosAlmoxarifados.forEach(a => {
                almoxMap[a.id] = `${a.codigo} - ${a.descricao}`;
            });

            if (isAdmin || usuario.acesso_todos_almoxarifados) {
                almoxarifadosPermitidos = [...todosAlmoxarifados];
            } else {
                const idsVinc = (resVinc.data || []).map(v => v.almoxarifado_id);
                almoxarifadosPermitidos = todosAlmoxarifados.filter(a => idsVinc.includes(a.id));
            }

            if (almoxarifadosPermitidos.length === 1) {
                const unico = almoxarifadosPermitidos[0];
                setPickerValue('col-almoxarifado', 'lbl-pick-col-almox', unico.id, `${unico.codigo} - ${unico.descricao}`, 'Toque para buscar almoxarifado...');
            }
        } catch (err) {
            console.error('Erro na inicialização mobile:', err);
            mAlert('Erro de Conexão', 'Não foi possível carregar os dados iniciais. Verifique sua internet e recarregue.');
        }
    }

    function preencherPerfil() {
        document.getElementById('m-footer-nome').innerText = usuario.nome_completo || '-';
        document.getElementById('m-footer-cargo').innerText = usuario.cargos?.nome || 'Colaborador';

        document.getElementById('m-conta-nome').innerText = usuario.nome_completo || '-';
        document.getElementById('m-conta-email').innerText = usuario.email || '-';
        document.getElementById('m-conta-cargo').innerText = usuario.cargos?.nome || 'Colaborador';

        if (usuario.avatar_url) {
            const imgHtml = `<img src="${usuario.avatar_url}" alt="Avatar">`;
            document.getElementById('m-footer-avatar').innerHTML = imgHtml;
            document.getElementById('m-conta-avatar').innerHTML = imgHtml;
        }
    }

    async function carregarVersao() {
        try {
            const res = await fetch(`../version.json?v=${Date.now()}`);
            if (!res.ok) return;
            const info = await res.json();
            if (info.versao) document.getElementById('m-sobre-versao').innerText = info.versao;
            if (info.data) document.getElementById('m-sobre-data').innerText = info.data;
        } catch {}
    }

    // ================= COLETA DE MAC EM LOTE =================
    document.getElementById('btn-iniciar-conferencia')?.addEventListener('click', () => {
        const almoxId = document.getElementById('col-almoxarifado').value;
        if (!almoxId) {
            mAlert('Atenção', 'Selecione o almoxarifado antes de iniciar.');
            return;
        }
        confAlmoxId = almoxId;
        confAlmoxNome = almoxMap[almoxId] || document.getElementById('lbl-pick-col-almox').innerText;
        confTipo = document.getElementById('col-tipo').value || 'Estoque';

        document.getElementById('lbl-conf-almox').innerText = confAlmoxNome;
        document.getElementById('lbl-conf-tipo').innerText = confTipo.toUpperCase();

        document.getElementById('coleta-step-setup').style.display = 'none';
        document.getElementById('coleta-step-ativa').style.display = 'flex';
        mostrarPassoModelo();
    });

    document.getElementById('btn-trocar-almox')?.addEventListener('click', async () => {
        if (loteMac.length > 0) {
            const conf = await mConfirm('Trocar Almoxarifado', 'Existem equipamentos no lote atual. Deseja descartar o lote e trocar de almoxarifado?');
            if (!conf) return;
            loteMac = [];
            renderizarLote();
        }
        await pararScanner();
        document.getElementById('coleta-step-ativa').style.display = 'none';
        document.getElementById('coleta-step-setup').style.display = 'block';
    });

    function mostrarPassoModelo() {
        pararScanner();
        document.getElementById('coleta-passo-modelo').style.display = 'block';
        document.getElementById('coleta-passo-scanner').style.display = 'none';
    }

    document.getElementById('btn-confirmar-modelo')?.addEventListener('click', () => {
        const prodId = document.getElementById('col-produto').value;
        if (!prodId) {
            mAlert('Atenção', 'Selecione o modelo da ONU antes de avançar.');
            return;
        }
        modeloSelecionado = {
            id: prodId,
            nome: document.getElementById('lbl-pick-col-prod').innerText
        };
        document.getElementById('lbl-modelo-atual').innerText = modeloSelecionado.nome;
        iniciarEtapaScan('MAC');
    });

    document.getElementById('btn-mudar-modelo')?.addEventListener('click', mostrarPassoModelo);
    document.getElementById('btn-voltar-passo-scan')?.addEventListener('click', () => iniciarEtapaScan('MAC'));

    async function iniciarEtapaScan(etapa) {
        etapaScan = etapa;
        document.getElementById('coleta-passo-modelo').style.display = 'none';
        document.getElementById('coleta-passo-scanner').style.display = 'block';
        document.getElementById('col-input-manual').value = '';

        if (etapa === 'MAC') {
            macTemp = '';
            document.getElementById('lbl-scan-badge').innerText = 'PASSO 2 DE 3';
            document.getElementById('lbl-scan-titulo').innerText = 'Leia o MAC (GPON) da ONU';
            document.getElementById('lbl-scan-sub').innerText = 'Direcione a linha laranja sobre o código de barras do MAC (GPON).';
            document.getElementById('lbl-mac-capturado-box').style.display = 'none';
            document.getElementById('btn-voltar-passo-scan').style.display = 'none';
        } else {
            document.getElementById('lbl-scan-badge').innerText = 'PASSO 3 DE 3';
            document.getElementById('lbl-scan-titulo').innerText = 'Leia o Nº de Série da ONU';
            document.getElementById('lbl-scan-sub').innerText = 'Direcione a linha laranja sobre o código de barras do Nº de Série.';
            document.getElementById('lbl-mac-capturado').innerText = macTemp;
            document.getElementById('lbl-mac-capturado-box').style.display = 'flex';
            document.getElementById('btn-voltar-passo-scan').style.display = 'flex';
        }

        focarAreaCamera();
        await iniciarScanner();
    }

    async function iniciarScanner() {
        if (scannerAtivo || typeof Html5Qrcode === 'undefined') return;
        try {
            if (!html5QrCode) html5QrCode = new Html5Qrcode('qr-reader');
            scannerAtivo = true;
            await html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 12, qrbox: { width: 260, height: 110 } },
                (texto) => processarCodigoCapturado(texto)
            );
            focarAreaCamera();
        } catch (err) {
            scannerAtivo = false;
            console.warn('Câmera indisponível, use entrada manual:', err);
        }
    }

    async function pararScanner() {
        if (html5QrCode && scannerAtivo) {
            try { await html5QrCode.stop(); } catch {}
            scannerAtivo = false;
        }
    }

    function processarCodigoCapturado(valorBruto) {
        if (bloqueioLeitura) return;
        const codigo = String(valorBruto || '').trim().toUpperCase();
        if (!codigo) return;

        bloqueioLeitura = true;
        if (navigator.vibrate) navigator.vibrate(80);

        if (etapaScan === 'MAC') {
            if (loteMac.some(i => i.mac === codigo)) {
                mAlert('MAC Duplicado', `O MAC <strong>${codigo}</strong> já está neste lote.`).then(() => { bloqueioLeitura = false; });
                return;
            }
            macTemp = codigo;
            tocarBipConfirmacao('mac');
            mostrarToast('MAC lido! Agora leia o Nº de Série.', 'info', 2200);
            iniciarEtapaScan('SERIAL');
            setTimeout(() => { bloqueioLeitura = false; }, 900);
        } else {
            if (loteMac.some(i => i.numero_serie === codigo)) {
                mAlert('Série Duplicada', `O Nº de Série <strong>${codigo}</strong> já está neste lote.`).then(() => { bloqueioLeitura = false; });
                return;
            }
            loteMac.unshift({
                idLocal: Date.now(),
                produto_id: modeloSelecionado.id,
                produto_nome: modeloSelecionado.nome,
                mac: macTemp,
                numero_serie: codigo
            });
            renderizarLote();
            tocarBipConfirmacao('serial');
            mostrarToast(`Nº de Série lido! (${loteMac.length} no lote)`, 'success', 2000);

            const manter = document.getElementById('col-manter-modelo').checked;
            if (manter) iniciarEtapaScan('MAC');
            else mostrarPassoModelo();

            setTimeout(() => { bloqueioLeitura = false; }, 900);
        }
    }

    document.getElementById('btn-confirmar-manual')?.addEventListener('click', () => {
        const val = document.getElementById('col-input-manual').value;
        if (!val.trim()) return;
        processarCodigoCapturado(val);
    });

    function renderizarLote() {
        document.getElementById('lbl-qtd-lote').innerText = loteMac.length;
        document.getElementById('btn-enviar-lote').disabled = loteMac.length === 0;
        document.getElementById('btn-limpar-lote').style.display = loteMac.length > 0 ? 'inline' : 'none';

        const container = document.getElementById('lista-lote-mac');
        if (loteMac.length === 0) {
            container.innerHTML = '<div class="m-empty-sm">Nenhum equipamento bipado ainda.</div>';
            return;
        }

        container.innerHTML = loteMac.map(item => `
            <div class="m-lote-item">
                <div>
                    <strong>${item.produto_nome}</strong>
                    <small>MAC: ${item.mac}</small>
                    <small>S/N: ${item.numero_serie}</small>
                </div>
                <button type="button" onclick="window.removerItemLote(${item.idLocal})" style="background:none; border:none; color:#ef4444; padding:6px;">
                    <i data-lucide="trash-2" style="width:16px;"></i>
                </button>
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    }

    window.removerItemLote = function(idLocal) {
        loteMac = loteMac.filter(i => i.idLocal !== idLocal);
        renderizarLote();
    };

    document.getElementById('btn-limpar-lote')?.addEventListener('click', async () => {
        const conf = await mConfirm('Limpar Lote', 'Deseja remover todos os itens capturados deste lote?');
        if (!conf) return;
        loteMac = [];
        renderizarLote();
    });

    document.getElementById('btn-enviar-lote')?.addEventListener('click', async () => {
        if (loteMac.length === 0) return;
        const conf = await mConfirm(
            'Enviar Conferência',
            `Deseja enviar <strong>${loteMac.length} equipamento(s)</strong> para <strong>${confAlmoxNome}</strong> (Tipo: ${confTipo})?`,
            'Enviar Agora'
        );
        if (!conf) return;

        const btn = document.getElementById('btn-enviar-lote');
        btn.disabled = true;
        btn.innerText = 'Enviando...';

        try {
            const dataHoje = new Date().toISOString().split('T')[0];
            const payload = loteMac.map(item => ({
                almoxarifado_id: confAlmoxId,
                numero_os: '',
                tipo_os: confTipo.toUpperCase(),
                data_coleta: dataHoje,
                produto_consumo_id: item.produto_id,
                mac: item.mac,
                numero_serie: item.numero_serie,
                observacoes: '',
                usuario_estoquista_id: usuario.id,
                status: 'PENDENTE'
            }));

            const { error } = await window.db.from('coletas_mac').insert(payload);
            if (error) throw error;

            await pararScanner();
            loteMac = [];
            renderizarLote();

            // Limpa almoxarifado, produto e variáveis da coleta anterior
            confAlmoxId = null;
            confAlmoxNome = '';
            modeloSelecionado = null;
            macTemp = '';
            setPickerValue('col-almoxarifado', 'lbl-pick-col-almox', '', '', 'Toque para buscar almoxarifado...');
            setPickerValue('col-produto', 'lbl-pick-col-prod', '', '', 'Toque para buscar produto...');
            const inpManual = document.getElementById('col-input-manual');
            if (inpManual) inpManual.value = '';

            await mAlert('Sucesso', 'Lote enviado com sucesso! Os equipamentos já estão disponíveis para conferência no desktop.');

            document.getElementById('coleta-step-ativa').style.display = 'none';
            document.getElementById('coleta-step-setup').style.display = 'block';
            await navegarParaView('home', false);
            window.history.pushState({ app: 'smart-cnx', view: 'home', guard: true }, '');
        } catch (err) {
            console.error(err);
            mAlert('Erro ao Enviar', err.message || 'Não foi possível gravar o lote de MACs.');
        } finally {
            btn.disabled = loteMac.length === 0;
            btn.innerHTML = `<i data-lucide="cloud-upload"></i> Enviar Lote para o Sistema`;
            if (window.lucide) lucide.createIcons();
        }
    });

    // ================= REQUISIÇÕES (SOMENTE SOLICITANTE) =================
    async function carregarRequisicoesMobile() {
        const container = document.getElementById('lista-req-mobile');
        container.innerHTML = '<div class="m-empty">Carregando...</div>';

        const idsAlmox = almoxarifadosPermitidos.map(a => a.id);
        if (idsAlmox.length === 0) {
            container.innerHTML = '<div class="m-empty">Nenhum almoxarifado vinculado.</div>';
            return;
        }

        let query = window.db
            .from('requisicoes')
            .select('*')
            .limit(80);

        if (!isAdmin && !usuario.acesso_todos_almoxarifados) {
            query = query.in('almoxarifado_requisitante_id', idsAlmox);
        }

        const statusFiltro = document.getElementById('req-filtro-status').value;
        if (statusFiltro) query = query.eq('status', statusFiltro);

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao carregar requisições:', error);
            container.innerHTML = '<div class="m-empty">Erro ao carregar requisições.</div>';
            return;
        }

        requisicoesCache = data || [];
        if (requisicoesCache.length === 0) {
            container.innerHTML = '<div class="m-empty">Nenhuma requisição encontrada.</div>';
            return;
        }

        const statusAguardandoReceb = ['ENVIADA', 'ENVIADO', 'EM TRANSITO', 'AGUARDANDO RECEBIMENTO'];

        const corStatus = (s) => {
            const st = String(s || '').toUpperCase();
            if (st === 'PENDENTE') return 'background:#fef3c7; color:#b45309;';
            if (st === 'APROVADA') return 'background:#e0f2fe; color:#0369a1;';
            if (statusAguardandoReceb.includes(st)) return 'background:#ede9fe; color:#6d28d9;';
            if (st === 'CONCLUIDA' || st === 'CONCLUÍDA' || st === 'RECEBIDA') return 'background:#dcfce7; color:#166534;';
            return 'background:#fee2e2; color:#991b1b;';
        };

        container.innerHTML = requisicoesCache.map(r => {
            const st = String(r.status || '').toUpperCase();
            const cod = r.codigo ? String(r.codigo).padStart(6, '0') : String(r.id).slice(0, 6);
            const nomeDestino = almoxMap[r.almoxarifado_requisitante_id] || '-';
            const nomeOrigem = almoxMap[r.almoxarifado_abastecedor_id] || '-';
            const dataRaw = r.data_solicitacao || r.data_criacao || r.atualizado_em;
            const dt = dataRaw ? new Date(dataRaw).toLocaleDateString('pt-BR') : '-';
            const podeReceber = statusAguardandoReceb.includes(st);

            return `
                <div class="m-req-card">
                    <div class="m-req-top">
                        <span class="m-req-cod">#${cod}</span>
                        <span class="m-status-pill" style="${corStatus(st)}">${st}</span>
                    </div>
                    <div class="m-req-meta">
                        <div><strong>Destino:</strong> ${nomeDestino}</div>
                        <div><strong>Origem:</strong> ${nomeOrigem}</div>
                        <div><strong>Data:</strong> ${dt}</div>
                    </div>
                    <div class="m-req-actions">
                        <button type="button" onclick="window.verRequisicaoMobile('${r.id}', false)"><i data-lucide="eye" style="width:14px;"></i> Visualizar</button>
                        ${st === 'PENDENTE' ? `<button type="button" onclick="window.editarRequisicaoMobile('${r.id}')"><i data-lucide="edit-3" style="width:14px;"></i> Editar</button>` : ''}
                        ${podeReceber ? `<button type="button" class="confirm-rec" onclick="window.verRequisicaoMobile('${r.id}', true)"><i data-lucide="package-check" style="width:14px;"></i> Confirmar Receb.</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons();
    }

    document.getElementById('req-filtro-status')?.addEventListener('change', carregarRequisicoesMobile);
    document.getElementById('btn-refresh-req-mobile')?.addEventListener('click', carregarRequisicoesMobile);

    function abrirFormNovaRequisicao() {
        if (!temPermissaoMobile('requisicoes')) {
            mAlert('Acesso Negado', 'Você não tem permissão para criar requisições no mobile.');
            return;
        }

        document.getElementById('modal-req-titulo').innerText = 'Nova Requisição';
        document.getElementById('req-edit-id').value = '';
        document.getElementById('req-obs').value = '';

        setPickerValue('req-almox-sol', 'lbl-pick-req-sol', '', '', 'Toque para buscar solicitante...');
        setPickerValue('req-almox-abast', 'lbl-pick-req-abast', '', '', 'Toque para buscar abastecedor...');
        setPickerValue('req-item-prod', 'lbl-pick-req-prod', '', '', 'Toque para buscar produto...');
        document.getElementById('req-item-prod-nome').value = '';
        document.getElementById('req-item-qtd').value = '1';

        if (almoxarifadosPermitidos.length === 1) {
            const unico = almoxarifadosPermitidos[0];
            setPickerValue('req-almox-sol', 'lbl-pick-req-sol', unico.id, `${unico.codigo} - ${unico.descricao}`, 'Toque para buscar solicitante...');
            if (unico.almoxarifado_abastecedor_id) {
                const abast = todosAlmoxarifados.find(a => a.id === unico.almoxarifado_abastecedor_id);
                if (abast) {
                    setPickerValue('req-almox-abast', 'lbl-pick-req-abast', abast.id, `${abast.codigo} - ${abast.descricao}`, 'Toque para buscar abastecedor...');
                }
            }
        }

        reqFormItens = [];
        reqFormItensOriginais = [];
        reqFormSujo = false;
        renderizarItensFormReq();
        mudarAbaReqForm('geral');
        abrirModal('modal-req-form');
    }

    document.getElementById('btn-nova-req-mobile')?.addEventListener('click', abrirFormNovaRequisicao);

    window.editarRequisicaoMobile = async function(reqId) {
        const req = requisicoesCache.find(r => r.id === reqId);
        if (!req) return;
        const { data: itens } = await window.db.from('requisicao_itens').select('*, produtos(codigo, descricao)').eq('requisicao_id', reqId);

        document.getElementById('modal-req-titulo').innerText = 'Editar Requisição';
        document.getElementById('req-edit-id').value = req.id;

        const solId = req.almoxarifado_requisitante_id || '';
        const abastId = req.almoxarifado_abastecedor_id || '';
        setPickerValue('req-almox-sol', 'lbl-pick-req-sol', solId, almoxMap[solId] || '', 'Toque para buscar solicitante...');
        setPickerValue('req-almox-abast', 'lbl-pick-req-abast', abastId, almoxMap[abastId] || '', 'Toque para buscar abastecedor...');
        setPickerValue('req-item-prod', 'lbl-pick-req-prod', '', '', 'Toque para buscar produto...');
        document.getElementById('req-item-prod-nome').value = '';
        document.getElementById('req-item-qtd').value = '1';
        document.getElementById('req-obs').value = req.observacoes_solicitacao || '';

        reqFormItens = (itens || []).map(i => ({
            id: i.id,
            produto_id: i.produto_id,
            nome: i.produtos ? `${i.produtos.codigo} - ${i.produtos.descricao}` : 'Produto',
            qtd: Number(i.qtd_solicitada) || 0
        }));
        reqFormItensOriginais = reqFormItens.map(i => ({ ...i }));

        reqFormSujo = false;
        renderizarItensFormReq();
        mudarAbaReqForm('geral');
        abrirModal('modal-req-form');
    };

    document.getElementById('btn-req-add-item')?.addEventListener('click', () => {
        const prodId = document.getElementById('req-item-prod')?.value;
        const prodNome = document.getElementById('req-item-prod-nome')?.value;
        const qtd = parseInt(document.getElementById('req-item-qtd')?.value) || 0;

        if (!prodId || qtd <= 0) {
            mAlert('Atenção', 'Selecione um produto e informe uma quantidade válida.');
            return;
        }

        const existente = reqFormItens.find(i => i.produto_id === prodId);
        if (existente) existente.qtd += qtd;
        else reqFormItens.push({ produto_id: prodId, nome: prodNome || 'Produto', qtd });

        reqFormSujo = true;
        setPickerValue('req-item-prod', 'lbl-pick-req-prod', '', '', 'Toque para buscar produto...');
        const inpNome = document.getElementById('req-item-prod-nome');
        if (inpNome) inpNome.value = '';
        const inpQtd = document.getElementById('req-item-qtd');
        if (inpQtd) inpQtd.value = '1';
        renderizarItensFormReq();
    });

    document.getElementById('btn-req-salvar')?.addEventListener('click', async () => {
        const editId = document.getElementById('req-edit-id').value;
        const solId = document.getElementById('req-almox-sol').value;
        const abastId = document.getElementById('req-almox-abast').value;
        const obs = document.getElementById('req-obs').value.trim().toUpperCase();

        if (!solId || !abastId) {
            mudarAbaReqForm('geral');
            mAlert('Atenção', 'Selecione o almoxarifado solicitante e o abastecedor.');
            return;
        }
        if (reqFormItens.length === 0) {
            mudarAbaReqForm('produtos');
            mAlert('Atenção', 'Adicione pelo menos um produto à requisição.');
            return;
        }

        try {
            if (editId) {
                const { error } = await window.db.from('requisicoes').update({
                    almoxarifado_requisitante_id: solId,
                    almoxarifado_abastecedor_id: abastId,
                    observacoes_solicitacao: obs
                }).eq('id', editId);
                if (error) throw error;

                // 1. Exclui somente os itens que realmente foram removidos
                const idsMantidos = reqFormItens.filter(i => i.id).map(i => i.id);
                const removidos = reqFormItensOriginais.filter(orig => !idsMantidos.includes(orig.id));
                if (removidos.length > 0) {
                    const { error: errDel } = await window.db
                        .from('requisicao_itens')
                        .delete()
                        .in('id', removidos.map(r => r.id));
                    if (errDel) throw errDel;
                }

                // 2. Atualiza somente os itens que tiveram a quantidade alterada
                for (const item of reqFormItens) {
                    if (item.id) {
                        const orig = reqFormItensOriginais.find(o => o.id === item.id);
                        if (orig && Number(orig.qtd) !== Number(item.qtd)) {
                            const { error: errUpd } = await window.db
                                .from('requisicao_itens')
                                .update({ qtd_solicitada: item.qtd })
                                .eq('id', item.id);
                            if (errUpd) throw errUpd;
                        }
                    }
                }

                // 3. Insere somente os itens novos
                const novos = reqFormItens.filter(i => !i.id).map(i => ({
                    requisicao_id: editId,
                    produto_id: i.produto_id,
                    qtd_solicitada: i.qtd
                }));
                if (novos.length > 0) {
                    const { error: errIns } = await window.db.from('requisicao_itens').insert(novos);
                    if (errIns) throw errIns;
                }
            } else {
                const { data, error } = await window.db.from('requisicoes').insert([{
                    almoxarifado_requisitante_id: solId,
                    almoxarifado_abastecedor_id: abastId,
                    usuario_solicitante_id: usuario.id,
                    observacoes_solicitacao: obs,
                    status: 'PENDENTE'
                }]).select().single();
                if (error) throw error;

                const itensPayload = reqFormItens.map(i => ({
                    requisicao_id: data.id,
                    produto_id: i.produto_id,
                    qtd_solicitada: i.qtd
                }));
                const { error: errItens } = await window.db.from('requisicao_itens').insert(itensPayload);
                if (errItens) throw errItens;
            }

            reqFormSujo = false;
            fecharModalSilencioso('modal-req-form');
            await mAlert('Sucesso', editId ? 'Requisição atualizada!' : 'Requisição criada com sucesso!');
            if (viewAtual === 'requisicoes') carregarRequisicoesMobile();
        } catch (err) {
            console.error(err);
            mAlert('Erro', err.message || 'Falha ao salvar requisição.');
        }
    });

    function renderizarItensFormReq() {
        const lblQtd = document.getElementById('lbl-req-qtd-itens');
        if (lblQtd) lblQtd.innerText = reqFormItens.length;

        const el = document.getElementById('req-form-itens-lista');
        if (reqFormItens.length === 0) {
            el.innerHTML = '<div class="m-empty-sm">Nenhum item adicionado.</div>';
            return;
        }
        el.innerHTML = reqFormItens.map((item, idx) => `
            <div class="m-lote-item">
                <div>
                    <strong>${item.nome}</strong>
                    <small>Qtd. Solicitada: ${item.qtd}</small>
                </div>
                <button type="button" onclick="window.removerItemReqForm(${idx})" style="background:none; border:none; color:#ef4444; padding:6px;">
                    <i data-lucide="trash-2" style="width:16px;"></i>
                </button>
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    }

    window.removerItemReqForm = function(idx) {
        reqFormItens.splice(idx, 1);
        reqFormSujo = true;
        renderizarItensFormReq();
    };

    document.getElementById('btn-req-salvar')?.addEventListener('click', async () => {
        const editId = document.getElementById('req-edit-id').value;
        const solId = document.getElementById('req-almox-sol').value;
        const abastId = document.getElementById('req-almox-abast').value;
        const obs = document.getElementById('req-obs').value.trim();

        if (!solId || !abastId) {
            mudarAbaReqForm('geral');
            mAlert('Atenção', 'Selecione o almoxarifado solicitante e o abastecedor.');
            return;
        }
        if (reqFormItens.length === 0) {
            mudarAbaReqForm('produtos');
            mAlert('Atenção', 'Adicione pelo menos um produto à requisição.');
            return;
        }

        try {
            let reqId = editId;
            if (editId) {
                const { error } = await window.db.from('requisicoes').update({
                    almoxarifado_requisitante_id: solId,
                    almoxarifado_abastecedor_id: abastId,
                    observacoes_solicitacao: obs
                }).eq('id', editId);
                if (error) throw error;
                await window.db.from('requisicao_itens').delete().eq('requisicao_id', editId);
            } else {
                const { data, error } = await window.db.from('requisicoes').insert([{
                    almoxarifado_requisitante_id: solId,
                    almoxarifado_abastecedor_id: abastId,
                    usuario_solicitante_id: usuario.id,
                    observacoes_solicitacao: obs,
                    status: 'PENDENTE'
                }]).select().single();
                if (error) throw error;
                reqId = data.id;
            }

            const itensPayload = reqFormItens.map(i => ({
                requisicao_id: reqId,
                produto_id: i.produto_id,
                qtd_solicitada: i.qtd
            }));
            const { error: errItens } = await window.db.from('requisicao_itens').insert(itensPayload);
            if (errItens) throw errItens;

            reqFormSujo = false;
            fecharModalSilencioso('modal-req-form');
            await mAlert('Sucesso', editId ? 'Requisição atualizada!' : 'Requisição criada com sucesso!');
            if (viewAtual === 'requisicoes') carregarRequisicoesMobile();
        } catch (err) {
            console.error(err);
            mAlert('Erro', err.message || 'Falha ao salvar requisição.');
        }
    });

    window.verRequisicaoMobile = async function(reqId, modoReceber) {
        const req = requisicoesCache.find(r => r.id === reqId);
        if (!req) return;
        const { data: itens } = await window.db.from('requisicao_itens').select('*, produtos(codigo, descricao)').eq('requisicao_id', reqId);

        const cod = req.codigo ? String(req.codigo).padStart(6, '0') : String(req.id).slice(0, 6);
        document.getElementById('modal-det-titulo').innerText = modoReceber ? `Receber Req. #${cod}` : `Requisição #${cod}`;

        const itensHtml = (itens || []).map(i => {
            const nome = i.produtos ? `${i.produtos.codigo} - ${i.produtos.descricao}` : 'Produto';
            const qtdEnv = i.qtd_enviada ?? i.qtd_aprovada ?? i.qtd_solicitada;
            return `
                <div class="m-lote-item">
                    <div style="flex:1;">
                        <strong>${nome}</strong>
                        <small>Solicitado: ${i.qtd_solicitada} | Enviado: ${qtdEnv}</small>
                    </div>
                    ${modoReceber
                        ? `<input type="number" class="m-input inp-qtd-rec" data-item-id="${i.id}" value="${qtdEnv}" min="0" style="width:72px; text-align:center; padding:6px;">`
                        : `<strong style="color:var(--cnx-blue); font-size:0.8rem;">Rec: ${i.qtd_recebida ?? '-'}</strong>`}
                </div>
            `;
        }).join('');

        document.getElementById('modal-det-body').innerHTML = `
            <div style="font-size:0.8rem; color:#475569; margin-bottom:12px; line-height:1.5;">
                <div><strong>Status:</strong> ${req.status}</div>
                <div><strong>Destino:</strong> ${almoxMap[req.almoxarifado_requisitante_id] || '-'}</div>
                <div><strong>Origem:</strong> ${almoxMap[req.almoxarifado_abastecedor_id] || '-'}</div>
                ${req.observacoes_solicitacao ? `<div><strong>Obs:</strong> ${req.observacoes_solicitacao}</div>` : ''}
            </div>
            <div class="m-lote-list">${itensHtml}</div>
        `;

        document.getElementById('modal-det-footer').innerHTML = modoReceber
            ? `<button type="button" class="m-btn-outline" id="btn-cancelar-rec">Cancelar</button>
               <button type="button" class="m-btn-success" id="btn-confirmar-recebimento-mobile">Confirmar</button>`
            : `<button type="button" class="m-btn-primary" id="btn-fechar-det">Fechar</button>`;

        if (modoReceber) {
            document.getElementById('btn-cancelar-rec').onclick = () => fecharModalSilencioso('modal-req-detalhes');
            document.getElementById('btn-confirmar-recebimento-mobile').onclick = async () => {
                const conf = await mConfirm('Confirmar Recebimento', 'Deseja confirmar o recebimento com as quantidades informadas?');
                if (!conf) return;
                try {
                    const inputs = document.querySelectorAll('.inp-qtd-rec');
                    for (const inp of inputs) {
                        await window.db.from('requisicao_itens')
                            .update({ qtd_recebida: parseInt(inp.value) || 0 })
                            .eq('id', inp.dataset.itemId);
                    }
                    await window.db.from('requisicoes').update({ status: 'CONCLUIDA' }).eq('id', reqId);
                    fecharModalSilencioso('modal-req-detalhes');
                    await mAlert('Concluído', 'Recebimento confirmado com sucesso!');
                    carregarRequisicoesMobile();
                } catch (err) {
                    mAlert('Erro', err.message || 'Falha ao confirmar recebimento.');
                }
            };
        } else {
            document.getElementById('btn-fechar-det').onclick = () => fecharModalSilencioso('modal-req-detalhes');
        }

        abrirModal('modal-req-detalhes');
    };

    // ================= MINHA CONTA =================
    document.querySelectorAll('.m-toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const estavaMascarado = input.classList.toggle('m-pass-masked');
            const visivel = !estavaMascarado;
            btn.innerHTML = `<i data-lucide="${visivel ? 'eye' : 'eye-off'}"></i>`;
            btn.style.color = visivel ? 'var(--cnx-orange)' : '#94a3b8';
            if (window.lucide) lucide.createIcons();
        });
    });

    const inAvatar = document.getElementById('m-input-avatar');
    document.getElementById('btn-m-upload-avatar')?.addEventListener('click', () => inAvatar.click());
    inAvatar?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        try {
            const filename = `avatar_${usuario.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: upErr } = await window.db.storage.from('avatar_usuario').upload(filename, file);
            if (upErr) throw upErr;

            const publicUrl = window.db.storage.from('avatar_usuario').getPublicUrl(filename).data.publicUrl;
            const { error: dbErr } = await window.db.from('usuarios').update({ avatar_url: publicUrl }).eq('id', usuario.id);
            if (dbErr) throw dbErr;

            usuario.avatar_url = publicUrl;
            preencherPerfil();
            mAlert('Sucesso', 'Foto de perfil atualizada!');
        } catch (err) {
            mAlert('Erro', 'Não foi possível atualizar a foto.');
        }
    });

    document.getElementById('btn-m-salvar-senha')?.addEventListener('click', async () => {
        const s1 = document.getElementById('m-nova-senha').value;
        const s2 = document.getElementById('m-confirma-senha').value;

        if (!s1 || s1.length < 6) { mAlert('Atenção', 'A senha deve ter pelo menos 6 caracteres.'); return; }
        if (s1 !== s2) { mAlert('Atenção', 'As senhas não coincidem.'); return; }

        const conf = await mConfirm('Alterar Senha', 'Deseja confirmar a alteração da sua senha?');
        if (!conf) return;

        const { error } = await window.db.auth.updateUser({ password: s1 });
        if (error) { mAlert('Erro', error.message); return; }

        document.getElementById('m-nova-senha').value = '';
        document.getElementById('m-confirma-senha').value = '';
        mAlert('Sucesso', 'Senha atualizada com sucesso!');
    });

    document.getElementById('btn-m-logout')?.addEventListener('click', async () => {
        const conf = await mConfirm('Sair', 'Deseja encerrar sua sessão?', 'Sair');
        if (!conf) return;
        await pararScanner();
        await window.db.auth.signOut();
        window.location.replace('../index.html');
    });

    await inicializar();
})();