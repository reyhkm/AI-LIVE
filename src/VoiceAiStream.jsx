import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import './VoiceAiStream.css'; // CSS untuk styling

// --- Konfigurasi ---
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const LIVE_MODEL = 'gemini-1.5-flash-latest'; // Model yang mendukung audio I/O
const SAMPLE_RATE = 16000; // Sample rate yang umum untuk speech recognition

const ai = new GoogleGenAI(GEMINI_API_KEY);

const VoiceAiStream = () => {
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Klik untuk memulai');
  const [transcript, setTranscript] = useState('');

  // Refs untuk menyimpan objek yang tidak perlu me-render ulang komponen
  const sessionRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const mediaStreamRef = useRef(null);

  // --- Fungsi untuk Memainkan Audio dari AI ---
  const playNextInQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }
    isPlayingRef.current = true;
    
    const audioData = audioQueueRef.current.shift(); // Ambil audio pertama dari antrian
    
    try {
      // Audio dari server adalah base64, kita perlu decode
      const audioBlob = await (await fetch(`data:audio/ogg;base64,${audioData}`)).blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        isPlayingRef.current = false;
        playNextInQueue(); // Mainkan audio selanjutnya jika ada
      };
    } catch (error) {
      console.error("Gagal memainkan audio:", error);
      isPlayingRef.current = false;
      playNextInQueue();
    }
  };

  // --- Fungsi untuk Menghubungkan ke Live AI ---
  const connect = async () => {
    setStatusMessage('Menghubungkan ke AI...');
    try {
      const session = await ai.getGenerativeModel({ model: LIVE_MODEL }).startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: "You are a helpful and responsive AI voice assistant. Keep your answers brief and clear." }]
          },
          {
            role: 'model',
            parts: [{ text: "OK, I'm ready to help!" }]
          }
        ]
      });
      
      const chat = session.withAudioStreaming();
      sessionRef.current = chat;

      setIsConnected(true);
      setStatusMessage('Terhubung. Silakan bicara.');

      // Start processing responses
      (async () => {
        for await (const chunk of chat.stream) {
          const serverMessage = chunk;
          if (serverMessage.text) {
            setTranscript(prev => prev + serverMessage.text);
          }
          if (serverMessage.audio) {
            audioQueueRef.current.push(serverMessage.audio);
            playNextInQueue();
          }
        }
      })().catch(e => {
        console.error("Error processing stream:", e);
        setStatusMessage('Error. Coba lagi.');
        stopListening();
      });

    } catch (error) {
      console.error("Gagal koneksi:", error);
      setStatusMessage('Gagal terhubung. Cek API Key.');
    }
  };

  // --- Fungsi untuk Memulai & Menghentikan Mendengarkan ---
  const startListening = async () => {
    if (isListening) return;
    setIsListening(true);
    setTranscript(''); // Reset transkrip
    await connect();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      await audioContextRef.current.audioWorklet.addModule('audio-processor.js');
      processorRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      processorRef.current.port.onmessage = (event) => {
        if (sessionRef.current) {
          sessionRef.current.sendAudio(event.data);
        }
      };

    } catch (error) {
      console.error("Error mengakses mikrofon:", error);
      setStatusMessage('Gagal akses mikrofon.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (!isListening) return;
    setIsListening(false);
    setStatusMessage('Klik untuk memulai');

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      // The new SDK doesn't have a close method on the chat session itself.
      // It closes when the stream ends or on page unload.
      sessionRef.current = null;
    }
    setIsConnected(false);
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="voice-container">
      <div className="status-display">
        <p>{statusMessage}</p>
      </div>
      <div className="transcript-window">
        <p>{transcript || "Transkrip akan muncul di sini..."}</p>
      </div>
      <button 
        className={`mic-button ${isListening ? 'listening' : ''}`}
        onClick={handleToggleListening}
      >
        {isListening ? 'Stop' : 'Start'}
      </button>
    </div>
  );
};

export default VoiceAiStream;
