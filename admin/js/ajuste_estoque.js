// js/ajuste_estoque.js
(async function initModuloAjusteEstoque() {
    console.log("Módulo Ajuste de Estoque carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-ajuste_estoque .modulo-container');
    if (!moduloContent) return;

    // Componentes Grelha e Filtros
    const tbodyAjustes = moduloContent.querySelector('#tbody-ajustes');
    const lblTotalGeral = moduloContent.querySelector('#lbl-total-geral');
    const lblTotalExibidos = moduloContent.querySelector('#lbl-total-exibidos');
    
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const inputData = moduloContent.querySelector('#filtro-valor-data');
    const wrapperTexto = moduloContent.querySelector('#wrapper-texto');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    
    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    const btnRefresh = moduloContent.querySelector('#btn-refresh-ajustes');

    // Componentes Modal Principal
    const btnNovoAjuste = moduloContent.querySelector('#btn-novo-ajuste');
    const modalAjuste = moduloContent.querySelector('#modal-ajuste');
    const modalTitulo = moduloContent.querySelector('#modal-titulo-ajuste');
    const footerAjuste = moduloContent.querySelector('#modal-ajuste-footer');
    
    const tabBtns = moduloContent.querySelectorAll('.tab-form-btn');
    const tabContents = moduloContent.querySelectorAll('.tab-form-content');

    const inAlmoxId = moduloContent.querySelector('#ajuste-almox-id');
    const inAlmoxDesc = moduloContent.querySelector('#ajuste-almox-desc');
    const inIdEntrada = moduloContent.querySelector('#ajuste-id-entrada');
    const inIdInventario = moduloContent.querySelector('#ajuste-id-inventario');
    const inDataAjuste = moduloContent.querySelector('#ajuste-data');
    const inObs = moduloContent.querySelector('#ajuste-obs');
    const btnBuscaAlmox = moduloContent.querySelector('#btn-busca-almox');

    // Itens (Aba 2)
    const tbodyMacs = moduloContent.querySelector('#tbody-itens-pendentes');
    const chkAllMacs = moduloContent.querySelector('#chk-all-macs');
    const lblTotalMacsSel = moduloContent.querySelector('#lbl-total-macs-sel');

    // Componentes Modal Consulta (Lupa)
    const modalConsulta = moduloContent.querySelector('#modal-consulta-ajuste');
    const inputBuscaConsulta = moduloContent.querySelector('#input-busca-consulta-ajuste');
    const tbodyConsulta = moduloContent.querySelector('#tbody-consulta-ajuste');

    let usuarioLogadoId = null;
    let isAdmin = false;
    let isGestor = false;
    let acessoTodos = false;
    let permissoesAcesso = { view: false, create: false, edit: false, delete: false };
    let meusAlmoxarifadosIds = [];
    
    let almoxarifados = [];
    let todosAjustes = [];
    let macsDisponiveis = [];
    let filtrosAtivos = [];
    let sortConfig = { key: 'data_ajuste', direction: 'desc' };

    let modoForm = 'novo'; 
    let registroEmEdicaoId = null;
    let formFoiAlterado = false;

    btnRefresh.addEventListener('click', async () => {
        const icon = btnRefresh.querySelector('.refresh-icon');
        icon.classList.add('lucide-spin');
        await buscarAjustes();
        icon.classList.remove('lucide-spin');
    });

    async function verificarAutoAbrirNovoAjuste() {
        const almoxId = window.ajusteEstoqueAutoAbrirAlmoxId;
        if (!almoxId) return;
        window.ajusteEstoqueAutoAbrirAlmoxId = null;

        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para criar lotes de ajuste.', 'error');
            return;
        }

        await abrirFormulario('novo', null);
        window.selecAlmoxAjuste(almoxId);
    }

    document.addEventListener('telaRestaurada', (e) => {
        if (e.detail?.rota === 'ajuste_estoque') {
            verificarAutoAbrirNovoAjuste();
        }
    });

    async function carregarDadosIniciais() {
        try {
            permissoesAcesso = {
                view: window.temPermissao('ajuste_estoque', 'view'),
                create: window.temPermissao('ajuste_estoque', 'create'),
                edit: window.temPermissao('ajuste_estoque', 'edit'),
                delete: window.temPermissao('ajuste_estoque', 'delete')
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar o Ajuste de Estoque.</p></div>`;
                lucide.createIcons();
                return;
            }

            if (btnNovoAjuste) btnNovoAjuste.style.display = permissoesAcesso.create ? 'flex' : 'none';

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
                .order('descricao');
            almoxarifados = resAlmox || [];
            
            meusAlmoxarifadosIds = acessoTodos ? almoxarifados.map(a => a.id) : acessosDiretos;

            await buscarAjustes();
            await verificarAutoAbrirNovoAjuste();
        } catch (e) { console.error(e); }
    }

    async function buscarAjustes() {
        tbodyAjustes.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        lucide.createIcons();

        let query = window.db.from('ajustes_estoque')
            .select(`
                *,
                almoxarifado:almoxarifados(codigo, descricao),
                usuario:usuarios!usuario_supervisor_id(nome_completo),
                coletas:coletas_mac(id, mac, numero_serie, almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao))
            `)
            .order('created_at', { ascending: false });

        if (!acessoTodos) {
            if (meusAlmoxarifadosIds.length > 0) query = query.in('almoxarifado_id', meusAlmoxarifadosIds);
            else { todosAjustes = []; aplicarFiltrosEOrdenar(); return; }
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar ajustes:', error);
            tbodyAjustes.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Erro ao buscar ajustes.</td></tr>`;
            return;
        }

        todosAjustes = (data || []).map(r => {
            const destinosUnicos = [
                ...new Set(
                    (r.coletas || [])
                        .map(c => c.almoxarifado_destino ? `${c.almoxarifado_destino.codigo} - ${c.almoxarifado_destino.descricao}` : null)
                        .filter(Boolean)
                )
            ];

            return {
                ...r,
                almoxarifadoDesc: r.almoxarifado ? `${r.almoxarifado.codigo} - ${r.almoxarifado.descricao}` : 'Desconhecido',
                almoxarifadoDestinoDesc: destinosUnicos.length > 0 ? destinosUnicos.join(', ') : '-',
                supervisorNome: r.usuario ? r.usuario.nome_completo : 'Desconhecido',
                qtdEquips: r.coletas ? r.coletas.length : 0
            };
        });

        if (lblTotalGeral) lblTotalGeral.innerText = todosAjustes.length;
        aplicarFiltrosEOrdenar();
    }

    // ================= FILTROS E TABELA =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');
        if (val === 'data') { inputData.style.display = 'block'; wrapperTexto.style.display = 'none'; }
        else { wrapperTexto.style.display = 'flex'; inputTexto.value = ''; chkExato.checked = false; }
    });

    btnAddFiltro.addEventListener('click', adicionarFiltro);
    btnAplicarFiltro.addEventListener('click', adicionarFiltro);
    inputTexto.addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFiltro(); });
    btnLimparFiltros.addEventListener('click', () => { filtrosAtivos = []; renderizarTagsFiltros(); aplicarFiltrosEOrdenar(); });

    function adicionarFiltro() {
        const campo = comboCampo.value; const labelCampo = comboCampo.options[comboCampo.selectedIndex].text;
        let valor = '', labelValor = '', exato = false;

        if (campo === 'data') {
            valor = inputData.value; if (!valor) return;
            const dt = new Date(valor + 'T12:00:00'); labelValor = dt.toLocaleDateString('pt-BR'); exato = true;
        } else {
            valor = inputTexto.value.trim().toUpperCase(); if (!valor) return;
            labelValor = valor; exato = chkExato.checked; inputTexto.value = ''; 
        }
        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    }

    window.removerFiltroAjuste = function(idFiltro) {
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
        const isExato = firstFiltro.exato && firstFiltro.campo !== 'data' ? ' (Exato)' : '';
        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span><strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroAjuste(${firstFiltro.id})"><i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i></button>
            </div>
        `;

        if (filtrosAtivos.length > 1) {
            const extraCount = filtrosAtivos.length - 1;
            htmlInline += `<div class="dropdown-filters" style="position: relative;"><button id="btn-toggle-filters-drop-ajuste" style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 4px;">+${extraCount} <i data-lucide="chevron-down" style="width:12px; height:12px;"></i></button><div id="drop-filters-menu-ajuste" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 280px; z-index: 50;"><div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px 6px 0 0;"><strong style="color: var(--cnx-blue); font-size: 0.75rem;">Filtros Ativos</strong><button id="btn-close-filters-drop-ajuste" style="background:none; border:none; cursor:pointer; color:#64748b; display:flex;"><i data-lucide="x" style="width:14px; height:14px;"></i></button></div><div style="padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">`;
            filtrosAtivos.forEach(f => {
                const fExato = f.exato && f.campo !== 'data' ? ' (Exato)' : '';
                htmlInline += `<div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;"><div style="flex:1;"><span style="color: #64748b;">${f.labelCampo}${fExato}:</span> <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong></div><button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroAjuste(${f.id})"><i data-lucide="trash-2" style="width: 14px; height: 14px; color: #ef4444;"></i></button></div>`;
            });
            htmlInline += `</div></div></div>`;
        }
        containerTagsInline.innerHTML = htmlInline;
        lucide.createIcons();

        const btnToggle = containerTagsInline.querySelector('#btn-toggle-filters-drop-ajuste');
        const dropMenu = containerTagsInline.querySelector('#drop-filters-menu-ajuste');
        const btnClose = containerTagsInline.querySelector('#btn-close-filters-drop-ajuste');
        if (btnToggle && dropMenu) {
            btnToggle.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = dropMenu.style.display === 'none' ? 'block' : 'none'; });
            btnClose.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = 'none'; });
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) { dropMenu.style.display = 'none'; document.removeEventListener('click', closeDrop); }
            });
        }
    }

    function aplicarFiltrosEOrdenar() {
        let lista = [...todosAjustes];
        filtrosAtivos.forEach(f => {
            lista = lista.filter(item => {
                if (f.campo === 'data') { 
                    const d = new Date(item.data_ajuste + 'T12:00:00'); return d.toISOString().split('T')[0] === f.valor; 
                }
                
                if (f.campo === 'mac') {
                    const searchVal = f.valor.toUpperCase();
                    const matchFn = c => {
                        const cMac = String(c.mac || '').toUpperCase();
                        const cSn = String(c.numero_serie || '').toUpperCase();
                        if (f.exato) return cMac === searchVal || cSn === searchVal;
                        return cMac.includes(searchVal) || cSn.includes(searchVal);
                    };
                    return item.coletas && item.coletas.some(matchFn);
                }

                const v = String(item[f.campo] || '').toUpperCase();
                return f.exato ? v === f.valor : v.includes(f.valor);
            });
        });
        if (window.ordenarDadosTabela) lista = window.ordenarDadosTabela(lista, sortConfig);
        if (lblTotalExibidos) lblTotalExibidos.innerText = lista.length;
        renderizarGrid(lista);
    }

    function renderizarGrid(lista) {
        if (lista.length === 0) {
            tbodyAjustes.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum ajuste encontrado.</td></tr>`;
            return;
        }

        tbodyAjustes.innerHTML = lista.map(r => {
            const dataFmt = r.data_ajuste ? new Date(r.data_ajuste + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
            
            let btnHtml = `<button class="btn-acao btn-ver" data-id="${r.id}" title="Visualizar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>`;
            btnHtml += `<button class="btn-acao btn-historico" data-id="${r.id}" title="Auditoria/Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width:16px;"></i></button>`;

            if (acessoTodos || r.usuario_supervisor_id === usuarioLogadoId) {
                if (permissoesAcesso.edit) {
                    btnHtml += `<button class="btn-acao btn-editar" data-id="${r.id}" title="Editar Ajuste" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>`;
                }
                if (permissoesAcesso.delete) {
                    btnHtml += `<button class="btn-acao btn-excluir" data-id="${r.id}" title="Excluir Lote Inteiro" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>`;
                }
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1rem; font-size: 0.8rem;">${dataFmt}</td>
                    <td style="padding: 0.6rem 1rem; font-weight: 800; color: var(--cnx-orange);">${r.id_entrada_erp}</td>
                    <td style="padding: 0.6rem 1rem; font-weight: 800; color: #ef4444;">${r.id_inventario_erp}</td>
                    <td style="padding: 0.6rem 1rem;" title="${r.almoxarifadoDesc}">${r.almoxarifadoDesc}</td>
                    <td style="padding: 0.6rem 1rem;" title="${r.almoxarifadoDestinoDesc}">${r.almoxarifadoDestinoDesc}</td>
                    <td style="padding: 0.6rem 1rem; font-weight: 700; text-align: center;">${r.qtdEquips}</td>
                    <td style="padding: 0.6rem 1rem; font-size: 0.8rem;">${r.supervisorNome}</td>
                    <td style="padding: 0.6rem 1rem; text-align: center; display: flex; justify-content: center; gap: 8px;">${btnHtml}</td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ================= EVENTOS GLOBAIS DA TELA =================
    if (window.configurarOrdenacaoTabela) { window.configurarOrdenacaoTabela(moduloContent, sortConfig, aplicarFiltrosEOrdenar); }

    moduloContent.addEventListener('click', async (e) => {
        const btnAcao = e.target.closest('.btn-acao');
        if (btnAcao) {
            const id = btnAcao.dataset.id;
            if (btnAcao.classList.contains('btn-ver')) {
                abrirFormulario('visualizar', id);
            } else if (btnAcao.classList.contains('btn-editar')) {
                abrirFormulario('editar', id);
            } else if (btnAcao.classList.contains('btn-excluir')) {
                if (!permissoesAcesso.delete) {
                    window.appAlert('Acesso Negado', 'Você não tem permissão para excluir lotes de ajuste.', 'error');
                    return;
                }
                const conf = await window.appConfirm('Excluir Lote de Ajuste', 'Deseja realmente apagar este Lote? Atenção: Os equipamentos dentro dele voltarão para a fila de PENDENTES.', 'danger');
                if (conf) {
                    await window.db.from('coletas_mac').update({ ajuste_estoque_id: null, produto_patrimonio_erp: null, status: 'PENDENTE' }).eq('ajuste_estoque_id', id);
                    await window.db.from('ajustes_estoque').delete().eq('id', id);
                    window.appAlert('Sucesso', 'Ajuste excluído e MACs revertidos.', 'success'); 
                    buscarAjustes();
                }
            } else if (btnAcao.classList.contains('btn-historico')) { 
                if(window.abrirHistorico) window.abrirHistorico('ajustes_estoque', id); 
            }
            return;
        }

        const btnAlmox = e.target.closest('#btn-busca-almox') || e.target.closest('#ajuste-almox-desc');
        if (btnAlmox && !inAlmoxDesc.readOnly) { abrirModalConsulta(); return; }
        
        const chkItem = e.target.closest('.chk-mac-item');
        if (chkItem) {
            const tr = chkItem.closest('tr');
            const inErp = tr.querySelector('.in-erp-id');
            if (chkItem.checked) {
                inErp.disabled = false;
                if (modoForm === 'novo') inErp.focus();
                tr.style.background = '#f0fdf4';
            } else {
                inErp.disabled = true;
                if (modoForm === 'novo') inErp.value = '';
                tr.style.background = 'transparent';
            }
            atualizarContadorSelecao();
        }
    });

    moduloContent.addEventListener('input', (e) => {
        if (e.target.closest('#modal-ajuste') && !e.target.classList.contains('filter-input')) formFoiAlterado = true;
    });

    chkAllMacs.addEventListener('change', () => {
        const isChecked = chkAllMacs.checked;
        moduloContent.querySelectorAll('.chk-mac-item').forEach(chk => {
            chk.checked = isChecked;
            const tr = chk.closest('tr');
            const inErp = tr.querySelector('.in-erp-id');
            inErp.disabled = !isChecked;
            if (!isChecked) { 
                if (modoForm === 'novo') inErp.value = ''; 
                tr.style.background = 'transparent'; 
            } else { 
                tr.style.background = '#f0fdf4'; 
            }
        });
        atualizarContadorSelecao();
    });

    function atualizarContadorSelecao() {
        const val = moduloContent.querySelectorAll('.chk-mac-item:checked').length;
        lblTotalMacsSel.innerText = val;
        formFoiAlterado = true;
    }

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

    // ================= LÓGICA DO MODAL DE AJUSTE =================
    btnNovoAjuste.addEventListener('click', () => {
        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para criar lotes de ajuste.', 'error');
            return;
        }
        abrirFormulario('novo', null);
    });
    
    async function fecharModalAjuste() {
        if (formFoiAlterado && modoForm !== 'visualizar') {
            const conf = await window.appConfirm('Atenção', 'As configurações não foram salvas. Deseja realmente sair?', 'warning');
            if(!conf) return;
        }
        modalAjuste.style.display = 'none';
        formFoiAlterado = false;
    }
    moduloContent.querySelector('#btn-fechar-ajuste').addEventListener('click', fecharModalAjuste);

    async function abrirFormulario(modo, id) {
        const mapaModoPerm = { novo: 'create', editar: 'edit' };
        if (mapaModoPerm[modo] && !permissoesAcesso[mapaModoPerm[modo]]) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para executar esta ação.', 'error');
            return;
        }

        modoForm = modo;
        registroEmEdicaoId = id;
        formFoiAlterado = false;
        macsDisponiveis = [];
        
        inAlmoxId.value = ''; inAlmoxDesc.value = ''; 
        inIdEntrada.value = ''; inIdInventario.value = ''; inObs.value = '';
        inDataAjuste.value = new Date().toISOString().split('T')[0];
        
        chkAllMacs.checked = false;
        chkAllMacs.disabled = false;
        lblTotalMacsSel.innerText = '0';
        
        tabBtns[0].click(); 
        
        if (modo === 'novo') {
            modalTitulo.innerHTML = `<i data-lucide="layers" style="color: var(--cnx-orange); width: 20px;"></i> <span>Criar Lote de Ajuste</span>`;
            inAlmoxDesc.readOnly = false; inIdEntrada.readOnly = false; inIdInventario.readOnly = false;
            inDataAjuste.readOnly = false; inObs.readOnly = false;
            btnBuscaAlmox.style.display = 'block';
            montarFooterFormulario(true);
            tbodyMacs.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">Selecione um Almoxarifado de Origem na Aba 1 para listar os MACs pendentes.</td></tr>`;
        } else {
            const r = todosAjustes.find(x => x.id === id);
            if (!r) return;
            
            modalTitulo.innerHTML = `<i data-lucide="layers" style="color: var(--cnx-orange); width: 20px;"></i> <span>Detalhes do Ajuste de Estoque</span>`;
            
            inDataAjuste.value = r.data_ajuste ? r.data_ajuste.split('T')[0] : '';
            inAlmoxId.value = r.almoxarifado_id; inAlmoxDesc.value = r.almoxarifadoDesc;
            inIdEntrada.value = r.id_entrada_erp; inIdInventario.value = r.id_inventario_erp; inObs.value = r.observacoes;
            
            if (modo === 'visualizar') {
                inAlmoxDesc.readOnly = true; inIdEntrada.readOnly = true; inIdInventario.readOnly = true;
                inDataAjuste.readOnly = true; inObs.readOnly = true;
                btnBuscaAlmox.style.display = 'none';
                chkAllMacs.disabled = true;
                montarFooterFormulario(false);
            } else if (modo === 'editar') {
                inAlmoxDesc.readOnly = true;
                inIdEntrada.readOnly = false; inIdInventario.readOnly = false;
                inDataAjuste.readOnly = false; inObs.readOnly = false;
                btnBuscaAlmox.style.display = 'none';
                chkAllMacs.disabled = false;
                montarFooterFormulario(true);
            }
            await carregarMacsDoAjuste(id, modo);
        }
        
        modalAjuste.style.display = 'flex';
        lucide.createIcons();
    }

    async function carregarMacsPendentes(idAlmox) {
        tbodyMacs.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i> Buscando pendências...</td></tr>`;
        lucide.createIcons();
        
        const { data, error } = await window.db
            .from('coletas_mac')
            .select(`
                *,
                produto:produtos(codigo, descricao),
                almoxarifado_origem:almoxarifados!almoxarifado_id(codigo, descricao),
                almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao)
            `)
            .eq('almoxarifado_id', idAlmox)
            .eq('status', 'PENDENTE')
            .order('data_coleta', { ascending: true });

        if (error) {
            console.error('Erro ao buscar MACs pendentes:', error);
            tbodyMacs.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #ef4444;">Erro ao buscar pendências.</td></tr>`;
            return;
        }

        macsDisponiveis = data || [];
        
        if (macsDisponiveis.length === 0) {
            tbodyMacs.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #10b981; font-weight:700;"><i data-lucide="check-circle" style="width:24px; height:24px; margin-bottom:8px;"></i><br>Nenhum equipamento pendente de ajuste neste Almoxarifado!</td></tr>`;
            lucide.createIcons();
            return;
        }

        renderizarGridMacs(true, false);
    }

    async function carregarMacsDoAjuste(idAjuste, modo) {
        tbodyMacs.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i> Carregando equipamentos vinculados...</td></tr>`;
        lucide.createIcons();
        
        const { data, error } = await window.db
            .from('coletas_mac')
            .select(`
                *,
                produto:produtos(codigo, descricao),
                almoxarifado_origem:almoxarifados!almoxarifado_id(codigo, descricao),
                almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao)
            `)
            .eq('ajuste_estoque_id', idAjuste);

        if (error) {
            console.error('Erro ao buscar MACs do ajuste:', error);
            tbodyMacs.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #ef4444;">Erro ao carregar equipamentos vinculados.</td></tr>`;
            return;
        }

        macsDisponiveis = data || [];
        lblTotalMacsSel.innerText = macsDisponiveis.length;
        
        renderizarGridMacs(modo === 'editar', true);
    }

    function renderizarGridMacs(editavel, jaSalvos = false) {
        tbodyMacs.innerHTML = macsDisponiveis.map(m => {
            const pDesc = m.produto ? `${m.produto.codigo} - ${m.produto.descricao}` : '-';
            const mDesc = `<div style="font-weight:800; color:var(--cnx-orange);">${m.mac}</div><div style="font-size:0.7rem; color:#64748b;">SN: ${m.numero_serie || '-'}</div>`;
            const origDesc = m.almoxarifado_origem
                ? `${m.almoxarifado_origem.codigo} - ${m.almoxarifado_origem.descricao}`
                : '-';
            const destDesc = m.almoxarifado_destino
                ? `${m.almoxarifado_destino.codigo} - ${m.almoxarifado_destino.descricao}`
                : '-';
            const dFmt = m.data_coleta ? new Date(m.data_coleta + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
            const oDesc = `<div style="font-weight:700; color:var(--cnx-blue);">${m.numero_os || '-'}</div><div style="font-size:0.7rem; color:#64748b;">${dFmt}</div>`;
            
            if (editavel) {
                const checkedStr = jaSalvos ? 'checked' : '';
                const disabledStr = jaSalvos ? '' : 'disabled';
                const bgCor = jaSalvos ? 'background: #f0fdf4;' : '';
                const valErp = m.produto_patrimonio_erp || '';

                return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s; ${bgCor}">
                    <td style="padding: 0.6rem; text-align: center;"><input type="checkbox" class="chk-mac-item" data-id="${m.id}" ${checkedStr} style="cursor: pointer;"></td>
                    <td style="padding: 0.6rem; font-size: 0.76rem;">${pDesc}</td>
                    <td style="padding: 0.6rem;">${mDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${origDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${destDesc}</td>
                    <td style="padding: 0.6rem;">${oDesc}</td>
                    <td style="padding: 0.4rem; background: #f0f9ff; border-left: 1px solid #bae6fd;">
                        <input type="text" class="in-erp-id input-standard input-upper" placeholder="ID IXC..." value="${valErp}" ${disabledStr} style="width: 100%; border: 1px solid #7dd3fc; border-radius: 4px; padding: 4px 8px; font-weight: 800; color: var(--cnx-blue);">
                    </td>
                </tr>`;
            } else {
                return `
                <tr style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                    <td style="padding: 0.6rem; text-align: center;"><i data-lucide="check" style="color:#10b981; width:16px;"></i></td>
                    <td style="padding: 0.6rem; font-size: 0.76rem;">${pDesc}</td>
                    <td style="padding: 0.6rem;">${mDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${origDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${destDesc}</td>
                    <td style="padding: 0.6rem;">${oDesc}</td>
                    <td style="padding: 0.6rem; background: #f0f9ff; border-left: 1px solid #bae6fd; font-weight: 800; color: var(--cnx-blue); text-align: center;">
                        ${m.produto_patrimonio_erp || '-'}
                    </td>
                </tr>`;
            }
        }).join('');
        lucide.createIcons();
    }

    function montarFooterFormulario(showSave) {
        if (!showSave) {
            footerAjuste.innerHTML = `<button class="btn-cancel" id="btn-fechar-visao">Fechar</button>`;
            footerAjuste.querySelector('#btn-fechar-visao').addEventListener('click', fecharModalAjuste);
        } else {
            footerAjuste.innerHTML = `
                <button class="btn-cancel" id="btn-cancel-form">Cancelar</button>
                <button class="btn-save" id="btn-salvar-form" style="background: var(--cnx-blue); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <i data-lucide="check-square" style="width: 16px; color: white;"></i> <span>Confirmar Ajuste</span>
                </button>
            `;
            footerAjuste.querySelector('#btn-cancel-form').addEventListener('click', fecharModalAjuste);
            footerAjuste.querySelector('#btn-salvar-form').addEventListener('click', salvarAjuste);
        }
        lucide.createIcons();
    }

    async function salvarAjuste() {
        const idAlmox = inAlmoxId.value;
        const entErp = inIdEntrada.value.trim().toUpperCase();
        const invErp = inIdInventario.value.trim().toUpperCase();
        const dt = inDataAjuste.value;
        
        if (!idAlmox || !entErp || !invErp || !dt) { window.appAlert("Atenção", "Preencha todos os campos obrigatórios (*) na Aba 1.", "warning"); return; }
        
        const chks = Array.from(moduloContent.querySelectorAll('.chk-mac-item:checked'));
        if (chks.length === 0) { window.appAlert("Atenção", "Selecione pelo menos um MAC na Aba 2 para vincular ao lote.", "warning"); return; }

        let macsParaAtualizar = [];
        for (let chk of chks) {
            const tr = chk.closest('tr');
            const inErp = tr.querySelector('.in-erp-id');
            const valErp = inErp.value.trim().toUpperCase();
            if (!valErp) {
                window.appAlert("Atenção", "Você marcou um MAC mas não informou o Novo ID Patrimônio (ERP) na frente dele.", "warning");
                inErp.focus(); return;
            }
            macsParaAtualizar.push({ id_coleta: chk.dataset.id, novo_id_erp: valErp });
        }

        const unchks = Array.from(moduloContent.querySelectorAll('.chk-mac-item:not(:checked)'));
        let macsParaDesvincular = unchks.map(c => c.dataset.id);

        const conf = await window.appConfirm('Salvar Ajuste', `Deseja consolidar o lote com ${macsParaAtualizar.length} equipamento(s)?`);
        if(!conf) return;

        const btnSave = footerAjuste.querySelector('#btn-salvar-form');
        btnSave.disabled = true; btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Gravando...`;

        try {
            const payload = {
                almoxarifado_id: idAlmox,
                id_entrada_erp: entErp,
                id_inventario_erp: invErp,
                data_ajuste: dt,
                observacoes: inObs.value.trim().toUpperCase()
            };

            if (modoForm === 'novo') {
                payload.usuario_supervisor_id = usuarioLogadoId;
                
                const { data: newAjuste, error: errAjuste } = await window.db.from('ajustes_estoque').insert([payload]).select('id').single();
                if (errAjuste) throw errAjuste;

                for (let item of macsParaAtualizar) {
                    await window.db.from('coletas_mac').update({
                        produto_patrimonio_erp: item.novo_id_erp,
                        ajuste_estoque_id: newAjuste.id,
                        status: 'AJUSTADO'
                    }).eq('id', item.id_coleta);
                }
            } else {
                const { error: errAjuste } = await window.db.from('ajustes_estoque').update(payload).eq('id', registroEmEdicaoId);
                if (errAjuste) throw errAjuste;

                for (let item of macsParaAtualizar) {
                    await window.db.from('coletas_mac').update({
                        produto_patrimonio_erp: item.novo_id_erp,
                        ajuste_estoque_id: registroEmEdicaoId,
                        status: 'AJUSTADO'
                    }).eq('id', item.id_coleta);
                }

                if (macsParaDesvincular.length > 0) {
                    await window.db.from('coletas_mac').update({
                        produto_patrimonio_erp: null,
                        ajuste_estoque_id: null,
                        status: 'PENDENTE'
                    }).in('id', macsParaDesvincular);
                }
            }

            formFoiAlterado = false;
            window.appAlert("Sucesso", `Lote salvo e configurações aplicadas!`, "success");
            modalAjuste.style.display = 'none';
            await buscarAjustes();
        } catch (e) { console.error(e); window.appAlert("Erro", "Falha ao gravar o lote de ajuste.", "error"); } 
        finally { btnSave.disabled = false; btnSave.innerHTML = `Confirmar Ajuste`; }
    }

    // ================= MODAL DE CONSULTA (LUPA) =================
    async function abrirModalConsulta() {
        inputBuscaConsulta.value = '';
        tbodyConsulta.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        modalConsulta.style.display = 'flex';
        lucide.createIcons();
        renderizarListaConsulta();
    }

    moduloContent.querySelector('#btn-fechar-consulta-ajuste').addEventListener('click', () => modalConsulta.style.display = 'none');
    inputBuscaConsulta.addEventListener('input', renderizarListaConsulta);

    function renderizarListaConsulta() {
        const termo = inputBuscaConsulta.value.trim().toUpperCase();
        let lista = almoxarifados.filter(a => meusAlmoxarifadosIds.includes(a.id));
        if (termo) {
            lista = lista.filter(a =>
                String(a.codigo || '').toUpperCase().includes(termo) ||
                String(a.descricao || '').toUpperCase().includes(termo)
            );
        }

        lista.sort((a, b) =>
            String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR', { sensitivity: 'base' })
        );
        
        if (lista.length === 0) {
            tbodyConsulta.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b;">Nenhum almoxarifado disponível.</td></tr>`;
        } else {
            tbodyConsulta.innerHTML = lista.map(a => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.6rem; font-weight:700;">${a.codigo}</td>
                    <td style="padding: 0.6rem;">${a.descricao}</td>
                    <td style="padding: 0.6rem; text-align: center;"><button type="button" onclick="window.selecAlmoxAjuste('${a.id}')" style="background:none; border:none; cursor:pointer;"><i data-lucide="check-circle" style="color:var(--cnx-blue); width:20px;"></i></button></td>
                </tr>
            `).join('');
            lucide.createIcons();
        }
    }

    window.selecAlmoxAjuste = function(id) {
        const a = almoxarifados.find(x => x.id === id);
        if (a) { 
            inAlmoxId.value = a.id; 
            inAlmoxDesc.value = `${a.codigo} - ${a.descricao}`; 
            formFoiAlterado = true; 
            modalConsulta.style.display = 'none'; 
            carregarMacsPendentes(a.id);
        }
    };

    // Prevenção Modal Global Esc
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const mConsulta = modalConsulta;
            const mPrincipal = modalAjuste;
            
            if (mConsulta && mConsulta.style.display !== 'none') { e.preventDefault(); e.stopPropagation(); mConsulta.style.display = 'none'; return; }
            if (mPrincipal && mPrincipal.style.display !== 'none') { e.preventDefault(); e.stopPropagation(); fecharModalAjuste(); }
        }
    }, true);

    carregarDadosIniciais();
})();