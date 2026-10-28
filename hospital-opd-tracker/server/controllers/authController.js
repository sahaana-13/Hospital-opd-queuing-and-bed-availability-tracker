import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
function publicUser(user) { return { id:user._id, name:user.name, email:user.email, role:user.role, active:user.active, patientId:user.patientId, contactNumber:user.contactNumber, departments:user.departments || [] }; }
function tokenFor(user) { return jwt.sign({ sub:user._id, role:user.role }, process.env.JWT_SECRET, { expiresIn:process.env.JWT_EXPIRES_IN || '8h' }); }
export const register = asyncHandler(async (req,res) => {
 const { name,email,password,dateOfBirth,contactNumber,address }=req.body;
 if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({success:false,message:'Name, email and password are required.'});
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,message:'Enter a valid email address.'});
 if (password.length < 8) return res.status(400).json({success:false,message:'Password must be at least 8 characters.'});
 if (contactNumber && !/^[+0-9 ()-]{7,20}$/.test(contactNumber)) return res.status(400).json({success:false,message:'Enter a valid contact number.'});
 const passwordHash=await bcrypt.hash(password,12); const patientId=`PAT-${randomBytes(5).toString('hex').toUpperCase()}`;
 const user=await User.create({name,email,passwordHash,role:'PATIENT',patientId,dateOfBirth:dateOfBirth || undefined,contactNumber,address});
 res.status(201).json({success:true,message:'Registration successful.',data:{user:publicUser(user),token:tokenFor(user)}});
});
export const login = asyncHandler(async (req,res) => { const {email,password}=req.body; if(!email || !password) return res.status(400).json({success:false,message:'Email and password are required.'}); const user=await User.findOne({email:String(email).toLowerCase().trim()}).select('+passwordHash'); if(!user || !user.active || !(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({success:false,message:'Invalid email or password.'}); res.json({success:true,data:{user:publicUser(user),token:tokenFor(user)}}); });
export const me = asyncHandler(async(req,res)=>res.json({success:true,data:{user:publicUser(req.user)}}));
export const logout = asyncHandler(async(req,res)=>res.json({success:true,message:'Logged out. Remove the session token from this browser.'}));
