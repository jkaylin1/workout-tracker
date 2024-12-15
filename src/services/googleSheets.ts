import { WorkoutData, Exercise, CardioSession } from '../types/workout';

interface SheetResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

interface CellUpdate {
  promise: Promise<void>;
  row: number;
  col: number;
  value: string;
}

class GoogleSheetsService {
  private readonly SPREADSHEET_ID: string;

  constructor() {
    this.SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
  }

  private getAuthToken(): string {
    const token = localStorage.getItem('gapi_access_token');
    if (!token) throw new Error('No authentication token available');
    return token;
  }

  private async fetchSheetData(range: string): Promise<SheetResponse> {
    const token = this.getAuthToken();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('gapi_access_token');
        throw new Error('Authentication expired');
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  private parseDate(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Remove any leading/trailing whitespace
    dateStr = dateStr.trim();
    
    // Extract the date portion if it includes day of week (e.g., "Thu 12/12")
    const dateParts = dateStr.split(' ');
    if (dateParts.length > 1) {
      // Take the last part which should be the actual date
      dateStr = dateParts[dateParts.length - 1];
    }
    
    // If the date includes a year, remove it
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        // If it's MM/DD/YYYY format, take just MM/DD
        return `${parts[0]}/${parts[1]}`;
      }
    }
    
