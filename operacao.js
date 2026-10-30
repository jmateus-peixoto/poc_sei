/* ============================================================
   Operação: fila de trabalho, indicadores do CCO, fiscalização,
   ocorrências e tratativas, medições e evidências (4.3, 8, 9, 10, 12.8)
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  const { esc, icon, pill, lpill, tipoTag, D } = A;

  const scopeIds = () => A.contratosVisiveis().map((c) => c.id);
  const itensAtivos = () => A.state.itens.filter((i) => scopeIds().includes(i.contratoId) && i.status.startsWith("ativo"));
  const fotosMem = {}; // object URLs das fotos tiradas nesta sessão

  /* Valores de uma medição: estimado vem da regra validada; confirmado só após validação */
  A.medValores = function (m) {
    const f = m.financeiro;
    if (f.estimado != null || f.confirmado != null) return { estimado: f.estimado ?? null, confirmado: f.confirmado ?? null };
    if (["estimada", "risco", "em_validacao"].includes(f.situacao)) {
      const g = A.glosaEstimada(m.itemId, m.comp);
      return { estimado: g ? g.total : null, confirmado: null };
    }
    return { estimado: null, confirmado: null };
  };
  const medDe = (itemId, comp) => A.state.medicoes.find((m) => m.itemId === itemId && m.comp === comp);

  /* ---------------- Linhas da fila de trabalho ---------------- */
  function workRows(comp) {
    const rows = [];
    itensAtivos().forEach((item) => {
      if (item.config.vigencia.inicio > comp) return;
      const med = medDe(item.id, comp);
      const prazo = med ? med : null;
      const fin = item.config.financeiro.situacao;
      const base = { item, comp, med: prazo, contrato: A.getContrato(item.contratoId) };
      if (item.tipo === "indicador") {
        const g = A.glosaEstimada(item.id, comp);
        item.config.abrangencia.forEach((pid) => {
          const r = A.computeIndicator(item.id, pid, comp);
          const esp = item.config.especifico;
          let sit;
          if (r.status === "sem_dados") sit = { label: r.fonteExterna ? "Aguardando a fonte" : "Sem dados", tone: "nodata" };
          else if (r.status === "fora") sit = { label: r.parcial ? "Fora do critério (parcial)" : "Fora do critério", tone: "danger" };
          else sit = { label: r.parcial ? "Conforme (parcial)" : "Conforme", tone: "success" };
          const gl = g && g.linhas.find((l) => l.postoId === pid);
          rows.push(Object.assign({}, base, {
            postoId: pid, posto: A.getPosto(pid).nome,
            resultado: r.valor != null ? `${A.fmtNum(r.valor)} ${esp.unidade}` : null, valorNum: r.valor,
            referencia: `${esp.sentido === "min" ? "≥" : "≤"} ${esp.meta} ${esp.unidade}`,
            cobertura: r.fonteExterna ? null : r.cobertura, cobInfo: r,
            evidencia: r.fonteExterna ? esp.fonte : `CCO D-1 · ${r.validos}/${r.previstos} dias`,
            sit, impacto: impacto(fin, r.status === "fora", gl ? gl.valor : null, med),
            acao: r.status !== "conforme" || (r.cobertura < 1 && !r.fonteExterna),
          }));
        });
      } else if (item.tipo === "entrega") {
        const entregue = comp < A.CURRENT_COMP;
        rows.push(Object.assign({}, base, {
          postoId: null, posto: "Contrato (todos)",
          resultado: entregue ? "Entregue" : null, valorNum: null,
          referencia: item.config.especifico.marco, cobertura: null,
          evidencia: entregue ? "Documento no SEI" : "Aguardando documento",
          sit: entregue ? { label: "Conforme", tone: "success" } : { label: "Aguardando entrega", tone: "pending" },
          impacto: impacto(fin, false, null, med), acao: !entregue,
        }));
      } else if (item.tipo === "fiscalizacao") {
        item.config.abrangencia.forEach((pid) => {
          const fs = A.state.fiscalizacoes.filter((f) => f.itemId === item.id && f.postoId === pid && f.data.startsWith(comp)).sort((a, b) => (a.data < b.data ? 1 : -1));
          const f = fs[0];
          const nc = f ? Object.values(f.respostas).filter((x) => x.r === "NC").length : 0;
          let sit;
          if (!f) sit = comp < A.CURRENT_COMP ? { label: "Sem inspeção no período", tone: "neutral" } : { label: "Inspeção a realizar", tone: "pending" };
          else if (f.status === "rascunho") sit = { label: "Inspeção em rascunho", tone: "info" };
          else sit = nc ? { label: `${nc} não conformidade(s)`, tone: "danger" } : { label: "Conforme", tone: "success" };
          rows.push(Object.assign({}, base, {
            postoId: pid, posto: A.getPosto(pid).nome, fisc: f,
            resultado: f ? `${Object.keys(f.respostas).length}/${D.CHECKLISTS[f.checklist].itens.length} itens` : null, valorNum: null,
            referencia: "Checklist " + (D.CHECKLISTS[item.config.especifico.checklist] || {}).versao, cobertura: null,
            evidencia: f ? `${f.id}${f.sincronizada ? "" : " · não sincronizada"}` : "—",
            sit, impacto: impacto(fin, nc > 0, null, med), acao: !f || nc > 0 || f.status === "rascunho",
          }));
        });
      }
    });
    return rows;
  }
  function impacto(fin, desvio, valor, med) {
    if (fin === "sem_regra") return { label: "Sem regra financeira", tone: "outline" };
    if (fin === "pendente") return { label: "Regra pendente", tone: "pending" };
    if (med && med.status === "fechada") return { label: A.L.fin[med.financeiro.situacao][0], tone: A.L.fin[med.financeiro.situacao][1] };
    if (desvio && valor) return { label: "Estimada " + A.fmtMoney(valor), tone: "warning" };
    if (desvio) return { label: "Risco identificado", tone: "warning" };
    return { label: "Sem efeito", tone: "neutral" };
  }

  function coverageCell(v) {
    if (v == null) return `<span class="muted">—</span>`;
    const pct = Math.round(v * 100);
    return `<div class="coverage"><div class="coverage-label"><strong>${pct}%</strong><span>${pct < 100 ? "incompleta" : "completa"}</span></div><div class="bar ${pct < 90 ? "danger" : pct < 100 ? "warning" : "success"}"><span style="width:${pct}%"></span></div></div>`;
  }

  /* ---------------- Região (alinhamento de 27/10/2026: um contrato por região, 7 regiões) ---------------- */
  const regiaoDe = (cid) => (A.getContrato(cid) || {}).regiao;
  const regiaoField = (q = {}) => A.selectField("fRegiao", "Região", [["", "Todas"], ...D.REGIOES.map((r) => [r, r])], q.regiao || "");
  const contratoField = (q = {}) => A.selectField("fCt", "Contrato", [["", "Todos"], ...A.contratosVisiveis().map((c) => [c.id, `${c.numero} · ${c.regiao}`])], q.contrato || "");
  // Filtro de região e contrato que toda tela da Operação aplica
  const okFiltro = (root, cid) => { const g = (id) => (root.querySelector("#" + id) || {}).value || ""; return (!g("fRegiao") || regiaoDe(cid) === g("fRegiao")) && (!g("fCt") || cid === g("fCt")); };
  A.okFiltroOp = okFiltro;

  /* Chave do indicador de um item (TME, TMA… ou o nome do item quando não é um indicador do CCO) */
  const indKey = (item) => { const k = item.nome.split(" ")[0]; return D.INDICADORES.some((i) => i.id === k) ? k : item.nome; };

  /* ---------------- Visão operacional ---------------- */
  A.route("op/visao", "op", (p, q) => {
    const comps = [A.compAdd(A.CURRENT_COMP, -1), A.CURRENT_COMP];
    return {
      title: "Visão operacional", nav: "op/visao",
      html: `<div class="section">
        ${A.pageHeader("Minha fila de trabalho", `Como está a operação: postos, indicadores e medições. Dados do CCO cobrem até ${A.fmtDate(D.CCO_COVERAGE_END)} (D-1), coletados em ${A.fmtDateTime(D.CCO_LAST_PULL)}.`, `<a class="btn primary" href="#/op/fiscalizacoes?nova=1">${icon("add_task")}Nova fiscalização</a>`)}
        <div class="filters-grid">
          ${regiaoField(q)}
          ${contratoField(q)}
          ${A.selectField("fComp", "Competência", comps.map((c) => [c, A.fmtComp(c) + (c === A.CURRENT_COMP ? " (em curso)" : "")]), q.comp || comps[0])}
          ${A.selectField("fPosto", "Posto", [["", "Todos"], ...[...new Set(itensAtivos().flatMap((i) => i.config.abrangencia))].map((p2) => [p2, A.getPosto(p2).nome])], "")}
          ${A.selectField("fTipo", "Tipo de item", [["", "Todos"], ...Object.entries(A.L.tipo).map(([k, v]) => [k, v[0]])], "")}
          ${A.selectField("fSit", "Situação", [["acao", "Exigem ação"], ["", "Todas"], ["danger", "Fora do critério"], ["nodata", "Sem dados"], ["success", "Conforme"]], "acao")}
        </div>
        <div id="opBody"></div>
      </div>`,
      mount(root) {
        const v = (id) => root.querySelector("#" + id).value;
        const draw = () => {
          const comp = v("fComp");
          const all = workRows(comp).filter((r) => okFiltro(root, r.item.contratoId) && (!v("fPosto") || r.postoId === v("fPosto")) && (!v("fTipo") || r.item.tipo === v("fTipo")));
          const rows = all.filter((r) => !v("fSit") || (v("fSit") === "acao" ? r.acao : r.sit.tone === v("fSit")));
          const cts = A.contratosVisiveis().filter((c) => okFiltro(root, c.id));
          const ids = cts.map((c) => c.id);
          const ccoRows = all.filter((r) => r.cobertura != null);
          const cobMedia = ccoRows.length ? ccoRows.reduce((s2, r) => s2 + r.cobertura, 0) / ccoRows.length : null;
          // Postos: com problema = algum item fora do critério, com não conformidade ou sem dados
          const postos = {};
          all.filter((r) => r.postoId).forEach((r) => {
            const key = r.contrato.id + "|" + r.postoId; // o mesmo posto pode ser atendido por mais de um contrato
            const p2 = (postos[key] = postos[key] || { id: r.postoId, nome: r.posto, contrato: r.contrato, fora: 0, semDados: 0, total: 0 });
            p2.total++; if (r.sit.tone === "danger") p2.fora++; if (r.sit.tone === "nodata") p2.semDados++;
          });
          const listaPostos = Object.values(postos);
          const comProblema = listaPostos.filter((p2) => p2.fora || p2.semDados);
          const ranking = listaPostos.filter((p2) => p2.fora || p2.semDados).sort((a, b) => b.fora - a.fora || b.semDados - a.semDados).slice(0, 5);
          // Indicadores: resultado por posto, agrupado por indicador
          const indRows = all.filter((r) => r.item.tipo === "indicador");
          const conf = indRows.filter((r) => r.sit.tone === "success").length, fora = indRows.filter((r) => r.sit.tone === "danger").length, semD = indRows.filter((r) => r.sit.tone === "nodata").length;
          const pctOk = indRows.length ? Math.round((conf / indRows.length) * 100) : null;
          const porInd = {};
          indRows.forEach((r) => {
            const k = indKey(r.item);
            const o = (porInd[k] = porInd[k] || { k, nome: r.item.nome, total: 0, fora: 0, semDados: 0, glosa: 0, itens: new Set() });
            o.total++; if (r.sit.tone === "danger") o.fora++; if (r.sit.tone === "nodata") o.semDados++;
            if (!o.itens.has(r.item.id)) { o.itens.add(r.item.id); const g = A.glosaEstimada(r.item.id, comp); o.glosa += g ? g.total : 0; }
          });
          const inds = Object.values(porInd).sort((a, b) => b.glosa - a.glosa || b.fora / b.total - a.fora / a.total);
          const pior = inds.find((o) => o.fora) || null;
          const semMedicao = D.INDICADORES.filter((i) => !porInd[i.id]);
          // Medições da competência
          const meds = A.state.medicoes.filter((m) => { const it = A.getItem(m.itemId); return it && ids.includes(it.contratoId) && m.comp === comp; });
          const concl = meds.filter((m) => m.status === "fechada").length;
          const vencidas = A.state.ocorrencias.filter((o) => ids.includes(o.contratoId) && o.status === "vencida").length;
          const gl = A.resumoGlosas(ids);
          const pctPizza = (n) => (indRows.length ? (n / indRows.length) * 100 : 0);
          const body = root.querySelector("#opBody");
          body.innerHTML = `
            ${A.kpiHead("Como está a operação em " + A.fmtComp(comp, true), "")}
            <div class="kpi-grid">
              ${A.kpiCard({ tone: "red", label: "Postos com problema", value: `${comProblema.length} <small>de ${listaPostos.length}</small>`, sub: `${listaPostos.filter((p2) => p2.fora).length} fora do critério · ${listaPostos.filter((p2) => !p2.fora && p2.semDados).length} sem dados`, foot: "Ver ranking de postos", href: "#rankPostos" })}
              ${A.kpiCard({ tone: "green", label: "Indicadores dentro da meta", value: pctOk == null ? "—" : `${pctOk}<small>%</small>`, sub: `${conf} de ${indRows.length} resultados por posto`, bar: pctOk, foot: pior ? `${esc(pior.k)} é o que mais preocupa` : "Nenhum indicador fora da meta", href: "#situacaoInd" })}
              ${A.kpiCard({ tone: "teal", label: "Medições concluídas", value: `${concl} <small>de ${meds.length}</small>`, sub: `${meds.length - concl} ainda não concluída(s)`, bar: meds.length ? (concl / meds.length) * 100 : 0, foot: "Ver medições", href: "#/op/medicoes?de=visao" })}
              ${A.kpiCard({ tone: "orange", label: "Tratativas vencidas", value: vencidas, sub: "Vencimento não confirma desconto", foot: "Ver ocorrências", href: "#/op/ocorrencias?st=vencida" })}
              ${A.kpiCard({ tone: "blue", label: "Dias com dados do CCO", value: cobMedia == null ? "—" : `${Math.round(cobMedia * 100)}<small>%</small>`, sub: `${ccoRows.filter((r) => r.cobertura < 1).length} posto(s) com dias faltando`, foot: "Ver indicadores", href: "#/op/indicadores", info: "Quantos dias do mês já têm dados do CCO. Exemplo: 23 de 26 dias úteis = 88%. Dia sem dado fica fora da conta, não vira zero." })}
            </div>

            <div class="op-dash">
              <div class="panel flat" id="situacaoInd">
                ${A.sectionTitle("Situação por indicador", { icon: "monitoring", sub: "O que está bem e o que está mal nos postos medidos" })}
                <div class="ind-list">${inds.map((o) => { const tone = o.fora ? "danger" : o.semDados ? "nodata" : "success"; const ok = o.total - o.fora - o.semDados; return `<div class="ind-row is-${tone}">
                  <div class="ind-name"><strong>${esc(o.k)}</strong><span>${esc(o.nome)}</span></div>
                  <div class="ind-bar"><span class="ok" style="width:${(ok / o.total) * 100}%"></span><span class="bad" style="width:${(o.fora / o.total) * 100}%"></span><span class="nd" style="width:${(o.semDados / o.total) * 100}%"></span></div>
                  <div class="ind-status">${pill(o.fora ? `Fora em ${o.fora} de ${o.total}` : o.semDados ? `Sem dados em ${o.semDados}` : "Dentro da meta", tone, "sm")}${o === pior && o.glosa ? `<span class="ind-flag">${icon("warning")}Maior risco de glosa · ${A.fmtMoney0(o.glosa)}</span>` : ""}</div>
                </div>`; }).join("") || A.emptyState({ icon: "monitoring", title: "Nenhum indicador nos filtros" })}
                ${semMedicao.map((i) => `<div class="ind-row is-off"><div class="ind-name"><strong>${esc(i.id)}</strong><span>${esc(i.nome)}</span></div><div class="ind-bar"></div><div class="ind-status">${pill(i.definicao === "pendente" ? "Definição pendente" : "Sem fonte de dados", "outline", "sm")}</div></div>`).join("")}</div>
              </div>
              <div class="panel flat">
                ${A.sectionTitle("Resultado dos indicadores", { icon: "donut_large", sub: "Resultados por posto na competência" })}
                ${indRows.length ? `<div class="pie-wrap"><div class="pie" style="background:conic-gradient(#6b8a1c 0 ${pctPizza(conf)}%, #a63131 ${pctPizza(conf)}% ${pctPizza(conf + fora)}%, #8796a3 ${pctPizza(conf + fora)}% 100%)"><span><strong>${pctOk}%</strong><small>na meta</small></span></div>
                  <ul class="pie-legend"><li><i style="background:#6b8a1c"></i>Dentro da meta <strong>${conf}</strong></li><li><i style="background:#a63131"></i>Fora do critério <strong>${fora}</strong></li><li><i style="background:#8796a3"></i>Sem dados <strong>${semD}</strong></li></ul></div>` : A.emptyState({ icon: "donut_large", title: "Sem resultados de indicador" })}
              </div>
              <div class="panel flat" id="rankPostos">
                ${A.sectionTitle("Postos mais fora do critério", { icon: "leaderboard", sub: "Ranking por itens fora do critério e sem dados" })}
                ${ranking.length ? `<ol class="rank">${ranking.map((p2, i) => `<li><span class="rank-n">${i + 1}</span><div class="rank-main"><strong>${esc(p2.nome)}</strong><span>${esc(p2.contrato.numero)} · ${esc(p2.contrato.regiao)}</span><div class="rank-bar"><span class="bad" style="width:${(p2.fora / p2.total) * 100}%"></span><span class="nd" style="width:${(p2.semDados / p2.total) * 100}%"></span></div></div><span class="rank-val">${p2.fora ? `${p2.fora} fora` : ""}${p2.fora && p2.semDados ? " · " : ""}${p2.semDados ? `${p2.semDados} sem dados` : ""}</span></li>`).join("")}</ol>` : A.emptyState({ icon: "task_alt", title: "Nenhum posto com problema", desc: "Todos os postos dentro do critério nos filtros." })}
              </div>
            </div>

            <div class="panel flat" style="margin-top:16px">
              ${A.sectionTitle("Visão por contrato e região", { icon: "map", sub: "Clique em um contrato para filtrar a fila de trabalho" })}
              <div id="tCtReg"></div>
            </div>

            <div style="margin-top:18px">${A.sectionTitle("Fila de trabalho", { icon: "checklist", sub: "Itens liberados, por posto. Use o filtro Situação para ver todos." })}</div>
            <div id="tWork"></div>
            <div class="panel flat" style="margin-top:18px">
              ${A.sectionTitle("Resumo financeiro", { icon: "payments", sub: "Glosas dos seus contratos por situação. Valores só aparecem onde há regra validada.", right: `<a class="link-btn" href="#/op/medicoes?de=visao">${icon("calculate")}<span>Ver medições</span></a>` })}
              <div class="money-split">
                <div class="money-box is-est"><span>Glosa estimada</span><strong>${A.fmtMoney(gl.estimada)}</strong><span>Regra validada aplicada preliminarmente</span></div>
                <div class="money-box"><span>Em validação</span><strong>${A.fmtMoney(gl.em_validacao)}</strong><span>Aguardando responsável competente</span></div>
                <div class="money-box is-conf"><span>Glosa confirmada</span><strong>${A.fmtMoney(gl.confirmada)}</strong><span>Fluxo de fechamento concluído</span></div>
                <div class="money-box"><span>Regra financeira pendente</span><strong>${gl.pendentes}</strong><span>Medições sem valores calculados</span></div>
              </div>
            </div>`;
          A.mountTable(body.querySelector("#tCtReg"), {
            caption: "contratos",
            rows: cts.map((c) => {
              const rs = all.filter((r) => r.item.contratoId === c.id);
              const ps = listaPostos.filter((p2) => p2.contrato.id === c.id);
              const ms = meds.filter((m) => A.getItem(m.itemId).contratoId === c.id);
              const ir = rs.filter((r) => r.item.tipo === "indicador");
              const gEst = [...new Set(rs.map((r) => r.item.id))].reduce((s2, id) => { const g = A.glosaEstimada(id, comp); return s2 + (g ? g.total : 0); }, 0);
              return { c, id: c.id, numero: c.numero, regiao: c.regiao, postos: ps.length, postosProb: ps.filter((p2) => p2.fora || p2.semDados).length, indFora: ir.filter((r) => r.sit.tone === "danger").length, indTotal: ir.length, medConc: ms.filter((m) => m.status === "fechada").length, medTotal: ms.length, glosa: gEst };
            }), sortKey: "indFora", sortDir: -1,
            empty: { icon: "map", title: "Nenhum contrato nesta região", desc: "Escolha outra região ou limpe os filtros." },
            cols: [
              { key: "numero", label: "Contrato e região", tdCls: "td-main", render: (r) => `<div class="cell-main sei-num">${esc(r.numero)}</div><div class="cell-sub">${esc(r.c.objeto)}</div><div class="cell-sub">${icon("location_on", "cell-ic")}${esc(r.regiao)}</div>` },
              { key: "postosProb", label: "Postos com problema", render: (r) => (r.postos ? `<strong>${r.postosProb}</strong> de ${r.postos}` : `<span class="muted">sem postos medidos</span>`) },
              { key: "indFora", label: "Indicadores fora", render: (r) => (r.indTotal ? `<span class="pill ${r.indFora ? "danger" : "neutral"} no-dot">${r.indFora}</span> <span class="cell-sub">de ${r.indTotal}</span>` : `<span class="muted">—</span>`) },
              { key: "medConc", label: "Medições concluídas", render: (r) => (r.medTotal ? `${r.medConc} de ${r.medTotal}<div class="exec-bar" style="margin-left:0"><i style="width:${(r.medConc / r.medTotal) * 100}%"></i></div>` : `<span class="muted">—</span>`) },
              { key: "glosa", label: "Glosa estimada", cls: "num", render: (r) => (r.glosa ? A.fmtMoney(r.glosa) : `<span class="muted">—</span>`) },
            ],
            onRow: (r) => { root.querySelector("#fCt").value = r.id; root.querySelector("#fCt").dispatchEvent(new Event("change", { bubbles: true })); root.querySelector("#tWork").scrollIntoView({ behavior: "smooth", block: "start" }); },
          });
          A.mountTable(body.querySelector("#tWork"), {
            caption: "itens que exigem ação",
            rows, sortKey: "sitN", sortDir: -1,
            empty: { icon: "task_alt", title: "Nada exige ação neste filtro", desc: "Todos os itens estão conformes ou não há itens liberados para os filtros escolhidos.", action: `<button class="btn outline sm" type="button" onclick="document.getElementById('fSit').value='';document.getElementById('fSit').dispatchEvent(new Event('change', { bubbles: true }))">Ver todos os itens</button>` },
            cols: [
              { key: "itemNome", label: "Posto e item", tdCls: "td-main", sortValue: (r) => r.posto + r.item.nome, render: (r) => `<div class="cell-main">${esc(r.posto)}</div><div style="font-size:13px;line-height:18px">${esc(r.item.nome)}</div><div class="cell-sub">${esc(r.contrato.numero)} · ${esc(r.contrato.regiao)}</div>` },
              { key: "valorNum", label: "Resultado", cls: "nowrap", render: (r) => `${r.resultado ? `<strong>${esc(r.resultado)}</strong>` : r.sit.tone === "nodata" ? pill("Sem dados", "nodata") : `<span class="muted">—</span>`}<div class="cell-sub">Ref. ${esc(r.referencia)}</div>` },
              { key: "cobertura", label: "Dias com dados", render: (r) => `${coverageCell(r.cobertura)}<div class="cell-sub" style="margin-top:4px">${esc(r.evidencia)}</div>` },
              { key: "sitN", label: "Situação", sortValue: (r) => ({ danger: 4, nodata: 3, pending: 2, info: 1 }[r.sit.tone] || 0), render: (r) => pill(r.sit.label, r.sit.tone) },
              { key: "prazo", label: "Prazo", sortValue: (r) => (r.med ? r.med.fechamentoAte : ""), render: (r) => (r.med ? `${A.fmtDate(r.med.fechamentoAte)}<div>${lpill("prazo", r.med.prazo, "sm")}</div>` : `<span class="muted">—</span>`) },
              { key: "impacto", label: "Impacto financeiro", sortable: false, render: (r) => pill(r.impacto.label, r.impacto.tone) },
            ],
            onRow: (r) => openItemDetail(r.item.id, r.postoId, comp),
            foot: (rs) => `<span>${rs.length === all.length ? `${all.length} itens` : `${rs.length} de ${all.length} itens neste filtro`}</span><span>Clique em uma linha para ver resultado, regra, evidências, tratativas e memória de cálculo.</span>`,
          });
          // Links internos dos cartões (ranking e indicadores) rolam até o painel
          body.querySelectorAll('a.kpi-card[href^="#rank"], a.kpi-card[href^="#situacao"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); body.querySelector(a.getAttribute("href")).scrollIntoView({ behavior: "smooth", block: "center" }); }));
        };
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", draw));
        draw();
      },
    };
  });

  /* ---------------- Detalhe de um item (Resultado, Regra, Evidências, Tratativas, Memória) ---------------- */
  function openItemDetail(itemId, postoId, comp) {
    const item = A.getItem(itemId);
    const c = A.getContrato(item.contratoId);
    const esp = item.config.especifico || {};
    const med = medDe(itemId, comp);
    const ocs = A.state.ocorrencias.filter((o) => o.itemId === itemId && (!postoId || o.postoId === postoId));
    let resultado = "", memoria = "", evid = "";
    if (item.tipo === "indicador") {
      const r = A.computeIndicator(itemId, postoId, comp);
      if (r.fonteExterna) {
        resultado = `<div class="callout warning">${icon("cloud_off")}<div><strong>Aguardando dados da fonte.</strong> ${esc(esp.fonte)}. A ausência de dados não é tratada como zero nem como conformidade.</div></div>`;
        memoria = `<div class="callout">${icon("calculate")}<div>Cálculo pendente: faltam os dados de ${A.fmtComp(comp)}.</div></div>`;
        evid = `<dl class="kv cols-2"><div><dt>Fonte</dt><dd>${esc(esp.fonte)}</dd></div><div><dt>Situação</dt><dd>${pill("Não recebido", "nodata")}</dd></div></dl>`;
      } else {
        const pts = r.serie.map((d) => ({ v: d.semExpediente || d.ausente || d.inconsistente ? null : d[r.ind], gap: !!(d.ausente || d.inconsistente), label: A.fmtDate(d.data) + (d.semExpediente ? " (sem expediente)" : ""), short: d.data.slice(8, 10) }));
        resultado = `
          <div class="money-split">
            <div class="money-box ${r.status === "fora" ? "" : "is-conf"}"><span>Resultado do período</span><strong>${r.valor != null ? A.fmtNum(r.valor) + " " + esc(esp.unidade) : "Sem dados"}</strong><span>${r.parcial ? "Parcial, até " + A.fmtDate(D.CCO_COVERAGE_END) : "Período completo"}</span></div>
            <div class="money-box"><span>Meta</span><strong>≤ ${esc(esp.meta)} ${esc(esp.unidade)}</strong><span>${pill(r.status === "fora" ? "Fora do critério" : r.status === "conforme" ? "Conforme" : "Sem dados", r.status === "fora" ? "danger" : r.status === "conforme" ? "success" : "nodata", "sm")}</span></div>
            <div class="money-box"><span>Cobertura</span><strong>${Math.round(r.cobertura * 100)}%</strong><span>${r.validos} de ${r.previstos} dias úteis</span></div>
            <div class="money-box"><span>Atendimentos considerados</span><strong>${(r.atend || 0).toLocaleString("pt-BR")}</strong><span>Base da ponderação</span></div>
          </div>
          <div style="margin-top:14px">${A.lineChart(pts, { meta: r.meta, aria: `Evolução diária do ${r.ind}` })}</div>
          ${r.ausentes.length ? `<div class="callout warning" style="margin-top:10px">${icon("event_busy")}<div><strong>Dias sem dados:</strong> ${r.ausentes.map(A.fmtDate).join(", ")}. A lacuna pode impedir o fechamento ou exigir exceção autorizada.</div></div>` : ""}
          ${r.inconsistentes.length ? `<div class="callout danger" style="margin-top:10px">${icon("report")}<div><strong>Dado inconsistente excluído:</strong> ${r.inconsistentes.map(A.fmtDate).join(", ")} (valor zero com atendimentos registrados), conforme regra de exceções.</div></div>` : ""}`;
        const g = A.glosaEstimada(itemId, comp);
        const gl = g && g.linhas.find((l) => l.postoId === postoId);
        const dias = r.serie.filter((d) => !d.semExpediente);
        memoria = `
          <div class="formula">${esc(esp.formula)}</div>
          <div class="table-wrap" style="max-height:260px;overflow:auto;margin-top:10px"><table class="calc-table"><thead><tr><th>Dia</th><th class="num">Atendimentos</th><th class="num">${esc(r.ind)} (${esc(esp.unidade)})</th><th class="num">Produto</th><th>Tratamento</th></tr></thead><tbody>
            ${dias.map((d) => `<tr><td>${A.fmtDate(d.data)}</td><td class="num">${d.ausente ? "—" : d.atendimentos}</td><td class="num">${d.ausente ? "—" : A.fmtNum(d[r.ind])}</td><td class="num">${d.ausente || d.inconsistente ? "—" : A.fmtNum(d[r.ind] * d.atendimentos)}</td><td>${d.ausente ? pill("Sem dados", "nodata", "sm") : d.inconsistente ? pill("Excluído: inconsistente", "danger", "sm") : pill("Incluído", "success", "sm")}</td></tr>`).join("")}
            <tr class="total"><td>Total</td><td class="num">${(r.atend || 0).toLocaleString("pt-BR")}</td><td class="num">${r.valor != null ? A.fmtNum(r.valor, 2) : "—"}</td><td class="num"></td><td>Média ponderada</td></tr>
          </tbody></table></div>
          ${item.config.financeiro.situacao === "validada" ? `
            <h4 style="margin:16px 0 8px">${icon("payments")}Efeito financeiro (regra validada v${med ? med.versaoRegra : item.versao})</h4>
            <div class="formula">${esc(item.config.financeiro.formula)}<br>Fundamento: ${esc(item.config.financeiro.fundamento)}</div>
            <table class="calc-table" style="margin-top:8px"><tbody>
              <tr><td>Parcela mensal do posto</td><td class="num">${A.fmtMoney(g.parcela)}</td></tr>
              <tr><td>Excedente sobre a meta</td><td class="num">${r.status === "fora" ? A.fmtNum(r.valor - r.meta, 2) + " min → " + gl.faixas + " faixa(s)" : "—"}</td></tr>
              <tr><td>Percentual aplicado (limite 5%)</td><td class="num">${gl.pct.toLocaleString("pt-BR")}%</td></tr>
              <tr class="total"><td>Glosa estimada do posto</td><td class="num">${A.fmtMoney(gl.valor)}</td></tr>
            </tbody></table>
            <p class="field-hint">Valor estimado. A confirmação ocorre apenas na validação da medição pelo responsável competente.</p>`
          : `<div class="callout" style="margin-top:12px">${icon("info")}<div>${item.config.financeiro.situacao === "pendente" ? "<strong>Cálculo financeiro pendente:</strong> a regra de desconto ainda não foi validada." : "Item sem regra financeira aplicável."}</div></div>`}`;
        evid = `<dl class="kv cols-2">
            <div><dt>Fonte</dt><dd>${esc(esp.fonte)} · campo <code>${esc(esp.campo)}</code></dd></div>
            <div><dt>Período coberto</dt><dd>${A.fmtDate(comp + "-01")} a ${r.parcial ? A.fmtDate(D.CCO_COVERAGE_END) : A.fmtDate(r.serie[r.serie.length - 1].data)}</dd></div>
            <div><dt>Horário da coleta</dt><dd>${A.fmtDateTime(D.CCO_LAST_PULL)}</dd></div>
            <div><dt>Identificador do lote</dt><dd><code>CCO-${comp.replace("-", "")}-${postoId}</code></dd></div>
          </dl>
          <button class="btn outline sm" type="button" id="expSerie" style="margin-top:10px">${icon("download")}Exportar evidência (CSV)</button>`;
      }
    } else if (item.tipo === "fiscalizacao") {
      const fs = A.state.fiscalizacoes.filter((f) => f.itemId === itemId && f.postoId === postoId).sort((a, b) => (a.data < b.data ? 1 : -1));
      resultado = fs.length ? `<div class="list">${fs.map((f) => { const nc = Object.values(f.respostas).filter((x) => x.r === "NC").length; return `<a class="list-item clickable" href="#/op/fiscalizacao/${f.id}" style="grid-template-columns:auto 1fr auto;color:inherit;text-decoration:none"><span class="list-icon ${nc ? "danger" : "success"}">${icon("assignment_turned_in")}</span><div><div class="list-title">${esc(f.id)} · ${A.fmtDate(f.data)}</div><div class="list-desc">${esc(D.CHECKLISTS[f.checklist].nome)} ${esc(f.versao)} · ${nc} não conformidade(s)</div></div>${lpill("fisc", f.status)}</a>`; }).join("")}</div>` : A.emptyState({ icon: "assignment", title: "Nenhuma inspeção registrada", action: `<a class="btn primary sm" href="#/op/fiscalizacoes?nova=1&item=${itemId}&posto=${postoId}">${icon("add_task")}Registrar inspeção</a>` });
      memoria = `<div class="callout">${icon("info")}<div>Resultado consolidado pelas respostas do checklist versionado. ${item.config.financeiro.situacao === "validada" ? esc(item.config.financeiro.formula) : "Sem regra financeira aplicável."}</div></div>`;
      evid = `<p class="cell-sub">Checklist, fotos e verificação de cada inspeção ficam preservados com a versão do checklist utilizada.</p>`;
    } else {
      resultado = `<dl class="kv cols-2"><div><dt>Produto</dt><dd>${esc(esp.produto)}</dd></div><div><dt>Marco</dt><dd>${esc(esp.marco)}</dd></div><div><dt>Competência</dt><dd>${A.fmtComp(comp)}</dd></div><div><dt>Situação</dt><dd>${comp < A.CURRENT_COMP ? pill("Entregue e conferido", "success") : pill("Aguardando entrega", "pending")}</dd></div></dl>`;
      memoria = `<div class="callout">${icon("info")}<div>Entrega avaliada pelo critério de aceite: ${esc(esp.criterioAceite)}.</div></div>`;
      evid = `<p class="cell-sub">${esc(item.config.evidencia)}</p>`;
    }

    A.openDrawer({
      kicker: `${c.numero} · ${A.fmtComp(comp)}${postoId ? " · " + A.getPosto(postoId).nome : ""}`,
      title: item.nome,
      subtitle: `${(A.L.tipo[item.tipo] || [])[0]} · regra versão ${med ? med.versaoRegra : item.versao}${med ? " · medição " + A.L.med[med.status][0].toLowerCase() : ""}`,
      body: `
        <div class="drawer-section"><h4>${icon("insights")}Resultado</h4>${resultado}</div>
        <div class="drawer-section"><h4>${icon("gavel")}Regra aplicável</h4>
          <dl class="kv cols-2"><div><dt>Critério</dt><dd>${esc(item.config.criterio)}</dd></div><div><dt>Versão aprovada</dt><dd>v${med ? med.versaoRegra : item.versao} · De acordo de ${esc(A.userName((item.aceites[item.aceites.length - 1] || {}).usuario))}</dd></div><div><dt>Exceções</dt><dd>${esc(esp.excecoes || "—")}</dd></div><div><dt>Tratativa</dt><dd>Prazo de ${esc(item.config.tratativa.prazoDias)} dias · ${esc(item.config.tratativa.verificacao)}</dd></div></dl>
          <p class="field-hint" style="margin-top:8px">A regra aprovada não pode ser alterada durante a medição. Mudanças exigem nova versão pelo Gestor/Fiscal.</p>
        </div>
        <div class="drawer-section"><h4>${icon("inventory_2")}Evidências</h4>${evid}</div>
        <div class="drawer-section"><h4>${icon("build_circle")}Tratativas</h4>
          ${ocs.length ? `<div class="list">${ocs.map(ocItem).join("")}</div>` : `<p class="cell-sub">Nenhuma ocorrência vinculada.</p>`}
          <button class="btn outline sm" type="button" id="novaOc" style="margin-top:10px">${icon("add")}Abrir ocorrência</button>
        </div>
        <div class="drawer-section"><h4>${icon("calculate")}Memória de cálculo</h4>${memoria}</div>`,
      actions: [...(med ? [{ label: "Abrir medição", cls: "primary", icon: "calculate", onClick: () => setTimeout(() => openMedicao(med.id), 0) }] : [])],
      mount(box) {
        const ex = box.querySelector("#expSerie");
        if (ex) ex.addEventListener("click", () => {
          const r = A.computeIndicator(itemId, postoId, comp);
          A.downloadCsv(`evidencia-${item.id}-${postoId}-${comp}.csv`, ["Data", "Posto", "Atendimentos", r.ind, "Tratamento", "Fonte", "Coleta"], r.serie.filter((d) => !d.semExpediente).map((d) => [d.data, A.getPosto(postoId).nome, d.ausente ? "" : d.atendimentos, d.ausente ? "" : d[r.ind], d.ausente ? "sem dados" : d.inconsistente ? "excluído (inconsistente)" : "incluído", "CCO", D.CCO_LAST_PULL]));
        });
        box.querySelectorAll("[data-oc]").forEach((b) => b.addEventListener("click", () => setTimeout(() => openOcorrencia(b.dataset.oc), 0)));
        box.querySelector("#novaOc").addEventListener("click", () => novaOcorrencia({ itemId, postoId, comp }));
      },
    });
  }

  function ocItem(o) {
    return `<button type="button" class="list-item clickable" data-oc="${o.id}" style="grid-template-columns:auto 1fr auto;text-align:left;width:100%"><span class="list-icon ${o.status === "vencida" ? "danger" : o.status === "encerrada" ? "success" : "warning"}">${icon((A.L.origem[o.origem] || [])[1] || "build")}</span><span><span class="list-title">${esc(o.id)} · ${esc(o.titulo)}</span><span class="list-meta"><span>${icon("event")}Prazo ${A.fmtDate(o.prazo)}</span><span>${icon("person")}${esc(o.responsavel)}</span></span></span>${lpill("oc", o.status)}</button>`;
  }

  /* ---------------- Itens de acompanhamento ---------------- */
  A.route("op/itens", "op", (p, q) => ({
    title: "Itens de acompanhamento", nav: "op/itens", crumbs: [{ label: "Itens de acompanhamento" }],
    html: `<div class="section">
      ${A.pageHeader("Itens de acompanhamento", "Somente itens liberados pelo De acordo. Itens em preparação não geram tarefas nem medições oficiais.")}
      <div class="filters-grid">${regiaoField(q)}${contratoField(q)}${A.selectField("fTp", "Tipo", [["", "Todos"], ...Object.entries(A.L.tipo).map(([k, v]) => [k, v[0]])], "")}</div>
      <div id="tI"></div>
      <div class="callout" style="margin-top:12px">${icon("lock")}<div>${A.state.itens.filter((i) => scopeIds().includes(i.contratoId) && !i.status.startsWith("ativo")).length} item(ns) dos seus contratos ainda estão em preparação com o Gestor/Fiscal e não aparecem aqui.</div></div>
    </div>`,
    mount(root) {
      const v = (id) => root.querySelector("#" + id).value;
      const t = A.mountTable(root.querySelector("#tI"), {
        caption: "itens",
        rows: () => itensAtivos().filter((i) => okFiltro(root, i.contratoId) && (!v("fTp") || i.tipo === v("fTp"))),
        empty: { icon: "checklist", title: "Nenhum item liberado", desc: "Aguardando o De acordo do Gestor/Fiscal." },
        cols: [
          { key: "nome", label: "Item", tdCls: "td-main", render: (i) => `<div class="cell-main">${esc(i.nome)}</div><div class="cell-sub">${esc(A.getContrato(i.contratoId).numero)} · ${tipoTag(i.tipo)}</div>` },
          { key: "abr", label: "Abrangência", sortable: false, render: (i) => `<span class="cell-sub">${i.config.abrangencia.map((p) => esc(A.getPosto(p).nome)).join(", ")}</span>` },
          { key: "freq", label: "Coleta · medição", sortable: false, render: (i) => `${esc(i.config.freq.coleta)}<div class="cell-sub">Medição ${esc(i.config.freq.medicao)} · fecha em ${esc(i.config.freq.fechamentoDias)} dias</div>` },
          { key: "prog", label: "Programação", sortable: false, render: (i) => A.state.medicoes.filter((m) => m.itemId === i.id && m.status !== "fechada").sort((a, b) => (a.comp > b.comp ? 1 : -1)).slice(0, 3).map((m) => `<div class="cell-sub">${A.fmtComp(m.comp)}: ${esc(A.L.med[m.status][0])}</div>`).join("") || `<span class="muted">—</span>` },
          { key: "status", label: "Situação", render: (i) => lpill("item", i.status, "plain") },
        ],
        onRow: (i) => openItemDetail(i.id, i.tipo === "entrega" ? null : i.config.abrangencia[0], A.compAdd(A.CURRENT_COMP, -1)),
      });
      root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
    },
  }));

  /* ---------------- Indicadores e cobertura ---------------- */
  A.route("op/indicadores", "op", () => {
    const postos = Object.keys(D.CCO);
    return {
      title: "Indicadores", nav: "op/indicadores", crumbs: [{ label: "Indicadores" }],
      html: `<div class="section">
        ${A.pageHeader("Indicadores e cobertura dos dados", `Integração CCO · dados D-1 cobrem até <strong>${A.fmtDate(D.CCO_COVERAGE_END)}</strong> · última coleta ${A.fmtDateTime(D.CCO_LAST_PULL)}. Ausência de dado não equivale a zero.`, `<div class="segmented" role="tablist"><button type="button" class="active" data-view="lista">${icon("view_list")}Lista</button><button type="button" data-view="matriz">${icon("grid_on")}Matriz</button></div>`)}
        ${A.sectionTitle("Definições conferidas", { icon: "menu_book", sub: "Cada indicador precisa de definição de negócio, fonte e cálculo conferidos individualmente." })}
        <div class="ind-defs" id="indDefs">${D.INDICADORES.map((i) => `<div class="panel flat" style="padding:12px"><div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><strong>${esc(i.id)}</strong>${i.definicao === "conferida" ? pill("Conferido", "success", "sm") : i.definicao === "pendente" ? pill("Definição pendente", "pending", "sm") : pill("Sem fonte", "nodata", "sm")}</div><div class="cell-sub" style="margin-top:4px">${esc(i.nome)}</div><div class="cell-sub" style="margin-top:6px">${esc(i.fonte)}</div></div>`).join("")}</div>
        <div class="filters-grid">${regiaoField()}${A.selectField("fInd", "Indicador", [["TME", "TME — tempo médio de espera"], ["TMA", "TMA — tempo médio de atendimento"]], "TME")}${A.selectField("fComp", "Competência", [[A.CURRENT_COMP, A.fmtComp(A.CURRENT_COMP) + " (em curso)"], [A.compAdd(A.CURRENT_COMP, -1), A.fmtComp(A.compAdd(A.CURRENT_COMP, -1))]], A.CURRENT_COMP)}</div>
        <div id="indBody"></div>
      </div>`,
      mount(root) {
        let view = "lista";
        const draw = () => {
          const ind = root.querySelector("#fInd").value, comp = root.querySelector("#fComp").value;
          const itemId = ind === "TME" ? "i1" : "i2";
          const meta = ind === "TME" ? 15 : 12;
          const reg = root.querySelector("#fRegiao").value;
          const ps = reg && regiaoDe(A.getItem(itemId).contratoId) !== reg ? [] : postos;
          const body = root.querySelector("#indBody");
          if (view === "lista") {
            body.innerHTML = `<div id="tCov"></div>`;
            A.mountTable(body.querySelector("#tCov"), {
              caption: "postos",
              rows: ps.map((pid) => Object.assign({ pid }, A.computeIndicator(itemId, pid, comp))),
              cols: [
                { key: "pid", label: "Posto", tdCls: "td-main", render: (r) => `<span class="cell-main">${esc(A.getPosto(r.pid).nome)}</span><div class="cell-sub">CT 014/2025</div>` },
                { key: "valor", label: ind + " do período", render: (r) => (r.valor != null ? `<strong>${A.fmtNum(r.valor)} min</strong>` : pill("Sem dados", "nodata")) },
                { key: "status", label: "Critério", render: (r) => pill(r.status === "fora" ? "Fora (≤ " + meta + " min)" : r.status === "conforme" ? "Conforme" : "Sem dados", r.status === "fora" ? "danger" : r.status === "conforme" ? "success" : "nodata") },
                { key: "cobertura", label: "Cobertura", render: (r) => coverageCell(r.cobertura) },
                { key: "periodo", label: "Período coberto", sortable: false, render: (r) => `${A.fmtDate(comp + "-01")} a ${A.fmtDate(r.serie[r.serie.length - 1].data)}` },
                { key: "ausentesN", label: "Dias sem dados", sortValue: (r) => r.ausentes.length, render: (r) => (r.ausentes.length ? `<span class="pill nodata no-dot">${r.ausentes.length}</span><div class="cell-sub">${r.ausentes.map((d) => d.slice(8, 10) + "/" + d.slice(5, 7)).join(", ")}</div>` : `<span class="pill neutral no-dot">0</span>`) },
                { key: "incN", label: "Inconsistências", sortValue: (r) => r.inconsistentes.length, render: (r) => (r.inconsistentes.length ? `<span class="pill danger no-dot">${r.inconsistentes.length}</span><div class="cell-sub">Excluídas com registro</div>` : `<span class="pill neutral no-dot">0</span>`) },
              ],
              onRow: (r) => openItemDetail(itemId, r.pid, comp),
            });
          } else {
            if (!ps.length) { body.innerHTML = A.emptyState({ icon: "map", title: "Nenhum posto medido nesta região", desc: "Os indicadores do CCO desta competência são dos postos de outra região." }); return; }
            const dias = D.CCO[ps[0]].filter((d) => d.data.startsWith(comp));
            body.innerHTML = `<p class="matrix-hint" hidden>${icon("swap_horiz")}Role para o lado para ver todos os dias. A coluna Posto fica fixa.</p><div class="matrix-box"><div class="matrix-wrap"><table class="matrix"><thead><tr><th class="sticky-col">Posto</th>${dias.map((d) => `<th>${d.data.slice(8, 10)}</th>`).join("")}<th>Período</th></tr></thead><tbody>
              ${ps.map((pid) => { const r = A.computeIndicator(itemId, pid, comp); return `<tr><td class="sticky-col">${esc(A.getPosto(pid).nome)}</td>${D.CCO[pid].filter((d) => d.data.startsWith(comp)).map((d) => d.semExpediente ? `<td class="na" title="Sem expediente">·</td>` : d.ausente ? `<td class="na" title="Sem dados">s/d</td>` : d.inconsistente ? `<td class="na" title="Inconsistente: excluído">inc</td>` : `<td class="${d[ind] > meta ? "out" : ""}" title="${A.fmtDate(d.data)}: ${A.fmtNum(d[ind])} min · ${d.atendimentos} atendimentos">${A.fmtNum(d[ind])}</td>`).join("")}<td class="${r.status === "fora" ? "out" : ""}"><strong>${r.valor != null ? A.fmtNum(r.valor) : "s/d"}</strong></td></tr>`; }).join("")}
            </tbody></table></div></div>
            <div class="chart-legend"><span>Valores em minutos</span><span>Em vermelho: acima de ${meta} min</span><span>s/d: sem dados · inc: inconsistente · “·”: sem expediente</span><span>Período: média ponderada por atendimentos</span></div>`;
            const box = body.querySelector(".matrix-box"), wrap = body.querySelector(".matrix-wrap");
            const sync = () => {
              const max = wrap.scrollWidth - wrap.clientWidth;
              body.querySelector(".matrix-hint").hidden = max <= 1;
              box.classList.toggle("is-scrolled", wrap.scrollLeft > 0);
              box.classList.toggle("has-more", wrap.scrollLeft < max - 1);
            };
            wrap.addEventListener("scroll", sync);
            sync();
          }
        };
        root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; root.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("active", x === b)); draw(); }));
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", draw));
        draw();
      },
    };
  });

  /* ---------------- Fiscalizações ---------------- */
  A.route("op/fiscalizacoes", "op", (p, q) => ({
    title: "Fiscalizações", nav: "op/fiscalizacoes", crumbs: [{ label: "Fiscalizações" }],
    html: `<div class="section">
      ${A.pageHeader("Fiscalizações físicas", "Inspeções com checklist versionado, fotos obrigatórias para Não Conforme e indicação de sincronização.", `<button class="btn primary" type="button" id="novaF">${icon("add_task")}Nova fiscalização</button>`)}
      <div class="filters-grid">${regiaoField(q)}${contratoField(q)}</div>
      <div id="tF"></div>
    </div>`,
    mount(root) {
      const tF = A.mountTable(root.querySelector("#tF"), {
        caption: "fiscalizações",
        rows: () => A.state.fiscalizacoes.filter((f) => scopeIds().includes(f.contratoId) && okFiltro(root, f.contratoId)), sortKey: "data", sortDir: -1,
        empty: { icon: "assignment", title: "Nenhuma fiscalização registrada", desc: "Registre a primeira inspeção de um posto." },
        cols: [
          { key: "id", label: "Inspeção", tdCls: "td-main", render: (f) => `<div class="cell-main">${esc(f.id)} · ${esc(A.getPosto(f.postoId).nome)}</div><div class="cell-sub">${esc(A.getContrato(f.contratoId).numero)} · ${esc(A.getItem(f.itemId).nome)}</div>` },
          { key: "data", label: "Data", render: (f) => A.fmtDate(f.data) },
          { key: "checklist", label: "Checklist", render: (f) => `${esc(D.CHECKLISTS[f.checklist].nome)} <span class="tag">${esc(f.versao)}</span>` },
          { key: "nc", label: "Não conformidades", sortValue: (f) => Object.values(f.respostas).filter((x) => x.r === "NC").length, render: (f) => { const n = Object.values(f.respostas).filter((x) => x.r === "NC").length; return n ? `<span class="pill danger no-dot">${n}</span>` : `<span class="pill neutral no-dot">0</span>`; } },
          { key: "status", label: "Situação", render: (f) => lpill("fisc", f.status) },
          { key: "sync", label: "Sincronização", render: (f) => (f.sincronizada ? pill("Sincronizada", "success") : pill("Não sincronizada", "warning")) },
        ],
        onRow: (f) => A.go("op/fiscalizacao/" + f.id),
      });
      root.querySelectorAll(".filters-grid select").forEach((sel) => sel.addEventListener("change", tF.render));
      const nova = () => {
        const its = itensAtivos().filter((i) => i.tipo === "fiscalizacao");
        A.openModal({
          title: "Nova fiscalização", subtitle: "Selecione contrato, posto, data e checklist aplicável.",
          body: `${A.selectField("nItem", "Item / contrato", its.map((i) => [i.id, A.getContrato(i.contratoId).numero + " · " + i.nome]), q.item || its[0].id)}
            <div id="nPostoWrap"></div>
            <div class="form-field"><label for="nData">Data da inspeção</label><input class="input" type="date" id="nData" value="${D.TODAY}" max="${D.TODAY}"/></div>
            <div id="nCk" class="callout"></div>`,
          mount(box) {
            const upd = () => {
              const it = A.getItem(box.querySelector("#nItem").value);
              box.querySelector("#nPostoWrap").innerHTML = A.selectField("nPosto", "Posto", it.config.abrangencia.map((p) => [p, A.getPosto(p).nome]), q.posto || it.config.abrangencia[0]);
              const ck = D.CHECKLISTS[it.config.especifico.checklist];
              box.querySelector("#nCk").innerHTML = `${icon("checklist")}<div>Checklist aplicável: <strong>${esc(ck.nome)} ${esc(ck.versao)}</strong> (vigente desde ${A.fmtDate(ck.vigenteDesde)}, ${ck.itens.length} itens). A versão fica registrada na inspeção.</div>`;
            };
            box.querySelector("#nItem").addEventListener("change", upd);
            upd();
          },
          actions: [{ label: "Iniciar inspeção", cls: "primary", icon: "play_arrow", onClick: (l) => {
            const it = A.getItem(l.el.querySelector("#nItem").value);
            const n = A.state.fiscalizacoes.length + 100;
            const f = { id: "F-0" + n, contratoId: it.contratoId, itemId: it.id, postoId: l.el.querySelector("#nPosto").value, data: l.el.querySelector("#nData").value, checklist: it.config.especifico.checklist, versao: D.CHECKLISTS[it.config.especifico.checklist].versao, por: "camila", status: "rascunho", sincronizada: true, respostas: {} };
            A.state.fiscalizacoes.push(f);
            A.addHistorico({ acao: "Inspeção iniciada", objeto: f.id, detalhe: A.getPosto(f.postoId).nome, contratoId: f.contratoId });
            A.save();
            setTimeout(() => A.go("op/fiscalizacao/" + f.id), 0);
          } }],
        });
      };
      root.querySelector("#novaF").addEventListener("click", nova);
      if (q.nova) nova();
    },
  }));

  A.route("op/fiscalizacao/:id", "op", (p) => {
    const f = A.state.fiscalizacoes.find((x) => x.id === p.id);
    if (!f || !scopeIds().includes(f.contratoId)) return { title: "Fiscalização", nav: "op/fiscalizacoes", html: `<div class="section">${A.stateBox("search_off", "Inspeção não encontrada", "A inspeção não existe ou está fora do seu escopo.")}</div>` };
    const ck = D.CHECKLISTS[f.checklist];
    const editavel = f.status === "rascunho";
    const ANS = [["C", "Conforme", "check_circle", "a-c"], ["NC", "Não Conforme", "cancel", "a-nc"], ["NA", "Não se aplica", "remove_circle", "a-na"], ["IR", "Inverificável remotamente", "visibility_off", "a-ir"]];
    return {
      title: `${f.id} · ${A.getPosto(f.postoId).nome}`, nav: "op/fiscalizacoes", crumbs: [{ label: "Fiscalizações", href: "#/op/fiscalizacoes" }, { label: f.id }],
      html: `<div class="section" style="max-width:1080px;margin:0 auto;width:100%">
        ${A.pageHeader(`${f.id} · ${A.getPosto(f.postoId).nome}`, `${esc(A.getContrato(f.contratoId).numero)} · ${A.fmtDate(f.data)} · ${esc(ck.nome)} <span class="tag">${esc(f.versao)}</span> · ${esc(A.userName(f.por))}`, editavel ? "" : `<button class="btn outline" type="button" id="rel">${icon("print")}Relatório da inspeção</button>`)}
        <div class="ck-sticky">
          <div class="sync-bar ${f.sincronizada ? "" : "offline"}" id="syncBar"></div>
          ${editavel ? `<div class="ck-actions"><div class="ck-progress" aria-hidden="true"><i id="ckBar"></i></div><span class="save-state" id="ckState">${icon("save")}Salvamento parcial automático</span><div class="page-actions"><button class="btn outline" type="button" id="salvar">${icon("save")}Salvar rascunho</button><button class="btn primary" type="button" id="enviar">${icon("send")}Finalizar e enviar</button></div></div>` : ""}
        </div>
        ${editavel ? "" : `<div class="callout success" style="margin-bottom:14px">${icon("lock")}<div>Inspeção enviada. Respostas, fotos e verificação ficam preservadas; alterações no checklist valem só para novas inspeções.</div></div>`}
        <div class="stack" id="ckList">${ck.itens.map((q, i) => {
          const r = f.respostas[i] || {};
          return `<div class="check-item ${r.r === "NC" ? "is-nc" : ""}" data-i="${i}">
            <div class="check-q"><span class="q-num">${i + 1}.</span><span>${esc(q)}</span></div>
            <div class="answer-group" role="radiogroup" aria-label="${esc(q)}">${ANS.map(([v, l, ic, cls]) => `<label class="${cls}"><input type="radio" name="q${i}" value="${v}" ${r.r === v ? "checked" : ""} ${editavel ? "" : "disabled"}/>${icon(ic)}${l}</label>`).join("")}</div>
            <div class="nc-fields" ${r.r === "NC" ? "" : "hidden"}>
              <div class="form-field"><label for="d${i}">Descrição da não conformidade <span class="field-req">*</span></label><textarea class="textarea ${r.r === "NC" && !r.desc ? "is-missing" : ""}" id="d${i}" ${editavel ? "" : "disabled"}>${esc(r.desc || "")}</textarea></div>
              <label class="photo-drop ${r.r === "NC" && !r.foto ? "is-missing" : ""}" for="ph${i}">${fotosMem[f.id + i] ? `<img src="${fotosMem[f.id + i]}" alt="Foto da não conformidade"/>` : r.foto ? `${icon("image")}<span>${esc(r.foto)}</span>` : `${icon("photo_camera")}<span>Foto obrigatória<br>Toque para tirar ou escolher</span>`}
                <input type="file" id="ph${i}" accept="image/*" capture="environment" hidden ${editavel ? "" : "disabled"}/></label>
            </div>
          </div>`;
        }).join("")}</div>
      </div>`,
      mount(root) {
        let offline = !f.sincronizada;
        const pend = () => Object.keys(f.respostas).length;
        const drawSync = () => {
          root.querySelector("#syncBar").className = "sync-bar " + (f.sincronizada ? "" : "offline");
          const bar = root.querySelector("#ckBar");
          if (bar) bar.style.width = Math.round((pend() / ck.itens.length) * 100) + "%";
          root.querySelector("#syncBar").innerHTML = `<span style="display:flex;gap:8px;align-items:center">${icon(f.sincronizada ? "cloud_done" : "cloud_off")}<strong>${f.sincronizada ? "Tudo sincronizado" : "Alterações salvas só neste dispositivo"}</strong><span class="cell-sub">${pend()}/${ck.itens.length} itens respondidos</span></span>
            ${editavel ? `<span style="display:flex;gap:12px;align-items:center"><label class="switch"><input type="checkbox" id="offT" ${offline ? "checked" : ""}/>Simular sem conexão</label>${!f.sincronizada && !offline ? `<button class="btn outline sm" type="button" id="syncNow">${icon("sync")}Sincronizar</button>` : ""}</span>` : ""}`;
          const t = root.querySelector("#offT");
          if (t) t.addEventListener("change", () => { offline = t.checked; drawSync(); });
          const s = root.querySelector("#syncNow");
          if (s) s.addEventListener("click", () => { f.sincronizada = true; A.save(); drawSync(); A.toast("Inspeção sincronizada. Nenhum conflito encontrado.", "cloud_done"); });
        };
        drawSync();
        if (editavel) {
          const touch = () => {
            f.sincronizada = !offline && f.sincronizada;
            if (offline) f.sincronizada = false;
            A.save(); drawSync();
            root.querySelector("#ckState").innerHTML = `${icon("save")}Rascunho salvo às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${offline ? " (offline)" : ""}`;
          };
          root.querySelectorAll(".check-item").forEach((box) => {
            const i = box.dataset.i;
            box.querySelectorAll("input[type=radio]").forEach((rb) => rb.addEventListener("change", () => {
              f.respostas[i] = Object.assign(f.respostas[i] || {}, { r: rb.value });
              box.classList.toggle("is-nc", rb.value === "NC");
              box.querySelector(".nc-fields").hidden = rb.value !== "NC";
              touch();
            }));
            box.querySelector("textarea").addEventListener("input", (e) => { f.respostas[i] = Object.assign(f.respostas[i] || {}, { desc: e.target.value }); e.target.classList.toggle("is-missing", !e.target.value.trim()); touch(); });
            box.querySelector("input[type=file]").addEventListener("change", (e) => {
              const file = e.target.files[0];
              if (!file) return;
              fotosMem[f.id + i] = URL.createObjectURL(file);
              f.respostas[i] = Object.assign(f.respostas[i] || {}, { foto: file.name });
              const drop = box.querySelector(".photo-drop");
              drop.classList.remove("is-missing");
              drop.innerHTML = `<img src="${fotosMem[f.id + i]}" alt="Foto da não conformidade"/>`;
              drop.appendChild(e.target);
              touch();
            });
          });
          root.querySelector("#salvar").addEventListener("click", () => { touch(); A.toast(offline ? "Rascunho salvo no dispositivo. Sincronize quando houver conexão." : "Rascunho salvo.", "save"); });
          root.querySelector("#enviar").addEventListener("click", () => {
            const faltam = ck.itens.map((_, i) => i).filter((i) => !f.respostas[i] || !f.respostas[i].r);
            const ncIncompletas = Object.entries(f.respostas).filter(([, r]) => r.r === "NC" && (!r.desc || !r.foto));
            if (faltam.length) { A.toast(`Responda todos os itens: faltam ${faltam.map((x) => x + 1).join(", ")}.`, "error"); return; }
            if (ncIncompletas.length) { A.toast("Toda resposta Não Conforme exige foto e descrição.", "error"); return; }
            if (offline || !f.sincronizada) { A.toast("Sem conexão: sincronize antes de enviar. O rascunho está preservado.", "cloud_off"); return; }
            const ncs = Object.entries(f.respostas).filter(([, r]) => r.r === "NC");
            A.openModal({
              title: "Finalizar e enviar inspeção", subtitle: `${f.id} · ${ncs.length} não conformidade(s)`,
              body: `<p>Após o envio, a inspeção fica bloqueada para edição. Para cada constatação confirmada você pode abrir uma ocorrência de correção.</p>
                ${ncs.length ? `<div class="list">${ncs.map(([i, r]) => `<label class="list-item" style="grid-template-columns:auto 1fr;cursor:pointer"><input type="checkbox" data-nc="${i}" checked style="accent-color:var(--primary);margin-top:3px"/><span><span class="list-title">Abrir ocorrência: ${esc(ck.itens[i])}</span><span class="list-desc">${esc(r.desc)}</span></span></label>`).join("")}</div>` : ""}
                <div class="callout">${icon("draw")}<div>Assinatura digital e envio formal ao SEI dependem de método a definir. Uma imagem de assinatura não é tratada como assinatura eletrônica validada.</div></div>`,
              actions: [{ label: "Enviar", cls: "primary", icon: "send", onClick: (l) => {
                f.status = "enviada";
                const item = A.getItem(f.itemId);
                l.el.querySelectorAll("[data-nc]:checked").forEach((cb) => {
                  const i = +cb.dataset.nc;
                  criarOcorrencia({ itemId: f.itemId, postoId: f.postoId, comp: f.data.slice(0, 7), origem: "inspecao", fiscalizacaoId: f.id, titulo: ck.itens[i] + " — " + A.getPosto(f.postoId).nome, descricao: f.respostas[i].desc, prazoDias: +item.config.tratativa.prazoDias || 5, evidencias: ["Foto: " + f.respostas[i].foto, "Checklist " + f.id] });
                });
                A.addHistorico({ acao: "Inspeção enviada", objeto: f.id, detalhe: `${ncs.length} não conformidade(s).`, contratoId: f.contratoId });
                A.save(); A.refreshNav(); A.toast("Inspeção enviada.", "send"); A.renderRoute();
              } }],
            });
          });
        } else {
          root.querySelector("#rel").addEventListener("click", () => {
            const ncs = Object.entries(f.respostas).filter(([, r]) => r.r === "NC");
            const cnt = (v) => Object.values(f.respostas).filter((r) => r.r === v).length;
            A.openModal({
              wide: true, kicker: "Relatório de inspeção", title: `${f.id} · ${A.getPosto(f.postoId).nome}`, subtitle: `${A.fmtDate(f.data)} · ${esc(ck.nome)} ${esc(f.versao)}`,
              body: `<div class="money-split"><div class="money-box is-conf"><strong>${cnt("C")}</strong><span>Conforme</span></div><div class="money-box"><strong>${cnt("NC")}</strong><span>Não Conforme</span></div><div class="money-box"><strong>${cnt("NA")}</strong><span>Não se aplica</span></div><div class="money-box"><strong>${cnt("IR")}</strong><span>Inverificável remotamente</span></div></div>
                <table class="calc-table"><thead><tr><th>#</th><th>Item</th><th>Resposta</th></tr></thead><tbody>${ck.itens.map((q, i) => `<tr><td>${i + 1}</td><td>${esc(q)}${f.respostas[i] && f.respostas[i].desc ? `<div class="cell-sub">${esc(f.respostas[i].desc)}</div>` : ""}</td><td>${esc((ANS.find((a) => a[0] === (f.respostas[i] || {}).r) || ["", "—"])[1])}</td></tr>`).join("")}</tbody></table>
                ${ncs.length ? `<h4 style="margin:6px 0 0">Galeria de fotos</h4><div class="check-row">${ncs.map(([i, r]) => `<span class="tag">${icon("image")}${esc(r.foto || "sem foto")}</span>`).join("")}</div>` : ""}
                <div class="callout warning">${icon("draw")}<div>Sem assinatura eletrônica validada. Envio à contratada e formalização no SEI dependem do método definido.</div></div>`,
              actions: [{ label: "Imprimir", cls: "primary", icon: "print", close: false, onClick: () => window.print() }],
            });
          });
        }
      },
    };
  });

  /* ---------------- Ocorrências e tratativas ---------------- */
  function criarOcorrencia(o) {
    const item = A.getItem(o.itemId);
    const n = 441 + A.state.ocorrencias.filter((x) => x.manual).length;
    const prazo = new Date(A.parseDate(D.TODAY).getTime() + (o.prazoDias || 5) * 864e5).toISOString().slice(0, 10);
    const oc = {
      id: "OC-0" + n, manual: true, contratoId: item.contratoId, itemId: o.itemId, postoId: o.postoId, comp: o.comp, origem: o.origem, fiscalizacaoId: o.fiscalizacaoId,
      titulo: o.titulo, descricao: o.descricao, responsavel: item.config.responsaveis.responde, encaminhadoEm: D.TODAY, cienciaEm: null, prazo, regraPrazo: `${o.prazoDias || 5} dias a partir do encaminhamento`,
      status: "encaminhada",
      eventos: [
        { data: A.nowIso(), tipo: "abertura", por: A.currentUser().id, texto: "Ocorrência aberta." },
        { data: A.nowIso(), tipo: "encaminhamento", por: A.currentUser().id, texto: `Encaminhada a ${item.config.responsaveis.responde} com prazo até ${A.fmtDate(prazo)}.` },
      ],
      evidencias: o.evidencias || [],
    };
    A.state.ocorrencias.unshift(oc);
    A.addHistorico({ acao: "Ocorrência aberta", objeto: oc.id, detalhe: oc.titulo, contratoId: oc.contratoId });
    return oc;
  }

  function novaOcorrencia(ctx) {
    const item = A.getItem(ctx.itemId);
    A.openModal({
      title: "Abrir ocorrência", subtitle: `${A.getContrato(item.contratoId).numero} · ${esc(item.nome)}${ctx.postoId ? " · " + esc(A.getPosto(ctx.postoId).nome) : ""}`,
      body: `<div class="form-field"><label for="oT">Título <span class="field-req">*</span></label><input class="input" id="oT"/></div>
        <div class="form-field"><label for="oD">Descrição e evidências</label><textarea class="textarea" id="oD"></textarea></div>
        <div class="form-grid">${A.selectField("oO", "Origem", [["indicador", "Indicador"], ["inspecao", "Inspeção"], ["dados", "Problema de dados"]], item.tipo === "indicador" ? "indicador" : "inspecao")}<div class="form-field"><label for="oP">Prazo (dias)</label><input class="input" type="number" id="oP" value="${esc(item.config.tratativa.prazoDias)}"/></div></div>
        <div class="callout">${icon("info")}<div>O posto indica onde o problema ocorreu. A responsabilidade financeira continua vinculada à contratada e ao item contratual.</div></div>`,
      actions: [{ label: "Abrir e encaminhar", cls: "primary", icon: "send", onClick: (l) => {
        const t = l.el.querySelector("#oT").value.trim();
        if (!t) { l.el.querySelector("#oT").classList.add("is-missing"); return false; }
        const oc = criarOcorrencia({ itemId: ctx.itemId, postoId: ctx.postoId, comp: ctx.comp, origem: l.el.querySelector("#oO").value, titulo: t, descricao: l.el.querySelector("#oD").value.trim(), prazoDias: +l.el.querySelector("#oP").value || 5 });
        A.save(); A.refreshNav(); A.toast(oc.id + " aberta e encaminhada.");
      } }],
    });
  }

  A.route("op/ocorrencias", "op", (p, q) => ({
    title: "Ocorrências e tratativas", nav: "op/ocorrencias", crumbs: [{ label: "Ocorrências e tratativas" }],
    html: `<div class="section">
      ${A.pageHeader("Ocorrências e tratativas", "“Resolvido” não encerra a ocorrência: o verificador aceita ou rejeita a solução. O vencimento não confirma desconto sozinho.")}
      <div class="filters-grid">
        ${A.selectField("fSt", "Situação", [["", "Todas"], ["abertas", "Em aberto"], ...Object.entries(A.L.oc).map(([k, v]) => [k, v[0]])], q.st || "abertas")}
        ${regiaoField()}${contratoField()}
        ${A.selectField("fOr", "Origem", [["", "Todas"], ...Object.entries(A.L.origem).map(([k, v]) => [k, v[0]])], "")}
      </div>
      <div id="tO"></div>
    </div>`,
    mount(root) {
      const v = (id) => root.querySelector("#" + id).value;
      const t = A.mountTable(root.querySelector("#tO"), {
        caption: "ocorrências",
        rows: () => A.state.ocorrencias.filter((o) => scopeIds().includes(o.contratoId) && okFiltro(root, o.contratoId) && (!v("fOr") || o.origem === v("fOr")) && (!v("fSt") || (v("fSt") === "abertas" ? o.status !== "encerrada" : o.status === v("fSt")))),
        sortKey: "prazo",
        empty: { icon: "task_alt", title: "Nenhuma ocorrência neste filtro" },
        cols: [
          { key: "id", label: "Ocorrência", tdCls: "td-main", render: (o) => `<div class="cell-main">${esc(o.id)} · ${esc(o.titulo)}</div><div class="cell-sub">${esc(A.getContrato(o.contratoId).numero)} · ${o.postoId ? esc(A.getPosto(o.postoId).nome) : "—"} · ${A.fmtComp(o.comp)}</div>` },
          { key: "origem", label: "Origem", render: (o) => `<span class="tag">${icon(A.L.origem[o.origem][1])}${esc(A.L.origem[o.origem][0])}</span>` },
          { key: "responsavel", label: "Responsável pela solução" },
          { key: "prazo", label: "Prazo", cls: "nowrap", render: (o) => `${A.fmtDate(o.prazo)}<div class="cell-sub">${esc(o.regraPrazo)}</div>` },
          { key: "status", label: "Situação", render: (o) => lpill("oc", o.status) },
        ],
        onRow: (o) => openOcorrencia(o.id, t.render),
      });
      root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
    },
  }));

  function openOcorrencia(id, onChange) {
    const o = A.state.ocorrencias.find((x) => x.id === id);
    const item = A.getItem(o.itemId);
    const verificador = item.config.responsaveis.verifica;
    const ev = (tipo, texto, por) => { o.eventos.push({ data: A.nowIso(), tipo, por: por || A.currentUser().id, texto }); };
    const done = (msg) => { A.addHistorico({ acao: "Tratativa: " + msg, objeto: o.id, detalhe: o.titulo, contratoId: o.contratoId }); A.save(); A.refreshNav(); A.toast(msg); if (onChange) onChange(); };
    const tlIc = { abertura: "flag", encaminhamento: "send", ciencia: "mark_email_read", resposta: "reply", verificacao: "verified", devolucao: "undo", vencimento: "alarm", prorrogacao: "update", analise: "calculate" };
    const aberta = o.status !== "encerrada";
    const acts = [];
    if (aberta && ["encaminhada", "devolvida", "vencida", "em_analise", "aberta"].includes(o.status) && o.origem !== "dados") acts.push({ label: "Registrar resposta da contratada", icon: "reply", onClick: () => setTimeout(() => {
      A.confirmModal({ title: "Registrar resposta", subtitle: "Resposta e comprovação apresentadas pelo responsável.", body: `<p class="cell-sub">No protótipo, você registra a resposta recebida. O canal de resposta da contratada ainda será definido.</p>`, requireText: "Resposta e evidências apresentadas", confirmLabel: "Registrar", onConfirm: (t) => { o.status = "em_verificacao"; ev("resposta", t, o.responsavel); done("Resposta registrada; aguardando verificação."); setTimeout(() => openOcorrencia(id, onChange), 0); } });
    }, 0) });
    if (o.status === "em_verificacao") {
      acts.push({ label: "Rejeitar solução", cls: "danger-outline", icon: "undo", onClick: () => setTimeout(() => A.confirmModal({ title: "Devolver ao responsável", body: "<p>A solução não foi aceita. A ocorrência volta ao responsável conforme a regra.</p>", requireText: "Motivo", confirmLabel: "Devolver", onConfirm: (t) => { o.status = "devolvida"; ev("devolucao", t); done("Solução devolvida."); setTimeout(() => openOcorrencia(id, onChange), 0); } }), 0) });
      acts.push({ label: "Aceitar correção", cls: "primary", icon: "verified", onClick: () => setTimeout(() => A.confirmModal({ title: "Aceitar a correção", subtitle: `Verificador designado: ${esc(A.userName(verificador))}`, body: "<p>Encerrar a tratativa não apaga um efeito já produzido no período; a análise da medição é um registro separado.</p>", requireText: "Evidência da verificação", confirmLabel: "Aceitar e encerrar tratativa", onConfirm: (t) => { o.status = "encerrada"; ev("verificacao", "Correção aceita. " + t); done("Correção aceita."); setTimeout(() => openOcorrencia(id, onChange), 0); } }), 0) });
    }
    // Prorrogar fica junto do campo Prazo, para o rodapé manter no máximo duas ações.
    const podeProrrogar = aberta && o.status !== "em_verificacao";
    const prorrogar = () => setTimeout(() => A.openModal({
      title: "Prorrogar prazo", subtitle: "Alteração de prazo exige autorização e fica no histórico.",
      body: `<div class="form-field"><label for="np">Novo prazo</label><input class="input" type="date" id="np" min="${D.TODAY}" value="${A.compAdd(D.TODAY.slice(0, 7), 0)}-${String(Math.min(28, +D.TODAY.slice(8) + 5)).padStart(2, "0")}"/></div><div class="form-field"><label for="nj">Justificativa e autorização <span class="field-req">*</span></label><textarea class="textarea" id="nj"></textarea></div>`,
      actions: [{ label: "Prorrogar", cls: "primary", onClick: (l) => { const j = l.el.querySelector("#nj").value.trim(); if (!j) { l.el.querySelector("#nj").classList.add("is-missing"); return false; } const ant = o.prazo; o.prazo = l.el.querySelector("#np").value; if (o.status === "vencida") o.status = "encaminhada"; ev("prorrogacao", `Prazo ${A.fmtDate(ant)} → ${A.fmtDate(o.prazo)}. ${j}`); done("Prazo prorrogado."); setTimeout(() => openOcorrencia(id, onChange), 0); } }],
    }), 0);
    if (o.status === "vencida") acts.push({ label: "Analisar efeito na medição", cls: "primary", icon: "calculate", onClick: () => setTimeout(() => A.confirmModal({
      title: "Analisar efeito na medição", subtitle: `${A.fmtComp(o.comp)} · ${esc(item.nome)}`,
      body: `<div class="callout warning">${icon("info")}<div>${item.config.financeiro.situacao === "validada" ? "Regra validada: " + esc(item.config.financeiro.formula) : "Item sem regra financeira validada. O vencimento não gera desconto; registre a conclusão para a medição."}</div></div>`,
      requireText: "Conclusão e fundamento", confirmLabel: "Registrar conclusão",
      onConfirm: (t) => { ev("analise", t); const m = medDe(o.itemId, o.comp); if (m && m.status !== "fechada") m.status = "em_analise"; done("Conclusão registrada na medição."); setTimeout(() => openOcorrencia(id, onChange), 0); },
    }), 0) });

    A.openDrawer({
      kicker: `${A.getContrato(o.contratoId).numero} · ${A.fmtComp(o.comp)}`,
      title: `${o.id} · ${o.titulo}`,
      subtitle: `${A.L.oc[o.status][0]} · ${A.L.origem[o.origem][0]}`,
      body: `
        ${o.status === "vencida" ? `<div class="callout danger">${icon("alarm")}<div><strong>Prazo vencido sem solução.</strong> Segue para análise e apuração conforme a regra. O vencimento, sozinho, não confirma desconto.</div></div>` : ""}
        ${o.origem === "dados" ? `<div class="callout warning">${icon("database")}<div>Problema de dados: não é descumprimento da contratada. Trata-se com a equipe da integração.</div></div>` : ""}
        <div class="drawer-section"><h4>${icon("info")}Dados da ocorrência</h4>
          <dl class="kv cols-2">
            <div><dt>Posto (onde ocorreu)</dt><dd>${o.postoId ? esc(A.getPosto(o.postoId).nome) : "—"}</dd></div>
            <div><dt>Obrigação / item</dt><dd>${esc(item.nome)}</dd></div>
            <div><dt>Responsável pela solução</dt><dd>${esc(o.responsavel)}</dd></div>
            <div><dt>Verificador</dt><dd>${esc(A.userName(verificador))}</dd></div>
            <div><dt>Encaminhamento</dt><dd>${A.fmtDate(o.encaminhadoEm)}</dd></div>
            <div><dt>Ciência</dt><dd>${o.cienciaEm ? A.fmtDate(o.cienciaEm) : pill("Não disponível", "nodata")}</dd></div>
            <div><dt>Prazo</dt><dd>${A.fmtDate(o.prazo)} <div class="cell-sub">${esc(o.regraPrazo)}</div>${podeProrrogar ? `<button class="link-btn" type="button" id="ocProrrogar" style="margin-top:4px">${icon("update")}<span>Prorrogar prazo</span></button>` : ""}</dd></div>
            <div><dt>Efeito na medição</dt><dd>${A.finCfgPill(item.config.financeiro.situacao)}</dd></div>
          </dl>
          <p style="margin:12px 0 0;font-size:14px">${esc(o.descricao)}</p>
        </div>
        <div class="drawer-section"><h4>${icon("inventory_2")}Evidências</h4>${o.evidencias.length ? `<div class="check-row">${o.evidencias.map((e) => `<span class="tag info">${icon("attach_file")}${esc(e)}</span>`).join("")}</div>` : `<p class="cell-sub">Sem evidências anexadas.</p>`}</div>
        <div class="drawer-section"><h4>${icon("timeline")}Andamento</h4><ul class="timeline">${o.eventos.slice().reverse().map((e) => `<li><span class="tl-dot ${["verificacao"].includes(e.tipo) ? "success" : ["vencimento", "devolucao"].includes(e.tipo) ? "danger" : ["resposta", "prorrogacao"].includes(e.tipo) ? "warning" : ""}">${icon(tlIc[e.tipo] || "circle")}</span><div><div class="tl-title">${esc(e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1))}</div><div class="tl-meta">${A.fmtDateTime(e.data)} · ${esc(D.USERS[e.por] ? A.userName(e.por) : e.por === "sistema" ? "Sistema" : e.por)}</div><div class="tl-body">${esc(e.texto)}</div></div></li>`).join("")}</ul></div>`,
      actions: acts,
      mount(box, layer) { const b = box.querySelector("#ocProrrogar"); if (b) b.addEventListener("click", () => { layer.close(); prorrogar(); }); },
    });
  }

  /* ---------------- Medições ---------------- */
  A.route("op/medicoes", "op", (p, q) => ({
    title: "Medições", nav: "op/medicoes", crumbs: [{ label: "Medições" }],
    html: `<div class="section">
      ${A.pageHeader("Medições por competência", "Uma medição por item, escopo e período. O estado da execução é separado da condição do prazo; valores aparecem só onde há regra validada.")}
      <div class="filters-grid">
        ${A.selectField("fComp", "Competência", [["", "Todas"], ...[...new Set(A.state.medicoes.map((m) => m.comp))].sort().reverse().map((c) => [c, A.fmtComp(c)])], q.comp || "")}
        ${regiaoField()}${contratoField()}
        ${A.selectField("fSt", "Situação", [["", "Todas"], ...Object.entries(A.L.med).map(([k, v]) => [k, v[0]])], "")}
        ${A.selectField("fPz", "Prazo", [["", "Todos"], ...Object.entries(A.L.prazo).map(([k, v]) => [k, v[0]])], "")}
      </div>
      <div id="tM"></div>
    </div>`,
    mount(root) {
      const v = (id) => root.querySelector("#" + id).value;
      const t = A.mountTable(root.querySelector("#tM"), {
        caption: "medições",
        rows: () => A.state.medicoes.filter((m) => { const it = A.getItem(m.itemId); return it && scopeIds().includes(it.contratoId) && (!v("fComp") || m.comp === v("fComp")) && okFiltro(root, it.contratoId) && (!v("fSt") || m.status === v("fSt")) && (!v("fPz") || m.prazo === v("fPz")); }),
        sortKey: "comp", sortDir: -1,
        empty: { icon: "calculate", title: "Nenhuma medição neste filtro" },
        cols: [
          { key: "item", label: "Item", tdCls: "td-main", sortValue: (m) => A.getItem(m.itemId).nome, render: (m) => { const it = A.getItem(m.itemId); return `<div class="cell-main">${esc(it.nome)}</div><div class="cell-sub">${esc(A.getContrato(it.contratoId).numero)} · regra v${m.versaoRegra}</div>`; } },
          { key: "comp", label: "Competência", render: (m) => A.fmtComp(m.comp) },
          { key: "status", label: "Situação", render: (m) => lpill("med", m.status) },
          { key: "prazo", label: "Prazo", render: (m) => `${lpill("prazo", m.prazo)}<div class="cell-sub">${m.fechamentoAte ? "Fecha até " + A.fmtDate(m.fechamentoAte) : "A definir"}</div>` },
          { key: "fin", label: "Efeito financeiro", sortValue: (m) => m.financeiro.situacao, render: (m) => lpill("fin", m.financeiro.situacao) },
          { key: "glosa", label: "Glosa", cls: "num", sortValue: (m) => { const v = A.medValores(m); return v.confirmado ?? v.estimado; }, render: (m) => { const v = A.medValores(m); const fmt = (x) => (x == null ? "—" : A.fmtMoney(x)); return `<div class="cell-sub nowrap">Estimada ${fmt(v.estimado)}</div><div class="nowrap">Confirmada <strong>${fmt(v.confirmado)}</strong></div>`; } },
        ],
        onRow: (m) => openMedicao(m.id, t.render),
      });
      root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
    },
  }));

  function openMedicao(id, onChange) {
    const m = A.state.medicoes.find((x) => x.id === id);
    const item = A.getItem(m.itemId);
    const c = A.getContrato(item.contratoId);
    const vals = A.medValores(m);
    const g = A.glosaEstimada(item.id, m.comp);
    const cobertura = item.tipo === "indicador" && !(item.config.especifico.fonte || "").startsWith("Outra") ? item.config.abrangencia.map((p) => ({ p, r: A.computeIndicator(item.id, p, m.comp) })) : [];
    const lacunas = cobertura.filter((x) => x.r.cobertura < 1 && x.r.ausentes.length);
    // Competência que ainda não começou: não há dado do CCO para mostrar na memória de cálculo.
    const periodoFuturo = m.comp > A.CURRENT_COMP;
    const ocs = A.state.ocorrencias.filter((o) => o.itemId === item.id && o.comp === m.comp);
    const validador = item.config.responsaveis.verifica;
    const ev = (acao, det) => { A.addHistorico({ acao, objeto: `Medição ${A.fmtComp(m.comp)} — ${item.nome}`, detalhe: det, contratoId: item.contratoId }); A.save(); A.refreshNav(); if (onChange) onChange(); };
    const reopen = () => setTimeout(() => openMedicao(id, onChange), 0);

    const acts = [];
    if (["em_analise", "aguardando", "em_acompanhamento"].includes(m.status) && m.comp < A.CURRENT_COMP) acts.push({ label: "Submeter para validação", cls: "primary", icon: "send",
      disabled: m.status === "aguardando", tip: "Faltam dados ou evidências do período. A medição só pode ser submetida depois que eles chegarem.",
      onClick: () => setTimeout(() => {
      A.confirmModal({ title: "Submeter para validação", body: `<p>A medição será enviada ao responsável competente (${esc(A.userName(validador))}). Você não confirma valores nesta etapa.</p>`, confirmLabel: "Submeter", onConfirm: () => { m.status = "pronta_validacao"; if (m.financeiro.situacao === "risco") m.financeiro.situacao = "estimada"; ev("Medição submetida", "Pronta para validação."); A.toast("Medição pronta para validação."); reopen(); } });
    }, 0) });
    if (m.status === "pronta_validacao") {
      acts.push({ label: "Validar e fechar", cls: "primary", icon: "lock", disabled: true, tip: "Sua função prepara e submete; a confirmação cabe ao responsável competente." });
      acts.push({ label: `Simular validação por ${A.userName(validador)}`, icon: "how_to_reg", onClick: () => setTimeout(() => A.openModal({
        kicker: "Simulação de protótipo", title: "Validação pelo responsável competente", subtitle: `${esc(A.userName(validador))} · ${A.fmtComp(m.comp)}`,
        body: `${lacunas.length ? `<div class="callout warning">${icon("event_busy")}<div><strong>Cobertura incompleta</strong> em ${lacunas.map((x) => esc(A.getPosto(x.p).nome)).join(", ")}. O fechamento exige exceção autorizada.</div></div><label class="check-chip"><input type="checkbox" id="vExc"/>Registrar exceção autorizada para a lacuna</label>` : ""}
          ${vals.estimado != null ? `<div class="form-field"><span class="field-label">Decisão sobre a glosa estimada (${A.fmtMoney(vals.estimado)})</span><div class="check-row"><label class="check-chip"><input type="radio" name="vDec" value="confirmada" checked/>Confirmar glosa</label><label class="check-chip"><input type="radio" name="vDec" value="nao_aplicada"/>Não aplicar</label></div></div>` : ""}
          <div class="form-field"><label for="vJ">Fundamento da decisão <span class="field-req">*</span></label><textarea class="textarea" id="vJ"></textarea></div>`,
        actions: [{ label: "Validar e fechar", cls: "primary", icon: "lock", onClick: (l) => {
          const j = l.el.querySelector("#vJ").value.trim();
          if (!j) { l.el.querySelector("#vJ").classList.add("is-missing"); return false; }
          const exc = l.el.querySelector("#vExc");
          if (exc && !exc.checked) { A.toast("Registre a exceção autorizada para a lacuna de cobertura.", "error"); return false; }
          const dec = (l.el.querySelector("[name=vDec]:checked") || {}).value;
          m.status = "fechada";
          m.fechamento = { por: validador, em: A.nowIso(), fundamento: j, excecao: !!exc };
          if (vals.estimado != null) m.financeiro = Object.assign({}, m.financeiro, { situacao: dec, estimado: vals.estimado, confirmado: dec === "confirmada" ? vals.estimado : 0, justificativa: j });
          A.state.riscos = A.state.riscos.filter((r) => !(r.contratoId === item.contratoId && /pronta para validação/.test(r.motivo)));
          ev("Fechamento", `Validado por ${A.userName(validador)}. ${j}`);
          A.toast("Medição fechada.", "lock"); reopen();
        } }],
      }), 0) });
    }
    if (m.status === "fechada") acts.push({ label: "Solicitar retificação", cls: "danger-outline", icon: "edit_note", onClick: () => setTimeout(() => A.confirmModal({ title: "Solicitar retificação", body: "<p>Medições fechadas só mudam por retificação autorizada, com comparação entre os valores anteriores e revisados.</p>", requireText: "Justificativa", confirmLabel: "Solicitar", onConfirm: (t) => { m.status = "em_retificacao"; m.retificacao = { motivo: t, anterior: vals }; ev("Retificação solicitada", t); A.toast("Retificação solicitada."); reopen(); } }), 0) });

    A.openDrawer({
      kicker: `${c.numero} · ${A.fmtComp(m.comp, true)}`,
      title: item.nome,
      subtitle: `Regra versão ${m.versaoRegra} · ${A.L.med[m.status][0]} · ${A.L.prazo[m.prazo][0]}`,
      body: `
        <div class="drawer-section"><h4>${icon("flag")}Situação</h4>
          <div class="status-dims"><div class="status-dim"><span>Execução</span>${lpill("med", m.status)}</div><div class="status-dim"><span>Prazo</span>${lpill("prazo", m.prazo)}</div><div class="status-dim"><span>Efeito financeiro</span>${lpill("fin", m.financeiro.situacao)}</div></div>
          ${m.fechamento ? `<p class="cell-sub" style="margin-top:10px">${icon("lock")} Fechada por ${esc(A.userName(m.fechamento.por))} em ${A.fmtDateTime(m.fechamento.em)}${m.fechamento.fundamento ? " · " + esc(m.fechamento.fundamento) : ""}</p>` : ""}
          ${m.retificacao ? `<div class="callout danger" style="margin-top:10px">${icon("edit_note")}<div><strong>Retificação:</strong> ${esc(m.retificacao.motivo)}<br>Valor anterior confirmado: ${A.fmtMoney(m.retificacao.anterior.confirmado || 0)}</div></div>` : ""}
          ${m.status === "programada" ? `<div class="callout" style="margin-top:10px">${icon("event")}<div>Competência programada. O acompanhamento começa no período; não há medições retroativas.</div></div>` : ""}
        </div>
        <div class="drawer-section"><h4>${icon("payments")}Valores</h4>
          <div class="money-split" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <div class="money-box is-est"><span>Glosa estimada</span><strong>${vals.estimado == null ? "—" : A.fmtMoney(vals.estimado)}</strong><span>${item.config.financeiro.situacao === "validada" ? "Regra validada aplicada" : "Sem regra validada"}</span></div>
            <div class="money-box is-conf"><span>Glosa confirmada</span><strong>${vals.confirmado == null ? "—" : A.fmtMoney(vals.confirmado)}</strong><span>${m.financeiro.justificativa ? esc(m.financeiro.justificativa) : "Somente após validação"}</span></div>
          </div>
          ${m.financeiro.situacao === "pendente" ? `<div class="callout warning" style="margin-top:10px">${icon("calculate")}<div><strong>Cálculo pendente:</strong> a regra financeira deste item ainda não foi validada pelo Gestor/Fiscal.</div></div>` : ""}
        </div>
        ${cobertura.length && periodoFuturo ? `<div class="drawer-section"><h4>${icon("calculate")}Memória de cálculo por posto</h4><div class="callout">${icon("event")}<div>O período de ${A.fmtComp(m.comp, true)} ainda não começou. A memória de cálculo aparece quando chegarem os primeiros dados do CCO.</div></div></div>` : ""}
        ${cobertura.length && !periodoFuturo ? `<div class="drawer-section"><h4>${icon("calculate")}Memória de cálculo por posto</h4>
          <table class="calc-table"><thead><tr><th>Posto</th><th class="num">Resultado</th><th class="num">Cobertura</th><th class="num">Faixas</th><th class="num">%</th><th class="num">Estimado</th></tr></thead><tbody>
            ${cobertura.map(({ p, r }) => { const l = g ? g.linhas.find((x) => x.postoId === p) : null; return `<tr><td>${esc(A.getPosto(p).nome)}</td><td class="num">${r.valor != null ? A.fmtNum(r.valor) : "s/d"}</td><td class="num">${Math.round(r.cobertura * 100)}%</td><td class="num">${l ? l.faixas : "—"}</td><td class="num">${l ? l.pct.toLocaleString("pt-BR") + "%" : "—"}</td><td class="num">${l ? A.fmtMoney(l.valor) : "—"}</td></tr>`; }).join("")}
            ${g ? `<tr class="total"><td colspan="5">Total estimado (parcela mensal do posto: ${A.fmtMoney(g.parcela)})</td><td class="num">${A.fmtMoney(g.total)}</td></tr>` : ""}
          </tbody></table>
          ${lacunas.length ? `<p class="field-hint" style="margin-top:8px">Lacunas de cobertura: ${lacunas.map((x) => `${esc(A.getPosto(x.p).nome)} (${x.r.ausentes.map(A.fmtDate).join(", ")})`).join("; ")}.</p>` : ""}
        </div>` : ""}
        <div class="drawer-section"><h4>${icon("build_circle")}Ocorrências do período</h4>${ocs.length ? `<div class="list">${ocs.map(ocItem).join("")}</div>` : `<p class="cell-sub">Nenhuma ocorrência vinculada a esta competência.</p>`}</div>
        <div class="drawer-section"><h4>${icon("how_to_reg")}Responsáveis pelas decisões</h4><dl class="kv cols-2"><div><dt>Prepara</dt><dd>${esc(A.userName(item.config.responsaveis.acompanha))} (Operação)</dd></div><div><dt>Valida e fecha</dt><dd>${esc(A.userName(validador))}<div class="cell-sub">Autoridade de fechamento ainda em definição</div></dd></div></dl></div>`,
      actions: acts,
      mount(box) { box.querySelectorAll("[data-oc]").forEach((b) => b.addEventListener("click", () => setTimeout(() => openOcorrencia(b.dataset.oc), 0))); },
    });
  }

  /* ---------------- Evidências e relatórios ---------------- */
  A.route("op/evidencias", "op", () => {
    const ev = [];
    itensAtivos().forEach((it) => {
      if (it.tipo === "indicador" && !(it.config.especifico.fonte || "").startsWith("Outra")) {
        it.config.abrangencia.forEach((p) => [A.compAdd(A.CURRENT_COMP, -1), A.CURRENT_COMP].forEach((comp) => {
          const r = A.computeIndicator(it.id, p, comp);
          ev.push({ id: `CCO-${comp.replace("-", "")}-${p}-${it.id}`, tipo: "Dados de origem", fonte: "CCO (integração)", item: it, posto: p, comp, desc: `${r.ind} diário · ${r.validos}/${r.previstos} dias`, data: D.CCO_LAST_PULL, reproduz: true });
        }));
      }
    });
    A.state.fiscalizacoes.filter((f) => scopeIds().includes(f.contratoId)).forEach((f) => {
      ev.push({ id: f.id, tipo: "Checklist", fonte: "Inspeção física", item: A.getItem(f.itemId), posto: f.postoId, comp: f.data.slice(0, 7), desc: `${D.CHECKLISTS[f.checklist].nome} ${f.versao}`, data: f.data, reproduz: true, link: "#/op/fiscalizacao/" + f.id });
      Object.values(f.respostas).filter((r) => r.foto).forEach((r) => ev.push({ id: f.id + "-foto", tipo: "Foto", fonte: "Inspeção física", item: A.getItem(f.itemId), posto: f.postoId, comp: f.data.slice(0, 7), desc: r.foto, data: f.data, reproduz: false, link: "#/op/fiscalizacao/" + f.id }));
    });
    D.DOCUMENTOS.filter((d) => scopeIds().includes(d.contratoId) && ["Relatório", "Ofício"].includes(d.tipo)).forEach((d) => ev.push({ id: "SEI " + d.sei, tipo: "Documento", fonte: "SEI", item: null, contratoId: d.contratoId, posto: null, comp: d.data.slice(0, 7), desc: d.titulo, data: d.data, reproduz: false }));
    return {
      title: "Evidências e relatórios", nav: "op/evidencias", crumbs: [{ label: "Evidências e relatórios" }],
      html: `<div class="section">
        ${A.pageHeader("Evidências e relatórios", "Cada evidência identifica a fonte e permite reproduzir a apuração considerada, observadas as permissões.", A.exportMenu('data-export="evidencias"', { cls: "btn outline", alignRight: true }))}
        <div class="filters-grid">${regiaoField()}${A.selectField("fTp", "Tipo", [["", "Todos"], ...[...new Set(ev.map((e) => e.tipo))].map((t) => [t, t])], "")}${A.selectField("fComp", "Competência", [["", "Todas"], ...[...new Set(ev.map((e) => e.comp))].sort().reverse().map((c) => [c, A.fmtComp(c)])], "")}</div>
        <div id="tE"></div>
      </div>`,
      mount(root) {
        const v = (id) => root.querySelector("#" + id).value;
        const rows = () => ev.filter((e) => (!v("fRegiao") || regiaoDe(e.item ? e.item.contratoId : e.contratoId) === v("fRegiao")) && (!v("fTp") || e.tipo === v("fTp")) && (!v("fComp") || e.comp === v("fComp")));
        const t = A.mountTable(root.querySelector("#tE"), {
          caption: "evidências",
          rows, sortKey: "data", sortDir: -1,
          empty: { icon: "inventory_2", title: "Nenhuma evidência neste filtro" },
          cols: [
            { key: "id", label: "Identificador", tdCls: "td-main", render: (e) => `<div class="cell-main"><code>${esc(e.id)}</code></div><div class="cell-sub">${esc(e.desc)}</div>` },
            { key: "tipo", label: "Tipo", render: (e) => `<span class="tag">${esc(e.tipo)}</span>` },
            { key: "fonte", label: "Fonte" },
            { key: "itemN", label: "Item / posto", sortValue: (e) => (e.item ? e.item.nome : ""), render: (e) => `${e.item ? esc(e.item.nome) : esc(A.getContrato(e.contratoId).numero)}<div class="cell-sub">${e.posto ? esc(A.getPosto(e.posto).nome) : "—"}</div>` },
            { key: "comp", label: "Competência", render: (e) => A.fmtComp(e.comp) },
            { key: "reproduz", label: "Reprodutível", render: (e) => (e.reproduz ? pill("Sim", "success") : pill("Registro", "neutral")) },
          ],
          onRow: (e) => { if (e.link) A.go(e.link.slice(2)); else if (e.item && e.tipo === "Dados de origem") openItemDetail(e.item.id, e.posto, e.comp); },
        });
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
        root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
          const header = ["Identificador", "Tipo", "Fonte", "Item", "Posto", "Competência", "Descrição", "Data"];
          const data = rows().map((e) => [e.id, e.tipo, e.fonte, e.item ? e.item.nome : "", e.posto ? A.getPosto(e.posto).nome : "", A.fmtComp(e.comp), e.desc, e.data]);
          if (b.dataset.format === "csv") A.downloadCsv("indice-evidencias.csv", header, data);
          else A.downloadPdf("indice-evidencias.pdf", "Índice de evidências", header, data);
        }));
      },
    };
  });

  Object.assign(A, { openItemDetail, openMedicao, openOcorrencia });
})();
