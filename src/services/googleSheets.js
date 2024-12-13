const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;

const syncQueue = {
  add: (change) => {
    const queue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
    queue.push(change);
    localStorage.setItem('syncQueue', JSON.stringify(queue));
  },
  
  get: () => {
    return JSON.parse(localStorage.getItem('syncQueue') || '[]');
  }
};

class GoogleSheetsService {
  formatDate(date) {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
  }

  matchesDate(rowDate, targetDate) {
    if (!rowDate) return false;
    const targetMatch = targetDate.match(/(\d{1,2}\/\d{1,2})/);
    if (!targetMatch) return false;
    const cleanRowDate = rowDate.trim()
      .replace(/^[A-Za-z]{3}\s+/, '')
      .replace(/\/\d{4}$/, '');
    
    return cleanRowDate === targetMatch[1];
  }

  isOnline() {
    return window.navigator.onLine;
  }

  getCachedData(date) {
    try {
      const cached = localStorage.getItem(`workout_${date}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  setCachedData(date, data) {
    try {
      localStorage.setItem(`workout_${date}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  async getWorkoutData(date) {
    // First check if we're offline
    if (!this.isOnline()) {
      const cached = this.getCachedData(date);
      if (cached) {
        return cached;
      }
      throw new Error('Offline and no cached data available');
    }

    try {
      const workoutResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'workout log'!A:Z?key=${API_KEY}`
      );
      
      if (!workoutResponse.ok) {
        // Check cache before giving up
        const cached = this.getCachedData(date);
        if (cached) return cached;
        console.error('Failed to fetch workout data:', await workoutResponse.text());
        throw new Error('Failed to fetch workout data');
      }

      const workoutData = await workoutResponse.json();
      const workoutRows = workoutData.values || [];
      const targetDate = this.formatDate(date);

      // Process workout data
      const exercises = this.processWorkoutRows(workoutRows, targetDate);

      // Try to fetch cardio data
      let cardio = null;
      try {
        const cardioResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'cardio log'!A:Z?key=${API_KEY}`
        );
        
        if (cardioResponse.ok) {
          const cardioData = await cardioResponse.json();
          const cardioRows = cardioData.values || [];
          cardio = this.processCardioRows(cardioRows, targetDate);
        }
      } catch (cardioError) {
        console.log('Error fetching cardio data (continuing without it):', cardioError);
      }

      const result = {
        exercises,
        cardio: cardio || {
          modality: '',
          minutes: 0,
          seconds: 0,
          rpe: 0,
          workRest: '',
          watts: 0,
          notes: ''
        }
      };

      // Cache the successful response
      this.setCachedData(date, result);

      return result;
    } catch (error) {
      // One final check of cache before giving up
      const cached = this.getCachedData(date);
      if (cached) return cached;
      console.error('Error in getWorkoutData:', error);
      throw error;
    }
  }

  processWorkoutRows(rows, targetDate) {
    const dateColumnIndex = 6;  // Column G
    const exerciseColumnIndex = 8;  // Column I
    const setsColumnIndex = 13;  // Column N
    const firstSetStartIndex = 14;  // Column O (first set's reps)
    const notesColumnIndex = 37;  // Column AL
    
    const workoutRows = rows
      .slice(1)
      .filter(row => this.matchesDate(row[dateColumnIndex], targetDate));

    const exercises = [];

    for (const row of workoutRows) {
      const exerciseName = row[exerciseColumnIndex];
      if (!exerciseName) continue;

      const totalSets = parseInt(row[setsColumnIndex]) || 0;
      const sets = [];

      // Process each set (groups of 3 columns)
      for (let setNum = 0; setNum < totalSets; setNum++) {
        const setStartIndex = firstSetStartIndex + (setNum * 3);
        const reps = row[setStartIndex];
        const weight = row[setStartIndex + 1];
        const rir = row[setStartIndex + 2];

        // Only add the set if we have data
        if (reps || weight || rir) {
          sets.push({
            reps: parseInt(reps) || 0,
            weight: parseFloat(weight) || 0,
            rir: parseInt(rir) || 0
          });
        }
      }

      // Only add exercises that have sets
      if (sets.length > 0) {
        exercises.push({
          name: exerciseName,
          sets: sets,
          notes: row[notesColumnIndex] || '' // Reading notes from column AL
        });
      }
    }

    return exercises;
  }

  processCardioRows(rows, targetDate) {
    const dateColumnIndex = 5;  // Column F
    const modalityColumnIndex = 8;  // Column I
    const minutesColumnIndex = 11; // Column L
    const secondsColumnIndex = 12; // Column M
    const rpeColumnIndex = 16;  // Column Q
    const workRestColumnIndex = 17; // Column R
    const wattsColumnIndex = 24; // Column Y
    const notesColumnIndex = 64; // Column BM
    
    // Find the relevant row for the target date
    const cardioRow = rows
      .slice(1)
      .find(row => this.matchesDate(row[dateColumnIndex], targetDate));

    if (!cardioRow) return null;

    return {
      modality: cardioRow[modalityColumnIndex] || '',
      minutes: parseInt(cardioRow[minutesColumnIndex]) || 0,
      seconds: parseInt(cardioRow[secondsColumnIndex]) || 0,
      rpe: parseFloat(cardioRow[rpeColumnIndex]) || 0,
      workRest: cardioRow[workRestColumnIndex] || '',
      watts: parseInt(cardioRow[wattsColumnIndex]) || 0,
      notes: cardioRow[notesColumnIndex] || ''
    };
  }

  async updateWorkoutData(date, workoutData) {
    if (!navigator.onLine) {
      syncQueue.add({ date, workoutData });
      return { offline: true };
    }

    try {
      const formattedDate = this.formatDate(date);
      
      // Update workout data
      if (workoutData.exercises.length > 0) {
        const workoutUpdates = workoutData.exercises.map(exercise => {
          const row = new Array(38).fill(''); // Extend array to include notes column
          row[6] = formattedDate; // Column G
          row[8] = exercise.name; // Column I
          row[13] = exercise.sets.length.toString(); // Column N - number of sets
          
          // Add sets data
          exercise.sets.forEach((set, index) => {
            const baseIndex = 14 + (index * 3);
            row[baseIndex] = set.reps.toString();
            row[baseIndex + 1] = set.weight.toString();
            row[baseIndex + 2] = set.rir.toString();
          });
          
          row[37] = exercise.notes || ''; // Column AL - notes
          return row;
        });

        const workoutResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'workout log'!A:Z:append?valueInputOption=USER_ENTERED&key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: workoutUpdates })
          }
        );

