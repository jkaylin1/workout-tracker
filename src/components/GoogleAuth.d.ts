import React from 'react';

declare const GoogleAuth: React.FC<{
  onAuthStatusChange: (status: boolean) => void;
}>;

export default GoogleAuth;