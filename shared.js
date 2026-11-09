/* ============================================================
   Partes compartilhadas entre perfis: tabela da carteira,
   pendências por contrato, ficha do contrato com abas (12.7),
   prontidão de itens (7.4) e revisão de versão por aditivo (7.5).
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  const { esc, icon, pill, lpill, tipoTag, D } = A;

  /* ---------------- Pendências de um contrato ---------------- */
  function pendenciasContrato(cid) {
    const S = A.state;
    const out = [];
    const c = A.getContrato(cid);
    if (c.cadastro !== "conferido") out.push({ ic: "fact_check", tone: "warning", texto: "Cadastro em conferência: dados extraídos do SEI ainda são sugestões.", tipo: "Cadastro" });
    if (!A.designacoesAtivas(cid).length && !A.respManual(cid)) out.push({ ic: "person_off", tone: "danger", texto: "Sem gestor ou fiscal designado.", tipo: "Designação" });
    A.docsDo(cid).filter((d) => d.conferencia === "pendente").forEach((d) => out.push({ ic: "description", tone: "warning", texto: `Documento pendente de conferência: SEI ${d.sei} — ${d.titulo}`, tipo: "Documento" }));
    // Obrigações, itens e tratativas da fiscalização ficam para a fase 2 (reuniões de 05/11/2026)
    void S;
    const sit = A.situacaoContratual(c);
    if (sit.key === "vencendo") out.push({ ic: "event_busy", tone: "danger", texto: `Vigência termina em ${sit.dias} dias (${A.fmtDate(c.datas.fimVigencia)}).`, tipo: "Vencimento" });
    return out;
  }

  /* ---------------- Prontidão do item para ativação (7.4) ---------------- */
  function readiness(item) {
    const c = item.config;
    const ob = item.obrigacaoId ? A.state.obrigacoes.find((o) => o.id === item.obrigacaoId) : null;
    const esp = c.especifico || {};
    const espOk = {
      indicador: !!(esp.fonte && esp.formula && esp.meta),
      entrega: !!(esp.produto && esp.marco),
      documento: !!(esp.tipoDoc && esp.validade && esp.antecedencia),
      fiscalizacao: !!esp.checklist,
    }[item.tipo];
    return [
      { label: "Fundamento contratual", ok: !!(ob ? ob.clausula : c.fundamentoManual) || !!item.fundamentoOk },
      { label: "Responsável que acompanha", ok: !!c.responsaveis.acompanha },
      { label: "Verificador", ok: !!c.responsaveis.verifica },
      { label: "Abrangência", ok: c.abrangencia.length > 0 },
      { label: "Período de aplicação", ok: !!c.vigencia.inicio },
      { label: "Frequência de medição", ok: !!c.freq.medicao },
      { label: "Critério de cumprimento", ok: !!c.criterio },
      { label: "Evidência exigida", ok: !!c.evidencia },
      { label: "Parâmetros do tipo", ok: !!espOk },
    ];
  }

  function readinessHtml(item) {
    const r = readiness(item);
    return `<div class="readiness"><ul>${r.map((x) => `<li>${icon(x.ok ? "check_circle" : "error", x.ok ? "ok" : "miss")}<span>${esc(x.label)}${x.ok ? "" : " — <strong>pendente</strong>"}</span></li>`).join("")}</ul></div>`;
  }

  /* ---------------- Tabela da carteira ---------------- */
  function contratoRow(c) {
    const sit = A.situacaoContratual(c);
    return {
      c, id: c.id, numero: c.numero, contratada: c.contratada, regiao: c.regiao,
      fim: c.datas.fimVigencia, vigente: c.valores.vigente, sit,
      acomp: A.acompanhamento(c.id), cadastro: c.cadastro,
      pend: pendenciasContrato(c.id), gestor: A.gestorDe(c.id), fiscal: A.fiscalDe(c.id),
      riscos: A.state.riscos.filter((r) => r.contratoId === c.id),
      fin: A.finContrato(c), origem: c.origemDados || "sei",
    };
  }
  const SEV_ORDER = { critica: 3, alta: 2, media: 1 };
  function prioridade(r) {
    return (A.radarDoContrato ? A.radarDoContrato(r.id).length * 10 : 0) + r.riscos.reduce((s, x) => s + SEV_ORDER[x.severidade] * 10, 0) + r.pend.length;
  }

  const COLS_CONTRATO = {
    contrato: { key: "numero", label: "Contrato", tdCls: "td-main", render: (r) => `<div class="cell-main">${esc(r.numero)}</div><div class="cell-sub">${esc(r.c.objeto)}</div>` },
    contratada: { key: "contratada", label: "Contratada", render: (r) => `${esc(r.contratada)}<div class="cell-sub">${esc(r.regiao)}</div>` },
    vigencia: { key: "fim", label: "Situação contratual", render: (r) => `${pill(r.sit.label, r.sit.tone)}<div class="cell-sub">${r.cadastro && r.cadastro !== "conferido" ? `Cadastro: ${esc(A.L.cadastro[r.cadastro][0].toLowerCase())}` : `Fim: ${A.fmtDate(r.fim)}`}</div>` },
    valor: { key: "vigente", label: "Valor vigente", cls: "num", render: (r) => r.vigente == null ? `<span class="muted">A conferir</span>` : A.fmtMoney(r.vigente) },
    cadastro: { key: "cadastro", label: "Cadastro", render: (r) => lpill("cadastro", r.cadastro) },
    acomp: { key: "acomp", label: "Acompanhamento", render: (r) => lpill("acomp", r.acomp) },
    pend: { key: "pendN", label: "Pendências", sortValue: (r) => r.pend.length, render: (r) => r.pend.length ? `<span class="pill ${r.pend.some((p) => p.tone === "danger") ? "danger" : "warning"} no-dot">${r.pend.length}</span>` : `<span class="pill neutral no-dot">0</span>` },
    gestor: { key: "gestor", label: "Gestor", render: (r) => esc(r.gestor) },
    /* Grade no padrão do SEI (alinhamento de 27/10/2026): colunas agrupadas para caber sem rolar */
    contratoSei: { key: "numero", label: "Contrato", tdCls: "td-main", render: (r) => `<div class="cell-main sei-num">${esc(r.numero)}</div><div class="cell-sub">${esc(r.c.objeto)}</div><div class="cell-sub">${icon("location_on", "cell-ic")}${esc(r.regiao)}</div>` },
    contratadaSei: { key: "contratada", label: "Contratado", render: (r) => `${esc(r.contratada)}<div class="cell-sub origem-${r.origem}">${icon(r.origem === "manual" ? "edit_note" : "cloud_done", "cell-ic")}${esc(A.ORIGEM_DADOS[r.origem][0])}</div>` },
    responsaveis: { key: "gestor", label: "Gestor e fiscal", render: (r) => `${r.gestor === "Não designado" ? `<span class="muted">não identificado</span>` : esc(r.gestor)}${!A.designacoesAtivas(r.id).length && A.respManual(r.id) ? `<div class="cell-sub">${icon("edit_note", "cell-ic")}informado pela GCR</div>` : ""}<div class="cell-sub">Fiscal: ${r.fiscal ? esc(r.fiscal) : "não identificado"}</div>` },
    vigenciaSei: { key: "fim", label: "Vigência", sortValue: (r) => r.fim, render: (r) => `${pill(r.sit.label, r.sit.tone, "sm")}<div class="cell-sub nowrap">${A.fmtDate(r.c.datas.inicioVigencia)} a ${A.fmtDate(r.fim)}</div><div class="cell-sub">${r.cadastro !== "conferido" ? `Cadastro: ${esc(A.L.cadastro[r.cadastro][0].toLowerCase())}` : esc(A.prazoVigencia(r.fim))}</div>` },
    total: { key: "total", label: "Valor total", cls: "num", sortValue: (r) => r.fin.total, render: (r) => r.fin.total == null ? `<span class="muted">A conferir</span><div class="cell-sub">inicial ${A.fmtMoney0(r.fin.inicial)}</div>` : `${A.fmtMoney0(r.fin.total)}<div class="cell-sub">${r.fin.total !== r.fin.inicial ? `inicial ${A.fmtMoney0(r.fin.inicial)}` : "sem aditivo de valor"}</div>` },
    executado: { key: "exec", label: "Valor executado", cls: "num", sortValue: (r) => r.fin.executado, render: (r) => r.fin.notas.length ? `${A.fmtMoney0(r.fin.executado)}<div class="cell-sub">${r.fin.notas.length} nota(s)</div>` : `<span class="muted">sem nota lançada</span>` },
    saldo: { key: "saldo", label: "Saldo", cls: "num", sortValue: (r) => r.fin.saldo, render: (r) => r.fin.saldo == null ? `<span class="muted">não identificado</span>` : `<strong>${A.fmtMoney0(r.fin.saldo)}</strong><div class="exec-bar" title="${r.fin.pct}% executado"><i style="width:${Math.min(100, r.fin.pct)}%" class="${r.fin.pct >= 90 ? "is-high" : ""}"></i></div><div class="cell-sub">${r.fin.pct}% executado</div>` },
    contratoSeiAcomp: { key: "numero", label: "Contrato", tdCls: "td-main", render: (r) => `<div class="cell-main sei-num">${esc(r.numero)}</div><div class="cell-sub">${esc(r.c.objeto)}</div><div class="cell-sub">${icon("location_on", "cell-ic")}${esc(r.regiao)}</div><div style="margin-top:4px">${lpill("acomp", r.acomp, "sm")}</div>` },
    prioridade: { key: "prio", label: "Prioridade", sortValue: prioridade, render: (r) => { const top = r.riscos.sort((a, b) => SEV_ORDER[b.severidade] - SEV_ORDER[a.severidade])[0]; return top ? lpill("sev", top.severidade) : `<span class="muted">—</span>`; } },
  };

  /* ---------------- Ficha do contrato (Superintendência e Gestor/Fiscal) ---------------- */
  /* Abas enxutas da 1ª versão (05/11/2026). Obrigações e itens e Pendências (P2) saíram; alertas ficam na Visão geral. */
  const TABS = [
    ["visao", "Visão geral", "dashboard"],
    ["financeiro", "Financeiro", "account_balance_wallet"],
    ["ois", "OIS", "assignment"],
    ["instrumentos", "Documentos e fontes", "folder_open"],
    ["responsaveis", "Responsáveis", "groups"],
    ["historico", "Histórico", "history"],
  ];

  function fichaContrato(base, cid, tab) {
    const c = A.getContrato(cid);
    const prof = A.profileKey;
    if (!c || !A.podeVerContrato(cid)) {
      return {
        title: "Contrato não encontrado", nav: prof + "/contratos",
        crumbs: [{ label: "Contratos" }],
        html: `<div class="section">${A.stateBox("search_off", "Contrato não encontrado", "O endereço não corresponde a nenhum contrato da carteira da DSC.", `<a class="btn primary" href="#/${prof}/contratos">Voltar para Contratos</a>`)}</div>`,
      };
    }
    tab = TABS.some((t) => t[0] === tab) ? tab : "visao";
    const sit = A.situacaoContratual(c);
    const pend = pendenciasContrato(cid);
    const readOnly = prof === "super";
    const nRadar = A.radarDoContrato(cid).filter((x) => x.grupo !== "sobrestado").length;
    const gestor = A.gestorDe(cid);
    const action = `<a class="btn outline" href="#/${prof}/caixa?contrato=${cid}&sit=">${icon("inbox")}Entradas na Caixa DSC</a>`;

    const head = `
      <div class="contract-head">
        <div>
          <span class="kicker">${esc(c.contratada)} · CNPJ ${esc(c.cnpj)}</span>
          <h2>${esc(c.numero)} <span style="font-weight:500;color:var(--muted);font-size:17px">${esc(c.objeto)}</span></h2>
          <div class="contract-head-meta">
            <span>${icon("event")}Vigência ${A.fmtDate(c.datas.inicioVigencia)} a ${A.fmtDate(c.datas.fimVigencia)}</span>
            <span>${icon("location_on")}${esc(c.regiao)}</span>
            <span class="origem-${c.origemDados || "sei"}">${icon(c.origemDados === "manual" ? "edit_note" : "cloud_done")}Origem: ${esc(A.ORIGEM_DADOS[c.origemDados || "sei"][0])}</span>
          </div>
          <div class="status-dims">
            <div class="status-dim"><span>Cadastro</span>${lpill("cadastro", c.cadastro)}</div>
            <div class="status-dim"><span>Situação contratual</span>${pill(sit.label, sit.tone)}</div>
            <div class="status-dim"><span>Gestor</span>${gestor === "Não designado" ? pill("Não identificado", "danger") : pill(gestor, "neutral")}</div>
            <div class="status-dim"><span>Radar</span>${nRadar ? pill(nRadar + (nRadar === 1 ? " exceção" : " exceções"), "danger") : pill("Sem exceções", "success")}</div>
          </div>
        </div>
        <div class="page-actions">${readOnly ? `<span class="pill outline no-dot has-icon">${icon("visibility")}Acesso de consulta</span>` : ""}${action}</div>
      </div>`;

    const nOis = A.oisDo(cid).filter((o) => A.oisSemLastro(o) || A.oisAtraso(o)).length;
    const tabs = `<div class="tabs" role="tablist">${TABS.map(([k, l, ic]) => `<a class="tab ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" href="#/${base}/${cid}/${k}">${icon(ic)}${l}${k === "ois" && nOis ? ` <span class="count">${nOis}</span>` : ""}</a>`).join("")}</div>`;

    const body = { visao: tabVisao, financeiro: tabFinanceiro, ois: tabOis, instrumentos: tabInstrumentos, responsaveis: tabResponsaveis, historico: tabHistorico }[tab](c, { readOnly, pend, base });

    return {
      title: "Ficha do contrato", nav: prof + "/contratos",
      crumbs: [{ label: "Contratos", href: `#/${prof}/contratos` }, { label: c.numero }],
      html: `${head}<div class="section">${tabs}<div id="tabBody">${body.html}</div></div>`,
      mount(root) {
        if (body.mount) body.mount(root.querySelector("#tabBody"));
      },
    };
  }

  /* Valores do contrato em destaque: inicial, total atualizado pelos aditivos, executado e saldo */
  function valoresContrato(c) {
    const f = A.finContrato(c);
    return `<div class="money-split contract-values">
      <div class="money-box"><span>Valor inicial</span><strong>${A.fmtMoney(f.inicial)}</strong><span>Assinatura do contrato</span></div>
      <div class="money-box"><span>Valor total atualizado</span><strong>${f.total == null ? pill("A conferir", "pending") : A.fmtMoney(f.total)}</strong><span>${f.total != null && f.total !== f.inicial ? `${f.total > f.inicial ? "+" : ""}${A.fmtMoney(f.total - f.inicial)} por aditivo` : "Sem aditivo de valor"}</span></div>
      <div class="money-box"><span>Valor executado</span><strong>${A.fmtMoney(f.executado)}</strong><span>${f.notas.length ? `${f.notas.length} nota(s) de cobrança` : "Nenhuma nota lançada"}</span></div>
      <div class="money-box is-saldo"><span>Saldo do contrato</span><strong>${f.saldo == null ? pill("Não identificado", "nodata") : A.fmtMoney(f.saldo)}</strong>${f.pct != null ? `<div class="exec-bar wide"><i style="width:${Math.min(100, f.pct)}%" class="${f.pct >= 90 ? "is-high" : ""}"></i></div><span>${f.pct}% do valor total executado</span>` : "<span>Depende do valor total conferido</span>"}</div>
    </div>`;
  }

  /* Aba Financeiro: execução mês a mês pelas notas de cobrança (pagamento simulado) */
  function tabFinanceiro(c) {
    const f = A.finContrato(c);
    const prazoAteste = (n) => A.compAdd(n.comp, 1) + "-15";
    const sitNota = (n) => n.situacao === "paga" ? ["Paga", "success"] : prazoAteste(n) < D.TODAY ? ["Ateste vencido", "danger"] : ["Em ateste", "warning"];
    const ult = f.notas.slice(-12);
    const max = Math.max(1, ...ult.map((n) => n.valor));
    const mensal = c.valores.vigente ? c.valores.vigente / c.valores.mesesVigencia : null;
    return {
      html: `
        ${valoresContrato(c)}
        <div class="grid-2" style="margin-top:16px">
          <div class="panel flat">
            ${A.sectionTitle("Execução mês a mês", { icon: "bar_chart", sub: mensal ? `Últimas ${ult.length} competências · parcela mensal prevista ${A.fmtMoney0(mensal)}` : "Sem valor total conferido" })}
            ${ult.length ? `<div class="vbar-chart">${ult.map((n) => { const st = sitNota(n); return `<div class="vbar" title="${A.fmtComp(n.comp)} · ${A.fmtMoney(n.valor)} · ${st[0]}"><span class="vbar-fill ${st[1]}" style="height:${Math.round((n.valor / max) * 100)}%"></span><span class="vbar-label">${A.fmtComp(n.comp).split("/")[0]}</span></div>`; }).join("")}</div>
            <div class="chart-legend"><span><i class="lg success"></i>Paga</span><span><i class="lg warning"></i>Em ateste</span><span><i class="lg danger"></i>Ateste vencido</span></div>` : A.emptyState({ icon: "receipt_long", title: "Nenhuma nota lançada", desc: "A execução começa a aparecer com a primeira nota de cobrança." })}
          </div>
          <div class="panel flat">
            ${A.sectionTitle("Cobrança e pagamento", { icon: "receipt_long", sub: "Situação das notas de cobrança do contrato" })}
            <dl class="kv cols-2">
              <div><dt>Notas pagas</dt><dd>${f.notas.filter((n) => n.situacao === "paga").length}</dd></div>
              <div><dt>Em ateste</dt><dd>${f.notas.filter((n) => n.situacao !== "paga").length}</dd></div>
              <div><dt>Última competência</dt><dd>${ult.length ? A.fmtComp(ult[ult.length - 1].comp) : "—"}</dd></div>
            </dl>
            <div class="callout" style="margin-top:12px">${icon("info")}<div>Notas e pagamentos simulados. No ambiente real virão do processo de pagamento vinculado no SEI. Medições, glosas e descontos ficam para a próxima fase.</div></div>
          </div>
        </div>
        <div style="margin-top:16px">${A.sectionTitle("Notas de cobrança", { icon: "request_quote" })}<div id="tNotas"></div></div>`,
      mount(root) {
        A.mountTable(root.querySelector("#tNotas"), {
          caption: "notas fiscais",
          rows: f.notas.slice().reverse().map((n) => ({ ...n, liquido: n.valor - (n.glosa || 0), st: sitNota(n) })), sortKey: "comp", sortDir: -1,
          empty: { icon: "receipt_long", title: "Nenhuma nota de cobrança", desc: "Contrato ainda sem execução faturada." },
          cols: [
            { key: "comp", label: "Competência", render: (n) => A.fmtComp(n.comp) },
            { key: "nf", label: "Nota fiscal", render: (n) => esc(n.nf) },
            { key: "valor", label: "Valor cobrado", cls: "num", render: (n) => A.fmtMoney(n.valor) },
            { key: "situacao", label: "Situação", render: (n) => pill(n.st[0], n.st[1]) },
          ],
        });
      },
    };
  }

  /* Linha do tempo do contrato (modelo mostrado na chamada de 05/11/2026): realizado e previsto separados */
  function eventosContrato(c) {
    const ev = [];
    const hoje = D.TODAY;
    const push = (d, t, tipo, extra = {}) => d && ev.push({ d, t, tipo, prev: d > hoje, ...extra });
    push(c.datas.assinatura, "Assinatura do contrato", "marco");
    push(c.datas.inicioVigencia, "Início da vigência", "marco");
    A.docsDo(c.id).filter((d) => d.tipo === "Termo aditivo").forEach((d) => push(d.data, d.titulo, "aditivo"));
    A.state.aditivos.filter((a) => a.contratoId === c.id && a.situacao === "proposto").forEach((a) => push(a.data, a.titulo + " (proposto)", "aditivo", { proposto: true }));
    A.oisDo(c.id).forEach((o) => push(o.etapas.emissao, `${o.numero} emitida`, "ois", { alerta: A.oisSemLastro(o) }));
    A.state.reajustes.filter((r) => r.contratoId === c.id).forEach((r) => push(r.dataBase, `${r.tipo}: data-base (${r.indice})`, "reajuste"));
    push(c.datas.fimVigencia, "Fim da vigência", "fim");
    return ev.sort((a, b) => (a.d < b.d ? -1 : 1));
  }
  function linhaDoTempo(c) {
    const ev = eventosContrato(c);
    if (!ev.length) return A.emptyState({ icon: "timeline", title: "Sem datas identificadas" });
    const ms = (d) => A.parseDate(d).getTime();
    const min = ms(ev[0].d), max = Math.max(ms(ev[ev.length - 1].d), ms(D.TODAY));
    const pos = (d) => (max === min ? 0 : ((ms(d) - min) / (max - min)) * 100);
    const anos = [];
    for (let y = A.parseDate(ev[0].d).getFullYear() + 1; y <= new Date(max).getFullYear(); y++) anos.push(y);
    const IC = { marco: "flag", aditivo: "post_add", ois: "assignment", reajuste: "trending_up", fim: "event_busy" };
    return `<div class="ctl" role="img" aria-label="Linha do tempo do contrato">
        <div class="ctl-track"></div>
        ${anos.map((y) => `<span class="ctl-year" style="left:${pos(y + "-01-01")}%">${y}</span>`).join("")}
        <span class="ctl-today" style="left:${pos(D.TODAY)}%"><small>Hoje</small></span>
        ${ev.map((e) => `<span class="ctl-dot is-${e.tipo} ${e.prev ? "is-prev" : ""} ${e.alerta ? "is-alert" : ""} ${e.proposto ? "is-prev" : ""}" style="left:${pos(e.d)}%" tabindex="0" data-tip="${A.fmtDate(e.d)} · ${esc(e.t)}${e.prev ? " (previsto)" : ""}">${icon(IC[e.tipo])}</span>`).join("")}
      </div>
      <div class="chart-legend"><span><i class="lg primary"></i>Realizado</span><span><i class="lg hollow"></i>Previsto ou proposto</span><span><i class="lg danger"></i>Exceção</span><span>Passe o mouse para ver cada evento</span></div>
      <ul class="ctl-list" hidden>${ev.map((e) => `<li class="${e.prev ? "is-prev" : ""}"><span class="nowrap">${A.fmtDate(e.d)}</span>${icon(IC[e.tipo], "cell-ic")}<span>${esc(e.t)}${e.prev ? ` ${pill("Previsto", "outline", "sm")}` : ""}${e.alerta ? ` ${pill("Sem cobertura contratual", "danger", "sm")}` : ""}</span></li>`).join("")}</ul>`;
  }

  /* Prazos do contrato: vigência, entradas da caixa, OIS em aberto, aditivos e reajustes */
  function prazosContrato(c) {
    const out = [];
    const sit = A.situacaoContratual(c);
    if (c.datas.fimVigencia) out.push({ d: c.datas.fimVigencia, t: "Fim da vigência", s: A.prazoVigencia(c.datas.fimVigencia), tone: sit.key === "vencendo" || sit.key === "encerrado" ? "danger" : "", ic: "event_busy" });
    A.state.caixa.filter((e) => e.contratoId === c.id && A.cxAberta(e) && e.prazo).forEach((e) => out.push({ d: e.prazo.data, t: e.assunto, s: `${A.L.prazoTipo[e.prazo.tipo][0]} · ${e.prazo.regra}`, tone: A.cxVencida(e) ? "danger" : "warning", ic: "inbox", cx: e.id }));
    A.oisDo(c.id).filter((o) => A.oisEtapa(o).idx < A.OIS_ETAPAS.length && A.oisEtapa(o).key !== "execucao").forEach((o) => out.push({ d: A.oisEtapa(o).desde || o.comp + "-01", t: `${o.numero}: ${A.oisEtapa(o).label.toLowerCase()} pendente`, s: o.aguardando ? "Aguardando " + o.aguardando : "Competência " + A.fmtComp(o.comp), tone: A.oisAtraso(o) || A.oisSemLastro(o) ? "danger" : "", ic: "assignment" }));
    A.state.reajustes.filter((r) => r.contratoId === c.id && r.situacao !== "aplicado").forEach((r) => out.push({ d: r.dataBase, t: `${r.tipo} (${A.L.reajuste[r.situacao][0].toLowerCase()})`, s: r.texto, tone: r.situacao === "solicitado" ? "warning" : "", ic: "trending_up" }));
    return out.sort((a, b) => (a.d < b.d ? -1 : 1));
  }

  function tabVisao(c, { base }) {
    const f = A.finContrato(c);
    const prof = base.split("/")[0];
    const radar = A.radarDoContrato(c.id);
    const cxAbertas = A.state.caixa.filter((e) => e.contratoId === c.id && A.cxAberta(e));
    const oisAbertas = A.oisDo(c.id).filter((o) => A.oisEtapa(o).idx < A.OIS_ETAPAS.length);
    const gestor = A.gestorDe(c.id), fiscal = A.fiscalDe(c.id);
    const sit = A.situacaoContratual(c);
    const prazos = prazosContrato(c);
    const aditivos = A.docsDo(c.id).filter((d) => d.tipo === "Termo aditivo");
    return {
      html: `
      <div class="ficha-resumo">
        <strong>${sit.key === "encerrado" ? `Vigência encerrada em ${A.fmtDate(c.datas.fimVigencia)} (há ${-A.daysUntil(c.datas.fimVigencia)} dias).` : `Vigência até ${A.fmtDate(c.datas.fimVigencia)} (${A.prazoVigencia(c.datas.fimVigencia)}).`}</strong>
        Valor original ${A.fmtMoney(f.inicial)} · total ${f.total == null ? "a conferir" : A.fmtMoney(f.total)} (original + aditivos).
        Executado: ${f.notas.length ? A.fmtMoney(f.executado) : "sem nota lançada"} · saldo: ${f.saldo == null ? "não identificado" : A.fmtMoney(f.saldo)}.
        Gestor: ${gestor === "Não designado" ? "não identificado" : esc(gestor)} · Fiscal: ${fiscal ? esc(fiscal) : "não identificado"}.
        ${radar.length} exceção(ões) no Radar · ${cxAbertas.length} entrada(s) aberta(s) na caixa · ${oisAbertas.length} OIS em aberto.
        <div class="cell-sub" style="margin-top:6px">Processos: ${c.processos.map((p) => `${A.procLink(p.numero, c.id)} (${esc(p.papel)})`).join(" · ")}</div>
      </div>

      <div class="panel flat" style="margin-top:16px">
        ${A.sectionTitle("Linha do tempo", { icon: "timeline", sub: "Assinatura, vigência, aditivos, OIS e reajustes. Realizados com evidência e previstos separados.", right: `<div class="segmented" role="group" aria-label="Formato"><button type="button" class="active" data-ctl="g">${icon("timeline")}Gráfico</button><button type="button" data-ctl="l">${icon("list")}Lista</button></div>` })}
        ${linhaDoTempo(c)}
      </div>

      <div class="grid-2" style="margin-top:16px">
        <div class="panel flat">
          ${A.sectionTitle("Prazos", { icon: "event", sub: "Vigência, caixa DSC, OIS e reajustes, por data" })}
          ${prazos.length ? `<div class="list">${prazos.map((x) => `<${x.cx ? `button type="button" class="list-item list-btn" data-cx="${x.cx}"` : `div class="list-item"`} style="grid-template-columns:auto 1fr auto"><span class="list-icon ${x.tone}">${icon(x.ic)}</span><div><div class="list-title">${esc(x.t)}</div><div class="list-desc">${esc(x.s)}</div></div><span class="nowrap cell-sub ${x.tone === "danger" ? "txt-danger" : ""}">${A.fmtDate(x.d)}</span></${x.cx ? "button" : "div"}>`).join("")}</div>` : A.emptyState({ icon: "event_available", title: "Nenhum prazo em aberto" })}
        </div>
        <div class="panel flat">
          ${A.sectionTitle("Alertas", { icon: "radar", sub: "Exceções do Radar para este contrato", right: `<a class="more-link" href="#/${prof}/radar">Abrir o Radar</a>` })}
          ${radar.length ? `<div class="list">${radar.map((x, i) => `<button type="button" class="list-item list-btn" data-rd="${i}" style="grid-template-columns:1fr"><div>${A.grupoTag(x.grupo)}<div class="list-title" style="margin-top:6px">${esc(x.motivo)}</div><div class="list-desc">${icon("subdirectory_arrow_right", "cell-ic")}${esc(x.proxima)} · Responsável: ${x.responsavel ? esc(x.responsavel) : "não identificado"}</div></div></button>`).join("")}</div>` : A.emptyState({ icon: "verified_user", title: "Sem exceções", desc: "Nada fora do normal para este contrato." })}
        </div>
      </div>

      <div class="grid-main-side" style="margin-top:16px">
        <div class="panel flat">
          ${A.sectionTitle("Identificação e valores", { icon: "badge" })}
          <dl class="kv">
            <div><dt>Objeto</dt><dd>${esc(c.objetoLongo)}</dd></div>
            <div><dt>Contratada</dt><dd>${esc(c.contratada)}<div class="cell-sub">CNPJ ${esc(c.cnpj)}</div></dd></div>
            <div><dt>Alterações confirmadas</dt><dd>${aditivos.length ? aditivos.map((d) => esc(d.titulo.split("—")[0].trim())).join(", ") : "Nenhuma"}</dd></div>
            <div><dt>Datas</dt><dd>Assinatura ${c.datas.assinatura ? A.fmtDate(c.datas.assinatura) : "não disponível"} · início da execução ${c.datas.inicioExecucao ? A.fmtDate(c.datas.inicioExecucao) : "pendente de conferência"} · vigência ${A.fmtDate(c.datas.inicioVigencia)} a ${A.fmtDate(c.datas.fimVigencia)}</dd></div>
          </dl>
          ${valoresContrato(c)}
        </div>
        <div class="stack">
          <div class="panel flat">
            ${A.sectionTitle("Qualidade da informação", { icon: "verified" })}
            <dl class="kv cols-2">
              <div><dt>Origem</dt><dd>${esc(c.qualidade.origem)}</dd></div>
              <div><dt>Última consulta ao SEI</dt><dd>${A.fmtDateTime(c.qualidade.consulta)}</dd></div>
              <div><dt>Cadastro</dt><dd>${lpill("cadastro", c.cadastro)}</dd></div>
              <div><dt>Dados a validar</dt><dd>${c.qualidade.pendencias}</dd></div>
            </dl>
          </div>
          <div class="panel flat">
            ${A.sectionTitle("Abrangência", { icon: "location_on" })}
            ${c.postos.length ? `<div class="list">${c.postos.map((p) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon("storefront")}</span><div><div class="list-title">${esc(A.getPosto(p.id).nome)}</div><div class="list-desc">${esc(A.getPosto(p.id).regiao)} · desde ${A.fmtDate(p.desde)}</div></div>${p.pendente ? pill("A partir de " + A.fmtDate(p.desde), "pending") : pill("Ativo", "success")}</div>`).join("")}</div>` : A.emptyState({ icon: "location_off", title: "Sem postos vinculados", desc: "Contrato sem abrangência física cadastrada." })}
            <div class="cell-sub" style="margin-top:10px">Serviços: ${esc(c.servicos.join(", ") || "—")}</div>
          </div>
        </div>
      </div>`,
      mount(root) {
        root.querySelectorAll("[data-ctl]").forEach((b) => b.addEventListener("click", () => {
          root.querySelectorAll("[data-ctl]").forEach((x) => x.classList.toggle("active", x === b));
          const lista = b.dataset.ctl === "l";
          root.querySelector(".ctl").hidden = lista;
          root.querySelector(".ctl-list").hidden = !lista;
          root.querySelector(".ctl + .chart-legend").hidden = lista;
        }));
        root.querySelectorAll("[data-cx]").forEach((b) => b.addEventListener("click", () => A.openCaixa(b.dataset.cx, () => A.renderRoute())));
        root.querySelectorAll("[data-rd]").forEach((b) => b.addEventListener("click", () => A.openRadar(radar[+b.dataset.rd], () => A.renderRoute())));
      },
    };
  }

  /* Aba OIS: uma OIS, um identificador; sem medição e pagamento nesta versão */
  function tabOis(c) {
    const lista = A.oisDo(c.id);
    return {
      html: `${c.ois ? `<div class="panel flat" style="margin-bottom:16px">${A.sectionTitle("OIS do mês", { icon: "calendar_month", sub: "Sem OIS no mês, o contrato pode estar parado ou com pendência." })}${A.oisMesCards([c])}</div>` : `<div class="callout" style="margin-bottom:16px">${icon("info")}<div>Este contrato não é executado por OIS mensal.</div></div>`}
        ${A.sectionTitle("OIS do contrato", { icon: "assignment", sub: "Solicitação → emissão → assinatura → execução → aceite. Medição e pagamento ficam para a próxima fase." })}
        <div id="tOisCt"></div>`,
      mount(root) {
        const t = A.mountTable(root.querySelector("#tOisCt"), {
          caption: "OIS", rows: lista, sortKey: "comp", sortDir: -1,
          empty: { icon: "assignment", title: "Nenhuma OIS localizada", desc: "Nenhuma OIS foi encontrada nos processos vinculados a este contrato." },
          cols: [
            { key: "numero", label: "OIS", tdCls: "td-main", render: (o) => `<div class="cell-main">${esc(o.numero)}</div><div class="cell-sub">SEI ${esc(o.sei)} · ${esc(o.objeto)}</div>` },
            { key: "comp", label: "Competência", render: (o) => A.fmtComp(o.comp) },
            { key: "etapas", label: "Etapas", sortable: false, render: (o) => A.oisStepsHtml(o, true) },
            { key: "etapa", label: "Etapa atual", sortValue: (o) => A.oisEtapa(o).idx, render: (o) => esc(A.oisEtapa(o).label) },
            { key: "alerta", label: "Alerta", sortable: false, render: (o) => (A.oisSemLastro(o) ? pill("Sem cobertura contratual", "danger", "sm") : A.oisAtraso(o) ? pill(A.oisAtraso(o).texto, "warning", "sm") : `<span class="muted">—</span>`) },
          ],
          onRow: (o) => A.openOis(o.id, () => t.render()),
        });
      },
    };
  }

  /* Árvore do processo no padrão do SEI: pasta amarela por processo e documentos com o número SEI entre parênteses */
  const DOC_ICON = { Contrato: "contract", Anexo: "attach_file", "Termo aditivo": "edit_document", "Ofício": "mail", OIS: "assignment", Minuta: "draft", "Nota fiscal": "receipt_long", "Relatório": "summarize", Portaria: "gavel" };
  function arvoreProcessos(c, docs) {
    return `<div class="sei-tree">${c.processos.map((p, i) => {
      const ds = docs.filter((d) => d.processo === p.numero).sort((a, b) => a.data.localeCompare(b.data));
      return `<details class="sei-tree-proc" data-proc="${esc(p.numero)}" ${i === 0 ? "open" : ""}>
        <summary>${icon("chevron_right", "sei-tree-caret")}<span class="sei-tree-folder">${icon("folder_open")}</span>${A.procLink(p.numero)}<span class="cell-sub">${esc(p.papel)}</span></summary>
        ${ds.length ? `<ul>${ds.map((d) => `<li>${d.restrito
          ? `<span class="sei-tree-doc is-restrito" tabindex="0" data-tip="Acesso restrito no SEI">${icon("lock")}<span>${esc(d.titulo)} <span class="sei-tree-num">(${esc(d.sei)})</span></span></span>`
          : `<button type="button" class="sei-tree-doc" data-open="${d.id}">${icon(DOC_ICON[d.tipo] || "description")}<span>${esc(d.titulo)} <span class="sei-tree-num">(${esc(d.sei)})</span></span></button>`}${d.conferencia === "pendente" ? `<span class="sei-tree-flag" data-tip="Pendente de conferência" tabindex="0"></span>` : ""}</li>`).join("")}</ul>` : `<p class="sei-tree-empty">Nenhum documento deste contrato no processo.</p>`}
      </details>`;
    }).join("")}</div>`;
  }

  const FONTES = { Contrato: "contrato", "Termo aditivo": "termo aditivo", Portaria: "portaria de designação", OIS: "OIS", Minuta: "minuta" };
  function tabInstrumentos(c, { readOnly }) {
    const docs = A.docsDo(c.id);
    const fontes = docs.filter((d) => FONTES[d.tipo]).sort((a, b) => (a.data < b.data ? 1 : -1));
    const cats = [...new Set(docs.map((d) => d.tipo))];
    return {
      html: `
        <div class="grid-main-side">
          <div class="panel flat">
            ${A.sectionTitle("Fontes confirmadas", { icon: "fact_check", sub: "Documentos do SEI que sustentam os dados da ficha. Cada documento é lido uma vez; um documento novo gera nova leitura." })}
            ${fontes.length ? `<div class="list">${fontes.map((d) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon(DOC_ICON[d.tipo] || "description")}</span><div><div class="list-title">SEI nº ${esc(d.sei)} · ${esc(d.titulo)}</div><div class="list-desc">lido como ${esc(FONTES[d.tipo])} · ${d.conferencia === "conferido" ? `revisado em ${A.fmtDateTime(c.qualidade.consulta)}` : "aguardando revisão"}</div></div>${lpill("conf", d.conferencia, "sm")}</div>`).join("")}</div>` : A.emptyState({ icon: "description", title: "Nenhuma fonte lida", desc: "Nenhum documento deste contrato foi lido no SEI." })}
          </div>
          <div class="panel flat">
            ${A.sectionTitle("Por categoria", { icon: "category", sub: "Sem precisar abrir a árvore do processo" })}
            <div class="list">${cats.map((t) => `<button type="button" class="list-item list-btn" data-cat="${esc(t)}" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon(DOC_ICON[t] || "description")}</span><div class="list-title">${esc(t)}</div><span class="pill neutral no-dot">${docs.filter((d) => d.tipo === t).length}</span></button>`).join("")}</div>
          </div>
        </div>
        <div style="height:16px"></div>
        ${A.sectionTitle("Documentos do processo", { icon: "description", sub: "Informações extraídas são sugestões até a conferência. A visão da carteira não amplia o acesso a documentos restritos." })}
        <div class="filters-grid">${A.selectField("fTipoDoc", "Categoria", [["", "Todas"], ...cats.map((t) => [t, t])], "")}${A.selectField("fConf", "Conferência", [["", "Todas"], ["conferido", "Conferido"], ["pendente", "Pendente de conferência"]], "")}</div>
        <div id="tDocs"></div>
        <div style="height:16px"></div>
        ${A.sectionTitle("Processos SEI vinculados", { icon: "folder", sub: "Um contrato pode ter vários processos; o número do processo, sozinho, não identifica o instrumento.", right: readOnly ? "" : `<button class="btn outline sm" type="button" data-act="vincular">${icon("add_link")}Vincular processo</button>` })}
        <div class="proc-layout">
          <div class="panel flat sei-tree-panel">
            <div class="sei-tree-head">${icon("account_tree")}Árvore do processo</div>
            ${arvoreProcessos(c, docs)}
            <div class="sei-tree-legend"><span><i class="is-novo"></i>Não visualizado</span><span><i></i>Visualizado</span><span><i class="is-flag"></i>A conferir</span></div>
          </div>
          <div id="tProc"></div>
        </div>`,
      mount(root) {
        function abrirRefSei(id) {
          const d = A.getDoc(id);
          A.marcarProcVisto(d.processo);
          A.openModal({ kicker: "Referência ao SEI", title: d.titulo, subtitle: `SEI ${d.sei} · Processo ${d.processo}`, body: `<div class="callout">${icon("info")}<div>No ambiente real, este atalho abriria o documento no SEI respeitando as permissões do usuário lá. Neste protótipo a consulta é simulada.</div></div><dl class="kv cols-2"><div><dt>Tipo</dt><dd>${esc(d.tipo)}</dd></div><div><dt>Data</dt><dd>${A.fmtDate(d.data)}</dd></div><div><dt>Assinatura</dt><dd>${lpill("assin", d.assinatura)}</dd></div><div><dt>Conferência</dt><dd>${lpill("conf", d.conferencia)}</dd></div></dl>` });
        }
        root.querySelectorAll(".sei-tree [data-open]").forEach((b) => b.addEventListener("click", () => abrirRefSei(b.dataset.open)));
        // Abrir a pasta conta como visualizar o processo (o evento "toggle" também dispara na carga, por isso o clique)
        root.querySelectorAll(".sei-tree-proc > summary").forEach((sm) => sm.addEventListener("click", () => A.marcarProcVisto(sm.parentElement.dataset.proc)));
        A.mountTable(root.querySelector("#tProc"), {
          caption: "processos",
          rows: c.processos, responsive: true,
          cols: [
            { key: "numero", label: "Processo", tdCls: "td-main", render: (p) => `<span class="cell-main">${A.procLink(p.numero)}</span>` },
            { key: "papel", label: "Finalidade", render: (p) => `<span class="tag info">${esc(p.papel)}</span>` },
            { key: "unidade", label: "Unidade atual", render: (p) => esc(p.unidade) },
            { key: "x", label: "Observação", sortable: false, render: () => `<span class="cell-sub">Andamento no SEI não indica, por si, avanço de entrega.</span>` },
          ],
        });
        const docTable = A.mountTable(root.querySelector("#tDocs"), {
          caption: "documentos",
          rows: () => docs.filter((d) => (!root.querySelector("#fTipoDoc").value || d.tipo === root.querySelector("#fTipoDoc").value) && (!root.querySelector("#fConf").value || d.conferencia === root.querySelector("#fConf").value)),
          sortKey: "data", sortDir: -1,
          empty: { icon: "description", title: "Nenhum documento neste filtro", desc: "Ajuste os filtros para ver outros documentos vinculados." },
          cols: [
            { key: "sei", label: "SEI", cls: "nowrap", render: (d) => `<span class="cell-main" style="display:inline-flex;align-items:center;gap:4px">${d.restrito ? icon("lock") : ""}${esc(d.sei)}</span>` },
            { key: "titulo", label: "Documento", tdCls: "td-main", render: (d) => `<div class="cell-main">${esc(d.titulo)}</div><div class="cell-sub">${esc(d.tipo)} · Processo ${esc(d.processo)}</div>` },
            { key: "data", label: "Data", cls: "nowrap", render: (d) => A.fmtDate(d.data) },
            { key: "assinatura", label: "Assinatura", render: (d) => lpill("assin", d.assinatura) },
            { key: "conferencia", label: "Conferência", render: (d) => lpill("conf", d.conferencia) },
            { key: "acoes", label: "Ações", sortable: false, cls: "col-acao", tdCls: "cell-actions-td", render: (d) => `<div class="cell-actions">${!readOnly && d.conferencia === "pendente" && !d.restrito ? A.actionIcon({ icon: "fact_check", label: "Conferir documento", attrs: `data-conf="${d.id}"` }) : ""}${d.restrito ? A.actionIcon({ static: true, icon: "lock", label: "Acesso restrito", tip: "Acesso restrito no SEI. Seu perfil na plataforma não amplia esse acesso." }) : A.actionIcon({ icon: "open_in_new", label: "Abrir referência no SEI", attrs: `data-open="${d.id}"` })}</div>` },
          ],
          afterRender(el) {
            el.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => abrirRefSei(b.dataset.open)));
            el.querySelectorAll("[data-conf]").forEach((b) => b.addEventListener("click", () => {
              const d = A.getDoc(b.dataset.conf);
              A.confirmModal({
                title: "Confirmar conferência do documento", subtitle: `SEI ${d.sei} · ${esc(d.titulo)}`,
                body: `<p>Ao conferir, você confirma que tipo, data e vínculo ao contrato estão corretos. Dados já confirmados não serão substituídos silenciosamente por novas consultas.</p>`,
                confirmLabel: "Marcar como conferido", confirmIcon: "done",
                onConfirm: () => { d.conferencia = "conferido"; A.addHistorico({ acao: "Conferência de documento", objeto: `SEI ${d.sei}`, detalhe: d.titulo, contratoId: d.contratoId }); A.toast("Documento conferido."); docTable.render(); A.refreshNav(); },
              });
            }));
          },
        });
        root.querySelectorAll("#fTipoDoc, #fConf").forEach((s) => s.addEventListener("change", () => docTable.render()));
        root.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { root.querySelector("#fTipoDoc").value = b.dataset.cat; docTable.render(); root.querySelector("#tDocs").scrollIntoView({ block: "start", behavior: "smooth" }); }));
        const vinc = root.querySelector('[data-act="vincular"]');
        if (vinc) vinc.addEventListener("click", () => {
          A.openModal({
            title: "Vincular processo SEI", subtitle: c.numero,
            body: `<div class="form-field"><label for="nProc">Número do processo</label><input class="input" id="nProc" placeholder="00000.000000/0000-00"/></div>${A.selectField("nPapel", "Finalidade", ["Contratação", "Pagamento", "Fiscalização", "Penalidade", "Outro"], "Fiscalização")}<div class="callout warning">${icon("info")}<div>O processo será consultado no SEI e você deverá confirmar quais documentos pertencem a este contrato. Um processo pode conter documentos de mais de um contrato.</div></div>`,
            actions: [{ label: "Consultar no SEI", cls: "primary", icon: "search", onClick: (l) => { const v = l.el.querySelector("#nProc").value.trim(); if (!v) { l.el.querySelector("#nProc").classList.add("is-missing"); return false; } A.toast("Consulta simulada: nenhum documento novo encontrado em " + v + ".", "info"); } }],
          });
        });
      },
    };
  }

  function tabResponsaveis(c, { readOnly }) {
    const all = D.DESIGNACOES.filter((d) => d.contratoId === c.id);
    const ativas = A.designacoesAtivas(c.id);
    const man = A.respManual(c.id);
    return {
      html: `
        ${!ativas.length ? `<div class="callout ${man ? "warning" : "danger"}" style="margin-bottom:16px">${icon(man ? "edit_note" : "person_off")}<div>${man
          ? `<strong>Responsável informado pela Equipe GCR:</strong> ${esc(man.nome)} (${esc(man.papel)}), em ${A.fmtDate(man.data)} por ${esc(A.userName(man.por))}. O contrato não traz gestor ou fiscal designado; a informação não substitui a portaria.`
          : `<strong>Sem responsável.</strong> Os documentos do contrato não trazem gestor ou fiscal com designação vigente.${readOnly ? " A Equipe GCR pode informar o responsável." : " Informe quem responde por este contrato."}`}</div></div>` : ""}
        ${A.sectionTitle("Designações", { icon: "badge", sub: "Gestor e fiscal vêm do contrato e das portarias. A atribuição de processo no SEI não comprova designação.", right: readOnly ? "" : `<button class="btn outline sm" type="button" data-act="resp">${icon("person_add")}${man ? "Alterar responsável informado" : "Informar responsável"}</button>` })}
        <div id="tDes"></div>
        <div style="height:16px"></div>
        <div class="panel flat">${A.sectionTitle("Postos e serviços", { icon: "storefront" })}
          ${c.postos.length ? `<div class="list">${c.postos.map((p) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon("storefront")}</span><div><div class="list-title">${esc(A.getPosto(p.id).nome)}</div><div class="list-desc">Aplicação desde ${A.fmtDate(p.desde)}</div></div>${p.pendente ? pill("Futuro", "pending") : pill("Ativo", "success")}</div>`).join("")}</div>` : A.emptyState({ icon: "location_off", title: "Sem postos" })}
        </div>`,
      mount(root) {
        A.mountTable(root.querySelector("#tDes"), {
          caption: "designações",
          rows: all,
          empty: { icon: "person_off", title: "Sem designações registradas", desc: "Nenhuma portaria de designação foi localizada para este contrato." },
          cols: [
            { key: "userId", label: "Pessoa", tdCls: "td-main", render: (d) => `<div class="cell-main">${esc(A.userName(d.userId))}</div><div class="cell-sub">${esc(D.USERS[d.userId].funcao)}</div>` },
            { key: "papel", label: "Atribuição", render: (d) => esc(d.papel) },
            { key: "inicio", label: "Período", render: (d) => `${A.fmtDate(d.inicio)} – ${d.fim ? A.fmtDate(d.fim) : "atual"}` },
            { key: "ativo", label: "Situação", sortValue: (d) => (!d.fim || d.fim >= D.TODAY ? 1 : 0), render: (d) => (!d.fim || d.fim >= D.TODAY ? pill("Ativa", "success") : pill("Encerrada", "neutral")) },
            { key: "origem", label: "Origem", render: (d) => `<span class="cell-sub">${esc(d.origem)}</span>` },
          ],
        });
        const b = root.querySelector('[data-act="resp"]');
        if (b) b.addEventListener("click", () => {
          A.openModal({
            kicker: c.numero, title: "Informar responsável", subtitle: "Use quando o contrato não traz gestor ou fiscal. Fica marcado como informação manual da GCR.",
            body: `<div class="form-grid">
                <div class="form-field"><label for="rmNome">Nome <span class="field-req">*</span></label><input class="input" id="rmNome" value="${esc(man ? man.nome : "")}" placeholder="Quem responde pelo contrato" /></div>
                ${A.selectField("rmPapel", "Papel", ["Gestor", "Fiscal", "Responsável pela ação"], man ? man.papel : "Gestor")}
              </div>
              <div class="callout">${icon("info")}<div>A informação aparece como “informado pela GCR” e não substitui a portaria de designação no SEI.</div></div>`,
            actions: [{ label: "Salvar", cls: "primary", icon: "save", onClick: (l) => {
              const nome = l.el.querySelector("#rmNome");
              if (!nome.value.trim()) { nome.classList.add("is-missing"); A.toast("Informe o nome.", "error"); return false; }
              A.state.respManual = A.state.respManual || {};
              A.state.respManual[c.id] = { nome: nome.value.trim(), papel: l.el.querySelector("#rmPapel").value, por: A.currentUser().id, data: D.TODAY };
              A.addHistorico({ acao: "Responsável informado", objeto: c.numero, detalhe: `${nome.value.trim()} (${l.el.querySelector("#rmPapel").value}), informado manualmente pela Equipe GCR.`, contratoId: c.id });
              A.save();
              A.toast("Responsável informado.");
              A.refreshNav();
              A.renderRoute();
            } }],
          });
        });
      },
    };
  }

  function riscoItem(r) {
    const c = A.getContrato(r.contratoId);
    return `<div class="list-item"><span class="list-icon ${r.severidade === "critica" ? "danger" : r.severidade === "alta" ? "warning" : ""}">${icon("report")}</span>
      <div><div class="list-title">${esc(r.motivo)}</div>
      <div class="list-meta"><span>${icon("description")}${esc(c.numero)}</span><span>${icon("person")}${esc(r.responsavel)}</span><span>${icon("event")}Prazo ${A.fmtDate(r.prazo)}</span></div>
      <div class="list-desc"><strong>Providência:</strong> ${esc(r.providencia)}</div></div>
      <div class="list-side">${lpill("sev", r.severidade)}</div></div>`;
  }

  function tabHistorico(c) {
    const h = A.state.historico.filter((x) => x.contratoId === c.id);
    return {
      html: `${A.sectionTitle("Histórico do contrato", { icon: "history", sub: "Mudanças em dados, regras, designações, prazos, evidências, aceites e medições. Registros confirmados não são eliminados." })}
        ${h.length ? `<ul class="timeline">${h.map(histItem).join("")}</ul>` : A.emptyState({ icon: "history", title: "Sem registros" })}`,
    };
  }

  function histItem(x) {
    const tone = /De acordo|Fechamento|Conferência/.test(x.acao) ? "success" : /Devolução|Vencimento|Retificação/.test(x.acao) ? "warning" : "";
    const ic = { "De acordo": "verified", Fechamento: "lock", Designação: "badge", Consulta: "sync", "Proposta de atualização": "difference", Devolução: "undo" }[x.acao] || "edit_note";
    return `<li><span class="tl-dot ${tone}">${icon(ic)}</span><div><div class="tl-title">${esc(x.acao)} · ${esc(x.objeto)}</div><div class="tl-meta">${A.fmtDateTime(x.data)} · ${esc(x.usuario === "sistema" ? "Sistema" : A.userName(x.usuario))} (${esc(x.funcao)})</div>${x.detalhe ? `<div class="tl-body">${esc(x.detalhe)}</div>` : ""}</div></li>`;
  }

  /* ---------------- Configuração aprovada de um item (consulta) ---------------- */
  function itemConfigHtml(item) {
    const cfg = item.config;
    const ob = item.obrigacaoId ? A.state.obrigacoes.find((o) => o.id === item.obrigacaoId) : null;
    const esp = cfg.especifico || {};
    const espRows = {
      indicador: [["Fonte", esp.fonte], ["Campo", esp.campo], ["Fórmula", esp.formula], ["Unidade", esp.unidade], ["Janela", esp.janela], ["Agregação", esp.agregacao], ["Meta", esp.meta], ["Tolerância", esp.tolerancia], ["Exceções", esp.excecoes]],
      entrega: [["Produto", esp.produto], ["Quantidade", esp.quantidade], ["Marco", esp.marco], ["Critério de aceite", esp.criterioAceite]],
      documento: [["Tipo de documento", esp.tipoDoc], ["Validade atual", esp.validade ? A.fmtDate(esp.validade) : ""], ["Antecedência de renovação", esp.antecedencia]],
      fiscalizacao: [["Checklist", esp.checklist ? D.CHECKLISTS[esp.checklist].nome + " (" + D.CHECKLISTS[esp.checklist].versao + ")" : ""], ["Evidências obrigatórias", esp.evidenciasObrigatorias]],
    }[item.tipo] || [];
    const val = (v) => (v ? esc(v) : pill("Não definido", "pending"));
    return `
      <div class="drawer-section"><h4>${icon("gavel")}Fundamento</h4>
        <dl class="kv cols-2"><div><dt>Obrigação</dt><dd>${ob ? esc(ob.descricao) : esc(item.nome)}</dd></div><div><dt>Cláusula e documento</dt><dd>${ob && ob.clausula ? esc(ob.clausula) + "<div class='cell-sub'>" + A.docSource(ob.docId) + "</div>" : pill("Sem referência identificada", "pending")}</dd></div></dl>
      </div>
      <div class="drawer-section"><h4>${icon("tune")}Configuração comum</h4>
        <dl class="kv cols-2">
          <div><dt>Descrição</dt><dd>${val(cfg.descricao)}</dd></div>
          <div><dt>Abrangência</dt><dd>${cfg.abrangencia.length ? cfg.abrangencia.map((p) => esc(A.getPosto(p).nome)).join(", ") : pill("Não definida", "pending")}</dd></div>
          <div><dt>Acompanha</dt><dd>${val(A.userName(cfg.responsaveis.acompanha))}</dd></div>
          <div><dt>Responde</dt><dd>${val(cfg.responsaveis.responde)}</dd></div>
          <div><dt>Verifica</dt><dd>${cfg.responsaveis.verifica ? esc(A.userName(cfg.responsaveis.verifica)) : pill("Não definido", "pending")}</dd></div>
          <div><dt>Vigência da configuração</dt><dd>${A.fmtComp(cfg.vigencia.inicio)} a ${cfg.vigencia.fim ? A.fmtComp(cfg.vigencia.fim) : "—"}</dd></div>
          <div><dt>Coleta</dt><dd>${val(cfg.freq.coleta)}</dd></div>
          <div><dt>Avaliação</dt><dd>${val(cfg.freq.avaliacao)}</dd></div>
          <div><dt>Medição</dt><dd>${val(cfg.freq.medicao)}</dd></div>
          <div><dt>Fechamento</dt><dd>${cfg.freq.fechamentoDias ? cfg.freq.fechamentoDias + " dias após o período" : pill("Não definido", "pending")}</dd></div>
          <div><dt>Critério de cumprimento</dt><dd>${val(cfg.criterio)}</dd></div>
          <div><dt>Evidência</dt><dd>${val(cfg.evidencia)}</dd></div>
          <div><dt>Tratativa</dt><dd>${cfg.tratativa.prazoDias ? `Prazo de ${cfg.tratativa.prazoDias} dias · ${esc(cfg.tratativa.verificacao)}` : pill("Não definida", "pending")}</dd></div>
          <div><dt>Efeito financeiro</dt><dd>${{ validada: pill("Regra validada", "success"), pendente: pill("Regra pendente", "pending"), sem_regra: pill("Sem regra financeira aplicável", "outline") }[cfg.financeiro.situacao]}${cfg.financeiro.formula ? `<div class="formula" style="margin-top:6px">${esc(cfg.financeiro.formula)}</div><div class="cell-sub">${esc(cfg.financeiro.fundamento)}</div>` : ""}</dd></div>
        </dl>
      </div>
      <div class="drawer-section"><h4>${icon(L_tipoIcon(item.tipo))}Parâmetros de ${esc((A.L.tipo[item.tipo] || [item.tipo])[0].toLowerCase())}</h4>
        <dl class="kv cols-2">${espRows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${val(v)}</dd></div>`).join("")}</dl>
      </div>`;
  }
  const L_tipoIcon = (t) => (A.L.tipo[t] || ["", "tune"])[1];
  function finCfgPill(sit) {
    return { validada: pill("Regra validada", "success"), pendente: pill("Regra pendente", "pending"), sem_regra: pill("Sem regra financeira", "outline") }[sit] || pill("—", "neutral");
  }

  function openItemConfig(itemId) {
    const item = A.getItem(itemId);
    const c = A.getContrato(item.contratoId);
    A.openDrawer({
      kicker: c.numero + " · Versão " + item.versao,
      title: item.nome,
      subtitle: (A.L.item[item.status] || [item.status])[0],
      body: `
        ${item.status === "ativo_sem_financeiro" ? `<div class="callout warning">${icon("info")}<div><strong>Ativo para acompanhamento, sem cálculo financeiro.</strong> A parte operacional está liberada, mas a regra de desconto ainda não foi validada.</div></div>` : ""}
        ${item.revisaoPendente ? `<div class="callout warning">${icon("difference")}<div><strong>Nova versão em revisão:</strong> ${esc(item.revisaoPendente.motivo)}</div></div>` : ""}
        ${itemConfigHtml(item)}
        <div class="drawer-section"><h4>${icon("verified")}Aceites e versões</h4>
          ${item.aceites.length ? `<ul class="timeline">${item.aceites.slice().reverse().map((a) => `<li><span class="tl-dot success">${icon("verified")}</span><div><div class="tl-title">De acordo — versão ${a.versao}</div><div class="tl-meta">${esc(A.userName(a.usuario))} (${esc(a.funcao)}) · ${A.fmtDateTime(a.data)}</div><div class="tl-body">Aplicação a partir de ${A.fmtComp(a.aplicacao)} · Documentos: SEI ${a.docs.map(esc).join(", SEI ")}</div></div></li>`).join("")}</ul>` : A.emptyState({ icon: "pending", title: "Ainda sem De acordo", desc: "O item não gera tarefas nem medições oficiais enquanto estiver em preparação." })}
        </div>`,
      actions: A.profileKey === "gestor" && item.revisaoPendente && A.podeDarAceite(item.contratoId)
        ? [{ label: "Revisar alteração", cls: "primary", icon: "difference", onClick: () => { setTimeout(() => openRevisao(item.id), 0); } }]
        : null,
    });
  }

  /* ---------------- Revisão de alteração por aditivo (7.5) ---------------- */
  function openRevisao(itemId) {
    const item = A.getItem(itemId);
    const rv = item.revisaoPendente;
    const c = A.getContrato(item.contratoId);
    const pode = A.podeDarAceite(item.contratoId);
    const d = A.getDoc(rv.docId);
    A.openModal({
      wide: true, kicker: c.numero + " · Revisar alteração",
      title: item.nome,
      subtitle: esc(rv.motivo),
      body: `
        <div class="version-compare">
          <div class="version-col"><h5>${pill("v" + item.versao, "neutral")} Versão vigente</h5>
            <dl class="kv">${rv.mudancas.map((m) => `<div><dt>${esc(m.campo)}</dt><dd>${esc(m.antes)}</dd></div>`).join("")}<div><dt>Aplica-se a</dt><dd>Medições até ${A.fmtComp(A.compAdd(rv.aplicacao, -1))}</dd></div></dl>
          </div>
          <div class="version-col is-new"><h5>${pill("v" + rv.versao, "info")} Nova versão proposta</h5>
            <dl class="kv">${rv.mudancas.map((m) => `<div><dt>${esc(m.campo)}</dt><dd><span class="changed">${esc(m.depois)}</span></dd></div>`).join("")}<div><dt>Data de aplicação</dt><dd><strong>A partir de ${A.fmtComp(rv.aplicacao, true)}</strong></dd></div></dl>
          </div>
        </div>
        <div class="callout">${icon("history")}<div>Medições anteriores mantêm a versão ${item.versao}. Retificação retroativa, se necessária, segue fluxo próprio com justificativa.</div></div>
        <div>${A.sectionTitle("Fundamento", { icon: "description" })}${d ? A.docSource(d.id) : ""}</div>
        ${pode ? "" : `<div class="callout danger">${icon("lock")}<div>Sua designação neste contrato não permite dar o De acordo.</div></div>`}`,
      actions: [
        { label: "Dar De acordo na v" + rv.versao, cls: "primary", icon: "verified", disabled: !pode, onClick: () => {
          item.config.abrangencia = rv.abrangencia || item.config.abrangencia;
          item.versao = rv.versao;
          item.aceites.push({ versao: rv.versao, usuario: A.currentUser().id, funcao: A.minhaDesignacao(item.contratoId).papel, data: A.nowIso(), aplicacao: rv.aplicacao, docs: [d ? d.sei : "—"] });
          item.revisaoPendente = null;
          if (!A.state.medicoes.some((m) => m.itemId === item.id && m.comp === rv.aplicacao)) {
            A.state.medicoes.push({ id: A.uid("m"), itemId: item.id, comp: rv.aplicacao, status: "programada", prazo: "no_prazo", fechamentoAte: null, versaoRegra: rv.versao, financeiro: { situacao: "sem_calculo" } });
          }
          A.state.riscos = A.state.riscos.filter((r) => !(r.contratoId === item.contratoId && /versão anterior/.test(r.motivo)));
          A.state.alertas.forEach((a) => { if (a.contratoId === item.contratoId && /Termo Aditivo/.test(a.titulo)) a.estado = "encerrado"; });
          A.addHistorico({ acao: "De acordo", objeto: `${item.nome} (v${rv.versao})`, detalhe: `Nova versão aplicada a partir de ${A.fmtComp(rv.aplicacao)}. Medições anteriores mantêm a v${rv.versao - 1}.`, contratoId: item.contratoId });
          A.save();
          A.toast(`Versão ${rv.versao} aprovada. Aplicação a partir de ${A.fmtComp(rv.aplicacao)}.`, "verified");
          A.refreshNav();
          A.renderRoute();
        } },
      ],
    });
  }

  Object.assign(A, { finCfgPill, pendenciasContrato, readiness, readinessHtml, contratoRow, prioridade, COLS_CONTRATO, fichaContrato, riscoItem, histItem, itemConfigHtml, openItemConfig, openRevisao });
})();
