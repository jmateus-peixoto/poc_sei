/* ============================================================
   Dados fictícios do protótipo.
   Nomes, números de processo, CNPJs e valores são inventados e não
   representam contratos reais (item 15 do documento de concepção).
   Tudo o que muda durante o uso (decisões, aceites, ocorrências,
   medições, histórico) vive em `seedState()` e é salvo no navegador.
   ============================================================ */
(function () {
  "use strict";

  const TODAY = "2026-10-26";
  const CCO_COVERAGE_END = "2026-10-25"; // dados D-1
  const CCO_LAST_PULL = "2026-10-26T06:12:00";

  const USERS = {
    carlos: { id: "carlos", nome: "Carlos", iniciais: "C", funcao: "Diretor de Serviço ao Cidadão (DSC)" },
    helena: { id: "helena", nome: "Helena Duarte", iniciais: "HD", funcao: "Superintendente de Contratos" },
    rafael: { id: "rafael", nome: "Rafael Moura", iniciais: "RM", funcao: "Analista GCR (controle)" },
    camila: { id: "camila", nome: "Camila Nunes", iniciais: "CN", funcao: "Analista de Operação" },
    marcos: { id: "marcos", nome: "Marcos Viana", iniciais: "MV", funcao: "Gestor de contratos" },
    paula: { id: "paula", nome: "Paula Reis", iniciais: "PR", funcao: "Gestora de contratos" },
    ana: { id: "ana", nome: "Ana Lima", iniciais: "AL", funcao: "Fiscal técnica" },
    joao: { id: "joao", nome: "João Pires", iniciais: "JP", funcao: "Fiscal administrativo" },
    bruno: { id: "bruno", nome: "Bruno Teles", iniciais: "BT", funcao: "Analista de Operação" },
  };

  /* Perfis da 1ª versão (reuniões de 05/11/2026): o Diretor da DSC acompanha sem etapa de aprovação e a
     Equipe GCR faz a curadoria da caixa DSC. A chave "super" foi mantida para não quebrar endereços. */
  const PROFILES = {
    super: {
      key: "super",
      label: "Diretoria DSC",
      userId: "carlos",
      avatarTone: "is-navy",
      descricao: "Vê tudo o que entra e tramita na caixa DSC, mesmo o que não precisa da sua assinatura, e recebe alertas. Não há etapa de aprovação nova.",
      escopo: "Caixa DSC e carteira de contratos da Diretoria",
      tags: ["Consulta e alertas", "Caixa DSC"],
      home: "super/visao-geral",
      nav: [
        { route: "super/visao-geral", icon: "space_dashboard", label: "Visão geral" },
        { route: "super/caixa", icon: "inbox", label: "Caixa DSC", count: "caixaDiretor" },
        { route: "super/radar", icon: "radar", label: "Radar", count: "radar" },
        { route: "super/contratos", icon: "description", label: "Contratos" },
        { route: "super/ois", icon: "assignment", label: "OIS", count: "oisPend" },
        { route: "super/mudancas", icon: "difference", label: "Mudanças", count: "mudancas" },
        { route: "super/relatorios", icon: "summarize", label: "Relatórios" },
      ],
    },
    gestor: {
      key: "gestor",
      label: "Equipe GCR",
      userId: "rafael",
      avatarTone: "is-teal",
      descricao: "Faz a curadoria da caixa DSC: classifica entradas, vincula contratos, registra responsáveis, prazos e cobranças.",
      escopo: "Caixa DSC e carteira completa da Diretoria",
      tags: ["Curadoria", "Cobranças"],
      home: "gestor/caixa",
      nav: [
        { route: "gestor/visao-geral", icon: "space_dashboard", label: "Visão geral" },
        { route: "gestor/caixa", icon: "inbox", label: "Caixa DSC", count: "caixaTriagem" },
        { route: "gestor/radar", icon: "radar", label: "Radar", count: "radar" },
        { route: "gestor/contratos", icon: "description", label: "Contratos" },
        { route: "gestor/ois", icon: "assignment", label: "OIS", count: "oisPend" },
        { route: "gestor/mudancas", icon: "difference", label: "Mudanças", count: "mudancas" },
        { route: "gestor/relatorios", icon: "summarize", label: "Relatórios" },
        { route: "gestor/historico", icon: "history", label: "Histórico" },
      ],
      // Fluxo de preparação e De acordo (P2): código mantido, fora do menu na 1ª versão
      ocultas: ["gestor/meus-contratos", "gestor/preparar", "gestor/itens", "gestor/documentos", "gestor/pendencias"],
    },
    op: {
      key: "op",
      hidden: true, // fiscalização, indicadores e medições ficam para a fase 2
      label: "Operação",
      userId: "camila",
      avatarTone: "is-amber",
      descricao: "Executa o acompanhamento dos itens aprovados: indicadores, fiscalização e medições.",
      escopo: "4 contratos e 10 postos atribuídos",
      tags: ["Itens liberados", "Fiscalização e medição"],
      home: "op/visao",
      nav: [
        { route: "op/visao", icon: "monitoring", label: "Visão operacional" },
        { route: "op/itens", icon: "checklist", label: "Itens" },
        { route: "op/indicadores", icon: "query_stats", label: "Indicadores" },
        { route: "op/fiscalizacoes", icon: "assignment_turned_in", label: "Fiscalizações" },
        { route: "op/ocorrencias", icon: "build_circle", label: "Ocorrências", count: "ocVencidas" },
        { route: "op/medicoes", icon: "calculate", label: "Medições", count: "medPendentes" },
        { route: "op/evidencias", icon: "inventory_2", label: "Evidências" },
      ],
    },
  };

  /* Designações: perfil Gestor/Fiscal só enxerga contratos daqui (4.2) */
  const DESIGNACOES = [
    { contratoId: "c1", userId: "rafael", papel: "Gestor", podeAceite: true, inicio: "2025-03-01", fim: null, origem: "Portaria nº 41/2025 — SEI 0098812" },
    { contratoId: "c1", userId: "ana", papel: "Fiscal técnica", podeAceite: false, inicio: "2025-03-01", fim: null, origem: "Portaria nº 41/2025 — SEI 0098812" },
    { contratoId: "c2", userId: "rafael", papel: "Gestor", podeAceite: true, inicio: "2025-05-15", fim: null, origem: "Portaria nº 77/2025 — SEI 0103340" },
    { contratoId: "c2", userId: "joao", papel: "Fiscal administrativo", podeAceite: false, inicio: "2025-05-15", fim: null, origem: "Portaria nº 77/2025 — SEI 0103340" },
    { contratoId: "c3", userId: "marcos", papel: "Gestor", podeAceite: true, inicio: "2024-01-01", fim: null, origem: "Portaria nº 03/2024 — SEI 0071125" },
    { contratoId: "c3", userId: "joao", papel: "Fiscal técnico", podeAceite: false, inicio: "2024-01-01", fim: "2026-10-09", origem: "Portaria nº 03/2024 — SEI 0071125" },
    { contratoId: "c3", userId: "rafael", papel: "Fiscal técnico", podeAceite: false, inicio: "2026-10-10", fim: null, origem: "Portaria nº 88/2026 — SEI 0144120" },
    { contratoId: "c4", userId: "paula", papel: "Gestora", podeAceite: true, inicio: "2026-08-01", fim: null, origem: "Portaria nº 61/2026 — SEI 0139870" },
    { contratoId: "c5", userId: "rafael", papel: "Gestor", podeAceite: true, inicio: "2026-09-01", fim: null, origem: "Portaria nº 74/2026 — SEI 0141502" },
    { contratoId: "c5", userId: "ana", papel: "Fiscal técnica", podeAceite: false, inicio: "2026-09-01", fim: null, origem: "Portaria nº 74/2026 — SEI 0141502" },
    { contratoId: "c6", userId: "marcos", papel: "Gestor", podeAceite: true, inicio: "2023-02-01", fim: "2026-01-31", origem: "Portaria nº 12/2023 — SEI 0050241" },
    { contratoId: "c7", userId: "paula", papel: "Gestora", podeAceite: true, inicio: "2025-11-01", fim: null, origem: "Portaria nº 102/2025 — SEI 0119077" },
  ];

  /* Equipe de Operação e seu escopo (4.3) */
  const OPERACAO_ESCOPO = { camila: ["c1", "c2", "c3", "c5"], bruno: ["c1", "c2"] };

  const POSTOS = {
    "p-centro": { nome: "Posto Centro", regiao: "Metropolitana" },
    "p-norte": { nome: "Posto Norte", regiao: "Metropolitana" },
    "p-sul": { nome: "Posto Sul", regiao: "Metropolitana" },
    "p-leste": { nome: "Posto Leste", regiao: "Metropolitana" },
    "p-oeste": { nome: "Posto Oeste", regiao: "Metropolitana" },
    "p-norte2": { nome: "Posto Norte II", regiao: "Norte" },
    "p-distrito": { nome: "Posto Distrito Industrial", regiao: "Norte" },
    "p-vale": { nome: "Posto Vale", regiao: "Interior Leste" },
    "p-serra": { nome: "Posto Serra", regiao: "Interior Leste" },
    "p-sul2": { nome: "Posto Sul II", regiao: "Sul" },
    "p-campos": { nome: "Posto Campos", regiao: "Interior Oeste" },
  };

  /* 7 regiões; cada contrato pertence a uma região (alinhamento de 27/10/2026) */
  const REGIOES = ["Metropolitana", "Norte", "Sul", "Litoral", "Serrana", "Interior Leste", "Interior Oeste"];

  const CONTRATOS = [
    {
      id: "c1", numero: "CT 014/2025",
      objeto: "Operação e suporte dos postos de atendimento",
      objetoLongo: "Prestação de serviços continuados de operação, recepção, triagem e suporte ao atendimento presencial nos postos da região Metropolitana.",
      contratada: "Alfa Atendimento Integrado Ltda", cnpj: "11.222.333/0001-01",
      regiao: "Metropolitana",
      processos: [
        { numero: "23180.004512/2024-31", papel: "Contratação", unidade: "GCR/Contratos" },
        { numero: "23180.009914/2025-08", papel: "Pagamento", unidade: "DFIN/Pagamentos" },
        { numero: "23180.010233/2025-55", papel: "Fiscalização", unidade: "GCR/Fiscalização" },
      ],
      datas: { assinatura: "2025-02-20", inicioExecucao: "2025-03-01", inicioVigencia: "2025-03-01", fimVigencia: "2027-02-28" },
      valores: { original: 12480000, vigente: 13104000, mesesVigencia: 24 },
      postos: [
        { id: "p-centro", desde: "2025-03-01" }, { id: "p-norte", desde: "2025-03-01" },
        { id: "p-sul", desde: "2025-03-01" }, { id: "p-leste", desde: "2025-07-15" },
      ],
      servicos: ["Recepção e triagem", "Atendimento presencial", "Gestão de filas"],
      cadastro: "conferido",
      qualidade: { origem: "SEI + conferência manual", consulta: "2026-10-26T07:40:00", pendencias: 1 },
    },
    {
      id: "c2", numero: "CT 022/2025",
      objeto: "Limpeza e conservação dos postos",
      objetoLongo: "Serviços contínuos de limpeza, asseio e conservação predial com fornecimento de materiais nos postos de atendimento.",
      contratada: "Beta Facilities S.A.", cnpj: "22.333.444/0001-02",
      regiao: "Metropolitana",
      processos: [
        { numero: "23180.002210/2025-14", papel: "Contratação", unidade: "GCR/Contratos" },
        { numero: "23180.011870/2025-61", papel: "Pagamento", unidade: "DFIN/Pagamentos" },
      ],
      datas: { assinatura: "2025-05-08", inicioExecucao: "2025-05-15", inicioVigencia: "2025-05-15", fimVigencia: "2027-05-14" },
      valores: { original: 4380000, vigente: 4809240, mesesVigencia: 24 },
      postos: [
        { id: "p-centro", desde: "2025-05-15" }, { id: "p-leste", desde: "2025-05-15" },
        { id: "p-oeste", desde: "2026-11-01", pendente: true },
      ],
      servicos: ["Limpeza diária", "Conservação", "Fornecimento de insumos"],
      cadastro: "conferido",
      qualidade: { origem: "SEI + conferência manual", consulta: "2026-10-26T07:40:00", pendencias: 1 },
    },
    {
      id: "c3", numero: "CT 031/2024",
      objeto: "Vigilância patrimonial armada e desarmada",
      objetoLongo: "Serviços de vigilância patrimonial 24 horas nos postos e no Distrito Industrial.",
      contratada: "Gama Segurança Ltda", cnpj: "33.444.555/0001-03",
      regiao: "Norte",
      processos: [
        { numero: "23180.000877/2023-90", papel: "Contratação", unidade: "GCR/Contratos" },
        { numero: "23180.003311/2024-12", papel: "Pagamento", unidade: "DFIN/Pagamentos" },
      ],
      datas: { assinatura: "2023-12-18", inicioExecucao: "2024-01-01", inicioVigencia: "2024-01-01", fimVigencia: "2026-12-31" },
      valores: { original: 6720000, vigente: 7056000, mesesVigencia: 36 },
      postos: [{ id: "p-norte2", desde: "2024-01-01" }, { id: "p-distrito", desde: "2024-01-01" }],
      servicos: ["Vigilância 24h", "Ronda motorizada"],
      cadastro: "conferido",
      qualidade: { origem: "SEI", consulta: "2026-10-26T07:40:00", pendencias: 0 },
    },
    {
      id: "c4", numero: "CT 008/2026",
      objeto: "Suporte de TI aos postos",
      objetoLongo: "Suporte técnico de primeiro e segundo nível aos equipamentos e sistemas dos postos de atendimento.",
      contratada: "Delta Tecnologia Ltda", cnpj: "44.555.666/0001-04",
      regiao: "Sul",
      processos: [{ numero: "23180.006650/2026-02", papel: "Contratação", unidade: "GTI/Contratos" }],
      datas: { assinatura: "2026-07-22", inicioExecucao: "2026-08-01", inicioVigencia: "2026-08-01", fimVigencia: "2028-07-31" },
      valores: { original: 2950000, vigente: 2950000, mesesVigencia: 24 },
      postos: [{ id: "p-sul2", desde: "2026-08-01" }],
      servicos: ["Suporte N1", "Suporte N2"],
      cadastro: "conferido",
      qualidade: { origem: "SEI", consulta: "2026-10-25T18:02:00", pendencias: 0 },
    },
    {
      id: "c5", numero: "CT 019/2026",
      objeto: "Manutenção predial dos postos",
      objetoLongo: "Manutenção preventiva e corretiva de instalações prediais, elétricas, hidráulicas e de climatização dos postos do Interior Leste.",
      contratada: "Épsilon Engenharia Ltda", cnpj: "55.666.777/0001-05",
      regiao: "Interior Leste",
      processos: [
        { numero: "23180.007702/2026-47", papel: "Contratação", unidade: "GCR/Contratos" },
      ],
      datas: { assinatura: "2026-08-25", inicioExecucao: "2026-09-01", inicioVigencia: "2026-09-01", fimVigencia: "2027-08-31" },
      valores: { original: 1860000, vigente: 1860000, mesesVigencia: 12 },
      postos: [{ id: "p-vale", desde: "2026-09-01" }, { id: "p-serra", desde: "2026-09-01" }],
      servicos: ["Manutenção preventiva", "Manutenção corretiva", "Climatização"],
      cadastro: "conferido",
      qualidade: { origem: "SEI + conferência manual", consulta: "2026-10-26T07:40:00", pendencias: 2 },
    },
    {
      id: "c6", numero: "CT 027/2023",
      objeto: "Transporte de documentos e malotes",
      objetoLongo: "Coleta, transporte e entrega de documentos e malotes entre os postos e a sede.",
      contratada: "Zeta Logística Ltda", cnpj: "66.777.888/0001-06",
      regiao: "Interior Oeste",
      processos: [{ numero: "23180.001190/2022-73", papel: "Contratação", unidade: "GCR/Contratos" }],
      datas: { assinatura: "2023-01-25", inicioExecucao: "2023-02-01", inicioVigencia: "2023-02-01", fimVigencia: "2026-01-31" },
      valores: { original: 980000, vigente: 1029000, mesesVigencia: 36 },
      postos: [{ id: "p-campos", desde: "2023-02-01" }],
      servicos: ["Malote"],
      cadastro: "conferido",
      qualidade: { origem: "SEI", consulta: "2026-10-20T10:00:00", pendencias: 0 },
    },
    {
      id: "c7", numero: "CT 033/2025",
      objeto: "Central de atendimento telefônico",
      objetoLongo: "Operação de central de atendimento telefônico e canais remotos.",
      contratada: "Ômega Contact Center S.A.", cnpj: "77.888.999/0001-07",
      regiao: "Litoral",
      processos: [{ numero: "23180.008120/2025-36", papel: "Contratação", unidade: "GCR/Contratos" }],
      datas: { assinatura: "2025-10-20", inicioExecucao: "2025-11-01", inicioVigencia: "2025-11-01", fimVigencia: "2027-10-31" },
      valores: { original: 8400000, vigente: 8400000, mesesVigencia: 24 },
      postos: [],
      servicos: ["Atendimento telefônico", "Chat"],
      cadastro: "conferido",
      qualidade: { origem: "Cadastro manual", consulta: null, pendencias: 0 },
    },
    {
      id: "c8", numero: "CT 041/2026",
      objeto: "Fornecimento de mobiliário para postos",
      objetoLongo: "Fornecimento e instalação de mobiliário de atendimento.",
      contratada: "Sigma Comércio Ltda", cnpj: "88.999.000/0001-08",
      regiao: "Serrana",
      processos: [{ numero: "23180.012004/2026-19", papel: "Contratação", unidade: "GCR/Contratos" }],
      datas: { assinatura: null, inicioExecucao: null, inicioVigencia: "2026-10-15", fimVigencia: "2027-04-14" },
      valores: { original: 645000, vigente: null, mesesVigencia: 6 },
      postos: [],
      servicos: ["Fornecimento"],
      cadastro: "em_conferencia",
      qualidade: { origem: "Sugestão extraída do SEI", consulta: "2026-10-24T15:10:00", pendencias: 3 },
    },
  ];

  /* Documentos acessíveis no SEI, por contrato (3.1) */
  const DOCUMENTOS = [
    { id: "d1", contratoId: "c1", sei: "0094410", tipo: "Contrato", titulo: "Contrato nº 014/2025", data: "2025-02-20", processo: "23180.004512/2024-31", assinatura: "assinado", conferencia: "conferido" },
    { id: "d2", contratoId: "c1", sei: "0094388", tipo: "Anexo", titulo: "Anexo I — Termo de Referência", data: "2025-02-20", processo: "23180.004512/2024-31", assinatura: "assinado", conferencia: "conferido" },
    { id: "d3", contratoId: "c1", sei: "0094391", tipo: "Anexo", titulo: "Anexo II — Acordo de Nível de Serviço (ANS)", data: "2025-02-20", processo: "23180.004512/2024-31", assinatura: "assinado", conferencia: "conferido" },
    { id: "d4", contratoId: "c1", sei: "0127730", tipo: "Termo aditivo", titulo: "1º Termo Aditivo — acréscimo de 5% e inclusão do Posto Leste", data: "2025-07-10", processo: "23180.004512/2024-31", assinatura: "assinado", conferencia: "conferido" },
    { id: "d5", contratoId: "c1", sei: "0141987", tipo: "Ofício", titulo: "Ofício nº 231/2026 — Plano de ação para o Posto Norte", data: "2026-10-03", processo: "23180.010233/2025-55", assinatura: "assinado", conferencia: "pendente" },
    { id: "d6", contratoId: "c1", sei: "0141801", tipo: "OIS", titulo: "OIS nº 038/2026 — serviços de outubro", data: "2026-09-26", processo: "23180.010233/2025-55", assinatura: "assinado", conferencia: "conferido" },
    { id: "d7", contratoId: "c1", sei: "0143350", tipo: "Nota fiscal", titulo: "NF-e 4.512 — Competência set/2026", data: "2026-10-06", processo: "23180.009914/2025-08", assinatura: "nao_disponivel", conferencia: "pendente", restrito: true },
    { id: "d8", contratoId: "c1", sei: "0142201", tipo: "Relatório", titulo: "Relatório mensal de execução — set/2026", data: "2026-10-03", processo: "23180.010233/2025-55", assinatura: "assinado", conferencia: "conferido" },
    { id: "d9", contratoId: "c2", sei: "0103122", tipo: "Contrato", titulo: "Contrato nº 022/2025", data: "2025-05-08", processo: "23180.002210/2025-14", assinatura: "assinado", conferencia: "conferido" },
    { id: "d10", contratoId: "c2", sei: "0103125", tipo: "Anexo", titulo: "Anexo I — Termo de Referência e checklist de limpeza", data: "2025-05-08", processo: "23180.002210/2025-14", assinatura: "assinado", conferencia: "conferido" },
    { id: "d11", contratoId: "c2", sei: "0131870", tipo: "Termo aditivo", titulo: "1º Termo Aditivo — prorrogação até 14/05/2027", data: "2026-03-10", processo: "23180.002210/2025-14", assinatura: "assinado", conferencia: "conferido" },
    { id: "d12", contratoId: "c2", sei: "0145872", tipo: "Termo aditivo", titulo: "2º Termo Aditivo — inclusão do Posto Oeste (+9,8%)", data: "2026-10-21", processo: "23180.002210/2025-14", assinatura: "assinado", conferencia: "pendente" },
    { id: "d13", contratoId: "c2", sei: "0142880", tipo: "Relatório", titulo: "Relatório mensal de limpeza — set/2026", data: "2026-10-04", processo: "23180.011870/2025-61", assinatura: "assinado", conferencia: "conferido" },
    { id: "d14", contratoId: "c3", sei: "0071002", tipo: "Contrato", titulo: "Contrato nº 031/2024", data: "2023-12-18", processo: "23180.000877/2023-90", assinatura: "assinado", conferencia: "conferido" },
    { id: "d15", contratoId: "c3", sei: "0109954", tipo: "Termo aditivo", titulo: "1º Termo Aditivo — repactuação 2025", data: "2025-01-20", processo: "23180.000877/2023-90", assinatura: "assinado", conferencia: "conferido" },
    { id: "d16", contratoId: "c3", sei: "0143702", tipo: "Ofício", titulo: "Ofício nº 112/2026 (contratada) — pedido de repactuação", data: "2026-10-14", processo: "23180.000877/2023-90", assinatura: "assinado", conferencia: "pendente" },
    { id: "d17", contratoId: "c3", sei: "0144120", tipo: "Portaria", titulo: "Portaria nº 88/2026 — designação de fiscal técnico", data: "2026-10-10", processo: "23180.000877/2023-90", assinatura: "assinado", conferencia: "conferido" },
    { id: "d18", contratoId: "c5", sei: "0140960", tipo: "Contrato", titulo: "Contrato nº 019/2026", data: "2026-08-25", processo: "23180.007702/2026-47", assinatura: "assinado", conferencia: "conferido" },
    { id: "d19", contratoId: "c5", sei: "0140944", tipo: "Anexo", titulo: "Anexo I — Termo de Referência", data: "2026-08-25", processo: "23180.007702/2026-47", assinatura: "assinado", conferencia: "pendente" },
    { id: "d20", contratoId: "c5", sei: "0140947", tipo: "Anexo", titulo: "Anexo III — Instrumento de Medição de Resultado (IMR)", data: "2026-08-25", processo: "23180.007702/2026-47", assinatura: "assinado", conferencia: "pendente" },
    { id: "d21", contratoId: "c5", sei: "0141502", tipo: "Portaria", titulo: "Portaria nº 74/2026 — designação de gestor e fiscal", data: "2026-08-29", processo: "23180.007702/2026-47", assinatura: "assinado", conferencia: "conferido" },
    { id: "d22", contratoId: "c5", sei: "0142630", tipo: "OIS", titulo: "OIS nº 001/2026 — início dos serviços", data: "2026-09-01", processo: "23180.007702/2026-47", assinatura: "pendente", conferencia: "pendente" },
    { id: "d23", contratoId: "c4", sei: "0138811", tipo: "Contrato", titulo: "Contrato nº 008/2026", data: "2026-07-22", processo: "23180.006650/2026-02", assinatura: "assinado", conferencia: "conferido" },
    { id: "d24", contratoId: "c6", sei: "0050110", tipo: "Contrato", titulo: "Contrato nº 027/2023", data: "2023-01-25", processo: "23180.001190/2022-73", assinatura: "assinado", conferencia: "conferido" },
    { id: "d25", contratoId: "c7", sei: "0118870", tipo: "Contrato", titulo: "Contrato nº 033/2025", data: "2025-10-20", processo: "23180.008120/2025-36", assinatura: "assinado", conferencia: "conferido" },
    { id: "d27", contratoId: "c1", sei: "0146032", tipo: "OIS", titulo: "OIS nº 042/2026 — serviços de novembro", data: "2026-10-23", processo: "23180.010233/2025-55", assinatura: "pendente", conferencia: "conferido" },
    { id: "d28", contratoId: "c2", sei: "0143115", tipo: "OIS", titulo: "OIS nº 019/2026 — limpeza de outubro", data: "2026-09-29", processo: "23180.002210/2025-14", assinatura: "assinado", conferencia: "conferido" },
    { id: "d29", contratoId: "c5", sei: "0143910", tipo: "OIS", titulo: "OIS nº 002/2026 — manutenção preventiva de outubro", data: "2026-10-01", processo: "23180.007702/2026-47", assinatura: "assinado", conferencia: "conferido" },
    { id: "d30", contratoId: "c6", sei: "0140230", tipo: "OIS", titulo: "OIS nº 007/2026 — transporte de malotes de setembro", data: "2026-09-02", processo: "23180.001190/2022-73", assinatura: "assinado", conferencia: "pendente" },
    { id: "d31", contratoId: "c3", sei: "0146120", tipo: "Minuta", titulo: "Minuta do 2º Termo Aditivo — prorrogação por 12 meses", data: "2026-10-24", processo: "23180.000877/2023-90", assinatura: "pendente", conferencia: "pendente" },
    { id: "d26", contratoId: "c8", sei: "0146011", tipo: "Minuta", titulo: "Minuta do Contrato nº 041/2026", data: "2026-10-22", processo: "23180.012004/2026-19", assinatura: "pendente", conferencia: "pendente" },
  ];

  /* Trechos de documentos usados no painel lateral de origem (12.7) */
  const TRECHOS = {
    "c1-ob1": "7.2. A CONTRATADA deverá manter o <mark>Tempo Médio de Espera (TME) igual ou inferior a 15 (quinze) minutos</mark>, apurado mensalmente por posto, ponderado pelo número de atendimentos.",
    "c1-ob2": "2.2. O <mark>Tempo Médio de Atendimento (TMA) não deverá exceder 12 (doze) minutos</mark>, considerando os atendimentos concluídos no mês.",
    "c1-ob3": "9.1. A CONTRATADA apresentará <mark>relatório mensal de execução até o 5º (quinto) dia útil</mark> do mês subsequente, contendo quadro de pessoal, ocorrências e indicadores.",
    "c1-ob4": "12.3. A CONTRATADA manterá <mark>apólice de seguro de responsabilidade civil</mark> durante toda a vigência contratual, apresentando a renovação…",
    "c1-ob5": "5. Os postos deverão ser mantidos em <mark>condições adequadas de funcionamento, sinalização, acessibilidade e segurança</mark>, verificadas mediante inspeção…",
    "c1-ob6": "Nenhum trecho correspondente foi localizado nos documentos acessíveis. A proposta veio do painel de referência de indicadores.",
    "c5-p1": "6.1. Os <mark>chamados corretivos classificados como emergenciais deverão ser atendidos em até 4 (quatro) horas</mark> contadas da abertura do chamado…",
    "c5-p2": "6.3. A CONTRATADA executará o <mark>plano de manutenção preventiva</mark> conforme cronograma aprovado, com <mark>periodicidade mensal</mark> para os sistemas de climatização…",
    "c5-p3": "8.4. A CONTRATADA deverá apresentar a <mark>Anotação de Responsabilidade Técnica (ART)</mark> do responsável técnico, mantendo-a atualizada…",
    "c5-p4": "7. As instalações deverão manter <mark>condições adequadas de climatização e iluminação</mark> nos ambientes de atendimento ao público.",
    "c5-p5": "9.2. Mensalmente, a CONTRATADA entregará <mark>relatório de serviços executados, com registro fotográfico</mark> antes e depois das intervenções.",
    "c5-p6": "3. O descumprimento do prazo de atendimento emergencial ensejará <mark>desconto de 0,5% a 2%</mark> sobre o valor da fatura mensal, conforme faixas de atraso…",
  };

  const CHECKLIST_GCR = {
    id: "gcr", nome: "Checklist GCR — condições do posto", versao: "v2", vigenteDesde: "2026-06-01",
    itens: [
      "Sinalização de identificação do posto visível na fachada",
      "Painel de senhas em funcionamento",
      "Climatização adequada no salão de atendimento",
      "Extintores dentro do prazo de validade",
      "Rampa e piso tátil desobstruídos",
      "Sanitários limpos e abastecidos",
      "Equipe uniformizada e identificada com crachá",
      "Quadro de avisos com horário de funcionamento atualizado",
      "Wi-Fi público disponível para o cidadão",
    ],
  };
  const CHECKLIST_LIMPEZA = {
    id: "limp", nome: "Checklist de limpeza", versao: "v1", vigenteDesde: "2025-05-15",
    itens: [
      "Pisos do salão limpos e secos",
      "Sanitários higienizados conforme rotina",
      "Lixeiras esvaziadas e com saco",
      "Insumos (papel, sabonete, álcool) abastecidos",
      "Vidros e superfícies sem acúmulo de sujeira",
    ],
  };

  /* Indicadores do CCO: definição de negócio conferida individualmente (8.1) */
  const INDICADORES = [
    { id: "TME", nome: "Tempo médio de espera", unidade: "min", definicao: "conferida", fonte: "CCO — fila de atendimento (campo tempo_espera)", meta: 15, sentido: "max" },
    { id: "TMA", nome: "Tempo médio de atendimento", unidade: "min", definicao: "conferida", fonte: "CCO — atendimento (campo duracao_atendimento)", meta: 12, sentido: "max" },
    { id: "TEV", nome: "Tempo de espera virtual", unidade: "min", definicao: "pendente", fonte: "Campo não localizado no CCO", meta: null, sentido: "max" },
    { id: "TAV", nome: "Tempo de atendimento virtual", unidade: "min", definicao: "pendente", fonte: "Campo não localizado no CCO", meta: null, sentido: "max" },
    { id: "SINT", nome: "Sintonia", unidade: "%", definicao: "sem_fonte", fonte: "Fórmula e fonte não confirmadas", meta: null, sentido: "min" },
  ];

  /* ---------------- Série diária do CCO (gerada deterministicamente) ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildCcoSeries() {
    const rnd = mulberry32(20261026);
    const base = {
      "p-centro": { TME: 11.2, TMA: 9.4, vol: 290 },
      "p-norte": { TME: 16.4, TMA: 10.8, vol: 260 },
      "p-sul": { TME: 12.6, TMA: 10.1, vol: 230 },
      "p-leste": { TME: 13.1, TMA: 12.3, vol: 210 },
    };
    const missing = {
      "p-leste": ["2026-09-12", "2026-09-14", "2026-09-15"],
      "p-sul": ["2026-10-20", "2026-10-21", "2026-10-22"],
    };
    const inconsistent = { "p-norte": ["2026-10-09"] };
    const series = {};
    const start = new Date("2026-09-01T12:00:00");
    const end = new Date(CCO_COVERAGE_END + "T12:00:00");
    Object.keys(base).forEach((pid) => {
      series[pid] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        if (dow === 0) { series[pid].push({ data: iso, semExpediente: true }); continue; }
        if ((missing[pid] || []).includes(iso)) { series[pid].push({ data: iso, ausente: true }); continue; }
        const b = base[pid];
        const sat = dow === 6;
        const trend = pid === "p-norte" && iso >= "2026-10-12" ? -2.4 : 0;
        const vol = Math.round(b.vol * (sat ? 0.45 : 1) * (0.85 + rnd() * 0.3));
        let tme = +(b.TME + trend + (rnd() - 0.5) * 5).toFixed(1);
        const tma = +(b.TMA + (rnd() - 0.5) * 2.6).toFixed(1);
        let inconsistente = false;
        if ((inconsistent[pid] || []).includes(iso)) { tme = 0; inconsistente = true; }
        series[pid].push({ data: iso, atendimentos: vol, TME: Math.max(tme, 0), TMA: tma, inconsistente });
      }
    });
    return series;
  }

  /* ---------------- Estado mutável ---------------- */
  /* Execução financeira (alinhamento de 27/10/2026): notas de cobrança mês a mês até a última
     competência fechada. Valor executado = soma das notas; saldo = valor total atualizado − executado. */
  const ULTIMA_COMP_FECHADA = "2026-09";
  function gerarNotas(c) {
    if (!c.valores.vigente || !c.datas.inicioExecucao) return [];
    const rnd = mulberry32(c.id.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
    const mensal = c.valores.vigente / c.valores.mesesVigencia;
    const notas = [];
    let [y, m] = c.datas.inicioExecucao.slice(0, 7).split("-").map(Number);
    const fim = (c.datas.fimVigencia || "9999-12").slice(0, 7);
    let n = 1;
    for (;;) {
      const comp = `${y}-${String(m).padStart(2, "0")}`;
      if (comp > ULTIMA_COMP_FECHADA || comp > fim) break;
      const valor = Math.round(mensal * (0.94 + rnd() * 0.08));
      const situacao = comp === ULTIMA_COMP_FECHADA ? "em_ateste" : "paga";
      notas.push({ nf: `NF ${String(1000 + n * 7 + c.id.charCodeAt(1)).padStart(5, "0")}`, comp, valor, situacao });
      n++; m++; if (m > 12) { m = 1; y++; }
    }
    return notas;
  }
  CONTRATOS.forEach((c) => {
    c.notas = gerarNotas(c);
    c.valores.executado = c.notas.reduce((s, x) => s + x.valor - (x.glosa || 0), 0);
    c.origemDados = c.qualidade.origem === "Cadastro manual" ? "manual" : c.cadastro === "conferido" ? "sei" : "sei_conferencia";
    // Contratos executados por OIS mensal (a OIS do mês é o sinal de que o contrato está andando)
    c.ois = ["c1", "c2", "c3", "c5", "c6"].includes(c.id);
  });

  function respostasConformes(n, outras = {}) {
    const r = {};
    for (let i = 0; i < n; i++) r[i] = { r: outras[i] || "C" };
    return r;
  }

  function seedState() {
    return {
      version: 5,
      /* ---------- Caixa DSC (R06): entradas lidas da unidade DSC no SEI ----------
         Cada entrada: o que é, o que precisa ser feito, onde está, prazo, quem responde e evidência.
         "andamentos" é o histórico de tramitação; o último indica a localização atual. */
      caixa: [
        { id: "cx01", sei: "0146120", processo: "23180.000877/2023-90", entrada: "2026-10-24", remetente: "DJU — Jurídico", assunto: "Minuta do 2º Termo Aditivo — prorrogação da vigilância por 12 meses", categoria: "Termo aditivo", contratoId: "c3",
          acao: "assinatura", precisaDiretor: true, situacao: "aguardando_assinatura", aguardando: "Diretor DSC", responsavel: "marcos",
          prazo: { data: "2026-11-16", tipo: "interno", regra: "Assinar até 45 dias antes do fim da vigência (31/12/2026)" },
          andamentos: [
            { data: "2026-10-08", unidade: "DSC/GCR", texto: "Pedido de prorrogação instruído pelo gestor." },
            { data: "2026-10-22", unidade: "DJU — Jurídico", texto: "Parecer favorável à prorrogação por 12 meses." },
            { data: "2026-10-24", unidade: "DSC (Gabinete)", texto: "Minuta encaminhada para assinatura do Diretor." },
          ] },
        { id: "cx02", sei: "0143702", processo: "23180.000877/2023-90", entrada: "2026-10-14", remetente: "Gama Segurança Ltda (contratada)", assunto: "Ofício nº 112/2026 — pedido de repactuação de preços", categoria: "Ofício", contratoId: "c3",
          acao: "analise", precisaDiretor: false, situacao: "em_analise", aguardando: "DJU — Jurídico", responsavel: "marcos",
          prazo: { data: "2026-12-13", tipo: "contratual", regra: "60 dias para responder ao pedido de repactuação (Cláusula 14)" },
          andamentos: [
            { data: "2026-10-14", unidade: "DSC/GCR", texto: "Ofício recebido e juntado ao processo." },
            { data: "2026-10-16", unidade: "DJU — Jurídico", texto: "Enviado para análise jurídica e de planilha de custos." },
          ] },
        { id: "cx03", sei: "0145872", processo: "23180.002210/2025-14", entrada: "2026-10-21", remetente: "DSC/GCR", assunto: "2º Termo Aditivo assinado — inclusão do Posto Oeste (+9,8%)", categoria: "Termo aditivo", contratoId: "c2",
          acao: "ciencia", precisaDiretor: false, situacao: "concluido", aguardando: null, responsavel: "rafael",
          prazo: null, evidencia: "Termo assinado (SEI 0145872) e extrato publicado no DOE em 23/10/2026",
          andamentos: [
            { data: "2026-10-21", unidade: "DSC (Gabinete)", texto: "Termo assinado pelas partes." },
            { data: "2026-10-23", unidade: "DSC/GCR", texto: "Extrato publicado; processo devolvido ao gestor." },
          ] },
        { id: "cx04", sei: "0146032", processo: "23180.010233/2025-55", entrada: "2026-10-23", remetente: "DSC/GOS", assunto: "OIS nº 042/2026 — serviços de novembro", categoria: "OIS", contratoId: "c1",
          acao: "assinatura", precisaDiretor: true, situacao: "aguardando_assinatura", aguardando: "Diretor DSC", responsavel: "rafael",
          prazo: { data: "2026-10-30", tipo: "contratual", regra: "OIS assinada até o último dia útil do mês anterior ao serviço" },
          andamentos: [
            { data: "2026-10-20", unidade: "DSC/GOS", texto: "Solicitação da OIS de novembro." },
            { data: "2026-10-23", unidade: "DSC (Gabinete)", texto: "OIS emitida e enviada para assinatura." },
          ] },
        { id: "cx05", sei: "0142955", processo: "23180.007702/2026-47", entrada: "2026-09-29", remetente: "Prefeitura de Vale", assunto: "Exigências para emissão do alvará de funcionamento do Posto Vale", categoria: "Ofício", contratoId: "c5", posto: "p-vale",
          acao: "resposta", precisaDiretor: false, situacao: "aguardando_terceiro", aguardando: "Prefeitura de Vale", responsavel: "rafael",
          prazo: null, semPrazoMotivo: "A Prefeitura não informou prazo para emitir o alvará",
          andamentos: [
            { data: "2026-09-29", unidade: "DSC/GCR", texto: "Ofício da Prefeitura recebido com 3 exigências." },
            { data: "2026-10-05", unidade: "Prefeitura de Vale", texto: "Documentos entregues pela GCR; aguardando a Prefeitura." },
          ] },
        { id: "cx06", sei: "0140230", processo: "23180.001190/2022-73", entrada: "2026-09-02", remetente: "DSC/GOS", assunto: "OIS nº 007/2026 — transporte de malotes de setembro", categoria: "OIS", contratoId: "c6",
          acao: "analise", precisaDiretor: false, situacao: "em_analise", aguardando: "DSC/GCR", responsavel: null,
          prazo: { data: "2026-09-30", tipo: "interno", regra: "Conferir a OIS dentro do mês de competência" },
          andamentos: [
            { data: "2026-09-02", unidade: "DSC/GOS", texto: "OIS emitida e assinada." },
            { data: "2026-09-04", unidade: "DSC/GCR", texto: "Recebida para conferência." },
          ] },
        { id: "cx07", sei: "0145990", processo: "23180.013002/2026-11", entrada: "2026-10-16", remetente: "Casa Civil", assunto: "Ofício nº 318/2026 — pedido de informações sobre o tempo de espera nos postos", categoria: "Órgão de controle", contratoId: null,
          acao: "resposta", precisaDiretor: true, situacao: "em_analise", aguardando: "DSC/GAT", responsavel: null,
          prazo: { data: "2026-10-23", tipo: "legal", regra: "5 dias úteis a partir do recebimento" },
          andamentos: [
            { data: "2026-10-16", unidade: "DSC (Gabinete)", texto: "Ofício recebido." },
            { data: "2026-10-17", unidade: "DSC/GAT", texto: "Encaminhado para levantar os dados." },
          ] },
        { id: "cx08", sei: "0146201", processo: "23180.006650/2026-02", entrada: "2026-10-25", remetente: "DSC/GIS", assunto: "Relatório de chamados de TI de setembro", categoria: "Despacho", contratoId: "c4",
          acao: "ciencia", precisaDiretor: false, situacao: "recebido", aguardando: "DSC/GCR", responsavel: "paula",
          prazo: null,
          andamentos: [{ data: "2026-10-25", unidade: "DSC/GCR", texto: "Despacho recebido para ciência." }] },
        { id: "cx09", sei: "0146244", processo: "23180.013120/2026-05", entrada: "2026-10-26", remetente: "DAF — Financeiro", assunto: "Memorando — cronograma de pagamentos de novembro", categoria: null, contratoId: null,
          acao: null, precisaDiretor: false, situacao: "sem_classificacao", aguardando: "DSC/GCR", responsavel: null,
          prazo: null,
          andamentos: [{ data: "2026-10-26", unidade: "DSC (Gabinete)", texto: "Documento recebido na caixa da DSC." }] },
        { id: "cx10", sei: "0146011", processo: "23180.012004/2026-19", entrada: "2026-10-22", remetente: "DSC/GCR", assunto: "Minuta do Contrato nº 041/2026 — mobiliário dos postos", categoria: "Contrato", contratoId: "c8",
          acao: "assinatura", precisaDiretor: true, situacao: "aguardando_assinatura", aguardando: "Sigma Comércio Ltda (contratada)", responsavel: null,
          prazo: { data: "2026-11-05", tipo: "interno", regra: "Assinatura antes do início previsto da execução" },
          andamentos: [
            { data: "2026-10-22", unidade: "DSC/GCR", texto: "Minuta enviada à contratada para assinatura." },
          ] },
        { id: "cx11", sei: "0139412", processo: "23180.008120/2025-36", entrada: "2026-08-28", remetente: "DSC/GAT", assunto: "Proposta de supressão de 10% da central telefônica", categoria: "Termo aditivo", contratoId: "c7",
          acao: "aprovacao", precisaDiretor: true, situacao: "em_analise", aguardando: "DAF — Orçamento", responsavel: "paula",
          prazo: null, semPrazoMotivo: "Processo sobrestado formalmente",
          sobrestado: { desde: "2026-09-10", motivo: "Aguardando confirmação de dotação orçamentária de 2027", ato: "Despacho DAF nº 88/2026 (SEI 0141220)", desbloqueio: "DAF — Orçamento" },
          andamentos: [
            { data: "2026-08-28", unidade: "DSC/GAT", texto: "Proposta de supressão elaborada." },
            { data: "2026-09-10", unidade: "DAF — Orçamento", texto: "Processo sobrestado até a confirmação da dotação de 2027." },
          ] },
        { id: "cx12", sei: "0140877", processo: "23180.010233/2025-55", entrada: "2026-09-16", remetente: "Alfa Atendimento Integrado Ltda (contratada)", assunto: "Pedido de substituição do preposto do contrato", categoria: "Ofício", contratoId: "c1",
          acao: "analise", precisaDiretor: false, situacao: "em_analise", aguardando: "DSC/GOS", responsavel: "rafael",
          prazo: null, semPrazoMotivo: "Sem prazo no contrato para esta resposta",
          andamentos: [
            { data: "2026-09-16", unidade: "DSC/GCR", texto: "Ofício recebido." },
            { data: "2026-09-18", unidade: "DSC/GOS", texto: "Enviado para avaliação do currículo do novo preposto." },
          ] },
        { id: "cx13", sei: "0144401", processo: "23180.011870/2025-61", entrada: "2026-09-28", remetente: "DSC/GCR", assunto: "Notificação à contratada — atraso na reposição de insumos no Posto Leste", categoria: "Notificação", contratoId: "c2", posto: "p-leste",
          acao: "resposta", precisaDiretor: false, situacao: "encerrado_pendencia", aguardando: "Beta Facilities S.A. (contratada)", responsavel: "rafael",
          prazo: { data: "2026-10-08", tipo: "contratual", regra: "10 dias para a contratada responder à notificação" },
          evidencia: "Resposta da contratada (SEI 0144620)", pendencia: "Falta a foto do abastecimento do Posto Leste para comprovar a correção",
          andamentos: [
            { data: "2026-09-28", unidade: "Beta Facilities S.A.", texto: "Notificação enviada." },
            { data: "2026-10-07", unidade: "DSC/GCR", texto: "Resposta recebida; comprovação parcial." },
          ] },
        { id: "cx14", sei: "0143910", processo: "23180.007702/2026-47", entrada: "2026-10-01", remetente: "DSC/GOS", assunto: "OIS nº 002/2026 — manutenção preventiva de outubro", categoria: "OIS", contratoId: "c5",
          acao: "ciencia", precisaDiretor: false, situacao: "concluido", aguardando: null, responsavel: "ana",
          prazo: null, evidencia: "OIS assinada (SEI 0143910)",
          andamentos: [{ data: "2026-10-02", unidade: "DSC/GOS", texto: "OIS assinada e enviada à contratada." }] },
        { id: "cx15", sei: "0145102", processo: "23180.004512/2024-31", entrada: "2026-10-09", remetente: "Alfa Atendimento Integrado Ltda (contratada)", assunto: "Renovação da apólice de seguro de responsabilidade civil", categoria: "Documento da contratada", contratoId: "c1",
          acao: "analise", precisaDiretor: false, situacao: "concluido", aguardando: null, responsavel: "rafael",
          prazo: null, evidencia: null,
          andamentos: [
            { data: "2026-10-09", unidade: "DSC/GCR", texto: "Apólice recebida." },
            { data: "2026-10-12", unidade: "DSC/GCR", texto: "Marcado como concluído sem anexar a apólice conferida." },
          ] },
      ],
      /* ---------- OIS (R05): uma OIS, um identificador. Medição e pagamento ficam para a fase 2 ---------- */
      ois: [
        { id: "o1", numero: "OIS nº 031/2026", contratoId: "c1", comp: "2026-09", objeto: "Operação dos postos — setembro", sei: "0139020", etapas: { solicitacao: "2026-08-21", emissao: "2026-08-25", assinatura: "2026-08-27", execucao: "2026-09-01", aceite: "2026-10-06" } },
        { id: "o2", numero: "OIS nº 038/2026", contratoId: "c1", comp: "2026-10", objeto: "Operação dos postos — outubro", sei: "0141801", etapas: { solicitacao: "2026-09-22", emissao: "2026-09-26", assinatura: "2026-09-29", execucao: "2026-10-01", aceite: null } },
        { id: "o3", numero: "OIS nº 042/2026", contratoId: "c1", comp: "2026-11", objeto: "Operação dos postos — novembro", sei: "0146032", caixaId: "cx04", etapas: { solicitacao: "2026-10-20", emissao: "2026-10-23", assinatura: null, execucao: null, aceite: null }, aguardando: "Diretor DSC" },
        { id: "o4", numero: "OIS nº 019/2026", contratoId: "c2", comp: "2026-10", objeto: "Limpeza dos postos — outubro", sei: "0143115", etapas: { solicitacao: "2026-09-24", emissao: "2026-09-28", assinatura: "2026-09-29", execucao: "2026-10-01", aceite: null } },
        { id: "o5", numero: "OIS nº 011/2026", contratoId: "c3", comp: "2026-09", objeto: "Vigilância — setembro", sei: "0139550", etapas: { solicitacao: "2026-08-25", emissao: "2026-08-28", assinatura: "2026-08-29", execucao: "2026-09-01", aceite: "2026-10-03" } },
        { id: "o6", numero: "OIS nº 001/2026", contratoId: "c5", comp: "2026-09", objeto: "Início dos serviços de manutenção", sei: "0142630", etapas: { solicitacao: "2026-08-28", emissao: "2026-09-01", assinatura: null, execucao: null, aceite: null }, aguardando: "Épsilon Engenharia Ltda (contratada)" },
        { id: "o7", numero: "OIS nº 002/2026", contratoId: "c5", comp: "2026-10", objeto: "Manutenção preventiva — outubro", sei: "0143910", caixaId: "cx14", etapas: { solicitacao: "2026-09-26", emissao: "2026-10-01", assinatura: "2026-10-02", execucao: "2026-10-05", aceite: null } },
        { id: "o8", numero: "OIS nº 007/2026", contratoId: "c6", comp: "2026-09", objeto: "Transporte de malotes — setembro", sei: "0140230", caixaId: "cx06", etapas: { solicitacao: "2026-08-30", emissao: "2026-09-02", assinatura: "2026-09-02", execucao: "2026-09-03", aceite: null } },
      ],
      /* ---------- Aditivos e reajustes (R02): proposto ≠ formalizado ≠ vigente ---------- */
      aditivos: [
        { id: "ad1", contratoId: "c3", titulo: "2º Termo Aditivo — prorrogação por 12 meses", tipo: "Prorrogação", situacao: "proposto", sei: "0146120", caixaId: "cx01", efeito: "Nova vigência até 31/12/2027", data: "2026-10-24" },
        { id: "ad2", contratoId: "c2", titulo: "2º Termo Aditivo — inclusão do Posto Oeste", tipo: "Acréscimo de valor e abrangência", situacao: "formalizado", sei: "0145872", caixaId: "cx03", efeito: "Vale a partir de 01/11/2026 (+9,8%)", data: "2026-10-21" },
        { id: "ad3", contratoId: "c7", titulo: "Supressão de 10% da central telefônica", tipo: "Supressão", situacao: "proposto", sei: "0139412", caixaId: "cx11", efeito: "Redução de R$ 840.000,00 no valor total", data: "2026-08-28" },
        { id: "ad4", contratoId: "c1", titulo: "1º Termo Aditivo — acréscimo de 5% e Posto Leste", tipo: "Acréscimo de valor e abrangência", situacao: "vigente", sei: "0127730", efeito: "Valor total de R$ 13.104.000,00", data: "2025-07-10" },
      ],
      reajustes: [
        { id: "rj1", contratoId: "c3", tipo: "Repactuação", situacao: "solicitado", dataBase: "2026-01-01", indice: "Convenção coletiva 2026", caixaId: "cx02", texto: "Pedido da contratada em análise no Jurídico." },
        { id: "rj2", contratoId: "c1", tipo: "Reajuste anual", situacao: "previsto", dataBase: "2027-03-01", indice: "IPCA", texto: "A contratada pode pedir o reajuste a partir da data-base." },
        { id: "rj3", contratoId: "c2", tipo: "Reajuste anual", situacao: "aplicado", dataBase: "2026-05-15", indice: "IPCA", texto: "Aplicado por apostilamento em 06/2026." },
      ],
      /* Cobranças registradas pela Equipe GCR, por item (ref = "cx:<id>", "ois:<id>" ou "ct:<id>") */
      cobrancas: [
        { id: "cb1", ref: "cx:cx05", data: "2026-10-19T10:20:00", por: "rafael", canal: "E-mail", destinatario: "Prefeitura de Vale", texto: "Pedida a posição do alvará do Posto Vale.", resposta: "Prefeitura informou que o pedido está em análise, sem data." },
        { id: "cb2", ref: "ois:o6", data: "2026-10-05T15:00:00", por: "ana", canal: "Ofício SEI", destinatario: "Épsilon Engenharia Ltda", texto: "Cobrada a assinatura da OIS nº 001/2026.", resposta: null },
        { id: "cb3", ref: "cx:cx07", data: "2026-10-22T09:00:00", por: "rafael", canal: "Teams", destinatario: "DSC/GAT", texto: "Lembrete do prazo legal da resposta à Casa Civil (23/10).", resposta: "GAT informou que os dados de setembro ainda não fecharam." },
      ],
      /* Responsáveis informados à mão pela GCR quando o contrato não traz gestor ou fiscal */
      respManual: {},
      vistosDiretor: ["cx03", "cx14", "cx15", "cx12", "cx13", "cx05", "cx02", "cx11", "cx06"],
      obrigacoes: [
        // CT 014/2025 — preparação parcialmente concluída
        { id: "c1-ob1", contratoId: "c1", descricao: "Manter TME igual ou inferior a 15 minutos por posto", docId: "d3", clausula: "Anexo II, item 2.1 / Cláusula 7.2", tipo: "indicador", abrangencia: "4 postos", periodicidade: "Mensal", prazo: "—", ausentes: [], decisao: { acao: "confirmada", por: "rafael", em: "2026-06-03" } },
        { id: "c1-ob2", contratoId: "c1", descricao: "Manter TMA igual ou inferior a 12 minutos", docId: "d3", clausula: "Anexo II, item 2.2", tipo: "indicador", abrangencia: "4 postos", periodicidade: "Mensal", prazo: "—", ausentes: ["Regra de desconto não localizada"], decisao: { acao: "confirmada", por: "rafael", em: "2026-06-03" } },
        { id: "c1-ob3", contratoId: "c1", descricao: "Apresentar relatório mensal de execução até o 5º dia útil", docId: "d1", clausula: "Cláusula 9.1", tipo: "entrega", abrangencia: "Contrato", periodicidade: "Mensal", prazo: "5º dia útil", ausentes: [], decisao: { acao: "confirmada", por: "rafael", em: "2026-06-03" } },
        { id: "c1-ob4", contratoId: "c1", descricao: "Manter apólice de seguro de responsabilidade civil vigente", docId: "d1", clausula: "Cláusula 12.3", tipo: "documento", abrangencia: "Contrato", periodicidade: "Anual", prazo: "Não identificado", ausentes: ["Antecedência de renovação"], decisao: { acao: "ajustada", por: "rafael", em: "2026-06-04", justificativa: "Periodicidade anual conforme apólice vigente." } },
        { id: "c1-ob5", contratoId: "c1", descricao: "Manter condições físicas dos postos conforme checklist GCR", docId: "d2", clausula: "Anexo I, item 5", tipo: "fiscalizacao", abrangencia: "4 postos", periodicidade: "Mensal", prazo: "—", ausentes: [], decisao: { acao: "confirmada", por: "rafael", em: "2026-06-03" } },
        { id: "c1-ob6", contratoId: "c1", descricao: "Manter índice de Sintonia igual ou superior a 90%", docId: null, clausula: null, tipo: "indicador", abrangencia: "Não identificada", periodicidade: "Não identificada", prazo: "—", ausentes: ["Cláusula de origem", "Fórmula", "Fonte de dados"], decisao: null },
        // CT 019/2026 — preparação ainda não iniciada
        { id: "c5-p1", contratoId: "c5", descricao: "Atender chamados corretivos emergenciais em até 4 horas", docId: "d19", clausula: "Anexo I, item 6.1", tipo: "indicador", abrangencia: "Postos Vale e Serra", periodicidade: "Não identificada", prazo: "4 horas", ausentes: ["Periodicidade de apuração", "Fonte dos chamados"], decisao: null },
        { id: "c5-p2", contratoId: "c5", descricao: "Executar o plano de manutenção preventiva mensal", docId: "d19", clausula: "Anexo I, item 6.3", tipo: "entrega", abrangencia: "Postos Vale e Serra", periodicidade: "Mensal", prazo: "Conforme cronograma", ausentes: [], decisao: null },
        { id: "c5-p3", contratoId: "c5", descricao: "Apresentar e manter atualizada a ART do responsável técnico", docId: "d18", clausula: "Cláusula 8.4", tipo: "documento", abrangencia: "Contrato", periodicidade: "Anual", prazo: "Não identificado", ausentes: ["Validade do documento"], decisao: null },
        { id: "c5-p4", contratoId: "c5", descricao: "Manter climatização e iluminação adequadas nos postos", docId: "d19", clausula: "Anexo I, item 7", tipo: "fiscalizacao", abrangencia: "Postos Vale e Serra", periodicidade: "Mensal", prazo: "—", ausentes: ["Critério de aceite não especificado"], decisao: null },
        { id: "c5-p5", contratoId: "c5", descricao: "Entregar relatório mensal de serviços com registro fotográfico", docId: "d18", clausula: "Cláusula 9.2", tipo: "entrega", abrangencia: "Contrato", periodicidade: "Mensal", prazo: "Não identificado", ausentes: ["Prazo de entrega"], decisao: null },
        { id: "c5-p6", contratoId: "c5", descricao: "Aplicar desconto por atraso no atendimento emergencial", docId: "d20", clausula: "Anexo III (IMR), item 3", tipo: "indicador", abrangencia: "Postos Vale e Serra", periodicidade: "Mensal", prazo: "—", ausentes: ["Base de cálculo ambígua (fatura total ou parcela do posto)"], decisao: null },
      ],
      itens: [
        {
          id: "i1", contratoId: "c1", obrigacaoId: "c1-ob1", nome: "TME por posto ≤ 15 min", tipo: "indicador", status: "ativo", versao: 1,
          config: {
            descricao: "Acompanhar o tempo médio de espera de cada posto, ponderado pelo número de atendimentos do mês.",
            abrangencia: ["p-centro", "p-norte", "p-sul", "p-leste"],
            responsaveis: { acompanha: "camila", responde: "Alfa Atendimento (preposto)", verifica: "ana" },
            vigencia: { inicio: "2026-07", fim: "2027-02" },
            freq: { coleta: "Diária (CCO, D-1)", avaliacao: "Mensal, por posto", medicao: "Mensal", fechamentoDias: 5 },
            evidencia: "Série diária do CCO por posto, com cobertura e memória de cálculo.",
            criterio: "TME mensal do posto ≤ 15 min, média ponderada pelo número de atendimentos.",
            tratativa: { prazoDias: 10, verificacao: "Verificação da média do mês seguinte e plano de ação." },
            financeiro: { situacao: "validada", fundamento: "Anexo II, item 4.1 (IMR)", formula: "0,5% da parcela mensal do posto por minuto ou fração acima da meta; limite de 5%." },
            especifico: { fonte: "CCO", campo: "tempo_espera", formula: "Σ(TME_dia × atendimentos_dia) ÷ Σ atendimentos_dia", unidade: "min", janela: "Mês civil", agregacao: "Ponderada por atendimentos", meta: "15", tolerancia: "0", excecoes: "Dias sem expediente; dias com dado inconsistente excluídos com registro." },
          },
          aceites: [{ versao: 1, usuario: "rafael", funcao: "Gestor", data: "2026-06-20T15:12:00", aplicacao: "2026-07", docs: ["0094391", "0127730"] }],
        },
        {
          id: "i2", contratoId: "c1", obrigacaoId: "c1-ob2", nome: "TMA por posto ≤ 12 min", tipo: "indicador", status: "ativo_sem_financeiro", versao: 1,
          config: {
            descricao: "Acompanhar o tempo médio de atendimento por posto.",
            abrangencia: ["p-centro", "p-norte", "p-sul", "p-leste"],
            responsaveis: { acompanha: "camila", responde: "Alfa Atendimento (preposto)", verifica: "ana" },
            vigencia: { inicio: "2026-07", fim: "2027-02" },
            freq: { coleta: "Diária (CCO, D-1)", avaliacao: "Mensal, por posto", medicao: "Mensal", fechamentoDias: 5 },
            evidencia: "Série diária do CCO por posto.",
            criterio: "TMA mensal do posto ≤ 12 min.",
            tratativa: { prazoDias: 10, verificacao: "Verificação da média do mês seguinte." },
            financeiro: { situacao: "pendente", fundamento: "", formula: "" },
            especifico: { fonte: "CCO", campo: "duracao_atendimento", formula: "Σ(TMA_dia × atendimentos_dia) ÷ Σ atendimentos_dia", unidade: "min", janela: "Mês civil", agregacao: "Ponderada por atendimentos", meta: "12", tolerancia: "0", excecoes: "Dias sem expediente." },
          },
          aceites: [{ versao: 1, usuario: "rafael", funcao: "Gestor", data: "2026-06-20T15:14:00", aplicacao: "2026-07", docs: ["0094391"] }],
        },
        {
          id: "i3", contratoId: "c1", obrigacaoId: "c1-ob3", nome: "Relatório mensal de execução", tipo: "entrega", status: "ativo", versao: 1,
          config: {
            descricao: "Receber e conferir o relatório mensal de execução.",
            abrangencia: ["p-centro", "p-norte", "p-sul", "p-leste"],
            responsaveis: { acompanha: "camila", responde: "Alfa Atendimento (preposto)", verifica: "ana" },
            vigencia: { inicio: "2026-07", fim: "2027-02" },
            freq: { coleta: "Mensal", avaliacao: "Na entrega", medicao: "Mensal", fechamentoDias: 5 },
            evidencia: "Documento juntado ao processo de fiscalização no SEI.",
            criterio: "Entrega até o 5º dia útil com quadro de pessoal, ocorrências e indicadores.",
            tratativa: { prazoDias: 5, verificacao: "Conferência do conteúdo mínimo." },
            financeiro: { situacao: "sem_regra", fundamento: "", formula: "" },
            especifico: { produto: "Relatório mensal de execução", quantidade: "1 por mês", marco: "5º dia útil", criterioAceite: "Conteúdo mínimo da Cláusula 9.1" },
          },
          aceites: [{ versao: 1, usuario: "rafael", funcao: "Gestor", data: "2026-06-20T15:20:00", aplicacao: "2026-07", docs: ["0094410"] }],
        },
        {
          id: "i4", contratoId: "c1", obrigacaoId: "c1-ob4", nome: "Apólice de seguro RC vigente", tipo: "documento", status: "em_preparacao", versao: 1,
          config: {
            descricao: "Controlar a validade da apólice de responsabilidade civil.",
            abrangencia: [],
            responsaveis: { acompanha: "camila", responde: "Alfa Atendimento (preposto)", verifica: "" },
            vigencia: { inicio: "2026-11", fim: "2027-02" },
            freq: { coleta: "Anual", avaliacao: "Na renovação", medicao: "Anual", fechamentoDias: 10 },
            evidencia: "",
            criterio: "Apólice válida durante toda a vigência.",
            tratativa: { prazoDias: 15, verificacao: "Conferência da nova apólice." },
            financeiro: { situacao: "sem_regra", fundamento: "", formula: "" },
            especifico: { tipoDoc: "Apólice de seguro RC", validade: "2026-12-15", antecedencia: "" },
          },
          aceites: [],
        },
        {
          id: "i5", contratoId: "c1", obrigacaoId: "c1-ob5", nome: "Condições físicas — checklist GCR", tipo: "fiscalizacao", status: "ativo", versao: 1,
          config: {
            descricao: "Inspeção mensal das condições de cada posto.",
            abrangencia: ["p-centro", "p-norte", "p-sul", "p-leste"],
            responsaveis: { acompanha: "camila", responde: "Alfa Atendimento (preposto)", verifica: "ana" },
            vigencia: { inicio: "2026-07", fim: "2027-02" },
            freq: { coleta: "Mensal (inspeção)", avaliacao: "Por inspeção", medicao: "Mensal", fechamentoDias: 5 },
            evidencia: "Checklist preenchido, fotos obrigatórias para Não Conforme e verificação.",
            criterio: "Todos os itens do checklist Conforme ou justificados.",
            tratativa: { prazoDias: 5, verificacao: "Nova evidência fotográfica aceita pelo verificador." },
            financeiro: { situacao: "sem_regra", fundamento: "", formula: "" },
            especifico: { checklist: "gcr", evidenciasObrigatorias: "Foto e descrição para Não Conforme" },
          },
          aceites: [{ versao: 1, usuario: "rafael", funcao: "Gestor", data: "2026-06-20T15:25:00", aplicacao: "2026-07", docs: ["0094388"] }],
        },
        {
          id: "i6", contratoId: "c2", obrigacaoId: null, nome: "Limpeza dos postos — checklist mensal", tipo: "fiscalizacao", status: "ativo", versao: 1,
          config: {
            descricao: "Inspeção mensal da limpeza em cada posto.",
            abrangencia: ["p-centro", "p-leste"],
            responsaveis: { acompanha: "camila", responde: "Beta Facilities (encarregada)", verifica: "joao" },
            vigencia: { inicio: "2025-06", fim: "2027-05" },
            freq: { coleta: "Mensal (inspeção)", avaliacao: "Por inspeção", medicao: "Mensal", fechamentoDias: 5 },
            evidencia: "Checklist de limpeza com fotos.",
            criterio: "Itens do checklist Conforme.",
            tratativa: { prazoDias: 2, verificacao: "Nova inspeção do item." },
            financeiro: { situacao: "validada", fundamento: "Anexo I, item 11", formula: "1% da parcela mensal do posto por item não corrigido no prazo." },
            especifico: { checklist: "limp", evidenciasObrigatorias: "Foto para Não Conforme" },
          },
          aceites: [{ versao: 1, usuario: "rafael", funcao: "Gestor", data: "2025-06-02T10:00:00", aplicacao: "2025-06", docs: ["0103125"] }],
          revisaoPendente: {
            versao: 2, motivo: "2º Termo Aditivo (SEI 0145872) inclui o Posto Oeste a partir de 01/11/2026.",
            aplicacao: "2026-11", docId: "d12",
            mudancas: [{ campo: "Abrangência", antes: "Posto Centro, Posto Leste", depois: "Posto Centro, Posto Leste, Posto Oeste" }],
            abrangencia: ["p-centro", "p-leste", "p-oeste"],
          },
        },
        {
          id: "i7", contratoId: "c2", obrigacaoId: null, nome: "Relatório mensal de limpeza", tipo: "entrega", status: "ativo", versao: 1,
          config: {
            descricao: "Receber o relatório mensal de limpeza.",
            abrangencia: ["p-centro", "p-leste"],
            responsaveis: { acompanha: "camila", responde: "Beta Facilities (encarregada)", verifica: "joao" },
            vigencia: { inicio: "2025-06", fim: "2027-05" },
            freq: { coleta: "Mensal", avaliacao: "Na entrega", medicao: "Mensal", fechamentoDias: 5 },
            evidencia: "Documento no SEI.",
            criterio: "Entrega até o 5º dia útil.",
            tratativa: { prazoDias: 5, verificacao: "Conferência do conteúdo." },
            financeiro: { situacao: "sem_regra", fundamento: "", formula: "" },
            especifico: { produto: "Relatório mensal", quantidade: "1 por mês", marco: "5º dia útil", criterioAceite: "Conteúdo mínimo do TR" },
          },
          aceites: [{ versao: 1, usuario: "rafael", funcao: "Gestor", data: "2025-06-02T10:05:00", aplicacao: "2025-06", docs: ["0103125"] }],
        },
        {
          id: "i8", contratoId: "c3", obrigacaoId: null, nome: "Cobertura dos postos de vigilância 24h", tipo: "indicador", status: "ativo_sem_financeiro", versao: 1,
          config: {
            descricao: "Verificar se todos os turnos previstos foram cobertos.",
            abrangencia: ["p-norte2", "p-distrito"],
            responsaveis: { acompanha: "camila", responde: "Gama Segurança (supervisor)", verifica: "rafael" },
            vigencia: { inicio: "2026-08", fim: "2026-12" },
            freq: { coleta: "Mensal (escala enviada pela contratada)", avaliacao: "Mensal", medicao: "Mensal", fechamentoDias: 7 },
            evidencia: "Escala realizada assinada e livro de ocorrências.",
            criterio: "100% dos turnos cobertos.",
            tratativa: { prazoDias: 3, verificacao: "Escala corrigida." },
            financeiro: { situacao: "pendente", fundamento: "", formula: "" },
            especifico: { fonte: "Outra fonte: escala da contratada", campo: "turnos_cobertos", formula: "turnos cobertos ÷ turnos previstos", unidade: "%", janela: "Mês civil", agregacao: "Soma de turnos", meta: "100", tolerancia: "0", excecoes: "" },
          },
          aceites: [{ versao: 1, usuario: "marcos", funcao: "Gestor", data: "2026-07-28T09:30:00", aplicacao: "2026-08", docs: ["0071002"] }],
        },
      ],
      medicoes: [
        { id: "m1", itemId: "i1", comp: "2026-09", status: "pronta_validacao", prazo: "proximo", fechamentoAte: "2026-10-31", versaoRegra: 1, financeiro: { situacao: "estimada" } },
        { id: "m2", itemId: "i1", comp: "2026-10", status: "em_acompanhamento", prazo: "no_prazo", fechamentoAte: "2026-11-06", versaoRegra: 1, financeiro: { situacao: "risco" } },
        { id: "m3", itemId: "i1", comp: "2026-11", status: "programada", prazo: "no_prazo", fechamentoAte: "2026-12-07", versaoRegra: 1, financeiro: { situacao: "sem_calculo" } },
        { id: "m4", itemId: "i2", comp: "2026-09", status: "em_analise", prazo: "proximo", fechamentoAte: "2026-10-31", versaoRegra: 1, financeiro: { situacao: "pendente" } },
        { id: "m5", itemId: "i2", comp: "2026-10", status: "em_acompanhamento", prazo: "no_prazo", fechamentoAte: "2026-11-06", versaoRegra: 1, financeiro: { situacao: "pendente" } },
        { id: "m6", itemId: "i3", comp: "2026-09", status: "fechada", prazo: "no_prazo", fechamentoAte: "2026-10-07", versaoRegra: 1, financeiro: { situacao: "sem_regra" }, fechamento: { por: "ana", em: "2026-10-06T16:40:00" } },
        { id: "m7", itemId: "i3", comp: "2026-10", status: "aguardando", prazo: "no_prazo", fechamentoAte: "2026-11-13", versaoRegra: 1, financeiro: { situacao: "sem_regra" } },
        { id: "m8", itemId: "i5", comp: "2026-09", status: "fechada", prazo: "no_prazo", fechamentoAte: "2026-10-07", versaoRegra: 1, financeiro: { situacao: "sem_regra" }, fechamento: { por: "ana", em: "2026-10-07T11:02:00" } },
        { id: "m9", itemId: "i5", comp: "2026-10", status: "em_analise", prazo: "no_prazo", fechamentoAte: "2026-11-06", versaoRegra: 1, financeiro: { situacao: "sem_regra" } },
        { id: "m10", itemId: "i6", comp: "2026-08", status: "fechada", prazo: "no_prazo", fechamentoAte: "2026-09-05", versaoRegra: 1, financeiro: { situacao: "confirmada", estimado: 912.0, confirmado: 912.0, fundamento: "Anexo I, item 11 — 1 item não corrigido no prazo (Posto Leste)" }, fechamento: { por: "joao", em: "2026-09-04T17:20:00" } },
        { id: "m11", itemId: "i6", comp: "2026-09", status: "fechada", prazo: "no_prazo", fechamentoAte: "2026-10-07", versaoRegra: 1, financeiro: { situacao: "nao_aplicada", estimado: 912.0, confirmado: 0, justificativa: "Correção comprovada dentro do prazo de 2 dias (ocorrência OC-0412)." }, fechamento: { por: "joao", em: "2026-10-05T10:10:00" } },
        { id: "m12", itemId: "i6", comp: "2026-10", status: "em_acompanhamento", prazo: "no_prazo", fechamentoAte: "2026-11-06", versaoRegra: 1, financeiro: { situacao: "sem_calculo" } },
        { id: "m13", itemId: "i7", comp: "2026-09", status: "fechada", prazo: "no_prazo", fechamentoAte: "2026-10-07", versaoRegra: 1, financeiro: { situacao: "sem_regra" }, fechamento: { por: "joao", em: "2026-10-05T10:12:00" } },
        { id: "m14", itemId: "i7", comp: "2026-10", status: "aguardando", prazo: "no_prazo", fechamentoAte: "2026-11-13", versaoRegra: 1, financeiro: { situacao: "sem_regra" } },
        { id: "m15", itemId: "i8", comp: "2026-09", status: "aguardando", prazo: "atrasado", fechamentoAte: "2026-10-09", versaoRegra: 1, financeiro: { situacao: "pendente" } },
        { id: "m16", itemId: "i8", comp: "2026-10", status: "em_acompanhamento", prazo: "no_prazo", fechamentoAte: "2026-11-09", versaoRegra: 1, financeiro: { situacao: "pendente" } },
      ],
      ocorrencias: [
        {
          id: "OC-0431", contratoId: "c1", itemId: "i1", postoId: "p-norte", comp: "2026-09", origem: "indicador",
          titulo: "TME do Posto Norte acima da meta em set/2026",
          descricao: "Média ponderada do mês acima de 15 min. Picos concentrados no início do mês.",
          responsavel: "Alfa Atendimento (preposto)", encaminhadoEm: "2026-10-02", cienciaEm: "2026-10-03", prazo: "2026-10-16", regraPrazo: "10 dias corridos a partir da ciência",
          status: "em_verificacao",
          eventos: [
            { data: "2026-10-01T09:10:00", tipo: "abertura", por: "camila", texto: "Ocorrência aberta a partir da apuração de set/2026." },
            { data: "2026-10-02T11:00:00", tipo: "encaminhamento", por: "camila", texto: "Encaminhada ao preposto com prazo de 10 dias." },
            { data: "2026-10-03T08:42:00", tipo: "ciencia", por: "Alfa Atendimento", texto: "Ciência registrada." },
            { data: "2026-10-14T17:30:00", tipo: "resposta", por: "Alfa Atendimento", texto: "Plano de ação com reforço de 2 atendentes no período da manhã (Ofício nº 231/2026)." },
          ],
          evidencias: ["Série diária CCO — Posto Norte set/2026", "Ofício nº 231/2026 (SEI 0141987)"],
        },
        {
          id: "OC-0437", contratoId: "c1", itemId: "i5", postoId: "p-centro", comp: "2026-10", origem: "inspecao", fiscalizacaoId: "F-0102",
          titulo: "Extintor com validade vencida no Posto Centro",
          descricao: "Extintor do salão principal com selo vencido em 08/2026.",
          responsavel: "Alfa Atendimento (preposto)", encaminhadoEm: "2026-10-14", cienciaEm: "2026-10-14", prazo: "2026-10-21", regraPrazo: "5 dias úteis a partir da ciência",
          status: "vencida",
          eventos: [
            { data: "2026-10-14T10:20:00", tipo: "abertura", por: "camila", texto: "Constatação na inspeção F-0102, item 4 (Não Conforme, com foto)." },
            { data: "2026-10-14T10:25:00", tipo: "encaminhamento", por: "camila", texto: "Encaminhada ao preposto." },
            { data: "2026-10-14T14:00:00", tipo: "ciencia", por: "Alfa Atendimento", texto: "Ciência registrada." },
            { data: "2026-10-22T00:00:00", tipo: "vencimento", por: "sistema", texto: "Prazo vencido sem resposta. Segue para análise do efeito na medição (não confirma desconto)." },
          ],
          evidencias: ["Foto do selo do extintor", "Checklist F-0102"],
        },
        {
          id: "OC-0440", contratoId: "c1", itemId: "i1", postoId: "p-sul", comp: "2026-10", origem: "dados",
          titulo: "Ausência de dados do CCO — Posto Sul (20 a 22/10)",
          descricao: "Três dias sem registros na integração. Ausência não é tratada como zero nem como descumprimento.",
          responsavel: "Equipe de integração CCO", encaminhadoEm: "2026-10-23", cienciaEm: null, prazo: "2026-10-30", regraPrazo: "Política de cobertura (a definir)",
          status: "em_analise",
          eventos: [
            { data: "2026-10-23T07:00:00", tipo: "abertura", por: "sistema", texto: "Lacuna de cobertura identificada na coleta diária." },
            { data: "2026-10-23T09:15:00", tipo: "encaminhamento", por: "camila", texto: "Solicitada recarga dos dados à equipe do CCO." },
          ],
          evidencias: ["Log de coleta CCO 20–22/10"],
        },
        {
          id: "OC-0412", contratoId: "c2", itemId: "i6", postoId: "p-leste", comp: "2026-09", origem: "inspecao",
          titulo: "Sanitários sem abastecimento de insumos — Posto Leste",
          descricao: "Falta de papel e sabonete em dois sanitários.",
          responsavel: "Beta Facilities (encarregada)", encaminhadoEm: "2026-09-18", cienciaEm: "2026-09-18", prazo: "2026-09-20", regraPrazo: "2 dias corridos",
          status: "encerrada",
          eventos: [
            { data: "2026-09-18T09:00:00", tipo: "abertura", por: "camila", texto: "Constatação na inspeção mensal." },
            { data: "2026-09-19T15:10:00", tipo: "resposta", por: "Beta Facilities", texto: "Abastecimento realizado, fotos anexadas." },
            { data: "2026-09-20T10:00:00", tipo: "verificacao", por: "joao", texto: "Correção aceita com evidência fotográfica." },
          ],
          evidencias: ["Fotos antes/depois"],
        },
        {
          id: "OC-0438", contratoId: "c3", itemId: "i8", postoId: "p-distrito", comp: "2026-10", origem: "inspecao",
          titulo: "Turno noturno descoberto no Distrito Industrial (11/10)",
          descricao: "Livro de ocorrências sem registro de vigilante entre 02h e 06h.",
          responsavel: "Gama Segurança (supervisor)", encaminhadoEm: "2026-10-12", cienciaEm: "2026-10-12", prazo: "2026-10-15", regraPrazo: "3 dias corridos",
          status: "devolvida",
          eventos: [
            { data: "2026-10-12T08:30:00", tipo: "abertura", por: "camila", texto: "Ocorrência aberta." },
            { data: "2026-10-14T18:00:00", tipo: "resposta", por: "Gama Segurança", texto: "Informa que o vigilante estava em ronda." },
            { data: "2026-10-16T09:40:00", tipo: "devolucao", por: "rafael", texto: "Resposta sem comprovação. Solicitado registro da ronda." },
          ],
          evidencias: ["Foto do livro de ocorrências"],
        },
      ],
      fiscalizacoes: [
        ...[["F-0088", "p-centro", "2026-09-10"], ["F-0089", "p-norte", "2026-09-11"], ["F-0090", "p-sul", "2026-09-14"], ["F-0091", "p-leste", "2026-09-16"]].map(([id, posto, data]) => (
          { id, contratoId: "c1", itemId: "i5", postoId: posto, data, checklist: "gcr", versao: "v2", por: "camila", status: "enviada", sincronizada: true, respostas: respostasConformes(9, { 8: "IR" }) })),
        { id: "F-0086", contratoId: "c2", itemId: "i6", postoId: "p-centro", data: "2026-09-17", checklist: "limp", versao: "v1", por: "camila", status: "enviada", sincronizada: true, respostas: respostasConformes(5) },
        { id: "F-0087", contratoId: "c2", itemId: "i6", postoId: "p-leste", data: "2026-09-18", checklist: "limp", versao: "v1", por: "camila", status: "enviada", sincronizada: true,
          respostas: Object.assign(respostasConformes(5), { 3: { r: "NC", desc: "Falta de papel e sabonete em dois sanitários.", foto: "sanitarios-leste.jpg" } }) },
        { id: "F-0102", contratoId: "c1", itemId: "i5", postoId: "p-centro", data: "2026-10-14", checklist: "gcr", versao: "v2", por: "camila", status: "enviada", sincronizada: true,
          respostas: { 0: { r: "C" }, 1: { r: "C" }, 2: { r: "C" }, 3: { r: "NC", desc: "Extintor do salão principal com selo vencido em 08/2026.", foto: "extintor-salao.jpg" }, 4: { r: "C" }, 5: { r: "C" }, 6: { r: "C" }, 7: { r: "NA" }, 8: { r: "IR" } } },
        { id: "F-0098", contratoId: "c2", itemId: "i6", postoId: "p-leste", data: "2026-10-08", checklist: "limp", versao: "v1", por: "camila", status: "enviada", sincronizada: true,
          respostas: { 0: { r: "C" }, 1: { r: "C" }, 2: { r: "C" }, 3: { r: "C" }, 4: { r: "C" } } },
        { id: "F-0105", contratoId: "c1", itemId: "i5", postoId: "p-norte", data: "2026-10-24", checklist: "gcr", versao: "v2", por: "camila", status: "rascunho", sincronizada: false,
          respostas: { 0: { r: "C" }, 1: { r: "C" }, 2: { r: "NC", desc: "Ar-condicionado do salão desligado; temperatura elevada.", foto: "" } } },
      ],
      preparacao: {
        c1: { step: 3, revisaoRegistrada: true, docsConferidos: ["d1", "d2", "d3", "d4"], iniciadoEm: "2026-06-02" },
      },
      alertas: [
        { id: "a1", perfil: ["super", "gestor"], contratoId: "c1", titulo: "OIS de novembro aguarda a sua assinatura", meta: "CT 014/2025 · OIS nº 042/2026 · prazo 30/10", responsavel: "Diretor DSC", estado: "novo", data: "2026-10-23" },
        { id: "a2", perfil: ["super", "gestor"], contratoId: null, titulo: "Prazo legal vencido: resposta à Casa Civil", meta: "Ofício nº 318/2026 · venceu em 23/10 · sem responsável", responsavel: "DSC/GAT", estado: "novo", data: "2026-10-24" },
        { id: "a3", perfil: ["super", "gestor"], contratoId: "c6", titulo: "OIS emitida para contrato com vigência encerrada", meta: "CT 027/2023 · OIS nº 007/2026 · vigência terminou em 31/01/2026", responsavel: "Sem responsável", estado: "novo", data: "2026-09-04" },
        { id: "a4", perfil: ["super", "gestor"], contratoId: "c3", titulo: "Prorrogação aguarda assinatura; vigência termina em 66 dias", meta: "CT 031/2024 · minuta do 2º Termo Aditivo", responsavel: "Marcos Viana", estado: "reconhecido", data: "2026-10-24" },
        { id: "a5", perfil: ["gestor"], contratoId: null, titulo: "Documento novo sem classificação na caixa DSC", meta: "Memorando DAF — cronograma de pagamentos", responsavel: "Equipe GCR", estado: "novo", data: "2026-10-26" },
        { id: "a6", perfil: ["op"], contratoId: "c1", titulo: "Correção vencida: extintor no Posto Centro", meta: "OC-0437 · venceu em 21/10", responsavel: "Camila Nunes", estado: "novo", data: "2026-10-22" },
      ],
      historico: [
        { id: "h1", data: "2026-10-26T07:40:00", usuario: "sistema", funcao: "Integração SEI", acao: "Consulta", objeto: "Carteira", detalhe: "Consulta diária aos processos vinculados. 2 documentos novos identificados.", contratoId: null },
        { id: "h2", data: "2026-10-21T16:02:00", usuario: "sistema", funcao: "Integração SEI", acao: "Proposta de atualização", objeto: "CT 022/2025", detalhe: "2º Termo Aditivo (SEI 0145872) gerou proposta de nova versão do item “Limpeza dos postos”. Dados confirmados não foram alterados.", contratoId: "c2" },
        { id: "h3", data: "2026-10-16T09:40:00", usuario: "rafael", funcao: "Fiscal técnico", acao: "Devolução", objeto: "OC-0438", detalhe: "Resposta devolvida por falta de comprovação.", contratoId: "c3" },
        { id: "h4", data: "2026-10-10T11:00:00", usuario: "sistema", funcao: "Cadastro", acao: "Designação", objeto: "CT 031/2024", detalhe: "Fiscal técnico: João Pires → Rafael Moura (Portaria nº 88/2026). Acesso anterior encerrado em 09/10.", contratoId: "c3" },
        { id: "h5", data: "2026-10-07T11:02:00", usuario: "ana", funcao: "Fiscal técnica", acao: "Fechamento", objeto: "Medição set/2026 — Checklist GCR", detalhe: "Competência fechada sem efeito financeiro.", contratoId: "c1" },
        { id: "h6", data: "2026-06-20T15:25:00", usuario: "rafael", funcao: "Gestor", acao: "De acordo", objeto: "Condições físicas — checklist GCR (v1)", detalhe: "Item liberado para a Operação a partir de 07/2026.", contratoId: "c1" },
        { id: "h7", data: "2026-06-20T15:12:00", usuario: "rafael", funcao: "Gestor", acao: "De acordo", objeto: "TME por posto ≤ 15 min (v1)", detalhe: "Item liberado para a Operação a partir de 07/2026.", contratoId: "c1" },
        { id: "h8", data: "2026-06-02T10:00:00", usuario: "rafael", funcao: "Gestor", acao: "Início do acompanhamento", objeto: "CT 014/2025", detalhe: "Preparação guiada iniciada.", contratoId: "c1" },
      ],
      mudancas: [
        { id: "mu1", data: "2026-10-21", contratoId: "c2", tipo: "aditivo", titulo: "2º Termo Aditivo assinado", origem: { docId: "d12" }, situacao: "confirmada",
          campos: [{ campo: "Valor vigente", antes: "R$ 4.380.000,00", depois: "R$ 4.809.240,00" }, { campo: "Abrangência", antes: "2 postos", depois: "3 postos (Posto Oeste a partir de 01/11/2026)" }],
          efeito: "A OIS de novembro precisa incluir o Posto Oeste." },
        { id: "mu2", data: "2026-10-24", contratoId: "c8", tipo: "cadastro", titulo: "Novo contrato identificado no SEI", origem: { docId: "d26" }, situacao: "pendente_conferencia",
          campos: [{ campo: "Cadastro", antes: "—", depois: "Em conferência" }], efeito: "Sem gestor designado." },
        { id: "mu3", data: "2026-10-14", contratoId: "c3", tipo: "evento", titulo: "Ofício da contratada pedindo repactuação", origem: { docId: "d16" }, situacao: "evento",
          campos: [], efeito: "Novo evento, sem mudança contratual confirmada." },
        { id: "mu4", data: "2026-10-10", contratoId: "c3", tipo: "designacao", titulo: "Substituição de fiscal técnico", origem: { docId: "d17" }, situacao: "confirmada",
          campos: [{ campo: "Fiscal técnico", antes: "João Pires", depois: "Rafael Moura" }], efeito: "Acesso de João Pires a este contrato encerrado em 09/10/2026." },
        { id: "mu5", data: "2026-09-01", contratoId: "c5", tipo: "cadastro", titulo: "Início da vigência", origem: { docId: "d18" }, situacao: "confirmada",
          campos: [{ campo: "Situação contratual", antes: "Vigência futura", depois: "Vigente" }], efeito: "OIS nº 001/2026 ainda sem assinatura da contratada." },
        { id: "mu6", data: "2026-07-15", contratoId: "c1", tipo: "aditivo", titulo: "1º Termo Aditivo — vigência do Posto Leste", origem: { docId: "d4" }, situacao: "confirmada",
          campos: [{ campo: "Valor vigente", antes: "R$ 12.480.000,00", depois: "R$ 13.104.000,00" }], efeito: "As OIS passaram a incluir o Posto Leste." },
        { id: "mu7", data: "2026-03-10", contratoId: "c2", tipo: "aditivo", titulo: "1º Termo Aditivo — prorrogação", origem: { docId: "d11" }, situacao: "confirmada",
          campos: [{ campo: "Fim da vigência", antes: "14/05/2026", depois: "14/05/2027" }], efeito: "—" },
      ],
      riscos: [
        { id: "r1", contratoId: "c3", severidade: "critica", motivo: "Vigência termina em 31/12/2026 e a prorrogação ainda não foi assinada.", responsavel: "Marcos Viana", prazo: "2026-11-16", providencia: "Assinar a minuta do 2º Termo Aditivo (SEI 0146120)." },
        { id: "r2", contratoId: "c8", severidade: "alta", motivo: "Contrato em conferência sem gestor ou fiscal designado.", responsavel: "Equipe GCR (a definir)", prazo: "2026-11-05", providencia: "Registrar designações com vigência e origem." },
        { id: "r3", contratoId: "c6", severidade: "alta", motivo: "OIS emitida em 02/09/2026 para contrato com vigência encerrada em 31/01/2026 (sem cobertura contratual).", responsavel: "Sem responsável", prazo: "2026-10-31", providencia: "Suspender a execução e verificar a cobertura contratual com o Jurídico." },
      ],
    };
  }

  window.SEI_DATA = {
    TODAY, CCO_COVERAGE_END, CCO_LAST_PULL, REGIOES, ULTIMA_COMP_FECHADA,
    USERS, PROFILES, DESIGNACOES, OPERACAO_ESCOPO, POSTOS, CONTRATOS, DOCUMENTOS, TRECHOS,
    CHECKLISTS: { gcr: CHECKLIST_GCR, limp: CHECKLIST_LIMPEZA },
    INDICADORES,
    CCO: buildCcoSeries(),
    seedState,
  };
})();
