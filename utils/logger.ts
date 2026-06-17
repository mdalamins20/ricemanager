
import { db, auth } from '../firebase';

export const logAction = async (action: string, details: string) => {
  try {
    const user = auth.currentUser;
    const performedBy = user ? user.email : 'Unknown/System';
    
    await db.collection('logs').add({
      action,
      details,
      performedBy,
      timestamp: new Date().toISOString()
    });
    console.log(`[LOG] ${action}: ${details}`);
  } catch (error) {
    console.error("Failed to write log:", error);
  }
};
