import { Dashboard } from './components/Dashboard/Dashboard';
import './App.css';

// Import FDOT API utils to initialize window functions
import './utils/fdotApi';

function App() {
  return (
    <div className="App">
      <Dashboard />
    </div>
  );
}

export default App;

