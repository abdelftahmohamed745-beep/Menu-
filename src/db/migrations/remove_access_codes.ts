import { collection, getDocs, updateDoc, doc, deleteField } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/**
 * Migration: Remove Access Codes
 * Scans all collections (venues, etc.) and deletes any legacy access code fields
 * (accessCode, access_code, code) so that no dangling credentials or codes remain.
 */
export async function runRemoveAccessCodesMigration(): Promise<{
  scannedVenues: number;
  cleanedVenues: number;
  details: string[];
}> {
  console.log('[Migration] Starting legacy access code cleanup...');
  const venuesRef = collection(db, 'venues');
  const snapshot = await getDocs(venuesRef);

  let cleanedVenues = 0;
  const details: string[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const fieldsToDelete: Record<string, any> = {};

    if ('accessCode' in data) fieldsToDelete.accessCode = deleteField();
    if ('access_code' in data) fieldsToDelete.access_code = deleteField();
    if ('adminCode' in data) fieldsToDelete.adminCode = deleteField();
    if ('code' in data && typeof data.code === 'string' && data.code.length <= 12) {
      fieldsToDelete.code = deleteField();
    }

    if (Object.keys(fieldsToDelete).length > 0) {
      await updateDoc(doc(db, 'venues', docSnap.id), fieldsToDelete);
      cleanedVenues++;
      details.push(`Cleaned access code fields from venue: ${docSnap.id} (${data.name || 'unnamed'})`);
    }
  }

  console.log(`[Migration] Finished. Scanned: ${snapshot.size}, Cleaned: ${cleanedVenues}`);
  return {
    scannedVenues: snapshot.size,
    cleanedVenues,
    details,
  };
}
