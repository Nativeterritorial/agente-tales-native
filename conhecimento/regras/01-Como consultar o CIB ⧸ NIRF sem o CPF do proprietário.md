# Consulta e Organização de Dados CAFIR na Receita Federal

**Tema:** Procedimento para baixar, processar e organizar dados do CAFIR (Cadastro de Imóveis Rurais) da Receita Federal para pesquisa de CIBs sem CPF do titular.

## Regras técnicas

- Acessar dados CAFIR através do site receita.fazenda.gov.br > menu lateral > Acesso a Informação > Dados Abertos > Consulta Dados CAFIR
- Baixar primeiramente os dois arquivos de layout (explicações de estrutura dos dados)
- Os arquivos de dados estão divididos em 10 partes — podem ser baixados separadamente ou em conjunto
- Arquivos podem vir em formato TXT ou PDF; se não abrir diretamente, copiar e colar conteúdo em bloco de notas
- Abrir arquivo TXT no Excel usando opção "Delimitados" (não largura fixa, pois dados não têm largura consistente)
- Ao formatar números com zeros à esquerda (ex: CIB com menos de 8 dígitos), usar formato de célula "Número > Personalizado > 00000000" para padronização
- Separar colunas desorganizadas usando função Excel: Dados > Texto para Colunas > Largura Fixa
- Usar função de concatenação para unir colunas quando necessário
- Consultar layout para confirmar quantidade de dígitos: CIB = 8 dígitos | Código INCRA = 13 dígitos | Datas/CEP = 8 dígitos

## Estrutura de dados CAFIR (colunas padrão)

- Coluna A: CAFIR + CIB (8 dig.) + Código INCRA (13 dig.) + Área do imóvel + Nome do imóvel
- Coluna B: Continuação do nome do imóvel
- Coluna C: Situação e endereço
- Coluna D: Continuação do endereço
- Coluna E: Continuação do endereço
- Coluna F: Zona rural
- Coluna G: Município e Estado
- Coluna H: Continuação do município/estado
- Coluna I: CEP + Data de inclusão + Imunidade (sim/não) + Situação no INCRA

## Códigos de situação do imóvel (INCRA)

- 02 = Ativo
- 49 = Cancelado (motivos diversos)
- 52 = Cancelado por Anexação Total
- 56 = Cancelado por Desapropriação pelo Poder Público
- Códigos de imunidade e vinculação também disponíveis no layout

## Organização recomendada

- Separar dados por estado (facilita busca)
- Dentro de cada estado, ordenar alfabeticamente por município
- Opcionalmente: se trabalha em estado específico, extrair apenas município de interesse
- Manter arquivo com referência de layout para consultas de significado de códigos

## Observações importantes

- Arquivo completo contém ~1.137.000 imóveis — arquivo muito pesado, demora para carregar
- CIBs com zeros à esquerda não são erro — o zero faz parte da numeração (ex: 1058 é válido mesmo com menos de 8 dígitos visíveis)
- Após formatar, validar dados consultando certidão de imóvel no sistema para confirmar correspondência de nome, município e área
- Área em hectares pode ter casas decimais variáveis — não tem formato fixo