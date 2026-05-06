# Determinação das Precisões no Georreferenciamento de Imóveis Rurais

**Tema:** Evolução das normas técnicas de precisão posicional do INCRA do georreferenciamento, desde a Portaria 954/2002 até a terceira norma.

## Regras técnicas

- A precisão posicional geral não deve ultrapassar 50 cm (estabelecido na Portaria 954/2002 do INCRA)
- Limites artificiais: máximo de 0,50 m (primeira norma) → mantido na segunda norma → 0,50 m na terceira norma
- Limites naturais (cursos d'água, serras, grotas, acidentes geográficos): até 2,00 m na segunda norma → até 3,00 m na terceira norma
- Limites inacessíveis (áreas com restrição ambiental, unidades de conservação, áreas de preservação, brejos): máximo de 7,50 m (terceira norma)
- A classe C5 (limites naturais) só é admitida para: serras, grotas, cursos de água e limites definidos por acidentes geográficos naturais
- Vértices de limites naturais podem ser implantados como Marco Virtual ou Offset

## Tolerâncias / valores numéricos

| Elemento | Precisão |
|----------|----------|
| Apoio básico (primeira norma) | 10 cm |
| Apoio imediato/poligonal (primeira norma) | 20 cm |
| Levantamento cadastral (primeira norma) | 50 cm |
| Desenvolvimento poligonal (segunda norma) | 40 cm |
| Vértice de limite artificial (todas normas) | 50 cm |
| Vértice de limite natural (segunda norma) | 2,00 m |
| Vértice de limite natural (terceira norma) | 3,00 m |
| Limites inacessíveis (terceira norma) | 7,50 m |
| 1 Sigma | = 0,50 m |

## Pendências comuns / erros do SIGEF

- **Confundimento de precisão em limites naturais** — falta de análise de flutuação do curso de água — técnico deve avaliar se o córrego pode deslocar-se e analisar em imagem se não está caindo em propriedade vizinha
- **Sobreposição em cursos d'água** — uso inadequado da tolerância de 3,00 m — causa: falta de responsabilidade técnica; solução: aplicar método e precisão adequados ao local, não usar automaticamente o máximo permitido
- **Aplicação de precisão genérica** — uso de um único padrão para todos os limites naturais — a terceira norma deixa a especificação técnica a cargo do credenciado; solução: determinar método e precisão conforme características locais

## Documentos exigidos / Marcos legais

- **Lei 10.267/2001** — base legal para georreferenciamento
- **Artigos 176 e 225 da Lei 6.015** — determinam responsabilidade do INCRA
- **Portaria INCRA 954/2002** — estabeleceu primeiro indicador de precisão posicional
- **Decreto 4.449** — estabelece prazos (estudado em aula posterior)

## Observações importantes

- A **terceira norma é mais sucinta** que as anteriores e transfere maior responsabilidade técnica ao profissional credenciado — não detalha especificações, apenas exige conformidade com precisão; o método fica a cargo do credenciado
- A **segunda norma detalha extensivamente métodos de levantamento** (poligonação, triangulação, etc.); a terceira reduz este detalhe
- **RTK foi enfatizado na terceira norma** como método viável (já mencionado na segunda)
- **Vértices virtuais com restrição**: quando originem de levantamento anterior (ex.: imagem/ortofoto), herdam a precisão do método original, não automaticamente 7,50 m
- Maior tolerância para limites naturais (3,00 m na terceira) busca equilibrar a dificuldade prática de levantamento em terrenos com risco de flutuação de cursos d'água