    return dateStr;
  }

  private parseExerciseRow(row: string[]): Exercise | null {
    // Skip if no exercise name in column I (index 8)
    if (!row[8]) return null;

    const sets = [];
    // Process three possible sets using the correct column indices
    const setGroups = [
      { reps: 14, weight: 15, rir: 16 },  // O, P, Q columns (0-based)
      { reps: 17, weight: 18, rir: 19 },  // R, S, T columns
      { reps: 20, weight: 21, rir: 22 }   // U, V, W columns
    ];

    for (const group of setGroups) {
      // Only add set if reps value exists and is a number
      const repsStr = row[group.reps];
      if (repsStr && !isNaN(Number(repsStr))) {
        const weightStr = row[group.weight];
        const rirStr = row[group.rir];
        
        sets.push({
          reps: parseInt(repsStr) || 0,
          weight: parseFloat(weightStr) || 0,
          rir: parseInt(rirStr) || 0
        });
      }
    }

    return {
      name: row[8].trim(),  // Column I, remove any whitespace
      sets
    };
  }

  async getWorkoutData(date: string): Promise<WorkoutData> {
    try {
      const parsedDate = this.parseDate(new Date(date));
      console.log('Looking for date:', parsedDate);
      
      // Fetch workout data
      const workoutData = await this.fetchSheetData("'workout log'!A:AL");
      const workoutRows = workoutData.values || [];
      
      // Find rows matching the date
      const matchingWorkoutRows = workoutRows.filter(row => {
        if (!row[6]) return false; // Skip rows with no date
        const rowDate = this.normalizeDate(row[6]);
        const matches = rowDate === parsedDate;
        console.log(`Comparing row date '${row[6]}' (normalized: '${rowDate}') with parsed date '${parsedDate}'`, matches);
        return matches;
      });
      
      console.log('Found matching workout rows:', matchingWorkoutRows);

      // Process exercises
      const exercises: Exercise[] = [];
      for (const row of matchingWorkoutRows) {
        const exercise = this.parseExerciseRow(row);
        if (exercise) {
          exercises.push(exercise);
        }
      }

      // Fetch cardio data
      const cardioData = await this.fetchSheetData("'cardio log'!A:BM");
      const cardioRows = cardioData.values || [];
      
      // Find matching cardio row (using column F for date)
      const cardioRow = cardioRows.find(row => {
        if (!row[5]) return false;
        return this.normalizeDate(row[5]) === parsedDate;
      });
      
      console.log('Found matching cardio row:', cardioRow);

      const cardio: CardioSession = cardioRow ? {
        modality: cardioRow[8] || '',     // Column I
        minutes: parseInt(cardioRow[11]) || 0,  // Column L
        seconds: parseInt(cardioRow[12]) || 0,  // Column M
        rpe: parseInt(cardioRow[16]) || 0,      // Column Q
        workRest: cardioRow[17] || '',          // Column R
        watts: parseInt(cardioRow[24]) || 0,    // Column Y
        notes: cardioRow[63] || ''              // Column BM
      } : {
        modality: '',
        minutes: 0,
        seconds: 0,
        rpe: 0,
        workRest: '',
        watts: 0,
        notes: ''
      };

      const result = { date, exercises, cardio };
      console.log('Processed workout data:', result);
      return result;

    } catch (error) {
      console.error('Error in getWorkoutData:', error);
      throw error;
    }
  }

  async updateWorkoutData(date: string, workoutData: WorkoutData): Promise<void> {
    const parsedDate = this.parseDate(new Date(date));
    
    try {
      // Get existing data first to find the rows we need to update
      const workoutResponse = await this.fetchSheetData("'workout log'!A:AL");
      const workoutRows = workoutResponse.values || [];
      
      // Find the row indices for each exercise
      for (const exercise of workoutData.exercises) {
        const rowIndex = workoutRows.findIndex(row => 
          row[6] === parsedDate && row[8] === exercise.name
        );
        
        if (rowIndex !== -1) {
          // Update the sets data
          const updates: CellUpdate[] = [];
          exercise.sets.forEach((set, setIndex) => {
            const baseCol = setIndex * 3 + 14;  // Start at column N (14)
            updates.push(
              {
                promise: this.updateCell(rowIndex + 1, baseCol, set.reps.toString()),
                row: rowIndex + 1,
                col: baseCol,
                value: set.reps.toString()
              },
              {
                promise: this.updateCell(rowIndex + 1, baseCol + 1, set.weight.toString()),
                row: rowIndex + 1,
                col: baseCol + 1,
                value: set.weight.toString()
              },
              {
                promise: this.updateCell(rowIndex + 1, baseCol + 2, set.rir.toString()),
                row: rowIndex + 1,
                col: baseCol + 2,
                value: set.rir.toString()
              }
            );
          });
          
          await Promise.all(updates.map(update => update.promise));
        }
      }

      // Update cardio data
      const cardioResponse = await this.fetchSheetData("'cardio log'!A:BM");
      const cardioRows = cardioResponse.values || [];
      const cardioRowIndex = cardioRows.findIndex(row => row[5] === parsedDate);
      
      if (cardioRowIndex !== -1) {
        const cardioUpdates: CellUpdate[] = [
          {
            promise: this.updateCell(cardioRowIndex + 1, 8, workoutData.cardio.modality),
            row: cardioRowIndex + 1,
            col: 8,
            value: workoutData.cardio.modality
          },
          {
            promise: this.updateCell(cardioRowIndex + 1, 11, workoutData.cardio.minutes.toString()),
            row: cardioRowIndex + 1,
            col: 11,
            value: workoutData.cardio.minutes.toString()
          },
          {
            promise: this.updateCell(cardioRowIndex + 1, 12, workoutData.cardio.seconds.toString()),
            row: cardioRowIndex + 1,
            col: 12,
            value: workoutData.cardio.seconds.toString()
          },
          {
            promise: this.updateCell(cardioRowIndex + 1, 16, workoutData.cardio.rpe.toString()),
            row: cardioRowIndex + 1,
            col: 16,
            value: workoutData.cardio.rpe.toString()
          },
          {
            promise: this.updateCell(cardioRowIndex + 1, 17, workoutData.cardio.workRest),
            row: cardioRowIndex + 1,
            col: 17,
            value: workoutData.cardio.workRest
          },
          {
            promise: this.updateCell(cardioRowIndex + 1, 24, workoutData.cardio.watts.toString()),
            row: cardioRowIndex + 1,
            col: 24,
            value: workoutData.cardio.watts.toString()
          },
          {
            promise: this.updateCell(cardioRowIndex + 1, 63, workoutData.cardio.notes),
            row: cardioRowIndex + 1,
            col: 63,
            value: workoutData.cardio.notes
          }
        ];
        
        await Promise.all(cardioUpdates.map(update => update.promise));
      }
    } catch (error) {
      console.error('Error updating workout data:', error);
      throw error;
    }
  }

  private async updateCell(row: number, col: number, value: string): Promise<void> {
    const token = this.getAuthToken();
    const colLetter = String.fromCharCode(65 + col); // Convert column number to letter
    const range = `${colLetter}${row}`;
    
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range,
          values: [[value]]
        })
      }
    );
  }
}

export default new GoogleSheetsService();