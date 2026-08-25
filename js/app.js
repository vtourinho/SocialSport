/**
 * ============================================================================
 * PULSETRACKER - MAIN APPLICATION CONTROLLER
 * Controlador central, interface de usuário, timers e ciclo de vida do treino
 * ============================================================================
 */

class PulseTrackerApp {
  constructor() {
    this.currentMode = 'run'; // 'run' | 'bike'
    this.gpsSource = 'real'; // 'real' | 'simulated'
    this.selectedSimRoute = 'ibirapuera';
    this.selectedGoal = 'free';

    this.workoutState = 'IDLE'; // 'IDLE', 'COUNTDOWN', 'RUNNING', 'PAUSED', 'SUMMARY'
    this.timerInterval = null;
    this.geolocationWatchId = null;
    this.wakeLockSentinel = null;

    this.isScreenLocked = false;
    this.lastSavedActivity = null;
    this.tempProfilePhoto = '';

    this.init();
  }

  // Inicialização do aplicativo e escuta de eventos do DOM
  init() {
    this.loadUserProfileUi();
    this.bindSetupEvents();
    this.bindWorkoutEvents();
    this.bindSummaryEvents();
    this.bindModalEvents();
    this.bindProfileEvents();
    this.initPwa();

    // Registra callbacks no motor de telemetria
    window.telemetryEngine.onPositionUpdate = (point, metrics) => {
      this.handlePositionUpdate(point, metrics);
    };

    window.telemetryEngine.onSplitCompleted = (split, metrics) => {
      this.handleSplitCompleted(split, metrics);
    };

    // Atualiza badges de recordes no histórico
    this.updateHistoryUi();
  }

