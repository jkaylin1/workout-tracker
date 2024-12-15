import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Save, Calendar } from 'lucide-react';
import type { WorkoutData, Set } from '../types/workout';
import GoogleAuth from './GoogleAuth';
import googleSheetsService from '../services/googleSheets';

const WorkoutTracker = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workout, setWorkout] = useState<WorkoutData>({
    date: '',
    exercises: [],
    cardio: {
      modality: '',
      minutes: 0,
      seconds: 0,
      rpe: 0,
      workRest: '',
      watts: 0,
      notes: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  useEffect(() => {
    const loadWorkout = async () => {
      if (!isAuthenticated) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await googleSheetsService.getWorkoutData(date);
        setWorkout(data);
      } catch (err) {
        console.error('Error loading workout:', err);
        setError('Failed to load workout data');
      } finally {
        setLoading(false);
      }
    };

    loadWorkout();
  }, [date, isAuthenticated]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await googleSheetsService.updateWorkoutData(date, workout);
      // Don't reload the data after a successful save
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Failed to save workout');
      // Only reload data if there was an error
      const data = await googleSheetsService.getWorkoutData(date);
      setWorkout(data);
    } finally {
      setLoading(false);
    }
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof Set, value: number) => {
    const newWorkout = { ...workout };
    if (newWorkout.exercises[exerciseIndex] && newWorkout.exercises[exerciseIndex].sets[setIndex]) {
      newWorkout.exercises[exerciseIndex].sets[setIndex][field] = value;
      setWorkout(newWorkout);
    }
  };

  const updateCardio = (field: keyof WorkoutData['cardio'], value: any) => {
    setWorkout(prev => ({
      ...prev,
      cardio: {
        ...prev.cardio,
        [field]: value
      }
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="sticky top-0 bg-background pt-2 pb-4 border-b z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <GoogleAuth onAuthStatusChange={setIsAuthenticated} />
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            size="sm"
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {error && (
          <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-8">Loading...</div>
      ) : (
        <div className="space-y-4 mt-4">
          {/* Exercises */}
          {workout.exercises.map((exercise, exerciseIndex) => (
            <Card key={exerciseIndex} className="overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpandedExercise(
                  expandedExercise === exerciseIndex ? null : exerciseIndex
                )}
              >
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between bg-muted">
                  <div>
                    <h3 className="text-lg font-semibold">{exercise.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {exercise.sets.length} sets
                    </p>
                  </div>
                  {expandedExercise === exerciseIndex ? 
                    <ChevronUp className="h-5 w-5" /> : 
                    <ChevronDown className="h-5 w-5" />
                  }
                </CardHeader>
              </button>

              {expandedExercise === exerciseIndex && (
                <CardContent className="p-4">
                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="mb-4 last:mb-0">
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Set {setIndex + 1}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-sm">Weight (kg)</Label>
                          <Input
                            type="number"
                            value={set.weight}
                            onChange={(e) => updateSet(exerciseIndex, setIndex, 'weight', parseFloat(e.target.value))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Reps</Label>
                          <Input
                            type="number"
                            value={set.reps}
                            onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', parseInt(e.target.value))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">RIR</Label>
                          <Input
                            type="number"
                            value={set.rir}
                            onChange={(e) => updateSet(exerciseIndex, setIndex, 'rir', parseInt(e.target.value))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Notes field for exercise */}
                  <div className="mt-4">
                    <Label className="text-sm">Notes</Label>
                    <Input
                      value={exercise.notes || ''}
                      onChange={(e) => {
                        const newWorkout = { ...workout };
                        newWorkout.exercises[exerciseIndex].notes = e.target.value;
                        setWorkout(newWorkout);
                      }}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Cardio Section */}
          <Card>
            <CardHeader className="py-2 bg-muted">
              <h2 className="text-lg font-semibold">Cardio</h2>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Exercise</Label>
                <Input
                  value={workout.cardio.modality}
                  onChange={(e) => updateCardio('modality', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    value={workout.cardio.minutes}
                    onChange={(e) => updateCardio('minutes', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>RPE</Label>
                  <Input
                    type="number"
                    value={workout.cardio.rpe}
                    onChange={(e) => updateCardio('rpe', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              {/* Notes field for cardio */}
              <div>
                <Label>Notes</Label>
                <Input
                  value={workout.cardio.notes}
                  onChange={(e) => updateCardio('notes', e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WorkoutTracker;