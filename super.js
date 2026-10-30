/* ============================================================
   Superintendência: acompanhamento da carteira, somente consulta (4.1, 12.6)
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  const { esc, icon, pill, lpill, D } = A;

  /* Valores de glosa por situação — estimado e confirmado nunca se misturam */
  function resumoGlosas(contratoIds) {
    const ids = contratoIds ? new Set(contratoIds) : null;
    const out = { estimada: 0, em_validacao: 0, confirmada: 0, nao_aplicada: 0, nEst: 0, nConf: 0, pendentes: 0 };
    A.state.medicoes.forEach((m) => {
      const it = A.getItem(m.itemId);
      if (!it || (ids && !ids.has(it.contratoId))) return;
      const v = A.medValores(m);
      const s = m.financeiro.situacao;
      if (s === "estimada") { out.estimada += v.estimado || 0; out.nEst++; }
      if (s === "em_validacao") out.em_validacao += v.estimado || 0;
      if (s === "confirmada") { out.confirmada += v.confirmado || 0; out.nConf++; }
      if (s === "nao_aplicada") out.nao_aplicada += v.estimado || 0;
      if (s === "pendente") out.pendentes++;
    });
    return out;
  }
  A.resumoGlosas = resumoGlosas;

  /* Visão geral (alinhamento de 28/10/2026): sem Região, que é da contratada e fica no ambiente Operação */
  const contratoSemRegiao = { key: "numero", label: "Contrato", tdCls: "td-main", render: (r) => `<div class="cell-main sei-num">${A.esc(r.numero)}</div><div class="cell-sub">${A.esc(r.c.objeto)}</div>` };
  function filtrosCarteira(q) {
    const contratadas = [...new Set(D.CONTRATOS.map((c) => c.contratada))].sort();
    const gestores = [...new Set(D.CONTRATOS.map((c) => A.gestorDe(c.id)))].sort();
    return `<div class="filters-grid">
      ${A.selectField("fPeriodo", "Período de mudanças", [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Últimos 12 meses"]], q.periodo || "30")}
      ${A.selectField("fContratada", "Contratada", [["", "Todas"], ...contratadas.map((c) => [c, c])], q.contratada || "")}
      ${A.selectField("fAcomp", "Situação de acompanhamento", [["", "Todas"], ...Object.entries(A.L.acomp).map(([k, v]) => [k, v[0]])], q.acomp || "")}
      ${A.selectField("fResp", "Responsável", [["", "Todos"], ...gestores.map((g) => [g, g])], q.resp || "")}
    </div>`;
  }
  function readFiltros(root) {
    const v = (id) => (root.querySelector("#" + id) || {}).value || "";
    return { periodo: v("fPeriodo") || "30", contratada: v("fContratada"), acomp: v("fAcomp"), resp: v("fResp") };
  }
  function aplicaFiltros(f) {
    return D.CONTRATOS.filter((c) => (!f.contratada || c.contratada === f.contratada) && (!f.acomp || A.acompanhamento(c.id) === f.acomp) && (!f.resp || A.gestorDe(c.id) === f.resp));
  }

  /* ---------------- Visão geral ---------------- */
  A.route("super/visao-geral", "super", (p, q) => ({
    title: "Visão geral", nav: "super/visao-geral",
    html: `<div class="section">
      ${A.pageHeader("Visão geral da carteira", "O que mudou, quais valores e prazos foram alterados e onde estão as pendências e os riscos.", `<a class="btn primary" href="#/super/relatorios">${icon("summarize")}Relatórios executivos</a>`)}
      ${filtrosCarteira(q)}
      <div id="vgBody"></div>
    </div>`,
    mount(root) {
      const body = root.querySelector("#vgBody");
      const draw = () => {
        const f = readFiltros(root);
        const cs = aplicaFiltros(f);
        const ids = cs.map((c) => c.id);
        const acompanhados = cs.filter((c) => ["ativo", "parcial"].includes(A.acompanhamento(c.id)));
        const conferidos = cs.filter((c) => c.cadastro === "conferido" && c.valores.vigente != null);
        const valor = conferidos.reduce((s, c) => s + c.valores.vigente, 0);
        const vencendo = cs.filter((c) => A.situacaoContratual(c).key === "vencendo");
        const riscos = A.state.riscos.filter((r) => ids.includes(r.contratoId));
        const criticos = riscos.filter((r) => r.severidade === "critica" || r.severidade === "alta");
        const dias = +f.periodo;
        const mudancas = A.state.mudancas.filter((m) => ids.includes(m.contratoId) && A.daysUntil(m.data) >= -dias).sort((a, b) => (a.data < b.data ? 1 : -1));
        const gl = resumoGlosas(ids);
        const naoIniciados = cs.filter((c) => A.acompanhamento(c.id) === "nao_iniciado").length;

        // Indicadores para decisão (cartões coloridos no padrão dos painéis do SEI)
        const total = (lst) => lst.reduce((s2, c) => s2 + (c.valores.vigente || 0), 0);
        const vigentes = cs.filter((c) => c.cadastro === "conferido" && ["vigente", "vencendo"].includes(A.situacaoContratual(c).key));
        const encerrados = cs.filter((c) => A.situacaoContratual(c).key === "encerrado");
        const valorVig = total(vigentes), valorVenc = total(vencendo);
        const vencidos = prazosVencidos(ids);
        const parados = cs.filter((c) => ["nao_iniciado", "em_preparacao"].includes(A.acompanhamento(c.id)) && ["vigente", "vencendo"].includes(A.situacaoContratual(c).key) && -A.daysUntil(c.datas.inicioVigencia) > 30)
          .map((c) => ({ c, dias: -A.daysUntil(c.datas.inicioVigencia) })).sort((x, y) => y.dias - x.dias);

        body.innerHTML = `
          ${A.kpiHead("Indicadores para decisão")}
          <div class="kpi-grid">
            ${A.kpiCard({ tone: "blue", label: "Valor da carteira vigente", value: A.moneyKpi(valorVig), sub: `${vigentes.length} contrato(s) vigente(s)`, foot: "Valores contratuais atualizados", href: "#/super/contratos?filtro=vigente" })}
            ${A.kpiCard({ tone: "orange", label: "Vigências em até 90 dias", value: A.moneyKpi(valorVenc), sub: `${vencendo.length} contrato(s) · ${valorVig ? ((valorVenc / valorVig) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}% da carteira`, foot: "Decidir continuidade ou substituição", href: "#/super/contratos?filtro=vencendo" })}
            ${A.kpiCard({ tone: "purple", label: "Contratos com vigência encerrada", value: A.moneyKpi(total(encerrados)), sub: `${encerrados.length} contrato(s) sem prorrogação registrada`, foot: "Risco de execução sem cobertura contratual", href: "#/super/contratos?filtro=encerrado" })}
            ${A.kpiCard({ tone: "red", label: "Prazos vencidos", value: vencidos.lista.length, sub: vencidos.lista.length ? `Mais antigo há ${vencidos.maisAntigo} dias` : "Nenhum prazo vencido", foot: vencidos.principal || "Sem pendência de prazo", href: "#/super/pendencias" })}
            ${A.kpiCard({ tone: "slate", label: "Processos sem avanço", value: parados.length, sub: parados.length ? `Mais antigo: ${parados[0].dias} dias sem avanço` : "Todos os processos avançando", foot: "Regra operacional: acima de 30 dias", href: "#/super/contratos?acomp=nao_iniciado" })}
          </div>

          <div class="grid-main-side">
            <div class="panel has-stripe">
              ${A.sectionTitle("O que mudou", { icon: "difference", sub: `Últimos ${dias} dias · antes e depois, data e origem`, right: `<a class="more-link" href="#/super/mudancas">Ver todas</a>` })}
              ${mudancas.length ? `<div class="list">${mudancas.slice(0, 5).map(mudancaItem).join("")}</div>` : A.emptyState({ icon: "history_toggle_off", title: "Nenhuma mudança no período", desc: "Amplie o período para ver alterações anteriores." })}
            </div>
            <div class="stack">
              <div class="panel has-stripe stripe-rose">
                ${A.sectionTitle("Riscos e decisões pendentes", { icon: "report", right: `<a class="more-link" href="#/super/pendencias">Ver mais</a>` })}
                ${riscos.length ? `<div class="list">${riscos.sort((a, b) => sev(b) - sev(a)).slice(0, 3).map(A.riscoItem).join("")}</div>` : A.emptyState({ icon: "verified_user", title: "Sem riscos nos filtros atuais" })}
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:16px">
            ${A.sectionTitle("Contratos priorizados por pendências e riscos", { icon: "low_priority", sub: "Clique para abrir a ficha em modo de consulta.", right: `<a class="more-link" href="#/super/contratos">Ver carteira</a>` })}
            <div id="tPrio"></div>
          </div>

          <div class="grid-2" style="margin-top:16px">
            <div class="panel has-stripe stripe-amber">
              ${A.sectionTitle("Aditivos e vencimentos", { icon: "event_note", sub: "Dias até o fim da vigência (contratos vigentes)" })}
              <div class="hbar-chart">${cs.filter((c) => ["vigente", "vencendo"].includes(A.situacaoContratual(c).key)).sort((a, b) => (a.datas.fimVigencia > b.datas.fimVigencia ? 1 : -1)).map((c) => {
                const d = A.daysUntil(c.datas.fimVigencia);
                return `<div class="hbar-row"><span class="hbar-label" title="${esc(c.objeto)}">${esc(c.numero)}</span><div class="bar ${d <= 90 ? "danger" : d <= 180 ? "warning" : ""}"><span style="width:${Math.min(100, (d / 730) * 100)}%"></span></div><span class="num">${d} dias</span></div>`;
              }).join("")}</div>
              <div class="chart-legend"><span>Escala: 0 a 24 meses</span><span>Vermelho: até 90 dias · Âmbar: até 180 dias</span></div>
              <div style="margin-top:14px" class="list">${A.state.mudancas.filter((m) => m.tipo === "aditivo" && ids.includes(m.contratoId)).slice(0, 3).map((m) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon violet">${icon("post_add")}</span><div><div class="list-title">${esc(A.getContrato(m.contratoId).numero)} · ${esc(m.titulo)}</div><div class="list-desc">${A.fmtDate(m.data)}</div></div>${lpill("conf", m.situacao === "confirmada" ? "conferido" : "pendente")}</div>`).join("")}</div>
            </div>
            <div class="panel has-stripe stripe-violet">
              ${A.sectionTitle("Resumo financeiro das medições", { icon: "account_balance_wallet", sub: "Valores estimados e confirmados separados. Só há valores onde existe regra validada." })}
              <div class="money-split" style="grid-template-columns:repeat(2,minmax(0,1fr))">
                <div class="money-box"><span>Valor contratual vigente</span><strong>${A.fmtMoneyShort(valor)}</strong><span>Somente contratos conferidos</span></div>
                <div class="money-box"><span>Valor executado</span><strong>${A.fmtMoneyShort(conferidos.reduce((s2, c) => s2 + (c.valores.executado || 0), 0))}</strong><span>Soma das notas de cobrança lançadas</span></div>
                <div class="money-box is-est"><span>Glosa estimada</span><strong>${A.fmtMoney(gl.estimada)}</strong><span>${gl.nEst} competência(s) aguardando validação</span></div>
                <div class="money-box is-conf"><span>Glosa confirmada</span><strong>${A.fmtMoney(gl.confirmada)}</strong><span>${gl.nConf} competência(s) fechada(s)</span></div>
              </div>
              <div class="callout" style="margin-top:12px">${icon("info")}<div>${gl.pendentes} medição(ões) com <strong>regra financeira pendente</strong> não entram nos valores. Percentual de “probabilidade de glosa” não é exibido sem método validado.</div></div>
            </div>
          </div>`;

        A.mountTable(body.querySelector("#tPrio"), {
          caption: "contratos",
          rows: cs.map(A.contratoRow), sortKey: "prio", sortDir: -1,
          empty: { icon: "filter_alt_off", title: "Nenhum contrato nos filtros", desc: "Ajuste os filtros para ver a carteira." },
          cols: [contratoSemRegiao, A.COLS_CONTRATO.prioridade, A.COLS_CONTRATO.vigenciaSei, A.COLS_CONTRATO.total, A.COLS_CONTRATO.executado, A.COLS_CONTRATO.saldo],
          onRow: (r) => A.go("super/contrato/" + r.id),
        });
      };
      root.querySelectorAll(".filters-grid select").forEach((s) => s.addEventListener("change", draw));
      draw();
    },
  }));
  const sev = (r) => ({ critica: 3, alta: 2, media: 1 }[r.severidade]);

  /* Prazos vencidos: ateste de nota fora do prazo (dia 15 do mês seguinte), tratativas vencidas e medições atrasadas */
  function prazosVencidos(ids) {
    const lista = [];
    D.CONTRATOS.filter((c) => ids.includes(c.id)).forEach((c) => (c.notas || []).filter((n) => n.situacao === "em_ateste").forEach((n) => {
      const prazo = A.compAdd(n.comp, 1) + "-15";
      if (prazo < D.TODAY) lista.push({ tipo: "ateste", prazo, texto: `Ateste da nota fiscal de ${A.fmtComp(n.comp, true).split(" de ")[0]} pendente` });
    }));
    A.state.ocorrencias.filter((o) => ids.includes(o.contratoId) && o.status === "vencida").forEach((o) => lista.push({ tipo: "ocorrencia", prazo: o.prazo, texto: `Tratativa ${o.id} vencida` }));
    A.state.medicoes.filter((m) => { const it = A.getItem(m.itemId); return it && ids.includes(it.contratoId) && m.prazo === "atrasado" && m.status !== "fechada"; })
      .forEach((m) => lista.push({ tipo: "medicao", prazo: m.fechamentoAte || D.TODAY, texto: `Medição de ${A.fmtComp(m.comp)} atrasada` }));
    lista.sort((x, y) => (x.prazo > y.prazo ? 1 : -1));
    const porTipo = {}; lista.forEach((x) => { porTipo[x.tipo] = porTipo[x.tipo] || x; });
    const principal = (porTipo.ateste || porTipo.ocorrencia || porTipo.medicao || {}).texto;
    return { lista, maisAntigo: lista.length ? -A.daysUntil(lista[0].prazo) : 0, principal };
  }

  function mudancaItem(m) {
    const c = A.getContrato(m.contratoId);
    const d = A.getDoc(m.origem.docId);
    const ic = { aditivo: "post_add", designacao: "badge", evento: "mail", cadastro: "add_circle" }[m.tipo];
    const tone = m.tipo === "evento" ? "" : m.situacao === "pendente_conferencia" ? "warning" : "violet";
    return `<div class="list-item"><span class="list-icon ${tone}">${icon(ic)}</span>
      <div><div class="list-title">${esc(c.numero)} · ${esc(m.titulo)}</div>
        ${m.campos.map((f) => `<div class="diff"><span class="cell-sub" style="min-width:110px">${esc(f.campo)}</span><span class="before">${esc(f.antes)}</span>${icon("arrow_forward")}<span class="after">${esc(f.depois)}</span></div>`).join("")}
        <div class="list-meta"><span>${icon("event")}${A.fmtDate(m.data)}</span>${d ? `<span>${icon("description")}SEI ${esc(d.sei)} · ${esc(d.tipo)}</span>` : ""}${m.efeito && m.efeito !== "—" ? `<span>${icon("subdirectory_arrow_right")}${esc(m.efeito)}</span>` : ""}</div>
      </div>
      <div class="list-side">${m.tipo === "evento" ? pill("Novo evento", "neutral") : m.situacao === "confirmada" ? pill("Mudança confirmada", "violet") : pill("Pendente de conferência", "pending")}</div></div>`;
  }

  /* ---------------- Contratos ---------------- */
  A.route("super/contratos", "super", (p, q) => ({
    title: "Contratos", nav: "super/contratos", crumbs: [{ label: "Contratos" }],
    html: `<div class="section">
      ${A.pageHeader("Contratos", "Toda a carteira da abrangência autorizada. A coluna Contratado indica se os dados vieram do SEI ou de cadastro manual.", A.exportMenu('data-export="carteira"', { cls: "btn outline", alignRight: true }) + `<button class="btn primary" type="button" id="cadSei">${icon("add_link")}Cadastrar pelo processo SEI</button>`)}
      <div class="filters-grid">
        <div class="span-2">${A.searchField("fBusca", "Número, objeto ou contratada", q.busca || "")}</div>
        ${A.selectField("fContratada", "Contratada", [["", "Todas"], ...[...new Set(D.CONTRATOS.map((c) => c.contratada))].map((c) => [c, c])], "")}
        ${A.selectField("fSit", "Situação contratual", [["", "Todas"], ["vigente", "Vigente"], ["vencendo", "Vence em até 90 dias"], ["encerrado", "Encerrada"], ["pendente", "Pendente de conferência"]], q.filtro || "")}
        ${A.selectField("fAcomp", "Acompanhamento", [["", "Todos"], ...Object.entries(A.L.acomp).map(([k, v]) => [k, v[0]])], q.acomp || "")}
        ${A.selectField("fRegiao", "Região", [["", "Todas"], ...D.REGIOES.map((r) => [r, r])], q.regiao || "")}
        ${A.selectField("fResp", "Responsável", [["", "Todos"], ...[...new Set(D.CONTRATOS.map((c) => A.gestorDe(c.id)))].map((r) => [r, r])], "")}
      </div>
      <div id="tContratos"></div>
    </div>`,
    mount(root) {
      const v = (id) => root.querySelector("#" + id).value;
      const rows = () => D.CONTRATOS.map(A.contratoRow).filter((r) => {
        const b = v("fBusca").toLowerCase();
        if (b && ![r.numero, r.c.objeto, r.contratada, ...r.c.processos.map((x) => x.numero)].join(" ").toLowerCase().includes(b)) return false;
        if (v("fContratada") && r.contratada !== v("fContratada")) return false;
        if (v("fSit") && r.sit.key !== v("fSit") && !(v("fSit") === "vigente" && r.sit.key === "vencendo")) return false;
        if (v("fAcomp") && !(r.acomp === v("fAcomp") || (v("fAcomp") === "ativo" && r.acomp === "parcial"))) return false;
        if (v("fRegiao") && r.regiao !== v("fRegiao")) return false;
        if (v("fResp") && r.gestor !== v("fResp")) return false;
        return true;
      });
      const t = A.mountTable(root.querySelector("#tContratos"), {
        caption: "contratos",
        rows, sortKey: "numero",
        empty: { icon: "search_off", title: "Nenhum contrato encontrado", desc: "Revise a busca ou limpe os filtros." },
        cols: [A.COLS_CONTRATO.contratoSeiAcomp, A.COLS_CONTRATO.contratadaSei, A.COLS_CONTRATO.responsaveis, A.COLS_CONTRATO.vigenciaSei, A.COLS_CONTRATO.total, A.COLS_CONTRATO.executado, A.COLS_CONTRATO.saldo],
        onRow: (r) => A.go("super/contrato/" + r.id),
        foot: (rs) => `<span>${rs.length} de ${D.CONTRATOS.length} contratos</span><span>Situação contratual e de acompanhamento são dimensões separadas.</span>`,
      });
      root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
      root.querySelector("#fBusca").addEventListener("input", t.render);
      root.querySelector("#cadSei").addEventListener("click", () => cadastrarPorProcesso(t.render));
      root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
        const header = ["Contrato", "Objeto", "Contratado", "Origem", "Região", "Gestor", "Fiscal", "Início vigência", "Fim vigência", "Situação contratual", "Valor inicial", "Valor total", "Valor executado", "Saldo", "Acompanhamento"];
        const data = rows().map((r) => [r.numero, r.c.objeto, r.contratada, A.ORIGEM_DADOS[r.origem][0], r.regiao, r.gestor, r.fiscal || "não identificado", A.fmtDate(r.c.datas.inicioVigencia), A.fmtDate(r.fim), r.sit.label, r.fin.inicial, r.fin.total ?? "A conferir", r.fin.executado, r.fin.saldo ?? "não identificado", A.L.acomp[r.acomp][0]]);
        if (b.dataset.format === "csv") A.downloadCsv("carteira-contratos.csv", header, data);
        else A.downloadPdf("carteira-contratos.pdf", "Carteira de contratos", header, data, { money: [10, 11, 12, 13] });
      }));
    },
  }));

  /* Cadastro a partir do número do processo SEI (alinhamento de 27/10/2026). Simulado: a consulta devolve
     o que normalmente vem do SEI e marca o que precisa ser preenchido à mão. */
  const SUGESTOES_SEI = [
    { objeto: "Serviços de TI e sustentação de sistemas", contratada: "Delta Soluções Digitais Ltda", cnpj: "12.345.678/0001-90", valor: 2400000, meses: 24 },
    { objeto: "Vigilância eletrônica dos postos", contratada: "Guarda Total Segurança Ltda", cnpj: "23.456.789/0001-01", valor: 1050000, meses: 12 },
    { objeto: "Apoio à governança de TIC", contratada: "Extreme Digital Consultoria Ltda", cnpj: "34.567.890/0001-12", valor: 42667451, meses: 24 },
  ];
  function cadastrarPorProcesso(onDone) {
    const fmt = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/;
    let achado = null;
    const linha = (rot, val, auto) => `<div class="sei-field"><span class="sei-field-label">${esc(rot)}</span><span class="sei-field-val">${val}</span><span class="tag ${auto ? "info" : ""}">${icon(auto ? "cloud_done" : "edit_note")}${auto ? "Do SEI" : "Manual"}</span></div>`;
    A.openModal({
      kicker: "Superintendência", title: "Cadastrar contrato pelo processo SEI", wide: true,
      subtitle: "Informe o número do processo. O sistema consulta o SEI e traz o que já existe lá dentro.",
      body: `<div class="form-field"><label for="nProcSei">Número do processo SEI <span class="field-req">*</span></label><input class="input" id="nProcSei" placeholder="00000.000000/0000-00" value="23180.013377/2026-41" /></div>
        <div id="seiResult" style="margin-top:14px"></div>`,
      actions: [
        { label: "Consultar no SEI", icon: "search", close: false, onClick: (l) => {
          const inp = l.el.querySelector("#nProcSei"); const v = inp.value.trim();
          if (!fmt.test(v)) { inp.classList.add("is-missing"); A.toast("Use o formato 00000.000000/0000-00.", "error"); return false; }
          inp.classList.remove("is-missing");
          const sug = SUGESTOES_SEI[[...v].reduce((a2, ch) => a2 + ch.charCodeAt(0), 0) % SUGESTOES_SEI.length];
          const ano = v.slice(-7, -3);
          achado = { processo: v, ...sug, numero: `CT ${String(40 + D.CONTRATOS.length).padStart(3, "0")}/${ano}`, inicio: `${ano}-11-01`, fim: `${+ano + Math.round(sug.meses / 12)}-10-31` };
          l.el.querySelector("#seiResult").innerHTML = `<div class="callout success">${icon("cloud_done")}<div><strong>Processo encontrado no SEI.</strong> 3 documentos lidos: contrato, termo de referência e portaria de designação (pendente).</div></div>
            <div class="sei-fields">
              ${linha("Número do contrato", esc(achado.numero), true)}
              ${linha("Objeto", esc(achado.objeto), true)}
              ${linha("Contratado", `${esc(achado.contratada)} · CNPJ ${esc(achado.cnpj)}`, true)}
              ${linha("Vigência", `${A.fmtDate(achado.inicio)} a ${A.fmtDate(achado.fim)}`, true)}
              ${linha("Valor inicial", A.fmtMoney(achado.valor), true)}
              ${linha("Região", A.selectField("nRegiao", "Região", D.REGIOES.map((r2) => [r2, r2]), D.REGIOES[0]).replace(/<label[^>]*>.*?<\/label>/, ""), false)}
              ${linha("Gestor e fiscal", `<span class="muted">Portaria de designação ainda não assinada no SEI</span>`, false)}
            </div>`;
          l.el.querySelector(".modal-foot .btn.primary").innerHTML = `${icon("add")}Cadastrar contrato`;
          l.el.querySelector(".modal-foot .btn.primary").dataset.step = "2";
          return false;
        } },
      ],
      mount(box, layer) {
        // A ação única muda de "Consultar" para "Cadastrar" depois da consulta
        const btn = box.querySelector(".modal-foot .btn.primary");
        btn.addEventListener("click", (e) => {
          if (btn.dataset.step !== "2" || !achado) return;
          e.stopImmediatePropagation();
          const id = "n" + Date.now().toString(36);
          const novo = {
            id, numero: achado.numero, objeto: achado.objeto, objetoLongo: achado.objeto + " (texto extraído do contrato no SEI).",
            contratada: achado.contratada, cnpj: achado.cnpj, regiao: box.querySelector("#nRegiao").value,
            processos: [{ numero: achado.processo, papel: "Contratação", unidade: "GCR/Contratos" }],
            datas: { assinatura: null, inicioExecucao: null, inicioVigencia: achado.inicio, fimVigencia: achado.fim },
            valores: { original: achado.valor, vigente: null, mesesVigencia: achado.meses, executado: 0 },
            postos: [], servicos: [], cadastro: "em_conferencia", notas: [], origemDados: "sei_conferencia",
            qualidade: { origem: "Sugestão extraída do SEI", consulta: A.nowIso(), pendencias: 2 },
          };
          A.state.contratosNovos = (A.state.contratosNovos || []).concat([novo]);
          D.CONTRATOS.push(novo);
          A.addHistorico({ acao: "Cadastro pelo SEI", objeto: novo.numero, detalhe: `Processo ${achado.processo}. Dados sugeridos pelo SEI aguardam conferência.`, contratoId: id });
          A.save();
          layer.close();
          A.toast(`${novo.numero} cadastrado. Dados do SEI aguardam conferência.`, "add_link");
          if (onDone) onDone();
        }, true);
      },
    });
  }

  A.route("super/contrato/:id/:tab?", "super", (p) => A.fichaContrato("super/contrato", p.id, p.tab));

  /* ---------------- Mudanças e aditivos ---------------- */
  A.route("super/mudancas", "super", () => ({
    title: "Mudanças e aditivos", nav: "super/mudancas", crumbs: [{ label: "Mudanças e aditivos" }],
    html: `<div class="section">
      ${A.pageHeader("Mudanças e aditivos", "Alterações confirmadas e novos eventos, com antes e depois e acesso à origem. Um novo evento não é uma mudança contratual.")}
      <div class="filters-grid">
        ${A.selectField("fPer", "Período", [["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Últimos 12 meses"]], "365")}
        ${A.selectField("fTipo", "Tipo", [["", "Todos"], ["aditivo", "Termo aditivo"], ["designacao", "Designação"], ["cadastro", "Cadastro e vigência"], ["evento", "Novo evento"]], "")}
        ${A.selectField("fCt", "Contrato", [["", "Todos"], ...D.CONTRATOS.map((c) => [c.id, c.numero])], "")}
        ${A.selectField("fSitM", "Situação", [["", "Todas"], ["confirmada", "Confirmada"], ["pendente_conferencia", "Pendente de conferência"], ["evento", "Novo evento"]], "")}
      </div>
      <div id="mList"></div>
    </div>`,
    mount(root) {
      const draw = () => {
        const v = (id) => root.querySelector("#" + id).value;
        const ms = A.state.mudancas.filter((m) => A.daysUntil(m.data) >= -v("fPer") && (!v("fTipo") || m.tipo === v("fTipo")) && (!v("fCt") || m.contratoId === v("fCt")) && (!v("fSitM") || m.situacao === v("fSitM"))).sort((a, b) => (a.data < b.data ? 1 : -1));
        root.querySelector("#mList").innerHTML = ms.length ? `<div class="list">${ms.map(mudancaItem).join("")}</div>` : A.emptyState({ icon: "history_toggle_off", title: "Nenhuma mudança encontrada", desc: "Ajuste o período ou os filtros." });
      };
      root.querySelectorAll("select").forEach((s) => s.addEventListener("change", draw));
      draw();
    },
  }));

  /* ---------------- Pendências e riscos ---------------- */
  A.route("super/pendencias", "super", () => ({
    title: "Pendências e riscos", nav: "super/pendencias", crumbs: [{ label: "Pendências e riscos" }],
    html: `<div class="section">
      ${A.pageHeader("Pendências e riscos", "Riscos com motivo, responsável, prazo e providência. Classificação por critérios documentados, sem percentuais de probabilidade.")}
      <div class="tabs"><button class="tab active" data-t="riscos">${icon("report")}Riscos</button><button class="tab" data-t="pend">${icon("pending_actions")}Pendências por contrato</button></div>
      <div id="pBody"></div>
    </div>`,
    mount(root) {
      const body = root.querySelector("#pBody");
      const show = (t) => {
        root.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.t === t));
        if (t === "riscos") {
          body.innerHTML = `<div class="filters-grid">${A.selectField("fSev", "Severidade", [["", "Todas"], ["critica", "Crítica"], ["alta", "Alta"], ["media", "Média"]], "")}</div><div id="tR"></div>`;
          const tr = A.mountTable(body.querySelector("#tR"), {
            caption: "riscos",
            rows: () => A.state.riscos.filter((r) => !body.querySelector("#fSev").value || r.severidade === body.querySelector("#fSev").value),
            sortKey: "sevN", sortDir: -1,
            empty: { icon: "verified_user", title: "Nenhum risco registrado" },
            cols: [
              { key: "sevN", label: "Severidade", sortValue: sev, render: (r) => lpill("sev", r.severidade) },
              { key: "motivo", label: "Motivo", tdCls: "td-main", render: (r) => `<div class="cell-main">${esc(r.motivo)}</div><div class="cell-sub">${esc(A.getContrato(r.contratoId).numero)} · ${esc(A.getContrato(r.contratoId).objeto)}</div>` },
              { key: "responsavel", label: "Responsável" },
              { key: "prazo", label: "Prazo", cls: "nowrap", render: (r) => `${A.fmtDate(r.prazo)}<div class="cell-sub">${A.daysUntil(r.prazo) < 0 ? "Vencido" : "em " + A.daysUntil(r.prazo) + " dias"}</div>` },
              { key: "providencia", label: "Providência", render: (r) => `<span class="cell-sub">${esc(r.providencia)}</span>` },
            ],
            onRow: (r) => A.go("super/contrato/" + r.contratoId + "/pendencias"),
          });
          body.querySelector("#fSev").addEventListener("change", tr.render);
        } else {
          const rows = D.CONTRATOS.map((c) => ({ c, p: A.pendenciasContrato(c.id) })).filter((x) => x.p.length);
          body.innerHTML = rows.map((x) => `<div class="panel flat" style="margin-bottom:12px">${A.sectionTitle(x.c.numero + " · " + x.c.objeto, { sub: x.c.contratada, right: `<a class="more-link" href="#/super/contrato/${x.c.id}/pendencias">Abrir ficha</a>` })}<div class="list">${x.p.map((p) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon ${p.tone}">${icon(p.ic)}</span><div class="list-title">${esc(p.texto)}</div><span class="tag">${esc(p.tipo)}</span></div>`).join("")}</div></div>`).join("");
        }
      };
      root.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.t)));
      show("riscos");
    },
  }));

  /* ---------------- Relatórios ---------------- */
  A.route("super/relatorios", "super", () => ({
    title: "Relatórios", nav: "super/relatorios", crumbs: [{ label: "Relatórios" }],
    html: `<div class="section">
      ${A.pageHeader("Relatórios executivos", "Exportações da carteira por período. Os arquivos são gerados no navegador com os dados deste protótipo.")}
      <div class="grid-3">
        ${report("rCarteira", "inventory", "Resumo da carteira", "Contratos, situação contratual e de acompanhamento, valores vigentes confirmados e responsáveis.")}
        ${report("rMud", "difference", "Mudanças e aditivos", "Alterações com antes e depois, data, documento de origem e situação de conferência.")}
        ${report("rRiscos", "report", "Pendências e riscos", "Riscos com severidade, motivo, responsável, prazo e providência.")}
        ${report("rVenc", "event_upcoming", "Vencimentos", "Fim de vigência e dias restantes de todos os contratos vigentes.")}
        ${report("rFin", "account_balance_wallet", "Glosas por situação", "Valores estimados, em validação, confirmados e não aplicados, separados por competência.")}
      </div>
      <div class="callout" style="margin-top:16px">${icon("info")}<div><strong>PDF para o processo SEI:</strong> a juntada ao processo formal depende de integração e do método de assinatura a definir. Indisponível neste protótipo.</div></div>
    </div>`,
    mount(root) {
      const S = A.state;
      const RELATORIOS = {
        rCarteira: () => ({ file: "resumo-carteira", title: "Resumo da carteira", money: [5],
          header: ["Contrato", "Objeto", "Contratada", "Situação contratual", "Acompanhamento", "Valor vigente", "Gestor"],
          rows: D.CONTRATOS.map((c) => [c.numero, c.objeto, c.contratada, A.situacaoContratual(c).label, A.L.acomp[A.acompanhamento(c.id)][0], c.valores.vigente ?? "Pendente", A.gestorDe(c.id)]) }),
        rMud: () => ({ file: "mudancas-aditivos", title: "Mudanças e aditivos",
          header: ["Data", "Contrato", "Mudança", "Campo", "Antes", "Depois", "Origem SEI", "Situação"],
          rows: S.mudancas.flatMap((m) => (m.campos.length ? m.campos : [{ campo: "—", antes: "—", depois: "—" }]).map((f) => [A.fmtDate(m.data), A.getContrato(m.contratoId).numero, m.titulo, f.campo, f.antes, f.depois, (A.getDoc(m.origem.docId) || {}).sei || "—", m.situacao])) }),
        rRiscos: () => ({ file: "pendencias-riscos", title: "Pendências e riscos",
          header: ["Severidade", "Contrato", "Motivo", "Responsável", "Prazo", "Providência"],
          rows: S.riscos.map((r) => [A.L.sev[r.severidade][0], A.getContrato(r.contratoId).numero, r.motivo, r.responsavel, A.fmtDate(r.prazo), r.providencia]) }),
        rVenc: () => ({ file: "vencimentos", title: "Vencimentos",
          header: ["Contrato", "Objeto", "Fim da vigência", "Dias restantes"],
          rows: D.CONTRATOS.filter((c) => c.cadastro === "conferido").map((c) => [c.numero, c.objeto, A.fmtDate(c.datas.fimVigencia), A.daysUntil(c.datas.fimVigencia)]) }),
        rFin: () => ({ file: "glosas-por-situacao", title: "Glosas por situação", money: [5, 6],
          header: ["Contrato", "Item", "Competência", "Situação da medição", "Efeito financeiro", "Estimado", "Confirmado"],
          rows: S.medicoes.map((m) => { const it = A.getItem(m.itemId); const v = A.medValores(m); return [A.getContrato(it.contratoId).numero, it.nome, A.fmtComp(m.comp), A.L.med[m.status][0], A.L.fin[m.financeiro.situacao][0], v.estimado ?? "", v.confirmado ?? ""]; }) }),
      };
      root.querySelectorAll("[data-report]").forEach((b) => b.addEventListener("click", async () => {
        const r = RELATORIOS[b.dataset.report]();
        if (b.dataset.format === "csv") return A.downloadCsv(r.file + ".csv", r.header, r.rows);
        b.disabled = true;
        await A.downloadPdf(r.file + ".pdf", r.title, r.header, r.rows, { money: r.money });
        b.disabled = false;
      }));
    },
  }));
  function report(id, ic, t, d) {
    return `<div class="panel flat report-card"><span class="list-icon">${icon(ic)}</span><h4>${esc(t)}</h4><p>${esc(d)}</p><div class="btn-row">${A.exportMenu(`data-report="${id}"`)}</div></div>`;
  }
})();
