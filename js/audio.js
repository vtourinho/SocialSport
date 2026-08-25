/**
 * ============================================================================
 * PULSETRACKER - AUDIO & VOICE COACH ENGINE
 * Sintetizador Web Audio API e Web Speech API (Voz em Português)
 * ============================================================================
 */

class AudioCoachEngine {
  constructor() {
    this.audioCtx = null;
    this.voiceEnabled = true;
    this.beepsEnabled = true;
    this.voiceVolume = 1.0;
    this.ptVoice = null;

    this.initVoices();
  }

  // Inicializa o AudioContext com tratamento de segurança de autoplay
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Busca vozes em português instaladas no navegador
  initVoices() {
    if (!('speechSynthesis' in window)) return;

    const findVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prioriza vozes em pt-BR (Brasil)
      this.ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR')) ||
                     voices.find(v => v.lang.startsWith('pt')) || null;
    };

    findVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findVoice;
    }
  }

  // Toca um beep em determinada frequência e duração
  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.25) {
    if (!this.beepsEnabled) return;
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playTone error:', e);
    }
  }

  // Sons de contagem regressiva (3, 2, 1, VAI!)
  playCountdownBeep(num) {
    if (num > 0) {
      this.playTone(440, 'triangle', 0.12, 0.3); // Lá 440Hz
    } else {
      // Som de "VAI!" mais agudo e vitorioso
      this.playTone(880, 'sine', 0.35, 0.4); // Lá 880Hz
    }
  }

  // Som ao pausar treino
  playPauseSound() {
    this.playTone(400, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(300, 'sine', 0.15, 0.2), 100);
  }

  // Som ao retomar treino
  playResumeSound() {
    this.playTone(300, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(500, 'sine', 0.15, 0.25), 100);
  }

  // Som triunfal ao completar um split de 1km
  playSplitChime() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // Acorde C Maior (Dó, Mi, Sol, Dó alto)
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.2, 0.25);
      }, idx * 90);
    });
  }

  // Fala uma mensagem por voz em português
  speak(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Para falas anteriores
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05; // Ritmo ligeiramente enérgico
      utterance.pitch = 1.0;
      utterance.volume = this.voiceVolume;

      if (this.ptVoice) {
        utterance.voice = this.ptVoice;
        utterance.lang = this.ptVoice.lang;
      } else {
        utterance.lang = 'pt-BR';
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // Anúncio falado ao completar cada 1 KM (Split)
  announceKmSplit(kmNumber, lapTimeFormatted, lapPaceFormatted, avgPaceFormatted, mode = 'run') {
    this.playSplitChime();

    let message = '';
    if (mode === 'run') {
      message = `Quilômetro ${kmNumber} completado! Ritmo do quilômetro: ${lapPaceFormatted} por quilômetro. Ritmo médio total: ${avgPaceFormatted}.`;
    } else {
      message = `Quilômetro ${kmNumber} completado! Tempo: ${lapTimeFormatted}.`;
    }

    setTimeout(() => {
      this.speak(message);
    }, 600);
  }
}

// Instância global
window.audioCoach = new AudioCoachEngine();
