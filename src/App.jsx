import VoiceAiStream from './VoiceAiStream';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Live Voice AI Stream</h1>
        <p>Bicara dengan Gemini secara real-time</p>
      </header>
      <main>
        <VoiceAiStream />
      </main>
    </div>
  );
}

export default App;
