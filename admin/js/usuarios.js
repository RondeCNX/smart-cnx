(async function initModuloUsuarios() {
    console.log("Módulo Gestão de Usuários carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-usuarios .modulo-container');
    if (!moduloContent) return; 

    const tbodyUsuarios = moduloContent.querySelector('#tabela-usuarios-body');
    const lblTotalGeral = moduloContent.querySelector('#lbl-total-geral');
    const lblTotalExibidos = moduloContent.querySelector('#lbl-total-exibidos');
    
    // Filtros
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const inputStatus = moduloContent.querySelector('#filtro-valor-status');
    const inputAlmox = moduloContent.querySelector('#filtro-valor-almox');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    const lblExato = moduloContent.querySelector('#lbl-filtro-exato');
    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    
    // Tags de Filtros Ativos
    const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');
    const containerTagsInline = moduloContent.querySelector('#container-tags-inline');
    const btnToggleTags = moduloContent.querySelector('#btn-toggle-tags');
    const lblTagsExtra = moduloContent.querySelector('#lbl-tags-extra');
    const dropdownTags = moduloContent.querySelector('#dropdown-tags');
    const containerTagsDropdown = moduloContent.querySelector('#container-tags-dropdown');

    // Modais e Botoes
    const modalUsuario = moduloContent.querySelector('#modal-usuario');
    const modalTitulo = moduloContent.querySelector('#modal-titulo');
    const btnNovo = moduloContent.querySelector('#btn-novo-usuario');
    const btnFechar = moduloContent.querySelector('#btn-fechar-modal');
    const btnCancelar = moduloContent.querySelector('#btn-cancelar-modal');
    const btnSalvar = moduloContent.querySelector('#btn-salvar-usuario');
    const btnToggleSenha = moduloContent.querySelector('#btn-toggle-senha');
    
    const inNome = moduloContent.querySelector('#usr-nome');
    const inEmail = moduloContent.querySelector('#usr-email');
    const inSenha = moduloContent.querySelector('#usr-senha');
    const inCargo = moduloContent.querySelector('#usr-cargo');
    
    const chkTodosAlmox = moduloContent.querySelector('#usr-acesso-todos');
    const containerTabelaAlmox = moduloContent.querySelector('#container-tabela-vinculos');
    const tbodyAlmox = moduloContent.querySelector('#tabela-vinculos-body');
    
    const fileAvatar = moduloContent.querySelector('#usr-avatar-file');
    const btnUploadAvatar = moduloContent.querySelector('#btn-upload-avatar');
    const avatarPreview = moduloContent.querySelector('#avatar-preview-container');
    const avatarNomeArquivo = moduloContent.querySelector('#avatar-nome-arquivo');

    const containerPermissoes = moduloContent.querySelector('#container-permissoes');
    const avisoPermissoes = moduloContent.querySelector('#permissoes-aviso');
    const tbodyPermissoes = moduloContent.querySelector('#tabela-permissoes-body');


    // Variáveis Globais de Dados
    let usuariosRaw = []; 
    let usuariosCompletos = []; 
    let almoxarifados = [];
    let cargos = [];
    let filtrosAtivos = []; 
    let sortConfig = { key: 'nome_completo', direction: 'asc' };
    
    let usuarioLogadoId = null;
    let isGestorGlobal = false;
    let isAdministrador = false;
    let modoEdicao = false;
    let modoVisualizacao = false;
    let usuarioEmEdicaoId = null;
    let avatarUrlSubmetido = null;
    
    let formStateOriginal = ""; 
    

    // ================== CARGA DE DADOS ==================
    async function carregarDadosIniciais() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (session) {
                usuarioLogadoId = session.user.id;
                const { data: ui } = await window.db.from('usuarios').select('acesso_todos_almoxarifados, cargos(nome)').eq('id', usuarioLogadoId).single();
                isGestorGlobal = ui?.acesso_todos_almoxarifados || false;
                
                if (ui?.cargos?.nome && ui.cargos.nome.toUpperCase() === 'ADMINISTRADOR') {
                    isAdministrador = true;
                    isGestorGlobal = true; 
                }
            }

            const [resCargos, resAlmox] = await Promise.all([
                window.db.from('cargos').select('*').order('nome'),
                window.db.from('almoxarifados').select('id, codigo, descricao').eq('status', 'ATIVO').order('descricao')
            ]);
            cargos = resCargos.data || [];
            almoxarifados = resAlmox.data || [];
            
            inputAlmox.innerHTML = '<option value="">Selecione o Almoxarifado...</option>' + 
                almoxarifados.map(a => `<option value="${a.id}">${a.codigo} - ${a.descricao}</option>`).join('');
                
            inCargo.innerHTML = '<option value="" disabled selected>SELECIONE...</option>' + cargos.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

            tbodyAlmox.innerHTML = almoxarifados.map(a => `
                <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer;">
                    <td style="padding: 0.5rem; text-align: center;"><input type="checkbox" class="chk-almox table-checkbox" value="${a.id}"></td>
                    <td style="padding: 0.5rem; font-weight: 700;">${a.codigo}</td>
                    <td style="padding: 0.5rem;">${a.descricao}</td>
                </tr>
            `).join('');

            await buscarUsuariosGrid();
        } catch (error) { console.error(error); }
    }

    async function buscarUsuariosGrid() {
        tbodyUsuarios.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin" style="width:24px; color:var(--cnx-orange);"></i></td></tr>`;
        lucide.createIcons();

        const { data, error } = await window.db.from('usuarios').select('*, cargos(nome)').order('nome_completo');
        if (error) {
            tbodyUsuarios.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>`;
            return;
        }
        
        usuariosRaw = data || [];
        const { data: vinculos } = await window.db.from('usuario_almoxarifados').select('*');
        
        usuariosCompletos = usuariosRaw.map(u => {
            const vincsUsr = vinculos ? vinculos.filter(v => v.usuario_id === u.id).map(v => v.almoxarifado_id) : [];
            const nomesVincs = almoxarifados.filter(a => vincsUsr.includes(a.id)).map(a => a.descricao).join(', ');
            return {
                ...u,
                cargoNome: u.cargos ? u.cargos.nome : 'Sem Cargo',
                almoxarifadosIds: vincsUsr,
                almoxarifadosNomes: u.acesso_todos_almoxarifados ? 'TODOS OS ALMOXARIFADOS (GESTÃO)' : (nomesVincs || 'NENHUM')
            };
        });

        if (lblTotalGeral) lblTotalGeral.innerText = usuariosCompletos.length;
        aplicarFiltrosEOrdenar(); 
    }

    // ================= LÓGICA DE FILTROS =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');
        lblExato.style.display = 'none';

        if (val === 'ativo') { inputStatus.style.display = 'block'; } 
        else if (val === 'almoxarifadosNomes') { inputAlmox.style.display = 'block'; } 
        else {
            inputTexto.style.display = 'block';
            inputTexto.value = '';
            lblExato.style.display = 'flex';
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

        if (campo === 'ativo') {
            valor = inputStatus.value;
            labelValor = inputStatus.options[inputStatus.selectedIndex].text;
            exato = true;
        } else if (campo === 'almoxarifadosNomes') {
            valor = inputAlmox.value;
            if (!valor) return;
            labelValor = inputAlmox.options[inputAlmox.selectedIndex].text;
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
    window.removerFiltroUsuario = removerFiltro;

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
            const isExato = f.exato && f.campo !== 'ativo' && f.campo !== 'almoxarifadosNomes' ? ' (Exato)' : '';
            const tagInline = `
                <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                    <span style="color: #64748b;">${f.labelCampo}${isExato}:</span>
                    <strong style="color: var(--cnx-blue);">${f.labelValor}</strong>
                    <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroUsuario(${f.id})">
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
                    <button style="background:#fee2e2; border:none; padding:4px; border-radius:4px; cursor:pointer;" onclick="window.removerFiltroUsuario(${f.id})" title="Remover filtro">
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
        let listaFiltrada = [...usuariosCompletos];

        filtrosAtivos.forEach(filtro => {
            listaFiltrada = listaFiltrada.filter(user => {
                if (filtro.campo === 'ativo') return String(user.ativo) === filtro.valor;
                if (filtro.campo === 'almoxarifadosNomes') {
                    if (user.acesso_todos_almoxarifados) return true;
                    return user.almoxarifadosIds.includes(parseInt(filtro.valor));
                }
                const valorCampoUser = String(user[filtro.campo] || '').toUpperCase();
                if (filtro.exato) return valorCampoUser === filtro.valor;
                return valorCampoUser.includes(filtro.valor);
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
            tbodyUsuarios.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum usuário corresponde aos filtros.</td></tr>`;
            return;
        }

        tbodyUsuarios.innerHTML = lista.map(u => {
            const statusBadge = u.ativo 
                ? `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ATIVO</span>`
                : `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">INATIVO</span>`;
            
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1.25rem; font-weight: 700;">${u.nome_completo}</td>
                    <td style="padding: 0.6rem 1.25rem; color: var(--cnx-blue); font-weight: 600;">${u.cargoNome}</td>
                    <td style="padding: 0.6rem 1.25rem; color: #64748b; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;" title="${u.almoxarifadosNomes}">${u.almoxarifadosNomes}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center;">${statusBadge}</td>
                    <td style="padding: 0.6rem 1.25rem; text-align: center; display: flex; justify-content: center; gap: 8px;">
                        <button class="btn-ver" data-id="${u.id}" title="Visualizar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width: 14px;"></i></button>
                        <button class="btn-hist" data-id="${u.id}" title="Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width: 14px;"></i></button>
                        <button class="btn-editar" data-id="${u.id}" title="Editar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit" style="width: 14px;"></i></button>
                        <button class="btn-status" data-id="${u.id}" data-ativo="${u.ativo}" data-nome="${u.nome_completo}" title="Alterar Status" style="background:none; border:none; color:${u.ativo ? '#166534' : '#94a3b8'}; cursor:pointer;"><i data-lucide="toggle-right" style="width: 14px;"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }


    // ================== AÇÕES MODAL ==================

    function getFormState() {
        const almox = Array.from(moduloContent.querySelectorAll('.chk-almox:checked')).map(el => el.value).join(',');
        const perms = Array.from(moduloContent.querySelectorAll('.chk-perm:checked')).map(el => el.dataset.mod + el.dataset.acao).join(',');
        return JSON.stringify({
            n: inNome.value,
            e: inEmail.value,
            c: inCargo.value,
            a: chkTodosAlmox.checked,
            s: inSenha.value,
            al: almox,
            pe: perms,
            av: avatarUrlSubmetido
        });
    }

    moduloContent.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            moduloContent.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.style.borderBottomColor = 'transparent'; b.style.color = '#64748b'; });
            e.currentTarget.classList.add('active'); e.currentTarget.style.borderBottomColor = 'var(--cnx-orange)'; e.currentTarget.style.color = 'var(--cnx-blue)';
            moduloContent.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            moduloContent.querySelector('#' + e.currentTarget.dataset.target).style.display = 'block';
        });
    });

    function alternarModoLeitura(somenteLeitura) {
        modoVisualizacao = somenteLeitura;
        const inputs = moduloContent.querySelectorAll('#modal-usuario input, #modal-usuario select');
        
        inputs.forEach(el => {
            el.disabled = somenteLeitura;
            if (somenteLeitura) {
                el.style.opacity = '0.8';
                el.style.cursor = 'not-allowed';
            } else {
                el.style.opacity = '1';
                el.style.cursor = 'pointer'; 
                if(el.type === 'text' || el.type === 'email' || el.type === 'password') el.style.cursor = 'text';
            }
        });

        btnSalvar.style.display = somenteLeitura ? 'none' : 'flex';
        btnUploadAvatar.style.display = somenteLeitura ? 'none' : 'flex';
        btnToggleSenha.style.display = somenteLeitura ? 'none' : 'block';
    }

    btnNovo.addEventListener('click', () => {
        modoEdicao = false; usuarioEmEdicaoId = null; avatarUrlSubmetido = null;
        inNome.value = ''; inEmail.value = ''; inSenha.value = ''; inCargo.value = '';
        chkTodosAlmox.checked = false; containerTabelaAlmox.style.display = 'block';
        moduloContent.querySelectorAll('.chk-almox').forEach(chk => chk.checked = false);
        
        avatarPreview.innerHTML = '<i data-lucide="users" style="width: 40px; height: 40px; color: #94a3b8;"></i>';
        avatarNomeArquivo.style.display = 'none';
        
        renderizarTabelaPermissoes(null);
        alternarModoLeitura(false);
        inSenha.closest('div').style.display = 'block'; 
        
        moduloContent.querySelector('.tab-btn[data-target="tab-dados"]').click();
        modalTitulo.innerHTML = `<i data-lucide="user-plus" style="color: var(--cnx-orange); width: 20px;"></i> <span>Cadastrar Novo Usuário</span>`;
        
        setTimeout(() => { formStateOriginal = getFormState(); }, 50);

        modalUsuario.style.display = 'flex';
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
        modalUsuario.style.display = 'none';
    }

    btnFechar.addEventListener('click', fecharComValidacao);
    btnCancelar.addEventListener('click', fecharComValidacao);

    tbodyUsuarios.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-editar');
        const btnVer = e.target.closest('.btn-ver');
        const btnStatus = e.target.closest('.btn-status');
        const btnHist = e.target.closest('.btn-hist');

        if (btnHist) {
            window.abrirHistorico('usuarios', btnHist.dataset.id);
            return;
        }

        if (btnStatus) {
            const id = btnStatus.dataset.id;
            const nome = btnStatus.dataset.nome;
            if (id === usuarioLogadoId && !isAdministrador) { 
                window.appAlert("Acesso Negado", "Apenas Administradores podem inativar o próprio usuário.", "error"); 
                return; 
            }
            const isAtivo = btnStatus.dataset.ativo === 'true';
            const acaoStr = isAtivo ? 'INATIVAR' : 'ATIVAR';
            const conf = await window.appConfirm('Confirmar Ação', `Deseja realmente <strong>${acaoStr}</strong> o utilizador ${nome}?`, 'warning');
            
            if(conf) {
                const { error } = await window.db.from('usuarios').update({ ativo: !isAtivo }).eq('id', id);
                if (error) {
                    window.appAlert('Erro', 'Ocorreu um erro ao atualizar o status.', 'error');
                    return;
                }

                window.appAlert('Sucesso', `Utilizador ${acaoStr} com sucesso.`, 'success');
                buscarUsuariosGrid();
            }
            return;
        }

        if (btnVer) {
            abrirModalEdicao(btnVer.dataset.id, true);
        } else if (btnEdit) {
            const id = btnEdit.dataset.id;
            if (id === usuarioLogadoId && !isAdministrador) { 
                window.appAlert("Acesso Negado", "Apenas Administradores podem editar o próprio usuário.", "error"); 
                return; 
            }
            abrirModalEdicao(id, false);
        }
    });

    async function abrirModalEdicao(id, apenasLeitura) {
        const usr = usuariosRaw.find(u => u.id === id);
        if(!usr) return;

        modoEdicao = true;
        usuarioEmEdicaoId = id;
        avatarUrlSubmetido = usr.avatar_url;

        inNome.value = usr.nome_completo;
        inEmail.value = usr.email;
        inSenha.value = ''; 
        inCargo.value = usr.id_cargo || '';
        
        chkTodosAlmox.checked = usr.acesso_todos_almoxarifados;
        containerTabelaAlmox.style.display = usr.acesso_todos_almoxarifados ? 'none' : 'block';

        const { data: vinculos } = await window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', id);
        const idsVinc = vinculos ? vinculos.map(v => v.almoxarifado_id) : [];
        
        moduloContent.querySelectorAll('.chk-almox').forEach(chk => { 
            chk.checked = idsVinc.some(id_vinc => String(id_vinc) === String(chk.value)); 
        });

        if (usr.avatar_url) {
            avatarPreview.innerHTML = `<img src="${usr.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            avatarNomeArquivo.innerText = "Avatar registado.";
            avatarNomeArquivo.style.display = 'block';
        } else {
            avatarPreview.innerHTML = '<i data-lucide="users" style="width: 40px; height: 40px; color: #94a3b8;"></i>';
            avatarNomeArquivo.style.display = 'none';
        }

        renderizarTabelaPermissoes(usr.id_cargo, apenasLeitura);
        alternarModoLeitura(apenasLeitura);
        inSenha.closest('div').style.display = 'none'; 
        
        moduloContent.querySelector('.tab-btn[data-target="tab-dados"]').click();
        
        const icone = apenasLeitura ? 'eye' : 'edit';
        const tituloTexto = apenasLeitura ? 'Visualizar Usuário' : 'Editar Usuário';
        modalTitulo.innerHTML = `<i data-lucide="${icone}" style="color: var(--cnx-orange); width: 20px;"></i> <span>${tituloTexto}: ${usr.nome_completo}</span>`;
        
        setTimeout(() => { formStateOriginal = getFormState(); }, 50);
        modalUsuario.style.display = 'flex';
        lucide.createIcons();
    }

    // Gravar Dados
    btnSalvar.addEventListener('click', async () => {
        if(!inNome.value || !inEmail.value || !inCargo.value) { 
            window.appAlert("Dados Incompletos", "Preencha todos os campos obrigatórios na aba Dados.", "warning"); 
            return; 
        }

        const estadoAtual = getFormState();
        if (estadoAtual === formStateOriginal) {
            window.appAlert("Atenção", "Nenhuma alteração foi realizada.", "info");
            return;
        }

        const conf = await window.appConfirm("Gravar Utilizador", "Deseja salvar as alterações efetuadas?", "info");
        if (!conf) return;
        
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width: 16px;"></i> A Guardar...`;
        lucide.createIcons();

        try {
            let permissoesParaSalvar = {};
            moduloContent.querySelectorAll('.chk-perm').forEach(chk => {
                const mod = chk.dataset.mod;
                const acao = chk.dataset.acao;
                if(!permissoesParaSalvar[mod]) permissoesParaSalvar[mod] = {};
                permissoesParaSalvar[mod][acao] = chk.checked;
            });
            
            const cargoNome = inCargo.options[inCargo.selectedIndex]?.text || 'Nenhum';
            let almoxNomes = 'Nenhum';
            if (chkTodosAlmox.checked) {
                almoxNomes = 'TODOS OS ALMOXARIFADOS (Gestão Global)';
            } else {
                const checkedAlmox = Array.from(moduloContent.querySelectorAll('.chk-almox:checked'));
                if (checkedAlmox.length > 0) {
                    almoxNomes = checkedAlmox.map(c => c.closest('tr').cells[2].innerText).join(', ');
                }
            }

            let userDbId = usuarioEmEdicaoId;
            const payloadUsuario = {
                nome_completo: inNome.value.trim().toUpperCase(),
                email: inEmail.value.trim().toLowerCase(),
                id_cargo: parseInt(inCargo.value),
                acesso_todos_almoxarifados: chkTodosAlmox.checked,
                avatar_url: avatarUrlSubmetido,
                historico_acessos: {
                    Cargo: cargoNome,
                    Almoxarifados: almoxNomes,
                    Permissoes: permissoesParaSalvar
                }
            };

            if (modoEdicao) {
                const { error: updErr } = await window.db.from('usuarios').update(payloadUsuario).eq('id', userDbId);
                if (updErr) throw new Error("Erro ao atualizar o utilizador: " + updErr.message);
            } else {
                let authRes = await window.db.auth.signUp({ email: payloadUsuario.email, password: (inSenha.value || 'Cnx@2026!') });
                if (authRes.error) throw new Error("Erro ao criar perfil de autenticação: " + authRes.error.message);
                
                if (authRes.data?.user) { userDbId = authRes.data.user.id; } 
                else { const { data: uuid } = await window.db.rpc('gen_random_uuid'); userDbId = uuid || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (Math.random()*16|0).toString(16)); }
                
                payloadUsuario.id = userDbId;
                payloadUsuario.ativo = true;
                const { error: insErr } = await window.db.from('usuarios').insert([payloadUsuario]);
                if (insErr) throw new Error("Erro ao inserir utilizador: " + insErr.message);
            }

            await window.db.from('usuario_almoxarifados').delete().eq('usuario_id', userDbId);
            if (!chkTodosAlmox.checked) {
                const idsMarcados = Array.from(moduloContent.querySelectorAll('.chk-almox:checked')).map(chk => chk.value);
                if(idsMarcados.length > 0) {
                    const almoxSelecionados = idsMarcados.map(id_al => ({ usuario_id: userDbId, almoxarifado_id: id_al }));
                    const { error: vincErr } = await window.db.from('usuario_almoxarifados').insert(almoxSelecionados);
                    if (vincErr) throw new Error("Erro ao gravar os vínculos de almoxarifado: " + vincErr.message);
                }
            }
            
            if (inCargo.value) {
               await salvarPermissoesNoCargo(inCargo.value, permissoesParaSalvar);
            }

            window.appAlert("Sucesso", "O utilizador foi gravado com sucesso no sistema.", "success");
            modalUsuario.style.display = 'none';
            buscarUsuariosGrid();

            if (userDbId === usuarioLogadoId && typeof carregarFiltroAlmoxarifados === 'function') {
                carregarFiltroAlmoxarifados(usuarioLogadoId);
            }
            
        } catch (err) {
            console.error("Falha ao salvar:", err);
            window.appAlert("Erro de Gravação", err.message || "Ocorreu um erro ao salvar o utilizador no banco de dados.", "error");
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = `<i data-lucide="save" style="width: 16px; color: var(--cnx-orange);"></i> <span>Salvar Cadastro</span>`;
            lucide.createIcons();
        }
    });

    btnToggleSenha.addEventListener('click', () => {
        const isPass = inSenha.type === 'password';
        inSenha.type = isPass ? 'text' : 'password';
        btnToggleSenha.innerHTML = `<i data-lucide="${isPass ? 'eye' : 'eye-off'}" style="width: 16px;"></i>`;
        lucide.createIcons();
    });

    btnUploadAvatar.addEventListener('click', () => { if(!modoVisualizacao) fileAvatar.click(); });
    fileAvatar.addEventListener('change', async (e) => {
        if(modoVisualizacao) return;
        const file = e.target.files[0];
        if(!file) return;
        
        btnUploadAvatar.innerText = "Enviando...";
        try {
            const filename = `avatar_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: upErr } = await window.db.storage.from('avatar_usuario').upload(filename, file);
            if(upErr) throw new Error(upErr.message);
            
            avatarUrlSubmetido = window.db.storage.from('avatar_usuario').getPublicUrl(filename).data.publicUrl;
            
            avatarPreview.innerHTML = `<img src="${avatarUrlSubmetido}" style="width: 100%; height: 100%; object-fit: cover;">`;
            avatarNomeArquivo.innerText = `Arquivo: ${file.name}`;
            avatarNomeArquivo.style.display = 'block';
        } catch (error) {
            console.error("Erro upload:", error);
            window.appAlert("Erro de Upload", error.message || "Falha ao processar a imagem do avatar.", "error");
        } finally {
            btnUploadAvatar.innerHTML = `<i data-lucide="upload" style="width: 16px; color: var(--cnx-orange);"></i> Selecionar Arquivo`;
            lucide.createIcons();
        }
    });

    chkTodosAlmox.addEventListener('change', (e) => {
        containerTabelaAlmox.style.display = e.target.checked ? 'none' : 'block';
    });

    inCargo.addEventListener('change', () => { renderizarTabelaPermissoes(inCargo.value, modoVisualizacao); });

    function renderizarTabelaPermissoes(cargoId, apenasLeitura = false) {
        if (!cargoId) { containerPermissoes.style.display = 'none'; avisoPermissoes.style.display = 'block'; return; }
        
        const cargo = cargos.find(c => c.id == cargoId);
        containerPermissoes.style.display = 'block'; 
        avisoPermissoes.style.display = 'none';
        
        const estrutura = typeof menuEstrutura !== 'undefined' ? menuEstrutura : {};
        const perms = cargo?.permissoes || {};
        
        const cbClass = apenasLeitura ? 'table-checkbox-readonly' : 'chk-perm table-checkbox';
        const cbAllClass = apenasLeitura ? 'table-checkbox-readonly' : 'chk-perm-all table-checkbox';
        const cbDisabledAttr = apenasLeitura ? 'disabled' : '';

        let html = '';

        for (const [nomeMenu, telas] of Object.entries(estrutura)) {
            html += `
                <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <td colspan="3" style="padding: 0.5rem 1rem; font-size: 0.7rem; font-weight: 800; color: var(--cnx-orange); text-transform: uppercase; letter-spacing: 0.5px;">
                        ${nomeMenu}
                    </td>
                </tr>
            `;

            telas.forEach(tela => {
                const acoes = tela.acoes || [
                    { key: 'view', label: 'Visualizar' },
                    { key: 'create', label: 'Criar' },
                    { key: 'edit', label: 'Editar' },
                    { key: 'delete', label: 'Inativar' }
                ];

                const pTela = perms[tela.id] || {};
                const todosMarcados = acoes.length > 0 && acoes.every(a => !!pTela[a.key]);

                const acoesHtml = acoes.map(a => `
                    <label style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.72rem; font-weight: 600; color: #334155; cursor: ${apenasLeitura ? 'not-allowed' : 'pointer'};">
                        <input type="checkbox" class="${cbClass}" data-cargo="${cargoId}" data-mod="${tela.id}" data-acao="${a.key}" ${pTela[a.key] ? 'checked' : ''} ${cbDisabledAttr}>
                        <span>${a.label}</span>
                    </label>
                `).join('');

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: white;">
                        <td style="padding: 0.7rem 1rem; font-weight: 700; color: var(--cnx-blue); font-size: 0.78rem;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="${tela.icone || 'square'}" style="width: 14px; height: 14px; color: #64748b;"></i>
                                <span>${tela.nome}</span>
                            </div>
                        </td>
                        <td style="padding: 0.6rem 1rem;">
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                ${acoesHtml}
                            </div>
                        </td>
                        <td style="text-align: center; background: #f8fafc;">
                            <input type="checkbox" class="${cbAllClass}" data-cargo="${cargoId}" data-mod="${tela.id}" ${todosMarcados ? 'checked' : ''} ${cbDisabledAttr}>
                        </td>
                    </tr>
                `;
            });
        }

        tbodyPermissoes.innerHTML = html;
        lucide.createIcons();

        if (!apenasLeitura) {
            moduloContent.querySelectorAll('.chk-perm-all').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const marcar = e.target.checked;
                    e.target.closest('tr').querySelectorAll('.chk-perm').forEach(c => c.checked = marcar);
                });
            });

            moduloContent.querySelectorAll('.chk-perm').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const tr = e.target.closest('tr');
                    const todos = Array.from(tr.querySelectorAll('.chk-perm'));
                    const chkAll = tr.querySelector('.chk-perm-all');
                    if (chkAll) chkAll.checked = todos.length > 0 && todos.every(c => c.checked);
                });
            });
        }
    }

    async function salvarPermissoesNoCargo(cargoId, permissoesParaSalvar) {
        const idLimpo = isNaN(cargoId) ? cargoId : parseInt(cargoId);
        
        const cargo = cargos.find(c => c.id == idLimpo);
        if(cargo) cargo.permissoes = permissoesParaSalvar;
        
        const { error } = await window.db.from('cargos').update({ permissoes: permissoesParaSalvar }).eq('id', idLimpo);
        if (error) throw new Error("Erro ao gravar permissões: " + error.message);
    }

    carregarDadosIniciais();

})();