import { useEffect } from 'react';
import WorkoutTracker from './components/WorkoutTracker';

function App() {
  useEffect(() => {
    const loadGoogleApi = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    };

    loadGoogleApi();
  }, []);

  return (
    <WorkoutTracker />
  );
}

export default App;