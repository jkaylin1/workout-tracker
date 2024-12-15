import React, { useEffect, useState } from 'react';
import type { GoogleOAuthResponse } from '../types/google';
import { Button } from '@/components/ui/button';

interface GoogleAuthProps {
  onAuthStatusChange: (status: boolean) => void;
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthStatusChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    const loadGoogleScript = () => {
      // Check if script is already loaded
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        setScriptLoaded(true);
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google script loaded successfully');
        setScriptLoaded(true);
        setIsLoading(false);
      };
      
      script.onerror = (error) => {
        console.error('Error loading Google script:', error);
        setIsLoading(false);
      };

      document.body.appendChild(script);
    };

    loadGoogleScript();

    // Check authentication status
    const token = localStorage.getItem('gapi_access_token');
    if (token) {
      setIsAuthenticated(true);
      onAuthStatusChange(true);
    }

    return () => {
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script) {
        document.body.removeChild(script);
      }
    };
  }, [onAuthStatusChange]);

  const handleAuthClick = () => {
    if (!scriptLoaded) {
      console.error('Google API not loaded yet');
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (response: GoogleOAuthResponse) => {
          console.log('Auth response received:', response);
          if (response.access_token) {
            localStorage.setItem('gapi_access_token', response.access_token);
            setIsAuthenticated(true);
            onAuthStatusChange(true);
          }
        },
      });
      
      console.log('Requesting access token...');
      client.requestAccessToken();
    } catch (error) {
      console.error('Error during authentication:', error);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('gapi_access_token');
    setIsAuthenticated(false);
    onAuthStatusChange(false);
  };

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {!isAuthenticated ? (
        <Button 
          onClick={handleAuthClick} 
          variant="default"
          disabled={!scriptLoaded}
        >
          {scriptLoaded ? 'Sign in with Google' : 'Loading Google Auth...'}
        </Button>
      ) : (
        <>
          <span className="text-green-600">✓ Signed in</span>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            Sign Out
          </Button>
        </>
      )}
    </div>
  );
};

export default GoogleAuth;