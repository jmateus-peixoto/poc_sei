# Gestão Contratual SEI — protótipo

Protótipo navegável da plataforma de gestão contratual integrada ao SEI, construído a partir do documento
`PLATAFORMA_GESTAO_CONTRATUAL_SEI.md` (v1.0, 26/10/2026) e seguindo o padrão visual do protótipo WES HUB 360
(menu lateral recolhível, topbar com busca, tema claro/escuro e notificações, `.section`, cartões de resumo,
tabelas em linhas-cartão e pílulas de status). Desde o alinhamento de 27/10/2026 usa as cores da POC "Agente Executivo SEI"
(azul #19639A, ciano #0098C4, verde, âmbar e vermelho da mesma paleta), cartões coloridos nos painéis e tabelas com cabeçalho azul, no padrão das grades do SEI.

Todos os dados são fictícios. SEI e CCO são simulados; nada é enviado a sistemas externos.

## Como abrir

```bash
python3 -m http.server 8140
```

Depois acesse http://localhost:8140, entre com os dados já preenchidos (o login é simulado e aceita qualquer e-mail e senha) e escolha um perfil. Para voltar ao estado inicial, use
**menu do usuário › Restaurar dados de exemplo**.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Login, seleção de perfil e shell (menu, topbar, assistente, toast). |
| `styles.css` | Tokens (claro/escuro) e componentes no padrão do Hub360. |
| `data.js` | Contratos, documentos SEI, designações, série diária do CCO e estado inicial. |
| `core.js` | Estado (localStorage), escopo por perfil, componentes, cálculos, roteador e shell. |
| `shared.js` | Ficha do contrato com abas, pendências, prontidão de itens e revisão por aditivo. |
| `super.js` | Superintendência: visão geral, contratos, mudanças e aditivos, riscos, relatórios. |
| `gestor.js` | Gestor/Fiscal: meus contratos, preparação guiada em 4 etapas, De acordo, itens, documentos, pendências, histórico. |
| `operacao.js` | Operação: fila de trabalho, itens, indicadores e cobertura, fiscalização, ocorrências, medições e evidências. |

## Roteiro sugerido

1. **Superintendência** — veja os cartões de "Indicadores para decisão" e a tabela com valor total, executado e saldo.
   Em *Contratos*, use **Cadastrar pelo processo SEI** (consulta simulada que marca o que veio do SEI e o que é manual)
   e abra a aba **Financeiro** de um contrato para ver as notas mês a mês.
2. **Gestor/Fiscal** — em *Meus contratos*, clique no ícone **Iniciar acompanhamento** (▶, coluna Ação) do CT 019/2026: confira os documentos,
   revise as obrigações com o painel de origem, configure um item e dê o **De acordo**. Depois, em *Aprovações*,
   revise a alteração do 2º Termo Aditivo do CT 022/2025. Tente abrir `#/gestor/contrato/c4`: o acesso é bloqueado.
3. **Operação** — no painel da *Visão operacional*, veja postos com problema, situação por indicador, a pizza e o
   ranking de postos; filtre por **Região** (7 regiões, um contrato por região). Abra o TME do Posto Norte (set/2026)
   para ver a memória de cálculo e a glosa estimada. Continue a inspeção F-0105 com a opção “Simular sem conexão”.

## O que está simulado

- Consulta e vínculo ao SEI, coleta do CCO (D-1), assistente e juntada de PDF ao processo SEI. Os relatórios em CSV e PDF são gerados de verdade no navegador (o PDF usa a biblioteca jsPDF, carregada da internet no primeiro uso).
- Validação de medições pelo responsável competente (botão identificado como simulação).
- Notas de cobrança, valor executado e saldo: gerados de forma fixa a partir do valor e da vigência de cada contrato.
- Cadastro pelo número do processo SEI: a consulta devolve uma sugestão fictícia; o contrato cadastrado fica salvo no navegador.
- Fotos de inspeção ficam só na sessão atual do navegador; o estado das demais ações fica no `localStorage`.
