import { useRef, useState } from "react";

async function toWav16kMono(blob: Blob): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(buf);
  await ctx.close();

  const targetRate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE"); w(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  });
  return new Blob([view], { type: "audio/wav" });
}

interface Options {
  onText: (text: string) => void;
  onError: (message: string) => void;
  transcribe: (wav: Blob) => Promise<string>;
}

export function useVoiceInput({ onText, onError, transcribe }: Options) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        try {
          const wav = await toWav16kMono(new Blob(chunks.current));
          const text = (await transcribe(wav)).trim();
          if (text) onText(text);
          else onError("Couldn't hear anything. Please try again.");
        } catch (e) {
          onError(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    } catch {
      onError("Microphone access was denied or is unavailable.");
    }
  }

  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  return { recording, transcribing, toggle: () => (recording ? stop() : start()) };
}