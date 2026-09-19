import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Doctor from '../models/Doctor.js';
import Ward from '../models/Ward.js';
import Bed from '../models/Bed.js';
import Appointment from '../models/Appointment.js';
import QueueToken from '../models/QueueToken.js';
import Counter from '../models/Counter.js';
import Notification from '../models/Notification.js';
import { normalizeToDateOnly, getNextTokenNumber } from '../utils/generateQueueToken.js';
import calculateWaitTime from '../utils/calculateWaitTime.js';

/**
 * NOTE ON CREDENTIALS: the values below are DEVELOPMENT / DEMO
 * credentials only, intended for a local seeded database. They are
 * printed to the console after seeding so they're never silently
 * baked into the codebase as a hidden default — never reuse a
 * database seeded with this script in production.
 */
const DEV_PASSWORD = 'password123';

const hash = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

const seed = async () => {
  await connectDB();

  console.log('\n🧹 Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Doctor.deleteMany({}),
    Ward.deleteMany({}),
    Bed.deleteMany({}),
    Appointment.deleteMany({}),
    QueueToken.deleteMany({}),
    Counter.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // -------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------
  console.log('👤 Creating admin...');
  const admin = await User.create({
    name: 'Hospital Admin',
    email: 'admin@hospital.com',
    password: await hash(DEV_PASSWORD),
    phone: '9000000000',
    age: 40,
    gender: 'Other',
    role: 'ADMIN',
  });

  // -------------------------------------------------------------
  // Departments
  // -------------------------------------------------------------
  console.log('🏥 Creating departments...');
  const departmentData = [
    { name: 'General Medicine', description: 'General health & primary care' },
    { name: 'Cardiology', description: 'Heart and cardiovascular care' },
    { name: 'Orthopedics', description: 'Bones, joints, and muscles' },
    { name: 'Pediatrics', description: 'Child healthcare' },
    { name: 'Dermatology', description: 'Skin, hair, and nail care' },
  ];
  const departments = await Department.insertMany(departmentData);

  // -------------------------------------------------------------
  // Doctors (User + Doctor profile pairs)
  // -------------------------------------------------------------
  console.log('🩺 Creating doctors...');
  const doctorData = [
    {
      name: 'Dr. Aisha Khan',
      email: 'aisha.khan@hospital.com',
      phone: '9111111111',
      department: departments[0]._id, // General Medicine
      specialization: 'General Physician',
      licenseNumber: 'LIC-1001',
      experience: 8,
      consultationRoom: 'Room 101',
      averageConsultationTime: 10,
    },
    {
      name: 'Dr. Rohan Mehta',
      email: 'rohan.mehta@hospital.com',
      phone: '9111111112',
      department: departments[1]._id, // Cardiology
      specialization: 'Cardiologist',
      licenseNumber: 'LIC-1002',
      experience: 12,
      consultationRoom: 'Room 202',
      averageConsultationTime: 15,
    },
    {
      name: 'Dr. Sara Thomas',
      email: 'sara.thomas@hospital.com',
      phone: '9111111113',
      department: departments[2]._id, // Orthopedics
      specialization: 'Orthopedic Surgeon',
      licenseNumber: 'LIC-1003',
      experience: 10,
      consultationRoom: 'Room 303',
      averageConsultationTime: 12,
    },
    {
      name: 'Dr. Vikram Nair',
      email: 'vikram.nair@hospital.com',
      phone: '9111111114',
      department: departments[3]._id, // Pediatrics
      specialization: 'Pediatrician',
      licenseNumber: 'LIC-1004',
      experience: 6,
      consultationRoom: 'Room 104',
      averageConsultationTime: 8,
    },
    {
      name: 'Dr. Emily Chen',
      email: 'emily.chen@hospital.com',
      phone: '9111111115',
      department: departments[4]._id, // Dermatology
      specialization: 'Dermatologist',
      licenseNumber: 'LIC-1005',
      experience: 9,
      consultationRoom: 'Room 205',
      averageConsultationTime: 10,
    },
  ];

  const doctors = [];
  for (const d of doctorData) {
    const user = await User.create({
      name: d.name,
      email: d.email,
      password: await hash(DEV_PASSWORD),
      phone: d.phone,
      age: 30 + d.experience,
      gender: 'Other',
      role: 'DOCTOR',
    });

    const doctor = await Doctor.create({
      user: user._id,
      department: d.department,
      specialization: d.specialization,
      licenseNumber: d.licenseNumber,
      experience: d.experience,
      consultationRoom: d.consultationRoom,
      averageConsultationTime: d.averageConsultationTime,
    });

    doctors.push({ doctor, user, meta: d });
  }

  // -------------------------------------------------------------
  // Wards & Beds
  // -------------------------------------------------------------
  console.log('🛏️  Creating wards and beds...');
  const wardData = [
    { name: 'General Ward', type: 'GENERAL', bedCount: 12 },
    { name: 'ICU', type: 'ICU', bedCount: 6 },
    { name: 'Emergency', type: 'EMERGENCY', bedCount: 8 },
    { name: 'Private Ward', type: 'PRIVATE', bedCount: 10 },
  ];

  const wards = [];
  for (const w of wardData) {
    const ward = await Ward.create({ name: w.name, type: w.type, totalBeds: w.bedCount });
    wards.push(ward);

    const beds = [];
    for (let i = 1; i <= w.bedCount; i++) {
      // Sprinkle in some non-AVAILABLE statuses for a realistic demo
      let status = 'AVAILABLE';
      if (i % 5 === 0) status = 'OCCUPIED';
      else if (i % 7 === 0) status = 'CLEANING';
      beds.push({ bedNumber: `${w.name.slice(0, 3).toUpperCase()}-${i}`, ward: ward._id, status });
    }
    await Bed.insertMany(beds);
  }

  // -------------------------------------------------------------
  // Patients
  // -------------------------------------------------------------
  console.log('🧑‍🤝‍🧑 Creating patients...');
  const patientData = [
    { name: 'John Doe', email: 'john.doe@example.com', phone: '9222222221', age: 29, gender: 'Male' },
    { name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '9222222222', age: 34, gender: 'Female' },
    { name: 'Michael Lee', email: 'michael.lee@example.com', phone: '9222222223', age: 45, gender: 'Male' },
    { name: 'Fatima Ali', email: 'fatima.ali@example.com', phone: '9222222224', age: 22, gender: 'Female' },
    { name: 'David Kim', email: 'david.kim@example.com', phone: '9222222225', age: 51, gender: 'Male' },
    { name: 'Grace Okafor', email: 'grace.okafor@example.com', phone: '9222222226', age: 38, gender: 'Female' },
  ];

  const patients = [];
  for (const p of patientData) {
    const patient = await User.create({
      name: p.name,
      email: p.email,
      password: await hash(DEV_PASSWORD),
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      role: 'PATIENT',
    });
    patients.push(patient);
  }

  // -------------------------------------------------------------
  // Sample active queue: book the first 3 patients into
  // Dr. Aisha Khan's (General Medicine) queue today.
  // -------------------------------------------------------------
  console.log('🎫 Creating sample queue tokens...');
  const queueDate = normalizeToDateOnly(new Date());
  const generalMedDoctor = doctors[0].doctor;

  for (let i = 0; i < 3; i++) {
    const patient = patients[i];

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: generalMedDoctor._id,
      department: generalMedDoctor.department,
      appointmentDate: new Date(),
      status: 'WAITING',
    });

    const tokenNumber = await getNextTokenNumber(generalMedDoctor.department, queueDate);
    const estimatedWaitTime = calculateWaitTime(i, generalMedDoctor.averageConsultationTime);

    const token = await QueueToken.create({
      tokenNumber,
      patient: patient._id,
      doctor: generalMedDoctor._id,
      department: generalMedDoctor.department,
      appointment: appointment._id,
      status: 'WAITING',
      queueDate,
      estimatedWaitTime,
    });

    appointment.queueToken = token._id;
    await appointment.save();
  }

  // -------------------------------------------------------------
  // Done — print credentials
  // -------------------------------------------------------------
  console.log('\n✅ Seed complete!\n');
  console.log('==================== DEV LOGIN CREDENTIALS ====================');
  console.log('(development/demo accounts only — do not use in production)\n');
  console.log(`ADMIN\n  email: ${admin.email}\n  password: ${DEV_PASSWORD}\n`);
  console.log('DOCTORS');
  doctors.forEach(({ user, meta }) => {
    console.log(`  ${meta.name} (${meta.specialization})\n    email: ${user.email}\n    password: ${DEV_PASSWORD}`);
  });
  console.log('\nPATIENTS');
  patients.forEach((p) => {
    console.log(`  ${p.name}\n    email: ${p.email}\n    password: ${DEV_PASSWORD}`);
  });
  console.log('\n=================================================================\n');
  console.log(`Departments created: ${departments.length}`);
  console.log(`Wards created: ${wards.length}`);
  console.log(`Sample queue tokens created: 3 (Dr. Aisha Khan / General Medicine)\n`);

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error('❌ Seeding failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
