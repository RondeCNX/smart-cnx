// js/emprestimos.js
(async function initModuloEmprestimos() {
    console.log("Módulo Empréstimos carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-emprestimos .modulo-container');
    if (!moduloContent) return;

    const oldRefresh = moduloContent.querySelector('#btn-refresh-grid');
    if (oldRefresh) oldRefresh.remove();

    const tbodyEmps = moduloContent.querySelector('#tbody-emprestimos');
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
            buscarEmprestimos().then(() => { if(icon) icon.classList.remove('lucide-spin'); });
        });
        lucide.createIcons();
    }

    let filtrosAtivos = [];
    let sortConfig = { key: 'codigo', direction: 'desc' };

    const btnNovoEmp = moduloContent.querySelector('#btn-novo-emp');
    const modalEmp = moduloContent.querySelector('#modal-emp');
    const modalTitulo = moduloContent.querySelector('#modal-titulo-emp');
    const badgeStatusModal = moduloContent.querySelector('#badge-status-modal');
    const footerEmp = moduloContent.querySelector('#modal-emp-footer');
    
    const tabBtns = moduloContent.querySelectorAll('.tab-form-btn');
    const tabContents = moduloContent.querySelectorAll('.tab-form-content');

    const inEmpId = moduloContent.querySelector('#emp-almox-id');
    const inEmpDesc = moduloContent.querySelector('#emp-almox-desc');
    const inResponsavel = moduloContent.querySelector('#emp-responsavel');
    const inDataSaida = moduloContent.querySelector('#emp-data-saida');
    const inDataPrev = moduloContent.querySelector('#emp-data-prev');
    
    const inObs = moduloContent.querySelector('#emp-obs');
    const painelDevolucao = moduloContent.querySelector('#painel-devolucao');
    const inDataDev = moduloContent.querySelector('#emp-data-devolucao');
    const inObsDev = moduloContent.querySelector('#emp-obs-devolucao');
    
    const btnBuscaProduto = moduloContent.querySelector('#btn-busca-produto');
    const tbodyItens = moduloContent.querySelector('#tbody-itens-emp');
    const hintEdicao = moduloContent.querySelector('#hint-edicao-qtd');

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
    let almoxarifadosVinculadosIds = []; 
    let almoxarifados = [];
    let produtos = [];
    let todosEmprestimos = [];
    
    let modoForm = 'novo'; 
    let empEmEdicaoId = null;
    let itensEmpCache = [];
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

    if (!window.appCustomPrompt) {
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
    }

    // ================= CARGA DE DADOS =================
    async function carregarDadosIniciais() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return;
            usuarioLogadoId = session.user.id;

            const { data: user } = await window.db.from('usuarios').select('nome_completo, acesso_todos_almoxarifados, cargos(nome)').eq('id', usuarioLogadoId).single();
            nomeUsuarioLogado = user?.nome_completo || '';
            
            const upperCargo = user?.cargos?.nome?.toUpperCase() || '';
            isAdmin = upperCargo === 'ADMINISTRADOR';
            isGestor = isAdmin || upperCargo.includes('SUPERVISOR');
            acessoTodos = isAdmin || !!user?.acesso_todos_almoxarifados;

            await buscarEmprestimos();
        } catch (e) { console.error(e); }
    }

    async function buscarEmprestimos() {
        tbodyEmps.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        lucide.createIcons();

        const { data: resAlmox } = await window.db.from('almoxarifados').select('*').eq('status', 'ATIVO').order('codigo');
        almoxarifados = resAlmox || [];
        
        const { data: vincs } = await window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', usuarioLogadoId);
        const acessosDiretos = vincs ? vincs.map(v => v.almoxarifado_id) : [];
        almoxarifadosVinculadosIds = acessoTodos ? almoxarifados.map(a => a.id) : acessosDiretos;

        let query = window.db.from('emprestimos')
            .select(`*, usuarios(nome_completo), almoxarifado:almoxarifados(codigo, descricao), itens:emprestimo_itens(status, produtos(descricao, codigo))`)
            .order('codigo', { ascending: false });

        if (!acessoTodos) {
            const idsFmt = almoxarifadosVinculadosIds.map(i => `"${i}"`).join(',');
            if (idsFmt) query = query.in('almoxarifado_id', almoxarifadosVinculadosIds);
            else { todosEmprestimos = []; aplicarFiltrosEOrdenar(); return; }
        }

        const { data, error } = await query;
        if (error) { tbodyEmps.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Erro ao buscar empréstimos.</td></tr>`; return; }

        const hoje = new Date(); hoje.setHours(0,0,0,0);

        todosEmprestimos = (data || []).map(r => {
            const nomesEquips = r.itens ? r.itens.map(i => i.produtos?.descricao).join(' ') : '';
            
            let statusCalc = r.status;
            if (statusCalc === 'ATIVO' && r.previsao_devolucao) {
                const prev = new Date(r.previsao_devolucao + 'T12:00:00');
                if (prev < hoje) statusCalc = 'ATRASADO';
            }

            return {
                ...r,
                codigoFormatado: String(r.codigo).padStart(6, '0'),
                equipamentosBusca: nomesEquips.toUpperCase(),
                statusCalculado: statusCalc
            };
        });

        if (lblTotalGeral) lblTotalGeral.innerText = todosEmprestimos.length;
        
        if(!Array.from(inputStatus.options).find(o => o.value === 'DEVOLUCAO PARCIAL')){
            inputStatus.innerHTML += `<option value="DEVOLUCAO PARCIAL">DEVOLUÇÃO PARCIAL</option>`;
        }
        
        aplicarFiltrosEOrdenar();
    }

    function getStatusBadge(status) {
        switch (status) {
            case 'ATIVO': return `<span style="background: #bae6fd; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ATIVO</span>`;
            case 'ATRASADO': return `<span style="background: #fef08a; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ATRASADO</span>`;
            case 'DEVOLUCAO PARCIAL': return `<span style="background: #e9d5ff; color: #7e22ce; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">DEVOLUÇÃO PARCIAL</span>`;
            case 'DEVOLVIDO': return `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">DEVOLVIDO</span>`;
            case 'CANCELADO': return `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">CANCELADO</span>`;
            default: return `<span style="background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">${status}</span>`;
        }
    }

    // ================= LÓGICA DE FILTROS =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');
        if (val === 'status') { inputStatus.style.display = 'block'; wrapperTexto.style.display = 'none'; } 
        else if (val === 'data_emprestimo' || val === 'data_devolucao') { inputData.style.display = 'block'; wrapperTexto.style.display = 'none'; }
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
        } else if (campo === 'data_emprestimo' || campo === 'data_devolucao') {
            valor = inputData.value; if (!valor) return;
            const dt = new Date(valor + 'T12:00:00'); labelValor = dt.toLocaleDateString('pt-BR'); exato = true;
        } else {
            valor = inputTexto.value.trim().toUpperCase(); if (!valor) return;
            labelValor = valor; exato = chkExato.checked; inputTexto.value = ''; 
        }
        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    }

    window.removerFiltroEmp = function(idFiltro) {
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
        
        containerTagsInline.style.display = 'flex';
        containerTagsInline.style.gap = '4px';
        containerTagsInline.style.alignItems = 'center';
        containerTagsInline.innerHTML = '';
        
        if (filtrosAtivos.length === 0) { 
            lblFiltrosAtivos.style.display = 'inline'; 
            return; 
        }
        
        lblFiltrosAtivos.style.display = 'none';

        const firstFiltro = filtrosAtivos[0];
        const isExato = firstFiltro.exato && firstFiltro.campo !== 'status' && !firstFiltro.campo.includes('data') ? ' (Exato)' : '';
        
        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span><strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroEmp(${firstFiltro.id})">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i>
                </button>
            </div>
        `;

        if (filtrosAtivos.length > 1) {
            const extraCount = filtrosAtivos.length - 1;
            htmlInline += `
                <div class="dropdown-filters" style="position: relative;">
                    <button id="btn-toggle-filters-drop" style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        +${extraCount} <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
                    </button>
                    
                    <div id="drop-filters-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 280px; z-index: 50;">
                        <div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px 6px 0 0;">
                            <strong style="color: var(--cnx-blue); font-size: 0.75rem;">Filtros Ativos</strong>
                            <button id="btn-close-filters-drop" style="background:none; border:none; cursor:pointer; color:#64748b; display:flex;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
                        </div>
                        <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">
            `;
            
            filtrosAtivos.forEach(f => {
                const fExato = f.exato && f.campo !== 'status' && !f.campo.includes('data') ? ' (Exato)' : '';
                htmlInline += `
                    <div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;">
                        <div style="flex:1;">
                            <span style="color: #64748b;">${f.labelCampo}${fExato}:</span> 
                            <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong>
                        </div>
                        <button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroEmp(${f.id})">
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
            
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) {
                    dropMenu.style.display = 'none';
                    document.removeEventListener('click', closeDrop);
                }
            });
        }
    }

    if (window.configurarOrdenacaoTabela) { window.configurarOrdenacaoTabela(moduloContent, sortConfig, aplicarFiltrosEOrdenar); }

    function aplicarFiltrosEOrdenar() {
        let lista = [...todosEmprestimos];
        filtrosAtivos.forEach(filtro => {
            lista = lista.filter(item => {
                if (filtro.campo === 'status') return String(item.statusCalculado) === filtro.valor;
                if (filtro.campo === 'data_emprestimo' || filtro.campo === 'data_devolucao') {
                    if (!item[filtro.campo]) return false;
                    const d = new Date(item[filtro.campo]); return d.toISOString().split('T')[0] === filtro.valor;
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
            tbodyEmps.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum empréstimo encontrado.</td></tr>`;
            return;
        }

        tbodyEmps.innerHTML = lista.map(r => {
            const dataFmt = new Date(r.data_emprestimo + 'T12:00:00').toLocaleDateString('pt-BR');
            const prevFmt = r.previsao_devolucao ? new Date(r.previsao_devolucao + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
            
            let btnHtml = `<button class="btn-acao btn-ver" data-id="${r.id}" title="Visualizar Detalhes" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>`;
            btnHtml += `<button class="btn-acao btn-historico" data-id="${r.id}" title="Auditoria/Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width:16px;"></i></button>`;

            if (r.arquivo_assinatura) {
                btnHtml += `<button class="btn-acao btn-gestao-anexo" data-id="${r.id}" data-tem-anexo="true" title="Ficha Assinada Anexada" style="background:none; border:none; color:#10b981; cursor:pointer;"><i data-lucide="file-check-2" style="width:16px;"></i></button>`;
            } else {
                btnHtml += `<button class="btn-acao btn-gestao-anexo" data-id="${r.id}" data-tem-anexo="false" title="Imprimir / Anexar Ficha" style="background:none; border:none; color:var(--cnx-orange); cursor:pointer;"><i data-lucide="printer" style="width:16px;"></i></button>`;
            }

            if (r.statusCalculado === 'ATIVO' || r.statusCalculado === 'ATRASADO' || r.statusCalculado === 'DEVOLUCAO PARCIAL') {
                if (!r.temDevolucaoLancada || isGestor) {
                    btnHtml += `<button class="btn-acao btn-editar" data-id="${r.id}" title="Editar Empréstimo" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>`;
                }
                btnHtml += `<button class="btn-acao btn-devolver" data-id="${r.id}" title="Efetuar Devolução" style="background:none; border:none; color:#16a34a; cursor:pointer;"><i data-lucide="log-in" style="width:16px;"></i></button>`;
                if (isAdmin) {
                    btnHtml += `<button class="btn-acao btn-cancelar" data-id="${r.id}" title="Cancelar Empréstimo" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="x-circle" style="width:16px;"></i></button>`;
                }
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1.25rem; font-weight: 800; color: var(--cnx-blue);">${r.codigoFormatado}</td>
                    <td style="padding: 0.6rem 1.25rem;">${r.responsavel}</td>
                    <td style="padding: 0.6rem 1.25rem; font-size: 0.8rem;">${dataFmt}</td>
                    <td style="padding: 0.6rem 1.25rem; font-size: 0.8rem;">${prevFmt}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center;">${getStatusBadge(r.statusCalculado)}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center; display: flex; justify-content: center; gap: 8px;">${btnHtml}</td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ================= ABAS =================
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

    // ================= DELEGAÇÃO DE EVENTOS =================
    moduloContent.addEventListener('click', async (e) => {
        const btnAcao = e.target.closest('.btn-acao');
        if (btnAcao) {
            const id = btnAcao.dataset.id;
            
            if (btnAcao.classList.contains('btn-ver')) abrirFormulario('visualizar', id);
            else if (btnAcao.classList.contains('btn-editar')) abrirFormulario('editar', id);
            else if (btnAcao.classList.contains('btn-devolver')) abrirFormulario('devolver', id);
            else if (btnAcao.classList.contains('btn-historico')) { if(window.abrirHistorico) window.abrirHistorico('emprestimos', id); }
            else if (btnAcao.classList.contains('btn-cancelar')) {
                let motivo = await window.appCustomPrompt('Cancelar Empréstimo', 'Por favor, informe o motivo do cancelamento:');
                if (motivo === null) return; 
                if (motivo.trim() === '') { window.appAlert('Atenção', 'Motivo é obrigatório.', 'warning'); return; }
                
                const r = todosEmprestimos.find(x => x.id === id);
                const obs = r.observacoes ? `${r.observacoes}\n\n[CANCELADO]: ${motivo.toUpperCase()}` : `[CANCELADO]: ${motivo.toUpperCase()}`;
                await window.db.from('emprestimos').update({ status: 'CANCELADO', observacoes: obs }).eq('id', id);
                window.appAlert('Sucesso', 'Empréstimo cancelado.', 'success'); buscarEmprestimos();
            }
            else if (btnAcao.classList.contains('btn-gestao-anexo')) {
                abrirMenuAnexo(id, btnAcao.dataset.temAnexo === 'true');
            }
            return;
        }

        const btnBuscaA = e.target.closest('#btn-busca-almox') || e.target.closest('#emp-almox-desc');
        if (btnBuscaA && !inEmpDesc.readOnly) { abrirModalConsulta('almoxarifado'); return; }

        const btnBuscaP = e.target.closest('#btn-busca-produto');
        if (btnBuscaP && btnBuscaP.style.display !== 'none') { abrirModalConsulta('produto'); return; }
    });

    moduloContent.addEventListener('input', (e) => {
        if (e.target.closest('#modal-emp') && !e.target.classList.contains('filter-input')) formFoiAlterado = true;
        
        if (e.target.classList.contains('in-qtd-inline')) {
            const prodId = e.target.dataset.prodid;
            const campo = e.target.dataset.campo;
            let val = parseFloat(e.target.value) || 0;
            if (val < 0) { val = 0; e.target.value = 0; }
            
            const idx = itensEmpCache.findIndex(x => x.produto_id === prodId);
            if (idx >= 0 && campo === 'emprestada') {
                itensEmpCache[idx].qtd_emprestada = val;
            }
        }
    });

    moduloContent.addEventListener('change', (e) => {
        if (e.target.closest('#modal-emp') && !e.target.classList.contains('filter-input')) formFoiAlterado = true;
    });

    // Fechamento por ESC respeitando a hierarquia dos modais
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        const customPrompt = document.getElementById('custom-prompt-modal');
        if (customPrompt && customPrompt.style.display !== 'none') {
            return;
        }

        const pdfModal = document.getElementById('pdf-frame-modal');
        if (pdfModal && pdfModal.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            pdfModal.style.display = 'none';
            return;
        }

        const anexoModal = document.getElementById('modal-anexo-emp');
        if (anexoModal && anexoModal.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            anexoModal.style.display = 'none';
            return;
        }

        if (modalConsulta && modalConsulta.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            modalConsulta.style.display = 'none';
            return;
        }

        if (modalEmp && modalEmp.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            fecharModalEmprestimo();
        }
    }, true);

    // ================= MODAL LUPA =================
    async function abrirModalConsulta(tipo) {
        tipoConsultaAtual = tipo;
        inputBuscaConsulta.value = '';
        
        tbodyConsulta.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        modalConsulta.style.display = 'flex';
        
        if (tipo === 'almoxarifado') {
            tituloConsulta.innerHTML = `<i data-lucide="warehouse" style="color: var(--cnx-orange); width: 18px;"></i> <span>Selecionar Origem</span>`;
            theadConsulta.innerHTML = `<tr><th style="padding: 0.6rem; width: 80px; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Código</th><th style="padding: 0.6rem; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Descrição</th><th style="padding: 0.6rem; width: 60px; text-align:center; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Ação</th></tr>`;
            const { data: almoxs } = await window.db.from('almoxarifados').select('*').eq('status', 'ATIVO').order('codigo');
            almoxarifados = almoxs || [];
            if (acessoTodos) {
                almoxarifadosVinculadosIds = almoxarifados.map(a => a.id);
            }
        } else {
            tituloConsulta.innerHTML = `<i data-lucide="package" style="color: var(--cnx-orange); width: 18px;"></i> <span>Selecionar Equipamento</span>`;
            theadConsulta.innerHTML = `<tr><th style="padding: 0.6rem; width: 80px; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Código</th><th style="padding: 0.6rem; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Descrição</th><th style="padding: 0.6rem; width: 60px; text-align:center; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Ação</th></tr>`;
            const { data: prods } = await window.db.from('produtos').select('*').eq('status', 'ATIVO').order('descricao');
            produtos = (prods || []).filter(p => String(p.tipo || p.tipo_item || '').toUpperCase().includes('EQUIPAMENTO'));
        }
        lucide.createIcons();
        renderizarListaConsulta();
    }

    moduloContent.querySelector('#btn-fechar-consulta').addEventListener('click', () => modalConsulta.style.display = 'none');
    inputBuscaConsulta.addEventListener('input', renderizarListaConsulta);

    function renderizarListaConsulta() {
        const termo = inputBuscaConsulta.value.trim().toUpperCase();
        let html = '';

        if (tipoConsultaAtual === 'almoxarifado') {
            let lista = acessoTodos
                ? [...almoxarifados]
                : almoxarifados.filter(a => almoxarifadosVinculadosIds.includes(a.id));

            if (termo) lista = lista.filter(a => a.codigo.includes(termo) || a.descricao.includes(termo));

            lista.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' }));
            
            if (lista.length === 0) html = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum almoxarifado disponível.</td></tr>`;
            else {
                html = lista.map(a => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem; font-weight:700;">${a.codigo}</td>
                        <td style="padding: 0.6rem;">${a.descricao}</td>
                        <td style="padding: 0.6rem; text-align: center;"><button type="button" onclick="window.selecionarAlmoxEmp('${a.id}')" style="background:none; border:none; cursor:pointer;" title="Selecionar"><i data-lucide="check-circle" style="color:var(--cnx-blue); width:20px;"></i></button></td>
                    </tr>
                `).join('');
            }
        } else {
            let lista = [...produtos];
            if (termo) lista = lista.filter(p => p.codigo.includes(termo) || p.descricao.includes(termo));

            lista.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' }));
            
            if (lista.length === 0) html = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum equipamento encontrado.</td></tr>`;
            else {
                html = lista.map(p => {
                    const jaExiste = itensEmpCache.some(i => i.produto_id === p.id);
                    const btn = jaExiste 
                        ? `<span style="color:#10b981; font-weight:700; font-size:0.7rem;"><i data-lucide="check" style="width:16px;"></i> Na lista</span>`
                        : `<button type="button" onclick="window.selecionarProdutoEmp('${p.id}')" style="background:none; border:none; cursor:pointer;" title="Adicionar"><i data-lucide="plus-circle" style="color:var(--cnx-orange); width:22px;"></i></button>`;
                    return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem; font-weight:700;">${p.codigo}</td>
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

    window.selecionarAlmoxEmp = function(id) {
        const a = almoxarifados.find(x => x.id === id);
        if (a) {
            inEmpId.value = a.id;
            inEmpDesc.value = `${a.codigo} - ${a.descricao}`;
            formFoiAlterado = true;
        }
        modalConsulta.style.display = 'none'; 
    };

    window.selecionarProdutoEmp = function(id) {
        const p = produtos.find(x => x.id === id);
        if (!p) return;
        itensEmpCache.push({ produto_id: p.id, codigo: p.codigo, descricao: p.descricao, qtd_emprestada: 1, status_item: 'PENDENTE', status_item_original: 'PENDENTE', id: null });
        formFoiAlterado = true;
        renderizarItensEmp();
        modalConsulta.style.display = 'none'; 
    };

    // ================= FORMULÁRIO DE EMPRÉSTIMO =================
    btnNovoEmp.addEventListener('click', () => abrirFormulario('novo', null));
    
    async function fecharModalEmprestimo() {
        if (formFoiAlterado && modoForm !== 'visualizar') {
            const conf = await window.appConfirm('Atenção', 'Existem alterações não guardadas. Deseja sair sem salvar?', 'warning');
            if(!conf) return;
        }
        modalEmp.style.display = 'none';
        formFoiAlterado = false;
    }
    moduloContent.querySelector('#btn-fechar-emp').addEventListener('click', fecharModalEmprestimo);

    async function abrirFormulario(modo, empId) {
        modoForm = modo;
        empEmEdicaoId = empId;
        itensEmpCache = [];
        itensRemovidosDB = [];
        
        inEmpId.value = ''; inEmpDesc.value = ''; inResponsavel.value = ''; inObs.value = ''; 
        inDataSaida.value = new Date().toISOString().split('T')[0]; 
        inDataPrev.value = ''; inDataDev.value = '';
        if(inObsDev) inObsDev.value = '';
        
        badgeStatusModal.innerHTML = '';
        tabBtns[0].click(); 

        const colsDev = moduloContent.querySelectorAll('.col-devolv');
        const colsAcao = moduloContent.querySelectorAll('.col-acao');
        
        inEmpDesc.readOnly = false;
        inResponsavel.disabled = false;
        inDataSaida.disabled = false;
        inDataPrev.disabled = false;
        inObs.disabled = false;
        if(inObsDev) inObsDev.disabled = false;

        if (btnBuscaProduto) btnBuscaProduto.style.display = 'flex';
        if (painelDevolucao) painelDevolucao.style.display = 'none';
        hintEdicao.style.display = 'none';
        
        if (modo === 'novo') {
            modalTitulo.innerHTML = `<i data-lucide="wrench" style="color: var(--cnx-orange); width: 20px;"></i> <span>Novo Empréstimo</span>`;
            colsDev.forEach(el => el.style.display = 'none');
            colsAcao.forEach(el => el.style.display = 'table-cell');
            hintEdicao.style.display = 'block';
            montarFooterFormulario(true);

            if (almoxarifadosVinculadosIds.length === 1) {
                window.selecionarAlmoxEmp(almoxarifadosVinculadosIds[0]);
            }
            formFoiAlterado = false;

        } else {
            const r = todosEmprestimos.find(x => x.id === empId);
            if (!r) return;
            
            modalTitulo.innerHTML = `<i data-lucide="wrench" style="color: var(--cnx-orange); width: 20px;"></i> <span>Empréstimo ${r.codigoFormatado}</span>`;
            badgeStatusModal.innerHTML = getStatusBadge(r.statusCalculado);
            
            inEmpId.value = r.almoxarifado_id;
            inEmpDesc.value = r.almoxarifado ? `${r.almoxarifado.codigo} - ${r.almoxarifado.descricao}` : '';
            inResponsavel.value = r.responsavel;
            inDataSaida.value = r.data_emprestimo ? r.data_emprestimo.split('T')[0] : '';
            inDataPrev.value = r.previsao_devolucao ? r.previsao_devolucao.split('T')[0] : '';
            inObs.value = r.observacoes || '';

            const { data: itens } = await window.db.from('emprestimo_itens').select('*, produtos(codigo, descricao)').eq('emprestimo_id', empId);
            if (itens) {
                itensEmpCache = itens.map(i => ({
                    id: i.id,
                    produto_id: i.produto_id,
                    codigo: i.produtos ? i.produtos.codigo : '-',
                    descricao: i.produtos ? i.produtos.descricao : 'Excluído',
                    qtd_emprestada: i.qtd_emprestada,
                    status_item: i.status || 'PENDENTE',
                    status_item_original: i.status || 'PENDENTE'
                }));
            }

            inEmpDesc.readOnly = true;

            if (modo === 'visualizar') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'none'; 
                inResponsavel.disabled = true; inDataSaida.disabled = true; inDataPrev.disabled = true; inObs.disabled = true;
                
                colsDev.forEach(el => el.style.display = 'table-cell');
                colsAcao.forEach(el => el.style.display = 'none');
                
                if (r.data_devolucao || r.temDevolucaoLancada) {
                    painelDevolucao.style.display = 'block';
                    inDataDev.value = r.data_devolucao ? r.data_devolucao.split('T')[0] : '';
                    inDataDev.disabled = true;
                    if(inObsDev) inObsDev.style.display = 'none'; 
                }
                montarFooterFormulario(false);
                
            } else if (modo === 'editar') {
                hintEdicao.style.display = 'block';
                colsDev.forEach(el => el.style.display = 'none');
                colsAcao.forEach(el => el.style.display = 'table-cell');
                montarFooterFormulario(true);
                
            } else if (modo === 'devolver') {
                if (btnBuscaProduto) btnBuscaProduto.style.display = 'none'; 
                inResponsavel.disabled = true; inDataSaida.disabled = true; inDataPrev.disabled = true;
                inObs.disabled = true; 
                
                painelDevolucao.style.display = 'block';
                inDataDev.disabled = false;
                inDataDev.value = new Date().toISOString().split('T')[0];
                if(inObsDev) { inObsDev.style.display = 'block'; inObsDev.disabled = false; }

                colsDev.forEach(el => el.style.display = 'table-cell');
                colsAcao.forEach(el => el.style.display = 'none');
                
                montarFooterFormulario(true, 'Confirmar Devolução');
            }
            formFoiAlterado = false; 
        }
        
        renderizarItensEmp();
        modalEmp.style.display = 'flex';
        lucide.createIcons();
    }

    window.confirmarDevolucaoItem = function(prodId) {
        const idx = itensEmpCache.findIndex(x => x.produto_id === prodId);
        if (idx >= 0) {
            itensEmpCache[idx].status_item = 'DEVOLVIDO';
            formFoiAlterado = true;
            renderizarItensEmp();
        }
    };

    window.removerItemEmp = async function(prodId) {
        const item = itensEmpCache.find(x => x.produto_id === prodId);
        if (!item) return;
        if (item.id) itensRemovidosDB.push(item.id); 
        itensEmpCache = itensEmpCache.filter(x => x.produto_id !== prodId);
        formFoiAlterado = true;
        renderizarItensEmp();
    };

    function renderizarItensEmp() {
        if (modoForm === 'devolver') {
            const todosDevolvidos = itensEmpCache.every(i => i.status_item_original === 'DEVOLVIDO');
            if (todosDevolvidos) {
                tbodyItens.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #16a34a; font-weight: 800;">Todos os equipamentos deste empréstimo já foram devolvidos.</td></tr>`;
                return;
            }
        }

        if (itensEmpCache.length === 0) {
            tbodyItens.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #94a3b8;">Nenhum equipamento adicionado.</td></tr>`;
            return;
        }

        let html = '';
        itensEmpCache.forEach(i => {
            if (modoForm === 'devolver' && i.status_item_original === 'DEVOLVIDO') return;

            let acaoHtml = `<td style="display:none;"></td>`;
            if (modoForm === 'novo' || modoForm === 'editar') {
                acaoHtml = `<td style="padding: 0.5rem; text-align: center;"><button type="button" onclick="window.removerItemEmp('${i.produto_id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Remover"><i data-lucide="trash-2" style="width: 14px;"></i></button></td>`;
            }

            let saidaHtml = `<td style="padding: 0.5rem; text-align: center; font-weight: 800;">${i.qtd_emprestada}</td>`;
            if (modoForm === 'novo' || modoForm === 'editar') {
                saidaHtml = `<td style="padding: 0.5rem; text-align: center;"><input type="number" class="in-qtd-inline input-standard" data-prodid="${i.produto_id}" data-campo="emprestada" value="${i.qtd_emprestada}" min="1" style="width: 70px; padding: 4px; text-align: center; border: 1px solid #cbd5e1; font-weight:800;"></td>`;
            }

            let devHtml = `<td style="display:none;"></td>`;
            if (modoForm === 'devolver') {
                if (i.status_item === 'DEVOLVIDO') {
                    devHtml = `<td style="padding: 0.5rem; text-align: center;"><span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-weight:800; font-size:0.65rem;">DEVOLVIDO</span></td>`;
                } else {
                    devHtml = `<td style="padding: 0.5rem; text-align: center;"><button type="button" onclick="window.confirmarDevolucaoItem('${i.produto_id}')" style="background:white; border:1px solid #16a34a; color:#16a34a; padding:4px 10px; border-radius:4px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; margin:0 auto;"><i data-lucide="check" style="width:14px;"></i> Devolver</button></td>`;
                }
            } else if (moduloContent.querySelector('.col-devolv').style.display !== 'none') {
                if (i.status_item === 'DEVOLVIDO') {
                    devHtml = `<td style="padding: 0.5rem; text-align: center;"><i data-lucide="check-circle" style="color:#16a34a; width:18px;"></i></td>`;
                } else {
                    devHtml = `<td style="padding: 0.5rem; text-align: center;"><i data-lucide="clock" style="color:#f59e0b; width:18px;"></i></td>`;
                }
            }

            html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.5rem; font-weight:700;">${i.codigo}</td>
                <td style="padding: 0.5rem;">${i.descricao}</td>
                ${saidaHtml}
                ${devHtml}
                ${acaoHtml}
            </tr>`;
        });
        
        if(html === '' && modoForm === 'devolver') html = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: #16a34a; font-weight: 800;">Todos os equipamentos deste empréstimo já foram devolvidos.</td></tr>`;
        
        tbodyItens.innerHTML = html;
        lucide.createIcons();
    }

    function montarFooterFormulario(showSave, saveText = 'Salvar') {
        if (!showSave) {
            footerEmp.innerHTML = `<button class="btn-cancel" id="btn-fechar-visao">Fechar Visão</button>`;
            footerEmp.querySelector('#btn-fechar-visao').addEventListener('click', fecharModalEmprestimo);
        } else {
            let icon = 'save'; let bgColor = 'var(--cnx-blue)';
            if (modoForm === 'devolver') { icon = 'log-in'; bgColor = '#16a34a'; }

            footerEmp.innerHTML = `
                <button class="btn-cancel" id="btn-cancel-form">Cancelar</button>
                <button class="btn-save" id="btn-salvar-form" style="background: ${bgColor}; color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <i data-lucide="${icon}" style="width: 16px; color: white;"></i> <span>${saveText}</span>
                </button>
            `;
            footerEmp.querySelector('#btn-cancel-form').addEventListener('click', fecharModalEmprestimo);
            footerEmp.querySelector('#btn-salvar-form').addEventListener('click', executarAcoesFormulario);
        }
        lucide.createIcons();
    }

    async function executarAcoesFormulario() {
        if (!formFoiAlterado && modoForm === 'editar') {
            window.appAlert('Aviso', 'Nenhuma alteração foi feita no empréstimo para ser guardada.', 'info');
            return;
        }
        if (!formFoiAlterado && modoForm === 'novo') {
            window.appAlert('Aviso', 'O formulário está vazio.', 'info');
            return;
        }
        if (modoForm === 'devolver' && !formFoiAlterado) {
            window.appAlert('Aviso', 'Nenhum equipamento foi devolvido nesta operação.', 'info');
            return;
        }

        if (modoForm === 'devolver') {
            let itensPendentesStr = [];
            let devolucaoTotal = true;
            for (const i of itensEmpCache) {
                if (i.status_item !== 'DEVOLVIDO') {
                    devolucaoTotal = false;
                    itensPendentesStr.push(`1x ${i.descricao}`);
                }
            }

            let msg = `Deseja realmente confirmar esta devolução?`;
            if (!devolucaoTotal) {
                msg = `<span style="color:#b45309; font-weight:700;">Atenção: Trata-se de uma devolução PARCIAL.</span><br><br>Os seguintes itens não foram devolvidos nesta operação:<br><ul style="text-align:left; margin-top:8px;"><li>${itensPendentesStr.join('</li><li>')}</li></ul><br>Deseja prosseguir?`;
            }
            
            const conf = await window.appConfirm('Confirmação de Devolução', msg, devolucaoTotal ? 'info' : 'warning');
            if(!conf) return;
            await registrarDevolucao(devolucaoTotal);
            return;
        }

        const conf = await window.appConfirm('Confirmação', `Deseja realmente salvar este registro?`);
        if(!conf) return;

        await salvarNovoOuEditar();
    }

    async function salvarNovoOuEditar() {
        const idAlmox = inEmpId.value;
        const resp = inResponsavel.value.trim().toUpperCase();
        const dataSaida = inDataSaida.value;
        const dataPrev = inDataPrev.value;

        if (!idAlmox || !resp || !dataSaida) { window.appAlert("Erro", "Campos obrigatórios: Almoxarifado, Responsável e Data de Saída.", "error"); return; }
        if (itensEmpCache.length === 0) { window.appAlert("Atenção", "Adicione pelo menos um equipamento.", "warning"); return; }

        const btnSave = footerEmp.querySelector('#btn-salvar-form');
        btnSave.disabled = true; btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Aguarde...`;

        try {
            const payload = {
                almoxarifado_id: idAlmox,
                responsavel: resp,
                data_emprestimo: dataSaida,
                previsao_devolucao: dataPrev || null,
                observacoes: inObs.value.trim().toUpperCase(),
                status: 'ATIVO'
            };

            let currentId = empEmEdicaoId;

            if (modoForm === 'novo') {
                payload.usuario_registro_id = usuarioLogadoId;
                const { data: newEmp, error: errEmp } = await window.db.from('emprestimos').insert([payload]).select('id').single();
                if (errEmp) throw errEmp;
                currentId = newEmp.id;
                
                const payloadItens = itensEmpCache.map(i => ({ emprestimo_id: currentId, produto_id: i.produto_id, qtd_emprestada: i.qtd_emprestada, status: 'PENDENTE' }));
                await window.db.from('emprestimo_itens').insert(payloadItens);
            } else {
                const { error: errEmp } = await window.db.from('emprestimos').update(payload).eq('id', currentId);
                if (errEmp) throw errEmp;
                
                if (itensRemovidosDB.length > 0) await window.db.from('emprestimo_itens').delete().in('id', itensRemovidosDB);

                for (const i of itensEmpCache) {
                    if (i.id) await window.db.from('emprestimo_itens').update({ qtd_emprestada: i.qtd_emprestada }).eq('id', i.id);
                    else await window.db.from('emprestimo_itens').insert([{ emprestimo_id: currentId, produto_id: i.produto_id, qtd_emprestada: i.qtd_emprestada, status: 'PENDENTE' }]);
                }
            }

            formFoiAlterado = false;
            window.appAlert("Sucesso", "Empréstimo guardado!", "success");
            modalEmp.style.display = 'none';
            await buscarEmprestimos();
        } catch (e) { console.error(e); window.appAlert("Erro", "Falha ao gravar empréstimo.", "error"); } 
        finally { btnSave.disabled = false; btnSave.innerHTML = `Salvar`; }
    }

    async function registrarDevolucao(devolucaoTotal) {
        const dDev = inDataDev.value;
        if (!dDev) { window.appAlert('Atenção', 'Informe a data efetiva da devolução.', 'warning'); return; }

        const btnSave = footerEmp.querySelector('#btn-salvar-form');
        btnSave.disabled = true; btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Registando...`;

        try {
            let itensDevolvidosNestaSessao = [];
            
            for (const i of itensEmpCache) {
                if (i.status_item === 'DEVOLVIDO' && i.status_item !== i.status_item_original) {
                    itensDevolvidosNestaSessao.push(i.descricao);
                    await window.db.from('emprestimo_itens').update({ status: 'DEVOLVIDO' }).eq('id', i.id);
                }
            }

            const novoStatus = devolucaoTotal ? 'DEVOLVIDO' : 'DEVOLUCAO PARCIAL';
            
            const obsTextoLivre = inObsDev ? inObsDev.value.trim().toUpperCase() : '';
            let formatacaoNovaObs = '';
            
            if (obsTextoLivre) {
                formatacaoNovaObs = `[OBS. DA DEVOLUÇÃO EM ${new Date(dDev+'T12:00:00').toLocaleDateString('pt-BR')}]: ${obsTextoLivre}`;
            }

            let obsAdicional = inObs.value || '';
            if (formatacaoNovaObs) {
                obsAdicional = (obsAdicional ? obsAdicional + '\n\n' : '') + formatacaoNovaObs;
            }

            await window.db.from('emprestimos').update({ 
                status: novoStatus, 
                data_devolucao: dDev,
                observacoes: obsAdicional
            }).eq('id', empEmEdicaoId);

            formFoiAlterado = false;
            
            if (devolucaoTotal) {
                window.appAlert('Sucesso', `Devolução total registada com sucesso.`, 'success');
            } else {
                window.appAlert('Sucesso', `Devolução parcial registada.\nItens devolvidos: ${itensDevolvidosNestaSessao.join(', ')}`, 'success', 5000);
            }
            
            modalEmp.style.display = 'none'; await buscarEmprestimos();
        } catch (e) { console.error(e); window.appAlert('Erro', 'Falha ao registar devolução.', 'error'); }
        finally { btnSave.disabled = false; btnSave.innerHTML = `Confirmar Devolução`; }
    }

    // ================= GESTÃO DE IMPRESSÃO E ANEXO DE PDF =================
    let empIdParaAnexo = null;

    window.abrirMenuAnexo = function(id, temAnexo) {
        empIdParaAnexo = id;
        const container = document.getElementById('acoes-anexo-container');
        
        if (temAnexo) {
            container.innerHTML = `
                <button onclick="window.visualizarAnexoEmp()" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="eye" style="width: 18px; color: #10b981;"></i> Visualizar documento assinado</button>
                ${isGestor ? `<button onclick="window.apagarAnexoEmp()" style="background: #fef2f2; border: 1px solid #fecaca; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: #991b1b; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="trash-2" style="width: 18px;"></i> Apagar anexo</button>` : ''}
            `;
        } else {
            container.innerHTML = `
                <button onclick="window.imprimirFichaColeta()" style="background: var(--cnx-blue); border: none; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="printer" style="width: 18px; color: var(--cnx-orange);"></i> Imprimir ficha p/ assinatura</button>
                <div style="text-align: center; margin: 4px 0; color: #94a3b8; font-size: 0.7rem; font-weight: 700;">OU</div>
                <button onclick="document.getElementById('input-upload-pdf').click()" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.8rem; border-radius: 6px; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="upload-cloud" style="width: 18px; color: #10b981;"></i> Anexar PDF assinado</button>
            `;
        }
        document.getElementById('modal-anexo-emp').style.display = 'flex';
        lucide.createIcons();
    };

    window.imprimirFichaColeta = async function() {
        if (!window.jspdf) { window.appAlert('Erro', 'Biblioteca PDF indisponível.', 'error'); return; }
        
        const modalAcoes = document.getElementById('modal-anexo-emp');
        if (modalAcoes) modalAcoes.style.display = 'none';

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
            const r = todosEmprestimos.find(x => x.id === empIdParaAnexo);
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margemEsq = 40;
            const margemDir = pageWidth - 40; 

            const imgUrl = '../assets/imagens/Logo.png';
            try {
                const img = new Image();
                img.src = imgUrl;
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
            
            doc.setFontSize(14); doc.setTextColor(242, 101, 34); doc.setFont("helvetica", "bold");
            doc.text("TERMO DE RESPONSABILIDADE / EMPRÉSTIMO", pageWidth / 2, 100, { align: 'center' });

            doc.setFontSize(9); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "normal");
            
            doc.text(`N.º do Empréstimo: ${r.codigoFormatado}`, margemEsq, 130);
            doc.text(`Data de Saída: ${new Date(r.data_emprestimo + 'T12:00:00').toLocaleDateString('pt-BR')}`, margemDir, 130, { align: 'right' });
            
            const nomeCriador = r.usuarios ? r.usuarios.nome_completo : 'Sistema';
            doc.text(`Criado por: ${nomeCriador}`, margemEsq, 145);
            
            const codigoAlmox = r.almoxarifado ? r.almoxarifado.codigo : '';
            const nomeAlmox = r.almoxarifado ? r.almoxarifado.descricao : 'Desconhecida';
            doc.text(`Origem: ${codigoAlmox} - ${nomeAlmox}`, margemDir, 145, { align: 'right' });

            const { data: itensDB } = await window.db.from('emprestimo_itens').select('qtd_emprestada, produtos(codigo, descricao)').eq('emprestimo_id', empIdParaAnexo);
            
            const colunas = [["ID Equipamento", "Descrição", "Qtd"]];
            const linhas = (itensDB || []).map(i => [
                i.produtos?.codigo || '-', 
                i.produtos?.descricao || '-', 
                i.qtd_emprestada 
            ]);

            doc.autoTable({
                startY: 165, head: colunas, body: linhas, theme: 'grid',
                headStyles: { fillColor: [242, 101, 34], textColor: [255,255,255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 100 }, 2: { cellWidth: 50, halign: 'center' } },
                margin: { bottom: 150 } 
            });

            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
            doc.text("Declaro para os devidos fins que recebi os equipamentos listados acima em perfeitas condições de uso e", margemEsq, pageHeight - 120);
            doc.text("assumo total responsabilidade pela sua guarda, conservação e devolução quando solicitado.", margemEsq, pageHeight - 108);

            doc.line(130, pageHeight - 50, 465, pageHeight - 50);
            
            doc.setFont("helvetica", "bold"); doc.setTextColor(0, 43, 91); doc.setFontSize(10);
            doc.text(r.responsavel.toUpperCase(), pageWidth / 2, pageHeight - 35, { align: 'center' });
            
            const horaAtual = new Date().toLocaleString('pt-BR');
            doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
            doc.text(`Impresso em: ${horaAtual} por ${nomeUsuarioLogado}`, margemEsq, pageHeight - 15);

            const iframe = document.getElementById('pdf-iframe');
            const frameModal = document.getElementById('pdf-frame-modal');
            if (iframe && frameModal) {
                iframe.src = doc.output('bloburl');
                frameModal.style.display = 'flex';
            }
        } catch(e) { console.error("Falha ao gerar PDF", e); window.appAlert('Erro', 'Não foi possível gerar a ficha.', 'error'); }
    };

    // Upload do PDF
    document.getElementById('input-upload-pdf').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !empIdParaAnexo) return;
        
        document.getElementById('modal-anexo-emp').style.display = 'none';
        const msgAlerta = window.appAlert('Aguarde', 'Fazendo upload do arquivo...', 'info', 10000);

        try {
            const r = todosEmprestimos.find(x => x.id === empIdParaAnexo);
            const fileName = `EMP-${r.codigoFormatado}_${Date.now()}.pdf`;
            
            const { data, error } = await window.db.storage.from('emprestimos-assinaturas').upload(fileName, file);
            if (error) throw error;

            const { data: publicUrlData } = window.db.storage.from('emprestimos-assinaturas').getPublicUrl(data.path);
            
            await window.db.from('emprestimos').update({ arquivo_assinatura: publicUrlData.publicUrl }).eq('id', empIdParaAnexo);
            
            window.appAlert('Sucesso', 'Ficha anexada com sucesso!', 'success');
            buscarEmprestimos();
        } catch (err) {
            console.error(err); window.appAlert('Erro', 'Falha ao anexar o arquivo.', 'error');
        } finally { e.target.value = ''; }
    });

    window.visualizarAnexoEmp = function() {
        document.getElementById('modal-anexo-emp').style.display = 'none';
        const r = todosEmprestimos.find(x => x.id === empIdParaAnexo);
        
        if (r && r.arquivo_assinatura) {
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

            const iframe = document.getElementById('pdf-iframe');
            const frameModal = document.getElementById('pdf-frame-modal');
            
            if (iframe && frameModal) {
                iframe.src = r.arquivo_assinatura;
                frameModal.style.display = 'flex';
            }
        }
    };

    window.apagarAnexoEmp = async function() {
        document.getElementById('modal-anexo-emp').style.display = 'none';
        const r = todosEmprestimos.find(x => x.id === empIdParaAnexo);
        if (!r || !r.arquivo_assinatura) return;

        const conf = await window.appConfirm('Apagar Ficha', 'Tem certeza que deseja apagar a ficha assinada deste empréstimo?', 'danger');
        if (!conf) return;

        try {
            const urlParts = r.arquivo_assinatura.split('/');
            const fileName = urlParts[urlParts.length - 1];
            
            await window.db.storage.from('emprestimos-assinaturas').remove([fileName]);
            await window.db.from('emprestimos').update({ arquivo_assinatura: null }).eq('id', empIdParaAnexo);
            
            window.appAlert('Sucesso', 'Ficha apagada.', 'success');
            buscarEmprestimos();
        } catch (e) { console.error(e); window.appAlert('Erro', 'Falha ao apagar ficheiro.', 'error'); }
    };

    carregarDadosIniciais();
})();