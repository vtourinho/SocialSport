/**
 * ============================================================================
 * SOCIALSPORT - SUPABASE CLOUD DATABASE & AUTH SERVICE
 * Autenticação de Usuários, RLS e Sincronização em Nuvem (PostgreSQL)
 * ============================================================================
 */

class SupabaseService {
  constructor() {
    this.CONFIG_KEY = 'socialsport_supabase_config_v1';
    this.client = null;
    this.isConnected = false;
    this.currentUser = null;
    this.config = this.loadConfig();

    this.initClient();
  }

  // Carrega configurações de conexão salvas
  loadConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          url: (parsed.url || '').trim().replace(/\/+$/, ''),
          anonKey: (parsed.anonKey || '').trim()
        };
      }
    } catch (e) {
      console.warn('Erro ao ler config do Supabase:', e);
    }
    return {
      url: 'https://ecnoikcjvdhjueqtdovd.supabase.co',
      anonKey: ''
    };
  }

  // Salva novas credenciais de conexão do Supabase
  saveConfig(url, anonKey) {
    this.config = {
      url: (url || '').trim().replace(/\/+$/, ''),
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
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        this.isConnected = true;

        // Recupera sessão ativa
        this.client.auth.getSession().then(({ data: { session } }) => {
          this.currentUser = session ? session.user : null;
        }).catch(() => {});

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

  // Registra listener de mudanças de estado de login/logout
  onAuthStateChange(callback) {
    if (!this.client) return;
    this.client.auth.onAuthStateChange((event, session) => {
      this.currentUser = session ? session.user : null;
      if (typeof callback === 'function') {
        callback(event, session, this.currentUser);
      }
    });
  }

  // Retorna usuário logado atualmente
  async getCurrentUser() {
    if (!this.client) return null;
    try {
      const { data: { user } } = await this.client.auth.getUser();
      this.currentUser = user;
      return user;
    } catch (e) {
      return null;
    }
  }

  // 1. Criar Nova Conta (Sign Up)
  async signUp(email, password, metadata = {}) {
    if (!this.initClient()) {
      return { success: false, message: 'Supabase não configurado. Adicione a URL e Anon Key nas configurações.' };
    }

    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) {
        return { success: false, message: error.message };
      }

      this.currentUser = data.user;
      return { success: true, user: data.user, session: data.session };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // 2. Fazer Login (Sign In)
  async signIn(email, password) {
    if (!this.initClient()) {
      return { success: false, message: 'Supabase não configurado. Adicione a URL e Anon Key nas configurações.' };
    }

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, message: error.message };
      }

      this.currentUser = data.user;
      return { success: true, user: data.user, session: data.session };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // 3. Fazer Logout (Sign Out)
  async signOut() {
    if (!this.client) return { success: true };

    try {
      await this.client.auth.signOut();
      this.currentUser = null;
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // Testa conexão com o banco de dados
  async testConnection() {
    if (!this.initClient()) {
      return { success: false, message: 'URL ou Chave Anônima do Supabase ausentes.' };
    }

    try {
      const { data, error } = await this.client.from('activities').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        // Ignora erro de RLS (que é normal se não estiver logado)
        if (error.message.includes('permission denied') || error.code === '42501') {
          this.isConnected = true;
          return { success: true, message: 'Conectado com sucesso ao Supabase (RLS ativo)!' };
        }
        return { success: false, message: `Erro: ${error.message}` };
      }
      this.isConnected = true;
      return { success: true, message: 'Conectado com sucesso ao Supabase!' };
    } catch (e) {
      return { success: false, message: `Falha de rede ao conectar: ${e.message}` };
    }
  }

  // Salva ou atualiza perfil no Supabase para o usuário autenticado
  async saveProfile(profile) {
    const user = await this.getCurrentUser();
    if (!this.isConnected || !this.client || !user) return null;

    try {
      const payload = {
        user_id: user.id,
        name: profile.name || 'Atleta',
        nickname: profile.nickname || 'Atleta',
        email: profile.email || user.email || null,
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
        .upsert([payload], { onConflict: 'user_id' })
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

  // Busca perfil do usuário logado no Supabase
  async fetchProfile() {
    const user = await this.getCurrentUser();
    if (!this.isConnected || !this.client || !user) return null;

    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        name: data.name,
        nickname: data.nickname,
        email: data.email,
        phone: data.phone,
        age: data.age,
        weight: data.weight,
        height: data.height,
        gender: data.gender,
        city: data.city,
        state: data.state,
        photo: data.photo_url
      };
    } catch (e) {
      return null;
    }
  }

  // Salva uma atividade realizada exclusivamente para o usuário autenticado
  async saveActivity(act) {
    const user = await this.getCurrentUser();
    if (!this.isConnected || !this.client || !user) {
      console.log('Atividade salva localmente (faça login para sincronizar no Supabase)');
      return null;
    }

    try {
      const payload = {
        user_id: user.id,
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
        console.error('❌ Erro Supabase ao salvar atividade:', error.message, error.details, error.hint);
        return null;
      }
      console.log('✅ Atividade salva com sucesso no Supabase:', data);
      return data && data[0] ? data[0] : null;
    } catch (e) {
      console.error('❌ Exceção ao salvar atividade no Supabase:', e);
      return null;
    }
  }

  // Busca histórico de atividades pertencentes exclusivamente ao usuário autenticado (protegido por RLS)
  async fetchActivities() {
    const user = await this.getCurrentUser();
    if (!this.isConnected || !this.client || !user) return [];

    try {
      const { data, error } = await this.client
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
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
