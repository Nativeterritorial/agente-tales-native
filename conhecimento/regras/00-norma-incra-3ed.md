# Norma Técnica INCRA 3ª Edição — Regras Aplicáveis

## Documentos Vinculantes
- A norma deve ser aplicada em conjunto com o **Manual Técnico de Limites e Confrontações** e o **Manual Técnico de Posicionamento** publicados pelo INCRA.
- As prescrições destes manuais, quando citadas, têm caráter de **determinação obrigatória**.
- Aplicação **indistinta** para imóveis públicos e privados.

## Identificação do Imóvel Rural
- A identificação se dá pela correta descrição dos limites (art. 176, §3º, Lei 6.015/73).
- Limites descritos por **segmentos de reta interligados por vértices**.
- Cada vértice deve ser descrito por seu **código** e **valores de coordenadas**.
- O imóvel rural considerado é aquele objeto do título de domínio ou aquele passível de titulação (incluídos limites de respeito em ocupações rurais tituláveis).

## Codificação do Vértice
Estrutura do código alfanumérico inequívoco (não pode haver repetição entre imóveis distintos):
- **4 primeiros caracteres**: código do credenciado responsável pelo posicionamento.
- **5º caractere**: tipo do vértice (definido no Manual de Limites e Confrontações).
- **Caracteres seguintes**: sequência de números inteiros incrementais.
- Não pode haver repetição de número em vértices do mesmo tipo e do mesmo credenciado.
- Credenciados com codificação antiga de **3 dígitos permanecem** com os mesmos.

## Tipos de Vértice e Tipos de Limite
- Tipos de vértices definidos no Manual Técnico de Limites e Confrontações.
- Tipos de limites e suas codificações também definidos no Manual Técnico de Limites e Confrontações.

## Sistema de Referência
- Coordenadas referenciadas ao **SGB vigente na época da submissão**.
- Atualmente: **SIRGAS2000** (Resolução nº 01, de 25/02/2005, do IBGE).
- Coordenadas descritas em **coordenadas geodésicas (φ, λ, h)** vinculadas ao SGB.
- Determinação executada conforme o Manual Técnico de Posicionamento.

## Precisão Posicional
- Refere-se à **precisão posicional absoluta** (vinculada ao SGB, com propagação de covariâncias).
- Cálculo da **precisão posicional planimétrica (horizontal)**:
  - **σP = √(σφ² + σλ²)**
  - Em metros (σφ, σλ, σh devem ser convertidos de angular para linear).
  - **Desconsidera-se σh** (desvio padrão da altitude) no cálculo.

### Padrões de precisão posicional (vértices definidores de limite)
- **Limites artificiais**: σP **≤ 0,50 m**.
- **Limites naturais**: σP **≤ 3,00 m**.
- **Limites inacessíveis**: σP **≤ 7,50 m**.

## Cálculo de Área
- Deve ser realizado com base em **coordenadas referenciadas ao Sistema Geodésico Local (SGL)**.
- Conversão entre coordenadas cartesianas geocêntricas e locais conforme Manual Técnico de Posicionamento.
- SGL: sistema cartesiano com eixos (e, n, u); "n" → norte geodésico; "e" → leste, perpendicular a "n"; "u" → coincidente com a normal ao elipsoide no vértice de origem.

## Credenciamento
- Obrigatório para requerer certificação (art. 176, §5º, Lei 6.015/73, alterado pela Lei 11.952/2009).
- Apenas profissional **habilitado pelo CREA** para serviços de georreferenciamento de imóveis rurais pode ser credenciado.
- Procedimento: preenchimento de **formulário eletrônico** com envio de **certidão do CREA** conforme **Decisão PL-0745/2007** do CONFEA (ou instrumento vigente).
- Após credenciamento, o profissional recebe o **código de credenciado** (4 caracteres usados na codificação dos vértices).

## Responsabilidade Técnica do Credenciado
- Correta identificação do imóvel (art. 176, §3º, Lei 6.015/73), observando:
  - **Exatidão de limites** (limites do título e limites de respeito quando aplicável).
  - **Informações posicionais** (coordenadas geodésicas com respectivas precisões σφ, σλ, σh) de **todos** os vértices de limite.

## Gestão da Certificação
Operacionalizada em ato normativo específico, contemplando:
- Desmembramento / Parcelamento.
- Remembramento.
- Retificação de certificação.
- Cancelamento de certificação.
- Análise de sobreposição.
- **Sanções ao credenciado** (definidas em ato normativo próprio).