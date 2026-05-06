# Codificação de Vértices em Georreferenciamento de Imóveis

**Tema:** Estrutura e evolução das regras de codificação de vértices nas normas técnicas do INCRA/SIGEF

## Definição de vértice

- Vértice é todo ponto onde a linha limite do imóvel muda de direção
- Vértice é todo ponto onde existe interseção da linha limite com qualquer outra linha limítrofe (rodovia, ferrovia, curso d'água, etc.)
- Vértice também ocorre quando muda o tipo de confrontação (ex: de cerca para ponte)

## Tipos de vértice

| Código | Tipo | Definição |
|--------|------|-----------|
| M | Marco | Ponto materializado e implantado em campo |
| P | Ponto | Ponto levantado em campo, não implantado |
| V | Virtual | Ponto originado de cálculo (paralelas, interseções de retas) |
| O | Offset | Ponto originado de offset (introduzido na 2ª Norma) |

## Estrutura de codificação por norma

### 1ª e 2ª Normas
- Campos 1–3: Código do credenciado (3 caracteres)
- Campo 4: Tipo de vértice (M, P, V, O)
- Campos 5–7: Numeração sequencial (001 a 999)
- Ao atingir 999, passa para A001, A999, depois B001, etc.
- Numeração independente por tipo (M001-M999, P001-P999, V001-V999, O001-O999)

### 3ª Norma (atual)
- Campos 1–4: Código do credenciado (4 caracteres — letras e números)
- Campo 5: Tipo de vértice (M, P, V, O)
- Numeração sequencial: 0001, 0002... 9999, 10000, 10001... (sem retorno a letras)
- Numeração **NÃO diferenciada** por tipo (sequência contínua)

## Regras de numeração

- Numeração sequencial deve ser **global e contínua** por credenciado, para evitar reutilização de códigos em diferentes imóveis
- Cada credenciado mantém registro próprio e não pode repetir códigos entre imóveis que já certificou
- Na 3ª Norma, o sistema impede entrada de letras na numeração (somente dígitos)

## Compatibilidade com imóveis já certificados

- Ao georreferenciar imóvel contíguo a imóvel já certificado, deve-se **respeitar e reutilizar** a numeração dos vértices comuns já implantados
- Aplica-se também a vértices tipo P e V comuns
- Se vértice virtual comum não for aceito, pode-se solicitar correção ao colega credenciado ou análise do INCRA para cancelamento

## Observações importantes

- Vértices virtuais não são materializados, mas são levantados e originam linhas (paralelas, interseções)
- Mudança de tipo de confrontação exige novo vértice, mesmo sem mudança de direção
- A carteira física do credenciado foi substituída pelo SIGEF — código agora consta no sistema