        if (!workoutResponse.ok) {
          throw new Error('Failed to update workout data');
        }
      }

      // Update cardio data if it exists
      if (workoutData.cardio && Object.values(workoutData.cardio).some(v => v)) {
        const cardioRow = new Array(65).fill(''); // Extend to include notes column (BM)
        cardioRow[5] = formattedDate; // Column F
        cardioRow[8] = workoutData.cardio.modality; // Column I
        cardioRow[11] = workoutData.cardio.minutes?.toString(); // Column L
        cardioRow[12] = workoutData.cardio.seconds?.toString(); // Column M
        cardioRow[16] = workoutData.cardio.rpe?.toString(); // Column Q
        cardioRow[17] = workoutData.cardio.workRest; // Column R
        cardioRow[24] = workoutData.cardio.watts?.toString(); // Column Y
        cardioRow[64] = workoutData.cardio.notes; // Column BM

        const cardioResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'cardio log'!A:BM:append?valueInputOption=USER_ENTERED&key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [cardioRow] })
          }
        );

        if (!cardioResponse.ok) {
          console.error('Failed to update cardio data:', await cardioResponse.text());
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateWorkoutData:', error);
      syncQueue.add({ date, workoutData });
      throw error;
    }
  }
}

export default new GoogleSheetsService();