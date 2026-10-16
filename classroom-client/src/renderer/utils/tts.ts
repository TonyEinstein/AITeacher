/**
 * TTS 语音合成工具
 * 优先使用浏览器原生 Web Speech API（零依赖，本地运行）
 * 可选：通过后端代理调用腾讯云 TTS（质量更好，需网络）
 */

export interface TTSSpeakOptions {
  rate?: number;      // 语速 0.5-2.0，默认 1.0
  pitch?: number;     // 音调 0-2，默认 1.0
  volume?: number;     // 音量 0-1，默认 1.0
  voiceName?: string;  // 指定语音名称
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number) => void; // 口型同步用
}

class TTSManager {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private speaking = false;
  private paused = false;
  private queue: string[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      // 语音列表异步加载
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  /** 获取可用的中文语音列表 */
  getChineseVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(v => v.lang.startsWith('zh') || v.lang.includes('CN'));
  }

  /** 是否支持 TTS */
  isSupported(): boolean {
    return !!this.synth;
  }

  /** 是否正在说话 */
  isSpeaking(): boolean {
    return this.speaking;
  }

  /**
   * 朗读文本
   * @param text 要朗读的文本
   * @param options 选项
   */
  speak(text: string, options: TTSSpeakOptions = {}): void {
    if (!this.synth || !text.trim()) return;

    // 如果正在说话，先取消
    if (this.speaking) {
      this.stop();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;
    utterance.lang = 'zh-CN';

    // 选择中文语音
    const chineseVoices = this.getChineseVoices();
    if (options.voiceName) {
      const v = this.voices.find(v => v.name === options.voiceName);
      if (v) utterance.voice = v;
    } else if (chineseVoices.length > 0) {
      // 优先选普通话女声
      const preferred = chineseVoices.find(v =>
        v.name.includes('Xiaoxiao') || v.name.includes('Female') || v.name.includes('女')
      ) || chineseVoices[0];
      utterance.voice = preferred;
    }

    utterance.onstart = () => {
      this.speaking = true;
      this.paused = false;
      options.onStart?.();
    };

    utterance.onend = () => {
      this.speaking = false;
      options.onEnd?.();
      this.processQueue();
    };

    utterance.onerror = () => {
      this.speaking = false;
      options.onEnd?.();
    };

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      options.onBoundary?.(e.charIndex);
    };

    this.synth.speak(utterance);
  }

  /**
   * 按句队列朗读（长文本自动分句）
   */
  speakLong(text: string, options: TTSSpeakOptions = {}): void {
    // 按句号、问号、感叹号、分号分句
    const sentences = text.split(/(?<=[。！？；!?;])/).filter(s => s.trim());
    this.queue = sentences;
    this.processQueue(options);
  }

  private processQueue(options: TTSSpeakOptions = {}) {
    if (this.queue.length === 0) {
      return;
    }
    if (this.speaking) return;
    const sentence = this.queue.shift();
    if (sentence) {
      this.speak(sentence, {
        ...options,
        onEnd: () => {
          options.onEnd?.();
          this.processQueue(options);
        },
      });
    }
  }

  /** 暂停 */
  pause(): void {
    if (this.synth && this.speaking) {
      this.synth.pause();
      this.paused = true;
    }
  }

  /** 恢复 */
  resume(): void {
    if (this.synth && this.paused) {
      this.synth.resume();
      this.paused = false;
    }
  }

  /** 停止 */
  stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.speaking = false;
      this.paused = false;
      this.queue = [];
    }
  }

  /**
   * 设置 AI 教学风格（影响语速和音调）
   * serious: 严肃 - 语速稍慢，音调低
   * gentle: 温柔 - 语速慢，音调中
   * humorous: 幽默 - 语速快，音调高
   */
  setStyle(style: 'serious' | 'gentle' | 'humorous'): TTSSpeakOptions {
    const map: Record<string, TTSSpeakOptions> = {
      serious: { rate: 0.85, pitch: 0.8 },
      gentle: { rate: 0.9, pitch: 1.0 },
      humorous: { rate: 1.15, pitch: 1.2 },
    };
    return map[style] || { rate: 1.0, pitch: 1.0 };
  }
}

export const tts = new TTSManager();
export default tts;
