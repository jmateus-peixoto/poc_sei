/* ============================================================
   Núcleo: utilitários, estado, regras de escopo, componentes,
   shell (menu lateral, topbar) e roteador por hash.
   As páginas de cada perfil ficam em super.js, gestor.js e
   operacao.js e se registram com App.route().
   ============================================================ */
(function () {
  "use strict";

  const D = window.SEI_DATA;
  const STORAGE_KEY = "gcsei.state.v3";
  const PROFILE_KEY = "gcsei.profile";
  const THEME_KEY = "gcsei.theme";
  const SIDEBAR_KEY = "gcsei.sidebar";
  const SESSION_KEY = "gcsei.session"; // login simulado: guarda só o e-mail, nunca a senha

  /* ---------------- Utilitários ---------------- */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function parseDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d || 1);
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = parseDate(iso);
    return d.toLocaleDateString("pt-BR");
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtComp(comp, long) {
    if (!comp) return "—";
    const [y, m] = comp.split("-").map(Number);
    return (long ? MESES_LONGOS : MESES)[m - 1] + (long ? " de " : "/") + y;
  }
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function fmtMoney(v) { return v == null ? "Não disponível" : BRL.format(v); }
  function fmtMoneyShort(v) {
    if (v == null) return "—";
    if (Math.abs(v) >= 1e6) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
    if (Math.abs(v) >= 1e3) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
    return BRL.format(v);
  }
  function fmtMoney0(v) { return v == null ? "—" : "R$ " + Math.round(v).toLocaleString("pt-BR"); }
  function fmtNum(v, digits = 1) { return v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function daysUntil(iso) {
    const t = parseDate(D.TODAY);
    return Math.round((parseDate(iso) - t) / 864e5);
  }
  function nowIso() { return D.TODAY + "T" + new Date().toTimeString().slice(0, 8); }
  function compAdd(comp, n) {
    const [y, m] = comp.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  const CURRENT_COMP = D.TODAY.slice(0, 7);
  const NEXT_COMP = compAdd(CURRENT_COMP, 1);
  function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }
  function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase(); }

  /* ---------------- Estado persistido ---------------- */
  let state;
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === D.seedState().version) return parsed;
      }
    } catch (e) { /* armazenamento indisponível: segue com dados de exemplo */ }
    return D.seedState();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
  }
  function resetState() {
    state = D.seedState();
    save();
    syncContratosNovos();
  }
  /* Contratos cadastrados pelo processo SEI no próprio protótipo ficam no estado e entram na carteira */
  function syncContratosNovos() {
    for (let i = D.CONTRATOS.length - 1; i >= 0; i--) if (D.CONTRATOS[i].id.startsWith("n")) D.CONTRATOS.splice(i, 1);
    (state.contratosNovos || []).forEach((c) => D.CONTRATOS.push(c));
  }
  state = loadState();
  syncContratosNovos();

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }

  /* ---------------- Consultas ---------------- */
  const userName = (id) => (D.USERS[id] ? D.USERS[id].nome : id || "—");
  const getContrato = (id) => D.CONTRATOS.find((c) => c.id === id);
  const getPosto = (id) => D.POSTOS[id] || { nome: id, regiao: "—" };
  const getDoc = (id) => D.DOCUMENTOS.find((d) => d.id === id);
  const getItem = (id) => state.itens.find((i) => i.id === id);
  const itensDo = (cid) => state.itens.filter((i) => i.contratoId === cid);
  const docsDo = (cid) => D.DOCUMENTOS.filter((d) => d.contratoId === cid);

  function designacoesAtivas(cid) {
    return D.DESIGNACOES.filter((d) => d.contratoId === cid && (!d.fim || d.fim >= D.TODAY));
  }
  function gestorDe(cid) {
    const g = designacoesAtivas(cid).find((d) => d.podeAceite);
    if (g) return userName(g.userId);
    const m = (state.respManual || {})[cid];
    return m ? m.nome : "Não designado";
  }
  /* Responsável informado à mão pela GCR quando o contrato não traz gestor/fiscal (reunião de 05/11/2026) */
  function respManual(cid) { return (state.respManual || {})[cid] || null; }

  function currentProfile() { return D.PROFILES[App.profileKey] || null; }
  function currentUser() { const p = currentProfile(); return p ? D.USERS[p.userId] : null; }

  /* Escopo: perfil diz QUAIS ações; escopo diz EM QUAIS contratos (4.4) */
  function contratosVisiveis(profileKey = App.profileKey) {
    if (profileKey === "super") return D.CONTRATOS.slice();
    // Equipe GCR: controla a carteira inteira da DSC (curadoria), não só contratos com designação
    if (profileKey === "gestor") return D.CONTRATOS.slice();
    if (profileKey === "op") {
      const ids = D.OPERACAO_ESCOPO.camila;
      return D.CONTRATOS.filter((c) => ids.includes(c.id));
    }
    return [];
  }
  function podeVerContrato(cid) { return contratosVisiveis().some((c) => c.id === cid); }
  function minhaDesignacao(cid) {
    if (App.profileKey !== "gestor") return null;
    return D.DESIGNACOES.find((d) => d.contratoId === cid && d.userId === "rafael" && (!d.fim || d.fim >= D.TODAY));
  }
  function podeDarAceite(cid) {
    const d = minhaDesignacao(cid);
    return !!(d && d.podeAceite && App.profileKey === "gestor");
  }

  /* Situação contratual: só datas e instrumentos confirmados (5.3) */
  function situacaoContratual(c) {
    if (c.cadastro !== "conferido") return { key: "pendente", label: "A confirmar", tone: "pending" };
    const ini = c.datas.inicioVigencia, fim = c.datas.fimVigencia;
    if (ini && ini > D.TODAY) return { key: "futura", label: "Vigência futura", tone: "neutral" };
    if (fim && fim < D.TODAY) return { key: "encerrado", label: "Vigência encerrada", tone: "outline" };
    const dias = daysUntil(fim);
    if (dias <= 90) return { key: "vencendo", label: "Vence em " + dias + " dias", tone: "warning", dias };
    return { key: "vigente", label: "Vigente", tone: "success", dias };
  }

  function acompanhamento(cid) {
    const c = getContrato(cid);
    if (situacaoContratual(c).key === "encerrado") return "encerrado";
    if (cid === "c7") return "em_preparacao"; // preparação conduzida por outra gestora
    const itens = itensDo(cid).filter((i) => i.status !== "descartado");
    const ativos = itens.filter((i) => i.status === "ativo" || i.status === "ativo_sem_financeiro");
    const prep = state.preparacao[cid];
    if (!itens.length) return prep ? "em_preparacao" : "nao_iniciado";
    if (!ativos.length) return "em_preparacao";
    const obrigPend = state.obrigacoes.some((o) => o.contratoId === cid && !o.decisao);
    if (ativos.length < itens.length || obrigPend) return "parcial";
    return "ativo";
  }

  /* ---------------- Rótulos de situação ---------------- */
  const L = {
    acomp: { nao_iniciado: ["Não iniciado", "neutral"], em_preparacao: ["Em preparação", "info"], parcial: ["Parcialmente ativo", "violet"], ativo: ["Ativo", "success"], encerrado: ["Encerrado", "outline"] },
    cadastro: { rascunho: ["Rascunho", "neutral"], em_conferencia: ["Em conferência", "pending"], conferido: ["Conferido", "success"] },
    item: { em_preparacao: ["Em preparação", "info"], aguardando_aceite: ["Aguardando De acordo", "warning"], ativo: ["Ativo", "success"], ativo_sem_financeiro: ["Ativo, sem cálculo financeiro", "teal"], descartado: ["Não se aplica", "outline"] },
    med: { programada: ["Programada", "neutral"], em_acompanhamento: ["Em acompanhamento", "info"], aguardando: ["Aguardando dados", "nodata"], em_analise: ["Em análise", "violet"], pronta_validacao: ["Pronta para validação", "warning"], fechada: ["Fechada", "success"], em_retificacao: ["Em retificação", "danger"] },
    prazo: { no_prazo: ["No prazo", "success"], proximo: ["Vence em breve", "warning"], atrasado: ["Atrasado", "danger"] },
    fin: { sem_regra: ["Sem regra", "outline"], pendente: ["Regra pendente", "pending"], risco: ["Risco identificado", "warning"], estimada: ["Glosa estimada", "warning"], em_validacao: ["Em validação", "violet"], confirmada: ["Glosa confirmada", "danger"], nao_aplicada: ["Não aplicada", "neutral"], sem_calculo: ["Sem cálculo", "outline"] },
    oc: { aberta: ["Aberta", "info"], encaminhada: ["Encaminhada", "info"], respondida: ["Respondida", "violet"], em_verificacao: ["Em verificação", "violet"], em_analise: ["Em análise", "warning"], devolvida: ["Devolvida", "warning"], vencida: ["Vencida", "danger"], encerrada: ["Encerrada", "success"] },
    alerta: { novo: ["Novo", "info"], reconhecido: ["Reconhecido", "neutral"], em_tratamento: ["Em tratamento", "warning"], encerrado: ["Encerrado", "success"] },
    sev: { critica: ["Crítica", "danger"], alta: ["Alta", "warning"], media: ["Média", "info"] },
    tipo: { indicador: ["Indicador", "query_stats"], entrega: ["Entrega", "local_shipping"], documento: ["Documento periódico", "article"], fiscalizacao: ["Fiscalização física", "assignment_turned_in"] },
    conf: { conferido: ["Conferido", "success"], pendente: ["Pendente de conferência", "pending"] },
    assin: { assinado: ["Assinado", "success"], pendente: ["Assinatura pendente", "warning"], nao_disponivel: ["Não disponível", "nodata"] },
    origem: { indicador: ["Indicador", "query_stats"], inspecao: ["Inspeção", "assignment_turned_in"], dados: ["Problema de dados", "database"] },
    fisc: { rascunho: ["Rascunho", "neutral"], enviada: ["Enviada", "success"] },
    decisao: { confirmada: ["Confirmada", "success"], ajustada: ["Ajustada", "info"], desdobrada: ["Desdobrada", "violet"], relacionada: ["Relacionada", "teal"], nao_aplica: ["Não se aplica", "outline"] },
    /* Caixa DSC (R06) */
    acao: { analise: ["Análise", "info"], assinatura: ["Assinatura", "warning"], ciencia: ["Ciência", "neutral"], despacho: ["Despacho", "info"], resposta: ["Resposta", "violet"], devolucao: ["Devolução", "warning"], aprovacao: ["Aprovação", "warning"], arquivamento: ["Arquivamento", "neutral"], nenhuma: ["Nenhuma ação", "outline"] },
    cx: { nao_localizado: ["Não localizado", "nodata"], recebido: ["Recebido", "info"], sem_classificacao: ["Sem classificação", "pending"], em_analise: ["Em análise", "violet"], aguardando_assinatura: ["Aguardando assinatura", "warning"], aguardando_terceiro: ["Aguardando terceiro", "warning"], concluido: ["Concluído", "success"], encerrado_pendencia: ["Encerrado com pendência", "danger"] },
    prazoTipo: { legal: ["Prazo legal", "danger"], contratual: ["Prazo contratual", "warning"], interno: ["Prazo interno", "info"] },
    aditivo: { proposto: ["Proposto", "pending"], formalizado: ["Formalizado", "info"], vigente: ["Vigente", "success"] },
    reajuste: { previsto: ["Previsto", "neutral"], solicitado: ["Solicitado", "warning"], aplicado: ["Aplicado", "success"] },
  };

  /* ---------------- Componentes ---------------- */
  const icon = (name, cls = "") => `<span class="material-symbols-rounded ${cls}" aria-hidden="true">${name}</span>`;
  function pill(text, tone = "neutral", extra = "") {
    return `<span class="pill ${tone} ${extra}">${esc(text)}</span>`;
  }
  function lpill(map, key, extra = "") {
    const v = L[map][key];
    if (!v) return pill(key || "—", "neutral", extra);
    return pill(v[0], v[1], extra);
  }
  /* Botão "Mais" com menu de ações secundárias (abre e fecha por delegação em bindMenus) */
  function moreMenu(items, label = "Mais", o = {}) {
    return `<div class="menu-wrap"><button class="${o.cls || "btn outline sm"}" type="button" data-menu-toggle aria-haspopup="menu" aria-expanded="false">${icon(o.icon || "more_horiz")}${esc(label)}${o.caret ? icon("expand_more") : ""}</button><div class="menu ${o.alignRight ? "align-right" : ""}" role="menu" hidden>${items.join("")}</div></div>`;
  }
  /* Botão único "Exportar" com as opções CSV e PDF; data-attrs identifica o que exportar */
  function exportMenu(dataAttrs, o = {}) {
    return moreMenu([
      `<button type="button" ${dataAttrs} data-format="csv">${icon("table_view")}Planilha (CSV)</button>`,
      `<button type="button" ${dataAttrs} data-format="pdf">${icon("picture_as_pdf")}Documento (PDF)</button>`,
    ], "Exportar", { icon: "download", caret: true, cls: o.cls, alignRight: o.alignRight });
  }
  function closeMenus(except) {
    document.querySelectorAll(".menu-wrap .menu:not([hidden])").forEach((m) => {
      if (m === except) return;
      m.hidden = true;
      m.previousElementSibling.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-menu-toggle]");
    if (t) {
      const m = t.nextElementSibling;
      closeMenus(m);
      m.hidden = !m.hidden;
      t.setAttribute("aria-expanded", String(!m.hidden));
      return;
    }
    closeMenus(); // clique em um item do menu ou fora dele fecha os menus abertos
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });

  /* Ação de linha em tabela: só ícone, com dica ao passar o mouse */
  function actionIcon(o) {
    const tag = o.href ? "a" : o.static ? "span" : "button";
    const attrs = o.href ? `href="${o.href}"` : o.static ? 'tabindex="0"' : `type="button" ${o.attrs || ""}`;
    return `<${tag} class="icon-btn action-icon ${o.static ? "is-static" : ""}" ${attrs} aria-label="${esc(o.label)}" data-tip="${esc(o.tip || o.label)}">${icon(o.icon)}</${tag}>`;
  }
  function tipoTag(tipo) {
    const t = L.tipo[tipo] || [tipo, "label"];
    return `<span class="tag">${icon(t[1])}${esc(t[0])}</span>`;
  }
  function source(text, href) {
    return `<span class="source">${icon("link")}${href ? `<a href="${href}">${esc(text)}</a>` : esc(text)}</span>`;
  }
  function docSource(docId) {
    const d = getDoc(docId);
    if (!d) return `<span class="source">${icon("help")}Origem não identificada</span>`;
    return `<span class="source">${icon("description")}SEI ${esc(d.sei)} · ${esc(d.titulo)}</span>`;
  }

  /* Número do processo no padrão do Controle de Processos do SEI: vermelho enquanto não visualizado, azul depois */
  function procVisto(numero) {
    return (state.procVistos || []).includes(numero) || !D.DOCUMENTOS.some((d) => d.processo === numero && d.conferencia === "pendente");
  }
  function marcarProcVisto(numero) {
    if (!state.procVistos) state.procVistos = [];
    if (!state.procVistos.includes(numero)) { state.procVistos.push(numero); save(); }
    document.querySelectorAll(`.sei-proc[data-proc="${numero}"]`).forEach((a) => { a.classList.remove("is-novo"); a.removeAttribute("data-tip"); });
  }
  function procLink(numero, cid) {
    const novo = !procVisto(numero);
    const href = cid && App.profileKey !== "op" ? `#/${App.profileKey === "super" ? "super" : "gestor"}/contrato/${cid}/instrumentos` : null;
    const tag = href ? "a" : "span";
    return `<${tag} class="sei-proc ${novo ? "is-novo" : ""}" data-proc="${esc(numero)}" ${href ? `href="${href}"` : 'tabindex="0"'} ${novo ? 'data-tip="Processo com documento ainda não visualizado"' : ""}>${esc(numero)}</${tag}>`;
  }
  document.addEventListener("click", (e) => { const a = e.target.closest(".sei-proc"); if (a) marcarProcVisto(a.dataset.proc); });

  /* Cartão colorido de indicador (padrão dos painéis do SEI): rótulo, valor grande, contexto e rodapé com ação */
  function kpiCard(o) {
    const tag = o.href ? "a" : "div";
    return `<${tag} class="kpi-card is-${o.tone || "blue"}" ${o.href ? `href="${o.href}"` : ""}>
      ${o.info ? `<span class="kpi-info" tabindex="0" data-tip="${esc(o.info)}" aria-label="${esc(o.info)}">${icon("info")}</span>` : ""}
      <span class="kpi-label">${esc(o.label)}</span>
      <span class="kpi-value">${o.value}</span>
      ${o.sub ? `<span class="kpi-sub">${o.sub}</span>` : ""}
      ${o.bar != null ? `<span class="kpi-bar"><i style="width:${Math.max(0, Math.min(100, o.bar))}%"></i></span>` : ""}
      ${o.foot ? `<span class="kpi-foot"><span>${o.foot}</span>${o.href ? icon("north_east") : ""}</span>` : ""}
    </${tag}>`;
  }
  function kpiHead(title, right = "Clique para ver a composição") {
    return `<div class="kpi-head"><h3>${esc(title)}</h3>${right ? `<span>${esc(right)}</span>` : ""}</div>`;
  }
  /* Valor com unidade menor, como nos cartões do SEI: "R$ 16,53 mi" */
  function moneyKpi(v) {
    if (v == null) return "—";
    if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>mi</small>`;
    if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <small>mil</small>`;
    return BRL.format(v);
  }
  /* Finanças do contrato: inicial, total atualizado (aditivos), executado (notas) e saldo */
  function finContrato(c) {
    const total = c.valores.vigente;
    const executado = c.valores.executado || 0;
    return { inicial: c.valores.original, total, executado, saldo: total == null ? null : total - executado, pct: total ? Math.round((executado / total) * 100) : null, notas: c.notas || [] };
  }
  function fiscalDe(cid) {
    const f = designacoesAtivas(cid).find((d) => /fiscal/i.test(d.papel));
    return f ? userName(f.userId) : null;
  }
  /* "faltam 66 dias" / "encerrada há 62 dias" */
  function prazoVigencia(fim) {
    if (!fim) return "";
    const d = daysUntil(fim);
    return d < 0 ? `encerrada há ${-d} dias` : d === 0 ? "termina hoje" : `faltam ${d} dias`;
  }
  const ORIGEM_DADOS = { sei: ["SEI (confirmado)", "success"], sei_conferencia: ["SEI (em conferência)", "pending"], manual: ["Cadastro manual", "neutral"] };

  function statCard(o) {
    const tag = o.href ? "a" : o.action ? "button" : "div";
    const attrs = o.href ? `href="${o.href}"` : o.action ? `type="button" data-action="${o.action}"` : "";
    return `<${tag} class="stat-card ${o.tone || "is-navy"}" ${attrs}>
      ${o.info ? `<span class="stat-info" tabindex="0" data-tip="${esc(o.info)}" aria-label="${esc(o.info)}">${icon("info")}</span>` : ""}
      <div class="stat-top"><div class="stat-icon">${icon(o.icon)}</div><div class="stat-value">${o.value}</div></div>
      <div class="stat-label">${esc(o.label)}</div>
      ${o.sub ? `<div class="stat-sub">${o.sub}</div>` : ""}
    </${tag}>`;
  }

  function emptyState(o = {}) {
    return `<div class="empty-state ${o.cls || ""}">${icon(o.icon || "inbox")}<strong>${esc(o.title || "Nenhum registro")}</strong>${o.desc ? `<p>${o.desc}</p>` : ""}${o.action || ""}</div>`;
  }

  function sectionTitle(title, o = {}) {
    return `<div class="section-title"><div><h3>${o.icon ? icon(o.icon) : ""}${esc(title)}</h3>${o.sub ? `<p>${o.sub}</p>` : ""}</div>${o.right || ""}</div>`;
  }

  // O título da tela fica só no topo (h1); o cabeçalho da página traz a descrição e as ações.
  function pageHeader(title, subtitle, actions = "") {
    return `<div class="page-header"><div>${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}</div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
  }

  function selectField(id, label, options, value, o = {}) {
    const opts = options.map((op) => {
      const [v, t] = Array.isArray(op) ? op : [op, op];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`;
    }).join("");
    return `<div class="form-field ${o.cls || ""}"><label for="${id}">${esc(label)}</label><select class="select" id="${id}" ${o.attrs || ""}>${opts}</select></div>`;
  }
  function searchField(id, placeholder, value = "") {
    return `<div class="form-field"><label for="${id}" class="sr-only">${esc(placeholder)}</label><div class="search-field">${icon("search")}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" /></div></div>`;
  }

  /* Tabela em linhas-cartão com ordenação, paginação e estado vazio na própria tabela */
  function pagerHtml(page, pages, total, size) {
    const from = (page - 1) * size + 1, to = Math.min(page * size, total);
    const nums = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    return `<nav class="pager" aria-label="Paginação">
      <span class="pager-info">${from}–${to} de ${total}</span>
      <button class="pager-btn" type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Página anterior">${icon("chevron_left")}</button>
      ${nums.map((p) => (p === "…" ? `<span class="pager-gap">…</span>` : `<button class="pager-btn ${p === page ? "is-current" : ""}" type="button" data-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`)).join("")}
      <button class="pager-btn" type="button" data-page="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Próxima página">${icon("chevron_right")}</button>
    </nav>`;
  }
  /* Última linha aberta em qualquer tabela, destacada como "acessada" no padrão do SEI */
  let lastAccessedId = null;
  function mountTable(el, cfg) {
    let sortKey = cfg.sortKey || null;
    let sortDir = cfg.sortDir || 1;
    const pageSize = cfg.pageSize || 10;
    let page = 1;
    let lastCount = null;
    function render() {
      let rows = (typeof cfg.rows === "function" ? cfg.rows() : cfg.rows).slice();
      if (lastCount !== null && rows.length !== lastCount) page = 1;
      lastCount = rows.length;
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      page = Math.min(page, pages);
      const offset = (page - 1) * pageSize;
      if (sortKey) {
        const col = cfg.cols.find((c) => c.key === sortKey);
        const get = col && col.sortValue ? col.sortValue : (r) => r[sortKey];
        rows.sort((a, b) => {
          const va = get(a), vb = get(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir;
        });
      }
      const head = cfg.cols.map((c) => {
        const sortable = c.sortable !== false && c.key;
        const sorted = sortKey === c.key;
        return `<th class="${c.cls || ""} ${sortable ? "sortable" : ""} ${sorted ? "sorted" : ""}" ${sortable ? `data-sort="${c.key}" tabindex="0" aria-sort="${sorted ? (sortDir > 0 ? "ascending" : "descending") : "none"}"` : ""}><span class="th-in">${esc(c.label)}${sortable ? icon(sorted ? (sortDir > 0 ? "arrow_upward" : "arrow_downward") : "unfold_more", "sort-ind") : ""}</span></th>`;
      }).join("");
      const body = rows.length
        ? rows.slice(offset, offset + pageSize).map((r, j) => `<tr class="${cfg.onRow ? "clickable" : ""} ${r.id != null && r.id === lastAccessedId ? "is-acessada" : ""} ${cfg.rowClass ? cfg.rowClass(r) : ""}" data-i="${offset + j}" ${cfg.onRow ? 'tabindex="0"' : ""}>${cfg.cols.map((c) => `<td class="${c.cls || ""} ${c.tdCls || ""}" data-label="${esc(c.label)}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")
        : `<tr class="table-empty-row"><td colspan="${cfg.cols.length}">${emptyState(cfg.empty || {})}</td></tr>`;
      /* Legenda no padrão do SEI: "Lista de contratos (8 registros)" */
      const n = rows.length;
      const caption = cfg.caption === false || !n ? "" : `<div class="table-caption">${cfg.caption ? `Lista de ${esc(cfg.caption)} ` : ""}<span>(${n} ${n === 1 ? "registro" : "registros"})</span></div>`;
      el.innerHTML = `${caption}<div class="table-wrap"><table class="data-table ${cfg.responsive !== false ? "responsive" : ""}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${cfg.foot || pages > 1 ? `<div class="table-foot"><div class="table-foot-text">${cfg.foot ? cfg.foot(rows) : ""}</div>${pages > 1 ? pagerHtml(page, pages, rows.length, pageSize) : ""}</div>` : ""}`;
      el.querySelectorAll(".pager-btn[data-page]").forEach((b) => b.addEventListener("click", () => {
        page = +b.dataset.page;
        render();
        el.scrollIntoView({ block: "nearest" });
      }));
      el.querySelectorAll("th[data-sort]").forEach((th) => {
        const go = () => { const k = th.dataset.sort; sortDir = sortKey === k ? -sortDir : 1; sortKey = k; page = 1; render(); };
        th.addEventListener("click", go);
        th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      el.querySelectorAll("tbody tr[data-i]").forEach((tr) => tr.addEventListener("click", (e) => {
        const r = rows[+tr.dataset.i];
        if (!r || r.id == null || !(cfg.onRow || e.target.closest("a, button"))) return;
        lastAccessedId = r.id;
        el.querySelectorAll("tr.is-acessada").forEach((x) => x.classList.remove("is-acessada"));
        tr.classList.add("is-acessada");
      }, true));
      if (cfg.onRow) {
        el.querySelectorAll("tbody tr[data-i]").forEach((tr) => {
          const go = (e) => { if (e.target.closest("button, a, input, select")) return; cfg.onRow(rows[+tr.dataset.i]); };
          tr.addEventListener("click", go);
          tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(e); });
        });
      }
      if (cfg.afterRender) cfg.afterRender(el, rows);
    }
    render();
    return { render };
  }

  /* Tags e pílulas com a mesma largura (a da maior) em cada coluna de tabela e em cada lista.
     Roda sozinho sempre que o conteúdo da página, de uma gaveta ou de um modal muda. */
  const BADGE = ".pill:not(.plain), .tag";
  function badgeKind(b) { return b.classList.contains("tag") ? "tag" : b.classList.contains("sm") ? "pill-sm" : "pill"; }
  function equalizeGroup(badges) {
    const groups = {};
    badges.forEach((b) => (groups[badgeKind(b)] = groups[badgeKind(b)] || []).push(b));
    Object.values(groups).forEach((g) => {
      if (g.length < 2) return;
      const w = Math.ceil(Math.max(...g.map((b) => b.getBoundingClientRect().width)));
      g.forEach((b) => { b.style.minWidth = w + "px"; b.dataset.eq = ""; });
    });
  }
  function equalizeBadges(scope = document) {
    scope.querySelectorAll("[data-eq]").forEach((b) => { b.style.minWidth = ""; delete b.dataset.eq; });
    scope.querySelectorAll("table.data-table").forEach((t) => {
      const rows = [...t.querySelectorAll("tbody tr[data-i]")];
      const cols = rows[0] ? rows[0].children.length : 0;
      for (let c = 0; c < cols; c++) {
        const perCell = rows.map((r) => [...(r.children[c] ? r.children[c].querySelectorAll(BADGE) : [])]);
        if (perCell.some((bs) => bs.length > 1)) continue; // células com várias tags (listas de etiquetas)
        equalizeGroup(perCell.flat());
      }
    });
    scope.querySelectorAll(".list").forEach((l) => {
      equalizeGroup([...l.children].map((it) => it.querySelector(":scope > .tag, :scope > .pill:not(.plain)")).filter(Boolean));
    });
    // Tabela em cartões (telas estreitas): célula cuja tag não cabe em meia largura ocupa a linha inteira
    scope.querySelectorAll(".data-table.responsive td.is-span").forEach((td) => td.classList.remove("is-span"));
    if (window.matchMedia("(max-width: 900px)").matches) {
      scope.querySelectorAll(".data-table.responsive td").forEach((td) => {
        if ([...td.querySelectorAll(BADGE)].some((b) => b.scrollWidth > b.clientWidth + 1)) td.classList.add("is-span");
      });
    }
  }
  /* "Limpar filtros (n)": aparece no fim de cada linha de filtros quando algum campo sai do valor padrão
     (a opção que a tela trouxe selecionada, ou campo de busca vazio). */
  const filterFields = (grid) => [...grid.querySelectorAll("select, input")];
  const isDefault = (el) => (el.tagName === "SELECT" ? el.value === ([...el.options].find((o) => o.defaultSelected) || el.options[0] || {}).value : el.value === el.defaultValue);
  function updateFilterClear(grid) {
    const btn = grid.querySelector(".filters-clear");
    if (!btn) return;
    const n = filterFields(grid).filter((el) => !isDefault(el)).length;
    btn.hidden = !n;
    btn.querySelector("span:last-child").textContent = `Limpar filtros (${n})`;
  }
  function setupFilterClears() {
    document.querySelectorAll(".filters-grid:not([data-clear-ready])").forEach((grid) => {
      grid.dataset.clearReady = "";
      grid.insertAdjacentHTML("beforeend", `<button type="button" class="link-btn filters-clear" hidden>${icon("close")}<span></span></button>`);
      grid.querySelector(".filters-clear").addEventListener("click", () => {
        filterFields(grid).forEach((el) => {
          if (isDefault(el)) return;
          if (el.tagName === "SELECT") { el.value = ([...el.options].find((o) => o.defaultSelected) || el.options[0]).value; el.dispatchEvent(new Event("change", { bubbles: true })); }
          else { el.value = el.defaultValue; el.dispatchEvent(new Event("input", { bubbles: true })); }
        });
        updateFilterClear(grid);
      });
      updateFilterClear(grid);
    });
  }
  ["change", "input"].forEach((ev) => document.addEventListener(ev, (e) => {
    const grid = e.target.closest && e.target.closest(".filters-grid");
    if (grid) updateFilterClear(grid);
  }));

  /* Lista longa (ex.: mais de 50 contratos): ganha um campo de busca que filtra as opções da lista.
     O <select> continua sendo o campo de valor, então as telas não precisam mudar. */
  const LONG_SELECT = 50;
  function enhanceLongSelects() {
    document.querySelectorAll("select.select:not([data-search-ready])").forEach((sel) => {
      sel.dataset.searchReady = "";
      if (sel.options.length <= LONG_SELECT) return;
      const inp = document.createElement("input");
      inp.type = "search"; inp.className = "input select-search"; inp.placeholder = "Digite para buscar…";
      inp.setAttribute("aria-label", "Buscar na lista");
      sel.before(inp);
      inp.addEventListener("input", () => {
        const q = inp.value.trim().toLowerCase();
        [...sel.options].forEach((o, i) => { o.hidden = i > 0 && !!q && !o.text.toLowerCase().includes(q) && o.value !== sel.value; });
      });
    });
  }

  let eqTimer = 0;
  const scheduleEqualize = () => { clearTimeout(eqTimer); eqTimer = setTimeout(() => { setupFilterClears(); enhanceLongSelects(); equalizeBadges(); }, 0); };
  new MutationObserver(scheduleEqualize).observe(document.documentElement, { childList: true, subtree: true });
  if (document.fonts) document.fonts.ready.then(scheduleEqualize);
  window.addEventListener("resize", scheduleEqualize);

  /* Lista paginada (mesmo paginador das tabelas) */
  function mountPagedList(el, cfg) {
    const pageSize = cfg.pageSize || 10;
    let page = 1;
    function render() {
      const rows = cfg.rows;
      if (!rows.length) { el.innerHTML = emptyState(cfg.empty || {}); return; }
      const pages = Math.ceil(rows.length / pageSize);
      page = Math.min(page, pages);
      const slice = rows.slice((page - 1) * pageSize, page * pageSize);
      el.innerHTML = `<div class="list">${slice.map(cfg.renderItem).join("")}</div>${pages > 1 ? `<div class="table-foot"><div class="table-foot-text"></div>${pagerHtml(page, pages, rows.length, pageSize)}</div>` : ""}`;
      el.querySelectorAll(".pager-btn[data-page]").forEach((b) => b.addEventListener("click", () => {
        page = +b.dataset.page;
        render();
        el.scrollIntoView({ block: "nearest" });
      }));
    }
    render();
  }

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg, ic = "check_circle") {
    const t = document.getElementById("appToast");
    t.querySelector(".app-toast-content").innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), 3200);
  }

  /* ---------------- Modal e drawer ---------------- */
  const layerStack = [];
  function trapKeys(e) {
    if (e.key === "Escape" && layerStack.length) { e.preventDefault(); layerStack[layerStack.length - 1].close(); }
  }
  document.addEventListener("keydown", trapKeys);

  function openLayer(kind, o) {
    const prevFocus = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const box = document.createElement("div");
    box.className = kind + (o.wide ? " wide" : "");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", o.title || "");
    // Padrão de rodapé: fechar/cancelar só pelo X do cabeçalho; no máximo uma ação
    // secundária (outline) à esquerda e a principal (primary) à direita.
    let actions = (o.actions || []).filter((a) => a.onClick || a.disabled);
    if (actions.length) {
      const main = actions.findIndex((a) => a.cls === "primary" && !a.disabled);
      const iMain = main >= 0 ? main : actions.length - 1;
      actions = [...actions.filter((_, i) => i !== iMain), actions[iMain]]
        .map((a, i, arr) => ({ ...a, cls: i === arr.length - 1 && (!a.disabled || arr.length === 1) ? "primary" : a.cls === "danger-outline" ? "danger-outline" : "outline" }));
    }
    o = { ...o, actions: actions.length ? actions : null };
    if (kind === "modal") {
      box.innerHTML = `<div class="modal-head"><div>${o.kicker ? `<span class="kicker">${esc(o.kicker)}</span>` : ""}<h3>${esc(o.title)}</h3>${o.subtitle ? `<p>${o.subtitle}</p>` : ""}</div><button class="icon-btn" data-close aria-label="Fechar">${icon("close")}</button></div><div class="modal-body">${o.body || ""}</div>${o.actions ? `<div class="modal-foot"></div>` : ""}`;
    } else {
      box.innerHTML = `<div class="drawer-head"><div>${o.kicker ? `<span class="kicker">${esc(o.kicker)}</span>` : ""}<h3>${esc(o.title)}</h3>${o.subtitle ? `<p>${o.subtitle}</p>` : ""}</div><button class="icon-btn" data-close aria-label="Fechar">${icon("close")}</button></div><div class="drawer-body">${o.body || ""}</div>${o.actions ? `<div class="drawer-foot"></div>` : ""}`;
    }
    const layer = {
      el: box,
      close() {
        overlay.remove(); box.remove();
        const i = layerStack.indexOf(layer); if (i >= 0) layerStack.splice(i, 1);
        if (o.onClose) o.onClose();
        if (prevFocus && prevFocus.focus) prevFocus.focus();
      },
    };
    if (o.actions) {
      const foot = box.querySelector(".modal-foot, .drawer-foot");
      o.actions.forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn " + (a.cls || "outline");
        b.innerHTML = (a.icon ? icon(a.icon) : "") + esc(a.label);
        b.addEventListener("click", () => { if (a.onClick) { const r = a.onClick(layer); if (r === false) return; } if (a.close !== false) layer.close(); });
        if (a.disabled) {
          // Botão desabilitado não recebe o mouse: a dica fica num invólucro em volta dele
          b.disabled = true;
          const wrap = document.createElement("span");
          wrap.className = "btn-tip";
          if (a.tip) { wrap.dataset.tip = a.tip; wrap.tabIndex = 0; wrap.setAttribute("aria-label", a.tip); }
          wrap.appendChild(b);
          foot.appendChild(wrap);
        } else foot.appendChild(b);
      });
    }
    overlay.addEventListener("click", () => layer.close());
    box.querySelector("[data-close]").addEventListener("click", () => layer.close());
    document.body.append(overlay, box);
    layerStack.push(layer);
    if (o.mount) o.mount(box, layer);
    const first = box.querySelector("input, select, textarea, button:not([data-close])");
    (kind === "drawer" ? box.querySelector("[data-close]") : first || box.querySelector("[data-close]")).focus({ preventScroll: true });
    return layer;
  }
  const openModal = (o) => openLayer("modal", o);
  const openDrawer = (o) => openLayer("drawer", o);

  function confirmModal(o) {
    return openModal({
      title: o.title, subtitle: o.subtitle, kicker: o.kicker,
      body: o.body + (o.requireText ? `<div class="form-field"><label for="cmText">${esc(o.requireText)} <span class="field-req">*</span></label><textarea class="textarea" id="cmText" placeholder="${esc(o.placeholder || "")}"></textarea></div>` : ""),
      actions: [
        { label: o.confirmLabel || "Confirmar", cls: o.confirmCls || "primary", icon: o.confirmIcon, onClick: (layer) => {
          let txt = "";
          if (o.requireText) {
            const ta = layer.el.querySelector("#cmText");
            txt = ta.value.trim();
            if (!txt) { ta.classList.add("is-missing"); ta.focus(); toast("Registre a justificativa para continuar.", "error"); return false; }
          }
          return o.onConfirm(txt, layer);
        } },
      ],
    });
  }

  /* ---------------- Histórico (rastreabilidade, item 13) ---------------- */
  function addHistorico(e) {
    const u = currentUser();
    const p = currentProfile();
    state.historico.unshift({
      id: uid("h"), data: nowIso(), usuario: u ? u.id : "sistema",
      funcao: e.funcao || (p ? p.label : "—"),
      acao: e.acao, objeto: e.objeto, detalhe: e.detalhe || "", contratoId: e.contratoId || null,
    });
    save();
  }

  /* ---------------- Cálculos de indicadores (8.2–8.4) ---------------- */
  const CAMPO_IND = { tempo_espera: "TME", duracao_atendimento: "TMA" };
  function serieDoPosto(postoId, comp) {
    return (D.CCO[postoId] || []).filter((d) => d.data.startsWith(comp));
  }
  function computeIndicator(itemId, postoId, comp) {
    const item = getItem(itemId);
    const esp = item.config.especifico || {};
    const ind = CAMPO_IND[esp.campo];
    const meta = parseFloat(esp.meta);
    if (!ind || !D.CCO[postoId]) {
      return { ind: esp.campo, meta, valor: null, cobertura: 0, previstos: 0, validos: 0, ausentes: [], inconsistentes: [], status: "sem_dados", fonteExterna: true, serie: [] };
    }
    const serie = serieDoPosto(postoId, comp);
    const previstos = serie.filter((d) => !d.semExpediente);
    const ausentes = previstos.filter((d) => d.ausente).map((d) => d.data);
    const inconsistentes = previstos.filter((d) => d.inconsistente).map((d) => d.data);
    const validos = previstos.filter((d) => !d.ausente && !d.inconsistente);
    const soma = validos.reduce((s, d) => s + d[ind] * d.atendimentos, 0);
    const atend = validos.reduce((s, d) => s + d.atendimentos, 0);
    const valor = atend ? soma / atend : null;
    const cobertura = previstos.length ? validos.length / previstos.length : 0;
    let status = "sem_dados";
    if (valor != null) status = valor > meta ? "fora" : "conforme";
    const parcial = comp === CURRENT_COMP;
    return { ind, meta, valor, atend, cobertura, previstos: previstos.length, validos: validos.length, ausentes, inconsistentes, status, parcial, serie };
  }
  function parcelaMensalPosto(item) {
    const c = getContrato(item.contratoId);
    return c.valores.vigente / c.valores.mesesVigencia / (item.config.abrangencia.length || 1);
  }
  /* Regra validada do item i1: 0,5% da parcela do posto por minuto ou fração acima da meta, limite 5% */
  function glosaEstimada(itemId, comp) {
    const item = getItem(itemId);
    if (!item || item.config.financeiro.situacao !== "validada" || item.tipo !== "indicador") return null;
    const parcela = parcelaMensalPosto(item);
    const linhas = item.config.abrangencia.map((pid) => {
      const r = computeIndicator(itemId, pid, comp);
      let faixas = 0, pct = 0, valor = 0;
      if (r.status === "fora") {
        faixas = Math.ceil(r.valor - r.meta - 1e-9);
        pct = Math.min(faixas * 0.5, 5);
        valor = Math.round(parcela * pct) / 100;
      }
      return { postoId: pid, r, faixas, pct, valor, parcela };
    });
    return { parcela, linhas, total: linhas.reduce((s, l) => s + l.valor, 0), coberturaCompleta: linhas.every((l) => l.r.cobertura >= 1) };
  }

  /* ---------------- Gráfico de linha (SVG) com lacunas ---------------- */
  function lineChart(points, o = {}) {
    const W = o.width || 640, H = o.height || 180, P = { l: 34, r: 10, t: 10, b: 22 };
    const vals = points.filter((p) => p.v != null).map((p) => p.v);
    const meta = o.meta;
    const max = Math.max(...vals, meta || 0) * 1.12 || 1;
    const min = 0;
    const x = (i) => P.l + (i / Math.max(points.length - 1, 1)) * (W - P.l - P.r);
    const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
    const segs = [];
    let cur = [];
    points.forEach((p, i) => {
      if (p.v == null) { if (cur.length) segs.push(cur); cur = []; }
      else cur.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
    });
    if (cur.length) segs.push(cur);
    const gaps = points.map((p, i) => (p.gap ? `<rect x="${(x(i) - (W - P.l - P.r) / points.length / 2).toFixed(1)}" y="${P.t}" width="${((W - P.l - P.r) / points.length).toFixed(1)}" height="${H - P.t - P.b}" fill="url(#hatch)" opacity="0.9"><title>${esc(p.label)}: sem dados</title></rect>` : "")).join("");
    const ticks = [0, 0.5, 1].map((f) => { const v = min + (max - min) * f; return `<text x="${P.l - 6}" y="${y(v) + 3}" text-anchor="end">${fmtNum(v, 0)}</text><line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border-soft)"/>`; }).join("");
    const xl = points.map((p, i) => (i % Math.ceil(points.length / 8) === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(p.short || "")}</text>` : "")).join("");
    const metaLine = meta != null ? `<line x1="${P.l}" x2="${W - P.r}" y1="${y(meta)}" y2="${y(meta)}" stroke="var(--danger)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - P.r}" y="${y(meta) - 4}" text-anchor="end" style="fill:var(--danger-text);font-weight:600">meta ${fmtNum(meta, 0)}</text>` : "";
    const dots = points.map((p, i) => (p.v != null ? `<circle cx="${x(i)}" cy="${y(p.v)}" r="2.6" fill="${meta != null && p.v > meta ? "var(--danger)" : "var(--primary)"}"><title>${esc(p.label)}: ${fmtNum(p.v)}</title></circle>` : "")).join("");
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || "Gráfico")}">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--panel-2)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--border-strong)" stroke-width="2"/></pattern></defs>
      ${ticks}${gaps}${metaLine}
      ${segs.map((s) => `<polyline points="${s.join(" ")}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/>`).join("")}
      ${dots}${xl}
    </svg>
    <div class="chart-legend"><span><i></i>Valor diário</span>${meta != null ? `<span><i class="meta"></i>Meta contratual</span>` : ""}<span><i class="gap"></i>Faixa hachurada: sem dados (não é zero)</span></div></div>`;
  }

  /* ---------------- Exportação CSV (real) ---------------- */
  function downloadCsv(filename, header, rows) {
    const escCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [header, ...rows].map((r) => r.map(escCsv).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Arquivo " + filename + " gerado.", "download");
  }

  /* ---------------- Exportação PDF (real, jsPDF carregado sob demanda) ---------------- */
  const PDF_LIBS = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
  ];
  let pdfLibs = null;
  function loadPdfLibs() {
    if (!pdfLibs) {
      pdfLibs = PDF_LIBS.reduce((p, src) => p.then(() => new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = src; s.onload = ok; s.onerror = fail;
        document.head.appendChild(s);
      })), Promise.resolve()).catch((e) => { pdfLibs = null; throw e; });
    }
    return pdfLibs;
  }
  async function downloadPdf(filename, title, header, rows, opts = {}) {
    try { await loadPdfLibs(); } catch (e) {
      toast("Não foi possível carregar o gerador de PDF. Verifique a conexão.", "error");
      return;
    }
    const doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const money = new Set(opts.money || []);
    // A fonte padrão do PDF só cobre Latin-1/WinAnsi: troca símbolos fora dela.
    const pdfText = (t) => String(t).replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠/g, "<>").replace(/[‐‑−]/g, "-")
      .replace(/[^\u0000-ÿ–—‘’“”•…€]/g, "");
    const cell = (v, i) => pdfText(money.has(i) && typeof v === "number" ? fmtMoney(v) : v ?? "—");
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(25, 99, 154);
    doc.text(pdfText(title), 40, 44);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(95, 107, 122);
    doc.text(`Gestão Contratual · Gerado em ${fmtDate(D.TODAY)} · ${rows.length} registro(s)`, 40, 60);
    doc.autoTable({
      head: [header],
      body: rows.map((r) => r.map(cell)),
      startY: 74,
      margin: { left: 40, right: 40, bottom: 40 },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: [31, 41, 55], lineColor: [226, 232, 240], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: { fillColor: [25, 99, 154], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [243, 245, 247] },
      columnStyles: Object.fromEntries([...money].map((i) => [i, { halign: "right" }])),
      didDrawPage: () => {
        doc.setFontSize(8); doc.setTextColor(95, 107, 122);
        doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, W - 40, H - 20, { align: "right" });
      },
    });
    doc.save(filename);
    toast("Arquivo " + filename + " gerado.", "download");
  }

  /* ============================================================
     Roteador
     ============================================================ */
  const routes = [];
  function route(pattern, profile, handler) {
    const parts = pattern.split("/");
    routes.push({ pattern, parts, profile, handler });
  }
  function matchRoute(path) {
    const segs = path.split("/").filter(Boolean);
    for (const r of routes) {
      const params = {};
      let ok = true;
      for (let i = 0; i < Math.max(r.parts.length, segs.length); i++) {
        const p = r.parts[i], s = segs[i];
        if (p === undefined) { ok = false; break; }
        if (p.startsWith(":")) {
          const opt = p.endsWith("?");
          if (s === undefined) { if (!opt) ok = false; continue; }
          params[p.replace(/[:?]/g, "")] = decodeURIComponent(s);
        } else if (p !== s) { ok = false; break; }
      }
      if (ok) return { r, params };
    }
    return null;
  }
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const query = Object.fromEntries(new URLSearchParams(qs || ""));
    return { path, query };
  }
  function go(path) {
    const h = "#/" + path;
    if (location.hash === h) renderRoute(); else location.hash = h; // mesmo endereço: só redesenha
  }

  function renderRoute() {
    const { path, query } = parseHash();
    closeMenus();
    document.getElementById("appShell").classList.remove("mobile-nav-open");
    while (layerStack.length) layerStack[layerStack.length - 1].close();

    if (path === "login" || !lsGet(SESSION_KEY)) {
      showLoginScreen();
      return;
    }
    if (!path || path === "perfil" || !App.profileKey) {
      showProfileScreen();
      return;
    }
    const m = matchRoute(path);
    const prof = path.split("/")[0];
    showShell();
    const content = document.getElementById("content");
    const oculta = (currentProfile().ocultas || []).find((r) => path === r || path.startsWith(r + "/"));
    if (oculta) {
      return renderPage(content, { title: "Fora da primeira versão", crumbs: [], html: `<div class="section">${stateBox("schedule", "Esta tela fica para a próxima fase", "A preparação do acompanhamento e o De acordo dos itens fazem parte do P2. Na primeira versão a Equipe GCR trabalha pela Caixa DSC, pelo Radar e pelas OIS.", `<a class="btn primary" href="#/${currentProfile().home}">Ir para a Caixa DSC</a>`)}</div>` });
    }
    if (!m) {
      return renderPage(content, { title: "Página não encontrada", crumbs: [], html: `<div class="section">${stateBox("search_off", "Página não encontrada", "O endereço não corresponde a nenhuma tela deste ambiente.", `<a class="btn primary" href="#/${currentProfile().home}">Ir para o início</a>`)}</div>` });
    }
    if (m.r.profile && m.r.profile !== App.profileKey) {
      const target = D.PROFILES[prof];
      return renderPage(content, {
        title: "Sem permissão", crumbs: [],
        html: `<div class="section">${stateBox("lock", "Este ambiente não faz parte do seu perfil", `A tela pertence ao ambiente <strong>${esc(target ? target.label : prof)}</strong>. Seu perfil atual é <strong>${esc(currentProfile().label)}</strong>. A troca de ambiente não amplia o escopo de contratos.`, `<a class="btn primary" href="#/${currentProfile().home}">Voltar ao meu ambiente</a>`)}</div>`,
      });
    }
    let page;
    try { page = m.r.handler(m.params, query); }
    catch (err) { console.error(err); page = { title: "Erro", html: `<div class="section">${stateBox("error", "Não foi possível montar a tela", esc(err.message))}</div>` }; }
    renderPage(content, page);
  }

  function stateBox(ic, title, desc, action = "") {
    return `<div class="state-box">${icon(ic)}<h2>${esc(title)}</h2><p>${desc}</p>${action ? `<div style="margin-top:8px">${action}</div>` : ""}</div>`;
  }

  /* Histórico de telas para o "Voltar" do topo. Abas e filtros da mesma tela (mesmo título e último nível do caminho)
     contam como uma tela só, então o Voltar leva à tela de onde o usuário veio, não à aba anterior. */
  let navStack = [];
  function trackPage(page, crumbs) {
    const label = crumbs.length > 1 ? crumbs[crumbs.length - 1].label : page.title || "";
    const key = (page.title || "") + "|" + label;
    const entry = { key, label, hash: location.hash };
    const top = navStack[navStack.length - 1];
    if (top && top.key === key) navStack[navStack.length - 1] = entry;
    else if (navStack.length > 1 && navStack[navStack.length - 2].key === key) { navStack.pop(); navStack[navStack.length - 1] = entry; }
    else navStack = navStack.concat(entry).slice(-30);
    const prev = navStack[navStack.length - 2];
    const back = document.getElementById("topbarBack");
    back.hidden = !prev;
    if (prev) {
      back.href = prev.hash;
      back.setAttribute("aria-label", "Voltar para " + prev.label);
      back.dataset.tip = "Voltar para " + prev.label;
    }
  }

  function renderPage(content, page) {
    const p = currentProfile();
    document.getElementById("topbarTitle").textContent = page.title || "";
    document.title = (page.title ? page.title + " · " : "") + "Gestão Contratual SEI";
    const crumbs = [{ label: p.label, href: "#/" + p.home }].concat(page.crumbs || []);
    trackPage(page, crumbs);
    document.getElementById("breadcrumb").innerHTML = crumbs.map((c, i) => (i ? icon("chevron_right") : "") + (c.href && i < crumbs.length - 1 ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`)).join("");
    content.innerHTML = page.html;
    document.querySelectorAll("#sideNav .nav-item").forEach((a) => a.classList.toggle("active", a.dataset.route === page.nav));
    if (page.mount) page.mount(content);
    window.scrollTo(0, 0);
  }

  /* ============================================================
     Shell
     ============================================================ */
  function showLoginScreen() {
    document.getElementById("appShell").hidden = true;
    document.getElementById("profileScreen").hidden = true;
    document.body.classList.add("on-profile");
    document.getElementById("seiBarUnit").hidden = true;
    document.getElementById("loginScreen").hidden = false;
    document.title = "Entrar · Gestão Contratual SEI";
  }

  function logout() {
    App.profileKey = null;
    navStack = [];
    lsSet(PROFILE_KEY, "");
    lsSet(SESSION_KEY, "");
    go("login");
  }

  function bindLogin() {
    const form = document.getElementById("loginForm");
    const email = document.getElementById("loginEmail"), senha = document.getElementById("loginSenha");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const vazio = [email, senha].filter((el) => !el.value.trim() || (el === email && !email.checkValidity()));
      [email, senha].forEach((el) => el.closest(".auth-input-wrap").classList.toggle("is-missing", vazio.includes(el)));
      if (vazio.length) { toast(vazio.includes(email) ? "Informe um e-mail válido." : "Informe a senha.", "error"); vazio[0].focus(); return; }
      lsSet(SESSION_KEY, email.value.trim());
      App.profileKey = null;
      lsSet(PROFILE_KEY, "");
      go("perfil");
    });
    document.getElementById("loginShowPass").addEventListener("click", (e) => {
      const b = e.currentTarget, ver = senha.type === "password";
      senha.type = ver ? "text" : "password";
      b.setAttribute("aria-pressed", String(ver));
      b.setAttribute("aria-label", ver ? "Ocultar senha" : "Mostrar senha");
      b.innerHTML = icon(ver ? "visibility_off" : "visibility");
    });
    document.getElementById("loginForgot").addEventListener("click", (e) => { e.preventDefault(); toast("Recuperação de senha simulada neste protótipo.", "info"); });
    document.getElementById("profileLogout").addEventListener("click", logout);
  }

  function showProfileScreen() {
    document.getElementById("appShell").hidden = true;
    document.getElementById("loginScreen").hidden = true;
    document.body.classList.add("on-profile");
    document.getElementById("seiBarUnit").hidden = true;
    const scr = document.getElementById("profileScreen");
    scr.hidden = false;
    document.getElementById("sessionEmail").textContent = lsGet(SESSION_KEY);
    document.title = "Selecione o perfil · Gestão Contratual SEI";
    const grid = document.getElementById("profileGrid");
    grid.innerHTML = Object.values(D.PROFILES).filter((p) => !p.hidden).map((p) => {
      const u = D.USERS[p.userId];
      return `<a class="profile-card" href="#/${p.home}" data-profile="${p.key}">
        <span class="profile-avatar ${p.avatarTone}">${u.iniciais}</span>
        <strong>${esc(p.label)}</strong>
        <p>${esc(u.nome)} · ${esc(u.funcao)}</p>
        <span class="profile-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</span>
        <p>${esc(p.descricao)}</p>
        <span class="profile-access">Continuar ${icon("arrow_forward")}</span>
      </a>`;
    }).join("");
    grid.querySelectorAll("[data-profile]").forEach((a) => a.addEventListener("click", () => setProfile(a.dataset.profile)));
  }

  function setProfile(key) {
    App.profileKey = key;
    navStack = [];
    lsSet(PROFILE_KEY, key);
    buildShell();
  }

  function showShell() {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("profileScreen").hidden = true;
    document.getElementById("appShell").hidden = false;
    document.body.classList.remove("on-profile");
  }

  function navCounts() {
    const scopeIds = new Set(contratosVisiveis().map((c) => c.id));
    return {
      caixaDiretor: App.caixaAguardandoDiretor ? App.caixaAguardandoDiretor().length : 0,
      caixaTriagem: App.caixaTriagem ? App.caixaTriagem().length : 0,
      radar: App.radarItens ? App.radarItens().length : 0,
      oisPend: App.oisPendentes ? App.oisPendentes().length : 0,
      mudancas: state.mudancas.filter((m) => daysUntil(m.data) >= -30).length,
      riscosCriticos: state.riscos.filter((r) => r.severidade === "critica" || r.severidade === "alta").length,
      aguardandoAceite: state.itens.filter((i) => scopeIds.has(i.contratoId) && (i.status === "aguardando_aceite" || i.revisaoPendente)).length,
      pendGestor: App.pendenciasGestor ? App.pendenciasGestor().length : 0,
      ocVencidas: state.ocorrencias.filter((o) => scopeIds.has(o.contratoId) && o.status === "vencida").length,
      medPendentes: state.medicoes.filter((m) => { const it = getItem(m.itemId); return it && scopeIds.has(it.contratoId) && m.status !== "fechada" && (m.status === "pronta_validacao" || m.prazo === "atrasado"); }).length,
    };
  }

  function buildShell() {
    const p = currentProfile();
    if (!p) return;
    const u = currentUser();
    const counts = navCounts();
    document.getElementById("sideNav").innerHTML = p.nav.map((n) => {
      const c = n.count ? counts[n.count] : 0;
      return `<a class="nav-item" href="#/${n.route}" data-route="${n.route}" title="${esc(n.label)}">${icon(n.icon)}<span class="nav-label">${esc(n.label)}</span>${c ? `<span class="nav-count" aria-label="${c} pendentes">${c}</span>` : ""}</a>`;
    }).join("");
    document.getElementById("userAvatar").textContent = u.iniciais;
    document.getElementById("userName").textContent = u.nome;
    document.getElementById("userRole").textContent = u.funcao;
    document.getElementById("userChip").textContent = p.label;
    document.getElementById("userScope").innerHTML = `<strong>${esc(u.nome)}</strong>Ambiente: ${esc(p.label)}<br>Escopo: ${esc(p.escopo)}`;
    const unit = document.getElementById("seiBarUnit");
    unit.textContent = p.label;
    unit.hidden = false;
    renderNotifications();
  }
  /* Recalcula contadores do menu e alertas mantendo o item ativo */
  function refreshNav() {
    if (!currentProfile()) return;
    const active = document.querySelector("#sideNav .nav-item.active");
    const r = active && active.dataset.route;
    buildShell();
    if (r) { const a = document.querySelector(`#sideNav [data-route="${r}"]`); if (a) a.classList.add("active"); }
  }

  function renderNotifications() {
    const list = state.alertas.filter((a) => a.perfil.includes(App.profileKey));
    const abertos = list.filter((a) => a.estado === "novo").length;
    const dot = document.getElementById("notifDot");
    dot.hidden = !abertos;
    dot.textContent = abertos;
    document.getElementById("notifList").innerHTML = list.length ? list.map((a) => `
      <li class="notif-item">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <span class="notif-title">${esc(a.titulo)}</span>${lpill("alerta", a.estado, "sm")}
        </div>
        <span class="notif-meta">${esc(a.meta)} · Responsável: ${esc(a.responsavel)} · ${fmtDate(a.data)}</span>
        <div class="notif-actions">
          ${a.estado === "novo" ? `<button class="link-btn" data-alert="${a.id}" data-to="reconhecido">${icon("done")}<span>Reconhecer</span></button>` : ""}
          ${a.estado !== "em_tratamento" && a.estado !== "encerrado" ? `<button class="link-btn" data-alert="${a.id}" data-to="em_tratamento">${icon("pending")}<span>Em tratamento</span></button>` : ""}
          ${a.estado !== "encerrado" ? `<button class="link-btn" data-alert="${a.id}" data-to="encerrado">${icon("task_alt")}<span>Encerrar</span></button>` : ""}
        </div>
      </li>`).join("") : `<li class="notif-item"><span class="notif-meta">Nenhum alerta para este ambiente.</span></li>`;
    document.querySelectorAll("#notifList [data-alert]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = state.alertas.find((x) => x.id === b.dataset.alert);
      a.estado = b.dataset.to;
      addHistorico({ acao: "Alerta " + L.alerta[a.estado][0].toLowerCase(), objeto: a.titulo, contratoId: a.contratoId });
      save();
      renderNotifications();
    }));
  }

  function closeMenus(except) {
    ["notifDropdown", "userDropdown", "searchResults"].forEach((id) => { if (id !== except) { const el = document.getElementById(id); if (el) el.hidden = true; } });
    document.getElementById("notifToggle").setAttribute("aria-expanded", "false");
    document.getElementById("userToggle").setAttribute("aria-expanded", "false");
  }

  /* Busca por contrato, processo ou documento — respeita o escopo do perfil */
  function runSearch(q) {
    const box = document.getElementById("searchResults");
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; return; }
    const vis = contratosVisiveis();
    const ids = new Set(vis.map((c) => c.id));
    const fichaRoute = (cid) => App.profileKey === "super" ? `super/contrato/${cid}` : App.profileKey === "gestor" ? `gestor/contrato/${cid}` : `op/itens?contrato=${cid}`;
    const res = [];
    vis.forEach((c) => {
      if ([c.numero, c.objeto, c.contratada, c.cnpj].join(" ").toLowerCase().includes(q)) res.push({ ic: "description", t: c.numero + " — " + c.objeto, s: c.contratada, href: fichaRoute(c.id) });
      c.processos.forEach((p) => { if (p.numero.includes(q)) res.push({ ic: "folder", t: "Processo " + p.numero, s: p.papel + " · " + c.numero, href: fichaRoute(c.id) + (App.profileKey !== "op" ? "/instrumentos" : "") }); });
    });
    D.DOCUMENTOS.filter((d) => ids.has(d.contratoId)).forEach((d) => {
      if ([d.sei, d.titulo, d.tipo].join(" ").toLowerCase().includes(q)) {
        const c = getContrato(d.contratoId);
        res.push({ ic: d.restrito ? "lock" : "article", t: "SEI " + d.sei + " — " + d.titulo, s: c.numero + (d.restrito ? " · acesso restrito no SEI" : ""), href: fichaRoute(c.id) + (App.profileKey !== "op" ? "/instrumentos" : "") });
      }
    });
    box.innerHTML = res.length ? res.slice(0, 12).map((r) => `<a class="search-result" href="#/${r.href}">${icon(r.ic)}<span><strong>${esc(r.t)}</strong><small>${esc(r.s)}</small></span></a>`).join("")
      : `<div class="search-empty">Nenhum resultado no seu escopo para “${esc(q)}”.</div>`;
    box.hidden = false;
  }

  /* Assistente discreto: explica fontes, não aprova nada (12.9) */
  const ASSIST = {
    super: [
      ["O que precisa de mim hoje?", "Duas assinaturas: a OIS nº 042/2026 do CT 014/2025 (prazo 30/10) e a minuta do 2º Termo Aditivo do CT 031/2024, que prorroga a vigilância (prazo interno 16/11). A proposta de supressão do CT 033/2025 está sobrestada no Orçamento. Veja a Caixa DSC com o filtro “Precisa do Diretor”."],
      ["O que está atrasado?", "A resposta à Casa Civil (Ofício nº 318/2026) venceu em 23/10 e está sem responsável. A OIS nº 007/2026 foi emitida para o CT 027/2023, cuja vigência terminou em 31/01/2026. Os dois estão no Radar."],
      ["Onde os processos estão parados?", "O pedido de troca de preposto do CT 014/2025 está na DSC/GOS sem andamento há 38 dias. O alvará do Posto Vale depende da Prefeitura desde 05/10, com uma cobrança registrada em 19/10."],
    ],
    gestor: [
      ["O que falta classificar na caixa?", "O memorando da DAF com o cronograma de pagamentos de novembro chegou hoje e ainda não tem categoria, contrato nem ação. Abra a entrada na Caixa DSC e use “Classificar”."],
      ["Quais itens estão sem responsável?", "A resposta à Casa Civil, a OIS nº 007/2026 do CT 027/2023 e a minuta do CT 041/2026. O CT 041/2026 também não tem gestor nem fiscal designados: informe o responsável na ficha, aba Responsáveis."],
    ],
    op: [
      ["Como foi calculado o TME do Posto Norte?", "Média ponderada pelo número de atendimentos de cada dia útil de set/2026, com dados do CCO (D-1). Dias sem expediente não contam e dias com dado inconsistente são excluídos com registro. A memória de cálculo está no detalhe do item."],
      ["Posso fechar a medição de set/2026?", "A medição do TME está pronta para validação. A confirmação de valores cabe ao responsável competente; sua função prepara e submete. Há lacuna de cobertura no Posto Leste (3 dias), que exige exceção autorizada."],
    ],
  };
  function renderAssistant() {
    const body = document.getElementById("assistantBody");
    const qs = ASSIST[App.profileKey] || [];
    body.innerHTML = `<div class="assistant-msg">Posso ajudar a localizar fontes e explicar resultados deste ambiente. Escolha uma pergunta:</div>
      <div class="assistant-suggest">${qs.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join("")}</div>`;
    body.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
      const [q, a] = qs[+b.dataset.q];
      body.insertAdjacentHTML("beforeend", `<div class="assistant-msg me">${esc(q)}</div><div class="assistant-msg">${esc(a)}</div>`);
      body.scrollTop = body.scrollHeight;
    }));
  }

  function applyTheme(t) {
    document.body.classList.toggle("theme-dark", t === "dark");
    document.querySelectorAll(".theme-option").forEach((b) => {
      const on = b.dataset.theme === t;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function bindShell() {
    const shell = document.getElementById("appShell");
    if (lsGet(SIDEBAR_KEY) === "collapsed") shell.classList.add("sidebar-collapsed");
    document.getElementById("sidebarCollapse").addEventListener("click", () => {
      shell.classList.toggle("sidebar-collapsed");
      lsSet(SIDEBAR_KEY, shell.classList.contains("sidebar-collapsed") ? "collapsed" : "open");
    });
    document.getElementById("mobileMenu").addEventListener("click", () => shell.classList.toggle("mobile-nav-open"));
    document.getElementById("mobileScrim").addEventListener("click", () => shell.classList.remove("mobile-nav-open"));

    document.querySelectorAll(".theme-option").forEach((b) => b.addEventListener("click", () => { applyTheme(b.dataset.theme); lsSet(THEME_KEY, b.dataset.theme); }));

    const nt = document.getElementById("notifToggle");
    nt.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = document.getElementById("notifDropdown");
      const open = dd.hidden;
      closeMenus("notifDropdown");
      dd.hidden = !open;
      nt.setAttribute("aria-expanded", String(open));
    });
    const ut = document.getElementById("userToggle");
    ut.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = document.getElementById("userDropdown");
      const open = dd.hidden;
      closeMenus("userDropdown");
      dd.hidden = !open;
      ut.setAttribute("aria-expanded", String(open));
    });
    document.getElementById("notifDropdown").addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => closeMenus());

    document.getElementById("switchProfile").addEventListener("click", () => { App.profileKey = null; lsSet(PROFILE_KEY, ""); go("perfil"); });
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("resetData").addEventListener("click", () => {
      confirmModal({
        title: "Restaurar dados de exemplo?",
        body: "<p>As decisões, aceites, fiscalizações e ocorrências registradas neste navegador serão descartadas e o protótipo volta ao estado inicial.</p>",
        confirmLabel: "Restaurar", confirmIcon: "restart_alt",
        onConfirm: () => { resetState(); buildShell(); renderRoute(); toast("Dados de exemplo restaurados.", "restart_alt"); },
      });
    });

    const gs = document.getElementById("globalSearchInput");
    gs.addEventListener("input", () => runSearch(gs.value));
    gs.addEventListener("focus", () => runSearch(gs.value));
    gs.addEventListener("click", (e) => e.stopPropagation());
    gs.addEventListener("keydown", (e) => { if (e.key === "Escape") { gs.value = ""; runSearch(""); gs.blur(); } });
    document.getElementById("searchResults").addEventListener("click", () => { gs.value = ""; document.getElementById("searchResults").hidden = true; document.getElementById("globalSearch").classList.remove("is-open"); });
    document.getElementById("searchToggle").addEventListener("click", (e) => {
      e.stopPropagation();
      const w = document.getElementById("globalSearch");
      w.classList.toggle("is-open");
      if (w.classList.contains("is-open")) gs.focus();
    });

    const fab = document.getElementById("assistantFab");
    const panel = document.getElementById("assistantPanel");
    fab.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      fab.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) renderAssistant();
    });
    document.getElementById("assistantClose").addEventListener("click", () => { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); });
  }

  /* ============================================================
     API pública
     ============================================================ */
  const App = {
    D, L, get state() { return state; }, save, resetState,
    profileKey: null,
    esc, icon, pill, lpill, tipoTag, procLink, procVisto, marcarProcVisto, source, docSource, statCard, emptyState, sectionTitle, pageHeader, selectField, searchField, stateBox,
    fmtDate, fmtDateTime, fmtComp, fmtMoney, fmtMoneyShort, fmtNum, daysUntil, compAdd, nowIso, uid, initials, parseDate,
    CURRENT_COMP, NEXT_COMP,
    userName, getContrato, getPosto, getDoc, getItem, itensDo, docsDo, designacoesAtivas, gestorDe, respManual,
    currentProfile, currentUser, contratosVisiveis, podeVerContrato, minhaDesignacao, podeDarAceite,
    situacaoContratual, acompanhamento,
    mountTable, mountPagedList, actionIcon, moreMenu, exportMenu, kpiCard, kpiHead, moneyKpi, fmtMoney0, finContrato, fiscalDe, prazoVigencia, ORIGEM_DADOS, toast, openModal, openDrawer, confirmModal, addHistorico,
    computeIndicator, glosaEstimada, parcelaMensalPosto, lineChart, downloadCsv, downloadPdf,
    route, go, renderRoute, refreshNav, navCounts,
  };
  window.App = App;

  document.addEventListener("DOMContentLoaded", () => {
    const theme = lsGet(THEME_KEY) || "light";
    applyTheme(theme);
    bindShell();
    bindLogin();
    const saved = lsGet(PROFILE_KEY);
    if (saved && D.PROFILES[saved] && !D.PROFILES[saved].hidden) { App.profileKey = saved; buildShell(); }
    const { path } = parseHash();
    // Entrar por um link direto de outro perfil leva primeiro à seleção
    const prof = path.split("/")[0];
    if (!lsGet(SESSION_KEY)) { if (path !== "login") location.hash = "#/login"; } // sem login, tudo começa pelo login
    else if (!App.profileKey && D.PROFILES[prof]) { /* exige escolher o perfil */ location.hash = "#/perfil"; }
    window.addEventListener("hashchange", renderRoute);
    renderRoute();
  });
})();
