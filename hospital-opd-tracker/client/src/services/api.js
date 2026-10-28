import axios from 'axios';
export const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
export const api=axios.create({baseURL:API_URL,timeout:15000,headers:{'Content-Type':'application/json'}});
api.interceptors.request.use((config)=>{const token=sessionStorage.getItem('opd_token');if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
api.interceptors.response.use(r=>r,(error)=>{if(error.response?.status===401){sessionStorage.removeItem('opd_token');sessionStorage.removeItem('opd_user');if(!location.pathname.startsWith('/login')&&!location.pathname.startsWith('/register'))location.href='/login';}return Promise.reject(error);});
export const errorMessage=(error)=>error.response?.data?.message||error.message||'Something went wrong. Please try again.';
