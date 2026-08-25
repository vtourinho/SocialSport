/**
 * ============================================================================
 * PULSETRACKER - TELEMETRY & GPS CALCULATION ENGINE
 * Motor de alta precisão para cálculo de Distância, Pace, Velocidade e Splits
 * ============================================================================
 */

class TelemetryEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.mode = 'run'; // 'run' ou 'bike'
    this.startTime = null;
    this.endTime = null;
    this.lastTickTime = null;
    this.totalMovingTime = 0; // segundos
    this.isPaused = false;

    // Coordenadas e Rota
    this.points = []; // [{ lat, lng, alt, speed, timestamp, heading, accuracy }]
    this.totalDistance = 0; // em metros

    // Métricas Instantâneas Suavizadas
    this.currentSpeed = 0; // km/h
    this.currentPaceSeconds = 0; // segundos por km
    this.recentPoints = []; // janela móvel para suavização de velocidade

    // Quilômetro Atual e Splits
    this.completedKmCount = 0;
    this.lapDistance = 0; // metros percorridos no km atual (0 a 1000)
    this.lapMovingTime = 0; // segundos no km atual
    this.lapStartTime = null;
    this.splits = []; // [{ km, timeSeconds, paceFormatted, speedKmh, rawPaceSeconds }]

    // Estatísticas Máximas
    this.maxSpeed = 0; // km/h
    this.calories = 0;

    // Callbacks de Eventos
    this.onSplitCompleted = null;
    this.onPositionUpdate = null;
  }

  // Define modalidade do treino
  setMode(mode) {
    this.mode = mode === 'bike' ? 'bike' : 'run';
  }

  // Inicia o rastreamento
  start() {
    this.reset();
    const now = Date.now();
    this.startTime = now;
    this.lastTickTime = now;
    this.lapStartTime = now;
    this.isPaused = false;
  }

  // Pausa o treino
  pause() {
    this.isPaused = true;
    this.currentSpeed = 0;
    this.currentPaceSeconds = 0;
  }

  // Retoma o treino
  resume() {
    this.isPaused = false;
    this.lastTickTime = Date.now();
  }

  // Atualização de tempo chamada a cada segundo
  tick() {
    if (this.isPaused || !this.startTime) return;

    const now = Date.now();
    const deltaSeconds = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    if (deltaSeconds > 0 && deltaSeconds < 5) {
      this.totalMovingTime += deltaSeconds;
      this.lapMovingTime += deltaSeconds;
    }

    this.calculateCalories();
  }

  /**
   * Adiciona um novo ponto de GPS recebido do Geolocation ou Simulador
   * @param {Object} rawPoint { lat, lng, altitude, speed, timestamp, accuracy, heading }
   */
  addGpsPoint(rawPoint) {
    if (this.isPaused) return;

    const timestamp = rawPoint.timestamp || Date.now();
    const point = {
      lat: rawPoint.lat,
      lng: rawPoint.lng,
      altitude: rawPoint.altitude || 0,
      speed: rawPoint.speed || 0,
      timestamp: timestamp,
      accuracy: rawPoint.accuracy || 5,
      heading: rawPoint.heading || 0
    };

    if (this.points.length === 0) {
      this.points.push(point);
      if (this.onPositionUpdate) this.onPositionUpdate(point, this.getMetrics());
      return;
    }

    const prevPoint = this.points[this.points.length - 1];
    const segmentDistance = this.haversineDistance(
      prevPoint.lat, prevPoint.lng,
      point.lat, point.lng
    );

    // Filtro anti-ruído: ignora micro-oscilações (< 1.5m) ou saltos anômalos de GPS (> 50m em 1 segundo)
    const timeDiff = (point.timestamp - prevPoint.timestamp) / 1000;
    if (timeDiff > 0) {
      const calculatedSpeedKmh = (segmentDistance / timeDiff) * 3.6;

      // Se a velocidade for fisicamente improvável para o modo (ex: > 45km/h na corrida ou > 120km/h na bike), descarta como ruído de GPS
      const speedLimit = this.mode === 'run' ? 45 : 110;
      if (calculatedSpeedKmh > speedLimit) {
        return;
      }
    }

    // Se o movimento for relevante (maior que 1.8 metros)
    if (segmentDistance >= 1.8) {
      this.totalDistance += segmentDistance;
      this.lapDistance += segmentDistance;

      // Adiciona ponto filtrado
      this.points.push(point);

      // Atualiza lista recente para janela móvel de velocidade
      this.recentPoints.push({ dist: segmentDistance, time: timeDiff, timestamp: point.timestamp });
      if (this.recentPoints.length > 5) {
        this.recentPoints.shift();
      }

      // Calcula velocidade instantânea por média móvel
      let recentDistSum = 0;
      let recentTimeSum = 0;
      for (const p of this.recentPoints) {
        recentDistSum += p.dist;
        recentTimeSum += p.time;
      }

      if (recentTimeSum > 0) {
        const instantSpeed = (recentDistSum / recentTimeSum) * 3.6;
        // Suavização exponencial com a velocidade anterior
        this.currentSpeed = (this.currentSpeed * 0.4) + (instantSpeed * 0.6);
      }

      // Atualiza velocidade máxima
      if (this.currentSpeed > this.maxSpeed) {
        this.maxSpeed = this.currentSpeed;
      }

      // Calcula Pace instantâneo (min/km)
      if (this.currentSpeed >= 1.0) {
        this.currentPaceSeconds = 3600 / this.currentSpeed;
      } else {
        this.currentPaceSeconds = 0; // Parado ou muito devagar
      }

      // VERIFICAÇÃO DE SPLIT (A CADA 1.000 METROS)
      const currentExpectedKm = Math.floor(this.totalDistance / 1000);
      if (currentExpectedKm > this.completedKmCount) {
        this.completedKmCount = currentExpectedKm;
        this.recordKmSplit(this.completedKmCount);
      }
    }

    if (this.onPositionUpdate) {
      this.onPositionUpdate(point, this.getMetrics());
    }
  }

  // Registra a conclusão de um quilômetro
  recordKmSplit(kmNumber) {
    const lapTime = Math.max(1, this.lapMovingTime);
    const lapPaceSec = lapTime; // para 1km completo, o tempo do km é exatamente o pace em segundos
    const lapSpeedKmh = (1 / (lapTime / 3600));

    const splitData = {
      km: kmNumber,
      timeSeconds: lapTime,
      timeFormatted: this.formatDuration(lapTime),
      paceFormatted: this.formatPace(lapPaceSec),
      speedKmh: parseFloat(lapSpeedKmh.toFixed(1)),
      rawPaceSeconds: lapPaceSec
    };

    this.splits.push(splitData);

    // Reinicia contadores do novo quilômetro
    this.lapDistance = this.totalDistance % 1000;
    this.lapMovingTime = 0;
    this.lapStartTime = Date.now();

    // Notifica áudio e UI
    if (this.onSplitCompleted) {
      this.onSplitCompleted(splitData, this.getMetrics());
    }
  }

  // Retorna todas as métricas em tempo real formatadas
  getMetrics() {
    const totalDistKm = this.totalDistance / 1000;
    const totalTimeHours = this.totalMovingTime / 3600;

    // Velocidade Média Total (km/h)
    const avgSpeedKmh = totalTimeHours > 0 ? (totalDistKm / totalTimeHours) : 0;

    // Pace Médio Total (segundos/km)
    const avgPaceSec = totalDistKm > 0 ? (this.totalMovingTime / totalDistKm) : 0;

    // Pace do Quilômetro Atual em Andamento
    let lapPaceSec = 0;
    const lapDistKm = this.lapDistance / 1000;
    if (lapDistKm > 0.05 && this.lapMovingTime > 0) {
      lapPaceSec = this.lapMovingTime / lapDistKm;
    } else if (this.currentPaceSeconds > 0) {
      lapPaceSec = this.currentPaceSeconds;
    }

    // Velocidade do Quilômetro Atual em Andamento (km/h)
    let lapSpeedKmh = 0;
    const lapTimeHours = this.lapMovingTime / 3600;
    if (lapDistKm > 0.05 && lapTimeHours > 0) {
      lapSpeedKmh = lapDistKm / lapTimeHours;
    } else {
      lapSpeedKmh = this.currentSpeed;
    }

    // Progresso dentro do km atual (0 a 1000m)
    const currentKmNumber = this.completedKmCount + 1;
    const currentKmProgressMeters = Math.min(1000, Math.floor(this.lapDistance));
    const currentKmPercent = Math.min(100, (currentKmProgressMeters / 1000) * 100);

    return {
      mode: this.mode,
      totalMovingTimeSeconds: this.totalMovingTime,
      totalDurationFormatted: this.formatDuration(this.totalMovingTime),

      // Distância
      totalDistanceMeters: Math.floor(this.totalDistance),
      totalDistanceKm: totalDistKm.toFixed(2),
      totalDistanceFormatted: totalDistKm.toFixed(2),

      // Métricas de Corrida (Paces e Velocidades)
      currentPaceFormatted: this.formatPace(this.currentPaceSeconds),
      avgPaceFormatted: this.formatPace(avgPaceSec),
      lapPaceFormatted: this.formatPace(lapPaceSec),

      currentSpeedFormatted: this.currentSpeed.toFixed(1),
      avgSpeedFormatted: avgSpeedKmh.toFixed(1),
      lapSpeedFormatted: lapSpeedKmh.toFixed(1),
      maxSpeedFormatted: this.maxSpeed.toFixed(1),

      // Progresso do KM atual
      currentKmNumber: currentKmNumber,
      currentKmProgressMeters: currentKmProgressMeters,
      currentKmPercent: currentKmPercent.toFixed(0),

      // Calorias e Splits
      calories: Math.round(this.calories),
      splits: this.splits
    };
  }

  // Estimativa precisa de queima calórica utilizando Idade, Altura e Peso do usuário
  calculateCalories() {
    // Obtém perfil biométrico cadastrado pelo usuário
    const profile = (window.storageEngine && typeof window.storageEngine.getUserProfile === 'function')
      ? window.storageEngine.getUserProfile()
      : { weight: 70, age: 30, height: 175, gender: 'M' };

    const weightKg = Math.max(30, Number(profile.weight) || 70);
    const heightCm = Math.max(100, Number(profile.height) || 175);
    const ageYears = Math.max(12, Number(profile.age) || 30);
    const isFemale = profile.gender === 'F';

    // 1. Cálculo do MET (Equivalente Metabólico da Tarefa) baseado na intensidade da velocidade
    let met = 1.0;
    if (this.mode === 'run') {
      // MET para Corrida conforme a velocidade instantânea (km/h)
      if (this.currentSpeed < 5) met = 5.0;
      else if (this.currentSpeed < 8) met = 8.0;
      else if (this.currentSpeed < 10) met = 9.8;
      else if (this.currentSpeed < 12) met = 11.5;
      else if (this.currentSpeed < 14) met = 12.8;
      else met = 14.5;
    } else {
      // MET para Ciclismo conforme a velocidade instantânea (km/h)
      if (this.currentSpeed < 15) met = 4.0;
      else if (this.currentSpeed < 20) met = 6.0;
      else if (this.currentSpeed < 25) met = 8.5;
      else if (this.currentSpeed < 30) met = 10.0;
      else met = 12.5;
    }

    // 2. Fator de Taxa Metabólica Basal (TMB - Mifflin-St Jeor) usando Peso, Altura e Idade
    // TMB base = 10*peso + 6.25*altura - 5*idade + (5 para masc / -161 para fem)
    const genderConstant = isFemale ? -161 : 5;
    const tmb = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + genderConstant;
    const tmbRatio = Math.max(0.75, Math.min(1.35, tmb / 1700)); // Normalizado em relação à média

    // 3. Queima calórica da atividade: ((MET * 3.5 * Peso) / 200) * minutos de exercício * fator TMB
    const minutes = this.totalMovingTime / 60;
    const caloriesPerMinute = ((met * 3.5 * weightKg) / 200) * tmbRatio;
    
    this.calories = Math.max(0, caloriesPerMinute * minutes);
  }

  // Fórmula de Haversine para cálculo de distância geodésica em metros
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raio da Terra em metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Formata duração em HH:MM:SS ou MM:SS
  formatDuration(totalSeconds) {
    const sec = Math.floor(totalSeconds % 60);
    const min = Math.floor((totalSeconds / 60) % 60);
    const hrs = Math.floor(totalSeconds / 3600);

    const pad = (n) => String(n).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
    }
    return `${pad(min)}:${pad(sec)}`;
  }

  // Formata Pace em MM'SS"
  formatPace(paceSeconds) {
    if (!paceSeconds || paceSeconds <= 0 || paceSeconds > 1800) {
      return `--'--"`;
    }
    const min = Math.floor(paceSeconds / 60);
    const sec = Math.floor(paceSeconds % 60);
    return `${min}'${String(sec).padStart(2, '0')}"`;
  }

  // Gera arquivo GPX compatível com Strava, Garmin, Nike Run
  generateGpxString(activityTitle = 'Treino PulseTracker') {
    const nowIso = new Date(this.startTime || Date.now()).toISOString();
    let trkpts = '';

    for (const p of this.points) {
      const timeIso = new Date(p.timestamp).toISOString();
      trkpts += `      <trkpt lat="${p.lat}" lon="${p.lng}">
        <ele>${p.altitude || 0}</ele>
        <time>${timeIso}</time>
      </trkpt>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PulseTracker Web App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${activityTitle}</name>
    <time>${nowIso}</time>
  </metadata>
  <trk>
    <name>${activityTitle}</name>
    <type>${this.mode === 'bike' ? 'Cycling' : 'Running'}</type>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`;
  }
}

// Instância global
window.telemetryEngine = new TelemetryEngine();
