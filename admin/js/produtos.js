// js/produtos.js
(async function initModuloProdutos() {
    console.log("Módulo Produtos carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-produtos .modulo-container');
    if (!moduloContent) return;

    const tbodyProdutos = moduloContent.querySelector('#tabela-produtos-body');
    const lblTotalGeral = moduloContent.querySelector('#lbl-total-geral');
    const lblTotalExibidos = moduloContent.querySelector('#lbl-total-exibidos');
    
    // Filtros
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const inputTipo = moduloContent.querySelector('#filtro-valor-tipo');
    const inputUM = moduloContent.querySelector('#filtro-valor-um');
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
    const modalProduto = moduloContent.querySelector('#modal-produto');
    const modalTitulo = moduloContent.querySelector('#modal-titulo');
    const btnNovo = moduloContent.querySelector('#btn-novo-produto');
    const btnFechar = moduloContent.querySelector('#btn-fechar-modal');
    const btnCancelar = moduloContent.querySelector('#btn-cancelar-modal');
    const btnSalvar = moduloContent.querySelector('#btn-salvar-produto');
    
    // Inputs Form
    const inCodigo = moduloContent.querySelector('#prod-codigo');
    const inDescricao = moduloContent.querySelector('#prod-descricao');
    const inTipo = moduloContent.querySelector('#prod-tipo');
    const inUM = moduloContent.querySelector('#prod-um');
    const inObs = moduloContent.querySelector('#prod-obs');

    // Variáveis
    let produtosRaw = [];
    let filtrosAtivos = [];
    
    let sortConfig = { key: 'codigo', direction: 'asc' }; // Ordem natural padrão
    
    let usuarioLogadoId = null;
    let permissoesAcesso = { view: false, create: false, edit: false, delete: false };
    
    let modoEdicao = false;
    let modoVisualizacao = false;
    let produtoEmEdicaoId = null;
    let formStateOriginal = "";

    async function carregarPermissoes() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (session) usuarioLogadoId = session.user.id;

            permissoesAcesso = {
                view: window.temPermissao('produtos', 'view'),
                create: window.temPermissao('produtos', 'create'),
                edit: window.temPermissao('produtos', 'edit'),
                delete: window.temPermissao('produtos', 'delete')
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar o Cadastro de Produtos.</p></div>`;
                lucide.createIcons();
                return false;
            }

            if (btnNovo) btnNovo.style.display = permissoesAcesso.create ? 'flex' : 'none';
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async function carregarDadosIniciais() {
        const autorizado = await carregarPermissoes();
        if (!autorizado) return;
        
        await buscarProdutosGrid();
    }

    async function buscarProdutosGrid() {
        tbodyProdutos.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin" style="width:24px; color:var(--cnx-orange);"></i></td></tr>`;
        lucide.createIcons();

        const { data, error } = await window.db.from('produtos').select('*').order('codigo', { ascending: true });
        
        if (error) {
            tbodyProdutos.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Erro ao carregar dados do banco.</td></tr>`;
            return;
        }
        
        produtosRaw = (data || []).map(p => ({
            ...p,
            codigoFormatado: window.fmtCod(p.codigo)
        }));

        if (lblTotalGeral) lblTotalGeral.innerText = produtosRaw.length;
        aplicarFiltrosEOrdenar();
    }

    // ================= LÓGICA DE FILTROS =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');

        if (val === 'status') { inputStatus.style.display = 'block'; wrapperTexto.style.display = 'none'; } 
        else if (val === 'tipo') { inputTipo.style.display = 'block'; wrapperTexto.style.display = 'none'; }
        else if (val === 'unidade_medida') { inputUM.style.display = 'block'; wrapperTexto.style.display = 'none'; }
        else {
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
            valor = inputTipo.value;
            labelValor = inputTipo.options[inputTipo.selectedIndex].text;
            exato = true;
        } else if (campo === 'unidade_medida') {
            valor = inputUM.value;
            labelValor = inputUM.options[inputUM.selectedIndex].text;
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
    window.removerFiltroProduto = removerFiltro;

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
            const isExato = f.exato && f.campo !== 'status' && f.campo !== 'tipo' && f.campo !== 'unidade_medida' ? ' (Exato)' : '';
            const tagInline = `
                <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                    <span style="color: #64748b;">${f.labelCampo}${isExato}:</span>
                    <strong style="color: var(--cnx-blue);">${f.labelValor}</strong>
                    <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroProduto(${f.id})">
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
                    <button style="background:#fee2e2; border:none; padding:4px; border-radius:4px; cursor:pointer;" onclick="window.removerFiltroProduto(${f.id})" title="Remover filtro">
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
        let listaFiltrada = [...produtosRaw];

        filtrosAtivos.forEach(filtro => {
            listaFiltrada = listaFiltrada.filter(item => {
                if (filtro.campo === 'status') return String(item.status) === filtro.valor;

                if (filtro.campo === 'codigo') {
                    const codRaw = String(item.codigo || '').toUpperCase();
                    const codFmt = String(item.codigoFormatado || '').toUpperCase();
                    if (filtro.exato) return codRaw === filtro.valor || codFmt === filtro.valor;
                    return codRaw.includes(filtro.valor) || codFmt.includes(filtro.valor);
                }
                
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
            tbodyProdutos.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        tbodyProdutos.innerHTML = lista.map(p => {
            const isAtivo = p.status === 'ATIVO';
            const statusBadge = isAtivo 
                ? `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">ATIVO</span>`
                : `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">INATIVO</span>`;
            
            let botoesAcao = `<button class="btn-ver" data-id="${p.id}" title="Visualizar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width: 14px;"></i></button>`;
            botoesAcao += `<button class="btn-hist" data-id="${p.id}" title="Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width: 14px;"></i></button>`;
            
            if (permissoesAcesso.edit) {
                botoesAcao += `<button class="btn-editar" data-id="${p.id}" title="Editar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit" style="width: 14px;"></i></button>`;
            }
            if (permissoesAcesso.delete) {
                botoesAcao += `<button class="btn-status" data-id="${p.id}" data-ativo="${isAtivo}" data-desc="${p.descricao}" title="Alterar Status" style="background:none; border:none; color:${isAtivo ? '#166534' : '#94a3b8'}; cursor:pointer;"><i data-lucide="toggle-right" style="width: 14px;"></i></button>`;
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1.25rem; font-weight: 700;">${p.codigoFormatado}</td>
                    <td style="padding: 0.6rem 1.25rem;">${p.descricao}</td>
                    <td style="padding: 0.6rem 1.25rem; color: #64748b; font-size: 0.75rem; font-weight: 600;">${p.tipo}</td>
                    <td style="padding: 0.6rem 1.25rem; color: #64748b; font-size: 0.75rem;">${p.unidade_medida}</td>
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
            cod: inCodigo.value,
            desc: inDescricao.value,
            tipo: inTipo.value,
            um: inUM.value,
            obs: inObs.value
        });
    }

    function alternarModoLeitura(somenteLeitura) {
        modoVisualizacao = somenteLeitura;
        const inputs = moduloContent.querySelectorAll('#modal-produto input, #modal-produto select, #modal-produto textarea');
        
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
        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para criar produtos.', 'error');
            return;
        }
        modoEdicao = false; produtoEmEdicaoId = null;
        inCodigo.value = ''; inDescricao.value = ''; inTipo.value = ''; inUM.value = ''; inObs.value = '';
        
        alternarModoLeitura(false);
        modalTitulo.innerHTML = `<i data-lucide="package-plus" style="color: var(--cnx-orange); width: 20px;"></i> <span>Cadastrar Novo Produto</span>`;
        
        setTimeout(() => { formStateOriginal = getFormState(); }, 50);
        modalProduto.style.display = 'flex';
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
        modalProduto.style.display = 'none';
    }

    btnFechar.addEventListener('click', fecharComValidacao);
    btnCancelar.addEventListener('click', fecharComValidacao);

    tbodyProdutos.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-editar');
        const btnVer = e.target.closest('.btn-ver');
        const btnStatus = e.target.closest('.btn-status');
        const btnHist = e.target.closest('.btn-hist');

        if (btnHist) {
            if(window.abrirHistorico) window.abrirHistorico('produtos', btnHist.dataset.id);
            else window.appAlert("Erro", "Módulo de histórico indisponível.", "error");
            return;
        }

        if (btnStatus) {
            if (!permissoesAcesso.delete) {
                window.appAlert('Acesso Negado', 'Você não tem permissão para inativar/ativar produtos.', 'error');
                return;
            }
            const id = btnStatus.dataset.id;
            const desc = btnStatus.dataset.desc;
            const isAtivo = btnStatus.dataset.ativo === 'true';
            const novoStatus = isAtivo ? 'INATIVO' : 'ATIVO';
            const conf = await window.appConfirm('Confirmar Ação', `Deseja realmente <strong>${novoStatus}</strong> o item ${desc}?`, 'warning');
            
            if(conf) {
                const { error } = await window.db.from('produtos').update({ status: novoStatus }).eq('id', id);
                if (error) { window.appAlert('Erro', 'Ocorreu um erro ao atualizar o status.', 'error'); return; }
                
                window.appAlert('Sucesso', `Item atualizado para ${novoStatus}.`, 'success');
                buscarProdutosGrid();
            }
            return;
        }

        if (btnVer) {
            abrirModalEdicao(btnVer.dataset.id, true);
        } else if (btnEdit) {
            if (!permissoesAcesso.edit) {
                window.appAlert('Acesso Negado', 'Você não tem permissão para editar produtos.', 'error');
                return;
            }
            abrirModalEdicao(btnEdit.dataset.id, false);
        }
    });

    function abrirModalEdicao(id, apenasLeitura) {
        const p = produtosRaw.find(x => x.id === id);
        if(!p) return;

        modoEdicao = true;
        produtoEmEdicaoId = id;

        inCodigo.value = apenasLeitura ? window.fmtCod(p.codigo) : (p.codigo || '');
        inDescricao.value = p.descricao || '';
        inTipo.value = p.tipo || '';
        inUM.value = p.unidade_medida || '';
        inObs.value = p.observacoes || '';

        alternarModoLeitura(apenasLeitura);
        
        const icone = apenasLeitura ? 'eye' : 'edit';
        const tituloTexto = apenasLeitura ? 'Visualizar Item' : 'Editar Item';
        modalTitulo.innerHTML = `<i data-lucide="${icone}" style="color: var(--cnx-orange); width: 20px;"></i> <span>${tituloTexto}: ${p.descricao}</span>`;
        
        setTimeout(() => { formStateOriginal = getFormState(); }, 50);
        modalProduto.style.display = 'flex';
        lucide.createIcons();
    }

    // Gravar Dados
    btnSalvar.addEventListener('click', async () => {

        if ((modoEdicao && !permissoesAcesso.edit) || (!modoEdicao && !permissoesAcesso.create)) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para salvar alterações neste cadastro.', 'error');
            return;
        }

        if(!inDescricao.value || !inTipo.value || !inUM.value) { 
            window.appAlert("Dados Incompletos", "Preencha todos os campos obrigatórios (*).", "warning"); 
            return; 
        }

        const estadoAtual = getFormState();
        if (estadoAtual === formStateOriginal) {
            window.appAlert("Atenção", "Nenhuma alteração foi realizada.", "info");
            return;
        }

        const conf = await window.appConfirm("Gravar Produto", "Deseja salvar as alterações efetuadas?", "info");
        if (!conf) return;
        
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width: 16px;"></i> A Guardar...`;
        lucide.createIcons();

        try {
            let codValue = inCodigo.value.trim().toUpperCase();
            
            // INTELIGÊNCIA GERADORA DE CÓDIGOS (Ex: 000001, 000002...)
            if (!codValue && !modoEdicao) {
                // Vai ao banco pesquisar o maior código existente
                const { data: maxData } = await window.db
                    .from('produtos')
                    .select('codigo')
                    .not('codigo', 'is', null)
                    .order('codigo', { ascending: false })
                    .limit(1);
                
                if (maxData && maxData.length > 0 && maxData[0].codigo) {
                    // Extrai os números e soma 1
                    const currentMax = parseInt(maxData[0].codigo.replace(/\D/g, '') || '0');
                    codValue = String(currentMax + 1).padStart(6, '0');
                } else {
                    // Se a base de dados estiver vazia, arranca do 1
                    codValue = '000001';
                }
                
                inCodigo.value = codValue; // Mostra ao utilizador o código mágico gerado
            } else if (!codValue && modoEdicao) {
                throw new Error("O Código Interno é um campo obrigatório no sistema e não pode ser apagado.");
            }

            // Agora o Payload tem a garantia matemática de levar SEMPRE um código válido
            const payload = {
                codigo: codValue,
                descricao: inDescricao.value.trim().toUpperCase(),
                tipo: inTipo.value,
                unidade_medida: inUM.value,
                observacoes: inObs.value.trim().toUpperCase() || null
            };

            if (modoEdicao) {
                const { error } = await window.db.from('produtos').update(payload).eq('id', produtoEmEdicaoId);
                if (error) throw new Error("Erro ao atualizar o item: " + error.message);
            } else {
                payload.status = 'ATIVO';
                const { error } = await window.db.from('produtos').insert([payload]);
                if (error) throw new Error("Erro ao cadastrar novo item: " + error.message);
            }

            window.appAlert("Sucesso", "O cadastro foi gravado com sucesso no sistema.", "success");
            modalProduto.style.display = 'none';
            buscarProdutosGrid();
            
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