import { useState, useEffect, useCallback } from 'react';
import GoogleAuth from './GoogleAuth';
import googleSheetsService from '../services/googleSheetsService';

const WorkoutTracker = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [dataSource, setDataSource] = useState('online');
  const [pendingChanges, setPendingChanges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadWorkoutData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First try to get cached data
      const cachedData = localStorage.getItem(`workout_${date}`);
      
      if (!isOnline && cachedData) {
        setWorkout(JSON.parse(cachedData));
        setDataSource('cache');
      } else if (isOnline) {
        const data = await googleSheetsService.getWorkoutData(date);
        setWorkout(data);
        // Cache the data
        localStorage.setItem(`workout_${date}`, JSON.stringify(data));
        setDataSource('online');
      }
    } catch (err) {
      console.error('Error loading workout data:', err);
      setError('Unable to load workout data. ' + 
               (isOnline ? 'Please try again later.' : 'You are currently offline.'));
    } finally {
      setLoading(false);
    }
  }, [date, isOnline]);

  // Sync pending changes when online
  const syncPendingChanges = useCallback(async () => {
    if (!isOnline || pendingChanges.length === 0) return;
    
    setIsSaving(true);
    try {
      for (const change of pendingChanges) {
        await googleSheetsService.saveWorkoutData(change);
      }
      setPendingChanges([]);
      localStorage.removeItem('pendingChanges');
      await loadWorkoutData(); // Reload data after successful sync
    } catch (error) {
      setError('Failed to sync changes. Will retry when connection is available.');
      console.error('Sync error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isOnline, pendingChanges, loadWorkoutData]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingChanges(); // Try to sync when coming back online
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingChanges]);

  // Load cached changes from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('pendingChanges');
    if (cached) {
      setPendingChanges(JSON.parse(cached));
    }
  }, []);

  // Handle saving changes
  const handleSave = async (updatedWorkout) => {
    setIsSaving(true);
    try {
      if (isOnline) {
        await googleSheetsService.saveWorkoutData(updatedWorkout);
        await loadWorkoutData();
      } else {
        // Store changes locally when offline
        const change = {
          date,
          workout: updatedWorkout,
          timestamp: new Date().toISOString()
        };
        const newPendingChanges = [...pendingChanges, change];
        setPendingChanges(newPendingChanges);
        localStorage.setItem('pendingChanges', JSON.stringify(newPendingChanges));
        localStorage.setItem(`workout_${date}`, JSON.stringify(updatedWorkout));
        setWorkout(updatedWorkout);
      }
    } catch (error) {
      setError('Failed to save changes. ' + 
               (isOnline ? 'Please try again later.' : 'Changes will be saved when you are back online.'));
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Load data when date changes or online status changes
  useEffect(() => {
    loadWorkoutData();
  }, [loadWorkoutData]);

  const handleAuthStatusChange = (signedIn) => {
    setIsAuthenticated(signedIn);
    if (signedIn) {
      loadWorkoutData(); // Reload data when authenticated
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-50 min-h-screen">
      <GoogleAuth onAuthStatusChange={handleAuthStatusChange} />
      
      {isAuthenticated ? (
        <>
          {/* Status Banners */}
          {!isOnline && (
            <div className="mb-4 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
              You are currently offline. Changes will be saved locally and synced when you&apos;re back online.
            </div>
          )}
          
          {pendingChanges.length > 0 && (
            <div className="mb-4 p-2 bg-blue-100 border border-blue-400 text-blue-700 rounded">
              {`${pendingChanges.length} change(s) pending sync`}
            </div>
          )}

          {dataSource === 'cache' && (
            <div className="mb-4 p-2 bg-blue-100 border border-blue-400 text-blue-700 rounded">
              Showing cached data from your last sync
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={() => handleSave(workout)}
            disabled={isSaving}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading workout data...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Workout Data */}
          {!loading && !error && workout && (
            <div>
              {/* Date Selector */}
              <div className="mb-4">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2 border rounded"
                />
              </div>

              {/* Workout Content */}
              <div>
                {workout.exercises?.map((exercise, index) => (
                  <div key={index} className="mb-4 p-4 bg-white rounded shadow">
                    <h3 className="text-lg font-semibold">{exercise.name}</h3>
                    {/* Exercise details */}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          Please connect to Google Sheets to use the workout tracker.
        </div>
      )}
    </div>
  );
};

export default WorkoutTracker;