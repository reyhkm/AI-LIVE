import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/genai';
import './VoiceAiStream.css';

// --- Konfigurasi ---
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash-latest';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// Helper untuk mengubah Blob menjadi string Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // Hapus prefix data URL
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const VoiceAiStream = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Klik untuk merekam');
  const [transcript, setTranscript] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const chatRef = useRef(null);

  // Inisialisasi chat session saat komponen dimuat
  useEffect(() => {
    chatRef.current = model.startChat({
      history: [
        { role: 'user', parts: [{ text: "You are a helpful and responsive AI voice assistant named Gemini. Keep your answers brief and clear." }] },
        { role: 'model', parts: [{ text: "OK, I'm ready to help! How can I assist you today?" }] }
      ]
    });
  }, []);

  // --- Fungsi untuk Memainkan Audio dari AI ---
  const playNextInQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }
    isPlayingRef.current = true;
    
    const audioData = audioQueueRef.current.shift();
    
    try {
      const audioBlob = await (await fetch(`data:audio/ogg;base64,${audioData}`)).blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        isPlayingRef.current = false;
        playNextInQueue();
      };
    } catch (error) {
      console.error("Gagal memainkan audio:", error);
      isPlayingRef.current = false;
      playNextInQueue();
    }
  };

  // --- Fungsi untuk Memulai & Menghentikan Merekam ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        setStatusMessage('Memproses audio...');
        setTranscript('');

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64Audio = await blobToBase64(audioBlob);

        try {
          const result = await chatRef.current.sendMessageStream([
            { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
          ]);

          setStatusMessage('AI sedang menjawab...');
          let fullResponse = "";
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              fullResponse += chunkText;
              setTranscript(fullResponse);
            }
            
            if (chunk.candidates && chunk.candidates[0].content.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                  audioQueueRef.current.push(part.inlineData.data);
                  playNextInQueue();
                }
              }
            }
          }
        } catch (error) {
          console.error("Gagal mengirim audio ke Gemini:", error);
          setStatusMessage('Gagal memproses audio. Coba lagi.');
        } finally {
          setIsProcessing(false);
          setStatusMessage('Klik untuk merekam');
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatusMessage('Merekam... Klik untuk berhenti.');
    } catch (error) {
      console.error("Gagal mengakses mikrofon:", error);
      setStatusMessage('Gagal akses mikrofon.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
  };

  const handleToggleRecording = () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getButtonText = () => {
    if (isProcessing) return 'Proses...';
    if (isRecording) return 'Stop';
    return 'Start';
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
        className={`mic-button ${isRecording ? 'listening' : ''}`}
        onClick={handleToggleRecording}
        disabled={isProcessing}
      >
        {getButtonText()}
      </button>
    </div>
  );
};

export default VoiceAiStream;
