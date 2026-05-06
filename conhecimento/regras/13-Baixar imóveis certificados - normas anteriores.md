# Baixar Geometria de Imóveis Certificados (SNCI) via SIGEF

**Tema:** Procedimento passo a passo para download de geometrias de imóveis certificados pelo SNCI através do portal do INCRA.

## Regras técnicas

- Acessar o portal fundiário INCRA via certificado digital (gov.br)
- Utilizar a opção **i3g Incra** para localizar imóveis certificados (evita problemas com disponibilizador de coordenadas indisponível)
- Informar coordenadas de busca no formato: latitude (ex.: -16) e longitude (ex.: -49) para localizar imóveis próximos
- Buscar pelo **número de certificação SNCI** no disponibilizador de coordenadas
- Download do arquivo em formato **CSV** contendo a geometria
- O arquivo CSV baixado **não inclui**: numeração de vértices, Sigma, altitude

## Dados inclusos no CSV baixado

- Coordenadas dos vértices (do levantamento original)
- Informações principais do imóvel

## Dados NÃO inclusos (necessários complementar)

- Numeração de vértices
- Sigma (desvio-padrão)
- Altitude

## Pendências comuns / erros do SIGEF

- **Disponibilizador de coordenadas indisponível** — problema recorrente do site — usar **i3g Incra** como alternativa
- **URL do disponibilizador muda frequentemente** — pesquisar no Google em vez de guardar link fixo

## Fluxo para complementar a geometria

Se o imóvel foi certificado por terceiro (não pelo próprio profissional):
1. Obter numeração de vértices da certidão ou mapa original
2. Realizar levantamento próprio para obter Sigma e altitude
3. Usar as coordenadas do CSV como referência

## Softwares compatíveis com CSV

- Posição
- Métrica
- Topocad 2000
- Geoice
- Data Geis