// DUNAZOE OS — UPLOAD SERVICE (Port 4020) — Cloudinary + magic bytes validation
require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const multer     = require("multer");
const cloudinary = require("cloudinary").v2;
const { Pool }   = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4020;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false });

cloudinary.config({
  cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
  api_key:process.env.CLOUDINARY_API_KEY,
  api_secret:process.env.CLOUDINARY_API_SECRET,
  secure:true
});

const MAX_SIZE  = parseInt(process.env.MAX_FILE_SIZE_MB||"5")*1024*1024;
const MAGIC = { "image/jpeg":[0xFF,0xD8,0xFF],"image/png":[0x89,0x50,0x4E,0x47],"image/webp":[0x52,0x49,0x46,0x46],"image/gif":[0x47,0x49,0x46] };

const upload = multer({
  storage:multer.memoryStorage(), limits:{fileSize:MAX_SIZE,files:5},
  fileFilter:(req,file,cb)=>{
    const ext=require("path").extname(file.originalname).toLowerCase();
    if (![".jpg",".jpeg",".png",".webp",".gif"].includes(ext)) return cb(new Error(`Not allowed: ${ext}`));
    cb(null,true);
  }
});

function checkMagic(buf,mime){ const e=MAGIC[mime]; return e?e.every((b,i)=>buf[i]===b):false; }

async function toCloudinary(buffer,folder,transforms=[]) {
  return new Promise((resolve,reject)=>{
    const s=cloudinary.uploader.upload_stream({folder,resource_type:"image",transformation:transforms,unique_filename:true},(e,r)=>e?reject(e):resolve(r));
    s.end(buffer);
  });
}

app.get("/health",(req,res)=>res.json({service:"upload-service",status:"ok",port:PORT,cloudinary:process.env.CLOUDINARY_CLOUD_NAME?"configured":"⚠️ not configured"}));

app.post("/upload/product-image", requireAuth, upload.single("image"), asyncHandler(async(req,res)=>{
  if (!req.file) return res.status(400).json({success:false,error:"No image provided"});
  if (!checkMagic(req.file.buffer,req.file.mimetype)) return res.status(400).json({success:false,error:"File rejected — invalid magic bytes"});
  if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(503).json({success:false,error:"Storage not configured"});
  const r=await toCloudinary(req.file.buffer,`dunazoe/products/${req.user.id}`,[{width:1200,height:1200,crop:"limit"},{quality:"auto:good"},{fetch_format:"auto"}]);
  res.json({success:true,url:r.secure_url,public_id:r.public_id,width:r.width,height:r.height,size_bytes:req.file.size});
}));

app.post("/upload/delivery-proof", requireAuth, upload.single("photo"), asyncHandler(async(req,res)=>{
  const {order_id}=req.body;
  if (!req.file||!order_id) return res.status(400).json({success:false,error:"photo and order_id required"});
  if (!checkMagic(req.file.buffer,req.file.mimetype)) return res.status(400).json({success:false,error:"File rejected"});
  const r=await toCloudinary(req.file.buffer,`dunazoe/delivery/${order_id}`,[{width:1920,crop:"limit"},{quality:"auto"}]);
  await pool.query("UPDATE orders SET delivery_photo=$1 WHERE id=$2",[r.secure_url,order_id]).catch(()=>{});
  res.json({success:true,url:r.secure_url,order_id,message:"Proof uploaded."});
}));

app.post("/upload/dispute-evidence", requireAuth, upload.array("files",5), asyncHandler(async(req,res)=>{
  if (!req.files?.length) return res.status(400).json({success:false,error:"No files provided"});
  const urls=[];
  for (const f of req.files) {
    if (!checkMagic(f.buffer,f.mimetype)) return res.status(400).json({success:false,error:`File "${f.originalname}" rejected`});
    const r=await toCloudinary(f.buffer,"dunazoe/disputes");
    urls.push(r.secure_url);
  }
  res.json({success:true,urls,count:urls.length});
}));

app.use((err,req,res,next)=>{
  if (err.code==="LIMIT_FILE_SIZE") return res.status(400).json({success:false,error:`Max ${process.env.MAX_FILE_SIZE_MB||5}MB`});
  next(err);
});
app.use(errorHandler);
app.listen(PORT,()=>logger.info(`✅ Upload Service running on port ${PORT}`));
module.exports=app;
