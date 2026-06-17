
import { db } from '../firebase';

export const seedDatabase = async () => {
  try {
    console.log("Starting database initialization...");

    // 1. Create 'settings' collection with default configuration
    const configRef = db.collection('settings').doc('config');
    await configRef.set({
      mealPrice: 65,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("Settings collection created.");

    // 2. Create 'members' collection with a sample member if empty
    const membersRef = db.collection('members');
    const memberSnapshot = await membersRef.get();
    
    if (memberSnapshot.empty) {
      await membersRef.add({
        fullName: "Demo Member",
        phone: "01700000000",
        address: "Dhaka, Bangladesh",
        joinDate: new Date().toISOString().split('T')[0],
        status: 'active'
      });
      console.log("Members collection created with sample data.");
    } else {
      console.log("Members collection already exists.");
    }

    // 3. Create 'meals' collection structure
    const todayStr = new Date().toISOString().split('T')[0];
    const mealsRef = db.collection('meals').doc(todayStr);
    
    await mealsRef.set({
      date: todayStr,
      entries: {} 
    }, { merge: true });
    console.log("Meals collection initialized.");

    return { success: true, message: "Database structure created successfully!" };
  } catch (error: any) {
    console.error("Error seeding database:", error);
    return { success: false, message: "Error: " + error.message };
  }
};
