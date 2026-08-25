/**
 * ============================================================================
 * PULSETRACKER - GPS SIMULATOR ENGINE
 * Gerador de rotas realistas para teste em tempo real de Corrida e Bicicleta
 * ============================================================================
 */

class GpsSimulatorEngine {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.timer = null;
    this.speedMultiplier = 1; // 1x, 2x, 5x, 10x
    this.currentIndex = 0;
    this.selectedRoute = 'ibirapuera';
    this.onGpsTick = null;

    // Definição das Rotas de Demonstração (Waypoints principais de referência)
    this.routes = {
      // Circuito Parque Ibirapuera (~5.2 km) - São Paulo
      ibirapuera: [
        [-23.587416, -46.657634],
        [-23.586123, -46.656214],
        [-23.584762, -46.654890],
        [-23.583210, -46.653450],
        [-23.582100, -46.655100],
        [-23.581500, -46.657800],
        [-23.582800, -46.660100],
        [-23.584900, -46.662200],
        [-23.587200, -46.663100],
        [-23.589800, -46.662100],
        [-23.591500, -46.659800],
        [-23.590500, -46.657100],
        [-23.588600, -46.656500],
        [-23.587416, -46.657634]
      ],

      // Orla Copacabana & Ipanema (~10.4 km) - Rio de Janeiro
      copacabana: [
        [-22.964400, -43.173200], // Leme
        [-22.969100, -43.178800], // Copacabana Posto 2
        [-22.974500, -43.184300], // Copacabana Posto 4
        [-22.981200, -43.190500], // Copacabana Posto 6 / Forte
        [-22.987500, -43.192800], // Arpoador
        [-22.985500, -43.201200], // Ipanema Posto 9
        [-22.984000, -43.208500], // Ipanema Posto 10
        [-22.987000, -43.214000], // Leblon Posto 11
        [-22.989200, -43.223000], // Leblon Posto 12
        [-22.987000, -43.214000], // Retorno Leblon
        [-22.985500, -43.201200], // Retorno Ipanema
        [-22.981200, -43.190500]  // Retorno Arpoador
      ],

      // Ciclovia Marginal & Vila-Lobos (~18 km) - Ciclismo
      vilalobos: [
        [-23.548200, -46.723100], // Parque Vila-Lobos
        [-23.554000, -46.719000], // Ponte Jaguaré
        [-23.562000, -46.711000], // Ponte Cidade Universitária
        [-23.571000, -46.702000], // Ponte Eusébio Matoso
        [-23.582000, -46.696000], // Ponte Cidade Jardim
        [-23.593000, -46.692000], // Ponte Morumbi
        [-23.605000, -46.694000], // Ponte Estaiada
        [-23.593000, -46.692000], // Retorno Morumbi
        [-23.582000, -46.696000], // Retorno Cidade Jardim
        [-23.571000, -46.702000], // Retorno Eusébio Matoso
        [-23.554000, -46.719000], // Retorno Jaguaré
        [-23.548200, -46.723100]  // Retorno Vila-Lobos
      ]
    };

    // Cache de pontos interpolados em alta densidade (1 ponto por segundo)
    this.interpolatedPoints = [];
  }

  // Prepara a rota interpolando pontos intermediários realistas com base na modalidade
  prepareRoute(routeKey = 'ibirapuera', mode = 'run') {
    this.selectedRoute = routeKey;
    const waypoints = this.routes[routeKey] || this.routes.ibirapuera;

    // Velocidade base média em metros por segundo:
    // Corrida: ~3.1 m/s (11.1 km/h - pace ~5'24")
    // Bike: ~7.5 m/s (27.0 km/h)
    const baseSpeedMps = mode === 'bike' ? 7.5 : 3.1;

    this.interpolatedPoints = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      const segmentDistMeters = window.telemetryEngine.haversineDistance(
        p1[0], p1[1],
        p2[0], p2[1]
      );

      // Quantidade de segundos necessária para percorrer este segmento
      const segmentSeconds = Math.max(2, Math.floor(segmentDistMeters / baseSpeedMps));

      // Calcula direção (heading) em graus
      const deltaLat = p2[0] - p1[0];
      const deltaLng = p2[1] - p1[1];
      const headingDeg = (Math.atan2(deltaLng, deltaLat) * 180) / Math.PI;
      const normalizedHeading = (headingDeg + 360) % 360;

      for (let s = 0; s < segmentSeconds; s++) {
        const factor = s / segmentSeconds;
        const lat = p1[0] + (p2[0] - p1[0]) * factor;
        const lng = p1[1] + (p2[1] - p1[1]) * factor;

        // Variação orgânica e realista de velocidade (+- 10% de ritmo)
        const speedFluctuation = Math.sin((s + i * 15) * 0.15) * (mode === 'bike' ? 2.5 : 0.8);
        const actualSpeedKmh = (baseSpeedMps * 3.6) + speedFluctuation;

        this.interpolatedPoints.push({
          lat: lat,
          lng: lng,
          speed: Math.max(2, actualSpeedKmh),
          heading: normalizedHeading,
          altitude: 740 + Math.sin(s * 0.05) * 12, // Elevação suave
          accuracy: 4
        });
      }
    }
  }

  // Inicia a simulação
  start(routeKey = 'ibirapuera', mode = 'run', onTick = null) {
    this.stop();
    this.prepareRoute(routeKey, mode);
    this.onGpsTick = onTick;
    this.currentIndex = 0;
    this.isRunning = true;
    this.isPaused = false;

    this.scheduleNextTick();
  }

  // Agenda próximo ponto conforme o multiplicador de velocidade
  scheduleNextTick() {
    if (!this.isRunning) return;

    // Intervalo padrão de 1 segundo dividido pelo multiplicador
    const intervalMs = Math.max(50, Math.floor(1000 / this.speedMultiplier));

    this.timer = setTimeout(() => {
      if (this.isRunning && !this.isPaused) {
        this.step();
      }
      this.scheduleNextTick();
    }, intervalMs);
  }

  // Executa um passo do simulador
  step() {
    if (this.currentIndex >= this.interpolatedPoints.length) {
      // Reinicia o circuito se chegar ao fim
      this.currentIndex = 0;
    }

    const currentPoint = this.interpolatedPoints[this.currentIndex];
    this.currentIndex++;

    if (this.onGpsTick && currentPoint) {
      // Adiciona timestamp atual
      const pointWithTimestamp = {
        ...currentPoint,
        timestamp: Date.now()
      };
      this.onGpsTick(pointWithTimestamp);
    }
  }

  // Define multiplicador de velocidade (1x, 2x, 5x, 10x)
  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = Number(multiplier) || 1;
  }

  // Pausa a simulação
  pause() {
    this.isPaused = true;
  }

  // Retoma a simulação
  resume() {
    this.isPaused = false;
  }

  // Para completamente
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentIndex = 0;
  }
}

// Instância global
window.gpsSimulator = new GpsSimulatorEngine();
