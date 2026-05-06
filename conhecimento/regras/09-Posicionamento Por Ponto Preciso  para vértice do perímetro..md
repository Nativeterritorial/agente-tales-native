# Posicionamento por Ponto Preciso (PPP) em Georreferenciamento de Imóveis Rurais

**Tema:** Uso do método PPP (pós-processamento de ponto único) para levantamento de vértices de perímetro, conforme normas técnicas do INCRA.

## Regras técnicas

- PPP determina as coordenadas dos vértices de interesse de forma **absoluta**, sem necessidade de receptor base com coordenadas conhecidas
- Usa apenas **um aparelho** para levantamento do vértice desejado
- Requer dados GNSS processados (pós-processamento) via serviço do IBGE ou similar
- Aplicável para levantamento de **perímetros** (córregos, serras, limites)
- O INCRA autoriza este método para uso em levantamentos rurais
- Método válido para **limites artificiais ou naturais**, conforme Tabela 6 da norma técnica

## Tolerâncias / valores numéricos

- Diferença máxima para limite artificial: **1,50 m** (tolerância)
- Sigma esperado (após 1 hora): ~70 cm (horizontal), ~60 cm (horizontal), ~4 cm (altitude)
- Sigma esperado (após 6 horas): ~12 cm, ~18 cm
- **Discrepância observada em teste prático:** 1,12 m entre dois resultados (pós-processamento L1/L2 vs. IBGE)

## Pendências comuns / erros do SIGEF

- Uso em **limites artificiais com sigma elevado** — diferença pode aproximar-se da tolerância máxima (1,50 m) — avaliar com cautela ou usar método alternativo
- Sigma alto em processamento curto — aumentar tempo de coleta de dados para reduzir incerteza

## Documentos exigidos

- Relatório de processamento do IBGE (ou outro provedor autorizado)
- Comparação com métodos tradicionais quando limite artificial for crítico

## Observações importantes

- Método agiliza levantamentos de pontos isolados (apenas 1 pessoa em campo)
- Serviço de cálculo PPP disponível pelo IBGE (link fornecido no material complementar)
- Em cursos d'água (limites naturais), tolerância é menos crítica que em limites artificiais
- Sigma do PPP é próximo à tolerância em limites artificiais — exige prudência na aplicação