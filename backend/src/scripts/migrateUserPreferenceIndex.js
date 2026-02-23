import 'dotenv/config';
import mongoose from 'mongoose';
import UserPreference from '../models/UserPreference.js';

async function migrateUserPreferenceIndex() {
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const collection = UserPreference.collection;
    const indexes = await collection.indexes();

    const oldIndex = indexes.find(
      (idx) =>
        idx.unique &&
        idx.key &&
        idx.key.userId === 1 &&
        idx.key.preferenceValue === 1 &&
        idx.key.preferenceType === undefined
    );

    if (oldIndex) {
      await collection.dropIndex(oldIndex.name);
      console.log(`Dropped old index: ${oldIndex.name}`);
    } else {
      console.log('Old userId+preferenceValue index not found, skipping drop');
    }

    await collection.createIndex(
      { userId: 1, preferenceType: 1, preferenceValue: 1 },
      { unique: true }
    );
    console.log('Ensured new unique index: userId+preferenceType+preferenceValue');
  } finally {
    await mongoose.disconnect();
  }
}

migrateUserPreferenceIndex().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});

