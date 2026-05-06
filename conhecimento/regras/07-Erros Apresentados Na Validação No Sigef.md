# Erros de Validação em Planilhas SIGEF

**Tema:** Identificação e correção de erros detectados pelo SIGEF na validação de planilhas para certificação

## Regras técnicas

- A primeira coordenada listada na planilha deve ser a coordenada mais ao norte e mais a oeste
- Código de imóvel deve conter exatamente 13 números (13 algarismos)
- Coordenadas devem ter no máximo 2 casas decimais após a vírgula
- Quando um vértice já existe na base de dados com as mesmas coordenadas, é obrigatório usar o código dele, não criar um novo
- Em desmembramentos, verificar qual limite (LN1, cerca, etc.) realmente separa cada parcela — não pode estar invertido entre as planilhas das duas glebas
- CPF, nomes de parcelas e perímetros devem estar corretos antes de envio

## Tolerâncias / valores numéricos

- Distância máxima entre coordenada e município: **até 50 metros é alerta; acima de 50-60 km é erro**
- Diferença de altitude: até ~8 cm é tolerável; acima disso deve-se verificar qual valor está correto e alinhar com vizinhos/colegas
- Sigma (precisão de posicionamento): verificar manual técnico; vértices fora da tolerância sigma causam erro

## Erros comuns do SIGEF

| Erro | Causa | Solução |
|------|-------|---------|
| Código de imóvel não encontrado | Código inibido, cancelado ou inventado | Verificar base de dados; validar numeração |
| Coordenada fora do domínio com mais casas decimais | Mais de 2 casas decimais | Reduzir para 2 casas decimais |
| Polígono inválido / lado externo inválido | Número de parcela ou perímetro escrito errado (ex: "1" em vez de "01"; "2" em vez de "002") | Corrigir zeros à esquerda na planilha |
| Vértice com altitude diferente | Diferença com colega que compartilha mesmo vértice | Conferir qual está correto; usar altitude do colega se diferença pequena |
| Limite (LN1, cerca, etc.) invertido em desmembramento | Trocou qual limite vai em qual direção entre duas parcelas | Verificar na planta; corrigir na planilha qual limite realmente separa cada gleba |
| Vértice existe com mesmas coordenadas mas código diferente | Usou coordenada própria em vez do código já existente | Usar o código do vértice já registrado na base |
| Precisão fora da tolerância (sigma) | Posicionamento inadequado | Consultar manual técnico; reposicionar ponto se necessário |

## Observações importantes

- O SIGEF valida planilhas em etapas: detecta um erro, o usuário corrige e reenvia; então apresenta o próximo erro. Pode apresentar vários erros simultâneos na mesma varredura
- Alertas (distância pequena ao município) não impedem envio; **erros (distância > 50-60 km) impedem**
- Se a planilha foi corrigida mas a coordenada não coincide exatamente com o resultado da auditoria posterior, prevalece o resultado da análise de processamento do SIGEF, não a edição manual
- Distâncias até ~7,9 km podem ser alertas; acima disso ou com grande diferença de altitude, verificar se imóvel/parcela está realmente no município/gleba corretos