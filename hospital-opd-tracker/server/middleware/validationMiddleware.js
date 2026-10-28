import mongoose from 'mongoose';
export function requireFields(...fields) { return (req, res, next) => { const missing = fields.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null || String(req.body[field]).trim() === ''); if (missing.length) return res.status(400).json({ success: false, message: `Required fields: ${missing.join(', ')}` }); next(); }; }
export function validateObjectId(param = 'id') { return (req, res, next) => mongoose.isValidObjectId(req.params[param]) ? next() : res.status(400).json({ success: false, message: `Invalid ${param}.` }); }
