interface GoogleOAuthResponse {
    access_token?: string;
  }
  
  interface TokenClient {
    requestAccessToken: () => void;
  }
  
  interface OAuth2 {
    initialize: (config: {
      client_id: string;
      scope: string;
      callback: (response: GoogleOAuthResponse) => void;
    }) => void;
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: GoogleOAuthResponse) => void;
    }) => TokenClient;
  }
  
  interface GoogleAccounts {
    oauth2: OAuth2;
  }
  
  interface Google {
    accounts: GoogleAccounts;
  }
  
  declare global {
    interface Window {
      google: Google;
    }
  }
  
  export type { GoogleOAuthResponse, TokenClient, OAuth2, GoogleAccounts, Google };