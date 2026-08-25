/**
 * ============================================================================
 * PULSETRACKER - STORAGE & ACTIVITY HISTORY ENGINE
 * Gerenciamento de histórico local, recordes pessoais (PRs) e exportação GPX
 * ============================================================================
 */

class StorageEngine {
  constructor() {
    this.STORAGE_KEY = 'pulsetracker_activities_v1';
    this.PROFILE_KEY = 'pulsetracker_user_profile_v1';
  }

  // Obtém o perfil do usuário
  getUserProfile() {
    try {
      const data = localStorage.getItem(this.PROFILE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Erro ao ler perfil:', e);
    }
    // Perfil padrão caso ainda não preenchido
    return {
      name: '',
      nickname: 'Atleta',
      email: '',
      phone: '',
      age: 30,
      height: 175,
      weight: 70,
      gender: 'M',
      city: '',
      state: 'SP',
      photo: ''
    };
  }

  // Salva o perfil do usuário (Local + Supabase)
  saveUserProfile(profile) {
    try {
      localStorage.setItem(this.PROFILE_KEY, JSON.stringify(profile));
      
      // Sincroniza em segundo plano com o Supabase se configurado
      if (window.supabaseService && typeof window.supabaseService.saveProfile === 'function') {
        window.supabaseService.saveProfile(profile).catch(err => {
          console.warn('Supabase profile sync background error:', err);
        });
      }
      return true;
    } catch (e) {
      console.error('Erro ao salvar perfil:', e);
      return false;
    }
  }

  // Obtém todas as atividades salvas
  getActivities() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Erro ao ler localStorage:', e);
      return [];
    }
  }

  // Salva uma nova atividade (Local + Supabase)
  saveActivity(activity) {
    try {
      const list = this.getActivities();
      // Insere no início da lista (mais recente primeiro)
      list.unshift(activity);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));

      // Sincroniza em segundo plano com o Supabase se configurado
      if (window.supabaseService && typeof window.supabaseService.saveActivity === 'function') {
        window.supabaseService.saveActivity(activity).catch(err => {
          console.warn('Supabase activity sync background error:', err);
        });
      }
      return true;
    } catch (e) {
      console.error('Erro ao salvar atividade:', e);
      return false;
    }
  }

  // Exclui uma atividade específica
  deleteActivity(id) {
    try {
      let list = this.getActivities();
      list = list.filter(a => a.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Erro ao excluir atividade:', e);
      return false;
    }
  }

  // Limpa todo o histórico
  clearAll() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Calcula Recordes Pessoais (PRs)
  getPersonalRecords() {
    const list = this.getActivities();
    let longestDistMeters = 0;
    let bestPace1kSeconds = Infinity;
    let maxBikeSpeedKmh = 0;

    for (const act of list) {
      // Maior distância
      if (act.distanceMeters > longestDistMeters) {
        longestDistMeters = act.distanceMeters;
      }

      // Melhor split de 1km (corrida)
      if (act.mode === 'run' && act.splits && act.splits.length > 0) {
        for (const s of act.splits) {
          if (s.rawPaceSeconds && s.rawPaceSeconds < bestPace1kSeconds) {
            bestPace1kSeconds = s.rawPaceSeconds;
          }
        }
      }

      // Maior velocidade de bike
      if (act.mode === 'bike' && act.maxSpeed > maxBikeSpeedKmh) {
        maxBikeSpeedKmh = act.maxSpeed;
      }
    }

    return {
      longestDistFormatted: (longestDistMeters / 1000).toFixed(2) + ' km',
      bestPaceFormatted: bestPace1kSeconds !== Infinity ? window.telemetryEngine.formatPace(bestPace1kSeconds) : `--'--"`,
      maxBikeSpeedFormatted: maxBikeSpeedKmh.toFixed(1) + ' km/h'
    };
  }

  // Dispara o download de um arquivo GPX no navegador
  downloadGpx(gpxContent, filename = 'PulseTracker_Atividade.gpx') {
    try {
      const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao baixar arquivo GPX:', e);
      alert('Erro ao exportar GPX.');
    }
  }
}

// Instância global
window.storageEngine = new StorageEngine();
