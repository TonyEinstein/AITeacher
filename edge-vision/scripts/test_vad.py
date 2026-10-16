"""
Silero VAD 语音活动检测：本地检测"有人说话"的片段，零云成本。

用法:
  # 从麦克风实时检测
  python scripts/test_vad.py --mic

  # 从音频文件检测
  python scripts/test_vad.py --file path/to/audio.wav

依赖:
  pip install silero-vad torchaudio sounddevice
"""
from __future__ import annotations

import argparse
import logging
from dataclasses import dataclass
from typing import Iterator

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class SpeechSegment:
    start_sec: float
    end_sec: float
    confidence: float


class VoiceActivityDetector:
    """Silero VAD 封装：检测音频流中的人声片段。"""

    SAMPLE_RATE = 16000
    WINDOW_SAMPLES = 512  # 32ms @ 16kHz

    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold
        self._model = None

    def _load(self):
        if self._model is not None:
            return
        import torch
        self._model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True,
        )
        logger.info("Silero VAD 模型已加载")

    def is_speech(self, audio_chunk: np.ndarray) -> float:
        """检测一段 16kHz mono 音频是否有人声，返回 0-1 置信度。"""
        self._load()
        import torch
        tensor = torch.from_numpy(audio_chunk).float()
        return float(self._model(tensor, self.SAMPLE_RATE).item())

    def detect_file(self, audio_path: str) -> list[SpeechSegment]:
        """从音频文件检测所有说话片段。"""
        self._load()
        import torchaudio
        wav, sr = torchaudio.load(audio_path)
        if sr != self.SAMPLE_RATE:
            wav = torchaudio.functional.resample(wav, sr, self.SAMPLE_RATE)
        mono = wav.mean(dim=0).numpy()

        segments: list[SpeechSegment] = []
        in_speech = False
        seg_start = 0.0
        confidence_sum = 0.0
        conf_count = 0

        for i in range(0, len(mono) - self.WINDOW_SAMPLES, self.WINDOW_SAMPLES):
            chunk = mono[i : i + self.WINDOW_SAMPLES]
            conf = self.is_speech(chunk)
            t = i / self.SAMPLE_RATE

            if conf >= self.threshold:
                if not in_speech:
                    in_speech = True
                    seg_start = t
                    confidence_sum = 0.0
                    conf_count = 0
                confidence_sum += conf
                conf_count += 1
            else:
                if in_speech:
                    segments.append(
                        SpeechSegment(
                            start_sec=seg_start,
                            end_sec=t,
                            confidence=confidence_sum / max(conf_count, 1),
                        )
                    )
                    in_speech = False

        if in_speech:
            segments.append(
                SpeechSegment(
                    start_sec=seg_start,
                    end_sec=len(mono) / self.SAMPLE_RATE,
                    confidence=confidence_sum / max(conf_count, 1),
                )
            )
        return segments


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=str, help="音频文件路径")
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    vad = VoiceActivityDetector(threshold=args.threshold)
    if args.file:
        segs = vad.detect_file(args.file)
        print(f"\n检测到 {len(segs)} 段人声:")
        for s in segs:
            print(f"  {s.start_sec:.1f}s - {s.end_sec:.1f}s  (置信度 {s.confidence:.2f})")
    else:
        print("请用 --file 指定音频文件，或接麦克风（后续实现）")


if __name__ == "__main__":
    main()
