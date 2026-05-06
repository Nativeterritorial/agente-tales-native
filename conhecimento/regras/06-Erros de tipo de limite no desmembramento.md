# Erro de Tipo de Limite no SIGEF

**Tema:** Identificação e correção do erro de tipo de limite em polígonos de desmembramento no SIGEF.

## Regras técnicas

- O tipo de limite deve ser **idêntico nos dois lados** de um mesmo segmento de divisa (sentido horário e anti-horário)
- Ao percorrer o perímetro em sentido horário, o tipo de limite informado deve corresponder ao tipo de limite real no terreno
- Se um segmento é uma cerca no sentido de ida, deve ser cerca também no sentido de volta
- Se há mais de um polígono adjacente compartilhando o mesmo limite, todos devem informar o **mesmo tipo de limite** para esse segmento
- A planilha de desmembramento só pode conter erro de sobreposição (aceitável); outros tipos de erro indicam problemas na vetorização ou classificação

## Pendências comuns / erros do SIGEF

- **Erro: tipo de limite inconsistente** — Causa: classificação diferente do mesmo segmento em sentidos opostos ou entre polígonos adjacentes — Solução: verificar cada vértice acusado no erro, confrontar com a planta e corrigir o tipo de limite na planilha para consistência
- O SIGEF aponta o erro listando todos os segmentos afetados (pode aparecer 4 vezes se há 2 segmentos com problema)

## Método de correção

- Anotar no papel todos os pares de vértices que o sistema acusa como erro
- Consultar a planta visual (georeferenciamento) para determinar o tipo de limite **verdadeiro** em campo
- Corrigir a planilha apenas na(s) célula(s) correspondente(s)
- Reenviar; o único erro esperado é sobreposição

## Observações importantes

- Se houver dúvida, contactar suporte do SIGEF com a planilha para análise