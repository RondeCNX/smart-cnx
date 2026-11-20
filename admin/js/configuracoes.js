// js/configuracoes.js
(async function initModuloConfiguracoes() {
    console.log("Módulo Configurações carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-configuracoes .modulo-container');
    if (!moduloContent) return;

    if (!document.getElementById('custom-prompt-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" id="custom-prompt-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 10500; align-items: center; justify-content: center; padding: 1rem;">
                <div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden;">
                    <div style="background: var(--cnx-blue); padding: 1rem 1.5rem; color: white; font-weight: 800; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="message-square" style="color: var(--cnx-orange); width: 20px;"></i> <span id="custom-prompt-title">Informação Necessária</span>
                    </div>
                    <div style="padding: 1.5rem;">
                        <label id="custom-prompt-msg" style="font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 10px; display: block; line-height: 1.4;"></label>
                        <input type="text" id="custom-prompt-input" class="input-standard" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    </div>
                    <div style="padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="custom-prompt-btn-cancel" style="background: white; border: 1px solid #cbd5e1; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; color: #64748b;">Cancelar</button>
                        <button id="custom-prompt-btn-ok" style="background: var(--cnx-blue); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; cursor: pointer;">Confirmar</button>
                    </div>
                </div>
            </div>
        `);
        lucide.createIcons();
    }

    if (!document.getElementById('aud-smart-tooltip')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="aud-smart-tooltip" style="display: none; position: fixed; z-index: 12000; max-width: 460px; background: #0f172a; color: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; box-shadow: 0 15px 30px -5px rgba(0,0,0,0.35); font-size: 0.74rem; line-height: 1.45; pointer-events: none; border: 1px solid #334155;"></div>
        `);
    }

    function abrirPromptPersonalizado(title, message, placeholder = '', forceUpper = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-prompt-modal');
            const input = document.getElementById('custom-prompt-input');
            document.getElementById('custom-prompt-title').innerText = title;
            document.getElementById('custom-prompt-msg').innerHTML = message;
            input.value = '';
            input.placeholder = placeholder;
            if (forceUpper) input.classList.add('input-upper');
            else input.classList.remove('input-upper');

            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 80);

            const btnOk = document.getElementById('custom-prompt-btn-ok');
            const btnCancel = document.getElementById('custom-prompt-btn-cancel');

            const fechar = (val) => {
                modal.style.display = 'none';
                btnOk.onclick = null;
                btnCancel.onclick = null;
                input.onkeydown = null;
                resolve(val);
            };

            btnOk.onclick = () => fechar(input.value);
            btnCancel.onclick = () => fechar(null);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') fechar(input.value);
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(null); }
            };
        });
    }

    let usuarioLogadoId = null;
    let nomeUsuarioLogado = '';
    let isAdmin = false;
    let isGestor = false;

    let cargosCache = [];
    let cargoSelecionadoId = null;

    // Estado Auditoria
    let logsAuditoriaBrutos = [];
    let logsAuditoriaFiltrados = [];
    let audFiltrosAtivos = [];
    let audCache = { almoxarifados: {}, usuarios: {}, produtos: {}, cargos: {} };

    // Estado Backup / Importação
    let tabelaParaImportar = null;
    const TABELAS_BACKUP = [
        { id: 'produtos', nome: 'Produtos', icone: 'box' },
        { id: 'almoxarifados', nome: 'Almoxarifados', icone: 'warehouse' },
        { id: 'usuarios', nome: 'Usuários', icone: 'users' },
        { id: 'cargos', nome: 'Cargos', icone: 'shield' },
        { id: 'usuario_almoxarifados', nome: 'Vínculos Usuário x Almox.', icone: 'link' },
        { id: 'requisicoes', nome: 'Requisições', icone: 'truck' },
        { id: 'requisicao_itens', nome: 'Itens de Requisições', icone: 'list' },
        { id: 'requisicao_divergencias', nome: 'Divergências de Req.', icone: 'alert-circle' },
        { id: 'emprestimos', nome: 'Empréstimos', icone: 'wrench' },
        { id: 'emprestimo_itens', nome: 'Itens de Empréstimos', icone: 'list-checks' },
        { id: 'ajustes_estoque', nome: 'Ajustes de Estoque', icone: 'layers' },
        { id: 'coletas_mac', nome: 'Coletas de MAC', icone: 'cpu' },
        { id: 'configuracoes_sistema', nome: 'Configurações do Sistema', icone: 'settings' },
        { id: 'logs_auditoria', nome: 'Logs de Auditoria', icone: 'activity' }
    ];

    // ================= ABAS =================
    const tabBtns = moduloContent.querySelectorAll('.cfg-tab-btn');
    const tabContents = moduloContent.querySelectorAll('.cfg-tab-content');
    const tabsWrapper = moduloContent.querySelector('#cfg-tabs-wrapper');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = '#64748b';
                b.style.fontWeight = '700';
            });
            tabContents.forEach(c => c.style.display = 'none');

            const target = e.currentTarget;
            const targetId = target.dataset.target;
            target.classList.add('active');
            target.style.borderBottomColor = 'var(--cnx-orange)';
            target.style.color = 'var(--cnx-blue)';
            target.style.fontWeight = '800';

            const isAuditoria = targetId === 'cfg-tab-auditoria';
            moduloContent.querySelector(`#${targetId}`).style.display = isAuditoria ? 'flex' : 'block';
            if (tabsWrapper) {
                tabsWrapper.style.overflowY = isAuditoria ? 'hidden' : 'auto';
                tabsWrapper.style.paddingRight = isAuditoria ? '0' : '4px';
            }

            if (targetId === 'cfg-tab-sobre') {
                carregarEstatisticasSupabase();
            }
        });
    });

    // ================= CARGA INICIAL =================
    async function carregarInicial() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return;
            usuarioLogadoId = session.user.id;

            const { data: user } = await window.db
                .from('usuarios')
                .select('nome_completo, email, avatar_url, cargos(nome, permissoes)')
                .eq('id', usuarioLogadoId)
                .single();

            nomeUsuarioLogado = user?.nome_completo || '';
            const cargoUpper = user?.cargos?.nome?.toUpperCase() || '';
            const permsCargo = user?.cargos?.permissoes || {};
            isAdmin = cargoUpper === 'ADMINISTRADOR';
            isGestor = isAdmin || cargoUpper.includes('SUPERVISOR');

            const pode = (mod, acao) => isAdmin || !!permsCargo?.[mod]?.[acao];

            // Controle granular de cada aba de Configurações
            const mapaAbas = {
                'cfg-tab-conta': pode('cfg_conta', 'view') || true,
                'cfg-tab-regras': pode('cfg_regras', 'view'),
                'cfg-tab-buckets': pode('cfg_buckets', 'view'),
                'cfg-tab-cargos': pode('cfg_cargos', 'view'),
                'cfg-tab-auditoria': pode('cfg_auditoria', 'view'),
                'cfg-tab-backup': pode('cfg_backup', 'view') || pode('cfg_backup', 'create'),
                'cfg-tab-sobre': true
            };

            moduloContent.querySelectorAll('.cfg-tab-btn').forEach(btn => {
                const alvo = btn.dataset.target;
                if (mapaAbas[alvo] === false) btn.style.display = 'none';
            });

            // Ações específicas dentro das abas
            if (!pode('cfg_conta', 'edit') && !isAdmin) {
                if (permsCargo?.cfg_conta && permsCargo.cfg_conta.edit === false) {
                    moduloContent.querySelector('#btn-cfg-upload-avatar').style.display = 'none';
                    moduloContent.querySelector('#btn-cfg-salvar-senha').style.display = 'none';
                }
            }
            if (!pode('cfg_regras', 'edit')) {
                moduloContent.querySelector('#btn-cfg-salvar-regras').style.display = 'none';
            }
            if (!pode('cfg_buckets', 'edit')) {
                moduloContent.querySelector('#btn-cfg-salvar-buckets').style.display = 'none';
            }
            if (!pode('cfg_buckets', 'delete')) {
                moduloContent.querySelector('#btn-cfg-limpar-buckets').style.display = 'none';
            }
            if (!pode('cfg_auditoria', 'export')) {
                moduloContent.querySelector('#btn-aud-gerar-rel').style.display = 'none';
            }
            if (!pode('cfg_sobre', 'edit')) {
                moduloContent.querySelector('#cfg-sobre-link').readOnly = true;
                moduloContent.querySelector('#btn-cfg-salvar-link').style.display = 'none';
            }

            // Minha Conta
            moduloContent.querySelector('#cfg-conta-nome').innerText = user?.nome_completo || '-';
            moduloContent.querySelector('#cfg-conta-email').innerText = user?.email || session.user.email || '-';
            if (user?.avatar_url) {
                moduloContent.querySelector('#cfg-avatar-preview').innerHTML = `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
            }

            moduloContent.querySelector('#cfg-sobre-link').value = `${window.location.origin}/`;

            await carregarConfiguracoesSistema();
            carregarVersaoApp();

            if (mapaAbas['cfg-tab-cargos']) await carregarCargos();
            if (mapaAbas['cfg-tab-backup']) renderizarGridBackup();
            if (mapaAbas['cfg-tab-auditoria']) {
                await carregarUsuariosAuditoria();
                await carregarLogsAuditoria();
            }
        } catch (err) {
            console.error('Erro ao inicializar Configurações:', err);
        }
    }

    // ================= ABA 1: MINHA CONTA =================
    const inAvatarFile = moduloContent.querySelector('#cfg-input-avatar');
    const btnUploadAvatar = moduloContent.querySelector('#btn-cfg-upload-avatar');

    btnUploadAvatar.addEventListener('click', () => inAvatarFile.click());
    inAvatarFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btnUploadAvatar.disabled = true;
        btnUploadAvatar.innerText = 'Enviando...';
        try {
            const filename = `avatar_${usuarioLogadoId}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: upErr } = await window.db.storage.from('avatar_usuario').upload(filename, file);
            if (upErr) throw upErr;

            const publicUrl = window.db.storage.from('avatar_usuario').getPublicUrl(filename).data.publicUrl;
            const { error: dbErr } = await window.db.from('usuarios').update({ avatar_url: publicUrl }).eq('id', usuarioLogadoId);
            if (dbErr) throw dbErr;

            moduloContent.querySelector('#cfg-avatar-preview').innerHTML = `<img src="${publicUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            const footerAvatar = document.getElementById('layout-avatar');
            if (footerAvatar) footerAvatar.innerHTML = `<img src="${publicUrl}" alt="Avatar">`;

            window.appAlert('Sucesso', 'Foto de perfil atualizada!', 'success');
        } catch (err) {
            console.error(err);
            window.appAlert('Erro', 'Não foi possível atualizar o avatar.', 'error');
        } finally {
            btnUploadAvatar.disabled = false;
            btnUploadAvatar.innerHTML = `<i data-lucide="upload" style="width: 14px; color: var(--cnx-orange);"></i> Alterar Foto`;
            lucide.createIcons();
            e.target.value = '';
        }
    });

    moduloContent.querySelector('#btn-cfg-salvar-senha').addEventListener('click', async () => {
        const s1 = moduloContent.querySelector('#cfg-nova-senha').value;
        const s2 = moduloContent.querySelector('#cfg-confirma-senha').value;

        if (!s1 || s1.length < 6) {
            window.appAlert('Atenção', 'A nova senha deve ter pelo menos 6 caracteres.', 'warning');
            return;
        }
        if (s1 !== s2) {
            window.appAlert('Atenção', 'As senhas digitadas não coincidem.', 'warning');
            return;
        }

        const conf = await window.appConfirm('Alterar Senha', 'Deseja confirmar a alteração da sua senha de acesso?', 'info');
        if (!conf) return;

        const { error } = await window.db.auth.updateUser({ password: s1 });
        if (error) {
            window.appAlert('Erro', 'Falha ao atualizar senha: ' + error.message, 'error');
            return;
        }

        moduloContent.querySelector('#cfg-nova-senha').value = '';
        moduloContent.querySelector('#cfg-confirma-senha').value = '';
        window.appAlert('Sucesso', 'Senha atualizada com sucesso!', 'success');
    });

    // ================= CONFIGURACOES_SISTEMA (REGRAS, BUCKETS, SOBRE) =================
    async function carregarConfiguracoesSistema() {
        const { data, error } = await window.db.from('configuracoes_sistema').select('*');
        if (error || !data) return;

        const mapa = {};
        data.forEach(row => { mapa[row.chave] = row.valor; });

        if (mapa.regras) {
            moduloContent.querySelector('#cfg-regra-prazo').value = mapa.regras.prazo_devolucao_dias ?? 7;
            moduloContent.querySelector('#cfg-regra-anexo-req').checked = !!mapa.regras.exigir_anexo_req;
            moduloContent.querySelector('#cfg-regra-anexo-emp').checked = !!mapa.regras.exigir_anexo_emp;
        }
        if (mapa.buckets) {
            moduloContent.querySelector('#cfg-bucket-req').value = String(mapa.buckets['requisicoes-assinaturas'] ?? 90);
            moduloContent.querySelector('#cfg-bucket-emp').value = String(mapa.buckets['emprestimos-assinaturas'] ?? 90);
        }
        if (mapa.sobre && mapa.sobre.link_app) {
            moduloContent.querySelector('#cfg-sobre-link').value = mapa.sobre.link_app;
        }
    }

    async function carregarVersaoApp() {
        const elVersao = moduloContent.querySelector('#cfg-sobre-versao');
        const elData = moduloContent.querySelector('#cfg-sobre-data-versao');
        try {
            const res = await fetch(`../version.json?v=${Date.now()}`);
            if (!res.ok) return;
            const info = await res.json();
            if (elVersao && info.versao) elVersao.innerText = info.versao;
            if (elData && info.data) elData.innerText = info.data;
        } catch {
            // Mantém os valores padrão do HTML se version.json ainda não existir
        }
    }

    async function salvarConfigChave(chave, valor) {
        const { error } = await window.db
            .from('configuracoes_sistema')
            .upsert({ chave, valor, atualizado_em: new Date().toISOString() });
        if (error) throw error;
    }

    moduloContent.querySelector('#btn-cfg-salvar-regras').addEventListener('click', async () => {
        try {
            await salvarConfigChave('regras', {
                prazo_devolucao_dias: parseInt(moduloContent.querySelector('#cfg-regra-prazo').value) || 7,
                exigir_anexo_req: moduloContent.querySelector('#cfg-regra-anexo-req').checked,
                exigir_anexo_emp: moduloContent.querySelector('#cfg-regra-anexo-emp').checked
            });
            window.appAlert('Sucesso', 'Regras operacionais salvas!', 'success');
        } catch (err) {
            window.appAlert('Erro', 'Falha ao salvar regras.', 'error');
        }
    });

    moduloContent.querySelector('#btn-cfg-salvar-buckets').addEventListener('click', async () => {
        try {
            await salvarConfigChave('buckets', {
                'requisicoes-assinaturas': parseInt(moduloContent.querySelector('#cfg-bucket-req').value) || 0,
                'emprestimos-assinaturas': parseInt(moduloContent.querySelector('#cfg-bucket-emp').value) || 0
            });
            window.appAlert('Sucesso', 'Política de retenção salva!', 'success');
        } catch (err) {
            window.appAlert('Erro', 'Falha ao salvar política de buckets.', 'error');
        }
    });

    moduloContent.querySelector('#btn-cfg-limpar-buckets').addEventListener('click', async () => {
        const diasReq = parseInt(moduloContent.querySelector('#cfg-bucket-req').value) || 0;
        const diasEmp = parseInt(moduloContent.querySelector('#cfg-bucket-emp').value) || 0;

        const conf = await window.appConfirm(
            'Executar Limpeza de Buckets',
            'Arquivos mais antigos que o prazo configurado serão removidos permanentemente do Storage (exceto avatares). Deseja continuar?',
            'danger'
        );
        if (!conf) return;

        const bucketsAlvo = [
            { nome: 'requisicoes-assinaturas', dias: diasReq },
            { nome: 'emprestimos-assinaturas', dias: diasEmp }
        ];

        let totalRemovidos = 0;
        try {
            for (const b of bucketsAlvo) {
                if (b.dias <= 0) continue;
                const limite = Date.now() - (b.dias * 24 * 60 * 60 * 1000);
                const { data: arquivos } = await window.db.storage.from(b.nome).list('', { limit: 1000 });
                if (!arquivos || arquivos.length === 0) continue;

                const expirados = arquivos
                    .filter(f => f.created_at && new Date(f.created_at).getTime() < limite)
                    .map(f => f.name);

                if (expirados.length > 0) {
                    const { error } = await window.db.storage.from(b.nome).remove(expirados);
                    if (!error) totalRemovidos += expirados.length;
                }
            }
            window.appAlert('Limpeza Concluída', `${totalRemovidos} arquivo(s) expirado(s) removido(s).`, 'success');
        } catch (err) {
            console.error(err);
            window.appAlert('Erro', 'Falha durante a limpeza dos buckets.', 'error');
        }
    });

    // ================= ABA 4: GESTÃO DE CARGOS =================
    async function carregarCargos() {
        const { data } = await window.db.from('cargos').select('*').order('nome');
        cargosCache = data || [];
        renderizarListaCargos();
    }

    function renderizarListaCargos() {
        const container = moduloContent.querySelector('#cfg-lista-cargos');
        if (cargosCache.length === 0) {
            container.innerHTML = `<div style="padding:1rem; text-align:center; color:#94a3b8; font-size:0.75rem;">Nenhum cargo.</div>`;
            return;
        }
        container.innerHTML = cargosCache.map(c => {
            const ativo = String(c.id) === String(cargoSelecionadoId);
            return `
                <button class="btn-sel-cargo" data-id="${c.id}" style="text-align:left; padding:0.75rem 1rem; border:none; border-bottom:1px solid #f1f5f9; background:${ativo ? '#fff7ed' : 'white'}; color:${ativo ? 'var(--cnx-orange)' : 'var(--cnx-blue)'}; font-weight:${ativo ? '800' : '600'}; font-size:0.78rem; cursor:pointer;">
                    ${c.nome}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.btn-sel-cargo').forEach(btn => {
            btn.addEventListener('click', () => selecionarCargo(btn.dataset.id));
        });
    }

    function selecionarCargo(id) {
        cargoSelecionadoId = id;
        const cargo = cargosCache.find(c => String(c.id) === String(id));
        if (!cargo) return;

        renderizarListaCargos();
        moduloContent.querySelector('#cfg-cargo-vazio').style.display = 'none';
        moduloContent.querySelector('#cfg-cargo-editor').style.display = 'block';
        moduloContent.querySelector('#cfg-cargo-nome').value = cargo.nome || '';

        const estrutura = typeof menuEstrutura !== 'undefined' ? menuEstrutura : {};
        const perms = cargo.permissoes || {};
        const tbody = moduloContent.querySelector('#cfg-cargo-perms-body');

        let html = '';
        for (const [nomeMenu, telas] of Object.entries(estrutura)) {
            html += `<tr style="background:#f1f5f9;"><td colspan="3" style="padding:0.45rem 0.85rem; font-size:0.68rem; font-weight:800; color:var(--cnx-orange); text-transform:uppercase;">${nomeMenu}</td></tr>`;
            telas.forEach(tela => {
                const acoes = tela.acoes || [{ key: 'view', label: 'Visualizar' }, { key: 'create', label: 'Criar' }, { key: 'edit', label: 'Editar' }, { key: 'delete', label: 'Inativar' }];
                const pTela = perms[tela.id] || {};
                const todos = acoes.every(a => !!pTela[a.key]);

                const acoesHtml = acoes.map(a => `
                    <label style="display:inline-flex; align-items:center; gap:5px; padding:3px 7px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; font-size:0.7rem; font-weight:600; cursor:pointer;">
                        <input type="checkbox" class="cfg-chk-perm" data-mod="${tela.id}" data-acao="${a.key}" ${pTela[a.key] ? 'checked' : ''}>
                        <span>${a.label}</span>
                    </label>
                `).join('');

                html += `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:0.6rem 0.85rem; font-weight:700; color:var(--cnx-blue); font-size:0.75rem;">${tela.nome}</td>
                        <td style="padding:0.5rem 0.85rem;"><div style="display:flex; flex-wrap:wrap; gap:5px;">${acoesHtml}</div></td>
                        <td style="text-align:center; background:#f8fafc;"><input type="checkbox" class="cfg-chk-perm-all" ${todos ? 'checked' : ''}></td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;

        tbody.querySelectorAll('.cfg-chk-perm-all').forEach(chk => {
            chk.addEventListener('change', (e) => {
                e.target.closest('tr').querySelectorAll('.cfg-chk-perm').forEach(c => c.checked = e.target.checked);
            });
        });
    }

    moduloContent.querySelector('#btn-cfg-novo-cargo').addEventListener('click', async () => {
        const nome = await abrirPromptPersonalizado('Novo Cargo', 'Informe o nome do novo cargo:', 'Ex: SUPERVISOR DE ESTOQUE', true);
        if (nome === null) return;
        if (!nome.trim()) { window.appAlert('Atenção', 'O nome do cargo é obrigatório.', 'warning'); return; }

        const { data, error } = await window.db.from('cargos').insert([{ nome: nome.trim().toUpperCase(), permissoes: {} }]).select().single();
        if (error) { window.appAlert('Erro', 'Falha ao criar cargo: ' + error.message, 'error'); return; }
        await carregarCargos();
        if (data) selecionarCargo(data.id);
        window.appAlert('Sucesso', 'Cargo criado!', 'success');
    });

    moduloContent.querySelector('#btn-cfg-salvar-cargo').addEventListener('click', async () => {
        if (!cargoSelecionadoId) return;
        const nome = moduloContent.querySelector('#cfg-cargo-nome').value.trim().toUpperCase();
        if (!nome) { window.appAlert('Atenção', 'Informe o nome do cargo.', 'warning'); return; }

        const perms = {};
        moduloContent.querySelectorAll('.cfg-chk-perm').forEach(chk => {
            if (!perms[chk.dataset.mod]) perms[chk.dataset.mod] = {};
            perms[chk.dataset.mod][chk.dataset.acao] = chk.checked;
        });

        const { error } = await window.db.from('cargos').update({ nome, permissoes: perms }).eq('id', cargoSelecionadoId);
        if (error) { window.appAlert('Erro', 'Falha ao salvar cargo.', 'error'); return; }
        await carregarCargos();
        window.appAlert('Sucesso', 'Cargo e permissões atualizados!', 'success');
    });

    moduloContent.querySelector('#btn-cfg-excluir-cargo').addEventListener('click', async () => {
        if (!cargoSelecionadoId) return;
        const conf = await window.appConfirm('Excluir Cargo', 'Deseja excluir este cargo permanentemente?', 'danger');
        if (!conf) return;
        const { error } = await window.db.from('cargos').delete().eq('id', cargoSelecionadoId);
        if (error) { window.appAlert('Erro', 'Não é possível excluir um cargo vinculado a usuários.', 'error'); return; }
        cargoSelecionadoId = null;
        moduloContent.querySelector('#cfg-cargo-editor').style.display = 'none';
        moduloContent.querySelector('#cfg-cargo-vazio').style.display = 'block';
        await carregarCargos();
        window.appAlert('Sucesso', 'Cargo excluído.', 'success');
    });

    // ================= ABA 5: AUDITORIA (FILTROS ANINHADOS + HINT INTELIGENTE + MODAL EXPORTAR) =================
    const audComboCampo = moduloContent.querySelector('#aud-filtro-campo');
    const audWrapperData = moduloContent.querySelector('#aud-wrapper-data');
    const audDataIni = moduloContent.querySelector('#aud-data-ini');
    const audDataFim = moduloContent.querySelector('#aud-data-fim');
    const audSelUsuario = moduloContent.querySelector('#aud-valor-usuario');
    const audSelAcao = moduloContent.querySelector('#aud-valor-acao');
    const audSelTabela = moduloContent.querySelector('#aud-valor-tabela');
    const audWrapperTexto = moduloContent.querySelector('#aud-wrapper-texto');
    const audInTexto = moduloContent.querySelector('#aud-valor-texto');
    const audModalExport = moduloContent.querySelector('#modal-exportar-auditoria');

    function formatarDataBR(dataStr) {
        if (!dataStr) return '-';
        const [ano, mes, dia] = dataStr.split('T')[0].split('-');
        return (ano && mes && dia) ? `${dia}/${mes}/${ano}` : dataStr;
    }

    async function carregarUsuariosAuditoria() {
        const { data } = await window.db.from('usuarios').select('id, nome_completo').order('nome_completo');
        audSelUsuario.innerHTML = '<option value="">Selecione o Usuário...</option>' +
            (data || []).map(u => `<option value="${u.id}">${u.nome_completo}</option>`).join('');
    }

    async function carregarLogsAuditoria() {
        const tbody = moduloContent.querySelector('#tbody-auditoria');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        lucide.createIcons();

        const [resLogs, resAlmox, resUsers, resProds, resCargos] = await Promise.all([
            window.db.from('logs_auditoria').select('*, usuarios(nome_completo)').order('criado_em', { ascending: false }).limit(500),
            window.db.from('almoxarifados').select('id, codigo, descricao'),
            window.db.from('usuarios').select('id, nome_completo'),
            window.db.from('produtos').select('id, codigo, descricao'),
            window.db.from('cargos').select('id, nome')
        ]);

        if (resLogs.error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:2rem;">Erro ao carregar auditoria.</td></tr>`;
            return;
        }

        audCache = { almoxarifados: {}, usuarios: {}, produtos: {}, cargos: {} };
        (resAlmox.data || []).forEach(a => audCache.almoxarifados[String(a.id).toLowerCase()] = `${a.codigo} - ${a.descricao}`);
        (resUsers.data || []).forEach(u => audCache.usuarios[String(u.id).toLowerCase()] = u.nome_completo);
        (resProds.data || []).forEach(p => audCache.produtos[String(p.id).toLowerCase()] = `${p.codigo} - ${p.descricao}`);
        (resCargos.data || []).forEach(c => audCache.cargos[String(c.id).toLowerCase()] = c.nome);

        logsAuditoriaBrutos = resLogs.data || [];
        aplicarFiltrosAuditoria();
    }

    audComboCampo.addEventListener('change', () => {
        const val = audComboCampo.value;
        moduloContent.querySelectorAll('.aud-input-dinamico').forEach(el => el.style.display = 'none');
        if (val === 'criado_em') { audWrapperData.style.display = 'flex'; }
        else if (val === 'usuario_id') { audSelUsuario.style.display = 'block'; }
        else if (val === 'acao') { audSelAcao.style.display = 'block'; }
        else if (val === 'tabela') { audSelTabela.style.display = 'block'; }
        else { audWrapperTexto.style.display = 'flex'; audInTexto.value = ''; }
    });

    function adicionarFiltroAuditoria() {
        const campo = audComboCampo.value;
        const labelCampo = audComboCampo.options[audComboCampo.selectedIndex].text.replace(' (Intervalo)', '');
        let valor = null, labelValor = '';

        if (campo === 'criado_em') {
            const ini = audDataIni.value, fim = audDataFim.value;
            if (!ini && !fim) return;
            valor = { ini, fim };
            labelValor = ini && fim ? `${formatarDataBR(ini)} até ${formatarDataBR(fim)}` : (ini ? `A partir de ${formatarDataBR(ini)}` : `Até ${formatarDataBR(fim)}`);
            audDataIni.value = ''; audDataFim.value = '';
        } else if (campo === 'usuario_id') {
            valor = audSelUsuario.value;
            if (!valor) return;
            labelValor = audSelUsuario.options[audSelUsuario.selectedIndex].text;
        } else if (campo === 'acao') {
            valor = audSelAcao.value;
            labelValor = audSelAcao.options[audSelAcao.selectedIndex].text;
        } else if (campo === 'tabela') {
            valor = audSelTabela.value;
            labelValor = audSelTabela.options[audSelTabela.selectedIndex].text;
        } else {
            valor = audInTexto.value.trim();
            if (!valor) return;
            labelValor = valor;
            audInTexto.value = '';
        }

        audFiltrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor });
        renderizarTagsAuditoria();
        aplicarFiltrosAuditoria();
    }

    window.removerFiltroAuditoria = function(id) {
        audFiltrosAtivos = audFiltrosAtivos.filter(f => f.id !== id);
        renderizarTagsAuditoria();
        aplicarFiltrosAuditoria();
    };

    function renderizarTagsAuditoria() {
        const container = moduloContent.querySelector('#container-aud-tags-inline');
        const lbl = moduloContent.querySelector('#lbl-aud-filtros-ativos');
        container.style.display = 'flex';
        container.style.gap = '4px';
        container.style.alignItems = 'center';
        container.innerHTML = '';

        if (audFiltrosAtivos.length === 0) {
            lbl.style.display = 'inline';
            return;
        }
        lbl.style.display = 'none';

        container.innerHTML = audFiltrosAtivos.map(f => `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${f.labelCampo}:</span>
                <strong style="color: var(--cnx-blue);">${f.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroAuditoria(${f.id})">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    }

    function extrairDadosResumoAuditoria(log) {
        const dados = log.dados_novos || log.dados_anteriores || {};
        const identificador =
            dados.nome_completo ||
            (dados.codigo && dados.descricao ? `${dados.codigo} - ${dados.descricao}` : null) ||
            dados.descricao ||
            dados.nome ||
            dados.responsavel ||
            dados.mac ||
            (dados.codigo ? `Código ${String(dados.codigo).padStart(6, '0')}` : null) ||
            'Registro';

        const acao = String(log.acao || '').toUpperCase();
        if (acao !== 'UPDATE' || !log.dados_anteriores || !log.dados_novos) {
            return { identificador, mudancas: [] };
        }

        const rotulosCampos = {
            nome: 'Nome', nome_completo: 'Nome Completo', email: 'E-mail', tipo: 'Tipo',
            status: 'Status', ativo: 'Ativo', codigo: 'Código', descricao: 'Descrição',
            cidade: 'Cidade', responsavel: 'Responsável', observacoes: 'Observações',
            id_cargo: 'Cargo', acesso_todos_almoxarifados: 'Acesso a Todos Almox.',
            almoxarifado_id: 'Almoxarifado', almoxarifado_abastecedor_id: 'Almox. Abastecedor',
            almoxarifado_requisitante_id: 'Almox. Solicitante', usuario_atendente_id: 'Atendente',
            usuario_solicitante_id: 'Solicitante', produto_id: 'Produto',
            qtd_solicitada: 'Qtd. Solicitada', qtd_aprovada: 'Qtd. Aprovada',
            qtd_enviada: 'Qtd. Enviada', qtd_recebida: 'Qtd. Recebida',
            previsao_devolucao: 'Prev. Devolução', data_devolucao: 'Data Devolução',
            numero_pedido: 'Pedido ERP', produto_patrimonio_erp: 'Patrimônio ERP',
            mac: 'MAC', numero_serie: 'Nº de Série'
        };

        // Mapa de telas e ações da menuEstrutura
        const mapaTelas = {};
        const mapaAcoes = {};
        if (typeof menuEstrutura !== 'undefined') {
            Object.values(menuEstrutura).forEach(telas => {
                telas.forEach(t => {
                    mapaTelas[t.id] = t.nome;
                    mapaAcoes[t.id] = {};
                    (t.acoes || []).forEach(a => { mapaAcoes[t.id][a.key] = a.label; });
                });
            });
        }

        const traduzirAcaoPerm = (mod, ac) => {
            if (mapaAcoes[mod] && mapaAcoes[mod][ac]) return mapaAcoes[mod][ac];
            const padrao = { view: 'Visualizar', create: 'Criar', edit: 'Editar', delete: 'Inativar/Excluir', approve: 'Aprovar', dispatch: 'Despachar', receive: 'Receber', return: 'Devolver', export: 'Exportar' };
            return padrao[ac] || ac;
        };

        const traduzirValor = (chave, val) => {
            if (val === null || val === undefined || val === '') return 'Vazio';
            if (typeof val === 'boolean') return val ? 'SIM' : 'NÃO';
            const str = String(val);
            const c = chave.toLowerCase();

            if (c.includes('almoxarifado')) return audCache.almoxarifados[str.toLowerCase()] || str;
            if (c.includes('usuario')) return audCache.usuarios[str.toLowerCase()] || str;
            if (c === 'produto_id') return audCache.produtos[str.toLowerCase()] || str;
            if (c === 'id_cargo') return audCache.cargos[str.toLowerCase()] || str;
            if ((c.includes('data') || c.includes('previsao')) && str.includes('-')) {
                const p = str.split('T')[0].split('-');
                if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
            }
            return str;
        };

        const ignorar = ['id', 'created_at', 'atualizado_em', 'modificado_em', 'avatar_url', 'senha'];
        const mudancas = [];

        const extrairMudancasPermissoes = (antP, novP) => {
            const lista = [];
            const mods = [...new Set([...Object.keys(antP || {}), ...Object.keys(novP || {})])];
            mods.forEach(m => {
                // Ignora chaves obsoletas que não existem mais na menuEstrutura
                if (Object.keys(mapaTelas).length > 0 && !mapaTelas[m]) return;
                const aM = (antP && antP[m]) || {};
                const nM = (novP && novP[m]) || {};
                const acoes = [...new Set([...Object.keys(aM), ...Object.keys(nM)])];
                acoes.forEach(ac => {
                    if (!!aM[ac] !== !!nM[ac]) {
                        const nomeTela = mapaTelas[m] || m;
                        const nomeAcao = traduzirAcaoPerm(m, ac);
                        lista.push({
                            campo: `${nomeTela} (${nomeAcao})`,
                            anterior: aM[ac] ? 'SIM' : 'NÃO',
                            novo: nM[ac] ? 'SIM' : 'NÃO'
                        });
                    }
                });
            });
            return lista;
        };

        Object.keys(log.dados_novos).forEach(k => {
            if (ignorar.includes(k)) return;
            const vAnt = log.dados_anteriores[k];
            const vNov = log.dados_novos[k];
            if (JSON.stringify(vAnt) === JSON.stringify(vNov)) return;

            if (k === 'permissoes') {
                mudancas.push(...extrairMudancasPermissoes(vAnt, vNov));
            } else if (k === 'historico_acessos') {
                if ((vAnt?.Cargo || '') !== (vNov?.Cargo || '')) {
                    mudancas.push({ campo: 'Cargo', anterior: vAnt?.Cargo || 'Nenhum', novo: vNov?.Cargo || 'Nenhum' });
                }
                if ((vAnt?.Almoxarifados || '') !== (vNov?.Almoxarifados || '')) {
                    mudancas.push({ campo: 'Almoxarifados', anterior: vAnt?.Almoxarifados || 'Nenhum', novo: vNov?.Almoxarifados || 'Nenhum' });
                }
                mudancas.push(...extrairMudancasPermissoes(vAnt?.Permissoes, vNov?.Permissoes));
            } else {
                const labelCampo = rotulosCampos[k.toLowerCase()] || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                mudancas.push({
                    campo: labelCampo,
                    anterior: traduzirValor(k, vAnt),
                    novo: traduzirValor(k, vNov)
                });
            }
        });

        return { identificador, mudancas };
    }

    function resumirAcaoAuditoriaTexto(log, quebrarLinhas = false) {
        const { identificador, mudancas } = extrairDadosResumoAuditoria(log);
        if (mudancas.length === 0) return identificador;
        const formatadas = mudancas.map(m => `${m.campo}: ${m.anterior} -> ${m.novo}`);
        if (quebrarLinhas) {
            return `${identificador}\n- ${formatadas.join('\n- ')}`;
        }
        return `${identificador} (${formatadas.join(' | ')})`;
    }

    function resumirAcaoAuditoria(log) {
        const { identificador, mudancas } = extrairDadosResumoAuditoria(log);
        if (mudancas.length === 0) return `<strong>${identificador}</strong>`;
        const inline = mudancas.map(m => `${m.campo}: ${m.anterior} → ${m.novo}`).join(' | ');
        return `<strong>${identificador}</strong> <span style="color:#64748b; font-size:0.7rem;">(${inline})</span>`;
    }

    function formatarTooltipAuditoria(log) {
        const { identificador, mudancas } = extrairDadosResumoAuditoria(log);
        let html = `<div style="font-weight: 800; color: var(--cnx-orange); margin-bottom: ${mudancas.length ? '8px' : '0'}; border-bottom: ${mudancas.length ? '1px solid #334155' : 'none'}; padding-bottom: ${mudancas.length ? '5px' : '0'}; font-size: 0.78rem;">${identificador}</div>`;
        if (mudancas.length > 0) {
            html += `<div style="display: flex; flex-direction: column; gap: 5px; max-height: 260px; overflow: hidden;">`;
            mudancas.slice(0, 12).forEach(m => {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px dashed #1e293b; padding-bottom: 3px;">
                        <span style="color: #cbd5e1; font-weight: 700; flex-shrink: 0;">${m.campo}:</span>
                        <span style="text-align: right; word-break: break-word;">
                            <span style="color: #fca5a5;">${m.anterior}</span>
                            <span style="color: #94a3b8; margin: 0 4px;">→</span>
                            <span style="color: #86efac; font-weight: 700;">${m.novo}</span>
                        </span>
                    </div>
                `;
            });
            if (mudancas.length > 12) {
                html += `<div style="color: #94a3b8; font-style: italic; margin-top: 2px; text-align: center;">+ ${mudancas.length - 12} alteração(ões)... clique no olho para ver tudo.</div>`;
            }
            html += `</div>`;
        }
        return html;
    }

    function getBadgeAcaoAuditoria(acao) {
        const a = String(acao || '').toUpperCase();
        if (a === 'INSERT' || a === 'CRIAR') return `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800;">CRIOU</span>`;
        if (a === 'UPDATE' || a === 'EDITAR') return `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800;">EDITOU</span>`;
        if (a === 'DELETE' || a === 'EXCLUIR') return `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800;">EXCLUIU</span>`;
        return `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800;">${a}</span>`;
    }

    function aplicarFiltrosAuditoria() {
        let lista = [...logsAuditoriaBrutos];

        audFiltrosAtivos.forEach(f => {
            lista = lista.filter(item => {
                if (f.campo === 'criado_em') {
                    const dt = item.criado_em ? item.criado_em.split('T')[0] : '';
                    if (!dt) return false;
                    if (f.valor.ini && dt < f.valor.ini) return false;
                    if (f.valor.fim && dt > f.valor.fim) return false;
                    return true;
                }
                if (f.campo === 'usuario_id') return String(item.usuario_id) === String(f.valor);
                if (f.campo === 'acao') return String(item.acao || '').toUpperCase() === String(f.valor).toUpperCase();
                if (f.campo === 'tabela') return String(item.tabela || '').toLowerCase() === String(f.valor).toLowerCase();
                if (f.campo === 'registro_id') return String(item.registro_id || '').toLowerCase().includes(String(f.valor).toLowerCase());
                return true;
            });
        });

        logsAuditoriaFiltrados = lista;
        moduloContent.querySelector('#lbl-aud-exibidos').innerText = lista.length;

        const tbody = moduloContent.querySelector('#tbody-auditoria');
        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:2rem;">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map((l, idx) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.55rem 0.75rem; font-size: 0.73rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                <td style="padding: 0.55rem 0.75rem; font-weight: 700; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${l.usuarios?.nome_completo || 'Sistema'}">${l.usuarios?.nome_completo || 'Sistema'}</td>
                <td style="padding: 0.55rem 0.5rem; text-align: center;">${getBadgeAcaoAuditoria(l.acao)}</td>
                <td style="padding: 0.55rem 0.75rem; font-size: 0.73rem; text-transform: uppercase; color: var(--cnx-blue); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(l.tabela || '-').replace(/_/g, ' ')}</td>
                <td class="aud-celula-resumo" data-idx="${idx}" style="padding: 0.55rem 0.75rem; font-size: 0.75rem; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: help;">${resumirAcaoAuditoria(l)}</td>
                <td style="padding: 0.55rem 0.5rem; text-align: center;">
                    ${l.tabela && l.registro_id ? `<button onclick="window.abrirHistorico('${l.tabela}', '${l.registro_id}')" title="Ver detalhes completos da alteração" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>` : '-'}
                </td>
            </tr>
        `).join('');
        lucide.createIcons();

        // Hint inteligente (posiciona acima ou abaixo automaticamente)
        const tooltip = document.getElementById('aud-smart-tooltip');
        tbody.querySelectorAll('.aud-celula-resumo').forEach(td => {
            td.addEventListener('mouseenter', () => {
                const log = logsAuditoriaFiltrados[Number(td.dataset.idx)];
                if (!log || !tooltip) return;

                tooltip.innerHTML = formatarTooltipAuditoria(log);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'hidden';

                const rect = td.getBoundingClientRect();
                const tipRect = tooltip.getBoundingClientRect();
                const margem = 10;

                const cabeAbaixo = (rect.bottom + tipRect.height + margem) <= window.innerHeight;
                const top = cabeAbaixo ? (rect.bottom + 6) : Math.max(margem, rect.top - tipRect.height - 6);

                let left = rect.left;
                if (left + tipRect.width > window.innerWidth - margem) {
                    left = window.innerWidth - tipRect.width - margem;
                }
                if (left < margem) left = margem;

                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${left}px`;
                tooltip.style.visibility = 'visible';
            });

            td.addEventListener('mouseleave', () => {
                if (tooltip) tooltip.style.display = 'none';
            });
        });
    }

    moduloContent.querySelector('#btn-aud-add-filtro').addEventListener('click', adicionarFiltroAuditoria);
    moduloContent.querySelector('#btn-aud-aplicar').addEventListener('click', adicionarFiltroAuditoria);
    moduloContent.querySelector('#btn-aud-limpar').addEventListener('click', () => {
        audFiltrosAtivos = [];
        audDataIni.value = ''; audDataFim.value = ''; audInTexto.value = '';
        renderizarTagsAuditoria();
        aplicarFiltrosAuditoria();
    });
    moduloContent.querySelector('#btn-aud-refresh').addEventListener('click', () => {
        const icon = moduloContent.querySelector('#btn-aud-refresh .refresh-icon');
        if (icon) icon.classList.add('lucide-spin');
        carregarLogsAuditoria().finally(() => { if (icon) icon.classList.remove('lucide-spin'); });
    });

    moduloContent.querySelector('#btn-aud-gerar-rel').addEventListener('click', () => {
        if (logsAuditoriaFiltrados.length === 0) {
            window.appAlert('Atenção', 'Nenhum registro de auditoria para exportar.', 'warning');
            return;
        }
        moduloContent.querySelector('#lbl-qtd-aud-export').innerText = logsAuditoriaFiltrados.length;
        audModalExport.style.display = 'flex';
        lucide.createIcons();
    });

    moduloContent.querySelector('#btn-fechar-modal-aud-export').addEventListener('click', () => { audModalExport.style.display = 'none'; });

    moduloContent.querySelector('#btn-aud-confirmar-excel').addEventListener('click', () => {
        audModalExport.style.display = 'none';
        const cab = ['Data/Hora', 'Usuário', 'Ação', 'Módulo', 'Registro', 'Alterações Realizadas'];
        const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
        const linhas = logsAuditoriaFiltrados.map(l => {
            const { identificador, mudancas } = extrairDadosResumoAuditoria(l);
            const textoMudancas = mudancas.map(m => `${m.campo}: ${m.anterior} -> ${m.novo}`).join('\n');
            return [
                new Date(l.criado_em).toLocaleString('pt-BR'),
                l.usuarios?.nome_completo || 'Sistema',
                l.acao,
                (l.tabela || '-').replace(/_/g, ' ').toUpperCase(),
                identificador,
                textoMudancas
            ].map(esc).join(';');
        });
        baixarCSV(`auditoria_${new Date().toISOString().split('T')[0]}.csv`, [cab.join(';'), ...linhas].join('\r\n'));
    });

    moduloContent.querySelector('#btn-aud-confirmar-pdf').addEventListener('click', () => {
        audModalExport.style.display = 'none';
        if (!window.jspdf) { window.appAlert('Erro', 'Biblioteca PDF indisponível.', 'error'); return; }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margem = 35;
        const larguraUtil = pageWidth - (margem * 2);
        const larguraResumo = larguraUtil - (82 + 120 + 52 + 88);

        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0, 43, 91);
        doc.text("RELATÓRIO DE AUDITORIA E LOGS DE USO - SMART CNX", margem, 38);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
        doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')} por ${nomeUsuarioLogado}   |   Registros: ${logsAuditoriaFiltrados.length}`, margem, 52);

        doc.autoTable({
            startY: 64,
            tableWidth: larguraUtil,
            head: [["Data/Hora", "Usuário", "Ação", "Módulo", "O que foi feito (Resumo e Alterações)"]],
            body: logsAuditoriaFiltrados.map(l => [
                new Date(l.criado_em).toLocaleString('pt-BR'),
                l.usuarios?.nome_completo || 'Sistema',
                l.acao,
                (l.tabela || '-').replace(/_/g, ' ').toUpperCase(),
                resumirAcaoAuditoriaTexto(l, true)
            ]),
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 5, valign: 'top', overflow: 'linebreak' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            headStyles: { fillColor: [0, 43, 91], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 82 },
                1: { cellWidth: 120, fontStyle: 'bold' },
                2: { cellWidth: 52, halign: 'center', fontStyle: 'bold' },
                3: { cellWidth: 88 },
                4: { cellWidth: larguraResumo }
            },
            margin: { left: margem, right: margem, bottom: 35 },
            didDrawPage: () => {
                doc.setFontSize(7); doc.setTextColor(140, 140, 140); doc.setFont("helvetica", "normal");
                doc.text(`Smart CNX - Auditoria do Sistema`, margem, pageHeight - 15);
                doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth - margem, pageHeight - 15, { align: 'right' });
            }
        });
        window.open(doc.output('bloburl'), '_blank');
    });

    // ================= ABA 6: BACKUP E IMPORTAÇÃO (TODAS AS TABELAS) =================
    function baixarCSV(nomeArquivo, conteudo) {
        const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nomeArquivo;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function renderizarGridBackup() {
        const grid = moduloContent.querySelector('#cfg-grid-backup-tabelas');
        grid.innerHTML = TABELAS_BACKUP.map(t => {
            const permiteImportar = t.id !== 'logs_auditoria';
            return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.7rem 0.9rem; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <i data-lucide="${t.icone}" style="width: 18px; height: 18px; color: var(--cnx-orange); flex-shrink: 0;"></i>
                        <div style="overflow: hidden;">
                            <div style="font-weight: 800; font-size: 0.78rem; color: var(--cnx-blue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.nome}</div>
                            <div style="font-size: 0.66rem; color: #64748b; font-family: monospace;">${t.id}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; flex-shrink: 0;">
                        <button class="btn-exp-tabela" data-tabela="${t.id}" title="Exportar ${t.nome} (CSV)" style="width: 32px; height: 32px; background: white; border: 1px solid #cbd5e1; color: var(--cnx-blue); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="download" style="width: 15px;"></i>
                        </button>
                        ${permiteImportar ? `
                        <button class="btn-imp-tabela" data-tabela="${t.id}" data-nome="${t.nome}" title="Importar dados para ${t.nome} (CSV)" style="width: 32px; height: 32px; background: #fff7ed; border: 1px solid #fdba74; color: #c2410c; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="upload" style="width: 15px;"></i>
                        </button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();

        grid.querySelectorAll('.btn-exp-tabela').forEach(btn => {
            btn.addEventListener('click', () => exportarTabelaCSV(btn.dataset.tabela));
        });

        grid.querySelectorAll('.btn-imp-tabela').forEach(btn => {
            btn.addEventListener('click', async () => {
                const conf1 = await window.appConfirm(
                    'Iniciar Importação de Dados',
                    `Você está prestes a importar dados para a tabela <strong>${btn.dataset.nome} (${btn.dataset.tabela})</strong>.<br><br>Linhas com ID existente serão atualizadas e linhas sem ID serão adicionadas. Deseja selecionar o arquivo CSV?`,
                    'warning',
                    'Sim, selecionar CSV',
                    'Cancelar'
                );
                if (!conf1) return;
                tabelaParaImportar = { id: btn.dataset.tabela, nome: btn.dataset.nome };
                moduloContent.querySelector('#cfg-input-import-csv').click();
            });
        });
    }

    async function exportarTabelaCSV(tabela) {
        const { data, error } = await window.db.from(tabela).select('*');
        if (error) { window.appAlert('Erro', `Falha ao exportar ${tabela}: ${error.message}`, 'error'); return; }
        if (!data || data.length === 0) { window.appAlert('Aviso', `A tabela ${tabela} está vazia.`, 'warning'); return; }

        const chaves = Object.keys(data[0]);
        const esc = v => `"${String(typeof v === 'object' && v !== null ? JSON.stringify(v) : (v ?? '')).replace(/"/g, '""')}"`;
        const linhas = data.map(row => chaves.map(k => esc(row[k])).join(';'));
        baixarCSV(`backup_${tabela}_${new Date().toISOString().split('T')[0]}.csv`, [chaves.join(';'), ...linhas].join('\r\n'));
        window.appAlert('Backup Gerado', `Exportação de ${tabela} concluída (${data.length} registros).`, 'success');
    }

    // Parser CSV robusto (suporta ; ou , e campos entre aspas)
    function parseCSV(texto) {
        const limpo = texto.replace(/^\uFEFF/, '').trim();
        const linhas = limpo.split(/\r?\n/).filter(l => l.trim() !== '');
        if (linhas.length < 2) return [];

        const sep = linhas[0].includes(';') ? ';' : ',';
        const splitLinha = (linha) => {
            const res = [];
            let atual = '', emAspas = false;
            for (let i = 0; i < linha.length; i++) {
                const c = linha[i];
                if (c === '"') {
                    if (emAspas && linha[i + 1] === '"') { atual += '"'; i++; }
                    else emAspas = !emAspas;
                } else if (c === sep && !emAspas) {
                    res.push(atual); atual = '';
                } else {
                    atual += c;
                }
            }
            res.push(atual);
            return res;
        };

        const cabecalho = splitLinha(linhas[0]).map(h => h.trim());
        const registros = [];

        for (let i = 1; i < linhas.length; i++) {
            const cols = splitLinha(linhas[i]);
            const obj = {};
            cabecalho.forEach((col, idx) => {
                let val = cols[idx] !== undefined ? cols[idx].trim() : '';
                if (col === 'id' && val === '') return;
                if (val === '') { obj[col] = null; }
                else if (val === 'true') { obj[col] = true; }
                else if (val === 'false') { obj[col] = false; }
                else if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                    try { obj[col] = JSON.parse(val); } catch { obj[col] = val; }
                } else {
                    obj[col] = val;
                }
            });
            registros.push(obj);
        }
        return registros;
    }

    moduloContent.querySelector('#cfg-input-import-csv').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file || !tabelaParaImportar) return;

        try {
            const texto = await file.text();
            const registros = parseCSV(texto);

            if (registros.length === 0) {
                window.appAlert('Arquivo Inválido', 'O arquivo CSV não contém registros válidos para importação.', 'error');
                return;
            }

            const colunas = Object.keys(registros[0]).join(', ');

            const conf2 = await window.appConfirm(
                'Conferência do Arquivo CSV (Passo 2 de 3)',
                `Arquivo: <strong>${file.name}</strong><br>Tabela destino: <strong>${tabelaParaImportar.id}</strong><br>Registros encontrados: <strong>${registros.length}</strong><br><br><small style="color:#64748b;">Colunas detectadas: ${colunas}</small><br><br>Os dados estão corretos?`,
                'warning',
                'Sim, prosseguir',
                'Cancelar'
            );
            if (!conf2) return;

            const conf3 = await window.appConfirm(
                'Confirmação Crítica (Passo 3 de 3)',
                `<strong style="color:#dc2626;">ATENÇÃO:</strong> Esta operação gravará <strong>${registros.length} registro(s)</strong> diretamente no banco de dados de produção e NÃO pode ser desfeita automaticamente.<br><br>Tem certeza absoluta que deseja continuar?`,
                'danger',
                'Tenho certeza',
                'Abortar'
            );
            if (!conf3) return;

            const palavraChave = await abrirPromptPersonalizado(
                'Confirmação Final de Segurança',
                `Para confirmar a importação de <strong>${registros.length}</strong> registros, digite exatamente o nome da tabela:<br><strong style="color:#dc2626; font-family:monospace;">${tabelaParaImportar.id}</strong>`,
                tabelaParaImportar.id,
                false
            );
            if (palavraChave !== tabelaParaImportar.id) {
                window.appAlert('Importação Cancelada', 'O nome da tabela não foi confirmado corretamente. Nenhuma alteração foi feita.', 'info');
                return;
            }

            const tamanhoLote = 100;
            for (let i = 0; i < registros.length; i += tamanhoLote) {
                const lote = registros.slice(i, i + tamanhoLote);
                const { error } = await window.db.from(tabelaParaImportar.id).upsert(lote);
                if (error) throw error;
            }

            window.appAlert('Importação Concluída', `${registros.length} registro(s) importado(s) com sucesso em ${tabelaParaImportar.id}!`, 'success', 4000);
        } catch (err) {
            console.error('Erro na importação CSV:', err);
            window.appAlert('Erro na Importação', err.message || 'Verifique a formatação das colunas e tente novamente.', 'error', 5000);
        } finally {
            tabelaParaImportar = null;
        }
    });

    // ================= ABA 7: SOBRE + CONTADOR SUPABASE =================
    function formatarBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const unidades = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${unidades[i]}`;
    }

    async function carregarEstatisticasSupabase() {
        const LIMITE_DB = 500 * 1024 * 1024; // 500 MB (Plano Gratuito)
        const LIMITE_ST = 1024 * 1024 * 1024; // 1 GB (Plano Gratuito)

        try {
            // 1. Estatísticas do Banco via RPC
            const { data: dbStats, error: rpcErr } = await window.db.rpc('get_db_stats');
            if (!rpcErr && dbStats) {
                const dbBytes = Number(dbStats.db_bytes) || 0;
                const dbPct = Math.min((dbBytes / LIMITE_DB) * 100, 100);
                moduloContent.querySelector('#stat-total-tabelas').innerText = dbStats.total_tabelas ?? '-';
                moduloContent.querySelector('#stat-db-usado').innerText = formatarBytes(dbBytes);
                moduloContent.querySelector('#stat-db-disp').innerText = formatarBytes(Math.max(LIMITE_DB - dbBytes, 0));
                moduloContent.querySelector('#stat-db-pct').innerText = `${dbPct.toFixed(1)}%`;
                moduloContent.querySelector('#stat-db-bar').style.width = `${dbPct}%`;
            } else {
                moduloContent.querySelector('#stat-total-tabelas').innerText = TABELAS_BACKUP.length;
                moduloContent.querySelector('#stat-db-usado').innerText = 'Execute o SQL RPC';
                moduloContent.querySelector('#stat-db-disp').innerText = '500 MB';
            }

            // 2. Estatísticas do Storage (soma arquivos e tamanhos nos buckets)
            const buckets = ['requisicoes-assinaturas', 'emprestimos-assinaturas', 'avatar_usuario'];
            let totalArquivos = 0;
            let totalBytesSt = 0;

            for (const b of buckets) {
                const { data: lista } = await window.db.storage.from(b).list('', { limit: 1000 });
                if (lista && lista.length > 0) {
                    const arquivosReais = lista.filter(f => f.name !== '.emptyFolderPlaceholder');
                    totalArquivos += arquivosReais.length;
                    arquivosReais.forEach(f => { totalBytesSt += Number(f.metadata?.size || 0); });
                }
            }

            const stPct = Math.min((totalBytesSt / LIMITE_ST) * 100, 100);
            moduloContent.querySelector('#stat-total-arquivos').innerText = totalArquivos;
            moduloContent.querySelector('#stat-st-usado').innerText = formatarBytes(totalBytesSt);
            moduloContent.querySelector('#stat-st-disp').innerText = formatarBytes(Math.max(LIMITE_ST - totalBytesSt, 0));
            moduloContent.querySelector('#stat-st-pct').innerText = `${stPct.toFixed(2)}%`;
            moduloContent.querySelector('#stat-st-bar').style.width = `${stPct}%`;
        } catch (err) {
            console.error('Erro ao carregar estatísticas Supabase:', err);
        }
    }

    moduloContent.querySelector('#btn-cfg-atualizar-stats').addEventListener('click', () => {
        const icon = moduloContent.querySelector('#btn-cfg-atualizar-stats .refresh-icon');
        if (icon) icon.classList.add('lucide-spin');
        carregarEstatisticasSupabase().finally(() => { if (icon) icon.classList.remove('lucide-spin'); });
    });

    moduloContent.querySelector('#btn-cfg-copiar-link').addEventListener('click', async () => {
        const link = moduloContent.querySelector('#cfg-sobre-link').value;
        try {
            await navigator.clipboard.writeText(link);
            window.appAlert('Copiado', 'Link da aplicação copiado para a área de transferência!', 'success', 1800);
        } catch {
            moduloContent.querySelector('#cfg-sobre-link').select();
            document.execCommand('copy');
            window.appAlert('Copiado', 'Link copiado!', 'success', 1800);
        }
    });

    moduloContent.querySelector('#btn-cfg-salvar-link').addEventListener('click', async () => {
        const link = moduloContent.querySelector('#cfg-sobre-link').value.trim();
        if (!link) { window.appAlert('Atenção', 'Informe um link válido.', 'warning'); return; }
        try {
            await salvarConfigChave('sobre', { link_app: link });
            window.appAlert('Sucesso', 'Link da aplicação salvo com sucesso!', 'success');
        } catch (err) {
            window.appAlert('Erro', 'Não foi possível salvar o link.', 'error');
        }
    });

    await carregarInicial();
})();