  /* ==========================================================================
     1. EVENTOS DA TELA DE SETUP (PRÉ-TREINO)
     ========================================================================== */
  bindSetupEvents() {
    // Seletor de Modalidade (Corrida vs Bike)
    const cardRun = document.getElementById('card-mode-run');
    const cardBike = document.getElementById('card-mode-bike');
    const btnStartModeLabel = document.getElementById('btn-start-mode-label');

    cardRun.addEventListener('click', () => {
      this.setSportMode('run');
    });

    cardBike.addEventListener('click', () => {
      this.setSportMode('bike');
    });

    // Seletor de Metas (Chips)
    const goalChips = document.querySelectorAll('#goal-selector .chip');
    goalChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        goalChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedGoal = chip.dataset.goal;
      });
    });

    // Seletor de Fonte GPS (Real vs Simulador)
    const radioReal = document.getElementById('gps-source-real');
    const radioSim = document.getElementById('gps-source-sim');
    const simRoutesContainer = document.getElementById('sim-routes-container');
    const gpsBadge = document.getElementById('gps-status-indicator');

    const updateGpsSource = () => {
      if (radioSim.checked) {
        this.gpsSource = 'simulated';
        simRoutesContainer.style.display = 'block';
        gpsBadge.innerHTML = '<span class="status-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b"></span><span class="status-text" style="color:#f59e0b">Simulador Ativo</span>';
      } else {
        this.gpsSource = 'real';
        simRoutesContainer.style.display = 'none';
        gpsBadge.innerHTML = '<span class="status-dot"></span><span class="status-text">GPS Real Pronto</span>';
      }
    };

    radioReal.addEventListener('change', updateGpsSource);
    radioSim.addEventListener('change', updateGpsSource);

    // Seletor de rota simulada
    const selectSimRoute = document.getElementById('select-sim-route');
    selectSimRoute.addEventListener('change', (e) => {
      this.selectedSimRoute = e.target.value;
    });

    // Toggles de Voice Coach e Wakelock
    const toggleVoice = document.getElementById('toggle-voice-coach');
    toggleVoice.addEventListener('change', (e) => {
      window.audioCoach.voiceEnabled = e.target.checked;
    });

    // Botão Principal de Iniciar
    const btnStart = document.getElementById('btn-start-workout');
    btnStart.addEventListener('click', () => {
      this.startCountdownSequence();
    });
  }

  // Alterna a modalidade do aplicativo
  setSportMode(mode) {
    this.currentMode = mode;
    window.telemetryEngine.setMode(mode);

    const cardRun = document.getElementById('card-mode-run');
    const cardBike = document.getElementById('card-mode-bike');
    const btnStartModeLabel = document.getElementById('btn-start-mode-label');
    const liveModeIcon = document.getElementById('live-mode-icon');
    const liveModeName = document.getElementById('live-mode-name');

    if (mode === 'bike') {
      document.body.classList.remove('mode-run');
      document.body.classList.add('mode-bike');
      cardRun.classList.remove('active');
      cardBike.classList.add('active');
      btnStartModeLabel.textContent = 'MODO: BICICLETA 🚴';
      liveModeIcon.textContent = '🚴';
      liveModeName.textContent = 'BICICLETA';

      document.getElementById('telemetry-run-layout').style.display = 'none';
      document.getElementById('telemetry-bike-layout').style.display = 'flex';
      document.getElementById('sum-pace-card').style.display = 'none';
    } else {
      document.body.classList.remove('mode-bike');
      document.body.classList.add('mode-run');
      cardBike.classList.remove('active');
      cardRun.classList.add('active');
      btnStartModeLabel.textContent = 'MODO: CORRIDA 🏃‍♂️';
      liveModeIcon.textContent = '🏃‍♂️';
      liveModeName.textContent = 'CORRIDA';

      document.getElementById('telemetry-run-layout').style.display = 'flex';
      document.getElementById('telemetry-bike-layout').style.display = 'none';
      document.getElementById('sum-pace-card').style.display = 'flex';
    }
  }

  /* ==========================================================================
     2. CONTAGEM REGRESSIVA (3, 2, 1, VAI!)
     ========================================================================== */
  startCountdownSequence() {
    const countdownScreen = document.getElementById('screen-countdown');
    const numEl = document.getElementById('countdown-number');
    const labelEl = document.getElementById('countdown-label');

    this.workoutState = 'COUNTDOWN';
    countdownScreen.classList.add('active');

    let count = 3;
    numEl.textContent = count;
    labelEl.textContent = 'Prepare-se...';
    window.audioCoach.playCountdownBeep(count);

    const countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        numEl.textContent = count;
        window.audioCoach.playCountdownBeep(count);
      } else if (count === 0) {
        numEl.textContent = 'VAI!';
        labelEl.textContent = 'Bom Treino!';
        window.audioCoach.playCountdownBeep(0);
        window.audioCoach.speak('Treino iniciado! Bom treino!');
      } else {
        clearInterval(countdownTimer);
        countdownScreen.classList.remove('active');
        this.beginActiveWorkout();
      }
    }, 900);
  }

  /* ==========================================================================
     3. INÍCIO E EXECUÇÃO DO TREINO ATIVO
     ========================================================================== */
  beginActiveWorkout() {
    this.workoutState = 'RUNNING';

    // Alterna telas
    document.getElementById('screen-setup').classList.remove('active');
    document.getElementById('screen-workout').classList.add('active');

    // Determina coordenadas iniciais para o mapa
    let initialCoords = null;
    if (this.gpsSource === 'simulated' && window.gpsSimulator && window.gpsSimulator.routes[this.selectedSimRoute]) {
      initialCoords = window.gpsSimulator.routes[this.selectedSimRoute][0];
    }

    // Inicializa Mapa
    window.mapEngine.initWorkoutMap('map-container', initialCoords);
    window.mapEngine.resetRoute();
    window.mapEngine.updateRouteStyle(this.currentMode);
    window.mapEngine.recenter();

    // Inicia Telemetria
    window.telemetryEngine.start();
    this.resetTelemetryUi();

    // Ativa Screen WakeLock se suportado e habilitado
    this.requestWakeLock();

    // Mostra/Oculta barra de simulação
    const simBar = document.getElementById('sim-control-bar');
    if (this.gpsSource === 'simulated') {
      simBar.style.display = 'flex';
      this.startGpsSimulation();
    } else {
      simBar.style.display = 'none';
      this.startRealGeolocation();
    }

    // Inicia Timer de Atualização
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.workoutState === 'RUNNING') {
        window.telemetryEngine.tick();
        this.updateTelemetryUi(window.telemetryEngine.getMetrics());
      }
    }, 1000);
  }

  // Inicia rastreamento por GPS Real do aparelho
  startRealGeolocation() {
    if (!('geolocation' in navigator)) {
      alert('Geolocalização não suportada neste dispositivo. Ativando modo simulação.');
      this.startGpsSimulation();
      return;
    }

    const gpsText = document.getElementById('live-gps-text');
    gpsText.textContent = 'GPS: Buscando satélites...';

    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    };

    this.geolocationWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy || 10;
        let quality = 'Ótimo';
        if (accuracy > 25) quality = 'Fraco';
        else if (accuracy > 12) quality = 'Bom';

        gpsText.textContent = `GPS: ${quality} (${Math.round(accuracy)}m)`;

        window.telemetryEngine.addGpsPoint({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude || 0,
          speed: (pos.coords.speed || 0) * 3.6, // Converte m/s para km/h
          heading: pos.coords.heading || 0,
          accuracy: accuracy,
          timestamp: pos.timestamp || Date.now()
        });
      },
      (err) => {
        console.warn('Erro no GPS:', err);
        gpsText.textContent = 'GPS: Sem sinal';
      },
      geoOptions
    );
  }

  // Inicia rastreamento por Simulador de Rota
  startGpsSimulation() {
    const gpsText = document.getElementById('live-gps-text');
    gpsText.textContent = 'GPS: Rota Simulada (4m)';

    window.gpsSimulator.start(this.selectedSimRoute, this.currentMode, (point) => {
      if (this.workoutState === 'RUNNING') {
        window.telemetryEngine.addGpsPoint(point);
      }
    });
  }

  // Recebe atualização de posição e atualiza o mapa
  handlePositionUpdate(point, metrics) {
    window.mapEngine.updateAthletePosition(point.lat, point.lng, point.heading, this.currentMode);
    this.updateTelemetryUi(metrics);
  }

  // Recebe evento de split concluído (a cada 1km)
  handleSplitCompleted(split, metrics) {
    // 1. Áudio e Fala
    window.audioCoach.announceKmSplit(
      split.km,
      split.timeFormatted,
      split.paceFormatted,
      metrics.avgPaceFormatted,
      this.currentMode
    );

    // 2. Notificação Visual Toast
    const toast = document.getElementById('split-toast');
    const toastTitle = document.getElementById('split-toast-title');
    const toastStats = document.getElementById('split-toast-stats');

    toastTitle.textContent = `Quilômetro ${split.km} Concluído! 🏆`;
    if (this.currentMode === 'run') {
      toastStats.textContent = `Tempo: ${split.timeFormatted} • Pace: ${split.paceFormatted}/km • Vel: ${split.speedKmh} km/h`;
    } else {
      toastStats.textContent = `Tempo: ${split.timeFormatted} • Velocidade Média: ${split.speedKmh} km/h`;
    }

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);
  }

  /* ==========================================================================
     4. ATUALIZAÇÃO DA INTERFACE DE TELEMETRIA EM TEMPO REAL
     ========================================================================== */
  resetTelemetryUi() {
    document.getElementById('hud-timer').textContent = '00:00:00';
    document.getElementById('hud-status-text').textContent = 'EM ANDAMENTO';
    document.getElementById('hud-status-badge').classList.remove('paused');

    // Corrida
    document.getElementById('run-current-pace').textContent = `--'--"`;
    document.getElementById('run-total-distance').textContent = '0.00';
    document.getElementById('run-distance-meters').textContent = '0 m';
    document.getElementById('run-avg-pace').textContent = `--'--"`;
    document.getElementById('run-lap-pace').textContent = `--'--"`;
    document.getElementById('run-current-speed').textContent = '0.0';
    document.getElementById('run-avg-speed').textContent = '0.0';
    document.getElementById('run-lap-speed').textContent = '0.0';
    document.getElementById('run-calories').textContent = '0';
    document.getElementById('run-km-progress-fill').style.width = '0%';
    document.getElementById('run-km-progress-label').textContent = 'Quilômetro 1 em andamento';
    document.getElementById('run-km-progress-val').textContent = '0 / 1000m (0%)';

    // Bike
    document.getElementById('bike-current-speed').textContent = '0.0';
    document.getElementById('bike-total-distance').textContent = '0.00';
    document.getElementById('bike-distance-meters').textContent = '0 m';
    document.getElementById('bike-avg-speed').textContent = '0.0';
    document.getElementById('bike-lap-speed').textContent = '0.0';
    document.getElementById('bike-max-speed').textContent = '0.0';
    document.getElementById('bike-calories').textContent = '0';
    document.getElementById('bike-km-progress-fill').style.width = '0%';
    document.getElementById('bike-km-progress-label').textContent = 'Quilômetro 1 em andamento';
    document.getElementById('bike-km-progress-val').textContent = '0 / 1000m (0%)';
  }

  updateTelemetryUi(m) {
    document.getElementById('hud-timer').textContent = m.totalDurationFormatted;

    if (this.currentMode === 'run') {
      // 8 Métricas de Corrida
      document.getElementById('run-current-pace').textContent = m.currentPaceFormatted;
      document.getElementById('run-total-distance').textContent = m.totalDistanceKm;
      document.getElementById('run-distance-meters').textContent = `${m.totalDistanceMeters} m`;
      document.getElementById('run-avg-pace').textContent = m.avgPaceFormatted;
      document.getElementById('run-lap-pace').textContent = m.lapPaceFormatted;
      document.getElementById('run-current-speed').textContent = m.currentSpeedFormatted;
      document.getElementById('run-avg-speed').textContent = m.avgSpeedFormatted;
      document.getElementById('run-lap-speed').textContent = m.lapSpeedFormatted;
      document.getElementById('run-calories').textContent = m.calories;

      // Progresso do KM atual
      document.getElementById('run-km-progress-fill').style.width = `${m.currentKmPercent}%`;
      document.getElementById('run-km-progress-label').textContent = `Quilômetro ${m.currentKmNumber} em andamento`;
      document.getElementById('run-km-progress-val').textContent = `${m.currentKmProgressMeters} / 1000m (${m.currentKmPercent}%)`;
    } else {
      // 5 Métricas Principais de Ciclismo
      document.getElementById('bike-current-speed').textContent = m.currentSpeedFormatted;
      document.getElementById('bike-total-distance').textContent = m.totalDistanceKm;
      document.getElementById('bike-distance-meters').textContent = `${m.totalDistanceMeters} m`;
      document.getElementById('bike-avg-speed').textContent = m.avgSpeedFormatted;
      document.getElementById('bike-lap-speed').textContent = m.lapSpeedFormatted;
      document.getElementById('bike-max-speed').textContent = m.maxSpeedFormatted;
      document.getElementById('bike-calories').textContent = m.calories;

      // Progresso do KM atual (Bike)
      document.getElementById('bike-km-progress-fill').style.width = `${m.currentKmPercent}%`;
      document.getElementById('bike-km-progress-label').textContent = `Quilômetro ${m.currentKmNumber} em andamento`;
      document.getElementById('bike-km-progress-val').textContent = `${m.currentKmProgressMeters} / 1000m (${m.currentKmPercent}%)`;
    }
  }

  /* ==========================================================================
     5. CONTROLES DO TREINO (PAUSAR, RETOMAR, FINALIZAR, MAPA)
     ========================================================================== */
  bindWorkoutEvents() {
    const btnPause = document.getElementById('btn-pause-workout');
    const pauseText = document.getElementById('btn-pause-text');
    const statusBadge = document.getElementById('hud-status-badge');
    const statusText = document.getElementById('hud-status-text');

    // Botão Pausar / Retomar
    btnPause.addEventListener('click', () => {
      if (this.workoutState === 'RUNNING') {
        this.workoutState = 'PAUSED';
        window.telemetryEngine.pause();
        window.gpsSimulator.pause();
        window.audioCoach.playPauseSound();

        btnPause.classList.add('resuming');
        pauseText.textContent = 'RETOMAR';
        statusBadge.classList.add('paused');
        statusText.textContent = 'PAUSADO';
      } else if (this.workoutState === 'PAUSED') {
        this.workoutState = 'RUNNING';
        window.telemetryEngine.resume();
        window.gpsSimulator.resume();
        window.audioCoach.playResumeSound();

        btnPause.classList.remove('resuming');
        pauseText.textContent = 'PAUSAR';
        statusBadge.classList.remove('paused');
        statusText.textContent = 'EM ANDAMENTO';
      }
    });

    // Botão Finalizar Treino (Abre Modal Customizado de Confirmação)
    const btnFinish = document.getElementById('btn-finish-workout');
    const modalConfirmFinish = document.getElementById('modal-confirm-finish');
    const btnCancelFinish = document.getElementById('btn-cancel-finish');
    const btnConfirmFinish = document.getElementById('btn-confirm-finish');

    if (btnFinish) {
      btnFinish.addEventListener('click', () => {
        if (modalConfirmFinish) {
          modalConfirmFinish.style.display = 'flex';
        } else {
          // Fallback seguro caso o modal não esteja no DOM
          if (confirm('Deseja realmente concluir e finalizar este treino?')) {
            this.finishWorkout();
          }
        }
      });
    }

    if (btnCancelFinish) {
      btnCancelFinish.addEventListener('click', () => {
        modalConfirmFinish.style.display = 'none';
      });
    }

    if (btnConfirmFinish) {
      btnConfirmFinish.addEventListener('click', () => {
        modalConfirmFinish.style.display = 'none';
        this.finishWorkout();
      });
    }

    // Alternador de Visualização: 🗺️ Modo Mapa vs 📊 Painel Completo
    const tabBtnMap = document.getElementById('tab-btn-map');
    const tabBtnTelemetry = document.getElementById('tab-btn-telemetry');
    const screenWorkout = document.getElementById('screen-workout');

    if (tabBtnMap && tabBtnTelemetry && screenWorkout) {
      tabBtnMap.addEventListener('click', () => {
        screenWorkout.classList.add('view-mode-map');
        tabBtnMap.classList.add('active');
        tabBtnTelemetry.classList.remove('active');
        if (window.mapEngine && window.mapEngine.map) {
          setTimeout(() => {
            window.mapEngine.map.invalidateSize();
            window.mapEngine.recenter();
          }, 100);
        }
      });

      tabBtnTelemetry.addEventListener('click', () => {
        screenWorkout.classList.remove('view-mode-map');
        tabBtnTelemetry.classList.add('active');
        tabBtnMap.classList.remove('active');
        if (window.mapEngine && window.mapEngine.map) {
          setTimeout(() => {
            window.mapEngine.map.invalidateSize();
          }, 100);
        }
      });
    }

    // Botão Alternar Modo Mapa Expandido (Recolhe métricas secundárias)
    const btnToggleMapExpand = document.getElementById('btn-toggle-map-expand');
    const dashboardHud = document.querySelector('.workout-dashboard-hud');
    if (btnToggleMapExpand && dashboardHud) {
      btnToggleMapExpand.addEventListener('click', () => {
        dashboardHud.classList.toggle('compact-mode');
        btnToggleMapExpand.classList.toggle('active');
        setTimeout(() => {
          if (window.mapEngine && window.mapEngine.map) {
            window.mapEngine.map.invalidateSize();
          }
        }, 150);
      });
    }

    // Botão Recentralizar Mapa
    const btnRecenter = document.getElementById('btn-recenter-map');
    btnRecenter.addEventListener('click', () => {
      window.mapEngine.recenter();
    });

    // Botão Alternar Estilo do Mapa
    const btnMapStyle = document.getElementById('btn-toggle-map-style');
    btnMapStyle.addEventListener('click', () => {
      window.mapEngine.toggleMapStyle();
    });

    // Botão Bloquear / Desbloquear Tela
    const btnLock = document.getElementById('btn-lock-screen');
    const lockOverlay = document.getElementById('screen-lock-overlay');
    const btnUnlock = document.getElementById('btn-unlock-screen');

    btnLock.addEventListener('click', () => {
      this.isScreenLocked = true;
      lockOverlay.style.display = 'flex';
    });

    btnUnlock.addEventListener('click', () => {
      this.isScreenLocked = false;
      lockOverlay.style.display = 'none';
    });

    // Botões de Velocidade da Simulação (1x, 2x, 5x, 10x)
    const speedBtns = document.querySelectorAll('.sim-speed-btn');
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.gpsSimulator.setSpeedMultiplier(btn.dataset.speed);
      });
    });

    const btnSimTogglePause = document.getElementById('btn-sim-toggle-pause');
    btnSimTogglePause.addEventListener('click', () => {
      if (window.gpsSimulator.isPaused) {
        window.gpsSimulator.resume();
        btnSimTogglePause.textContent = 'Pausar Sim';
      } else {
        window.gpsSimulator.pause();
        btnSimTogglePause.textContent = 'Retomar Sim';
      }
    });
  }

  // Finalização do treino (Garantida e Segura)
  finishWorkout() {
    this.workoutState = 'SUMMARY';

    try {
      // Interrompe timers e GPS
      if (this.timerInterval) clearInterval(this.timerInterval);
      if (this.geolocationWatchId !== null) {
        navigator.geolocation.clearWatch(this.geolocationWatchId);
        this.geolocationWatchId = null;
      }
      if (window.gpsSimulator) {
        window.gpsSimulator.stop();
      }
      this.releaseWakeLock();
    } catch (e) {
      console.warn('Erro ao interromper sensores/timers:', e);
    }

    const finalMetrics = window.telemetryEngine.getMetrics();
    const now = new Date();

    // Cria objeto da atividade
    const activity = {
      id: 'act_' + Date.now(),
      mode: this.currentMode,
      dateFormatted: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      timestamp: now.getTime(),
      title: this.currentMode === 'bike' ? 'Pedal PulseTracker' : 'Corrida PulseTracker',
      durationSeconds: finalMetrics.totalMovingTimeSeconds,
      durationFormatted: finalMetrics.totalDurationFormatted,
      distanceMeters: finalMetrics.totalDistanceMeters,
      distanceKm: finalMetrics.totalDistanceKm,
      avgPace: finalMetrics.avgPaceFormatted,
      avgSpeed: finalMetrics.avgSpeedFormatted,
      maxSpeed: finalMetrics.maxSpeedFormatted,
      calories: finalMetrics.calories,
      splits: finalMetrics.splits,
      points: window.telemetryEngine.points || []
    };

    this.lastSavedActivity = activity;

    // Salva no armazenamento local com proteção
    try {
      window.storageEngine.saveActivity(activity);
      this.updateHistoryUi();
    } catch (e) {
      console.warn('Erro ao salvar no storage:', e);
    }

    // Abre tela de Resumo
    this.showSummaryScreen(activity);
  }

  /* ==========================================================================
     6. TELA DE RESUMO PÓS-TREINO & SPLITS
     ========================================================================== */
  showSummaryScreen(act) {
    document.getElementById('screen-workout').classList.remove('active');
    document.getElementById('screen-summary').classList.add('active');

    // Header
    document.getElementById('summary-workout-title').textContent = act.title;
    document.getElementById('summary-workout-date').textContent = act.dateFormatted;
    document.getElementById('summary-sport-badge').textContent = act.mode === 'bike' ? '🚴 BICICLETA' : '🏃‍♂️ CORRIDA';

    // Métricas
    document.getElementById('sum-total-dist').textContent = act.distanceKm;
    document.getElementById('sum-total-time').textContent = act.durationFormatted;
    document.getElementById('sum-avg-pace').textContent = act.avgPace;
    document.getElementById('sum-avg-speed').textContent = act.avgSpeed;
    document.getElementById('sum-max-speed').textContent = act.maxSpeed;
    document.getElementById('sum-calories').textContent = act.calories;

    // Renderiza Mini Mapa com proteção
    try {
      window.mapEngine.renderSummaryMap(act.points, act.mode, 'summary-map-container');
    } catch (e) {
      console.warn('Erro ao renderizar mapa de resumo:', e);
    }

    // Renderiza Lista de Splits por KM
    this.renderSummarySplits(act.splits, act.mode);
  }

  renderSummarySplits(splits, mode) {
    const container = document.getElementById('splits-table-container');
    const countPill = document.getElementById('splits-total-count');

    if (!splits || splits.length === 0) {
      container.innerHTML = '<div class="empty-splits">Nenhum quilômetro completo gravado para gerar splits.</div>';
      countPill.textContent = '0 km registrados';
      return;
    }

    countPill.textContent = `${splits.length} km registrados`;

    // Encontra o split mais rápido para destacar em verde
    let minPaceSeconds = Infinity;
    splits.forEach(s => {
      if (s.rawPaceSeconds && s.rawPaceSeconds < minPaceSeconds) {
        minPaceSeconds = s.rawPaceSeconds;
      }
    });

    let html = '';
    splits.forEach(s => {
      const isFastest = s.rawPaceSeconds === minPaceSeconds;
      const barWidth = Math.min(100, Math.max(25, (s.speedKmh / 35) * 100));

      html += `
        <div class="split-row-card ${isFastest ? 'fastest' : ''}">
          <div class="split-km-label">Km ${s.km} ${isFastest ? '⚡' : ''}</div>
          <div class="split-bar-visual">
            <div class="split-bar-inner" style="width: ${barWidth}%"></div>
          </div>
          <div class="split-metrics-val">
            ${mode === 'run' ? `<span>${s.paceFormatted}/km</span>` : ''}
            <span>${s.speedKmh} km/h</span>
            <span style="color:var(--text-muted);">${s.timeFormatted}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  bindSummaryEvents() {
    // Exportar GPX
    const btnGpx = document.getElementById('btn-download-gpx');
    btnGpx.addEventListener('click', () => {
      if (!this.lastSavedActivity) return;
      const gpxContent = window.telemetryEngine.generateGpxString(this.lastSavedActivity.title);
      const filename = `PulseTracker_${this.lastSavedActivity.mode}_${Date.now()}.gpx`;
      window.storageEngine.downloadGpx(gpxContent, filename);
    });

    // Concluir e fechar resumo
    const btnSaveClose = document.getElementById('btn-save-and-close');
    btnSaveClose.addEventListener('click', () => {
      document.getElementById('screen-summary').classList.remove('active');
      document.getElementById('screen-setup').classList.add('active');
      this.workoutState = 'IDLE';
    });
  }

  /* ==========================================================================
     7. MODAIS DE HISTÓRICO E CONFIGURAÇÕES
     ========================================================================== */
  bindModalEvents() {
    // Modal de Histórico
    const modalHistory = document.getElementById('modal-history');
    const btnOpenHistory = document.getElementById('btn-open-history');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const btnCloseHistoryFooter = document.getElementById('btn-close-history-footer');
    const btnClearHistory = document.getElementById('btn-clear-history');

    btnOpenHistory.addEventListener('click', () => {
      this.updateHistoryUi();
      modalHistory.style.display = 'flex';
    });

    const closeHistory = () => { modalHistory.style.display = 'none'; };
    btnCloseHistory.addEventListener('click', closeHistory);
    btnCloseHistoryFooter.addEventListener('click', closeHistory);

    btnClearHistory.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja apagar todo o histórico de treinos?')) {
        window.storageEngine.clearAll();
        this.updateHistoryUi();
      }
    });

    // Modal de Configurações
    const modalSettings = document.getElementById('modal-settings');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnCloseSettingsFooter = document.getElementById('btn-close-settings-footer');

    btnOpenSettings.addEventListener('click', () => {
      modalSettings.style.display = 'flex';
    });

    const closeSettings = () => { modalSettings.style.display = 'none'; };
    btnCloseSettings.addEventListener('click', closeSettings);
    btnCloseSettingsFooter.addEventListener('click', closeSettings);

    // Ajuste de volume de voz
    const rangeVoiceVol = document.getElementById('setting-voice-vol');
    rangeVoiceVol.addEventListener('input', (e) => {
      window.audioCoach.voiceVolume = parseFloat(e.target.value);
    });

    // Toggle de beeps sonoros
    const toggleBeeps = document.getElementById('setting-beeps');
    toggleBeeps.addEventListener('change', (e) => {
      window.audioCoach.beepsEnabled = e.target.checked;
    });
  }

  /* ==========================================================================
     8. GESTÃO DO PERFIL DO USUÁRIO & BIOMETRIA
     ========================================================================== */
  loadUserProfileUi() {
    const profile = window.storageEngine.getUserProfile();

    // Atualiza botão do cabeçalho
    const headerNickname = document.getElementById('header-user-nickname');
    const headerAvatarPreview = document.getElementById('header-avatar-preview');

    if (profile.nickname) {
      headerNickname.textContent = profile.nickname;
    }

    if (profile.photo) {
      headerAvatarPreview.innerHTML = `<img src="${profile.photo}" alt="Avatar">`;
      const photoPreview = document.getElementById('profile-photo-preview');
      const photoPlaceholder = document.getElementById('profile-photo-placeholder');
      if (photoPreview && photoPlaceholder) {
        photoPreview.src = profile.photo;
        photoPreview.style.display = 'block';
        photoPlaceholder.style.display = 'none';
      }
    }

    // Atualiza o card de perfil na tela de setup inicial
    const setupUserName = document.getElementById('setup-user-name');
    const setupUserDetails = document.getElementById('setup-user-details');
    const setupAvatarPreview = document.getElementById('setup-avatar-preview');

    if (setupUserName && setupUserDetails) {
      if (profile.name || profile.nickname) {
        setupUserName.textContent = profile.name ? `${profile.name} (${profile.nickname || 'Atleta'})` : profile.nickname;
        const details = [];
        if (profile.age) details.push(`${profile.age} anos`);
        if (profile.weight) details.push(`${profile.weight} kg`);
        if (profile.height) details.push(`${profile.height} cm`);
        if (profile.city) details.push(`${profile.city}/${profile.state || 'UF'}`);
        setupUserDetails.textContent = details.length > 0 ? details.join(' • ') : 'Toque para cadastrar dados biométricos';
      } else {
        setupUserName.textContent = 'Atleta (Cadastre seus Dados)';
        setupUserDetails.textContent = 'Idade, Altura e Peso para cálculo exato de calorias';
      }
    }

    if (setupAvatarPreview && profile.photo) {
      setupAvatarPreview.innerHTML = `<img src="${profile.photo}" alt="Avatar">`;
    }

    // Preenche campos do formulário de perfil
    if (document.getElementById('profile-name')) {
      document.getElementById('profile-name').value = profile.name || '';
      document.getElementById('profile-nickname').value = profile.nickname || '';
      document.getElementById('profile-email').value = profile.email || '';
      document.getElementById('profile-phone').value = profile.phone || '';
      document.getElementById('profile-age').value = profile.age || 30;
      document.getElementById('profile-weight').value = profile.weight || 70;
      document.getElementById('profile-height').value = profile.height || 175;
      document.getElementById('profile-gender').value = profile.gender || 'M';
      document.getElementById('profile-city').value = profile.city || '';
      document.getElementById('profile-state').value = profile.state || 'SP';
    }
  }

  bindProfileEvents() {
    const modalProfile = document.getElementById('modal-profile');
    const btnOpenProfile = document.getElementById('btn-open-profile');
    const btnEditProfileCard = document.getElementById('btn-edit-profile-card');
    const btnCloseProfile = document.getElementById('btn-close-profile');
    const formProfile = document.getElementById('form-user-profile');
    const inputPhoto = document.getElementById('input-profile-photo');
    const photoPreview = document.getElementById('profile-photo-preview');
    const photoPlaceholder = document.getElementById('profile-photo-placeholder');

    const openProfileModal = () => {
      this.loadUserProfileUi();
      modalProfile.style.display = 'flex';
    };

    if (btnOpenProfile) btnOpenProfile.addEventListener('click', openProfileModal);
    if (btnEditProfileCard) btnEditProfileCard.addEventListener('click', openProfileModal);

    if (btnCloseProfile) {
      btnCloseProfile.addEventListener('click', () => {
        modalProfile.style.display = 'none';
      });
    }

    // Upload e preview da foto de perfil
    if (inputPhoto) {
      inputPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.tempProfilePhoto = event.target.result;
            if (photoPreview) {
              photoPreview.src = this.tempProfilePhoto;
              photoPreview.style.display = 'block';
            }
            if (photoPlaceholder) {
              photoPlaceholder.style.display = 'none';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Salvar formulário de perfil
    if (formProfile) {
      formProfile.addEventListener('submit', (e) => {
        e.preventDefault();

        const existingProfile = window.storageEngine.getUserProfile();
        const updatedProfile = {
          name: document.getElementById('profile-name').value.trim(),
          nickname: document.getElementById('profile-nickname').value.trim() || 'Atleta',
          email: document.getElementById('profile-email').value.trim(),
          phone: document.getElementById('profile-phone').value.trim(),
          age: parseInt(document.getElementById('profile-age').value) || 30,
          weight: parseFloat(document.getElementById('profile-weight').value) || 70,
          height: parseInt(document.getElementById('profile-height').value) || 175,
          gender: document.getElementById('profile-gender').value,
          city: document.getElementById('profile-city').value.trim(),
          state: document.getElementById('profile-state').value,
          photo: this.tempProfilePhoto || existingProfile.photo || ''
        };

        window.storageEngine.saveUserProfile(updatedProfile);
        this.loadUserProfileUi();
        modalProfile.style.display = 'none';
        alert('Cadastro do atleta salvo com sucesso! As calorias serão calculadas com base na sua idade, altura e peso.');
      });
    }
  }

  // Atualiza a visualização do histórico e recordes pessoais
  updateHistoryUi() {
    const list = window.storageEngine.getActivities();
    const container = document.getElementById('history-items-container');
    const prs = window.storageEngine.getPersonalRecords();

    // Atualiza Recordes Pessoais (PRs)
    document.getElementById('pr-longest-dist').textContent = prs.longestDistFormatted;
    document.getElementById('pr-best-pace').textContent = prs.bestPaceFormatted;
    document.getElementById('pr-max-speed').textContent = prs.maxBikeSpeedFormatted;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="empty-history-state">
          <div class="empty-icon">🏃‍♂️🚴</div>
          <h4>Nenhum treino salvo ainda</h4>
          <p>Seus treinos finalizados aparecerão aqui com gráficos e estatísticas completas.</p>
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach(act => {
      const isBike = act.mode === 'bike';
      html += `
        <div class="history-item-card" data-id="${act.id}" style="cursor: pointer;">
          <div class="history-item-left">
            <div class="history-item-icon">${isBike ? '🚴' : '🏃‍♂️'}</div>
            <div class="history-item-meta">
              <span class="history-item-title">${act.title}</span>
              <span class="history-item-date">${act.dateFormatted} • ${act.durationFormatted}</span>
            </div>
          </div>
          <div class="history-item-stats">
            <span class="history-item-dist">${act.distanceKm} km</span>
            <span class="history-item-sub">${isBike ? act.avgSpeed + ' km/h' : act.avgPace + '/km'}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Adiciona listener de clique em cada card do histórico
    container.querySelectorAll('.history-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const act = list.find(a => a.id === id);
        if (act) {
          document.getElementById('modal-history').style.display = 'none';
          document.getElementById('screen-setup').classList.remove('active');
          this.lastSavedActivity = act;
          this.showSummaryScreen(act);
        }
      });
    });
  }

  /* ==========================================================================
     9. SUPORTE A WAKELOCK E PWA
     ========================================================================== */
  async requestWakeLock() {
    const toggle = document.getElementById('toggle-wakelock');
    if (!toggle || !toggle.checked) return;

    if ('wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('WakeLock request failed:', err);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => {});
      this.wakeLockSentinel = null;
    }
  }

  initPwa() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('Service Worker registration skipped:', err);
        });
      });
    }
  }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.pulseTrackerApp = new PulseTrackerApp();
});
