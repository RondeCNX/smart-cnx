// js/coleta_mac.js
(async function initModuloColetaMac() {
    console.log("Módulo Coleta de MAC carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-coleta_mac .modulo-container');
    if (!moduloContent) return;

    // Componentes Grelha e Filtros
    const tbodyColetas = moduloContent.querySelector('#tbody-coletas');
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
    const btnRefresh = moduloContent.querySelector('#btn-refresh-coletas');

    // Componentes Modal Principal
    const btnNovaColeta = moduloContent.querySelector('#btn-nova-coleta');
    const modalColeta = moduloContent.querySelector('#modal-coleta');
    const modalTitulo = moduloContent.querySelector('#modal-titulo-coleta');
    const badgeStatusModal = moduloContent.querySelector('#badge-status-modal');
    const footerColeta = moduloContent.querySelector('#modal-coleta-footer');
    
    const tabBtns = moduloContent.querySelectorAll('.tab-form-btn');
    const tabContents = moduloContent.querySelectorAll('.tab-form-content');
    const tabBtnLote = moduloContent.querySelector('#tab-btn-lote');
    const badgeQtdLote = moduloContent.querySelector('#badge-qtd-lote');
    const wrapperChkLote = moduloContent.querySelector('#wrapper-chk-lote');
    const chkModoLote = moduloContent.querySelector('#coleta-modo-lote');
    const wrapperAcaoLote = moduloContent.querySelector('#wrapper-acao-lote');
    const btnAddItemLote = moduloContent.querySelector('#btn-add-item-lote');
    const btnLimparLoteModal = moduloContent.querySelector('#btn-limpar-lote-modal');
    const tbodyLoteColeta = moduloContent.querySelector('#tbody-lote-coleta');

    const inData = moduloContent.querySelector('#coleta-data');
    const inAlmoxId = moduloContent.querySelector('#coleta-almox-id');
    const inAlmoxDesc = moduloContent.querySelector('#coleta-almox-desc');
    const inAlmoxDestinoId = moduloContent.querySelector('#coleta-almox-destino-id');
    const inAlmoxDestinoDesc = moduloContent.querySelector('#coleta-almox-destino-desc');
    const inOs = moduloContent.querySelector('#coleta-os');
    const inTipoOs = moduloContent.querySelector('#coleta-tipo-os');
    
    const inProdutoId = moduloContent.querySelector('#coleta-produto-id');
    const inProdutoCod = moduloContent.querySelector('#coleta-produto-cod');
    const inProdutoDesc = moduloContent.querySelector('#coleta-produto-desc');
    const inMac = moduloContent.querySelector('#coleta-mac');
    const inSerie = moduloContent.querySelector('#coleta-serie');
    const inObs = moduloContent.querySelector('#coleta-obs');

    // Componentes Modal Consulta (Lupa)
    const modalConsulta = moduloContent.querySelector('#modal-consulta-coleta');
    const tituloConsulta = moduloContent.querySelector('#titulo-consulta-coleta');
    const inputBuscaConsulta = moduloContent.querySelector('#input-busca-consulta-coleta');
    const theadConsulta = moduloContent.querySelector('#thead-consulta-coleta');
    const tbodyConsulta = moduloContent.querySelector('#tbody-consulta-coleta');

    let permissoesAcesso = { view: false, create: false, edit: false, delete: false };
    let usuarioLogadoId = null;
    let isAdmin = false;
    let isGestor = false;
    let acessoTodos = false;
    let meusAlmoxarifadosIds = [];
    
    let almoxarifados = [];
    let produtos = [];
    let todasColetas = [];
    let filtrosAtivos = [];
    let sortConfig = { key: 'data_coleta', direction: 'desc' };

    let modoForm = 'novo'; 
    let registroEmEdicaoId = null; 
    let formFoiAlterado = false;
    let tipoConsultaAtual = '';
    let modoLote = false;
    let itensLote = [];
    let validandoMac = false;

    btnRefresh.addEventListener('click', async () => {
        const icon = btnRefresh.querySelector('.refresh-icon');
        icon.classList.add('lucide-spin');
        await buscarColetas();
        icon.classList.remove('lucide-spin');
    });

    async function carregarDadosIniciais() {
        try {
            permissoesAcesso = {
                view: window.temPermissao('coleta_mac', 'view'),
                create: window.temPermissao('coleta_mac', 'create'),
                edit: window.temPermissao('coleta_mac', 'edit'),
                delete: window.temPermissao('coleta_mac', 'delete')
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar a Coleta de MAC.</p></div>`;
                lucide.createIcons();
                return;
            }

            if (btnNovaColeta) btnNovaColeta.style.display = permissoesAcesso.create ? 'flex' : 'none';

            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return;
            usuarioLogadoId = session.user.id;

            const { data: user } = await window.db
                .from('usuarios')
                .select('acesso_todos_almoxarifados, cargos(nome)')
                .eq('id', usuarioLogadoId)
                .single();

            const upperCargo = user?.cargos?.nome?.toUpperCase() || '';
            isAdmin = upperCargo === 'ADMINISTRADOR';
            isGestor = isAdmin || upperCargo.includes('SUPERVISOR');
            acessoTodos = isAdmin || isGestor || !!user?.acesso_todos_almoxarifados;

            const { data: vincs } = await window.db
                .from('usuario_almoxarifados')
                .select('almoxarifado_id')
                .eq('usuario_id', usuarioLogadoId);
            const acessosDiretos = vincs ? vincs.map(v => v.almoxarifado_id) : [];
            
            const { data: resAlmox } = await window.db
                .from('almoxarifados')
                .select('*')
                .eq('status', 'ATIVO')
                .order('codigo');
            almoxarifados = resAlmox || [];
            
            meusAlmoxarifadosIds = acessoTodos ? almoxarifados.map(a => a.id) : acessosDiretos;

            await buscarColetas();
        } catch (e) { console.error(e); }
    }

    async function buscarColetas() {
        tbodyColetas.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        lucide.createIcons();

        let query = window.db.from('coletas_mac')
            .select(`
                *,
                almoxarifado:almoxarifados!almoxarifado_id(codigo, descricao),
                almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao),
                produto:produtos(codigo, descricao),
                usuario:usuarios!usuario_estoquista_id(nome_completo)
            `)
            .order('created_at', { ascending: false });

        if (!acessoTodos) {
            if (meusAlmoxarifadosIds.length > 0) {
                const idsFmt = meusAlmoxarifadosIds.map(i => `"${i}"`).join(',');
                query = query.or(`almoxarifado_id.in.(${idsFmt}),almoxarifado_destino_id.in.(${idsFmt})`);
            } else {
                todasColetas = [];
                aplicarFiltrosEOrdenar();
                return;
            }
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar coletas:', error);
            tbodyColetas.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">Erro ao buscar coletas.</td></tr>`;
            return;
        }

        todasColetas = (data || []).map(r => ({
            ...r,
            almoxarifadoDesc: r.almoxarifado ? `${window.fmtCod(r.almoxarifado.codigo)} - ${r.almoxarifado.descricao}` : 'Desconhecido',
            almoxarifadoDestinoDesc: r.almoxarifado_destino ? `${window.fmtCod(r.almoxarifado_destino.codigo)} - ${r.almoxarifado_destino.descricao}` : '-',
            produtoDesc: r.produto ? `${window.fmtCod(r.produto.codigo)} - ${r.produto.descricao}` : 'Desconhecido',
            estoquistaNome: r.usuario ? r.usuario.nome_completo : 'Desconhecido'
        }));

        if (lblTotalGeral) lblTotalGeral.innerText = todasColetas.length;
        aplicarFiltrosEOrdenar();
    }

    // ================= ORDENAÇÃO DA TABELA PRINCIPAL =================
    function atualizarIconesOrdenacao() {
        moduloContent.querySelectorAll('th.sort-col').forEach(th => {
            const icon = th.querySelector('.sort-icon, svg');
            if (!icon) return;
            if (th.dataset.col === sortConfig.key) {
                icon.style.opacity = '1';
                icon.style.transform = sortConfig.direction === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
            } else {
                icon.style.opacity = '0.35';
                icon.style.transform = 'rotate(0deg)';
            }
        });
    }

    moduloContent.querySelectorAll('th.sort-col').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (!col) return;
            if (sortConfig.key === col) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = col;
                sortConfig.direction = 'asc';
            }
            aplicarFiltrosEOrdenar();
        });
    });

    function ordenarLista(lista) {
        const { key, direction } = sortConfig;
        if (!key) return lista;
        const mult = direction === 'asc' ? 1 : -1;

        return [...lista].sort((a, b) => {
            const va = a[key] ?? '';
            const vb = b[key] ?? '';

            if (key === 'data_coleta') {
                const da = va ? new Date(va).getTime() : 0;
                const db = vb ? new Date(vb).getTime() : 0;
                return (da - db) * mult;
            }

            return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' }) * mult;
        });
    }

    // ================= FILTROS E TABELA =================
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
    btnLimparFiltros.addEventListener('click', () => { filtrosAtivos = []; renderizarTagsFiltros(); aplicarFiltrosEOrdenar(); });

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

    window.removerFiltroColeta = function(idFiltro) {
        filtrosAtivos = filtrosAtivos.filter(f => f.id !== idFiltro);
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    };

    function renderizarTagsFiltros() {
        const containerTagsInline = moduloContent.querySelector('#container-tags-inline');
        const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');
        
        containerTagsInline.style.display = 'flex'; containerTagsInline.style.gap = '4px'; containerTagsInline.style.alignItems = 'center';
        containerTagsInline.innerHTML = '';
        
        if (filtrosAtivos.length === 0) { lblFiltrosAtivos.style.display = 'inline'; return; }
        lblFiltrosAtivos.style.display = 'none';

        const firstFiltro = filtrosAtivos[0];
        const isExato = firstFiltro.exato && firstFiltro.campo !== 'status' && firstFiltro.campo !== 'data' ? ' (Exato)' : '';
        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span><strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroColeta(${firstFiltro.id})"><i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i></button>
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
                const fExato = f.exato && f.campo !== 'status' && f.campo !== 'data' ? ' (Exato)' : '';
                htmlInline += `
                    <div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;">
                        <div style="flex:1;"><span style="color: #64748b;">${f.labelCampo}${fExato}:</span> <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong></div>
                        <button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroColeta(${f.id})"><i data-lucide="trash-2" style="width: 14px; height: 14px; color: #ef4444;"></i></button>
                    </div>`;
            });
            htmlInline += `</div></div></div>`;
        }
        containerTagsInline.innerHTML = htmlInline;
        lucide.createIcons();

        const btnToggle = containerTagsInline.querySelector('#btn-toggle-filters-drop');
        const dropMenu = containerTagsInline.querySelector('#drop-filters-menu');
        const btnClose = containerTagsInline.querySelector('#btn-close-filters-drop');
        if (btnToggle && dropMenu) {
            btnToggle.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = dropMenu.style.display === 'none' ? 'block' : 'none'; });
            btnClose.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = 'none'; });
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) { dropMenu.style.display = 'none'; document.removeEventListener('click', closeDrop); }
            });
        }
    }

    function aplicarFiltrosEOrdenar() {
        let lista = [...todasColetas];
        filtrosAtivos.forEach(f => {
            lista = lista.filter(item => {
                if (f.campo === 'status') return String(item.status) === f.valor;
                if (f.campo === 'data') { const d = new Date(item.data_coleta + 'T12:00:00'); return d.toISOString().split('T')[0] === f.valor; }
                const v = String(item[f.campo] || '').toUpperCase();
                return f.exato ? v === f.valor : v.includes(f.valor);
            });
        });
        lista = ordenarLista(lista);
        atualizarIconesOrdenacao();
        if (lblTotalExibidos) lblTotalExibidos.innerText = lista.length;
        renderizarGrid(lista);
    }

    function getStatusBadge(status) {
        if (status === 'PENDENTE') return `<span style="background: #fef08a; color: #854d0e; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">PENDENTE</span>`;
        if (status === 'AJUSTADO') return `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">AJUSTADO</span>`;
        if (status === 'CANCELADO') return `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">CANCELADO</span>`;
        return status;
    }

    function renderizarGrid(lista) {
        if (lista.length === 0) { 
            tbodyColetas.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color:#64748b;">Nenhuma coleta encontrada.</td></tr>`; 
            return; 
        }

        tbodyColetas.innerHTML = lista.map(r => {
            const dataFmt = new Date(r.data_coleta + 'T12:00:00').toLocaleDateString('pt-BR');
            
            let btnHtml = `<button class="btn-acao btn-ver" data-id="${r.id}" title="Visualizar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>`;
            btnHtml += `<button class="btn-acao btn-historico" data-id="${r.id}" title="Auditoria/Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width:16px;"></i></button>`;
            
            if (r.status === 'PENDENTE') {
                if (permissoesAcesso.edit) {
                    btnHtml += `<button class="btn-acao btn-editar" data-id="${r.id}" title="Editar Coleta" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>`;
                }
                if ((r.usuario_estoquista_id === usuarioLogadoId || acessoTodos) && permissoesAcesso.delete) {
                    btnHtml += `<button class="btn-acao btn-excluir" data-id="${r.id}" title="Excluir Coleta" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>`;
                }
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.78rem; white-space: nowrap;">${dataFmt}</td>
                    <td style="padding: 0.6rem 0.5rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.numero_os || '-'}">${r.numero_os || '-'}</td>
                    <td style="padding: 0.6rem 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.almoxarifadoDesc}">${r.almoxarifadoDesc}</td>
                    <td style="padding: 0.6rem 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.almoxarifadoDestinoDesc}">${r.almoxarifadoDestinoDesc}</td>
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help;" title="${r.produtoDesc}">${r.produtoDesc}</td>
                    <td style="padding: 0.6rem 0.5rem; font-weight:800; color:var(--cnx-orange); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.mac || '-'}">${r.mac || '-'}</td>
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.78rem; color:#64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.numero_serie || '-'}">${r.numero_serie || '-'}</td>
                    <td style="padding: 0.6rem 0.5rem; text-align: center;">${getStatusBadge(r.status)}</td>
                    <td style="padding: 0.6rem 0.5rem; text-align: center; display: flex; justify-content: center; gap: 6px;">${btnHtml}</td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ================= VALIDAÇÃO PRINCIPAL DE MAC DUPLICADO =================
    async function verificarMacDuplicado(macRaw) {
        const mac = String(macRaw || '').trim().toUpperCase();
        if (!mac) return false;

        // 1. Verifica no lote atual em memória
        if (modoLote && itensLote.some(i => i.mac === mac)) {
            window.appAlert('MAC Duplicado', `O MAC <strong>${mac}</strong> já foi adicionado neste lote.`, 'warning');
            return true;
        }

        // 2. Verifica na base de dados (desconsiderando CANCELADO e o próprio registro em edição)
        let query = window.db
            .from('coletas_mac')
            .select('id, mac, numero_serie, status')
            .eq('mac', mac)
            .neq('status', 'CANCELADO')
            .limit(1);

        if (modoForm === 'editar' && registroEmEdicaoId) {
            query = query.neq('id', registroEmEdicaoId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            window.appAlert('MAC Duplicado', `O MAC <strong>${mac}</strong> já está cadastrado no sistema (Status: ${data[0].status || '-'}).`, 'warning');
            return true;
        }

        return false;
    }

    // ================= LÓGICA DE COLETA EM LOTE =================
    function atualizarInterfaceModoLote() {
        const ativo = modoForm === 'novo' && modoLote;
        tabBtnLote.style.display = ativo ? 'flex' : 'none';
        wrapperAcaoLote.style.display = ativo ? 'flex' : 'none';

        if (modoForm === 'novo') {
            modalTitulo.innerHTML = ativo
                ? `<i data-lucide="layers" style="color: var(--cnx-orange); width: 20px;"></i> <span>Coleta em Lote de MAC</span>`
                : `<i data-lucide="cpu" style="color: var(--cnx-orange); width: 20px;"></i> <span>Registro Unitário de Coleta</span>`;
        }

        const spanSalvar = footerColeta.querySelector('#btn-salvar-form span');
        if (spanSalvar) {
            spanSalvar.innerText = ativo ? `Salvar Lote (${itensLote.length})` : 'Salvar Coleta';
        }
        lucide.createIcons();
    }

    function renderizarTabelaLote() {
        badgeQtdLote.innerText = itensLote.length;
        const spanSalvar = footerColeta.querySelector('#btn-salvar-form span');
        if (spanSalvar && modoLote) {
            spanSalvar.innerText = `Salvar Lote (${itensLote.length})`;
        }

        if (itensLote.length === 0) {
            tbodyLoteColeta.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.8rem; color: #94a3b8;">Nenhum equipamento adicionado ao lote ainda.</td></tr>`;
            return;
        }

        tbodyLoteColeta.innerHTML = itensLote.map((item, idx) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.5rem 0.6rem; text-align: center; color: #64748b; font-weight: 700;">${itensLote.length - idx}</td>
                <td style="padding: 0.5rem 0.6rem; font-weight: 600; color: #334155;">${item.produto_cod} - ${item.produto_desc}</td>
                <td style="padding: 0.5rem 0.6rem; font-weight: 800; color: var(--cnx-orange);">${item.mac}</td>
                <td style="padding: 0.5rem 0.6rem; font-weight: 700; color: #475569;">${item.numero_serie || '-'}</td>
                <td style="padding: 0.5rem 0.6rem; text-align: center;">
                    <button type="button" class="btn-rem-item-lote" data-id-local="${item.idLocal}" title="Remover do Lote" style="background: none; border: none; color: #ef4444; cursor: pointer;">
                        <i data-lucide="trash-2" style="width: 15px;"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    }

    async function adicionarItemAoLote() {
        const prodId = inProdutoId.value;
        const prodCod = inProdutoCod.value.trim().toUpperCase();
        const prodDesc = inProdutoDesc.value.trim();
        const mac = inMac.value.trim().toUpperCase();
        const serie = inSerie.value.trim().toUpperCase();

        if (!prodId) {
            window.appAlert('Atenção', 'Selecione o Produto / Modelo antes de adicionar ao lote.', 'warning');
            inProdutoCod.focus();
            return;
        }
        if (!mac) {
            window.appAlert('Atenção', 'Informe ou bipe o MAC (Gpon).', 'warning');
            inMac.focus();
            return;
        }

        validandoMac = true;
        const macDuplicado = await verificarMacDuplicado(mac);
        validandoMac = false;
        if (macDuplicado) {
            inMac.value = '';
            inMac.focus();
            return;
        }

        itensLote.unshift({
            idLocal: Date.now() + Math.floor(Math.random() * 1000),
            produto_consumo_id: prodId,
            produto_cod: prodCod,
            produto_desc: prodDesc,
            mac,
            numero_serie: serie
        });

        formFoiAlterado = true;
        renderizarTabelaLote();

        // Mantém o produto preenchido para agilizar leituras em sequência (mas livre para alterar)
        inMac.value = '';
        inSerie.value = '';
        inMac.focus();
    }

    chkModoLote.addEventListener('change', async () => {
        if (!chkModoLote.checked && itensLote.length > 0) {
            const conf = await window.appConfirm('Desativar Coleta em Lote', `Existem ${itensLote.length} equipamento(s) no lote. Deseja limpar a lista e voltar para coleta unitária?`, 'warning');
            if (!conf) {
                chkModoLote.checked = true;
                return;
            }
            itensLote = [];
            renderizarTabelaLote();
        }
        modoLote = chkModoLote.checked;
        atualizarInterfaceModoLote();
        if (!modoLote && moduloContent.querySelector('#form-tab-lote').style.display !== 'none') {
            tabBtns[0].click();
        }
    });

    btnAddItemLote.addEventListener('click', adicionarItemAoLote);

    btnLimparLoteModal.addEventListener('click', async () => {
        if (itensLote.length === 0) return;
        const conf = await window.appConfirm('Limpar Lote', 'Deseja remover todos os equipamentos da lista do lote?', 'warning');
        if (!conf) return;
        itensLote = [];
        renderizarTabelaLote();
    });

    // ================= EVENTOS DE TECLADO (MAC -> SÉRIE -> LOTE OU SALVAR) =================
    inMac.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const mac = inMac.value.trim().toUpperCase();
            if (!mac) return;

            validandoMac = true;
            const duplicado = await verificarMacDuplicado(mac);
            validandoMac = false;

            if (duplicado) {
                inMac.value = '';
                inMac.focus();
            } else {
                inSerie.focus();
            }
        }
    });

    inMac.addEventListener('focusout', async () => {
        if (validandoMac || modoForm === 'visualizar') return;
        const mac = inMac.value.trim().toUpperCase();
        if (!mac) return;

        validandoMac = true;
        const duplicado = await verificarMacDuplicado(mac);
        validandoMac = false;

        if (duplicado) {
            inMac.value = '';
            inMac.focus();
        }
    });

    inSerie.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (modoForm === 'visualizar') return;

            if (modoForm === 'novo' && modoLote) {
                await adicionarItemAoLote();
            } else {
                await salvarColeta();
            }
        }
    });

    // ================= EVENTOS DA TELA PRINCIPAL =================
    moduloContent.addEventListener('click', async (e) => {
        const btnRemLote = e.target.closest('.btn-rem-item-lote');
        if (btnRemLote) {
            const idLocal = Number(btnRemLote.dataset.idLocal);
            itensLote = itensLote.filter(i => i.idLocal !== idLocal);
            renderizarTabelaLote();
            return;
        }

        const btnAcao = e.target.closest('.btn-acao');
        if (btnAcao) {
            const id = btnAcao.dataset.id;
            
            if (btnAcao.classList.contains('btn-ver')) {
                abrirFormulario('visualizar', id);
            } 
            else if (btnAcao.classList.contains('btn-editar')) {
                abrirFormulario('editar', id);
            } 
            else if (btnAcao.classList.contains('btn-historico')) { 
                if(window.abrirHistorico) window.abrirHistorico('coletas_mac', id); 
            } 
            else if (btnAcao.classList.contains('btn-excluir')) {
                if (!permissoesAcesso.delete) {
                    window.appAlert('Acesso Negado', 'Você não tem permissão para excluir coletas.', 'error');
                    return;
                }
                const conf = await window.appConfirm('Excluir Registro', 'Deseja realmente apagar esta coleta permanentemente?', 'danger');
                if (conf) {
                    await window.db.from('coletas_mac').delete().eq('id', id);
                    window.appAlert('Sucesso', 'Registro apagado.', 'success'); 
                    buscarColetas();
                }
            }
            return;
        }

        const btnAlmoxOrigem = e.target.closest('#btn-busca-almox') || e.target.closest('#coleta-almox-desc');
        if (btnAlmoxOrigem && modoForm !== 'visualizar') { 
            abrirModalConsulta('almoxarifado_origem'); 
            return; 
        }

        const btnAlmoxDestino = e.target.closest('#btn-busca-almox-destino') || e.target.closest('#coleta-almox-destino-desc');
        if (btnAlmoxDestino && modoForm !== 'visualizar') { 
            abrirModalConsulta('almoxarifado_destino'); 
            return; 
        }

        const btnProd = e.target.closest('#btn-busca-produto') || e.target.closest('#coleta-produto-desc');
        if (btnProd && modoForm !== 'visualizar') { 
            abrirModalConsulta('produto'); 
            return; 
        }
    });

    moduloContent.addEventListener('input', (e) => {
        if (e.target.closest('#modal-coleta') && !e.target.classList.contains('filter-input')) formFoiAlterado = true;
    });

    // ================= NAVEGAÇÃO DE ABAS =================
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

    btnNovaColeta.addEventListener('click', () => {
        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para registrar novas coletas.', 'error');
            return;
        }
        abrirFormulario('novo', null);
    });
    
    async function fecharModalColeta() {
        if ((formFoiAlterado || itensLote.length > 0) && modoForm !== 'visualizar') {
            const conf = await window.appConfirm('Atenção', 'Alterações não guardadas. Deseja realmente sair?', 'warning');
            if(!conf) return;
        }
        modalColeta.style.display = 'none';
        formFoiAlterado = false;
        itensLote = [];
    }
    moduloContent.querySelector('#btn-fechar-coleta').addEventListener('click', fecharModalColeta);

    function atualizarEstadoCampoOs() {
        const asteriscoOs = moduloContent.querySelector('#asterisco-os');
        const isEstoque = inTipoOs.value === 'ESTOQUE';

        if (isEstoque) {
            inOs.value = '';
            inOs.disabled = true;
            inOs.placeholder = 'Não se aplica (Estoque)';
            inOs.style.background = '#f1f5f9';
            if (asteriscoOs) asteriscoOs.style.display = 'none';
        } else {
            inOs.disabled = false;
            inOs.placeholder = 'EX: OS-12345';
            inOs.style.background = 'white';
            if (asteriscoOs) asteriscoOs.style.display = 'inline';
        }
    }

    inTipoOs.addEventListener('change', () => {
        atualizarEstadoCampoOs();
        formFoiAlterado = true;
    });

    async function abrirFormulario(modo, id) {
        const mapaModoPerm = { novo: 'create', editar: 'edit' };
        if (mapaModoPerm[modo] && !permissoesAcesso[mapaModoPerm[modo]]) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para executar esta ação.', 'error');
            return;
        }

        modoForm = modo;
        registroEmEdicaoId = id;
        formFoiAlterado = false;
        modoLote = false;
        itensLote = [];
        chkModoLote.checked = false;
        renderizarTabelaLote();
        
        inData.value = new Date().toISOString().split('T')[0];
        inAlmoxId.value = ''; inAlmoxDesc.value = '';
        inAlmoxDestinoId.value = ''; inAlmoxDestinoDesc.value = '';
        inOs.value = ''; inTipoOs.value = 'RETIRADA';
        inProdutoId.value = ''; inProdutoCod.value = ''; inProdutoDesc.value = ''; 
        inMac.value = ''; inSerie.value = ''; inObs.value = '';
        badgeStatusModal.innerHTML = '';
        tabBtns[0].click();
        
        inData.readOnly = false;
        inOs.readOnly = false;
        inTipoOs.disabled = false;
        inProdutoCod.readOnly = false;
        inMac.readOnly = false;
        inSerie.readOnly = false;
        inObs.readOnly = false;
        moduloContent.querySelector('#btn-busca-almox').style.display = 'block';
        moduloContent.querySelector('#btn-busca-almox-destino').style.display = 'block';
        moduloContent.querySelector('#btn-busca-produto').style.display = 'block';
        
        if (modo === 'novo') {
            wrapperChkLote.style.display = 'flex';
            atualizarEstadoCampoOs();
            montarFooterFormulario(true);
            atualizarInterfaceModoLote();
            
            // Define por padrão o almoxarifado de código "1" (se permitido), ou o único vinculado ao usuário
            const permitidos = almoxarifados.filter(a => meusAlmoxarifadosIds.includes(a.id));
            const almoxPadrao =
                permitidos.find(a => String(a.codigo || '').trim().replace(/^0+/, '') === '1') ||
                (permitidos.length === 1 ? permitidos[0] : null);

            if (almoxPadrao) {
                const descFmt = `${window.fmtCod(almoxPadrao.codigo)} - ${almoxPadrao.descricao}`;
                inAlmoxId.value = almoxPadrao.id;
                inAlmoxDesc.value = descFmt;
                inAlmoxDestinoId.value = almoxPadrao.id;
                inAlmoxDestinoDesc.value = descFmt;
            }
        } else {
            wrapperChkLote.style.display = 'none';
            tabBtnLote.style.display = 'none';
            wrapperAcaoLote.style.display = 'none';

            const r = todasColetas.find(x => x.id === id);
            if (!r) return;
            
            modalTitulo.innerHTML = `<i data-lucide="cpu" style="color: var(--cnx-orange); width: 20px;"></i> <span>Detalhes da Coleta</span>`;
            badgeStatusModal.innerHTML = getStatusBadge(r.status);
            
            inData.value = r.data_coleta ? r.data_coleta.split('T')[0] : '';
            inAlmoxId.value = r.almoxarifado_id || '';
            inAlmoxDesc.value = r.almoxarifadoDesc !== 'Desconhecido' ? r.almoxarifadoDesc : '';
            inAlmoxDestinoId.value = r.almoxarifado_destino_id || '';
            inAlmoxDestinoDesc.value = r.almoxarifadoDestinoDesc !== '-' ? r.almoxarifadoDestinoDesc : '';
            inTipoOs.value = r.tipo_os || 'RETIRADA';
            atualizarEstadoCampoOs();
            inOs.value = r.numero_os || '';
            inObs.value = r.observacoes || '';
            inProdutoId.value = r.produto_consumo_id || '';
            inProdutoCod.value = r.produto ? window.fmtCod(r.produto.codigo) : '';
            inProdutoDesc.value = r.produto ? r.produto.descricao : (r.produtoDesc || '');
            inMac.value = r.mac || '';
            inSerie.value = r.numero_serie || '';
            
            if (modo === 'visualizar') {
                inData.readOnly = true;
                inOs.readOnly = true;
                inTipoOs.disabled = true;
                inProdutoCod.readOnly = true;
                inMac.readOnly = true;
                inSerie.readOnly = true;
                inObs.readOnly = true;
                moduloContent.querySelector('#btn-busca-almox').style.display = 'none';
                moduloContent.querySelector('#btn-busca-almox-destino').style.display = 'none';
                moduloContent.querySelector('#btn-busca-produto').style.display = 'none';
                montarFooterFormulario(false);
            } else if (modo === 'editar') {
                montarFooterFormulario(true);
            }
        }
        
        modalColeta.style.display = 'flex';
        lucide.createIcons();
    }

    function montarFooterFormulario(showSave) {
        if (!showSave) {
            footerColeta.innerHTML = `<button class="btn-cancel" id="btn-fechar-visao">Fechar</button>`;
            footerColeta.querySelector('#btn-fechar-visao').addEventListener('click', fecharModalColeta);
        } else {
            footerColeta.innerHTML = `
                <button class="btn-cancel" id="btn-cancel-form">Cancelar</button>
                <button class="btn-save" id="btn-salvar-form" style="background: var(--cnx-blue); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <i data-lucide="save" style="width: 16px; color: white;"></i> <span>Salvar Coleta</span>
                </button>
            `;
            footerColeta.querySelector('#btn-cancel-form').addEventListener('click', fecharModalColeta);
            footerColeta.querySelector('#btn-salvar-form').addEventListener('click', salvarColeta);
        }
        lucide.createIcons();
    }

    async function salvarColeta() {
        const d = inData.value;
        const idAlmoxOrigem = inAlmoxId.value;
        const idAlmoxDestino = inAlmoxDestinoId.value;
        const isEstoque = inTipoOs.value === 'ESTOQUE';
        const os = isEstoque ? '' : inOs.value.trim().toUpperCase();
        const obs = inObs.value.trim().toUpperCase();

        if (!d || !idAlmoxOrigem || !idAlmoxDestino || (!isEstoque && !os)) {
            window.appAlert(
                "Atenção",
                isEstoque
                    ? "Preencha a Data, Almoxarifado de Origem e Almoxarifado de Destino na Aba 1."
                    : "Preencha a Data, O.S., Almoxarifado de Origem e Almoxarifado de Destino na Aba 1.",
                "warning"
            );
            tabBtns[0].click();
            return;
        }

        // ===== MODO LOTE =====
        if (modoForm === 'novo' && modoLote) {
            if (itensLote.length === 0) {
                window.appAlert("Atenção", "Adicione pelo menos um equipamento ao lote antes de salvar.", "warning");
                tabBtns[1].click();
                return;
            }

            const conf = await window.appConfirm('Salvar Lote', `Deseja gravar os <strong>${itensLote.length}</strong> equipamento(s) deste lote?`);
            if (!conf) return;

            const btnSave = footerColeta.querySelector('#btn-salvar-form');
            btnSave.disabled = true;
            btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Gravando Lote...`;
            lucide.createIcons();

            try {
                const payloads = itensLote.map(item => ({
                    almoxarifado_id: idAlmoxOrigem,
                    almoxarifado_destino_id: idAlmoxDestino,
                    numero_os: os,
                    tipo_os: inTipoOs.value,
                    data_coleta: d,
                    produto_consumo_id: item.produto_consumo_id,
                    mac: item.mac,
                    numero_serie: item.numero_serie,
                    observacoes: obs,
                    usuario_estoquista_id: usuarioLogadoId,
                    status: 'PENDENTE'
                }));

                const { error } = await window.db.from('coletas_mac').insert(payloads);
                if (error) throw error;

                formFoiAlterado = false;
                itensLote = [];
                window.appAlert("Sucesso", `${payloads.length} equipamento(s) registrados com sucesso!`, "success");
                modalColeta.style.display = 'none';
                await buscarColetas();
            } catch (e) {
                console.error(e);
                window.appAlert("Erro", "Falha ao gravar o lote de coletas.", "error");
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = `<i data-lucide="save" style="width: 16px; color: white;"></i> <span>Salvar Lote (${itensLote.length})</span>`;
                lucide.createIcons();
            }
            return;
        }

        // ===== MODO UNITÁRIO (NOVO / EDITAR) =====
        const prod = inProdutoId.value;
        const mac = inMac.value.trim().toUpperCase();
        const serie = inSerie.value.trim().toUpperCase();

        if (!prod || !mac) {
            window.appAlert("Atenção", "O Produto e o MAC (Aba 2) são obrigatórios.", "warning");
            tabBtns[1].click();
            return;
        }

        validandoMac = true;
        const macDuplicado = await verificarMacDuplicado(mac);
        validandoMac = false;
        if (macDuplicado) {
            tabBtns[1].click();
            inMac.focus();
            return;
        }

        const conf = await window.appConfirm('Salvar Coleta', `Deseja gravar o registro do MAC ${mac}?`);
        if(!conf) return;

        const btnSave = footerColeta.querySelector('#btn-salvar-form');
        btnSave.disabled = true; btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Gravando...`;
        lucide.createIcons();

        try {
            const payload = {
                almoxarifado_id: idAlmoxOrigem,
                almoxarifado_destino_id: idAlmoxDestino,
                numero_os: os,
                tipo_os: inTipoOs.value,
                data_coleta: d,
                produto_consumo_id: prod,
                mac: mac,
                numero_serie: serie,
                observacoes: obs
            };

            if (modoForm === 'novo') {
                payload.usuario_estoquista_id = usuarioLogadoId;
                payload.status = 'PENDENTE';
                const { error } = await window.db.from('coletas_mac').insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await window.db.from('coletas_mac').update(payload).eq('id', registroEmEdicaoId);
                if (error) throw error;
            }

            formFoiAlterado = false;
            window.appAlert("Sucesso", `Equipamento registrado com sucesso!`, "success");
            modalColeta.style.display = 'none';
            await buscarColetas();
        } catch (e) { console.error(e); window.appAlert("Erro", "Falha ao gravar coleta.", "error"); } 
        finally {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i data-lucide="save" style="width: 16px; color: white;"></i> <span>Salvar Coleta</span>`;
            lucide.createIcons();
        }
    }

    // ================= MODAL DE CONSULTA (LUPA) =================
    async function abrirModalConsulta(tipo) {
        tipoConsultaAtual = tipo;
        inputBuscaConsulta.value = '';
        
        tbodyConsulta.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        modalConsulta.style.display = 'flex';
        
        if (tipo === 'almoxarifado_origem' || tipo === 'almoxarifado_destino') {
            const tituloTxt = tipo === 'almoxarifado_origem' ? 'Selecionar Almoxarifado de Origem' : 'Selecionar Almoxarifado de Destino';
            tituloConsulta.innerHTML = `<i data-lucide="warehouse" style="color: var(--cnx-orange); width: 18px;"></i> <span>${tituloTxt}</span>`;
            theadConsulta.innerHTML = `<tr><th style="padding: 0.6rem; width: 80px; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Código</th><th style="padding: 0.6rem; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Descrição</th><th style="padding: 0.6rem; width: 60px; text-align:center; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Ação</th></tr>`;
        } else {
            tituloConsulta.innerHTML = `<i data-lucide="package" style="color: var(--cnx-orange); width: 18px;"></i> <span>Selecionar Produto Base</span>`;
            theadConsulta.innerHTML = `<tr><th style="padding: 0.6rem; width: 80px; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Código</th><th style="padding: 0.6rem; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Descrição</th><th style="padding: 0.6rem; width: 60px; text-align:center; position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 0 #cbd5e1;">Ação</th></tr>`;
            if (produtos.length === 0) {
                const { data: prods } = await window.db.from('produtos').select('id, codigo, descricao').eq('status', 'ATIVO').order('descricao');
                produtos = prods || [];
            }
        }
        lucide.createIcons();
        renderizarListaConsulta();
    }

    moduloContent.querySelector('#btn-fechar-consulta-coleta').addEventListener('click', () => modalConsulta.style.display = 'none');
    inputBuscaConsulta.addEventListener('input', renderizarListaConsulta);

    function renderizarListaConsulta() {
        const termo = inputBuscaConsulta.value.trim().toUpperCase();
        let html = '';

        if (tipoConsultaAtual === 'almoxarifado_origem' || tipoConsultaAtual === 'almoxarifado_destino') {
            let lista = tipoConsultaAtual === 'almoxarifado_origem'
                ? almoxarifados.filter(a => meusAlmoxarifadosIds.includes(a.id))
                : [...almoxarifados];

            if (termo) {
                lista = lista.filter(a =>
                    String(a.codigo || '').toUpperCase().includes(termo) ||
                    window.fmtCod(a.codigo).toUpperCase().includes(termo) ||
                    String(a.descricao || '').toUpperCase().includes(termo)
                );
            }

            lista.sort((a, b) =>
                String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR', { sensitivity: 'base' })
            );
            
            if (lista.length === 0) html = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum almoxarifado disponível.</td></tr>`;
            else {
                const fnSelec = tipoConsultaAtual === 'almoxarifado_origem' ? 'selecAlmoxOrigemColeta' : 'selecAlmoxDestinoColeta';
                html = lista.map(a => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem; font-weight:700;">${window.fmtCod(a.codigo)}</td>
                        <td style="padding: 0.6rem;">${a.descricao}</td>
                        <td style="padding: 0.6rem; text-align: center;"><button type="button" onclick="window.${fnSelec}('${a.id}')" style="background:none; border:none; cursor:pointer;"><i data-lucide="check-circle" style="color:var(--cnx-blue); width:20px;"></i></button></td>
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

            lista.sort((a, b) =>
                String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR', { sensitivity: 'base' })
            );
            
            if (lista.length === 0) html = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum equipamento encontrado.</td></tr>`;
            else {
                html = lista.map(p => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem; font-weight:700;">${window.fmtCod(p.codigo)}</td>
                        <td style="padding: 0.6rem;">${p.descricao}</td>
                        <td style="padding: 0.6rem; text-align: center;"><button type="button" onclick="window.selecProdColeta('${p.id}')" style="background:none; border:none; cursor:pointer;"><i data-lucide="check-circle" style="color:var(--cnx-blue); width:20px;"></i></button></td>
                    </tr>
                `).join('');
            }
        }
        tbodyConsulta.innerHTML = html;
        lucide.createIcons();
    }

    window.selecAlmoxOrigemColeta = function(id) {
        const a = almoxarifados.find(x => x.id === id);
        if (a) {
            const descFmt = `${window.fmtCod(a.codigo)} - ${a.descricao}`;
            inAlmoxId.value = a.id;
            inAlmoxDesc.value = descFmt;

            // Define o destino igual à origem por padrão (mantendo livre para edição)
            inAlmoxDestinoId.value = a.id;
            inAlmoxDestinoDesc.value = descFmt;

            formFoiAlterado = true;
        }
        modalConsulta.style.display = 'none'; 
    };

    window.selecAlmoxDestinoColeta = function(id) {
        const a = almoxarifados.find(x => x.id === id);
        if (a) {
            inAlmoxDestinoId.value = a.id;
            inAlmoxDestinoDesc.value = `${window.fmtCod(a.codigo)} - ${a.descricao}`;
            formFoiAlterado = true;
        }
        modalConsulta.style.display = 'none'; 
    };

    window.selecProdColeta = function(id) {
        const p = produtos.find(x => x.id === id);
        if (p) { 
            inProdutoId.value = p.id;
            inProdutoCod.value = window.fmtCod(p.codigo);
            inProdutoDesc.value = p.descricao; 
            formFoiAlterado = true; 
        }
        modalConsulta.style.display = 'none'; 
    };

    // Prevenção Modal Global Esc
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const mConsulta = modalConsulta;
            const mPrincipal = modalColeta;
            
            if (mConsulta && mConsulta.style.display !== 'none') { e.preventDefault(); e.stopPropagation(); mConsulta.style.display = 'none'; return; }
            if (mPrincipal && mPrincipal.style.display !== 'none') { e.preventDefault(); e.stopPropagation(); fecharModalColeta(); }
        }
    }, true);

    // ================= LÓGICA DO PRODUTO (AUTO-BUSCA PELO CÓDIGO) =================
    async function processarBuscaProdutoCod() {
        const valRaw = inProdutoCod.value.trim().toUpperCase();
        if (!valRaw) { 
            inProdutoId.value = ''; 
            inProdutoDesc.value = ''; 
            return; 
        }

        const semZeros = valRaw.replace(/^0+/, '') || valRaw;
        const comZeros = valRaw.padStart(6, '0');
        const candidatos = [...new Set([valRaw, semZeros, comZeros])];

        const pCache = produtos.find(x => candidatos.includes(String(x.codigo || '').trim().toUpperCase()));
        if (pCache) {
            inProdutoId.value = pCache.id;
            inProdutoCod.value = window.fmtCod(pCache.codigo);
            inProdutoDesc.value = pCache.descricao;
            formFoiAlterado = true;
            inMac.focus();
            return;
        }

        const { data } = await window.db.from('produtos')
            .select('id, codigo, descricao')
            .in('codigo', candidatos)
            .eq('status', 'ATIVO')
            .limit(1)
            .maybeSingle();
            
        if (data) {
            inProdutoId.value = data.id;
            inProdutoCod.value = window.fmtCod(data.codigo);
            inProdutoDesc.value = data.descricao;
            produtos.push(data);
            formFoiAlterado = true;
            inMac.focus();
        } else {
            window.appAlert('Erro', 'Produto não encontrado na base de dados.', 'warning');
            inProdutoCod.value = ''; 
            inProdutoId.value = ''; 
            inProdutoDesc.value = '';
            inProdutoCod.focus();
        }
    }

    inProdutoCod.addEventListener('focusout', processarBuscaProdutoCod);

    inProdutoCod.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            processarBuscaProdutoCod();
        }
    });

    carregarDadosIniciais();
})();