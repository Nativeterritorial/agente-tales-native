# Órbitas de Satélites GPS e Efemers para Processamento de Dados

**Tema:** Tipos de órbitas GPS disponíveis, suas características, latências e como baixá-las para processamento de levantamentos georreferenciados.

## Regras técnicas

- As efemers (órbitas) são transmitidas continuamente pelos satélites GPS e contêm parâmetros de identificação, posição, data, hora, precisão de relógios e informações de órbita
- O dia Juliano e a semana GPS são necessários para localizar e baixar as efemers corretas
- Comparar coordenadas obtidas das mensagens de navegação GPS com as efemers precisas do IGS é o método para avaliar a qualidade das efemers antes de processar

## Tipos de órbitas disponíveis

| Tipo | Sigla | Latência | Frequência | Uso |
|------|-------|----------|-----------|-----|
| Ultra rápidas | IGU | 3 a 9 horas | 4 vezes/dia | Processamentos urgentes (contém dados preditos e observados) |
| Rápidas | IGR | 17 a 41 horas | Disponível no dia seguinte | Processamento no dia seguinte ao levantamento |
| Finais | IGS | 12 a 18 dias | Após coleta | Maior precisão, não é viável para prazos curtos |

## Tolerâncias / valores numéricos

- Diferença de precisão das efemers transmitidas vs. precisas (IGS): 5 a 50 cm

## Documentos/recursos exigidos

- Calendário Juliano da IERS/USNO — necessário para identificar o dia Juliano e a semana GPS
- Semana GPS — informação obrigatória ao baixar efemers em alguns sites

## Observações importantes

- Se o processamento apresentar problemas, baixar novamente as efemers pode resultar em precisão melhorada
- Em caso de dúvidas sobre qual efeméride usar, consulte o suporte do curso