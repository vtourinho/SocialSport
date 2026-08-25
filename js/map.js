/**
 * ============================================================================
 * PULSETRACKER - MAP & ROUTE VISUALIZATION ENGINE
 * Renderização de mapa em tela cheia com Leaflet.js, marcador dinâmico e rota
 * ============================================================================
 */

class MapEngine {
  constructor() {
    this.map = null;
    this.summaryMap = null;
    this.tileLayers = {};
    this.currentTileStyle = 'dark'; // 'dark', 'light', 'osm'

    this.athleteMarker = null;
    this.routePolyline = null;
    this.routePoints = [];

    this.isFollowMode = true;
    this.defaultZoom = 17;

    // Coordenadas padrão inicial (São Paulo, Brasil) se não houver GPS de imediato
    this.defaultLocation = [-23.5874, -46.6576]; // Parque Ibirapuera
  }

  // Inicializa ou atualiza o mapa principal na tela de treino
  initWorkoutMap(containerId = 'map-container', initialCoords = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const startPos = initialCoords || this.defaultLocation;

    if (!this.map) {
      // Cria o mapa do Leaflet
      this.map = L.map(containerId, {
        center: startPos,
        zoom: this.defaultZoom,
        zoomControl: false, // Controle customizado
        attributionControl: false
      });

      // Cria camadas de ladrilhos (tiles)
      this.tileLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd'
        }),
        light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd'
        }),
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        })
      };

      // Adiciona camada escura padrão
      this.tileLayers.dark.addTo(this.map);

      // Detecta arrasto manual do usuário no mapa para desativar follow temporariamente
      this.map.on('dragstart', () => {
        this.isFollowMode = false;
        const recenterBtn = document.getElementById('btn-recenter-map');
        if (recenterBtn) recenterBtn.classList.remove('active');
      });

      // Inicializa polilinha da rota
      this.routePolyline = L.polyline([], {
        color: '#ccff00',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.0
      }).addTo(this.map);
    } else {
      this.map.setView(startPos, this.defaultZoom);
    }

    // Coloca imediatamente o marcador do atleta na posição inicial
    this.updateAthletePosition(startPos[0], startPos[1], 0);

    // Múltiplos recálculos de tamanho para garantir renderização perfeita após transição de tela
    [50, 200, 500, 1000].forEach(delay => {
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, delay);
    });
  }

  // Define o estilo da linha de rota conforme a modalidade
  updateRouteStyle(mode = 'run') {
    const color = mode === 'bike' ? '#ff5500' : '#ccff00';
    if (this.routePolyline) {
      this.routePolyline.setStyle({ color: color });
    }
  }

  // Alterna entre estilo Escuro, Claro e Tradicional
  toggleMapStyle() {
    if (!this.map) return;

    if (this.currentTileStyle === 'dark') {
      this.map.removeLayer(this.tileLayers.dark);
      this.tileLayers.osm.addTo(this.map);
      this.currentTileStyle = 'osm';
    } else if (this.currentTileStyle === 'osm') {
      this.map.removeLayer(this.tileLayers.osm);
      this.tileLayers.light.addTo(this.map);
      this.currentTileStyle = 'light';
    } else {
      this.map.removeLayer(this.tileLayers.light);
      this.tileLayers.dark.addTo(this.map);
      this.currentTileStyle = 'dark';
    }
  }

  // Atualiza ou cria o marcador do atleta no mapa
  updateAthletePosition(lat, lng, heading = 0, mode = 'run') {
    if (!this.map) return;

    const latLng = [lat, lng];

    // Cria o marcador com HTML customizado se ainda não existir
    if (!this.athleteMarker) {
      const customIcon = L.divIcon({
        className: 'custom-athlete-icon-wrapper',
        html: `
          <div class="athlete-marker-puck">
            <div class="athlete-pulse-ring"></div>
            <div class="athlete-core-dot" id="athlete-dot-puck">
              <div class="athlete-heading-arrow" id="athlete-heading-arrow"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      this.athleteMarker = L.marker(latLng, { icon: customIcon, zIndexOffset: 1000 }).addTo(this.map);
    } else {
      this.athleteMarker.setLatLng(latLng);
    }

    // Rotaciona a seta indicativa de direção se houver heading
    const arrowEl = document.getElementById('athlete-heading-arrow');
    if (arrowEl && heading) {
      arrowEl.style.transform = `rotate(${heading}deg)`;
    }

    // Adiciona ponto à polilinha da rota
    this.routePoints.push(latLng);
    this.routePolyline.setLatLngs(this.routePoints);

    // Se estiver em modo de acompanhamento automático, centraliza suavemente
    if (this.isFollowMode) {
      this.map.panTo(latLng, { animate: true, duration: 0.6 });
    }
  }

  // Reativa o modo de acompanhamento e centraliza no atleta
  recenter() {
    this.isFollowMode = true;
    const recenterBtn = document.getElementById('btn-recenter-map');
    if (recenterBtn) recenterBtn.classList.add('active');

    if (this.athleteMarker) {
      const pos = this.athleteMarker.getLatLng();
      this.map.setView(pos, this.defaultZoom, { animate: true });
    }
  }

  // Limpa rota para novo treino
  resetRoute() {
    this.routePoints = [];
    if (this.routePolyline) {
      this.routePolyline.setLatLngs([]);
    }
    if (this.athleteMarker && this.map) {
      this.map.removeLayer(this.athleteMarker);
      this.athleteMarker = null;
    }
  }

  // Renderiza mapa estático de resumo pós-treino com enquadramento da rota inteira
  renderSummaryMap(points, mode = 'run', containerId = 'summary-map-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.summaryMap) {
      this.summaryMap.remove();
      this.summaryMap = null;
    }

    if (!points || points.length === 0) return;

    const latLngs = points.map(p => [p.lat, p.lng]);

    this.summaryMap = L.map(containerId, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.summaryMap);

    const routeColor = mode === 'bike' ? '#ff5500' : '#ccff00';

    // Desenha a rota
    const summaryPoly = L.polyline(latLngs, {
      color: routeColor,
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.summaryMap);

    // Marcador de Início (Verde)
    const startPin = L.circleMarker(latLngs[0], {
      radius: 6,
      fillColor: '#10b981',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1
    }).addTo(this.summaryMap);

    // Marcador de Fim (Vermelho/Quadriculado)
    const endPin = L.circleMarker(latLngs[latLngs.length - 1], {
      radius: 6,
      fillColor: '#ef4444',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1
    }).addTo(this.summaryMap);

    try {
      if (latLngs.length > 1) {
        const bounds = summaryPoly.getBounds();
        if (bounds.isValid()) {
          this.summaryMap.fitBounds(bounds, { padding: [25, 25] });
        } else {
          this.summaryMap.setView(latLngs[0], 16);
        }
      } else if (latLngs.length === 1) {
        this.summaryMap.setView(latLngs[0], 16);
      }
    } catch (e) {
      console.warn('fitBounds fallback:', e);
      if (latLngs.length > 0) {
        this.summaryMap.setView(latLngs[0], 16);
      }
    }

    setTimeout(() => {
      if (this.summaryMap) {
        try { this.summaryMap.invalidateSize(); } catch(e) {}
      }
    }, 250);
  }
}

// Instância global
window.mapEngine = new MapEngine();
