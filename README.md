# Virtual Tunel By Mifael

Bem-vindo ao **Virtual Tunel**, uma plataforma visual web de altíssima fidelidade para testes e simulações aerodinâmicas rudimentares utilizando cálculos computacionais da Dinâmica dos Fluidos (CFD).

Esta ferramenta foi desenhada para trazer para os navegadores tecnologias outrora restritas a pacotes científicos acadêmicos, permitindo testar cruzamento de ventos, mapeamento de estagnação e esteiras de descolamento de vórtices em malhas tridimensionais, tudo com um design belíssimo (*Kinetic Blueprint*).

## Estrutura do Sistema

O projeto adota uma arquitetura descentralizada de alto-desempenho:

- **Frontend (`/frontend`)**: Uma aplicação WebGL impulsionada por `Three.js` e Vite. Substitui renderizações CPU-bound por um *"Transient CFD Player"* desenhado diretamente na GPU. O Frontend foi calibrado para usar Tone Mapping Cinematográfico ACESFilmic para lidar com os reflexos físicos do ambiente de laboratório.
- **Backend (`/backend`)**: Um servidor assíncrono em `FastAPI`/Python que atua como o motor RANS-CFD aproximado. Ele recebe a topologia tridimensional dos Modelos (`PyVista/NumPy`), computa limites aerodinâmicos, pressões, cálculos paramétricos de arrasto (Drag) versus Força Descendente (Downforce), e resolve as coordenadas das Pathlines do vento e vetores rotativos para retorno à tela gráfica via JSON.

## Funcionalidades Aerodinâmicas
1. **Simulação de Túnel Temporal em Looping**: Controle sobre `Loop Duration` e Carga Relacional (Resolução Numérica ou `Paths`).
2. **Yaw (Vento Lateral)**: Gire a estrutura da malha até ±180º graus em relação ao vento para aferir impacto de ventanias cruzadas. Os vértices são rotacionados numericamente no backend antes do contato com a matriz de ar virtual.
3. **Heatmap & Coloração Absoluta**: A velocidade das partículas baseia-se na `Norma L2 da Velocidade (||U||)` local, decaindo de Ciano (High-Speed Freestream) para Escarlate/Vermelho (Stagnation Layers/Impacto).
4. **Vórtex Cilíndrico de Esteira**: Analiticamente derivados das coordenadas limite em -X da malha.

## Instalação e Execução Inteligente (Recomendado)

Disponibilizamos um rotina automatizada (`start.ps1`) para que o laboratório levante ambos os terminais e aponte no seu navegador instantaneamente sem burocracia.

### Requisitos:
* Python 3.10+
* Node.js v18+

### Como Inicializar

Abra o prompt de comando ou PowerShell na pasta raiz (onde este README está localizado) e execute:

```powershell
.\start.ps1
```

Esse script irá:
1. Reativar e embutir na porta `8000` o seu backend físico de maneira oculta.
2. Agendar e servir as instâncias React/Vite localmente na porta `5173`.
3. Injetar direto na sua tela padrão a instância com modelo já posicionado (Mustang 13.04.2021).
4. Permitirá derrubar tudo magicamente ao pressionar qualquer tecla na sua respectiva janela preta.

## Uploading e Assets

* Você pode inserir arquivos compatíveis (via de regra `.obj` sem M-Tags ou `.stl` fechados) através do botão rotulado ou soltando-os sobre a interface drag-and-drop. Em segundos eles serão escalados e passarão a sofrer arrasto baseado no Grid-Bounds originado!
* Os modelos base operam a partir de `backend/data/` (se cacheados pelo PyVista) e as malhas brutas originais residem em `frontend/public`.
