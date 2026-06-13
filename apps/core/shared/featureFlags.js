const axios=require("axios");const FLAG_URL=process.env.FEATURE_FLAG_SERVICE_URL||"http://localhost:4019";const CACHE_TTL=10000;const cache=new Map();
async function isEnabled(flagName){const hit=cache.get(flagName);if(hit&&Date.now()-hit.ts<CACHE_TTL)return hit.enabled;try{const res=await axios.get(`${FLAG_URL}/flags/${flagName}`,{timeout:1000});const enabled=res.data?.enabled!==false;cache.set(flagName,{enabled,ts:Date.now()});return enabled;}catch(_){return true;}}
function requireFlag(flagName,errorMessage){return async(req,res,next)=>{const enabled=await isEnabled(flagName);if(!enabled)return res.status(503).json({success:false,error:errorMessage||`Feature temporarily unavailable`,flag:flagName});next();};}
module.exports={isEnabled,requireFlag};
