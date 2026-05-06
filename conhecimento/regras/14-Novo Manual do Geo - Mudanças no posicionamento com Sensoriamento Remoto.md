# Posicionamento por Sensoriamento Remoto (INCRA/SIGEF)

**Tema:** Metodologias e requisitos técnicos para levantamento de imóveis rurais por aerofotogrametria e sensores orbitais, incluindo produtos cartográficos, pontos de controle/checagem e uso de base cartográfica.

## Regras técnicas

- GSD (Ground Sample Distance) deve ser compatível com a feição a ser identificada, respeitando a precisão do tipo de limite
- Utilizar pontos de checagem proporcionais à área, geometria e relevo (não há mínimo obrigatório; antes era 20 pontos)
- Pontos de controle não devem ser utilizados como pontos de checagem
- A classe resultante do cálculo do Padrão de Exatidão Cartográfica (PEC) deve estar adequada à precisão exigida para o tipo de limite
- Para vértices com coordenadas obtidas por fotogrametria, o valor de precisão posicional será expresso em RMS
- Orto mosaicos e ortofotocartas são utilizáveis apenas quando há feições foto identificáveis (cercas, muros, estradas, ferrovias, cursos de água)
- Modelos Digitais de Terreno (MDT), Modelos Digitais de Superfície (MDS) e curvas de nível podem ser combinados para feições naturais de difícil definição
- Aerofotogrametria agora é permitida para determinar limites por cerca e mudanças de confrontação (novidade)
- Base cartográfica deve ser produzida por órgãos públicos ou exceções específicas (empresas gestoras de hidrelétricas, ferrovias)
- Base cartográfica de entes privados credenciados não é aceita
- Coordenadas de extremidades de feições (início/término de cursos d'água, p. ex.) devem ser determinadas de forma direta (levantamento em campo)
- Base cartográfica sem precisão conhecida restringe-se a feições de difícil identificação
- Limites municipais representados em base cartográfica sem precisão conhecida podem ser utilizados quando coincidirem com os vértices da parcela
- Prioridade de base cartográfica: órgãos estaduais > IBGE (Divisão Política Administrativa)

## Tolerâncias / valores numéricos

- Limite artificial: 50 cm
- Limite de cerca: 3 m
- Limites naturais/inacessíveis: 7 m
- GSD: expresso em centímetros por pixel (ex.: 20 cm/pixel)
- Precisão posicional: valor de RMS obtido no processamento de orto retificação

## Documentos/produtos exigidos

- Imagens orbitais ou aéreas referenciadas e orto retificadas
- Relatório de processamento do levantamento aéreo
- Relatório de processamento de pontos de controle (quando utilizados)
- Monografias dos pontos de checagem (quando utilizados)
- Relatório de controle de qualidade posicional
- Avaliação da couraça posicional absoluta
- Licença, habilitação e homologação de órgãos reguladores
- Anotação de Responsabilidade Técnica (ART)
- Base cartográfica utilizada
- Modelo Digital do Terreno (quando aplicável)

## Observações importantes

- **Diferença: ponto de controle vs. ponto de checagem**
  - Ponto de controle: alvo foto identificável com coordenadas obtidas por GPS de precisão; utilizado no processamento para melhorar parâmetros matemáticos
  - Ponto de checagem: alvo foto identificável; não é usado no processamento; serve para validação estatística da acurácia posicional

- Produtos obtidos por aerofotogrametria: orto mosaico, ortofotocar, modelo digital de terreno, modelo digital de superfície, curvas de nível

- Base cartográfica com precisão conhecida (de órgão público) permite uso em todos os tipos de feições; sem precisão conhecida restringe-se a feições de difícil identificação

- Recomendação: utilizar bases cartográficas produzidas por órgãos estaduais (GC, Instituto Mauro Borges, Instituto João Pinheiro); na falta, usar IBGE

- Houve mudanças significativas entre a Norma de Execução 2/2018 e versão atual, especialmente quanto à flexibilidade de pontos de checagem e permissão de aerofotogrametria em limites por cerca