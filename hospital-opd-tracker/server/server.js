import 'dotenv/config';
import http from 'node:http'; import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js'; import authRoutes from './routes/authRoutes.js'; import apiRoutes from './routes/apiRoutes.js'; import { notFound,errorHandler } from './middleware/errorMiddleware.js'; import { configureSockets } from './sockets/index.js';
const app=express();const allowed=(process.env.CLIENT_URL||'http://localhost:5173').split(',').map(s=>s.trim());app.use(helmet());app.use(cors({origin:(origin,cb)=>!origin||allowed.includes(origin)?cb(null,true):cb(new Error('Origin not allowed by CORS')),credentials:false}));app.use(express.json({limit:'100kb'}));app.use(express.urlencoded({extended:false,limit:'100kb'}));app.get('/api/health',(req,res)=>res.json({success:true,status:'ok',service:'hospital-opd-api',timestamp:new Date().toISOString()}));app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}),authRoutes);app.use('/api',apiRoutes);app.use(notFound);app.use(errorHandler);
const server=http.createServer(app);const port=Number(process.env.PORT)||5000;
if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32){console.error('JWT_SECRET must be configured with at least 32 characters in server/.env.');if(process.env.NODE_ENV!=='test')process.exit(1);}
configureSockets(server);
if(process.env.NODE_ENV!=='test'){connectDB().then(()=>server.listen(port,()=>console.log(`Hospital OPD API listening on port ${port}`))).catch(err=>{console.error(`Database connection failed: ${err.message}`);process.exit(1);});}
export {app,server};
