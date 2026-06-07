import { useState } from 'react';
import type { Skill } from './types';
import { Home } from './components/Home';
import { Train } from './modes/Train';
import { WarmUpSession } from './modes/WarmUpSession';
import { Dashboard } from './components/Dashboard';

type Screen =
  | { name: 'home' }
  | { name: 'train'; skill: Skill }
  | { name: 'warmup' }
  | { name: 'dashboard' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });

  return (
    <main className="min-h-screen bg-slate-950">
      {screen.name === 'home' && (
        <Home
          onTrain={(skill) => setScreen({ name: 'train', skill })}
          onWarmUp={() => setScreen({ name: 'warmup' })}
          onDashboard={() => setScreen({ name: 'dashboard' })}
        />
      )}
      {screen.name === 'train' && <Train skill={screen.skill} onExit={home} />}
      {screen.name === 'warmup' && <WarmUpSession onExit={home} />}
      {screen.name === 'dashboard' && <Dashboard onExit={home} />}
    </main>
  );
}
