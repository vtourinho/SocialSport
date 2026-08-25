/**
 * ============================================================================
 * SOCIALSPORT - SUPABASE CLOUD DATABASE SERVICE
 * Sincronização em nuvem com PostgreSQL (Perfis e Atividades Esportivas)
 * ============================================================================
 */

class SupabaseService {
  constructor() {
    this.CONFIG_KEY = 'socialsport_supabase_config_v1';
    this.client = null;
    this.isConnected = false;
    this.config = this.loadConfig();

    this.initClient();
  }

  // Carrega configurações de conexão salvas
  loadConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Erro ao ler config do Supabase:', e);
    }
    return {
      url: '',
      anonKey: ''
    };
  }

  // Salva novas credenciais de conexão do Supabase
  saveConfig(url, anonKey) {
    this.config = {
      url: (url || '').trim(),
      anonKey: (anonKey || '').trim()
    };
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {}

    return this.initClient();
  }

  // Inicializa o cliente do Supabase SDK
  initClient() {
    if (!this.config.url || !this.config.anonKey) {
      this.client = null;
      this.isConnected = false;
      return false;
    }

    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(this.config.url, this.config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
        this.isConnected = true;
        return true;
      } catch (e) {
        console.error('Erro ao inicializar cliente Supabase:', e);
        this.client = null;
        this.isConnected = false;
        return false;
      }
    }
    return false;
  }

  // Testa conexão com o banco de dados
  async testConnection() {
    if (!this.initClient()) {
      return { success: false, message: 'URL ou Chave Anônima do Supabase ausentes.' };
    }

    try {
      const { data, error } = await this.client.from('profiles').select('id').limit(1);
      if (error) {
        return { success: false, message: `Erro ao consultar Supabase: ${error.message}` };
      }
      this.isConnected = true;
      return { success: true, message: 'Conectado com sucesso ao Supabase!' };
    } catch (e) {
      return { success: false, message: `Falha de rede ao conectar: ${e.message}` };
    }
  }

  // Salva ou atualiza perfil no Supabase
  async saveProfile(profile) {
    if (!this.isConnected || !this.client) return null;

    try {
      const payload = {
        name: profile.name || 'Atleta',
        nickname: profile.nickname || 'Atleta',
        email: profile.email || null,
        phone: profile.phone || null,
        age: profile.age || 30,
        weight: profile.weight || 70,
        height: profile.height || 175,
        gender: profile.gender || 'M',
        city: profile.city || null,
        state: profile.state || 'SP',
        photo_url: profile.photo || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.client
        .from('profiles')
        .insert([payload])
        .select();

      if (error) {
        console.warn('Aviso ao sincronizar perfil no Supabase:', error.message);
        return null;
      }
      return data && data[0] ? data[0] : null;
    } catch (e) {
      console.warn('Erro ao salvar perfil no Supabase:', e);
      return null;
    }
  }

  // Salva uma atividade no Supabase
  async saveActivity(act) {
    if (!this.isConnected || !this.client) return null;

    try {
      const payload = {
        local_id: act.id,
        mode: act.mode,
        title: act.title,
        date_formatted: act.dateFormatted,
        timestamp: act.timestamp,
        duration_seconds: act.durationSeconds,
        duration_formatted: act.durationFormatted,
        distance_meters: act.distanceMeters,
        distance_km: act.distanceKm,
        avg_pace: act.avgPace,
        avg_speed: act.avgSpeed,
        max_speed: act.maxSpeed,
        calories: act.calories || 0,
        splits: act.splits || [],
        points: act.points || []
      };

      const { data, error } = await this.client
        .from('activities')
        .insert([payload])
        .select();

      if (error) {
        console.warn('Aviso ao salvar atividade no Supabase:', error.message);
        return null;
      }
      return data && data[0] ? data[0] : null;
    } catch (e) {
      console.warn('Erro ao salvar atividade no Supabase:', e);
      return null;
    }
  }

  // Busca histórico de atividades do Supabase
  async fetchActivities() {
    if (!this.isConnected || !this.client) return [];

    try {
      const { data, error } = await this.client
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('Aviso ao buscar atividades do Supabase:', error.message);
        return [];
      }

      return (data || []).map(row => ({
        id: row.local_id || row.id,
        mode: row.mode,
        title: row.title,
        dateFormatted: row.date_formatted,
        timestamp: row.timestamp,
        durationSeconds: row.duration_seconds,
        durationFormatted: row.duration_formatted,
        distanceMeters: row.distance_meters,
        distanceKm: row.distance_km,
        avgPace: row.avg_pace,
        avgSpeed: row.avg_speed,
        maxSpeed: row.max_speed,
        calories: row.calories,
        splits: row.splits || [],
        points: row.points || []
      }));
    } catch (e) {
      console.warn('Erro ao carregar atividades do Supabase:', e);
      return [];
    }
  }
}

// Instância global
window.supabaseService = new SupabaseService();
