const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

// Move syncQueue inside the class as static methods
class GoogleSheetsService {
  static addToSyncQueue(change) {
    const queue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
    queue.push(change);
    localStorage.setItem('syncQueue', JSON.stringify(queue));
  }
  
  static getSyncQueue() {
    return JSON.parse(localStorage.getItem('syncQueue') || '[]');
  }

  // Add method to get auth token
  async getAuthToken() {
    if (!window.gapi?.auth2) {
      throw new Error('Google API not initialized');
    }
    const currentUser = window.gapi.auth2.getAuthInstance().currentUser.get();
    return currentUser.getAuthResponse().access_token;
  }

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
    if (!this.isOnline()) {
      const cached = this.getCachedData(date);
      if (cached) return cached;
      throw new Error('Offline and no cached data available');
    }

    try {
      const token = await this.getAuthToken();
      const workoutResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'workout log'!A:Z`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!workoutResponse.ok) {
        const cached = this.getCachedData(date);
        if (cached) return cached;
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
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'cardio log'!A:Z`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
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

      this.setCachedData(date, result);
      return result;

    } catch (error) {
      const cached = this.getCachedData(date);
      if (cached) return cached;
      throw error;
    }
  }

  async updateWorkoutData(date, workoutData) {
    if (!this.isOnline()) {
      GoogleSheetsService.addToSyncQueue({ date, workoutData });
      return { offline: true };
    }

    try {
      const token = await this.getAuthToken();
      const formattedDate = this.formatDate(date);
      
      if (workoutData.exercises.length > 0) {
        const workoutUpdates = workoutData.exercises.map(exercise => {
          // Your existing workout updates logic
          const row = new Array(38).fill('');
          row[6] = formattedDate;
          row[8] = exercise.name;
          row[13] = exercise.sets.length.toString();
          
          exercise.sets.forEach((set, index) => {
            const baseIndex = 14 + (index * 3);
            row[baseIndex] = set.reps.toString();
            row[baseIndex + 1] = set.weight.toString();
            row[baseIndex + 2] = set.rir.toString();
          });
          
          row[37] = exercise.notes || '';
          return row;
        });

        const workoutResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'workout log'!A:Z:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: workoutUpdates })
          }
        );

        if (!workoutResponse.ok) {
          throw new Error('Failed to update workout data');
        }
      }

      // Handle cardio data updates
      if (workoutData.cardio && Object.values(workoutData.cardio).some(v => v)) {
        const cardioRow = new Array(65).fill('');
        cardioRow[5] = formattedDate;
        cardioRow[8] = workoutData.cardio.modality;
        cardioRow[11] = workoutData.cardio.minutes?.toString();
        cardioRow[12] = workoutData.cardio.seconds?.toString();
        cardioRow[16] = workoutData.cardio.rpe?.toString();
        cardioRow[17] = workoutData.cardio.workRest;
        cardioRow[24] = workoutData.cardio.watts?.toString();
        cardioRow[64] = workoutData.cardio.notes;

        const cardioResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'cardio log'!A:BM:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [cardioRow] })
          }
        );

        if (!cardioResponse.ok) {
          throw new Error('Failed to update cardio data');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateWorkoutData:', error);
      GoogleSheetsService.addToSyncQueue({ date, workoutData });
      throw error;
    }
  }

  async saveWorkoutData(workoutData) {
    return this.updateWorkoutData(workoutData.date, workoutData);
  }

  getOfflinePendingChanges() {
    return GoogleSheetsService.getSyncQueue();
  }

  clearOfflinePendingChanges() {
    localStorage.removeItem('syncQueue');
  }
}

export default new GoogleSheetsService();