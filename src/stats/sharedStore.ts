import { StatsStore } from './StatsStore';

// A single shared StatsStore instance for the whole app.
//
// StatsStore reads localStorage once in its constructor into an in-memory copy.
// If each screen created its own instance, the Dashboard's copy would be a
// stale snapshot taken at import time and would never reflect attempts recorded
// by Train/Warm-Up within the same page session. Sharing one instance means
// every write is immediately visible to every reader.
export const statsStore = new StatsStore();
