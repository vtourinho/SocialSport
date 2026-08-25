# 🏃‍♂️🚴 SocialSport - PulseTracker Pro

> **Aplicativo Web de Telemetria e Rastreamento em Tempo Real para Corrida e Ciclismo**  
> Inspirado nas melhores experiências de atletas (Nike Run Club e Strava), com mapa dinâmico em segundo plano, indicador de posição ao vivo, feedback por voz em português, cálculo biométrico de calorias e splits automáticos por quilômetro.

---

## 📱 Recursos Principais

### 🏃‍♂️ Modo Corrida (Pace & Ritmo)
- **Tempo de Atividade** em tempo real (`HH:MM:SS`).
- **Pace Instantâneo** (`min/km`) com algoritmo de suavização contra ruídos de GPS.
- **Pace Total Médio** do treino (`min/km`).
- **Pace do Km Atual** (tempo e ritmo do quilômetro em andamento).
- **Velocidade Momentânea**, **Velocidade Média** e **Velocidade do Km** (`km/h`).
- **Distância Total Percorrida** (km e metros) com barra de progresso visual de cada km.

### 🚴 Modo Ciclismo (Velocímetro & Distância)
- **Velocímetro em Destaque** (`km/h`).
- **Velocidade Média do Treino** e **Velocidade do Km Atual**.
- **Velocidade Máxima Registrada**.
- **Distância Total Percorrida** (`km`).

### 🗺️ Mapeamento Dinâmico em Tempo Real
- **Mapa em Tela Cheia no Fundo** utilizando Leaflet.js e camadas de alto contraste (Dark / OSM / Light).
- **Marcador do Atleta**: Indicador de pulso luminoso com rotação de bússola (heading) em tempo real.
- **Linha de Rota (Polyline)**: Traçado ao vivo com gradiente esportivo (*Nike Volt* para corrida e *Strava Orange* para bike).
- **Alternador de Visualização**: Alterne entre **Modo Mapa** (foco visual na rota) e **Modo Painel Completo** com 1 clique.
- **Acompanhamento Automático**: Centralização contínua com opção de recentralizar.

### 👤 Perfil do Atleta & Queima Calórica Científica
- **Cadastro Completo**: Nome, Apelido, Email, Telefone, Idade, Altura, Peso, Sexo, Cidade, Estado e Foto de Perfil.
- **Cálculo Biométrico Preciso**: Integração da Taxa Metabólica Basal (**TMB - Mifflin-St Jeor**) com intensidades de esforço (**METs**) baseadas no peso real e velocidade do atleta.

### 🔊 Audio Coach em Português & Feedback Sonoro
- **Contagem Regressiva Sonora**: Beeps no 3, 2, 1 e sinal de largada.
- **Avisos Falados por Voz**: Anúncio automático a cada 1 km completado com tempo, pace do split e ritmo médio.
- **Notificações Toast**: Destaque visual dos splits na tela.

### 📊 Resumo Pós-Treino, Histórico e GPX
- **Mini-Mapa da Rota** com pontos de largada e chegada.
- **Tabela de Splits por Quilômetro** destacando o km mais rápido.
- **Exportação de Arquivo GPX**: Compatível com Strava, Garmin Connect e Nike Run Club.
- **Histórico Local e Recordes Pessoais (PRs)**: Salvos no dispositivo sem necessidade de login.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend Core**: HTML5 Semântico, CSS3 Moderno (Custom Properties, Glassmorphism, Design System Esportivo), JavaScript ES6+ Modular.
- **Mapeamento**: Leaflet.js & OpenStreetMap / CartoDB.
- **Áudio e Voz**: Web Audio API & Web Speech API (Síntese de voz em português).
- **Sensores e PWA**: HTML5 Geolocation API, Screen WakeLock API, Service Worker e Web App Manifest.

---

## 🚀 Como Executar Localmente

Como a aplicação é 100% estática e modular (zero dependências pesadas de build), você pode executá-la de forma imediata:

1. **Abrir direto no navegador**:
   - Dê um duplo-clique no arquivo `index.html`.

2. **Ou via Servidor Local (Python)**:
   ```bash
   python -m http.server 8080
   ```
   Acesse no navegador: `http://localhost:8080`

---

## 🌐 Publicação no GitHub Pages (Hospedagem Gratuita)

Para deixar a aplicação acessível na web pelo celular ou computador:

1. Acesse o repositório no GitHub: `https://github.com/vtourinho/SocialSport`
2. Vá em **Settings** > **Pages**.
3. Em **Source**, selecione a branch `main` (ou `master`) e a pasta `/(root)`.
4. Clique em **Save**.
5. Em poucos instantes, seu app estará online em: `https://vtourinho.github.io/SocialSport/`

---

## 📄 Licença

Distribuído sob a licença MIT. Sinta-se livre para usar, modificar e contribuir!
