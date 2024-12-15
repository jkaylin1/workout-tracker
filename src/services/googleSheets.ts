import { WorkoutData, Exercise, CardioSession } from '../types/workout';

interface SheetResponse {
  range: string;
  majorDimension: string;
  values: string[][];
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

  private parseDate(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    const dateParts = dateStr.split(' ');
    if (dateParts.length > 1) {
      dateStr = dateParts[dateParts.length - 1];
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return `${parseInt(parts[0])}/${parseInt(parts[1])}`;
    }
    return dateStr;
  }

  private getColumnLetter(col: number): string {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode(65 + (col % 26)) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  }

  private async batchUpdate(updates: { range: string; values: string[][] }[]): Promise<void> {
    if (updates.length === 0) return;

    const token = this.getAuthToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: updates
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Batch update failed: ${error.error?.message || response.statusText}`);
    }
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
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }

    return response.json();
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
        if (!row[6]) return false;
        const rowDate = this.normalizeDate(row[6]);
        const matches = rowDate === parsedDate;
        return matches;
      });
      
      // Process exercises
      const exercises: Exercise[] = [];
      for (const row of matchingWorkoutRows) {
        if (!row[8]) continue; // Skip if no exercise name

        const sets = [];
        // Process sets
        const setGroups = [
          { reps: 14, weight: 15, rir: 16 },  // First set
          { reps: 17, weight: 18, rir: 19 },  // Second set
          { reps: 20, weight: 21, rir: 22 }   // Third set
        ];

        for (const group of setGroups) {
          const repsStr = row[group.reps];
          if (repsStr && !isNaN(Number(repsStr))) {
            sets.push({
              reps: parseInt(repsStr) || 0,
              weight: parseFloat(row[group.weight]) || 0,
              rir: parseInt(row[group.rir]) || 0
            });
          }
        }

        exercises.push({
          name: row[8].trim(),
          sets,
          notes: row[37] || '' // Column AL (37) for notes
        });
      }

      // Fetch cardio data
      const cardioData = await this.fetchSheetData("'cardio log'!A:BM");
      const cardioRows = cardioData.values || [];
      
      // Find matching cardio row (using column F for date)
      const cardioRow = cardioRows.find(row => {
        if (!row[5]) return false;
        return this.normalizeDate(row[5]) === parsedDate;
      });
      
      const cardio: CardioSession = cardioRow ? {
        modality: cardioRow[8] || '',      // Column I
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

      return { date, exercises, cardio };
    } catch (error) {
      console.error('Error in getWorkoutData:', error);
      throw error;
    }
  }

  async updateWorkoutData(date: string, workoutData: WorkoutData): Promise<void> {
    try {
      const parsedDate = this.parseDate(new Date(date));
      console.log('Updating data for date:', parsedDate);
      
      // Get workout data
      const workoutResponse = await this.fetchSheetData("'workout log'!A:AL");
      const workoutRows = workoutResponse.values || [];
      
      // Find rows for current date
      const dateRows = workoutRows.reduce((acc, row, index) => {
        const rowDate = this.normalizeDate(row[6]);
        if (rowDate === parsedDate) {
          acc[row[8]?.trim().toLowerCase()] = index + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Prepare workout updates
      const workoutUpdates = [];
      
      for (const exercise of workoutData.exercises) {
        const rowIndex = dateRows[exercise.name.toLowerCase()];
        if (rowIndex) {
          // Update sets
          exercise.sets.forEach((set, setIndex) => {
            const baseCol = 14 + (setIndex * 3);
            
            workoutUpdates.push(
              {
                range: `'workout log'!${this.getColumnLetter(baseCol)}${rowIndex}`,
                values: [[set.reps.toString()]]
              },
              {
                range: `'workout log'!${this.getColumnLetter(baseCol + 1)}${rowIndex}`,
                values: [[set.weight.toString()]]
              },
              {
                range: `'workout log'!${this.getColumnLetter(baseCol + 2)}${rowIndex}`,
                values: [[set.rir.toString()]]
              }
            );
          });

          // Only add notes update if this specific exercise has notes
          if (exercise.notes) {
            workoutUpdates.push({
              range: `'workout log'!AL${rowIndex}`,
              values: [[exercise.notes]]
            });
          }
        }
      }

      // Process workout updates
      await this.batchUpdate(workoutUpdates);

      // Process cardio updates
      const cardioResponse = await this.fetchSheetData("'cardio log'!A:BM");
      const cardioRows = cardioResponse.values || [];
      const cardioRowIndex = cardioRows.findIndex(row => 
        this.normalizeDate(row[5]) === parsedDate
      );
      
      if (cardioRowIndex !== -1) {
        const cardioUpdates = [
          { col: 8, value: workoutData.cardio.modality },
          { col: 11, value: workoutData.cardio.minutes.toString() },
          { col: 12, value: workoutData.cardio.seconds.toString() },
          { col: 16, value: workoutData.cardio.rpe.toString() },
          { col: 17, value: workoutData.cardio.workRest },
          { col: 24, value: workoutData.cardio.watts.toString() },
          { col: 63, value: workoutData.cardio.notes }
        ].map(update => ({
          range: `'cardio log'!${this.getColumnLetter(update.col)}${cardioRowIndex + 1}`,
          values: [[update.value]]
        }));

        await this.batchUpdate(cardioUpdates);
      }
      
      console.log('Successfully updated workout data');
    } catch (error) {
      console.error('Error updating workout data:', error);
      throw error;
    }
  }
}

export default new GoogleSheetsService();