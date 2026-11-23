// js/requisicoes.js
(async function initModuloRequisicoes() {
    console.log("Módulo Requisições carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-requisicoes .modulo-container');
    if (!moduloContent) return;

    const oldRefresh = moduloContent.querySelector('#btn-refresh-req');
    if (oldRefresh) oldRefresh.remove();

    const tbodyReqs = moduloContent.querySelector('#tbody-requisicoes');
    const lblTotalGeral = moduloContent.querySelector('#lbl-total-geral');
    const lblTotalExibidos = moduloContent.querySelector('#lbl-total-exibidos');
    
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const inputStatus = moduloContent.querySelector('#filtro-valor-status');
    const inputData = moduloContent.querySelector('#filtro-valor-data');
    const wrapperTexto = moduloContent.querySelector('#wrapper-texto');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    
    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    
    // Botão Refresh colocado estritamente ao lado esquerdo do funil "Nenhum Filtro" (tags-dropdown-wrapper)
    const tagsWrapper = moduloContent.querySelector('.tags-dropdown-wrapper');
    if (tagsWrapper && !moduloContent.querySelector('#btn-refresh-grid')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'btn-refresh-grid';
        refreshBtn.title = 'Recarregar Tabela';
        refreshBtn.style.cssText = 'background:none; border:none; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; margin-right:8px;';
        refreshBtn.innerHTML = `<i data-lucide="refresh-cw" class="refresh-icon" style="width: 14px; height: 14px;"></i>`;
        
        tagsWrapper.insertBefore(refreshBtn, tagsWrapper.firstChild);
        
        refreshBtn.addEventListener('click', () => {
            const icon = refreshBtn.querySelector('.refresh-icon');
            if(icon) icon.classList.add('lucide-spin');
            buscarRequisicoes().then(() => { if(icon) icon.classList.remove('lucide-spin'); });
        });
        lucide.createIcons();
    }

    let permissoesAcesso = { view: false, create: false, edit: false, delete: false, approve: false, dispatch: false, receive: false };
    let filtrosAtivos = [];
    let sortConfig = { key: 'codigo', direction: 'desc' };


    const btnNovaReq = moduloContent.querySelector('#btn-nova-req');
    const modalReq = moduloContent.querySelector('#modal-req');
    const modalTitulo = moduloContent.querySelector('#modal-titulo-req');
    const badgeStatusModal = moduloContent.querySelector('#badge-status-modal');
    const footerReq = moduloContent.querySelector('#modal-req-footer');
    
    const tabBtns = moduloContent.querySelectorAll('.tab-form-btn');
    const tabContents = moduloContent.querySelectorAll('.tab-form-content');

    const inReqId = moduloContent.querySelector('#req-requisitante-id');
    const inReqDesc = moduloContent.querySelector('#req-requisitante-desc');
    const btnBuscaAlmoxReq = moduloContent.querySelector('#btn-busca-almox-req');
    const inAbastId = moduloContent.querySelector('#req-abastecedor-id');
    const inAbastDesc = moduloContent.querySelector('#req-abastecedor-desc');
    
    const btnBuscaProduto = moduloContent.querySelector('#btn-busca-produto'); 
    const tbodyItens = moduloContent.querySelector('#tbody-itens-req');
    const lblTotalTipos = moduloContent.querySelector('#lbl-total-tipos');
    const lblSomaGeral = moduloContent.querySelector('#lbl-soma-geral');
    
    const inObs = moduloContent.querySelector('#req-obs');
    const painelEnvio = moduloContent.querySelector('#painel-envio-faturamento');
    const inNumPedido = moduloContent.querySelector('#req-num-pedido');
    const inDadosEnvio = moduloContent.querySelector('#req-dados-envio');

    const lblUserSol = moduloContent.querySelector('#lbl-user-solicitante span');
    const lblUserAtd = moduloContent.querySelector('#lbl-user-atendente span');

    const modalConsulta = moduloContent.querySelector('#modal-consulta');
    const tituloConsulta = moduloContent.querySelector('#titulo-consulta');
    const inputBuscaConsulta = moduloContent.querySelector('#input-busca-consulta');
    const theadConsulta = moduloContent.querySelector('#thead-consulta');
    const tbodyConsulta = moduloContent.querySelector('#tbody-consulta');
    
    let usuarioLogadoId = null;
    let nomeUsuarioLogado = '';
    let isAdmin = false;
    let isGestor = false;
    let acessoTodos = false;
    let meusAlmoxarifadosIds = []; 
    let almoxarifados = [];
    let produtos = [];
    let todasRequisicoes = [];
    
    let modoForm = 'novo'; 
    let reqEmEdicaoId = null;
    let itensReqCache = [];
    let itensRemovidosDB = []; 
    let formFoiAlterado = false; 
    let tipoConsultaAtual = ''; 

    if (!document.getElementById('custom-prompt-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" id="custom-prompt-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 10500; align-items: center; justify-content: center; padding: 1rem;">
                <div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden;">
                    <div style="background: var(--cnx-blue); padding: 1rem 1.5rem; color: white; font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="message-square" style="color: var(--cnx-orange); width: 20px;"></i> <span id="custom-prompt-title">Motivo Necessário</span>
                    </div>
                    <div style="padding: 1.5rem;">
                        <label id="custom-prompt-msg" style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 8px; display: block;"></label>
                        <input type="text" id="custom-prompt-input" class="input-standard input-upper" style="width: 100%; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    </div>
                    <div style="padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="custom-prompt-btn-cancel" style="background: white; border: 1px solid #cbd5e1; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; color: #64748b;">Cancelar</button>
                        <button id="custom-prompt-btn-ok" style="background: var(--cnx-blue); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; cursor: pointer;">Confirmar</button>
                    </div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('pdf-frame-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" id="pdf-frame-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 11000; align-items: center; justify-content: center; padding: 1rem;">
                <div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
                    <div style="background: #334155; padding: 0.8rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; color: white; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="file-text" style="color: #cbd5e1; width: 18px;"></i> Visualizador de Documento
                        </h3>
                        <button onclick="document.getElementById('pdf-frame-modal').style.display='none'" style="background: none; border: none; color: white; cursor: pointer;"><i data-lucide="x"></i></button>
                    </div>
                    <iframe id="pdf-iframe" style="flex: 1; width: 100%; border: none; background: #e2e8f0;"></iframe>
                </div>
            </div>
        `);
    }

    window.appCustomPrompt = function(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-prompt-modal');
            const input = document.getElementById('custom-prompt-input');
            document.getElementById('custom-prompt-title').innerText = title;
            document.getElementById('custom-prompt-msg').innerText = message;
            input.value = '';
            
            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 100);
            
            const btnOk = document.getElementById('custom-prompt-btn-ok');
            const btnCancel = document.getElementById('custom-prompt-btn-cancel');
            
            const fechar = (val) => {
                modal.style.display = 'none';
                btnOk.onclick = null; btnCancel.onclick = null; input.onkeydown = null;
                resolve(val);
            };

            btnOk.onclick = () => fechar(input.value);
            btnCancel.onclick = () => fechar(null);
            input.onkeydown = (e) => { if(e.key === 'Enter') fechar(input.value); if(e.key === 'Escape') fechar(null); };
        });
    };

    // ================= CARGA DE DADOS =================
    async function carregarDadosIniciais() {
        try {
            permissoesAcesso = {
                view: window.temPermissao('requisicoes', 'view'),
                create: window.temPermissao('requisicoes', 'create'),
                edit: window.temPermissao('requisicoes', 'edit'),
                delete: window.temPermissao('requisicoes', 'delete'),
                approve: window.temPermissao('requisicoes', 'approve'),
                dispatch: window.temPermissao('requisicoes', 'dispatch'),
                receive: window.temPermissao('requisicoes', 'receive')
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar Requisição e Envio.</p></div>`;
                lucide.createIcons();
                return;
            }

            if (btnNovaReq) btnNovaReq.style.display = permissoesAcesso.create ? 'flex' : 'none';

            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return;
            usuarioLogadoId = session.user.id;

            const { data: user, error: errUser } = await window.db
                .from('usuarios')
                .select('nome_completo, acesso_todos_almoxarifados, cargos(nome)')
                .eq('id', usuarioLogadoId)
                .single();

            if (errUser) throw errUser;

            nomeUsuarioLogado = user?.nome_completo || '';
            const upperCargo = user?.cargos?.nome?.toUpperCase() || '';
            isAdmin = upperCargo === 'ADMINISTRADOR';
            isGestor = isAdmin || upperCargo.includes('SUPERVISOR');
            acessoTodos = isAdmin || isGestor || !!user?.acesso_todos_almoxarifados;

            await buscarRequisicoes();
        } catch (e) {
            console.error('Erro ao inicializar módulo de requisições:', e);
            tbodyReqs.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:#ef4444;">Erro ao carregar dados iniciais. Clique em atualizar.</td></tr>`;
        }
    }

    async function buscarRequisicoes() {
        tbodyReqs.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        lucide.createIcons();

        try {
            if (!usuarioLogadoId) {
                const { data: { session } } = await window.db.auth.getSession();
                if (!session) return;
                usuarioLogadoId = session.user.id;
            }

            const [resAlmox, resVincs] = await Promise.all([
                window.db.from('almoxarifados').select('*').eq('status', 'ATIVO').order('codigo'),
                window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', usuarioLogadoId)
            ]);

            if (resAlmox.error) throw resAlmox.error;
            if (resVincs.error) throw resVincs.error;

            almoxarifados = resAlmox.data || [];
            const acessosDiretos = (resVincs.data || []).map(v => v.almoxarifado_id);
            meusAlmoxarifadosIds = acessoTodos ? almoxarifados.map(a => a.id) : acessosDiretos;

            let query = window.db.from('requisicoes')
                .select(`*, requisitante:almoxarifados!almoxarifado_requisitante_id(codigo, descricao), abastecedor:almoxarifados!almoxarifado_abastecedor_id(codigo, descricao), user_solic:usuarios!usuario_solicitante_id(nome_completo), user_atend:usuarios!usuario_atendente_id(nome_completo)`)
                .order('codigo', { ascending: false });

            if (!acessoTodos) {
                if (meusAlmoxarifadosIds.length > 0) {
                    const idsFmt = meusAlmoxarifadosIds.join(',');
                    query = query.or(`almoxarifado_requisitante_id.in.(${idsFmt}),almoxarifado_abastecedor_id.in.(${idsFmt})`);
                } else {
                    todasRequisicoes = [];
                    if (lblTotalGeral) lblTotalGeral.innerText = '0';
                    aplicarFiltrosEOrdenar();
                    return;
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            todasRequisicoes = (data || []).map(r => ({
                ...r,
                codigoFormatado: String(r.codigo).padStart(6, '0'),
                requisitanteNome: r.requisitante ? `${window.fmtCod(r.requisitante.codigo)} - ${r.requisitante.descricao}` : 'Desconhecido',
                abastecedorNome: r.abastecedor ? `${window.fmtCod(r.abastecedor.codigo)} - ${r.abastecedor.descricao}` : 'Desconhecido',
                solicitanteNome: r.user_solic ? r.user_solic.nome_completo : 'Desconhecido',
                atendenteNome: r.user_atend ? r.user_atend.nome_completo : 'Aguardando atendimento'
            }));

            if (lblTotalGeral) lblTotalGeral.innerText = todasRequisicoes.length;
            
            if (!Array.from(inputStatus.options).find(o => o.value === 'DIVERGENCIA')) {
                inputStatus.innerHTML += `<option value="DIVERGENCIA">COM DIVERGÊNCIA</option>`;
            }
            
            aplicarFiltrosEOrdenar();
        } catch (err) {
            console.error('Erro ao buscar requisições:', err);
            tbodyReqs.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:#ef4444;">Erro ao buscar requisições. Verifique o console ou clique em atualizar.</td></tr>`;
        }
    }

    function getStatusBadge(status) {
        switch (status) {
            case 'PENDENTE': return `<span style="background: #fef08a; color: #854d0e; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">PENDENTE</span>`;
            case 'APROVADA': return `<span style="background: #bae6fd; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">APROVADA</span>`;
            case 'ENVIADA': return `<span style="background: #e9d5ff; color: #7e22ce; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ENVIADA</span>`;
            case 'CONCLUIDA': return `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">CONCLUÍDA</span>`;
            case 'DIVERGENCIA': return `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">DIVERGÊNCIA</span>`;
            case 'REJEITADA': return `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">REJEITADA</span>`;
            default: return `<span style="background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">${status}</span>`;
        }
    }

    // ================= LÓGICA DE FILTROS =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');
        if (val === 'status') { inputStatus.style.display = 'block'; wrapperTexto.style.display = 'none'; } 
        else if (val === 'data') { inputData.style.display = 'block'; wrapperTexto.style.display = 'none'; }
        else { wrapperTexto.style.display = 'flex'; inputTexto.value = ''; chkExato.checked = false; }
    });

    btnAddFiltro.addEventListener('click', adicionarFiltro);
    btnAplicarFiltro.addEventListener('click', adicionarFiltro); 
    inputTexto.addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFiltro(); });

    function adicionarFiltro() {
        const campo = comboCampo.value; const labelCampo = comboCampo.options[comboCampo.selectedIndex].text;
        let valor = '', labelValor = '', exato = false;

        if (campo === 'status') {
            valor = inputStatus.value; labelValor = inputStatus.options[inputStatus.selectedIndex].text; exato = true;
        } else if (campo === 'data') {
            valor = inputData.value; if (!valor) return;
            const dt = new Date(valor + 'T12:00:00'); labelValor = dt.toLocaleDateString('pt-BR'); exato = true;
        } else {
            valor = inputTexto.value.trim().toUpperCase(); if (!valor) return;
            labelValor = valor; exato = chkExato.checked; inputTexto.value = ''; 
        }
        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    }

    window.removerFiltroReq = function(idFiltro) {
        filtrosAtivos = filtrosAtivos.filter(f => f.id !== idFiltro);
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    };

    btnLimparFiltros.addEventListener('click', () => {
        filtrosAtivos = []; inputTexto.value = ''; inputData.value = '';
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    });

    function renderizarTagsFiltros() {
        const containerTagsInline = moduloContent.querySelector('#container-tags-inline');
        const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');
        
        // Garante que o container flex funciona horizontalmente
        containerTagsInline.style.display = 'flex';
        containerTagsInline.style.gap = '4px';
        containerTagsInline.style.alignItems = 'center';
        containerTagsInline.innerHTML = '';
        
        if (filtrosAtivos.length === 0) { 
            lblFiltrosAtivos.style.display = 'inline'; 
            return; 
        }
        
        lblFiltrosAtivos.style.display = 'none';

        // 1. O primeiro filtro fica sempre visível inline
        const firstFiltro = filtrosAtivos[0];
        const isExato = firstFiltro.exato && firstFiltro.campo !== 'status' && !firstFiltro.campo.includes('data') ? ' (Exato)' : '';
        
        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span><strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroReq(${firstFiltro.id})">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i>
                </button>
            </div>
        `;

        // 2. Se houver mais filtros, agrupa-os no dropdown flutuante
        if (filtrosAtivos.length > 1) {
            const extraCount = filtrosAtivos.length - 1;
            htmlInline += `
                <div class="dropdown-filters" style="position: relative;">
                    <button id="btn-toggle-filters-drop" style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        +${extraCount} <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
                    </button>
                    
                    <!-- Menu Flutuante -->
                    <div id="drop-filters-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 280px; z-index: 50;">
                        <div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px 6px 0 0;">
                            <strong style="color: var(--cnx-blue); font-size: 0.75rem;">Filtros Ativos</strong>
                            <button id="btn-close-filters-drop" style="background:none; border:none; cursor:pointer; color:#64748b; display:flex;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
                        </div>
                        <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">
            `;
            
            // Renderiza TODOS os filtros dentro do modal (incluindo o primeiro)
            filtrosAtivos.forEach(f => {
                const fExato = f.exato && f.campo !== 'status' && !f.campo.includes('data') ? ' (Exato)' : '';
                htmlInline += `
                    <div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;">
                        <div style="flex:1;">
                            <span style="color: #64748b;">${f.labelCampo}${fExato}:</span> 
                            <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong>
                        </div>
                        <button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroReq(${f.id})">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: #ef4444;"></i>
                        </button>
                    </div>
                `;
            });
            
            htmlInline += `
                        </div>
                    </div>
                </div>
            `;
        }

        containerTagsInline.innerHTML = htmlInline;
        lucide.createIcons();

        // Ancorar Eventos do Dropdown
        const btnToggle = containerTagsInline.querySelector('#btn-toggle-filters-drop');
        const dropMenu = containerTagsInline.querySelector('#drop-filters-menu');
        const btnClose = containerTagsInline.querySelector('#btn-close-filters-drop');
        
        if (btnToggle && dropMenu) {
            btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropMenu.style.display = dropMenu.style.display === 'none' ? 'block' : 'none';
            });
            
            btnClose.addEventListener('click', (e) => {
                e.stopPropagation();
                dropMenu.style.display = 'none';
            });
            
            // Fechar ao clicar fora do menu
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) {
                    dropMenu.style.display = 'none';
                    document.removeEventListener('click', closeDrop);
                }
            });
        }
    }

    function aplicarFiltrosEOrdenar() {
        let lista = [...todasRequisicoes];
        filtrosAtivos.forEach(filtro => {
            lista = lista.filter(item => {
                if (filtro.campo === 'status') return String(item.status) === filtro.valor;
                if (filtro.campo === 'data') {
                    const d = new Date(item.criado_em); return d.toISOString().split('T')[0] === filtro.valor;
                }
                const v = String(item[filtro.campo] || '').toUpperCase();
                return filtro.exato ? v === filtro.valor : v.includes(filtro.valor);
            });
        });
        if (window.ordenarDadosTabela) lista = window.ordenarDadosTabela(lista, sortConfig);
        if (lblTotalExibidos) lblTotalExibidos.innerText = lista.length;
        renderizarGrid(lista);
    }

    function renderizarGrid(lista) {
        if (lista.length === 0) {
            tbodyReqs.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:#64748b;">Nenhuma requisição encontrada.</td></tr>`;
            return;
        }

        tbodyReqs.innerHTML = lista.map(r => {
            const dataFmt = new Date(r.criado_em).toLocaleDateString('pt-BR');
            const isRequisitante = meusAlmoxarifadosIds.includes(r.almoxarifado_requisitante_id);
            const isAbastecedor = meusAlmoxarifadosIds.includes(r.almoxarifado_abastecedor_id);
            const isCriador = r.usuario_solicitante_id === usuarioLogadoId;
            
            let btnHtml = `<button class="btn-acao btn-ver" data-id="${r.id}" title="Visualizar / Detalhes" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>`;
            btnHtml += `<button class="btn-acao btn-historico" data-id="${r.id}" title="Auditoria/Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width:16px;"></i></button>`;

            if (r.status === 'PENDENTE') {
                if ((isCriador || isAdmin) && permissoesAcesso.edit) {
                    btnHtml += `<button class="btn-acao btn-editar" data-id="${r.id}" title="Editar Pedido" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>`;
                }
                if ((isCriador || isAdmin) && permissoesAcesso.delete) {
                    btnHtml += `<button class="btn-acao btn-excluir" data-id="${r.id}" title="Excluir Pedido" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>`;
                }
                if ((isAbastecedor || isAdmin) && permissoesAcesso.approve) {
                    btnHtml += `<button class="btn-acao btn-aprovar" data-id="${r.id}" title="Aprovar / Separar" style="background:none; border:none; color:#10b981; cursor:pointer;"><i data-lucide="check-square" style="width:16px;"></i></button>`;
                    btnHtml += `<button class="btn-acao btn-reprovar" data-id="${r.id}" title="Reprovar Pedido" style="background:none; border:none; color:#f59e0b; cursor:pointer;"><i data-lucide="x-square" style="width:16px;"></i></button>`;
                }
            } else if (r.status === 'APROVADA') {
                if ((isAbastecedor || isAdmin) && permissoesAcesso.dispatch) {
                    btnHtml += `<button class="btn-acao btn-despachar" data-id="${r.id}" title="Confirmar Envio" style="background:none; border:none; color:#7e22ce; cursor:pointer;"><i data-lucide="truck" style="width:16px;"></i></button>`;
                }
            } else if (r.status === 'ENVIADA') {
                if ((isCriador || (isRequisitante && !isAbastecedor) || isAdmin) && permissoesAcesso.receive) {
                    btnHtml += `<button class="btn-acao btn-receber" data-id="${r.id}" title="Confirmar Recebimento" style="background:none; border:none; color:#16a34a; cursor:pointer;"><i data-lucide="package-check" style="width:16px;"></i></button>`;
                }
            }

            if (r.arquivo_assinatura) {
                btnHtml += `<button class="btn-acao btn-gestao-anexo-req" data-id="${r.id}" data-tem-anexo="true" title="Ficha Assinada Anexada" style="background:none; border:none; color:#10b981; cursor:pointer;"><i data-lucide="file-check-2" style="width:16px;"></i></button>`;
            } else {
                btnHtml += `<button class="btn-acao btn-gestao-anexo-req" data-id="${r.id}" data-tem-anexo="false" title="Imprimir / Anexar Ficha" style="background:none; border:none; color:var(--cnx-orange); cursor:pointer;"><i data-lucide="printer" style="width:16px;"></i></button>`;
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1.25rem; font-weight: 800; color: var(--cnx-blue);">${r.codigoFormatado}</td>
                    <td style="padding: 0.6rem 1.25rem;">${r.requisitanteNome}</td>
                    <td style="padding: 0.6rem 1.25rem;">${r.abastecedorNome}</td>
                    <td style="padding: 0.6rem 1.25rem; font-size: 0.8rem;">${dataFmt}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center;">${getStatusBadge(r.status)}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center; display: flex; justify-content: center; gap: 8px;">${btnHtml}</td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ================= ABAS DO FORMULÁRIO =================
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => { b.classList.remove('active'); b.style.borderBottomColor = 'transparent'; b.style.color = '#64748b'; });
            tabContents.forEach(c => c.style.display = 'none');
            const target = e.currentTarget;
            target.classList.add('active');
            target.style.borderBottomColor = 'var(--cnx-orange)';
            target.style.color = 'var(--cnx-blue)';
            moduloContent.querySelector(`#${target.dataset.target}`).style.display = 'block';
        });
    });

    // ================= EVENT DELEGATION GLOBAL =================
    moduloContent.addEventListener('click', async (e) => {
        
        const btnAcao = e.target.closest('.btn-acao');
        if (btnAcao) {
            const id = btnAcao.dataset.id;
            
            if (btnAcao.classList.contains('btn-ver')) abrirFormulario('visualizar', id);
            else if (btnAcao.classList.contains('btn-editar')) abrirFormulario('editar', id);
            else if (btnAcao.classList.contains('btn-aprovar')) abrirFormulario('aprovar', id);
            else if (btnAcao.classList.contains('btn-despachar')) abrirFormulario('despachar', id);
            else if (btnAcao.classList.contains('btn-receber')) abrirFormulario('receber', id);
            else if (btnAcao.classList.contains('btn-historico')) { if(window.abrirHistorico) window.abrirHistorico('requisicoes', id); }
            else if (btnAcao.classList.contains('btn-excluir')) {
                if (!permissoesAcesso.delete) {
                    window.appAlert('Acesso Negado', 'Você não tem permissão para excluir requisições.', 'error');
                    return;
                }
                const conf = await window.appConfirm('Excluir Pedido', 'Tem certeza que deseja apagar esta requisição permanentemente?', 'danger');
                if (conf) {
                    await window.db.from('requisicoes').delete().eq('id', id);
                    window.appAlert('Sucesso', 'Requisição excluída.', 'success'); buscarRequisicoes();
                }
            }
            else if (btnAcao.classList.contains('btn-reprovar')) {
                if (!permissoesAcesso.approve) {
                    window.appAlert('Acesso Negado', 'Você não tem permissão para reprovar requisições.', 'error');
                    return;
                }
                let motivo = await window.appCustomPrompt('Rejeitar Pedido', 'Por favor, informe o motivo da rejeição deste pedido:');
                if (motivo === null) return; 
                if (motivo.trim() === '') { window.appAlert('Atenção', 'É obrigatório informar o motivo para rejeitar.', 'warning'); return; }
                
                const r = todasRequisicoes.find(x => x.id === id);
                const obsFormatada = r.observacoes_solicitacao ? `${r.observacoes_solicitacao}\n\n[REJEITADO POR]: ${motivo.trim().toUpperCase()}` : `[REJEITADO POR]: ${motivo.trim().toUpperCase()}`;
                
                await window.db.from('requisicoes').update({ status: 'REJEITADA', usuario_atendente_id: usuarioLogadoId, observacoes_solicitacao: obsFormatada }).eq('id', id);
                window.appAlert('Sucesso', 'Requisição rejeitada.', 'success'); buscarRequisicoes();
            }
            else if (btnAcao.classList.contains('btn-gestao-anexo-req')) {
                abrirMenuAnexoReq(id, btnAcao.dataset.temAnexo === 'true');
            }
            return;
        }

        const btnBuscaA = e.target.closest('#btn-busca-almox-req') || e.target.closest('#req-requisitante-desc');
        if (btnBuscaA && !inReqDesc.readOnly) {
            abrirModalConsulta('almoxarifado_req'); return;
        }

        const btnBuscaAbast = e.target.closest('#btn-busca-almox-abast');
        if (btnBuscaAbast && btnBuscaAbast.style.display !== 'none') {
            abrirModalConsulta('almoxarifado_abast'); return;
        }

        const btnBuscaP = e.target.closest('#btn-busca-produto');
        if (btnBuscaP && btnBuscaP.style.display !== 'none') {
            abrirModalConsulta('produto'); return;
        }
    });

    moduloContent.addEventListener('input', (e) => {
        if (e.target.closest('#modal-req') && !e.target.classList.contains('filter-input')) {
            formFoiAlterado = true;
        }
        
        if (e.target.classList.contains('in-qtd-inline')) {
            const prodId = e.target.dataset.prodid;
            const campo = e.target.dataset.campo;
            let val = parseFloat(e.target.value) || 0;
            if (val < 0) { val = 0; e.target.value = 0; }
            
            const idx = itensReqCache.findIndex(x => x.produto_id === prodId);
            if (idx >= 0) {
                if (campo === 'solicitada') itensReqCache[idx].qtd_solicitada = val;
                if (campo === 'aprovada') {
                    if (val !== itensReqCache[idx].qtd_solicitada) itensReqCache[idx].marcadoParaJustificar = true;
                    else itensReqCache[idx].marcadoParaJustificar = false;
                    itensReqCache[idx].qtd_aprovada = val;
                }
                if (campo === 'recebida') itensReqCache[idx].qtd_recebida = val;
                calcularTotaisItens();
            }
        }
    });
    
    moduloContent.addEventListener('focusout', async (e) => {
        if (modoForm === 'aprovar' && e.target.classList.contains('in-qtd-inline') && e.target.dataset.campo === 'aprovada') {
            const prodId = e.target.dataset.prodid;
            const idx = itensReqCache.findIndex(x => x.produto_id === prodId);
            if (idx >= 0 && itensReqCache[idx].marcadoParaJustificar) {
                const motivo = await window.appCustomPrompt('Justificativa de Alteração', `O requisitante solicitou ${itensReqCache[idx].qtd_solicitada} un. Informe o motivo da alteração:`);
                if (motivo && motivo.trim() !== '') {
                    inObs.value = (inObs.value ? inObs.value + '\n' : '') + `[CORTE EM ${itensReqCache[idx].codigo}]: ${motivo.toUpperCase()}`;
                    itensReqCache[idx].marcadoParaJustificar = false;
                } else {
                    window.appAlert('Atenção', 'Motivo é obrigatório. A quantidade foi revertida.', 'warning');
                    e.target.value = itensReqCache[idx].qtd_solicitada;
                    itensReqCache[idx].qtd_aprovada = itensReqCache[idx].qtd_solicitada;
                    itensReqCache[idx].marcadoParaJustificar = false;
                    calcularTotaisItens();
                }
            }
        }
    });

    moduloContent.addEventListener('change', (e) => {
        if (e.target.closest('#modal-req') && !e.target.classList.contains('filter-input')) {
            formFoiAlterado = true;
        }
    });

    // Validação de fechamento por ESC respeitando a hierarquia de modais
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        // 1. Prompt customizado (trata o próprio ESC)
        const customPrompt = document.getElementById('custom-prompt-modal');
        if (customPrompt && customPrompt.style.display !== 'none') {
            return;
        }

        // 2. Visualizador de PDF
        const pdfModal = document.getElementById('pdf-frame-modal');
        if (pdfModal && pdfModal.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            pdfModal.style.display = 'none';
            return;
        }

        // 3. Modal de anexo / impressão
        const anexoModal = document.getElementById('modal-anexo-req');
        if (anexoModal && anexoModal.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            anexoModal.style.display = 'none';
            return;
        }

        // 4. Modal de consulta (Lupa: Almoxarifado ou Produto)
        if (modalConsulta && modalConsulta.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            modalConsulta.style.display = 'none';
            return;
        }

        // 5. Modal principal da Requisição
        if (modalReq && modalReq.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            fecharModalRequisicao();
        }
    }, true);

    // ================= MODAL DE CONSULTA (LUPA) =================
    async function abrirModalConsulta(tipo) {
        tipoConsultaAtual = tipo;
        inputBuscaConsulta.value = '';
        
        tbodyConsulta.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        modalConsulta.style.display = 'flex';
        
        if (tipo.startsWith('almoxarifado')) {
            tituloConsulta.innerHTML = `<i data-lucide="warehouse" style="color: var(--cnx-orange); width: 18px;"></i> <span>Selecionar Almoxarifado</span>`;
            theadConsulta.innerHTML = `<tr><th style="padding: 0.6rem; width: 80px; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Código</th><th style="padding: 0.6rem; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Descrição</th><th style="padding: 0.6rem; width: 60px; text-align:center; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Ação</th></tr>`;
            const { data: almoxs } = await window.db.from('almoxarifados').select('*').eq('status', 'ATIVO').order('codigo');
            almoxarifados = almoxs || [];
        } else {
            tituloConsulta.innerHTML = `<i data-lucide="package" style="color: var(--cnx-orange); width: 18px;"></i> <span>Selecionar Produto (Consumo)</span>`;
            theadConsulta.innerHTML = `<tr><th style="padding: 0.6rem; width: 80px; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Código</th><th style="padding: 0.6rem; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Descrição</th><th style="padding: 0.6rem; width: 60px; text-align:center; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Ação</th></tr>`;
            const { data: prods } = await window.db.from('produtos').select('*').eq('status', 'ATIVO').order('descricao');
            produtos = (prods || []).filter(p => String(p.tipo || p.tipo_item || '').trim().toUpperCase() === 'CONSUMO');
        }
        lucide.createIcons();
        renderizarListaConsulta();
    }

    moduloContent.querySelector('#btn-fechar-consulta').addEventListener('click', () => modalConsulta.style.display = 'none');
    inputBuscaConsulta.addEventListener('input', renderizarListaConsulta);

    function renderizarListaConsulta() {
        const termo = inputBuscaConsulta.value.trim().toUpperCase();
        let html = '';

        if (tipoConsultaAtual.startsWith('almoxarifado')) {
            let lista = [];
            if (tipoConsultaAtual === 'almoxarifado_req') lista = almoxarifados.filter(a => meusAlmoxarifadosIds.includes(a.id) && a.almoxarifado_abastecedor_id);
            else lista = almoxarifados.filter(a => meusAlmoxarifadosIds.includes(a.id));

            if (termo) {
                lista = lista.filter(a =>
                    String(a.codigo || '').toUpperCase().includes(termo) ||
                    window.fmtCod(a.codigo).toUpperCase().includes(termo) ||
                    String(a.descricao || '').toUpperCase().includes(termo)
                );
            }

            lista.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' }));
            
            if (lista.length === 0) html = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum almoxarifado disponível.</td></tr>`;
            else {
                html = lista.map(a => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem; font-weight:700;">${window.fmtCod(a.codigo)}</td>
                        <td style="padding: 0.6rem;">${a.descricao}</td>
                        <td style="padding: 0.6rem; text-align: center;"><button type="button" onclick="window.selecionarAlmoxConsulta('${a.id}')" style="background:none; border:none; cursor:pointer;" title="Selecionar"><i data-lucide="check-circle" style="color:var(--cnx-blue); width:20px;"></i></button></td>
                    </tr>
                `).join('');
            }
        } else {
            let lista = [...produtos];
            if (termo) {
                lista = lista.filter(p =>
                    String(p.codigo || '').toUpperCase().includes(termo) ||
                    window.fmtCod(p.codigo).toUpperCase().includes(termo) ||
                    String(p.descricao || '').toUpperCase().includes(termo)
                );
            }

            lista.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' }));
            
            if (lista.length === 0) html = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum produto encontrado.</td></tr>`;
            else {
                html = lista.map(p => {
                    const jaExiste = itensReqCache.some(i => i.produto_id === p.id);
                    const btn = jaExiste 
                        ? `<span style="color:#10b981; font-weight:700; font-size:0.7rem;"><i data-lucide="check" style="width:16px;"></i> Na lista</span>`
                        : `<button type="button" onclick="window.selecionarProdutoConsulta('${p.id}')" style="background:none; border:none; cursor:pointer;" title="Adicionar"><i data-lucide="plus-circle" style="color:var(--cnx-orange); width:22px;"></i></button>`;
                    return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem; font-weight:700;">${window.fmtCod(p.codigo)}</td>
                        <td style="padding: 0.6rem;">${p.descricao}</td>
                        <td style="padding: 0.6rem; text-align: center; vertical-align: middle;">${btn}</td>
                    </tr>
                    `;
                }).join('');
            }
        }
        tbodyConsulta.innerHTML = html;
        lucide.createIcons();
    }

    window.selecionarAlmoxConsulta = function(id) {
        const a = almoxarifados.find(x => x.id === id);
        if (a) {
            if (tipoConsultaAtual === 'almoxarifado_req') {
                inReqId.value = a.id;
                inReqDesc.value = `${window.fmtCod(a.codigo)} - ${a.descricao}`;
                const abast = almoxarifados.find(x => x.id === a.almoxarifado_abastecedor_id);
                if (abast) {
                    inAbastId.value = abast.id;
                    inAbastDesc.value = `${window.fmtCod(abast.codigo)} - ${abast.descricao}`;
                } else {
                    inAbastId.value = ''; inAbastDesc.value = 'Sem abastecedor fixo.';
                }
            } else if (tipoConsultaAtual === 'almoxarifado_abast') {
                inAbastId.value = a.id;
                inAbastDesc.value = `${window.fmtCod(a.codigo)} - ${a.descricao}`;
            }
            formFoiAlterado = true;
        }
        modalConsulta.style.display = 'none'; 
    };

    window.selecionarProdutoConsulta = function(id) {
        const p = produtos.find(x => x.id === id);
        if (!p) return;
        
        itensReqCache.push({ produto_id: p.id, codigo: window.fmtCod(p.codigo), descricao: p.descricao, qtd_solicitada: 1, qtd_aprovada: null, qtd_recebida: null, id: null });
        formFoiAlterado = true;
        renderizarItensRequisicao();
        modalConsulta.style.display = 'none'; 
    };

    // ================= FORMULÁRIO DE REQUISIÇÃO =================
    btnNovaReq.addEventListener('click', () => {
        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para criar requisições.', 'error');
            return;
        }
        abrirFormulario('novo', null);
    });
    
    async function fecharModalRequisicao() {
        if (formFoiAlterado && modoForm !== 'visualizar') {
            const conf = await window.appConfirm('Atenção', 'Existem alterações não guardadas. Deseja realmente sair sem salvar?', 'warning');
            if(!conf) return;
        }
        modalReq.style.display = 'none';
        formFoiAlterado = false;
    }
    moduloContent.querySelector('#btn-fechar-req').addEventListener('click', fecharModalRequisicao);

    async function abrirFormulario(modo, reqId) {
        const mapaModoPerm = { novo: 'create', editar: 'edit', aprovar: 'approve', despachar: 'dispatch', receber: 'receive' };
        if (mapaModoPerm[modo] && !permissoesAcesso[mapaModoPerm[modo]]) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para executar esta ação.', 'error');
            return;
        }

        modoForm = modo;
        reqEmEdicaoId = reqId;
        itensReqCache = [];
        itensRemovidosDB = [];
        
        inReqId.value = ''; inReqDesc.value = ''; inAbastId.value = ''; inAbastDesc.value = ''; 
        inObs.value = ''; inNumPedido.value = ''; inDadosEnvio.value = '';
        lblUserSol.innerText = 'Registro pendente...'; lblUserAtd.innerText = 'Aguardando atendimento...';
        
        badgeStatusModal.innerHTML = '';
        tabBtns[0].click(); 

        const colsAprov = moduloContent.querySelectorAll('.col-aprov');
        const colsReceb = moduloContent.querySelectorAll('.col-receb');
        const colsAcao = moduloContent.querySelectorAll('.col-acao');
        const btnBuscaAbast = moduloContent.querySelector('#btn-busca-almox-abast');
        
        inReqDesc.readOnly = false;
        if (btnBuscaProduto) btnBuscaProduto.style.display = 'flex';
        inObs.disabled = false;
        inNumPedido.disabled = false;
        inDadosEnvio.disabled = false;
        
        if (painelEnvio) painelEnvio.style.display = 'none';
        if (btnBuscaAbast) btnBuscaAbast.style.display = (isGestor && (modo === 'novo' || modo === 'editar')) ? 'block' : 'none';
        
        if (modo === 'novo') {
            modalTitulo.innerHTML = `<i data-lucide="shopping-cart" style="color: var(--cnx-orange); width: 20px;"></i> <span>Nova Requisição</span>`;
            colsAprov.forEach(el => el.style.display = 'none');
            colsReceb.forEach(el => el.style.display = 'none');
            colsAcao.forEach(el => el.style.display = 'table-cell');
            montarFooterFormulario(true);

            const chkFooterAtivos = Array.from(document.querySelectorAll('.chk-almox-item:checked'));
            if (chkFooterAtivos.length === 1) {
                const idFiltro = chkFooterAtivos[0].value;
                const a = almoxarifados.find(x => x.id === idFiltro && x.almoxarifado_abastecedor_id);
                if(a) { tipoConsultaAtual = 'almoxarifado_req'; window.selecionarAlmoxConsulta(a.id); }
            } else {
                const listaValida = almoxarifados.filter(a => meusAlmoxarifadosIds.includes(a.id) && a.almoxarifado_abastecedor_id);
                if (listaValida.length === 1) {
                    tipoConsultaAtual = 'almoxarifado_req'; window.selecionarAlmoxConsulta(listaValida[0].id);
                }
            }
            formFoiAlterado = false;

        } else {
            const r = todasRequisicoes.find(x => x.id === reqId);
            if (!r) return;
            
            modalTitulo.innerHTML = `<i data-lucide="shopping-cart" style="color: var(--cnx-orange); width: 20px;"></i> <span>Requisição ${r.codigoFormatado}</span>`;
            badgeStatusModal.innerHTML = getStatusBadge(r.status);
            
            inReqId.value = r.almoxarifado_requisitante_id;
            inReqDesc.value = r.requisitanteNome;
            inAbastId.value = r.almoxarifado_abastecedor_id;
            inAbastDesc.value = r.abastecedorNome;
            
            inObs.value = r.observacoes_solicitacao || '';
            inNumPedido.value = r.numero_pedido || '';
            inDadosEnvio.value = r.dados_envio || '';

            lblUserSol.innerText = r.solicitanteNome;
            lblUserAtd.innerText = r.atendenteNome;

            const { data: itens } = await window.db.from('requisicao_itens').select('*, produtos(codigo, descricao)').eq('requisicao_id', reqId);
            if (itens) {
                itensReqCache = itens.map(i => ({
                    id: i.id,
                    produto_id: i.produto_id,
                    codigo: i.produtos ? window.fmtCod(i.produtos.codigo) : '-',
                    descricao: i.produtos ? i.produtos.descricao : 'Item Excluído',
                    qtd_solicitada: i.qtd_solicitada,
                    qtd_aprovada: i.qtd_aprovada,
                    qtd_enviada: i.qtd_enviada,
                    qtd_recebida: i.qtd_recebida
                }));
            }

            inReqDesc.readOnly = true;

            if (modo === 'visualizar') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'none'; 
                inObs.disabled = true; inNumPedido.disabled = true; inDadosEnvio.disabled = true;
                
                colsAprov.forEach(el => el.style.display = r.status !== 'PENDENTE' ? 'table-cell' : 'none');
                colsReceb.forEach(el => el.style.display = (r.status === 'CONCLUIDA' || r.status === 'ENVIADA' || r.status === 'DIVERGENCIA') ? 'table-cell' : 'none');
                colsAcao.forEach(el => el.style.display = 'none');
                
                if (painelEnvio && (r.status === 'APROVADA' || r.status === 'ENVIADA' || r.status === 'CONCLUIDA' || r.status === 'DIVERGENCIA')) {
                    painelEnvio.style.display = 'block';
                }
                montarFooterFormulario(false);
                
            } else if (modo === 'editar') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'flex'; 
                inObs.disabled = false;
                colsAprov.forEach(el => el.style.display = 'none');
                colsReceb.forEach(el => el.style.display = 'none');
                colsAcao.forEach(el => el.style.display = 'table-cell');
                montarFooterFormulario(true);
                
            } else if (modo === 'aprovar') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'none'; 
                inObs.disabled = true; 
                colsAprov.forEach(el => el.style.display = 'table-cell');
                colsReceb.forEach(el => el.style.display = 'none');
                colsAcao.forEach(el => el.style.display = 'table-cell'); 
                montarFooterFormulario(true, 'Aprovar / Separar');
                
            } else if (modo === 'despachar') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'none'; 
                inObs.disabled = true; 
                colsAprov.forEach(el => el.style.display = 'table-cell');
                colsReceb.forEach(el => el.style.display = 'none');
                colsAcao.forEach(el => el.style.display = 'none');
                if (painelEnvio) painelEnvio.style.display = 'block';
                montarFooterFormulario(true, 'Confirmar Envio (Faturamento)');
                
            } else if (modo === 'receber') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'none'; 
                inObs.disabled = true; inNumPedido.disabled = true; inDadosEnvio.disabled = true;
                if (painelEnvio) painelEnvio.style.display = 'block';
                colsAprov.forEach(el => el.style.display = 'table-cell');
                colsReceb.forEach(el => el.style.display = 'table-cell');
                colsAcao.forEach(el => el.style.display = 'none');
                montarFooterFormulario(true, 'Confirmar Recebimento');
            }
            formFoiAlterado = false; 
        }
        
        renderizarItensRequisicao();
        modalReq.style.display = 'flex';
        lucide.createIcons();
    }

    window.removerItemReq = async function(prodId) {
        const item = itensReqCache.find(x => x.produto_id === prodId);
        if (!item) return;

        if (modoForm === 'aprovar') {
            const conf = await window.appConfirm('Cortar Item', `Deseja realmente remover o item ${item.codigo} do pedido?`, 'warning');
            if (!conf) return;

            const motivo = await window.appCustomPrompt('Justificativa de Corte', `Informe o motivo para cortar o item ${item.codigo} da separação:`);
            if (motivo === null) return;
            if (motivo.trim() === '') { window.appAlert('Atenção', 'É obrigatório informar o motivo do corte.', 'warning'); return; }
            inObs.value = (inObs.value ? inObs.value + '\n' : '') + `[ITEM CORTADO - ${item.codigo}]: ${motivo.toUpperCase()}`;
        }

        if (item.id) itensRemovidosDB.push(item.id); 
        
        itensReqCache = itensReqCache.filter(x => x.produto_id !== prodId);
        formFoiAlterado = true;
        renderizarItensRequisicao();
    };

    function calcularTotaisItens() {
        if(lblTotalTipos) lblTotalTipos.innerText = itensReqCache.length;
        let soma = 0;
        itensReqCache.forEach(i => {
            if (modoForm === 'novo' || modoForm === 'editar') soma += (parseFloat(i.qtd_solicitada) || 0);
            else if (modoForm === 'aprovar' || modoForm === 'despachar' || modoForm === 'visualizar') soma += (parseFloat(i.qtd_aprovada) || parseFloat(i.qtd_solicitada) || 0);
            else if (modoForm === 'receber') soma += (parseFloat(i.qtd_recebida) || parseFloat(i.qtd_enviada) || 0);
        });
        if(lblSomaGeral) lblSomaGeral.innerText = soma;
    }

    function renderizarItensRequisicao() {
        calcularTotaisItens();

        if (itensReqCache.length === 0) {
            tbodyItens.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: #94a3b8;">Nenhum produto adicionado.</td></tr>`;
            return;
        }

        tbodyItens.innerHTML = itensReqCache.map(i => {
            let acaoHtml = `<td style="display:none;"></td>`;
            if (modoForm === 'novo' || modoForm === 'editar' || modoForm === 'aprovar') {
                acaoHtml = `<td style="padding: 0.5rem; text-align: center;"><button type="button" onclick="window.removerItemReq('${i.produto_id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Excluir/Cortar Item"><i data-lucide="trash-2" style="width: 14px;"></i></button></td>`;
            }

            let solHtml = `<td style="padding: 0.5rem; text-align: center; font-weight: 800;">${i.qtd_solicitada}</td>`;
            if (modoForm === 'novo' || modoForm === 'editar') {
                solHtml = `<td style="padding: 0.5rem; text-align: center;"><input type="number" class="in-qtd-inline input-standard" data-prodid="${i.produto_id}" data-campo="solicitada" value="${i.qtd_solicitada}" min="1" style="width: 70px; padding: 4px; text-align: center; border: 1px solid #cbd5e1; font-weight:800;"></td>`;
            }

            let aprovHtml = `<td style="display:none;"></td>`;
            if (modoForm === 'aprovar') {
                const valAprov = i.qtd_aprovada !== null ? i.qtd_aprovada : i.qtd_solicitada; 
                aprovHtml = `<td style="padding: 0.5rem; text-align: center;"><input type="number" class="in-qtd-inline input-standard" data-prodid="${i.produto_id}" data-campo="aprovada" value="${valAprov}" min="0" style="width: 70px; padding: 4px; text-align: center; border: 1px solid #f97316; font-weight:800; color:#ea580c;"></td>`;
            } else if (moduloContent.querySelector('.col-aprov').style.display !== 'none') {
                aprovHtml = `<td style="padding: 0.5rem; text-align: center; font-weight:700; color:#ea580c;">${i.qtd_aprovada !== null ? i.qtd_aprovada : '-'}</td>`;
            }

            let recebHtml = `<td style="display:none;"></td>`;
            if (modoForm === 'receber') {
                const valReceb = i.qtd_recebida !== null ? i.qtd_recebida : i.qtd_enviada; 
                recebHtml = `<td style="padding: 0.5rem; text-align: center;"><input type="number" class="in-qtd-inline input-standard" data-prodid="${i.produto_id}" data-campo="recebida" value="${valReceb}" min="0" style="width: 70px; padding: 4px; text-align: center; border: 1px solid #16a34a; font-weight:800; color:#16a34a;"></td>`;
            } else if (moduloContent.querySelector('.col-receb').style.display !== 'none') {
                recebHtml = `<td style="padding: 0.5rem; text-align: center; font-weight:700; color:#16a34a;">${i.qtd_recebida !== null ? i.qtd_recebida : '-'}</td>`;
            }

            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.5rem; font-weight:700;">${i.codigo}</td>
                <td style="padding: 0.5rem;">${i.descricao}</td>
                ${solHtml}
                ${aprovHtml}
                ${recebHtml}
                ${acaoHtml}
            </tr>`;
        }).join('');
        lucide.createIcons();
    }

    function montarFooterFormulario(showSave, saveText = 'Salvar Requisição') {
        if (!showSave) {
            footerReq.innerHTML = `<div style="flex:1;"></div> <button class="btn-cancel" id="btn-fechar-visao">Fechar Visão</button>`;
            footerReq.querySelector('#btn-fechar-visao').addEventListener('click', fecharModalRequisicao);
        } else {
            let icon = 'save';
            let bgColor = 'var(--cnx-blue)';
            if (modoForm === 'aprovar') { icon = 'check-square'; bgColor = '#10b981'; }
            if (modoForm === 'despachar') { icon = 'truck'; bgColor = 'var(--cnx-orange)'; }
            if (modoForm === 'receber') { icon = 'package-check'; bgColor = '#16a34a'; }

            footerReq.innerHTML = `
                <button class="btn-cancel" id="btn-cancel-form">Cancelar</button>
                <button class="btn-save" id="btn-salvar-form" style="background: ${bgColor}; color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <i data-lucide="${icon}" style="width: 16px; color: white;"></i> <span>${saveText}</span>
                </button>
            `;
            footerReq.querySelector('#btn-cancel-form').addEventListener('click', fecharModalRequisicao);
            footerReq.querySelector('#btn-salvar-form').addEventListener('click', executarAcoesFormulario);
        }
        lucide.createIcons();
    }

    async function executarAcoesFormulario() {
        if (!formFoiAlterado && modoForm === 'editar') {
            window.appAlert('Aviso', 'Nenhuma alteração foi feita no pedido para ser guardada.', 'info');
            return;
        }
        if (!formFoiAlterado && modoForm === 'novo') {
            window.appAlert('Aviso', 'O formulário está vazio.', 'info');
            return;
        }

        const conf = await window.appConfirm('Confirmação', `Deseja realmente ${modoForm === 'novo' || modoForm === 'editar' ? 'salvar' : modoForm} este pedido?`);
        if(!conf) return;

        if (modoForm === 'novo' || modoForm === 'editar') await salvarNovoOuEditar();
        else if (modoForm === 'aprovar') await aprovarRequisicao();
        else if (modoForm === 'despachar') await despacharRequisicao();
        else if (modoForm === 'receber') await receberRequisicao();
    }

    async function salvarNovoOuEditar() {
        const idReq = inReqId.value;
        const idAbast = inAbastId.value;

        if (!idReq || !idAbast) { window.appAlert("Erro", "Destino não possui Almoxarifado de Origem válido configurado.", "error"); return; }
        if (itensReqCache.length === 0) { window.appAlert("Atenção", "Adicione pelo menos um produto.", "warning"); return; }

        const btnSave = footerReq.querySelector('#btn-salvar-form');
        btnSave.disabled = true; btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Aguarde...`;

        try {
            const payloadReq = {
                almoxarifado_requisitante_id: idReq,
                almoxarifado_abastecedor_id: idAbast,
                status: 'PENDENTE',
                observacoes_solicitacao: inObs.value.trim().toUpperCase()
            };

            let currentReqId = reqEmEdicaoId;

            if (modoForm === 'novo') {
                payloadReq.usuario_solicitante_id = usuarioLogadoId;
                const { data: newReq, error: errReq } = await window.db.from('requisicoes').insert([payloadReq]).select('id').single();
                if (errReq) throw errReq;
                currentReqId = newReq.id;
                
                const payloadItens = itensReqCache.map(i => ({ requisicao_id: currentReqId, produto_id: i.produto_id, qtd_solicitada: i.qtd_solicitada }));
                await window.db.from('requisicao_itens').insert(payloadItens);
            } else {
                const { error: errReq } = await window.db.from('requisicoes').update(payloadReq).eq('id', currentReqId);
                if (errReq) throw errReq;
                
                if (itensRemovidosDB.length > 0) {
                    await window.db.from('requisicao_itens').delete().in('id', itensRemovidosDB);
                }

                for (const i of itensReqCache) {
                    if (i.id) {
                        await window.db.from('requisicao_itens').update({ qtd_solicitada: i.qtd_solicitada }).eq('id', i.id);
                    } else {
                        await window.db.from('requisicao_itens').insert([{ requisicao_id: currentReqId, produto_id: i.produto_id, qtd_solicitada: i.qtd_solicitada }]);
                    }
                }
            }

            formFoiAlterado = false;
            window.appAlert("Sucesso", "Requisição gravada com sucesso!", "success");
            modalReq.style.display = 'none';
            await buscarRequisicoes();
        } catch (e) { console.error(e); window.appAlert("Erro", "Falha ao gravar requisição.", "error"); } 
        finally { btnSave.disabled = false; btnSave.innerHTML = `Salvar Requisição`; }
    }

    async function aprovarRequisicao() {
        if (itensReqCache.length === 0) { window.appAlert('Atenção', 'A requisição não possui itens para aprovar. Rejeite-a ou cancele.', 'warning'); return; }
        
        try {
            await window.db.from('requisicoes').update({ status: 'APROVADA', usuario_atendente_id: usuarioLogadoId, observacoes_solicitacao: inObs.value }).eq('id', reqEmEdicaoId);
            
            if (itensRemovidosDB.length > 0) {
                await window.db.from('requisicao_itens').delete().in('id', itensRemovidosDB);
            }

            for (const i of itensReqCache) {
                const valAprov = i.qtd_aprovada !== null ? i.qtd_aprovada : i.qtd_solicitada;
                await window.db.from('requisicao_itens').update({ qtd_aprovada: valAprov }).eq('id', i.id);
            }

            formFoiAlterado = false;
            window.appAlert('Sucesso', 'Requisição aprovada. Já pode confirmar o envio.', 'success');
            modalReq.style.display = 'none'; await buscarRequisicoes();
        } catch (e) { console.error(e); window.appAlert('Erro', 'Falha ao aprovar pedido.', 'error'); }
    }
    
    async function despacharRequisicao() {
        const num = inNumPedido.value.trim().toUpperCase();
        const transp = inDadosEnvio.value.trim().toUpperCase();
        
        if (!num || !transp) { window.appAlert('Atenção', 'Informe o N.º do Pedido de Faturamento e os Dados de Transporte antes de despachar.', 'warning'); return; }

        try {
            await window.db.from('requisicoes').update({ status: 'ENVIADA', numero_pedido: num, dados_envio: transp }).eq('id', reqEmEdicaoId);
            
            for (const i of itensReqCache) { 
                await window.db.from('requisicao_itens').update({ qtd_enviada: i.qtd_aprovada }).eq('id', i.id); 
            }
            
            formFoiAlterado = false;
            window.appAlert('Sucesso', 'Materiais despachados com sucesso!', 'success');
            modalReq.style.display = 'none'; await buscarRequisicoes();
        } catch (e) { console.error(e); window.appAlert('Erro', 'Falha ao despachar pedido.', 'error'); }
    }

    async function receberRequisicao() {
        try {
            let divergencias = [];
            for (const i of itensReqCache) {
                const qtdOrigem = i.qtd_aprovada !== null ? i.qtd_aprovada : i.qtd_solicitada;
                const receb = i.qtd_recebida !== null ? i.qtd_recebida : qtdOrigem;
                await window.db.from('requisicao_itens').update({ qtd_recebida: receb }).eq('id', i.id);

                if (Number(qtdOrigem) !== Number(receb)) {
                    divergencias.push({
                        requisicao_id: reqEmEdicaoId,
                        produto_id: i.produto_id,
                        qtd_enviada: qtdOrigem,
                        qtd_recebida: receb,
                        justificativa: 'Divergência de conferência no recebimento.'
                    });
                }
            }

            if (divergencias.length > 0) {
                await window.db.from('requisicoes').update({ status: 'DIVERGENCIA' }).eq('id', reqEmEdicaoId);
                await window.db.from('requisicao_divergencias').insert(divergencias);
                window.appAlert('Recebido com Divergência', `Recebimento concluído. Foram reportadas divergências em ${divergencias.length} item(ns).`, 'warning', 4500);
            } else {
                await window.db.from('requisicoes').update({ status: 'CONCLUIDA' }).eq('id', reqEmEdicaoId);
                window.appAlert('Sucesso', 'Recebimento concluído sem divergências!', 'success');
            }

            formFoiAlterado = false;
            modalReq.style.display = 'none'; await buscarRequisicoes();
        } catch (e) { console.error(e); window.appAlert('Erro', 'Falha ao processar recebimento.', 'error'); }
    }

    // ================= GESTÃO DE IMPRESSÃO E ANEXO DE PDF =================
    let reqIdParaAnexo = null;

    window.abrirMenuAnexoReq = function(id, temAnexo) {
        reqIdParaAnexo = id;
        const container = document.getElementById('acoes-anexo-req-container');
        
        if (temAnexo) {
            container.innerHTML = `
                <button onclick="window.visualizarAnexoReq()" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="eye" style="width: 18px; color: #10b981;"></i> Visualizar ficha assinada</button>
                ${isGestor ? `<button onclick="window.apagarAnexoReq()" style="background: #fef2f2; border: 1px solid #fecaca; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: #991b1b; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="trash-2" style="width: 18px;"></i> Apagar anexo</button>` : ''}
            `;
        } else {
            container.innerHTML = `
                <button onclick="window.imprimirGuiaPDF()" style="background: var(--cnx-blue); border: none; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="printer" style="width: 18px; color: var(--cnx-orange);"></i> Imprimir guia p/ assinatura</button>
                <div style="text-align: center; margin: 4px 0; color: #94a3b8; font-size: 0.7rem; font-weight: 700;">OU</div>
                <button onclick="document.getElementById('input-upload-pdf-req').click()" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="upload-cloud" style="width: 18px; color: #10b981;"></i> Anexar PDF assinado</button>
            `;
        }
        document.getElementById('modal-anexo-req').style.display = 'flex';
        lucide.createIcons();
    };

    window.imprimirGuiaPDF = async function() {
        if (!window.jspdf) { window.appAlert('Erro', 'Biblioteca PDF indisponível.', 'error'); return; }
        
        const modalAcoes = document.getElementById('modal-anexo-req');
        if (modalAcoes) modalAcoes.style.display = 'none';

        // Injeta modal iFrame
        if (!document.getElementById('pdf-frame-modal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal-overlay" id="pdf-frame-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 11000; align-items: center; justify-content: center; padding: 1rem;">
                    <div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
                        <div style="background: #334155; padding: 0.8rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; color: white; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="file-text" style="color: #cbd5e1; width: 18px;"></i> Visualizador de Documento
                            </h3>
                            <button onclick="document.getElementById('pdf-frame-modal').style.display='none'" style="background: none; border: none; color: white; cursor: pointer;"><i data-lucide="x"></i></button>
                        </div>
                        <iframe id="pdf-iframe" style="flex: 1; width: 100%; border: none; background: #e2e8f0;"></iframe>
                    </div>
                </div>
            `);
            lucide.createIcons();
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4'); 
            const r = todasRequisicoes.find(x => x.id === reqIdParaAnexo);
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margemEsq = 40;
            const margemDir = pageWidth - 40; 

            // CABEÇALHO COMPACTO
            const imgUrl = '../assets/imagens/Logo.png';
            try {
                const img = new Image(); img.src = imgUrl;
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
                doc.addImage(img, 'PNG', margemEsq, 25, 45, 45); 
            } catch (err) {
                doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(242, 101, 34);
                doc.text("CNX", margemEsq, 50); doc.setTextColor(0, 43, 91); doc.text("TELECOM", 75, 50);
            }

            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0, 43, 91); 
            doc.text("CNX TELECOM LTDA", 100, 40);
            
            doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal");
            doc.text("Fone: (64) 3404-8181    Email: atendimento@cnx.net.br", 100, 52);
            doc.text("RUA DIVINÓPOLIS - Itumbiara - GO - 75513-150", 100, 64);
            
            // TÍTULO
            doc.setFontSize(14); doc.setTextColor(242, 101, 34); doc.setFont("helvetica", "bold");
            doc.text("FICHA DE SEPARAÇÃO E ENVIO DE MATERIAIS", pageWidth / 2, 100, { align: 'center' }); 

            // DADOS DA REQUISIÇÃO
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
            
            doc.text(`Requisição N.º: ${r.codigoFormatado}`, margemEsq, 130);
            doc.text(`Data Solicitação: ${new Date(r.criado_em).toLocaleDateString('pt-BR')}`, margemDir, 130, { align: 'right' });
            
            doc.text(`Solicitante (Destino): ${r.requisitanteNome}`, margemEsq, 145);
            if (r.numero_pedido) {
                doc.setFont("helvetica", "bold"); doc.text(`Pedido ERP: ${r.numero_pedido}`, margemDir, 145, { align: 'right' }); doc.setFont("helvetica", "normal");
            }
            
            doc.text(`Abastecedor (Origem): ${r.abastecedorNome}`, margemEsq, 160);
            doc.text(`Usuário Solicitante: ${r.solicitanteNome}`, margemDir, 160, { align: 'right' });
            
            // TABELA
            const { data: itensDB } = await window.db.from('requisicao_itens').select('qtd_solicitada, qtd_aprovada, qtd_enviada, produtos(codigo, descricao)').eq('requisicao_id', reqIdParaAnexo);
            const colunas = [["Código", "Produto", "Qtd Enviada", "Check"]];
            const linhas = (itensDB || []).map(i => [
                i.produtos?.codigo ? window.fmtCod(i.produtos.codigo) : '-', 
                i.produtos?.descricao || '-', 
                i.qtd_enviada !== null ? i.qtd_enviada : (i.qtd_aprovada !== null ? i.qtd_aprovada : i.qtd_solicitada), 
                ""
            ]);

            doc.autoTable({
                startY: 180, head: colunas, body: linhas, theme: 'grid',
                headStyles: { fillColor: [0, 43, 91], textColor: [255,255,255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 70, halign: 'center' }, 3: { cellWidth: 50 } },
                margin: { bottom: 120 } 
            });

            // RODAPÉ FIXO (ÚLTIMA PÁGINA)
            const finalY = pageHeight - 60;
            doc.line(40, finalY, 250, finalY); doc.text("Assinatura Abastecedor / Separação", 40, finalY + 15);
            doc.line(300, finalY, margemDir, finalY); doc.text("Assinatura Conferência / Transporte", 300, finalY + 15);

            const horaAtual = new Date().toLocaleString('pt-BR');
            doc.setFontSize(7); doc.setTextColor(150, 150, 150);
            doc.text(`Impresso em: ${horaAtual} por ${nomeUsuarioLogado}`, margemEsq, pageHeight - 15);

            const iframe = document.getElementById('pdf-iframe');
            const frameModal = document.getElementById('pdf-frame-modal');
            if (iframe && frameModal) {
                iframe.src = doc.output('bloburl');
                frameModal.style.display = 'flex';
            }
        } catch(e) { console.error("Falha ao gerar PDF", e); }
    };

    // LOGICA DE UPLOAD E VISUALIZACAO (IGUAL AOS EMPRÉSTIMOS)
    document.getElementById('input-upload-pdf-req').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !reqIdParaAnexo) return;
        
        document.getElementById('modal-anexo-req').style.display = 'none';
        const msgAlerta = window.appAlert('Aguarde', 'Fazendo upload da ficha assinada...', 'info', 10000);

        try {
            const r = todasRequisicoes.find(x => x.id === reqIdParaAnexo);
            const fileName = `REQ-${r.codigoFormatado}_${Date.now()}.pdf`;
            
            const { data, error } = await window.db.storage.from('requisicoes-assinaturas').upload(fileName, file);
            if (error) throw error;

            const { data: publicUrlData } = window.db.storage.from('requisicoes-assinaturas').getPublicUrl(data.path);
            
            await window.db.from('requisicoes').update({ arquivo_assinatura: publicUrlData.publicUrl }).eq('id', reqIdParaAnexo);
            
            window.appAlert('Sucesso', 'Ficha anexada com sucesso!', 'success');
            buscarRequisicoes();
        } catch (err) {
            console.error(err); window.appAlert('Erro', 'Falha ao anexar o arquivo.', 'error');
        } finally { e.target.value = ''; }
    });

    window.visualizarAnexoReq = function() {
        document.getElementById('modal-anexo-req').style.display = 'none';
        const r = todasRequisicoes.find(x => x.id === reqIdParaAnexo);
        
        if (r && r.arquivo_assinatura) {
            if (!document.getElementById('pdf-frame-modal')) {
                // Injeta iFrame se por acaso falhou antes
                document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="pdf-frame-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 11000; align-items: center; justify-content: center; padding: 1rem;"><div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;"><div style="background: #334155; padding: 0.8rem 1.5rem; display: flex; justify-content: space-between; align-items: center;"><h3 style="margin: 0; color: white; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;"><i data-lucide="file-text" style="color: #cbd5e1; width: 18px;"></i> Visualizador de Documento</h3><button onclick="document.getElementById('pdf-frame-modal').style.display='none'" style="background: none; border: none; color: white; cursor: pointer;"><i data-lucide="x"></i></button></div><iframe id="pdf-iframe" style="flex: 1; width: 100%; border: none; background: #e2e8f0;"></iframe></div></div>`);
                lucide.createIcons();
            }
            const iframe = document.getElementById('pdf-iframe');
            const frameModal = document.getElementById('pdf-frame-modal');
            if (iframe && frameModal) {
                iframe.src = r.arquivo_assinatura;
                frameModal.style.display = 'flex';
            }
        }
    };

    window.apagarAnexoReq = async function() {
        document.getElementById('modal-anexo-req').style.display = 'none';
        const r = todasRequisicoes.find(x => x.id === reqIdParaAnexo);
        if (!r || !r.arquivo_assinatura) return;

        const conf = await window.appConfirm('Apagar Ficha', 'Tem certeza que deseja apagar a ficha assinada desta requisição?', 'danger');
        if (!conf) return;

        try {
            const urlParts = r.arquivo_assinatura.split('/');
            const fileName = urlParts[urlParts.length - 1];
            
            await window.db.storage.from('requisicoes-assinaturas').remove([fileName]);
            await window.db.from('requisicoes').update({ arquivo_assinatura: null }).eq('id', reqIdParaAnexo);
            
            window.appAlert('Sucesso', 'Ficha apagada.', 'success');
            buscarRequisicoes();
        } catch (e) { console.error(e); window.appAlert('Erro', 'Falha ao apagar ficheiro.', 'error'); }
    };

    carregarDadosIniciais();
})();