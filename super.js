/* ============================================================
   Telas da carteira usadas pelos dois perfis da 1ª versão (reuniões de 05/11/2026):
   Diretoria DSC (rotas "super/…", só consulta) e Equipe GCR (rotas "gestor/…", curadoria).
   Visão geral, Contratos, Mudanças e Relatórios. Medições ficam fora desta versão.
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  const { esc, icon, pill, lpill, D } = A;
  const PERFIS = ["super", "gestor"];
  const base = () => A.profileKey;

  /* Valores de glosa por situação — usados só pelo ambiente Operação (fase 2) */
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

  /* Visão geral (alinhamento de 28/10/2026): sem Região, que é da contratada */
  const contratoSemRegiao = { key: "numero", label: "Contrato", tdCls: "td-main", render: (r) => `<div class="cell-main sei-num">${A.esc(r.numero)}</div><div class="cell-sub">${A.esc(r.c.objeto)}</div>` };
  const colExcecoes = { key: "exc", label: "Exceções no Radar", sortValue: (r) => A.radarDoContrato(r.id).filter((x) => x.grupo !== "sobrestado").length, render: (r) => {
    const it = A.radarDoContrato(r.id).filter((x) => x.grupo !== "sobrestado");
    if (!it.length) return `<span class="pill neutral no-dot">0</span>`;
    const grupos = [...new Set(it.map((x) => x.grupo))].map((g) => A.GRUPOS_RADAR.find((y) => y.key === g).label);
    return `<span class="pill ${it.some((x) => ["vencidos", "ois", "vigencia", "semresp"].includes(x.grupo)) ? "danger" : "warning"} no-dot">${it.length}</span><div class="cell-sub">${esc(grupos.slice(0, 2).join(", "))}${grupos.length > 2 ? "…" : ""}</div>`;
  } };
  function filtrosCarteira(q) {
    const contratadas = [...new Set(D.CONTRATOS.map((c) => c.contratada))].sort();
    const gestores = [...new Set(D.CONTRATOS.map((c) => A.gestorDe(c.id)))].sort();
    return `<div class="filters-grid">
      ${A.selectField("fPeriodo", "Período de mudanças", [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Últimos 12 meses"]], q.periodo || "30")}
      ${A.selectField("fContratada", "Contratada", [["", "Todas"], ...contratadas.map((c) => [c, c])], q.contratada || "")}
      ${A.selectField("fResp", "Gestor do contrato", [["", "Todos"], ...gestores.map((g) => [g, g])], q.resp || "")}
    </div>`;
  }
  function readFiltros(root) {
    const v = (id) => (root.querySelector("#" + id) || {}).value || "";
    return { periodo: v("fPeriodo") || "30", contratada: v("fContratada"), resp: v("fResp") };
  }
  function aplicaFiltros(f) {
    return D.CONTRATOS.filter((c) => (!f.contratada || c.contratada === f.contratada) && (!f.resp || A.gestorDe(c.id) === f.resp));
  }

  /* ---------------- Visão geral (painel do Diretor) ---------------- */
  function telaVisaoGeral(p, q) {
    const pr = base();
    return {
      title: "Visão geral", nav: pr + "/visao-geral",
      html: `<div class="section">
        ${A.pageHeader("Visão geral", pr === "super"
          ? "O que entrou na caixa DSC, o que precisa de você, o que saiu do normal e como estão vigências, aditivos e OIS. Medições ficam para a próxima fase."
          : "O mesmo painel que o Diretor vê. Use a Caixa DSC e o Radar para classificar, atribuir e cobrar.", `<a class="btn primary" href="#/${pr}/caixa">${icon("inbox")}Abrir a Caixa DSC</a>`)}
        ${filtrosCarteira(q)}
        <div id="vgBody"></div>
      </div>`,
      mount(root) {
        const body = root.querySelector("#vgBody");
        const draw = () => {
          const f = readFiltros(root);
          const cs = aplicaFiltros(f);
          const ids = cs.map((c) => c.id);
          const filtrado = !!(f.contratada || f.resp);
          const noFiltro = (cid) => (cid ? ids.includes(cid) : !filtrado);
          const caixa = A.state.caixa.filter((e) => noFiltro(e.contratoId));
          const abertas = caixa.filter(A.cxAberta);
          const comDir = caixa.filter(A.comDiretor);
          const depois = abertas.filter((e) => e.precisaDiretor && !A.comDiretor(e));
          const radar = A.radarItens().filter((x) => noFiltro(x.contratoId));
          const vencidos = radar.filter((x) => x.grupo === "vencidos");
          const parados = abertas.filter(A.cxParada), terceiros = abertas.filter((e) => A.ehTerceiro(e.aguardando));
          const total = (lst) => lst.reduce((s2, c) => s2 + (c.valores.vigente || 0), 0);
          const vigentes = cs.filter((c) => c.cadastro === "conferido" && ["vigente", "vencendo"].includes(A.situacaoContratual(c).key));
          const vencendo = cs.filter((c) => A.situacaoContratual(c).key === "vencendo");
          const valorVig = total(vigentes), valorVenc = total(vencendo);
          const dias = +f.periodo;
          const mudancas = A.state.mudancas.filter((m) => ids.includes(m.contratoId) && A.daysUntil(m.data) >= -dias).sort((a, b) => (a.data < b.data ? 1 : -1));
          const novas7 = caixa.filter((e) => -A.daysUntil(e.entrada) <= 7);
          const nGrupo = (k) => A.radarItens({ incluirSobrestados: true }).filter((x) => x.grupo === k && noFiltro(x.contratoId)).length;

          body.innerHTML = `
            <div class="sync-line">${icon("sync")}Última leitura da caixa DSC no SEI: ${A.fmtDateTime(D.TODAY + "T07:40:00")} · dados de demonstração</div>
            ${A.kpiHead("Indicadores para decisão")}
            <div class="kpi-grid">
              ${A.kpiCard({ tone: "blue", label: "Entradas novas na caixa", value: novas7.length, sub: `Últimos 7 dias · ${abertas.length} entradas abertas`, foot: `${caixa.filter((e) => e.situacao === "sem_classificacao").length} sem classificação`, href: `#/${pr}/caixa?sit=abertas` })}
              ${A.kpiCard({ tone: "orange", label: "Aguardando o Diretor", value: comDir.length, sub: comDir.length ? `Mais antiga há ${Math.max(...comDir.map(A.diasSemAndamento))} dias · +${depois.length} depois` : "Nada com o Diretor agora", foot: "Assinaturas e decisões", href: `#/${pr}/caixa?diretor=agora` })}
              ${A.kpiCard({ tone: "red", label: "Prazos vencidos", value: vencidos.length, sub: vencidos.length ? `Mais antigo há ${Math.max(...vencidos.map((x) => -A.daysUntil(x.prazo)))} dias` : "Nenhum prazo vencido", foot: "Legal, contratual ou interno", href: `#/${pr}/radar?g=vencidos` })}
              ${A.kpiCard({ tone: "slate", label: "Parados ou com terceiros", value: new Set([...parados, ...terceiros]).size, sub: `${parados.length} sem andamento há +${A.limiteParado()} dias · ${terceiros.length} fora da Prodesp`, foot: "Sobrestados não contam", href: `#/${pr}/radar?g=parados` })}
              ${A.kpiCard({ tone: "purple", label: "Vigências em até 90 dias", value: A.moneyKpi(valorVenc), sub: `${vencendo.length} contrato(s) · ${valorVig ? ((valorVenc / valorVig) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}% da carteira vigente`, foot: "Decidir continuidade ou prorrogação", href: `#/${pr}/contratos?filtro=vencendo` })}
            </div>

            <div class="grid-main-side">
              <div class="panel has-stripe stripe-amber">
                ${A.sectionTitle("Aguardando o Diretor", { icon: "draw", sub: "Assinaturas e decisões na caixa DSC. Nada aqui é uma aprovação nova: é o que já precisa do Diretor no SEI.", right: `<a class="more-link" href="#/${pr}/caixa?diretor=sim">Ver todas</a>` })}
                ${[...comDir, ...depois].length ? `<div class="list">${[...comDir, ...depois].slice(0, 5).map((e) => caixaItem(e, pr)).join("")}</div>` : A.emptyState({ icon: "task_alt", title: "Nada aguardando o Diretor" })}
              </div>
              <div class="panel has-stripe stripe-rose">
                ${A.sectionTitle("Radar de exceções", { icon: "radar", sub: "O que saiu do normal", right: `<a class="more-link" href="#/${pr}/radar">Abrir o Radar</a>` })}
                <div class="radar-sum">${A.GRUPOS_RADAR.map((g) => { const n = nGrupo(g.key); return `<a class="radar-sum-row ${n ? "" : "is-zero"}" href="#/${pr}/radar?g=${g.key}">${A.grupoTag(g.key)}<strong>${n}</strong></a>`; }).join("")}</div>
              </div>
            </div>

            <div class="grid-2" style="margin-top:16px">
              <div class="panel has-stripe">
                ${A.sectionTitle("O que mudou", { icon: "difference", sub: `Últimos ${dias} dias · antes e depois, data e origem`, right: `<a class="more-link" href="#/${pr}/mudancas">Ver todas</a>` })}
                ${mudancas.length ? `<div class="list">${mudancas.slice(0, 4).map(mudancaItem).join("")}</div>` : A.emptyState({ icon: "history_toggle_off", title: "Nenhuma mudança no período", desc: "Amplie o período para ver alterações anteriores." })}
              </div>
              <div class="panel has-stripe stripe-violet">
                ${A.sectionTitle(`OIS do mês — ${A.fmtComp(A.CURRENT_COMP, true)}`, { icon: "assignment", sub: "Sem OIS no mês, o contrato pode estar parado.", right: `<a class="more-link" href="#/${pr}/ois">Ver OIS</a>` })}
                ${A.oisMesCards(A.contratosOis().filter((c) => ids.includes(c.id)))}
              </div>
            </div>

            <div class="panel has-stripe stripe-amber" style="margin-top:16px">
              ${A.sectionTitle("Vencimentos, aditivos e reajustes", { icon: "event_note", sub: "Aditivo proposto, formalizado e vigente são situações diferentes." })}
              <div class="grid-2">
                <div>
                  <div class="hbar-chart">${cs.filter((c) => ["vigente", "vencendo"].includes(A.situacaoContratual(c).key)).sort((a, b) => (a.datas.fimVigencia > b.datas.fimVigencia ? 1 : -1)).map((c) => {
                    const d = A.daysUntil(c.datas.fimVigencia);
                    return `<div class="hbar-row"><span class="hbar-label" title="${esc(c.objeto)}">${esc(c.numero)}</span><div class="bar ${d <= 90 ? "danger" : d <= 180 ? "warning" : ""}"><span style="width:${Math.min(100, (d / 730) * 100)}%"></span></div><span class="num">${d} d</span></div>`;
                  }).join("")}</div>
                  <div class="chart-legend"><span>Dias até o fim da vigência · escala de 0 a 24 meses</span><span>Vermelho: até 90 dias · Âmbar: até 180 dias</span></div>
                </div>
                <div class="list">
                  ${A.state.aditivos.filter((a) => ids.includes(a.contratoId) && a.situacao !== "vigente").map((a) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon violet">${icon("post_add")}</span><div><div class="list-title">${esc(A.getContrato(a.contratoId).numero)} · ${esc(a.titulo)}</div><div class="list-desc">${esc(a.efeito)} · SEI ${esc(a.sei)}</div></div>${lpill("aditivo", a.situacao)}</div>`).join("")}
                  ${A.state.reajustes.filter((r) => ids.includes(r.contratoId) && r.situacao !== "aplicado").map((r) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon("trending_up")}</span><div><div class="list-title">${esc(A.getContrato(r.contratoId).numero)} · ${esc(r.tipo)} (${esc(r.indice)})</div><div class="list-desc">Data-base ${A.fmtDate(r.dataBase)} · ${esc(r.texto)}</div></div>${lpill("reajuste", r.situacao)}</div>`).join("")}
                </div>
              </div>
            </div>

            <div class="panel" style="margin-top:16px">
              ${A.sectionTitle("Carteira de contratos", { icon: "low_priority", sub: "Ordenada pelas exceções no Radar. Clique para abrir a ficha.", right: `<a class="more-link" href="#/${pr}/contratos">Ver carteira</a>` })}
              <div id="tPrio"></div>
            </div>`;

          A.mountTable(body.querySelector("#tPrio"), {
            caption: "contratos",
            rows: cs.map(A.contratoRow), sortKey: "exc", sortDir: -1,
            empty: { icon: "filter_alt_off", title: "Nenhum contrato nos filtros", desc: "Ajuste os filtros para ver a carteira." },
            cols: [contratoSemRegiao, colExcecoes, A.COLS_CONTRATO.vigenciaSei, A.COLS_CONTRATO.total, A.COLS_CONTRATO.executado, A.COLS_CONTRATO.saldo],
            onRow: (r) => A.go(pr + "/contrato/" + r.id),
          });
          body.querySelectorAll("[data-cx]").forEach((b) => b.addEventListener("click", () => A.openCaixa(b.dataset.cx, draw)));
        };
        root.querySelectorAll(".filters-grid select").forEach((s) => s.addEventListener("change", draw));
        draw();
      },
    };
  }

  function caixaItem(e, pr) {
    const c = e.contratoId ? A.getContrato(e.contratoId) : null;
    const novo = pr === "super" && !(A.state.vistosDiretor || []).includes(e.id);
    return `<button type="button" class="list-item list-btn" data-cx="${e.id}" style="grid-template-columns:auto 1fr auto">
      <span class="list-icon ${A.comDiretor(e) ? "warning" : ""}">${icon(e.acao === "assinatura" ? "draw" : e.acao === "aprovacao" ? "gavel" : "reply")}</span>
      <div><div class="list-title">${esc(e.assunto)}${novo ? ` ${pill("Novo", "info", "sm")}` : ""}</div>
        <div class="list-meta"><span>${icon("description")}SEI ${esc(e.sei)}</span>${c ? `<span>${icon("contract")}${esc(c.numero)}</span>` : ""}<span>${icon("location_on")}${esc(e.aguardando || A.ultimoAnd(e).unidade)}</span>${e.prazo ? `<span class="${A.cxVencida(e) ? "txt-danger" : ""}">${icon("event")}${A.fmtDate(e.prazo.data)}</span>` : ""}</div>
      </div>
      <div class="list-side">${A.comDiretor(e) ? pill("Com o Diretor", "warning", "sm") : e.sobrestado ? pill("Sobrestado", "neutral", "sm") : pill("Em andamento", "outline", "sm")}</div>
    </button>`;
  }

  /* ---------------- Contratos ---------------- */
  function telaContratos(p, q) {
    const pr = base();
    return {
      title: "Contratos", nav: pr + "/contratos", crumbs: [{ label: "Contratos" }],
      html: `<div class="section">
        ${A.pageHeader("Contratos", "Toda a carteira da DSC. A coluna Contratado indica se os dados vieram do SEI ou de cadastro manual; responsável em branco aparece como “não identificado”.", `${pr === "gestor" ? `<button class="btn primary" type="button" id="cadSei">${icon("add_link")}Cadastrar pelo processo SEI</button>` : ""}${A.exportMenu('data-export="carteira"', { cls: "btn outline", alignRight: true })}`)}
        <div class="filters-grid">
          <div class="span-2">${A.searchField("fBusca", "Número, objeto ou contratada", q.busca || "")}</div>
          ${A.selectField("fContratada", "Contratada", [["", "Todas"], ...[...new Set(D.CONTRATOS.map((c) => c.contratada))].map((c) => [c, c])], "")}
          ${A.selectField("fSit", "Situação contratual", [["", "Todas"], ["vigente", "Vigente"], ["vencendo", "Vence em até 90 dias"], ["encerrado", "Encerrada"], ["pendente", "Pendente de conferência"]], q.filtro || "")}
          ${A.selectField("fRegiao", "Região", [["", "Todas"], ...D.REGIOES.map((r) => [r, r])], q.regiao || "")}
          ${A.selectField("fResp", "Responsável", [["", "Todos"], ["__sem", "Não identificado"], ...[...new Set(D.CONTRATOS.map((c) => A.gestorDe(c.id)))].filter((r) => r !== "Não designado").map((r) => [r, r])], "")}
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
          if (v("fRegiao") && r.regiao !== v("fRegiao")) return false;
          if (v("fResp") === "__sem" && r.gestor !== "Não designado") return false;
          if (v("fResp") && v("fResp") !== "__sem" && r.gestor !== v("fResp")) return false;
          return true;
        });
        const t = A.mountTable(root.querySelector("#tContratos"), {
          caption: "contratos",
          rows, sortKey: "numero",
          empty: { icon: "search_off", title: "Nenhum contrato encontrado", desc: "Revise a busca ou limpe os filtros." },
          cols: [A.COLS_CONTRATO.contratoSei, A.COLS_CONTRATO.contratadaSei, A.COLS_CONTRATO.responsaveis, A.COLS_CONTRATO.vigenciaSei, A.COLS_CONTRATO.total, A.COLS_CONTRATO.executado, A.COLS_CONTRATO.saldo],
          onRow: (r) => A.go(pr + "/contrato/" + r.id),
          foot: (rs) => `<span>${rs.length} de ${D.CONTRATOS.length} contratos</span><span>Valor executado = notas fiscais lançadas; medições ficam para a próxima fase.</span>`,
        });
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
        root.querySelector("#fBusca").addEventListener("input", t.render);
        const cad = root.querySelector("#cadSei");
        if (cad) cad.addEventListener("click", () => cadastrarPorProcesso(t.render));
        root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
          const header = ["Contrato", "Objeto", "Contratado", "Origem", "Região", "Gestor", "Fiscal", "Início vigência", "Fim vigência", "Situação contratual", "Valor inicial", "Valor total", "Valor executado", "Saldo"];
          const data = rows().map((r) => [r.numero, r.c.objeto, r.contratada, A.ORIGEM_DADOS[r.origem][0], r.regiao, r.gestor === "Não designado" ? "não identificado" : r.gestor, r.fiscal || "não identificado", A.fmtDate(r.c.datas.inicioVigencia), A.fmtDate(r.fim), r.sit.label, r.fin.inicial, r.fin.total ?? "A conferir", r.fin.executado, r.fin.saldo ?? "não identificado"]);
          if (b.dataset.format === "csv") A.downloadCsv("carteira-contratos.csv", header, data);
          else A.downloadPdf("carteira-contratos.pdf", "Carteira de contratos", header, data, { money: [10, 11, 12, 13] });
        }));
      },
    };
  }

  /* Cadastro a partir do número do processo SEI (alinhamento de 27/10/2026). Simulado: a consulta devolve
     o que normalmente vem do SEI e marca o que precisa ser preenchido à mão. Na 1ª versão é tarefa da Equipe GCR. */
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
      kicker: "Equipe GCR", title: "Cadastrar contrato pelo processo SEI", wide: true,
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
            processos: [{ numero: achado.processo, papel: "Contratação", unidade: "DSC/GCR" }],
            datas: { assinatura: null, inicioExecucao: null, inicioVigencia: achado.inicio, fimVigencia: achado.fim },
            valores: { original: achado.valor, vigente: null, mesesVigencia: achado.meses, executado: 0 },
            postos: [], servicos: [], cadastro: "em_conferencia", notas: [], origemDados: "sei_conferencia", ois: false,
            qualidade: { origem: "Sugestão extraída do SEI", consulta: A.nowIso(), pendencias: 2 },
          };
          A.state.contratosNovos = (A.state.contratosNovos || []).concat([novo]);
          D.CONTRATOS.push(novo);
          A.addHistorico({ acao: "Cadastro pelo SEI", objeto: novo.numero, detalhe: `Processo ${achado.processo}. Dados sugeridos pelo SEI aguardam conferência.`, contratoId: id });
          A.save();
          layer.close();
          A.toast(`${novo.numero} cadastrado. Dados do SEI aguardam conferência.`, "add_link");
          A.refreshNav();
          if (onDone) onDone();
        }, true);
      },
    });
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

  /* ---------------- Mudanças e aditivos ---------------- */
  function telaMudancas() {
    const pr = base();
    return {
      title: "Mudanças e aditivos", nav: pr + "/mudancas", crumbs: [{ label: "Mudanças e aditivos" }],
      html: `<div class="section">
        ${A.pageHeader("Mudanças e aditivos", "Alterações confirmadas e novos eventos, com antes e depois e acesso à origem. Um novo evento não é uma mudança contratual.")}
        <div class="filters-grid">
          ${A.selectField("fPer", "Período", [["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Últimos 12 meses"]], "365")}
          ${A.selectField("fTipo", "Tipo", [["", "Todos"], ["aditivo", "Termo aditivo"], ["designacao", "Designação"], ["cadastro", "Cadastro e vigência"], ["evento", "Novo evento"]], "")}
          ${A.selectField("fCt", "Contrato", [["", "Todos"], ...D.CONTRATOS.map((c) => [c.id, c.numero])], "")}
          ${A.selectField("fSitM", "Situação", [["", "Todas"], ["confirmada", "Confirmada"], ["pendente_conferencia", "Pendente de conferência"], ["evento", "Novo evento"]], "")}
        </div>
        <div class="grid-main-side">
          <div id="mList"></div>
          <div class="panel flat">
            ${A.sectionTitle("Aditivos e reajustes em andamento", { icon: "post_add", sub: "Proposto ainda não vale; formalizado vale a partir da data de efeito." })}
            <div class="list">${A.state.aditivos.map((a) => `<div class="list-item" style="grid-template-columns:1fr auto"><div><div class="list-title">${esc(A.getContrato(a.contratoId).numero)} · ${esc(a.titulo)}</div><div class="list-desc">${esc(a.efeito)} · SEI ${esc(a.sei)}</div></div>${lpill("aditivo", a.situacao, "sm")}</div>`).join("")}
            ${A.state.reajustes.map((r) => `<div class="list-item" style="grid-template-columns:1fr auto"><div><div class="list-title">${esc(A.getContrato(r.contratoId).numero)} · ${esc(r.tipo)}</div><div class="list-desc">Data-base ${A.fmtDate(r.dataBase)} · ${esc(r.indice)}</div></div>${lpill("reajuste", r.situacao, "sm")}</div>`).join("")}</div>
          </div>
        </div>
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
    };
  }

  /* ---------------- Relatórios ---------------- */
  function telaRelatorios() {
    const pr = base();
    return {
      title: "Relatórios", nav: pr + "/relatorios", crumbs: [{ label: "Relatórios" }],
      html: `<div class="section">
        ${A.pageHeader("Relatórios", "Exportações geradas no navegador com os dados deste protótipo.")}
        <div class="grid-3">
          ${report("rCaixa", "inbox", "Caixa DSC", "Entradas com ação requerida, situação, com quem está, prazo, responsável e evidência.")}
          ${report("rRadar", "radar", "Radar de exceções", "Vencidos, parados, com terceiros, sem responsável, sem evidência, OIS e decisões do Diretor.")}
          ${report("rOis", "assignment", "OIS", "Cada OIS com as datas de solicitação, emissão, assinatura, execução e aceite.")}
          ${report("rCarteira", "inventory", "Resumo da carteira", "Contratos, situação contratual, valores e responsáveis.")}
          ${report("rMud", "difference", "Mudanças e aditivos", "Alterações com antes e depois, data, documento de origem e situação de conferência.")}
          ${report("rVenc", "event_upcoming", "Vencimentos e aditivos", "Fim de vigência, dias restantes e aditivo ou reajuste em andamento.")}
        </div>
        <div class="callout" style="margin-top:16px">${icon("info")}<div><strong>PDF para o processo SEI:</strong> a juntada ao processo formal depende de integração e do método de assinatura a definir. Indisponível neste protótipo.</div></div>
      </div>`,
      mount(root) {
        const S = A.state;
        const RELATORIOS = {
          rCaixa: () => ({ file: "caixa-dsc", title: "Caixa DSC",
            header: ["SEI", "Entrada", "Assunto", "Contrato", "Ação", "Precisa do Diretor", "Situação", "Com quem está", "Prazo", "Responsável"],
            rows: S.caixa.map((e) => [e.sei, A.fmtDate(e.entrada), e.assunto, e.contratoId ? A.getContrato(e.contratoId).numero : "—", e.acao ? A.L.acao[e.acao][0] : "A definir", e.precisaDiretor ? "Sim" : "Não", A.L.cx[e.situacao][0], A.cxAberta(e) ? e.aguardando || "—" : "—", e.prazo ? A.fmtDate(e.prazo.data) : "Sem prazo", e.responsavel ? A.userName(e.responsavel) : "Sem responsável"]) }),
          rRadar: () => ({ file: "radar-excecoes", title: "Radar de exceções",
            header: ["Grupo", "Exceção", "Contrato", "Problema", "Próxima ação", "Responsável", "Prazo"],
            rows: A.radarItens({ incluirSobrestados: true }).map((x) => [A.GRUPOS_RADAR.find((g) => g.key === x.grupo).label, x.titulo, x.contratoId ? A.getContrato(x.contratoId).numero : "—", x.motivo, x.proxima, x.responsavel || "Sem responsável", x.prazo ? A.fmtDate(x.prazo) : "—"]) }),
          rOis: () => ({ file: "ois", title: "Ordens de serviço (OIS)",
            header: ["OIS", "Contrato", "Competência", ...A.OIS_ETAPAS.map(([, l]) => l), "Alerta"],
            rows: S.ois.map((o) => [o.numero, A.getContrato(o.contratoId).numero, A.fmtComp(o.comp), ...A.OIS_ETAPAS.map(([k]) => (o.etapas[k] ? A.fmtDate(o.etapas[k]) : "—")), A.oisSemLastro(o) ? "Sem cobertura contratual" : A.oisAtraso(o) ? A.oisAtraso(o).texto : "—"]) }),
          rCarteira: () => ({ file: "resumo-carteira", title: "Resumo da carteira", money: [4, 5],
            header: ["Contrato", "Objeto", "Contratada", "Situação contratual", "Valor total", "Valor executado", "Gestor"],
            rows: D.CONTRATOS.map((c) => { const f = A.finContrato(c); return [c.numero, c.objeto, c.contratada, A.situacaoContratual(c).label, f.total ?? "Pendente", f.executado, A.gestorDe(c.id)]; }) }),
          rMud: () => ({ file: "mudancas-aditivos", title: "Mudanças e aditivos",
            header: ["Data", "Contrato", "Mudança", "Campo", "Antes", "Depois", "Origem SEI", "Situação"],
            rows: S.mudancas.flatMap((m) => (m.campos.length ? m.campos : [{ campo: "—", antes: "—", depois: "—" }]).map((f) => [A.fmtDate(m.data), A.getContrato(m.contratoId).numero, m.titulo, f.campo, f.antes, f.depois, (A.getDoc(m.origem.docId) || {}).sei || "—", m.situacao])) }),
          rVenc: () => ({ file: "vencimentos", title: "Vencimentos e aditivos",
            header: ["Contrato", "Objeto", "Fim da vigência", "Dias restantes", "Aditivo em andamento", "Reajuste"],
            rows: D.CONTRATOS.filter((c) => c.cadastro === "conferido").map((c) => { const ad = S.aditivos.find((a) => a.contratoId === c.id && a.situacao !== "vigente"); const rj = S.reajustes.find((r) => r.contratoId === c.id && r.situacao !== "aplicado"); return [c.numero, c.objeto, A.fmtDate(c.datas.fimVigencia), A.daysUntil(c.datas.fimVigencia), ad ? `${ad.titulo} (${A.L.aditivo[ad.situacao][0].toLowerCase()})` : "—", rj ? `${rj.tipo} (${A.L.reajuste[rj.situacao][0].toLowerCase()})` : "—"]; }) }),
        };
        root.querySelectorAll("[data-report]").forEach((b) => b.addEventListener("click", async () => {
          const r = RELATORIOS[b.dataset.report]();
          if (b.dataset.format === "csv") return A.downloadCsv(r.file + ".csv", r.header, r.rows);
          b.disabled = true;
          await A.downloadPdf(r.file + ".pdf", r.title, r.header, r.rows, { money: r.money });
          b.disabled = false;
        }));
      },
    };
  }
  function report(id, ic, t, d) {
    return `<div class="panel flat report-card"><span class="list-icon">${icon(ic)}</span><h4>${esc(t)}</h4><p>${esc(d)}</p><div class="btn-row">${A.exportMenu(`data-report="${id}"`)}</div></div>`;
  }

  PERFIS.forEach((pf) => {
    A.route(pf + "/visao-geral", pf, telaVisaoGeral);
    A.route(pf + "/contratos", pf, telaContratos);
    A.route(pf + "/mudancas", pf, telaMudancas);
    A.route(pf + "/relatorios", pf, telaRelatorios);
  });
  A.route("super/contrato/:id/:tab?", "super", (p) => A.fichaContrato("super/contrato", p.id, p.tab));
  // Endereço antigo da tela de riscos: agora é o Radar
  A.route("super/pendencias", "super", () => { setTimeout(() => A.go("super/radar"), 0); return { title: "Radar", html: "" }; });
})();
