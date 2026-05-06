# Consulta e Organização de Dados CAFIR da Receita Federal

**Tema:** Procedimento prático para baixar, organizar e formatar dados de CIB/NIRF do CAFIR (Cadastro de Imóveis Rurais Federais) através dos dados abertos da Receita Federal.

## Regras técnicas

- Acessar dados CAFIR pelo site receita.fazenda.gov.br → menu lateral → Acesso a Informação → Dados Abertos → Consulta Cadastro CAFIR
- Baixar obrigatoriamente os dois arquivos de layout antes de processar os dados — eles contêm as especificações técnicas das colunas
- O CIB (número do imóvel) possui sempre **8 dígitos** (pode vir com zeros à esquerda)
- O código INCRA (número do imóvel INCRA) possui sempre **13 dígitos**
- A área do imóvel não tem quantidade fixa de dígitos — varia conforme a metragem
- Usar "Texto para Colunas" com opção **largura fixa** para separar dados desorganizados em colunas específicas
- Os dados vêm em formato TXT delimitado (por tabulação ou vírgula) — pode ser baixado direto ou copiado/colado de visualizador web em editor de texto
- Importar arquivo TXT no Excel escolhendo opção **delimitado** (não largura fixa) na importação inicial
- Após separar colunas, formatar células numéricas com formato personalizado "0" para eliminar problemas de visualização de zeros à esquerda
- Usar função **CONCATENAR** para unir colunas de texto quando necessário recombinar campos
- Organizar dados finais por: **Estado (ordem alfabética) → Município (ordem alfabética dentro do estado)**

## Tolerâncias / valores numéricos

- Não aplicável nesta aula

## Pendências comuns / erros do SIGEF

- CIB aparentando estar "errado" por ter menos de 8 dígitos → Na verdade possui zeros à esquerda; formatar como "0" resolve
- Dificuldade em separar nome do imóvel fragmentado em múltiplas colunas → Usar CONCATENAR para unir colunas necessárias
- Situação de imóvel desconhecida (ex: 52, 56) → Consultar tabela de situações fornecida no layout para decodificar

## Documentos exigidos

- Layout CAFIR (arquivo de especificação de colunas) — obrigatório antes de processar dados
- Arquivo de dados CAFIR em formato TXT (10 partes disponíveis; podem ser baixadas parcialmente ou todas)

## Observações importantes

- Os arquivos de dados são muito pesados (>1 milhão de registros) — carregar em planilha única demanda tempo e recursos
- Recomenda-se separar dados por estado e depois por município para facilitar buscas futuras e otimizar performance
- Todos os 10 arquivos de partes devem ser consultados se o imóvel não for encontrado na primeira — não há ordem alfabética entre eles
- Exemplo de decodificação: situação "52" = cancelamento por anexação total; "56" = cancelamento por desapropriação pelo poder público
- O preenchimento de zeros à esquerda no CIB (ex: "1058" = "00001058") é normal e não indica erro — confirmável através de certidão negativa de imóvel
- Possível importar dados via visualizador web (copiar/colar em Bloco de Notas) se download direto falhar