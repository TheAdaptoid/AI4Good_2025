import { Dashboard } from './components/Dashboard/Dashboard';
import './App.css';

// Import FDOT API utils to initialize window functions (dev only)
if (import.meta.env.DEV) {
  import('./utils/fdotApi');
}

function App() {
  return (
    <div className="App">
      <Dashboard />
    </div>
  );
}

export default App;

