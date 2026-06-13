// DUNAZOE OS — REALTIME SERVICE (Socket.IO) Port 4021
require("dotenv").config();
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");
const jwt        = require("jsonwebtoken");
const { Pool }   = require("pg");
const { logger } = require("../../shared/logger");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4021;
const JWT_SECRET = process.env.JWT_SECRET || "dunazoe_secret_change_in_prod";

app.use(cors()); app.use(express.json());

const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false });

const io = new Server(server, {
  cors:{ origin:(process.env.ALLOWED_ORIGINS||"http://localhost:3000").split(","), methods:["GET","POST"], credentials:true },
  pingTimeout:30000, pingInterval:10000
});

async function setupRedis() {
  try {
    const {createAdapter}=require("@socket.io/redis-adapter");
    const {createClient}=require("redis");
    const pub=createClient({url:process.env.REDIS_URL||"redis://localhost:6379"});
    const sub=pub.duplicate();
    await Promise.all([pub.connect(),sub.connect()]);
    io.adapter(createAdapter(pub,sub));
    logger.info("[Realtime] Redis adapter ✓");
  } catch(e) { logger.warn("[Realtime] Single-instance mode:", e.message); }
}

io.use((socket,next)=>{
  const token=socket.handshake.auth?.token||(socket.handshake.headers?.authorization||"").replace("Bearer ","");
  if (!token) return next(new Error("Auth required"));
  try { const d=jwt.verify(token,JWT_SECRET); socket.user_id=d.id; socket.user_role=d.role; next(); }
  catch { next(new Error("Invalid token")); }
});

const connectedUsers=new Map();
function emitToUser(uid,event,data){ const s=connectedUsers.get(uid)||new Set(); for(const sid of s) io.to(sid).emit(event,data); }

io.on("connection",socket=>{
  const uid=socket.user_id, role=socket.user_role;
  if(!connectedUsers.has(uid)) connectedUsers.set(uid,new Set());
  connectedUsers.get(uid).add(socket.id);
  socket.join(`user:${uid}`);

  socket.on("join:order",async order_id=>{
    try {
      const r=await pool.query("SELECT o.customer_id,v.user_id vid,o.delivery_agent_id FROM orders o JOIN vendors v ON o.vendor_id=v.id WHERE o.id=$1",[order_id]);
      if(!r.rows[0]) return;
      const o=r.rows[0];
      if([o.customer_id,o.vid,o.delivery_agent_id].includes(uid)||role==="admin"){
        socket.join(`order:${order_id}`);
        socket.emit("joined:order",{order_id,message:"Receiving live updates"});
      }
    } catch(e){ logger.error("join:order",e.message); }
  });

  socket.on("chat:message",async data=>{
    try {
      const {receiver_id,message,order_id}=data;
      if (!receiver_id||!message||message.length>2000) return;
      const r=await pool.query("INSERT INTO chat_messages(sender_id,receiver_id,order_id,message) VALUES($1,$2,$3,$4) RETURNING id,created_at",[uid,receiver_id,order_id||null,message.trim()]);
      const msg={id:r.rows[0].id,sender_id:uid,receiver_id,order_id:order_id||null,message:message.trim(),created_at:r.rows[0].created_at};
      emitToUser(receiver_id,"chat:message",msg);
      socket.emit("chat:sent",msg);
      if(order_id) io.to(`order:${order_id}`).emit("chat:message",msg);
    } catch(e){ socket.emit("error",{message:"Message failed"}); }
  });

  socket.on("agent:location",async data=>{
    const {order_id,lat,lng}=data;
    if(!order_id||!lat||!lng||Math.abs(lat)>90||Math.abs(lng)>180) return;
    if(!["agent","admin"].includes(role)) return;
    await pool.query("UPDATE delivery_assignments SET gps_lat=$1,gps_lng=$2 WHERE order_id=$3 AND status IN ('assigned','picked_up','in_transit','nearby')",[parseFloat(lat),parseFloat(lng),order_id]).catch(()=>{});
    io.to(`order:${order_id}`).emit("agent:location",{order_id,lat:parseFloat(lat),lng:parseFloat(lng),agent_id:uid,timestamp:new Date().toISOString()});
  });

  socket.on("chat:typing",data=>{ if(data.receiver_id) emitToUser(data.receiver_id,"chat:typing",{sender_id:uid,order_id:data.order_id}); });
  socket.on("chat:stop_typing",data=>{ if(data.receiver_id) emitToUser(data.receiver_id,"chat:stop_typing",{sender_id:uid}); });
  socket.on("disconnect",()=>{ const s=connectedUsers.get(uid); if(s){s.delete(socket.id); if(!s.size) connectedUsers.delete(uid);} });
});

app.post("/emit/user/:uid",(req,res)=>{
  if(req.headers["x-internal-key"]!==process.env.INTERNAL_SECRET) return res.status(401).json({success:false,error:"Unauthorised"});
  const {event,data}=req.body;
  if(!event) return res.status(400).json({success:false,error:"event required"});
  emitToUser(parseInt(req.params.uid),event,data);
  res.json({success:true,sockets_reached:connectedUsers.get(parseInt(req.params.uid))?.size||0});
});

app.post("/emit/order/:oid",(req,res)=>{
  if(req.headers["x-internal-key"]!==process.env.INTERNAL_SECRET) return res.status(401).json({success:false,error:"Unauthorised"});
  const {event,data}=req.body;
  io.to(`order:${req.params.oid}`).emit(event,data);
  res.json({success:true,room:`order:${req.params.oid}`});
});

app.get("/health",(req,res)=>res.json({service:"realtime-service",status:"ok",port:PORT,connected_users:connectedUsers.size,total_sockets:io.engine.clientsCount}));

setupRedis().then(()=>server.listen(PORT,()=>logger.info(`✅ Realtime Service running on port ${PORT}`)));
module.exports={app,server,io,emitToUser};
