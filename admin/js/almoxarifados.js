// js/almoxarifados.js
(async function initModuloAlmoxarifados() {
    console.log("Módulo Almoxarifados carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-almoxarifados .modulo-container');
    if (!moduloContent) return;

    const tbodyAlmox = moduloContent.querySelector('#tabela-almoxarifados-body');
    const lblTotalGeral = moduloContent.querySelector('#lbl-total-geral');
    const lblTotalExibidos = moduloContent.querySelector('#lbl-total-exibidos');
    
    // Filtros
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const inputStatus = moduloContent.querySelector('#filtro-valor-status');
    const wrapperTexto = moduloContent.querySelector('#wrapper-texto');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    
    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    
    // Tags
    const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');
    const containerTagsInline = moduloContent.querySelector('#container-tags-inline');
    const btnToggleTags = moduloContent.querySelector('#btn-toggle-tags');
    const lblTagsExtra = moduloContent.querySelector('#lbl-tags-extra');
    const dropdownTags = moduloContent.querySelector('#dropdown-tags');
    const containerTagsDropdown = moduloContent.querySelector('#container-tags-dropdown');

    // Modal
    const modalAlmox = moduloContent.querySelector('#modal-almoxarifado');
    const modalTitulo = moduloContent.querySelector('#modal-titulo');
    const btnNovo = moduloContent.querySelector('#btn-novo-almoxarifado');
    const btnFechar = moduloContent.querySelector('#btn-fechar-modal');
    const btnCancelar = moduloContent.querySelector('#btn-cancelar-modal');
    const btnSalvar = moduloContent.querySelector('#btn-salvar-almoxarifado');
    
    // Inputs Form
    const inCodigo = moduloContent.querySelector('#almox-codigo');
    const inDescricao = moduloContent.querySelector('#almox-descricao');
    const inTipo = moduloContent.querySelector('#almox-tipo');
    const inCidade = moduloContent.querySelector('#almox-cidade');
    const inAbastecedor = moduloContent.querySelector('#almox-abastecedor');

    // Variáveis
    let almoxarifadosRaw = [];
    let almoxarifadosCompletos = [];
    let filtrosAtivos = [];
    let sortConfig = { key: 'codigo', direction: 'asc' };
    
    let usuarioLogadoId = null;
    let permissoesAcesso = { view: false, create: false, edit: false, delete: false };
    
    let modoEdicao = false;
    let modoVisualizacao = false;
    let almoxEmEdicaoId = null;
    let formStateOriginal = "";

    async function carregarPermissoes() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (session) {
                usuarioLogadoId = session.user.id;
                const { data: user } = await window.db.from('usuarios').select('cargos(nome, permissoes)').eq('id', usuarioLogadoId).single();
                
                if (user?.cargos?.nome && user.cargos.nome.toUpperCase() === 'ADMINISTRADOR') {
                    permissoesAcesso = { view: true, create: true, edit: true, delete: true };
                } else if (user?.cargos?.permissoes?.almoxarifados) {
                    permissoesAcesso = user.cargos.permissoes.almoxarifados;
                }
            }
            
            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar o Cadastro de Almoxarifados.</p></div>`;
                lucide.createIcons();
                return false;
            }
            
            if (!permissoesAcesso.create) btnNovo.style.display = 'none';
            return true;
        } catch (error) { 
            console.error(error); 
            return false; 
        }
    }

    async function carregarDadosIniciais() {
        const autorizado = await carregarPermissoes();
        if (!autorizado) return;
        
        await buscarAlmoxarifadosGrid();
    }

    function popularSelectAbastecedores(excluirId = null) {
        if (!inAbastecedor) return;
        let html = '<option value="">Nenhum (Centro Principal / Sem Abastecedor Direto)</option>';

        const ordenados = [...almoxarifadosRaw]
            .filter(a => a.id !== excluirId)
            .sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' }));

        ordenados.forEach(a => {
            html += `<option value="${a.id}">${a.codigo} - ${a.descricao}</option>`;
        });

        inAbastecedor.innerHTML = html;
    }

    async function buscarAlmoxarifadosGrid() {
        tbodyAlmox.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin" style="width:24px; color:var(--cnx-orange);"></i></td></tr>`;
        lucide.createIcons();

        const { data, error } = await window.db.from('almoxarifados').select('*').order('codigo');
        
        if (error) {
            tbodyAlmox.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Erro ao carregar dados do banco.</td></tr>`;
            return;
        }
        
        almoxarifadosRaw = data || [];

        // Monta objetos enriquecidos com o nome do almoxarifado abastecedor correspondente
        almoxarifadosCompletos = almoxarifadosRaw.map(a => {
            let nomeAbast = 'Nenhum';
            if (a.almoxarifado_abastecedor_id) {
                const pai = almoxarifadosRaw.find(x => x.id === a.almoxarifado_abastecedor_id);
                if (pai) nomeAbast = `${pai.codigo} - ${pai.descricao}`;
            }
            return {
                ...a,
                abastecedorNome: nomeAbast
            };
        });

        if (lblTotalGeral) lblTotalGeral.innerText = almoxarifadosCompletos.length;
        aplicarFiltrosEOrdenar();
    }

    // ================= LÓGICA DE FILTROS =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');

        if (val === 'status') { 
            inputStatus.style.display = 'block'; 
            wrapperTexto.style.display = 'none'; 
        } else if (val === 'tipo') {
            const selTipoFiltro = moduloContent.querySelector('#filtro-valor-tipo');
            if (selTipoFiltro) selTipoFiltro.style.display = 'block';
            wrapperTexto.style.display = 'none';
        } else {
            wrapperTexto.style.display = 'flex';
            inputTexto.value = '';
            chkExato.checked = false;
        }
    });

    btnAddFiltro.addEventListener('click', adicionarFiltro);
    btnAplicarFiltro.addEventListener('click', adicionarFiltro); 
    inputTexto.addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFiltro(); });

    function adicionarFiltro() {
        const campo = comboCampo.value;
        const labelCampo = comboCampo.options[comboCampo.selectedIndex].text;
        let valor = '', labelValor = '', exato = false;

        if (campo === 'status') {
            valor = inputStatus.value;
            labelValor = inputStatus.options[inputStatus.selectedIndex].text;
            exato = true;
        } else if (campo === 'tipo') {
            const selTipoFiltro = moduloContent.querySelector('#filtro-valor-tipo');
            valor = selTipoFiltro ? selTipoFiltro.value : 'TÉCNICO';
            labelValor = valor;
            exato = true;
        } else {
            valor = inputTexto.value.trim().toUpperCase();
            if (!valor) return;
            labelValor = valor;
            exato = chkExato.checked;
            inputTexto.value = ''; 
        }

        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros();
        aplicarFiltrosEOrdenar();
    }

    function removerFiltro(idFiltro) {
        filtrosAtivos = filtrosAtivos.filter(f => f.id !== idFiltro);
        renderizarTagsFiltros();
        aplicarFiltrosEOrdenar();
    }
    window.removerFiltroAlmox = removerFiltro;

    btnLimparFiltros.addEventListener('click', () => {
        filtrosAtivos = [];
        inputTexto.value = '';
        renderizarTagsFiltros();
        aplicarFiltrosEOrdenar();
    });

    function renderizarTagsFiltros() {
        containerTagsInline.innerHTML = ''; containerTagsDropdown.innerHTML = '';
        if (filtrosAtivos.length === 0) {
            lblFiltrosAtivos.innerText = "Nenhum filtro aplicado";
            lblFiltrosAtivos.style.display = 'inline';
            btnToggleTags.style.display = 'none'; dropdownTags.style.display = 'none';
            return;
        }

        lblFiltrosAtivos.style.display = 'none';

        filtrosAtivos.forEach((f, index) => {
            const isExato = f.exato && f.campo !== 'status' && f.campo !== 'tipo' ? ' (Exato)' : '';
            const tagInline = `
                <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                    <span style="color: #64748b;">${f.labelCampo}${isExato}:</span>
                    <strong style="color: var(--cnx-blue);">${f.labelValor}</strong>
                    <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroAlmox(${f.id})">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i>
                    </button>
                </div>
            `;
            const tagDropdown = `
                <div style="background: white; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem;">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span style="color: #64748b;">${f.labelCampo}${isExato}:</span>
                        <strong style="color: var(--cnx-blue);">${f.labelValor}</strong>
                    </div>
                    <button style="background:#fee2e2; border:none; padding:4px; border-radius:4px; cursor:pointer;" onclick="window.removerFiltroAlmox(${f.id})" title="Remover filtro">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444;"></i>
                    </button>
                </div>
            `;
            if (index === 0) containerTagsInline.innerHTML = tagInline;
            containerTagsDropdown.innerHTML += tagDropdown;
        });

        if (filtrosAtivos.length > 1) {
            btnToggleTags.style.display = 'flex'; lblTagsExtra.innerText = filtrosAtivos.length - 1;
        } else {
            btnToggleTags.style.display = 'none'; dropdownTags.style.display = 'none';
        }
        lucide.createIcons();
    }

    btnToggleTags.addEventListener('click', (e) => { e.stopPropagation(); dropdownTags.style.display = dropdownTags.style.display === 'none' ? 'block' : 'none'; });
    document.addEventListener('click', (e) => { if (!e.target.closest('#dropdown-tags') && !e.target.closest('#btn-toggle-tags')) { if(dropdownTags) dropdownTags.style.display = 'none'; } });

    // ================= PROCESSAMENTO DA GRELHA E ORDENAÇÃO =================
    if (window.configurarOrdenacaoTabela) {
        window.configurarOrdenacaoTabela(moduloContent, sortConfig, aplicarFiltrosEOrdenar);
    }

    function aplicarFiltrosEOrdenar() {
        let listaFiltrada = [...almoxarifadosCompletos];

        filtrosAtivos.forEach(filtro => {
            listaFiltrada = listaFiltrada.filter(item => {
                if (filtro.campo === 'status') return String(item.status) === filtro.valor;
                if (filtro.campo === 'tipo') return String(item.tipo || '').toUpperCase() === filtro.valor;
                
                const valorCampo = String(item[filtro.campo] || '').toUpperCase();
                if (filtro.exato) return valorCampo === filtro.valor;
                return valorCampo.includes(filtro.valor);
            });
        });

        if (window.ordenarDadosTabela) {
            listaFiltrada = window.ordenarDadosTabela(listaFiltrada, sortConfig);
        }

        if (lblTotalExibidos) lblTotalExibidos.innerText = listaFiltrada.length;
        renderizarGrid(listaFiltrada);
    }

    function renderizarGrid(lista) {
        if (lista.length === 0) {
            tbodyAlmox.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum almoxarifado encontrado.</td></tr>`;
            return;
        }

        tbodyAlmox.innerHTML = lista.map(a => {
            const isAtivo = a.status === 'ATIVO';
            const statusBadge = isAtivo 
                ? `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ATIVO</span>`
                : `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">INATIVO</span>`;
            
            const tipoUpper = (a.tipo || '').toUpperCase();
            let tipoBadge = `<span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">NÃO DEFINIDO</span>`;
            if (tipoUpper === 'TÉCNICO') {
                tipoBadge = `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">TÉCNICO</span>`;
            } else if (tipoUpper === 'LOJA') {
                tipoBadge = `<span style="background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">LOJA</span>`;
            } else if (tipoUpper === 'ESTOQUE') {
                tipoBadge = `<span style="background: #ede9fe; color: #6d28d9; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ESTOQUE</span>`;
            }

            let botoesAcao = `<button class="btn-ver" data-id="${a.id}" title="Visualizar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width: 14px;"></i></button>`;
            
            botoesAcao += `<button class="btn-hist" data-id="${a.id}" title="Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width: 14px;"></i></button>`;
            
            if (permissoesAcesso.edit) {
                botoesAcao += `<button class="btn-editar" data-id="${a.id}" title="Editar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit" style="width: 14px;"></i></button>`;
            }
            if (permissoesAcesso.delete) {
                botoesAcao += `<button class="btn-status" data-id="${a.id}" data-ativo="${isAtivo}" data-desc="${a.descricao}" title="Alterar Status" style="background:none; border:none; color:${isAtivo ? '#166534' : '#94a3b8'}; cursor:pointer;"><i data-lucide="toggle-right" style="width: 14px;"></i></button>`;
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1.25rem; font-weight: 700; color: var(--cnx-blue);">${a.codigo}</td>
                    <td style="padding: 0.6rem 1.25rem;">${a.descricao}</td>
                    <td style="padding: 0.6rem 1.25rem;">${tipoBadge}</td>
                    <td style="padding: 0.6rem 1.25rem; color: #64748b; font-size: 0.8rem;">${a.cidade || '-'}</td>
                    <td style="padding: 0.6rem 1.25rem; color: #475569; font-size: 0.8rem; font-weight: 600;">${a.abastecedorNome}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center;">${statusBadge}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center; display: flex; justify-content: center; gap: 8px;">
                        ${botoesAcao}
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ================== AÇÕES DO MODAL ==================
    function getFormState() {
        return JSON.stringify({
            codigo: inCodigo.value,
            descricao: inDescricao.value,
            tipo: inTipo.value,
            cidade: inCidade.value,
            abastecedor: inAbastecedor.value
        });
    }

    function alternarModoLeitura(somenteLeitura) {
        modoVisualizacao = somenteLeitura;
        const inputs = moduloContent.querySelectorAll('#modal-almoxarifado input, #modal-almoxarifado select');
        
        inputs.forEach(el => {
            el.disabled = somenteLeitura;
            if (somenteLeitura) {
                el.style.opacity = '0.8';
                el.style.cursor = 'not-allowed';
            } else {
                el.style.opacity = '1';
                el.style.cursor = el.tagName === 'SELECT' ? 'pointer' : 'text';
            }
        });

        btnSalvar.style.display = somenteLeitura ? 'none' : 'flex';
    }

    btnNovo.addEventListener('click', () => {
        modoEdicao = false; almoxEmEdicaoId = null;
        inCodigo.value = ''; inDescricao.value = ''; inTipo.value = 'TÉCNICO'; inCidade.value = '';
        
        popularSelectAbastecedores(null);
        alternarModoLeitura(false);
        modalTitulo.innerHTML = `<i data-lucide="warehouse" style="color: var(--cnx-orange); width: 20px;"></i> <span>Cadastrar Novo Almoxarifado</span>`;
        
        setTimeout(() => { formStateOriginal = getFormState(); }, 50);
        modalAlmox.style.display = 'flex';
        lucide.createIcons();
    });

    async function fecharComValidacao() {
        if (!modoVisualizacao) {
            const estadoAtual = getFormState();
            if (estadoAtual !== formStateOriginal) {
                const conf = await window.appConfirm('Descartar Alterações?', 'Existem dados não guardados. Tem certeza que deseja fechar?', 'warning', 'Sim, descartar', 'Não, voltar');
                if (!conf) return;
            }
        }
        modalAlmox.style.display = 'none';
    }

    btnFechar.addEventListener('click', fecharComValidacao);
    btnCancelar.addEventListener('click', fecharComValidacao);

    tbodyAlmox.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-editar');
        const btnVer = e.target.closest('.btn-ver');
        const btnStatus = e.target.closest('.btn-status');
        const btnHist = e.target.closest('.btn-hist');

        if (btnHist) {
            if(window.abrirHistorico) window.abrirHistorico('almoxarifados', btnHist.dataset.id);
            return;
        }

        if (btnStatus) {
            const id = btnStatus.dataset.id;
            const desc = btnStatus.dataset.desc;
            const isAtivo = btnStatus.dataset.ativo === 'true';
            const novoStatus = isAtivo ? 'INATIVO' : 'ATIVO';
            const conf = await window.appConfirm('Confirmar Ação', `Deseja realmente <strong>${novoStatus}</strong> o almoxarifado ${desc}?`, 'warning');
            
            if(conf) {
                const { error } = await window.db.from('almoxarifados').update({ status: novoStatus }).eq('id', id);
                if (error) { window.appAlert('Erro', 'Ocorreu um erro ao atualizar o status.', 'error'); return; }
                
                window.appAlert('Sucesso', `Almoxarifado atualizado para ${novoStatus}.`, 'success');
                buscarAlmoxarifadosGrid();
            }
            return;
        }

        if (btnVer) {
            abrirModalEdicao(btnVer.dataset.id, true);
        } else if (btnEdit) {
            abrirModalEdicao(btnEdit.dataset.id, false);
        }
    });

    function abrirModalEdicao(id, apenasLeitura) {
        const a = almoxarifadosRaw.find(x => x.id === id);
        if(!a) return;

        modoEdicao = true;
        almoxEmEdicaoId = id;

        popularSelectAbastecedores(id); // Exclui o próprio ID da lista para evitar auto-referência

        inCodigo.value = a.codigo || '';
        inDescricao.value = a.descricao || '';
        inTipo.value = a.tipo || 'TÉCNICO';
        inCidade.value = a.cidade || '';
        inAbastecedor.value = a.almoxarifado_abastecedor_id || '';

        alternarModoLeitura(apenasLeitura);
        
        const icone = apenasLeitura ? 'eye' : 'edit';
        const tituloTexto = apenasLeitura ? 'Visualizar Almoxarifado' : 'Editar Almoxarifado';
        modalTitulo.innerHTML = `<i data-lucide="${icone}" style="color: var(--cnx-orange); width: 20px;"></i> <span>${tituloTexto}: ${a.descricao}</span>`;
        
        setTimeout(() => { formStateOriginal = getFormState(); }, 50);
        modalAlmox.style.display = 'flex';
        lucide.createIcons();
    }

    // Gravar Dados
    btnSalvar.addEventListener('click', async () => {
        if(!inCodigo.value || !inDescricao.value || !inTipo.value) { 
            window.appAlert("Dados Incompletos", "Preencha todos os campos obrigatórios (*).", "warning"); 
            return; 
        }

        const estadoAtual = getFormState();
        if (estadoAtual === formStateOriginal) {
            window.appAlert("Atenção", "Nenhuma alteração foi realizada.", "info");
            return;
        }

        const conf = await window.appConfirm("Gravar Almoxarifado", "Deseja salvar as alterações efetuadas?", "info");
        if (!conf) return;
        
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width: 16px;"></i> A Guardar...`;
        lucide.createIcons();

        try {
            const payload = {
                codigo: inCodigo.value.trim().toUpperCase(),
                descricao: inDescricao.value.trim().toUpperCase(),
                tipo: inTipo.value,
                cidade: inCidade.value ? inCidade.value.trim().toUpperCase() : null,
                almoxarifado_abastecedor_id: inAbastecedor.value ? inAbastecedor.value : null
            };

            if (modoEdicao) {
                const { error } = await window.db.from('almoxarifados').update(payload).eq('id', almoxEmEdicaoId);
                if (error) throw new Error("Erro ao atualizar o almoxarifado: " + error.message);
            } else {
                payload.status = 'ATIVO';
                const { error } = await window.db.from('almoxarifados').insert([payload]);
                if (error) throw new Error("Erro ao cadastrar novo almoxarifado: " + error.message);
            }

            window.appAlert("Sucesso", "O cadastro foi gravado com sucesso no sistema.", "success");
            modalAlmox.style.display = 'none';
            buscarAlmoxarifadosGrid();
            
        } catch (err) {
            console.error("Falha ao salvar:", err);
            window.appAlert("Erro de Gravação", err.message || "Ocorreu um erro ao salvar o registro no banco de dados.", "error");
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = `<i data-lucide="save" style="width: 16px; color: var(--cnx-orange);"></i> <span>Salvar Cadastro</span>`;
            lucide.createIcons();
        }
    });

    // Iniciar
    carregarDadosIniciais();

})();