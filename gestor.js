/* ============================================================
   Gestor/Fiscal: contratos designados, preparação guiada,
   configuração de itens e "De acordo" por item (4.2, 6, 7, 12.7)
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  const { esc, icon, pill, lpill, tipoTag, D } = A;

  const scopeIds = () => A.contratosVisiveis().map((c) => c.id);

  A.pendenciasGestor = function () {
    if (A.profileKey !== "gestor") return [];
    return scopeIds().flatMap((cid) => A.pendenciasContrato(cid).map((p) => Object.assign({ contratoId: cid }, p)));
  };

  function acaoPrincipal(cid) {
    const ac = A.acompanhamento(cid);
    if (A.itensDo(cid).some((i) => i.revisaoPendente)) return { label: "Revisar alteração", ic: "difference", href: `#/gestor/itens?contrato=${cid}`, revisar: true };
    if (ac === "nao_iniciado") return { label: "Iniciar acompanhamento", ic: "play_arrow", href: `#/gestor/preparar/${cid}` };
    if (ac === "em_preparacao" || ac === "parcial") return { label: "Continuar preparação", ic: "resume", href: `#/gestor/preparar/${cid}` };
    return { label: "Abrir ficha", ic: "description", href: `#/gestor/contrato/${cid}`, outline: true };
  }

  /* ---------------- Meus contratos ---------------- */
  A.route("gestor/meus-contratos", "gestor", () => { // fluxo de designação (P2), fora do menu
    const cs = A.contratosVisiveis();
    // Visão financeira dos contratos designados (alinhamento de 27/10/2026)
    const fs = cs.map((c) => ({ c, f: A.finContrato(c) }));
    const fin = fs.reduce((o, x) => ({ total: o.total + (x.f.total || 0), executado: o.executado + x.f.executado, saldo: o.saldo + (x.f.saldo || 0), notas: o.notas + x.f.notas.length }), { total: 0, executado: 0, saldo: 0, notas: 0 });
    const menorSaldo = fs.filter((x) => x.f.pct != null).sort((a, b) => b.f.pct - a.f.pct)[0];
    const emAteste = fs.flatMap((x) => x.f.notas.filter((n) => n.situacao === "em_ateste").map((n) => ({ c: x.c, n, vencido: A.compAdd(n.comp, 1) + "-15" < D.TODAY })));
    return {
      title: "Meus contratos", nav: "gestor/meus-contratos", crumbs: [{ label: "Meus contratos" }],
      html: `<div class="section">
        ${A.pageHeader("Meus contratos", "Contratos em que você possui designação ativa. Situação contratual e preparação do acompanhamento aparecem separadas.", `<a class="btn primary" href="#/gestor/preparar">${icon("playlist_add_check")}Preparar acompanhamento</a>`)}
        ${A.kpiHead("Visão geral dos meus contratos", "Clique para ver a composição")}
        <div class="kpi-grid">
          ${A.kpiCard({ tone: "blue", label: "Valor total dos contratos", value: A.moneyKpi(fin.total), sub: `${cs.length} contrato(s) · ${cs.filter((c) => A.minhaDesignacao(c.id).podeAceite).length} como gestor, ${cs.filter((c) => !A.minhaDesignacao(c.id).podeAceite).length} como fiscal`, foot: "Valores atualizados com aditivos" })}
          ${A.kpiCard({ tone: "teal", label: "Valor executado", value: A.moneyKpi(fin.executado), sub: `${fin.total ? Math.round((fin.executado / fin.total) * 100) : 0}% do valor total · ${fin.notas} nota(s)`, bar: fin.total ? (fin.executado / fin.total) * 100 : 0, foot: "Ver execução mês a mês", href: `#/gestor/contrato/${(cs[0] || {}).id}/financeiro` })}
          ${A.kpiCard({ tone: "green", label: "Saldo disponível", value: A.moneyKpi(fin.saldo), sub: menorSaldo ? `Menor saldo: ${esc(menorSaldo.c.numero)} (${100 - menorSaldo.f.pct}%)` : "Sem saldo apurado", foot: "Acompanhar consumo do contrato", href: menorSaldo ? `#/gestor/contrato/${menorSaldo.c.id}/financeiro` : "" })}
          ${A.kpiCard({ tone: "orange", label: "Notas em ateste", value: emAteste.length, sub: `${emAteste.filter((x) => x.vencido).length} com prazo de ateste vencido`, foot: emAteste.length ? `Atestar notas de ${A.fmtComp(D.ULTIMA_COMP_FECHADA, true).split(" de ")[0]}` : "Nenhuma nota aguardando", href: emAteste.length ? `#/gestor/contrato/${emAteste[0].c.id}/financeiro` : "" })}
          ${A.kpiCard({ tone: "red", label: "Pendências", value: A.pendenciasGestor().length, sub: `${cs.filter((c) => ["nao_iniciado", "em_preparacao", "parcial"].includes(A.acompanhamento(c.id))).length} contrato(s) com preparação pendente`, foot: "Documentos, obrigações, itens e tratativas", href: "#/gestor/pendencias" })}
        </div>
        <div id="tMeus"></div>
      </div>`,
      mount(root) {
        A.mountTable(root.querySelector("#tMeus"), {
          caption: "contratos",
          rows: cs.map((c) => Object.assign(A.contratoRow(c), { desig: A.minhaDesignacao(c.id) })),
          sortKey: "numero",
          empty: { icon: "folder_off", title: "Nenhuma designação ativa", desc: "Você verá os contratos aqui quando houver designação registrada com vigência." },
          cols: [
            { key: "numero", label: "Contrato", tdCls: "td-main", render: (r) => `<div class="cell-main sei-num">${esc(r.numero)}</div><div class="cell-sub">${esc(r.c.objeto)}</div><div class="cell-sub">${icon("badge", "cell-ic")}${esc(r.desig.papel)} · ${r.desig.podeAceite ? "pode dar o De acordo" : "sem De acordo"}</div>` },
            A.COLS_CONTRATO.vigenciaSei,
            A.COLS_CONTRATO.total,
            A.COLS_CONTRATO.executado,
            A.COLS_CONTRATO.saldo,
            { key: "acomp", label: "Preparação", render: (r) => `${lpill("acomp", r.acomp)}<div class="cell-sub">${r.pend.length ? `${r.pend.length} pendência(s)` : "Sem pendências"}</div>` },
            { key: "acao", label: "Ação", sortable: false, cls: "col-acao", tdCls: "cell-actions-td", render: (r) => { const a = acaoPrincipal(r.id); return `<div class="cell-actions">${A.actionIcon({ href: a.href, icon: a.ic, label: a.label })}</div>`; } },
          ],
          onRow: (r) => A.go("gestor/contrato/" + r.id),
        });
      },
    };
  });

  A.route("gestor/contrato/:id/:tab?", "gestor", (p) => A.fichaContrato("gestor/contrato", p.id, p.tab));

  /* ---------------- Preparar acompanhamento: escolha ---------------- */
  A.route("gestor/preparar", "gestor", () => {
    const cs = A.contratosVisiveis().filter((c) => A.acompanhamento(c.id) !== "encerrado");
    return {
      title: "Preparar acompanhamento", nav: "gestor/preparar", crumbs: [{ label: "Preparar acompanhamento" }],
      html: `<div class="section">
        ${A.pageHeader("Preparar acompanhamento", "Preparação guiada com salvamento parcial: conferir documentos, revisar obrigações, configurar itens e dar o De acordo.")}
        <div class="list">${cs.map((c) => {
          const a = acaoPrincipal(c.id);
          const obs = A.state.obrigacoes.filter((o) => o.contratoId === c.id);
          const dec = obs.filter((o) => o.decisao).length;
          const it = A.itensDo(c.id);
          return `<div class="list-item"><span class="list-icon">${icon("contract")}</span>
            <div><div class="list-title">${esc(c.numero)} · ${esc(c.objeto)}</div>
              <div class="list-meta"><span>${icon("domain")}${esc(c.contratada)}</span><span>${icon("rule")}${dec}/${obs.length} obrigações revisadas</span><span>${icon("fact_check")}${it.filter((i) => i.status.startsWith("ativo")).length}/${it.length} itens ativos</span><span>${icon("badge")}${esc(A.minhaDesignacao(c.id).papel)}</span></div>
              <div class="status-dims" style="margin-top:8px">${pill(A.situacaoContratual(c).label, A.situacaoContratual(c).tone)} ${lpill("acomp", A.acompanhamento(c.id))}</div>
            </div>
            <div class="list-side"><a class="btn ${a.outline ? "outline" : "primary"} sm" href="${a.revisar ? `#/gestor/itens?contrato=${c.id}` : `#/gestor/preparar/${c.id}`}">${icon(a.ic)}${esc(a.outline ? "Revisar preparação" : a.label)}</a></div></div>`;
        }).join("")}</div>
      </div>`,
    };
  });

  /* ---------------- Preparação guiada ---------------- */
  const STEPS = [["Conferir contrato", "Dados e documentos"], ["Revisar obrigações", "Propostas e origem"], ["Configurar itens", "Frequência e parâmetros"], ["De acordo", "Revisão final por item"]];

  function defaultEspecifico(tipo) {
    return {
      indicador: { fonte: "", campo: "", formula: "", unidade: "", janela: "Mês civil", agregacao: "", meta: "", tolerancia: "", excecoes: "" },
      entrega: { produto: "", quantidade: "", marco: "", criterioAceite: "" },
      documento: { tipoDoc: "", validade: "", antecedencia: "" },
      fiscalizacao: { checklist: "", evidenciasObrigatorias: "Foto e descrição para Não Conforme" },
    }[tipo];
  }
  const PERIODICIDADES = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual", "Por evento"];

  function criarItem(ob, nome) {
    const c = A.getContrato(ob.contratoId);
    const per = PERIODICIDADES.includes(ob.periodicidade) ? ob.periodicidade : "";
    const item = {
      id: A.uid("i"), contratoId: ob.contratoId, obrigacaoId: ob.id, nome: nome || ob.descricao, tipo: ob.tipo, status: "em_preparacao", versao: 1,
      config: {
        descricao: ob.descricao,
        abrangencia: ob.abrangencia === "Contrato" ? c.postos.filter((p) => !p.pendente).map((p) => p.id) : c.postos.filter((p) => !p.pendente).map((p) => p.id),
        responsaveis: { acompanha: "", responde: c.contratada.split(" ")[0] + " (preposto)", verifica: "" },
        vigencia: { inicio: A.NEXT_COMP, fim: c.datas.fimVigencia.slice(0, 7) },
        freq: { coleta: "", avaliacao: "", medicao: per, fechamentoDias: 5 },
        evidencia: "", criterio: "",
        tratativa: { prazoDias: "", verificacao: "" },
        financeiro: { situacao: /desconto/i.test(ob.descricao) ? "pendente" : "sem_regra", fundamento: "", formula: "" },
        especifico: defaultEspecifico(ob.tipo),
      },
      aceites: [],
    };
    A.state.itens.push(item);
    return item;
  }

  function prep(cid) {
    if (!A.state.preparacao[cid]) {
      A.state.preparacao[cid] = { step: 1, revisaoRegistrada: false, docsConferidos: A.docsDo(cid).filter((d) => d.conferencia === "conferido").map((d) => d.id), iniciadoEm: D.TODAY };
      A.addHistorico({ acao: "Início do acompanhamento", objeto: A.getContrato(cid).numero, detalhe: "Preparação guiada iniciada.", contratoId: cid });
      A.state.alertas.forEach((a) => { if (a.contratoId === cid && /sem acompanhamento/.test(a.titulo)) a.estado = "em_tratamento"; });
      A.save();
    }
    return A.state.preparacao[cid];
  }

  A.route("gestor/preparar/:id", "gestor", (p, q) => {
    const cid = p.id;
    const c = A.getContrato(cid);
    if (!c || !A.podeVerContrato(cid)) return A.fichaContrato("gestor/contrato", cid);
    const pr = prep(cid);
    if (q.etapa) pr.step = Math.min(4, Math.max(1, +q.etapa));
    const step = pr.step;
    const desig = A.minhaDesignacao(cid);
    // Etapa 3 sem nenhum item em preparação: não há o que levar para o De acordo
    const semItens = step === 3 && !A.itensDo(cid).some((i) => i.status === "em_preparacao" || i.status === "aguardando_aceite");
    return {
      title: c.numero, nav: "gestor/preparar",
      crumbs: [{ label: "Preparar acompanhamento", href: "#/gestor/preparar" }, { label: c.numero }],
      html: `<div class="section">
        ${A.pageHeader(`${c.numero} · ${c.objeto}`, `<strong>${esc(c.objeto)}</strong> · ${esc(c.contratada)} · Vigência ${A.fmtDate(c.datas.inicioVigencia)} a ${A.fmtDate(c.datas.fimVigencia)} · Sua designação: ${esc(desig.papel)}`, `<a class="btn outline" href="#/gestor/contrato/${cid}">${icon("description")}Ficha do contrato</a>`)}
        <ol class="stepper">${STEPS.map(([t, s], i) => `<li><button type="button" class="step ${i + 1 === step ? "active" : i + 1 < step ? "done" : ""}" data-step="${i + 1}" ${i + 1 === step ? 'aria-current="step"' : ""}><span class="step-num">${i + 1 < step ? icon("check") : i + 1}</span><span>${t}<small>${s}</small></span></button></li>`).join("")}</ol>
        <div id="stepBody"></div>
        <div class="wizard-foot">
          <span class="save-state" id="saveState">${icon("cloud_done")}Progresso salvo automaticamente neste navegador</span>
          <div class="page-actions">
            ${step > 1 ? `<button class="btn outline" type="button" data-go="${step - 1}">${icon("arrow_back")}Voltar</button>` : ""}
            ${step < 4 ? (semItens
              ? `<span data-tip="Confirme ao menos uma obrigação na etapa 2 para configurar itens." tabindex="0"><button class="btn primary" type="button" disabled>Avançar ${icon("arrow_forward")}</button></span>`
              : `<button class="btn primary" type="button" data-go="${step + 1}">Avançar ${icon("arrow_forward")}</button>`) : `<a class="btn primary" href="#/gestor/contrato/${cid}/obrigacoes">Concluir por agora</a>`}
          </div>
        </div>
      </div>`,
      mount(root) {
        const goStep = (n) => {
          pr.step = n; A.save();
          const target = `#/gestor/preparar/${cid}?etapa=${n}`;
          if (location.hash === target) A.renderRoute(); else location.hash = target;
        };
        root.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => goStep(+b.dataset.step)));
        root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => goStep(+b.dataset.go)));
        const body = root.querySelector("#stepBody");
        const markSaved = () => { const s = root.querySelector("#saveState"); s.innerHTML = `${icon("cloud_done")}Salvo às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; };
        [step1, step2, step3, step4][step - 1](body, c, pr, { markSaved, rerender: () => A.renderRoute() });
      },
    };
  });

  /* Etapa 1 — conferir contrato e documentos */
  function step1(body, c, pr, h) {
    const docs = A.docsDo(c.id);
    const sugest = (v, ok) => `${v} ${ok ? pill("Conferido", "success", "sm") : pill("Sugestão do SEI", "pending", "sm")}`;
    body.innerHTML = `
      <div class="callout" style="margin-bottom:16px">${icon("info")}<div>Os dados abaixo foram extraídos dos documentos acessíveis no SEI. Confira cada documento relevante; itens não conferidos continuam como sugestão e geram pendência, mas não impedem a preparação.</div></div>
      <div class="grid-2">
        <div class="panel flat">${A.sectionTitle("Dados básicos", { icon: "badge" })}
          <dl class="kv cols-2">
            <div><dt>Contrato</dt><dd>${sugest(esc(c.numero), true)}</dd></div>
            <div><dt>Contratada</dt><dd>${esc(c.contratada)}</dd></div>
            <div><dt>Início da execução</dt><dd>${sugest(A.fmtDate(c.datas.inicioExecucao), c.cadastro === "conferido")}</dd></div>
            <div><dt>Fim da vigência</dt><dd>${sugest(A.fmtDate(c.datas.fimVigencia), c.cadastro === "conferido")}</dd></div>
            <div><dt>Valor vigente</dt><dd>${A.fmtMoney(c.valores.vigente)}</dd></div>
            <div><dt>Abrangência</dt><dd>${c.postos.map((p) => esc(A.getPosto(p.id).nome)).join(", ") || "—"}</dd></div>
          </dl>
        </div>
        <div class="panel flat">${A.sectionTitle("Situação da conferência", { icon: "fact_check" })}
          <div class="money-split" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <div class="money-box"><strong id="nConf">${pr.docsConferidos.length}</strong><span>Documentos conferidos</span></div>
            <div class="money-box is-est"><strong id="nPend">${docs.length - pr.docsConferidos.length}</strong><span>Pendentes de conferência</span></div>
          </div>
        </div>
      </div>
      <div style="height:16px"></div>
      ${A.sectionTitle("Documentos do contrato", { icon: "description", sub: "Marque os que você conferiu. Documentos restritos no SEI não podem ser abertos por esta plataforma." })}
      <div class="list" id="docList">${docs.map((d) => `
        <label class="list-item" style="grid-template-columns:auto auto 1fr auto;cursor:pointer;align-items:center">
          <input type="checkbox" data-doc="${d.id}" ${pr.docsConferidos.includes(d.id) ? "checked" : ""} ${d.restrito ? "disabled" : ""} style="width:18px;height:18px;accent-color:var(--primary)"/>
          <span class="list-icon">${icon(d.restrito ? "lock" : "description")}</span>
          <span><span class="list-title">${esc(d.titulo)}</span><span class="list-meta"><span>SEI ${esc(d.sei)}</span><span>${esc(d.tipo)}</span><span>${A.fmtDate(d.data)}</span><span>Processo ${esc(d.processo)}</span></span></span>
          <span>${d.restrito ? pill("Acesso restrito", "outline") : lpill("assin", d.assinatura)}</span>
        </label>`).join("")}</div>`;
    body.querySelectorAll("[data-doc]").forEach((cb) => cb.addEventListener("change", () => {
      const id = cb.dataset.doc;
      pr.docsConferidos = cb.checked ? [...new Set([...pr.docsConferidos, id])] : pr.docsConferidos.filter((x) => x !== id);
      const d = A.getDoc(id);
      d.conferencia = cb.checked ? "conferido" : "pendente";
      if (cb.checked) A.addHistorico({ acao: "Conferência de documento", objeto: `SEI ${d.sei}`, detalhe: d.titulo, contratoId: c.id });
      A.save();
      body.querySelector("#nConf").textContent = pr.docsConferidos.length;
      body.querySelector("#nPend").textContent = docs.length - pr.docsConferidos.length;
      h.markSaved();
      A.refreshNav();
    }));
  }

  /* Etapa 2 — revisar obrigações com painel lateral de origem */
  function step2(body, c, pr, h) {
    let sel = (A.state.obrigacoes.find((o) => o.contratoId === c.id && !o.decisao) || A.state.obrigacoes.find((o) => o.contratoId === c.id) || {}).id;
    const draw = () => {
      const obs = A.state.obrigacoes.filter((o) => o.contratoId === c.id);
      const pend = obs.filter((o) => !o.decisao).length;
      const ob = obs.find((o) => o.id === sel);
      body.innerHTML = `
        <div class="prep-layout">
          <div class="stack">
            <div class="section-title"><div><h3>${icon("rule")}Obrigações e entregas propostas</h3><p>${obs.length} propostas · ${pend} sem decisão. A identificação assistida não é necessariamente completa.</p></div><button class="btn outline sm" type="button" id="addOb">${icon("add")}Adicionar compromisso</button></div>
            ${obs.length ? obs.map(obCard).join("") : A.emptyState({ icon: "rule", title: "Nenhuma proposta", desc: "Adicione os compromissos identificados manualmente." })}
            <label class="callout ${pr.revisaoRegistrada ? "success" : "warning"}" style="cursor:pointer">
              <input type="checkbox" id="revReg" ${pr.revisaoRegistrada ? "checked" : ""} style="margin-top:3px;accent-color:var(--primary)"/>
              <div><strong>Registrar revisão realizada.</strong> Revisei os documentos acessíveis e incluí os compromissos não identificados pela plataforma.</div>
            </label>
          </div>
          <aside class="source-panel" aria-label="Origem da obrigação selecionada">
            ${ob ? sourcePanel(ob) : A.emptyState({ icon: "description", title: "Selecione uma obrigação" })}
          </aside>
        </div>`;
      body.querySelectorAll("[data-sel]").forEach((el) => el.addEventListener("click", (e) => { if (e.target.closest("button")) return; sel = el.dataset.sel; draw(); }));
      body.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => decidir(b.dataset.ob, b.dataset.dec)));
      body.querySelector("#addOb").addEventListener("click", addOb);
      body.querySelector("#revReg").addEventListener("change", (e) => {
        pr.revisaoRegistrada = e.target.checked;
        if (pr.revisaoRegistrada) A.addHistorico({ acao: "Revisão de obrigações registrada", objeto: c.numero, detalhe: `${obs.length} propostas revisadas.`, contratoId: c.id });
        A.save(); h.markSaved(); draw();
      });
    };

    function obCard(o) {
      const it = A.state.itens.filter((i) => i.obrigacaoId === o.id && i.status !== "descartado");
      const d = o.decisao;
      return `<div class="ob-card ${o.id === sel ? "is-selected" : ""} ${d && d.acao === "nao_aplica" ? "is-discarded" : ""}" data-sel="${o.id}" tabindex="0">
        <div class="ob-head"><div><div class="ob-title">${esc(o.descricao)}</div>
          <div class="cell-sub" style="margin-top:4px">${o.clausula ? `${icon("description")} ${esc(o.clausula)} · ${esc((A.getDoc(o.docId) || {}).titulo || "")}` : `<strong style="color:var(--warning-text)">Origem não identificada nos documentos</strong>`}</div></div>
          ${d ? lpill("decisao", d.acao) : pill("Pendente de revisão", "pending")}</div>
        <div class="ob-meta">${tipoTag(o.tipo)}<span class="tag">${icon("location_on")}${esc(o.abrangencia)}</span><span class="tag">${icon("event_repeat")}${esc(o.periodicidade)}</span>${o.prazo && o.prazo !== "—" ? `<span class="tag">${icon("timer")}${esc(o.prazo)}</span>` : ""}</div>
        ${o.ausentes.length ? `<div class="ob-missing">${o.ausentes.map((x) => pill(x, "pending", "sm")).join("")}</div>` : ""}
        ${d && d.justificativa ? `<div class="cell-sub"><strong>Justificativa:</strong> ${esc(d.justificativa)}</div>` : ""}
        ${it.length ? `<div class="cell-sub">${icon("subdirectory_arrow_right")} Itens: ${it.map((i) => esc(i.nome) + " (" + A.L.item[i.status][0] + ")").join("; ")}</div>` : ""}
        <div class="ob-actions">${d
          ? (it.some((i) => i.status.startsWith("ativo")) ? `<span class="cell-sub">Decisão vinculada a item ativo. Alterações exigem nova versão.</span>` : `<button class="btn ghost sm" type="button" data-ob="${o.id}" data-dec="desfazer">${icon("undo")}Desfazer decisão</button>`)
          : `<button class="btn primary sm" type="button" data-ob="${o.id}" data-dec="confirmada">${icon("check")}Confirmar</button>
             <button class="btn outline sm" type="button" data-ob="${o.id}" data-dec="ajustada">${icon("edit")}Ajustar</button>
             ${A.moreMenu([
               `<button type="button" data-ob="${o.id}" data-dec="desdobrada">${icon("call_split")}Desdobrar</button>`,
               `<button type="button" data-ob="${o.id}" data-dec="relacionada">${icon("link")}Relacionar</button>`,
               `<button type="button" class="danger" data-ob="${o.id}" data-dec="nao_aplica">${icon("block")}Não se aplica</button>`,
             ])}`}</div>
      </div>`;
    }

    function sourcePanel(o) {
      const d = A.getDoc(o.docId);
      return `<span class="kicker">Origem da proposta</span>
        <h4 style="margin-top:6px">${d ? esc(d.titulo) : "Sem documento de origem"}</h4>
        ${d ? `<div class="cell-sub">SEI ${esc(d.sei)} · ${A.fmtDate(d.data)} · ${lpill("conf", d.conferencia, "sm")}</div>` : ""}
        <div class="doc-excerpt">${D.TRECHOS[o.id] || "Trecho não disponível para esta proposta."}</div>
        <dl class="kv cols-2"><div><dt>Cláusula / item</dt><dd>${o.clausula ? esc(o.clausula) : pill("Não identificada", "pending")}</dd></div><div><dt>Tipo sugerido</dt><dd>${tipoTag(o.tipo)}</dd></div><div><dt>Abrangência</dt><dd>${esc(o.abrangencia)}</dd></div><div><dt>Periodicidade</dt><dd>${esc(o.periodicidade)}</dd></div></dl>
        ${o.ausentes.length ? `<div style="margin-top:12px" class="callout warning">${icon("help")}<div><strong>Informações ausentes ou ambíguas:</strong><br>${o.ausentes.map(esc).join("<br>")}</div></div>` : ""}
        ${!o.clausula ? `<div style="margin-top:12px" class="callout danger">${icon("gavel")}<div>Sem fundamento, a regra contratual não pode ser aprovada. Indique a cláusula ao confirmar ou marque como “não se aplica”.</div></div>` : ""}`;
    }

    function registrar(o, acao, extra) {
      o.decisao = Object.assign({ acao, por: A.currentUser().id, em: D.TODAY }, extra || {});
      A.addHistorico({ acao: "Obrigação " + A.L.decisao[acao][0].toLowerCase(), objeto: o.descricao, detalhe: extra && extra.justificativa ? extra.justificativa : "", contratoId: o.contratoId });
      A.save(); h.markSaved(); A.refreshNav(); draw();
    }

    function decidir(obId, acao) {
      const o = A.state.obrigacoes.find((x) => x.id === obId);
      if (acao === "desfazer") {
        A.state.itens.filter((i) => i.obrigacaoId === o.id && !i.status.startsWith("ativo")).forEach((i) => { A.state.itens.splice(A.state.itens.indexOf(i), 1); });
        A.addHistorico({ acao: "Decisão desfeita", objeto: o.descricao, contratoId: o.contratoId });
        o.decisao = null; A.save(); draw(); return;
      }
      if (acao === "confirmada") {
        if (!o.clausula) {
          return A.openModal({
            title: "Informar o fundamento", subtitle: "A proposta não tem origem identificada.",
            body: `<div class="form-field"><label for="fClaus">Cláusula, item e documento <span class="field-req">*</span></label><input class="input" id="fClaus" placeholder="Ex.: Anexo II, item 2.4"/></div><div class="form-field"><label for="fDoc">Documento</label><select class="select" id="fDoc">${A.docsDo(o.contratoId).map((d) => `<option value="${d.id}">SEI ${esc(d.sei)} — ${esc(d.titulo)}</option>`).join("")}</select></div>`,
            actions: [{ label: "Confirmar com fundamento", cls: "primary", onClick: (l) => { const v = l.el.querySelector("#fClaus").value.trim(); if (!v) { l.el.querySelector("#fClaus").classList.add("is-missing"); return false; } o.clausula = v; o.docId = l.el.querySelector("#fDoc").value; criarItem(o); registrar(o, "confirmada"); } }],
          });
        }
        criarItem(o); registrar(o, "confirmada");
        A.toast("Obrigação confirmada. Item criado em preparação.");
        return;
      }
      if (acao === "ajustada") {
        return A.openModal({
          title: "Ajustar obrigação", subtitle: "A proposta original permanece registrada no histórico.",
          body: `<div class="form-field"><label for="aDesc">Descrição</label><textarea class="textarea" id="aDesc">${esc(o.descricao)}</textarea></div>
            <div class="form-grid">${A.selectField("aTipo", "Tipo de acompanhamento", Object.entries(A.L.tipo).map(([k, v]) => [k, v[0]]), o.tipo)}${A.selectField("aPer", "Periodicidade", PERIODICIDADES, PERIODICIDADES.includes(o.periodicidade) ? o.periodicidade : "Mensal")}</div>
            <div class="form-field"><label for="aJust">Justificativa do ajuste <span class="field-req">*</span></label><textarea class="textarea" id="aJust"></textarea></div>`,
          actions: [{ label: "Salvar ajuste", cls: "primary", onClick: (l) => {
            const j = l.el.querySelector("#aJust").value.trim();
            if (!j) { l.el.querySelector("#aJust").classList.add("is-missing"); return false; }
            o.descricao = l.el.querySelector("#aDesc").value.trim() || o.descricao;
            o.tipo = l.el.querySelector("#aTipo").value; o.periodicidade = l.el.querySelector("#aPer").value;
            criarItem(o); registrar(o, "ajustada", { justificativa: j });
          } }],
        });
      }
      if (acao === "desdobrada") {
        return A.openModal({
          title: "Desdobrar em itens menores", subtitle: esc(o.descricao),
          body: `<div class="form-field"><label for="d1">Item 1</label><input class="input" id="d1" value="${esc(o.descricao)} — parte 1"/></div><div class="form-field"><label for="d2">Item 2</label><input class="input" id="d2" value="${esc(o.descricao)} — parte 2"/></div><div class="form-field"><label for="dJ">Justificativa <span class="field-req">*</span></label><textarea class="textarea" id="dJ" placeholder="Ex.: prazos distintos para emergencial e urgente"></textarea></div>`,
          actions: [{ label: "Desdobrar", cls: "primary", icon: "call_split", onClick: (l) => {
            const j = l.el.querySelector("#dJ").value.trim();
            if (!j) { l.el.querySelector("#dJ").classList.add("is-missing"); return false; }
            criarItem(o, l.el.querySelector("#d1").value.trim()); criarItem(o, l.el.querySelector("#d2").value.trim());
            registrar(o, "desdobrada", { justificativa: j });
          } }],
        });
      }
      if (acao === "relacionada") {
        const outras = A.state.obrigacoes.filter((x) => x.contratoId === o.contratoId && x.id !== o.id);
        return A.openModal({
          title: "Relacionar a outra obrigação", subtitle: "Use quando o compromisso já está coberto por outro item.",
          body: `${A.selectField("rOb", "Obrigação relacionada", outras.map((x) => [x.id, x.descricao]), "")}<div class="form-field"><label for="rJ">Justificativa <span class="field-req">*</span></label><textarea class="textarea" id="rJ"></textarea></div>`,
          actions: [{ label: "Relacionar", cls: "primary", onClick: (l) => {
            const j = l.el.querySelector("#rJ").value.trim();
            if (!j) { l.el.querySelector("#rJ").classList.add("is-missing"); return false; }
            registrar(o, "relacionada", { justificativa: j, relacionadaA: l.el.querySelector("#rOb").value });
          } }],
        });
      }
      if (acao === "nao_aplica") {
        return A.confirmModal({
          title: "Indicar que não se aplica", subtitle: esc(o.descricao),
          body: `<p>A proposta continuará rastreável com a justificativa e não gerará item de acompanhamento.</p>`,
          requireText: "Justificativa", confirmLabel: "Registrar não aplicação", confirmCls: "primary",
          onConfirm: (j) => registrar(o, "nao_aplica", { justificativa: j }),
        });
      }
    }

    function addOb() {
      A.openModal({
        title: "Adicionar compromisso não identificado", subtitle: c.numero,
        body: `<div class="form-field"><label for="nDesc">Descrição <span class="field-req">*</span></label><textarea class="textarea" id="nDesc"></textarea></div>
          <div class="form-grid">${A.selectField("nTipo", "Tipo", Object.entries(A.L.tipo).map(([k, v]) => [k, v[0]]), "entrega")}${A.selectField("nPer", "Periodicidade", PERIODICIDADES, "Mensal")}</div>
          <div class="form-grid"><div class="form-field"><label for="nClaus">Cláusula / item</label><input class="input" id="nClaus" placeholder="Deixe vazio se não houver referência"/></div>${A.selectField("nDoc", "Documento", [["", "Sem documento"], ...A.docsDo(c.id).map((d) => [d.id, "SEI " + d.sei + " — " + d.titulo])], "")}</div>`,
        actions: [{ label: "Adicionar", cls: "primary", icon: "add", onClick: (l) => {
          const v = l.el.querySelector("#nDesc").value.trim();
          if (!v) { l.el.querySelector("#nDesc").classList.add("is-missing"); return false; }
          const claus = l.el.querySelector("#nClaus").value.trim();
          const o = { id: A.uid("ob"), contratoId: c.id, descricao: v, docId: l.el.querySelector("#nDoc").value || null, clausula: claus || null, tipo: l.el.querySelector("#nTipo").value, abrangencia: "Contrato", periodicidade: l.el.querySelector("#nPer").value, prazo: "—", ausentes: claus ? [] : ["Cláusula de origem"], decisao: null, manual: true };
          A.state.obrigacoes.push(o);
          sel = o.id;
          A.addHistorico({ acao: "Compromisso incluído manualmente", objeto: v, contratoId: c.id });
          A.save(); draw();
        } }],
      });
    }
    draw();
  }

  /* Etapa 3 — configurar cada item */
  function step3(body, c, pr, h) {
    const lista = () => A.itensDo(c.id).filter((i) => i.status === "em_preparacao" || i.status === "aguardando_aceite");
    let sel = (lista()[0] || {}).id;
    const draw = () => {
      const its = lista();
      const item = A.getItem(sel);
      if (!its.length) {
        body.innerHTML = A.emptyState({ icon: "playlist_add_check", title: "Nenhum item em preparação", desc: "Confirme obrigações na etapa 2 para criar itens. Itens já ativos são alterados por nova versão.", action: `<button class="btn primary sm" type="button" id="toStep2">${icon("arrow_back")}Revisar obrigações</button>` });
        body.querySelector("#toStep2").addEventListener("click", () => { pr.step = 2; A.save(); A.renderRoute(); });
        return;
      }
      body.innerHTML = `<div class="prep-layout is-items">
        <aside class="stack-sm">
          <span class="kicker">Itens em preparação</span>
          ${its.map((i) => { const r = A.readiness(i); const ok = r.filter((x) => x.ok).length; return `<button type="button" class="list-item clickable ${i.id === sel ? "is-selected" : ""}" data-it="${i.id}" style="grid-template-columns:auto 1fr;text-align:left;${i.id === sel ? "border-color:var(--primary-line);background:var(--tint-primary)" : ""}"><span class="list-icon ${ok === r.length ? "success" : "warning"}">${icon((A.L.tipo[i.tipo] || [])[1] || "tune")}</span><span><span class="list-title">${esc(i.nome)}</span><span class="list-meta"><span>${ok}/${r.length} requisitos</span>${lpill("item", i.status, "sm")}</span></span></button>`; }).join("")}
        </aside>
        <div id="itemForm"></div>
      </div>`;
      body.querySelectorAll("[data-it]").forEach((b) => b.addEventListener("click", () => { sel = b.dataset.it; draw(); }));
      if (item) itemForm(body.querySelector("#itemForm"), item, { onChange: () => { h.markSaved(); refreshSide(); } , redraw: draw });
      function refreshSide() {
        body.querySelectorAll("[data-it]").forEach((b) => { const i = A.getItem(b.dataset.it); const r = A.readiness(i); const ok = r.filter((x) => x.ok).length; b.querySelector(".list-meta span").textContent = `${ok}/${r.length} requisitos`; b.querySelector(".list-icon").className = "list-icon " + (ok === r.length ? "success" : "warning"); });
      }
    };
    draw();
  }

  function itemForm(el, item, h) {
    const c = A.getContrato(item.contratoId);
    const cfg = item.config;
    const ob = A.state.obrigacoes.find((o) => o.id === item.obrigacaoId);
    const verificadores = [...new Set(D.DESIGNACOES.filter((d) => d.contratoId === c.id && (!d.fim || d.fim >= D.TODAY)).map((d) => d.userId))];
    const comps = Array.from({ length: 8 }, (_, i) => A.compAdd(A.NEXT_COMP, i));
    const f = (path, label, o = {}) => {
      const val = path.split(".").reduce((x, k) => (x ? x[k] : ""), item) ?? "";
      const miss = o.req && !val ? "is-missing" : "";
      if (o.type === "select") return `<div class="form-field ${o.cls || ""}"><label for="f_${path}">${esc(label)}${o.req ? ' <span class="field-req">*</span>' : ""}</label><select class="select ${miss}" id="f_${path}" data-path="${path}">${o.options.map((op) => { const [v, t] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select>${o.hint ? `<span class="field-hint">${o.hint}</span>` : ""}</div>`;
      if (o.type === "textarea") return `<div class="form-field ${o.cls || ""}"><label for="f_${path}">${esc(label)}${o.req ? ' <span class="field-req">*</span>' : ""}</label><textarea class="textarea ${miss}" id="f_${path}" data-path="${path}" placeholder="${esc(o.ph || "")}">${esc(val)}</textarea>${o.hint ? `<span class="field-hint">${o.hint}</span>` : ""}</div>`;
      return `<div class="form-field ${o.cls || ""}"><label for="f_${path}">${esc(label)}${o.req ? ' <span class="field-req">*</span>' : ""}</label><input class="input ${miss}" id="f_${path}" data-path="${path}" type="${o.type || "text"}" value="${esc(val)}" placeholder="${esc(o.ph || "")}"/>${o.hint ? `<span class="field-hint">${o.hint}</span>` : ""}</div>`;
    };
    const esp = {
      indicador: `<div class="form-grid cols-3">${f("config.especifico.fonte", "Fonte", { req: true, ph: "Ex.: CCO, planilha da contratada" })}${f("config.especifico.campo", "Campo", { ph: "Ex.: tempo_atendimento_emergencial" })}${f("config.especifico.unidade", "Unidade", { ph: "h, min, %" })}${f("config.especifico.formula", "Fórmula", { req: true, cls: "full", ph: "Ex.: chamados atendidos em até 4h ÷ chamados emergenciais" })}${f("config.especifico.janela", "Janela")}${f("config.especifico.agregacao", "Agregação", { ph: "Ex.: ponderada por chamados" })}${f("config.especifico.meta", "Meta", { req: true })}${f("config.especifico.tolerancia", "Tolerância")}${f("config.especifico.excecoes", "Exceções", { cls: "full", type: "textarea", ph: "Ex.: chamados abertos fora do horário contratual" })}</div>`,
      entrega: `<div class="form-grid">${f("config.especifico.produto", "Produto esperado", { req: true })}${f("config.especifico.quantidade", "Quantidade")}${f("config.especifico.marco", "Marco / data", { req: true, ph: "Ex.: 5º dia útil" })}${f("config.especifico.criterioAceite", "Critério de aceite")}</div>`,
      documento: `<div class="form-grid cols-3">${f("config.especifico.tipoDoc", "Tipo de documento", { req: true })}${f("config.especifico.validade", "Validade atual", { req: true, type: "date" })}${f("config.especifico.antecedencia", "Antecedência de renovação", { req: true, ph: "Ex.: 30 dias" })}</div>`,
      fiscalizacao: `<div class="form-grid">${f("config.especifico.checklist", "Checklist versionado", { req: true, type: "select", options: [["", "Selecione"], ...Object.values(D.CHECKLISTS).map((k) => [k.id, k.nome + " (" + k.versao + ")"])] })}${f("config.especifico.evidenciasObrigatorias", "Evidências obrigatórias")}</div><p class="field-hint" style="margin-top:8px">Respostas previstas: Conforme, Não Conforme, Não se aplica e Inverificável Remotamente. Não Conforme exige foto e descrição.</p>`,
    }[item.tipo];

    el.innerHTML = `<div class="stack">
      <div class="callout ${item.status === "aguardando_aceite" ? "success" : ""}">${icon(item.status === "aguardando_aceite" ? "task_alt" : "info")}<div>${item.status === "aguardando_aceite" ? "Item pronto. Siga para a etapa 4 para revisar e dar o De acordo." : "Enquanto estiver em preparação, o item não gera tarefas nem medições oficiais."}</div></div>
      <!-- Etapa 3 simplificada (alinhamento de 27/10/2026): só o essencial à vista; o resto vem preenchido do contrato -->
      <fieldset class="fieldset"><legend>${icon("star")}O essencial</legend>
        <div class="form-grid">${f("nome", "Nome do item", { req: true, cls: "full" })}</div>
        <div style="margin-top:12px"><span class="field-label">Postos abrangidos <span class="field-req">*</span></span>
        <div class="check-row" style="margin:6px 0 14px">${c.postos.length ? c.postos.map((p) => `<label class="check-chip"><input type="checkbox" data-posto="${p.id}" ${cfg.abrangencia.includes(p.id) ? "checked" : ""}/>${esc(A.getPosto(p.id).nome)}${p.pendente ? " (a partir de " + A.fmtDate(p.desde) + ")" : ""}</label>`).join("") : `<span class="cell-sub">Contrato sem postos cadastrados.</span>`}</div></div>
        <div class="form-grid cols-3">
          ${f("config.responsaveis.acompanha", "Quem acompanha (Operação)", { req: true, type: "select", options: [["", "Selecione"], ["camila", "Camila Nunes"], ["bruno", "Bruno Teles"]] })}
          ${f("config.responsaveis.verifica", "Quem verifica", { req: true, type: "select", options: [["", "Selecione"], ...verificadores.map((u) => [u, A.userName(u)])] })}
          ${f("config.vigencia.inicio", "Vale a partir de", { req: true, type: "select", options: comps.map((x) => [x, A.fmtComp(x)]), hint: "Sem medições retroativas." })}
          ${f("config.freq.medicao", "Medição", { req: true, type: "select", options: [["", "Selecione"], ...PERIODICIDADES] })}
          ${f("config.financeiro.situacao", "Regra de desconto", { type: "select", options: [["sem_regra", "Sem regra financeira aplicável"], ["pendente", "Regra pendente de validação"], ["validada", "Regra validada"]] })}
        </div>
        <div class="form-grid" style="margin-top:12px">${f("config.criterio", "Critério de cumprimento", { req: true, type: "textarea", cls: "full" })}</div>
      </fieldset>
      <details class="more-details" id="moreDetails">
        <summary>${icon("tune")}<span>Mais detalhes</span><small>Preenchidos a partir do contrato · revise se precisar</small><span class="more-miss" id="moreMiss"></span>${icon("expand_more", "more-caret")}</summary>
        <div class="stack" style="margin-top:12px">
          <fieldset class="fieldset"><legend>${icon("badge")}Identificação e fundamento</legend>
            <div class="form-grid">${f("tipo", "Tipo", { type: "select", options: Object.entries(A.L.tipo).map(([k, v]) => [k, v[0]]) })}${f("config.descricao", "Descrição verificável", { type: "textarea", cls: "full" })}</div>
            <div style="margin-top:10px">${ob && ob.clausula ? `<span class="field-label">Fundamento</span><div>${esc(ob.clausula)} · ${A.docSource(ob.docId)}</div>` : `<div class="callout danger">${icon("gavel")}<div>Fundamento ausente. Resolva antes da aprovação da regra contratual.</div></div>`}</div>
          </fieldset>
          <fieldset class="fieldset"><legend>${icon("event_repeat")}Responsável da contratada e frequências</legend>
            <div class="form-grid cols-4">
              ${f("config.responsaveis.responde", "Quem responde", { ph: "Preposto da contratada" })}
              ${f("config.vigencia.fim", "Até", { type: "month" })}
              ${f("config.freq.coleta", "Coleta", { ph: "Ex.: Diária (CCO, D-1)" })}
              ${f("config.freq.avaliacao", "Avaliação", { ph: "Ex.: Mensal, por posto" })}
              ${f("config.freq.fechamentoDias", "Prazo de fechamento (dias)", { type: "number" })}
            </div>
          </fieldset>
          <fieldset class="fieldset"><legend>${icon("rule")}Evidência e tratativa</legend>
            <div class="form-grid">
              ${f("config.evidencia", "Evidência exigida", { req: true, type: "textarea", ph: "Dados, documentos ou registros necessários" })}
              ${f("config.tratativa.prazoDias", "Prazo de correção (dias)", { type: "number" })}
              ${f("config.tratativa.verificacao", "Condição de verificação")}
            </div>
          </fieldset>
          <fieldset class="fieldset"><legend>${icon((A.L.tipo[item.tipo] || [])[1] || "tune")}Parâmetros de ${esc(A.L.tipo[item.tipo][0].toLowerCase())}</legend>${esp}</fieldset>
          <fieldset class="fieldset"><legend>${icon("payments")}Regra de desconto em detalhe</legend>
            <div class="form-grid">
              ${f("config.financeiro.fundamento", "Fundamento da regra", { ph: "Ex.: Anexo III (IMR), item 3" })}
              ${f("config.financeiro.formula", "Base, fórmula, limites e cumulatividade", { type: "textarea", cls: "full" })}
            </div>
          </fieldset>
        </div>
      </details>
      <div class="panel flat">${A.sectionTitle("O que falta para o De acordo", { icon: "checklist" })}<div id="readyBox">${A.readinessHtml(item)}</div>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" type="button" id="markReady">${icon("task_alt")}Marcar como pronto para o De acordo</button></div></div>
    </div>`;

    const syncMore = () => {
      const det = el.querySelector("#moreDetails");
      const n = det.querySelectorAll(".is-missing").length;
      el.querySelector("#moreMiss").textContent = n ? `${n} campo(s) a preencher` : "";
      if (n) det.open = true;
    };
    syncMore();
    const setPath = (path, v) => { const ks = path.split("."); let o = item; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = v; };
    const after = () => {
      if (item.status === "aguardando_aceite" && A.readiness(item).some((r) => !r.ok)) item.status = "em_preparacao";
      A.save();
      el.querySelector("#readyBox").innerHTML = A.readinessHtml(item);
      h.onChange();
    };
    el.querySelectorAll("[data-path]").forEach((inp) => inp.addEventListener("change", () => {
      let v = inp.value;
      if (inp.type === "number") v = v === "" ? "" : +v;
      setPath(inp.dataset.path, v);
      inp.classList.remove("is-missing");
      syncMore();
      if (inp.dataset.path === "tipo") { item.config.especifico = defaultEspecifico(v); A.save(); h.redraw(); return; }
      after();
    }));
    el.querySelectorAll("[data-posto]").forEach((cb) => cb.addEventListener("change", () => {
      cfg.abrangencia = cb.checked ? [...new Set([...cfg.abrangencia, cb.dataset.posto])] : cfg.abrangencia.filter((x) => x !== cb.dataset.posto);
      after();
    }));
    el.querySelector("#markReady").addEventListener("click", () => {
      const falta = A.readiness(item).filter((r) => !r.ok);
      if (falta.length) { A.toast("Ainda faltam: " + falta.map((x) => x.label).join(", "), "error"); return; }
      item.status = "aguardando_aceite";
      A.addHistorico({ acao: "Item pronto para aceite", objeto: item.nome, contratoId: item.contratoId });
      A.save(); A.refreshNav(); A.toast("Item pronto para o De acordo."); h.redraw();
    });
  }

  /* Etapa 4 — revisão final e De acordo por item */
  function step4(body, c) {
    const pode = A.podeDarAceite(c.id);
    const its = A.itensDo(c.id).filter((i) => i.status !== "descartado");
    body.innerHTML = `
      ${pode ? `<div class="callout">${icon("verified")}<div>O aceite é por item: os itens prontos podem ser liberados agora e os demais continuam em preparação. O sistema registra usuário, data, função, versão e documentos.</div></div>`
        : `<div class="callout danger">${icon("lock")}<div>Sua designação neste contrato (${esc(A.minhaDesignacao(c.id).papel)}) não permite dar o De acordo. O aceite cabe a ${esc(A.gestorDe(c.id))}.</div></div>`}
      <div class="stack" style="margin-top:16px">${its.map((i) => {
        const r = A.readiness(i);
        const pronto = r.every((x) => x.ok);
        const ativo = i.status.startsWith("ativo");
        return `<div class="panel flat">
          <div class="section-title"><div><h3>${icon((A.L.tipo[i.tipo] || [])[1])}${esc(i.nome)}</h3><p>${tipoTag(i.tipo)} · versão ${i.versao}</p></div>${lpill("item", i.status)}</div>
          <dl class="kv">
            <div><dt>Regra</dt><dd>${esc(i.config.criterio || "—")}</dd></div>
            <div><dt>Responsáveis</dt><dd>Acompanha: ${esc(A.userName(i.config.responsaveis.acompanha) || "—")}<br>Verifica: ${esc(A.userName(i.config.responsaveis.verifica) || "—")}</dd></div>
            <div><dt>Abrangência</dt><dd>${i.config.abrangencia.map((p) => esc(A.getPosto(p).nome)).join(", ") || "—"}</dd></div>
            <div><dt>Frequência</dt><dd>Medição ${esc(i.config.freq.medicao || "—")} · fechamento em ${esc(i.config.freq.fechamentoDias || "—")} dias</dd></div>
            <div><dt>Evidências</dt><dd>${esc(i.config.evidencia || "—")}</dd></div>
            <div><dt>Efeito financeiro</dt><dd>${A.finCfgPill(i.config.financeiro.situacao)}</dd></div>
          </dl>
          ${ativo ? `<div class="cell-sub" style="margin-top:10px">${icon("verified")} De acordo de ${esc(A.userName(i.aceites[i.aceites.length - 1].usuario))} em ${A.fmtDateTime(i.aceites[i.aceites.length - 1].data)}</div>`
            : `<div style="margin-top:12px">${pronto ? "" : A.readinessHtml(i)}</div>
               <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
                 <button class="btn primary" type="button" data-aceite="${i.id}" ${pronto && pode ? "" : "disabled"}>${icon("verified")}Dar De acordo</button>
                 ${pronto ? "" : `<span class="cell-sub" style="align-self:center">Complete os requisitos na etapa 3.</span>`}
               </div>`}
        </div>`;
      }).join("") || A.emptyState({ icon: "playlist_add", title: "Nenhum item configurado" })}</div>`;
    body.querySelectorAll("[data-aceite]").forEach((b) => b.addEventListener("click", () => darAceite(b.dataset.aceite)));
  }

  function darAceite(itemId) {
    const item = A.getItem(itemId);
    const ob = A.state.obrigacoes.find((o) => o.id === item.obrigacaoId);
    const docs = [ob && A.getDoc(ob.docId)].filter(Boolean);
    const fin = item.config.financeiro.situacao;
    const comps = Array.from({ length: 4 }, (_, i) => A.compAdd(A.NEXT_COMP, i));
    const inicio = item.config.vigencia.inicio >= A.NEXT_COMP ? item.config.vigencia.inicio : A.NEXT_COMP;
    A.openModal({
      wide: true, kicker: A.getContrato(item.contratoId).numero + " · De acordo",
      title: "Confirmar o que será aprovado",
      subtitle: `${esc(item.nome)} · versão ${item.versao}`,
      body: `
        <div class="drawer-section" style="padding:0;border:0">${A.itemConfigHtml(item)}</div>
        <div class="form-grid">${A.selectField("acComp", "Data de aplicação (primeira competência)", comps.map((x) => [x, A.fmtComp(x, true)]), inicio, { cls: "" })}
          <div class="form-field"><span class="field-label">Situação após o aceite</span><div>${fin === "pendente" ? pill("Ativo, sem cálculo financeiro", "teal") : pill("Ativo", "success")}</div></div></div>
        <div class="callout">${icon("event")}<div>A Operação receberá o item e a programação a partir da competência escolhida. <strong>Nenhuma medição retroativa será criada.</strong></div></div>
        <div class="callout">${icon("description")}<div>Documentos que fundamentam: ${docs.length ? docs.map((d) => `SEI ${esc(d.sei)} — ${esc(d.titulo)}`).join("; ") : "fundamento informado manualmente"}.</div></div>`,
      actions: [{ label: "Dar De acordo", cls: "primary", icon: "verified", onClick: (l) => {
        const comp = l.el.querySelector("#acComp").value;
        item.status = fin === "pendente" ? "ativo_sem_financeiro" : "ativo";
        item.config.vigencia.inicio = comp;
        item.aceites.push({ versao: item.versao, usuario: A.currentUser().id, funcao: A.minhaDesignacao(item.contratoId).papel, data: A.nowIso(), aplicacao: comp, docs: docs.map((d) => d.sei) });
        if (!A.state.medicoes.some((m) => m.itemId === item.id && m.comp === comp)) {
          A.state.medicoes.push({ id: A.uid("m"), itemId: item.id, comp, status: "programada", prazo: "no_prazo", fechamentoAte: null, versaoRegra: item.versao, financeiro: { situacao: fin === "validada" ? "sem_calculo" : fin === "pendente" ? "pendente" : "sem_regra" } });
        }
        A.addHistorico({ acao: "De acordo", objeto: `${item.nome} (v${item.versao})`, detalhe: `Item liberado para a Operação a partir de ${A.fmtComp(comp)}.`, contratoId: item.contratoId });
        A.save(); A.refreshNav();
        A.toast("De acordo registrado. Item liberado para a Operação.", "verified");
        A.renderRoute();
      } }],
    });
  }

  /* ---------------- Itens e aprovações ---------------- */
  A.route("gestor/itens", "gestor", (p, q) => ({
    title: "Itens e aprovações", nav: "gestor/itens", crumbs: [{ label: "Itens e aprovações" }],
    html: `<div class="section">
      ${A.pageHeader("Itens e aprovações", "Itens de acompanhamento dos seus contratos, com versão, aceite e alterações em revisão.")}
      <div class="filters-grid">
        ${A.selectField("fCt", "Contrato", [["", "Todos"], ...A.contratosVisiveis().map((c) => [c.id, c.numero])], q.contrato || "")}
        ${A.selectField("fSt", "Situação", [["", "Todas"], ["pendentes", "Pendentes de aceite ou revisão"], ...Object.entries(A.L.item).map(([k, v]) => [k, v[0]])], "")}
        ${A.selectField("fTp", "Tipo", [["", "Todos"], ...Object.entries(A.L.tipo).map(([k, v]) => [k, v[0]])], "")}
      </div>
      <div id="tIt"></div>
    </div>`,
    mount(root) {
      const v = (id) => root.querySelector("#" + id).value;
      const t = A.mountTable(root.querySelector("#tIt"), {
        caption: "itens",
        rows: () => A.state.itens.filter((i) => scopeIds().includes(i.contratoId) && (!v("fCt") || i.contratoId === v("fCt")) && (!v("fTp") || i.tipo === v("fTp")) && (!v("fSt") || (v("fSt") === "pendentes" ? (i.revisaoPendente || i.status === "em_preparacao" || i.status === "aguardando_aceite") : i.status === v("fSt")))),
        sortKey: "contratoId",
        empty: { icon: "fact_check", title: "Nenhum item neste filtro" },
        cols: [
          { key: "nome", label: "Item", tdCls: "td-main", render: (i) => `<div class="cell-main">${esc(i.nome)}</div><div class="cell-sub">${esc(A.getContrato(i.contratoId).numero)} · ${tipoTag(i.tipo)}</div>` },
          { key: "versao", label: "Versão", render: (i) => `v${i.versao}${i.revisaoPendente ? `<div>${pill("v" + i.revisaoPendente.versao + " em revisão", "pending", "sm")}</div>` : ""}` },
          { key: "status", label: "Situação", render: (i) => lpill("item", i.status) },
          { key: "fin", label: "Efeito financeiro", sortable: false, render: (i) => A.finCfgPill(i.config.financeiro.situacao) },
          { key: "aceite", label: "Último De acordo", sortValue: (i) => (i.aceites[i.aceites.length - 1] || {}).data, render: (i) => { const a = i.aceites[i.aceites.length - 1]; return a ? `${esc(A.userName(a.usuario))}<div class="cell-sub">${A.fmtDateTime(a.data)} · desde ${A.fmtComp(a.aplicacao)}</div>` : `<span class="muted">—</span>`; } },
          { key: "acao", label: "Ação", sortable: false, cls: "col-acao", tdCls: "cell-actions-td", render: (i) => `<div class="cell-actions">${i.revisaoPendente ? A.actionIcon({ icon: "difference", label: "Revisar alteração", attrs: `data-rev="${i.id}"` }) : i.status === "em_preparacao" || i.status === "aguardando_aceite" ? A.actionIcon({ href: `#/gestor/preparar/${i.contratoId}?etapa=${i.status === "aguardando_aceite" ? 4 : 3}`, icon: i.status === "aguardando_aceite" ? "verified" : "edit", label: i.status === "aguardando_aceite" ? "Dar De acordo" : "Configurar" }) : A.actionIcon({ icon: "visibility", label: "Ver configuração", attrs: `data-cfg="${i.id}"` })}</div>` },
        ],
        onRow: (i) => A.openItemConfig(i.id),
        afterRender(el) {
          el.querySelectorAll("[data-rev]").forEach((b) => b.addEventListener("click", () => A.openRevisao(b.dataset.rev)));
          el.querySelectorAll("[data-cfg]").forEach((b) => b.addEventListener("click", () => A.openItemConfig(b.dataset.cfg)));
        },
      });
      root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
    },
  }));

  /* ---------------- Documentos e processos ---------------- */
  A.route("gestor/documentos", "gestor", () => {
    const ids = scopeIds();
    const docs = D.DOCUMENTOS.filter((d) => ids.includes(d.contratoId));
    return {
      title: "Documentos e processos", nav: "gestor/documentos", crumbs: [{ label: "Documentos e processos" }],
      html: `<div class="section">
        ${A.pageHeader("Documentos e processos", "Ofícios, ordens de serviço, notas fiscais, aditivos e datas principais, com vínculo aos processos SEI.")}
        <div class="grid-2" style="margin-bottom:16px">
          <div class="panel flat">${A.sectionTitle("Datas principais", { icon: "event" })}
            <div class="list">${A.contratosVisiveis().map((c) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon("event")}</span><div><div class="list-title">${esc(c.numero)}</div><div class="list-desc">Execução desde ${A.fmtDate(c.datas.inicioExecucao)} · vigência até ${A.fmtDate(c.datas.fimVigencia)}</div></div>${pill(A.situacaoContratual(c).label, A.situacaoContratual(c).tone)}</div>`).join("")}</div>
          </div>
          <div class="panel flat">${A.sectionTitle("Processos vinculados", { icon: "folder" })}
            <div class="list">${A.contratosVisiveis().flatMap((c) => c.processos.map((p) => `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="list-icon">${icon("folder")}</span><div><div class="list-title">${A.procLink(p.numero, c.id)}</div><div class="list-desc">${esc(c.numero)} · ${esc(p.unidade)}</div></div><span class="tag info">${esc(p.papel)}</span></div>`)).join("")}</div>
          </div>
        </div>
        <div class="filters-grid">
          <div class="span-2">${A.searchField("fB", "Buscar por número SEI ou título")}</div>
          ${A.selectField("fT", "Tipo", [["", "Todos"], ...[...new Set(docs.map((d) => d.tipo))].map((t) => [t, t])], "")}
          ${A.selectField("fC", "Contrato", [["", "Todos"], ...A.contratosVisiveis().map((c) => [c.id, c.numero])], "")}
          ${A.selectField("fCf", "Conferência", [["", "Todas"], ["pendente", "Pendente"], ["conferido", "Conferido"]], "")}
        </div>
        <div id="tD"></div>
      </div>`,
      mount(root) {
        const v = (id) => root.querySelector("#" + id).value;
        const t = A.mountTable(root.querySelector("#tD"), {
          caption: "documentos",
          rows: () => docs.filter((d) => (!v("fT") || d.tipo === v("fT")) && (!v("fC") || d.contratoId === v("fC")) && (!v("fCf") || d.conferencia === v("fCf")) && (!v("fB") || (d.sei + " " + d.titulo).toLowerCase().includes(v("fB").toLowerCase()))),
          sortKey: "data", sortDir: -1,
          empty: { icon: "description", title: "Nenhum documento encontrado" },
          cols: [
            { key: "titulo", label: "Documento", tdCls: "td-main", render: (d) => `<div class="cell-main">${d.restrito ? icon("lock") + " " : ""}${esc(d.titulo)}</div><div class="cell-sub">SEI ${esc(d.sei)} · Processo ${esc(d.processo)}</div>` },
            { key: "tipo", label: "Tipo", render: (d) => `<span class="tag">${esc(d.tipo)}</span>` },
            { key: "contratoId", label: "Contrato", render: (d) => esc(A.getContrato(d.contratoId).numero) },
            { key: "data", label: "Data", cls: "nowrap", render: (d) => A.fmtDate(d.data) },
            { key: "assinatura", label: "Assinatura", render: (d) => lpill("assin", d.assinatura) },
            { key: "conferencia", label: "Conferência", render: (d) => (d.restrito ? pill("Acesso restrito", "outline") : lpill("conf", d.conferencia)) },
          ],
          onRow: (d) => A.go(`gestor/contrato/${d.contratoId}/instrumentos`),
        });
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
        root.querySelector("#fB").addEventListener("input", t.render);
      },
    };
  });

  /* ---------------- Pendências ---------------- */
  A.route("gestor/pendencias", "gestor", () => {
    const ps = A.pendenciasGestor();
    const tipos = [...new Set(ps.map((p) => p.tipo))];
    return {
      title: "Pendências", nav: "gestor/pendencias", crumbs: [{ label: "Pendências" }],
      html: `<div class="section">
        ${A.pageHeader("Pendências", "Pendências de preparação, conferência, aceite e tratativas dos contratos sob sua responsabilidade.")}
        <div class="filters-grid">${A.selectField("fTipo", "Tipo", [["", "Todos"], ...tipos.map((t) => [t, t])], "")}${A.selectField("fCt", "Contrato", [["", "Todos"], ...A.contratosVisiveis().map((c) => [c.id, c.numero])], "")}</div>
        <div id="pList"></div>
      </div>`,
      mount(root) {
        const draw = () => {
          const t = root.querySelector("#fTipo").value, ct = root.querySelector("#fCt").value;
          const rows = ps.filter((p) => (!t || p.tipo === t) && (!ct || p.contratoId === ct));
          A.mountPagedList(root.querySelector("#pList"), {
            rows,
            empty: { icon: "task_alt", title: "Sem pendências", desc: "Nada pendente neste filtro." },
            renderItem: (p) => {
            const c = A.getContrato(p.contratoId);
            const link = p.tipo === "Preparação" ? `#/gestor/preparar/${c.id}?etapa=2` : p.tipo === "Aceite" ? `#/gestor/preparar/${c.id}?etapa=3` : p.tipo === "Alteração" ? `#/gestor/itens?contrato=${c.id}` : p.tipo === "Documento" ? `#/gestor/contrato/${c.id}/instrumentos` : `#/gestor/contrato/${c.id}/pendencias`;
            return `<a class="list-item clickable" href="${link}" style="grid-template-columns:auto 1fr auto;text-decoration:none;color:inherit"><span class="list-icon ${p.tone}">${icon(p.ic)}</span><div><div class="list-title">${esc(p.texto)}</div><div class="list-meta"><span>${icon("description")}${esc(c.numero)} · ${esc(c.objeto)}</span></div></div><span class="tag">${esc(p.tipo)}</span></a>`;
            },
          });
        };
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", draw));
        draw();
      },
    };
  });

  /* ---------------- Histórico ---------------- */
  A.route("gestor/historico", "gestor", () => {
    const ids = scopeIds();
    return {
      title: "Histórico", nav: "gestor/historico", crumbs: [{ label: "Histórico" }],
      html: `<div class="section">
        ${A.pageHeader("Histórico de versões e mudanças", "Decisões, aceites, versões, designações e consultas registradas nos seus contratos.")}
        <div class="filters-grid">${A.selectField("fCt", "Contrato", [["", "Todos"], ...A.contratosVisiveis().map((c) => [c.id, c.numero])], "")}${A.selectField("fAc", "Ação", [["", "Todas"], ...[...new Set(A.state.historico.map((h) => h.acao))].map((a) => [a, a])], "")}</div>
        <div id="hList"></div>
      </div>`,
      mount(root) {
        const draw = () => {
          const ct = root.querySelector("#fCt").value, ac = root.querySelector("#fAc").value;
          const hs = A.state.historico.filter((h) => (!h.contratoId || ids.includes(h.contratoId)) && (!ct || h.contratoId === ct) && (!ac || h.acao === ac));
          root.querySelector("#hList").innerHTML = hs.length ? `<ul class="timeline">${hs.map((h) => A.histItem(Object.assign({}, h, { objeto: (h.contratoId && !String(h.objeto).includes(A.getContrato(h.contratoId).numero) ? A.getContrato(h.contratoId).numero + " · " : "") + h.objeto }))).join("")}</ul>` : A.emptyState({ icon: "history", title: "Sem registros neste filtro" });
        };
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", draw));
        draw();
      },
    };
  });
})();
