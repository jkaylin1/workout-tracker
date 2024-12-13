import { useState, useEffect, useCallback } from 'react';
import googleSheetsService from '../services/googleSheets';
import { Calendar } from 'lucide-react';

const WorkoutTracker = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workout, setWorkout] = useState({
    exercises: [],
    cardio: {
      type: '',
      duration: '',
      distance: '',
      watts: '',
      rpe: ''
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const loadWorkoutData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await googleSheetsService.getWorkoutData(date);
      setWorkout(data);
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading workout data:', err);
      setError('Failed to load workout data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadWorkoutData();
  }, [loadWorkoutData]);

  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    setWorkout(prev => {
      const newWorkout = { ...prev };
      const newExercises = [...prev.exercises];
      const newSets = [...newExercises[exerciseIndex].sets];
      
      newSets[setIndex] = {
        ...newSets[setIndex],
        [field]: value
      };
      
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: newSets
      };
      
      return {
        ...newWorkout,
        exercises: newExercises
      };
    });
    setHasChanges(true);
  };

  const handleNotesChange = (exerciseIndex, value) => {
    setWorkout(prev => {
      const newWorkout = { ...prev };
      const newExercises = [...prev.exercises];
      
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        notes: value
      };
      
      return {
        ...newWorkout,
        exercises: newExercises
      };
    });
    setHasChanges(true);
  };

  const handleCardioChange = (field, value) => {
    setWorkout(prev => ({
      ...prev,
      cardio: {
        ...prev.cardio,
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      await googleSheetsService.updateWorkoutData(date, workout);
      setHasChanges(false);
      await loadWorkoutData(); // Refresh data after saving
    } catch (err) {
      console.error('Error saving workout data:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-50 min-h-screen">
      {/* Header with Save Button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-slate-700">Workout Tracker</h1>
        {hasChanges && (
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Date Picker */}
      <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <label htmlFor="workout-date" className="text-lg font-medium text-slate-600">
            Workout Date
          </label>
          <div className="relative">
            <input
              type="date"
              id="workout-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-3 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Cardio Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-teal-50 border-b border-slate-200 p-4">
            <h2 className="text-xl font-semibold text-slate-700">Cardio</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Modality */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Type
                </label>
                <input
                  type="text"
                  value={workout.cardio.modality || ''}
                  onChange={(e) => handleCardioChange('modality', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., Recumbent Bike"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  value={workout.cardio.minutes || ''}
                  onChange={(e) => handleCardioChange('minutes', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Seconds
                </label>
                <input
                  type="number"
                  value={workout.cardio.seconds || ''}
                  onChange={(e) => handleCardioChange('seconds', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* RPE */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  RPE
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={workout.cardio.rpe || ''}
                  onChange={(e) => handleCardioChange('rpe', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Work:Rest */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Work:Rest
                </label>
                <input
                  type="text"
                  value={workout.cardio.workRest || ''}
                  onChange={(e) => handleCardioChange('workRest', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., 1:1"
                />
              </div>

              {/* Watts */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Watts
                </label>
                <input
                  type="number"
                  value={workout.cardio.watts || ''}
                  onChange={(e) => handleCardioChange('watts', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Notes
              </label>
              <textarea
                value={workout.cardio.notes || ''}
                onChange={(e) => handleCardioChange('notes', e.target.value)}
                placeholder="Add cardio session notes here..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[60px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-8 text-slate-600">Loading workout data...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : workout.exercises.length === 0 ? (
        <div className="text-center py-8 text-slate-600">No exercises found for this date.</div>
      ) : (
        <div className="space-y-6">
          {workout.exercises.map((exercise, exerciseIndex) => (
            <div 
              key={`${exercise.name}-${exerciseIndex}`} 
              className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
            >
              {/* Exercise Header */}
              <div className="bg-slate-50 border-b border-slate-200 p-4">
                <h2 className="text-xl font-semibold text-slate-700">{exercise.name}</h2>
              </div>

              {/* Sets Table */}
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Set</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Reps</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Weight (kg)</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">RIR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercise.sets.map((set, setIndex) => (
                        <tr 
                          key={setIndex}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-4 py-2 text-slate-600">
                            {setIndex + 1}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) => handleSetChange(
                                exerciseIndex,
                                setIndex,
                                'reps',
                                parseInt(e.target.value) || 0
                              )}
                              className="w-20 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.5"
                              value={set.weight}
                              onChange={(e) => handleSetChange(
                                exerciseIndex,
                                setIndex,
                                'weight',
                                parseFloat(e.target.value) || 0
                              )}
                              className="w-24 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={set.rir}
                              onChange={(e) => handleSetChange(
                                exerciseIndex,
                                setIndex,
                                'rir',
                                parseInt(e.target.value) || 0
                              )}
                              className="w-20 px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes Section - Now editable */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label className="block mb-2 text-sm font-medium text-slate-600">
                    Notes
                  </label>
                  <textarea
                    value={exercise.notes}
                    onChange={(e) => handleNotesChange(exerciseIndex, e.target.value)}
                    placeholder="Add exercise notes here..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[60px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkoutTracker;