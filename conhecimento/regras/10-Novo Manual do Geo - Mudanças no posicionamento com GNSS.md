# Posicionamento em Georreferenciamento de Imóveis Rurais (INSS e Topografia)

**Tema:** Métodos de posicionamento para levantamento de coordenadas de vértices em imóveis rurais, incluindo INSS, topografia clássica e projeção técnica.

## Regras técnicas

- **PPP-RTK:** Método de posicionamento por ponto preciso em tempo real via rede geodésica global; dispensa instalação de base local, necessita apenas um receptor no nível de usuário
- **Estação Livre (PT9):** Coordenadas determinadas a partir de distâncias ou direções em relação a dois ou mais pontos de apoio conhecidos (levantados por GPS); também chamado de intersecção a ré; permite escolher livremente o local de estacionamento do instrumento desde que haja visibilidade a pelo menos 2 pontos conhecidos
- **Projeção Técnica (PA3):** Determinação de coordenadas virtuais através de projeção de ângulos e distâncias contidas em certidão de imóvel ou peças técnicas analógicas; **só pode ser empregada em locais inacessíveis quando não for possível aplicar outro método de posicionamento**
- **Sensoriamento Remoto:** Aplicável para: reconstituição de imóveis inundados por reservatórios; definição de vértices em linhas não coincidentes com limites visíveis; regiões de relevo escarpado; áreas com proibição de acesso por legislação ambiental

## Documentos exigidos por método

**INSS/RTK:**
- Arquivos brutos em formato RINEX nativo (ou dispensáveis conforme manual)
- Arquivos de registro de dados de INSS RTK (arquivos de trabalho)
- Relatório de processamento de posicionamento

**Topografia Clássica (Estação Total):**
- Caderneta de campos (digital ou analógica)
- Relatório de processamento de dados

**Projeção Técnica:**
- Cópia da certidão de imóvel (com ângulos e distâncias)
- Peça técnica analógica (quando for a única referência geométrica)

## Observações importantes

- O manual apresenta ambiguidade quanto à inclusão/exclusão de arquivos RTK na seção de INSS — há dupla interpretação não resolvida
- A projeção técnica é método subsidiário, só deve ser usado quando outros métodos não são viáveis
- Estação livre oferece vantagem operacional ao permitir escolher livremente o ponto de estacionamento