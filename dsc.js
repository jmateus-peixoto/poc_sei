/* ============================================================
   Primeira versão (P1) — reuniões de 05/11/2026 sobre o documento GCR → T7:
   Caixa DSC (R06), Radar de exceções (R15) e OIS (R05, sem medição e pagamento).
   As telas valem para os dois perfis: Diretoria DSC (consulta e alertas, sem
   etapa de aprovação) e Equipe GCR (curadoria: classifica, atribui e cobra).
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  const { esc, icon, pill, lpill, D } = A;

  /* Dias sem andamento para um processo contar como parado. Definido pelo usuário em "Regras do controle"
     (menu do usuário), vale para os dois perfis; 30 dias até alguém mudar. */
  const LIMITE_PADRAO = 30;
  const limiteParado = () => ((A.state.regras || {}).limiteParado || LIMITE_PADRAO);
  const FECHADAS = ["concluido", "encerrado_pendencia"];
  const S = () => A.state;
  const isGcr = () => A.profileKey === "gestor";
  const base = () => A.profileKey; // "super" ou "gestor": o prefixo das rotas é a chave do perfil

  /* ---------------- Caixa DSC: regras ---------------- */
  const cxAberta = (e) => !FECHADAS.includes(e.situacao);
  const ultimoAnd = (e) => e.andamentos[e.andamentos.length - 1];
  const diasSemAndamento = (e) => -A.daysUntil(ultimoAnd(e).data);
  const cxVencida = (e) => cxAberta(e) && !!e.prazo && e.prazo.data < D.TODAY;
  const cxParada = (e) => cxAberta(e) && !e.sobrestado && diasSemAndamento(e) > limiteParado();
  const comDiretor = (e) => cxAberta(e) && e.aguardando === "Diretor DSC";
  /* Quem não é unidade interna da Prodesp/DSC é terceiro: contratada, prefeitura, órgão externo */
  const ehTerceiro = (q) => !!q && !/^(DSC|DJU|DAF|Diretor)/.test(q);
  const getCx = (id) => S().caixa.find((e) => e.id === id);
  const vistoDiretor = (e) => (S().vistosDiretor || []).includes(e.id);
  function marcarVistoDiretor(e) {
    if (A.profileKey !== "super" || vistoDiretor(e)) return;
    S().vistosDiretor = (S().vistosDiretor || []).concat(e.id);
    A.save();
  }

  function caixaAguardandoDiretor() { return S().caixa.filter(comDiretor); }
  function caixaTriagem() { return S().caixa.filter((e) => e.situacao === "sem_classificacao" || (cxAberta(e) && !e.responsavel)); }
  const cobrancasDe = (ref) => S().cobrancas.filter((c) => c.ref === ref).sort((a, b) => (a.data < b.data ? 1 : -1));

  /* ---------------- OIS: regras ---------------- */
  const ETAPAS = [["solicitacao", "Solicitação"], ["emissao", "Emissão"], ["assinatura", "Assinatura"], ["execucao", "Execução"], ["aceite", "Aceite"]];
  function oisEtapa(o) {
    const i = ETAPAS.findIndex(([k]) => !o.etapas[k]);
    if (i < 0) return { idx: ETAPAS.length, key: "concluida", label: "Concluída", desde: o.etapas.aceite };
    return { idx: i, key: ETAPAS[i][0], label: ETAPAS[i][1], desde: i ? o.etapas[ETAPAS[i - 1][0]] : null };
  }
  /* OIS emitida depois do fim da vigência: execução sem lastro contratual (caso relatado pela GCR) */
  function oisSemLastro(o) {
    const c = A.getContrato(o.contratoId);
    return !!(o.etapas.emissao && c.datas.fimVigencia && o.etapas.emissao > c.datas.fimVigencia);
  }
  function oisAtraso(o) {
    const et = oisEtapa(o);
    if (et.idx >= ETAPAS.length) return null;
    const dias = et.desde ? -A.daysUntil(et.desde) : 0;
    if ((et.key === "emissao" || et.key === "assinatura") && dias > 10) return { dias, texto: `${et.label} pendente há ${dias} dias` };
    if (et.key === "aceite" && o.comp < A.CURRENT_COMP) {
      const fimComp = A.compAdd(o.comp, 1) + "-10";
      if (fimComp < D.TODAY) return { dias: -A.daysUntil(fimComp), texto: `Aceite de ${A.fmtComp(o.comp)} pendente` };
    }
    return null;
  }
  const oisDo = (cid) => S().ois.filter((o) => o.contratoId === cid).sort((a, b) => (a.comp < b.comp ? 1 : -1));
  /* Situação da OIS de uma competência para um contrato executado por OIS */
  function oisDoMes(c, comp = A.CURRENT_COMP) {
    const sit = A.situacaoContratual(c);
    const o = S().ois.find((x) => x.contratoId === c.id && x.comp === comp);
    if (!o) {
      if (sit.key === "encerrado") return { key: "encerrado", label: "Vigência encerrada", tone: "outline", o: null };
      return { key: "nao_emitida", label: "Não emitida", tone: "danger", o: null };
    }
    if (oisSemLastro(o)) return { key: "sem_lastro", label: "Sem cobertura contratual", tone: "danger", o };
    if (!o.etapas.emissao) return { key: "solicitada", label: "Solicitada, não emitida", tone: "warning", o };
    if (!o.etapas.assinatura) return { key: "sem_assinatura", label: "Emitida, falta assinatura", tone: "warning", o };
    return { key: "ok", label: "Emitida e assinada", tone: "success", o };
  }
  const contratosOis = () => D.CONTRATOS.filter((c) => c.ois);

  /* ---------------- Radar de exceções (R15) ---------------- */
  const GRUPOS = [
    { key: "vencidos", label: "Prazo vencido", ic: "alarm", tone: "danger", risco: "Descumprir prazo legal, contratual ou interno." },
    { key: "diretor", label: "Decisão do Diretor", ic: "draw", tone: "warning", risco: "O processo não anda até a assinatura ou decisão do Diretor." },
    { key: "parados", label: "Parado", ic: "hourglass_disabled", tone: "warning", risco: "Sem andamento além do limite definido em Regras do controle, sem sobrestamento formal." },
    { key: "terceiro", label: "Aguardando terceiro", ic: "pending", tone: "info", risco: "Depende de alguém de fora da Prodesp; a responsabilidade precisa estar registrada." },
    { key: "semresp", label: "Sem responsável", ic: "person_off", tone: "danger", risco: "Ninguém está designado para fazer o assunto andar." },
    { key: "semevid", label: "Sem evidência ou com pendência", ic: "plagiarism", tone: "warning", risco: "Encerrado sem prova do que foi feito ou com pendência residual." },
    { key: "ois", label: "Exceção de OIS", ic: "assignment_late", tone: "danger", risco: "Serviço sem OIS, sem assinatura ou sem cobertura contratual." },
    { key: "vigencia", label: "Vigência", ic: "event_busy", tone: "danger", risco: "Execução sem cobertura contratual depois do fim da vigência." },
    { key: "sobrestado", label: "Sobrestado formalmente", ic: "pause_circle", tone: "neutral", risco: "Parado por ato formal; não é atraso, mas precisa de quem desbloqueie." },
  ];
  const grupo = (k) => GRUPOS.find((g) => g.key === k);

  function radarItens(o = {}) {
    const out = [];
    const nomeResp = (u) => (u ? A.userName(u) : null);
    S().caixa.forEach((e) => {
      const b = { ref: "cx:" + e.id, origem: "caixa", objId: e.id, contratoId: e.contratoId, titulo: e.assunto, responsavel: nomeResp(e.responsavel), aguardando: cxAberta(e) ? e.aguardando : null, prazo: e.prazo ? e.prazo.data : null, evidencia: e.evidencia ? e.evidencia : `SEI ${e.sei} · processo ${e.processo}` };
      const ab = cxAberta(e);
      if (cxVencida(e)) out.push({ ...b, grupo: "vencidos", motivo: `${A.L.prazoTipo[e.prazo.tipo][0]} venceu em ${A.fmtDate(e.prazo.data)} (há ${-A.daysUntil(e.prazo.data)} dias). ${e.prazo.regra}.`, proxima: e.aguardando ? `Cobrar ${e.aguardando} e registrar a resposta.` : "Definir quem responde." });
      if (comDiretor(e)) out.push({ ...b, grupo: "diretor", motivo: `Aguardando ${A.L.acao[e.acao][0].toLowerCase()} do Diretor desde ${A.fmtDate(ultimoAnd(e).data)}.`, proxima: `${A.L.acao[e.acao][0]} do Diretor no SEI.`, decisao: e.acao === "aprovacao" ? "Aprovar ou devolver" : "Assinar ou devolver com despacho" });
      if (cxParada(e)) out.push({ ...b, grupo: "parados", motivo: `Sem andamento há ${diasSemAndamento(e)} dias em ${ultimoAnd(e).unidade}.`, proxima: `Cobrar ${e.aguardando || ultimoAnd(e).unidade} ou registrar sobrestamento formal.` });
      if (ab && e.sobrestado) out.push({ ...b, grupo: "sobrestado", motivo: `Sobrestado desde ${A.fmtDate(e.sobrestado.desde)}: ${e.sobrestado.motivo}.`, proxima: `Desbloqueio depende de ${e.sobrestado.desbloqueio}.`, evidencia: e.sobrestado.ato });
      if (ab && ehTerceiro(e.aguardando)) out.push({ ...b, grupo: "terceiro", motivo: `Depende de ${e.aguardando} desde ${A.fmtDate(ultimoAnd(e).data)} (${diasSemAndamento(e)} dias).`, proxima: `Cobrar ${e.aguardando}; a responsabilidade da GCR foi até o envio.` });
      if (ab && !e.responsavel) out.push({ ...b, grupo: "semresp", motivo: "Entrada aberta sem responsável na Equipe GCR.", proxima: "Classificar e atribuir um responsável." });
      if (e.situacao === "concluido" && !e.evidencia) out.push({ ...b, grupo: "semevid", motivo: "Marcado como concluído sem evidência anexada.", proxima: "Anexar o documento que comprova a conclusão.", evidencia: null });
      if (e.situacao === "encerrado_pendencia") out.push({ ...b, grupo: "semevid", motivo: `Encerrado com pendência: ${e.pendencia}.`, proxima: "Obter a comprovação que falta.", pendencia: e.pendencia });
    });
    S().ois.forEach((x) => {
      const c = A.getContrato(x.contratoId);
      const b = { ref: "ois:" + x.id, origem: "ois", objId: x.id, contratoId: x.contratoId, titulo: `${x.numero} — ${x.objeto}`, responsavel: A.gestorDe(c.id) === "Não designado" ? null : A.gestorDe(c.id), aguardando: x.aguardando || null, prazo: null, evidencia: `SEI ${x.sei}` };
      if (oisSemLastro(x)) out.push({ ...b, grupo: "ois", motivo: `OIS emitida em ${A.fmtDate(x.etapas.emissao)} para contrato com vigência encerrada em ${A.fmtDate(c.datas.fimVigencia)}. Não há lastro contratual.`, proxima: "Suspender a execução e verificar a cobertura com o Jurídico.", responsavel: null });
      const at = oisAtraso(x);
      const cx = x.caixaId && getCx(x.caixaId);
      if (at && !(cx && cxAberta(cx))) out.push({ ...b, grupo: "ois", motivo: `${at.texto}.`, proxima: x.aguardando ? `Cobrar ${x.aguardando}.` : "Registrar a etapa no SEI." });
    });
    contratosOis().forEach((c) => {
      const m = oisDoMes(c);
      if (m.key === "nao_emitida") out.push({ ref: "ct:" + c.id, origem: "contrato", objId: c.id, contratoId: c.id, grupo: "ois", titulo: `${c.numero} — OIS de ${A.fmtComp(A.CURRENT_COMP)}`, motivo: `Nenhuma OIS de ${A.fmtComp(A.CURRENT_COMP)} localizada nos processos do contrato. O último documento é de ${A.fmtComp(oisDo(c.id)[0] ? oisDo(c.id)[0].comp : "—")}.`, proxima: "Confirmar com o gestor se a OIS foi emitida em outro processo ou se está pendente.", responsavel: A.gestorDe(c.id) === "Não designado" ? null : A.gestorDe(c.id), aguardando: null, prazo: null, evidencia: "Busca nos processos vinculados ao contrato" });
    });
    D.CONTRATOS.forEach((c) => {
      const sit = A.situacaoContratual(c);
      if (!A.designacoesAtivas(c.id).length && !A.respManual(c.id)) out.push({ ref: "ct:" + c.id, origem: "contrato", objId: c.id, contratoId: c.id, grupo: "semresp", titulo: `${c.numero} — ${c.objeto}`, motivo: "Contrato sem gestor ou fiscal identificado nos documentos.", proxima: "Informar o responsável na ficha do contrato (aba Responsáveis).", responsavel: null, aguardando: null, prazo: null, evidencia: "Nenhuma portaria de designação vigente" });
      if (sit.key === "vencendo" && !S().aditivos.some((a) => a.contratoId === c.id && a.tipo === "Prorrogação" && a.situacao !== "proposto")) {
        const ad = S().aditivos.find((a) => a.contratoId === c.id && a.tipo === "Prorrogação");
        out.push({ ref: "ct:" + c.id, origem: "contrato", objId: c.id, contratoId: c.id, grupo: "vigencia", titulo: `${c.numero} — ${c.objeto}`, motivo: `Vigência termina em ${sit.dias} dias (${A.fmtDate(c.datas.fimVigencia)}). ${ad ? "Prorrogação proposta, ainda não assinada." : "Nenhuma prorrogação ou nova contratação vinculada."}`, proxima: ad ? "Assinar o termo aditivo de prorrogação." : "Definir a estratégia de continuidade.", responsavel: A.gestorDe(c.id) === "Não designado" ? null : A.gestorDe(c.id), aguardando: ad ? "Diretor DSC" : null, prazo: c.datas.fimVigencia, evidencia: ad ? `Minuta SEI ${ad.sei}` : "—" });
      }
    });
    out.forEach((x, i) => { x.id = x.grupo + ":" + x.ref + ":" + i; x.risco = x.grupo === "parados" ? `Sem andamento há mais de ${limiteParado()} dias, sem sobrestamento formal.` : grupo(x.grupo).risco; });
    return o.incluirSobrestados ? out : out.filter((x) => x.grupo !== "sobrestado");
  }
  const oisPendentes = () => radarItens().filter((x) => x.grupo === "ois");
  const radarDoContrato = (cid) => radarItens({ incluirSobrestados: true }).filter((x) => x.contratoId === cid);

  /* ---------------- Peças de interface ---------------- */
  function prazoHtml(e) {
    if (!e.prazo) return `<span class="muted">Sem prazo</span>${e.semPrazoMotivo ? `<div class="cell-sub">${esc(e.semPrazoMotivo)}</div>` : ""}`;
    const d = A.daysUntil(e.prazo.data);
    const venc = cxAberta(e) && d < 0;
    return `<span class="nowrap ${venc ? "txt-danger" : ""}">${A.fmtDate(e.prazo.data)}</span><div class="cell-sub">${esc(A.L.prazoTipo[e.prazo.tipo][0])}</div>${cxAberta(e) ? `<div class="cell-sub ${venc ? "txt-danger" : ""}">${venc ? `vencido há ${-d} dias` : d === 0 ? "vence hoje" : `em ${d} dias`}</div>` : ""}`;
  }
  function ondeEsta(e) {
    if (!cxAberta(e)) return `<span class="muted">Encerrado</span><div class="cell-sub">${A.fmtDate(ultimoAnd(e).data)}</div>`;
    const dias = diasSemAndamento(e);
    return `${e.aguardando ? esc(e.aguardando) : esc(ultimoAnd(e).unidade)}${ehTerceiro(e.aguardando) ? `<div class="cell-sub">${icon("call_made", "cell-ic")}fora da Prodesp</div>` : ""}<div class="cell-sub ${cxParada(e) ? "txt-warning" : ""}">último andamento há ${dias} ${dias === 1 ? "dia" : "dias"}</div>`;
  }
  const respHtml = (u) => (u ? esc(A.userName(u)) : pill("Sem responsável", "danger", "sm"));
  function contratoMini(cid) {
    if (!cid) return `<span class="cell-sub">Sem contrato vinculado</span>`;
    const c = A.getContrato(cid);
    return `<a class="cell-sub link-sub" href="#/${base()}/contrato/${cid}">${esc(c.numero)} · ${esc(c.objeto)}</a>`;
  }
  function oisStepsHtml(o, compact) {
    const et = oisEtapa(o);
    const semLastro = oisSemLastro(o);
    return `<ol class="ois-steps ${compact ? "is-compact" : ""}">${ETAPAS.map(([k, l], i) => {
      const done = !!o.etapas[k];
      const cur = i === et.idx;
      return `<li class="${done ? "done" : ""} ${cur ? "current" : ""} ${semLastro && k === "emissao" ? "alert" : ""}" ${compact ? `data-tip="${esc(l)}: ${done ? A.fmtDate(o.etapas[k]) : cur ? "etapa atual" : "pendente"}" tabindex="0"` : ""}><span class="ois-dot">${icon(done ? "check" : cur ? "more_horiz" : "radio_button_unchecked")}</span>${compact ? "" : `<span class="ois-lbl">${esc(l)}<small>${done ? A.fmtDate(o.etapas[k]) : cur ? "etapa atual" : "—"}</small></span>`}</li>`;
    }).join("")}</ol>`;
  }
  function grupoTag(k) { const g = grupo(k); return `<span class="tag radar-tag is-${g.tone}">${icon(g.ic)}${esc(g.label)}</span>`; }
  function cobrancaList(ref) {
    const cs = cobrancasDe(ref);
    if (!cs.length) return `<p class="cell-sub">Nenhuma cobrança registrada.</p>`;
    return `<ul class="timeline">${cs.map((c) => `<li><span class="tl-dot">${icon("campaign")}</span><div><div class="tl-title">${esc(c.canal)} para ${esc(c.destinatario)}</div><div class="tl-meta">${A.fmtDateTime(c.data)} · ${esc(A.userName(c.por))}</div><div class="tl-body">${esc(c.texto)}${c.resposta ? `<div class="cell-sub" style="margin-top:4px">${icon("reply", "cell-ic")}Resposta: ${esc(c.resposta)}</div>` : `<div class="cell-sub" style="margin-top:4px">Sem resposta registrada</div>`}</div></div></li>`).join("")}</ul>`;
  }

  /* Cobrança registrada pela Equipe GCR (o histórico de cobrança é exigência do R15) */
  function registrarCobranca(ref, destinatario, titulo, onDone) {
    A.openModal({
      kicker: "Registrar cobrança", title: titulo,
      body: `<div class="form-grid">
          ${A.selectField("cbCanal", "Canal", ["E-mail", "Ofício SEI", "Despacho SEI", "Teams", "Telefone"], "E-mail")}
          <div class="form-field"><label for="cbDest">Cobrado <span class="field-req">*</span></label><input class="input" id="cbDest" value="${esc(destinatario || "")}" /></div>
        </div>
        <div class="form-field"><label for="cbTexto">O que foi cobrado <span class="field-req">*</span></label><textarea class="textarea" id="cbTexto" placeholder="Ex.: pedida a posição do alvará e uma data prevista"></textarea></div>
        <div class="form-field"><label for="cbResp">Resposta recebida</label><textarea class="textarea" id="cbResp" placeholder="Deixe em branco se ainda não houve resposta"></textarea></div>
        <div class="callout">${icon("info")}<div>A cobrança fica no histórico do item e aparece para o Diretor. Neste protótipo nada é enviado de fato.</div></div>`,
      actions: [{ label: "Registrar cobrança", cls: "primary", icon: "campaign", onClick: (l) => {
        const dest = l.el.querySelector("#cbDest"), txt = l.el.querySelector("#cbTexto");
        const falta = [dest, txt].filter((x) => !x.value.trim());
        falta.forEach((x) => x.classList.add("is-missing"));
        if (falta.length) { A.toast("Informe quem foi cobrado e o que foi cobrado.", "error"); return false; }
        S().cobrancas.push({ id: A.uid("cb"), ref, data: A.nowIso(), por: A.currentUser().id, canal: l.el.querySelector("#cbCanal").value, destinatario: dest.value.trim(), texto: txt.value.trim(), resposta: l.el.querySelector("#cbResp").value.trim() || null });
        const cid = ref.startsWith("cx:") ? (getCx(ref.slice(3)) || {}).contratoId : ref.startsWith("ois:") ? (S().ois.find((o) => o.id === ref.slice(4)) || {}).contratoId : ref.slice(3);
        A.addHistorico({ acao: "Cobrança", objeto: titulo, detalhe: `${l.el.querySelector("#cbCanal").value} para ${dest.value.trim()}: ${txt.value.trim()}`, contratoId: cid || null });
        A.save();
        A.toast("Cobrança registrada.", "campaign");
        A.refreshNav();
        if (onDone) onDone();
      } }],
    });
  }

  /* ---------------- Detalhe de uma entrada da caixa ---------------- */
  function abrirSei(sei, processo) {
    A.openModal({ kicker: "Referência ao SEI", title: `SEI ${sei}`, subtitle: `Processo ${esc(processo || "—")}`, body: `<div class="callout">${icon("info")}<div>No ambiente real, este atalho abre o documento no SEI-SP com as permissões do seu usuário lá. Neste protótipo a consulta é simulada.</div></div>` });
  }

  function openCaixa(id, onChange) {
    const e = getCx(id);
    marcarVistoDiretor(e);
    const ref = "cx:" + e.id;
    const callouts = [
      e.sobrestado ? `<div class="callout">${icon("pause_circle")}<div><strong>Sobrestado formalmente desde ${A.fmtDate(e.sobrestado.desde)}.</strong> ${esc(e.sobrestado.motivo)}. Ato: ${esc(e.sobrestado.ato)}. Desbloqueio: ${esc(e.sobrestado.desbloqueio)}. Não conta como parado.</div></div>` : "",
      cxVencida(e) ? `<div class="callout danger">${icon("alarm")}<div><strong>${esc(A.L.prazoTipo[e.prazo.tipo][0])} vencido há ${-A.daysUntil(e.prazo.data)} dias.</strong> ${esc(e.prazo.regra)}.</div></div>` : "",
      cxParada(e) ? `<div class="callout warning">${icon("hourglass_disabled")}<div><strong>Parado há ${diasSemAndamento(e)} dias</strong> em ${esc(ultimoAnd(e).unidade)}, sem sobrestamento formal.</div></div>` : "",
      e.situacao === "encerrado_pendencia" ? `<div class="callout danger">${icon("plagiarism")}<div><strong>Pendência residual:</strong> ${esc(e.pendencia)}.</div></div>` : "",
      e.situacao === "concluido" && !e.evidencia ? `<div class="callout warning">${icon("plagiarism")}<div><strong>Concluído sem evidência.</strong> Anexe o documento que comprova a conclusão.</div></div>` : "",
    ].join("");
    const c = e.contratoId ? A.getContrato(e.contratoId) : null;
    A.openDrawer({
      kicker: `Caixa DSC · SEI ${e.sei}`, title: e.assunto,
      subtitle: `${(A.L.cx[e.situacao] || [e.situacao])[0]}${e.precisaDiretor ? " · precisa do Diretor" : " · só para conhecimento do Diretor"}`,
      body: `${callouts}
        <div class="drawer-section"><h4>${icon("badge")}Identificação</h4><dl class="kv cols-2">
          <div><dt>Documento SEI</dt><dd><button class="link-btn" type="button" data-sei>${icon("open_in_new")}<span>SEI ${esc(e.sei)}</span></button></dd></div>
          <div><dt>Processo</dt><dd>${A.procLink(e.processo, e.contratoId)}</dd></div>
          <div><dt>Entrada na caixa</dt><dd>${A.fmtDate(e.entrada)}</dd></div>
          <div><dt>Remetente</dt><dd>${esc(e.remetente)}</dd></div>
          <div><dt>Categoria</dt><dd>${e.categoria ? esc(e.categoria) : pill("Sem classificação", "pending")}</dd></div>
          <div><dt>Contrato</dt><dd>${c ? `<a href="#/${base()}/contrato/${c.id}">${esc(c.numero)}</a><div class="cell-sub">${esc(c.objeto)}</div>` : `<span class="muted">Sem contrato vinculado</span>`}${e.posto ? `<div class="cell-sub">${icon("storefront", "cell-ic")}${esc(A.getPosto(e.posto).nome)}</div>` : ""}</dd></div>
        </dl></div>
        <div class="drawer-section"><h4>${icon("task_alt")}Ação e responsáveis</h4><dl class="kv cols-2">
          <div><dt>Ação requerida</dt><dd>${e.acao ? lpill("acao", e.acao) : pill("A definir", "pending")}</dd></div>
          <div><dt>Diretor</dt><dd>${e.precisaDiretor ? "Precisa assinar ou decidir" : "Só para conhecimento"}</dd></div>
          <div><dt>Responsável na GCR</dt><dd>${respHtml(e.responsavel)}</dd></div>
          <div><dt>Com quem está</dt><dd>${cxAberta(e) ? esc(e.aguardando || ultimoAnd(e).unidade) : "—"}${ehTerceiro(e.aguardando) && cxAberta(e) ? `<div class="cell-sub">Fora da Prodesp: a GCR foi até o envio</div>` : ""}</dd></div>
          <div><dt>Prazo</dt><dd>${prazoHtml(e)}</dd></div>
          <div><dt>Regra do prazo</dt><dd>${e.prazo ? esc(e.prazo.regra) : "—"}</dd></div>
        </dl></div>
        <div class="drawer-section"><h4>${icon("route")}Tramitação</h4>
          <ul class="timeline">${e.andamentos.slice().reverse().map((a, i) => `<li><span class="tl-dot ${i === 0 ? "success" : ""}">${icon(i === 0 ? "location_on" : "east")}</span><div><div class="tl-title">${esc(a.unidade)}</div><div class="tl-meta">${A.fmtDate(a.data)}${i === 0 ? " · localização atual" : ""}</div><div class="tl-body">${esc(a.texto)}</div></div></li>`).join("")}</ul>
        </div>
        <div class="drawer-section"><h4>${icon("verified")}Evidência</h4>${e.evidencia ? `<p>${icon("description", "cell-ic")}${esc(e.evidencia)}</p>` : `<p class="cell-sub">Nenhuma evidência anexada.</p>`}</div>
        <div class="drawer-section"><h4>${icon("campaign")}Cobranças</h4>${cobrancaList(ref)}</div>`,
      actions: isGcr() ? [
        { label: "Classificar e atribuir", cls: "outline", icon: "edit_note", onClick: () => { setTimeout(() => classificar(e.id, onChange), 0); } },
        cxAberta(e) ? { label: "Registrar cobrança", cls: "primary", icon: "campaign", onClick: () => { setTimeout(() => registrarCobranca(ref, e.aguardando, e.assunto, () => { if (onChange) onChange(); }), 0); } } : null,
      ].filter(Boolean) : null,
      mount(box) { box.querySelector("[data-sei]").addEventListener("click", () => abrirSei(e.sei, e.processo)); },
      onClose: () => { if (A.profileKey === "super" && onChange) onChange(); A.refreshNav(); },
    });
  }

  const PESSOAS_GCR = ["rafael", "marcos", "paula", "ana", "joao"];
  const UNIDADES = ["Diretor DSC", "DSC/GCR", "DSC/GOS", "DSC/GAT", "DSC/GIS", "DJU — Jurídico", "DAF — Financeiro", "DAF — Orçamento"];
  const CATEGORIAS = ["Contrato", "Termo aditivo", "OIS", "Ofício", "Notificação", "Despacho", "Parecer", "Memorando", "Órgão de controle", "Documento da contratada"];

  function classificar(id, onChange) {
    const e = getCx(id);
    const aguard = UNIDADES.includes(e.aguardando) ? e.aguardando : e.aguardando ? "__outro" : "DSC/GCR";
    A.openModal({
      wide: true, kicker: `Caixa DSC · SEI ${e.sei}`, title: "Classificar e atribuir", subtitle: esc(e.assunto),
      body: `<div class="form-grid">
          ${A.selectField("clCat", "Categoria", [["", "Selecione"], ...CATEGORIAS.map((x) => [x, x])], e.categoria || "")}
          ${A.selectField("clCt", "Contrato vinculado", [["", "Sem contrato"], ...D.CONTRATOS.map((c) => [c.id, `${c.numero} · ${c.objeto}`])], e.contratoId || "")}
          ${A.selectField("clAcao", "Ação requerida", [["", "Selecione"], ...Object.entries(A.L.acao).map(([k, v]) => [k, v[0]])], e.acao || "")}
          ${A.selectField("clResp", "Responsável na GCR", [["", "Sem responsável"], ...PESSOAS_GCR.map((u) => [u, A.userName(u)])], e.responsavel || "")}
          ${A.selectField("clAg", "Com quem está", [...UNIDADES.map((u) => [u, u]), ["__outro", "Terceiro (contratada, prefeitura, órgão)"]], aguard)}
          <div class="form-field"><label for="clAgOutro">Nome do terceiro</label><input class="input" id="clAgOutro" value="${esc(aguard === "__outro" ? e.aguardando : "")}" placeholder="Ex.: Prefeitura de Vale" /></div>
          ${A.selectField("clSit", "Situação", Object.entries(A.L.cx).filter(([k]) => k !== "nao_localizado").map(([k, v]) => [k, v[0]]), e.situacao)}
          <div class="form-field"><label class="check-inline"><input type="checkbox" id="clDir" ${e.precisaDiretor ? "checked" : ""} /> Precisa da assinatura ou decisão do Diretor</label></div>
          <div class="form-field"><label for="clPrazo">Prazo</label><input class="input" type="date" id="clPrazo" value="${e.prazo ? e.prazo.data : ""}" /></div>
          ${A.selectField("clTipo", "Tipo de prazo", Object.entries(A.L.prazoTipo).map(([k, v]) => [k, v[0]]), e.prazo ? e.prazo.tipo : "interno")}
        </div>
        <div class="form-field"><label for="clRegra">Regra do prazo</label><input class="input" id="clRegra" value="${esc(e.prazo ? e.prazo.regra : "")}" placeholder="Ex.: 10 dias úteis a partir do recebimento" /></div>
        <div class="form-field"><label for="clEvid">Evidência</label><input class="input" id="clEvid" value="${esc(e.evidencia || "")}" placeholder="Documento SEI que comprova o que foi feito" /><span class="field-hint">Obrigatória para marcar como concluído.</span></div>
        <div class="form-field"><label for="clPend">Pendência residual</label><input class="input" id="clPend" value="${esc(e.pendencia || "")}" placeholder="O que ainda falta comprovar" /><span class="field-hint">Obrigatória para encerrar com pendência.</span></div>`,
      actions: [{ label: "Salvar", cls: "primary", icon: "save", onClick: (l) => {
        const v = (x) => l.el.querySelector("#" + x).value.trim();
        const sit = v("clSit");
        const miss = [];
        if (sit === "concluido" && !v("clEvid")) miss.push("clEvid");
        if (sit === "encerrado_pendencia" && !v("clPend")) miss.push("clPend");
        if (v("clAg") === "__outro" && !v("clAgOutro")) miss.push("clAgOutro");
        if (v("clPrazo") && !v("clRegra")) miss.push("clRegra");
        miss.forEach((x) => l.el.querySelector("#" + x).classList.add("is-missing"));
        if (miss.length) { A.toast("Preencha os campos destacados.", "error"); return false; }
        const novoAg = v("clAg") === "__outro" ? v("clAgOutro") : v("clAg");
        const mudouLocal = novoAg !== e.aguardando;
        Object.assign(e, {
          categoria: v("clCat") || null, contratoId: v("clCt") || null, acao: v("clAcao") || null, responsavel: v("clResp") || null,
          aguardando: FECHADAS.includes(sit) ? null : novoAg, situacao: sit === "sem_classificacao" && v("clCat") ? "recebido" : sit,
          precisaDiretor: l.el.querySelector("#clDir").checked,
          prazo: v("clPrazo") ? { data: v("clPrazo"), tipo: v("clTipo"), regra: v("clRegra") } : null,
          evidencia: v("clEvid") || null, pendencia: v("clPend") || null,
        });
        if (mudouLocal && !FECHADAS.includes(sit)) e.andamentos.push({ data: D.TODAY, unidade: novoAg, texto: "Localização atualizada pela Equipe GCR." });
        A.addHistorico({ acao: "Classificação", objeto: `SEI ${e.sei}`, detalhe: `${e.assunto} · ${(A.L.cx[e.situacao] || [""])[0]}${e.responsavel ? " · responsável " + A.userName(e.responsavel) : ""}`, contratoId: e.contratoId });
        A.save();
        A.toast("Entrada atualizada.");
        A.refreshNav();
        if (onChange) onChange();
      } }],
    });
  }

  /* ---------------- Tela: Caixa DSC ---------------- */
  function telaCaixa(p, q) {
    const pr = base();
    const sub = pr === "super"
      ? "Tudo o que entrou e tramita na caixa da DSC, inclusive o que não precisa da sua assinatura. Você só acompanha: não há etapa de aprovação nova."
      : "Entradas da caixa da DSC para classificar, vincular ao contrato, atribuir responsável, acompanhar prazos e cobrar.";
    return {
      title: "Caixa DSC", nav: pr + "/caixa", crumbs: [{ label: "Caixa DSC" }],
      html: `<div class="section">
        ${A.pageHeader("Caixa DSC", sub, A.exportMenu('data-export="caixa"', { cls: "btn outline", alignRight: true }))}
        <div class="sync-line">${icon("sync")}Última leitura da caixa DSC no SEI: ${A.fmtDateTime(D.TODAY + "T07:40:00")} · ${S().caixa.length} entradas · dados de demonstração</div>
        <div id="cxKpis"></div>
        <div class="callout" style="margin-bottom:14px">${icon("rule")}<div><strong>Cobertura ainda não conferida.</strong> A lista mostra as entradas lidas da caixa DSC. Antes de afirmar que nada ficou de fora, o universo de entradas precisa ser conferido com o SEI-SP, inclusive processos restritos.</div></div>
        <div class="filters-grid">
          <div class="span-2">${A.searchField("fBusca", "Assunto, número SEI, processo ou remetente", q.busca || "")}</div>
          ${A.selectField("fDir", "Diretor", [["", "Todas as entradas"], ["agora", "Com o Diretor agora"], ["sim", "Precisa do Diretor"], ["nao", "Só para conhecimento"]], q.diretor || "")}
          ${A.selectField("fSit", "Situação", [["", "Todas"], ["abertas", "Abertas"], ...Object.entries(A.L.cx).filter(([k]) => k !== "nao_localizado").map(([k, v]) => [k, v[0]])], q.sit != null ? q.sit : "abertas")}
          ${A.selectField("fAcao", "Ação requerida", [["", "Todas"], ...Object.entries(A.L.acao).map(([k, v]) => [k, v[0]])], "")}
          ${A.selectField("fCt", "Contrato", [["", "Todos"], ["__sem", "Sem contrato"], ...D.CONTRATOS.map((c) => [c.id, c.numero])], q.contrato || "")}
          ${A.selectField("fExc", "Exceção", [["", "Todas"], ["vencido", "Prazo vencido"], ["parado", `Parado (+${limiteParado()} dias)`], ["terceiro", "Com terceiros"], ["semresp", "Sem responsável"], ["sobrestado", "Sobrestado"]], q.exc || "")}
        </div>
        <div id="tCaixa"></div>
      </div>`,
      mount(root) {
        const v = (id) => root.querySelector("#" + id).value;
        const rows = () => S().caixa.filter((e) => {
          const b = v("fBusca").toLowerCase();
          if (b && ![e.assunto, e.sei, e.processo, e.remetente, e.categoria || ""].join(" ").toLowerCase().includes(b)) return false;
          const d = v("fDir");
          if (d === "agora" && !comDiretor(e)) return false;
          if (d === "sim" && !(e.precisaDiretor && cxAberta(e))) return false;
          if (d === "nao" && e.precisaDiretor) return false;
          const s = v("fSit");
          if (s === "abertas" && !cxAberta(e)) return false;
          if (s && s !== "abertas" && e.situacao !== s) return false;
          if (v("fAcao") && e.acao !== v("fAcao")) return false;
          const ct = v("fCt");
          if (ct === "__sem" && e.contratoId) return false;
          if (ct && ct !== "__sem" && e.contratoId !== ct) return false;
          const x = v("fExc");
          if (x === "vencido" && !cxVencida(e)) return false;
          if (x === "parado" && !cxParada(e)) return false;
          if (x === "terceiro" && !(cxAberta(e) && ehTerceiro(e.aguardando))) return false;
          if (x === "semresp" && !(cxAberta(e) && !e.responsavel)) return false;
          if (x === "sobrestado" && !e.sobrestado) return false;
          return true;
        });
        const kpis = () => {
          const ab = S().caixa.filter(cxAberta);
          const dir = caixaAguardandoDiretor();
          const depois = ab.filter((e) => e.precisaDiretor && !comDiretor(e)).length;
          const venc = ab.filter(cxVencida);
          const par = ab.filter(cxParada);
          const ter = ab.filter((e) => ehTerceiro(e.aguardando));
          const tri = caixaTriagem();
          root.querySelector("#cxKpis").innerHTML = `<div class="kpi-grid">
            ${A.kpiCard({ tone: "blue", label: "Entradas abertas", value: ab.length, sub: `${S().caixa.filter((e) => -A.daysUntil(e.entrada) <= 7).length} chegaram nos últimos 7 dias`, foot: "Ver entradas abertas", href: `#/${pr}/caixa?sit=abertas` })}
            ${A.kpiCard({ tone: "orange", label: "Com o Diretor agora", value: dir.length, sub: `${depois} outra(s) vão precisar do Diretor depois`, foot: "Assinaturas e decisões", href: `#/${pr}/caixa?diretor=agora` })}
            ${A.kpiCard({ tone: "red", label: "Prazos vencidos", value: venc.length, sub: venc.length ? `Mais antigo há ${Math.max(...venc.map((e) => -A.daysUntil(e.prazo.data)))} dias` : "Nenhum prazo vencido", foot: "Legal, contratual ou interno", href: `#/${pr}/caixa?exc=vencido&sit=abertas` })}
            ${A.kpiCard({ tone: "slate", label: "Parados ou com terceiros", value: new Set([...par, ...ter]).size, sub: `${par.length} parado(s) há mais de ${limiteParado()} dias · ${ter.length} com terceiros`, foot: "Sobrestados não contam como parados", href: `#/${pr}/caixa?exc=parado&sit=abertas` })}
            ${A.kpiCard({ tone: "purple", label: pr === "gestor" ? "Para classificar ou atribuir" : "Sem responsável", value: pr === "gestor" ? tri.length : ab.filter((e) => !e.responsavel).length, sub: `${S().caixa.filter((e) => e.situacao === "sem_classificacao").length} sem classificação`, foot: "Curadoria da Equipe GCR", href: `#/${pr}/caixa?exc=semresp&sit=abertas` })}
          </div>`;
        };
        kpis();
        const t = A.mountTable(root.querySelector("#tCaixa"), {
          caption: "entradas da caixa DSC", rows, sortKey: "entrada", sortDir: -1, pageSize: 10,
          empty: { icon: "inbox", title: "Nenhuma entrada nos filtros", desc: "Limpe os filtros para ver toda a caixa." },
          rowClass: (e) => (A.profileKey === "super" && !vistoDiretor(e) ? "is-novo-row" : ""),
          cols: [
            { key: "entrada", label: "Entrada", render: (e) => `<div class="cell-main nowrap">SEI ${esc(e.sei)}${A.profileKey === "super" && !vistoDiretor(e) ? ` ${pill("Novo", "info", "sm")}` : ""}</div><div class="cell-sub nowrap">${A.fmtDate(e.entrada)}</div><div class="cell-sub">${esc(e.remetente)}</div>` },
            { key: "assunto", label: "Assunto", tdCls: "td-main", render: (e) => `<div class="cell-main">${esc(e.assunto)}</div><div class="cell-sub">${e.categoria ? esc(e.categoria) : `<span class="txt-warning">Sem categoria</span>`}</div>${contratoMini(e.contratoId)}` },
            { key: "acao", label: "Ação", sortValue: (e) => (e.precisaDiretor ? "0" : "1") + (e.acao || ""), render: (e) => `${e.acao ? lpill("acao", e.acao, "sm") : pill("A definir", "pending", "sm")}${e.precisaDiretor ? `<div class="cell-sub dir-flag">${icon("draw", "cell-ic")}Precisa do Diretor</div>` : `<div class="cell-sub">Só conhecimento</div>`}` },
            { key: "situacao", label: "Situação", render: (e) => `${lpill("cx", e.situacao, "sm")}${e.sobrestado && cxAberta(e) ? `<div class="cell-sub">${icon("pause_circle", "cell-ic")}Sobrestado</div>` : ""}` },
            { key: "onde", label: "Com quem está", sortValue: (e) => (cxAberta(e) ? -diasSemAndamento(e) : 1e9), render: ondeEsta },
            { key: "prazo", label: "Prazo", sortValue: (e) => (e.prazo ? e.prazo.data : "9999"), render: prazoHtml },
            { key: "responsavel", label: "Responsável", sortValue: (e) => (e.responsavel ? A.userName(e.responsavel) : ""), render: (e) => respHtml(e.responsavel) },
          ],
          onRow: (e) => openCaixa(e.id, () => { kpis(); t.render(); }),
        });
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
        root.querySelector("#fBusca").addEventListener("input", t.render);
        root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
          const header = ["SEI", "Processo", "Entrada", "Remetente", "Assunto", "Categoria", "Contrato", "Ação", "Precisa do Diretor", "Situação", "Com quem está", "Dias sem andamento", "Prazo", "Tipo de prazo", "Responsável", "Evidência"];
          const data = rows().map((e) => [e.sei, e.processo, A.fmtDate(e.entrada), e.remetente, e.assunto, e.categoria || "Sem classificação", e.contratoId ? A.getContrato(e.contratoId).numero : "—", e.acao ? A.L.acao[e.acao][0] : "A definir", e.precisaDiretor ? "Sim" : "Não", A.L.cx[e.situacao][0], cxAberta(e) ? e.aguardando || ultimoAnd(e).unidade : "—", cxAberta(e) ? diasSemAndamento(e) : "—", e.prazo ? A.fmtDate(e.prazo.data) : "Sem prazo", e.prazo ? A.L.prazoTipo[e.prazo.tipo][0] : "—", e.responsavel ? A.userName(e.responsavel) : "Sem responsável", e.evidencia || "—"]);
          if (b.dataset.format === "csv") A.downloadCsv("caixa-dsc.csv", header, data);
          else A.downloadPdf("caixa-dsc.pdf", "Caixa DSC", header, data);
        }));
        if (q.id && getCx(q.id)) openCaixa(q.id, () => { kpis(); t.render(); });
      },
    };
  }

  /* ---------------- Tela: Radar de exceções ---------------- */
  function openRadar(x, onChange) {
    const c = x.contratoId ? A.getContrato(x.contratoId) : null;
    const g = grupo(x.grupo);
    const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
    const link = x.origem === "caixa" ? `#/${base()}/caixa?id=${x.objId}` : x.origem === "ois" ? `#/${base()}/ois?id=${x.objId}` : `#/${base()}/contrato/${x.contratoId}/${x.grupo === "semresp" ? "responsaveis" : "visao"}`;
    A.openDrawer({
      kicker: `Radar · ${g.label}`, title: x.titulo, subtitle: c ? `${c.numero} · ${esc(c.contratada)}` : "Sem contrato vinculado",
      body: `<div class="drawer-section"><h4>${icon("account_tree")}Do problema à decisão</h4><dl class="kv chain">
          ${row("Problema", esc(x.motivo))}
          ${row("Evidência", x.evidencia ? esc(x.evidencia) : `<span class="muted">Nenhuma evidência anexada</span>`)}
          ${row("Risco", esc(x.risco))}
          ${row("Responsável", x.responsavel ? esc(x.responsavel) : pill("Sem responsável", "danger", "sm"))}
          ${row("Com quem está", x.aguardando ? esc(x.aguardando) : "—")}
          ${row("Próxima ação", esc(x.proxima))}
          ${row("Prazo", x.prazo ? `${A.fmtDate(x.prazo)} <span class="cell-sub">(${A.daysUntil(x.prazo) < 0 ? "vencido há " + -A.daysUntil(x.prazo) + " dias" : "em " + A.daysUntil(x.prazo) + " dias"})</span>` : `<span class="muted">Sem prazo formal</span>`)}
          ${row("Pendência residual", x.pendencia ? esc(x.pendencia) : "—")}
          ${row("Decisão", x.decisao ? esc(x.decisao) : "—")}
        </dl></div>
        <div class="drawer-section"><h4>${icon("campaign")}Cobranças e respostas</h4>${cobrancaList(x.ref)}</div>
        <a class="btn outline sm" href="${link}">${icon("open_in_new")}${x.origem === "caixa" ? "Abrir a entrada na Caixa DSC" : x.origem === "ois" ? "Abrir a OIS" : "Abrir a ficha do contrato"}</a>`,
      actions: isGcr() ? [{ label: "Registrar cobrança", cls: "primary", icon: "campaign", onClick: () => { setTimeout(() => registrarCobranca(x.ref, x.aguardando || "", x.titulo, onChange), 0); } }] : null,
    });
  }

  function telaRadar(p, q) {
    const pr = base();
    return {
      title: "Radar de exceções", nav: pr + "/radar", crumbs: [{ label: "Radar" }],
      html: `<div class="section">
        ${A.pageHeader("Radar de exceções", "O que saiu do normal na caixa DSC, nas OIS e nos contratos: vencido, parado, com terceiros, sem responsável, sem evidência e decisões do Diretor. Cada item mostra o caminho do problema até a decisão.", A.exportMenu('data-export="radar"', { cls: "btn outline", alignRight: true }))}
        <div class="sync-line">${icon("tune")}Parado = sem andamento há mais de ${limiteParado()} dias. <button class="link-btn" type="button" data-regras><span>Alterar em Regras do controle</span></button></div>
        <div class="tabs radar-tabs" role="tablist" id="rdTabs"></div>
        <div id="tRadar"></div>
      </div>`,
      mount(root) {
        let atual = q.g && grupo(q.g) ? q.g : "";
        const all = () => radarItens({ incluirSobrestados: true });
        const drawTabs = () => {
          const it = all();
          const n = (k) => it.filter((x) => x.grupo === k).length;
          root.querySelector("#rdTabs").innerHTML = [`<button class="tab ${atual === "" ? "active" : ""}" type="button" data-g="">${icon("radar")}Todas <span class="count">${it.filter((x) => x.grupo !== "sobrestado").length}</span></button>`]
            .concat(GRUPOS.map((g) => `<button class="tab ${atual === g.key ? "active" : ""}" type="button" data-g="${g.key}">${icon(g.ic)}${esc(g.label)}${n(g.key) ? ` <span class="count">${n(g.key)}</span>` : ""}</button>`)).join("");
          root.querySelectorAll("#rdTabs [data-g]").forEach((b) => b.addEventListener("click", () => { atual = b.dataset.g; drawTabs(); t.render(); }));
        };
        const rows = () => all().filter((x) => (atual ? x.grupo === atual : x.grupo !== "sobrestado"));
        const t = A.mountTable(root.querySelector("#tRadar"), {
          caption: "exceções", rows, sortKey: "ord", sortDir: 1, pageSize: 12,
          empty: { icon: "verified_user", title: "Nenhuma exceção neste grupo", desc: "Quando algo sair do normal, aparece aqui." },
          cols: [
            { key: "ord", label: "Exceção", tdCls: "td-main", sortValue: (x) => GRUPOS.findIndex((g) => g.key === x.grupo), render: (x) => `${grupoTag(x.grupo)}<div class="cell-main" style="margin-top:6px">${esc(x.titulo)}</div>${contratoMini(x.contratoId)}` },
            { key: "motivo", label: "Motivo e próxima ação", sortable: false, render: (x) => `<div>${esc(x.motivo)}</div><div class="cell-sub">${icon("subdirectory_arrow_right", "cell-ic")}${esc(x.proxima)}</div>` },
            { key: "aguardando", label: "Com quem está", render: (x) => (x.aguardando ? esc(x.aguardando) : `<span class="muted">—</span>`) },
            { key: "responsavel", label: "Responsável", render: (x) => (x.responsavel ? esc(x.responsavel) : pill("Sem responsável", "danger", "sm")) },
            { key: "prazo", label: "Prazo", sortValue: (x) => x.prazo || "9999", render: (x) => (x.prazo ? `<span class="nowrap">${A.fmtDate(x.prazo)}</span><div class="cell-sub ${A.daysUntil(x.prazo) < 0 ? "txt-danger" : ""}">${A.daysUntil(x.prazo) < 0 ? "vencido há " + -A.daysUntil(x.prazo) + " dias" : "em " + A.daysUntil(x.prazo) + " dias"}</div>` : `<span class="muted">Sem prazo</span>`) },
            { key: "cob", label: "Última cobrança", sortValue: (x) => (cobrancasDe(x.ref)[0] || {}).data || "", render: (x) => { const cb = cobrancasDe(x.ref)[0]; return cb ? `<span class="nowrap">${A.fmtDate(cb.data.slice(0, 10))}</span><div class="cell-sub">${esc(cb.canal)} · ${cb.resposta ? "respondida" : "sem resposta"}</div>` : `<span class="muted">Nenhuma</span>`; } },
          ],
          onRow: (x) => openRadar(x, () => { drawTabs(); t.render(); }),
        });
        drawTabs();
        root.querySelector("[data-regras]").addEventListener("click", abrirRegras);
        root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
          const header = ["Grupo", "Exceção", "Contrato", "Problema", "Próxima ação", "Com quem está", "Responsável", "Prazo", "Evidência", "Cobranças"];
          const data = rows().map((x) => [grupo(x.grupo).label, x.titulo, x.contratoId ? A.getContrato(x.contratoId).numero : "—", x.motivo, x.proxima, x.aguardando || "—", x.responsavel || "Sem responsável", x.prazo ? A.fmtDate(x.prazo) : "—", x.evidencia || "—", cobrancasDe(x.ref).length]);
          if (b.dataset.format === "csv") A.downloadCsv("radar-excecoes.csv", header, data);
          else A.downloadPdf("radar-excecoes.pdf", "Radar de exceções", header, data);
        }));
      },
    };
  }

  /* ---------------- Tela: OIS ---------------- */
  function openOis(id, onChange) {
    const o = S().ois.find((x) => x.id === id);
    const c = A.getContrato(o.contratoId);
    const et = oisEtapa(o);
    const at = oisAtraso(o);
    const cx = o.caixaId && getCx(o.caixaId);
    A.openDrawer({
      kicker: `${c.numero} · ${A.fmtComp(o.comp)}`, title: o.numero, subtitle: esc(o.objeto),
      body: `${oisSemLastro(o) ? `<div class="callout danger">${icon("gpp_bad")}<div><strong>OIS sem cobertura contratual.</strong> Emitida em ${A.fmtDate(o.etapas.emissao)}, depois do fim da vigência (${A.fmtDate(c.datas.fimVigencia)}). Uma OIS precisa ter lastro em contrato vigente.</div></div>` : ""}
        ${at ? `<div class="callout warning">${icon("schedule")}<div><strong>${esc(at.texto)}.</strong>${o.aguardando ? ` Aguardando ${esc(o.aguardando)}.` : ""}</div></div>` : ""}
        <div class="drawer-section"><h4>${icon("route")}Etapas</h4>${oisStepsHtml(o)}</div>
        <div class="drawer-section"><h4>${icon("badge")}Identificação</h4><dl class="kv cols-2">
          <div><dt>Identificador</dt><dd>${esc(o.numero)}</dd></div>
          <div><dt>Documento SEI</dt><dd>SEI ${esc(o.sei)}</dd></div>
          <div><dt>Contrato</dt><dd><a href="#/${base()}/contrato/${c.id}/ois">${esc(c.numero)}</a><div class="cell-sub">${esc(c.objeto)}</div></dd></div>
          <div><dt>Competência</dt><dd>${A.fmtComp(o.comp, true)}</dd></div>
          <div><dt>Etapa atual</dt><dd>${esc(et.label)}</dd></div>
          <div><dt>Na caixa DSC</dt><dd>${cx ? `<a href="#/${base()}/caixa?id=${cx.id}">SEI ${esc(cx.sei)}</a> · ${esc(A.L.cx[cx.situacao][0])}` : "—"}</dd></div>
        </dl></div>
        <div class="drawer-section"><h4>${icon("campaign")}Cobranças</h4>${cobrancaList("ois:" + o.id)}</div>
        <div class="callout">${icon("info")}<div>Medição e pagamento da OIS ficam para a próxima fase.</div></div>`,
      actions: isGcr() && et.idx < ETAPAS.length ? [{ label: "Registrar cobrança", cls: "primary", icon: "campaign", onClick: () => { setTimeout(() => registrarCobranca("ois:" + o.id, o.aguardando || A.gestorDe(c.id), o.numero, onChange), 0); } }] : null,
    });
  }

  function oisMesCards(cs) {
    return `<div class="ois-month">${cs.map((c) => {
      const m = oisDoMes(c);
      const prox = oisDoMes(c, A.NEXT_COMP);
      return `<a class="ois-month-card" href="#/${base()}/contrato/${c.id}/ois">
        <div class="ois-month-top"><strong>${esc(c.numero)}</strong>${pill(m.label, m.tone, "sm")}</div>
        <div class="cell-sub">${esc(c.objeto)}</div>
        <div class="ois-month-line">${m.o ? `${esc(m.o.numero)} · ${oisEtapa(m.o).idx < ETAPAS.length ? "aguardando " + esc(oisEtapa(m.o).label.toLowerCase()) : "concluída"}` : "Nenhuma OIS localizada"}</div>
        <div class="cell-sub">${A.fmtComp(A.NEXT_COMP)}: ${prox.o ? `${esc(prox.o.numero)} · ${esc(prox.label.toLowerCase())}` : prox.key === "encerrado" ? "vigência encerrada" : "ainda não solicitada"}</div>
      </a>`;
    }).join("")}</div>`;
  }

  function telaOis(p, q) {
    const pr = base();
    return {
      title: "OIS", nav: pr + "/ois", crumbs: [{ label: "OIS" }],
      html: `<div class="section">
        ${A.pageHeader("Ordens de serviço (OIS)", "Uma OIS, um identificador. Acompanha da solicitação ao aceite e mostra se a OIS do mês saiu. Medição e pagamento ficam para a próxima fase.", A.exportMenu('data-export="ois"', { cls: "btn outline", alignRight: true }))}
        <div class="panel" style="margin-bottom:16px">
          ${A.sectionTitle(`OIS do mês — ${A.fmtComp(A.CURRENT_COMP, true)}`, { icon: "calendar_month", sub: "Contratos executados por OIS mensal. Sem OIS no mês, o contrato pode estar parado ou com pendência." })}
          ${oisMesCards(contratosOis())}
        </div>
        <div class="filters-grid">
          ${A.selectField("fCt", "Contrato", [["", "Todos"], ...contratosOis().map((c) => [c.id, c.numero])], q.contrato || "")}
          ${A.selectField("fEt", "Etapa atual", [["", "Todas"], ...ETAPAS.map(([k, l]) => [k, l]), ["concluida", "Concluída"]], "")}
          ${A.selectField("fAl", "Alerta", [["", "Todas"], ["sim", "Com alerta"]], "")}
        </div>
        <div id="tOis"></div>
      </div>`,
      mount(root) {
        const v = (id) => root.querySelector("#" + id).value;
        const rows = () => S().ois.filter((o) => (!v("fCt") || o.contratoId === v("fCt")) && (!v("fEt") || oisEtapa(o).key === v("fEt")) && (!v("fAl") || oisSemLastro(o) || oisAtraso(o)));
        const t = A.mountTable(root.querySelector("#tOis"), {
          caption: "OIS", rows, sortKey: "comp", sortDir: -1,
          empty: { icon: "assignment", title: "Nenhuma OIS nos filtros" },
          cols: [
            { key: "numero", label: "OIS", tdCls: "td-main", render: (o) => `<div class="cell-main">${esc(o.numero)}</div><div class="cell-sub">SEI ${esc(o.sei)} · ${esc(o.objeto)}</div>${contratoMini(o.contratoId)}` },
            { key: "comp", label: "Competência", render: (o) => A.fmtComp(o.comp) },
            { key: "etapas", label: "Etapas", sortable: false, render: (o) => oisStepsHtml(o, true) },
            { key: "etapa", label: "Etapa atual", sortValue: (o) => oisEtapa(o).idx, render: (o) => { const et = oisEtapa(o); return `${esc(et.label)}${o.aguardando && et.idx < ETAPAS.length ? `<div class="cell-sub">Aguardando ${esc(o.aguardando)}</div>` : ""}`; } },
            { key: "alerta", label: "Alerta", sortValue: (o) => (oisSemLastro(o) ? 2 : oisAtraso(o) ? 1 : 0), render: (o) => (oisSemLastro(o) ? pill("Sem cobertura contratual", "danger", "sm") : oisAtraso(o) ? `${pill("Atrasada", "warning", "sm")}<div class="cell-sub">${esc(oisAtraso(o).texto)}</div>` : `<span class="muted">—</span>`) },
          ],
          onRow: (o) => openOis(o.id, () => t.render()),
        });
        root.querySelectorAll("select").forEach((s) => s.addEventListener("change", t.render));
        root.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
          const header = ["OIS", "SEI", "Contrato", "Competência", ...ETAPAS.map(([, l]) => l), "Etapa atual", "Alerta"];
          const data = rows().map((o) => [o.numero, o.sei, A.getContrato(o.contratoId).numero, A.fmtComp(o.comp), ...ETAPAS.map(([k]) => (o.etapas[k] ? A.fmtDate(o.etapas[k]) : "—")), oisEtapa(o).label, oisSemLastro(o) ? "Sem cobertura contratual" : oisAtraso(o) ? oisAtraso(o).texto : "—"]);
          if (b.dataset.format === "csv") A.downloadCsv("ois.csv", header, data);
          else A.downloadPdf("ois.pdf", "Ordens de serviço (OIS)", header, data);
        }));
        if (q.id) openOis(q.id, () => t.render());
      },
    };
  }

  /* ---------------- Regras do controle (menu do usuário) ---------------- */
  function abrirRegras() {
    const r = A.state.regras || {};
    const contar = (n) => S().caixa.filter((e) => cxAberta(e) && !e.sobrestado && diasSemAndamento(e) > n).length;
    A.openModal({
      kicker: "Regras do controle", title: "Quando um processo conta como parado",
      subtitle: "Vale para a Caixa DSC, o Radar e o painel, nos dois perfis.",
      body: `<div class="form-field"><label for="rgLimite">Parado após quantos dias sem andamento? <span class="field-req">*</span></label>
          <div class="input-suffix"><input class="input" id="rgLimite" type="number" min="1" max="365" step="1" value="${limiteParado()}" /><span>dias</span></div>
          <span class="field-hint" id="rgPrev"></span></div>
        <div class="callout">${icon("info")}<div>Conta a partir do último andamento do processo no SEI. Processos sobrestados formalmente não contam como parados. ${r.alteradoPor ? `Última alteração: ${esc(A.userName(r.alteradoPor))} (${esc(r.perfil)}), ${A.fmtDateTime(r.alteradoEm)}.` : `Valor inicial: ${LIMITE_PADRAO} dias, a confirmar com a GCR.`}</div></div>`,
      mount(box) {
        const inp = box.querySelector("#rgLimite"), prev = box.querySelector("#rgPrev");
        const upd = () => { const n = Math.round(+inp.value); prev.textContent = n >= 1 && n <= 365 ? `Com ${n} dias, ${contar(n)} entrada(s) aberta(s) da caixa ficam como paradas hoje.` : "Use um número de 1 a 365."; };
        inp.addEventListener("input", upd);
        upd();
      },
      actions: [{ label: "Salvar regra", cls: "primary", icon: "save", onClick: (l) => {
        const inp = l.el.querySelector("#rgLimite");
        const n = Math.round(+inp.value);
        if (!(n >= 1 && n <= 365)) { inp.classList.add("is-missing"); A.toast("Use um número de 1 a 365 dias.", "error"); return false; }
        const antes = limiteParado();
        A.state.regras = { ...(A.state.regras || {}), limiteParado: n, alteradoPor: A.currentUser().id, perfil: A.currentProfile().label, alteradoEm: A.nowIso() };
        if (n !== antes) A.addHistorico({ acao: "Regra alterada", objeto: "Limite de processo parado", detalhe: `De ${antes} para ${n} dias sem andamento.` });
        A.save();
        A.toast(`Parado agora é sem andamento há mais de ${n} dias.`, "tune");
        A.refreshNav();
        A.renderRoute();
      } }],
    });
  }
  const rulesBtn = document.getElementById("rulesBtn");
  if (rulesBtn) rulesBtn.addEventListener("click", abrirRegras);

  ["super", "gestor"].forEach((pf) => {
    A.route(pf + "/caixa", pf, telaCaixa);
    A.route(pf + "/radar", pf, telaRadar);
    A.route(pf + "/ois", pf, telaOis);
  });

  Object.assign(A, {
    limiteParado, abrirRegras, GRUPOS_RADAR: GRUPOS, cxAberta, cxVencida, cxParada, comDiretor, ehTerceiro, ultimoAnd, diasSemAndamento,
    caixaAguardandoDiretor, caixaTriagem, radarItens, radarDoContrato, oisPendentes, oisDo, oisDoMes, oisEtapa, oisSemLastro, oisAtraso, contratosOis,
    oisStepsHtml, oisMesCards, grupoTag, openCaixa, openOis, openRadar, registrarCobranca, prazoCaixaHtml: prazoHtml, cobrancasDe, OIS_ETAPAS: ETAPAS,
  });
})();
