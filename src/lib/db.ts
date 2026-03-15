import mongoose from 'mongoose';
let isConnected = false;
export const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI!);
  isConnected = true;
  console.log('MongoDB connected');
};
export default connectDB;
