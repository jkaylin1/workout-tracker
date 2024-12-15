// Types for workout data structure
export interface Set {
  reps: number;
  weight: number;
  rir: number;
}

export interface Exercise {
  name: string;
  sets: Set[];
  notes?: string;
}

export interface CardioSession {
  modality: string;
  minutes: number;
  seconds: number;
  rpe: number;
  workRest: string;
  watts: number;
  notes: string;
}

export interface WorkoutData {
  date: string;
  exercises: Exercise[];
  cardio: CardioSession;
}

// Helper functions for Google Sheets data transformation
export const parseWorkoutRow = (row: any[]): Exercise | null => {
  if (!row[8]) return null; // No exercise name in column I
  
  const sets: Set[] = [];
  // Check each set of columns (N-P-Q, R-S-T, etc.)
  const setColumns = [
    { reps: 13, weight: 14, rir: 15 },
    { reps: 16, weight: 17, rir: 18 },
    { reps: 19, weight: 20, rir: 21 }
  ];

  for (const cols of setColumns) {
    if (row[cols.reps]) {
      sets.push({
        reps: parseInt(row[cols.reps]) || 0,
        weight: parseFloat(row[cols.weight]) || 0,
        rir: parseInt(row[cols.rir]) || 0
      });
    }
  }

  return {
    name: row[8],
    sets,
    notes: row[37] || '' // Column AL for notes
  };
};

export const parseCardioRow = (row: any[]): CardioSession | null => {
  if (!row[8]) return null; // No modality in column I
  
  return {
    modality: row[8] || '',    // Column I
    minutes: parseInt(row[11]) || 0,  // Column L
    seconds: parseInt(row[12]) || 0,  // Column M
    rpe: parseInt(row[16]) || 0,      // Column Q
    workRest: row[17] || '',          // Column R
    watts: parseInt(row[24]) || 0,    // Column Y
    notes: row[64] || ''              // Column BM
  };
};

export const formatSheetData = (exerciseData: Set[], cardioData: CardioSession): string[][] => {
  const exerciseRows: string[][] = exerciseData.map(set => {
    const row = new Array(38).fill('');
    // Set the exercise data in the appropriate columns
    row[13] = set.reps.toString();
    row[14] = set.weight.toString();
    row[15] = set.rir.toString();
    return row;
  });

  const cardioRow = new Array(65).fill('');
  cardioRow[8] = cardioData.modality;
  cardioRow[11] = cardioData.minutes.toString();
  cardioRow[12] = cardioData.seconds.toString();
  cardioRow[16] = cardioData.rpe.toString();
  cardioRow[17] = cardioData.workRest;
  cardioRow[24] = cardioData.watts.toString();
  cardioRow[64] = cardioData.notes;

  return [...exerciseRows, cardioRow];
};