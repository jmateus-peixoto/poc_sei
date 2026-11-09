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

## Primeira versão (reuniões de 05/11/2026)

Depois do documento GCR → T7 de 04/11/2026, o protótipo passou a ter dois perfis:

- **Diretoria DSC** (rotas `super/…`): o Diretor vê tudo o que entra na caixa DSC, mesmo o que não precisa da assinatura dele, e recebe alertas. Não há etapa de aprovação nova.
- **Equipe GCR** (rotas `gestor/…`): curadoria da caixa: classifica entradas, vincula contratos, atribui responsáveis, registra prazos, evidências e cobranças.

Entram no P1: **Caixa DSC** (R06), **Radar de exceções** (R15), **OIS** (R05, sem medição e pagamento) e
**vencimentos, aditivos e reajustes** (R02). Ficam fora desta versão, com o código mantido: medições e glosas, o perfil Operação
(fiscalização, indicadores, ocorrências) e o fluxo de preparação e De acordo do gestor.

O limite de dias para um processo contar como **parado** fica em **menu do usuário › Regras do controle** (30 dias por padrão).
Os dois perfis podem alterar, e o valor vale para todos.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Login, seleção de perfil e shell (menu, topbar, assistente, toast). |
| `styles.css` | Tokens (claro/escuro) e componentes no padrão do Hub360. |
| `data.js` | Contratos, documentos SEI, designações, série diária do CCO e estado inicial. |
| `core.js` | Estado (localStorage), escopo por perfil, componentes, cálculos, roteador e shell. |
| `dsc.js` | Caixa DSC, Radar de exceções e OIS (regras e telas dos dois perfis). |
| `shared.js` | Ficha do contrato com abas, pendências, prontidão de itens e revisão por aditivo. |
| `super.js` | Telas da carteira dos dois perfis: visão geral (painel do Diretor), contratos, mudanças e aditivos, relatórios. |
| `gestor.js` | Ficha e histórico da Equipe GCR. O fluxo de preparação e De acordo continua aqui, fora do menu (P2). |
| `operacao.js` | Operação (fase 2, fora da seleção de perfil): itens, indicadores, fiscalização, ocorrências, medições e evidências. |

## Roteiro sugerido

1. **Diretoria DSC** — na *Visão geral*, veja o que está "Aguardando o Diretor", o resumo do Radar, a OIS do mês e os aditivos
   e reajustes em andamento. Na *Caixa DSC*, filtre "Com o Diretor agora" e abra a OIS nº 042/2026. Entradas novas aparecem marcadas
   até serem abertas.
2. **Radar** — abra o Ofício da Casa Civil (prazo legal vencido, sem responsável) e a OIS nº 007/2026, emitida para um contrato com
   vigência encerrada. Cada item mostra problema → evidência → risco → responsável → próxima ação → prazo → cobranças.
3. **Ficha do contrato** — no CT 031/2024, veja a linha do tempo, os prazos e os alertas; na aba *Documentos e fontes*, as fontes
   confirmadas e os documentos por categoria.
4. **Equipe GCR** — na *Caixa DSC*, classifique o memorando da DAF (sem classificação) e registre uma cobrança para a Prefeitura de Vale.
   No CT 041/2026, aba *Responsáveis*, informe o responsável que falta.

## O que está simulado

- Consulta e vínculo ao SEI, coleta do CCO (D-1), assistente e juntada de PDF ao processo SEI. Os relatórios em CSV e PDF são gerados de verdade no navegador (o PDF usa a biblioteca jsPDF, carregada da internet no primeiro uso).
- Leitura da caixa DSC: as 15 entradas, as OIS, os aditivos e os reajustes são fictícios. A cobertura da caixa não foi conferida com o SEI-SP.
- Notas de cobrança, valor executado e saldo: gerados de forma fixa a partir do valor e da vigência de cada contrato.
- Cadastro pelo número do processo SEI: a consulta devolve uma sugestão fictícia; o contrato cadastrado fica salvo no navegador.
- Fotos de inspeção ficam só na sessão atual do navegador; o estado das demais ações fica no `localStorage`.
