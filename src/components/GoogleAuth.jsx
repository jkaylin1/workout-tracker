import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const GoogleAuth = ({ onAuthStatusChange }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const loadGoogleAuth = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = initializeGoogleAuth;
      document.body.appendChild(script);
    };

    const initializeGoogleAuth = () => {
      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            plugin_name: 'workout_tracker'
          });

          const authInstance = window.gapi.auth2.getAuthInstance();
          setIsSignedIn(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen((signedIn) => {
            setIsSignedIn(signedIn);
            onAuthStatusChange(signedIn);
          });
          setAuthInitialized(true);
        } catch (error) {
          console.error('Google Auth initialization error:', error);
        }
      });
    };

    loadGoogleAuth();
  }, [onAuthStatusChange]);

  const handleSignIn = () => {
    window.gapi.auth2.getAuthInstance().signIn();
  };

  const handleSignOut = () => {
    window.gapi.auth2.getAuthInstance().signOut();
  };

  if (!authInitialized) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-gray-600">Initializing authentication...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4 p-4">
      {isSignedIn ? (
        <div className="flex items-center space-x-4">
          <span className="text-green-600">✓ Connected to Google Sheets</span>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Connect Google Sheets
        </button>
      )}
    </div>
  );
};

GoogleAuth.propTypes = {
  onAuthStatusChange: PropTypes.func.isRequired
};

export default GoogleAuth;